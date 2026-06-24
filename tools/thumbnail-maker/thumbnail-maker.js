// ===================== STATE =====================
const canvas = document.getElementById('mainCanvas');
let ctx = canvas.getContext('2d');
let scale = 0.6, layers = [], selectedIndex = -1;
let historyStack = [], redoStack = [];
let bgType = 'gradient', bgSolidColor = '#1a1a2e';
let bgGradient = { c1:'#0d0d0d', c2:'#1a0533', c3:null, dir:'to bottom right', angle:135 };
let bgImage = null;
let isDragging = false, dragOffX = 0, dragOffY = 0;
let isResizing = false, resizeHandle = '';
let isRotating = false, rotateStartAngle = 0, rotateStartRotation = 0;
let canvasW = 1280, canvasH = 720;
let aspectLock = {};

// ===================== BRUSH STATE =====================
let drawingMode = false, isPainting = false, lastPaintPos = null;
let brushSettings = {type:'pencil', color:'#ffffff', size:20, opacity:100};
const BRUSH_TYPES = [
  {id:'pencil',label:'✏️ Pencil'},
  {id:'marker',label:'🖊 Marker'},
  {id:'highlighter',label:'🖍 Highlighter'},
  {id:'neon',label:'✨ Neon Glow'},
  {id:'spray',label:'🎨 Spray'},
  {id:'eraser',label:'🧹 Eraser'},
];

// ===================== ALL FONTS (42) =====================
const ALL_FONTS = [
  // Impact / Display
  {name:'Bebas Neue',label:'BEBAS',cat:'display'},
  {name:'Anton',label:'ANTON',cat:'display'},
  {name:'Barlow Condensed',label:'Barlow C',cat:'display'},
  {name:'Impact',label:'Impact',cat:'display'},
  {name:'Black Han Sans',label:'Black Han',cat:'display'},
  {name:'Bungee',label:'Bungee',cat:'display'},
  {name:'Teko',label:'Teko',cat:'display'},
  {name:'Alfa Slab One',label:'Alfa Slab',cat:'display'},
  {name:'Fjalla One',label:'Fjalla',cat:'display'},
  {name:'Bangers',label:'Bangers',cat:'display'},
  {name:'Passion One',label:'Passion',cat:'display'},
  {name:'Bowlby One SC',label:'Bowlby',cat:'display'},
  {name:'Squada One',label:'Squada',cat:'display'},
  {name:'Titan One',label:'Titan',cat:'display'},
  {name:'Luckiest Guy',label:'Lucky',cat:'display'},
  // Modern / Clean
  {name:'Montserrat',label:'Montserrat',cat:'modern'},
  {name:'Oswald',label:'Oswald',cat:'modern'},
  {name:'Rajdhani',label:'Rajdhani',cat:'modern'},
  {name:'Exo 2',label:'Exo 2',cat:'modern'},
  {name:'Chakra Petch',label:'Chakra',cat:'modern'},
  {name:'Russo One',label:'Russo',cat:'modern'},
  {name:'Righteous',label:'Righteous',cat:'modern'},
  {name:'Poppins',label:'Poppins',cat:'modern'},
  {name:'Archivo Black',label:'Archivo B',cat:'modern'},
  {name:'Fredoka',label:'Fredoka',cat:'modern'},
  {name:'Inter',label:'Inter',cat:'modern'},
  {name:'Arial',label:'Arial',cat:'modern'},
  // Futuristic / Tech
  {name:'Orbitron',label:'Orbitron',cat:'tech'},
  {name:'Press Start 2P',label:'Pixel',cat:'tech'},
  {name:'Audiowide',label:'Audiowide',cat:'tech'},
  {name:'Monoton',label:'Monoton',cat:'tech'},
  // Elegant / Serif
  {name:'Playfair Display',label:'Playfair',cat:'serif'},
  {name:'Cormorant Garamond',label:'Cormorant',cat:'serif'},
  {name:'Georgia',label:'Georgia',cat:'serif'},
  // Handwritten / Fun
  {name:'Permanent Marker',label:'Marker',cat:'hand'},
  {name:'Pacifico',label:'Pacifico',cat:'hand'},
  {name:'Lobster',label:'Lobster',cat:'hand'},
  {name:'Dancing Script',label:'Dancing',cat:'hand'},
  {name:'Caveat',label:'Caveat',cat:'hand'},
  {name:'Indie Flower',label:'Indie Flower',cat:'hand'},
  {name:'Kalam',label:'Kalam',cat:'hand'},
  {name:'Amatic SC',label:'Amatic',cat:'hand'},
  {name:'Comfortaa',label:'Comfortaa',cat:'hand'},
];

// ===================== GRADIENTS =====================
const GRADIENTS = [
  ['#0f2027','#2c5364'],['#c8a96e','#ff6b6b'],['#43e97b','#38f9d7'],
  ['#f7971e','#ffd200'],['#ee0979','#ff6a00'],['#1a1a2e','#16213e'],
  ['#000000','#434343'],['#870000','#190a05'],['#00c6ff','#0072ff'],
  ['#f953c6','#b91d73'],['#11998e','#38ef7d'],['#fc4a1a','#f7b733'],
  ['#4e54c8','#8f94fb'],['#0575e6','#021b79'],['#ff416c','#ff4b2b'],
  ['#a8ff78','#78ffd6'],['#1c1c2e','#5c5c8a'],['#2b5876','#4e4376'],
  ['#373b44','#4286f4'],['#f12711','#f5af19'],['#0d0d0d','#1a0533'],
  ['#0a0a0a','#1a1a2e'],['#0c3483','#a2b6df'],['#6a3093','#a044ff'],
];

const QUICK_PALETTE = [
  '#ffffff','#000000','#ff0000','#ff6b6b','#ff3300','#ffcc00','#ffd200',
  '#00ff88','#43e97b','#00c6ff','#0072ff','#c8a96e','#e8c98e',
  '#f953c6','#b91d73','#870000','#1a1a2e','#ff6a00','#ee0979',
  '#00ffff','#ff00ff','#7fff00','#ff8c00','#8b0000','#4b0082',
];

const BG_QUICK = [
  '#000000','#111118','#1a1a2e','#0f0f0f','#16213e','#0d1117',
  '#1e0a2e','#0a1628','#1a0000','#001a00','#0a0a1a','#2d1b00',
];

// ===================== TEMPLATES (24) =====================
const TEMPLATES = [
  {name:'Dark Drama',bg:['#0d0d0d','#1a0533'],txt:'YOUR TITLE',txtColor:'#ffffff',font:'Bebas Neue',size:96},
  {name:'Neon Gold',bg:['#000000','#1a0a2e'],txt:'CLICK NOW',txtColor:'#c8a96e',font:'Impact',size:100},
  {name:'Fire Red',bg:['#870000','#fc4a1a'],txt:'AMAZING',txtColor:'#ffffff',font:'Bebas Neue',size:110},
  {name:'Ocean',bg:['#00c6ff','#0072ff'],txt:'EXPLORE',txtColor:'#ffffff',font:'Montserrat',size:80},
  {name:'Gold Rush',bg:['#f7971e','#ffd200'],txt:'EPIC',txtColor:'#1a1000',font:'Bebas Neue',size:120},
  {name:'Matrix',bg:['#000000','#003300'],txt:'TUTORIAL',txtColor:'#00ff41',font:'Rajdhani',size:88},
  {name:'Purple Night',bg:['#4e54c8','#8f94fb'],txt:'NEW VIDEO',txtColor:'#ffffff',font:'Anton',size:90},
  {name:'Sunset',bg:['#ff416c','#ff4b2b'],txt:'WATCH NOW',txtColor:'#ffffff',font:'Barlow Condensed',size:92},
  {name:'Cyber',bg:['#0575e6','#021b79'],txt:'LEVEL UP',txtColor:'#00ffff',font:'Orbitron',size:72},
  {name:'Rose',bg:['#f953c6','#b91d73'],txt:'MUST SEE',txtColor:'#ffffff',font:'Pacifico',size:82},
  {name:'Dark Minimal',bg:['#111118','#1c1c26'],txt:'How I Did It',txtColor:'#c8a96e',font:'Cormorant Garamond',size:88},
  {name:'Viral',bg:['#1a1a1a','#2a0a0a'],txt:"WON'T BELIEVE",txtColor:'#ff3333',font:'Impact',size:86},
  {name:'Emerald',bg:['#11998e','#38ef7d'],txt:'SECRET TIPS',txtColor:'#fff',font:'Oswald',size:88},
  {name:'Midnight',bg:['#0c3483','#a2b6df'],txt:'THE TRUTH',txtColor:'#fff',font:'Anton',size:94},
  {name:'Retro Orange',bg:['#fc4a1a','#f7b733'],txt:'OLD SCHOOL',txtColor:'#fff',font:'Bungee',size:80},
  {name:'Deep Purple',bg:['#6a3093','#a044ff'],txt:'MINDBLOWN',txtColor:'#fff',font:'Exo 2',size:82},
  {name:'Comic Pop',bg:['#fff700','#ff2d2d'],txt:'POW!',txtColor:'#000',font:'Bangers',size:140},
  {name:'Elegant White',bg:['#e8e8e8','#ffffff'],txt:'Prestige',txtColor:'#111',font:'Playfair Display',size:88},
  {name:'Neon Cyan',bg:['#000000','#003333'],txt:'NEXT LEVEL',txtColor:'#00ffff',font:'Audiowide',size:76},
  {name:'Warm Earth',bg:['#2b1b0e','#6b3a1f'],txt:'Raw Insight',txtColor:'#e8c98e',font:'Cormorant Garamond',size:84},
  {name:'Ice Blue',bg:['#e0f7fa','#006064'],txt:'COOL TIPS',txtColor:'#fff',font:'Montserrat',size:80},
  {name:'Pixel Game',bg:['#000011','#110022'],txt:'GAME ON',txtColor:'#ff00ff',font:'Press Start 2P',size:48},
  {name:'Marker Pop',bg:['#fffde7','#fff9c4'],txt:'Quick Tips!',txtColor:'#222',font:'Permanent Marker',size:88},
  {name:'Dark Teal',bg:['#004d40','#00251a'],txt:'MASTER IT',txtColor:'#64ffda',font:'Oswald',size:90},
];

// ===================== STICKERS (50) =====================
const STICKERS = [
  '🔥','⚡','💥','👑','🎯','❤️','💎','🚀','⭐','🎮',
  '💰','🎬','✅','❌','🏆','📢','🎁','💡','🔑','🌟',
  '😱','🤯','💪','🎉','🔴','🟢','🟡','🌈','☠️','👀',
  '🤑','🔔','📌','⚠️','✨','🎸','🏅','🎖️','🧨','💫',
  '😂','🙏','🤝','🦾','🧠','🎤','📱','💻','🌍','🕹️',
];

// ===================== BADGE DATA =====================
const BADGE_DATA = {
  new:{text:'NEW',color:'#00ff88',bg:'#003322'},
  hot:{text:'🔥 HOT',color:'#ffffff',bg:'#cc2200'},
  free:{text:'FREE',color:'#ffffff',bg:'#007700'},
  pro:{text:'PRO',color:'#000000',bg:'#c8a96e'},
  sale:{text:'SALE',color:'#ffffff',bg:'#cc0044'},
  viral:{text:'⚡VIRAL',color:'#000000',bg:'#ffdd00'},
  subscribe:{text:'🔔 SUBSCRIBE',color:'#fff',bg:'#cc0000'},
  live:{text:'🔴 LIVE',color:'#fff',bg:'#ff0000'},
  breaking:{text:'BREAKING',color:'#fff',bg:'#cc2200'},
  exclusive:{text:'★ EXCLUSIVE',color:'#fff',bg:'#333'},
  part1:{text:'PART 1',color:'#fff',bg:'#0055cc'},
  limited:{text:'⏳ LIMITED',color:'#fff',bg:'#772200'},
};

// ===================== IMG FILTER PRESETS =====================
const IMG_FILTERS = {
  none:{brightness:100,contrast:100,saturation:100,hueRotate:0,sepia:0,grayscale:0,blurFilter:0},
  bw:{brightness:100,contrast:120,saturation:0,hueRotate:0,sepia:0,grayscale:100,blurFilter:0},
  sepia:{brightness:110,contrast:100,saturation:70,hueRotate:0,sepia:80,grayscale:0,blurFilter:0},
  vivid:{brightness:110,contrast:130,saturation:200,hueRotate:0,sepia:0,grayscale:0,blurFilter:0},
  cold:{brightness:100,contrast:110,saturation:90,hueRotate:200,sepia:0,grayscale:0,blurFilter:0},
  warm:{brightness:115,contrast:105,saturation:120,hueRotate:10,sepia:20,grayscale:0,blurFilter:0},
  invert:{brightness:100,contrast:100,saturation:100,hueRotate:180,sepia:0,grayscale:0,blurFilter:0},
  fade:{brightness:130,contrast:70,saturation:60,hueRotate:0,sepia:10,grayscale:0,blurFilter:0},
  cinema:{brightness:90,contrast:130,saturation:80,hueRotate:0,sepia:15,grayscale:0,blurFilter:0},
  highcon:{brightness:100,contrast:200,saturation:100,hueRotate:0,sepia:0,grayscale:0,blurFilter:0},
  dramatic:{brightness:80,contrast:160,saturation:70,hueRotate:0,sepia:10,grayscale:0,blurFilter:0},
  soft:{brightness:120,contrast:80,saturation:90,hueRotate:0,sepia:5,grayscale:0,blurFilter:1},
};

// ===================== INIT =====================
function init() {
  applyCanvasScale();
  buildGradGrid(); buildTemplateGrid(); buildFontGrid(); buildMobileFontGrid();
  buildQuickPalette(); buildStickerGrid(); buildBrushUI();
  populateFontSelect();
  setupMouseEvents();
  setupTouchZoomAndPan();
  enhanceSliders();
  redraw(); updateLayerList();
  updateMobileQuickActions();
}

// ===================== ENHANCE SLIDERS: add manual number input next to every range slider =====================
function enhanceSliders() {
  document.querySelectorAll('input[type="range"]').forEach(range => {
    if(range.dataset.enhanced) return;
    range.dataset.enhanced='1';
    // Skip image section — already has adj-num box in HTML
    if(range.classList.contains('adj-slider')) return;
    // Hide inline-val span to avoid duplicate value display
    const prev = range.previousElementSibling;
    if(prev && prev.classList.contains('inline-lv')) {
      const span = prev.querySelector('.inline-val');
      if(span) span.style.display='none';
    }
    const num=document.createElement('input');
    num.type='number';
    num.className='range-num-input';
    num.min=range.min; num.max=range.max; num.step=range.step||1;
    num.value=range.value;
    const wrap=document.createElement('div');
    wrap.className='range-num-wrap';
    range.parentNode.insertBefore(wrap, range);
    wrap.appendChild(range);
    wrap.appendChild(num);
    num.addEventListener('input', () => {
      let v=parseFloat(num.value);
      if(isNaN(v)) return;
      const min=range.min!==''?parseFloat(range.min):-Infinity;
      const max=range.max!==''?parseFloat(range.max):Infinity;
      if(v<min)v=min; if(v>max)v=max;
      range.value=v;
      range.dispatchEvent(new Event('input',{bubbles:true}));
    });
    range.addEventListener('input', () => { num.value=range.value; });
  });
}

function buildStickerGrid() {
  ['stickerGrid','stickerPickerGrid'].forEach(gid=>{
    const g = document.getElementById(gid);
    if(!g)return;
    STICKERS.forEach(e => {
      const b = document.createElement('button');
      b.className = 'sticker-btn'; b.textContent = e;
      b.style.fontSize='20px';
      b.onclick = () => { addSticker(e); closeModal('stickerModal'); };
      g.appendChild(b);
    });
  });
}
function openStickerPicker(){openModal('stickerModal');}

