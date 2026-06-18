/**
 * pdf-studio.js — Tool logic for PDF Studio Pro
 * Requires: pdf.js, pdf-lib, jszip (loaded via <script> in pdf-studio.html)
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const { PDFDocument, rgb, degrees, StandardFonts, PageSizes } = PDFLib;

/* ── STATE ── */
let currentMode = 'build';
let currentTool = null;
let loadedFiles = [];
let loadedImages = [];
let pageRotations = {};
let pageOrder = [];       // current order of ORIGINAL page numbers (1-indexed), deleted pages removed
let deletedPages = new Set();
let textOverlays = [];    // {page, x, y, text, size, color} - for the Edit Text tool
let totalPages = 0;
let pdfDoc = null;
let pdfIsEncrypted = false;
let pdfPassword = null;

// ── TOOLS DEFINITION ──
const TOOLS = {
  build: [
    { id:'img2pdf',   icon:'🖼️',  name:'Images → PDF',     desc:'Convert images to PDF with layout control' },
    { id:'merge',     icon:'🔗',  name:'Merge PDFs',        desc:'Combine multiple PDFs into one' },
  ],
  edit: [
    { id:'edittext',  icon:'✏️',  name:'Add / Edit Text',    desc:'Place editable text boxes anywhere on a page' },
    { id:'reorder',   icon:'↕️',  name:'Reorder Pages',     desc:'Drag pages to rearrange or delete' },
    { id:'rotate',    icon:'🔄',  name:'Rotate Pages',       desc:'Rotate any or all pages' },
    { id:'crop',      icon:'✂️',  name:'Crop / Trim',        desc:'Remove margins or crop to content' },
  ],
  tools: [
    { id:'split',     icon:'✂️',  name:'Split PDF',          desc:'Split by pages, range, or every N pages' },
    { id:'compress',  icon:'⚡',  name:'Compress PDF',       desc:'Reduce file size intelligently' },
    { id:'watermark', icon:'💧',  name:'Watermark',          desc:'Add text or image watermark' },
    { id:'protect',   icon:'🔒',  name:'Protect / Unlock',   desc:'Password protect or remove protection' },
    { id:'extract',   icon:'📄',  name:'Extract Pages',      desc:'Pull specific pages out as new PDF' },
    { id:'pdf2img',   icon:'🎨',  name:'PDF → Images',       desc:'Export pages as PNG/JPG images' },
  ]
};

// ── DOWNLOAD BUTTON LABEL/ICON PER TOOL ──
const DOWNLOAD_META = {
  img2pdf:   { label:'Download PDF',            icon:'download' },
  merge:     { label:'Download Merged PDF',      icon:'download' },
  reorder:   { label:'Download Edited PDF',      icon:'download' },
  rotate:    { label:'Download Rotated PDF',     icon:'download' },
  crop:      { label:'Download Cropped PDF',     icon:'download' },
  split:     { label:'Download Split ZIP',       icon:'zip' },
  compress:  { label:'Download Compressed PDF',  icon:'download' },
  watermark: { label:'Download Watermarked PDF', icon:'download' },
  extract:   { label:'Download Extracted Pages', icon:'download' },
  pdf2img:   { label:'Download Images',          icon:'zip' },
  edittext:  { label:'Download Edited PDF',      icon:'download' },
};
const DOWNLOAD_ICONS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  zip:      '<path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>',
  lock:     '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock:   '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
};
function setDownloadButton(label, iconKey) {
  const lbl = document.getElementById('btnDownloadLabel');
  const icon = document.getElementById('btnDownloadIcon');
  if (lbl) lbl.textContent = label;
  if (icon) icon.innerHTML = DOWNLOAD_ICONS[iconKey] || DOWNLOAD_ICONS.download;
}

// ── SIDEBAR RENDER ──
function renderSidebar() {
  const sc = document.getElementById('sidebarContent');
  const groups = { build: 'Build PDFs', edit: 'Edit Pages', tools: 'PDF Tools' };

  if (currentMode === 'build') {
    let html = '<div class="tool-section"><div class="tool-section-label">Build PDFs</div><div class="tool-grid">';
    TOOLS.build.forEach(t => {
      html += `<div class="tool-card ${currentTool===t.id?'active':''}" onclick="selectTool('${t.id}')">
        <div class="tool-card-icon">${t.icon}</div>
        <div class="tool-card-name">${t.name}</div>
        <div class="tool-card-desc">${t.desc}</div>
      </div>`;
    });
    html += '</div></div>';
    // file list
    if (loadedImages.length && currentTool === 'img2pdf') {
      html += renderImageList();
    } else if (loadedFiles.length && currentTool === 'merge') {
      html += renderFileList();
    } else {
      html += renderUploadZone();
    }
    sc.innerHTML = html;
  } else if (currentMode === 'edit') {
    let html = '<div class="tool-section"><div class="tool-section-label">Edit Pages</div><div class="tool-grid">';
    TOOLS.edit.forEach(t => {
      html += `<div class="tool-card ${currentTool===t.id?'active':''}" onclick="selectTool('${t.id}')">
        <div class="tool-card-icon">${t.icon}</div>
        <div class="tool-card-name">${t.name}</div>
        <div class="tool-card-desc">${t.desc}</div>
      </div>`;
    });
    html += '</div></div>';
    if (loadedFiles.length && currentTool) {
      html += renderFileList();
    } else {
      html += renderPDFUploadZone();
    }
    sc.innerHTML = html;
  } else {
    let html = '<div class="tool-section"><div class="tool-section-label">PDF Tools</div><div class="tool-grid">';
    TOOLS.tools.forEach(t => {
      html += `<div class="tool-card ${currentTool===t.id?'active':''}" onclick="selectTool('${t.id}')">
        <div class="tool-card-icon">${t.icon}</div>
        <div class="tool-card-name">${t.name}</div>
        <div class="tool-card-desc">${t.desc}</div>
      </div>`;
    });
    html += '</div></div>';
    if (loadedFiles.length) {
      html += renderFileList();
    } else {
      html += renderPDFUploadZone();
    }
    sc.innerHTML = html;
  }
  bindDragDrop();
}

function renderUploadZone() {
  return `<div class="upload-zone" id="uploadZone" onclick="document.getElementById('imgInput').click()">
    <div class="upload-icon">🖼️</div>
    <div class="upload-title">Drop images here</div>
    <div class="upload-sub">PNG, JPG, WEBP, GIF, BMP<br>Multiple files supported</div>
    <button class="btn-upload">Choose Images</button>
  </div>`;
}

function renderPDFUploadZone() {
  return `<div class="upload-zone" id="uploadZone" onclick="document.getElementById('pdfInput').click()">
    <div class="upload-icon">📄</div>
    <div class="upload-title">Drop PDF here</div>
    <div class="upload-sub">One or more PDF files<br>100% processed locally</div>
    <button class="btn-upload">Choose PDF</button>
  </div>`;
}

function renderFileList() {
  let html = '<div class="file-list">';
  loadedFiles.forEach((f, i) => {
    const size = formatSize(f.size);
    html += `<div class="file-item" draggable="true" data-idx="${i}">
      <div class="file-thumb">📄</div>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-meta">${size} · PDF</div>
      </div>
      <div class="file-actions">
        <button class="file-btn del" onclick="removeFile(${i})" title="Remove">✕</button>
      </div>
    </div>`;
  });
  html += `<div style="padding:4px 2px;">
    <button class="btn btn-outline" style="width:100%;justify-content:center;font-size:14px;" onclick="document.getElementById('pdfInput').click()">+ Add More PDFs</button>
  </div>`;
  html += '</div>';
  return html;
}

function renderImageList() {
  let html = '<div class="file-list">';
  loadedImages.forEach((img, i) => {
    const rot = img.rotation || 0;
    html += `<div class="file-item" draggable="true" data-imgidx="${i}">
      <div class="file-thumb"><img src="${img.url}" style="transform:rotate(${rot}deg);width:100%;height:100%;object-fit:cover;" /></div>
      <div class="file-info">
        <div class="file-name">${img.name}</div>
        <div class="file-meta">${formatSize(img.size)} · ${img.type}</div>
      </div>
      <div class="file-actions">
        <button class="file-btn" onclick="rotateImage(${i},-90)" title="Rotate left" style="font-size:14px;">↺</button>
        <button class="file-btn" onclick="rotateImage(${i},90)" title="Rotate right" style="font-size:14px;">↻</button>
        <button class="file-btn del" onclick="removeImage(${i})" title="Remove">✕</button>
      </div>
    </div>`;
  });
  html += `<div style="padding:4px 2px;">
    <button class="btn btn-outline" style="width:100%;justify-content:center;font-size:14px;" onclick="document.getElementById('imgInput').click()">+ Add More Images</button>
  </div>`;
  html += '</div>';
  return html;
}

