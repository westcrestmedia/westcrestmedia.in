/**
 * background-remover.js — Tool logic for AI Background Remover Pro
 * External deps: @imgly/background-removal (dynamic CDN import), JSZip (loaded via CDN <script> in HTML)
 */

/* ── AI MODEL LOADER ── */
const LIB_VERSION = '1.5.5';
let removeBackground = null;
async function loadLib() {
  if (removeBackground) return removeBackground;
  const mod = await import(`https://cdn.jsdelivr.net/npm/@imgly/background-removal@${LIB_VERSION}/+esm`);
  removeBackground = mod.removeBackground || mod.default || Object.values(mod).find(v=>typeof v==='function');
  if (!removeBackground) throw new Error('removeBackground not found');
  return removeBackground;
}

/* ── BATCH STATE ── */
const MAX_BATCH = 20;
let items = []; // { id, file, origBlob, resultCanvas, status, name, bgSnapshot }
let activeId = null;
let editorOpened = false; // once editor opens, never auto-open again
let batchLoopRunning = false; // hard lock — prevents two addFiles() calls from both starting a processing loop

/* ── EDITOR STATE ── */
let wCanvas = null, wCtx = null, origData = null;
let brushMode = null, isPainting = false;
window.brushSize = 20;
window.smartEdge = false;       // desktop smart-edge toggle
window.smartEdgeTol = 30;       // colour tolerance 0-100
const MAX_UNDO = 30;
let undoStack = [], redoStack = [];
let zoom = 1, panX = 0, panY = 0, isPanning = false, panStart = {x:0,y:0}, spaceDown = false;
let beforeAfterMode = false; // true = showing original "before" image
window._baMode = false;
let baseW = 0, baseH = 0;
let currentBgColor = 'transparent';
let currentPhotoBg = null; // { url, img }
let eventsReady = false;

// Shadow / blur state
let shadowEnabled = false;
let shadowColor = '#000000', shadowOpacity = 60, shadowBlur = 20, shadowDistance = 10, shadowAngle = 135;
let bgBlur = 0;

// Outline state
let outlineEnabled = false;
let outlineColor = '#ffffff', outlineWidth = 4;

// Glow state
let glowEnabled = false;
let glowColor = '#c8a96e', glowStrength = 60, glowBlur = 20;

// Feather state
let featherRadius = 0;

/* ── FEATHER: soften edges of alpha mask ── */
function applyFeatherToCanvas(srcCanvas, radius) {
  if (!radius || radius <= 0) return srcCanvas;
  const w = srcCanvas.width, h = srcCanvas.height;

  // Step 1: extract alpha channel
  const tmp = document.createElement('canvas'); tmp.width=w; tmp.height=h;
  const tCtx = tmp.getContext('2d');
  tCtx.drawImage(srcCanvas, 0, 0);
  const imgData = tCtx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Step 2: build alpha-only array, then gaussian blur it
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i*4+3] / 255;

  // Simple box blur approximation (3 passes ≈ gaussian)
  const r = Math.round(radius);
  const blurred = boxBlurAlpha(alpha, w, h, r);

  // Step 3: write blurred alpha back into the canvas pixels
  const out = document.createElement('canvas'); out.width=w; out.height=h;
  const oCtx = out.getContext('2d');
  oCtx.drawImage(srcCanvas, 0, 0);
  const outData = oCtx.getImageData(0, 0, w, h);
  const od = outData.data;
  for (let i = 0; i < w * h; i++) {
    od[i*4+3] = Math.round(blurred[i] * 255);
  }
  oCtx.putImageData(outData, 0, 0);
  return out;
}

function boxBlurAlpha(alpha, w, h, r) {
  let src = new Float32Array(alpha);
  let dst = new Float32Array(w * h);
  const passes = 3;
  for (let p = 0; p < passes; p++) {
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      let sum = 0, count = 0;
      for (let x = -r; x <= r; x++) {
        const xi = Math.max(0, Math.min(w-1, x));
        sum += src[y*w + xi]; count++;
      }
      for (let x = 0; x < w; x++) {
        dst[y*w + x] = sum / count;
        const addX = Math.min(w-1, x+r+1);
        const remX = Math.max(0, x-r);
        sum += src[y*w + addX] - src[y*w + remX];
      }
    }
    // Vertical pass
    const tmp2 = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let y = -r; y <= r; y++) {
        const yi = Math.max(0, Math.min(h-1, y));
        sum += dst[yi*w + x]; count++;
      }
      for (let y = 0; y < h; y++) {
        tmp2[y*w + x] = sum / count;
        const addY = Math.min(h-1, y+r+1);
        const remY = Math.max(0, y-r);
        sum += dst[addY*w + x] - dst[remY*w + x];
      }
    }
    src = tmp2;
  }
  return src;
}

// Subject transform (independent of canvas zoom/pan)
let subjectScale = 1, subjectX = 0, subjectY = 0, subjectRotation = 0;
let flipX = false, flipY = false;
let isDraggingSubject = false, subjectDragStart = {x:0,y:0};

// Background photo transform
let bgScale = 1, bgOffsetX = 0, bgOffsetY = 0;

const viewport  = document.getElementById('canvas-viewport');
const dc        = document.getElementById('display-canvas');
const dctx      = dc.getContext('2d', { willReadFrequently:true });
const cc        = document.getElementById('cursor-canvas');
const cctx      = cc.getContext('2d');

/* ── FILE INPUT ── */
const fileIn   = document.getElementById('file-in');
const dropZone = document.getElementById('drop-zone');

fileIn.addEventListener('change', e => { if (e.target.files.length) addFiles(Array.from(e.target.files)); });
if (window.innerWidth > 768) {
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/'));
    if (files.length) addFiles(files);
  });
}
dropZone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileIn.click(); });

/* ── ADD FILES ── */
function showUploadOverlay(title, sub) {
  document.getElementById('upload-overlay-title').textContent = title;
  document.getElementById('upload-overlay-sub').textContent = sub;
  document.getElementById('upload-overlay').classList.add('active');
}
function hideUploadOverlay() {
  document.getElementById('upload-overlay').classList.remove('active');
}

async function addFiles(files) {
  files = files.slice(0, MAX_BATCH - items.length);
  if (!files.length) return;

  const isSingle = files.length === 1;

  // Show upload reading animation
  showUploadOverlay(
    isSingle ? 'Loading Image…' : `Loading ${files.length} Images…`,
    isSingle ? 'Getting ready to process' : 'Queuing all images for processing'
  );

  // Brief delay so user sees the upload state
  await new Promise(r => setTimeout(r, 600));

  files.forEach(f => {
    items.push({ id: Date.now()+Math.random(), file:f, resultCanvas:null, status:'queued', name:f.name });
  });
  dropZone.classList.add('hidden');
  renderBatchGrid();
  updateBatchHeader();

  hideUploadOverlay();

  // Auto-process: single → direct, multi → sequential
  // Hard lock: if another addFiles() call is already running the processing loop,
  // just leave these items queued — that running loop will pick them up itself.
  if (batchLoopRunning) {
    renderBatchGrid();
    updateBatchHeader();
    return;
  }
  batchLoopRunning = true;

  try {
    if (isSingle) {
      // Single photo: go straight to processing
      const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
      const item = items[items.length - 1];
      await processItem(item);
      const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
      updateBatchHeader();
      if (item.status === 'done' && !editorOpened && !activeId) { editorOpened = true; await openEditor(item.id); }
      // Pick up any items that were queued by an overlapping addFiles() call while we were busy
      let extra;
      while ((extra = items.find(i => i.status === 'queued'))) {
        await processItem(extra);
        if (extra.status === 'done' && !editorOpened) { editorOpened = true; await openEditor(extra.id); }
      }
    } else {
      // Multiple photos: process sequentially, pick queued items dynamically so add-more items are included
      const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
      let next;
      while ((next = items.find(i => i.status === 'queued'))) {
        await processItem(next);
        if (next.status === 'done' && !editorOpened) {
          editorOpened = true;
          await openEditor(next.id);
        }
      }
      const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
      updateBatchHeader();
    }
  } finally {
    batchLoopRunning = false;
  }
}