function populateFontSelect() {
  const sel = document.getElementById('txtFont');
  const groups = {display:'Display / Impact',modern:'Modern / Clean',tech:'Futuristic / Tech',serif:'Elegant / Serif',hand:'Handwritten / Fun'};
  Object.entries(groups).forEach(([k,label]) => {
    const og = document.createElement('optgroup'); og.label = label;
    ALL_FONTS.filter(f=>f.cat===k).forEach(f => {
      const o = document.createElement('option'); o.value = f.name; o.textContent = f.name;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.value = 'Montserrat';
}

function buildFontGrid() {
  const g = document.getElementById('fontGrid');
  // Show first 16 fonts as preview tiles
  ALL_FONTS.slice(0,16).forEach(f => createFontBtn(f, g));
}

function createFontBtn(f, container) {
  const btn = document.createElement('button');
  btn.className = 'font-preview-btn';
  btn.style.fontFamily = `"${f.name}"`;
  btn.dataset.fontName = f.name;
  btn.innerHTML = `${f.label}<small>${f.name}</small>`;
  btn.onclick = () => {
    document.getElementById('txtFont').value = f.name;
    updateSelectedText();
    document.querySelectorAll('.font-preview-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  };
  container.appendChild(btn);
  return btn;
}

function buildMobileFontGrid() {
  const g = document.getElementById('mobileFontGrid');
  ALL_FONTS.forEach(f => createFontBtn(f, g));
}

function filterFonts() {
  const q = document.getElementById('fontSearch').value.toLowerCase();
  const g = document.getElementById('fontGrid');
  g.innerHTML = '';
  ALL_FONTS.filter(f=>!q||f.name.toLowerCase().includes(q)||f.label.toLowerCase().includes(q)).slice(0,16).forEach(f=>createFontBtn(f,g));
}

function filterMobileFonts(q) {
  const g = document.getElementById('mobileFontGrid');
  g.innerHTML = '';
  ALL_FONTS.filter(f=>!q||f.name.toLowerCase().includes(q.toLowerCase())).forEach(f=>createFontBtn(f,g));
}

function buildQuickPalette() {
  const p = document.getElementById('quickPalette');
  QUICK_PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className='color-swatch'; s.style.background=c;
    s.onclick = () => {
      if(selectedIndex<0) return;
      const l = layers[selectedIndex];
      if(l.type==='shape'){l.fill=c;document.getElementById('shapeFill').value=c;document.getElementById('shapeFillHex').value=c;}
      else if(l.type==='text'){l.color=c;document.getElementById('txtColor').value=c;document.getElementById('txtColorHex').value=c;}
      redraw();
    };
    p.appendChild(s);
  });
  // BG quick colors
  const bg = document.getElementById('bgQuickColors');
  BG_QUICK.forEach(c => {
    const s = document.createElement('div');
    s.className='color-swatch'; s.style.background=c;
    s.onclick = () => {bgSolidColor=c;bgType='solid';bgImage=null;document.getElementById('bgColor').value=c;document.getElementById('bgColorHex').value=c;document.getElementById('bgImgOptions').style.display='none';redraw();};
    bg.appendChild(s);
  });
  // Mobile palette
  const mp = document.getElementById('mobilePalette');
  QUICK_PALETTE.forEach(c => {
    const s = document.createElement('div');
    s.className='color-swatch'; s.style.background=c;
    s.onclick = () => mobileSetFill(c);
    mp.appendChild(s);
  });
}

// ===================== CANVAS SCALE =====================
function applyCanvasScale() {
  const wrapper = document.getElementById('canvasWrapper');
  wrapper.style.width = (canvasW*scale)+'px'; wrapper.style.height = (canvasH*scale)+'px';
  canvas.style.width = (canvasW*scale)+'px'; canvas.style.height = (canvasH*scale)+'px';
  canvas.width = canvasW; canvas.height = canvasH;
  const pct = Math.round(scale*100)+'%';
  document.getElementById('zoomLabel').textContent = pct;
  document.getElementById('zoomLabel2').textContent = pct;
  document.getElementById('canvasInfo').textContent = canvasW+'×'+canvasH;
  document.getElementById('canvasInfo2').textContent = canvasW+' × '+canvasH+' px';
  const ci3=document.getElementById('canvasInfo3');if(ci3)ci3.textContent=canvasW+' × '+canvasH+' px';
  const az=document.getElementById('appZoomLabel'); if(az) az.textContent=pct;
  const af=document.getElementById('appFormatLabel'); if(af) af.textContent=canvasW+'×'+canvasH;
  redraw(); // changing canvas.width/height clears the buffer - always redraw after
}

function setPlatform(btn,w,h) {
  document.querySelectorAll('.plat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  canvasW=w; canvasH=h;
  document.getElementById('cw').value=w; document.getElementById('ch').value=h;
  document.getElementById('formatLabel').textContent=w+'×'+h;
  fitCanvas();
  closeModal('formatModal');
}
function applyCustom() {
  canvasW=parseInt(document.getElementById('cw').value)||1280;
  canvasH=parseInt(document.getElementById('ch').value)||720;
  document.querySelectorAll('.plat-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('formatLabel').textContent=canvasW+'×'+canvasH;
  fitCanvas();
  closeModal('formatModal');
}
function openModal(id){document.getElementById(id).classList.add('show');}
function closeModal(id){document.getElementById(id).classList.remove('show');}
function zoom(delta) { scale=Math.max(0.08,Math.min(2,scale+delta)); applyCanvasScale(); }
function fitCanvas() {
  const area=document.getElementById('canvasArea');
  const aw=area.clientWidth-40, ah=area.clientHeight-40;
  if(aw<=10||ah<=10){scale=0.5;applyCanvasScale();return;}
  const sw=aw/canvasW, sh=ah/canvasH;
  scale=Math.max(0.05,Math.min(sw,sh,1)); applyCanvasScale();
}

// ===================== REDRAW =====================
function redraw() {
  ctx.clearRect(0,0,canvasW,canvasH);
  drawBackground();
  const mainCtx = ctx;
  layers.forEach((layer,i) => {
    if(!layer.visible) return;
    const mask = layer.mask||'none';
    const isFadeMask = mask.indexOf('fade')===0;
    let off=null;
    if(isFadeMask){
      off=document.createElement('canvas');off.width=canvasW;off.height=canvasH;
      ctx=off.getContext('2d');
    }
    ctx.save();
    const op=(layer.opacity!=null?layer.opacity:100)/100;
    ctx.globalAlpha=op;
    if(!isFadeMask && layer.blendMode && layer.blendMode!=='source-over') ctx.globalCompositeOperation=layer.blendMode;
    applyLayerTransform(layer);

    // Apply blur via filter (gaussian only for shapes/stickers, image has its own)
    if(layer.fxBlur>0 && layer.type!=='image') ctx.filter=`blur(${layer.fxBlur}px)`;

    // Apply drop shadow from FX
    if(layer.shadowBlur>0) {
      const sOp=(layer.fxShadowOpacity!=null?layer.fxShadowOpacity:80)/100;
      ctx.shadowColor=hexToRgba(layer.shadowColor||'#000000',sOp);
      ctx.shadowBlur=layer.shadowBlur;
      ctx.shadowOffsetX=layer.shadowX||0; ctx.shadowOffsetY=layer.shadowY||0;
    }
    if(layer.glowSize>0 && layer.type==='shape') {
      const glowAlpha=(layer.glowIntensity!=null?layer.glowIntensity:50)/100;
      ctx.shadowColor=hexToRgba(layer.glowColor||'#ffffff',glowAlpha); ctx.shadowBlur=layer.glowSize;
    }

    // Clip-based masks (shape crops)
    if(mask==='circle'||mask==='rounded'||mask==='ellipse') applyMaskClip(layer);

    if(layer.type==='text') drawText(layer);
    else if(layer.type==='image') drawImage(layer);
    else if(layer.type==='shape') drawShape(layer);
    else if(layer.type==='sticker') drawSticker(layer);
    else if(layer.type==='draw'&&layer.drawCanvas) ctx.drawImage(layer.drawCanvas,layer.x,layer.y,layer.w,layer.h);

    ctx.restore();

    if(isFadeMask){
      applyFadeGradientMask(ctx, layer, mask);
      ctx=mainCtx;
      ctx.save();
      ctx.globalCompositeOperation = layer.blendMode||'source-over';
      ctx.drawImage(off,0,0);
      ctx.restore();
    }

    if(i===selectedIndex) drawSelection(layer);
  });
  // Canvas border
  const cbw = parseInt(document.getElementById('canvasBorderWidth').value)||0;
  if(cbw>0) {
    ctx.save();
    ctx.strokeStyle=document.getElementById('canvasBorderColor').value;
    ctx.lineWidth=cbw*2;
    ctx.strokeRect(0,0,canvasW,canvasH);
    ctx.restore();
  }

  // Smart Snapping Alignment Guides
  if (selectedIndex >= 0 && isDragging) {
    const l = layers[selectedIndex];
    if (l.snappedX || l.snappedY) {
      ctx.save();
      ctx.strokeStyle = '#c084fc'; // Beautiful purple snap guide
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);

      if (l.snappedX) {
        ctx.beginPath();
        ctx.moveTo(canvasW / 2, 0);
        ctx.lineTo(canvasW / 2, canvasH);
        ctx.stroke();
      }
      if (l.snappedY) {
        ctx.beginPath();
        ctx.moveTo(0, canvasH / 2);
        ctx.lineTo(canvasW, canvasH / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function applyLayerTransform(layer) {
  const cx=layer.x+layer.w/2, cy=layer.y+layer.h/2;
  ctx.translate(cx,cy);
  if(layer.rotation) ctx.rotate(layer.rotation*Math.PI/180);
  if(layer.skewX||layer.skewY) {
    const mat=new DOMMatrix([1,Math.tan((layer.skewY||0)*Math.PI/180),Math.tan((layer.skewX||0)*Math.PI/180),1,0,0]);
    ctx.transform(mat.a,mat.b,mat.c,mat.d,0,0);
  }
  ctx.translate(-cx,-cy);
}

// ===================== MASK CLIP (shape crops) =====================
function applyMaskClip(layer) {
  const {x,y,w,h,mask} = layer;
  if(mask==='circle'){ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2,0,Math.PI*2);ctx.clip();}
  else if(mask==='rounded'){ctx.beginPath();const r=Math.min(40,w/4,h/4);ctx.roundRect(x,y,w,h,r);ctx.clip();}
  else if(mask==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.clip();}
}

// ===================== FADE / VIGNETTE MASK (gradient-based) =====================
function applyFadeGradientMask(octx, layer, mask) {
  const {x,y,w,h}=layer;
  const fadePct=(layer.maskFadeSize!=null?layer.maskFadeSize:30)/100;
  octx.save();
  octx.globalCompositeOperation='destination-in';
  let grad;
  if(mask==='fade-l'){grad=octx.createLinearGradient(x,0,x+w*fadePct,0);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');}
  else if(mask==='fade-r'){grad=octx.createLinearGradient(x+w,0,x+w-w*fadePct,0);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');}
  else if(mask==='fade-t'){grad=octx.createLinearGradient(0,y,0,y+h*fadePct);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');}
  else if(mask==='fade-b'){grad=octx.createLinearGradient(0,y+h,0,y+h-h*fadePct);grad.addColorStop(0,'rgba(0,0,0,0)');grad.addColorStop(1,'rgba(0,0,0,1)');}
  else if(mask==='fade-all'){
    const cx=x+w/2,cy=y+h/2,maxR=Math.max(w,h)/2;
    grad=octx.createRadialGradient(cx,cy,Math.max(0,maxR*(1-fadePct)),cx,cy,maxR);
    grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');
  }
  if(grad){octx.fillStyle=grad;octx.fillRect(0,0,canvasW,canvasH);}
  octx.restore();
}

// ===================== BACKGROUND =====================
function drawBackground() {
  if(bgImage) {
    const fit=document.getElementById('bgFit').value;
    const dim=parseInt(document.getElementById('bgDim').value)/100;
    const bright=parseInt(document.getElementById('bgBright').value)/100;
    const blurPx=parseInt(document.getElementById('bgBlur').value)||0;
    const sat=parseInt(document.getElementById('bgSat').value)/100;
    ctx.save();
    let fStr='';
    if(blurPx>0) fStr+=`blur(${blurPx}px) `;
    if(bright!==1) fStr+=`brightness(${bright}) `;
    if(sat!==1) fStr+=`saturate(${sat}) `;
    if(fStr) ctx.filter=fStr.trim();
    if(fit==='cover'){const sc=Math.max(canvasW/bgImage.width,canvasH/bgImage.height);const dw=bgImage.width*sc,dh=bgImage.height*sc;ctx.drawImage(bgImage,(canvasW-dw)/2,(canvasH-dh)/2,dw,dh);}
    else if(fit==='contain'){const sc=Math.min(canvasW/bgImage.width,canvasH/bgImage.height);const dw=bgImage.width*sc,dh=bgImage.height*sc;ctx.fillStyle='#000';ctx.fillRect(0,0,canvasW,canvasH);ctx.drawImage(bgImage,(canvasW-dw)/2,(canvasH-dh)/2,dw,dh);}
    else {ctx.drawImage(bgImage,0,0,canvasW,canvasH);}
    ctx.filter='none';
    if(dim>0){ctx.fillStyle=`rgba(0,0,0,${dim})`;ctx.fillRect(0,0,canvasW,canvasH);}
    ctx.restore();
    applyBgOverlay(); return;
  }
  if(bgType==='solid'){ctx.fillStyle=bgSolidColor;ctx.fillRect(0,0,canvasW,canvasH);}
  else {
    const angle=(parseInt(document.getElementById('gradAngle').value)||135)*Math.PI/180;
    const cx2=canvasW/2,cy2=canvasH/2;
    const len=Math.sqrt(canvasW*canvasW+canvasH*canvasH)/2;
    const dir=bgGradient.dir;
    let grad;
    if(dir==='radial') grad=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,Math.max(canvasW,canvasH)/2);
    else if(dir==='conic') grad=ctx.createRadialGradient(cx2,cy2,0,cx2,cy2,Math.max(canvasW,canvasH)/2);
    else {
      const dirs={'to right':[0,cy2,canvasW,cy2],'to bottom':[cx2,0,cx2,canvasH],'to bottom right':[0,0,canvasW,canvasH],'to bottom left':[canvasW,0,0,canvasH]};
      const d=dirs[dir]||[cx2-Math.cos(angle)*len,cy2-Math.sin(angle)*len,cx2+Math.cos(angle)*len,cy2+Math.sin(angle)*len];
      grad=ctx.createLinearGradient(...d);
    }
    grad.addColorStop(0,bgGradient.c1);
    if(bgGradient.c3){grad.addColorStop(0.5,bgGradient.c2);grad.addColorStop(1,bgGradient.c3);}
    else grad.addColorStop(1,bgGradient.c2);
    ctx.fillStyle=grad; ctx.fillRect(0,0,canvasW,canvasH);
  }
  applyBgOverlay();
}

function applyBgOverlay() {
  const ovOp=parseInt(document.getElementById('bgOverlayOp').value)||0;
  if(ovOp>0){ctx.fillStyle=hexToRgba(document.getElementById('bgOverlayColor').value,ovOp/100);ctx.fillRect(0,0,canvasW,canvasH);}
}

function hexToRgba(hex,a){
  if(!hex||hex.length<7) return `rgba(0,0,0,${a})`;
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ===================== DRAW TEXT =====================
function drawText(layer) {
  const isItalic = layer.italic ? 'italic ' : '';
  const weight = layer.fontWeight||'700';
  const family = layer.font||'Montserrat';
  const rawText = layer.text||'Text';
  const text = layer.allcaps ? rawText.toUpperCase() : rawText;
  const lines = text.split('\n');
  const lh = layer.lineH||1.2;
  const lineGap = layer.size*lh;
  const totalH = lineGap*lines.length;
  const startY = layer.y+layer.h/2-totalH/2+lineGap/2;

  ctx.font=`${isItalic}${weight} ${layer.size}px "${family}"`;
  ctx.textAlign=layer.align||'center';
  ctx.textBaseline='middle';
  if(layer.letterSpacing) ctx.letterSpacing=(layer.letterSpacing||0)+'px';
  const tx = layer.align==='left'?layer.x : layer.align==='right'?layer.x+layer.w : layer.x+layer.w/2;

  // BG box behind text
  if(layer.bgBox) {
    const pad = layer.bgBoxPad||10;
    const r2 = layer.bgBoxRadius||0;
    ctx.save();
    ctx.fillStyle = layer.bgBoxColor||'#ffff00';
    lines.forEach((line,li) => {
      const ty = startY+li*lineGap;
      const metrics = ctx.measureText(line);
      const bx = layer.align==='center'?tx-metrics.width/2 : layer.align==='right'?tx-metrics.width:tx;
      ctx.beginPath();
      if(r2>0) ctx.roundRect(bx-pad, ty-layer.size/2-pad, metrics.width+pad*2, layer.size+pad*2, r2);
      else ctx.rect(bx-pad, ty-layer.size/2-pad, metrics.width+pad*2, layer.size+pad*2);
      ctx.fill();
    });
    ctx.restore();
  }

  // Glow
  if(layer.glowSize>0){ctx.shadowColor=layer.glowColor||'#fff';ctx.shadowBlur=layer.glowSize;}
  // Shadow
  if(layer.shadow>0){ctx.shadowColor=hexToRgba(layer.shadowColor||'#000',0.85);ctx.shadowBlur=layer.shadow;ctx.shadowOffsetX=layer.shadowX||2;ctx.shadowOffsetY=layer.shadowY||2;}

  lines.forEach((line,li) => {
    const ty = startY+li*lineGap;
    // Outline stroke
    if(layer.outlineWidth>0 && layer.strokeEnabled!==false){
      ctx.strokeStyle=layer.outlineColor||'#000';
      ctx.lineWidth=layer.outlineWidth*2;ctx.lineJoin='round';
      ctx.strokeText(line,tx,ty);
    }
    // Fill
    if(layer.fillEnabled===false){/* skip fill */}
    else {
      const fillType = layer.txtFillType||'solid';
      if(fillType==='transparent'){/* skip fill */}
      else if(fillType==='gradient'&&layer.grad1&&layer.grad2){
        const dirs={'to right':[layer.x,ty,layer.x+layer.w,ty],'to bottom':[tx,layer.y,tx,layer.y+layer.h],'to bottom right':[layer.x,layer.y,layer.x+layer.w,layer.y+layer.h]};
        const d=dirs[layer.txtGradDir||'to right']||[layer.x,ty,layer.x+layer.w,ty];
        const grd=ctx.createLinearGradient(...d);
        grd.addColorStop(0,layer.grad1); grd.addColorStop(1,layer.grad2);
        ctx.fillStyle=grd;
      } else {ctx.fillStyle=layer.color||'#ffffff';}
      if(fillType!=='transparent') ctx.fillText(line,tx,ty);
    }

    // Underline
    if(layer.underline){const m=ctx.measureText(line);const ux=layer.align==='center'?tx-m.width/2:layer.align==='right'?tx-m.width:tx;ctx.beginPath();ctx.strokeStyle=layer.color||'#fff';ctx.lineWidth=Math.max(1,layer.size/20);ctx.moveTo(ux,ty+layer.size*.6);ctx.lineTo(ux+m.width,ty+layer.size*.6);ctx.stroke();}
    // Strikethrough
    if(layer.strikethrough){const m=ctx.measureText(line);const ux=layer.align==='center'?tx-m.width/2:layer.align==='right'?tx-m.width:tx;ctx.beginPath();ctx.strokeStyle=layer.color||'#fff';ctx.lineWidth=Math.max(1,layer.size/20);ctx.moveTo(ux,ty);ctx.lineTo(ux+m.width,ty);ctx.stroke();}
  });
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.letterSpacing='0px';
}

// ===================== DRAW IMAGE =====================
function drawImage(layer) {
  if(!layer.img) return;
  ctx.save();

  // Clip shape (including border radius)
  const br = layer.imgBorderRadius||0;
  if(layer.clipShape&&layer.clipShape!=='none'){
    ctx.beginPath();clipPathForShape(layer.clipShape,layer.x,layer.y,layer.w,layer.h);ctx.clip();
  } else if(br>0){
    ctx.beginPath();ctx.roundRect(layer.x,layer.y,layer.w,layer.h,br);ctx.clip();
  }

  // imgOpacity independent from layer opacity
  if(layer.imgOpacity!=null&&layer.imgOpacity!==100) ctx.globalAlpha=(layer.imgOpacity/100);

  // Build CSS filter string — simulate exposure, highlights, shadows via brightness/contrast tricks
  let fStr='';
  const bright = (layer.brightness??100) + (layer.exposure??0)*0.8 + (layer.whites??0)*0.3;
  const cont = (layer.contrast??100) + (layer.highlights??0)*0.5 - (layer.shadows??0)*0.3;
  const sat = (layer.saturation??100) + (layer.vibrance??0)*0.6;
  const gamma = layer.gamma??100;
  // temperature: warm = +red/yellow tint via sepia+hue, approximated via hue
  const tempHue = layer.temperature??0; // +warm shifts hue slightly
  const tintHue = layer.tint??0;

  if(bright!==100) fStr+=`brightness(${Math.max(0,Math.round(bright))}%) `;
  if(cont!==100) fStr+=`contrast(${Math.max(0,Math.round(cont))}%) `;
  if(sat!==100) fStr+=`saturate(${Math.max(0,Math.round(sat))}%) `;
  if(layer.hueRotate||tempHue||tintHue) fStr+=`hue-rotate(${(layer.hueRotate??0)+(tempHue*0.3)+(tintHue*0.15)}deg) `;
  if(layer.blurFilter) fStr+=`blur(${layer.blurFilter}px) `;
  if(layer.sepia) fStr+=`sepia(${layer.sepia}%) `;
  if(layer.grayscale) fStr+=`grayscale(${layer.grayscale}%) `;
  if(gamma!==100) fStr+=`brightness(${gamma}%) `;
  // clarity/texture/sharpness approximated via contrast
  if(layer.clarity&&layer.clarity!==0) fStr+=`contrast(${100+layer.clarity*0.4}%) `;
  if(layer.sharpness&&layer.sharpness>0) fStr+=`contrast(${100+layer.sharpness*0.25}%) saturate(${100+layer.sharpness*0.5}%) `;
  if(layer.fxBlur>0) fStr+=`blur(${layer.fxBlur}px) `;
  if(fStr) ctx.filter=fStr.trim();

  if(layer.blendMode&&layer.blendMode!=='source-over') ctx.globalCompositeOperation=layer.blendMode;
  ctx.drawImage(layer.img,layer.x,layer.y,layer.w,layer.h);
  ctx.filter='none'; ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;

  // Border
  const bw = layer.imgBorderWidth||0;
  if(bw>0){
    ctx.strokeStyle=layer.imgBorderColor||'#fff';
    ctx.lineWidth=bw;
    if(br>0){ctx.beginPath();ctx.roundRect(layer.x,layer.y,layer.w,layer.h,br);ctx.stroke();}
    else if(layer.clipShape&&layer.clipShape==='circle'){ctx.beginPath();ctx.arc(layer.x+layer.w/2,layer.y+layer.h/2,Math.min(layer.w,layer.h)/2,0,Math.PI*2);ctx.stroke();}
    else ctx.strokeRect(layer.x,layer.y,layer.w,layer.h);
  }

  // Vignette
  if(layer.vignette>0){
    const vg=ctx.createRadialGradient(layer.x+layer.w/2,layer.y+layer.h/2,Math.min(layer.w,layer.h)*0.3,layer.x+layer.w/2,layer.y+layer.h/2,Math.max(layer.w,layer.h)*0.7);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(0,0,0,${layer.vignette/100})`);
    ctx.fillStyle=vg;ctx.fillRect(layer.x,layer.y,layer.w,layer.h);
  }

  // Blacks/shadows overlay (darken shadows)
  if(layer.blacks&&layer.blacks<0){
    ctx.fillStyle=`rgba(0,0,0,${Math.abs(layer.blacks)/200})`;ctx.fillRect(layer.x,layer.y,layer.w,layer.h);
  }

  // Overlay
  if(layer.overlayOpacity>0){
    ctx.globalAlpha=(layer.overlayOpacity/100);
    ctx.fillStyle=layer.overlayColor||'#ff0000';
    ctx.fillRect(layer.x,layer.y,layer.w,layer.h);
    ctx.globalAlpha=1;
  }

  // Noise grain
  if(layer.noise>0){
    const noiseCanvas=document.createElement('canvas');noiseCanvas.width=layer.w;noiseCanvas.height=layer.h;
    const nc=noiseCanvas.getContext('2d');const id=nc.createImageData(layer.w,layer.h);
    const d=id.data;for(let i=0;i<d.length;i+=4){const g=(Math.random()-0.5)*layer.noise*2.5;d[i]=128+g;d[i+1]=128+g;d[i+2]=128+g;d[i+3]=20;}
    nc.putImageData(id,0,0);ctx.globalCompositeOperation='overlay';ctx.globalAlpha=layer.noise/200;
    ctx.drawImage(noiseCanvas,layer.x,layer.y,layer.w,layer.h);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }

  ctx.restore();
}

// ===================== CLIP PATHS =====================
function clipPathForShape(shape,x,y,w,h){
  if(shape==='circle'){ctx.arc(x+w/2,y+h/2,Math.min(w,h)/2,0,Math.PI*2);}
  else if(shape==='roundrect'){ctx.roundRect(x,y,w,h,Math.min(20,w/4,h/4));}
  else if(shape==='triangle'){ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();}
  else if(shape==='diamond'){ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();}
  else if(shape==='hexagon'){for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;const px=x+w/2+Math.min(w,h)/2*Math.cos(a);const py=y+h/2+Math.min(w,h)/2*Math.sin(a);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();}
  else if(shape==='star'){drawStarPath({x,y,w,h});}
}

// ===================== DRAW SHAPE =====================
function drawShape(layer) {
  ctx.save();
  // Glow/shadow
  if(layer.glowSize>0){
    const glowAlpha=(layer.glowIntensity!=null?layer.glowIntensity:50)/100;
    ctx.shadowColor=hexToRgba(layer.glowColor||'#fff',glowAlpha);ctx.shadowBlur=layer.glowSize;
  }
  if(layer.shadowBlur>0){ctx.shadowColor=hexToRgba(layer.shadowColor||'#000',0.8);ctx.shadowBlur=layer.shadowBlur;ctx.shadowOffsetX=layer.shadowX||4;ctx.shadowOffsetY=layer.shadowY||4;}

  // Fill style
  if(layer.fillType==='gradient'&&layer.gradC1&&layer.gradC2){
    let grd;
    if(layer.gradDir==='radial') grd=ctx.createRadialGradient(layer.x+layer.w/2,layer.y+layer.h/2,0,layer.x+layer.w/2,layer.y+layer.h/2,Math.max(layer.w,layer.h)/2);
    else {const dirs={'to right':[layer.x,layer.y,layer.x+layer.w,layer.y],'to bottom':[layer.x,layer.y,layer.x,layer.y+layer.h],'to bottom right':[layer.x,layer.y,layer.x+layer.w,layer.y+layer.h]};const d=dirs[layer.gradDir||'to right']||[layer.x,layer.y,layer.x+layer.w,layer.y];grd=ctx.createLinearGradient(...d);}
    grd.addColorStop(0,layer.gradC1);grd.addColorStop(1,layer.gradC2);
    ctx.fillStyle=grd;
  } else if(layer.fillType==='none'){ctx.fillStyle='transparent';}
  else {ctx.fillStyle=layer.fill||'#c8a96e';}

  const bw=layer.borderWidth||0;
  if(bw>0){ctx.strokeStyle=layer.borderColor||'#fff';ctx.lineWidth=bw;if(layer.dashStyle==='dashed')ctx.setLineDash([bw*4,bw*2]);else if(layer.dashStyle==='dotted')ctx.setLineDash([bw,bw*2]);else ctx.setLineDash([]);}
  const cr=layer.cornerRadius||0;

  const shapeFns = {
    rect:()=>{if(cr>0)ctx.roundRect(layer.x,layer.y,layer.w,layer.h,cr);else ctx.rect(layer.x,layer.y,layer.w,layer.h);},
    roundrect:()=>{ctx.roundRect(layer.x,layer.y,layer.w,layer.h,cr||Math.min(20,layer.w/4,layer.h/4));},
    circle:()=>{ctx.arc(layer.x+layer.w/2,layer.y+layer.h/2,Math.min(layer.w,layer.h)/2,0,Math.PI*2);},
    ellipse:()=>{ctx.ellipse(layer.x+layer.w/2,layer.y+layer.h/2,layer.w/2,layer.h/2,0,0,Math.PI*2);},
    triangle:()=>{ctx.moveTo(layer.x+layer.w/2,layer.y);ctx.lineTo(layer.x+layer.w,layer.y+layer.h);ctx.lineTo(layer.x,layer.y+layer.h);ctx.closePath();},
    diamond:()=>{ctx.moveTo(layer.x+layer.w/2,layer.y);ctx.lineTo(layer.x+layer.w,layer.y+layer.h/2);ctx.lineTo(layer.x+layer.w/2,layer.y+layer.h);ctx.lineTo(layer.x,layer.y+layer.h/2);ctx.closePath();},
    hexagon:()=>{for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;const px=layer.x+layer.w/2+Math.min(layer.w,layer.h)/2*Math.cos(a);const py=layer.y+layer.h/2+Math.min(layer.w,layer.h)/2*Math.sin(a);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();},
    pentagon:()=>{for(let i=0;i<5;i++){const a=(i*2*Math.PI/5)-Math.PI/2;const px=layer.x+layer.w/2+Math.min(layer.w,layer.h)/2*Math.cos(a);const py=layer.y+layer.h/2+Math.min(layer.w,layer.h)/2*Math.sin(a);i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);}ctx.closePath();},
    star:()=>drawStarPath(layer),
    arrow:()=>drawArrowPath(layer),
    arrowdouble:()=>drawArrowDoublePath(layer),
    burst:()=>drawBurstPath(layer),
    speechbubble:()=>drawSpeechBubblePath(layer),
    heart:()=>drawHeartPath(layer),
    cross:()=>drawCrossPath(layer),
    parallelogram:()=>drawParallelogramPath(layer),
    ribbon:()=>drawRibbonPath(layer),
    cloud:()=>drawCloudPath(layer),
    chevron:()=>drawChevronPath(layer),
    line:()=>{ctx.moveTo(layer.x,layer.y+layer.h/2);ctx.lineTo(layer.x+layer.w,layer.y+layer.h/2);}
  };

  if(layer.shape==='line'){
    ctx.beginPath();shapeFns.line();
    ctx.strokeStyle=layer.fill||'#c8a96e';ctx.lineWidth=bw||4;ctx.stroke();
  } else {
    ctx.beginPath();
    (shapeFns[layer.shape]||shapeFns.rect)();
    if(layer.fillEnabled!==false && layer.fillType!=='none') ctx.fill();
    if(layer.strokeEnabled!==false && bw>0) ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.restore();
}

// ===================== SHAPE PATHS =====================
function drawStarPath(l){const cx=l.x+l.w/2,cy=l.y+l.h/2,out=Math.min(l.w,l.h)/2,inn=out*0.4;for(let i=0;i<10;i++){const r=i%2===0?out:inn,a=i*Math.PI/5-Math.PI/2;i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}ctx.closePath();}
function drawArrowPath(l){const x=l.x,y=l.y,w=l.w,h=l.h,hw=h*0.4,hy=h/2;ctx.moveTo(x,y+hy-hw/2);ctx.lineTo(x+w*.65,y+hy-hw/2);ctx.lineTo(x+w*.65,y);ctx.lineTo(x+w,y+hy);ctx.lineTo(x+w*.65,y+h);ctx.lineTo(x+w*.65,y+hy+hw/2);ctx.lineTo(x,y+hy+hw/2);ctx.closePath();}
function drawArrowDoublePath(l){const x=l.x,y=l.y,w=l.w,h=l.h,hw=h*0.4,hy=h/2,p=w*.2;ctx.moveTo(x,hy+y);ctx.lineTo(x+p,y);ctx.lineTo(x+p,y+hy-hw/2);ctx.lineTo(x+w-p,y+hy-hw/2);ctx.lineTo(x+w-p,y);ctx.lineTo(x+w,y+hy);ctx.lineTo(x+w-p,y+h);ctx.lineTo(x+w-p,y+hy+hw/2);ctx.lineTo(x+p,y+hy+hw/2);ctx.lineTo(x+p,y+h);ctx.closePath();}
function drawBurstPath(l){const cx=l.x+l.w/2,cy=l.y+l.h/2,out=Math.min(l.w,l.h)/2,inn=out*.7,pts=16;for(let i=0;i<pts;i++){const r=i%2===0?out:inn,a=i*Math.PI/(pts/2)-Math.PI/2;i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}ctx.closePath();}
function drawSpeechBubblePath(l){const x=l.x,y=l.y,w=l.w,h=l.h*.82,r=15,bx=l.x+l.w*.2,by=l.y+h,tw=40,th=l.h*.18;ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(bx+tw,y+h);ctx.lineTo(bx,by+th);ctx.lineTo(bx-5,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function drawHeartPath(l){const x=l.x,y=l.y,w=l.w,h=l.h,cx=x+w/2,top=y+h*.25;ctx.moveTo(cx,y+h);ctx.bezierCurveTo(x-w*.1,y+h*.65,x,top,cx-w*.25,top);ctx.bezierCurveTo(x-w*.05,y,cx,y+h*.15,cx,top+h*.1);ctx.bezierCurveTo(cx,y+h*.15,x+w+.05,y,x+w+w*.05,top);ctx.bezierCurveTo(x+w+w*.1,top,x+w*.1+w,y+h*.65,cx,y+h);ctx.closePath();}
function drawCrossPath(l){const x=l.x,y=l.y,w=l.w,h=l.h,t=Math.min(w,h)*.3;ctx.rect(x+w/2-t/2,y,t,h);ctx.rect(x,y+h/2-t/2,w,t);}
function drawParallelogramPath(l){const sk=l.w*.2;ctx.moveTo(l.x+sk,l.y);ctx.lineTo(l.x+l.w,l.y);ctx.lineTo(l.x+l.w-sk,l.y+l.h);ctx.lineTo(l.x,l.y+l.h);ctx.closePath();}
function drawRibbonPath(l){const x=l.x,y=l.y,w=l.w,h=l.h,nb=h*.3;ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h-nb);ctx.lineTo(x+w*.75,y+h*.65);ctx.lineTo(x+w,y+h);ctx.lineTo(x+w/2,y+h*.8);ctx.lineTo(x,y+h);ctx.lineTo(x+w*.25,y+h*.65);ctx.lineTo(x,y+h-nb);ctx.closePath();}
function drawCloudPath(l){const cx=l.x+l.w/2,cy=l.y+l.h/2,rx=l.w/2,ry=l.h/2;ctx.arc(cx,cy+ry*.1,ry*.55,Math.PI,0);ctx.arc(cx+rx*.35,cy-ry*.1,ry*.45,Math.PI,0,true);ctx.arc(cx-rx*.25,cy-ry*.2,ry*.35,Math.PI,0,true);ctx.arc(cx-rx*.6,cy+ry*.15,ry*.4,Math.PI*.5,Math.PI*1.5);ctx.arc(cx+rx*.6,cy+ry*.15,ry*.4,0,Math.PI*.5);ctx.closePath();}
function drawChevronPath(l){const x=l.x,y=l.y,w=l.w,h=l.h,p=w*.2;ctx.moveTo(x,y);ctx.lineTo(x+w-p,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w-p,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x+p,y+h/2);ctx.closePath();}

function drawSticker(layer){
  ctx.save();
  const size=Math.min(layer.w,layer.h)*0.85;
  ctx.font=`${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0)';
  ctx.fillText(layer.emoji,layer.x+layer.w/2,layer.y+layer.h/2);
  ctx.restore();
}

// ===================== SELECTION HANDLES =====================
// Rotate icon cache — keyed by angle, loaded once
const _rotateIconCache = {};
function _getRotateIconImg(angleDeg) {
  const key = Math.round(((angleDeg % 360) + 360) % 360);
  if (_rotateIconCache[key]) return _rotateIconCache[key];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 14 14'><g transform='rotate(${key},7,7)'><path d='M7 2 A5 5 0 0 1 12 7' fill='none' stroke='white' stroke-width='2' stroke-linecap='round'/><polygon points='12,4 12,8 8,6' fill='white'/></g></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  _rotateIconCache[key] = img;
  return img;
}

function drawSelection(layer) {
  ctx.save();
  applyLayerTransform(layer);
  ctx.strokeStyle='#c8a96e';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);
  ctx.strokeRect(layer.x-1.5,layer.y-1.5,layer.w+3,layer.h+3);
  ctx.setLineDash([]);
  const rawHandles=[
    {x:layer.x,y:layer.y,id:'tl'},{x:layer.x+layer.w,y:layer.y,id:'tr'},
    {x:layer.x,y:layer.y+layer.h,id:'bl'},{x:layer.x+layer.w,y:layer.y+layer.h,id:'br'},
    {x:layer.x+layer.w/2,y:layer.y,id:'tm'},{x:layer.x+layer.w/2,y:layer.y+layer.h,id:'bm'},
    {x:layer.x,y:layer.y+layer.h/2,id:'ml'},{x:layer.x+layer.w,y:layer.y+layer.h/2,id:'mr'},
  ];
  // Draw plain white dots on ALL handles
  rawHandles.forEach(h=>{
    ctx.fillStyle='#fff';ctx.strokeStyle='#c8a96e';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(h.x,h.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
  });
  // Draw rotate icon ONLY on the corner the mouse is currently hovering (rotate zone)
  if(_hoverRotateCorner) {
    const hoverH = rawHandles.find(h=>h.id===_hoverRotateCorner);
    if(hoverH) {
      // In LOCAL space (canvas already rotated by applyLayerTransform),
      // base angle per corner — no extra rotation needed
      const cornerBaseAngle = {tl:225, tr:315, bl:135, br:45};
      const angle = cornerBaseAngle[_hoverRotateCorner] || 0;
      const off = {tl:{ox:-14,oy:-14}, tr:{ox:14,oy:-14}, bl:{ox:-14,oy:14}, br:{ox:14,oy:14}};
      const o = off[_hoverRotateCorner];
      const img = _getRotateIconImg(angle);
      if(img.complete && img.naturalWidth) {
        ctx.drawImage(img, hoverH.x + o.ox - 7, hoverH.y + o.oy - 7, 14, 14);
      }
    }
  }
  ctx.restore();
}

function rotatePoint(px,py,cx,cy,angleDeg){
  if(!angleDeg) return {x:px,y:py};
  const rad=angleDeg*Math.PI/180;
  const cos=Math.cos(rad), sin=Math.sin(rad);
  const dx=px-cx, dy=py-cy;
  return { x: cx + dx*cos - dy*sin, y: cy + dx*sin + dy*cos };
}

function getHandles(layer){
  const raw=[
    {x:layer.x,y:layer.y,id:'tl'},{x:layer.x+layer.w,y:layer.y,id:'tr'},
    {x:layer.x,y:layer.y+layer.h,id:'bl'},{x:layer.x+layer.w,y:layer.y+layer.h,id:'br'},
    {x:layer.x+layer.w/2,y:layer.y,id:'tm'},{x:layer.x+layer.w/2,y:layer.y+layer.h,id:'bm'},
    {x:layer.x,y:layer.y+layer.h/2,id:'ml'},{x:layer.x+layer.w,y:layer.y+layer.h/2,id:'mr'},
  ];
  if(!layer.rotation) return raw;
  const cx=layer.x+layer.w/2, cy=layer.y+layer.h/2;
  return raw.map(h=>({...rotatePoint(h.x,h.y,cx,cy,layer.rotation),id:h.id}));
}

// Returns 'resize' or 'rotate' if mouse is near a corner handle, plus the handle id.
// Inner ring (close to the dot) = resize. Outer ring (just outside the dot) = rotate.
function getCornerZone(layer,x,y){
  const corners=getHandles(layer).filter(h=>['tl','tr','bl','br'].includes(h.id));
  for(const h of corners){
    const dist=Math.hypot(x-h.x,y-h.y);
    if(dist<10/scale) return {zone:'resize',id:h.id};
    if(dist<22/scale) return {zone:'rotate',id:h.id};
  }
  return null;
}

// ===================== MOUSE / TOUCH =====================
function setupMouseEvents(){
  canvas.addEventListener('mousedown',onMouseDown);
  document.addEventListener('mousemove',onMouseMove);
  document.addEventListener('mouseup',onMouseUp);
  canvas.addEventListener('dblclick',onDblClick);
  canvas.addEventListener('contextmenu',onRightClick);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();onMouseDown(touchEvt(e));},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();onMouseMove(touchEvt(e));},{passive:false});
  canvas.addEventListener('touchend',()=>onMouseUp());
  document.addEventListener('click',e=>{if(!e.target.closest('.ctx-menu'))hideCtx();});
  document.getElementById('canvasArea').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(e.deltaY<0?.1:-.1);}},{passive:false});
  document.getElementById('canvasArea').addEventListener('dragover',e=>e.preventDefault());
  document.getElementById('canvasArea').addEventListener('drop',e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))handleImageUpload({target:{files:[f]}});});
}
function touchEvt(e){return{clientX:e.touches[0].clientX,clientY:e.touches[0].clientY};}
function canvasCoords(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvasW/r.width),y:(e.clientY-r.top)*(canvasH/r.height)};}

function onMouseDown(e){
  const {x,y}=canvasCoords(e);
  if(drawingMode){
    if(selectedIndex<0||layers[selectedIndex].type!=='draw') addBrushLayer();
    saveHistory();
    isPainting=true; lastPaintPos={x,y};
    paintAt(x,y,true);
    return;
  }
  if(selectedIndex>=0){
    const layer=layers[selectedIndex];
    const corner=getCornerZone(layer,x,y);
    if(corner){
      if(corner.zone==='resize'){
        saveHistory();
        isResizing=true;resizeHandle=corner.id;
        if(document.getElementById('lockAspect').checked)aspectLock.ratio=layer.w/layer.h;
        return;
      } else {
        isRotating=true;
        const cx=layer.x+layer.w/2, cy=layer.y+layer.h/2;
        rotateStartAngle=Math.atan2(y-cy,x-cx)*180/Math.PI;
        rotateStartRotation=layer.rotation||0;
        saveHistory();
        return;
      }
    }
    // mid-edge handles (tm/bm/ml/mr) still resize as before
    for(const h of getHandles(layer)){
      if(['tm','bm','ml','mr'].includes(h.id) && Math.hypot(x-h.x,y-h.y)<10/scale){
        saveHistory();
        isResizing=true;resizeHandle=h.id;
        if(document.getElementById('lockAspect').checked)aspectLock.ratio=layer.w/layer.h;
        return;
      }
    }
  }
  let found=-1;
  for(let i=layers.length-1;i>=0;i--){
    const l=layers[i];
    if(!l.visible||l.locked)continue;
    // Unrotate mouse point into layer's local space before hit test
    let lx=x, ly=y;
    if(l.rotation){
      const cx=l.x+l.w/2, cy=l.y+l.h/2;
      const rad=-l.rotation*Math.PI/180;
      const dx=x-cx, dy=y-cy;
      lx=cx+dx*Math.cos(rad)-dy*Math.sin(rad);
      ly=cy+dx*Math.sin(rad)+dy*Math.cos(rad);
    }
    if(lx>=l.x&&lx<=l.x+l.w&&ly>=l.y&&ly<=l.y+l.h){found=i;break;}
  }
  selectedIndex=found;
  if(found>=0){
    isDragging=true;
    saveHistory();
    const fl=layers[found];
    dragOffX=x-(fl.x+fl.w/2);dragOffY=y-(fl.y+fl.h/2);
    updateRightPanel();updateFxPanel();
  }
  else updateRightPanel();
  updateLayerList();redraw();
}

function onMouseMove(e){
  const {x,y}=canvasCoords(e);

  if(isPainting){
    paintAt(x,y,false);
    lastPaintPos={x,y};
    return;
  }
  if(isDragging&&selectedIndex>=0){
    let layer = layers[selectedIndex];
    // mouse - center_offset = new center; subtract half-size to get top-left (layer.x/y)
    let targetX = x - dragOffX - layer.w/2;
    let targetY = y - dragOffY - layer.h/2;
    let snapThreshold = 10;
    let snappedX = false;
    let snappedY = false;

    // Center X Snapping
    let canvasCenterX = canvasW / 2;
    let layerCenterX = targetX + layer.w / 2;
    if(Math.abs(layerCenterX - canvasCenterX) < snapThreshold) {
      targetX = canvasCenterX - layer.w / 2;
      snappedX = true;
    }

    // Center Y Snapping
    let canvasCenterY = canvasH / 2;
    let layerCenterY = targetY + layer.h / 2;
    if(Math.abs(layerCenterY - canvasCenterY) < snapThreshold) {
      targetY = canvasCenterY - layer.h / 2;
      snappedY = true;
    }

    layer.x = Math.round(targetX);
    layer.y = Math.round(targetY);
    layer.snappedX = snappedX;
    layer.snappedY = snappedY;

    updateRightPanel();redraw();
  } else if(isResizing&&selectedIndex>=0){
    const l=layers[selectedIndex],h=resizeHandle;
    const rot=(l.rotation||0)*Math.PI/180;
    const cosR=Math.cos(rot),sinR=Math.sin(rot);
    const oldCx=l.x+l.w/2, oldCy=l.y+l.h/2;
    // Unrotate mouse into local space
    const dxM=x-oldCx,dyM=y-oldCy;
    const lx=oldCx+dxM*Math.cos(-rot)-dyM*Math.sin(-rot);
    const ly=oldCy+dxM*Math.sin(-rot)+dyM*Math.cos(-rot);
    // Pin the opposite corner/edge
    const pinLx=h.includes('r')?l.x:(h.includes('l')?l.x+l.w:l.x+l.w/2);
    const pinLy=h.includes('b')?l.y:(h.includes('t')?l.y+l.h:l.y+l.h/2);
    let newW=l.w,newH=l.h;
    if(h.includes('r')) newW=Math.max(10,lx-pinLx);
    if(h.includes('l')) newW=Math.max(10,pinLx-lx);
    if(h.includes('b')) newH=Math.max(10,ly-pinLy);
    if(h.includes('t')) newH=Math.max(10,pinLy-ly);
    if(document.getElementById('lockAspect').checked&&aspectLock.ratio){
      if(h.includes('r')||h.includes('l'))newH=newW/aspectLock.ratio;
      else newW=newH*aspectLock.ratio;
    }
    const newLx=h.includes('r')?pinLx:(h.includes('l')?pinLx-newW:l.x+(l.w-newW)/2);
    const newLy=h.includes('b')?pinLy:(h.includes('t')?pinLy-newH:l.y+(l.h-newH)/2);
    const dxC=newLx+newW/2-oldCx,dyC=newLy+newH/2-oldCy;
    l.w=Math.round(newW);l.h=Math.round(newH);
    l.x=Math.round(oldCx+dxC*cosR-dyC*sinR-newW/2);
    l.y=Math.round(oldCy+dxC*sinR+dyC*cosR-newH/2);
    updateRightPanel();redraw();
  } else if(isRotating&&selectedIndex>=0){
    const l=layers[selectedIndex];
    const cx=l.x+l.w/2, cy=l.y+l.h/2;
    const currentAngle=Math.atan2(y-cy,x-cx)*180/Math.PI;
    let newRotation=Math.round(rotateStartRotation+(currentAngle-rotateStartAngle));
    if(e.shiftKey){newRotation=Math.round(newRotation/15)*15;} // snap to 15° with Shift
    newRotation=((newRotation%360)+360)%360;
    if(newRotation>180)newRotation-=360;
    l.rotation=newRotation;
    document.getElementById('propRot')&&(document.getElementById('propRot').value=l.rotation);
    const pRV=document.getElementById('propRotVal');if(pRV)pRV.textContent=l.rotation+'°';
    const pRV2=document.getElementById('propRotVal2');if(pRV2)pRV2.textContent=l.rotation+'°';
    document.getElementById('fxRotation')&&(document.getElementById('fxRotation').value=l.rotation);
    const rv=document.getElementById('rotVal');if(rv)rv.textContent=l.rotation+'°';
    redraw();
  }
  if(drawingMode){canvas.style.cursor='crosshair';return;}
  if(selectedIndex>=0 && !isDragging && !isResizing && !isRotating){
    const l=layers[selectedIndex];
    const rot=l.rotation||0;
    const corner=getCornerZone(l,x,y);
    if(corner){
      if(corner.zone==='rotate'){
        // Rotate cursor — angle = corner's natural direction + object rotation
        const cornerBaseAngle = {tl:225, tr:315, bl:135, br:45};
        const totalAngle = ((cornerBaseAngle[corner.id]||0) + rot + 360) % 360;
        const rotateCursorSVG = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g transform='rotate(${Math.round(totalAngle)},12,12)'><path d='M12 4 A8 8 0 0 1 20 12' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'/><polygon points='20,6 20,12 14,12' fill='black'/></g></svg>`;
        const encoded = 'data:image/svg+xml;base64,' + btoa(rotateCursorSVG);
        canvas.style.cursor = `url('${encoded}') 12 12, grab`;
        if(_hoverRotateCorner !== corner.id){ _hoverRotateCorner=corner.id; redraw(); }
      } else {
        if(_hoverRotateCorner){_hoverRotateCorner=null;redraw();}
        const baseAngles={tl:135,tr:45,bl:225,br:315};
        const angle=(baseAngles[corner.id]+rot+360)%360;
        canvas.style.cursor=_diagCursorForAngle(angle);
      }
    } else {
      if(_hoverRotateCorner){_hoverRotateCorner=null;redraw();}
      const handles=getHandles(l);
      let cur='default';
      for(const h of handles){
        if(!['tm','bm','ml','mr'].includes(h.id)) continue;
        if(Math.hypot(x-h.x,y-h.y)<10/scale){
          // tm/bm natural axis = 0°, ml/mr = 90° — add object rotation for actual screen direction
          const baseAngles={tm:0,bm:0,ml:90,mr:90};
          const angle=(baseAngles[h.id]+rot+360)%360;
          cur=_diagCursorForAngle(angle);
          break;
        }
      }
      canvas.style.cursor=cur;
    }
  } else if(isRotating){
    if(_hoverRotateCorner){_hoverRotateCorner=null;}
    canvas.style.cursor='grabbing';
  } else {
    if(_hoverRotateCorner){_hoverRotateCorner=null;redraw();}
    canvas.style.cursor='default';
  }
}
function _diagCursorForAngle(angle){
  const a=((angle%360)+360)%360;
  if((a>=337.5||a<22.5)||(a>=157.5&&a<202.5)) return 'ns-resize';
  if((a>=67.5&&a<112.5)||(a>=247.5&&a<292.5)) return 'ew-resize';
  if((a>=22.5&&a<67.5)||(a>=202.5&&a<247.5)) return 'nesw-resize';
  return 'nwse-resize';
}
let _hoverRotateCorner=null, _hoverRotateX=0, _hoverRotateY=0;
function onMouseUp(){
  if(selectedIndex>=0){
    layers[selectedIndex].snappedX = false;
    layers[selectedIndex].snappedY = false;
  }
  isDragging=false;isResizing=false;isRotating=false;aspectLock={};isPainting=false;lastPaintPos=null;
  canvas.style.cursor = drawingMode ? 'crosshair' : 'default';
  redraw();
}
function onDblClick(e){if(selectedIndex>=0&&layers[selectedIndex].type==='text'){switchTabByName('text');document.getElementById('txtContent').value=layers[selectedIndex].text;document.getElementById('txtContent').focus();}}
function onRightClick(e){e.preventDefault();if(selectedIndex<0)return;const m=document.getElementById('ctxMenu');m.style.display='block';m.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';m.style.top=Math.min(e.clientY,window.innerHeight-200)+'px';}
function hideCtx(){document.getElementById('ctxMenu').style.display='none';}

// ===================== ADD LAYERS =====================
function newLayerBase(extra){return{opacity:100,rotation:0,visible:true,blendMode:'source-over',skewX:0,skewY:0,fxBlur:0,fxBlurType:'gaussian',fxMotionAngle:0,shadowBlur:0,shadowX:4,shadowY:4,shadowColor:'#000000',fxShadowOpacity:80,shadowAngle:135,shadowSpread:6,glowSize:0,glowColor:'#c8a96e',glowIntensity:50,mask:'none',fillEnabled:true,strokeEnabled:false,...extra};}

function addText(preset){
  saveHistory();
  const presets={
    title:{text:'YOUR TITLE',size:96,font:'Bebas Neue',w:900,h:130,color:'#ffffff',fontWeight:'400'},
    sub:{text:'Your Subtitle Here',size:48,font:'Montserrat',w:700,h:80,color:'#cccccc',fontWeight:'700'},
    label:{text:'LABEL',size:32,font:'Syne',w:300,h:55,color:'#ffcc00',fontWeight:'700'},
    number:{text:'#1',size:140,font:'Bebas Neue',w:220,h:200,color:'#ff6b6b',fontWeight:'400'},
    viral:{text:"YOU WON'T BELIEVE THIS",size:72,font:'Impact',w:900,h:100,color:'#ff3333',fontWeight:'700'},
    outline:{text:'OUTLINE TEXT',size:88,font:'Bebas Neue',w:800,h:120,color:'transparent',fontWeight:'400',outlineWidth:4,outlineColor:'#c8a96e',txtFillType:'transparent'},
    neon:{text:'NEON',size:88,font:'Orbitron',w:600,h:120,color:'#00ffff',fontWeight:'700',glowColor:'#00ffff',glowSize:20,shadow:0},
    comic:{text:'POW!',size:100,font:'Bangers',w:500,h:140,color:'#ff3300',fontWeight:'400',outlineWidth:3,outlineColor:'#000'},
    handwritten:{text:'Write here...',size:72,font:'Caveat',w:700,h:110,color:'#ffffff',fontWeight:'700'},
    boxed:{text:'KEY POINT',size:60,font:'Montserrat',w:600,h:100,color:'#000000',fontWeight:'700',bgBox:true,bgBoxColor:'#ffff00',bgBoxPad:14},
  };
  const p=presets[preset]||{text:'New Text',size:72,font:'Montserrat',w:600,h:100,color:'#ffffff',fontWeight:'700'};
  layers.push(newLayerBase({
    type:'text',text:p.text,x:canvasW/2-(p.w||600)/2,y:canvasH/2-(p.h||100)/2,
    w:p.w||600,h:p.h||100,color:p.color||'#ffffff',size:p.size||72,font:p.font||'Montserrat',
    fontWeight:p.fontWeight||'700',align:'center',letterSpacing:0,lineH:1.2,
    shadow:p.shadow!=null?p.shadow:0,shadowX:2,shadowY:2,shadowColor:'#000000',
    outlineWidth:p.outlineWidth||0,outlineColor:p.outlineColor||'#000000',
    glowSize:p.glowSize||0,glowColor:p.glowColor||'#ffffff',
    txtFillType:p.txtFillType||'solid',grad1:'#ff6b6b',grad2:'#c8a96e',txtGradDir:'to right',
    italic:false,underline:false,strikethrough:false,allcaps:false,
    bgBox:p.bgBox||false,bgBoxColor:p.bgBoxColor||'#ffff00',bgBoxPad:p.bgBoxPad||10,bgBoxRadius:0,
    name:(p.text||'Text').substring(0,16),
  }));
  selectedIndex=layers.length-1;
  updateLayerList();updateRightPanel();redraw();
  switchTabByName('text');
  document.getElementById('txtContent').value=layers[selectedIndex].text;
}

function addShape(shape,name,overrides){
  saveHistory();
  const w=shape==='line'?400:200,h=shape==='line'?4:200;
  layers.push(newLayerBase({
    type:'shape',shape,name,
    x:canvasW/2-w/2,y:canvasH/2-h/2,w,h,
    fill:'#c8a96e',fillType:'solid',
    borderColor:'#ffffff',borderWidth:0,dashStyle:'solid',
    cornerRadius:0,gradC1:'#c8a96e',gradC2:'#ff6b6b',gradDir:'to right',
    ...(overrides||{})
  }));
  selectedIndex=layers.length-1;
  updateLayerList();updateRightPanel();redraw();
  switchTabByName('shape');
}

function addRect(){addShape('rect','Rectangle');}
function addRoundRect(){addShape('roundrect','Rounded Rect',{cornerRadius:20});}
function addCircle(){addShape('circle','Circle');}
function addEllipse(){addShape('ellipse','Ellipse');}
function addTriangle(){addShape('triangle','Triangle');}
function addLine(){addShape('line','Line',{borderWidth:4});}
function addStar(){addShape('star','Star');}
function addArrow(){addShape('arrow','Arrow');}
function addArrowDouble(){addShape('arrowdouble','Double Arrow');}
function addHexagon(){addShape('hexagon','Hexagon');}
function addPentagon(){addShape('pentagon','Pentagon');}
function addDiamond(){addShape('diamond','Diamond');}
function addBurst(){addShape('burst','Burst');}
function addSpeechBubble(){addShape('speechbubble','Speech Bubble');}
function addHeart(){addShape('heart','Heart',{fill:'#ff3366'});}
function addCross(){addShape('cross','Cross');}
function addParallelogram(){addShape('parallelogram','Parallelogram');}
function addRibbon(){addShape('ribbon','Ribbon',{fill:'#c8a96e'});}
function addCloud(){addShape('cloud','Cloud',{fill:'#ffffff'});}
function addChevron(){addShape('chevron','Chevron');}

function addSticker(emoji){
  saveHistory();const s=100;
  layers.push(newLayerBase({type:'sticker',emoji,name:emoji+' Sticker',x:canvasW/2-s/2,y:canvasH/2-s/2,w:s,h:s}));
  selectedIndex=layers.length-1;updateLayerList();updateRightPanel();redraw();
}

function addBadge(type){
  const b=BADGE_DATA[type]||BADGE_DATA.new;
  saveHistory();
  const bw=Math.max(160,b.text.length*22),bh=70,bx=canvasW-bw-30,by=30;
  layers.push(newLayerBase({type:'shape',shape:'roundrect',name:b.text+' Badge bg',x:bx,y:by,w:bw,h:bh,fill:b.bg,fillType:'solid',borderColor:'transparent',borderWidth:0,dashStyle:'solid',cornerRadius:bh/2,gradC1:b.bg,gradC2:b.bg,gradDir:'to right'}));
  layers.push(newLayerBase({type:'text',text:b.text,x:bx,y:by,w:bw,h:bh,color:b.color,size:Math.round(bh*.5),font:'Bebas Neue',fontWeight:'400',align:'center',letterSpacing:2,lineH:1.2,shadow:0,shadowX:0,shadowY:0,shadowColor:'#000',outlineWidth:0,outlineColor:'#000',glowSize:0,glowColor:'#fff',txtFillType:'solid',grad1:'#fff',grad2:'#fff',txtGradDir:'to right',italic:false,underline:false,strikethrough:false,allcaps:true,bgBox:false,bgBoxColor:'#fff',bgBoxPad:10,bgBoxRadius:0,name:b.text+' text'}));
  selectedIndex=layers.length-1;updateLayerList();updateRightPanel();redraw();showToast('Badge added!');
}

// ===================== BRUSH / DRAWING TOOL =====================
function buildBrushUI(){
  const g=document.getElementById('brushTypeGrid');
  BRUSH_TYPES.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='shape-btn'+(b.id===brushSettings.type?' active':'');
    btn.dataset.brush=b.id;
    btn.textContent=b.label;
    btn.onclick=()=>{brushSettings.type=b.id;document.querySelectorAll('#brushTypeGrid .shape-btn').forEach(x=>x.classList.toggle('active',x===btn));};
    g.appendChild(btn);
  });
  const p=document.getElementById('brushPalette');
  QUICK_PALETTE.forEach(c=>{
    const s=document.createElement('div');
    s.className='color-swatch';s.style.background=c;
    s.onclick=()=>{brushSettings.color=c;document.getElementById('brushColor').value=c;document.getElementById('brushColorHex').value=c;};
    p.appendChild(s);
  });
}

function updateBrushSettings(){
  brushSettings.color=document.getElementById('brushColor').value;
  document.getElementById('brushColorHex').value=brushSettings.color;
  brushSettings.size=parseInt(document.getElementById('brushSize').value)||20;
  brushSettings.opacity=parseInt(document.getElementById('brushOpacity').value)||100;
}
function syncBrushColor(){
  const v=document.getElementById('brushColorHex').value;
  if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('brushColor').value=v;updateBrushSettings();}
}

