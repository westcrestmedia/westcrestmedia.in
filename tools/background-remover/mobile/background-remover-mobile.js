/* ═══════════════════════════════════════════════════════════
   MOBILE BACKGROUND REMOVER — Self-contained JS
   No dependency on desktop .js or .css
   All state, canvas logic, touch handling, UI — everything here
═══════════════════════════════════════════════════════════ */

/* ── AI Model ── */
const LIB_VERSION = '1.5.5';
let removeBackground = null;
async function loadLib() {
  if (removeBackground) return removeBackground;
  const mod = await import(`https://cdn.jsdelivr.net/npm/@imgly/background-removal@${LIB_VERSION}/+esm`);
  removeBackground = mod.removeBackground || mod.default || Object.values(mod).find(v=>typeof v==='function');
  if (!removeBackground) throw new Error('removeBackground not found');
  return removeBackground;
}

/* ── Batch State ── */
const MAX_BATCH = 20;
let items = [];
let activeId = null;
let editorOpened = false;
let batchLoopRunning = false;

/* ── Editor State ── */
let wCanvas = null, wCtx = null, origData = null;
let brushMode = null, isPainting = false;
window.brushSize = 20;
window.smartEdge = false;
window.smartEdgeTol = 30;
const MAX_UNDO = 30;
let undoStack = [], redoStack = [];
let zoom = 1, panX = 0, panY = 0;
let isPanning = false, panStart = {x:0,y:0};
let lastTouches = null;
let beforeAfterMode = false;
let baseW = 0, baseH = 0;

/* ── BG/Effects State ── */
let currentBgColor = 'transparent';
let currentPhotoBg = null;
let shadowEnabled=false, shadowColor='#000000', shadowOpacity=60, shadowBlur=20, shadowDistance=10, shadowAngle=135;
let bgBlur=0;
let outlineEnabled=false, outlineColor='#ffffff', outlineWidth=4;
let glowEnabled=false, glowColor='#c8a96e', glowStrength=60, glowBlur=20;
let featherRadius=0;
let subjectScale=1, subjectX=0, subjectY=0, subjectRotation=0;
let flipX=false, flipY=false;
let bgScale=1, bgOffsetX=0, bgOffsetY=0;

/* ── Canvas elements ── */
const viewport = document.getElementById('canvas-viewport');
const dc       = document.getElementById('display-canvas');
const dctx     = dc.getContext('2d', {willReadFrequently:true});
const cc       = document.getElementById('cursor-canvas');
const cctx     = cc.getContext('2d');

/* ── File input ── */
const fileIn   = document.getElementById('file-in');
const dropZone = document.getElementById('drop-zone');
fileIn.addEventListener('change', e => { if (e.target.files.length) addFiles(Array.from(e.target.files)); });
dropZone.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') fileIn.click(); });

/* ── Helpers ── */
function loadImg(src){
  return new Promise((res,rej)=>{
    const i=new Image(); i.crossOrigin='anonymous';
    i.onload=()=>res(i);
    i.onerror=()=>{const i2=new Image();i2.onload=()=>res(i2);i2.onerror=()=>rej(new Error('load fail'));i2.src=src+(src.includes('?')?'&':'?')+'_t='+Date.now();};
    i.src=src;
  });
}

/* ── Upload overlay ── */
function showUploadOverlay(t,s){document.getElementById('upload-overlay-title').textContent=t;document.getElementById('upload-overlay-sub').textContent=s;document.getElementById('upload-overlay').classList.add('active');}
function hideUploadOverlay(){document.getElementById('upload-overlay').classList.remove('active');}

/* ── Add Files ── */
async function addFiles(files){
  files=files.slice(0,MAX_BATCH-items.length); if(!files.length)return;
  const isSingle=files.length===1;
  showUploadOverlay(isSingle?'Loading Image…':'Loading '+files.length+' Images…','Preparing files…');
  await new Promise(r=>setTimeout(r,400));
  files.forEach(f=>items.push({id:Date.now()+Math.random(),file:f,resultCanvas:null,status:'queued',name:f.name}));
  dropZone.classList.add('hidden');
  renderBatchGrid(); updateBatchHeader(); hideUploadOverlay();
  if(batchLoopRunning){renderBatchGrid();updateBatchHeader();return;}
  batchLoopRunning=true;
  // Run in background — don't block; first-done photo opens editor, rest process silently
  (async()=>{
    try{
      let next;
      while((next=items.find(i=>i.status==='queued'))){
        await processItem(next);
        if(next.status==='done'&&!editorOpened){editorOpened=true;openEditor(next.id);}
      }
      updateBatchHeader();
    }finally{batchLoopRunning=false;}
  })();
}

/* ── Render Batch Grid ── */
function renderBatchGrid(){
  const grid=document.getElementById('batch-grid');
  grid.innerHTML='';
  items.forEach(item=>{
    const card=document.createElement('div');
    card.className='batch-card'+(item.id===activeId?' active-edit':'');
    card.dataset.id=item.id;
    card.innerHTML=`
      <div class="batch-thumb-wrap" id="thumb-${item.id}">
        <img style="width:100%;height:100%;object-fit:contain;${item.resultCanvas?'display:none':''}" src="${item.resultCanvas?'':URL.createObjectURL(item.file)}">
        ${item.resultCanvas?`<canvas width="${item.resultCanvas.width}" height="${item.resultCanvas.height}" style="max-width:100%;max-height:100%;"></canvas>`:''}
        <span class="batch-status ${item.status}">${{queued:'Queued',processing:'Processing…',done:'Done',error:'Error'}[item.status]}</span>
        <button class="batch-remove-btn" onclick="removeItem('${item.id}');event.stopPropagation();" ${item.status==='processing'?'disabled':''}>✕</button>
        <div class="batch-progress-bar"><div class="batch-progress-fill" id="prog-${item.id}"></div></div>
        <div class="card-proc-overlay${item.status==='processing'?' active':''}">
          <div class="card-spinner"></div>
          <div class="card-proc-label">AI Processing</div>
        </div>
      </div>
      <div class="batch-card-footer">
        <span class="batch-name" title="${item.name}">${item.name}</span>
        <button class="batch-dl-btn" ${item.status!=='done'?'disabled':''} onclick="downloadItem('${item.id}');event.stopPropagation();">⬇</button>
      </div>`;
    if(item.resultCanvas){const cvs=card.querySelector('canvas');if(cvs)cvs.getContext('2d').drawImage(item.resultCanvas,0,0);}
    card.addEventListener('click',()=>{if(item.status==='done')openEditor(item.id,true);});
    // Visual hint: done cards are always interactive even while batch is processing
    if(item.status==='done') card.style.cursor='pointer';
    grid.appendChild(card);
  });
  if(items.length>0&&items.length<MAX_BATCH){
    const more=document.createElement('div');
    more.className='batch-add-more';
    more.innerHTML='<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add More</span>';
    more.addEventListener('click',()=>fileIn.click());
    grid.appendChild(more);
  }
}

function updateBatchHeader(){
  const hdr=document.getElementById('batch-header');
  hdr.classList.toggle('active',items.length>0);
  document.getElementById('batch-title-text').textContent=items.length+' image'+(items.length!==1?'s':'');
}

window.removeItem=function(id){
  const idx=items.findIndex(i=>i.id==id); if(idx===-1)return;
  items.splice(idx,1);
  if(activeId==id){activeId=null;wCanvas=null;wCtx=null;origData=null;document.getElementById('editor-wrap').classList.remove('active');showToolbar(false);}
  if(!items.length){dropZone.classList.remove('hidden');document.getElementById('batch-header').classList.remove('active');}
  renderBatchGrid(); updateBatchHeader();
};