function renderBatchGrid() {
  const grid = document.getElementById('batch-grid');
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'batch-card' + (item.id===activeId?' active-edit':'');
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="batch-thumb-wrap" id="thumb-${item.id}">
        <img class="batch-thumb" src="${item.resultCanvas ? '' : URL.createObjectURL(item.file)}" style="${item.resultCanvas?'display:none':''}">
        ${item.resultCanvas ? `<canvas width="${item.resultCanvas.width}" height="${item.resultCanvas.height}" style="max-width:100%;max-height:100%;"></canvas>` : ''}
        <span class="batch-status ${item.status}">${item.status==='queued'?'Queued':item.status==='processing'?'Processing…':item.status==='done'?'Done':'Error'}</span>
        <button class="batch-remove-btn" title="Remove image" onclick="removeItem('${item.id}');event.stopPropagation();" ${item.status==='processing'?'disabled':''}>✕</button>
        <div class="batch-progress-bar"><div class="batch-progress-fill" id="prog-${item.id}"></div></div>
        <div class="card-proc-overlay${item.status==='processing'?' active':''}">
          <div class="card-spinner"></div>
          <div class="card-proc-label">AI Processing</div>
        </div>
      </div>
      <div class="batch-card-footer">
        <span class="batch-name" title="${item.name}">${item.name}</span>
        <button class="batch-dl-btn" title="Download" ${item.status!=='done'?'disabled':''} onclick="downloadItem('${item.id}');event.stopPropagation();">⬇</button>
      </div>`;
    // Copy resultCanvas to card canvas
    if (item.resultCanvas) {
      const cvs = card.querySelector('canvas');
      if (cvs) cvs.getContext('2d').drawImage(item.resultCanvas, 0, 0);
    }
    card.addEventListener('click', () => { if (item.status==='done') openEditor(item.id, true); });
    grid.appendChild(card);
  });
  // Add more button — only show after at least 1 image has been added
  if (items.length > 0 && items.length < MAX_BATCH) {
    const addMore = document.createElement('div');
    addMore.className = 'batch-add-more';
    addMore.innerHTML = `<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add More</span><span class="batch-add-more-drag-text" style="font-size:10px;opacity:0.6;">or drag &amp; drop images here</span>`;
    addMore.addEventListener('click', () => fileIn.click());
    if (!isMobile()) {
      addMore.addEventListener('dragover', e => { e.preventDefault(); addMore.classList.add('drag-over'); });
      addMore.addEventListener('dragleave', () => addMore.classList.remove('drag-over'));
      addMore.addEventListener('drop', e => {
        e.preventDefault(); addMore.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length) addFiles(files);
      });
    }
    grid.appendChild(addMore);
  }
}

function updateBatchHeader() {
  const hdr = document.getElementById('batch-header');
  hdr.classList.toggle('active', items.length > 0);
  document.getElementById('batch-title-text').textContent = `${items.length} image${items.length!==1?'s':''}`;
  // btn-dl-all was part of the top toolbar that's no longer in the DOM; guard in case it's reintroduced
  const dlAllBtn = document.getElementById('btn-dl-all');
  if (dlAllBtn) {
    const allDone = items.length > 0 && items.every(i=>i.status==='done');
    dlAllBtn.style.display = allDone ? '' : 'none';
  }
}

/* ── REMOVE SINGLE ITEM ── */
window.removeItem = function(id) {
  const idx = items.findIndex(i => i.id == id);
  if (idx === -1) return;
  items.splice(idx, 1);
  // If removed item was active, close editor or open next done
  if (activeId == id) {
    activeId = null;
    wCanvas = null; wCtx = null; origData = null;
    document.getElementById('editor-wrap').classList.remove('active');
    document.getElementById('proc-overlay').classList.remove('active');
    mobShowToolbar(false);
    const nextDone = items.find(i => i.status === 'done');
    if (nextDone) openEditor(nextDone.id, true);
  }
  if (!items.length) {
    dropZone.classList.remove('hidden');
    document.getElementById('batch-header').classList.remove('active');
  }
  renderBatchGrid();
  updateBatchHeader();
};

/* ── PROCESS ALL ── */
window.processAll = async function() {
  const toProcess = items.filter(i=>i.status==='queued'||i.status==='error');
  if (!toProcess.length) return;
  if (batchLoopRunning) return; // another loop (addFiles) is already draining the queue
  batchLoopRunning = true;
  try {
    const _bpa1 = document.getElementById('btn-process-all'); if (_bpa1) _bpa1.disabled = true;
    for (const item of toProcess) {
      await processItem(item);
      if (item.status === 'done' && !editorOpened) {
        editorOpened = true;
        await openEditor(item.id);
      }
    }
    const _bpa2 = document.getElementById('btn-process-all'); if (_bpa2) _bpa2.disabled = false;
    updateBatchHeader();
  } finally {
    batchLoopRunning = false;
  }
};

async function processItem(item) {
  item.status = 'processing';
  renderBatchGrid();

  const procOverlay = document.getElementById('proc-overlay');
  const procTitle   = document.getElementById('proc-title');
  const procSub     = document.getElementById('proc-sub');
  const procPct     = document.getElementById('proc-pct');

  const showOnCanvas = !activeId;

  // Detect if model is cached (rough check via performance / localStorage flag)
  const modelCached = localStorage.getItem('wc_model_cached') === '1';

  // Helper to activate a stage in the overlay
  function setStage(n) {
    for (let i=1;i<=4;i++) {
      const el = document.getElementById('proc-stage-'+i);
      if (el) el.classList.toggle('active', i===n);
    }
  }

  if (showOnCanvas) {
    // Make sure the editor/canvas area is visible so the processing overlay can be seen
    document.getElementById('editor-wrap').classList.add('active');
    document.getElementById('editor-filename').textContent = item.name;
    if (!activeId) document.getElementById('editor-wrap').classList.add('active');

    setStage(1);
    procTitle.textContent = 'Preparing AI Engine…';
    procSub.textContent   = modelCached
      ? 'Loading AI from cache — almost ready'
      : 'Starting up AI engine for the first time';
    procPct.textContent   = 'AI';
    // Show/hide hint based on cache
    const hintEl = document.getElementById('proc-hint');
    if (hintEl) hintEl.style.display = modelCached ? 'none' : '';
    procOverlay.classList.add('active');
  }

  try {
    // Stage 1: Load the library
    const rbFn = await loadLib();

    if (showOnCanvas) {
      setStage(modelCached ? 3 : 2);
      procTitle.textContent = modelCached ? 'Optimising Image…' : 'Downloading AI Model…';
      procSub.textContent   = modelCached
        ? 'Preparing image for background removal'
        : `Downloading ${isMobile() ? '~40 MB' : '~170 MB'} model (once only — cached forever after)`;
      procPct.textContent   = '0%';
    }

    let lastStage = '';
    const blob = await rbFn(item.file, {
      publicPath: `https://staticimgly.com/@imgly/background-removal-data/${LIB_VERSION}/dist/`,
      progress: (key, cur, tot) => {
        const p   = tot > 0 ? Math.round(cur / tot * 100) : 0;
        const bar = document.getElementById(`prog-${item.id}`);
        if (bar) bar.style.width = p + '%';

        if (!showOnCanvas) return;

        if (key && key.includes('fetch')) {
          // Model download stage
          if (lastStage !== 'fetch') {
            lastStage = 'fetch';
            setStage(2);
            procTitle.textContent = 'Downloading AI Model…';
            procSub.textContent   = modelCached
              ? 'Loading model from browser cache…'
              : `⏳ First-time download (${isMobile() ? '~40 MB' : '~170 MB'}). Next time it's instant!`;
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (key && key.includes('execute')) {
          // Model execution stage
          if (lastStage !== 'execute') {
            lastStage = 'execute';
            setStage(3);
            procTitle.textContent = 'Optimising Image…';
            procSub.textContent   = 'Analysing image with neural network';
            localStorage.setItem('wc_model_cached', '1'); // mark model as cached
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (key && (key.includes('inference') || key.includes('segment') || key.includes('process') || key.includes('output'))) {
          // Inference / removing background stage
          if (lastStage !== 'remove') {
            lastStage = 'remove';
            setStage(4);
            procTitle.textContent = 'Removing Background…';
            procSub.textContent   = 'AI is precisely cutting out your subject';
            localStorage.setItem('wc_model_cached', '1');
          }
          if (p > 0) procPct.textContent = p + '%';
        } else if (p > 0) {
          // Fallback: if we haven't advanced to stage 4 yet, do it now
          if (lastStage !== 'remove') {
            lastStage = 'remove';
            setStage(4);
            procTitle.textContent = 'Removing Background…';
            procSub.textContent   = 'AI is precisely cutting out your subject';
            localStorage.setItem('wc_model_cached', '1');
          }
          procPct.textContent = p + '%';
        }
      },
      model: isMobile() ? 'small' : 'large',
      output: { format: 'image/png', quality: 1 },
    });

    // Done — store result
    const img = await loadImg(URL.createObjectURL(blob));
    const cvs = document.createElement('canvas');
    cvs.width = img.naturalWidth; cvs.height = img.naturalHeight;
    cvs.getContext('2d').drawImage(img, 0, 0);
    item.resultCanvas = cvs;
    item.status = 'done';

    if (showOnCanvas) {
      setStage(4);
      procPct.textContent   = '✓';
      procTitle.textContent = 'Background Removed!';
      procSub.textContent   = 'Your image is ready to edit & download';
      await new Promise(r => setTimeout(r, 500));
    }

    // Do NOT auto-open editor here — callers (addFiles/processAll) decide when to open
  } catch (err) {
    item.status = 'error';
    console.error(err);
    if (showOnCanvas) {
      procPct.textContent   = '!';
      procTitle.textContent = 'Something went wrong';
      procSub.textContent   = 'Please try again — may be a network issue';
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (showOnCanvas) procOverlay.classList.remove('active');
  if (showOnCanvas && item.status==='error' && !wCanvas) {
    document.getElementById('editor-wrap').classList.remove('active');
  }
  renderBatchGrid();
}

/* ── OPEN EDITOR ── */
async function openEditor(id, noScroll) {
  const item = items.find(i=>i.id==id);
  if (!item || !item.resultCanvas) return;
  activeId = id;

  document.getElementById('editor-wrap').classList.add('active');
  document.getElementById('editor-filename').textContent = item.name;

  // Reset editor state
  brushMode = null; isPainting = false; isPanning = false;
  zoom = 1; panX = 0; panY = 0; baseW = 0; baseH = 0;
  undoStack = []; redoStack = []; updateUndoUI();
  isDraggingSubject = false;
  bgScale = 1; bgOffsetX = 0; bgOffsetY = 0;

  // Restore saved state from bgSnapshot, or defaults if first time
  const snap = item.bgSnapshot || {};
  currentBgColor  = snap.bgColor    || 'transparent';
  currentPhotoBg  = snap.photoBg    || null;
  subjectScale    = snap.subjectScale != null ? snap.subjectScale : 1;
  subjectX        = snap.subjectX    || 0;
  subjectY        = snap.subjectY    || 0;
  subjectRotation = snap.subjectRotation || 0;
  flipX           = snap.flipX || false;
  flipY           = snap.flipY || false;
  shadowEnabled   = snap.shadowEnabled || false;
  shadowColor     = snap.shadowColor   || '#000000';
  shadowOpacity   = snap.shadowOpacity != null ? snap.shadowOpacity : 60;
  shadowBlur      = snap.shadowBlur    != null ? snap.shadowBlur    : 20;
  shadowDistance  = snap.shadowDistance!= null ? snap.shadowDistance: 10;
  shadowAngle     = snap.shadowAngle   != null ? snap.shadowAngle   : 135;
  bgBlur          = snap.bgBlur        != null ? snap.bgBlur        : 0;
  bgScale         = snap.bgScale       != null ? snap.bgScale       : 1;
  bgOffsetX       = snap.bgOffsetX     != null ? snap.bgOffsetX     : 0;
  bgOffsetY       = snap.bgOffsetY     != null ? snap.bgOffsetY     : 0;
  outlineEnabled  = snap.outlineEnabled || false;
  outlineColor    = snap.outlineColor   || '#ffffff';
  outlineWidth    = snap.outlineWidth   != null ? snap.outlineWidth  : 4;
  glowEnabled     = snap.glowEnabled    || false;
  glowColor       = snap.glowColor      || '#c8a96e';
  glowStrength    = snap.glowStrength   != null ? snap.glowStrength  : 60;
  glowBlur        = snap.glowBlur       != null ? snap.glowBlur      : 20;
  featherRadius   = snap.featherRadius  != null ? snap.featherRadius : 0;

  // Sync all UI controls to restored state
  // Subject sliders
  const ssEl = document.getElementById('subject-scale');
  if (ssEl) { ssEl.value = Math.round(subjectScale*100); document.getElementById('subject-scale-val').textContent = Math.round(subjectScale*100)+'%'; }
  const sxEl = document.getElementById('subject-x');
  if (sxEl) { sxEl.value = subjectX; document.getElementById('subject-x-val').textContent = subjectX; }
  const syEl = document.getElementById('subject-y');
  if (syEl) { syEl.value = subjectY; document.getElementById('subject-y-val').textContent = subjectY; }
  const srEl = document.getElementById('subject-rotate');
  if (srEl) { srEl.value = subjectRotation; document.getElementById('subject-rotate-val').textContent = subjectRotation+'°'; }
  // Mobile subject sliders
  const mssEl = document.getElementById('mob-subject-scale');
  if (mssEl) { mssEl.value = Math.round(subjectScale*100); document.getElementById('mob-subject-scale-val').textContent = Math.round(subjectScale*100)+'%'; }
  const msxEl = document.getElementById('mob-subject-x');
  if (msxEl) { msxEl.value = subjectX; document.getElementById('mob-subject-x-val').textContent = subjectX; }
  const msyEl = document.getElementById('mob-subject-y');
  if (msyEl) { msyEl.value = subjectY; document.getElementById('mob-subject-y-val').textContent = subjectY; }
  const msrEl = document.getElementById('mob-subject-rotate');
  if (msrEl) { msrEl.value = subjectRotation; document.getElementById('mob-subject-rotate-val').textContent = subjectRotation+'°'; }
  // Shadow
  document.getElementById('shadow-enable').checked = shadowEnabled;
  document.getElementById('shadow-controls').style.display = shadowEnabled ? 'flex' : 'none';
  document.getElementById('shadow-color').value   = shadowColor;
  document.getElementById('shadow-opacity').value = shadowOpacity; document.getElementById('shadow-opacity-val').textContent = shadowOpacity+'%';
  document.getElementById('shadow-blur').value    = shadowBlur;    document.getElementById('shadow-blur-val').textContent    = shadowBlur+'px';
  document.getElementById('shadow-distance').value= shadowDistance; document.getElementById('shadow-distance-val').textContent= shadowDistance+'px';
  document.getElementById('shadow-angle').value   = shadowAngle;   document.getElementById('shadow-angle-val').textContent   = shadowAngle+'°';
  // Mobile shadow
  const mse = document.getElementById('mob-shadow-enable'); if(mse) { mse.checked = shadowEnabled; document.getElementById('mob-shadow-controls').style.display = shadowEnabled?'flex':'none'; }
  const msc = document.getElementById('mob-shadow-color');    if(msc) msc.value = shadowColor;
  const mso = document.getElementById('mob-shadow-opacity');  if(mso) { mso.value = shadowOpacity; document.getElementById('mob-shadow-opacity-val').textContent = shadowOpacity+'%'; }
  const msb = document.getElementById('mob-shadow-blur');     if(msb) { msb.value = shadowBlur;    document.getElementById('mob-shadow-blur-val').textContent    = shadowBlur+'px'; }
  const msd = document.getElementById('mob-shadow-distance'); if(msd) { msd.value = shadowDistance; document.getElementById('mob-shadow-distance-val').textContent= shadowDistance+'px'; }
  const msa = document.getElementById('mob-shadow-angle');    if(msa) { msa.value = shadowAngle;   document.getElementById('mob-shadow-angle-val').textContent   = shadowAngle+'°'; }
  // BG blur
  document.getElementById('bg-blur').value = bgBlur; document.getElementById('bg-blur-val').textContent = bgBlur+'px';
  const mbgb = document.getElementById('mob-bg-blur'); if(mbgb) { mbgb.value = bgBlur; document.getElementById('mob-bg-blur-val').textContent = bgBlur+'px'; }
  // Outline
  document.getElementById('outline-enable').checked = outlineEnabled;
  document.getElementById('outline-controls').style.display = outlineEnabled ? 'flex' : 'none';
  document.getElementById('outline-color').value = outlineColor;
  document.getElementById('outline-width').value = outlineWidth; document.getElementById('outline-width-val').textContent = outlineWidth+'px';
  const moe=document.getElementById('mob-outline-enable'); if(moe){moe.checked=outlineEnabled; document.getElementById('mob-outline-controls').style.display=outlineEnabled?'flex':'none'; document.getElementById('mob-outline-color').value=outlineColor; document.getElementById('mob-outline-width').value=outlineWidth; document.getElementById('mob-outline-width-val').textContent=outlineWidth+'px';}
  // Glow
  document.getElementById('glow-enable').checked = glowEnabled;
  document.getElementById('glow-controls').style.display = glowEnabled ? 'flex' : 'none';
  document.getElementById('glow-color').value = glowColor;
  document.getElementById('glow-strength').value = glowStrength; document.getElementById('glow-strength-val').textContent = glowStrength+'%';
  document.getElementById('glow-blur').value = glowBlur; document.getElementById('glow-blur-val').textContent = glowBlur+'px';
  const mge=document.getElementById('mob-glow-enable'); if(mge){mge.checked=glowEnabled; document.getElementById('mob-glow-controls').style.display=glowEnabled?'flex':'none'; document.getElementById('mob-glow-color').value=glowColor; document.getElementById('mob-glow-strength').value=glowStrength; document.getElementById('mob-glow-strength-val').textContent=glowStrength+'%'; document.getElementById('mob-glow-blur').value=glowBlur; document.getElementById('mob-glow-blur-val').textContent=glowBlur+'px';}
  // Feather UI sync
  const featherEl = document.getElementById('feather-radius'); if(featherEl){ featherEl.value=featherRadius; document.getElementById('feather-radius-val').textContent=featherRadius+'px'; }
  const mFeatherEl = document.getElementById('mob-feather-radius'); if(mFeatherEl){ mFeatherEl.value=featherRadius; document.getElementById('mob-feather-radius-val').textContent=featherRadius+'px'; }
  // BG color swatches
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('active'));
  if (currentPhotoBg) {
    // Photo bg was active — highlight matching thumb if visible
    document.querySelectorAll('.photo-thumb').forEach(t => { if (t.src === currentPhotoBg.url || t._fullUrl === currentPhotoBg.url) t.classList.add('active'); });
    viewport.classList.remove('checker-bg-vp');
  } else if (currentBgColor === 'transparent') {
    const ts = document.querySelector('.swatch[data-bg="transparent"]'); if(ts) ts.classList.add('active');
    viewport.classList.add('checker-bg-vp');
  } else {
    const match = document.querySelector(`.swatch[data-bg="${currentBgColor}"]`);
    if (match) match.classList.add('active');
    viewport.classList.remove('checker-bg-vp');
  }

  // Set up wCanvas from item's resultCanvas
  wCanvas = document.createElement('canvas');
  wCanvas.width = item.resultCanvas.width;
  wCanvas.height = item.resultCanvas.height;
  wCtx = wCanvas.getContext('2d', { willReadFrequently:true });
  wCtx.drawImage(item.resultCanvas, 0, 0);

  // origData from original file
  const origImg = await loadImg(URL.createObjectURL(item.file));
  const origCanvas = document.createElement('canvas');
  origCanvas.width = wCanvas.width; origCanvas.height = wCanvas.height;
  const origCtx = origCanvas.getContext('2d', { willReadFrequently:true });
  origCtx.drawImage(origImg, 0, 0, wCanvas.width, wCanvas.height);
  origData = origCtx.getImageData(0, 0, wCanvas.width, wCanvas.height);

  // Reset before/after mode on new image
  beforeAfterMode = false; window._baMode = false;
  const baBtn = document.getElementById('btn-before-after');
  if (baBtn) {
    baBtn.style.display = '';
    baBtn.style.borderColor = 'var(--faint)';
    baBtn.style.color = 'var(--text-muted)';
    baBtn.textContent = '⇔ Before/After';
  }

  attachEvents();
  requestAnimationFrame(() => {
    computeBaseSize();
    updateBgTransformVisibility();
    updateFlipButtons();
    renderAll();
  });

  // Update grid highlight
  renderBatchGrid();
}

/* ── LAYOUT ── */
function computeBaseSize() {
  const vp = viewport.parentElement;
  const maxW = vp.clientWidth || 600;
  const isPortrait = wCanvas.height > wCanvas.width;

  // On mobile: subtract fixed UI bars from available height so canvas bottom is never hidden
  let reservedH = 0;
  if (isMobile()) {
    const tb = document.getElementById('mob-toolbar');
    const bb = document.getElementById('mob-brush-bar');
    const tbH = (tb && tb.offsetHeight) ? tb.offsetHeight : 72;
    const bbH = (bb && bb.classList.contains('active') && bb.offsetHeight) ? bb.offsetHeight : 0;
    reservedH = tbH + bbH + 8; // +8px breathing room
  }

  const availH = window.innerHeight - reservedH;
  const maxHFactor = isMobile() ? (isPortrait ? 0.88 : 0.70) : 0.72;
  const maxH = Math.min(availH * maxHFactor, isPortrait ? 1100 : 650);
  const ratio = Math.min(maxW / wCanvas.width, maxH / wCanvas.height, 1);
  baseW = Math.round(wCanvas.width * ratio);
  baseH = Math.round(wCanvas.height * ratio);
  viewport.style.height = baseH + 'px';
  viewport.style.minHeight = '';
  viewport.style.maxHeight = '';
}

function renderAll() {
  if (!wCanvas) return;
  const dw = Math.round(baseW * zoom);
  const dh = Math.round(baseH * zoom);
  const vpW = viewport.clientWidth, vpH = viewport.clientHeight;
  panX = Math.min(0, Math.max(vpW-dw, panX));
  panY = Math.min(0, Math.max(vpH-dh, panY));
  if (dw <= vpW) panX = Math.round((vpW-dw)/2);
  if (dh <= vpH) panY = Math.round((vpH-dh)/2);
  dc.width = dw; dc.height = dh;
  dc.style.width = dw+'px'; dc.style.height = dh+'px';
  dc.style.transform = `translate(${panX}px,${panY}px)`;
  cc.width = dw; cc.height = dh;
  cc.style.width = dw+'px'; cc.style.height = dh+'px';
  cc.style.transform = `translate(${panX}px,${panY}px)`;
  document.getElementById('zoom-level').textContent = Math.round(zoom*100)+'%';
  const resetBtn = document.getElementById('btn-zoom-reset');
  if (resetBtn) resetBtn.style.opacity = zoom === 1 && panX === 0 && panY === 0 ? '0.35' : '1';
  if (beforeAfterMode) {
    // Re-draw original image at new canvas size
    const dw2 = dc.width, dh2 = dc.height;
    dctx.clearRect(0, 0, dw2, dh2);
    const tmpC2 = document.createElement('canvas');
    tmpC2.width = origData.width; tmpC2.height = origData.height;
    tmpC2.getContext('2d').putImageData(origData, 0, 0);
    dctx.drawImage(tmpC2, 0, 0, dw2, dh2);
    return;
  }
  drawComposite();
}

function drawComposite() {
  if (!wCanvas) return;
  // In before/after mode: skip redraw (original is already shown), but silently update snapshot
  if (beforeAfterMode) {
    // Still update bgSnapshot so state is saved, then return
    const activeItem = items.find(i=>i.id==activeId);
    if (activeItem) {
      activeItem.bgSnapshot = { photoBg:currentPhotoBg, bgColor:currentBgColor, bgBlur, bgScale, bgOffsetX, bgOffsetY, shadowEnabled, shadowColor, shadowOpacity, shadowBlur, shadowDistance, shadowAngle, outlineEnabled, outlineColor, outlineWidth, glowEnabled, glowColor, glowStrength, glowBlur, featherRadius, subjectScale, subjectX, subjectY, subjectRotation, flipX, flipY, dcWidth:dc.width, dcHeight:dc.height };
    }
    return;
  }
  const dw = dc.width, dh = dc.height;
  dctx.clearRect(0, 0, dw, dh);

  // 1. Background — always fills full canvas
  if (currentPhotoBg && currentPhotoBg.img) {
    dctx.save();
    if (bgBlur > 0) dctx.filter = `blur(${bgBlur}px)`;
    const imgW = currentPhotoBg.img.naturalWidth, imgH = currentPhotoBg.img.naturalHeight;
    const scale = Math.max(dw/imgW, dh/imgH) * bgScale;
    const sw = imgW*scale, sh = imgH*scale;
    dctx.drawImage(currentPhotoBg.img, (dw-sw)/2 + bgOffsetX, (dh-sh)/2 + bgOffsetY, sw, sh);
    dctx.filter = 'none';
    dctx.restore();
  } else if (currentBgColor !== 'transparent') {
    dctx.save();
    const grad = getGradient(currentBgColor, dw, dh);
    dctx.fillStyle = grad || currentBgColor;
    dctx.fillRect(0, 0, dw, dh);
    dctx.restore();
  }

  // 2. Subject — drawn with its own independent transform
  const sw = dw * subjectScale;
  const sh = dh * subjectScale;
  const sx = (dw - sw) / 2 + subjectX;
  const sy = (dh - sh) / 2 + subjectY;
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const rad = subjectRotation * Math.PI / 180;

  // Glow — drawn before shadow+subject so it appears behind
  if (glowEnabled && glowBlur > 0) {
    const hex = glowColor;
    const a = glowStrength / 100;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    dctx.save();
    dctx.translate(cx, cy); dctx.rotate(rad);
    if (flipX) dctx.scale(-1, 1);
    if (flipY) dctx.scale(1, -1);
    dctx.translate(-cx, -cy);
    dctx.shadowColor = `rgba(${r},${g},${b},${a})`;
    dctx.shadowBlur = glowBlur * 2;
    dctx.shadowOffsetX = 0;
    dctx.shadowOffsetY = 0;
    const passes = Math.max(1, Math.round(glowStrength / 30));
    for (let p = 0; p < passes; p++) {
      dctx.drawImage(wCanvas, sx, sy, sw, sh);
    }
    dctx.restore();
  }

  if (shadowEnabled) {
    const rad2 = shadowAngle * Math.PI / 180;
    const dx = Math.cos(rad2) * shadowDistance;
    const dy = Math.sin(rad2) * shadowDistance;
    const hex = shadowColor;
    const a = shadowOpacity/100;
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    dctx.save();
    dctx.translate(cx, cy); dctx.rotate(rad);
    if (flipX) dctx.scale(-1, 1);
    if (flipY) dctx.scale(1, -1);
    dctx.translate(-cx, -cy);
    dctx.shadowColor = `rgba(${r},${g},${b},${a})`;
    dctx.shadowBlur = shadowBlur;
    dctx.shadowOffsetX = dx;
    dctx.shadowOffsetY = dy;
    dctx.drawImage(wCanvas, sx, sy, sw, sh);
    dctx.restore();
  }

  // Outline — drawn using offscreen canvas with dilate technique
  if (outlineEnabled && outlineWidth > 0) {
    dctx.save();
    dctx.translate(cx, cy); dctx.rotate(rad);
    if (flipX) dctx.scale(-1, 1);
    if (flipY) dctx.scale(1, -1);
    dctx.translate(-cx, -cy);
    drawOutline(dctx, wCanvas, sx, sy, sw, sh, outlineColor, outlineWidth);
    dctx.restore();
  }

  dctx.save();
  dctx.translate(cx, cy); dctx.rotate(rad);
  if (flipX) dctx.scale(-1, 1);
  if (flipY) dctx.scale(1, -1);
  dctx.translate(-cx, -cy);
  const featheredSrc = featherRadius > 0 ? applyFeatherToCanvas(wCanvas, featherRadius * 0.3) : wCanvas;
  dctx.drawImage(featheredSrc, sx, sy, sw, sh);
  dctx.restore();

  // Save bg+subject state into active item for export
  const activeItem = items.find(i=>i.id==activeId);
  if (activeItem) {
    activeItem.bgSnapshot = {
      photoBg: currentPhotoBg,
      bgColor: currentBgColor,
      bgBlur,
      bgScale,
      bgOffsetX,
      bgOffsetY,
      shadowEnabled,
      shadowColor,
      shadowOpacity,
      shadowBlur,
      shadowDistance,
      shadowAngle,
      outlineEnabled,
      outlineColor,
      outlineWidth,
      glowEnabled,
      glowColor,
      glowStrength,
      glowBlur,
      featherRadius,
      subjectScale,
      subjectX,
      subjectY,
      subjectRotation,
      flipX,
      flipY,
      dcWidth: dc.width,
      dcHeight: dc.height
    };
  }
}

/* ── OUTLINE HELPER ── */
function drawOutline(ctx, srcCanvas, sx, sy, sw, sh, color, width) {
  if (!width || width <= 0) return;
  const iw = Math.round(sw), ih = Math.round(sh);
  if (iw <= 0 || ih <= 0) return;

  // For large canvases or large widths, use fast shadow technique
  // For preview sizes, use accurate pixel dilation
  const pixelCount = iw * ih;
  const useAccurate = pixelCount < 1500000 && width <= 20; // ~1.5MP threshold

  if (useAccurate) {
    // Pixel dilation: accurate edge-following outline
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    const maskC = document.createElement('canvas');
    maskC.width = iw; maskC.height = ih;
    const maskCtx = maskC.getContext('2d');
    maskCtx.drawImage(srcCanvas, 0, 0, iw, ih);
    const maskData = maskCtx.getImageData(0, 0, iw, ih);
    const alpha = new Uint8Array(iw * ih);
    for (let i = 0; i < iw * ih; i++) alpha[i] = maskData.data[i*4+3];

    const outC = document.createElement('canvas');
    outC.width = iw; outC.height = ih;
    const outCtx = outC.getContext('2d');
    const outImg = outCtx.createImageData(iw, ih);
    const od = outImg.data;
    const w = Math.ceil(width);

    for (let y = 0; y < ih; y++) {
      for (let x = 0; x < iw; x++) {
        if (alpha[y * iw + x] > 128) continue;
        let hit = false;
        const x0 = Math.max(0, x-w), x1 = Math.min(iw-1, x+w);
        const y0 = Math.max(0, y-w), y1 = Math.min(ih-1, y+w);
        outer: for (let ny = y0; ny <= y1; ny++) {
          for (let nx = x0; nx <= x1; nx++) {
            if ((nx-x)*(nx-x)+(ny-y)*(ny-y) <= w*w && alpha[ny*iw+nx] > 128) { hit=true; break outer; }
          }
        }
        if (hit) {
          const idx = (y*iw+x)*4;
          od[idx]=r; od[idx+1]=g; od[idx+2]=b; od[idx+3]=255;
        }
      }
    }
    outCtx.putImageData(outImg, 0, 0);
    ctx.drawImage(outC, sx, sy, sw, sh);
  } else {
    // Shadow blur technique: fast, works for large export canvases
    const tc = document.createElement('canvas');
    tc.width = iw; tc.height = ih;
    const tctx = tc.getContext('2d');
    tctx.drawImage(srcCanvas, 0, 0, iw, ih);
    const outC = document.createElement('canvas');
    outC.width = iw; outC.height = ih;
    const octx = outC.getContext('2d');
    octx.save();
    octx.shadowColor = color;
    octx.shadowBlur = width * 2;
    octx.shadowOffsetX = 0; octx.shadowOffsetY = 0;
    for (let i = 0; i < 4; i++) octx.drawImage(tc, 0, 0);
    octx.restore();
    ctx.drawImage(outC, sx, sy);
  }
}

function getGradient(color, w, h) {
  const gradients = {
    'gradient-purple': ['#667eea','#764ba2'],
    'gradient-pink':   ['#f093fb','#f5576c'],
    'gradient-blue':   ['#4facfe','#00f2fe'],
    'gradient-green':  ['#43e97b','#38f9d7'],
  };
  if (gradients[color]) {
    const g = dctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, gradients[color][0]);
    g.addColorStop(1, gradients[color][1]);
    return g;
  }
  return null;
}

/* ── ZOOM ── */
window.adjustZoom = function(delta) {
  const nz = Math.min(8, Math.max(0.25, zoom+delta));
  const cx = viewport.clientWidth/2, cy = viewport.clientHeight/2;
  panX = cx - (cx-panX)*(nz/zoom);
  panY = cy - (cy-panY)*(nz/zoom);
  zoom = nz; renderAll();
};
window.toggleFlip = function(axis) {
  if (axis === 'x') flipX = !flipX;
  else flipY = !flipY;
  updateFlipButtons();
  drawComposite();
};

function updateFlipButtons() {
  const baseStyle = 'flex:1;padding:5px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);cursor:pointer;transition:all .2s;border-width:1.5px;border-style:solid;';
  const activeStyle   = baseStyle + 'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold);';
  const inactiveStyle = baseStyle + 'background:var(--dark4);border-color:var(--faint);color:var(--muted);';
  ['btn-flip-x','mob-btn-flip-x'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = flipX ? activeStyle : inactiveStyle;
  });
  ['btn-flip-y','mob-btn-flip-y'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.cssText = flipY ? activeStyle : inactiveStyle;
  });
}

