// thumbnail-maker-mobile.js
// Mobile-only functions: app mode, touch, CCP panel, quick actions
// Loaded after thumbnail-maker.js

function buildMobileFontGrid() {
  const g = document.getElementById('mobileFontGrid');
  ALL_FONTS.forEach(f => createFontBtn(f, g));
}
function filterMobileFonts(q) {
  const g = document.getElementById('mobileFontGrid');
  g.innerHTML = '';
  ALL_FONTS.filter(f=>!q||f.name.toLowerCase().includes(q.toLowerCase())).forEach(f=>createFontBtn(f,g));
}

function toggleAppSheet(which){
  const left=document.getElementById('leftPanelEl');
  const right=document.getElementById('rightPanelEl');
  const backdrop=document.getElementById('appSheetBackdrop');
  const btnTools=document.getElementById('appNavTools');
  const btnProps=document.getElementById('appNavProps');
  const target=which==='left'?left:right;
  const isOpen=target.classList.contains('sheet-open');
  left.classList.remove('sheet-open');
  right.classList.remove('sheet-open');
  if(window.innerWidth<=768)left.classList.remove('drawer-open');
  btnTools.classList.remove('active');
  btnProps.classList.remove('active');
  if(!isOpen){
    if(which==='right' && window.innerWidth<=768){
      // On mobile, Edit button opens CCP panel instead of right sheet
      if(typeof ccpRefresh==='function') ccpRefresh();
      (which==='left'?btnTools:btnProps).classList.add('active');
      return;
    }
    target.classList.add('sheet-open');
    backdrop.classList.add('show');
    (which==='left'?btnTools:btnProps).classList.add('active');
  } else {
    backdrop.classList.remove('show');
  }
}
function closeAppSheets(){
  document.getElementById('leftPanelEl').classList.remove('sheet-open');
  document.getElementById('rightPanelEl').classList.remove('sheet-open');
  document.getElementById('appSheetBackdrop').classList.remove('show');
  document.getElementById('appNavTools').classList.remove('active');
  document.getElementById('appNavProps').classList.remove('active');
}

// ===================== ACCORDION =====================
function toggleAcc(id) {
  const body = document.getElementById(id);
  const header = body.previousElementSibling;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  header.classList.toggle('open', !isOpen);
}

function openMobileExportSheet(){
  document.getElementById('mobileExportModal').classList.add('show');
}

function openMobileAddSheet(){
  const sheet = document.getElementById('mobAddSheet');
  const backdrop = document.getElementById('mobAddSheetBackdrop');
  if(!sheet || !backdrop) return;
  closeAppSheets();
  sheet.classList.add('show');
  backdrop.classList.add('show');
}

function closeMobAddSheet(){
  const sheet = document.getElementById('mobAddSheet');
  const backdrop = document.getElementById('mobAddSheetBackdrop');
  if(sheet) sheet.classList.remove('show');
  if(backdrop) backdrop.classList.remove('show');
}

function initAppMode(){
  const isMobile=window.matchMedia('(max-width:768px)').matches;
  if(isMobile){
    document.body.classList.add('app-mode');
    setTimeout(fitCanvasToMobile,50);
  } else {
    const lp=document.getElementById('leftPanelEl');
    if(lp)lp.classList.add('drawer-open');
  }
}
window.addEventListener('resize', ()=>{
  const isMobile = window.matchMedia('(max-width:768px)').matches;
  document.body.classList.toggle('app-mode', isMobile);
  if(!isMobile){
    closeAppSheets();
    const lp=document.getElementById('leftPanelEl');
    if(lp)lp.classList.add('drawer-open');
  }
  setTimeout(fitCanvasToMobile, 50);
});
initAppMode();

function openMobileFx(){if(selectedIndex<0){showToast('Select a layer first!');return;}document.getElementById('mobileFxModal').classList.add('show');}
function mobileToggleDraw(){
  toggleDrawingMode();
  const btn=document.getElementById('mobDrawBtn');
  if(btn)btn.classList.toggle('active',drawingMode);
  if(drawingMode) setTimeout(()=>switchTabByName('brush'), 50);
}
function openMobileFonts(){if(selectedIndex<0||layers[selectedIndex].type!=='text'){showToast('Select a text layer!');return;}document.getElementById('mobileFontModal').classList.add('show');}
function openMobileColor(){
  if(selectedIndex<0){showToast('Select a layer first!');return;}
  const l=layers[selectedIndex];
  const fill=l.type==='text'?l.color:l.type==='shape'?l.fill:'#ffffff';
  document.getElementById('mobFillColor').value=fill||'#ffffff';
  document.getElementById('mobFillHex').value=fill||'#ffffff';
  document.getElementById('mobStrokeWidth').value=l.borderWidth||l.outlineWidth||0;
  document.getElementById('mobileColorModal').classList.add('show');
}
function mobileSetFill(color){
  if(selectedIndex<0)return;const l=layers[selectedIndex];
  if(/^#[0-9a-fA-F]{6}$/.test(color)||color.startsWith('#')){
    if(l.type==='text'){l.color=color;document.getElementById('txtColor').value=color;}
    else if(l.type==='shape'){l.fill=color;document.getElementById('shapeFill').value=color;}
    document.getElementById('mobFillColor').value=color;
    document.getElementById('mobFillHex').value=color;
    redraw();
  }
}
function mobileSetStroke(){
  if(selectedIndex<0)return;const l=layers[selectedIndex];
  const color=document.getElementById('mobStrokeColor').value;
  const width=parseInt(document.getElementById('mobStrokeWidth').value)||0;
  if(l.type==='shape'){l.borderColor=color;l.borderWidth=width;}
  else if(l.type==='text'){l.outlineColor=color;l.outlineWidth=width;}
  redraw();
}