// ── MODE / TOOL SWITCHING ──
function switchMode(mode) {
  currentMode = mode;
  currentTool = null;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('modeTab-' + mode).classList.add('active');
  clearMain();
  renderSidebar();
}

function selectTool(id) {
  currentTool = id;
  renderSidebar();
  renderMainForTool(id);
}

function clearMain() {
  document.getElementById('canvasArea').innerHTML = '<div class="empty" id="emptyState"><div class="empty-icon">📑</div><div class="empty-title">PDF Studio Pro</div><div class="empty-sub">Select a tool from the sidebar to begin.</div></div>';
  document.getElementById('optionsArea').innerHTML = '';
  document.getElementById('statsBar').style.display = 'none';
  document.getElementById('btnDownload').disabled = true;
  document.getElementById('btnPreview').style.display = 'none';
  document.getElementById('topbarTitle').innerHTML = '<span>PDF Studio Pro</span> — Select a tool to begin';
  setDownloadButton('Download PDF', 'download');
}

// ── MAIN AREA PER TOOL ──
function renderMainForTool(id) {
  document.getElementById('statsBar').style.display = 'flex';
  updateStats();
  const titles = {
    img2pdf:'Images → PDF Converter', merge:'Merge PDFs', reorder:'Reorder & Delete Pages',
    rotate:'Rotate Pages', crop:'Crop & Trim', split:'Split PDF',
    compress:'Compress PDF', watermark:'Watermark PDF', protect:'Protect / Unlock PDF',
    extract:'Extract Pages', pdf2img:'PDF → Images', edittext:'Add / Edit Text'
  };
  document.getElementById('topbarTitle').innerHTML = `<span>PDF Studio Pro</span> — ${titles[id]||id}`;
  document.getElementById('btnDownload').disabled = false;
  document.getElementById('btnPreview').style.display = 'inline-flex';
  const meta = DOWNLOAD_META[id];
  if (meta) setDownloadButton(meta.label, meta.icon);

  const oa = document.getElementById('optionsArea');
  const ca = document.getElementById('canvasArea');

  if (id === 'img2pdf') renderImg2PdfOptions(oa, ca);
  else if (id === 'merge') renderMergeOptions(oa, ca);
  else if (id === 'reorder') renderReorderOptions(oa, ca);
  else if (id === 'rotate') renderRotateOptions(oa, ca);
  else if (id === 'crop') renderCropOptions(oa, ca);
  else if (id === 'split') renderSplitOptions(oa, ca);
  else if (id === 'compress') renderCompressOptions(oa, ca);
  else if (id === 'watermark') renderWatermarkOptions(oa, ca);
  else if (id === 'protect') renderProtectOptions(oa, ca);
  else if (id === 'extract') renderExtractOptions(oa, ca);
  else if (id === 'pdf2img') renderPdf2ImgOptions(oa, ca);
  else if (id === 'edittext') renderEditTextOptions(oa, ca);
  else {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">${TOOLS[currentMode]?.find(t=>t.id===id)?.icon||'📄'}</div><div class="empty-title">Upload a PDF to continue</div></div>`;
  }
}

// ── IMG2PDF ──
function renderImg2PdfOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Page Size</span>
      <div class="size-chips">
        <span class="opt-chip active" data-size="A4" onclick="setChip(this,'size')">A4</span>
        <span class="opt-chip" data-size="A3" onclick="setChip(this,'size')">A3</span>
        <span class="opt-chip" data-size="Letter" onclick="setChip(this,'size')">Letter</span>
        <span class="opt-chip" data-size="Original" onclick="setChip(this,'size')">Original</span>
        <span class="opt-chip" data-size="Fit" onclick="setChip(this,'size')">Fit Image</span>
      </div>
      <div class="opt-divider"></div>
      <span class="opt-label">Orientation</span>
      <span class="opt-chip active" data-orient="portrait" onclick="setChip(this,'orient')">Portrait</span>
      <span class="opt-chip" data-orient="landscape" onclick="setChip(this,'orient')">Landscape</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Margin</span>
      <select class="opt-select" id="optMargin">
        <option value="0">No margin</option>
        <option value="20" selected>Small (20px)</option>
        <option value="40">Medium (40px)</option>
        <option value="60">Large (60px)</option>
      </select>
      <div class="opt-divider"></div>
      <span class="opt-label">Quality</span>
      <input type="range" class="opt-range" min="0.5" max="1" step="0.05" value="0.92" id="optQuality">
      <span id="optQualityVal" style="font-family:'DM Mono',monospace;font-size:13px;color:var(--gold);">92%</span>
    </div>
  </div>`;

  document.getElementById('optQuality').oninput = function() {
    document.getElementById('optQualityVal').textContent = Math.round(this.value*100)+'%';
  };

  if (loadedImages.length === 0) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">🖼️</div><div class="empty-title">Add images from the sidebar</div><div class="empty-sub">Upload images, reorder them by dragging, set rotation per image, then download as PDF.</div></div>`;
  } else {
    renderImgBuilderGrid(ca);
  }
}

function renderImgBuilderGrid(ca) {
  let html = `<div class="img-builder-grid" id="imgBuilderGrid">`;
  loadedImages.forEach((img, i) => {
    const rot = img.rotation || 0;
    html += `<div class="img-card ${img.selected?'selected':''}" draggable="true" data-imgidx="${i}">
      <div class="img-order-badge">${i+1}</div>
      <div class="drag-handle">⠿</div>
      <div class="img-card-thumb"><img src="${img.url}" style="transform:rotate(${rot}deg);transition:transform .3s;" /></div>
      <div class="img-card-controls">
        <span class="img-card-name">${img.name}</span>
        <button class="img-card-rot" onclick="rotateImageMain(${i},-90)" title="Rotate left">↺</button>
        <button class="img-card-rot" onclick="rotateImageMain(${i},90)" title="Rotate right">↻</button>
        <button class="img-card-del" onclick="removeImageMain(${i})">✕</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  ca.innerHTML = html;
  bindImgDrag();
}

function rotateImage(i, deg) {
  loadedImages[i].rotation = ((loadedImages[i].rotation || 0) + deg + 360) % 360;
  renderSidebar();
  if (currentTool === 'img2pdf') renderImgBuilderGrid(document.getElementById('canvasArea'));
}

function rotateImageMain(i, deg) {
  loadedImages[i].rotation = ((loadedImages[i].rotation || 0) + deg + 360) % 360;
  renderImgBuilderGrid(document.getElementById('canvasArea'));
  renderSidebar();
}

function removeImage(i) { loadedImages.splice(i,1); renderSidebar(); if(currentTool==='img2pdf') renderMainForTool('img2pdf'); }
function removeImageMain(i) { loadedImages.splice(i,1); renderSidebar(); renderMainForTool('img2pdf'); }

// ── MERGE ──
function renderMergeOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Output Name</span>
      <input class="opt-input" id="mergeOutName" value="merged" style="width:140px;" placeholder="filename"/>
      <span style="font-family:'DM Mono',monospace;font-size:13px;color:var(--muted);">.pdf</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Page Range</span>
      <span class="opt-chip active" data-pages="all" onclick="setChip(this,'pages')">All Pages</span>
      <span class="opt-chip" data-pages="custom" onclick="setChip(this,'pages')">Custom Range</span>
      <input class="opt-input" id="mergeRangeInput" placeholder="e.g. 1-3,5" style="display:none;width:130px;" />
    </div>
  </div>`;

  if (loadedFiles.length === 0) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">🔗</div><div class="empty-title">Add PDFs to merge</div><div class="empty-sub">Upload multiple PDFs, drag to reorder, then download as one combined PDF.</div></div>`;
  } else {
    ca.innerHTML = `<div style="padding:24px;width:100%;max-width:520px;">
      <div style="font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Merge Order — Drag to rearrange</div>
      <div id="mergeList">
        ${loadedFiles.map((f,i)=>`
        <div class="file-item" draggable="true" data-idx="${i}" style="margin-bottom:8px;cursor:grab;">
          <div style="color:var(--gold);font-family:'DM Mono',monospace;font-size:14px;font-weight:700;min-width:20px;">${i+1}</div>
          <div class="file-thumb">📄</div>
          <div class="file-info"><div class="file-name">${f.name}</div><div class="file-meta">${formatSize(f.size)}</div></div>
          <button class="file-btn del" onclick="removeFile(${i})">✕</button>
        </div>`).join('')}
      </div>
      <div style="margin-top:12px;">
        <button class="btn btn-outline" onclick="document.getElementById('pdfInput').click()" style="font-size:14px;">+ Add More PDFs</button>
      </div>
    </div>`;
  }
}

// ── REORDER ──
function renderReorderOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Drag thumbnails to reorder</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Select</span>
      <button class="btn btn-outline" style="font-size:13px;padding:4px 10px;" onclick="selectAllPages()">All</button>
      <button class="btn btn-outline" style="font-size:13px;padding:4px 10px;" onclick="selectNoPages()">None</button>
      <div class="opt-divider"></div>
      <button class="btn btn-danger" style="font-size:13px;padding:4px 10px;" onclick="deleteSelectedPages()">Delete Selected</button>
      <button class="btn btn-outline" style="font-size:13px;padding:4px 10px;" id="restoreBtn" onclick="restoreDeletedPages()" style="display:none;">Restore Deleted (<span id="delCount">0</span>)</button>
      <div class="opt-divider"></div>
      <button class="btn btn-outline" style="font-size:13px;padding:4px 10px;" onclick="resetPageOrder()">Reset Order</button>
    </div>
  </div>`;

  if (loadedFiles.length === 0 || !pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">↕️</div><div class="empty-title">Upload a PDF to reorder pages</div></div>`;
  } else {
    renderPageGrid(ca, {draggable:true});
  }
}