window.resetZoom = function() { zoom=1;panX=0;panY=0;renderAll(); };

/* ── EVENTS ── */
function attachEvents() {
  if (eventsReady) return;
  eventsReady = true;
  window.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    if (e.code==='Space' && !isTyping) { spaceDown=true; viewport.style.cursor='grab'; e.preventDefault(); }
    if ((e.ctrlKey||e.metaKey) && e.code==='KeyZ' && !e.shiftKey) { e.preventDefault(); undoStroke(); }
    if ((e.ctrlKey||e.metaKey) && (e.code==='KeyY'||(e.code==='KeyZ'&&e.shiftKey))) { e.preventDefault(); redoStroke(); }
  });
  window.addEventListener('keyup', e => { if (e.code==='Space') { spaceDown=false; viewport.style.cursor=''; updateViewportCursor(); }});
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX-rect.left-panX, my = e.clientY-rect.top-panY;
    const delta = e.deltaY<0?0.15:-0.15;
    const nz = Math.min(8, Math.max(0.25, zoom+delta));
    panX -= mx*(nz/zoom-1); panY -= my*(nz/zoom-1); zoom=nz; renderAll();
  }, { passive:false });
  viewport.addEventListener('mousedown', e => {
    if (e.button===1||spaceDown) {
      isPanning=true; panStart={x:e.clientX-panX,y:e.clientY-panY}; viewport.style.cursor='grabbing'; e.preventDefault(); return;
    }
    if (!brushMode) {
      // Check if clicking on subject area for drag
      const pos = canvasPos(e);
      if (pos) {
        isDraggingSubject = true;
        subjectDragStart = { x: e.clientX - subjectX, y: e.clientY - subjectY };
        viewport.style.cursor = 'move';
        e.preventDefault();
      } else {
        isPanning=true; panStart={x:e.clientX-panX,y:e.clientY-panY}; viewport.style.cursor='grabbing'; e.preventDefault();
      }
      return;
    }
    const pos=canvasPos(e); if (!pos) return;
    isPainting=true; saveSnapshot(); applyBrush(pos.x,pos.y);
  });
  viewport.addEventListener('mousemove', e => {
    if (isPanning) { panX=e.clientX-panStart.x; panY=e.clientY-panStart.y; renderAll(); clearCursor(); return; }
    if (isDraggingSubject) {
      subjectX = e.clientX - subjectDragStart.x;
      subjectY = e.clientY - subjectDragStart.y;
      // Sync sliders
      const sxEl = document.getElementById('subject-x');
      const syEl = document.getElementById('subject-y');
      if (sxEl) { sxEl.value = Math.max(-500, Math.min(500, Math.round(subjectX))); document.getElementById('subject-x-val').textContent = Math.round(subjectX); }
      if (syEl) { syEl.value = Math.max(-500, Math.min(500, Math.round(subjectY))); document.getElementById('subject-y-val').textContent = Math.round(subjectY); }
      drawComposite(); return;
    }
    const pos=canvasPos(e);
    if (pos) { drawCursorRing(pos.x,pos.y); if (isPainting&&brushMode) applyBrush(pos.x,pos.y); }
    else clearCursor();
  });
  viewport.addEventListener('mouseup', e => {
    if (isPanning) { isPanning=false; viewport.style.cursor=''; updateViewportCursor(); return; }
    if (isDraggingSubject) { isDraggingSubject=false; viewport.style.cursor=''; updateViewportCursor(); return; }
    if (isPainting) { isPainting=false; bakeToItem(); }
  });
  viewport.addEventListener('mouseleave', () => { if (isPanning)isPanning=false; if (isDraggingSubject)isDraggingSubject=false; if (isPainting){isPainting=false;bakeToItem();} clearCursor(); });
  let lastTouches=null;
  viewport.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length===2){lastTouches=e.touches;isPainting=false;return;}
    if (!brushMode){isPanning=true;panStart={x:e.touches[0].clientX-panX,y:e.touches[0].clientY-panY};return;}
    const t = e.touches[0];
    const rawPos = touchPos(t);
    if (!rawPos) return;
    const brushPos = mobOffsetBrushPos(rawPos, t);
    _brushScreenX = t.clientX; _brushScreenY = t.clientY;
    // Show cursor ring + loupe immediately on touch (not just on move)
    drawCursorRing(brushPos.x, brushPos.y, t.clientX, t.clientY);
    isPainting=true; saveSnapshot(); applyBrush(brushPos.x, brushPos.y, rawPos, t);
  },{passive:false});
  viewport.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length===2&&lastTouches){
      const d0=Math.hypot(lastTouches[0].clientX-lastTouches[1].clientX,lastTouches[0].clientY-lastTouches[1].clientY);
      const d1=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
      const r=d1/d0;const cx=(e.touches[0].clientX+e.touches[1].clientX)/2-viewport.getBoundingClientRect().left;
      const cy=(e.touches[0].clientY+e.touches[1].clientY)/2-viewport.getBoundingClientRect().top;
      const nz=Math.min(8,Math.max(0.25,zoom*r)); panX-=(cx-panX)*(nz/zoom-1); panY-=(cy-panY)*(nz/zoom-1); zoom=nz; lastTouches=e.touches; renderAll(); return;
    }
    if (isPanning){panX=e.touches[0].clientX-panStart.x;panY=e.touches[0].clientY-panStart.y;renderAll();return;}
    if (!brushMode) { clearCursor(); return; }
    const t = e.touches[0];
    const rawPos = touchPos(t);
    if (!rawPos) { clearCursor(); return; }
    const brushPos = mobOffsetBrushPos(rawPos, t);
    drawCursorRing(brushPos.x, brushPos.y, t.clientX, t.clientY);
    if (isPainting) { _brushScreenX = t.clientX; _brushScreenY = t.clientY; applyBrush(brushPos.x, brushPos.y, rawPos, t); }
  },{passive:false});
  viewport.addEventListener('touchend', e=>{lastTouches=null;isPanning=false;if(isPainting){isPainting=false;bakeToItem();}clearCursor();});
}