/* ── Process Item ── */
async function processItem(item){
  item.status='processing'; renderBatchGrid();
  const ov=document.getElementById('proc-overlay');
  // Show full-screen overlay ONLY for the very first image (before any editor has opened)
  // Once editor is open, user can keep working — only card-level spinner shows for queued photos
  const showOnCanvas=!editorOpened&&!activeId;
  const modelCached=localStorage.getItem('wc_model_cached')==='1';

  function setStage(n){for(let i=1;i<=4;i++){const el=document.getElementById('proc-stage-'+i);if(el)el.classList.toggle('active',i===n);}}

  if(showOnCanvas){
    document.getElementById('editor-wrap').classList.add('active');
    document.getElementById('editor-filename').textContent=item.name;
    setStage(1);
    document.getElementById('proc-title').textContent='Preparing AI Engine…';
    document.getElementById('proc-sub').textContent=modelCached?'Loading from cache…':'Starting AI engine…';
    document.getElementById('proc-pct').textContent='AI';
    document.getElementById('proc-hint').style.display=modelCached?'none':'';
    ov.classList.add('active');
  }

  try{
    const rbFn=await loadLib();
    if(showOnCanvas){setStage(modelCached?3:2);document.getElementById('proc-title').textContent=modelCached?'Optimising Image…':'Downloading AI Model…';document.getElementById('proc-sub').textContent=modelCached?'Preparing image…':'~40 MB (once only, cached after)';}
    let lastStage='';
    const blob=await rbFn(item.file,{
      publicPath:`https://staticimgly.com/@imgly/background-removal-data/${LIB_VERSION}/dist/`,
      proxyToWorker:true,
      numThreads:1,
      progress:(key,cur,tot)=>{
        const p=tot>0?Math.round(cur/tot*100):0;
        const bar=document.getElementById('prog-'+item.id);if(bar)bar.style.width=p+'%';
        if(!showOnCanvas)return;
        if(key&&key.includes('fetch')&&lastStage!=='fetch'){lastStage='fetch';setStage(2);document.getElementById('proc-title').textContent='Downloading AI Model…';document.getElementById('proc-sub').textContent=modelCached?'Loading from cache…':'First-time download ~40MB';}
        else if(key&&key.includes('execute')&&lastStage!=='execute'){lastStage='execute';setStage(3);document.getElementById('proc-title').textContent='Optimising Image…';localStorage.setItem('wc_model_cached','1');}
        else if(lastStage!=='remove'&&(key.includes('inference')||key.includes('segment')||key.includes('output'))){lastStage='remove';setStage(4);document.getElementById('proc-title').textContent='Removing Background…';localStorage.setItem('wc_model_cached','1');}
        if(p>0)document.getElementById('proc-pct').textContent=p+'%';
      },
      model:'small',
      output:{format:'image/png',quality:1},
    });
    const img=await loadImg(URL.createObjectURL(blob));
    const cvs=document.createElement('canvas');cvs.width=img.naturalWidth;cvs.height=img.naturalHeight;
    cvs.getContext('2d').drawImage(img,0,0);
    item.resultCanvas=cvs;item.status='done';
    if(showOnCanvas){setStage(4);document.getElementById('proc-pct').textContent='✓';document.getElementById('proc-title').textContent='Done!';await new Promise(r=>setTimeout(r,500));}
  }catch(err){
    item.status='error';console.error(err);
    if(showOnCanvas){document.getElementById('proc-pct').textContent='!';document.getElementById('proc-title').textContent='Something went wrong. Try again.';}
  }
  if(showOnCanvas)ov.classList.remove('active');
  // Only hide editor if there's truly nothing to show (no previous canvas loaded)
  if(showOnCanvas&&item.status==='error'&&!wCanvas){
    document.getElementById('editor-wrap').classList.remove('active');
    showToolbar(false);
  } else if(showOnCanvas&&item.status==='error'&&wCanvas){
    // Keep toolbar visible — previous image still loaded
    showToolbar(true);
  }
  renderBatchGrid();
}

/* ── Open Editor ── */
async function openEditor(id, noScroll){
  const item=items.find(i=>i.id==id); if(!item||!item.resultCanvas)return;
  activeId=id;
  document.getElementById('editor-wrap').classList.add('active');
  showToolbar(true);
  document.getElementById('editor-filename').textContent=item.name;
  brushMode=null;isPainting=false;isPanning=false;lastTouches=null;
  zoom=1;panX=0;panY=0;baseW=0;baseH=0;
  undoStack=[];redoStack=[];updateUndoUI();

  const snap=item.bgSnapshot||{};
  currentBgColor=snap.bgColor||'transparent';
  currentPhotoBg=snap.photoBg||null;
  subjectScale=snap.subjectScale!=null?snap.subjectScale:1;
  subjectX=snap.subjectX||0;subjectY=snap.subjectY||0;subjectRotation=snap.subjectRotation||0;
  flipX=!!snap.flipX;flipY=!!snap.flipY;
  shadowEnabled=!!snap.shadowEnabled;shadowColor=snap.shadowColor||'#000000';
  shadowOpacity=snap.shadowOpacity!=null?snap.shadowOpacity:60;
  shadowBlur=snap.shadowBlur!=null?snap.shadowBlur:20;
  shadowDistance=snap.shadowDistance!=null?snap.shadowDistance:10;
  shadowAngle=snap.shadowAngle!=null?snap.shadowAngle:135;
  bgBlur=snap.bgBlur!=null?snap.bgBlur:0;
  bgScale=snap.bgScale!=null?snap.bgScale:1;
  bgOffsetX=snap.bgOffsetX||0;bgOffsetY=snap.bgOffsetY||0;
  outlineEnabled=!!snap.outlineEnabled;outlineColor=snap.outlineColor||'#ffffff';outlineWidth=snap.outlineWidth!=null?snap.outlineWidth:4;
  glowEnabled=!!snap.glowEnabled;glowColor=snap.glowColor||'#c8a96e';glowStrength=snap.glowStrength!=null?snap.glowStrength:60;glowBlur=snap.glowBlur!=null?snap.glowBlur:20;
  featherRadius=snap.featherRadius!=null?snap.featherRadius:0;

  // Sync UI sliders
  syncUI();

  // Setup wCanvas
  wCanvas=document.createElement('canvas');
  wCanvas.width=item.resultCanvas.width;wCanvas.height=item.resultCanvas.height;
  wCtx=wCanvas.getContext('2d',{willReadFrequently:true});
  wCtx.drawImage(item.resultCanvas,0,0);

  const origImg=await loadImg(URL.createObjectURL(item.file));
  const origCvs=document.createElement('canvas');origCvs.width=wCanvas.width;origCvs.height=wCanvas.height;
  const origCtx=origCvs.getContext('2d',{willReadFrequently:true});origCtx.drawImage(origImg,0,0,wCanvas.width,wCanvas.height);
  origData=origCtx.getImageData(0,0,wCanvas.width,wCanvas.height);

  beforeAfterMode=false;
  const baBtn=document.getElementById('btn-before-after');if(baBtn)baBtn.style.display='';

  requestAnimationFrame(()=>{computeBaseSize();renderAll();});
  renderBatchGrid();
}

function syncUI(){
  // Swatches
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(currentBgColor==='transparent'){const ts=document.querySelector('.swatch[data-bg="transparent"]');if(ts)ts.classList.add('active');viewport.classList.add('checker-bg-vp');}
  else{const ms=document.querySelector(`.swatch[data-bg="${currentBgColor}"]`);if(ms)ms.classList.add('active');viewport.classList.remove('checker-bg-vp');}
  // Subject sliders
  const ss=document.getElementById('mob-subj-scale');if(ss){ss.value=Math.round(subjectScale*100);document.getElementById('mob-subj-scale-v').textContent=Math.round(subjectScale*100)+'%';}
  const sx=document.getElementById('mob-subj-x');if(sx){sx.value=subjectX;document.getElementById('mob-subj-x-v').textContent=subjectX;}
  const sy=document.getElementById('mob-subj-y');if(sy){sy.value=subjectY;document.getElementById('mob-subj-y-v').textContent=subjectY;}
  const sr=document.getElementById('mob-subj-rot');if(sr){sr.value=subjectRotation;document.getElementById('mob-subj-rot-v').textContent=subjectRotation+'°';}
  // Bg blur
  const bb=document.getElementById('mob-bg-blur');if(bb){bb.value=bgBlur;document.getElementById('mob-bg-blur-val').textContent=bgBlur+'px';}
  // Shadow
  const se=document.getElementById('mob-shadow-en');if(se){se.checked=shadowEnabled;document.getElementById('mob-shadow-ctrls').style.display=shadowEnabled?'flex':'none';}
  const sco=document.getElementById('mob-shadow-color');if(sco)sco.value=shadowColor;
  const so=document.getElementById('mob-shadow-opacity');if(so){so.value=shadowOpacity;document.getElementById('mob-shadow-opacity-v').textContent=shadowOpacity+'%';}
  const sb=document.getElementById('mob-shadow-blur');if(sb){sb.value=shadowBlur;document.getElementById('mob-shadow-blur-v').textContent=shadowBlur+'px';}
  const sd=document.getElementById('mob-shadow-dist');if(sd){sd.value=shadowDistance;document.getElementById('mob-shadow-dist-v').textContent=shadowDistance+'px';}
  const sa=document.getElementById('mob-shadow-angle');if(sa){sa.value=shadowAngle;document.getElementById('mob-shadow-angle-v').textContent=shadowAngle+'°';}
  // Outline
  const oe=document.getElementById('mob-outline-en');if(oe){oe.checked=outlineEnabled;document.getElementById('mob-outline-ctrls').style.display=outlineEnabled?'flex':'none';}
  const oc=document.getElementById('mob-outline-color');if(oc)oc.value=outlineColor;
  const ow=document.getElementById('mob-outline-width');if(ow){ow.value=outlineWidth;document.getElementById('mob-outline-width-v').textContent=outlineWidth+'px';}
  // Glow
  const ge=document.getElementById('mob-glow-en');if(ge){ge.checked=glowEnabled;document.getElementById('mob-glow-ctrls').style.display=glowEnabled?'flex':'none';}
  const gc=document.getElementById('mob-glow-color');if(gc)gc.value=glowColor;
  const gs=document.getElementById('mob-glow-strength');if(gs){gs.value=glowStrength;document.getElementById('mob-glow-strength-v').textContent=glowStrength+'%';}
  const gbv=document.getElementById('mob-glow-blur');if(gbv){gbv.value=glowBlur;document.getElementById('mob-glow-blur-v').textContent=glowBlur+'px';}
  // Feather
  const fv=document.getElementById('mob-feather');if(fv){fv.value=featherRadius;document.getElementById('mob-feather-v').textContent=featherRadius+'px';}
}