function addBrushLayer(){
  saveHistory();
  const dc=document.createElement('canvas');dc.width=canvasW;dc.height=canvasH;
  layers.push(newLayerBase({type:'draw',name:'Brush Layer '+(layers.filter(l=>l.type==='draw').length+1),x:0,y:0,w:canvasW,h:canvasH,drawCanvas:dc}));
  selectedIndex=layers.length-1;
  updateLayerList();updateRightPanel();redraw();
  showToast('New brush layer created!');
}

function clearBrushLayer(){
  if(selectedIndex<0||layers[selectedIndex].type!=='draw'){showToast('Select a brush layer first!');return;}
  saveHistory();
  const dc=layers[selectedIndex].drawCanvas;
  dc.getContext('2d').clearRect(0,0,dc.width,dc.height);
  redraw();showToast('Brush layer cleared!');
}

function toggleDrawingMode(){
  drawingMode=!drawingMode;
  const btn=document.getElementById('drawModeBtn');
  if(drawingMode){
    if(selectedIndex<0||layers[selectedIndex].type!=='draw') addBrushLayer();
    btn.textContent='🖌 Drawing Mode: ON — tap canvas to draw';
    btn.classList.add('btn-success');
    canvas.style.cursor='crosshair';
  } else {
    btn.textContent='🖌 Drawing Mode: OFF';
    btn.classList.remove('btn-success');
    redraw();
  }
}

