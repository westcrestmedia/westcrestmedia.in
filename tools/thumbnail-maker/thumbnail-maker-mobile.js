// =====================================================================
// thumbnail-maker-mobile.js — Canva-style Mobile UX v3
// Completely new contextual bottom bar approach
// Loads after thumbnail-maker.js
// =====================================================================

/* ── Quick colour palette (shared across all sheets) ── */
const MOB_PAL = [
  '#ffffff','#000000','#ff3300','#ff6b6b','#ffcc00','#ffd200',
  '#00ff88','#43e97b','#00c6ff','#0072ff','#c8a96e','#e8c98e',
  '#f953c6','#b91d73','#00ffff','#ff00ff','#7fff00','#ff8c00',
  '#870000','#4b0082','#1a1a2e','#ff6a00','#ee0979','#ff8c94',
];

const MOB_GRADS = [
  ['#0f2027','#2c5364'],['#c8a96e','#ff6b6b'],['#43e97b','#38f9d7'],
  ['#f7971e','#ffd200'],['#ee0979','#ff6a00'],['#1a1a2e','#16213e'],
  ['#000000','#434343'],['#870000','#190a05'],['#00c6ff','#0072ff'],
  ['#f953c6','#b91d73'],['#4e54c8','#8f94fb'],['#fc4a1a','#f7b733'],
];

const IMG_FILTER_KEYS = ['none','bw','sepia','vivid','cold','warm','invert','fade','cinema','dramatic','soft'];

// =====================================================================
// INIT & APP MODE DETECTION
// =====================================================================
function initAppMode() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.body.classList.add('app-mode');
    buildMobileUI();
    setTimeout(fitCanvasToMobile, 60);
  } else {
    const lp = document.getElementById('leftPanelEl');
    if (lp) lp.classList.add('drawer-open');
  }
}

window.addEventListener('resize', () => {
  const isMobile = window.innerWidth <= 768;
  document.body.classList.toggle('app-mode', isMobile);
  if (!isMobile) {
    closeMobSheet();
    const lp = document.getElementById('leftPanelEl');
    if (lp) lp.classList.add('drawer-open');
  } else {
    if (!document.getElementById('mobTabBar')) buildMobileUI();
  }
  setTimeout(fitCanvasToMobile, 60);
});

// =====================================================================
// BUILD THE ENTIRE MOBILE UI (called once)
// =====================================================================
function buildMobileUI() {
  if (document.getElementById('mobTabBar')) return; // already built

  // ── 1. Bottom Tab Bar ──
  const tabBar = document.createElement('div');
  tabBar.id = 'mobTabBar';
  tabBar.innerHTML = `
    <button class="mob-tab" id="mobTabTemplates" onclick="mobOpenSheet('templates')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
      <span>Templates</span>
    </button>
    <button class="mob-tab" id="mobTabLayers" onclick="mobOpenSheet('layers')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
      <span>Layers</span>
    </button>
    <button class="mob-tab" id="mobTabAdd" onclick="mobOpenSheet('add')">
      <span class="mob-tab-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <span>Add</span>
    </button>
    <button class="mob-tab" id="mobTabBg" onclick="mobOpenSheet('bg')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
      <span>Background</span>
    </button>
    <button class="mob-tab" id="mobTabExport" onclick="mobOpenSheet('export')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      <span>Export</span>
    </button>
  `;
  document.body.appendChild(tabBar);

  // ── 2. Contextual Action Bar ──
  const ctxBar = document.createElement('div');
  ctxBar.id = 'mobCtxBar';
  document.body.appendChild(ctxBar);

  // ── 3. Sheet Backdrop ──
  const backdrop = document.createElement('div');
  backdrop.className = 'mob-sheet-backdrop';
  backdrop.id = 'mobSheetBackdrop';
  backdrop.onclick = closeMobSheet;
  document.body.appendChild(backdrop);

  // ── 4. Main Sheet (reusable) ──
  const sheet = document.createElement('div');
  sheet.className = 'mob-sheet';
  sheet.id = 'mobSheet';
  sheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-title" id="mobSheetTitle"></div>
    <div class="mob-sheet-body" id="mobSheetBody"></div>
  `;
  document.body.appendChild(sheet);

  // ── 5. More Popup ──
  const morePopup = document.createElement('div');
  morePopup.id = 'mobMorePopup';
  morePopup.style.display = 'none';
  document.body.appendChild(morePopup);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#mobMorePopup') && !e.target.closest('.ctx-more-btn')) {
      hideMobMore();
    }
  });

  // ── 6. Font Modal (keep existing) ──
  buildMobileFontGrid();

  // ── First render ──
  updateMobCtxBar();
}

// =====================================================================
// CONTEXTUAL BAR — rebuilds every time selection changes
// =====================================================================
function updateMobCtxBar() {
  const bar = document.getElementById('mobCtxBar');
  if (!bar || window.innerWidth > 768) return;

  bar.innerHTML = '';

  // Always-present 3 buttons at the end of every state
  const permBtns = () => `
    ${ctxSep()}
    ${ctxBtn("openModal('templatesModal')", svgTemplates(), 'Templates')}
    ${ctxBtn("openMobileAddSheet()", svgPlus(), 'Add')}
    ${ctxBtn("switchTabByName('layers');toggleAppSheet('left')", svgLayers(), 'Layers')}
  `;

  if (selectedIndex < 0) {
    // ── Nothing selected — add & utility actions ──
    bar.innerHTML = `
      ${ctxBtn('addText(\'title\')', svgT(), 'Title')}
      ${ctxBtn('addText()', svgText(), 'Text')}
      ${ctxBtn('triggerUpload()', svgImg(), 'Image')}
      ${ctxBtn('mobOpenSheet(\'shapes\')', svgShape(), 'Shapes')}
      ${ctxBtn('openStickerPicker()', '😀', 'Stickers', true)}
      ${ctxBtn('mobOpenSheet(\'badges\')', '🏷️', 'Badges', true)}
      ${ctxSep()}
      ${ctxBtn('mobOpenSheet(\'bg\')', svgBg(), 'Background')}
      ${ctxBtn('undo()', svgUndo(), 'Undo')}
      ${ctxBtn('redo()', svgRedo(), 'Redo')}
      ${ctxBtn('mobileToggleDraw()', svgBrush(), 'Draw')}
      ${ctxSep()}
      ${ctxBtn('mobOpenSheet(\'export\')', svgExport(), 'Export', false, 'gold')}
      ${permBtns()}
    `;
  } else {
    const l = layers[selectedIndex];

    // Common arrange buttons (end of every bar)
    const commonEnd = `
      ${ctxSep()}
      ${ctxBtn('moveLayer(-1)', svgLayerUp(), 'Forward')}
      ${ctxBtn('moveLayer(1)', svgLayerDown(), 'Back')}
      ${ctxBtn('duplicateSelected()', svgDup(), 'Duplicate')}
      ${ctxSep()}
      ${ctxBtn('showMobMore()', svgMore(), 'More', false, 'ctx-more-btn')}
      ${ctxBtn('deleteSelected()', svgTrash(), 'Delete', false, 'danger')}
    `;

    if (l.type === 'text') {
      bar.innerHTML = `
        ${ctxBtn('mobOpenSheet(\'textEdit\')', svgEdit(), 'Edit')}
        ${ctxBtn('mobOpenSheet(\'font\')', svgFont(), 'Font')}
        ${ctxBtn('mobOpenSheet(\'textStyle\')', svgStyle(), 'Style')}
        ${ctxBtn('mobOpenSheet(\'fontSize\')', svgSize(), 'Size')}
        ${ctxBtn('mobOpenSheet(\'textColor\')', svgColor(), 'Color')}
        ${ctxBtn('mobOpenSheet(\'textOutline\')', svgOutline(), 'Outline')}
        ${ctxBtn('mobOpenSheet(\'textShadow\')', svgShadow(), 'Shadow')}
        ${ctxBtn('mobOpenSheet(\'textGlow\')', svgGlow(), 'Glow')}
        ${ctxBtn('mobOpenSheet(\'textBgBox\')', svgBox(), 'BG Box')}
        ${ctxBtn('mobOpenSheet(\'opacity\')', svgOpacity(), 'Opacity')}
        ${ctxBtn('mobOpenSheet(\'position\')', svgPos(), 'Position')}
        ${commonEnd}
      ${permBtns()}
    `;
    } else if (l.type === 'image') {
      bar.innerHTML = `
        ${ctxBtn('mobOpenSheet(\'imgFilters\')', svgFilter(), 'Filter')}
        ${ctxBtn('mobOpenSheet(\'imgAdjust\')', svgBright(), 'Adjust')}
        ${ctxBtn('mobOpenSheet(\'imgMask\')', svgMask(), 'Mask')}
        ${ctxBtn('flipH()', svgFlipH(), 'Flip H')}
        ${ctxBtn('flipV()', svgFlipV(), 'Flip V')}
        ${ctxBtn('mobOpenSheet(\'imgBorder\')', svgBorder(), 'Border')}
        ${ctxBtn('mobOpenSheet(\'effects\')', svgFx(), 'Effects')}
        ${ctxBtn('mobOpenSheet(\'opacity\')', svgOpacity(), 'Opacity')}
        ${ctxBtn('mobOpenSheet(\'blend\')', svgBlend(), 'Blend')}
        ${ctxBtn('mobOpenSheet(\'position\')', svgPos(), 'Position')}
        ${commonEnd}
      ${permBtns()}
    `;
    } else if (l.type === 'shape') {
      bar.innerHTML = `
        ${ctxBtn('mobOpenSheet(\'shapeColor\')', svgColor(), 'Color')}
        ${ctxBtn('mobOpenSheet(\'shapeBorder\')', svgBorder(), 'Border')}
        ${ctxBtn('mobOpenSheet(\'shapeRadius\')', svgRadius(), 'Radius')}
        ${ctxBtn('mobOpenSheet(\'shapeGrad\')', svgGrad(), 'Gradient')}
        ${ctxBtn('flipH()', svgFlipH(), 'Flip H')}
        ${ctxBtn('mobOpenSheet(\'effects\')', svgFx(), 'Effects')}
        ${ctxBtn('mobOpenSheet(\'opacity\')', svgOpacity(), 'Opacity')}
        ${ctxBtn('mobOpenSheet(\'position\')', svgPos(), 'Position')}
        ${commonEnd}
      ${permBtns()}
    `;
    } else if (l.type === 'sticker') {
      bar.innerHTML = `
        ${ctxBtn('mobOpenSheet(\'effects\')', svgFx(), 'Effects')}
        ${ctxBtn('flipH()', svgFlipH(), 'Flip H')}
        ${ctxBtn('flipV()', svgFlipV(), 'Flip V')}
        ${ctxBtn('mobOpenSheet(\'opacity\')', svgOpacity(), 'Opacity')}
        ${ctxBtn('mobOpenSheet(\'position\')', svgPos(), 'Position')}
        ${commonEnd}
      ${permBtns()}
    `;
    } else if (l.type === 'draw') {
      bar.innerHTML = `
        ${ctxBtn('mobileToggleDraw()', svgBrush(), 'Draw Mode', false, drawingMode ? 'active' : '')}
        ${ctxBtn('mobOpenSheet(\'brush\')', svgEdit(), 'Brush')}
        ${ctxBtn('clearBrushLayer()', svgTrash(), 'Clear', false, 'danger')}
        ${ctxBtn('mobOpenSheet(\'opacity\')', svgOpacity(), 'Opacity')}
        ${ctxBtn('mobOpenSheet(\'position\')', svgPos(), 'Position')}
        ${commonEnd}
      ${permBtns()}
    `;
    }
  }
}

// Helper: build a ctx button HTML string
function ctxBtn(onclick, icon, label, isEmoji = false, extraClass = '') {
  const iconHtml = isEmoji
    ? `<span class="ctx-emoji">${icon}</span>`
    : icon;
  return `<button class="ctx-btn ${extraClass}" onclick="${onclick}">${iconHtml}<span>${label}</span></button>`;
}
function ctxSep() { return '<div class="ctx-sep"></div>'; }
function svgTemplates() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`; }
function svgPlus()      { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`; }
function svgLayers()    { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`; }