function updateViewportCursor(){viewport.style.cursor=brushMode?'none':'move';}
function canvasPos(e){
  const dr=dc.getBoundingClientRect();
  const scaleX=dc.width/dr.width,scaleY=dc.height/dr.height;
  const cx=(e.clientX-dr.left)*scaleX,cy=(e.clientY-dr.top)*scaleY;
  if(cx<0||cy<0||cx>dc.width||cy>dc.height)return null;
  return{x:cx,y:cy};
}
function touchPos(t){
  const dr=dc.getBoundingClientRect();
  const scaleX=dc.width/dr.width,scaleY=dc.height/dr.height;
  const cx=(t.clientX-dr.left)*scaleX,cy=(t.clientY-dr.top)*scaleY;
  if(cx<0||cy<0||cx>dc.width)return null;
  // On mobile: allow finger below canvas bottom by MOB_CURSOR_OFFSET_PX so the brush
  // (which is offset upward) can still reach the bottom edge of the image.
  const bottomSlack = isMobile() ? MOB_CURSOR_OFFSET_PX * scaleY : 0;
  if(cy > dc.height + bottomSlack) return null;
  // Clamp y to canvas bounds (brush offset will pull it up into valid range)
  return{x:cx, y:Math.min(cy, dc.height)};
}
// Returns brush position offset upward from finger (mobile only)
function mobOffsetBrushPos(rawPos) {
  if (!isMobile()) return rawPos;
  const dr = dc.getBoundingClientRect();
  const scaleX = dc.width / dr.width;
  const offsetDc = MOB_CURSOR_OFFSET_PX * scaleX;
  return { x: rawPos.x, y: rawPos.y - offsetDc };
}

/* ── CURSOR ── */
function clearCursor(){
  cctx.clearRect(0,0,cc.width,cc.height);
  hideMobileLupe();
}

// Mobile finger-offset: how many screen-px above finger the brush ring appears
const MOB_CURSOR_OFFSET_PX = 80;

function drawCursorRing(x, y, touchScreenX, touchScreenY) {
  cctx.clearRect(0, 0, cc.width, cc.height);
  if (!brushMode) return;

  const isMob = isMobile();
  const dr = dc.getBoundingClientRect();
  const scaleX = dc.width / dr.width;

  // On mobile: offset the ring upward in dc-pixel space
  let rx = x, ry = y;
  if (isMob) {
    const offsetInDc = MOB_CURSOR_OFFSET_PX * scaleX;
    ry = y - offsetInDc;
  }

  const ringR = (window.brushSize / 2) * scaleX;
  const col = window.smartEdge && !isMob
    ? 'rgba(201,168,76,.95)'                            // gold = smart-edge mode
    : brushMode === 'erase' ? 'rgba(255,80,80,.9)' : 'rgba(80,220,80,.9)';

  cctx.save();
  // Outer ring
  cctx.beginPath(); cctx.arc(rx, ry, ringR, 0, Math.PI * 2);
  cctx.strokeStyle = col; cctx.lineWidth = 1.5 * scaleX; cctx.stroke();
  // Centre dot
  cctx.beginPath(); cctx.arc(rx, ry, 1.5 * scaleX, 0, Math.PI * 2);
  cctx.fillStyle = col; cctx.fill();
  // On mobile: draw a thin line from ring down to finger tip
  if (isMob && touchScreenX !== undefined) {
    cctx.beginPath();
    cctx.moveTo(rx, ry + ringR);
    cctx.lineTo(x, y);
    cctx.strokeStyle = col;
    cctx.lineWidth = 1 * scaleX;
    cctx.setLineDash([3 * scaleX, 3 * scaleX]);
    cctx.stroke();
    cctx.setLineDash([]);
  }
  cctx.restore();

  // Show loupe on mobile
  if (isMob && touchScreenX !== undefined) {
    showMobileLupe(x, y, touchScreenX, touchScreenY);
  }
}

/* ── MOBILE MAGNIFIER LOUPE ── */
let _lupeEl = null;
let _lupeCtx = null;
const LUPE_SIZE = 140;    // px, CSS size of the loupe square
const LUPE_ZOOM = 4;      // magnification inside loupe
const LUPE_CANVAS_PX = LUPE_SIZE * (window.devicePixelRatio || 1);

function getLupe() {
  if (_lupeEl) return _lupeEl;
  const wrap = document.createElement('div');
  wrap.id = 'mob-lupe';
  wrap.className = 'mob-lupe';
  const cvs = document.createElement('canvas');
  cvs.width = LUPE_CANVAS_PX; cvs.height = LUPE_CANVAS_PX;
  cvs.style.width = LUPE_SIZE + 'px'; cvs.style.height = LUPE_SIZE + 'px';
  wrap.appendChild(cvs);
  document.body.appendChild(wrap);
  _lupeEl = wrap;
  _lupeCtx = cvs.getContext('2d');
  return wrap;
}

function showMobileLupe(dcX, dcY, screenX, screenY) {
  if (!wCanvas || !dc) return;
  const lupe = getLupe();

  // Position loupe: float near the brush ring (which is already offset above finger)
  const lupeSize = LUPE_SIZE;
  const margin = 12;
  const vpRect = viewport.getBoundingClientRect();

  // Ring is at screenY - MOB_CURSOR_OFFSET_PX (above finger)
  const ringScreenY = screenY - MOB_CURSOR_OFFSET_PX;
  let lupeTop = ringScreenY - lupeSize / 2;
  lupeTop = Math.max(vpRect.top + margin, Math.min(vpRect.bottom - lupeSize - margin, lupeTop));

  // Horizontal: place on opposite side from finger
  const fingerRight = screenX > vpRect.left + vpRect.width / 2;
  let lupeLeft;
  if (fingerRight) {
    lupeLeft = vpRect.left + margin;
  } else {
    lupeLeft = vpRect.right - lupeSize - margin;
  }

  lupe.style.position = 'fixed';
  lupe.style.left  = lupeLeft + 'px';
  lupe.style.top   = lupeTop + 'px';
  lupe.style.right = 'auto';
  lupe.style.display = 'block';

  const ctx = _lupeCtx;
  const sz = LUPE_CANVAS_PX;
  ctx.clearRect(0, 0, sz, sz);

  // Draw checker background (shows transparency)
  const tile = 10 * (window.devicePixelRatio || 1);
  for (let ty = 0; ty < sz; ty += tile) {
    for (let tx = 0; tx < sz; tx += tile) {
      ctx.fillStyle = ((Math.floor(tx/tile) + Math.floor(ty/tile)) % 2 === 0) ? '#2a2a2a' : '#3a3a3a';
      ctx.fillRect(tx, ty, tile, tile);
    }
  }

  // Sample from dc (display canvas) centred on brush position
  // dcX/dcY are in dc-pixel space
  const sampleW = LUPE_SIZE / LUPE_ZOOM;  // how many dc-css-px to sample
  const dr = dc.getBoundingClientRect();
  const dcCssPxPerDcPx = dr.width / dc.width;
  const sampleDcPx = sampleW / dcCssPxPerDcPx;   // in actual dc pixels

  const srcX = dcX - sampleDcPx / 2;
  const srcY = dcY - sampleDcPx / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(dc, srcX, srcY, sampleDcPx, sampleDcPx, 0, 0, sz, sz);
  ctx.restore();

  // Crosshair in centre
  const col = brushMode === 'erase' ? 'rgba(255,80,80,.85)' : 'rgba(80,220,80,.85)';
  const mid = sz / 2;
  const brushScreenR = (window.brushSize / 2);
  const brushLupeR = brushScreenR * (LUPE_ZOOM) * (window.devicePixelRatio || 1);
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5 * (window.devicePixelRatio || 1);
  ctx.beginPath(); ctx.arc(mid, mid, brushLupeR, 0, Math.PI * 2); ctx.stroke();
  // crosshair lines
  ctx.beginPath(); ctx.moveTo(mid - brushLupeR - 6, mid); ctx.lineTo(mid + brushLupeR + 6, mid); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mid, mid - brushLupeR - 6); ctx.lineTo(mid, mid + brushLupeR + 6); ctx.stroke();
  ctx.restore();

  // Border
  ctx.save();
  ctx.strokeStyle = brushMode === 'erase' ? 'rgba(255,80,80,.5)' : 'rgba(80,220,80,.5)';
  ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
  ctx.strokeRect(0, 0, sz, sz);
  ctx.restore();
}