function paintAt(x,y,isStart){
  if(selectedIndex<0||layers[selectedIndex].type!=='draw')return;
  // Clamp coordinates within canvas bounds
  x=Math.max(0,Math.min(x,canvasW));
  y=Math.max(0,Math.min(y,canvasH));
  const layer=layers[selectedIndex];
  const dctx=layer.drawCanvas.getContext('2d');
  const {type,color,size,opacity}=brushSettings;
  dctx.save();
  dctx.lineCap='round';dctx.lineJoin='round';
  dctx.globalAlpha=Math.max(0.02,opacity/100);
  dctx.globalCompositeOperation='source-over';
  dctx.shadowBlur=0;dctx.shadowColor='transparent';

  if(type==='eraser'){
    dctx.globalCompositeOperation='destination-out';
    dctx.globalAlpha=1;
    dctx.lineWidth=size;
    dctx.strokeStyle='rgba(0,0,0,1)';
  } else if(type==='highlighter'){
    dctx.globalAlpha=Math.min(opacity/100,0.35);
    dctx.strokeStyle=color;
    dctx.lineWidth=size*1.6;
    dctx.lineCap='square';
  } else if(type==='marker'){
    dctx.globalAlpha=Math.min(opacity/100,0.75);
    dctx.strokeStyle=color;
    dctx.lineWidth=size;
  } else if(type==='neon'){
    dctx.strokeStyle=color;
    dctx.lineWidth=Math.max(2,size*0.35);
    dctx.shadowColor=color;dctx.shadowBlur=size;
  } else if(type==='spray'){
    dctx.fillStyle=color;
    const density=Math.round(size*1.2);
    for(let i=0;i<density;i++){
      const ang=Math.random()*Math.PI*2, rad=Math.random()*size;
      dctx.fillRect(x+Math.cos(ang)*rad, y+Math.sin(ang)*rad, 1.5, 1.5);
    }
    dctx.restore();redraw();return;
  } else { // pencil
    dctx.strokeStyle=color;
    dctx.lineWidth=Math.max(1,size*0.45);
  }

  dctx.beginPath();
  if(isStart||!lastPaintPos){dctx.moveTo(x,y);dctx.lineTo(x+0.01,y+0.01);}
  else{dctx.moveTo(lastPaintPos.x,lastPaintPos.y);dctx.lineTo(x,y);}
  dctx.stroke();
  dctx.restore();
  redraw();
}