function resetPageOrder() {
  pageOrder = Array.from({length: totalPages}, (_,i)=>i+1);
  deletedPages = new Set();
  renderPageGrid(document.getElementById('canvasArea'), {draggable: currentTool==='reorder'});
  toast('Page order reset.','success');
}

async function renderPageGrid(ca, opts={}) {
  if (!pdfDoc) return;
  if (!pageOrder.length) pageOrder = Array.from({length: pdfDoc.numPages}, (_,i)=>i+1);
  const visible = pageOrder.filter(p => !deletedPages.has(p));
  ca.innerHTML = `<div class="page-grid" id="pageGrid"></div>`;
  const grid = document.getElementById('pageGrid');
  for (let idx = 0; idx < visible.length; idx++) {
    const p = visible[idx];
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page-thumb';
    pageDiv.dataset.page = p;
    pageDiv.dataset.slot = idx;
    if (opts.draggable) {
      pageDiv.draggable = true;
      pageDiv.addEventListener('dragstart', e => { dragPageNum = p; pageDiv.classList.add('dragging'); });
      pageDiv.addEventListener('dragend', () => { pageDiv.classList.remove('dragging'); dragPageNum = null; });
      pageDiv.addEventListener('dragover', e => e.preventDefault());
      pageDiv.addEventListener('drop', e => {
        e.preventDefault();
        if (dragPageNum === null || dragPageNum === p) return;
        const from = pageOrder.indexOf(dragPageNum);
        const to = pageOrder.indexOf(p);
        pageOrder.splice(from, 1);
        pageOrder.splice(to, 0, dragPageNum);
        renderPageGrid(ca, opts);
      });
    }
    pageDiv.onclick = (e) => { if(!e.target.closest('.page-del') && !e.target.closest('.page-rotate-btn')) pageDiv.classList.toggle('selected'); };
    const rot = pageRotations[p] || 0;

    const page = await pdfDoc.getPage(p);
    const viewport = page.getViewport({ scale: 0.4, rotation: rot });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const num = document.createElement('span');
    num.className = 'page-num'; num.textContent = (idx+1) + (idx+1!==p ? ` (orig ${p})` : '');

    const del = document.createElement('button');
    del.className = 'page-del'; del.textContent = '✕'; del.title = 'Delete page';
    del.onclick = (e) => { e.stopPropagation(); deletePage(p); };

    const rotBtns = document.createElement('div');
    rotBtns.className = 'page-rotate-btns';
    rotBtns.innerHTML = `<button class="page-rotate-btn" onclick="rotatePage(event,${p},-90)">↺</button><button class="page-rotate-btn" onclick="rotatePage(event,${p},90)">↻</button>`;

    pageDiv.appendChild(canvas);
    pageDiv.appendChild(num);
    pageDiv.appendChild(del);
    pageDiv.appendChild(rotBtns);
    grid.appendChild(pageDiv);
  }
  updateDeletedBadge();
}

let dragPageNum = null;

function rotatePage(e, pageNum, deg) {
  e.stopPropagation();
  pageRotations[pageNum] = ((pageRotations[pageNum]||0) + deg + 360) % 360;
  renderPageGrid(document.getElementById('canvasArea'), {draggable: currentTool==='reorder'});
}

function deletePage(pageNum) {
  deletedPages.add(pageNum);
  renderPageGrid(document.getElementById('canvasArea'), {draggable: currentTool==='reorder'});
  toast('Page removed. Download to apply, or restore it below.', 'success');
}
function selectAllPages() { document.querySelectorAll('.page-thumb').forEach(p=>p.classList.add('selected')); }
function selectNoPages() { document.querySelectorAll('.page-thumb').forEach(p=>p.classList.remove('selected')); }
function deleteSelectedPages() {
  const sel = Array.from(document.querySelectorAll('.page-thumb.selected')).map(el=>parseInt(el.dataset.page));
  if (!sel.length) { toast('No pages selected.','error'); return; }
  sel.forEach(p=>deletedPages.add(p));
  renderPageGrid(document.getElementById('canvasArea'), {draggable: currentTool==='reorder'});
  toast(`${sel.length} page(s) removed. Download to apply.`,'success');
}
function restoreDeletedPages() {
  deletedPages.clear();
  renderPageGrid(document.getElementById('canvasArea'), {draggable: currentTool==='reorder'});
  toast('Deleted pages restored.','success');
}
function updateDeletedBadge() {
  const btn = document.getElementById('restoreBtn');
  const cnt = document.getElementById('delCount');
  if (!btn) return;
  if (deletedPages.size) { btn.style.display='inline-flex'; if(cnt) cnt.textContent = deletedPages.size; }
  else btn.style.display = 'none';
}

// ── ROTATE ──
function renderRotateOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Apply to</span>
      <span class="opt-chip active" data-rot-target="all" onclick="setChip(this,'rot-target')">All Pages</span>
      <span class="opt-chip" data-rot-target="odd" onclick="setChip(this,'rot-target')">Odd Pages</span>
      <span class="opt-chip" data-rot-target="even" onclick="setChip(this,'rot-target')">Even Pages</span>
      <span class="opt-chip" data-rot-target="selected" onclick="setChip(this,'rot-target')">Selected</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Rotation</span>
      <button class="btn btn-outline" style="font-size:14px;padding:5px 12px;" onclick="applyRotation(-90)">↺ 90° Left</button>
      <button class="btn btn-outline" style="font-size:14px;padding:5px 12px;" onclick="applyRotation(90)">↻ 90° Right</button>
      <button class="btn btn-outline" style="font-size:14px;padding:5px 12px;" onclick="applyRotation(180)">↕ 180°</button>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">🔄</div><div class="empty-title">Upload a PDF to rotate pages</div></div>`;
  } else renderPageGrid(ca);
}

// ── CROP ──
let cropBox = {top:0, bottom:0, left:0, right:0}; // percentages
let cropApplyTo = 'all';
function renderCropOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Apply to</span>
      <span class="opt-chip active" data-crop-target="all" onclick="setChip(this,'crop-target');cropApplyTo='all'">All Pages</span>
      <span class="opt-chip" data-crop-target="current" onclick="setChip(this,'crop-target');cropApplyTo='current'">Preview Page Only</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Top</span>
      <input type="range" class="opt-range" min="0" max="40" value="0" id="cropTop" oninput="updateCrop()" style="width:80px;">
      <span class="opt-label">Bottom</span>
      <input type="range" class="opt-range" min="0" max="40" value="0" id="cropBottom" oninput="updateCrop()" style="width:80px;">
      <span class="opt-label">Left</span>
      <input type="range" class="opt-range" min="0" max="40" value="0" id="cropLeft" oninput="updateCrop()" style="width:80px;">
      <span class="opt-label">Right</span>
      <input type="range" class="opt-range" min="0" max="40" value="0" id="cropRight" oninput="updateCrop()" style="width:80px;">
      <div class="opt-divider"></div>
      <button class="btn btn-outline" style="font-size:13px;padding:4px 10px;" onclick="resetCrop()">Reset</button>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">✂️</div><div class="empty-title">Upload a PDF to crop pages</div><div class="empty-sub">Drag the sliders to trim margins from each edge — preview updates live.</div></div>`;
  } else {
    renderCropPreview(ca);
  }
}