function hideMobileLupe() {
  if (_lupeEl) _lupeEl.style.display = 'none';
}

/* ── BRUSH ── */
function applyBrush(dispX,dispY){
  // dc coords → wCanvas coords, accounting for subjectScale+offset
  const dw=dc.width, dh=dc.height;
  const drawnW = dw * subjectScale;
  const drawnH = dh * subjectScale;
  const originX = (dw - drawnW) / 2 + subjectX;
  const originY = (dh - drawnH) / 2 + subjectY;
  const fx = ((dispX - originX) / drawnW) * wCanvas.width;
  const fy = ((dispY - originY) / drawnH) * wCanvas.height;
  const sx = wCanvas.width / drawnW;
  const fr = (window.brushSize / 2) * sx;

  // ── Smart Edge Mode ──────────────────────────────────────────────
  if (window.smartEdge) {
    applySmartEdgeBrush(fx, fy, fr);
    drawComposite(); drawCursorRing(dispX, dispY, _brushScreenX, _brushScreenY);
    return;
  }
  // ── Normal brush ─────────────────────────────────────────────────
  if (brushMode==='erase'){
    wCtx.save(); wCtx.globalCompositeOperation='destination-out';
    wCtx.beginPath(); wCtx.arc(fx,fy,fr,0,Math.PI*2); wCtx.fillStyle='rgba(0,0,0,1)'; wCtx.fill(); wCtx.restore();
  } else {
    const x0=Math.max(0,Math.floor(fx-fr)),y0=Math.max(0,Math.floor(fy-fr));
    const x1=Math.min(wCanvas.width,Math.ceil(fx+fr)),y1=Math.min(wCanvas.height,Math.ceil(fy+fr));
    const pw=x1-x0,ph=y1-y0; if(pw<=0||ph<=0)return;
    const patch=wCtx.getImageData(x0,y0,pw,ph);const d=patch.data,od=origData.data,W=origData.width;
    for(let py=0;py<ph;py++){for(let px=0;px<pw;px++){
      if((x0+px-fx)**2+(y0+py-fy)**2>fr*fr)continue;
      const i=(py*pw+px)*4,oi=((y0+py)*W+(x0+px))*4;
      d[i]=od[oi];d[i+1]=od[oi+1];d[i+2]=od[oi+2];d[i+3]=od[oi+3];
    }}
    wCtx.putImageData(patch,x0,y0);
  }
  drawComposite(); drawCursorRing(dispX, dispY, _brushScreenX, _brushScreenY);
}

/* ── SMART EDGE BRUSH ───────────────────────────────────────────────
   Samples the original image colour at the brush centre, then only
   affects pixels inside the circle whose colour is "similar enough"
   (within tolerance) to that seed colour.  Pixels near edges (colour
   change) are left alone, giving a clean, edge-respecting stroke.
   ----------------------------------------------------------------- */
function applySmartEdgeBrush(fx, fy, fr) {
  const W = wCanvas.width, H = wCanvas.height;
  const x0 = Math.max(0, Math.floor(fx - fr));
  const y0 = Math.max(0, Math.floor(fy - fr));
  const x1 = Math.min(W, Math.ceil(fx + fr));
  const y1 = Math.min(H, Math.ceil(fy + fr));
  const pw = x1 - x0, ph = y1 - y0;
  if (pw <= 0 || ph <= 0) return;

  // Sample seed colour from origData at brush centre
  const seedX = Math.max(0, Math.min(W-1, Math.round(fx)));
  const seedY = Math.max(0, Math.min(H-1, Math.round(fy)));
  const od = origData.data, oW = origData.width;
  const si = (seedY * oW + seedX) * 4;
  const sr = od[si], sg = od[si+1], sb = od[si+2];

  // Tolerance: 0-100 slider → 0-441 colour distance (max possible = sqrt(255²*3) ≈ 441)
  const tol = (window.smartEdgeTol / 100) * 441;

  const patch = wCtx.getImageData(x0, y0, pw, ph);
  const d = patch.data;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      // Must be inside circle
      if ((x0+px-fx)**2 + (y0+py-fy)**2 > fr*fr) continue;

      // Colour similarity check against origData
      const oi = ((y0+py) * oW + (x0+px)) * 4;
      const dr = od[oi]-sr, dg = od[oi+1]-sg, db = od[oi+2]-sb;
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      if (dist > tol) continue;   // edge pixel — skip

      // Soft falloff at tolerance boundary (smooth transition)
      const strength = tol > 0 ? Math.max(0, 1 - dist / tol) : 1;

      const i = (py * pw + px) * 4;
      if (brushMode === 'erase') {
        // Reduce alpha proportional to strength
        d[i+3] = Math.max(0, d[i+3] - Math.round(255 * strength));
      } else {
        // Restore: blend from origData weighted by strength
        d[i]   = Math.round(d[i]   * (1-strength) + od[oi]   * strength);
        d[i+1] = Math.round(d[i+1] * (1-strength) + od[oi+1] * strength);
        d[i+2] = Math.round(d[i+2] * (1-strength) + od[oi+2] * strength);
        d[i+3] = Math.round(d[i+3] * (1-strength) + od[oi+3] * strength);
      }
    }
  }
  wCtx.putImageData(patch, x0, y0);
}
let _brushScreenX, _brushScreenY;

function bakeToItem(){
  // Save wCanvas back to item
  const item = items.find(i=>i.id==activeId);
  if (item && wCanvas) {
    const cvs = document.createElement('canvas');
    cvs.width=wCanvas.width; cvs.height=wCanvas.height;
    cvs.getContext('2d').drawImage(wCanvas,0,0);
    item.resultCanvas = cvs;
  }
}

/* ── UNDO ── */
function saveSnapshot(){
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); undoStack.push(snap);
  if(undoStack.length>MAX_UNDO)undoStack.shift(); redoStack=[]; updateUndoUI();
}
function updateUndoUI(){
  const u=document.getElementById('btn-undo'),r=document.getElementById('btn-redo');
  if(u)u.disabled=undoStack.length===0; if(r)r.disabled=redoStack.length===0;
}
window.undoStroke=function(){
  if(!undoStack.length)return;
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); redoStack.push(snap);
  const prev=undoStack.pop(); wCtx.clearRect(0,0,wCanvas.width,wCanvas.height); wCtx.drawImage(prev,0,0);
  drawComposite(); updateUndoUI(); bakeToItem();
};
window.redoStroke=function(){
  if(!redoStack.length)return;
  const snap=document.createElement('canvas'); snap.width=wCanvas.width; snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0); undoStack.push(snap);
  const next=redoStack.pop(); wCtx.clearRect(0,0,wCanvas.width,wCanvas.height); wCtx.drawImage(next,0,0);
  drawComposite(); updateUndoUI(); bakeToItem();
};

/* ── BRUSH MODE ── */
window.setBrushMode=function(mode){
  if(brushMode===mode){brushMode=null;updateViewportCursor();document.getElementById('btn-erase').classList.remove('mode-erase');document.getElementById('btn-restore').classList.remove('mode-restore');}
  else{brushMode=mode;viewport.style.cursor='none';document.getElementById('btn-erase').classList.toggle('mode-erase',mode==='erase');document.getElementById('btn-restore').classList.toggle('mode-restore',mode==='restore');document.getElementById('btn-erase').classList.toggle('mode-restore',false);document.getElementById('btn-restore').classList.toggle('mode-erase',false);}
};

/* ── SMART EDGE TOGGLE ── */
window.toggleSmartEdge = function() {
  window.smartEdge = !window.smartEdge;
  const btn = document.getElementById('btn-smart-edge');
  const tolWrap = document.getElementById('smart-edge-tol-wrap');
  if (window.smartEdge) {
    btn.classList.add('mode-smart-edge');
    if (tolWrap) tolWrap.style.display = '';
  } else {
    btn.classList.remove('mode-smart-edge');
    if (tolWrap) tolWrap.style.display = 'none';
  }
};

/* ── SMART EDGE TOGGLE (mobile) ── */
window.mobToggleSmartEdge = function() {
  window.smartEdge = !window.smartEdge;

  // Pill button in brush bar
  const pill = document.getElementById('mob-smart-edge-pill');
  if (pill) pill.classList.toggle('active', window.smartEdge);

  // Show/hide mobile sensitivity row
  const mobSensRow = document.getElementById('mob-smart-edge-sensitivity-row');
  if (mobSensRow) mobSensRow.style.display = window.smartEdge ? 'flex' : 'none';

  // Sync desktop button + sensitivity wrap
  const deskBtn = document.getElementById('btn-smart-edge');
  if (deskBtn) deskBtn.classList.toggle('mode-smart-edge', window.smartEdge);
  const tolWrap = document.getElementById('smart-edge-tol-wrap');
  if (tolWrap) tolWrap.style.display = window.smartEdge ? '' : 'none';
};

/* ── BG COLOR ── */
window.setBg=function(color,el){
  currentBgColor=color; currentPhotoBg=null;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(el)el.classList.add('active');
  document.querySelectorAll('.photo-thumb').forEach(t=>t.classList.remove('active'));
  if(color==='transparent'){
    viewport.classList.add('checker-bg-vp');
  } else {
    viewport.classList.remove('checker-bg-vp');
  }
  updateBgTransformVisibility();
  drawComposite();
};
window.applyCustomColor=function(val){
  document.getElementById('custom-hex').value=val;
  // find & remove active swatch, use raw hex
  setBg(val, null);
};
window.hexInputChange=function(val){
  if(/^#[0-9a-fA-F]{6}$/.test(val)){
    document.getElementById('custom-color-pick').value=val;
    setBg(val,null);
  }
};

/* ── EFFECTS ── */
window.updateEffects=function(){
  shadowEnabled=document.getElementById('shadow-enable').checked;
  document.getElementById('shadow-controls').style.display=shadowEnabled?'flex':'none';
  shadowColor=document.getElementById('shadow-color').value;
  shadowOpacity=+document.getElementById('shadow-opacity').value;
  document.getElementById('shadow-opacity-val').textContent=shadowOpacity+'%';
  shadowBlur=+document.getElementById('shadow-blur').value;
  document.getElementById('shadow-blur-val').textContent=shadowBlur+'px';
  shadowDistance=+document.getElementById('shadow-distance').value;
  document.getElementById('shadow-distance-val').textContent=shadowDistance+'px';
  shadowAngle=+document.getElementById('shadow-angle').value;
  document.getElementById('shadow-angle-val').textContent=shadowAngle+'°';
  bgBlur=+document.getElementById('bg-blur').value;
  document.getElementById('bg-blur-val').textContent=bgBlur+'px';
  // Outline
  outlineEnabled=document.getElementById('outline-enable').checked;
  document.getElementById('outline-controls').style.display=outlineEnabled?'flex':'none';
  outlineColor=document.getElementById('outline-color').value;
  outlineWidth=+document.getElementById('outline-width').value;
  document.getElementById('outline-width-val').textContent=outlineWidth+'px';
  // Glow
  glowEnabled=document.getElementById('glow-enable').checked;
  document.getElementById('glow-controls').style.display=glowEnabled?'flex':'none';
  glowColor=document.getElementById('glow-color').value;
  glowStrength=+document.getElementById('glow-strength').value;
  document.getElementById('glow-strength-val').textContent=glowStrength+'%';
  glowBlur=+document.getElementById('glow-blur').value;
  document.getElementById('glow-blur-val').textContent=glowBlur+'px';
  // Sync to mobile controls
  const moe=document.getElementById('mob-outline-enable'); if(moe){moe.checked=outlineEnabled; document.getElementById('mob-outline-controls').style.display=outlineEnabled?'flex':'none'; document.getElementById('mob-outline-color').value=outlineColor; document.getElementById('mob-outline-width').value=outlineWidth; document.getElementById('mob-outline-width-val').textContent=outlineWidth+'px';}
  const mge=document.getElementById('mob-glow-enable'); if(mge){mge.checked=glowEnabled; document.getElementById('mob-glow-controls').style.display=glowEnabled?'flex':'none'; document.getElementById('mob-glow-color').value=glowColor; document.getElementById('mob-glow-strength').value=glowStrength; document.getElementById('mob-glow-strength-val').textContent=glowStrength+'%'; document.getElementById('mob-glow-blur').value=glowBlur; document.getElementById('mob-glow-blur-val').textContent=glowBlur+'px';}
  // Feather
  featherRadius = +document.getElementById('feather-radius').value;
  document.getElementById('feather-radius-val').textContent = featherRadius+'px';
  const mfr = document.getElementById('mob-feather-radius'); if(mfr){ mfr.value=featherRadius; document.getElementById('mob-feather-radius-val').textContent=featherRadius+'px'; }
  drawComposite();
};

/* ── PHOTO SEARCH (infinite scroll, shared state) ── */
let photoSearchState = { query:'', page:1, loading:false, exhausted:false, source:'' };

/* ── API KEYS ── */
const PIXABAY_API_KEY = '56195183-28e328d32f454f70395ff87ba';
const PEXELS_API_KEY  = 'o4lyPnNivfvjZiCGp6IfzVomd465edTzsZmJWlUMUHcvuJJoUmLVbAiC';

// Which source worked last — start with pixabay, auto-switch on failure
let preferredSource = 'pixabay';