function cloneDrawCanvas(src){
  const c=document.createElement('canvas');c.width=src.width;c.height=src.height;
  c.getContext('2d').drawImage(src,0,0);return c;
}

function triggerUpload(){document.getElementById('fileInput').click();}

function handleImageUpload(e){
  const files=Array.from(e.target.files||[]);
  files.forEach(file=>{
    if(!file||!file.type.startsWith('image/'))return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const img=new Image();
      img.onload=()=>{
        saveHistory();
        const maxW=canvasW*.7,maxH=canvasH*.7;
        const sc=Math.min(maxW/img.width,maxH/img.height,1);
        const w=Math.round(img.width*sc),h=Math.round(img.height*sc);
        layers.push(newLayerBase({type:'image',img,name:file.name.substring(0,18),x:Math.round(canvasW/2-w/2),y:Math.round(canvasH/2-h/2),w,h,brightness:100,contrast:100,saturation:100,hueRotate:0,blurFilter:0,sepia:0,grayscale:0,blendMode:'source-over',clipShape:'none',overlayColor:'#ff0000',overlayOpacity:0,imgBorderColor:'#ffffff',imgBorderWidth:0}));
        selectedIndex=layers.length-1;updateLayerList();updateRightPanel();redraw();showToast('Image added!');
      };img.src=ev.target.result;
    };reader.readAsDataURL(file);
  });
  e.target.value='';
}