/* ── Layout / Sizing ── */
function computeBaseSize(){
  const vpParent=viewport.parentElement;
  const maxW=vpParent.clientWidth||360;
  const isPortrait=wCanvas.height>wCanvas.width;
  const tb=document.getElementById('mob-toolbar');
  const bb=document.getElementById('mob-brush-bar');
  const tbH=(tb&&tb.offsetHeight)?tb.offsetHeight:68;
  const bbH=(bb&&bb.classList.contains('active')&&bb.offsetHeight)?bb.offsetHeight:0;
  const availH=window.innerHeight-tbH-bbH-8;
  const maxHFactor=isPortrait?0.85:0.68;
  const maxH=Math.min(availH*maxHFactor, isPortrait?1100:650);
  const ratio=Math.min(maxW/wCanvas.width, maxH/wCanvas.height, 1);
  baseW=Math.round(wCanvas.width*ratio);
  baseH=Math.round(wCanvas.height*ratio);
  viewport.style.height=baseH+'px';
  viewport.style.minHeight='';
}

function renderAll(){
  if(!wCanvas)return;
  const dw=Math.round(baseW*zoom), dh=Math.round(baseH*zoom);
  const vpW=viewport.offsetWidth||viewport.clientWidth||360;
  const vpH=viewport.offsetHeight||viewport.clientHeight||baseH;
  // When canvas fits inside viewport, center it; otherwise clamp pan
  if(dw<=vpW){ panX=Math.round((vpW-dw)/2); }
  else { panX=Math.min(0,Math.max(vpW-dw,panX)); }
  if(dh<=vpH){ panY=Math.round((vpH-dh)/2); }
  else { panY=Math.min(0,Math.max(vpH-dh,panY)); }
  dc.width=dw;dc.height=dh;dc.style.width=dw+'px';dc.style.height=dh+'px';
  dc.style.transform=`translate(${panX}px,${panY}px)`;
  cc.width=dw;cc.height=dh;cc.style.width=dw+'px';cc.style.height=dh+'px';
  cc.style.transform=`translate(${panX}px,${panY}px)`;
  document.getElementById('zoom-level').textContent=Math.round(zoom*100)+'%';
  if(beforeAfterMode){
    const tmpC=document.createElement('canvas');tmpC.width=origData.width;tmpC.height=origData.height;
    tmpC.getContext('2d').putImageData(origData,0,0);
    dctx.clearRect(0,0,dw,dh);dctx.drawImage(tmpC,0,0,dw,dh);
    return;
  }
  drawComposite();
}

/* ── Draw Composite ── */
window.drawComposite = function drawComposite(){
  if(!wCanvas)return;
  const dw=dc.width,dh=dc.height;
  dctx.clearRect(0,0,dw,dh);

  // Background
  if(currentPhotoBg&&currentPhotoBg.img){
    const iw=currentPhotoBg.img.naturalWidth,ih=currentPhotoBg.img.naturalHeight;
    const sc=Math.max(dw/iw,dh/ih)*bgScale;
    const bx=(dw-iw*sc)/2+bgOffsetX, by=(dh-ih*sc)/2+bgOffsetY;
    // Exact same approach as desktop: set dctx.filter directly
    dctx.save();
    if(bgBlur>0) dctx.filter=`blur(${bgBlur}px)`;
    dctx.drawImage(currentPhotoBg.img,bx,by,iw*sc,ih*sc);
    dctx.filter='none';
    dctx.restore();
  } else if(currentBgColor!=='transparent'){
    dctx.save();
    const grad=getGradient(currentBgColor,dw,dh);
    dctx.fillStyle=grad||currentBgColor;dctx.fillRect(0,0,dw,dh);dctx.restore();
  }

  // Subject transform
  const sw=dw*subjectScale,sh=dh*subjectScale;
  const sx2=(dw-sw)/2+subjectX,sy2=(dh-sh)/2+subjectY;
  const cx2=sx2+sw/2,cy2=sy2+sh/2;
  const rad=subjectRotation*Math.PI/180;

  // Glow
  if(glowEnabled&&glowBlur>0){
    const hex=glowColor,a=glowStrength/100;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    dctx.save();dctx.translate(cx2,cy2);dctx.rotate(rad);
    if(flipX)dctx.scale(-1,1);if(flipY)dctx.scale(1,-1);dctx.translate(-cx2,-cy2);
    dctx.shadowColor=`rgba(${r},${g},${b},${a})`;dctx.shadowBlur=glowBlur*2;dctx.shadowOffsetX=0;dctx.shadowOffsetY=0;
    const passes=Math.max(1,Math.round(glowStrength/30));
    for(let p=0;p<passes;p++)dctx.drawImage(wCanvas,sx2,sy2,sw,sh);
    dctx.restore();
  }

  // Shadow
  if(shadowEnabled){
    const rad2=shadowAngle*Math.PI/180;
    const dx=Math.cos(rad2)*shadowDistance,dy=Math.sin(rad2)*shadowDistance;
    const hex=shadowColor,a=shadowOpacity/100;
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    dctx.save();dctx.translate(cx2,cy2);dctx.rotate(rad);
    if(flipX)dctx.scale(-1,1);if(flipY)dctx.scale(1,-1);dctx.translate(-cx2,-cy2);
    dctx.shadowColor=`rgba(${r},${g},${b},${a})`;dctx.shadowBlur=shadowBlur;dctx.shadowOffsetX=dx;dctx.shadowOffsetY=dy;
    dctx.drawImage(wCanvas,sx2,sy2,sw,sh);dctx.restore();
  }

  // Outline
  if(outlineEnabled&&outlineWidth>0){
    dctx.save();dctx.translate(cx2,cy2);dctx.rotate(rad);
    if(flipX)dctx.scale(-1,1);if(flipY)dctx.scale(1,-1);dctx.translate(-cx2,-cy2);
    drawOutline(dctx,wCanvas,sx2,sy2,sw,sh,outlineColor,outlineWidth);
    dctx.restore();
  }

  // Subject
  dctx.save();dctx.translate(cx2,cy2);dctx.rotate(rad);
  if(flipX)dctx.scale(-1,1);if(flipY)dctx.scale(1,-1);dctx.translate(-cx2,-cy2);
  const fSrc=featherRadius>0?applyFeather(wCanvas,featherRadius*0.3):wCanvas;
  dctx.drawImage(fSrc,sx2,sy2,sw,sh);
  dctx.restore();

  // Save snapshot
  const ai=items.find(i=>i.id==activeId);
  if(ai)ai.bgSnapshot={photoBg:currentPhotoBg,bgColor:currentBgColor,bgBlur,bgScale,bgOffsetX,bgOffsetY,shadowEnabled,shadowColor,shadowOpacity,shadowBlur,shadowDistance,shadowAngle,outlineEnabled,outlineColor,outlineWidth,glowEnabled,glowColor,glowStrength,glowBlur,featherRadius,subjectScale,subjectX,subjectY,subjectRotation,flipX,flipY,dcWidth:dc.width,dcHeight:dc.height};
};

/* ── Feather ── */
function applyFeather(src,radius){
  if(!radius||radius<=0)return src;
  const w=src.width,h=src.height;
  const tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;
  const tCtx=tmp.getContext('2d');tCtx.drawImage(src,0,0);
  const imgD=tCtx.getImageData(0,0,w,h);const d=imgD.data;
  const alpha=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)alpha[i]=d[i*4+3]/255;
  const r=Math.round(radius);
  let src2=new Float32Array(alpha),dst=new Float32Array(w*h);
  for(let p=0;p<3;p++){
    for(let y=0;y<h;y++){let sum=0,cnt=0;for(let x=-r;x<=r;x++){const xi=Math.max(0,Math.min(w-1,x));sum+=src2[y*w+xi];cnt++;}for(let x=0;x<w;x++){dst[y*w+x]=sum/cnt;const ax=Math.min(w-1,x+r+1),rx2=Math.max(0,x-r);sum+=src2[y*w+ax]-src2[y*w+rx2];}}
    const tmp2=new Float32Array(w*h);for(let x=0;x<w;x++){let sum=0,cnt=0;for(let y=-r;y<=r;y++){const yi=Math.max(0,Math.min(h-1,y));sum+=dst[yi*w+x];cnt++;}for(let y=0;y<h;y++){tmp2[y*w+x]=sum/cnt;const ay=Math.min(h-1,y+r+1),ry=Math.max(0,y-r);sum+=dst[ay*w+x]-dst[ry*w+x];}}
    src2=tmp2;
  }
  const out=document.createElement('canvas');out.width=w;out.height=h;
  const oCtx=out.getContext('2d');oCtx.drawImage(src,0,0);
  const outD=oCtx.getImageData(0,0,w,h);const od=outD.data;
  for(let i=0;i<w*h;i++)od[i*4+3]=Math.round(src2[i]*255);
  oCtx.putImageData(outD,0,0);return out;
}