// =====================================================================
// SHEET SYSTEM
// =====================================================================
let _currentSheet = null;

function mobOpenSheet(type) {
  _currentSheet = type;
  const title = document.getElementById('mobSheetTitle');
  const body = document.getElementById('mobSheetBody');
  const sheet = document.getElementById('mobSheet');
  const backdrop = document.getElementById('mobSheetBackdrop');

  // Update tab bar active state
  document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));
  const tabMap = { templates: 'mobTabTemplates', layers: 'mobTabLayers', add: 'mobTabAdd', bg: 'mobTabBg', export: 'mobTabExport' };
  if (tabMap[type]) document.getElementById(tabMap[type])?.classList.add('active');

  title.textContent = sheetTitle(type);
  body.innerHTML = buildSheetHTML(type);
  afterSheetBuild(type);

  sheet.classList.add('show');
  backdrop.classList.add('show');
  hideMobMore();
}

function closeMobSheet() {
  document.getElementById('mobSheet')?.classList.remove('show');
  document.getElementById('mobSheetBackdrop')?.classList.remove('show');
  document.querySelectorAll('.mob-tab').forEach(t => t.classList.remove('active'));
  _currentSheet = null;
}

function sheetTitle(type) {
  const titles = {
    add: 'Add to Canvas', templates: 'Templates', layers: 'Layers',
    bg: 'Background', export: 'Export',
    textEdit: 'Edit Text', font: 'Font', textStyle: 'Text Style',
    fontSize: 'Font Size', textColor: 'Text Color', textOutline: 'Outline',
    textShadow: 'Shadow', textGlow: 'Glow', textBgBox: 'Background Box',
    opacity: 'Opacity & Blend', position: 'Position & Size',
    effects: 'Effects & FX',
    imgFilters: 'Filters', imgAdjust: 'Adjustments', imgMask: 'Mask / Crop',
    imgBorder: 'Image Border', blend: 'Blend Mode',
    shapeColor: 'Shape Color', shapeBorder: 'Shape Border',
    shapeRadius: 'Corner Radius', shapeGrad: 'Shape Gradient',
    brush: 'Brush Settings', shapes: 'Shapes', badges: 'Badges',
  };
  return titles[type] || type;
}