function handleBgImage(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{const img=new Image();img.onload=()=>{bgImage=img;document.getElementById('bgImgOptions').style.display='block';redraw();showToast('Background set!');};img.src=ev.target.result;};
  reader.readAsDataURL(file);e.target.value='';
}

// ===================== UPDATE PROPS =====================
function updateSelectedText(){
  if(selectedIndex<0||layers[selectedIndex].type!=='text')return;
  const l=layers[selectedIndex];
  l.text=document.getElementById('txtContent').value||' ';
  l.font=document.getElementById('txtFont').value;
  l.size=parseInt(document.getElementById('txtSize').value)||72;
  l.fontWeight=document.getElementById('txtWeight').value;
  l.color=document.getElementById('txtColor').value;
  document.getElementById('txtColorHex').value=l.color;
  l.fillEnabled=document.getElementById('txtFillEnabled').checked;
  l.txtFillType=document.getElementById('txtFillType').value;
  l.grad1=document.getElementById('txtGrad1').value;
  l.grad2=document.getElementById('txtGrad2').value;
  l.txtGradDir=document.getElementById('txtGradDir').value;
  l.strokeEnabled=document.getElementById('txtStrokeEnabled').checked;
  l.letterSpacing=parseInt(document.getElementById('txtSpacing').value)||0;
  l.lineH=parseFloat(document.getElementById('txtLineH').value)||1.2;
  l.outlineColor=document.getElementById('txtOutlineColor').value;
  l.outlineWidth=parseInt(document.getElementById('txtOutlineWidth').value)||0;
  l.shadow=parseInt(document.getElementById('txtShadow').value)||0;
  l.shadowX=parseInt(document.getElementById('txtShadowX').value)||0;
  l.shadowY=parseInt(document.getElementById('txtShadowY').value)||0;
  l.shadowColor=document.getElementById('txtShadowColor').value;
  l.glowSize=parseInt(document.getElementById('txtGlowSize').value)||0;
  l.glowColor=document.getElementById('txtGlowColor').value;
  l.opacity=parseInt(document.getElementById('txtOpacity').value)||100;
  l.bgBox=document.getElementById('txtBgBox').checked;
  l.bgBoxColor=document.getElementById('txtBgBoxColor').value;
  l.bgBoxPad=parseInt(document.getElementById('txtBgBoxPad').value)||10;
  l.bgBoxRadius=parseInt(document.getElementById('txtBgBoxRadius').value)||0;
  toggleTxtFillUI();
  redraw();
}

function toggleTxtFillUI(){
  const t=document.getElementById('txtFillType').value;
  document.getElementById('txtSolidFill').style.display=t==='solid'?'':'none';
  document.getElementById('txtGradFill').style.display=t==='gradient'?'block':'none';
}