/* ── Outline Helper ── */
function drawOutline(ctx,srcCanvas,sx,sy,sw,sh,color,width){
  if(!width||width<=0)return;
  const iw=Math.round(sw),ih=Math.round(sh);if(iw<=0||ih<=0)return;
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  const maskC=document.createElement('canvas');maskC.width=iw;maskC.height=ih;
  const maskCtx=maskC.getContext('2d');maskCtx.drawImage(srcCanvas,0,0,iw,ih);
  const maskData=maskCtx.getImageData(0,0,iw,ih);
  const alpha=new Uint8Array(iw*ih);
  for(let i=0;i<iw*ih;i++)alpha[i]=maskData.data[i*4+3];
  const outC=document.createElement('canvas');outC.width=iw;outC.height=ih;
  const outCtx=outC.getContext('2d');
  const outImg=outCtx.createImageData(iw,ih);const od=outImg.data;
  const w2=Math.ceil(width);
  for(let y=0;y<ih;y++){for(let x=0;x<iw;x++){
    if(alpha[y*iw+x]>128)continue;
    let hit=false;
    const x0=Math.max(0,x-w2),x1=Math.min(iw-1,x+w2),y0=Math.max(0,y-w2),y1=Math.min(ih-1,y+w2);
    outer:for(let ny=y0;ny<=y1;ny++)for(let nx=x0;nx<=x1;nx++){if((nx-x)**2+(ny-y)**2<=w2*w2&&alpha[ny*iw+nx]>128){hit=true;break outer;}}
    if(hit){const idx=(y*iw+x)*4;od[idx]=r;od[idx+1]=g;od[idx+2]=b;od[idx+3]=255;}
  }}
  outCtx.putImageData(outImg,0,0);ctx.drawImage(outC,sx,sy,sw,sh);
}

function getGradient(color,w,h){
  const gradients={'gradient-purple':['#667eea','#764ba2'],'gradient-pink':['#f093fb','#f5576c'],'gradient-blue':['#4facfe','#00f2fe'],'gradient-green':['#43e97b','#38f9d7']};
  if(gradients[color]){const g=dctx.createLinearGradient(0,0,w,h);g.addColorStop(0,gradients[color][0]);g.addColorStop(1,gradients[color][1]);return g;}
  return null;
}

/* ════════════════════════════════════════
   TOUCH EVENTS — Clean, standalone, correct
════════════════════════════════════════ */

// Convert touch point to screen-px coords relative to dc element top-left.
// dc is rendered at exactly dc.width x dc.height CSS px (no CSS scaling), so
// screen-px == dc-canvas-px. We keep coords in screen-px here and let
// applyBrush do the single authoritative conversion to wCanvas space.
function touchToCanvas(t){
  const dr=dc.getBoundingClientRect();
  if(dr.width===0||dr.height===0)return null;
  const scaleX=dc.width/dr.width, scaleY=dc.height/dr.height;
  const cx=(t.clientX-dr.left)*scaleX;
  const cy=(t.clientY-dr.top)*scaleY;
  if(cx<0||cx>dc.width)return null;
  if(cy<-dc.height*0.5)return null;
  return{x:Math.max(0,Math.min(dc.width,cx)), y:Math.min(cy,dc.height)};
}

// Brush circle sits BRUSH_OFFSET_PX screen-px above the finger.
// Input/output: dc canvas px. Offset is converted from screen-px to canvas-px.
const BRUSH_OFFSET_PX=80;
function brushPos(rawCanvasPos){
  const dr=dc.getBoundingClientRect();
  const scaleY=dr.height>0?(dc.height/dr.height):1;
  return{x:rawCanvasPos.x, y:Math.max(0, rawCanvasPos.y-BRUSH_OFFSET_PX*scaleY)};
}

let _touchBrushScreenX=0, _touchBrushScreenY=0;

/* ── Subject drag state ── */
let isDraggingSubject=false;
let dragSubjectStart={x:0,y:0,sx:0,sy:0};

// Check if touch point hits the subject area on canvas
function touchHitsSubject(clientX,clientY){
  if(!wCanvas)return false;
  const dr=dc.getBoundingClientRect();
  if(dr.width===0)return false;
  // Convert screen px to base canvas px
  const scaleX=baseW/dr.width, scaleY=baseH/dr.height;
  const bx=(clientX-dr.left)*scaleX/zoom, by=(clientY-dr.top)*scaleY/zoom;
  const sw=baseW*subjectScale, sh=baseH*subjectScale;
  const sx=(baseW-sw)/2+subjectX, sy=(baseH-sh)/2+subjectY;
  return bx>=sx&&bx<=sx+sw&&by>=sy&&by<=sy+sh;
}

viewport.addEventListener('touchstart',e=>{
  e.preventDefault();
  lastTouches=e.touches;

  // 2-finger pinch start
  if(e.touches.length===2){isPainting=false;isPanning=false;isDraggingSubject=false;return;}

  const t=e.touches[0];

  if(!brushMode){
    // Check if finger is on subject — drag to move
    if(touchHitsSubject(t.clientX,t.clientY)){
      isDraggingSubject=true;isPanning=false;
      dragSubjectStart={x:t.clientX,y:t.clientY,sx:subjectX,sy:subjectY};
      viewport.style.cursor='grabbing';
      return;
    }
    // Pan canvas
    isPanning=true;isDraggingSubject=false;
    panStart={x:t.clientX-panX, y:t.clientY-panY};
    return;
  }

  // Brush start
  const raw=touchToCanvas(t);
  if(!raw)return;
  const bp=brushPos(raw);
  _touchBrushScreenX=t.clientX;_touchBrushScreenY=t.clientY;
  drawCursorRing(bp.x,bp.y,t.clientX,t.clientY);
  isPainting=true;
  saveSnapshot();
  applyBrush(bp.x,bp.y);
},{passive:false});

viewport.addEventListener('touchmove',e=>{
  e.preventDefault();

  // Pinch zoom
  if(e.touches.length===2&&lastTouches&&lastTouches.length===2){
    const d0=Math.hypot(lastTouches[0].clientX-lastTouches[1].clientX,lastTouches[0].clientY-lastTouches[1].clientY);
    const d1=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
    const r=d1/d0;
    const midX=(e.touches[0].clientX+e.touches[1].clientX)/2-viewport.getBoundingClientRect().left;
    const midY=(e.touches[0].clientY+e.touches[1].clientY)/2-viewport.getBoundingClientRect().top;
    const nz=Math.min(8,Math.max(0.25,zoom*r));
    panX-=(midX-panX)*(nz/zoom-1);panY-=(midY-panY)*(nz/zoom-1);
    zoom=nz;lastTouches=e.touches;renderAll();return;
  }

  const t=e.touches[0];

  // Subject drag move
  if(isDraggingSubject&&e.touches.length===1){
    const dr=dc.getBoundingClientRect();
    // Convert screen delta to base-canvas delta (account for zoom)
    const scaleX=baseW/(dr.width||baseW), scaleY=baseH/(dr.height||baseH);
    const dx=(t.clientX-dragSubjectStart.x)*scaleX/zoom;
    const dy=(t.clientY-dragSubjectStart.y)*scaleY/zoom;
    subjectX=Math.round(dragSubjectStart.sx+dx);
    subjectY=Math.round(dragSubjectStart.sy+dy);
    // Sync sliders
    const elx=document.getElementById('mob-subj-x'),ely=document.getElementById('mob-subj-y');
    const evx=document.getElementById('mob-subj-x-v'),evy=document.getElementById('mob-subj-y-v');
    if(elx){elx.value=subjectX;if(evx)evx.textContent=subjectX;}
    if(ely){ely.value=subjectY;if(evy)evy.textContent=subjectY;}
    drawComposite();return;
  }

  if(isPanning&&e.touches.length===1){
    panX=t.clientX-panStart.x;panY=t.clientY-panStart.y;renderAll();return;
  }

  if(!brushMode||!isPainting){clearCursor();return;}

  let raw=touchToCanvas(t);
  // Thumb canvas ke neeche gayi — clamp to bottom edge in screen-px
  if(!raw){
    const dr=dc.getBoundingClientRect();
    if(dr.width===0||dr.height===0){clearCursor();return;}
    const cx=t.clientX-dr.left;
    const cy=t.clientY-dr.top;
    if(cx<0||cx>dr.width||cy<-dr.height*0.5){clearCursor();return;}
    const scaleX2=dc.width/dr.width,scaleY2=dc.height/dr.height;
    raw={x:Math.max(0,Math.min(dc.width,cx*scaleX2)), y:dc.height};
  }
  const bp=brushPos(raw);
  _touchBrushScreenX=t.clientX;_touchBrushScreenY=t.clientY;
  drawCursorRing(bp.x,bp.y,t.clientX,t.clientY);
  applyBrush(bp.x,bp.y);
},{passive:false});

viewport.addEventListener('touchend',e=>{
  lastTouches=e.touches.length>0?e.touches:null;
  if(isDraggingSubject){isDraggingSubject=false;viewport.style.cursor='';bakeToItem();}
  isPanning=false;
  if(isPainting){isPainting=false;bakeToItem();}
  clearCursor();
},{passive:true});

viewport.addEventListener('touchcancel',e=>{
  isPanning=false;isPainting=false;isDraggingSubject=false;lastTouches=null;viewport.style.cursor='';clearCursor();
},{passive:true});