function quickFx(type){
  if(selectedIndex<0){showToast('Select a layer first!');return;}
  const l=layers[selectedIndex];saveHistory();
  if(type==='blur')l.fxBlur=Math.min((l.fxBlur||0)+5,40);
  else if(type==='glow'){l.glowSize=Math.min((l.glowSize||0)+10,60);l.glowColor='#c8a96e';}
  else if(type==='shadow'){l.shadowBlur=Math.min((l.shadowBlur||0)+10,60);l.shadowX=4;l.shadowY=4;}
  else if(type==='rotate')l.rotation=((l.rotation||0)+15)%360;
  else if(type==='fade50')l.opacity=50;
  else if(type==='reset'){l.fxBlur=0;l.glowSize=0;l.shadowBlur=0;l.opacity=100;l.rotation=0;l.skewX=0;l.skewY=0;l.mask='none';}
  updateFxPanel();redraw();showToast('FX applied!');
}

// ===================== MOBILE QUICK ACTIONS & TOUCH =====================
function updateMobileQuickActions() {
  const bar = document.getElementById('mobileQuickActions');
  if(!bar) return;
  // On mobile: hide the old quick bar — canvaCtxPanel handles it now
  if(window.innerWidth <= 768) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'none';
  return;
  // (legacy desktop code below kept for safety)
  bar.style.display = 'flex';
  bar.innerHTML = '';

  if(selectedIndex < 0) {
    bar.innerHTML = `
      <button class="mob-quick-btn" onclick="addText()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> + Text</button>
      <button class="mob-quick-btn" onclick="triggerUpload()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> + Image</button>
      <button class="mob-quick-btn" onclick="addRect()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> + Rect</button>
      <button class="mob-quick-btn" onclick="addCircle()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg> + Circle</button>
      <button class="mob-quick-btn" onclick="openModal('templatesModal')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg> Templates</button>
      <button class="mob-quick-btn" onclick="undo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> Undo</button>
    `;
    return;
  }

  const layer = layers[selectedIndex];
  const baseActions = `
    <button class="mob-quick-btn btn-danger" onclick="deleteSelected()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete</button>
    <button class="mob-quick-btn" onclick="duplicateSelected()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button>
    <button class="mob-quick-btn" onclick="moveLayer(-1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> Forward</button>
    <button class="mob-quick-btn" onclick="moveLayer(1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Backward</button>
    <button class="mob-quick-btn" onclick="selectedIndex=-1;updateMobileQuickActions();redraw();"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close</button>
  `;

  if(layer.type === 'text') {
    bar.innerHTML = `
      <button class="mob-quick-btn" onclick="openTextPrompt()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Text</button>
      <button class="mob-quick-btn" onclick="changeMobileFontSize(10)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> Size +</button>
      <button class="mob-quick-btn" onclick="changeMobileFontSize(-10)">Size -</button>
      <button class="mob-quick-btn" onclick="openMobileFonts()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> Font</button>
      <button class="mob-quick-btn" onclick="openMobileColor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Color</button>
      <button class="mob-quick-btn" onclick="toggleTextStyle('bold')"><b>B</b></button>
      <button class="mob-quick-btn" onclick="toggleTextStyle('italic')"><i>I</i></button>
      ${baseActions}
    `;
  } else if(layer.type === 'image') {
    bar.innerHTML = `
      <button class="mob-quick-btn" onclick="openMobileFx()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m10.607 10.607l.707.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg> FX & Filters</button>
      <button class="mob-quick-btn" onclick="adjustMobileImage('brightness', 15)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Bright +</button>
      <button class="mob-quick-btn" onclick="adjustMobileImage('brightness', -15)">Bright -</button>
      <button class="mob-quick-btn" onclick="adjustMobileImage('contrast', 15)">Contrast +</button>
      <button class="mob-quick-btn" onclick="flipH()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V2M22 12H2M16 8l-4 4 4 4M8 8l4 4-4 4"/></svg> Flip H</button>
      ${baseActions}
    `;
  } else if(layer.type === 'shape') {
    bar.innerHTML = `
      <button class="mob-quick-btn" onclick="openMobileColor()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg> Color</button>
      <button class="mob-quick-btn" onclick="adjustMobileShape('cornerRadius', 10)">Radius +</button>
      <button class="mob-quick-btn" onclick="adjustMobileShape('cornerRadius', -10)">Radius -</button>
      <button class="mob-quick-btn" onclick="adjustMobileShape('borderWidth', 2)">Border +</button>
      <button class="mob-quick-btn" onclick="adjustMobileShape('borderWidth', -2)">Border -</button>
      ${baseActions}
    `;
  } else if(layer.type === 'draw') {
    bar.innerHTML = `
      <button class="mob-quick-btn" onclick="mobileToggleDraw()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Draw Mode</button>
      <button class="mob-quick-btn" onclick="clearBrushLayer()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Clear</button>
      ${baseActions}
    `;
  } else {
    bar.innerHTML = baseActions;
  }
}