async function renderCropPreview(ca) {
  const p = pageOrder[0] || 1;
  const page = await pdfDoc.getPage(p);
  const rot = pageRotations[p] || 0;
  const vp = page.getViewport({scale:1.1, rotation: rot});
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
  ca.innerHTML = `<div style="position:relative;display:inline-block;margin:24px auto;box-shadow:0 4px 24px rgba(0,0,0,0.5);" id="cropWrap"></div>`;
  const wrap = document.getElementById('cropWrap');
  canvas.style.display = 'block';
  wrap.appendChild(canvas);
  const overlay = document.createElement('div');
  overlay.id = 'cropOverlayBox';
  overlay.style.cssText = 'position:absolute;inset:0;border:2px solid var(--gold);box-shadow:0 0 0 9999px rgba(0,0,0,0.55);pointer-events:none;';
  wrap.appendChild(overlay);
  updateCrop();
}

function updateCrop() {
  cropBox.top = parseInt(document.getElementById('cropTop')?.value||0);
  cropBox.bottom = parseInt(document.getElementById('cropBottom')?.value||0);
  cropBox.left = parseInt(document.getElementById('cropLeft')?.value||0);
  cropBox.right = parseInt(document.getElementById('cropRight')?.value||0);
  const box = document.getElementById('cropOverlayBox');
  if (box) box.style.inset = `${cropBox.top}% ${cropBox.right}% ${cropBox.bottom}% ${cropBox.left}%`;
}

function resetCrop() {
  ['cropTop','cropBottom','cropLeft','cropRight'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=0; });
  updateCrop();
}

async function downloadCrop() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const n = src.getPageCount();
  const targetPage = pageOrder[0] || 1;
  for (let i = 0; i < n; i++) {
    if (cropApplyTo === 'current' && (i+1) !== targetPage) continue;
    const page = src.getPage(i);
    const {width, height} = page.getSize();
    const newLeft = width * (cropBox.left/100);
    const newRight = width * (1 - cropBox.right/100);
    const newTop = height * (1 - cropBox.top/100);
    const newBottom = height * (cropBox.bottom/100);
    page.setCropBox(newLeft, newBottom, newRight-newLeft, newTop-newBottom);
  }
  const bytes = await src.save();
  savePdfBytes(bytes, 'westcrest-cropped.pdf');
  toast('Crop applied!', 'success');
}

function applyRotation(deg) {
  const target = document.querySelector('[data-rot-target].active');
  const t = target ? target.dataset.rotTarget : 'all';
  if (!pdfDoc) return;
  const n = pdfDoc.numPages;
  for(let i=1;i<=n;i++){
    if(t==='all'||(t==='odd'&&i%2!==0)||(t==='even'&&i%2===0)||(t==='selected'&&document.querySelector(`.page-thumb[data-page="${i}"].selected`))) {
      pageRotations[i] = ((pageRotations[i]||0)+deg+360)%360;
    }
  }
  renderPageGrid(document.getElementById('canvasArea'));
  toast(`Rotated ${t} pages by ${deg}°`,'success');
}

// ── SPLIT ──
function renderSplitOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Split Mode</span>
      <span class="opt-chip active" data-split="range" onclick="setChip(this,'split')">By Range</span>
      <span class="opt-chip" data-split="every" onclick="setChip(this,'split')">Every N Pages</span>
      <span class="opt-chip" data-split="single" onclick="setChip(this,'split')">Single Pages</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Pages</span>
      <input class="opt-input" id="splitInput" placeholder="e.g. 1-3, 4-6" style="width:160px;" />
      <div class="opt-divider"></div>
      <span class="opt-label">Output</span>
      <span class="opt-chip active" data-out="zip" onclick="setChip(this,'out')">ZIP</span>
      <span class="opt-chip" data-out="single" onclick="setChip(this,'out')">Single File</span>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">✂️</div><div class="empty-title">Upload a PDF to split</div><div class="empty-sub">Split by page range, every N pages, or extract each page individually.</div></div>`;
  } else renderPageGrid(ca);
}

// ── COMPRESS ──
function renderCompressOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Output Resolution</span>
      <span class="opt-chip active" data-cq="screen" onclick="setChip(this,'cq')">Screen (96 DPI)</span>
      <span class="opt-chip" data-cq="ebook" onclick="setChip(this,'cq')">eBook (150 DPI)</span>
      <span class="opt-chip" data-cq="printer" onclick="setChip(this,'cq')">Print (300 DPI)</span>
      <div class="opt-divider"></div>
      <span class="opt-label">JPEG Quality</span>
      <input type="range" class="opt-range" min="20" max="95" value="70" id="imgQuality">
      <span id="imgQualityVal" style="font-family:'DM Mono',monospace;font-size:13px;color:var(--gold);">70%</span>
    </div>
  </div>`;
  document.getElementById('imgQuality').oninput = function() {
    document.getElementById('imgQualityVal').textContent = this.value+'%';
  };
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">⚡</div><div class="empty-title">Upload a PDF to compress</div><div class="empty-sub">Every page is re-rendered at your chosen resolution and re-saved as a compressed JPEG — real recompression, not an estimate. Best for scanned or image-heavy PDFs; text-only PDFs may not shrink much further.</div></div>`;
  } else {
    ca.innerHTML = `<div style="padding:32px;width:100%;max-width:560px;">
      <div style="font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:18px;">Compress Preview</div>
      <div style="display:flex;align-items:center;gap:20px;background:var(--dark3);border:1px solid var(--gold-border);border-radius:var(--r);padding:28px;">
        <div style="flex:1;text-align:center;">
          <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Original</div>
          <div style="font-size:32px;font-weight:700;font-family:'Syne',sans-serif;">${formatSize(loadedFiles[0]?.size||0)}</div>
        </div>
        <div style="font-size:28px;color:var(--gold);">→</div>
        <div style="flex:1;text-align:center;">
          <div style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px;">Compressed</div>
          <div id="compressNewSize" style="font-size:32px;font-weight:700;font-family:'Syne',sans-serif;color:var(--muted);">—</div>
        </div>
      </div>
      <div id="compressResultBanner" style="display:none;margin-top:16px;padding:14px 18px;border-radius:var(--rs);text-align:center;font-size:16px;font-weight:600;"></div>
      <div style="margin-top:18px;font-size:14px;color:var(--muted);line-height:1.6;">Click <strong style="color:var(--gold);">Download Compressed PDF</strong> to render all ${pdfDoc.numPages} page(s) at the selected resolution and rebuild a compressed file — this re-encodes real pixel data, so results vary by document.</div>
      <div class="progress-bar" id="compressProgWrap" style="display:none;margin-top:14px;"><div class="progress-fill" id="compressProgFill" style="width:0%;"></div></div>
    </div>`;
  }
}