/* ── Cursor Ring ── */
function clearCursor(){cctx.clearRect(0,0,cc.width,cc.height);hideLupe();}

function drawCursorRing(dispX,dispY,fingerClientX,fingerClientY){
  cctx.clearRect(0,0,cc.width,cc.height);
  if(!brushMode)return;
  // dispX/Y are dc canvas pixels. cc is same size as dc (1:1), so draw directly.
  // Ring radius: same formula as desktop — brushSize/2 * scaleX (dc canvas px per CSS px)
  const dr=dc.getBoundingClientRect();
  const scaleX=dr.width>0?dc.width/dr.width:1;
  const ringR=(window.brushSize/2)*scaleX;
  const col=window.smartEdge?'rgba(201,168,76,.95)':brushMode==='erase'?'rgba(255,80,80,.9)':'rgba(80,220,80,.9)';
  cctx.save();
  cctx.beginPath();cctx.arc(dispX,dispY,ringR,0,Math.PI*2);
  cctx.strokeStyle=col;cctx.lineWidth=1.5*scaleX;cctx.stroke();
  cctx.beginPath();cctx.arc(dispX,dispY,1.5*scaleX,0,Math.PI*2);
  cctx.fillStyle=col;cctx.fill();
  cctx.beginPath();cctx.moveTo(dispX,dispY+ringR);cctx.lineTo(dispX,dispY+ringR+BRUSH_OFFSET_PX*scaleX*0.8);
  cctx.strokeStyle=col;cctx.lineWidth=scaleX;cctx.setLineDash([3*scaleX,3*scaleX]);cctx.stroke();cctx.setLineDash([]);
  cctx.restore();
  showLupe(dispX,dispY,fingerClientX,fingerClientY);
}

/* ── Loupe ── */
const lupeEl=document.getElementById('mob-lupe');
const lupeCvs=document.getElementById('mob-lupe-canvas');
const lupeSize=130;
const lupeZoom=4;
const lupeDpr=window.devicePixelRatio||1;
lupeCvs.width=lupeSize*lupeDpr;lupeCvs.height=lupeSize*lupeDpr;
lupeCvs.style.width=lupeSize+'px';lupeCvs.style.height=lupeSize+'px';
const lupeCtx=lupeCvs.getContext('2d');

function showLupe(ringScreenX,ringScreenY,fingerClientX,fingerClientY){
  if(!wCanvas||!dc)return;
  const vpRect=viewport.getBoundingClientRect();
  const margin=10;
  // Position lupe based on finger client position (screen coords)
  const dr0=dc.getBoundingClientRect();
  const scaleX0=dr0.width>0?dc.width/dr0.width:1;
  const ringClientY=dr0.top+ringScreenY/scaleX0; // convert canvas px back to client y for positioning
  let top=ringClientY-lupeSize/2;
  top=Math.max(vpRect.top+margin,Math.min(vpRect.bottom-lupeSize-margin,top));
  const right=(fingerClientX>vpRect.left+vpRect.width/2);
  const left=right?vpRect.left+margin:vpRect.right-lupeSize-margin;
  lupeEl.style.cssText=`display:block;position:fixed;left:${left}px;top:${top}px;width:${lupeSize}px;height:${lupeSize}px;`;

  const sz=lupeSize*lupeDpr;
  lupeCtx.clearRect(0,0,sz,sz);
  const tile=10*lupeDpr;
  for(let ty=0;ty<sz;ty+=tile)for(let tx=0;tx<sz;tx+=tile){lupeCtx.fillStyle=((Math.floor(tx/tile)+Math.floor(ty/tile))%2===0)?'#2a2a2a':'#3a3a3a';lupeCtx.fillRect(tx,ty,tile,tile);}

  // ringScreenX/Y are now dc canvas pixels — use directly
  const dr=dc.getBoundingClientRect();
  const scaleX=dr.width>0?dc.width/dr.width:1;
  const dcX=ringScreenX, dcY=ringScreenY;
  const sampleDcPx=(lupeSize/lupeZoom)*scaleX;
  lupeCtx.save();lupeCtx.imageSmoothingEnabled=false;
  lupeCtx.drawImage(dc,dcX-sampleDcPx/2,dcY-sampleDcPx/2,sampleDcPx,sampleDcPx,0,0,sz,sz);
  lupeCtx.restore();

  const col=brushMode==='erase'?'rgba(255,80,80,.85)':'rgba(80,220,80,.85)';
  const mid=sz/2;
  const brushR=(window.brushSize/2)*scaleX*lupeZoom*lupeDpr;
  lupeCtx.save();lupeCtx.strokeStyle=col;lupeCtx.lineWidth=1.5*lupeDpr;
  lupeCtx.beginPath();lupeCtx.arc(mid,mid,brushR,0,Math.PI*2);lupeCtx.stroke();
  lupeCtx.beginPath();lupeCtx.moveTo(mid-brushR-6,mid);lupeCtx.lineTo(mid+brushR+6,mid);lupeCtx.stroke();
  lupeCtx.beginPath();lupeCtx.moveTo(mid,mid-brushR-6);lupeCtx.lineTo(mid,mid+brushR+6);lupeCtx.stroke();
  lupeCtx.restore();
  lupeCtx.save();lupeCtx.strokeStyle=brushMode==='erase'?'rgba(255,80,80,.4)':'rgba(80,220,80,.4)';
  lupeCtx.lineWidth=2*lupeDpr;lupeCtx.strokeRect(0,0,sz,sz);lupeCtx.restore();
}
function hideLupe(){lupeEl.style.display='none';}

/* ── Apply Brush ── */
// dispX/Y: dc canvas pixels (same coordinate space as desktop version)
function applyBrush(dispX,dispY){
  // Exact same formula as desktop background-remover.js
  const dw=dc.width, dh=dc.height;
  const drawnW=dw*subjectScale, drawnH=dh*subjectScale;
  const originX=(dw-drawnW)/2+subjectX, originY=(dh-drawnH)/2+subjectY;
  const fx=((dispX-originX)/drawnW)*wCanvas.width;
  const fy=((dispY-originY)/drawnH)*wCanvas.height;
  const sx=wCanvas.width/drawnW;
  const fr=(window.brushSize/2)*sx;

  if(window.smartEdge){applySmartEdge(fx,fy,fr);drawComposite();drawCursorRing(screenX,screenY,_touchBrushScreenX,_touchBrushScreenY);return;}

  if(brushMode==='erase'){
    wCtx.save();wCtx.globalCompositeOperation='destination-out';
    wCtx.beginPath();wCtx.arc(fx,fy,fr,0,Math.PI*2);wCtx.fillStyle='rgba(0,0,0,1)';wCtx.fill();wCtx.restore();
  } else {
    const x0=Math.max(0,Math.floor(fx-fr)),y0=Math.max(0,Math.floor(fy-fr));
    const x1=Math.min(wCanvas.width,Math.ceil(fx+fr)),y1=Math.min(wCanvas.height,Math.ceil(fy+fr));
    const pw=x1-x0,ph=y1-y0;if(pw<=0||ph<=0)return;
    const patch=wCtx.getImageData(x0,y0,pw,ph);const d=patch.data,od=origData.data,W=origData.width;
    for(let py=0;py<ph;py++)for(let px=0;px<pw;px++){
      if((x0+px-fx)**2+(y0+py-fy)**2>fr*fr)continue;
      const i=(py*pw+px)*4,oi=((y0+py)*W+(x0+px))*4;
      d[i]=od[oi];d[i+1]=od[oi+1];d[i+2]=od[oi+2];d[i+3]=od[oi+3];
    }
    wCtx.putImageData(patch,x0,y0);
  }
  drawComposite();drawCursorRing(screenX,screenY,_touchBrushScreenX,_touchBrushScreenY);
}

function applySmartEdge(fx,fy,fr){
  const W=wCanvas.width,H=wCanvas.height;
  const x0=Math.max(0,Math.floor(fx-fr)),y0=Math.max(0,Math.floor(fy-fr));
  const x1=Math.min(W,Math.ceil(fx+fr)),y1=Math.min(H,Math.ceil(fy+fr));
  const pw=x1-x0,ph=y1-y0;if(pw<=0||ph<=0)return;
  const seedX=Math.max(0,Math.min(W-1,Math.round(fx))),seedY=Math.max(0,Math.min(H-1,Math.round(fy)));
  const od=origData.data,oW=origData.width;
  const si=(seedY*oW+seedX)*4;
  const sr=od[si],sg=od[si+1],sb=od[si+2];
  const tol=(window.smartEdgeTol/100)*441;
  const patch=wCtx.getImageData(x0,y0,pw,ph);const d=patch.data;
  for(let py=0;py<ph;py++)for(let px=0;px<pw;px++){
    if((x0+px-fx)**2+(y0+py-fy)**2>fr*fr)continue;
    const oi=((y0+py)*oW+(x0+px))*4;
    const dr=od[oi]-sr,dg=od[oi+1]-sg,dbv=od[oi+2]-sb;
    const dist=Math.sqrt(dr*dr+dg*dg+dbv*dbv);
    if(dist>tol)continue;
    const strength=tol>0?Math.max(0,1-dist/tol):1;
    const i=(py*pw+px)*4;
    if(brushMode==='erase'){d[i+3]=Math.max(0,d[i+3]-Math.round(255*strength));}
    else{d[i]=Math.round(d[i]*(1-strength)+od[oi]*strength);d[i+1]=Math.round(d[i+1]*(1-strength)+od[oi+1]*strength);d[i+2]=Math.round(d[i+2]*(1-strength)+od[oi+2]*strength);d[i+3]=Math.round(d[i+3]*(1-strength)+od[oi+3]*strength);}
  }
  wCtx.putImageData(patch,x0,y0);
}

