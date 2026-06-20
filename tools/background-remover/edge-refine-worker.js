/**
 * edge-refine-worker.js — Off-thread alpha edge refinement (guided-filter style matting)
 *
 * Goal: take the AI's binary-ish alpha mask + the original RGB pixels and produce a
 * softer, more detail-preserving alpha specifically along the foreground/background
 * boundary (hair strands, fabric texture, fuzzy edges) — WITHOUT ever touching RGB,
 * WITHOUT blocking the main thread, and WITHOUT ever crashing into a "solid background"
 * state. If anything goes wrong, we postMessage back the original alpha untouched.
 *
 * Only a narrow band around the existing alpha edge is processed (not the whole image),
 * which keeps this fast even on large (2560x1400+) photos.
 */

self.onmessage = function (e) {
  const { id, width, height, rgba, bandPx, strength } = e.data;

  try {
    const w = width, h = height;
    const src = new Uint8ClampedArray(rgba); // original RGBA pixels (untouched, used only as guide)
    const n = w * h;

    // 1) Extract alpha + find the edge band (pixels near the foreground/background boundary)
    const alphaIn = new Uint8Array(n);
    for (let i = 0; i < n; i++) alphaIn[i] = src[i * 4 + 3];

    const band = bandPx || 22; // how many px around the edge to refine
    const isEdge = new Uint8Array(n); // 1 = needs refinement

    // Quick edge detection: a pixel is "near edge" if a neighbor at radius `band/4` (cheap pass)
    // has a different alpha. Threshold lowered from 40 -> 15 so partial/soft alpha values
    // (very common in hair/fuzzy regions, where the AI is unsure and gives 30-200 instead of
    // a hard 0/255) are still picked up as edge pixels and get refined, not skipped.
    const step = Math.max(2, Math.round(band / 4));
    let edgeFlagCount = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const a = alphaIn[idx];
        let edge = false;
        const checks = [
          [x - step, y], [x + step, y], [x, y - step], [x, y + step]
        ];
        for (let c = 0; c < 4; c++) {
          const cx = checks[c][0], cy = checks[c][1];
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          const na = alphaIn[cy * w + cx];
          if (Math.abs(na - a) > 15) { edge = true; break; }
        }
        // Also flag any pixel that already has partial alpha (1-254) — these are exactly
        // the soft/uncertain hair-edge pixels we most want to refine, even if their
        // immediate neighbors happen to look similar.
        if (!edge && a > 0 && a < 255) edge = true;
        if (edge) { isEdge[idx] = 1; edgeFlagCount++; }
      }
    }

    // 2) Dilate the edge flag outward by `band` px so we cover the full transition zone
    //    (cheap separable dilation using a small radius, only on flagged pixels' bbox)
    const edgeDilated = new Uint8Array(n);
    const r = Math.max(3, Math.round(band / 2));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!isEdge[idx]) continue;
        const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
        const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
        for (let ny = y0; ny <= y1; ny++) {
          const rowBase = ny * w;
          for (let nx = x0; nx <= x1; nx++) {
            edgeDilated[rowBase + nx] = 1;
          }
        }
      }
    }

    // 3) Guided-filter-ish refinement, applied ONLY to flagged pixels:
    //    new_alpha = weighted blend of neighborhood alpha, weighted by color similarity
    //    to the center pixel (so it follows hair strands / texture edges instead of
    //    blindly blurring across them).
    const alphaOut = new Uint8Array(alphaIn); // start as a copy — safe fallback baseline
    const rad = Math.max(3, Math.round(band / 2.5));
    const sFactor = (typeof strength === 'number' ? strength : 0.85);
    let refinedCount = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!edgeDilated[idx]) continue;

        const cIdx = idx * 4;
        const cr = src[cIdx], cg = src[cIdx + 1], cb = src[cIdx + 2];

        let wsum = 0, asum = 0;
        const x0 = Math.max(0, x - rad), x1 = Math.min(w - 1, x + rad);
        const y0 = Math.max(0, y - rad), y1 = Math.min(h - 1, y + rad);

        for (let ny = y0; ny <= y1; ny++) {
          const rowBase = ny * w;
          for (let nx = x0; nx <= x1; nx++) {
            const nIdx = rowBase + nx;
            const nPix = nIdx * 4;
            const nr = src[nPix], ng = src[nPix + 1], nb = src[nPix + 2];
            // color-similarity weight (closer color => more influence) — this is what
            // makes the filter "edge-aware" so it doesn't smear across hair strands.
            // Widened color tolerance (4000 -> 9000) so faint, low-alpha hair-strand
            // pixels (which tend to be partially blended with the background color
            // already) still get meaningful weight instead of being treated as
            // "too different" and ignored.
            const dr = cr - nr, dg = cg - ng, db = cb - nb;
            const colorDist = dr * dr + dg * dg + db * db;
            const spatialDist = (nx - x) * (nx - x) + (ny - y) * (ny - y);
            const weight = Math.exp(-colorDist / 9000) * Math.exp(-spatialDist / (2 * rad * rad));
            wsum += weight;
            asum += weight * alphaIn[nIdx];
          }
        }

        if (wsum > 0) {
          const refined = asum / wsum;
          alphaOut[idx] = Math.round(alphaIn[idx] * (1 - sFactor) + refined * sFactor);
          refinedCount++;
        }
      }
    }

    // 4) Write refined alpha back into a fresh RGBA buffer — RGB is NEVER modified,
    //    so there is no possibility of this producing a solid-color background.
    const out = new Uint8ClampedArray(src); // copy original RGB+old alpha
    for (let i = 0; i < n; i++) out[i * 4 + 3] = alphaOut[i];

    self.postMessage({ id, ok: true, rgba: out.buffer, edgePixelCount: refinedCount }, [out.buffer]);
  } catch (err) {
    // Never let a worker error corrupt the image — caller will fall back to the
    // original unrefined mask it already has.
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