// ── WATERMARK ──
let wmColor = 'rgba(200,169,110,0.35)';
function renderWatermarkOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Text</span>
      <input class="opt-input" id="wmText" value="CONFIDENTIAL" style="width:160px;" oninput="updateWmPreview()"/>
      <div class="opt-divider"></div>
      <span class="opt-label">Color</span>
      <div class="color-row">
        <div class="color-swatch active" style="background:rgba(200,169,110,0.5);" onclick="setWmColor('rgba(200,169,110,0.35)',this)"></div>
        <div class="color-swatch" style="background:rgba(208,96,96,0.5);" onclick="setWmColor('rgba(208,96,96,0.35)',this)"></div>
        <div class="color-swatch" style="background:rgba(91,155,213,0.5);" onclick="setWmColor('rgba(91,155,213,0.35)',this)"></div>
        <div class="color-swatch" style="background:rgba(245,240,232,0.4);" onclick="setWmColor('rgba(245,240,232,0.3)',this)"></div>
        <div class="color-swatch" style="background:rgba(111,191,111,0.5);" onclick="setWmColor('rgba(111,191,111,0.35)',this)"></div>
      </div>
      <div class="opt-divider"></div>
      <span class="opt-label">Size</span>
      <select class="opt-select" id="wmSize" onchange="updateWmPreview()">
        <option value="20">Small</option><option value="32" selected>Medium</option><option value="48">Large</option><option value="64">XL</option>
      </select>
      <div class="opt-divider"></div>
      <span class="opt-label">Position</span>
      <span class="opt-chip active" data-wmp="center" onclick="setChip(this,'wmp')">Center</span>
      <span class="opt-chip" data-wmp="diagonal" onclick="setChip(this,'wmp')">Diagonal</span>
      <span class="opt-chip" data-wmp="tile" onclick="setChip(this,'wmp')">Tile</span>
    </div>
  </div>`;

  ca.innerHTML = `<div style="padding:24px;width:100%;max-width:480px;">
    <div style="font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Live Watermark Preview</div>
    <div class="wm-preview" id="wmPreview">
      <div style="color:#555;font-size:15px;">${pdfDoc?'PDF Loaded':'Upload a PDF first'}</div>
      <div class="wm-text" id="wmTextEl">CONFIDENTIAL</div>
    </div>
  </div>`;
}

function setWmColor(color, el) {
  wmColor = color;
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  const el2 = document.getElementById('wmTextEl');
  if(el2) el2.style.color = color;
}

function updateWmPreview() {
  const t = document.getElementById('wmText')?.value || 'WATERMARK';
  const s = document.getElementById('wmSize')?.value || '32';
  const el = document.getElementById('wmTextEl');
  if(el){ el.textContent = t; el.style.fontSize = s+'px'; el.style.color = wmColor; }
}

// ── ADD / EDIT TEXT ──
let editTextPage = 1;
let editTextScale = 1.3;
function renderEditTextOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Page</span>
      <input class="opt-input" id="etPageNum" type="number" min="1" value="1" style="width:60px;" onchange="changeEditTextPage(this.value)"/>
      <span class="opt-label" id="etPageTotal">of 1</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Font Size</span>
      <input class="opt-input" id="etFontSize" type="number" min="6" max="120" value="16" style="width:60px;"/>
      <span class="opt-label">Color</span>
      <div class="color-row">
        <div class="color-swatch active" style="background:#1a1a24;" onclick="setEtColor('#1a1a24',this)"></div>
        <div class="color-swatch" style="background:#d06060;" onclick="setEtColor('#d06060',this)"></div>
        <div class="color-swatch" style="background:#5b9bd5;" onclick="setEtColor('#5b9bd5',this)"></div>
        <div class="color-swatch" style="background:#6fbf6f;" onclick="setEtColor('#6fbf6f',this)"></div>
        <div class="color-swatch" style="background:#c8a96e;" onclick="setEtColor('#c8a96e',this)"></div>
      </div>
      <div class="opt-divider"></div>
      <button class="btn btn-primary" style="font-size:14px;padding:6px 14px;" onclick="addTextBoxAtCenter()">+ Add Text Box</button>
      <span style="font-size:13.5px;color:var(--muted);">or click anywhere on the page</span>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">✏️</div><div class="empty-title">Upload a PDF to add or edit text</div><div class="empty-sub">Click anywhere on a page to drop a text box. Drag to move, double-click to edit, type your own text, then download.</div></div>`;
  } else {
    document.getElementById('etPageTotal').textContent = 'of ' + pdfDoc.numPages;
    renderEditTextCanvas(ca);
  }
}

let etColor = '#1a1a24';
function setEtColor(c, el) {
  etColor = c;
  document.querySelectorAll('#optionsArea .color-swatch').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
}

function changeEditTextPage(val) {
  const n = Math.max(1, Math.min(pdfDoc.numPages, parseInt(val)||1));
  editTextPage = n;
  document.getElementById('etPageNum').value = n;
  renderEditTextCanvas(document.getElementById('canvasArea'));
}

async function renderEditTextCanvas(ca) {
  const page = await pdfDoc.getPage(editTextPage);
  const vp = page.getViewport({scale: editTextScale});
  ca.innerHTML = `<div style="position:relative;margin:24px auto;box-shadow:0 4px 24px rgba(0,0,0,0.5);" id="etWrap"></div>`;
  const wrap = document.getElementById('etWrap');
  wrap.style.width = vp.width+'px';
  wrap.style.height = vp.height+'px';
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  canvas.style.display = 'block';
  await page.render({canvasContext: canvas.getContext('2d'), viewport: vp}).promise;
  wrap.appendChild(canvas);
  wrap.onclick = (e) => {
    if (e.target !== canvas) return;
    const rect = wrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / editTextScale;
    const y = (vp.height - (e.clientY - rect.top)) / editTextScale; // PDF y is bottom-up
    addTextOverlay(x, y);
  };
  textOverlays.filter(t => t.page === editTextPage).forEach(renderTextOverlayEl);
}

function addTextBoxAtCenter() {
  const wrap = document.getElementById('etWrap');
  if (!wrap) return;
  const w = wrap.offsetWidth / editTextScale, h = wrap.offsetHeight / editTextScale;
  addTextOverlay(w/2 - 40, h/2);
}

function addTextOverlay(x, y) {
  const size = parseInt(document.getElementById('etFontSize')?.value || 16);
  const t = { id: 'et'+Date.now()+Math.random().toString(36).slice(2,6), page: editTextPage, x, y, text: 'Edit me', size, color: etColor };
  textOverlays.push(t);
  renderTextOverlayEl(t);
}

