/**
 * image-converter.js — Tool logic for Image Converter
 * Depends on: jsPDF, heic2any, JSZip (loaded via CDN in HTML)
 */

/* ── STATE ── */
let jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
let files          = [];
let outputFormat   = 'jpg';
let convertedBlobs = {};
let selectedMobileIndex = 0; // which image is shown in left preview box

/* ── DOM REFS ── */
const slider     = document.getElementById('quality-slider');
const qualityVal = document.getElementById('quality-val');
const dropZone   = document.getElementById('drop-zone');

/* ── FORMAT BUTTONS ── */
document.querySelectorAll('.fmt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    outputFormat = btn.dataset.fmt;

    const lossless = ['png', 'gif', 'bmp', 'ico', 'svg', 'wbmp', 'pdf'];
    const qWrap = slider.closest('.quality-wrap');
    const isLossless = lossless.includes(outputFormat);
    qWrap.style.opacity = isLossless ? '0.35' : '1';
    slider.disabled = isLossless;
  });
});

/* ── QUALITY SLIDER ── */
slider.addEventListener('input', () => {
  qualityVal.textContent = slider.value + '%';
});

/* ── DROP ZONE EVENTS ── */
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files]);
});
dropZone.addEventListener('click', e => {
  if (e.target.closest('.drop-zone__browse--mobile')) return;
  if (window.innerWidth <= 640) return;
  document.getElementById('file-input').click();
});
document.getElementById('file-input').addEventListener('change', e => handleFiles([...e.target.files]));