function bakeToItem(){
  const item=items.find(i=>i.id==activeId);
  if(item&&wCanvas){const cvs=document.createElement('canvas');cvs.width=wCanvas.width;cvs.height=wCanvas.height;cvs.getContext('2d').drawImage(wCanvas,0,0);item.resultCanvas=cvs;}
}

/* ── Undo ── */
function saveSnapshot(){
  const snap=document.createElement('canvas');snap.width=wCanvas.width;snap.height=wCanvas.height;
  snap.getContext('2d').drawImage(wCanvas,0,0);undoStack.push(snap);
  if(undoStack.length>MAX_UNDO)undoStack.shift();redoStack=[];updateUndoUI();
}
function updateUndoUI(){
  const u=document.getElementById('mob-btn-undo'),r=document.getElementById('mob-btn-redo');
  if(u)u.disabled=undoStack.length===0;if(r)r.disabled=redoStack.length===0;
}
window.undoStroke=function(){
  if(!undoStack.length)return;
  const snap=document.createElement('canvas');snap.width=wCanvas.width;snap.height=wCanvas.height;snap.getContext('2d').drawImage(wCanvas,0,0);redoStack.push(snap);
  const prev=undoStack.pop();wCtx.clearRect(0,0,wCanvas.width,wCanvas.height);wCtx.drawImage(prev,0,0);
  drawComposite();updateUndoUI();bakeToItem();
};
window.redoStroke=function(){
  if(!redoStack.length)return;
  const snap=document.createElement('canvas');snap.width=wCanvas.width;snap.height=wCanvas.height;snap.getContext('2d').drawImage(wCanvas,0,0);undoStack.push(snap);
  const next=redoStack.pop();wCtx.clearRect(0,0,wCanvas.width,wCanvas.height);wCtx.drawImage(next,0,0);
  drawComposite();updateUndoUI();bakeToItem();
};

/* ── Zoom Controls ── */
window.zoomIn=function(){
  if(!wCanvas)return;
  const vpW=viewport.offsetWidth||360;
  const vpH=viewport.offsetHeight||baseH;
  const midX=vpW/2, midY=vpH/2;
  const nz=Math.min(8,zoom*1.25);
  panX-=(midX-panX)*(nz/zoom-1);
  panY-=(midY-panY)*(nz/zoom-1);
  zoom=nz;renderAll();
};
window.zoomOut=function(){
  if(!wCanvas)return;
  const vpW=viewport.offsetWidth||360;
  const vpH=viewport.offsetHeight||baseH;
  const midX=vpW/2, midY=vpH/2;
  const nz=Math.max(0.25,zoom/1.25);
  panX-=(midX-panX)*(nz/zoom-1);
  panY-=(midY-panY)*(nz/zoom-1);
  zoom=nz;renderAll();
};
window.resetZoom=function(){
  if(!wCanvas)return;
  zoom=1;panX=0;panY=0;renderAll();
};

/* ── Toolbar ── */
function showToolbar(show){document.getElementById('mob-toolbar').classList.toggle('active',show);}

/* ── Brush Mode ── */
window.mobSetBrush=function(mode){
  if(brushMode===mode||mode===null){
    brushMode=null;clearCursor();
    document.getElementById('mob-btn-erase').className='mob-tb-btn';
    document.getElementById('mob-btn-restore').className='mob-tb-btn';
    document.getElementById('mob-brush-bar').classList.remove('active');
    if(wCanvas){computeBaseSize();renderAll();}
    return;
  }
  brushMode=mode;
  document.getElementById('mob-btn-erase').className='mob-tb-btn'+(mode==='erase'?' mode-erase':'');
  document.getElementById('mob-btn-restore').className='mob-tb-btn'+(mode==='restore'?' mode-restore':'');
  document.getElementById('mob-brush-bar').classList.add('active');
  const sz=document.getElementById('mob-brush-size');if(sz)window.brushSize=+sz.value;
  if(wCanvas){computeBaseSize();renderAll();}
};

/* ── Smart Edge toggle ── */
window.mobToggleSmartEdge=function(){
  window.smartEdge=!window.smartEdge;
  document.getElementById('mob-smart-pill').classList.toggle('active',window.smartEdge);
  document.getElementById('mob-sensitivity-row').style.display=window.smartEdge?'flex':'none';
  if(wCanvas)computeBaseSize();// height may change, re-render
};

/* ── Sheets ── */
let currentSheet=null;
window.openMobSheet=function(name){
  closeMobSheet();
  const sheet=document.getElementById('mob-sheet-'+name);
  if(!sheet)return;
  currentSheet=name;
  document.getElementById('mob-backdrop').classList.add('active');
  sheet.classList.add('open');
  // Inject close button if not already present
  if(!sheet.querySelector('.mob-sheet-close-btn')){
    const hdr=sheet.querySelector('.mob-sheet-header,.sheet-header,.mob-sheet-title,[class*="sheet-head"]');
    const btn=document.createElement('button');
    btn.className='mob-sheet-close-btn';
    btn.innerHTML='✕';
    btn.title='Close';
    btn.style.cssText='position:absolute;top:12px;right:14px;background:none;border:none;color:var(--text-muted);font-size:18px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:6px;z-index:10;';
    btn.onclick=()=>closeMobSheet();
    // Ensure sheet has relative positioning for absolute close btn
    const curPos=getComputedStyle(sheet).position;
    if(curPos==='static')sheet.style.position='relative';
    sheet.appendChild(btn);
  }
};
window.closeMobSheet=function(){
  document.querySelectorAll('.mob-sheet').forEach(s=>s.classList.remove('open'));
  document.getElementById('mob-backdrop').classList.remove('active');
  currentSheet=null;
};

/* ── FX sub-sections ── */
window.toggleFxSub=function(id){
  const el=document.getElementById(id);if(!el)return;
  el.classList.toggle('collapsed');
  const arr=document.getElementById(id+'-arr');if(arr)arr.textContent=el.classList.contains('collapsed')?'▸':'▾';
};

/* ── BG Color ── */
window.setBg=function(color,el){
  currentBgColor=color;currentPhotoBg=null;
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(el)el.classList.add('active');
  viewport.classList.toggle('checker-bg-vp',color==='transparent');
  if(color!=='transparent')viewport.classList.remove('checker-bg-vp');
  drawComposite();
};

/* ── Photo BG ── */
window.applyUploadedBg=async function(input){
  const file=input.files[0];if(!file)return;
  const url=URL.createObjectURL(file);
  const img=await loadImg(url);
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  viewport.classList.remove('checker-bg-vp');
  currentPhotoBg={url,img};currentBgColor='transparent';
  drawComposite();closeMobSheet();
};

/* ── Photo Search ── */
const PIXABAY_KEY='56195183-28e328d32f454f70395ff87ba';
const PEXELS_KEY='o4lyPnNivfvjZiCGp6IfzVomd465edTzsZmJWlUMUHcvuJJoUmLVbAiC';
let preferredSrc='pexels';