function openTextPrompt() {
  if (selectedIndex < 0 || layers[selectedIndex].type !== 'text') return;
  const l = layers[selectedIndex];
  const newText = prompt("Edit Text content:", l.text);
  if (newText !== null) {
    l.text = newText;
    document.getElementById('txtContent').value = newText;
    redraw();
    updateMobileQuickActions();
  }
}

function changeMobileFontSize(delta) {
  if (selectedIndex < 0 || layers[selectedIndex].type !== 'text') return;
  const l = layers[selectedIndex];
  l.size = Math.max(10, (l.size || 72) + delta);
  document.getElementById('txtSize').value = l.size;
  redraw();
  updateMobileQuickActions();
}

function adjustMobileImage(prop, delta) {
  if (selectedIndex < 0 || layers[selectedIndex].type !== 'image') return;
  const l = layers[selectedIndex];
  if (prop === 'brightness') {
    l.brightness = Math.max(0, Math.min(300, (l.brightness ?? 100) + delta));
  } else if (prop === 'contrast') {
    l.contrast = Math.max(0, Math.min(300, (l.contrast ?? 100) + delta));
  }
  syncImgPanelFromLayer(l);
  redraw();
}

function adjustMobileShape(prop, delta) {
  if (selectedIndex < 0 || layers[selectedIndex].type !== 'shape') return;
  const l = layers[selectedIndex];
  if (prop === 'cornerRadius') {
    l.cornerRadius = Math.max(0, Math.min(200, (l.cornerRadius ?? 0) + delta));
    document.getElementById('shapeCorner').value = l.cornerRadius;
    document.getElementById('cornerVal').textContent = l.cornerRadius;
  } else if (prop === 'borderWidth') {
    l.borderWidth = Math.max(0, Math.min(50, (l.borderWidth ?? 0) + delta));
    document.getElementById('shapeBorderW').value = l.borderWidth;
  }
  redraw();
}

// Mobile Touch Pinch and Pan Zoom support
function setupTouchZoomAndPan() {
  let touchStartDist = 0;
  let touchStartScale = 1;
  let isPanning = false;
  let panStartX = 0, panStartY = 0;
  const canvasArea = document.getElementById('canvasArea');
  if(!canvasArea) return;

  canvasArea.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartScale = scale;
    } else if (e.touches.length === 1 && selectedIndex < 0 && !drawingMode) {
      isPanning = true;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }, {passive: true});

  canvasArea.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist;
      scale = Math.max(0.1, Math.min(3, touchStartScale * factor));
      applyCanvasScale();
    } else if (isPanning && e.touches.length === 1) {
      const dx = e.touches[0].clientX - panStartX;
      const dy = e.touches[0].clientY - panStartY;
      canvasArea.scrollLeft -= dx;
      canvasArea.scrollTop -= dy;
      panStartX = e.touches[0].clientX;
      panStartY = e.touches[0].clientY;
    }
  }, {passive: false});

  canvasArea.addEventListener('touchend', () => {
    isPanning = false;
  });
}

// ===================== KEYBOARD =====================
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){undo();e.preventDefault();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='y'){redo();e.preventDefault();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='d'){duplicateSelected();e.preventDefault();return;}
  if(e.key==='Delete'||e.key==='Backspace'){deleteSelected();e.preventDefault();return;}
  if(e.key==='Escape'){selectedIndex=-1;updateLayerList();updateRightPanel();redraw();return;}
  if(selectedIndex>=0){
    const step=e.shiftKey?10:1;
    if(e.key==='ArrowLeft'){layers[selectedIndex].x-=step;redraw();updateRightPanel();}
    if(e.key==='ArrowRight'){layers[selectedIndex].x+=step;redraw();updateRightPanel();}
    if(e.key==='ArrowUp'){layers[selectedIndex].y-=step;redraw();updateRightPanel();}
    if(e.key==='ArrowDown'){layers[selectedIndex].y+=step;redraw();updateRightPanel();}
    e.preventDefault();
  }
});