async function fetchPhotoPage(query, page) {
  // Try preferred source first, then fallback to the other
  const order = preferredSource === 'pixabay'
    ? ['pixabay', 'pexels']
    : ['pexels', 'pixabay'];

  for (const src of order) {
    if (src === 'pixabay') {
      try {
        const res = await fetch(
          `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=18&page=${page}&safesearch=true`
        );
        if (!res.ok) throw new Error('pixabay ' + res.status);
        const data = await res.json();
        const hits = data.hits || [];
        if (!hits.length) throw new Error('empty');
        preferredSource = 'pixabay'; // mark as working
        return {
          photos: hits.map(p => ({ thumb: p.webformatURL, full: p.largeImageURL, label: p.user })),
          source: 'pixabay',
          hasMore: data.totalHits > page * 18
        };
      } catch(e) { console.warn('Pixabay failed:', e.message); }
    }

    if (src === 'pexels') {
      try {
        const res = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=18&page=${page}&orientation=landscape`,
          { headers: { Authorization: PEXELS_API_KEY } }
        );
        if (!res.ok) throw new Error('pexels ' + res.status);
        const data = await res.json();
        const photos = data.photos || [];
        if (!photos.length) throw new Error('empty');
        preferredSource = 'pexels'; // mark as working
        return {
          photos: photos.map(p => ({ thumb: p.src.small, full: p.src.large, label: p.photographer })),
          source: 'pexels',
          hasMore: !!data.next_page
        };
      } catch(e) { console.warn('Pexels failed:', e.message); }
    }
  }
  return null;
}

function appendPhotosToGrid(gridEl, photos, onPick) {
  photos.forEach(({thumb, full, label}) => {
    const img = document.createElement('img');
    img.className = 'photo-thumb';
    img.crossOrigin = 'anonymous';
    img.title = label || '';
    // Do NOT use loading="lazy" with crossOrigin — causes cache/CORS conflict
    // Set src after crossOrigin is set
    img.src = thumb;
    img.addEventListener('click', () => {
      if (img._picking) return; // prevent double-click spam
      onPick(img, full);
    });
    gridEl.appendChild(img);
  });
}

function setupInfiniteScroll(gridEl, onLoadMore) {
  // Remove old sentinel
  const old = gridEl.parentElement.querySelector('.photo-sentinel');
  if (old) old.remove();
  const sentinel = document.createElement('div');
  sentinel.className = 'photo-sentinel';
  sentinel.style.cssText = 'height:1px;width:100%;';
  gridEl.after(sentinel);
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) onLoadMore();
  }, { root: gridEl.parentElement, threshold: 0 });
  obs.observe(sentinel);
  return obs;
}

let desktopPhotoObs = null;
let _searchingDesktop = false;
window.searchPhotos = async function() {
  if (_searchingDesktop) return; // prevent spam clicks
  const q = document.getElementById('photo-query').value.trim();
  if (!q) {
    document.getElementById('photo-grid').innerHTML = '<div class="photo-loading">Type something and press Search.</div>';
    return;
  }
  _searchingDesktop = true;
  const searchBtn = document.querySelector('.photo-search-row button');
  if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = '…'; }
  const grid = document.getElementById('photo-grid');
  grid.innerHTML = '<div class="photo-loading">Searching…</div>';
  // Sync to mobile
  const mobQ = document.getElementById('mob-photo-query');
  if (mobQ) mobQ.value = q;

  if (desktopPhotoObs) { desktopPhotoObs.disconnect(); desktopPhotoObs = null; }
  photoSearchState = { query:q, page:1, loading:true, exhausted:false, source:'' };

  const result = await fetchPhotoPage(q, 1);
  _searchingDesktop = false;
  if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Search'; }
  grid.innerHTML = '';
  if (!result || !result.photos.length) {
    grid.innerHTML = '<div class="photo-loading">No results found. Try a different search.</div>';
    return;
  }
  appendPhotosToGrid(grid, result.photos, applyPhotoBg);
  photoSearchState = { query:q, page:1, loading:false, exhausted:!result.hasMore, source:result.source };
  document.querySelector('.photo-attribution').innerHTML = result.source === 'pixabay'
    ? 'Photos via <a href="https://pixabay.com" target="_blank">Pixabay</a>'
    : 'Photos via <a href="https://www.pexels.com" target="_blank">Pexels</a>';

  if (result.hasMore) {
    desktopPhotoObs = setupInfiniteScroll(grid, async () => {
      if (photoSearchState.loading || photoSearchState.exhausted) return;
      photoSearchState.loading = true;
      const nextPage = photoSearchState.page + 1;
      const more = await fetchPhotoPage(photoSearchState.query, nextPage);
      if (more && more.photos.length) {
        appendPhotosToGrid(grid, more.photos, applyPhotoBg);
        photoSearchState.page = nextPage;
        photoSearchState.exhausted = !more.hasMore;
      } else {
        photoSearchState.exhausted = true;
      }
      photoSearchState.loading = false;
    });
  }
};

let mobPhotoObs = null;
let _searchingMob = false;
window.mobSearchPhotos = async function() {
  if (_searchingMob) return;
  const q = document.getElementById('mob-photo-query').value.trim();
  if (!q) {
    document.getElementById('mob-photo-grid').innerHTML = '<div class="photo-loading">Type something and press Search.</div>';
    return;
  }
  _searchingMob = true;
  const mobSearchBtn = document.getElementById('mob-photo-search-btn');
  if (mobSearchBtn) { mobSearchBtn.disabled = true; mobSearchBtn.textContent = '…'; }
  const grid = document.getElementById('mob-photo-grid');
  grid.innerHTML = '<div class="photo-loading">Searching…</div>';
  // Sync to desktop
  const deskQ = document.getElementById('photo-query');
  if (deskQ) deskQ.value = q;

  if (mobPhotoObs) { mobPhotoObs.disconnect(); mobPhotoObs = null; }
  let mobState = { page:1, loading:true, exhausted:false };

  const result = await fetchPhotoPage(q, 1);
  _searchingMob = false;
  if (mobSearchBtn) { mobSearchBtn.disabled = false; mobSearchBtn.textContent = 'Search'; }
  grid.innerHTML = '';
  if (!result || !result.photos.length) {
    grid.innerHTML = '<div class="photo-loading">No results. Try a different search.</div>';
    return;
  }
  appendPhotosToGrid(grid, result.photos, (img, full) => { applyPhotoBg(img, full); closeMobSheet(); });
  mobState = { page:1, loading:false, exhausted:!result.hasMore };

  // Update mobile attribution
  const mobAttr = document.getElementById('mob-photo-attribution');
  if (mobAttr) {
    mobAttr.innerHTML = result.source === 'pixabay'
      ? 'Photos via <a href="https://pixabay.com" target="_blank">Pixabay</a>'
      : 'Photos via <a href="https://www.pexels.com" target="_blank">Pexels</a>';
  }

  if (result.hasMore) {
    mobPhotoObs = setupInfiniteScroll(grid, async () => {
      if (mobState.loading || mobState.exhausted) return;
      mobState.loading = true;
      const more = await fetchPhotoPage(q, mobState.page + 1);
      if (more && more.photos.length) {
        appendPhotosToGrid(grid, more.photos, (img, full) => { applyPhotoBg(img, full); closeMobSheet(); });
        mobState.page++;
        mobState.exhausted = !more.hasMore;
      } else {
        mobState.exhausted = true;
      }
      mobState.loading = false;
    });
  }
};

// Upload BG from PC
window.applyUploadedBg = async function(input) {
  const file = input.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = await loadImg(url);
  document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  viewport.classList.remove('checker-bg-vp');
  currentPhotoBg = { url, img };
  currentBgColor = 'transparent';
  updateBgTransformVisibility();
  drawComposite();
  const lbl = document.getElementById('bg-upload-file').parentElement;
  lbl.style.backgroundImage = `url(${url})`;
  lbl.style.backgroundSize = 'cover';
  lbl.style.backgroundPosition = 'center';
  lbl.querySelector('div').children[0].textContent = '✓ ' + file.name.slice(0,18);
};

async function applyPhotoBg(el, url) {
  if (el._picking) return; // guard against rapid clicks
  el._picking = true;
  document.querySelectorAll('.photo-thumb').forEach(t => { t.classList.remove('active'); t._picking = false; });
  el.classList.add('active');
  el.style.opacity = '0.6';
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  viewport.classList.remove('checker-bg-vp');
  try {
    const img = await loadImg(url);
    currentPhotoBg = { url, img };
    currentBgColor = 'transparent';
    updateBgTransformVisibility();
    drawComposite();
  } catch(e) {
    console.warn('applyPhotoBg failed:', e);
  } finally {
    el.style.opacity = '';
    el._picking = false;
  }
}

/* ── SUBJECT TRANSFORM ── */
window.updateSubjectTransform = function() {
  subjectScale = +document.getElementById('subject-scale').value / 100;
  subjectX = +document.getElementById('subject-x').value;
  subjectY = +document.getElementById('subject-y').value;
  subjectRotation = +document.getElementById('subject-rotate').value;
  document.getElementById('subject-scale-val').textContent = Math.round(subjectScale*100) + '%';
  document.getElementById('subject-x-val').textContent = subjectX;
  document.getElementById('subject-y-val').textContent = subjectY;
  document.getElementById('subject-rotate-val').textContent = subjectRotation + '°';
  // Sync mobile
  const mr = document.getElementById('mob-subject-rotate'); if(mr){mr.value=subjectRotation;document.getElementById('mob-subject-rotate-val').textContent=subjectRotation+'°';}
  drawComposite();
};

window.resetSubjectTransform = function() {
  subjectScale = 1; subjectX = 0; subjectY = 0; subjectRotation = 0;
  flipX = false; flipY = false;
  document.getElementById('subject-scale').value = 100;
  document.getElementById('subject-x').value = 0;
  document.getElementById('subject-y').value = 0;
  document.getElementById('subject-rotate').value = 0;
  document.getElementById('subject-scale-val').textContent = '100%';
  document.getElementById('subject-x-val').textContent = '0';
  document.getElementById('subject-y-val').textContent = '0';
  document.getElementById('subject-rotate-val').textContent = '0°';
  const mr = document.getElementById('mob-subject-rotate'); if(mr){mr.value=0;document.getElementById('mob-subject-rotate-val').textContent='0°';}
  updateFlipButtons();
  drawComposite();
};

/* ── BACKGROUND PHOTO TRANSFORM (desktop) ── */
window.updateBgTransform = function() {
  bgScale   = +document.getElementById('bg-scale').value / 100;
  bgOffsetX = +document.getElementById('bg-offset-x').value;
  bgOffsetY = +document.getElementById('bg-offset-y').value;
  document.getElementById('bg-scale-val').textContent = Math.round(bgScale*100) + '%';
  document.getElementById('bg-offset-x-val').textContent = bgOffsetX;
  document.getElementById('bg-offset-y-val').textContent = bgOffsetY;
  // Sync mobile sliders
  const mbs = document.getElementById('mob-bg-scale'); if(mbs){mbs.value=Math.round(bgScale*100);document.getElementById('mob-bg-scale-val').textContent=Math.round(bgScale*100)+'%';}
  const mbx = document.getElementById('mob-bg-x'); if(mbx){mbx.value=bgOffsetX;document.getElementById('mob-bg-x-val').textContent=bgOffsetX;}
  const mby = document.getElementById('mob-bg-y'); if(mby){mby.value=bgOffsetY;document.getElementById('mob-bg-y-val').textContent=bgOffsetY;}
  drawComposite();
};

window.resetBgTransform = function() {
  bgScale = 1; bgOffsetX = 0; bgOffsetY = 0;
  document.getElementById('bg-scale').value = 100;
  document.getElementById('bg-offset-x').value = 0;
  document.getElementById('bg-offset-y').value = 0;
  document.getElementById('bg-scale-val').textContent = '100%';
  document.getElementById('bg-offset-x-val').textContent = '0';
  document.getElementById('bg-offset-y-val').textContent = '0';
  const mbs = document.getElementById('mob-bg-scale'); if(mbs){mbs.value=100;document.getElementById('mob-bg-scale-val').textContent='100%';}
  const mbx = document.getElementById('mob-bg-x'); if(mbx){mbx.value=0;document.getElementById('mob-bg-x-val').textContent='0';}
  const mby = document.getElementById('mob-bg-y'); if(mby){mby.value=0;document.getElementById('mob-bg-y-val').textContent='0';}
  drawComposite();
};

/* ── BACKGROUND PHOTO TRANSFORM (mobile) ── */
window.mobUpdateBgTransform = function() {
  bgScale   = +document.getElementById('mob-bg-scale').value / 100;
  bgOffsetX = +document.getElementById('mob-bg-x').value;
  bgOffsetY = +document.getElementById('mob-bg-y').value;
  document.getElementById('mob-bg-scale-val').textContent = Math.round(bgScale*100) + '%';
  document.getElementById('mob-bg-x-val').textContent = bgOffsetX;
  document.getElementById('mob-bg-y-val').textContent = bgOffsetY;
  // Sync desktop sliders
  const bs = document.getElementById('bg-scale'); if(bs){bs.value=Math.round(bgScale*100);document.getElementById('bg-scale-val').textContent=Math.round(bgScale*100)+'%';}
  const bx = document.getElementById('bg-offset-x'); if(bx){bx.value=bgOffsetX;document.getElementById('bg-offset-x-val').textContent=bgOffsetX;}
  const by = document.getElementById('bg-offset-y'); if(by){by.value=bgOffsetY;document.getElementById('bg-offset-y-val').textContent=bgOffsetY;}
  drawComposite();
};

window.mobResetBgTransform = function() {
  bgScale = 1; bgOffsetX = 0; bgOffsetY = 0;
  ['mob-bg-scale','mob-bg-x','mob-bg-y'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.value=[100,0,0][i];});
  document.getElementById('mob-bg-scale-val').textContent='100%';
  document.getElementById('mob-bg-x-val').textContent='0';
  document.getElementById('mob-bg-y-val').textContent='0';
  const bs = document.getElementById('bg-scale'); if(bs){bs.value=100;document.getElementById('bg-scale-val').textContent='100%';}
  const bx = document.getElementById('bg-offset-x'); if(bx){bx.value=0;document.getElementById('bg-offset-x-val').textContent='0';}
  const by = document.getElementById('bg-offset-y'); if(by){by.value=0;document.getElementById('bg-offset-y-val').textContent='0';}
  drawComposite();
};

// Show/hide the background-position controls (desktop + mobile) based on whether a photo bg is active
function updateBgTransformVisibility() {
  const show = !!currentPhotoBg;
  const dEl = document.getElementById('bg-transform-controls');
  if (dEl) dEl.style.display = show ? 'flex' : 'none';
  // Mobile: show/hide bg tab availability info (the bg panel content is always accessible, just show a note if no photo)
  const mNote = document.getElementById('mob-bg-transform-note');
  if (mNote) mNote.style.display = show ? 'none' : '';
}

/* ── PANEL TOGGLE ── */
window.togglePanel=function(id){document.getElementById(id).classList.toggle('collapsed');};

/* ── DOWNLOAD ── */
function buildExportCanvasForItem(item) {
  const subject = item.resultCanvas;
  const w = subject.width, h = subject.height;
  const exp = document.createElement('canvas'); exp.width=w; exp.height=h;
  const ectx = exp.getContext('2d');
  const bg = item.bgSnapshot || {};
  const gradients = {'gradient-purple':['#667eea','#764ba2'],'gradient-pink':['#f093fb','#f5576c'],'gradient-blue':['#4facfe','#00f2fe'],'gradient-green':['#43e97b','#38f9d7']};

  // Pre-compute ratio (export canvas vs display canvas)
  const dcW0   = bg.dcWidth  || w;
  const ratio  = w / dcW0;

  // 1. Background
  if (bg.photoBg && bg.photoBg.img) {
    ectx.save();
    if (bg.bgBlur > 0) ectx.filter = "blur(" + bg.bgBlur + "px)";
    const imgW = bg.photoBg.img.naturalWidth, imgH = bg.photoBg.img.naturalHeight;
    const bgSc = (bg.bgScale || 1);
    const sc = Math.max(w/imgW, h/imgH) * bgSc;
    ectx.drawImage(bg.photoBg.img, (w-imgW*sc)/2 + (bg.bgOffsetX||0)*ratio, (h-imgH*sc)/2 + (bg.bgOffsetY||0)*ratio, imgW*sc, imgH*sc);
    ectx.filter = 'none'; ectx.restore();
  } else if (bg.bgColor && bg.bgColor !== 'transparent') {
    if (gradients[bg.bgColor]) {
      const g = ectx.createLinearGradient(0,0,w,h);
      g.addColorStop(0, gradients[bg.bgColor][0]);
      g.addColorStop(1, gradients[bg.bgColor][1]);
      ectx.fillStyle = g;
    } else {
      ectx.fillStyle = bg.bgColor;
    }
    ectx.fillRect(0,0,w,h);
  }

  // 2. Subject — mirror exactly what drawComposite does on dc, scaled up to full res
  // drawComposite uses dc (dcW x dcH) with subjectScale and subjectX/Y in dc-pixels.
  // Export canvas is (w x h). ratio = w/dcW converts dc-pixels → export-pixels.
  const sScale = bg.subjectScale != null ? bg.subjectScale : 1;
  const dcW    = dcW0;
  const dcH    = bg.dcHeight || h;

  const drawnW_dc  = dcW * sScale;
  const drawnH_dc  = dcH * sScale;
  const originX_dc = (dcW - drawnW_dc) / 2 + (bg.subjectX || 0);
  const originY_dc = (dcH - drawnH_dc) / 2 + (bg.subjectY || 0);

  const eSW = drawnW_dc  * ratio;
  const eSH = drawnH_dc  * ratio;
  const eSX = originX_dc * ratio;
  const eSY = originY_dc * ratio;
  const eCX = eSX + eSW / 2;
  const eCY = eSY + eSH / 2;
  const eRad = (bg.subjectRotation || 0) * Math.PI / 180;
  const eFlipX = !!bg.flipX, eFlipY = !!bg.flipY;

  // Glow export
  if (bg.glowEnabled && bg.glowBlur > 0) {
    const hex = bg.glowColor, a = (bg.glowStrength || 60) / 100;
    const r = parseInt(hex.slice(1,3),16), gv = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    ectx.shadowColor = "rgba(" + r + "," + gv + "," + b + "," + a + ")";
    ectx.shadowBlur = bg.glowBlur * 2 * ratio;
    ectx.shadowOffsetX = 0;
    ectx.shadowOffsetY = 0;
    const passes = Math.max(1, Math.round((bg.glowStrength||60) / 30));
    for (let p = 0; p < passes; p++) ectx.drawImage(subject, eSX, eSY, eSW, eSH);
    ectx.restore();
  }

  if (bg.shadowEnabled) {
    const rad = bg.shadowAngle * Math.PI / 180;
    const dx  = Math.cos(rad) * bg.shadowDistance * ratio;
    const dy  = Math.sin(rad) * bg.shadowDistance * ratio;
    const hex = bg.shadowColor, a = bg.shadowOpacity / 100;
    const r = parseInt(hex.slice(1,3),16), gv = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    ectx.shadowColor   = "rgba(" + r + "," + gv + "," + b + "," + a + ")";
    ectx.shadowBlur    = bg.shadowBlur * ratio;
    ectx.shadowOffsetX = dx;
    ectx.shadowOffsetY = dy;
    ectx.drawImage(subject, eSX, eSY, eSW, eSH);
    ectx.restore();
  }

  // Outline export
  if (bg.outlineEnabled && bg.outlineWidth > 0) {
    ectx.save();
    ectx.translate(eCX, eCY); ectx.rotate(eRad);
    if (eFlipX) ectx.scale(-1, 1);
    if (eFlipY) ectx.scale(1, -1);
    ectx.translate(-eCX, -eCY);
    drawOutline(ectx, subject, eSX, eSY, eSW, eSH, bg.outlineColor, bg.outlineWidth * ratio);
    ectx.restore();
  }

  ectx.save();
  ectx.translate(eCX, eCY); ectx.rotate(eRad);
  if (eFlipX) ectx.scale(-1, 1);
  if (eFlipY) ectx.scale(1, -1);
  ectx.translate(-eCX, -eCY);
  const exportFeather = bg.featherRadius || 0;
  const featheredExport = exportFeather > 0 ? applyFeatherToCanvas(subject, exportFeather) : subject;
  ectx.drawImage(featheredExport, eSX, eSY, eSW, eSH);
  ectx.restore();
  return exp;
}

// ── Format selector ──────────────────────────────────────────
let _dlFormat = 'png';

window.setFormat = function(fmt, btn) {
  _dlFormat = fmt;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('fmt-btn-active'));
  document.querySelectorAll(`.fmt-btn[data-fmt="${fmt}"]`).forEach(b => b.classList.add('fmt-btn-active'));
  const showQ = fmt === 'jpeg' || fmt === 'webp';
  [document.getElementById('fmt-quality-row'), document.getElementById('mob-fmt-quality-row')].forEach(el => { if(el) el.style.display = showQ ? 'flex' : 'none'; });
  const label = fmt.toUpperCase();
  [document.getElementById('dl-btn-label'), document.getElementById('mob-dl-btn-label')].forEach(el => { if(el) el.textContent = 'Download ' + label; });
};

function _getMimeAndExt() {
  if (_dlFormat === 'jpeg') return { mime: 'image/jpeg', ext: 'jpg' };
  if (_dlFormat === 'webp') return { mime: 'image/webp', ext: 'webp' };
  return { mime: 'image/png', ext: 'png' };
}

function _getQuality() {
  const q = document.getElementById('fmt-quality');
  return q ? (+q.value / 100) : 0.92;
}
// ─────────────────────────────────────────────────────────────

window.downloadCurrent=function(){
  const item=items.find(i=>i.id==activeId); if(!item)return;
  if(wCanvas){
    const cvs=document.createElement('canvas');cvs.width=wCanvas.width;cvs.height=wCanvas.height;
    cvs.getContext('2d').drawImage(wCanvas,0,0);
    item.resultCanvas=cvs;
  }
  const exp=buildExportCanvasForItem(item);
  const {mime,ext}=_getMimeAndExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-bg-removed.${ext}`;a.click();},mime,_getQuality());
};

window.downloadItem=async function(id){
  const item=items.find(i=>i.id==id); if(!item||!item.resultCanvas)return;
  const exp=buildExportCanvasForItem(item);
  const {mime,ext}=_getMimeAndExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`;a.click();},mime,_getQuality());
};

window.downloadAll=async function(){
  const done=items.filter(i=>i.status==='done'); if(!done.length)return;
  const JSZip=window.JSZip;
  if(!JSZip){alert('JSZip not loaded. Please try again.');return;}
  const zip=new JSZip();
  const {mime,ext}=_getMimeAndExt();
  for(const item of done){
    const exp=buildExportCanvasForItem(item);
    const blob=await new Promise(res=>exp.toBlob(res,mime,_getQuality()));
    zip.file(`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`,blob);
  }
  const zipBlob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');a.href=URL.createObjectURL(zipBlob);a.download='westcrest-bg-removed.zip';a.click();
};

window.clearAll=function(){
  items=[]; activeId=null; editorOpened=false; wCanvas=null; wCtx=null; origData=null;
  brushMode=null; isPainting=false; isPanning=false; eventsReady=false;
  zoom=1;panX=0;panY=0;baseW=0;baseH=0;
  undoStack=[];redoStack=[];updateUndoUI();
  currentBgColor='transparent';currentPhotoBg=null;
  fileIn.value='';
  dc.width=0;dc.height=0;cc.width=0;cc.height=0;
  document.getElementById('batch-grid').innerHTML='';
  document.getElementById('batch-header').classList.remove('active');
  document.getElementById('editor-wrap').classList.remove('active');
  dropZone.classList.remove('hidden');
};

/* ── MOBILE UI ── */
const isMobile = () => window.innerWidth <= 768;

// Show/hide toolbar when editor opens
const _origOpenEditor = window._origOpenEditor;
function mobShowToolbar(show) {
  const tb = document.getElementById('mob-toolbar');
  if (tb) tb.classList.toggle('active', show);
}

// Intercept openEditor to also show mob toolbar
const _openEditorOrig = openEditor;
// We patch via observer since openEditor is defined in same scope:
// Instead watch editor-wrap class changes
const editorWrapEl = document.getElementById('editor-wrap');
if (editorWrapEl) {
  new MutationObserver(() => {
    const active = editorWrapEl.classList.contains('active');
    mobShowToolbar(active && isMobile());
  }).observe(editorWrapEl, { attributes:true, attributeFilter:['class'] });
}
window.addEventListener('resize', () => {
  const active = editorWrapEl && editorWrapEl.classList.contains('active');
  mobShowToolbar(active && isMobile());
});

/* ── Sheet open/close ── */
let currentSheet = null;
window.openMobSheet = function(name) {
  closeMobSheet();
  const sheet = document.getElementById('mob-sheet-' + name);
  const backdrop = document.getElementById('mob-backdrop');
  if (!sheet) return;
  currentSheet = name;
  backdrop.classList.add('active');
  sheet.classList.add('open');
};
window.closeMobSheet = function() {
  document.querySelectorAll('.mob-sheet').forEach(s => s.classList.remove('open'));
  document.getElementById('mob-backdrop').classList.remove('active');
  currentSheet = null;
};

/* ── Brush mode (mobile) ── */
window.mobSetBrush = function(mode) {
  // Toggle off if same
  if (brushMode === mode || mode === null) {
    brushMode = null;
    updateViewportCursor();
    document.getElementById('mob-btn-erase').classList.remove('mode-erase');
    document.getElementById('mob-btn-restore').classList.remove('mode-restore');
    document.getElementById('mob-brush-bar').classList.remove('active');
    // Hide sensitivity row too
    const sensRow = document.getElementById('mob-smart-edge-sensitivity-row');
    if (sensRow) sensRow.style.display = 'none';
    // Also sync desktop buttons
    document.getElementById('btn-erase').classList.remove('mode-erase');
    document.getElementById('btn-restore').classList.remove('mode-restore');
    // Recompute canvas size now brush bar is hidden
    if (wCanvas) { computeBaseSize(); renderAll(); }
    return;
  }
  brushMode = mode;
  viewport.style.cursor = 'none';
  document.getElementById('mob-btn-erase').classList.toggle('mode-erase', mode==='erase');
  document.getElementById('mob-btn-erase').classList.toggle('mode-restore', false);
  document.getElementById('mob-btn-restore').classList.toggle('mode-restore', mode==='restore');
  document.getElementById('mob-btn-restore').classList.toggle('mode-erase', false);
  document.getElementById('mob-brush-bar').classList.add('active');
  // Sync desktop
  document.getElementById('btn-erase').classList.toggle('mode-erase', mode==='erase');
  document.getElementById('btn-restore').classList.toggle('mode-restore', mode==='restore');
  // Sync brush size
  const mobSz = document.getElementById('mob-brush-size');
  if (mobSz) window.brushSize = +mobSz.value;
  // Recompute canvas size now brush bar is visible
  if (wCanvas) { computeBaseSize(); renderAll(); }
};

/* ── Tab switch (mobile) — My Photo vs Background controls ── */
window.mobSwitchTab = function(which) {
  const subjBtn = document.getElementById('mob-tab-subject');
  const bgBtn   = document.getElementById('mob-tab-bg');
  const subjPanel = document.getElementById('mob-transform-subject');
  const bgPanel   = document.getElementById('mob-transform-bg');
  const isSubj = which === 'subject';
  subjPanel.style.display = isSubj ? '' : 'none';
  bgPanel.style.display   = isSubj ? 'none' : '';
  subjBtn.style.background = isSubj ? 'var(--gold)' : 'transparent';
  subjBtn.style.color      = isSubj ? '#000' : 'var(--muted)';
  subjBtn.style.borderColor= isSubj ? 'var(--gold)' : 'var(--faint)';
  bgBtn.style.background   = isSubj ? 'transparent' : 'var(--gold)';
  bgBtn.style.color        = isSubj ? 'var(--muted)' : '#000';
  bgBtn.style.borderColor  = isSubj ? 'var(--faint)' : 'var(--gold)';
};

/* ── Subject transform (mobile) ── */
window.mobUpdateSubject = function() {
  subjectScale = +document.getElementById('mob-subject-scale').value / 100;
  subjectX = +document.getElementById('mob-subject-x').value;
  subjectY = +document.getElementById('mob-subject-y').value;
  subjectRotation = +document.getElementById('mob-subject-rotate').value;
  document.getElementById('mob-subject-scale-val').textContent = Math.round(subjectScale*100) + '%';
  document.getElementById('mob-subject-x-val').textContent = subjectX;
  document.getElementById('mob-subject-y-val').textContent = subjectY;
  document.getElementById('mob-subject-rotate-val').textContent = subjectRotation + '°';
  // Sync desktop sliders
  const ss = document.getElementById('subject-scale'); if(ss){ss.value=Math.round(subjectScale*100);document.getElementById('subject-scale-val').textContent=Math.round(subjectScale*100)+'%';}
  const sx = document.getElementById('subject-x'); if(sx){sx.value=subjectX;document.getElementById('subject-x-val').textContent=subjectX;}
  const sy = document.getElementById('subject-y'); if(sy){sy.value=subjectY;document.getElementById('subject-y-val').textContent=subjectY;}
  const sr = document.getElementById('subject-rotate'); if(sr){sr.value=subjectRotation;document.getElementById('subject-rotate-val').textContent=subjectRotation+'°';}
  drawComposite();
};
window.mobResetSubject = function() {
  subjectScale=1;subjectX=0;subjectY=0;subjectRotation=0;
  ['mob-subject-scale','mob-subject-x','mob-subject-y','mob-subject-rotate'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.value=[100,0,0,0][i];});
  document.getElementById('mob-subject-scale-val').textContent='100%';
  document.getElementById('mob-subject-x-val').textContent='0';
  document.getElementById('mob-subject-y-val').textContent='0';
  document.getElementById('mob-subject-rotate-val').textContent='0°';
  resetSubjectTransform();
};

/* ── Shadow (mobile) ── */
window.mobUpdateShadow = function() {
  const en = document.getElementById('mob-shadow-enable').checked;
  // Sync to desktop shadow inputs
  document.getElementById('shadow-enable').checked = en;
  if (en) {
    document.getElementById('shadow-color').value = document.getElementById('mob-shadow-color').value;
    document.getElementById('shadow-opacity').value = document.getElementById('mob-shadow-opacity').value;
    document.getElementById('shadow-blur').value = document.getElementById('mob-shadow-blur').value;
    document.getElementById('shadow-distance').value = document.getElementById('mob-shadow-distance').value;
    document.getElementById('shadow-angle').value = document.getElementById('mob-shadow-angle').value;
  }
  document.getElementById('mob-shadow-controls').style.display = en ? 'flex' : 'none';
  // Update display vals
  document.getElementById('mob-shadow-opacity-val').textContent = document.getElementById('mob-shadow-opacity').value + '%';
  document.getElementById('mob-shadow-blur-val').textContent = document.getElementById('mob-shadow-blur').value + 'px';
  document.getElementById('mob-shadow-distance-val').textContent = document.getElementById('mob-shadow-distance').value + 'px';
  document.getElementById('mob-shadow-angle-val').textContent = document.getElementById('mob-shadow-angle').value + '°';
  updateEffects();
};

/* ── Outline (mobile) ── */
window.mobUpdateOutline = function() {
  const en = document.getElementById('mob-outline-enable').checked;
  document.getElementById('outline-enable').checked = en;
  outlineEnabled = en;
  document.getElementById('mob-outline-controls').style.display = en ? 'flex' : 'none';
  document.getElementById('outline-controls').style.display = en ? 'flex' : 'none';
  if (en) {
    outlineColor = document.getElementById('mob-outline-color').value;
    outlineWidth = +document.getElementById('mob-outline-width').value;
    document.getElementById('outline-color').value = outlineColor;
    document.getElementById('outline-width').value = outlineWidth;
    document.getElementById('outline-width-val').textContent = outlineWidth + 'px';
  }
  document.getElementById('mob-outline-width-val').textContent = document.getElementById('mob-outline-width').value + 'px';
  drawComposite();
};

/* ── Glow (mobile) ── */
window.mobUpdateGlow = function() {
  const en = document.getElementById('mob-glow-enable').checked;
  document.getElementById('glow-enable').checked = en;
  glowEnabled = en;
  document.getElementById('mob-glow-controls').style.display = en ? 'flex' : 'none';
  document.getElementById('glow-controls').style.display = en ? 'flex' : 'none';
  if (en) {
    glowColor = document.getElementById('mob-glow-color').value;
    glowStrength = +document.getElementById('mob-glow-strength').value;
    glowBlur = +document.getElementById('mob-glow-blur').value;
    document.getElementById('glow-color').value = glowColor;
    document.getElementById('glow-strength').value = glowStrength;
    document.getElementById('glow-blur').value = glowBlur;
    document.getElementById('glow-strength-val').textContent = glowStrength + '%';
    document.getElementById('glow-blur-val').textContent = glowBlur + 'px';
  }
  document.getElementById('mob-glow-strength-val').textContent = document.getElementById('mob-glow-strength').value + '%';
  document.getElementById('mob-glow-blur-val').textContent = document.getElementById('mob-glow-blur').value + 'px';
  drawComposite();
};

/* ── BG Blur (mobile) ── */
window.mobUpdateBgBlur = function(val) {
  bgBlur = +val;
  document.getElementById('mob-bg-blur-val').textContent = val + 'px';
  document.getElementById('bg-blur').value = val;
  document.getElementById('bg-blur-val').textContent = val + 'px';
  drawComposite();
};

/* ── Photo search (mobile) — defined above in shared search section ── */
/* ── Touch subject drag ── */
// We patch into the existing touch events via a flag approach
// When no brushMode and single finger touch, drag subject
let mobTouchDragActive = false;
let mobTouchDragStart = {x:0, y:0};

viewport.addEventListener('touchstart', e => {
  if (e.touches.length === 1 && !brushMode) {
    mobTouchDragActive = true;
    mobTouchDragStart = { x: e.touches[0].clientX - subjectX, y: e.touches[0].clientY - subjectY };
  }
}, { passive: true, capture: true });

viewport.addEventListener('touchmove', e => {
  if (mobTouchDragActive && e.touches.length === 1 && !brushMode) {
    e.preventDefault();
    subjectX = e.touches[0].clientX - mobTouchDragStart.x;
    subjectY = e.touches[0].clientY - mobTouchDragStart.y;
    // Sync mobile sliders
    const sxEl = document.getElementById('mob-subject-x');
    const syEl = document.getElementById('mob-subject-y');
    if (sxEl) { sxEl.value = Math.max(-500, Math.min(500, Math.round(subjectX))); document.getElementById('mob-subject-x-val').textContent = Math.round(subjectX); }
    if (syEl) { syEl.value = Math.max(-500, Math.min(500, Math.round(subjectY))); document.getElementById('mob-subject-y-val').textContent = Math.round(subjectY); }
    drawComposite();
  }
}, { passive: false, capture: true });

viewport.addEventListener('touchend', () => { mobTouchDragActive = false; }, { passive: true, capture: true });

/* ── FAQ ── */
window.toggleFaq = function(el) {
  document.querySelectorAll('.faq-item.open').forEach(item => {
    if (item !== el) item.classList.remove('open');
  });
  el.classList.toggle('open');
};

/* ── BEFORE / AFTER COMPARE ── */
window.toggleBeforeAfter = function() {
  if (!wCanvas || !origData) return;
  beforeAfterMode = !beforeAfterMode;
  window._baMode = beforeAfterMode;
  const baBtn = document.getElementById('btn-before-after');
  if (baBtn) {
    if (beforeAfterMode) {
      baBtn.style.borderColor = 'var(--gold-border)';
      baBtn.style.color = 'var(--gold)';
      baBtn.style.background = 'var(--gold-dim)';
      baBtn.textContent = '← Back to Result';
      // Draw original image on display canvas
      const dw = dc.width, dh = dc.height;
      dctx.clearRect(0, 0, dw, dh);
      const tmpC = document.createElement('canvas');
      tmpC.width = origData.width; tmpC.height = origData.height;
      tmpC.getContext('2d').putImageData(origData, 0, 0);
      dctx.drawImage(tmpC, 0, 0, dw, dh);
    } else {
      baBtn.style.borderColor = 'var(--faint)';
      baBtn.style.color = 'var(--text-muted)';
      baBtn.style.background = 'var(--dark-4)';
      baBtn.textContent = '⇔ Before/After';
      drawComposite(); // restore result view
    }
  }
};

// ── UTIL ── */
function loadImg(src){
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => {
      // Retry without crossOrigin (fallback for non-CORS sources)
      const i2 = new Image();
      i2.onload = () => res(i2);
      i2.onerror = () => rej(new Error('Image load failed: ' + src));
      i2.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now();
    };
    i.src = src;
  });
}

/* ══════════════════════════════════════════════════════════
   SLIDER ENHANCER
   Converts every <input type=range> + adjacent .slider-val span
   into: [range slider] [editable number box] [↺ mini reset]
   - Number box lets the user type an exact value; typing updates
     the slider live and fires the slider's original handler.
   - Mini reset restores that ONE control to its defaultValue
     (the value/min baked into the HTML), without touching siblings.
   - Skips any slider whose value box has already been converted,
     so this is safe to call more than once and never double-boxes.
   ══════════════════════════════════════════════════════════ */
function enhanceSliders(root) {
  root = root || document;
  const ranges = root.querySelectorAll('input[type="range"]');

  ranges.forEach(range => {
    if (range.dataset.enhanced === '1') return; // already processed

    const valId = range.id + '-val';
    const valSpan = document.getElementById(valId);
    if (!valSpan) return; // no companion display — leave slider alone (e.g. unlabeled sliders)
    if (valSpan.dataset.enhanced === '1') return;

    // Parse current text to detect a unit suffix (px, %, °) or none
    const rawText = valSpan.textContent.trim();
    const numMatch = rawText.match(/-?\d+(\.\d+)?/);
    const unit = numMatch ? rawText.slice(numMatch.index + numMatch[0].length) : '';

    // Build number input (replaces the span's job, keeps the same id so
    // existing JS that does document.getElementById(id+'-val').textContent=
    // still works — we intercept via a setter shim below)
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.className = 'slider-val-input';
    numInput.id = valId;
    numInput.min = range.min;
    numInput.max = range.max;
    numInput.step = range.step || '1';
    numInput.value = range.value;
    numInput.dataset.enhanced = '1';
    numInput.dataset.unit = unit;

    // Unit label shown after the box (px / % / °), purely cosmetic
    let unitSpan = null;
    if (unit) {
      unitSpan = document.createElement('span');
      unitSpan.className = 'slider-val-unit';
      unitSpan.textContent = unit;
    }

    // Mini reset button — restores ONLY this slider to its HTML default
    const defaultVal = range.getAttribute('value') || range.defaultValue || range.min;
    const miniReset = document.createElement('button');
    miniReset.type = 'button';
    miniReset.className = 'slider-mini-reset';
    miniReset.title = 'Reset this value';
    miniReset.innerHTML = '↺';
    miniReset.addEventListener('click', () => {
      range.value = defaultVal;
      numInput.value = defaultVal;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Swap span -> number input in the DOM, then append unit + reset after it
    valSpan.replaceWith(numInput);
    if (unitSpan) numInput.insertAdjacentElement('afterend', unitSpan);
    (unitSpan || numInput).insertAdjacentElement('afterend', miniReset);

    // ── Back-compat shim ──────────────────────────────────────────
    // Lots of existing code does: document.getElementById(id+'-val').textContent = '123%'
    // That used to set a <span>'s text. Now the element is an <input>, where
    // .textContent is invisible (the box shows .value instead). Rather than
    // rewriting ~90 call sites, we override .textContent on THIS element so
    // old assignments transparently extract the number and unit and route
    // them to .value + the unit span, keeping every existing call working.
    Object.defineProperty(numInput, 'textContent', {
      configurable: true,
      get() { return numInput.value + (numInput.dataset.unit || ''); },
      set(text) {
        const m = String(text).match(/-?\d+(\.\d+)?/);
        if (m) numInput.value = m[0];
        const u = m ? String(text).slice(m.index + m[0].length) : '';
        if (u && unitSpan) unitSpan.textContent = u;
      }
    });
    // ─────────────────────────────────────────────────────────────

    // Number box -> range slider (typing sets the slider + fires its handler)
    const pushToRange = () => {
      let v = parseFloat(numInput.value);
      if (isNaN(v)) return;
      const min = parseFloat(range.min), max = parseFloat(range.max);
      if (min !== undefined && !isNaN(min)) v = Math.max(min, v);
      if (max !== undefined && !isNaN(max)) v = Math.min(max, v);
      numInput.value = v;
      range.value = v;
      range.dispatchEvent(new Event('input', { bubbles: true }));
    };
    numInput.addEventListener('change', pushToRange);
    numInput.addEventListener('keydown', e => { if (e.key === 'Enter') { pushToRange(); numInput.blur(); } });

    // Range slider -> number box (dragging keeps the box live in sync)
    range.addEventListener('input', () => {
      numInput.value = range.value;
    });

    range.dataset.enhanced = '1';
  });
}

// Run once DOM is ready (safe even if this script runs after DOMContentLoaded already fired)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => enhanceSliders());
} else {
  enhanceSliders();
}

// Re-scan whenever mobile sheets / panels open, in case new sliders were
// lazily inserted — cheap no-op for already-enhanced sliders.
window.enhanceSliders = enhanceSliders;