function renderTextOverlayEl(t) {
  const wrap = document.getElementById('etWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'et-box';
  el.dataset.id = t.id;
  el.contentEditable = true;
  el.textContent = t.text;
  el.style.cssText = `position:absolute;left:${t.x*editTextScale}px;top:${(wrap.offsetHeight/editTextScale - t.y)*editTextScale - t.size*editTextScale}px;font-size:${t.size*editTextScale}px;color:${t.color};font-family:Helvetica,Arial,sans-serif;border:1.5px dashed var(--gold);background:rgba(255,255,255,0.85);padding:1px 4px;cursor:move;min-width:20px;outline:none;line-height:1.1;white-space:pre;`;
  el.oninput = () => { t.text = el.textContent; };
  el.onmousedown = (e) => {
    if (document.activeElement === el) return; // allow editing, don't drag while focused
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origLeft = el.offsetLeft, origTop = el.offsetTop;
    function onMove(me) {
      el.style.left = (origLeft + (me.clientX-startX)) + 'px';
      el.style.top = (origTop + (me.clientY-startY)) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const wrapH = wrap.offsetHeight;
      t.x = el.offsetLeft / editTextScale;
      t.y = (wrapH - el.offsetTop - t.size*editTextScale) / editTextScale;
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const del = document.createElement('button');
  del.textContent = '✕';
  del.style.cssText = 'position:absolute;top:-9px;right:-9px;width:16px;height:16px;border-radius:50%;background:var(--red);color:#fff;border:none;font-size:12px;cursor:pointer;line-height:1;';
  del.onclick = (e) => { e.stopPropagation(); textOverlays = textOverlays.filter(x=>x.id!==t.id); el.remove(); };
  el.appendChild(del);
  wrap.appendChild(el);
}

async function downloadEditText() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  if (!textOverlays.length) { toast('Add at least one text box first!','error'); return; }
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const font = await src.embedFont(StandardFonts.Helvetica);
  for (const t of textOverlays) {
    const page = src.getPage(t.page - 1);
    if (!page) continue;
    const hex = t.color.replace('#','');
    const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
    (t.text || '').split('\n').forEach((line, li) => {
      page.drawText(line, { x: t.x, y: t.y - li*t.size*1.15, size: t.size, font, color: rgb(r,g,b) });
    });
  }
  const bytes = await src.save();
  savePdfBytes(bytes, 'westcrest-text-edited.pdf');
  toast('Text added — ' + textOverlays.length + ' box(es) saved into the PDF!', 'success');
}

// ── PROTECT ──
function renderProtectOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Action</span>
      <span class="opt-chip active" data-protect="remove" onclick="setChip(this,'protect');toggleProtectUI()">Unlock (Remove Password)</span>
      <span class="opt-chip" data-protect="add" onclick="setChip(this,'protect');toggleProtectUI()">Lock with Password</span>
      <div class="opt-divider"></div>
      <div id="protectInputs" style="display:none;align-items:center;gap:10px;">
        <span class="opt-label">Password</span>
        <input class="opt-input" id="pwInput" type="password" placeholder="Enter password" style="width:160px;"/>
        <span class="opt-label">Confirm</span>
        <input class="opt-input" id="pwConfirm" type="password" placeholder="Confirm password" style="width:160px;"/>
      </div>
      <div id="unlockInputs" style="display:flex;align-items:center;gap:10px;">
        <span class="opt-label">Current Password</span>
        <input class="opt-input" id="unlockPwInput" type="password" placeholder="Enter current password" style="width:200px;"/>
      </div>
    </div>
  </div>`;
  toggleProtectUI();
  ca.innerHTML = `<div class="empty"><div class="empty-icon">🔒</div><div class="empty-title">${pdfDoc?'PDF loaded':'Upload a PDF to protect or unlock'}</div><div class="empty-sub" style="max-width:420px;">
    <strong style="color:var(--gold);">Unlock</strong> removes a real PDF user-password and saves a fully decrypted copy — works for genuinely encrypted PDFs.<br><br>
    <strong style="color:var(--gold);">Lock</strong> wraps your PDF in a password-gated HTML viewer (the PDF itself stays unencrypted at the file-format level, but it can't be opened without the password through this wrapper). True PDF-spec AES encryption needs a server-side library and isn't possible fully client-side with the tools loaded here.
  </div></div>`;
}

function toggleProtectUI() {
  const mode = document.querySelector('[data-protect].active')?.dataset.protect;
  const addInputs = document.getElementById('protectInputs');
  const unlockInputs = document.getElementById('unlockInputs');
  if(addInputs) addInputs.style.display = mode==='add' ? 'flex' : 'none';
  if(unlockInputs) unlockInputs.style.display = mode==='remove' ? 'flex' : 'none';
  if (mode === 'add') setDownloadButton('Download Locked HTML', 'lock');
  else setDownloadButton('Download Unlocked PDF', 'unlock');
}

// ── EXTRACT ──
function renderExtractOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Pages to Extract</span>
      <input class="opt-input" id="extractPages" placeholder="e.g. 1,3,5-8" style="width:180px;"/>
      <div class="opt-divider"></div>
      <span class="opt-label">Output</span>
      <span class="opt-chip active" data-exout="one" onclick="setChip(this,'exout')">One PDF</span>
      <span class="opt-chip" data-exout="separate" onclick="setChip(this,'exout')">Separate Files</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Keep Original</span>
      <span class="opt-chip active" data-keeporig="yes" onclick="setChip(this,'keeporig')">Yes</span>
      <span class="opt-chip" data-keeporig="no" onclick="setChip(this,'keeporig')">No</span>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">📄</div><div class="empty-title">Upload a PDF to extract pages</div></div>`;
  } else renderPageGrid(ca);
}

// ── PDF2IMG ──
function renderPdf2ImgOptions(oa, ca) {
  oa.innerHTML = `<div class="options-panel">
    <div class="opt-row">
      <span class="opt-label">Format</span>
      <span class="opt-chip active" data-fmt2="png" onclick="setChip(this,'fmt2')">PNG</span>
      <span class="opt-chip" data-fmt2="jpg" onclick="setChip(this,'fmt2')">JPG</span>
      <div class="opt-divider"></div>
      <span class="opt-label">DPI</span>
      <span class="opt-chip active" data-dpi="150" onclick="setChip(this,'dpi')">150 DPI</span>
      <span class="opt-chip" data-dpi="300" onclick="setChip(this,'dpi')">300 DPI</span>
      <span class="opt-chip" data-dpi="600" onclick="setChip(this,'dpi')">600 DPI</span>
      <div class="opt-divider"></div>
      <span class="opt-label">Pages</span>
      <span class="opt-chip active" data-p2i="all" onclick="setChip(this,'p2i')">All</span>
      <span class="opt-chip" data-p2i="range" onclick="setChip(this,'p2i')">Range</span>
      <input class="opt-input" id="p2iRange" placeholder="1-3, 5" style="display:none;width:130px;"/>
      <div class="opt-divider"></div>
      <span class="opt-label">Download as</span>
      <span class="opt-chip active" data-p2iout="zip" onclick="setChip(this,'p2iout')">ZIP</span>
      <span class="opt-chip" data-p2iout="individual" onclick="setChip(this,'p2iout')">Individual</span>
    </div>
  </div>`;
  if (!pdfDoc) {
    ca.innerHTML = `<div class="empty"><div class="empty-icon">🎨</div><div class="empty-title">Upload a PDF to convert to images</div></div>`;
  } else renderPageGrid(ca);
}

// ── DOWNLOAD HANDLER ──
async function doDownload() {
  if (!currentTool) return;
  const btn = document.getElementById('btnDownload');
  const lbl = document.getElementById('btnDownloadLabel');
  const prevLabel = lbl ? lbl.textContent : 'Download PDF';
  btn.disabled = true;
  if (lbl) lbl.textContent = 'Processing…';

  try {
    if (currentTool === 'img2pdf') await downloadImg2Pdf();
    else if (currentTool === 'merge') await downloadMerge();
    else if (currentTool === 'reorder' || currentTool === 'rotate') await downloadReordered();
    else if (currentTool === 'crop') await downloadCrop();
    else if (currentTool === 'split') await downloadSplit();
    else if (currentTool === 'compress') await downloadCompress();
    else if (currentTool === 'watermark') await downloadWatermark();
    else if (currentTool === 'protect') await downloadProtect();
    else if (currentTool === 'extract') await downloadExtract();
    else if (currentTool === 'pdf2img') await downloadPdf2Img();
    else if (currentTool === 'edittext') await downloadEditText();
    else toast('Tool coming soon!', 'error');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
  btn.disabled = false;
  if (lbl) lbl.textContent = prevLabel;
}

async function downloadImg2Pdf() {
  if (!loadedImages.length) { toast('Add images first!','error'); return; }
  const newPdf = await PDFDocument.create();
  const sizeMap = { A4:[595.28,841.89], A3:[841.89,1190.55], Letter:[612,792] };
  const pageSize = document.querySelector('[data-size].active')?.dataset.size || 'A4';
  const orient = document.querySelector('[data-orient].active')?.dataset.orient || 'portrait';
  const margin = parseInt(document.getElementById('optMargin')?.value||20);
  const quality = parseFloat(document.getElementById('optQuality')?.value||0.92);

  for (const imgObj of loadedImages) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    await new Promise(r=>{ img.onload=r; img.src=imgObj.url; });
    const rot = (imgObj.rotation||0);
    const sw = rot===90||rot===270 ? img.height : img.width;
    const sh = rot===90||rot===270 ? img.width : img.height;
    canvas.width = sw; canvas.height = sh;
    ctx.save(); ctx.translate(sw/2,sh/2); ctx.rotate(rot*Math.PI/180);
    ctx.drawImage(img, -img.width/2, -img.height/2);
    ctx.restore();

    let pw, ph;
    if (pageSize === 'Original' || pageSize === 'Fit') { pw = sw; ph = sh; }
    else {
      [pw, ph] = sizeMap[pageSize] || sizeMap.A4;
      if (orient === 'landscape') [pw, ph] = [ph, pw];
    }
    const page = newPdf.addPage([pw, ph]);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    const ab = await blob.arrayBuffer();
    const embedded = await newPdf.embedJpg(new Uint8Array(ab));
    const availW = pw - margin*2, availH = ph - margin*2;
    const scale = Math.min(availW/sw, availH/sh);
    const fw = sw*scale, fh = sh*scale;
    page.drawImage(embedded, { x: margin+(availW-fw)/2, y: margin+(availH-fh)/2, width: fw, height: fh });
  }
  const bytes = await newPdf.save();
  savePdfBytes(bytes, 'westcrest-images.pdf');
  toast('PDF created with ' + loadedImages.length + ' images!', 'success');
}

async function downloadMerge() {
  if (loadedFiles.length < 2) { toast('Add at least 2 PDFs to merge!','error'); return; }
  const merged = await PDFDocument.create();
  for (const f of loadedFiles) {
    const ab = await f.arrayBuffer();
    const pdf = await PDFDocument.load(ab);
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const name = (document.getElementById('mergeOutName')?.value || 'merged') + '.pdf';
  const bytes = await merged.save();
  savePdfBytes(bytes, name);
  toast('Merged ' + loadedFiles.length + ' PDFs!', 'success');
}

async function downloadReordered() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const newDoc = await PDFDocument.create();
  const order = pageOrder.length ? pageOrder : Array.from({length: src.getPageCount()}, (_,i)=>i+1);
  const finalOrder = order.filter(p => !deletedPages.has(p));
  if (!finalOrder.length) { toast('All pages removed — nothing to save!','error'); return; }
  for (const pageNum of finalOrder) {
    const [page] = await newDoc.copyPages(src, [pageNum-1]);
    const rot = (pageRotations[pageNum]||0);
    if (rot) page.setRotation(degrees((page.getRotation().angle||0) + rot));
    newDoc.addPage(page);
  }
  const bytes = await newDoc.save();
  savePdfBytes(bytes, 'westcrest-edited.pdf');
  toast('PDF saved with edits!', 'success');
}

async function downloadSplit() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const mode = document.querySelector('[data-split].active')?.dataset.split || 'range';
  const input = document.getElementById('splitInput')?.value || '';

  if (mode === 'single') {
    const zip = new JSZip();
    for (let i = 0; i < src.getPageCount(); i++) {
      const doc = await PDFDocument.create();
      const [p] = await doc.copyPages(src,[i]);
      doc.addPage(p);
      const b = await doc.save();
      zip.file(`page-${i+1}.pdf`, b);
    }
    const blob = await zip.generateAsync({type:'blob'});
    const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='westcrest-split-pages.zip'; a.click();
    toast('Split into ' + src.getPageCount() + ' individual pages!','success');
    return;
  }

  const ranges = parseRanges(input, src.getPageCount());
  if (!ranges.length) { toast('Enter valid page ranges!','error'); return; }
  const zip = new JSZip();
  for (let ri = 0; ri < ranges.length; ri++) {
    const doc = await PDFDocument.create();
    const indices = ranges[ri].map(p=>p-1);
    const pages = await doc.copyPages(src, indices);
    pages.forEach(p=>doc.addPage(p));
    const b = await doc.save();
    zip.file(`split-part-${ri+1}.pdf`, b);
  }
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='westcrest-split.zip'; a.click();
  toast('Split into ' + ranges.length + ' parts!','success');
}