// ===================== MOBILE CANVAS FIT =====================
function fitCanvasToMobile(force){
  if(window.innerWidth>768){
    document.getElementById('canvasWrapper').style.transform='';
    return;
  }
  const area = document.getElementById('canvasArea');
  const wrapper = document.getElementById('canvasWrapper');
  const areaW = area.clientWidth - 16;
  const areaH = area.clientHeight - 16;
  const scaleX = areaW / canvasW;
  const scaleY = areaH / canvasH;
  scale = Math.min(scaleX, scaleY, 1);
  wrapper.style.width = (canvasW * scale) + 'px';
  wrapper.style.height = (canvasH * scale) + 'px';
  const canvas = document.getElementById('mainCanvas');
  canvas.style.width = (canvasW * scale) + 'px';
  canvas.style.height = (canvasH * scale) + 'px';
  updateAppZoomLabel();
}
function zoomMobile(delta){
  zoom(delta);
  updateAppZoomLabel();
}
function updateAppZoomLabel(){
  const el=document.getElementById('appZoomLabel');
  if(el) el.textContent=Math.round(scale*100)+'%';
  const fl=document.getElementById('appFormatLabel');
  if(fl) fl.textContent=canvasW+'×'+canvasH;
}
window.addEventListener('resize',fitCanvasToMobile);

// ===================== BOOT =====================
window.addEventListener('load',()=>{
  init();fitCanvas();applyTemplate(TEMPLATES[0]);
  setTimeout(fitCanvasToMobile,300);
});

