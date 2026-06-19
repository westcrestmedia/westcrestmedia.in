/**
 * image-resizer-mobile.js — MOBILE-ONLY UI behaviour for Image Resizer Pro
 * Loaded after image-resizer.js. Does nothing on desktop widths.
 * Pair file: image-resizer-mobile.css
 *
 * What it does:
 *  1. Swaps "Drop image(s) here" copy → "Select Your Image" / "Choose Image"
 *  2. Shrinks the upload box once an image is chosen (ir-mobile-compact)
 *  3. Re-parents the real Resize/Download/Zip buttons into a sticky bottom
 *     bar (same elements, same ids — no logic duplicated, no listeners lost)
 */
(function () {
  var MQ = '(max-width: 768px)';
  if (!window.matchMedia(MQ).matches) return; // desktop: do nothing

  function init() {
    var dz = document.getElementById('dropZone');
    var emptyState = document.getElementById('emptyState');
    if (!dz || !emptyState) return;

    /* 0. Settings now live at the bottom (see mobile CSS reorder) —
       start every section collapsed, including Dimensions, so the
       block looks compact and the person opens only what they need */
    var accDims = document.getElementById('accDims');
    if (accDims) accDims.classList.remove('open');

    /* 1. Copy swap */
    var title = dz.querySelector('.ir-dz-title');
    var sub = dz.querySelector('.ir-dz-sub');
    var btn = dz.querySelector('.ir-btn-upload');
    if (title) title.textContent = 'Select Your Image';
    if (sub) sub.innerHTML = 'JPG · PNG · WEBP · GIF · BMP · AVIF<br>Up to 50 images · 100% private';
    if (btn) btn.textContent = 'Choose Image';

    /* 2 & 3. Build sticky bottom action bar and move the REAL action
       elements into it (preserves ids + existing onclick handlers) */
    var bar = document.createElement('div');
    bar.className = 'ir-mobile-actionbar';
    bar.id = 'mobileActionBar';
    document.body.appendChild(bar);

    var single = document.getElementById('sidebarActionsTop');
    var batch = document.getElementById('sidebarBatchActionsTop');
    if (single) bar.appendChild(single);
    if (batch) bar.appendChild(batch);

    /* Watch for image-upload state changes (empty → single/batch view)
       and toggle compact box + bottom bar visibility accordingly */
    var mo = new MutationObserver(function () {
      var hasImage = emptyState.style.display === 'none';
      dz.classList.toggle('ir-mobile-compact', hasImage);
      bar.classList.toggle('on', hasImage);
      document.body.classList.toggle('ir-mobile-bar-on', hasImage);
    });
    mo.observe(emptyState, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