async function downloadCompress() {
  if (!loadedFiles.length || !pdfDoc) { toast('Upload a PDF first!','error'); return; }
  const dpiMap = {screen:96, ebook:150, printer:300};
  const cq = document.querySelector('[data-cq].active')?.dataset.cq || 'ebook';
  const dpi = dpiMap[cq] || 150;
  const quality = parseInt(document.getElementById('imgQuality')?.value || 70) / 100;
  const scale = dpi / 72;
  const originalSize = loadedFiles[0].size;

  const progWrap = document.getElementById('compressProgWrap');
  const progFill = document.getElementById('compressProgFill');
  if (progWrap) progWrap.style.display = 'block';

  const newPdf = await PDFDocument.create();
  const n = pdfDoc.numPages;
  for (let i = 1; i <= n; i++) {
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    const ab2 = await blob.arrayBuffer();
    const embedded = await newPdf.embedJpg(new Uint8Array(ab2));
    const pageW = vp.width * 72/dpi, pageH = vp.height * 72/dpi;
    const newPage = newPdf.addPage([pageW, pageH]);
    newPage.drawImage(embedded, { x:0, y:0, width: pageW, height: pageH });
    if (progFill) progFill.style.width = Math.round(i/n*100) + '%';
  }
  const bytes = await newPdf.save();
  savePdfBytes(bytes, 'westcrest-compressed.pdf');
  const newSize = bytes.length;
  const pct = originalSize ? Math.round((1 - newSize/originalSize) * 100) : 0;

  const newSizeEl = document.getElementById('compressNewSize');
  const banner = document.getElementById('compressResultBanner');
  if (newSizeEl) {
    newSizeEl.textContent = formatSize(newSize);
    newSizeEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';
  }
  if (banner) {
    banner.style.display = 'block';
    banner.style.background = pct >= 0 ? 'var(--green-dim)' : 'var(--red-dim)';
    banner.style.border = '1px solid ' + (pct >= 0 ? 'rgba(111,191,111,0.4)' : 'rgba(208,96,96,0.4)');
    banner.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';
    banner.textContent = pct >= 0 ? `${pct}% smaller — file saved!` : 'File came out larger — try a lower DPI/quality and download again.';
  }
  toast(`Compressed: ${formatSize(originalSize)} → ${formatSize(newSize)} (${pct>=0?pct+'% smaller':'larger — try a lower DPI/quality'})`, pct>=0?'success':'error');
}

async function downloadWatermark() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const font = await src.embedFont(StandardFonts.HelveticaBold);
  const txt = document.getElementById('wmText')?.value || 'WATERMARK';
  const sz = parseInt(document.getElementById('wmSize')?.value||32);
  const n = src.getPageCount();
  for (let i=0;i<n;i++){
    const page = src.getPage(i);
    const {width,height} = page.getSize();
    page.drawText(txt, {
      x: width/2 - (txt.length*sz*0.3), y: height/2,
      size: sz, font, color: rgb(0.78,0.66,0.43), opacity: 0.35, rotate: degrees(-30)
    });
  }
  const bytes = await src.save();
  savePdfBytes(bytes, 'westcrest-watermarked.pdf');
  toast('Watermark applied to ' + n + ' pages!','success');
}

async function downloadProtect() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const mode = document.querySelector('[data-protect].active')?.dataset.protect || 'remove';
  const ab = await loadedFiles[0].arrayBuffer();

  if (mode === 'remove') {
    const pw = document.getElementById('unlockPwInput')?.value || '';
    try {
      const src = await PDFDocument.load(ab, pw ? {password: pw} : {});
      const bytes = await src.save();
      savePdfBytes(bytes, 'westcrest-unlocked.pdf');
      toast('Password removed — PDF saved unlocked!','success');
    } catch(e) {
      if (String(e.message||e).toLowerCase().includes('password') || String(e.message||e).toLowerCase().includes('encrypt')) {
        toast('Wrong password, or this PDF needs a password to unlock.','error');
      } else {
        toast('This PDF is not password-protected — nothing to remove.','error');
      }
    }
    return;
  }

  // mode === 'add' — real PDF AES encryption isn't supported by the in-browser library here,
  // so we build a genuinely password-gated HTML wrapper instead of faking encryption.
  const pw = document.getElementById('pwInput')?.value;
  const pw2 = document.getElementById('pwConfirm')?.value;
  if (!pw) { toast('Enter a password!','error'); return; }
  if (pw !== pw2) { toast('Passwords do not match!','error'); return; }
  const base64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  const fname = loadedFiles[0].name.replace(/\.pdf$/i,'');
  const html = buildLockedViewerHtml(base64, fname, pw);
  const blob = new Blob([html], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'westcrest-locked-' + fname + '.html'; a.click();
  toast('Locked viewer saved as .html — open it and enter the password to view the PDF.','success');
}