async function fetchPhotos(query,page){
  // Always try Pexels first; fall back to Pixabay only if Pexels fails
  try{
    const res=await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=18&page=${page}`,{headers:{Authorization:PEXELS_KEY}});
    if(!res.ok)throw new Error('pexels_err');
    const d=await res.json();
    if(!d.photos?.length)throw new Error('pexels_empty');
    return{photos:d.photos.map(p=>({thumb:p.src.small,full:p.src.large})),hasMore:!!d.next_page,source:'pexels'};
  }catch(e){}
  // Pixabay fallback
  try{
    const res=await fetch(`https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=photo&per_page=18&page=${page}&safesearch=true`);
    if(!res.ok)throw new Error('pixabay_err');
    const d=await res.json();
    if(!d.hits?.length)throw new Error('pixabay_empty');
    return{photos:d.hits.map(p=>({thumb:p.webformatURL,full:p.largeImageURL})),hasMore:d.totalHits>page*18,source:'pixabay'};
  }catch(e){}
  return null;
}

let _mobSearching=false;
window.mobSearchPhotos=async function(){
  if(_mobSearching)return;
  const q=document.getElementById('mob-photo-query').value.trim();
  if(!q){document.getElementById('mob-photo-grid').innerHTML='<div class="photo-loading">Type something first.</div>';return;}
  _mobSearching=true;
  const btn=document.getElementById('mob-search-btn');btn.disabled=true;btn.textContent='…';
  document.getElementById('mob-photo-grid').innerHTML='<div class="photo-loading">Searching…</div>';
  const result=await fetchPhotos(q,1);
  _mobSearching=false;btn.disabled=false;btn.textContent='Search';
  const grid=document.getElementById('mob-photo-grid');
  if(!result||!result.photos.length){grid.innerHTML='<div class="photo-loading">No results. Try different search.</div>';return;}
  grid.innerHTML='';
  result.photos.forEach(({thumb,full})=>{
    const img=document.createElement('img');img.className='photo-thumb';img.crossOrigin='anonymous';img.src=thumb;
    img.addEventListener('click',async()=>{
      // Mark selected immediately — no double-click needed
      document.querySelectorAll('.photo-thumb').forEach(t=>t.classList.remove('active'));
      img.classList.add('active');
      img.style.opacity='0.5';
      document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
      viewport.classList.remove('checker-bg-vp');
      try{
        const i=await loadImg(full);
        currentPhotoBg={url:full,img:i};
        currentBgColor='transparent';
        drawComposite();
      }catch(e){console.warn('Photo load failed',e);}
      img.style.opacity='';
      closeMobSheet();
    });
    grid.appendChild(img);
  });
  // Enter key support — search field pe Enter dabane se search ho
  const qEl=document.getElementById('mob-photo-query');
  qEl.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();window.mobSearchPhotos();}};
  const attr=document.getElementById('mob-photo-attr');
  if(attr)attr.innerHTML=`Photos via <a href="https://${result.source==='pixabay'?'pixabay.com':'www.pexels.com'}" target="_blank">${result.source==='pixabay'?'Pixabay':'Pexels'}</a>`;
};

/* ── Transform (Mobile) ── */
window.mobSwitchTab=function(which){
  const isSubj=which==='subject';
  document.getElementById('mob-panel-subject').style.display=isSubj?'':'none';
  document.getElementById('mob-panel-bg').style.display=isSubj?'none':'';
  const sBtn=document.getElementById('mob-tab-subject'),bBtn=document.getElementById('mob-tab-bg');
  sBtn.style.cssText=`flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid ${isSubj?'var(--gold)':'var(--faint)'};background:${isSubj?'var(--gold)':'transparent'};color:${isSubj?'#000':'var(--text-muted)'};`;
  bBtn.style.cssText=`flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid ${!isSubj?'var(--gold)':'var(--faint)'};background:${!isSubj?'var(--gold)':'transparent'};color:${!isSubj?'#000':'var(--text-muted)'};`;
};

window.mobUpdateSubject=function(){
  subjectScale=+document.getElementById('mob-subj-scale').value/100;
  subjectX=+document.getElementById('mob-subj-x').value;
  subjectY=+document.getElementById('mob-subj-y').value;
  subjectRotation=+document.getElementById('mob-subj-rot').value;
  document.getElementById('mob-subj-scale-v').textContent=Math.round(subjectScale*100)+'%';
  document.getElementById('mob-subj-x-v').textContent=subjectX;
  document.getElementById('mob-subj-y-v').textContent=subjectY;
  document.getElementById('mob-subj-rot-v').textContent=subjectRotation+'°';
  drawComposite();
};

window.mobResetSubject=function(){
  subjectScale=1;subjectX=0;subjectY=0;subjectRotation=0;flipX=false;flipY=false;
  document.getElementById('mob-subj-scale').value=100;document.getElementById('mob-subj-scale-v').textContent='100%';
  document.getElementById('mob-subj-x').value=0;document.getElementById('mob-subj-x-v').textContent='0';
  document.getElementById('mob-subj-y').value=0;document.getElementById('mob-subj-y-v').textContent='0';
  document.getElementById('mob-subj-rot').value=0;document.getElementById('mob-subj-rot-v').textContent='0°';
  updateFlipBtns();drawComposite();
};

window.mobFlip=function(axis){
  if(axis==='x')flipX=!flipX;else flipY=!flipY;
  updateFlipBtns();drawComposite();
};

function updateFlipBtns(){
  const base='flex:1;padding:8px;font-size:11px;font-weight:600;border-radius:var(--radius-sm);cursor:pointer;border:1.5px solid;';
  document.getElementById('mob-flip-x').style.cssText=base+(flipX?'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold);':'background:var(--dark-4);border-color:var(--faint);color:var(--text-muted);');
  document.getElementById('mob-flip-y').style.cssText=base+(flipY?'background:var(--gold-dim);border-color:var(--gold-border);color:var(--gold);':'background:var(--dark-4);border-color:var(--faint);color:var(--text-muted);');
}

window.mobUpdateBgTransform=function(){
  bgScale=+document.getElementById('mob-bg-scale').value/100;
  bgOffsetX=+document.getElementById('mob-bg-x').value;
  bgOffsetY=+document.getElementById('mob-bg-y').value;
  document.getElementById('mob-bg-scale-v').textContent=Math.round(bgScale*100)+'%';
  document.getElementById('mob-bg-x-v').textContent=bgOffsetX;
  document.getElementById('mob-bg-y-v').textContent=bgOffsetY;
  drawComposite();
};

window.mobResetBgTransform=function(){
  bgScale=1;bgOffsetX=0;bgOffsetY=0;
  document.getElementById('mob-bg-scale').value=100;document.getElementById('mob-bg-scale-v').textContent='100%';
  document.getElementById('mob-bg-x').value=0;document.getElementById('mob-bg-x-v').textContent='0';
  document.getElementById('mob-bg-y').value=0;document.getElementById('mob-bg-y-v').textContent='0';
  drawComposite();
};

/* ── Effects (Mobile) ── */
window.mobUpdateEffects=function(){
  // bgBlur — background blur slider
  const bbEl=document.getElementById('mob-bg-blur');
  if(bbEl){bgBlur=+bbEl.value;const bv=document.getElementById('mob-bg-blur-val');if(bv)bv.textContent=bgBlur+'px';}
  shadowEnabled=document.getElementById('mob-shadow-en').checked;
  document.getElementById('mob-shadow-ctrls').style.display=shadowEnabled?'flex':'none';
  shadowColor=document.getElementById('mob-shadow-color').value;
  shadowOpacity=+document.getElementById('mob-shadow-opacity').value;document.getElementById('mob-shadow-opacity-v').textContent=shadowOpacity+'%';
  shadowBlur=+document.getElementById('mob-shadow-blur').value;document.getElementById('mob-shadow-blur-v').textContent=shadowBlur+'px';
  shadowDistance=+document.getElementById('mob-shadow-dist').value;document.getElementById('mob-shadow-dist-v').textContent=shadowDistance+'px';
  shadowAngle=+document.getElementById('mob-shadow-angle').value;document.getElementById('mob-shadow-angle-v').textContent=shadowAngle+'°';
  outlineEnabled=document.getElementById('mob-outline-en').checked;
  document.getElementById('mob-outline-ctrls').style.display=outlineEnabled?'flex':'none';
  outlineColor=document.getElementById('mob-outline-color').value;
  outlineWidth=+document.getElementById('mob-outline-width').value;document.getElementById('mob-outline-width-v').textContent=outlineWidth+'px';
  glowEnabled=document.getElementById('mob-glow-en').checked;
  document.getElementById('mob-glow-ctrls').style.display=glowEnabled?'flex':'none';
  glowColor=document.getElementById('mob-glow-color').value;
  glowStrength=+document.getElementById('mob-glow-strength').value;document.getElementById('mob-glow-strength-v').textContent=glowStrength+'%';
  glowBlur=+document.getElementById('mob-glow-blur').value;document.getElementById('mob-glow-blur-v').textContent=glowBlur+'px';
  drawComposite();
};

/* ── Before/After ── */
window.toggleBeforeAfter=function(){
  if(!wCanvas||!origData)return;
  beforeAfterMode=!beforeAfterMode;
  const btn=document.getElementById('btn-before-after');
  if(beforeAfterMode){
    btn.textContent='← Result';btn.style.borderColor='var(--gold-border)';btn.style.color='var(--gold)';
    const tmpC=document.createElement('canvas');tmpC.width=origData.width;tmpC.height=origData.height;tmpC.getContext('2d').putImageData(origData,0,0);
    dctx.clearRect(0,0,dc.width,dc.height);dctx.drawImage(tmpC,0,0,dc.width,dc.height);
  } else {
    btn.textContent='⇔ B/A';btn.style.borderColor='var(--faint)';btn.style.color='var(--text-muted)';
    drawComposite();
  }
};

/* ── Download ── */
let _dlFormat='png';
window.setFormat=function(fmt,btn){
  _dlFormat=fmt;
  document.querySelectorAll('.fmt-btn').forEach(b=>b.classList.remove('fmt-btn-active'));
  document.querySelectorAll(`.fmt-btn[data-fmt="${fmt}"]`).forEach(b=>b.classList.add('fmt-btn-active'));
  const showQ=fmt==='jpeg'||fmt==='webp';
  ['mob-quality-row'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=showQ?'flex':'none';});
  document.getElementById('mob-dl-label').textContent='Download '+fmt.toUpperCase();
};

function getMimeExt(){
  if(_dlFormat==='jpeg')return{mime:'image/jpeg',ext:'jpg'};
  if(_dlFormat==='webp')return{mime:'image/webp',ext:'webp'};
  return{mime:'image/png',ext:'png'};
}
function getQuality(){const q=document.getElementById('mob-quality');return q?(+q.value/100):0.92;}

function buildExport(item){
  const sub=item.resultCanvas;
  const w=sub.width,h=sub.height;
  const exp=document.createElement('canvas');exp.width=w;exp.height=h;
  const ectx=exp.getContext('2d');
  const bg=item.bgSnapshot||{};
  const gradients={'gradient-purple':['#667eea','#764ba2'],'gradient-pink':['#f093fb','#f5576c'],'gradient-blue':['#4facfe','#00f2fe'],'gradient-green':['#43e97b','#38f9d7']};
  const dcW0=bg.dcWidth||w,ratio=w/dcW0;

  if(bg.photoBg&&bg.photoBg.img){
    const iw=bg.photoBg.img.naturalWidth,ih=bg.photoBg.img.naturalHeight;
    const sc=Math.max(w/iw,h/ih)*(bg.bgScale||1);
    const bx=(w-iw*sc)/2+(bg.bgOffsetX||0)*ratio, by=(h-ih*sc)/2+(bg.bgOffsetY||0)*ratio;
    if(bg.bgBlur>0){
      const pad=bg.bgBlur*3;
      const ofc=document.createElement('canvas');ofc.width=w+pad*2;ofc.height=h+pad*2;
      const ofctx=ofc.getContext('2d');
      ofctx.filter=`blur(${bg.bgBlur}px)`;
      ofctx.drawImage(bg.photoBg.img,bx+pad,by+pad,iw*sc,ih*sc);
      ofctx.filter='none';
      ectx.drawImage(ofc,-pad,-pad,w+pad*2,h+pad*2);
    } else {
      ectx.drawImage(bg.photoBg.img,bx,by,iw*sc,ih*sc);
    }
  } else if(bg.bgColor&&bg.bgColor!=='transparent'){
    if(gradients[bg.bgColor]){const g=ectx.createLinearGradient(0,0,w,h);g.addColorStop(0,gradients[bg.bgColor][0]);g.addColorStop(1,gradients[bg.bgColor][1]);ectx.fillStyle=g;}
    else ectx.fillStyle=bg.bgColor;
    ectx.fillRect(0,0,w,h);
  }

  const sScale=bg.subjectScale!=null?bg.subjectScale:1;
  const dcH=bg.dcHeight||h;
  const drW=dcW0*sScale,drH=dcH*sScale;
  const origX=(dcW0-drW)/2+(bg.subjectX||0),origY=(dcH-drH)/2+(bg.subjectY||0);
  const eSW=drW*ratio,eSH=drH*ratio,eSX=origX*ratio,eSY=origY*ratio;
  const eCX=eSX+eSW/2,eCY=eSY+eSH/2,eRad=(bg.subjectRotation||0)*Math.PI/180;
  const eFlipX=!!bg.flipX,eFlipY=!!bg.flipY;

  if(bg.glowEnabled&&bg.glowBlur>0){const hex=bg.glowColor,a=(bg.glowStrength||60)/100,r=parseInt(hex.slice(1,3),16),gv=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);ectx.save();ectx.translate(eCX,eCY);ectx.rotate(eRad);if(eFlipX)ectx.scale(-1,1);if(eFlipY)ectx.scale(1,-1);ectx.translate(-eCX,-eCY);ectx.shadowColor=`rgba(${r},${gv},${b},${a})`;ectx.shadowBlur=bg.glowBlur*2*ratio;ectx.shadowOffsetX=0;ectx.shadowOffsetY=0;for(let p=0;p<Math.max(1,Math.round((bg.glowStrength||60)/30));p++)ectx.drawImage(sub,eSX,eSY,eSW,eSH);ectx.restore();}
  if(bg.shadowEnabled){const rad2=bg.shadowAngle*Math.PI/180,dx=Math.cos(rad2)*bg.shadowDistance*ratio,dy=Math.sin(rad2)*bg.shadowDistance*ratio,hex=bg.shadowColor,a=bg.shadowOpacity/100,r=parseInt(hex.slice(1,3),16),gv=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);ectx.save();ectx.translate(eCX,eCY);ectx.rotate(eRad);if(eFlipX)ectx.scale(-1,1);if(eFlipY)ectx.scale(1,-1);ectx.translate(-eCX,-eCY);ectx.shadowColor=`rgba(${r},${gv},${b},${a})`;ectx.shadowBlur=bg.shadowBlur*ratio;ectx.shadowOffsetX=dx;ectx.shadowOffsetY=dy;ectx.drawImage(sub,eSX,eSY,eSW,eSH);ectx.restore();}
  if(bg.outlineEnabled&&bg.outlineWidth>0){ectx.save();ectx.translate(eCX,eCY);ectx.rotate(eRad);if(eFlipX)ectx.scale(-1,1);if(eFlipY)ectx.scale(1,-1);ectx.translate(-eCX,-eCY);drawOutline(ectx,sub,eSX,eSY,eSW,eSH,bg.outlineColor,bg.outlineWidth*ratio);ectx.restore();}

  ectx.save();ectx.translate(eCX,eCY);ectx.rotate(eRad);if(eFlipX)ectx.scale(-1,1);if(eFlipY)ectx.scale(1,-1);ectx.translate(-eCX,-eCY);
  const ef=bg.featherRadius||0;const fSrc=ef>0?applyFeather(sub,ef):sub;
  ectx.drawImage(fSrc,eSX,eSY,eSW,eSH);ectx.restore();
  return exp;
}

window.downloadCurrent=function(){
  const item=items.find(i=>i.id==activeId);if(!item)return;
  if(wCanvas){const cvs=document.createElement('canvas');cvs.width=wCanvas.width;cvs.height=wCanvas.height;cvs.getContext('2d').drawImage(wCanvas,0,0);item.resultCanvas=cvs;}
  const exp=buildExport(item);const{mime,ext}=getMimeExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-bg-removed.${ext}`;a.click();},mime,getQuality());
};