// ===================== CANVA-STYLE MOBILE CONTEXT PANEL =====================
(function(){
  if(typeof window === 'undefined') return;

  // ── Build panel DOM once ──
  function buildPanel(){
    if(document.getElementById('canvaCtxPanel')) return;
    const p = document.createElement('div');
    p.id = 'canvaCtxPanel';
    p.innerHTML = `
      <div class="ccp-topbar">
        <div class="ccp-handle"></div>
        <span class="ccp-layer-badge" id="ccpBadge">TEXT</span>
        <button class="ccp-close" onclick="ccpClose()">✕</button>
      </div>
      <div class="ccp-tabs" id="ccpTabs"></div>
      <div class="ccp-panes" id="ccpPanes"></div>
    `;
    document.body.appendChild(p);
  }

  // ── Show/hide ──
  window.ccpClose = function(){
    const p = document.getElementById('canvaCtxPanel');
    if(p) p.classList.remove('visible');
  };

  function ccpShow(){ 
    const p = document.getElementById('canvaCtxPanel');
    if(p && window.innerWidth <= 768) p.classList.add('visible');
  }

  // ── Tab switch ──
  window.ccpSwitchTab = function(idx){
    document.querySelectorAll('.ccp-tab').forEach((t,i)=>t.classList.toggle('active', i===idx));
    document.querySelectorAll('.ccp-pane').forEach((p,i)=>p.classList.toggle('active', i===idx));
  };

  // ── Color palette HTML ──
  const PAL = ['#fff','#000','#ff3300','#ff6b6b','#ffcc00','#ffd200','#00ff88','#43e97b','#00c6ff','#0072ff','#c8a96e','#e8c98e','#f953c6','#b91d73','#00ffff','#ff00ff','#7fff00','#ff8c00','#4b0082','#1a1a2e'];
  function swatchesHtml(onClickFn){
    return PAL.map(c=>`<div class="ccp-swatch" style="background:${c}" onclick="${onClickFn}('${c}')"></div>`).join('');
  }

  // ── GRADIENTS mini ──
  const GRADS = [['#0f2027','#2c5364'],['#c8a96e','#ff6b6b'],['#43e97b','#38f9d7'],['#f7971e','#ffd200'],['#ee0979','#ff6a00'],['#1a1a2e','#16213e'],['#000000','#434343'],['#870000','#190a05'],['#00c6ff','#0072ff'],['#f953c6','#b91d73'],['#4e54c8','#8f94fb'],['#fc4a1a','#f7b733']];
  function gradSwatchesHtml(){
    return GRADS.map((g,i)=>`<div class="ccp-grad-swatch" style="background:linear-gradient(135deg,${g[0]},${g[1]})" onclick="ccpApplyGrad(${i})"></div>`).join('');
  }

  window.ccpApplyGrad = function(i){
    bgType='gradient'; bgGradient.c1=GRADS[i][0]; bgGradient.c2=GRADS[i][1]; bgGradient.dir='to bottom right';
    bgImage=null;
    const g1=document.getElementById('grad1'),g2=document.getElementById('grad2');
    if(g1)g1.value=GRADS[i][0]; if(g2)g2.value=GRADS[i][1];
    redraw(); saveHistory();
  };

  // ── Apply color to selected layer ──
  window.ccpSetColor = function(c){
    if(selectedIndex<0) return;
    const l=layers[selectedIndex];
    if(l.type==='text'){l.color=c;const el=document.getElementById('txtColor');if(el)el.value=c;}
    else if(l.type==='shape'){l.fill=c;const el=document.getElementById('shapeFill');if(el)el.value=c;}
    redraw(); ccpRefresh();
  };

  window.ccpSetStrokeColor = function(c){
    if(selectedIndex<0) return;
    const l=layers[selectedIndex];
    if(l.type==='shape'){l.borderColor=c; redraw();}
    else if(l.type==='text'){l.outlineColor=c; redraw();}
  };

  // ── Font size stepper ──
  window.ccpFontStep = function(delta){
    if(selectedIndex<0||layers[selectedIndex].type!=='text') return;
    const l=layers[selectedIndex];
    l.size=Math.max(8,Math.min(600,(l.size||72)+delta));
    const el=document.getElementById('ccpFontSizeVal');
    if(el) el.textContent=l.size;
    const ts=document.getElementById('txtSize'); if(ts)ts.value=l.size;
    redraw();
  };

  // ── Text style toggle ──
  window.ccpToggleStyle = function(s){
    toggleTextStyle(s);
    ccpRefresh();
  };

  // ── Align shortcut ──
  window.ccpAlign = function(t){ alignLayer(t); };

  // ── BG solid color ──
  window.ccpBgSolid = function(c){
    bgType='solid'; bgSolidColor=c; bgImage=null; redraw();
    const el=document.getElementById('bgColor'); if(el)el.value=c;
  };

  // ── Image filter ──
  window.ccpApplyFilter = function(preset){
    applyImgFilter(preset);
    // update pill highlights
    document.querySelectorAll('.ccp-filter-pill').forEach(p=>p.classList.toggle('active', p.dataset.f===preset));
  };

  // ── Lock aspect toggle ──
  window.ccpToggleLock = function(){
    if(selectedIndex<0) return;
    const id=layers[selectedIndex].id;
    if(!aspectLock[id]) aspectLock[id]=true; else delete aspectLock[id];
    const t=document.getElementById('ccpLockToggle'); if(t) t.classList.toggle('on',!!aspectLock[id]);
  };

  // ── Build pane: TRANSFORM (all types) ──
  function paneTransform(l){
    const rot=l.rotation||0, op=l.opacity??100;
    return `
      <div class="ccp-label">Position & Size</div>
      <div class="ccp-xywh">
        <div class="ccp-field"><label>X</label><input type="number" value="${Math.round(l.x)}" oninput="if(selectedIndex>=0){layers[selectedIndex].x=+this.value;redraw();}"></div>
        <div class="ccp-field"><label>Y</label><input type="number" value="${Math.round(l.y)}" oninput="if(selectedIndex>=0){layers[selectedIndex].y=+this.value;redraw();}"></div>
        <div class="ccp-field"><label>W</label><input type="number" value="${Math.round(l.w)}" oninput="if(selectedIndex>=0){layers[selectedIndex].w=Math.max(1,+this.value);redraw();}"></div>
        <div class="ccp-field"><label>H</label><input type="number" value="${Math.round(l.h)}" oninput="if(selectedIndex>=0){layers[selectedIndex].h=Math.max(1,+this.value);redraw();}"></div>
      </div>
      <div class="ccp-toggle-row">
        <label>Lock Aspect Ratio</label>
        <div class="ccp-toggle${aspectLock[l.id]?' on':''}" id="ccpLockToggle" onclick="ccpToggleLock()"></div>
      </div>
      <div class="ccp-label">Rotation <span id="ccpRotVal">${rot}°</span></div>
      <div class="ccp-slider-row">
        <label>Rotate</label>
        <input type="range" min="-180" max="180" value="${rot}" oninput="if(selectedIndex>=0){layers[selectedIndex].rotation=+this.value;document.getElementById('ccpRotVal').textContent=this.value+'°';redraw();}">
        <span class="ccp-val">${rot}°</span>
      </div>
      <div class="ccp-label">Opacity <span id="ccpOpVal">${op}%</span></div>
      <div class="ccp-slider-row">
        <label>Opacity</label>
        <input type="range" min="0" max="100" value="${op}" oninput="if(selectedIndex>=0){layers[selectedIndex].opacity=+this.value;document.getElementById('ccpOpVal').textContent=this.value+'%';redraw();}">
        <span class="ccp-val">${op}%</span>
      </div>
    `;
  }

  // ── Build pane: FX (all types) ──
  function paneFx(l){
    const blur=l.fxBlur||0, glow=l.glowSize||0, shad=l.shadowBlur||0;
    return `
      <div class="ccp-label">Quick FX</div>
      <div class="ccp-fx-grid">
        <button class="ccp-fx-btn" onclick="quickFx('blur')">💫 Blur</button>
        <button class="ccp-fx-btn" onclick="quickFx('glow')">✨ Glow</button>
        <button class="ccp-fx-btn" onclick="quickFx('shadow')">🌑 Shadow</button>
        <button class="ccp-fx-btn" onclick="quickFx('rotate')">🔄 +15°</button>
        <button class="ccp-fx-btn" onclick="quickFx('fade50')">👁 50% Op</button>
        <button class="ccp-fx-btn" onclick="quickFx('reset')">♻ Reset</button>
      </div>
      <div class="ccp-label">Blur <span>${blur}px</span></div>
      <div class="ccp-slider-row">
        <label>Blur</label>
        <input type="range" min="0" max="40" value="${blur}" oninput="if(selectedIndex>=0){layers[selectedIndex].fxBlur=+this.value;redraw();}">
        <span class="ccp-val">${blur}</span>
      </div>
      <div class="ccp-label">Glow <span>${glow}px</span></div>
      <div class="ccp-slider-row">
        <label>Glow</label>
        <input type="range" min="0" max="60" value="${glow}" oninput="if(selectedIndex>=0){layers[selectedIndex].glowSize=+this.value;layers[selectedIndex].glowColor='#d4af37';redraw();}">
        <span class="ccp-val">${glow}</span>
      </div>
      <div class="ccp-label">Shadow <span>${shad}px</span></div>
      <div class="ccp-slider-row">
        <label>Shadow</label>
        <input type="range" min="0" max="60" value="${shad}" oninput="if(selectedIndex>=0){layers[selectedIndex].shadowBlur=+this.value;layers[selectedIndex].shadowX=4;layers[selectedIndex].shadowY=4;redraw();}">
        <span class="ccp-val">${shad}</span>
      </div>
      <div class="ccp-label">Mask Shape</div>
      <div class="ccp-fx-grid">
        <button class="ccp-fx-btn" onclick="setMask('none')">None</button>
        <button class="ccp-fx-btn" onclick="setMask('circle')">Circle</button>
        <button class="ccp-fx-btn" onclick="setMask('rounded')">Rounded</button>
        <button class="ccp-fx-btn" onclick="setMask('fade-l')">Fade L</button>
        <button class="ccp-fx-btn" onclick="setMask('fade-r')">Fade R</button>
        <button class="ccp-fx-btn" onclick="setMask('fade-all')">Vignette</button>
      </div>
    `;
  }

  // ── Build pane: ARRANGE ──
  function paneArrange(){
    return `
      <div class="ccp-label">Layer Order</div>
      <div class="ccp-arrange-grid">
        <button class="ccp-arrange-btn" onclick="bringToFront()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>Front
        </button>
        <button class="ccp-arrange-btn" onclick="sendToBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 6 12 11 7 6"/><polyline points="17 13 12 18 7 13"/></svg>Back
        </button>
        <button class="ccp-arrange-btn" onclick="moveLayer(-1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>Forward
        </button>
        <button class="ccp-arrange-btn" onclick="moveLayer(1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>Backward
        </button>
        <button class="ccp-arrange-btn" onclick="flipH()">↔ Flip H</button>
        <button class="ccp-arrange-btn" onclick="flipV()">↕ Flip V</button>
        <button class="ccp-arrange-btn" onclick="duplicateSelected()">⧉ Duplicate</button>
        <button class="ccp-arrange-btn" onclick="toggleLockSelected()">🔒 Lock</button>
      </div>
      <div class="ccp-label">Align to Canvas</div>
      <div class="ccp-arrange-grid">
        <button class="ccp-arrange-btn" onclick="ccpAlign('center-h')">⊕ Center H</button>
        <button class="ccp-arrange-btn" onclick="ccpAlign('center-v')">⊕ Center V</button>
        <button class="ccp-arrange-btn" onclick="ccpAlign('left')">⊢ Left</button>
        <button class="ccp-arrange-btn" onclick="ccpAlign('right')">⊣ Right</button>
        <button class="ccp-arrange-btn" onclick="ccpAlign('top')">⊤ Top</button>
        <button class="ccp-arrange-btn" onclick="ccpAlign('bottom')">⊥ Bottom</button>
      </div>
      <div style="margin-top:12px;">
        <button class="ccp-arrange-btn danger" style="width:100%;height:44px;border-radius:10px;" onclick="deleteSelected();ccpClose()">
          🗑 Delete Layer
        </button>
      </div>
    `;
  }

  // ── TEXT panel ──
  function buildTextPanel(l){
    const fonts=['Bebas Neue','Anton','Impact','Montserrat','Oswald','Poppins','Orbitron','Permanent Marker','Pacifico','Lobster','Dancing Script','Bangers'];
    const fontPills=fonts.map(f=>`<button class="ccp-font-pill${l.font===f?' active':''}" style="font-family:'${f}'" onclick="if(selectedIndex>=0){layers[selectedIndex].font='${f}';document.getElementById('txtFont').value='${f}';updateSelectedText();ccpRefresh();}">${f}</button>`).join('');
    const tabs=[
      {label:'Style', html:`
        <div class="ccp-label">Font Size</div>
        <div class="ccp-fontsize-row">
          <label>Size</label>
          <div class="ccp-stepper">
            <button class="ccp-step-btn" onclick="ccpFontStep(-4)">−</button>
            <div class="ccp-step-val" id="ccpFontSizeVal">${l.size||72}</div>
            <button class="ccp-step-btn" onclick="ccpFontStep(4)">+</button>
          </div>
        </div>
        <div class="ccp-label">Text Style</div>
        <div class="ccp-style-row">
          <button class="ccp-style-btn${l.bold?' on':''}" onclick="ccpToggleStyle('bold')"><b>B</b></button>
          <button class="ccp-style-btn${l.italic?' on':''}" onclick="ccpToggleStyle('italic')"><i>I</i></button>
          <button class="ccp-style-btn${l.underline?' on':''}" onclick="ccpToggleStyle('underline')"><u>U</u></button>
          <button class="ccp-style-btn${l.align==='left'?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='left';updateSelectedText();}">⬅</button>
          <button class="ccp-style-btn${l.align==='center'?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='center';updateSelectedText();}">≡</button>
          <button class="ccp-style-btn${l.align==='right'?' on':''}" onclick="if(selectedIndex>=0){layers[selectedIndex].align='right';updateSelectedText();}">➡</button>
        </div>
        <div class="ccp-label">Font</div>
        <div class="ccp-font-scroll">${fontPills}<button class="ccp-font-pill" onclick="document.getElementById('mobileFontModal').classList.add('show')">More…</button></div>
        <div class="ccp-label">Color</div>
        <div class="ccp-color-row">
          <label>Fill</label>
          <input type="color" value="${l.color||'#ffffff'}" oninput="ccpSetColor(this.value)">
          <input type="text" value="${l.color||'#ffffff'}" placeholder="#ffffff" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))ccpSetColor(this.value)">
        </div>
        <div class="ccp-palette">${swatchesHtml('ccpSetColor')}</div>
        <div class="ccp-label">Outline</div>
        <div class="ccp-slider-row">
          <label>Width</label>
          <input type="range" min="0" max="20" value="${l.outlineWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].outlineWidth=+this.value;redraw();}">
          <span class="ccp-val">${l.outlineWidth||0}</span>
        </div>
        <div class="ccp-label">Letter Spacing</div>
        <div class="ccp-slider-row">
          <label>Spacing</label>
          <input type="range" min="-10" max="40" value="${l.letterSpacing||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].letterSpacing=+this.value;redraw();}">
          <span class="ccp-val">${l.letterSpacing||0}</span>
        </div>
      `},
      {label:'Transform', html: paneTransform(l)},
      {label:'FX', html: paneFx(l)},
      {label:'Arrange', html: paneArrange()},
    ];
    return tabs;
  }

  // ── IMAGE panel ──
  function buildImagePanel(l){
    const filterKeys=Object.keys({none:1,bw:1,sepia:1,vivid:1,cold:1,warm:1,invert:1,fade:1,cinema:1,dramatic:1,soft:1});
    const filterPills=filterKeys.map(k=>`<button class="ccp-filter-pill${l.filterPreset===k?' active':''}" data-f="${k}" onclick="ccpApplyFilter('${k}')">${k}</button>`).join('');
    const tabs=[
      {label:'Adjust', html:`
        <div class="ccp-label">Filter</div>
        <div class="ccp-filter-row">${filterPills}</div>
        <div class="ccp-label">Brightness</div>
        <div class="ccp-slider-row">
          <label>Bright</label>
          <input type="range" min="0" max="300" value="${l.brightness||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].brightness=+this.value;redraw();}">
          <span class="ccp-val">${l.brightness||100}</span>
        </div>
        <div class="ccp-label">Contrast</div>
        <div class="ccp-slider-row">
          <label>Contrast</label>
          <input type="range" min="0" max="300" value="${l.contrast||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].contrast=+this.value;redraw();}">
          <span class="ccp-val">${l.contrast||100}</span>
        </div>
        <div class="ccp-label">Saturation</div>
        <div class="ccp-slider-row">
          <label>Saturation</label>
          <input type="range" min="0" max="300" value="${l.saturation||100}" oninput="if(selectedIndex>=0){layers[selectedIndex].saturation=+this.value;redraw();}">
          <span class="ccp-val">${l.saturation||100}</span>
        </div>
        <div class="ccp-label">Blur</div>
        <div class="ccp-slider-row">
          <label>Blur</label>
          <input type="range" min="0" max="40" value="${l.blurFilter||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].blurFilter=+this.value;redraw();}">
          <span class="ccp-val">${l.blurFilter||0}</span>
        </div>
        <div class="ccp-label">Image Border</div>
        <div class="ccp-slider-row">
          <label>Border</label>
          <input type="range" min="0" max="30" value="${l.imgBorderWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].imgBorderWidth=+this.value;redraw();}">
          <span class="ccp-val">${l.imgBorderWidth||0}</span>
        </div>
      `},
      {label:'Transform', html: paneTransform(l)},
      {label:'FX', html: paneFx(l)},
      {label:'Arrange', html: paneArrange()},
    ];
    return tabs;
  }

  // ── SHAPE panel ──
  function buildShapePanel(l){
    const tabs=[
      {label:'Style', html:`
        <div class="ccp-label">Fill Color</div>
        <div class="ccp-color-row">
          <label>Fill</label>
          <input type="color" value="${l.fill||'#c8a96e'}" oninput="ccpSetColor(this.value)">
          <input type="text" value="${l.fill||'#c8a96e'}" placeholder="#c8a96e" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))ccpSetColor(this.value)">
        </div>
        <div class="ccp-palette">${swatchesHtml('ccpSetColor')}</div>
        <div class="ccp-label">Border</div>
        <div class="ccp-slider-row">
          <label>Width</label>
          <input type="range" min="0" max="30" value="${l.borderWidth||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].borderWidth=+this.value;redraw();}">
          <span class="ccp-val">${l.borderWidth||0}</span>
        </div>
        <div class="ccp-label">Corner Radius</div>
        <div class="ccp-slider-row">
          <label>Radius</label>
          <input type="range" min="0" max="200" value="${l.cornerRadius||0}" oninput="if(selectedIndex>=0){layers[selectedIndex].cornerRadius=+this.value;redraw();}">
          <span class="ccp-val">${l.cornerRadius||0}</span>
        </div>
      `},
      {label:'Transform', html: paneTransform(l)},
      {label:'FX', html: paneFx(l)},
      {label:'Arrange', html: paneArrange()},
    ];
    return tabs;
  }

  // ── STICKER/DRAW panel ──
  function buildBasicPanel(l){
    return [
      {label:'Transform', html: paneTransform(l)},
      {label:'FX', html: paneFx(l)},
      {label:'Arrange', html: paneArrange()},
    ];
  }

  // ── BG panel (no layer selected) ──
  function buildBgPanel(){
    return [{
      label:'Background', html:`
        <div class="ccp-label">Gradients</div>
        <div class="ccp-grad-mini">${gradSwatchesHtml()}</div>
        <div class="ccp-label">Solid Color</div>
        <div class="ccp-color-row">
          <label>Color</label>
          <input type="color" value="${bgSolidColor}" oninput="ccpBgSolid(this.value)">
          <input type="text" value="${bgSolidColor}" placeholder="#000000" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))ccpBgSolid(this.value)">
        </div>
      `
    }];
  }

  // ── Main refresh ──
  function ccpRefresh(){
    if(window.innerWidth > 768){ ccpClose(); return; }
    buildPanel();
    const panel = document.getElementById('canvaCtxPanel');
    const tabsEl = document.getElementById('ccpTabs');
    const panesEl = document.getElementById('ccpPanes');
    const badge = document.getElementById('ccpBadge');
    if(!panel||!tabsEl||!panesEl) return;

    let tabs;
    if(selectedIndex >= 0 && layers[selectedIndex]){
      const l = layers[selectedIndex];
      badge.textContent = l.type.toUpperCase();
      if(l.type==='text') tabs=buildTextPanel(l);
      else if(l.type==='image') tabs=buildImagePanel(l);
      else if(l.type==='shape') tabs=buildShapePanel(l);
      else tabs=buildBasicPanel(l);
    } else {
      badge.textContent = 'BG';
      tabs = buildBgPanel();
    }

    tabsEl.innerHTML = tabs.map((t,i)=>`<button class="ccp-tab${i===0?' active':''}" onclick="ccpSwitchTab(${i})">${t.label}</button>`).join('');
    panesEl.innerHTML = tabs.map((t,i)=>`<div class="ccp-pane${i===0?' active':''}">${t.html}</div>`).join('');

    ccpShow();
  }

  // ── Live slider value update helper ──
  function wireLiveVals(){
    document.addEventListener('input', e=>{
      if(!e.target.matches('.ccp-slider-row input[type="range"]')) return;
      const valEl = e.target.nextElementSibling;
      if(valEl && valEl.classList.contains('ccp-val')) valEl.textContent = e.target.value;
    });
  }

  // ── Hook into existing updateMobileQuickActions ──
  const _origUpdate = window.updateMobileQuickActions;
  window.updateMobileQuickActions = function(){
    if(typeof _origUpdate==='function') _origUpdate.apply(this, arguments);
    if(window.innerWidth <= 768) ccpRefresh();
  };

  // ── Also hook canvas click (deselect → show BG panel) ──
  // We wait for load then patch mousedown/touchend
  window.addEventListener('load', ()=>{
    wireLiveVals();
    buildPanel();
    // Patch: after any redraw that changes selection, refresh panel
    const _origRedraw = window.redraw;
    if(typeof _origRedraw==='function'){
      let _lastIdx = -99;
      window.redraw = function(){
        _origRedraw.apply(this, arguments);
        if(window.innerWidth<=768 && selectedIndex!==_lastIdx){
          _lastIdx=selectedIndex;
          ccpRefresh();
        }
      };
    }
  });

})();