/* ── IMAGE RESOLUTION HELPER ── */
function getImageResolution(file) {
  return new Promise((resolve) => {
    if (file.name.toLowerCase().match(/\.heic|\.heif/)) { resolve({ w: '—', h: '—' }); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: '—', h: '—' }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/* ── FILE HANDLING ── */
async function handleFiles(newFiles) {
  const imageFiles = newFiles.filter(f =>
    f.type.startsWith('image/') || f.name.toLowerCase().match(/\.(heic|heif|wbmp)$/)
  );
  files = [...files, ...imageFiles];
  convertedBlobs = {};
  renderFileList();
  updateActionBar();
  const tip = document.getElementById('pro-tip');
  if (tip) tip.style.display = files.length > 0 ? 'block' : 'none';

  // Mobile: switch to compact UI after first file
  if (window.innerWidth <= 640 && files.length > 0) {
    buildMobileUI();
  }
}

function removeFile(index) {
  files.splice(index, 1);
  delete convertedBlobs[index];
  const newBlobs = {};
  Object.keys(convertedBlobs).forEach(k => {
    const ki = parseInt(k);
    if (ki > index)      newBlobs[ki - 1] = convertedBlobs[k];
    else if (ki < index) newBlobs[ki]      = convertedBlobs[k];
  });
  convertedBlobs = newBlobs;

  if (selectedMobileIndex >= files.length) selectedMobileIndex = Math.max(0, files.length - 1);

  if (window.innerWidth <= 640) {
    if (files.length === 0) {
      destroyMobileUI();
    } else {
      buildMobileUI();
    }
  }

  renderFileList();
  updateActionBar();
  const tip = document.getElementById('pro-tip');
  if (tip) tip.style.display = files.length > 0 ? 'block' : 'none';
}

/* ══════════════════════════════════════════
   MOBILE UI
══════════════════════════════════════════ */
function buildMobileUI() {
  // Hide original drop zone and desktop file list on mobile
  dropZone.style.display = 'none';
  const fileList = document.getElementById('file-list');
  if (fileList) fileList.style.display = 'none';

  let mobileUI = document.getElementById('mobile-ui');
  if (!mobileUI) {
    mobileUI = document.createElement('div');
    mobileUI.id = 'mobile-ui';
    mobileUI.className = 'mobile-ui';
    dropZone.parentNode.insertBefore(mobileUI, dropZone.nextSibling);
  }

  const selFile = files[selectedMobileIndex];
  const inputFmt = selFile ? selFile.name.split('.').pop().toUpperCase() : '—';
  const inputSize = selFile ? formatSize(selFile.size) : '—';

  // Build preview src
  let previewSrc = '';
  if (selFile && !selFile.name.toLowerCase().match(/\.heic|\.heif/)) {
    previewSrc = URL.createObjectURL(selFile);
  }

  // Thumbnail strip — each thumb has select, download (if converted), remove
  const thumbsHTML = files.map((f, i) => {
    const isHeic = f.name.toLowerCase().match(/\.heic|\.heif/);
    const thumbSrc = isHeic ? '' : URL.createObjectURL(f);
    const isActive = i === selectedMobileIndex ? 'mob-thumb--active' : '';
    const isDone   = !!convertedBlobs[i];
    return `
    <div class="mob-thumb-wrap">
      <div class="mob-thumb ${isActive}" onclick="selectMobileImage(${i})" data-index="${i}">
        ${isHeic
          ? `<div class="mob-thumb__heic">HEIC</div>`
          : `<img src="${thumbSrc}" alt="${f.name}">`
        }
        ${isDone ? `<div class="mob-thumb__done">✓</div>` : ''}
      </div>
      <div class="mob-thumb-actions">
        ${isDone
          ? `<button class="mob-act-btn mob-act-btn--dl" onclick="event.stopPropagation();downloadFile(${i})" title="Download">↓</button>`
          : `<button class="mob-act-btn mob-act-btn--dl mob-act-btn--disabled" disabled title="Convert first">↓</button>`
        }
        <button class="mob-act-btn mob-act-btn--rm" onclick="event.stopPropagation();removeFile(${i})" title="Remove">✕</button>
      </div>
    </div>`;
  }).join('');

  // Input detail of selected file
  const convBlob = convertedBlobs[selectedMobileIndex];
  const outputDetailHTML = convBlob ? `
    <div class="mob-detail__row mob-detail__row--out">
      <span class="mob-detail__label">Output</span>
      <span class="mob-detail__chip">${outputFormat.toUpperCase()}</span>
      <span class="mob-detail__val" id="mob-out-res">—</span>
      <span class="mob-detail__val">${formatSize(convBlob.blob.size)}</span>
    </div>` : '';

  mobileUI.innerHTML = `
    <div class="mob-boxes">
      <!-- TOP: Preview Box -->
      <div class="mob-box mob-box--preview">
        <div class="mob-preview-img">
          ${previewSrc
            ? `<img src="${previewSrc}" alt="preview" id="mob-preview-img">`
            : `<div class="mob-preview-placeholder"><svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" fill="none" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`
          }
        </div>
        <div class="mob-detail">
          <div class="mob-detail__name">${selFile ? selFile.name : ''}</div>
          <div class="mob-detail__row mob-detail__row--in">
            <span class="mob-detail__label">Input</span>
            <span class="mob-detail__chip">${inputFmt}</span>
            <span class="mob-detail__val" id="mob-in-res">—</span>
            <span class="mob-detail__val">${inputSize}</span>
          </div>
          ${outputDetailHTML}
        </div>
      </div>

      <!-- BOTTOM ROW: Files strip + Add More -->
      <div class="mob-bottom-row">
        <div class="mob-box mob-box--files">
          <div class="mob-thumb-strip">
            ${thumbsHTML}
          </div>
        </div>
        <div class="mob-box mob-box--add" onclick="document.getElementById('file-input').click()">
          <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span>Add More</span>
        </div>
      </div>
    </div>
  `;

  // Fetch resolution for selected image
  if (selFile) {
    getImageResolution(selFile).then(({ w, h }) => {
      const el = document.getElementById('mob-in-res');
      if (el) el.textContent = (w !== '—') ? `${w}×${h}` : '—';

      // Output resolution (same canvas size)
      const outEl = document.getElementById('mob-out-res');
      if (outEl) outEl.textContent = (w !== '—') ? `${w}×${h}` : '—';
    });
  }
}

function selectMobileImage(index) {
  selectedMobileIndex = index;
  buildMobileUI();
}

function destroyMobileUI() {
  const mobileUI = document.getElementById('mobile-ui');
  if (mobileUI) mobileUI.remove();
  dropZone.style.display = '';
  const fileList = document.getElementById('file-list');
  if (fileList) fileList.style.display = '';
}

/* ── RENDER FILE LIST (desktop) ── */
function renderFileList() {
  const list = document.getElementById('file-list');
  // On mobile, the mobile-ui handles display — desktop list stays empty/hidden
  if (window.innerWidth <= 640) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '';

  files.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.id = 'item-' + i;

    const img = document.createElement('img');
    img.className = 'file-thumb';
    img.alt = file.name;
    if (!file.name.toLowerCase().match(/\.heic|\.heif/)) {
      img.src = URL.createObjectURL(file);
    } else {
      img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42"><rect width="42" height="42" rx="6" fill="%231c1c26"/><text y="26" x="21" text-anchor="middle" font-size="14" fill="%23c9a84c">HEIC</text></svg>';
    }

    // Input details panel
    const infoWrap = document.createElement('div');
    infoWrap.className = 'file-info';
    infoWrap.innerHTML = `
      <div class="file-name">${file.name}</div>
      <div class="file-details-grid">
        <div class="file-detail-col file-detail-col--in">
          <div class="file-detail-head">Input</div>
          <div class="file-meta">
            <span class="file-detail-fmt">${file.name.split('.').pop().toUpperCase()}</span>
            <span class="file-detail-res" id="in-res-${i}">—</span>
            <span class="file-detail-size">${formatSize(file.size)}</span>
          </div>
        </div>
        <div class="file-detail-col file-detail-col--out" id="out-col-${i}" style="display:none;">
          <div class="file-detail-head">Output</div>
          <div class="file-meta">
            <span class="file-detail-fmt" id="out-fmt-${i}">—</span>
            <span class="file-detail-res" id="out-res-${i}">—</span>
            <span class="file-detail-size" id="out-size-${i}">—</span>
          </div>
        </div>
      </div>
    `;

    // Fetch input resolution
    getImageResolution(file).then(({ w, h }) => {
      const el = document.getElementById('in-res-' + i);
      if (el) el.textContent = (w !== '—') ? `${w}×${h}` : '—';
    });

    const progress = document.createElement('div');
    progress.className = 'file-item__progress';
    progress.id = 'progress-' + i;

    const status = document.createElement('span');
    status.className = 'file-status status-pending';
    status.id = 'status-' + i;
    status.textContent = 'Pending';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.title = 'Remove file';
    removeBtn.onclick = (e) => { e.stopPropagation(); removeFile(i); };

    item.appendChild(progress);
    item.appendChild(img);
    item.appendChild(infoWrap);
    item.appendChild(status);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

/* ── ACTION BAR ── */
function updateActionBar() {
  const bar        = document.getElementById('action-bar');
  const clearBtn   = document.getElementById('clear-btn');
  const dlBtn      = document.getElementById('download-all-btn');
  const convertBtn = document.getElementById('convert-btn');
  const zipBtn     = document.getElementById('download-zip-btn');

  if (files.length === 0) { bar.style.display = 'none'; return; }

  bar.style.display = 'flex';
  clearBtn.style.display = 'block';
  document.getElementById('file-count-num').textContent = files.length;
  convertBtn.textContent = files.length === 1 ? 'Convert' : 'Convert All';

  const doneCount = Object.keys(convertedBlobs).length;
  dlBtn.style.display = doneCount > 0 ? 'block' : 'none';
  if (zipBtn) zipBtn.style.display = (doneCount > 1 && outputFormat !== 'pdf') ? 'block' : 'none';
}

/* ── CONVERSION ── */
async function convertAll() {
  if (files.length === 0) return;
  const btn = document.getElementById('convert-btn');
  btn.disabled = true;
  btn.textContent = 'Converting…';
  convertedBlobs = {};

  if (outputFormat === 'pdf') {
    await convertToPDF();
  } else {
    for (let i = 0; i < files.length; i++) {
      await convertImage(files[i], i);
    }
  }

  btn.disabled = false;
  btn.textContent = files.length === 1 ? 'Convert Again' : 'Convert All Again';
  updateActionBar();

  // Refresh mobile UI to show output details
  if (window.innerWidth <= 640 && files.length > 0) {
    buildMobileUI();
  }
}

function animateProgress(id, duration) {
  const bar = document.getElementById('progress-' + id);
  if (!bar) return;
  bar.style.width = '0%';
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    bar.style.width = (t * 100) + '%';
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function convertImage(file, index) {
  return new Promise((resolve) => {
    const statusEl = document.getElementById('status-' + index);
    const item     = document.getElementById('item-' + index);

    if (statusEl) { statusEl.className = 'file-status status-converting'; statusEl.innerHTML = '<span class="spinner"></span>Converting'; }
    animateProgress(index, 1200);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        const needsWhiteBg = ['jpg', 'bmp', 'tiff', 'pdf', 'ico'].includes(outputFormat);
        if (needsWhiteBg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
        ctx.drawImage(img, 0, 0);

        const quality = parseInt(slider.value) / 100;

        let exportCanvas = canvas;
        if (outputFormat === 'ico') {
          exportCanvas = document.createElement('canvas');
          const icoSize = Math.min(canvas.width, canvas.height, 256);
          exportCanvas.width  = icoSize;
          exportCanvas.height = icoSize;
          const ictx = exportCanvas.getContext('2d');
          ictx.fillStyle = '#ffffff';
          ictx.fillRect(0, 0, icoSize, icoSize);
          ictx.drawImage(canvas, 0, 0, icoSize, icoSize);
        }

        const mimeMap = {
          jpg:'image/jpeg', png:'image/png', webp:'image/webp', avif:'image/avif',
          bmp:'image/bmp', gif:'image/gif', tiff:'image/png', ico:'image/png',
          svg:'image/png', wbmp:'image/png',
        };
        const mimeType = mimeMap[outputFormat] || 'image/png';

        exportCanvas.toBlob((blob) => {
          if (!blob) {
            if (statusEl) { statusEl.className = 'file-status status-error'; statusEl.textContent = 'Error'; }
            if (item) item.classList.add('is-error');
            resolve(); return;
          }

          convertedBlobs[index] = { blob, name: getOutputName(file.name) };
          if (statusEl) { statusEl.className = 'file-status status-done'; statusEl.textContent = '✓ Done'; }
          if (item) item.classList.add('is-done');

          // Update desktop output details
          const outCol = document.getElementById('out-col-' + index);
          if (outCol) {
            outCol.style.display = '';
            document.getElementById('out-fmt-' + index).textContent  = outputFormat.toUpperCase();
            document.getElementById('out-res-' + index).textContent  = `${exportCanvas.width}×${exportCanvas.height}`;
            document.getElementById('out-size-' + index).textContent = formatSize(blob.size);
          }

          if (item) {
            item.querySelector('.dl-btn')?.remove();
            const dlBtn = document.createElement('button');
            dlBtn.className   = 'dl-btn';
            dlBtn.textContent = '↓ Download';
            dlBtn.onclick     = () => downloadFile(index);
            item.insertBefore(dlBtn, item.querySelector('.remove-btn'));
          }
          resolve();
        }, mimeType, quality);
      };

      img.onerror = async () => {
        if (file.name.toLowerCase().match(/\.heic|\.heif/)) {
          try {
            if (statusEl) statusEl.innerHTML = '<span class="spinner"></span>Decoding HEIC';
            const heic2any = window.heic2any;
            if (heic2any) {
              const heicBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
              const url = URL.createObjectURL(heicBlob instanceof Blob ? heicBlob : heicBlob[0]);
              const img2 = new Image();
              img2.onload = () => {
                const c2 = document.createElement('canvas');
                c2.width  = img2.naturalWidth;
                c2.height = img2.naturalHeight;
                const cx2 = c2.getContext('2d');
                cx2.fillStyle = '#ffffff';
                cx2.fillRect(0, 0, c2.width, c2.height);
                cx2.drawImage(img2, 0, 0);
                const mm = {
                  jpg:'image/jpeg', png:'image/png', webp:'image/webp',
                  avif:'image/avif', bmp:'image/bmp', gif:'image/gif',
                  tiff:'image/png', ico:'image/png', svg:'image/png', wbmp:'image/png',
                };
                c2.toBlob((b) => {
                  convertedBlobs[index] = { blob: b, name: getOutputName(file.name) };
                  if (statusEl) { statusEl.className = 'file-status status-done'; statusEl.textContent = '✓ Done'; }
                  if (item) {
                    item.classList.add('is-done');
                    const outCol = document.getElementById('out-col-' + index);
                    if (outCol) {
                      outCol.style.display = '';
                      document.getElementById('out-fmt-' + index).textContent  = outputFormat.toUpperCase();
                      document.getElementById('out-res-' + index).textContent  = `${c2.width}×${c2.height}`;
                      document.getElementById('out-size-' + index).textContent = formatSize(b.size);
                    }
                    item.querySelector('.dl-btn')?.remove();
                    const dlBtn = document.createElement('button');
                    dlBtn.className   = 'dl-btn';
                    dlBtn.textContent = '↓ Download';
                    dlBtn.onclick     = () => downloadFile(index);
                    item.insertBefore(dlBtn, item.querySelector('.remove-btn'));
                  }
                  URL.revokeObjectURL(url);
                  resolve();
                }, mm[outputFormat] || 'image/jpeg', parseInt(slider.value) / 100);
              };
              img2.onerror = () => {
                if (statusEl) { statusEl.className = 'file-status status-error'; statusEl.textContent = 'HEIC Error'; }
                if (item) item.classList.add('is-error');
                resolve();
              };
              img2.src = url;
              return;
            }
          } catch {
            if (statusEl) { statusEl.className = 'file-status status-error'; statusEl.textContent = 'HEIC Error'; }
            if (item) item.classList.add('is-error');
            resolve(); return;
          }
        }
        if (statusEl) { statusEl.className = 'file-status status-error'; statusEl.textContent = 'Error'; }
        if (item) item.classList.add('is-error');
        resolve();
      };

      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function convertToPDF() {
  jsPDF = window.jspdf ? window.jspdf.jsPDF : jsPDF;

  files.forEach((_, i) => {
    const s = document.getElementById('status-' + i);
    if (s) { s.className = 'file-status status-converting'; s.innerHTML = '<span class="spinner"></span>Processing'; }
    animateProgress(i, 2000);
  });

  const imageDataUrls = await Promise.all(files.map(file => new Promise((res) => {
    const reader = new FileReader();
    reader.onload  = e => res(e.target.result);
    reader.onerror = () => res(null);
    reader.readAsDataURL(file);
  })));

  try {
    const pdf = new jsPDF({ unit: 'px', compress: true });
    let firstPage = true;

    for (let i = 0; i < imageDataUrls.length; i++) {
      const dataUrl = imageDataUrls[i];
      if (!dataUrl) continue;

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const pw    = pdf.internal.pageSize.getWidth();
          const ph    = pdf.internal.pageSize.getHeight();
          const ratio = Math.min(pw / img.naturalWidth, ph / img.naturalHeight);
          const w = img.naturalWidth  * ratio;
          const h = img.naturalHeight * ratio;
          const x = (pw - w) / 2;
          const y = (ph - h) / 2;
          if (!firstPage) pdf.addPage();
          firstPage = false;
          pdf.addImage(dataUrl, files[i].type.includes('png') ? 'PNG' : 'JPEG', x, y, w, h);
          const s = document.getElementById('status-' + i);
          if (s) { s.className = 'file-status status-done'; s.textContent = '✓ Added'; }
          const it = document.getElementById('item-' + i);
          if (it) it.classList.add('is-done');
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }

    const pdfBlob = pdf.output('blob');
    convertedBlobs['pdf'] = { blob: pdfBlob, name: 'converted-images.pdf' };

    const item = document.getElementById('item-0');
    if (item) {
      item.querySelector('.dl-btn')?.remove();
      const dlBtn = document.createElement('button');
      dlBtn.className   = 'dl-btn';
      dlBtn.textContent = '↓ Download PDF';
      dlBtn.onclick     = () => {
        const a = document.createElement('a');
        a.href    = URL.createObjectURL(pdfBlob);
        a.download = 'converted-images.pdf';
        a.click();
      };
      item.insertBefore(dlBtn, item.querySelector('.remove-btn'));
    }
  } catch (err) {
    console.error('PDF error:', err);
    files.forEach((_, i) => {
      const s = document.getElementById('status-' + i);
      if (s) { s.className = 'file-status status-error'; s.textContent = 'Error'; }
    });
  }
}

/* ── HELPERS ── */
function getOutputName(originalName) {
  const base   = originalName.replace(/\.[^/.]+$/, '');
  const extMap = { jpg:'jpg', png:'png', webp:'webp', avif:'avif', bmp:'bmp', gif:'gif', tiff:'tiff', ico:'ico', svg:'svg', wbmp:'wbmp', pdf:'pdf' };
  return base + '.' + (extMap[outputFormat] || outputFormat);
}

function formatSize(bytes) {
  if (bytes < 1024)           return bytes + ' B';
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/* ── DOWNLOAD ── */
function downloadFile(index) {
  const { blob, name } = convertedBlobs[index];
  const a = document.createElement('a');
  a.href    = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function downloadAll() {
  if (outputFormat === 'pdf' && convertedBlobs['pdf']) {
    const a = document.createElement('a');
    a.href    = URL.createObjectURL(convertedBlobs['pdf'].blob);
    a.download = 'converted-images.pdf';
    a.click();
    return;
  }
  Object.keys(convertedBlobs).forEach(idx => {
    setTimeout(() => downloadFile(idx), idx * 220);
  });
}

async function downloadZip() {
  const keys = Object.keys(convertedBlobs);
  if (keys.length === 0) return;

  const zipBtn  = document.getElementById('download-zip-btn');
  const origTxt = zipBtn.textContent;
  zipBtn.textContent = 'Preparing…';
  zipBtn.disabled    = true;

  const zip = new JSZip();
  for (const idx of keys) {
    const { blob, name } = convertedBlobs[idx];
    zip.file(name, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href    = URL.createObjectURL(zipBlob);
  a.download = 'converted-images.zip';
  a.click();

  zipBtn.textContent = origTxt;
  zipBtn.disabled    = false;
}

function clearAll() {
  files = [];
  convertedBlobs = {};
  selectedMobileIndex = 0;
  destroyMobileUI();
  document.getElementById('file-list').innerHTML = '';
  document.getElementById('file-input').value    = '';
  document.getElementById('pro-tip').style.display = 'none';
  document.getElementById('convert-btn').textContent = 'Convert';
  updateActionBar();
}

/* ── FAQ ── */
function toggleFaq(el) {
  document.querySelectorAll('.faq-item.is-open').forEach(item => {
    if (item !== el) item.classList.remove('is-open');
  });
  el.classList.toggle('is-open');
}