window.downloadItem=function(id){
  const item=items.find(i=>i.id==id);if(!item||!item.resultCanvas)return;
  const exp=buildExport(item);const{mime,ext}=getMimeExt();
  exp.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`;a.click();},mime,getQuality());
};

window.downloadAll=async function(){
  const done=items.filter(i=>i.status==='done');if(!done.length)return;
  const JSZip=window.JSZip;if(!JSZip){alert('JSZip not loaded');return;}
  const zip=new JSZip();const{mime,ext}=getMimeExt();
  for(const item of done){const exp=buildExport(item);const blob=await new Promise(res=>exp.toBlob(res,mime,getQuality()));zip.file(`wc-${item.name.replace(/\.[^.]+$/,'')}-nobg.${ext}`,blob);}
  const zipBlob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');a.href=URL.createObjectURL(zipBlob);a.download='westcrest-bg-removed.zip';a.click();
};

window.clearAll=function(){
  items=[];activeId=null;editorOpened=false;wCanvas=null;wCtx=null;origData=null;
  brushMode=null;isPainting=false;isPanning=false;zoom=1;panX=0;panY=0;baseW=0;baseH=0;
  undoStack=[];redoStack=[];
  currentBgColor='transparent';currentPhotoBg=null;
  fileIn.value='';dc.width=0;dc.height=0;cc.width=0;cc.height=0;
  document.getElementById('batch-grid').innerHTML='';
  document.getElementById('batch-header').classList.remove('active');
  document.getElementById('editor-wrap').classList.remove('active');
  dropZone.classList.remove('hidden');
  showToolbar(false);
};

/* ── Mouse Wheel Zoom ── */
viewport.addEventListener('wheel',e=>{
  if(!wCanvas)return;
  e.preventDefault();
  const r=viewport.getBoundingClientRect();
  const midX=e.clientX-r.left, midY=e.clientY-r.top;
  const delta=e.deltaY<0?1.1:0.909;
  const nz=Math.min(8,Math.max(0.25,zoom*delta));
  panX-=(midX-panX)*(nz/zoom-1);
  panY-=(midY-panY)*(nz/zoom-1);
  zoom=nz;renderAll();
},{passive:false});

/* ── Inject Reset Zoom button next to zoom-level display ── */
(function injectResetZoomBtn(){
  const zl=document.getElementById('zoom-level');
  if(!zl)return;
  // Already injected?
  if(document.getElementById('btn-reset-zoom'))return;
  const btn=document.createElement('button');
  btn.id='btn-reset-zoom';
  btn.textContent='↺ Reset';
  btn.title='Reset zoom to 100%';
  btn.style.cssText='font-size:11px;padding:4px 9px;border-radius:6px;border:1.5px solid var(--faint);background:var(--dark-4);color:var(--text-muted);cursor:pointer;margin-left:6px;flex-shrink:0;';
  btn.onclick=window.resetZoom;
  zl.parentNode.insertBefore(btn,zl.nextSibling);
})();

/* ── FAQ ── */
window.toggleFaq=function(el){
  document.querySelectorAll('.faq-item.open').forEach(it=>{if(it!==el)it.classList.remove('open');});
  el.classList.toggle('open');
};

/* ── Resize observer ── */
window.addEventListener('resize',()=>{if(wCanvas){computeBaseSize();renderAll();}});

/* ── Expose for editor observer ── */
// MutationObserver removed — showToolbar() is called explicitly at correct points