// =====================================================================
// SHEET HTML BUILDERS
// =====================================================================
function buildSheetHTML(type) {
  const l = selectedIndex >= 0 ? layers[selectedIndex] : null;

  switch (type) {

    // ─── ADD ───────────────────────────────────────────────────────
    case 'add': return `
      <div class="mob-add-section">Text</div>
      <div class="mob-add-grid">
        ${addTile('Bebas Neue','BIG','addText(\'title\');closeMobSheet()')}
        ${addTile('Montserrat','Sub','addText(\'sub\');closeMobSheet()')}
        ${addTile(null,'T','addText();closeMobSheet()')}
        ${addTile('Orbitron','NEON','addText(\'neon\');closeMobSheet()')}
        ${addTile('Permanent Marker','Hand','addText(\'handwritten\');closeMobSheet()')}
        ${addTile('Impact','VIRAL','addText(\'viral\');closeMobSheet()')}
        ${addTile('Montserrat','[Box]','addText(\'boxed\');closeMobSheet()')}
        ${addTile(null,'Outline','addText(\'outline\');closeMobSheet()', true)}
      </div>
      <div class="mob-add-section">Media & Shapes</div>
      <div class="mob-add-grid">
        ${addEmojiTile('🖼️','Image','triggerUpload();closeMobSheet()')}
        ${addEmojiTile('▬','Rect','addRect();closeMobSheet()')}
        ${addEmojiTile('●','Circle','addCircle();closeMobSheet()')}
        ${addEmojiTile('★','Star','addStar();closeMobSheet()')}
        ${addEmojiTile('➤','Arrow','addArrow();closeMobSheet()')}
        ${addEmojiTile('◆','Diamond','addDiamond();closeMobSheet()')}
        ${addEmojiTile('💬','Speech','addSpeechBubble();closeMobSheet()')}
        ${addEmojiTile('⬟','Hex','addHexagon();closeMobSheet()')}
        ${addEmojiTile('❤️','Heart','addHeart();closeMobSheet()')}
        ${addEmojiTile('☁️','Cloud','addCloud();closeMobSheet()')}
      </div>
      <div class="mob-add-section">Quick Add</div>
      <div class="mob-add-grid">
        ${addEmojiTile('😀','Sticker','openStickerPicker();closeMobSheet()')}
        ${addEmojiTile('🏷️','Badge','mobOpenSheet(\'badges\')')}
        ${addEmojiTile('✏️','Draw','mobileToggleDraw();closeMobSheet()')}
        ${addEmojiTile('📐','More Shapes','mobOpenSheet(\'shapes\')')}
      </div>
      <button class="mob-add-export-btn" onclick="mobOpenSheet('export')">
        ${svgExport()} Export Thumbnail
      </button>
    `;

    // ─── SHAPES ────────────────────────────────────────────────────
    case 'shapes': return `
      <div class="sp-btn-grid">
        ${spBtn('addTriangle();closeMobSheet()','△ Triangle')}
        ${spBtn('addLine();closeMobSheet()','— Line')}
        ${spBtn('addPentagon();closeMobSheet()','⬠ Pentagon')}
        ${spBtn('addBurst();closeMobSheet()','✸ Burst')}
        ${spBtn('addChevron();closeMobSheet()','❯ Chevron')}
        ${spBtn('addParallelogram();closeMobSheet()','▱ Parallelogram')}
        ${spBtn('addRibbon();closeMobSheet()','🎀 Ribbon')}
        ${spBtn('addCross();closeMobSheet()','✚ Cross')}
        ${spBtn('addArrowDouble();closeMobSheet()','⟺ Double Arrow')}
        ${spBtn('addEllipse();closeMobSheet()','⬭ Ellipse')}
        ${spBtn('addRoundRect();closeMobSheet()','▢ Rounded Rect')}
      </div>
    `;

    // ─── BADGES ────────────────────────────────────────────────────
    case 'badges': return `
      <div class="sp-btn-grid">
        ${Object.keys(BADGE_DATA).map(k => `<button class="sp-action-btn" onclick="addBadge('${k}');closeMobSheet()">${BADGE_DATA[k].text}</button>`).join('')}
      </div>
    `;

    // ─── TEMPLATES ─────────────────────────────────────────────────
    case 'templates': return `
      <div class="template-grid" id="mobTemplateGrid" style="grid-template-columns:repeat(2,1fr);gap:8px;"></div>
    `;

    // ─── LAYERS ────────────────────────────────────────────────────
    case 'layers': return `
      <div id="mobLayerListInner"></div>
    `;

    // ─── BACKGROUND ────────────────────────────────────────────────
    case 'bg': return `
      <div class="sp-label">Gradients</div>
      <div class="sp-grad-grid">${MOB_GRADS.map((g,i)=>`<div class="sp-grad-swatch" style="background:linear-gradient(135deg,${g[0]},${g[1]})" onclick="mobApplyGrad(${i})"></div>`).join('')}</div>
      <div class="sp-label">Solid Color</div>
      <div class="sp-color-row">
        <label>Color</label>
        <input type="color" value="${bgSolidColor}" oninput="bgType='solid';bgSolidColor=this.value;bgImage=null;document.getElementById('bgColor').value=this.value;redraw()">
        <input type="text" value="${bgSolidColor}" placeholder="#000000" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){bgType='solid';bgSolidColor=this.value;bgImage=null;document.getElementById('bgColor').value=this.value;redraw()}">
      </div>
      <div class="sp-palette">${palHtml('mobBgPalClick')}</div>
      <div class="sp-label">Background Image</div>
      <div class="sp-btn-grid-2">
        <button class="sp-action-btn" onclick="document.getElementById('bgImgInput').click()">📷 Upload BG</button>
        <button class="sp-action-btn danger" onclick="bgImage=null;document.getElementById('bgImgOptions').style.display='none';redraw();showToast('BG removed')">✕ Remove</button>
      </div>
      <div id="mobBgImgOptions" style="${bgImage?'':'display:none'}">
        <div class="sp-label">Fit</div>
        <select class="sp-select" id="mobBgFit" onchange="document.getElementById('bgFit').value=this.value;redraw()">
          <option value="cover">Cover (fill)</option>
          <option value="contain">Contain (fit)</option>
          <option value="stretch">Stretch</option>
        </select>
        <div class="sp-label">Dimming <span id="mobBgDimV">0%</span></div>
        <div class="sp-slider"><label>Dim</label><input type="range" min="0" max="95" value="${document.getElementById('bgDim')?.value||0}" oninput="document.getElementById('bgDim').value=this.value;document.getElementById('mobBgDimV').textContent=this.value+'%';redraw()"><span class="sp-val">${document.getElementById('bgDim')?.value||0}%</span></div>
        <div class="sp-label">Blur <span id="mobBgBlurV">0px</span></div>
        <div class="sp-slider"><label>Blur</label><input type="range" min="0" max="30" value="${document.getElementById('bgBlur')?.value||0}" oninput="document.getElementById('bgBlur').value=this.value;document.getElementById('mobBgBlurV').textContent=this.value+'px';redraw()"><span class="sp-val">${document.getElementById('bgBlur')?.value||0}</span></div>
      </div>
      <div class="sp-label">Canvas Border</div>
      <div class="sp-color-row">
        <label>Color</label>
        <input type="color" value="${document.getElementById('canvasBorderColor')?.value||'#c8a96e'}" oninput="document.getElementById('canvasBorderColor').value=this.value;redraw()">
        <input type="number" class="sp-field input" min="0" max="60" placeholder="Width px" value="${document.getElementById('canvasBorderWidth')?.value||0}" oninput="document.getElementById('canvasBorderWidth').value=this.value;redraw()" style="flex:1;height:38px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:0 10px;">
      </div>
    `;

    // ─── EXPORT ────────────────────────────────────────────────────
    case 'export': return `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
        <button class="sp-action-btn" style="background:rgba(0,200,100,0.1);border-color:rgba(0,200,100,0.4);color:#4ade80;height:52px;font-size:13px;" onclick="exportPNG();closeMobSheet()">PNG</button>
        <button class="sp-action-btn" style="background:rgba(0,120,255,0.1);border-color:rgba(0,120,255,0.4);color:#60a5fa;height:52px;font-size:13px;" onclick="exportJPG();closeMobSheet()">JPG</button>
        <button class="sp-action-btn" style="height:52px;font-size:13px;" onclick="exportWebP();closeMobSheet()">WebP</button>
      </div>
      <div class="sp-label">JPG Quality</div>
      <div class="sp-slider"><label>Quality</label><input type="range" min="10" max="100" value="95" oninput="document.getElementById('jpgQuality').value=this.value;document.getElementById('jpgQuality2').value=this.value;this.nextElementSibling.textContent=this.value+'%'"><span class="sp-val">95%</span></div>
      <div class="sp-label">Export Scale</div>
      <select class="sp-select" onchange="document.getElementById('exportScale').value=this.value;document.getElementById('exportScale2').value=this.value">
        <option value="1">1x (Canvas Size)</option>
        <option value="2">2x (Retina Quality)</option>
        <option value="0.5">0.5x (Smaller File)</option>
      </select>
      <div class="sp-label">Project</div>
      <div class="sp-btn-grid-2">
        <button class="sp-action-btn" onclick="saveProject()">💾 Save Project</button>
        <button class="sp-action-btn" onclick="document.getElementById('loadProjectInput').click()">📂 Load Project</button>
      </div>
    `;

    // ─── TEXT EDIT ─────────────────────────────────────────────────
    case 'textEdit':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Text Content</div>
        <textarea id="mobTxtArea" rows="4" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:15px;padding:10px;resize:vertical;font-family:'Syne',sans-serif;line-height:1.5;" oninput="if(selectedIndex>=0){layers[selectedIndex].text=this.value;document.getElementById('txtContent').value=this.value;redraw()}">${l.text||''}</textarea>
        <div class="sp-label" style="margin-top:14px;">Align</div>
        <div class="sp-style-row">
          <button class="sp-style-btn${l.align==='left'?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='left';setTextAlign('left');mobRefreshSheet('textEdit')}">← Left</button>
          <button class="sp-style-btn${l.align==='center'||!l.align?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='center';setTextAlign('center');mobRefreshSheet('textEdit')}">Center</button>
          <button class="sp-style-btn${l.align==='right'?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='right';setTextAlign('right');mobRefreshSheet('textEdit')}">→ Right</button>
        </div>
        <div class="sp-label">Letter Spacing <span id="mobLsV">${l.letterSpacing||0}</span></div>
        <div class="sp-slider"><label>Spacing</label><input type="range" min="-5" max="40" value="${l.letterSpacing||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].letterSpacing=+this.value;document.getElementById('txtSpacing').value=this.value;document.getElementById('mobLsV').textContent=this.value;redraw()}"><span class="sp-val">${l.letterSpacing||0}</span></div>
        <div class="sp-label">Line Height <span id="mobLhV">${(l.lineH||1.2).toFixed(2)}</span></div>
        <div class="sp-slider"><label>Line H</label><input type="range" min="0.5" max="3" step="0.05" value="${l.lineH||1.2}" oninput="if(selectedIndex>=0){layers[selectedIndex].lineH=+this.value;document.getElementById('txtLineH').value=this.value;document.getElementById('mobLhV').textContent=(+this.value).toFixed(2);redraw()}"><span class="sp-val">${(l.lineH||1.2).toFixed(2)}</span></div>
        <div class="sp-label" style="margin-top:8px;">All Caps</div>
        <div class="sp-toggle-row">
          <label>ALL CAPS</label>
          <div class="sp-toggle${l.allcaps?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].allcaps=!layers[selectedIndex].allcaps;toggleTextStyle('allcaps');this.classList.toggle('on')}"></div>
        </div>
      `;

    // ─── FONT ──────────────────────────────────────────────────────
    case 'font':
      if (!l) return noLayer();
      const recentFonts = ['Bebas Neue','Anton','Impact','Montserrat','Oswald','Poppins','Orbitron','Permanent Marker','Pacifico','Lobster','Dancing Script','Bangers','Barlow Condensed','Russo One','Exo 2'];
      return `
        <div class="sp-label">Recent / Popular</div>
        <div class="sp-font-scroll">
          ${recentFonts.map(f=>`<button class="sp-font-pill${l.font===f?' on':''}" style="font-family:'${f}'" onclick="if(selectedIndex>=0){layers[selectedIndex].font='${f}';document.getElementById('txtFont').value='${f}';updateSelectedText();mobRefreshSheet('font')}">${f}</button>`).join('')}
        </div>
        <div class="sp-label">All Fonts</div>
        <input class="sp-select" style="height:38px;margin-bottom:8px;" type="text" placeholder="🔍 Search fonts..." oninput="filterMobFontSearch(this.value)">
        <div class="sp-font-scroll" id="mobFontSearchResults" style="flex-wrap:wrap;height:auto;max-height:200px;overflow-y:auto;">
          ${ALL_FONTS.map(f=>`<button class="sp-font-pill${l.font===f.name?' on':''}" style="font-family:'${f.name}'" onclick="if(selectedIndex>=0){layers[selectedIndex].font='${f.name}';document.getElementById('txtFont').value='${f.name}';updateSelectedText();mobRefreshSheet('font')}">${f.label}</button>`).join('')}
        </div>
      `;

    // ─── TEXT STYLE ────────────────────────────────────────────────
    case 'textStyle':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Style</div>
        <div class="sp-style-row">
          <button class="sp-style-btn${l.bold?' on':''}" onclick="toggleTextStyle('bold');mobRefreshSheet('textStyle')"><b>B</b></button>
          <button class="sp-style-btn${l.italic?' on':''}" onclick="toggleTextStyle('italic');mobRefreshSheet('textStyle')"><i>I</i></button>
          <button class="sp-style-btn${l.underline?' on':''}" onclick="toggleTextStyle('underline');mobRefreshSheet('textStyle')"><u>U</u></button>
          <button class="sp-style-btn${l.strikethrough?' on':''}" onclick="toggleTextStyle('strike');mobRefreshSheet('textStyle')"><s>S</s></button>
          <button class="sp-style-btn${l.allcaps?' on':''}" onclick="toggleTextStyle('allcaps');mobRefreshSheet('textStyle')">AA</button>
        </div>
        <div class="sp-label">Weight</div>
        <select class="sp-select" onchange="if(selectedIndex>=0){layers[selectedIndex].fontWeight=this.value;document.getElementById('txtWeight').value=this.value;updateSelectedText()}">
          <option value="300"${(l.fontWeight||'700')==='300'?' selected':''}>Light 300</option>
          <option value="400"${(l.fontWeight||'700')==='400'?' selected':''}>Regular 400</option>
          <option value="700"${(l.fontWeight||'700')==='700'?' selected':''}>Bold 700</option>
          <option value="900"${(l.fontWeight||'700')==='900'?' selected':''}>Black 900</option>
        </select>
        <div class="sp-label">Quick Presets</div>
        <div class="sp-btn-grid">
          ${['title','sub','label','neon','comic','outline','viral','handwritten','boxed','number'].map(p=>`<button class="sp-action-btn" onclick="addText('${p}');closeMobSheet()" style="font-size:9px">${p}</button>`).join('')}
        </div>
      `;

    // ─── FONT SIZE ─────────────────────────────────────────────────
    case 'fontSize':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Font Size <span id="mobFsDisplay">${l.size||72}px</span></div>
        <div class="sp-stepper">
          <button class="sp-step-btn" onclick="mobFontStep(-2)">−</button>
          <div class="sp-step-val" id="mobFsVal">${l.size||72}</div>
          <button class="sp-step-btn" onclick="mobFontStep(2)">+</button>
        </div>
        <div class="sp-slider"><label>Size</label><input type="range" min="8" max="400" value="${l.size||72}" oninput="if(selectedIndex>=0){layers[selectedIndex].size=+this.value;document.getElementById('txtSize').value=this.value;document.getElementById('mobFsVal').textContent=this.value;document.getElementById('mobFsDisplay').textContent=this.value+'px';redraw()}"><span class="sp-val">${l.size||72}</span></div>
        <div class="sp-label">Quick Sizes</div>
        <div class="sp-pill-row">
          ${[24,32,48,64,72,88,96,120,140].map(s=>`<button class="sp-pill${(l.size||72)===s?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].size=${s};document.getElementById('txtSize').value=${s};document.getElementById('mobFsVal').textContent=${s};redraw();mobRefreshSheet('fontSize')}">${s}</button>`).join('')}
        </div>
      `;

    // ─── TEXT COLOR ────────────────────────────────────────────────
    case 'textColor':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Fill Type</div>
        <select class="sp-select" id="mobTxtFillType" onchange="if(selectedIndex>=0){layers[selectedIndex].txtFillType=this.value;document.getElementById('txtFillType').value=this.value;updateSelectedText();mobRefreshSheet('textColor')}">
          <option value="solid"${(l.txtFillType||'solid')==='solid'?' selected':''}>Solid Color</option>
          <option value="gradient"${l.txtFillType==='gradient'?' selected':''}>Gradient</option>
          <option value="transparent"${l.txtFillType==='transparent'?' selected':''}>Transparent (Outline Only)</option>
        </select>
        ${l.txtFillType!=='transparent' ? `
          <div class="sp-label">Color</div>
          <div class="sp-color-row">
            <label>Fill</label>
            <input type="color" value="${l.color||'#ffffff'}" oninput="if(selectedIndex>=0){layers[selectedIndex].color=this.value;document.getElementById('txtColor').value=this.value;redraw()}">
            <input type="text" value="${l.color||'#ffffff'}" placeholder="#ffffff" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)&&selectedIndex>=0){layers[selectedIndex].color=this.value;document.getElementById('txtColor').value=this.value;redraw()}">
          </div>
          <div class="sp-palette">${palHtml('mobSetTextColor')}</div>
        ` : ''}
        ${l.txtFillType==='gradient' ? `
          <div class="sp-label">Gradient Colors</div>
          <div class="sp-color-row">
            <label>Color 1</label>
            <input type="color" value="${l.grad1||'#ff6b6b'}" oninput="if(selectedIndex>=0){layers[selectedIndex].grad1=this.value;document.getElementById('txtGrad1').value=this.value;updateSelectedText()}">
            <input type="color" value="${l.grad2||'#c8a96e'}" oninput="if(selectedIndex>=0){layers[selectedIndex].grad2=this.value;document.getElementById('txtGrad2').value=this.value;updateSelectedText()}">
          </div>
          <select class="sp-select" onchange="if(selectedIndex>=0){layers[selectedIndex].txtGradDir=this.value;document.getElementById('txtGradDir').value=this.value;updateSelectedText()}">
            <option value="to right"${(l.txtGradDir||'to right')==='to right'?' selected':''}>→ Horizontal</option>
            <option value="to bottom"${l.txtGradDir==='to bottom'?' selected':''}>↓ Vertical</option>
            <option value="to bottom right"${l.txtGradDir==='to bottom right'?' selected':''}>↘ Diagonal</option>
          </select>
        ` : ''}
      `;

    // ─── TEXT OUTLINE ──────────────────────────────────────────────
    case 'textOutline':
      if (!l) return noLayer();
      return `
        <div class="sp-toggle-row">
          <label>Enable Outline</label>
          <div class="sp-toggle${l.strokeEnabled?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].strokeEnabled=!layers[selectedIndex].strokeEnabled;document.getElementById('txtStrokeEnabled').checked=layers[selectedIndex].strokeEnabled;updateSelectedText();this.classList.toggle('on')}"></div>
        </div>
        <div class="sp-label">Outline Width <span id="mobOwV">${l.outlineWidth||0}</span></div>
        <div class="sp-slider"><label>Width</label><input type="range" min="0" max="30" value="${l.outlineWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].outlineWidth=+this.value;layers[selectedIndex].strokeEnabled=this.value>0;document.getElementById('txtOutlineWidth').value=this.value;document.getElementById('mobOwV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.outlineWidth||0}</span></div>
        <div class="sp-label">Outline Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.outlineColor||'#000000'}" oninput="if(selectedIndex>=0){layers[selectedIndex].outlineColor=this.value;document.getElementById('txtOutlineColor').value=this.value;updateSelectedText()}">
          <input type="text" value="${l.outlineColor||'#000000'}" placeholder="#000000" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)&&selectedIndex>=0){layers[selectedIndex].outlineColor=this.value;document.getElementById('txtOutlineColor').value=this.value;updateSelectedText()}">
        </div>
        <div class="sp-palette">${palHtml('mobSetOutlineColor')}</div>
      `;

    // ─── TEXT SHADOW ───────────────────────────────────────────────
    case 'textShadow':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Shadow Blur <span id="mobSbV">${l.shadow||0}</span></div>
        <div class="sp-slider"><label>Blur</label><input type="range" min="0" max="30" value="${l.shadow||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadow=+this.value;document.getElementById('txtShadow').value=this.value;document.getElementById('mobSbV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.shadow||0}</span></div>
        <div class="sp-label">Offset X <span id="mobSxV">${l.shadowX||0}</span></div>
        <div class="sp-slider"><label>X</label><input type="range" min="-40" max="40" value="${l.shadowX||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadowX=+this.value;document.getElementById('txtShadowX').value=this.value;document.getElementById('mobSxV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.shadowX||0}</span></div>
        <div class="sp-label">Offset Y <span id="mobSyV">${l.shadowY||0}</span></div>
        <div class="sp-slider"><label>Y</label><input type="range" min="-40" max="40" value="${l.shadowY||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadowY=+this.value;document.getElementById('txtShadowY').value=this.value;document.getElementById('mobSyV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.shadowY||0}</span></div>
        <div class="sp-label">Shadow Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.shadowColor||'#000000'}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadowColor=this.value;document.getElementById('txtShadowColor').value=this.value;updateSelectedText()}">
        </div>
      `;

    // ─── TEXT GLOW ─────────────────────────────────────────────────
    case 'textGlow':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Glow Size <span id="mobGsV">${l.glowSize||0}</span></div>
        <div class="sp-slider"><label>Size</label><input type="range" min="0" max="80" value="${l.glowSize||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].glowSize=+this.value;document.getElementById('txtGlowSize').value=this.value;document.getElementById('mobGsV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.glowSize||0}</span></div>
        <div class="sp-label">Glow Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.glowColor||'#ffffff'}" oninput="if(selectedIndex>=0){layers[selectedIndex].glowColor=this.value;document.getElementById('txtGlowColor').value=this.value;updateSelectedText()}">
        </div>
        <div class="sp-palette">${palHtml('mobSetGlowColor')}</div>
        <div class="sp-label">Quick Glow</div>
        <div class="sp-pill-row">
          ${['#ffffff','#00ffff','#c8a96e','#ff00ff','#00ff88','#ff3300'].map(c=>`<button class="sp-pill" style="background:${c}22;border-color:${c}55;color:${c}" onclick="if(selectedIndex>=0){layers[selectedIndex].glowColor='${c}';layers[selectedIndex].glowSize=Math.max(layers[selectedIndex].glowSize||0,20);updateSelectedText();mobRefreshSheet('textGlow')}">●</button>`).join('')}
        </div>
      `;

    // ─── TEXT BG BOX ───────────────────────────────────────────────
    case 'textBgBox':
      if (!l) return noLayer();
      return `
        <div class="sp-toggle-row">
          <label>Enable BG Box</label>
          <div class="sp-toggle${l.bgBox?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].bgBox=!layers[selectedIndex].bgBox;document.getElementById('txtBgBox').checked=layers[selectedIndex].bgBox;updateSelectedText();this.classList.toggle('on')}"></div>
        </div>
        <div class="sp-label">Box Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.bgBoxColor||'#ffff00'}" oninput="if(selectedIndex>=0){layers[selectedIndex].bgBoxColor=this.value;document.getElementById('txtBgBoxColor').value=this.value;updateSelectedText()}">
        </div>
        <div class="sp-palette">${palHtml('mobSetBgBoxColor')}</div>
        <div class="sp-label">Padding <span id="mobBbpV">${l.bgBoxPad||10}</span></div>
        <div class="sp-slider"><label>Pad</label><input type="range" min="0" max="60" value="${l.bgBoxPad||10}" oninput="if(selectedIndex>=0){layers[selectedIndex].bgBoxPad=+this.value;document.getElementById('txtBgBoxPad').value=this.value;document.getElementById('mobBbpV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.bgBoxPad||10}</span></div>
        <div class="sp-label">Radius <span id="mobBbrV">${l.bgBoxRadius||0}</span></div>
        <div class="sp-slider"><label>Radius</label><input type="range" min="0" max="60" value="${l.bgBoxRadius||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].bgBoxRadius=+this.value;document.getElementById('txtBgBoxRadius').value=this.value;document.getElementById('mobBbrV').textContent=this.value;updateSelectedText()}"><span class="sp-val">${l.bgBoxRadius||0}</span></div>
      `;

    // ─── IMAGE FILTERS ─────────────────────────────────────────────
    case 'imgFilters':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Filter Presets</div>
        <div class="sp-pill-row" style="flex-wrap:wrap;">
          ${IMG_FILTER_KEYS.map(k=>`<button class="sp-pill${(l.filterPreset||'none')===k?' on':''}" onclick="applyImgFilter('${k}');document.querySelectorAll('#mobSheet .sp-pill').forEach(p=>p.classList.remove('on'));this.classList.add('on')">${k}</button>`).join('')}
        </div>
      `;

    // ─── IMAGE ADJUST ──────────────────────────────────────────────
    case 'imgAdjust':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Brightness <span id="mobBriV">${l.brightness||100}</span></div>
        <div class="sp-slider"><label>Bright</label><input type="range" min="0" max="300" value="${l.brightness||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].brightness=+this.value;document.getElementById('mobBriV').textContent=this.value;redraw()}"><span class="sp-val">${l.brightness||100}</span></div>
        <div class="sp-label">Contrast <span id="mobConV">${l.contrast||100}</span></div>
        <div class="sp-slider"><label>Contrast</label><input type="range" min="0" max="300" value="${l.contrast||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].contrast=+this.value;document.getElementById('mobConV').textContent=this.value;redraw()}"><span class="sp-val">${l.contrast||100}</span></div>
        <div class="sp-label">Saturation <span id="mobSatV">${l.saturation||100}</span></div>
        <div class="sp-slider"><label>Sat</label><input type="range" min="0" max="300" value="${l.saturation||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].saturation=+this.value;document.getElementById('mobSatV').textContent=this.value;redraw()}"><span class="sp-val">${l.saturation||100}</span></div>
        <div class="sp-label">Blur <span id="mobImgBlurV">${l.blurFilter||0}</span></div>
        <div class="sp-slider"><label>Blur</label><input type="range" min="0" max="40" value="${l.blurFilter||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].blurFilter=+this.value;document.getElementById('mobImgBlurV').textContent=this.value;redraw()}"><span class="sp-val">${l.blurFilter||0}</span></div>
        <div class="sp-label">Hue Rotate <span id="mobHueV">${l.hueRotate||0}°</span></div>
        <div class="sp-slider"><label>Hue</label><input type="range" min="0" max="360" value="${l.hueRotate||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].hueRotate=+this.value;document.getElementById('mobHueV').textContent=this.value+'°';redraw()}"><span class="sp-val">${l.hueRotate||0}</span></div>
      `;

    // ─── IMAGE MASK ────────────────────────────────────────────────
    case 'imgMask':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Mask Shape</div>
        <div class="sp-btn-grid">
          ${['none','circle','rounded','ellipse','fade-l','fade-r','fade-t','fade-b','fade-all'].map(m=>`<button class="sp-action-btn${(l.mask||'none')===m?' active':''}${m.includes('fade')?'':''}" onclick="setMask('${m}');document.querySelectorAll('#mobSheet .sp-action-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${m==='none'?'None':m==='circle'?'Circle':m==='rounded'?'Rounded':m==='ellipse'?'Ellipse':m==='fade-l'?'Fade ←':m==='fade-r'?'Fade →':m==='fade-t'?'Fade ↑':m==='fade-b'?'Fade ↓':'Vignette'}</button>`).join('')}
        </div>
        <div class="sp-label">Fade Size <span id="mobMfV">${document.getElementById('maskFadeSize')?.value||30}%</span></div>
        <div class="sp-slider"><label>Fade</label><input type="range" min="5" max="80" value="${document.getElementById('maskFadeSize')?.value||30}" oninput="document.getElementById('maskFadeSize').value=this.value;document.getElementById('mobMfV').textContent=this.value+'%';updateFx()"><span class="sp-val">${document.getElementById('maskFadeSize')?.value||30}%</span></div>
      `;

    // ─── IMAGE BORDER ──────────────────────────────────────────────
    case 'imgBorder':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Border Width <span id="mobIbwV">${l.imgBorderWidth||0}</span></div>
        <div class="sp-slider"><label>Width</label><input type="range" min="0" max="40" value="${l.imgBorderWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].imgBorderWidth=+this.value;document.getElementById('mobIbwV').textContent=this.value;redraw()}"><span class="sp-val">${l.imgBorderWidth||0}</span></div>
        <div class="sp-label">Border Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.imgBorderColor||'#ffffff'}" oninput="if(selectedIndex>=0){layers[selectedIndex].imgBorderColor=this.value;redraw()}">
        </div>
        <div class="sp-palette">${palHtml('mobSetImgBorderColor')}</div>
      `;

    // ─── BLEND MODE ────────────────────────────────────────────────
    case 'blend':
      if (!l) return noLayer();
      const blends = ['source-over','multiply','screen','overlay','hard-light','soft-light','difference','exclusion','color-dodge','luminosity'];
      return `
        <div class="sp-label">Blend Mode</div>
        <div class="sp-pill-row" style="flex-wrap:wrap;">
          ${blends.map(b=>`<button class="sp-pill${(l.blendMode||'source-over')===b?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].blendMode='${b}';document.getElementById('fxBlend').value='${b}';updateFx();document.querySelectorAll('#mobSheet .sp-pill').forEach(p=>p.classList.remove('on'));this.classList.add('on')}">${b==='source-over'?'Normal':b}</button>`).join('')}
        </div>
      `;

    // ─── SHAPE COLOR ───────────────────────────────────────────────
    case 'shapeColor':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Fill Type</div>
        <select class="sp-select" onchange="if(selectedIndex>=0){layers[selectedIndex].fillType=this.value;document.getElementById('shapeFillType').value=this.value;redraw();mobRefreshSheet('shapeColor')}">
          <option value="solid"${(l.fillType||'solid')==='solid'?' selected':''}>Solid Color</option>
          <option value="gradient"${l.fillType==='gradient'?' selected':''}>Gradient</option>
          <option value="none"${l.fillType==='none'?' selected':''}>No Fill (Border Only)</option>
        </select>
        ${(l.fillType||'solid')!=='none' ? `
          <div class="sp-label">Fill Color</div>
          <div class="sp-color-row">
            <label>Color</label>
            <input type="color" value="${l.fill||'#c8a96e'}" oninput="if(selectedIndex>=0){layers[selectedIndex].fill=this.value;document.getElementById('shapeFill').value=this.value;redraw()}">
            <input type="text" value="${l.fill||'#c8a96e'}" placeholder="#c8a96e" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)&&selectedIndex>=0){layers[selectedIndex].fill=this.value;document.getElementById('shapeFill').value=this.value;redraw()}">
          </div>
          <div class="sp-palette">${palHtml('mobSetShapeColor')}</div>
        ` : ''}
        ${l.fillType==='gradient' ? `
          <div class="sp-label">Gradient</div>
          <div class="sp-color-row">
            <label>C1 → C2</label>
            <input type="color" value="${l.gradC1||'#c8a96e'}" oninput="if(selectedIndex>=0){layers[selectedIndex].gradC1=this.value;redraw()}">
            <input type="color" value="${l.gradC2||'#ff6b6b'}" oninput="if(selectedIndex>=0){layers[selectedIndex].gradC2=this.value;redraw()}">
          </div>
          <select class="sp-select" onchange="if(selectedIndex>=0){layers[selectedIndex].gradDir=this.value;redraw()}">
            <option value="to right">→ Horizontal</option>
            <option value="to bottom">↓ Vertical</option>
            <option value="to bottom right">↘ Diagonal</option>
            <option value="radial">◉ Radial</option>
          </select>
        ` : ''}
      `;

    // ─── SHAPE BORDER ──────────────────────────────────────────────
    case 'shapeBorder':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Border Width <span id="mobSbwV">${l.borderWidth||0}</span></div>
        <div class="sp-slider"><label>Width</label><input type="range" min="0" max="40" value="${l.borderWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].borderWidth=+this.value;layers[selectedIndex].strokeEnabled=this.value>0;document.getElementById('shapeBorderW').value=this.value;document.getElementById('mobSbwV').textContent=this.value;redraw()}"><span class="sp-val">${l.borderWidth||0}</span></div>
        <div class="sp-label">Border Color</div>
        <div class="sp-color-row">
          <label>Color</label>
          <input type="color" value="${l.borderColor||'#ffffff'}" oninput="if(selectedIndex>=0){layers[selectedIndex].borderColor=this.value;document.getElementById('shapeBorder').value=this.value;redraw()}">
        </div>
        <div class="sp-palette">${palHtml('mobSetBorderColor')}</div>
        <div class="sp-label">Dash Style</div>
        <div class="sp-pill-row">
          ${['solid','dashed','dotted'].map(d=>`<button class="sp-pill${(l.dashStyle||'solid')===d?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].dashStyle='${d}';redraw();document.querySelectorAll('#mobSheet .sp-pill').forEach(p=>p.classList.remove('on'));this.classList.add('on')}">${d}</button>`).join('')}
        </div>
      `;

    // ─── SHAPE RADIUS ──────────────────────────────────────────────
    case 'shapeRadius':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Corner Radius <span id="mobCrV">${l.cornerRadius||0}</span></div>
        <div class="sp-slider"><label>Radius</label><input type="range" min="0" max="300" value="${l.cornerRadius||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].cornerRadius=+this.value;document.getElementById('shapeCorner').value=this.value;document.getElementById('mobCrV').textContent=this.value;redraw()}"><span class="sp-val">${l.cornerRadius||0}</span></div>
        <div class="sp-pill-row">
          ${[0,5,10,20,40,80,150,999].map(r=>`<button class="sp-pill" onclick="if(selectedIndex>=0){layers[selectedIndex].cornerRadius=${r};document.getElementById('shapeCorner').value=${r};document.getElementById('mobCrV').textContent=${r};redraw()}">${r===999?'●':r}</button>`).join('')}
        </div>
      `;

    // ─── SHAPE GRADIENT ────────────────────────────────────────────
    case 'shapeGrad':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Gradient Presets</div>
        <div class="sp-grad-grid">${MOB_GRADS.map((g,i)=>`<div class="sp-grad-swatch" style="background:linear-gradient(135deg,${g[0]},${g[1]})" onclick="if(selectedIndex>=0){layers[selectedIndex].fillType='gradient';layers[selectedIndex].gradC1='${g[0]}';layers[selectedIndex].gradC2='${g[1]}';redraw()}"></div>`).join('')}</div>
        <div class="sp-label">Custom Gradient</div>
        <div class="sp-color-row">
          <label>C1 → C2</label>
          <input type="color" value="${l.gradC1||'#c8a96e'}" oninput="if(selectedIndex>=0){layers[selectedIndex].fillType='gradient';layers[selectedIndex].gradC1=this.value;redraw()}">
          <input type="color" value="${l.gradC2||'#ff6b6b'}" oninput="if(selectedIndex>=0){layers[selectedIndex].fillType='gradient';layers[selectedIndex].gradC2=this.value;redraw()}">
        </div>
        <select class="sp-select" onchange="if(selectedIndex>=0){layers[selectedIndex].gradDir=this.value;redraw()}">
          <option value="to right">→ Horizontal</option>
          <option value="to bottom">↓ Vertical</option>
          <option value="to bottom right">↘ Diagonal</option>
          <option value="radial">◉ Radial</option>
        </select>
      `;

    // ─── EFFECTS ───────────────────────────────────────────────────
    case 'effects':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Quick Effects</div>
        <div class="sp-btn-grid">
          <button class="sp-action-btn" onclick="quickFx('blur')">💫 Blur +</button>
          <button class="sp-action-btn" onclick="quickFx('glow')">✨ Glow +</button>
          <button class="sp-action-btn" onclick="quickFx('shadow')">🌑 Shadow</button>
          <button class="sp-action-btn" onclick="quickFx('rotate')">🔄 +15°</button>
          <button class="sp-action-btn" onclick="quickFx('fade50')">👁 50% Op</button>
          <button class="sp-action-btn danger" onclick="quickFx('reset')">♻ Reset</button>
        </div>
        <div class="sp-label">Blur <span id="mobFxBlurV">${l.fxBlur||0}</span></div>
        <div class="sp-slider"><label>Blur</label><input type="range" min="0" max="40" value="${l.fxBlur||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].fxBlur=+this.value;document.getElementById('fxBlur').value=this.value;document.getElementById('mobFxBlurV').textContent=this.value;redraw()}"><span class="sp-val">${l.fxBlur||0}</span></div>
        <div class="sp-label">Glow Size <span id="mobFxGlowV">${l.glowSize||0}</span></div>
        <div class="sp-slider"><label>Glow</label><input type="range" min="0" max="80" value="${l.glowSize||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].glowSize=+this.value;layers[selectedIndex].glowColor=layers[selectedIndex].glowColor||'#c8a96e';document.getElementById('mobFxGlowV').textContent=this.value;redraw()}"><span class="sp-val">${l.glowSize||0}</span></div>
        <div class="sp-label">Shadow Blur <span id="mobFxShadV">${l.shadowBlur||0}</span></div>
        <div class="sp-slider"><label>Shadow</label><input type="range" min="0" max="80" value="${l.shadowBlur||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadowBlur=+this.value;layers[selectedIndex].shadowX=4;layers[selectedIndex].shadowY=4;document.getElementById('fxShadowBlur').value=this.value;document.getElementById('mobFxShadV').textContent=this.value;redraw()}"><span class="sp-val">${l.shadowBlur||0}</span></div>
        <div class="sp-label">Skew X <span id="mobSkXV">${l.skewX||0}°</span></div>
        <div class="sp-slider"><label>Skew X</label><input type="range" min="-45" max="45" value="${l.skewX||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].skewX=+this.value;document.getElementById('fxSkewX').value=this.value;document.getElementById('mobSkXV').textContent=this.value+'°';redraw()}"><span class="sp-val">${l.skewX||0}</span></div>
        <div class="sp-label">Skew Y <span id="mobSkYV">${l.skewY||0}°</span></div>
        <div class="sp-slider"><label>Skew Y</label><input type="range" min="-45" max="45" value="${l.skewY||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].skewY=+this.value;document.getElementById('fxSkewY').value=this.value;document.getElementById('mobSkYV').textContent=this.value+'°';redraw()}"><span class="sp-val">${l.skewY||0}</span></div>
      `;

    // ─── OPACITY ───────────────────────────────────────────────────
    case 'opacity':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Opacity <span id="mobOpV">${l.opacity??100}%</span></div>
        <div class="sp-stepper">
          <button class="sp-step-btn" onclick="if(selectedIndex>=0){layers[selectedIndex].opacity=Math.max(0,(layers[selectedIndex].opacity??100)-5);document.getElementById('fxOpacity').value=layers[selectedIndex].opacity;document.getElementById('mobOpV').textContent=layers[selectedIndex].opacity+'%';document.querySelectorAll('#mobSheet input[type=range]')[0].value=layers[selectedIndex].opacity;redraw()}">−</button>
          <div class="sp-step-val" id="mobOpNum">${l.opacity??100}</div>
          <button class="sp-step-btn" onclick="if(selectedIndex>=0){layers[selectedIndex].opacity=Math.min(100,(layers[selectedIndex].opacity??100)+5);document.getElementById('fxOpacity').value=layers[selectedIndex].opacity;document.getElementById('mobOpV').textContent=layers[selectedIndex].opacity+'%';document.querySelectorAll('#mobSheet input[type=range]')[0].value=layers[selectedIndex].opacity;redraw()}">+</button>
        </div>
        <div class="sp-slider"><label>Opacity</label><input type="range" min="0" max="100" value="${l.opacity??100}" oninput="if(selectedIndex>=0){layers[selectedIndex].opacity=+this.value;document.getElementById('fxOpacity').value=this.value;document.getElementById('mobOpV').textContent=this.value+'%';document.getElementById('mobOpNum').textContent=this.value;updateFx();redraw()}"><span class="sp-val">${l.opacity??100}%</span></div>
        <div class="sp-pill-row">
          ${[100,80,60,40,20,0].map(v=>`<button class="sp-pill" onclick="if(selectedIndex>=0){layers[selectedIndex].opacity=${v};document.getElementById('fxOpacity').value=${v};redraw();mobRefreshSheet('opacity')}">${v}%</button>`).join('')}
        </div>
      `;

    // ─── POSITION ──────────────────────────────────────────────────
    case 'position':
      if (!l) return noLayer();
      return `
        <div class="sp-label">Position</div>
        <div class="sp-xywh">
          <div class="sp-field"><label>X</label><input type="number" value="${Math.round(l.x)}" oninput="if(selectedIndex>=0){layers[selectedIndex].x=+this.value;redraw()}"></div>
          <div class="sp-field"><label>Y</label><input type="number" value="${Math.round(l.y)}" oninput="if(selectedIndex>=0){layers[selectedIndex].y=+this.value;redraw()}"></div>
          <div class="sp-field"><label>W</label><input type="number" value="${Math.round(l.w)}" oninput="if(selectedIndex>=0){layers[selectedIndex].w=Math.max(1,+this.value);redraw()}"></div>
          <div class="sp-field"><label>H</label><input type="number" value="${Math.round(l.h)}" oninput="if(selectedIndex>=0){layers[selectedIndex].h=Math.max(1,+this.value);redraw()}"></div>
        </div>
        <div class="sp-label">Rotation <span id="mobRotV">${l.rotation||0}°</span></div>
        <div class="sp-slider"><label>Rotate</label><input type="range" min="-180" max="180" value="${l.rotation||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].rotation=+this.value;document.getElementById('fxRotation').value=this.value;document.getElementById('mobRotV').textContent=this.value+'°';redraw()}"><span class="sp-val">${l.rotation||0}°</span></div>
        <div class="sp-label">Align to Canvas</div>
        <div class="sp-btn-grid">
          <button class="sp-action-btn" onclick="alignLayer('left')">⊢ Left</button>
          <button class="sp-action-btn" onclick="alignLayer('center-h')">⊕ Center H</button>
          <button class="sp-action-btn" onclick="alignLayer('right')">⊣ Right</button>
          <button class="sp-action-btn" onclick="alignLayer('top')">⊤ Top</button>
          <button class="sp-action-btn" onclick="alignLayer('center-v')">⊕ Center V</button>
          <button class="sp-action-btn" onclick="alignLayer('bottom')">⊥ Bottom</button>
        </div>
        <div class="sp-toggle-row">
          <label>Lock Aspect Ratio</label>
          <div class="sp-toggle${aspectLock[l.id]?' on':''}" onclick="if(selectedIndex>=0){const id=layers[selectedIndex].id;if(!aspectLock[id])aspectLock[id]=true;else delete aspectLock[id];this.classList.toggle('on')}"></div>
        </div>
      `;

    // ─── BRUSH ─────────────────────────────────────────────────────
    case 'brush': return `
      <div class="sp-label">Brush Type</div>
      <div class="sp-brush-grid">
        ${BRUSH_TYPES.map(b=>`<button class="sp-brush-btn${brushSettings.type===b.id?' on':''}" onclick="brushSettings.type='${b.id}';document.querySelectorAll('.sp-brush-btn').forEach(x=>x.classList.remove('on'));this.classList.add('on')">${b.label}</button>`).join('')}
      </div>
      <div class="sp-label">Color</div>
      <div class="sp-color-row">
        <label>Color</label>
        <input type="color" value="${brushSettings.color}" oninput="brushSettings.color=this.value;document.getElementById('brushColor').value=this.value">
      </div>
      <div class="sp-palette">${palHtml('mobSetBrushColor')}</div>
      <div class="sp-label">Size <span id="mobBrSzV">${brushSettings.size}</span></div>
      <div class="sp-slider"><label>Size</label><input type="range" min="1" max="80" value="${brushSettings.size}" oninput="brushSettings.size=+this.value;document.getElementById('brushSize').value=this.value;document.getElementById('mobBrSzV').textContent=this.value"><span class="sp-val">${brushSettings.size}</span></div>
      <div class="sp-label">Opacity <span id="mobBrOpV">${brushSettings.opacity}%</span></div>
      <div class="sp-slider"><label>Opacity</label><input type="range" min="1" max="100" value="${brushSettings.opacity}" oninput="brushSettings.opacity=+this.value;document.getElementById('brushOpacity').value=this.value;document.getElementById('mobBrOpV').textContent=this.value+'%'"><span class="sp-val">${brushSettings.opacity}%</span></div>
      <button class="sp-primary-btn" onclick="mobileToggleDraw();mobRefreshSheet('brush')" style="${drawingMode?'background:#ef4444;':''}">
        ${drawingMode ? '⏹ Stop Drawing' : '🖌 Start Drawing'}
      </button>
    `;

    default: return `<p style="color:var(--text3);text-align:center;padding:20px;">${type} panel</p>`;
  }
}