function buildLockedViewerHtml(base64, fname, pw) {
  const pwEsc = JSON.stringify(pw);
  const nameEsc = JSON.stringify(fname + '.pdf');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Protected: ${fname}</title>
<style>body{font-family:sans-serif;background:#0e0e14;color:#f5f0e8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
.box{background:#1a1a24;border:1px solid rgba(200,169,110,0.3);border-radius:10px;padding:32px;width:320px;text-align:center;}
input{width:100%;padding:10px;margin:14px 0;border-radius:6px;border:1px solid rgba(200,169,110,0.3);background:#14141c;color:#fff;font-size:17px;box-sizing:border-box;}
button{width:100%;padding:10px;border-radius:6px;border:none;background:#c8a96e;color:#0e0e14;font-weight:700;cursor:pointer;font-size:17px;}
.err{color:#d06060;font-size:15px;min-height:16px;}
iframe{border:none;width:100%;height:100%;}
</style></head><body>
<div class="box" id="gate">
  <div style="font-size:18px;font-weight:700;margin-bottom:4px;">🔒 Protected Document</div>
  <div style="font-size:15px;opacity:.6;">${fname}.pdf</div>
  <input type="password" id="pw" placeholder="Enter password" autofocus>
  <div class="err" id="err"></div>
  <button onclick="tryOpen()">Unlock</button>
</div>
<script>
const REAL_PW = ${pwEsc};
const DATA = "${base64}";
document.getElementById('pw').addEventListener('keydown', e => { if(e.key==='Enter') tryOpen(); });
function tryOpen(){
  const val = document.getElementById('pw').value;
  if (val !== REAL_PW) { document.getElementById('err').textContent = 'Incorrect password.'; return; }
  document.body.innerHTML = '';
  document.body.style.display='block';
  const iframe = document.createElement('iframe');
  iframe.src = 'data:application/pdf;base64,' + DATA;
  document.body.appendChild(iframe);
}
<\/script>
</body></html>`;
}

async function downloadExtract() {
  if (!loadedFiles.length) { toast('Upload a PDF first!','error'); return; }
  const input = document.getElementById('extractPages')?.value || '';
  const ab = await loadedFiles[0].arrayBuffer();
  const src = await PDFDocument.load(ab);
  const selected = Array.from(document.querySelectorAll('.page-thumb.selected')).map(el=>parseInt(el.dataset.page));
  const pages = selected.length ? selected : parseRanges(input, src.getPageCount()).flat();
  if (!pages.length) { toast('Select pages or enter page numbers!','error'); return; }
  const doc = await PDFDocument.create();
  const copied = await doc.copyPages(src, pages.map(p=>p-1));
  copied.forEach(p=>doc.addPage(p));
  const bytes = await doc.save();
  savePdfBytes(bytes, 'westcrest-extracted.pdf');
  toast('Extracted ' + pages.length + ' pages!','success');
}

async function downloadPdf2Img() {
  if (!pdfDoc) { toast('Upload a PDF first!','error'); return; }
  const fmt = document.querySelector('[data-fmt2].active')?.dataset.fmt2 || 'png';
  const dpi = parseInt(document.querySelector('[data-dpi].active')?.dataset.dpi||150);
  const scale = dpi/72;
  const zip = new JSZip();
  const n = pdfDoc.numPages;
  for (let i=1;i<=n;i++){
    const page = await pdfDoc.getPage(i);
    const vp = page.getViewport({scale});
    const canvas = document.createElement('canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    const blob = await new Promise(r=>canvas.toBlob(r,'image/'+fmt,0.92));
    zip.file(`page-${String(i).padStart(3,'0')}.${fmt}`,blob);
  }
  const zipBlob = await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');a.href=URL.createObjectURL(zipBlob);a.download='westcrest-pdf-images.zip';a.click();
  toast('Exported ' + n + ' pages as ' + fmt.toUpperCase() + '!','success');
}

function doPreview() {
  if (!pdfDoc) { toast('Upload a PDF to preview','error'); return; }
  renderPreview();
}

async function renderPreview() {
  const ca = document.getElementById('canvasArea');
  ca.innerHTML = '<div style="padding:16px;font-family:\'DM Mono\',monospace;font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--gold);">Loading preview…</div>';
  const n = Math.min(pdfDoc.numPages, 6);
  let html = '';
  ca.innerHTML = '';
  for (let i=1;i<=n;i++){
    const page = await pdfDoc.getPage(i);
    const rot = pageRotations[i]||0;
    const vp = page.getViewport({scale:0.9,rotation:rot});
    const canvas = document.createElement('canvas');
    canvas.width=vp.width; canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    const wrapper = document.createElement('div');
    wrapper.className='preview-page';
    wrapper.appendChild(canvas);
    ca.appendChild(wrapper);
  }
  if (pdfDoc.numPages > 6) {
    const note = document.createElement('div');
    note.style.cssText='font-size:14px;color:var(--muted);padding:8px;font-family:\'DM Mono\',monospace;';
    note.textContent='Showing 6 of '+pdfDoc.numPages+' pages';
    ca.appendChild(note);
  }
}

// ── FILE HANDLING ──
function handleFiles(files) {
  for(const f of files) {
    if(f.type==='application/pdf') handlePDFFile(f);
    else if(f.type.startsWith('image/')) handleImageFile(f);
  }
}

function handlePDFFiles(files) {
  for(const f of files) handlePDFFile(f);
}

function handleImageFiles(files) {
  for(const f of files) handleImageFile(f);
}

async function handlePDFFile(f) {
  loadedFiles.push(f);
  let justUnlocked = false;
  if (loadedFiles.length === 1) {
    const ab = await f.arrayBuffer();
    pdfIsEncrypted = false;
    pdfPassword = null;
    try {
      pdfDoc = await pdfjsLib.getDocument({data:ab.slice(0)}).promise;
    } catch(err) {
      if (err && err.name === 'PasswordException') {
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt++) {
          const msg = attempt === 0
            ? `"${f.name}" is password-protected. Enter the password to open it:`
            : 'Incorrect password. Try again (or Cancel to stop):';
          const pw = window.prompt(msg);
          if (pw === null) break; // user cancelled
          try {
            pdfDoc = await pdfjsLib.getDocument({data: ab.slice(0), password: pw}).promise;
            pdfIsEncrypted = true;
            pdfPassword = pw;
            justUnlocked = true;
            opened = true;
          } catch(err2) {
            if (!(err2 && err2.name === 'PasswordException')) break;
          }
        }
        if (!opened) {
          loadedFiles.pop();
          toast('Could not open "' + f.name + '" — correct password is required.', 'error');
          updateStats(); renderSidebar();
          return;
        }
      } else {
        loadedFiles.pop();
        toast('Could not read "' + f.name + '": ' + (err && err.message ? err.message : 'invalid or corrupted PDF'), 'error');
        updateStats(); renderSidebar();
        return;
      }
    }
    totalPages = pdfDoc.numPages;
    pageOrder = Array.from({length: totalPages}, (_,i)=>i+1);
    deletedPages = new Set();
    textOverlays = [];
    editTextPage = 1;
  }
  updateStats();
  renderSidebar();
  if (currentTool) renderMainForTool(currentTool);
  toast((justUnlocked ? 'Password accepted — loaded: ' : 'Loaded: ') + f.name,'success');
}

function handleImageFile(f) {
  const url = URL.createObjectURL(f);
  loadedImages.push({name:f.name,size:f.size,type:f.type.split('/')[1].toUpperCase(),url,rotation:0,file:f});
  updateStats();
  renderSidebar();
  if (currentTool==='img2pdf') renderImgBuilderGrid(document.getElementById('canvasArea'));
}

function removeFile(i) {
  loadedFiles.splice(i,1);
  if(i===0){pdfDoc=null;totalPages=0;pageRotations={};pageOrder=[];deletedPages=new Set();textOverlays=[];}
  updateStats(); renderSidebar(); if(currentTool) renderMainForTool(currentTool);
}

function updateStats() {
  const sb = document.getElementById('statsBar');
  const totalSize = [...loadedFiles,...loadedImages.map(i=>({size:i.size}))].reduce((a,f)=>a+f.size,0);
  document.getElementById('statFiles').textContent = loadedFiles.length + loadedImages.length;
  document.getElementById('statPages').textContent = totalPages || loadedImages.length || '—';
  document.getElementById('statSize').textContent = totalSize ? formatSize(totalSize) : '—';
  document.getElementById('statMode').textContent = currentTool || '—';
}

// ── HELPERS ──
function formatSize(b) {
  if (!b) return '0B';
  if (b<1024) return b+'B';
  if (b<1048576) return (b/1024).toFixed(1)+'KB';
  return (b/1048576).toFixed(2)+'MB';
}

function parseRanges(str, max) {
  if (!str.trim()) return [Array.from({length:max},(_,i)=>i+1)];
  const parts = str.split(',').map(s=>s.trim());
  return parts.map(p => {
    if (p.includes('-')) {
      const [a,b] = p.split('-').map(Number);
      const arr=[];for(let i=a;i<=Math.min(b,max);i++)arr.push(i);return arr;
    }
    const n = parseInt(p);
    return (n>=1&&n<=max)?[n]:[];
  }).filter(r=>r.length);
}

function savePdfBytes(bytes, filename) {
  const blob = new Blob([bytes],{type:'application/pdf'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function setChip(el, group) {
  document.querySelectorAll(`[data-${group}]`).forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  if (group==='pages') {
    const ri = document.getElementById('mergeRangeInput');
    if(ri) ri.style.display = el.dataset.pages==='custom'?'block':'none';
  }
  if (group==='p2i') {
    const ri = document.getElementById('p2iRange');
    if(ri) ri.style.display = el.dataset.p2i==='range'?'block':'none';
  }
}

function toast(msg, type='success') {
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span>${type==='success'?'✓':'✕'}</span><span>${msg}</span>`;
  wrap.appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

// ── NAV DROPDOWN ──


// ── DRAG & DROP on upload zones ──
function bindDragDrop() {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-over');});
  zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
  zone.addEventListener('drop',e=>{
    e.preventDefault(); zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

// ── IMG DRAG REORDER ──
let dragImgIdx = null;
function bindImgDrag() {
  const cards = document.querySelectorAll('[data-imgidx]');
  cards.forEach(card => {
    card.addEventListener('dragstart',()=>{ dragImgIdx=parseInt(card.dataset.imgidx); card.style.opacity='.4'; });
    card.addEventListener('dragend',()=>{ card.style.opacity='1'; dragImgIdx=null; });
    card.addEventListener('dragover',e=>{ e.preventDefault(); });
    card.addEventListener('drop',e=>{
      e.preventDefault();
      const target=parseInt(card.dataset.imgidx);
      if(dragImgIdx===null||dragImgIdx===target)return;
      const moved=loadedImages.splice(dragImgIdx,1)[0];
      loadedImages.splice(target,0,moved);
      renderImgBuilderGrid(document.getElementById('canvasArea'));
      renderSidebar();
    });
  });
}

// ── INIT ──
renderSidebar();