function setTextAlign(a,btn){
  document.querySelectorAll('#pane-text .style-row:first-of-type .style-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  if(selectedIndex>=0&&layers[selectedIndex].type==='text'){layers[selectedIndex].align=a;redraw();}
}

function toggleTextStyle(style){
  if(selectedIndex<0||layers[selectedIndex].type!=='text')return;
  const l=layers[selectedIndex];
  if(style==='bold')l.fontWeight=l.fontWeight==='900'?'400':'900';
  else if(style==='italic')l.italic=!l.italic;
  else if(style==='underline')l.underline=!l.underline;
  else if(style==='strike')l.strikethrough=!l.strikethrough;
  else if(style==='allcaps')l.allcaps=!l.allcaps;
  const idMap={bold:'txtBold',italic:'txtItalic',underline:'txtUnder',strike:'txtStrike',allcaps:'txtAllCaps'};
  const btn=document.getElementById(idMap[style]);if(btn)btn.classList.toggle('active');
  redraw();
}

function highlightFont(){const val=document.getElementById('txtFont').value;document.querySelectorAll('.font-preview-btn').forEach(b=>{b.classList.toggle('active',b.dataset.fontName===val);});}

function syncFxShadowColor(){const v=document.getElementById('fxShadowColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('fxShadowColor').value=v;updateFx();}}
function syncFxGlowColor(){const v=document.getElementById('fxGlowColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('fxGlowColor').value=v;updateFx();}}
function syncShapeGlowColor(){const v=document.getElementById('shapeGlowColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('shapeGlowColor').value=v;updateShapeProps();}}
function syncShapeShadowColor(){const v=document.getElementById('shapeShadowColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('shapeShadowColor').value=v;updateShapeProps();}}
function syncShadowAngleXY(){
  const angle=parseInt(document.getElementById('fxShadowAngle').value)||135;
  const spread=parseInt(document.getElementById('fxShadowSpread').value)||0;
  const rad=angle*Math.PI/180;
  const x=Math.round(Math.cos(rad)*spread);
  const y=Math.round(Math.sin(rad)*spread);
  const xs=document.getElementById('fxShadowX');const ys=document.getElementById('fxShadowY');
  if(xs){xs.value=x;const xv=document.getElementById('fxShadowXVal');if(xv)xv.textContent=x;}
  if(ys){ys.value=y;const yv=document.getElementById('fxShadowYVal');if(yv)yv.textContent=y;}
}

function syncColor(prefix){
  if(prefix==='txtShadow'){const v=document.getElementById('txtShadowColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('txtShadowColor').value=v;updateSelectedText();}return;}
  const v=document.getElementById(prefix+'ColorHex').value;
  if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById(prefix+'Color').value=v;updateSelectedText();}
}

function updateShapeProps(){
  if(selectedIndex<0||layers[selectedIndex].type!=='shape')return;
  const l=layers[selectedIndex];
  l.fillEnabled=document.getElementById('shapeFillEnabled').checked;
  l.fillType=document.getElementById('shapeFillType').value;
  l.fill=document.getElementById('shapeFill').value;document.getElementById('shapeFillHex').value=l.fill;
  l.gradC1=document.getElementById('shapeGrad1').value;l.gradC2=document.getElementById('shapeGrad2').value;
  l.gradDir=document.getElementById('shapeGradDir').value;
  l.strokeEnabled=document.getElementById('shapeStrokeEnabled').checked;
  l.borderColor=document.getElementById('shapeBorder').value;l.borderWidth=parseInt(document.getElementById('shapeBorderW').value)||0;
  l.dashStyle=document.getElementById('shapeDash').value;l.cornerRadius=parseInt(document.getElementById('shapeCorner').value)||0;
  l.glowColor=document.getElementById('shapeGlowColor').value;l.glowSize=parseInt(document.getElementById('shapeGlowSize').value)||0;
  l.shadowBlur=parseInt(document.getElementById('shapeShadowBlur').value)||0;
  l.shadowColor=document.getElementById('shapeShadowColor').value;
  l.shadowX=parseInt(document.getElementById('shapeShadowX').value)||4;
  l.shadowY=parseInt(document.getElementById('shapeShadowY').value)||4;
  redraw();
}
function syncShapeFill(){const v=document.getElementById('shapeFillHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){document.getElementById('shapeFill').value=v;if(selectedIndex>=0){layers[selectedIndex].fill=v;redraw();}}}
function toggleShapeFillUI(){const t=document.getElementById('shapeFillType').value;document.getElementById('shapeSolidFill').style.display=t==='solid'?'block':'none';document.getElementById('shapeGradFill').style.display=t==='gradient'?'block':'none';}

// ===================== ADJ SYNC HELPERS =====================
function syncAdj(sliderId, numId, unit){
  const v=document.getElementById(sliderId).value;
  const n=document.getElementById(numId);if(n)n.value=v;
}
function syncAdjFromNum(sliderId, numId){
  const v=document.getElementById(numId).value;
  const s=document.getElementById(sliderId);if(s)s.value=v;
}

function applyImgFilter(preset){
  if(selectedIndex<0||layers[selectedIndex].type!=='image')return;
  const p=IMG_FILTERS[preset]||IMG_FILTERS.none;
  const l=layers[selectedIndex];
  Object.assign(l,p);
  syncImgPanelFromLayer(l);
  document.querySelectorAll('.filter-btn').forEach(b=>{b.classList.toggle('active',b.textContent.toLowerCase().replace(/[ &]/g,'')===preset.replace(/ /g,''));});
  redraw();showToast('Filter: '+preset);
}

function syncImgPanelFromLayer(l){
  const sv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  sv('imgBright',l.brightness??100);        sv('imgBrightN',l.brightness??100);
  sv('imgContrast',l.contrast??100);        sv('imgContrastN',l.contrast??100);
  sv('imgExposure',l.exposure??0);          sv('imgExposureN',l.exposure??0);
  sv('imgHighlights',l.highlights??0);      sv('imgHighlightsN',l.highlights??0);
  sv('imgShadows',l.shadows??0);            sv('imgShadowsN',l.shadows??0);
  sv('imgWhites',l.whites??0);              sv('imgWhitesN',l.whites??0);
  sv('imgBlacks',l.blacks??0);              sv('imgBlacksN',l.blacks??0);
  sv('imgGamma',l.gamma??100);              sv('imgGammaN',l.gamma??100);
  sv('imgSat',l.saturation??100);           sv('imgSatN',l.saturation??100);
  sv('imgVibrance',l.vibrance??0);          sv('imgVibranceN',l.vibrance??0);
  sv('imgHue',l.hueRotate??0);              sv('imgHueN',l.hueRotate??0);
  sv('imgTemp',l.temperature??0);           sv('imgTempN',l.temperature??0);
  sv('imgTint',l.tint??0);                  sv('imgTintN',l.tint??0);
  sv('imgSharpness',l.sharpness??0);        sv('imgSharpnessN',l.sharpness??0);
  sv('imgTexture',l.texture??0);            sv('imgTextureN',l.texture??0);
  sv('imgClarity',l.clarity??0);            sv('imgClarityN',l.clarity??0);
  sv('imgBlurFilter',l.blurFilter??0);      sv('imgBlurN',l.blurFilter??0);
  sv('imgNoise',l.noise??0);                sv('imgNoiseN',l.noise??0);
  sv('imgVignette',l.vignette??0);          sv('imgVignetteN',l.vignette??0);
  sv('imgSepia',l.sepia??0);                sv('imgSepiaNumN',l.sepia??0);
  sv('imgGray',l.grayscale??0);             sv('imgGrayN',l.grayscale??0);
  sv('imgOpacity',l.imgOpacity??100);       sv('imgOpacityN',l.imgOpacity??100);
  sv('imgBorderWidthR',l.imgBorderWidth??0); sv('imgBorderWidth',l.imgBorderWidth??0);
  sv('imgBorderRadiusR',l.imgBorderRadius??0); sv('imgBorderRadiusN',l.imgBorderRadius??0);
  sv('imgOverlayOpacityR',l.overlayOpacity??0); sv('imgOverlayOpacity',l.overlayOpacity??0);
  if(l.imgBorderColor){sv('imgBorderColor',l.imgBorderColor);sv('imgBorderColorHex',l.imgBorderColor);}
  if(l.overlayColor){sv('imgOverlayColor',l.overlayColor);sv('imgOverlayColorHex',l.overlayColor);}
  if(l.blendMode)sv('imgBlend',l.blendMode);
}

function updateImageProps(){
  if(selectedIndex<0||layers[selectedIndex].type!=='image')return;
  const l=layers[selectedIndex];
  const gi=(id,def=0)=>parseInt(document.getElementById(id)?.value)||def;
  l.brightness=gi('imgBright',100);
  l.contrast=gi('imgContrast',100);
  l.exposure=gi('imgExposure',0);
  l.highlights=gi('imgHighlights',0);
  l.shadows=gi('imgShadows',0);
  l.whites=gi('imgWhites',0);
  l.blacks=gi('imgBlacks',0);
  l.gamma=gi('imgGamma',100);
  l.saturation=gi('imgSat',100);
  l.vibrance=gi('imgVibrance',0);
  l.hueRotate=gi('imgHue',0);
  l.temperature=gi('imgTemp',0);
  l.tint=gi('imgTint',0);
  l.sharpness=gi('imgSharpness',0);
  l.texture=gi('imgTexture',0);
  l.clarity=gi('imgClarity',0);
  l.blurFilter=gi('imgBlurFilter',0);
  l.noise=gi('imgNoise',0);
  l.vignette=gi('imgVignette',0);
  l.sepia=gi('imgSepia',0);
  l.grayscale=gi('imgGray',0);
  l.imgOpacity=gi('imgOpacity',100);
  l.imgBorderWidth=gi('imgBorderWidth',0);
  l.imgBorderRadius=gi('imgBorderRadiusN',0);
  l.imgBorderColor=document.getElementById('imgBorderColor')?.value||'#ffffff';
  l.blendMode=document.getElementById('imgBlend')?.value||'source-over';
  l.overlayColor=document.getElementById('imgOverlayColor')?.value||'#ff0000';
  l.overlayOpacity=gi('imgOverlayOpacity',0);
  redraw();
}

function resetImgAdj(){
  if(selectedIndex<0||layers[selectedIndex].type!=='image')return;
  const l=layers[selectedIndex];
  l.brightness=100;l.contrast=100;l.saturation=100;l.hueRotate=0;
  l.blurFilter=0;l.sepia=0;l.grayscale=0;l.exposure=0;l.highlights=0;
  l.shadows=0;l.whites=0;l.blacks=0;l.gamma=100;l.vibrance=0;
  l.temperature=0;l.tint=0;l.sharpness=0;l.texture=0;l.clarity=0;
  l.noise=0;l.vignette=0;l.imgOpacity=100;l.imgBorderWidth=0;l.imgBorderRadius=0;
  l.overlayOpacity=0;l.blendMode='source-over';
  syncImgPanelFromLayer(l);
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  redraw();showToast('Adjustments reset!');
}


function setImgClip(shape){if(selectedIndex<0)return;layers[selectedIndex].clipShape=shape;redraw();}

function updateFx(){
  if(selectedIndex<0)return;
  const l=layers[selectedIndex];
  l.fxBlur=parseInt(document.getElementById('fxBlur').value)||0;
  l.fxBlurType=document.getElementById('fxBlurType').value;
  document.getElementById('motionBlurAngle').style.display=l.fxBlurType==='motion'?'block':'none';
  l.fxMotionAngle=parseInt(document.getElementById('fxMotionAngle').value)||0;
  l.shadowBlur=parseInt(document.getElementById('fxShadowBlur').value)||0;
  l.shadowAngle=parseInt(document.getElementById('fxShadowAngle').value)||135;
  l.shadowSpread=parseInt(document.getElementById('fxShadowSpread').value)||0;
  // Auto-compute X/Y from angle+spread, allow manual X/Y to override
  const rad=l.shadowAngle*Math.PI/180;
  const autoX=Math.round(Math.cos(rad)*l.shadowSpread);
  const autoY=Math.round(Math.sin(rad)*l.shadowSpread);
  // Only auto-sync X/Y when spread or angle was the trigger
  const xSlider=document.getElementById('fxShadowX');
  const ySlider=document.getElementById('fxShadowY');
  l.shadowX=parseInt(xSlider.value)||autoX;
  l.shadowY=parseInt(ySlider.value)||autoY;
  l.shadowColor=document.getElementById('fxShadowColor').value;
  const shCol=document.getElementById('fxShadowColorHex');if(shCol)shCol.value=l.shadowColor;
  l.fxShadowOpacity=parseInt(document.getElementById('fxShadowOpacity').value)||80;
  l.glowColor=document.getElementById('fxGlowColor').value;
  const glCol=document.getElementById('fxGlowColorHex');if(glCol)glCol.value=l.glowColor;
  l.glowSize=parseInt(document.getElementById('fxGlowSize').value)||0;
  l.glowIntensity=parseInt(document.getElementById('fxGlowIntensity').value)||50;
  l.opacity=parseInt(document.getElementById('fxOpacity').value)||100;
  l.blendMode=document.getElementById('fxBlend').value;
  l.rotation=parseInt(document.getElementById('fxRotation').value)||0;
  l.skewX=parseInt(document.getElementById('fxSkewX').value)||0;
  l.skewY=parseInt(document.getElementById('fxSkewY').value)||0;
  l.mask=l.mask||'none';
  l.maskFadeSize=parseInt(document.getElementById('maskFadeSize').value)||30;
  document.getElementById('propRot').value=l.rotation;document.getElementById('propRotVal').textContent=l.rotation+'°';
  updateRightPanel();redraw();
}

function setMask(type){
  if(selectedIndex<0)return;
  layers[selectedIndex].mask=type;
  syncMaskButtons(type);
  redraw();
}
function syncMaskButtons(type){
  document.querySelectorAll('[data-mask]').forEach(b=>b.classList.toggle('active',b.dataset.mask===type));
}

function updateFxPanel(){
  if(selectedIndex<0)return;const l=layers[selectedIndex];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('fxBlur',l.fxBlur||0);document.getElementById('fxBlurVal').textContent=l.fxBlur||0;
  set('fxShadowBlur',l.shadowBlur||0);const sbv=document.getElementById('fxShadowBlurVal');if(sbv)sbv.textContent=l.shadowBlur||0;
  set('fxShadowAngle',l.shadowAngle!=null?l.shadowAngle:135);const sav=document.getElementById('fxShadowAngleVal');if(sav)sav.textContent=(l.shadowAngle!=null?l.shadowAngle:135)+'°';
  set('fxShadowSpread',l.shadowSpread||0);const spv=document.getElementById('fxShadowSpreadVal');if(spv)spv.textContent=l.shadowSpread||0;
  set('fxShadowX',l.shadowX||0);const sxv=document.getElementById('fxShadowXVal');if(sxv)sxv.textContent=l.shadowX||0;
  set('fxShadowY',l.shadowY||0);const syv=document.getElementById('fxShadowYVal');if(syv)syv.textContent=l.shadowY||0;
  set('fxShadowOpacity',l.fxShadowOpacity!=null?l.fxShadowOpacity:80);const sop=document.getElementById('fxShadowOpVal');if(sop)sop.textContent=(l.fxShadowOpacity!=null?l.fxShadowOpacity:80)+'%';
  if(l.shadowColor){set('fxShadowColor',l.shadowColor);set('fxShadowColorHex',l.shadowColor);}
  set('fxGlowSize',l.glowSize||0);const gv=document.getElementById('fxGlowVal');if(gv)gv.textContent=l.glowSize||0;
  set('fxGlowIntensity',l.glowIntensity!=null?l.glowIntensity:50);const giv=document.getElementById('fxGlowIntVal');if(giv)giv.textContent=(l.glowIntensity!=null?l.glowIntensity:50)+'%';
  if(l.glowColor){set('fxGlowColor',l.glowColor);set('fxGlowColorHex',l.glowColor);}
  set('fxOpacity',l.opacity||100);document.getElementById('fxOpVal').textContent=(l.opacity||100)+'%';
  set('fxRotation',l.rotation||0);document.getElementById('rotVal').textContent=(l.rotation||0)+'°';
  set('fxSkewX',l.skewX||0);document.getElementById('skewXVal').textContent=(l.skewX||0)+'°';
  set('fxSkewY',l.skewY||0);document.getElementById('skewYVal').textContent=(l.skewY||0)+'°';
  if(l.blendMode)set('fxBlend',l.blendMode);
  set('maskFadeSize',l.maskFadeSize||30);document.getElementById('maskFadeVal').textContent=(l.maskFadeSize||30)+'%';
  syncMaskButtons(l.mask||'none');
}

function applyBgColor(){bgSolidColor=document.getElementById('bgColor').value;document.getElementById('bgColorHex').value=bgSolidColor;bgType='solid';bgImage=null;document.getElementById('bgImgOptions').style.display='none';redraw();}
function syncBgColor(){const v=document.getElementById('bgColorHex').value;if(/^#[0-9a-fA-F]{6}$/.test(v)){bgSolidColor=v;document.getElementById('bgColor').value=v;bgType='solid';bgImage=null;redraw();}}
function applyGradient(){bgGradient.c1=document.getElementById('grad1').value;bgGradient.c2=document.getElementById('grad2').value;bgGradient.c3=null;bgGradient.dir=document.getElementById('gradDir').value;bgGradient.angle=parseInt(document.getElementById('gradAngle').value)||135;bgType='gradient';bgImage=null;document.getElementById('bgImgOptions').style.display='none';redraw();}

// ===================== RIGHT PANEL SYNC =====================
function updateRightPanel(){
  const none=document.getElementById('selNone'),props=document.getElementById('selProps');
  const none2=document.getElementById('selNone2'),props2=document.getElementById('selProps2');
  if(selectedIndex<0){
    none.style.display='block';props.style.display='none';
    if(none2){none2.style.display='block';props2.style.display='none';}
    return;
  }
  none.style.display='none';props.style.display='block';
  if(none2){none2.style.display='none';props2.style.display='block';}
  const l=layers[selectedIndex];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;const el2=document.getElementById(id+'2');if(el2)el2.value=v;};
  set('propX',Math.round(l.x));set('propY',Math.round(l.y));
  set('propW',Math.round(l.w));set('propH',Math.round(l.h));
  set('propRot',l.rotation||0);
  document.getElementById('propRotVal').textContent=(l.rotation||0)+'°';
  const pRV2=document.getElementById('propRotVal2');if(pRV2)pRV2.textContent=(l.rotation||0)+'°';
  set('propOpacity',l.opacity||100);
  document.getElementById('propOpVal').textContent=(l.opacity||100)+'%';
  const pOV2=document.getElementById('propOpVal2');if(pOV2)pOV2.textContent=(l.opacity||100)+'%';
  // sync canvas info
  const ci3=document.getElementById('canvasInfo3');if(ci3)ci3.textContent=canvasW+' × '+canvasH+' px';

  if(l.type==='text'){
    set('txtContent',l.text);set('txtFont',l.font);set('txtSize',l.size);
    set('txtWeight',l.fontWeight||'700');set('txtColor',l.color||'#ffffff');
    set('txtColorHex',l.color||'#ffffff');set('txtSpacing',l.letterSpacing||0);
    document.getElementById('lsVal').textContent=l.letterSpacing||0;
    set('txtLineH',l.lineH||1.2);document.getElementById('lhVal').textContent=(l.lineH||1.2).toFixed(2);
    set('txtOutlineWidth',l.outlineWidth||0);
    set('txtShadow',l.shadow||0);set('txtShadowX',l.shadowX||2);set('txtShadowY',l.shadowY||2);
    set('txtGlowSize',l.glowSize||0);set('txtOpacity',l.opacity||100);
    document.getElementById('txtOpVal').textContent=(l.opacity||100)+'%';
    document.getElementById('txtFillType').value=l.txtFillType||'solid';
    const tfe=document.getElementById('txtFillEnabled');if(tfe)tfe.checked=l.fillEnabled!==false;
    const tse=document.getElementById('txtStrokeEnabled');if(tse)tse.checked=l.strokeEnabled===true;
    document.getElementById('txtBgBox').checked=l.bgBox||false;
    if(l.bgBoxColor)set('txtBgBoxColor',l.bgBoxColor);
    set('txtBgBoxPad',l.bgBoxPad||10);set('txtBgBoxRadius',l.bgBoxRadius||0);
    document.getElementById('bgBoxRadVal').textContent=l.bgBoxRadius||0;
    toggleTxtFillUI();
  }
  if(l.type==='shape'){
    set('shapeFill',l.fill||'#c8a96e');set('shapeFillHex',l.fill||'#c8a96e');
    set('shapeBorder',l.borderColor||'#ffffff');set('shapeBorderW',l.borderWidth||0);
    document.getElementById('shapeFillType').value=l.fillType||'solid';
    set('shapeCorner',l.cornerRadius||0);document.getElementById('cornerVal').textContent=l.cornerRadius||0;
    const sfe=document.getElementById('shapeFillEnabled');if(sfe)sfe.checked=l.fillEnabled!==false;
    const sse=document.getElementById('shapeStrokeEnabled');if(sse)sse.checked=l.strokeEnabled===true;
    // sync shape glow/shadow sliders
    const sgv=document.getElementById('shapeShadowBlurVal');if(sgv)sgv.textContent=l.shadowBlur||0;
    const sgxv=document.getElementById('shapeShadowXVal');if(sgxv)sgxv.textContent=l.shadowX!=null?l.shadowX:4;
    const sgyv=document.getElementById('shapeShadowYVal');if(sgyv)sgyv.textContent=l.shadowY!=null?l.shadowY:4;
    const sglv=document.getElementById('shapeGlowVal');if(sglv)sglv.textContent=l.glowSize||0;
    const shapeSB=document.getElementById('shapeShadowBlur');if(shapeSB)shapeSB.value=l.shadowBlur||0;
    const shapeSX=document.getElementById('shapeShadowX');if(shapeSX)shapeSX.value=l.shadowX!=null?l.shadowX:4;
    const shapeSY=document.getElementById('shapeShadowY');if(shapeSY)shapeSY.value=l.shadowY!=null?l.shadowY:4;
    const shapeGL=document.getElementById('shapeGlowSize');if(shapeGL)shapeGL.value=l.glowSize||0;
    if(l.shadowColor){set('shapeShadowColor',l.shadowColor);set('shapeShadowColorHex',l.shadowColor);}
    if(l.glowColor){set('shapeGlowColor',l.glowColor);set('shapeGlowColorHex',l.glowColor);}
    toggleShapeFillUI();
  }
  if(l.type==='image'){
    syncImgPanelFromLayer(l);
  }
  updateFxPanel();
}

function updatePropPos(){if(selectedIndex<0)return;layers[selectedIndex].x=parseInt(document.getElementById('propX').value)||0;layers[selectedIndex].y=parseInt(document.getElementById('propY').value)||0;redraw();}
function updatePropSize(){if(selectedIndex<0)return;layers[selectedIndex].w=parseInt(document.getElementById('propW').value)||100;layers[selectedIndex].h=parseInt(document.getElementById('propH').value)||100;redraw();}
function updatePropRot(){if(selectedIndex<0)return;layers[selectedIndex].rotation=parseInt(document.getElementById('propRot').value)||0;document.getElementById('rotVal').textContent=layers[selectedIndex].rotation+'°';document.getElementById('fxRotation').value=layers[selectedIndex].rotation;redraw();}
function updatePropOpacity(){if(selectedIndex<0)return;layers[selectedIndex].opacity=parseInt(document.getElementById('propOpacity').value)||100;document.getElementById('fxOpacity').value=layers[selectedIndex].opacity;document.getElementById('fxOpVal').textContent=layers[selectedIndex].opacity+'%';redraw();}

// Mirror functions for pane-object panel
function updatePropPos2(){if(selectedIndex<0)return;layers[selectedIndex].x=parseInt(document.getElementById('propX2').value)||0;layers[selectedIndex].y=parseInt(document.getElementById('propY2').value)||0;redraw();}
function updatePropSize2(){if(selectedIndex<0)return;layers[selectedIndex].w=parseInt(document.getElementById('propW2').value)||100;layers[selectedIndex].h=parseInt(document.getElementById('propH2').value)||100;redraw();}
function updatePropRot2(){if(selectedIndex<0)return;layers[selectedIndex].rotation=parseInt(document.getElementById('propRot2').value)||0;const rv=document.getElementById('rotVal');if(rv)rv.textContent=layers[selectedIndex].rotation+'°';const fxr=document.getElementById('fxRotation');if(fxr)fxr.value=layers[selectedIndex].rotation;redraw();}
function updatePropOpacity2(){if(selectedIndex<0)return;layers[selectedIndex].opacity=parseInt(document.getElementById('propOpacity2').value)||100;const fo=document.getElementById('fxOpacity');if(fo)fo.value=layers[selectedIndex].opacity;const fov=document.getElementById('fxOpVal');if(fov)fov.textContent=layers[selectedIndex].opacity+'%';redraw();}

// ===================== LAYER OPS =====================
function moveLayer(dir){if(selectedIndex<0)return;moveLayerAt(selectedIndex,dir);}
function bringToFront(){if(selectedIndex<0)return;const l=layers.splice(selectedIndex,1)[0];layers.push(l);selectedIndex=layers.length-1;updateLayerList();redraw();}
function sendToBack(){if(selectedIndex<0)return;const l=layers.splice(selectedIndex,1)[0];layers.unshift(l);selectedIndex=0;updateLayerList();redraw();}
function deleteSelected(){if(selectedIndex<0)return;saveHistory();layers.splice(selectedIndex,1);selectedIndex=Math.min(selectedIndex,layers.length-1);updateLayerList();updateRightPanel();redraw();}
function toggleLockSelected(){if(selectedIndex<0)return;layers[selectedIndex].locked=!layers[selectedIndex].locked;updateLayerList();showToast(layers[selectedIndex].locked?'Locked':'Unlocked');}

function duplicateSelected(){
  if(selectedIndex<0)return;saveHistory();
  const src=layers[selectedIndex];
  const copy={...src,img:src.img,x:src.x+20,y:src.y+20,name:(src.name||'Layer')+' Copy'};
  if(src.type==='draw'&&src.drawCanvas) copy.drawCanvas=cloneDrawCanvas(src.drawCanvas);
  layers.splice(selectedIndex+1,0,copy);selectedIndex=selectedIndex+1;
  updateLayerList();updateRightPanel();redraw();showToast('Duplicated!');
}

function flipH(){
  if(selectedIndex<0)return;saveHistory();
  const l=layers[selectedIndex];
  if(l.type==='image'&&l.img){
    const off=document.createElement('canvas');off.width=l.img.width;off.height=l.img.height;
    const oc=off.getContext('2d');oc.translate(l.img.width,0);oc.scale(-1,1);oc.drawImage(l.img,0,0);
    const ni=new Image();ni.src=off.toDataURL();ni.onload=()=>{l.img=ni;redraw();};
  } else {l.rotation=(l.rotation||0)+(l.type==='text'?0:0);l.skewY=(l.skewY||0)*-1;}
  showToast('Flipped!');redraw();
}
function flipV(){if(selectedIndex<0)return;saveHistory();const l=layers[selectedIndex];l.skewX=(l.skewX||0)*-1;showToast('Flipped V!');redraw();}

function alignLayer(type){
  if(selectedIndex<0)return;saveHistory();const l=layers[selectedIndex];
  if(type==='left')l.x=0;else if(type==='right')l.x=canvasW-l.w;else if(type==='center-h')l.x=canvasW/2-l.w/2;
  else if(type==='top')l.y=0;else if(type==='bottom')l.y=canvasH-l.h;else if(type==='center-v')l.y=canvasH/2-l.h/2;
  updateRightPanel();redraw();
}

function updateLayerList(){
  const list=document.getElementById('layerList');list.innerHTML='';
  const icons={
    text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    shape: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`,
    sticker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    draw: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M6 14c0-2 2-3 4-3s3 1 3 3-2 3-4 3-3-1-3-3z"/></svg>`
  };
  [...layers].reverse().forEach((l,ri)=>{
    const i=layers.length-1-ri;
    const div=document.createElement('div');
    div.className='layer-item'+(i===selectedIndex?' selected':'');
    div.draggable=true;
    // lock icon: clearly colored SVGs
    const lockIcon=l.locked
      ? `<span class="layer-lock locked-on" onclick="toggleLock(${i},event)" title="Unlock layer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`
      : `<span class="layer-lock" onclick="toggleLock(${i},event)" title="Lock layer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></span>`;
    const visIcon=l.visible!==false
      ? `<span class="layer-vis" onclick="toggleVis(${i},event)" title="Hide"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>`
      : `<span class="layer-vis vis-hidden" onclick="toggleVis(${i},event)" title="Show"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></span>`;
    // order arrows
    const upBtn=`<span class="layer-order-btn" onclick="moveLi(${i},-1,event)" title="Move up"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg></span>`;
    const dnBtn=`<span class="layer-order-btn" onclick="moveLi(${i},1,event)" title="Move down"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg></span>`;
    div.innerHTML=`<span class="layer-drag-handle" title="Drag to reorder">⠿</span><span class="layer-icon">${icons[l.type]||'◼'}</span><span class="layer-name">${l.name||l.text||l.shape||'Layer'}</span>${visIcon}${lockIcon}<span class="layer-order-wrap">${upBtn}${dnBtn}</span><span class="layer-del" onclick="delLayer(${i},event)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
    div.onclick=(e)=>{
      if(e.target.classList.contains('layer-del')||e.target.classList.contains('layer-vis')||e.target.classList.contains('layer-lock')||e.target.classList.contains('layer-order-btn')||e.target.classList.contains('layer-drag-handle'))return;
      selectedIndex=i;updateLayerList();updateRightPanel();updateFxPanel();redraw();
    };
    // drag reorder
    div.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));div.style.opacity='0.5';});
    div.addEventListener('dragend',e=>{div.style.opacity='1';});
    div.addEventListener('dragover',e=>{e.preventDefault();div.style.borderColor='var(--accent)';});
    div.addEventListener('dragleave',e=>{div.style.borderColor='';});
    div.addEventListener('drop',e=>{
      e.preventDefault();div.style.borderColor='';
      const fromIdx=parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx=i;
      if(fromIdx===toIdx)return;
      const moved=layers.splice(fromIdx,1)[0];
      layers.splice(toIdx,0,moved);
      selectedIndex=toIdx;
      updateLayerList();redraw();showToast('Layer reordered');
    });
    list.appendChild(div);
  });
  updateMobileQuickActions();
}
function moveLi(i,dir,e){e.stopPropagation();moveLayerAt(i,dir);}
function moveLayerAt(i,dir){
  const ni=i+dir;
  if(ni<0||ni>=layers.length)return;
  [layers[i],layers[ni]]=[layers[ni],layers[i]];
  if(selectedIndex===i)selectedIndex=ni;
  else if(selectedIndex===ni)selectedIndex=i;
  updateLayerList();redraw();
}
function toggleVis(i,e){e.stopPropagation();layers[i].visible=layers[i].visible===false?true:false;updateLayerList();redraw();}
function toggleLock(i,e){e.stopPropagation();layers[i].locked=!layers[i].locked;updateLayerList();showToast(layers[i].locked?'🔒 Locked':'🔓 Unlocked');}
function delLayer(i,e){e.stopPropagation();saveHistory();layers.splice(i,1);if(selectedIndex>=i)selectedIndex=Math.max(-1,selectedIndex-1);updateLayerList();updateRightPanel();redraw();}

// ===================== TEMPLATES =====================
function buildTemplateGrid(){
  const grid=document.getElementById('templateGrid');
  TEMPLATES.forEach(t=>{
    const d=document.createElement('div');
    d.className='template-thumb';
    d.style.background=`linear-gradient(135deg,${t.bg[0]},${t.bg[1]||t.bg[0]})`;
    d.style.fontFamily=`"${t.font}"`;d.style.color=t.txtColor;
    d.textContent=t.name;d.title=t.name;
    d.onclick=()=>applyTemplate(t);
    grid.appendChild(d);
  });
}
function applyTemplate(t){
  saveHistory();layers=[];
  bgType='gradient';bgImage=null;
  bgGradient.c1=t.bg[0];bgGradient.c2=t.bg[1]||t.bg[0];bgGradient.dir='to bottom right';
  document.getElementById('grad1').value=bgGradient.c1;document.getElementById('grad2').value=bgGradient.c2;
  layers.push(newLayerBase({type:'text',text:t.txt,x:canvasW*.05,y:canvasH/2-t.size*.75,w:canvasW*.9,h:t.size*1.5,color:t.txtColor,size:t.size,font:t.font,fontWeight:'700',align:'center',letterSpacing:0,lineH:1.2,shadow:8,shadowX:3,shadowY:3,shadowColor:'#000000',outlineWidth:0,outlineColor:'#000',glowSize:0,glowColor:'#fff',txtFillType:'solid',grad1:'#fff',grad2:'#c8a96e',txtGradDir:'to right',italic:false,underline:false,strikethrough:false,allcaps:false,bgBox:false,bgBoxColor:'#fff',bgBoxPad:10,bgBoxRadius:0,name:'Main Title'}));
  selectedIndex=0;updateLayerList();updateRightPanel();redraw();showToast('Template: '+t.name);
  closeModal('templatesModal');
}

function buildGradGrid(){
  const grid=document.getElementById('gradGrid');
  GRADIENTS.forEach(g=>{
    const d=document.createElement('div');d.className='grad-swatch';
    d.style.background=`linear-gradient(135deg,${g[0]},${g[1]||g[0]})`;
    d.onclick=()=>{bgType='gradient';bgImage=null;bgGradient.c1=g[0];bgGradient.c2=g[1]||g[0];bgGradient.dir='to bottom right';document.getElementById('grad1').value=g[0];document.getElementById('grad2').value=g[1]||g[0];document.getElementById('bgImgOptions').style.display='none';redraw();};
    grid.appendChild(d);
  });
}

// ===================== HISTORY =====================
function serializeLayers(){
  return layers.map(l=>{
    const o={...l,img:l.img?'__img__':null,imgSrc:l.img?l.img.src:null};
    if(l.type==='draw'&&l.drawCanvas){o.drawCanvas=undefined;o.drawDataUrl=l.drawCanvas.toDataURL();}
    return o;
  });
}
function deserializeLayers(arr){
  return arr.map(l=>{
    if(l.imgSrc){const img=new Image();img.src=l.imgSrc;l.img=img;}else l.img=null;
    if(l.drawDataUrl){
      const c=document.createElement('canvas');c.width=l.w;c.height=l.h;
      const im=new Image();
      im.onload=()=>{c.getContext('2d').drawImage(im,0,0,l.w,l.h);redraw();};
      im.src=l.drawDataUrl;
      l.drawCanvas=c;
    }
    return l;
  });
}
function saveHistory(){
  historyStack.push(JSON.stringify({layers:serializeLayers(),bgType,bgSolidColor,bgGradient}));
  if(historyStack.length>30)historyStack.shift();redoStack=[];
}
function restoreState(state){
  const s=JSON.parse(state);bgType=s.bgType;bgSolidColor=s.bgSolidColor;bgGradient=s.bgGradient;
  layers=deserializeLayers(s.layers);
  selectedIndex=-1;updateLayerList();updateRightPanel();redraw();
}
function undo(){if(!historyStack.length)return;redoStack.push(JSON.stringify({layers:serializeLayers(),bgType,bgSolidColor,bgGradient}));restoreState(historyStack.pop());showToast('Undo!');}
function redo(){if(!redoStack.length)return;historyStack.push(JSON.stringify({layers:serializeLayers(),bgType,bgSolidColor,bgGradient}));restoreState(redoStack.pop());showToast('Redo!');}

// ===================== EXPORT =====================
function getExportCanvas(){
  const sc=parseFloat((document.getElementById('exportScale2')||document.getElementById('exportScale')).value)||1;
  if(sc===1) return canvas;
  const off=document.createElement('canvas');off.width=canvasW*sc;off.height=canvasH*sc;
  const oc=off.getContext('2d');oc.scale(sc,sc);oc.drawImage(canvas,0,0);return off;
}
function exportPNG(){const tmp=selectedIndex;selectedIndex=-1;redraw();const c=getExportCanvas();const a=document.createElement('a');a.download=`thumbnail_${canvasW}x${canvasH}.png`;a.href=c.toDataURL('image/png');a.click();selectedIndex=tmp;redraw();showToast('PNG exported!');}
function exportJPG(){const q=parseInt((document.getElementById('jpgQuality2')||document.getElementById('jpgQuality')).value)/100;const tmp=selectedIndex;selectedIndex=-1;redraw();const c=getExportCanvas();const a=document.createElement('a');a.download=`thumbnail_${canvasW}x${canvasH}.jpg`;a.href=c.toDataURL('image/jpeg',q);a.click();selectedIndex=tmp;redraw();showToast('JPG exported!');}
function exportWebP(){const tmp=selectedIndex;selectedIndex=-1;redraw();const c=getExportCanvas();const a=document.createElement('a');a.download=`thumbnail_${canvasW}x${canvasH}.webp`;a.href=c.toDataURL('image/webp',0.92);a.click();selectedIndex=tmp;redraw();showToast('WebP exported!');}

// ===================== SAVE / LOAD PROJECT =====================
function saveProject(){
  const data={version:2,canvasW,canvasH,bgType,bgSolidColor,bgGradient,layers:serializeLayers()};
  const a=document.createElement('a');a.download='thumbnail-project.json';a.href='data:application/json,'+encodeURIComponent(JSON.stringify(data));a.click();showToast('Project saved!');
}
function loadProject(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(d.version){canvasW=d.canvasW||1280;canvasH=d.canvasH||720;bgType=d.bgType;bgSolidColor=d.bgSolidColor;bgGradient=d.bgGradient;
      layers=deserializeLayers(d.layers);
      fitCanvas();selectedIndex=-1;updateLayerList();updateRightPanel();redraw();showToast('Project loaded!');}
    }catch(err){showToast('Invalid project file');}
  };reader.readAsText(file);e.target.value='';
}

// ===================== APP MODE (MOBILE) =====================
function toggleRightPanel(){
  const rp = document.getElementById('rightPanelEl');
  const btn = document.getElementById('rpToggle');
  rp.classList.toggle('collapsed');
  btn.textContent = rp.classList.contains('collapsed') ? '◂' : '▸';
  setTimeout(fitCanvas, 230);
}
function toggleAppSheet(which){
  const left=document.getElementById('leftPanelEl');
  const right=document.getElementById('rightPanelEl');
  const backdrop=document.getElementById('appSheetBackdrop');
  const btnTools=document.getElementById('appNavTools');
  const btnProps=document.getElementById('appNavProps');
  const target = which==='left' ? left : right;
  const isOpen = target.classList.contains('sheet-open');

  left.classList.remove('sheet-open');
  right.classList.remove('sheet-open');
  btnTools.classList.remove('active');
  btnProps.classList.remove('active');

  if(!isOpen){
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

function initAppMode(){
  if(window.matchMedia('(max-width:768px)').matches){
    document.body.classList.add('app-mode');
    setTimeout(fitCanvasToMobile, 50);
  }
}
window.addEventListener('resize', ()=>{
  const isMobile = window.matchMedia('(max-width:768px)').matches;
  document.body.classList.toggle('app-mode', isMobile);
  if(!isMobile) closeAppSheets();
  setTimeout(fitCanvasToMobile, 50);
});
initAppMode();


function clearCanvas(){if(!confirm('Clear all layers?'))return;saveHistory();layers=[];selectedIndex=-1;updateLayerList();updateRightPanel();redraw();}

function switchTab(el,pane){
  const leftPanel = el.closest('.left-panel');
  const wasActive = el.classList.contains('active');
  el.closest('.panel-tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  leftPanel.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');document.getElementById('pane-'+pane).classList.add('active');

  // On desktop, clicking the already-active tab toggles the drawer closed/open
  if(window.innerWidth>768){
    if(wasActive && leftPanel.classList.contains('drawer-open')){
      leftPanel.classList.remove('drawer-open');
    } else {
      leftPanel.classList.add('drawer-open');
    }
  } else {
    // On mobile, open the sheet
    leftPanel.classList.add('sheet-open');
    document.getElementById('appSheetBackdrop').classList.add('show');
    document.getElementById('appNavTools').classList.add('active');
  }
}

function switchTabByName(pane){
  const tabs=document.querySelectorAll('#leftTabs .tab');
  const panes=document.querySelectorAll('.tab-pane');
  const map={layers:0,object:1,add:2,text:3,shape:4,image:5,brush:6,fx:7,bg:8};
  const idx=map[pane];if(idx==null)return;
  tabs.forEach((t,i)=>t.classList.toggle('active',i===idx));
  panes.forEach(p=>p.classList.remove('active'));
  document.getElementById('pane-'+pane).classList.add('active');
  const leftPanel=document.getElementById('leftPanelEl');
  if(window.innerWidth>768){
    leftPanel.classList.add('drawer-open');
  } else {
    leftPanel.classList.add('sheet-open');
    document.getElementById('appSheetBackdrop').classList.add('show');
    document.getElementById('appNavTools').classList.add('active');
  }
}
function scrollTabs(id,dir){
  const el=document.getElementById(id);
  el.scrollBy({left:dir*100,behavior:'smooth'});
}

function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}

// ===================== MOBILE MODALS =====================
function openMobileFx(){if(selectedIndex<0){showToast('Select a layer first!');return;}document.getElementById('mobileFxModal').classList.add('show');}
function mobileToggleDraw(){
  toggleDrawingMode();
  const btn=document.getElementById('mobDrawBtn');
  btn.classList.toggle('active',drawingMode);
  if(drawingMode) switchTabByName('brush');
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
  if(window.innerWidth > 768) {
    bar.style.display = 'none';
    return;
  }
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