// =====================================================================
// AFTER-SHEET HOOKS — things that need DOM refs
// =====================================================================
function afterSheetBuild(type) {
  if (type === 'templates') {
    const grid = document.getElementById('mobTemplateGrid');
    if (!grid) return;
    TEMPLATES.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.style.cssText = `background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]});border:1px solid rgba(255,255,255,0.1);border-radius:8px;height:70px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${t.txtColor};font-family:'${t.font}',sans-serif;font-size:${Math.min(18,Math.round(t.size/5))}px;font-weight:700;letter-spacing:1px;`;
      btn.textContent = t.name;
      btn.onclick = () => { applyTemplate(t); closeMobSheet(); showToast('Template applied!'); };
      grid.appendChild(btn);
    });
  }
  if (type === 'layers') {
    const inner = document.getElementById('mobLayerListInner');
    if (!inner) return;
    inner.innerHTML = '';
    if (!layers.length) { inner.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px;">No layers yet</p>'; return; }
    [...layers].reverse().forEach((l, ri) => {
      const i = layers.length - 1 - ri;
      const div = document.createElement('div');
      div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;border-radius:8px;${i===selectedIndex?'background:rgba(212,175,55,0.08);':''}`;
      div.innerHTML = `
        <span style="font-size:16px">${{text:'T',image:'🖼',shape:'▬',sticker:'😀',draw:'✏️'}[l.type]||'?'}</span>
        <span style="flex:1;font-size:12px;font-weight:700;color:${i===selectedIndex?'var(--gold)':'var(--text)'}">${l.name||l.type}</span>
        <button style="background:none;border:none;color:var(--text3);font-size:10px;cursor:pointer;padding:4px;" onclick="event.stopPropagation();layers[${i}].visible=!layers[${i}].visible;redraw();afterSheetBuild('layers')">${l.visible!==false?'👁':'🚫'}</button>
      `;
      div.onclick = () => { selectedIndex = i; updateRightPanel(); updateLayerList(); redraw(); updateMobCtxBar(); closeMobSheet(); };
      inner.appendChild(div);
    });
  }
}

// =====================================================================
// MORE POPUP
// =====================================================================
function showMobMore() {
  const popup = document.getElementById('mobMorePopup');
  if (!popup) return;
  if (selectedIndex < 0) { hideMobMore(); return; }
  const l = layers[selectedIndex];

  popup.innerHTML = `
    <div class="mob-more-item" onclick="duplicateSelected();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Duplicate
    </div>
    <div class="mob-more-item" onclick="flipH();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h4M18 12h4"/><path d="M6 8l-4 4 4 4"/><path d="M18 8l4 4-4 4"/></svg>Flip Horizontal
    </div>
    <div class="mob-more-item" onclick="flipV();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20M12 2v4M12 18v4"/><path d="M8 6l4-4 4 4"/><path d="M8 18l4 4 4-4"/></svg>Flip Vertical
    </div>
    <div class="mob-more-item" onclick="bringToFront();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>Bring to Front
    </div>
    <div class="mob-more-item" onclick="sendToBack();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 6 12 11 7 6"/><polyline points="17 13 12 18 7 13"/></svg>Send to Back
    </div>
    <div class="mob-more-item" onclick="toggleLockSelected();hideMobMore()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>${l.locked ? '🔓 Unlock' : '🔒 Lock'}
    </div>
    <div class="mob-more-divider"></div>
    <div class="mob-more-item danger" onclick="deleteSelected();hideMobMore();updateMobCtxBar()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete Layer
    </div>
  `;

  // Position above the More button
  popup.style.display = 'block';
  popup.style.left = '50%';
  popup.style.transform = 'translateX(-50%)';
  popup.style.bottom = `calc(58px + 54px + max(env(safe-area-inset-bottom),0px) + 8px)`;
}

function hideMobMore() {
  const p = document.getElementById('mobMorePopup');
  if (p) p.style.display = 'none';
}

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================
function palHtml(fn) {
  return MOB_PAL.map(c => `<div class="sp-swatch" style="background:${c}" onclick="${fn}('${c}')"></div>`).join('');
}

function addTile(font, label, onclick, small = false) {
  const style = font ? `font-family:'${font}',sans-serif;${small?'font-size:10px':''}` : '';
  return `<button class="mob-add-tile" onclick="${onclick}"><span class="mob-add-icon" style="${style}">${label}</span><span>${label==='T'?'Text':label}</span></button>`;
}

function addEmojiTile(emoji, label, onclick) {
  return `<button class="mob-add-tile" onclick="${onclick}"><span class="mob-add-icon">${emoji}</span><span>${label}</span></button>`;
}

function spBtn(onclick, label) {
  return `<button class="sp-action-btn" onclick="${onclick}">${label}</button>`;
}

function noLayer() {
  return '<p style="color:var(--text3);text-align:center;padding:20px;font-size:12px;">Select a layer first</p>';
}

function mobRefreshSheet(type) {
  if (_currentSheet !== type) return;
  const body = document.getElementById('mobSheetBody');
  if (body) {
    body.innerHTML = buildSheetHTML(type);
    afterSheetBuild(type);
  }
}

// ── Palette click handlers ──
window.mobBgPalClick = (c) => { bgType='solid'; bgSolidColor=c; bgImage=null; document.getElementById('bgColor').value=c; redraw(); };
window.mobSetTextColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].color=c; document.getElementById('txtColor').value=c; redraw(); };
window.mobSetOutlineColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].outlineColor=c; document.getElementById('txtOutlineColor').value=c; redraw(); };
window.mobSetGlowColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].glowColor=c; document.getElementById('txtGlowColor').value=c; redraw(); };
window.mobSetBgBoxColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].bgBoxColor=c; document.getElementById('txtBgBoxColor').value=c; updateSelectedText(); };
window.mobSetShapeColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].fill=c; document.getElementById('shapeFill').value=c; redraw(); };
window.mobSetBorderColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].borderColor=c; document.getElementById('shapeBorder').value=c; redraw(); };
window.mobSetImgBorderColor = (c) => { if(selectedIndex<0)return; layers[selectedIndex].imgBorderColor=c; redraw(); };
window.mobSetBrushColor = (c) => { brushSettings.color=c; document.getElementById('brushColor').value=c; };

window.mobApplyGrad = (i) => {
  bgType='gradient'; bgGradient.c1=MOB_GRADS[i][0]; bgGradient.c2=MOB_GRADS[i][1]; bgGradient.dir='to bottom right';
  bgImage=null;
  const g1=document.getElementById('grad1'),g2=document.getElementById('grad2');
  if(g1)g1.value=MOB_GRADS[i][0]; if(g2)g2.value=MOB_GRADS[i][1];
  redraw(); saveHistory();
};

window.mobFontStep = (delta) => {
  if(selectedIndex<0||layers[selectedIndex].type!=='text') return;
  const l=layers[selectedIndex];
  l.size=Math.max(8,Math.min(400,(l.size||72)+delta));
  document.getElementById('txtSize').value=l.size;
  const fsv=document.getElementById('mobFsVal'); if(fsv)fsv.textContent=l.size;
  const fsd=document.getElementById('mobFsDisplay'); if(fsd)fsd.textContent=l.size+'px';
  redraw();
};

window.filterMobFontSearch = (q) => {
  const container = document.getElementById('mobFontSearchResults');
  if (!container) return;
  const l = selectedIndex >= 0 ? layers[selectedIndex] : null;
  const filtered = q ? ALL_FONTS.filter(f => f.name.toLowerCase().includes(q.toLowerCase()) || f.label.toLowerCase().includes(q.toLowerCase())) : ALL_FONTS;
  container.innerHTML = filtered.map(f => `<button class="sp-font-pill${l&&l.font===f.name?' on':''}" style="font-family:'${f.name}'" onclick="if(selectedIndex>=0){layers[selectedIndex].font='${f.name}';document.getElementById('txtFont').value='${f.name}';updateSelectedText();}">${f.label}</button>`).join('');
};

// =====================================================================
// SVG ICONS (inline, minimal)
// =====================================================================
const svgI = (d, extra='') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const svgT = () => svgI('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>');
const svgText = () => svgI('<path d="M17 6.1H3"/><path d="M21 12.1H3"/><path d="M15.1 18H3"/>');
const svgImg = () => svgI('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>');
const svgShape = () => svgI('<rect x="3" y="3" width="10" height="10" rx="1"/><polygon points="18 8 22 15 14 15 18 8"/><circle cx="12" cy="17" r="4"/>');
const svgBg = () => svgI('<rect x="2" y="2" width="20" height="20" rx="3"/><path d="M2 12h20M12 2v20"/>');
const svgUndo = () => svgI('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>');
const svgRedo = () => svgI('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>');
const svgBrush = () => svgI('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>');
const svgExport = () => svgI('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>');
const svgEdit = () => svgI('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>');
const svgFont = () => svgI('<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>');
const svgStyle = () => svgI('<path d="M4 6h16M4 12h10M4 18h6"/>');
const svgSize = () => svgI('<path d="M12 20V4M4 8l8-8 8 8"/><line x1="3" y1="20" x2="21" y2="20"/>');
const svgColor = () => svgI('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>');
const svgOutline = () => svgI('<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>');
const svgShadow = () => svgI('<rect x="2" y="2" width="14" height="14" rx="2"/><rect x="8" y="8" width="14" height="14" rx="2" opacity=".4"/>');
const svgGlow = () => svgI('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>');
const svgBox = () => svgI('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>');
const svgOpacity = () => svgI('<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18V4a8 8 0 0 1 0 16z"/>');
const svgPos = () => svgI('<path d="M12 2v20M2 12h20M17 7l5 5-5 5M7 7l-5 5 5 5"/>');
const svgFilter = () => svgI('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>');
const svgBright = () => svgI('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>');
const svgMask = () => svgI('<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20V2z"/>');
const svgBorder = () => svgI('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="4 2"/>');
const svgFx = () => svgI('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>');
const svgBlend = () => svgI('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>');
const svgRadius = () => svgI('<path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/>');
const svgGrad = () => svgI('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="transparent"/></linearGradient></defs><rect x="2" y="6" width="20" height="12" rx="2" fill="url(#g)" stroke="currentColor"/>');
const svgFlipH = () => svgI('<path d="M12 2v20"/><path d="M8 6L4 12l4 6"/><path d="M16 6l4 6-4 6"/>');
const svgFlipV = () => svgI('<path d="M2 12h20"/><path d="M6 8l6-4 6 4"/><path d="M6 16l6 4 6-4"/>');
const svgLayerUp = () => svgI('<polyline points="18 15 12 9 6 15"/>');
const svgLayerDown = () => svgI('<polyline points="6 9 12 15 18 9"/>');
const svgDup = () => svgI('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
const svgMore = () => svgI('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>');
const svgTrash = () => svgI('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>');

// =====================================================================
// CANVAS FIT FOR MOBILE
// =====================================================================
function fitCanvasToMobile() {
  if (window.innerWidth > 768) {
    const w = document.getElementById('canvasWrapper');
    if (w) w.style.transform = '';
    return;
  }
  const area = document.getElementById('canvasArea');
  const wrapper = document.getElementById('canvasWrapper');
  const canv = document.getElementById('mainCanvas');
  if (!area || !wrapper || !canv) return;
  const areaW = area.clientWidth - 16;
  const areaH = area.clientHeight - 16;
  if (areaW <= 0 || areaH <= 0) return;
  const sx = areaW / canvasW;
  const sy = areaH / canvasH;
  scale = Math.min(sx, sy, 1);
  wrapper.style.width = (canvasW * scale) + 'px';
  wrapper.style.height = (canvasH * scale) + 'px';
  canv.style.width = (canvasW * scale) + 'px';
  canv.style.height = (canvasH * scale) + 'px';
  updateAppZoomLabel();
}

function updateAppZoomLabel() {
  const el = document.getElementById('appZoomLabel');
  if (el) el.textContent = Math.round(scale * 100) + '%';
  const af = document.getElementById('appFormatLabel');
  if (af) af.textContent = canvasW + '×' + canvasH;
}

function zoomMobile(delta) { zoom(delta); updateAppZoomLabel(); }
window.addEventListener('resize', fitCanvasToMobile);

// =====================================================================
// HOOK INTO EXISTING FUNCTIONS
// =====================================================================

// After any redraw — sync ctx bar if selection changed
// We patch redraw after bootMobile runs (so it exists)
function patchRedraw() {
  if (typeof window.redraw !== 'function') return;
  const _orig = window.redraw;
  let _lastSel = -99;
  window.redraw = function () {
    _orig.apply(this, arguments);
    if (window.innerWidth <= 768 && selectedIndex !== _lastSel) {
      _lastSel = selectedIndex;
      updateMobCtxBar();
    }
  };
}

// updateMobileQuickActions — hook (keep compat)
window.updateMobileQuickActions = function () {
  if (window.innerWidth <= 768) updateMobCtxBar();
};

// Existing sheet functions — stub so nothing breaks
window.toggleAppSheet = function () {};
window.closeAppSheets = function () { closeMobSheet(); };
window.openMobileAddSheet = function () { mobOpenSheet('add'); };
window.closeMobAddSheet = function () { closeMobSheet(); };
window.openMobileExportSheet = function () { mobOpenSheet('export'); };
window.openMobileFx = function () { mobOpenSheet('effects'); };
window.openMobileFonts = function () { mobOpenSheet('font'); };
window.openMobileColor = function () {
  if (selectedIndex < 0) return;
  const t = layers[selectedIndex].type;
  if (t === 'text') mobOpenSheet('textColor');
  else if (t === 'shape') mobOpenSheet('shapeColor');
};

function mobileToggleDraw() {
  toggleDrawingMode();
  const btn = document.getElementById('mobDrawBtn');
  if (btn) btn.classList.toggle('active', drawingMode);
  updateMobCtxBar();
}
window.mobileToggleDraw = mobileToggleDraw;

function buildMobileFontGrid() {
  // Called from init() in main JS — safe to be empty here since
  // we build fonts inline in the font sheet panel
}
function filterMobileFonts(q) {
  filterMobFontSearch(q);
}

// toggleAcc still used by desktop
function toggleAcc(id) {
  const body = document.getElementById(id);
  if (!body) return;
  const header = body.previousElementSibling;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (header) header.classList.toggle('open', !isOpen);
}
window.toggleAcc = toggleAcc;

// =====================================================================
// KEYBOARD SHORTCUTS
// =====================================================================
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { undo(); e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') { redo(); e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') { duplicateSelected(); e.preventDefault(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); e.preventDefault(); return; }
  if (e.key === 'Escape') { selectedIndex = -1; updateLayerList(); updateRightPanel(); redraw(); closeMobSheet(); return; }
  if (selectedIndex >= 0) {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { layers[selectedIndex].x -= step; redraw(); updateRightPanel(); }
    if (e.key === 'ArrowRight') { layers[selectedIndex].x += step; redraw(); updateRightPanel(); }
    if (e.key === 'ArrowUp') { layers[selectedIndex].y -= step; redraw(); updateRightPanel(); }
    if (e.key === 'ArrowDown') { layers[selectedIndex].y += step; redraw(); updateRightPanel(); }
    e.preventDefault();
  }
});

// =====================================================================
// TOUCH PINCH ZOOM & PAN (upgraded version — replaces old one)
// =====================================================================
function setupTouchZoomAndPan() {
  let touchStartDist = 0, touchStartScale = 1;
  let isPanning = false, panStartX = 0, panStartY = 0;
  const canvasArea = document.getElementById('canvasArea');
  if (!canvasArea) return;

  canvasArea.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      touchStartScale = scale;
    } else if (e.touches.length === 1 && selectedIndex < 0 && !drawingMode) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvasArea.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scale = Math.max(0.1, Math.min(3, touchStartScale * (dist / touchStartDist)));
      applyCanvasScale();
    } else if (isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panStartX;
      const dy = e.touches[0].clientY - panStartY;
      canvasArea.scrollLeft -= dx;
      canvasArea.scrollTop -= dy;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  canvasArea.addEventListener('touchend', () => { isPanning = false; });
}

// =====================================================================
// BOOT
// init() + fitCanvas() are called by thumbnail-maker.js already
// We just need to kick off the mobile UI after everything is ready
// =====================================================================
(function bootMobile() {
  // Wait for DOM to be ready
  function onReady() {
    // Core init — called once only
    if (typeof init === 'function') init();
    if (typeof fitCanvas === 'function') fitCanvas();

    patchRedraw();

    if (window.innerWidth <= 768) {
      document.body.classList.add('app-mode');
      buildMobileUI();
      setTimeout(fitCanvasToMobile, 80);
    } else {
      const lp = document.getElementById('leftPanelEl');
      if (lp) lp.classList.add('drawer-open');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    // Scripts run after DOM — safe to call immediately with small delay
    // to ensure thumbnail-maker.js has finished setting up globals
    setTimeout(onReady, 50);
  }
})();
