/**
 * image-resizer.js — Tool logic for Image Resizer Pro
 * Requires: jszip (loaded via <script> in image-resizer.html)
 */

/* ── STATE ── */
let items=[], singleResult=null, AR=null, locked=true, bg='#ffffff', wmMode='none', wmImgEl=null, dpiValue=150;

/* ── TOP/SIDEBAR ACTION BAR SYNC ──
   The UI has two mirrored action bars: one in the sidebar (sidebarActions /
   sidebarBatchActions / btnDl / btnZip) and a sticky duplicate at the top of
   the canvas (sidebarActionsTop / sidebarBatchActionsTop / btnDlTop / btnZipTop).
   These helpers keep both bars in sync from a single call site so state never
   drifts between them. */
function setActionsMode(showSingle){
  const single=showSingle?'':'none', batch=showSingle?'none':'';
  document.getElementById('sidebarActions').style.display=single;
  document.getElementById('sidebarActionsTop').style.display=single;
  document.getElementById('sidebarBatchActions').style.display=batch;
  document.getElementById('sidebarBatchActionsTop').style.display=batch;
}
function setBtnDlDisabled(disabled){
  document.getElementById('btnDl').disabled=disabled;
  document.getElementById('btnDlTop').disabled=disabled;
}
function setBtnZipVisible(visible){
  const v=visible?'':'none';
  document.getElementById('btnZip').style.display=v;
  document.getElementById('btnZipTop').style.display=v;
}

// ═══════════════ PRESETS ═══════════════
const PRESETS={
  social:[
    {n:'Instagram Post',w:1080,h:1080},{n:'Instagram Story',w:1080,h:1920},
    {n:'Instagram Reel',w:1080,h:1920},{n:'Instagram Landscape',w:1080,h:566},
    {n:'Facebook Cover',w:820,h:312},{n:'Facebook Post',w:1200,h:630},
    {n:'Twitter/X Post',w:1200,h:675},{n:'Twitter/X Header',w:1500,h:500},
    {n:'LinkedIn Cover',w:1584,h:396},{n:'LinkedIn Post',w:1200,h:627},
    {n:'Pinterest Pin',w:1000,h:1500},{n:'YouTube Thumb',w:1280,h:720},
    {n:'TikTok Cover',w:1080,h:1920},{n:'WhatsApp DP',w:500,h:500},
  ],
  print:[
    {n:'A4 Portrait',w:2480,h:3508},{n:'A4 Landscape',w:3508,h:2480},
    {n:'A5 Portrait',w:1748,h:2480},{n:'A3 Portrait',w:3508,h:4961},
    {n:'US Letter',w:2550,h:3300},{n:'Business Card',w:1050,h:600},
    {n:'Postcard',w:1872,h:1271},{n:'Banner 6×2ft',w:5400,h:1800},
  ],
  web:[
    {n:'HD 720p',w:1280,h:720},{n:'Full HD 1080p',w:1920,h:1080},
    {n:'2K',w:2560,h:1440},{n:'4K',w:3840,h:2160},
    {n:'Square 800',w:800,h:800},{n:'Square 512',w:512,h:512},
    {n:'Favicon 32',w:32,h:32},{n:'Favicon 64',w:64,h:64},
    {n:'OG Image',w:1200,h:630},{n:'Hero Banner',w:1920,h:600},
    {n:'Blog Header',w:1200,h:400},{n:'Avatar 256',w:256,h:256},
  ],
  video:[
    {n:'720p HD',w:1280,h:720},{n:'1080p FHD',w:1920,h:1080},
    {n:'1440p 2K',w:2560,h:1440},{n:'4K UHD',w:3840,h:2160},
    {n:'Vertical 9:16',w:1080,h:1920},{n:'Square 1:1',w:1080,h:1080},
    {n:'4:3 Classic',w:1024,h:768},{n:'21:9 Ultra',w:2560,h:1080},
  ],
  device:[
    {n:'iPhone 15',w:1179,h:2556},{n:'iPhone 14',w:1170,h:2532},
    {n:'Samsung S23',w:1080,h:2340},{n:'iPad Air',w:1640,h:2360},
    {n:'iPad Pro 12.9"',w:2048,h:2732},{n:'MacBook 13"',w:2560,h:1600},
    {n:'Desktop FHD',w:1920,h:1080},{n:'Apple Watch 44',w:368,h:448},
  ],
  ecom:[
    {n:'Amazon Main',w:1000,h:1000},{n:'Amazon Detail',w:1500,h:1500},
    {n:'eBay Main',w:1600,h:1600},{n:'Shopify Product',w:2048,h:2048},
    {n:'Etsy Listing',w:2000,h:2000},{n:'WooCommerce',w:800,h:800},
    {n:'Flipkart',w:1000,h:1000},{n:'Meesho',w:900,h:900},
  ]
};

let activeCat='social', activePreset=null;

function showCat(cat, tabEl) {
  activeCat=cat;
  document.querySelectorAll('.ir-ptab').forEach(t=>t.classList.remove('on'));
  if(tabEl) tabEl.classList.add('on');
  const grid=document.getElementById('pgrid');
  grid.innerHTML=PRESETS[cat].map(p=>`
    <button class="ir-pbtn ${activePreset&&activePreset.w===p.w&&activePreset.h===p.h?'on':''}"
      onclick="applyPreset(${p.w},${p.h},'${p.n}',this)">
      <span class="ir-pbtn-name">${p.n}</span>
      <span class="ir-pbtn-dim">${p.w} × ${p.h}</span>
    </button>`).join('');
}

function applyPreset(w,h,name,el) {
  activePreset={w,h,name};
  document.getElementById('inpW').value=w;
  document.getElementById('inpH').value=h;
  document.getElementById('mode').value='exact';
  onModeChange();
  locked=false; updateLockUI();
  document.querySelectorAll('.ir-pbtn').forEach(b=>b.classList.remove('on'));
  if(el) el.classList.add('on');
  updateOutInfo();
}
showCat('social', document.querySelector('.ir-ptab'));

// ═══════════════ DPI ═══════════════
function setDpi(val, el) {
  document.querySelectorAll('.ir-dpi-btn').forEach(b=>b.classList.remove('on'));
  if(el) el.classList.add('on');
  const customRow = document.getElementById('dpiCustomRow');
  if(val===0) {
    customRow.style.display='';
    dpiValue=+document.getElementById('customDpiVal').value||150;
  } else {
    customRow.style.display='none';
    dpiValue=val;
  }
  document.getElementById('iDpi').innerText=dpiValue;
}
document.getElementById('customDpiVal').addEventListener('input',e=>{
  dpiValue=+e.target.value||150;
  document.getElementById('iDpi').innerText=dpiValue;
});

// ═══════════════ ACCORDION ═══════════════
function toggleAcc(id) { document.getElementById(id).classList.toggle('open'); }

// ═══════════════ MODE ═══════════════
function onModeChange() {
  const m=document.getElementById('mode').value;
  const isPct=m==='percent';
  const noH=['width-only','longest','shortest'].includes(m);
  const noW=m==='height-only';
  document.getElementById('grpPx').style.display=isPct?'none':'';
  document.getElementById('grpPct').style.display=isPct?'':'none';
  if(!isPct){
    document.getElementById('grpH').style.display=noH?'none':'';
    const wInp=document.getElementById('inpW').parentElement.parentElement;
    wInp.style.display=noW?'none':'';
  }
  updateOutInfo();
}

// ═══════════════ LOCK ═══════════════
function toggleLock(){locked=!locked;updateLockUI();}
function updateLockUI(){
  const b=document.getElementById('lockBtn');
  b.classList.toggle('on',locked);
  document.getElementById('lockIco').innerHTML=locked
    ?'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>'
    :'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/>';
}
function onW(){if(locked&&AR){const w=+document.getElementById('inpW').value;if(w)document.getElementById('inpH').value=Math.round(w/AR);}updateOutInfo();}
function onH(){if(locked&&AR){const h=+document.getElementById('inpH').value;if(h)document.getElementById('inpW').value=Math.round(h*AR);}updateOutInfo();}

// ═══════════════ BG / SWATCHES ═══════════════
function setSwatch(el,color){
  document.querySelectorAll('.ir-sw').forEach(s=>s.classList.remove('on'));
  if(el)el.classList.add('on');
  bg=color;
}

// ═══════════════ WATERMARK TABS ═══════════════
function setWmTab(t){
  wmMode=t;
  ['none','text','img'].forEach(x=>{
    const key=x.charAt(0).toUpperCase()+x.slice(1);
    document.getElementById('wmTab'+key).classList.toggle('on',x===t);
    document.getElementById('wmPanel'+key).classList.toggle('on',x===t);
  });
}

document.getElementById('wmImgFile').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();img.onload=()=>{wmImgEl=img;};img.src=URL.createObjectURL(f);
});

// ═══════════════ FILENAME PREVIEW ═══════════════
function updateFnamePreview(){
  const prefix=document.getElementById('fnPrefix').value||'resized';
  const pattern=document.getElementById('fnPattern').value;
  const fmt=document.getElementById('outFmt').value;
  const ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/bmp':'.bmp'}[fmt]||'.webp';
  const w=document.getElementById('inpW').value||'1920';
  const h=document.getElementById('inpH').value||'1080';
  const name='photo';
  let fname=pattern.replace('{prefix}',prefix).replace('{name}',name).replace('{w}',w).replace('{h}',h).replace('{index}','001');
  document.getElementById('fnamePreview').innerText=fname+ext;
}
updateFnamePreview();

// ═══════════════ DROP ZONE ═══════════════
const DZ=document.getElementById('dropZone');
DZ.addEventListener('dragenter',e=>{e.preventDefault();DZ.classList.add('drag-over');});
DZ.addEventListener('dragover',e=>{e.preventDefault();});
DZ.addEventListener('dragleave',e=>{if(!DZ.contains(e.relatedTarget))DZ.classList.remove('drag-over');});
DZ.addEventListener('drop',e=>{
  e.preventDefault();DZ.classList.remove('drag-over');
  const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/'));
  if(files.length)addFiles(files);
});
DZ.addEventListener('click',e=>{if(e.target===document.getElementById('file-in')||e.target.closest('button'))return;document.getElementById('file-in').click();});
document.getElementById('file-in').addEventListener('change',e=>{
  if(e.target.files.length)addFiles(Array.from(e.target.files));
  e.target.value='';
});

// Main area also accepts drops
document.getElementById('canvasWorkspace').addEventListener('dragover',e=>{e.preventDefault();});
document.getElementById('canvasWorkspace').addEventListener('drop',e=>{
  e.preventDefault();
  const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/'));
  if(files.length)addFiles(files);
});

// ═══════════════ STRIP RENDER ═══════════════
function renderStrip(){
  const strip=document.getElementById('imgStrip');
  if(items.length===0){strip.classList.remove('on');return;}
  strip.classList.add('on');
  // Remove old strip items (keep label header and add button)
  Array.from(strip.querySelectorAll('.ir-strip-item')).forEach(el=>el.remove());
  const addBtn=strip.querySelector('.ir-strip-add');
  items.forEach(it=>{
    const isEditing=editingId===it.id;
    const div=document.createElement('div');
    div.className='ir-strip-item'+(it.status==='done'?' ir-strip-done':'')+(isEditing?' ir-strip-editing':'');
    div.title=it.name;
    div.innerHTML=`
      <img src="${it.result?URL.createObjectURL(it.result.blob):it.url}" alt="">
      <div class="ir-strip-status ${it.status==='done'?'done':isEditing?'editing':'pending'}">${it.status==='done'?'✓':isEditing?'✏':'·'}</div>
      <div class="ir-strip-item-label">${it.name.length>12?it.name.slice(0,10)+'…':it.name}</div>
      <button class="ir-strip-remove" onclick="removeItem('${it.id}',event)" title="Remove">✕</button>`;
    div.addEventListener('click',()=>{
      if(editingId&&editingId!==it.id)return; // block switching while editing another
      if(it.status==='done'||it.status==='pending'){
        // Switch active preview in batch
        renderBatch();
      }
    });
    strip.insertBefore(div,addBtn);
  });
}
async function addFiles(files){
  const toAdd=files.slice(0,50-items.length);
  for(const f of toAdd){
    const url=URL.createObjectURL(f);
    const dims=await getDims(f);
    items.push({id:crypto.randomUUID(),file:f,name:f.name,origSize:f.size,
      origW:dims.w,origH:dims.h,url,result:null,status:'pending'});
  }
  if(items.length===1) initSingle();
  else initBatch();
}

function getDims(file){
  return new Promise(res=>{
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(u);res({w:img.naturalWidth,h:img.naturalHeight});};
    img.src=u;
  });
}

function initSingle(){
  const it=items[0];
  AR=it.origW/it.origH;
  if(!document.getElementById('inpW').value){
    document.getElementById('inpW').value=it.origW;
    document.getElementById('inpH').value=it.origH;
  }
  // topbar
  document.getElementById('iOrigDim').innerText=`${it.origW}×${it.origH}px`;
  document.getElementById('iFormat').innerText=it.name.split('.').pop().toUpperCase();
  document.getElementById('iOutFmt').innerText=getOutFmtLabel();
  document.getElementById('iSize').innerText=fmt(it.origSize);
  // views
  document.getElementById('emptyState').style.display='none';
  document.getElementById('singlePreview').classList.add('on');
  document.getElementById('batchSection').classList.remove('on');
  document.getElementById('origImg').src=it.url;
  document.getElementById('origBadge').innerText=`${it.origW}×${it.origH}`;
  document.getElementById('origDimF').innerText=`${it.origW} × ${it.origH} px`;
  document.getElementById('origSizeF').innerText=fmt(it.origSize);
  document.getElementById('singleFileName').innerText=it.name;
  // sidebar actions
  setActionsMode(true);
  document.getElementById('addMoreBar').classList.add('on');
  document.getElementById('batchStatBadge').style.display='none';
  setBtnDlDisabled(true);
  // reset output pane
  document.getElementById('outImg').style.display='none';
  document.getElementById('outPlaceholder').style.display='flex';
  document.getElementById('outBadge').innerText='—';
  document.getElementById('outDimF').innerText='—';
  document.getElementById('outSizeF').innerText='—';
  updateOutInfo();
  renderStrip();
}

function initBatch(){
  document.getElementById('emptyState').style.display='none';
  document.getElementById('singlePreview').classList.remove('on');
  document.getElementById('batchSection').classList.add('on');
  // topbar
  document.getElementById('iOrigDim').innerText=`${items.length} images`;
  document.getElementById('iFormat').innerText='Batch';
  document.getElementById('iOutFmt').innerText=getOutFmtLabel();
  document.getElementById('iSize').innerText='—';
  document.getElementById('iOutDim').innerText='—';
  document.getElementById('batchStatBadge').style.display='';
  // sidebar actions
  setActionsMode(false);
  document.getElementById('addMoreBar').classList.add('on');
  renderBatch();
  updateBatchHead();
  renderStrip();
}

// ═══════════════ REMOVE ═══════════════
function removeSingle(){
  if(!items.length)return;
  URL.revokeObjectURL(items[0].url);
  items=[];singleResult=null;AR=null;
  clearUI();
}

function removeItem(id,e){
  e.stopPropagation();
  const idx=items.findIndex(i=>i.id===id);
  if(idx<0)return;
  URL.revokeObjectURL(items[idx].url);
  items.splice(idx,1);
  if(items.length===0){clearUI();return;}
  if(items.length===1){editingId=null;document.getElementById('reeditBanner').classList.remove('on');initSingle();return;}
  renderBatch();updateBatchHead();renderStrip();
}

// ═══════════════ CLEAR ALL ═══════════════
function clearAll(){
  items.forEach(i=>{if(i.url)URL.revokeObjectURL(i.url);});
  items=[];singleResult=null;AR=null;
  clearUI();
}

function clearUI(){
  ['iOrigDim','iFormat','iOutFmt','iSize','iOutDim','iOutSize'].forEach(id=>document.getElementById(id).innerText='—');
  document.getElementById('iSavePct').innerText='';
  document.getElementById('iDpi').innerText=dpiValue;
  document.getElementById('emptyState').style.display='';
  document.getElementById('singlePreview').classList.remove('on');
  document.getElementById('batchSection').classList.remove('on');
  document.getElementById('batchGrid').innerHTML='';
  setActionsMode(true);
  setBtnDlDisabled(true);
  document.getElementById('addMoreBar').classList.remove('on');
  document.getElementById('batchStatBadge').style.display='none';
  document.getElementById('inpW').value='';
  document.getElementById('inpH').value='';
  document.getElementById('imgStrip').classList.remove('on');
  document.getElementById('batchDetailBar').classList.remove('on');
  selectedBatchId=null;
  editingId=null;
  document.getElementById('reeditBanner').classList.remove('on');
}

// ═══════════════ OUTPUT INFO ═══════════════
function updateOutInfo(){
  if(!items.length)return;
  const it=items[0];
  const d=calcDims(it.origW,it.origH);
  document.getElementById('iOutDim').innerText=`${d.w}×${d.h}px`;
  document.getElementById('outBadge').innerText=`${d.w}×${d.h}`;
  document.getElementById('outDimF').innerText=`${d.w} × ${d.h} px`;
  updateFnamePreview();
}

// ═══════════════ CALC DIMS ═══════════════
function calcDims(ow,oh){
  const m=document.getElementById('mode').value;
  const up=document.getElementById('advUp').checked;
  let tw=+document.getElementById('inpW').value||ow;
  let th=+document.getElementById('inpH').value||oh;
  const pct=+document.getElementById('inpPct').value||100;
  const ar=ow/oh;
  let rw,rh;
  if(m==='percent'){rw=Math.round(ow*pct/100);rh=Math.round(oh*pct/100);}
  else if(m==='width-only'||m==='longest'||m==='shortest'){if(!up)tw=Math.min(tw,ow);rw=tw;rh=Math.round(tw/ar);}
  else if(m==='height-only'){if(!up)th=Math.min(th,oh);rh=th;rw=Math.round(th*ar);}
  else if(m==='fit'||m==='contain'){
    if(!up){tw=Math.min(tw,ow);th=Math.min(th,oh);}
    const s=Math.min(tw/ow,th/oh);rw=Math.round(ow*s);rh=Math.round(oh*s);
  }
  else if(m==='cover'){if(!up){tw=Math.min(tw,ow);th=Math.min(th,oh);}rw=tw;rh=th;}
  else{if(!up){tw=Math.min(tw,ow);th=Math.min(th,oh);}rw=tw;rh=th;}
  return{w:Math.max(1,rw),h:Math.max(1,rh)};
}

// ═══════════════ CORE RESIZE ═══════════════
async function processFile(file,origW,origH){
  const m=document.getElementById('mode').value;
  const fmt2=document.getElementById('outFmt').value;
  const q=+document.getElementById('qualRange').value/100;
  const rot=+document.getElementById('advRot').value;
  const flipH=document.getElementById('advFlipH').checked;
  const flipV=document.getElementById('advFlipV').checked;
  const gray=document.getElementById('advGray').checked;
  const sharp=document.getElementById('advSharp').checked;
  const pad=document.getElementById('advPad').checked;
  const padAmt=+document.getElementById('padAmt').value||20;

  const d=calcDims(origW,origH);
  let rw=d.w,rh=d.h;
  const tw=+document.getElementById('inpW').value||rw;
  const th=+document.getElementById('inpH').value||rh;

  const img=await loadImg(file);
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');

  let cw,ch;
  if(m==='cover'){cw=tw;ch=th;}
  else if(m==='contain'||m==='fit'){cw=tw;ch=th;}
  else{cw=rw;ch=rh;}
  if(pad){cw+=padAmt*2;ch+=padAmt*2;}
  if(rot===90||rot===270){[cw,ch]=[ch,cw];}
  canvas.width=cw;canvas.height=ch;

  if(bg==='transparent'){ctx.clearRect(0,0,cw,ch);}
  else{ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);}

  ctx.save();
  ctx.translate(cw/2,ch/2);
  if(rot)ctx.rotate(rot*Math.PI/180);
  if(flipH)ctx.scale(-1,1);
  if(flipV)ctx.scale(1,-1);

  if(m==='cover'){
    const scW=tw/origW,scH=th/origH,sc=Math.max(scW,scH);
    const dw=origW*sc,dh=origH*sc;
    ctx.drawImage(img,-dw/2,-dh/2,dw,dh);
  }else if(m==='contain'||m==='fit'){
    ctx.drawImage(img,-rw/2,-rh/2,rw,rh);
  }else{
    ctx.drawImage(img,pad?-rw/2:-(rw/2),pad?-rh/2:-(rh/2),rw,rh);
  }
  ctx.restore();

  if(gray)applyGray(ctx,cw,ch);
  if(sharp)applySharpen(ctx,cw,ch);
  if(wmMode==='text')applyTextWM(ctx,cw,ch);
  else if(wmMode==='img'&&wmImgEl)applyImgWM(ctx,cw,ch);

  let blob=await toBlob(canvas,fmt2,q);

  // DPI embed for JPEG
  if(fmt2==='image/jpeg'&&document.getElementById('embedDpi').checked){
    blob=await embedJpegDpi(blob,dpiValue);
  }

  return{blob,w:cw,h:ch};
}

// ═══════════════ DPI EMBED (JPEG JFIF/EXIF) ═══════════════
async function embedJpegDpi(blob,dpi){
  try{
    const ab=await blob.arrayBuffer();
    const arr=new Uint8Array(ab);
    // Find JFIF APP0 marker (FF E0) and patch DPI fields
    // JFIF header: FF D8 FF E0 [len2] JFIF\0 [version2] [units] [Xdensity2] [Ydensity2]
    if(arr[0]===0xFF&&arr[1]===0xD8&&arr[2]===0xFF&&arr[3]===0xE0){
      const modified=new Uint8Array(arr);
      modified[11]=1; // units = DPI (1=dots per inch)
      modified[12]=(dpi>>8)&0xFF;
      modified[13]=dpi&0xFF;
      modified[14]=(dpi>>8)&0xFF;
      modified[15]=dpi&0xFF;
      return new Blob([modified],{type:'image/jpeg'});
    }
    return blob;
  }catch(e){return blob;}
}

function loadImg(file){
  return new Promise((res,rej)=>{
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{URL.revokeObjectURL(u);res(img);};
    img.onerror=rej;img.src=u;
  });
}
function toBlob(canvas,type,q){return new Promise(r=>canvas.toBlob(r,type,q));}

function applyGray(ctx,w,h){
  const d=ctx.getImageData(0,0,w,h);
  for(let i=0;i<d.data.length;i+=4){
    const g=d.data[i]*.299+d.data[i+1]*.587+d.data[i+2]*.114;
    d.data[i]=d.data[i+1]=d.data[i+2]=g;
  }
  ctx.putImageData(d,0,0);
}

function applySharpen(ctx,w,h){
  const id=ctx.getImageData(0,0,w,h);
  const src=new Uint8ClampedArray(id.data);
  const k=[-1,-1,-1,-1,9,-1,-1,-1,-1];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    let r=0,g=0,b=0;
    for(let ky=-1;ky<=1;ky++)for(let kx=-1;kx<=1;kx++){
      const p=((y+ky)*w+(x+kx))*4,ki=(ky+1)*3+(kx+1);
      r+=src[p]*k[ki];g+=src[p+1]*k[ki];b+=src[p+2]*k[ki];
    }
    const i=(y*w+x)*4;
    id.data[i]=Math.min(255,Math.max(0,r));
    id.data[i+1]=Math.min(255,Math.max(0,g));
    id.data[i+2]=Math.min(255,Math.max(0,b));
  }
  ctx.putImageData(id,0,0);
}

function applyTextWM(ctx,cw,ch){
  const text=document.getElementById('wmText').value||'© Westcrest Media';
  const size=+document.getElementById('wmSize').value||28;
  const color=document.getElementById('wmColor').value;
  const opacity=+document.getElementById('wmOpacity').value/100;
  const pos=document.getElementById('wmPos').value;
  const font=document.getElementById('wmFont').value;
  ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;
  ctx.font=`${size}px ${font}`;ctx.textBaseline='bottom';
  const pad=size*0.6;const tw=ctx.measureText(text).width;
  if(pos==='tile'){
    ctx.globalAlpha=opacity*0.4;ctx.rotate(-Math.PI/6);
    for(let y=-ch;y<cw+ch;y+=size*3)for(let x=-cw;x<cw*2;x+=tw+size*2)ctx.fillText(text,x,y);
  }else{
    let x,y;ctx.textBaseline='alphabetic';
    if(pos==='bottom-right'){x=cw-tw-pad;y=ch-pad;}
    else if(pos==='bottom-left'){x=pad;y=ch-pad;}
    else if(pos==='top-right'){x=cw-tw-pad;y=size+pad;}
    else if(pos==='top-left'){x=pad;y=size+pad;}
    else{x=(cw-tw)/2;y=(ch+size)/2;}
    ctx.shadowColor='rgba(0,0,0,0.4)';ctx.shadowBlur=4;
    ctx.fillText(text,x,y);
  }
  ctx.restore();
}

function applyImgWM(ctx,cw,ch){
  const sizeP=+document.getElementById('wmImgSize').value/100;
  const opacity=+document.getElementById('wmImgOpacity').value/100;
  const pos=document.getElementById('wmImgPos').value;
  const wmW=cw*sizeP;const wmH=wmW*(wmImgEl.naturalHeight/wmImgEl.naturalWidth);
  const pad=Math.min(cw,ch)*0.03;
  let x,y;
  if(pos==='bottom-right'){x=cw-wmW-pad;y=ch-wmH-pad;}
  else if(pos==='bottom-left'){x=pad;y=ch-wmH-pad;}
  else if(pos==='top-right'){x=cw-wmW-pad;y=pad;}
  else if(pos==='top-left'){x=pad;y=pad;}
  else{x=(cw-wmW)/2;y=(ch-wmH)/2;}
  ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(wmImgEl,x,y,wmW,wmH);ctx.restore();
}

// ═══════════════ SINGLE RESIZE ═══════════════
async function doResize(){
  if(items.length===0)return;
  // If in batch editing mode, resize just the editing item
  if(editingId){
    const it=items.find(i=>i.id===editingId);
    if(!it)return;
    showOverlay('Resizing…',it.name.slice(0,30));
    try{
      const r=await processFile(it.file,it.origW,it.origH);
      it.result=r;it.status='done';
      const url=URL.createObjectURL(r.blob);
      const outImg=document.getElementById('outImg');
      outImg.src=url;outImg.style.display='block';
      document.getElementById('outPlaceholder').style.display='none';
      document.getElementById('outBadge').innerText=`${r.w}×${r.h}`;
      document.getElementById('outDimF').innerText=`${r.w} × ${r.h} px`;
      document.getElementById('outSizeF').innerText=fmt(r.blob.size);
      // Update topbar output info
      document.getElementById('iOutDim').innerText=`${r.w}×${r.h}px`;
      document.getElementById('iOutSize').innerText=fmt(r.blob.size);
      const saved=it.origSize-r.blob.size;
      const pct=Math.round(saved/it.origSize*100);
      document.getElementById('iSavePct').innerText=saved>0?`▼ ${pct}% saved`:'';
      singleResult={blob:r.blob,name:it.name,w:r.w,h:r.h,url};
      setBtnDlDisabled(false);
      showResult(`${r.w}×${r.h}`);
      // Show done button prominently
      document.getElementById('btnDoneEdit').style.animation='pulse-green 1s ease 2';
    }catch(e){hideOverlay();alert('Could not resize.');}
    return;
  }
  if(items.length>1){resizeAll();return;}
  const it=items[0];
  showOverlay('Resizing…',it.name.slice(0,30));
  try{
    const r=await processFile(it.file,it.origW,it.origH);
    it.result=r;it.status='done';
    const url=URL.createObjectURL(r.blob);
    const outImg=document.getElementById('outImg');
    outImg.src=url;outImg.style.display='block';
    document.getElementById('outPlaceholder').style.display='none';
    document.getElementById('outBadge').innerText=`${r.w}×${r.h}`;
    document.getElementById('outDimF').innerText=`${r.w} × ${r.h} px`;
    document.getElementById('outSizeF').innerText=fmt(r.blob.size);
    // Update topbar output info
    document.getElementById('iOutDim').innerText=`${r.w}×${r.h}px`;
    document.getElementById('iOutSize').innerText=fmt(r.blob.size);
    const saved=it.origSize-r.blob.size;
    const pct=Math.round(saved/it.origSize*100);
    document.getElementById('iSavePct').innerText=saved>0?`▼ ${pct}% saved`:'';
    singleResult={blob:r.blob,name:it.name,w:r.w,h:r.h,url};
    setBtnDlDisabled(false);
    showResult(`${r.w}×${r.h}`);
  }catch(e){hideOverlay();alert('Could not resize. Try a different format.');}
}

function dlSingle(){
  if(!singleResult)return;
  const ext=getExt();
  dl(singleResult.blob,buildFname(singleResult.name,singleResult.w,singleResult.h,1)+ext);
}

// Done editing — go back to batch view
function finishEdit(){
  editingId=null;
  document.getElementById('reeditBanner').classList.remove('on');
  singleResult=null;
  // Back to batch
  document.getElementById('singlePreview').classList.remove('on');
  document.getElementById('batchSection').classList.add('on');
  setActionsMode(false);
  renderBatch();updateBatchHead();
  // Restore batch topbar
  document.getElementById('iOrigDim').innerText=`${items.length} images`;
  document.getElementById('iFormat').innerText='Batch';
  document.getElementById('iSize').innerText='—';
  document.getElementById('iOutDim').innerText='—';
  document.getElementById('iOutSize').innerText='—';
  document.getElementById('iSavePct').innerText='';
  // Highlight strip
  renderStrip();
}

// Cancel editing — restore item's previous state and go back to batch
function cancelEdit(){
  if(editingId){
    const it=items.find(i=>i.id===editingId);
    if(it){ it.status=it.result?'done':'pending'; }
    editingId=null;
  }
  document.getElementById('reeditBanner').classList.remove('on');
  singleResult=null;
  document.getElementById('singlePreview').classList.remove('on');
  document.getElementById('batchSection').classList.add('on');
  setActionsMode(false);
  renderBatch();updateBatchHead();
  document.getElementById('iOrigDim').innerText=`${items.length} images`;
  document.getElementById('iFormat').innerText='Batch';
  document.getElementById('iSize').innerText='—';
  document.getElementById('iOutDim').innerText='—';
  document.getElementById('iOutSize').innerText='—';
  document.getElementById('iSavePct').innerText='';
  renderStrip();
}

// ═══════════════ BATCH ═══════════════
let selectedBatchId=null;
let lightboxSrc=null;

function getOutFmtLabel(){
  return{'image/jpeg':'JPG','image/png':'PNG','image/webp':'WEBP','image/gif':'GIF','image/bmp':'BMP'}[document.getElementById('outFmt').value]||'WEBP';
}

function renderBatch(){
  const g=document.getElementById('batchGrid');
  if(!items.length){g.innerHTML='';return;}
  g.innerHTML=items.map(it=>`
    <div class="bcard ${it.status==='done'?'done':''} ${selectedBatchId===it.id?'selected':''}" onclick="selectBatchCard('${it.id}')">
      <div class="bcard-thumb-wrap">
        <img class="bcard-thumb" src="${it.result?URL.createObjectURL(it.result.blob):it.url}" alt="">
        <div class="bcard-remove" onclick="removeItem('${it.id}',event)" title="Remove">✕</div>
      </div>
      <div class="bcard-inner">
        <div class="bcard-name" title="${it.name}">${it.name.length>26?it.name.slice(0,23)+'…':it.name}</div>
        <div class="bcard-dims">${it.origW}×${it.origH}${it.result?` → ${it.result.w}×${it.result.h}`:''}</div>
        <div class="bcard-size">${fmt(it.origSize)}${it.result?` → ${fmt(it.result.blob.size)}`:''}</div>
      </div>
      <div class="bcard-foot">
        <span class="status ${it.status}">${
          it.status==='pending'?'⏳ Pending':
          it.status==='working'?'🔄 Resizing…':
          it.status==='done'?'✅ Done':'❌ Error'
        }</span>
        <div style="display:flex;gap:4px;">
          ${it.status==='done'?`<button class="btn-edit-sm" onclick="event.stopPropagation();editItem('${it.id}')">✏ Re-edit</button>`:''}
          <button class="btn-dl-sm" onclick="event.stopPropagation();dlItem('${it.id}')" ${it.status!=='done'?'disabled':''}>⬇</button>
        </div>
      </div>
    </div>`).join('');
}

function selectBatchCard(id){
  const it=items.find(i=>i.id===id);
  if(!it)return;
  selectedBatchId=id;
  renderBatch();
  // populate detail bar
  const outFmt=getOutFmtLabel();
  const src=it.result?URL.createObjectURL(it.result.blob):it.url;
  lightboxSrc=src;
  document.getElementById('bdbThumb').src=src;
  document.getElementById('bdbName').innerText=it.name;
  document.getElementById('bdbFmtIn').innerText=it.name.split('.').pop().toUpperCase();
  document.getElementById('bdbFmtOut').innerText=outFmt;
  document.getElementById('bdbSizeIn').innerText=fmt(it.origSize);
  const sizeOut=document.getElementById('bdbSizeOut');
  const saved=document.getElementById('bdbSaved');
  const dims=document.getElementById('bdbDims');
  // Also sync the main top info chips so this single image's details
  // show in place of the generic "Batch" summary, even with multiple photos loaded.
  document.getElementById('iOrigDim').innerText=`${it.origW}×${it.origH}px`;
  document.getElementById('iFormat').innerText=it.name.split('.').pop().toUpperCase();
  document.getElementById('iOutFmt').innerText=outFmt;
  document.getElementById('iSize').innerText=fmt(it.origSize);
  if(it.result){
    sizeOut.innerText='→ '+fmt(it.result.blob.size);sizeOut.style.display='';
    const pct=((1-it.result.blob.size/it.origSize)*100).toFixed(1);
    saved.innerText='▼ '+pct+'% saved';saved.style.display='';
    dims.innerText=`${it.result.w}×${it.result.h}px`;
    document.getElementById('iOutDim').innerText=`${it.result.w}×${it.result.h}px`;
    document.getElementById('iOutSize').innerText=fmt(it.result.blob.size);
    document.getElementById('iSavePct').innerText='▼ '+pct+'% saved';
    document.getElementById('lightboxMeta').innerText=`${it.name} · ${it.origW}×${it.origH} → ${it.result.w}×${it.result.h} · ${fmt(it.origSize)} → ${fmt(it.result.blob.size)} (${pct}% smaller)`;
  }else{
    sizeOut.style.display='none';saved.style.display='none';
    dims.innerText=`${it.origW}×${it.origH}px`;
    document.getElementById('iOutDim').innerText='—';
    document.getElementById('iOutSize').innerText='—';
    document.getElementById('iSavePct').innerText='Not resized yet';
    document.getElementById('lightboxMeta').innerText=`${it.name} · ${it.origW}×${it.origH} · ${fmt(it.origSize)} · Not yet resized`;
  }
  document.getElementById('batchDetailBar').classList.add('on');
  document.getElementById('batchDetailBar').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function closeDetailBar(){
  selectedBatchId=null;
  document.getElementById('batchDetailBar').classList.remove('on');
  renderBatch();
  // Restore the generic batch summary in the top info chips
  document.getElementById('iOrigDim').innerText=`${items.length} images`;
  document.getElementById('iFormat').innerText='Batch';
  document.getElementById('iOutFmt').innerText=getOutFmtLabel();
  document.getElementById('iSize').innerText='—';
  document.getElementById('iOutDim').innerText='—';
  document.getElementById('iOutSize').innerText='—';
  document.getElementById('iSavePct').innerText='';
}

function openLightbox(){
  if(!lightboxSrc)return;
  document.getElementById('lightboxImg').src=lightboxSrc;
  document.getElementById('lightbox').classList.add('on');
}
function closeLightbox(){document.getElementById('lightbox').classList.remove('on');}

function updateBatchHead(){
  const done=items.filter(i=>i.status==='done').length;
  document.getElementById('batchCount').innerText=items.length;
  document.getElementById('batchDone').innerText=done;
  document.getElementById('batchTxt').innerText=`${done}/${items.length}`;
  document.getElementById('batchStatBadge').style.display='';
  setBtnZipVisible(done>1);
}

async function resizeAll(){
  const pending=items.filter(i=>i.status==='pending');
  if(!pending.length){
    // Re-resize all (user changed settings after done)
    items.forEach(i=>i.status='pending');
    renderBatch();
    return resizeAll();
  }
  for(let idx=0;idx<pending.length;idx++){
    const it=pending[idx];
    it.status='working';renderBatch();
    showOverlay(`Resizing ${idx+1}/${pending.length}`,it.name.slice(0,28));
    try{
      const r=await processFile(it.file,it.origW,it.origH);
      it.result=r;it.status='done';
    }catch(e){it.status='error';}
    renderBatch();updateBatchHead();
  }
  hideOverlay();
  renderStrip();
}

// ═══ RE-EDIT STATE ═══
let editingId=null; // id of item currently being re-edited

// Edit an individual batch item — switch to single-edit mode for it, keep all other items
function editItem(id){
  const it=items.find(i=>i.id===id);
  if(!it)return;
  editingId=id;
  it.status='editing';
  AR=it.origW/it.origH;
  // Set sidebar inputs to match this image
  document.getElementById('inpW').value=it.origW;
  document.getElementById('inpH').value=it.origH;
  // Topbar
  document.getElementById('iOrigDim').innerText=`${it.origW}×${it.origH}px`;
  document.getElementById('iFormat').innerText=it.name.split('.').pop().toUpperCase();
  document.getElementById('iSize').innerText=fmt(it.origSize);
  document.getElementById('iOutDim').innerText='—';
  document.getElementById('iOutSize').innerText='—';
  document.getElementById('iSavePct').innerText='';
  // Show single preview for this item
  document.getElementById('emptyState').style.display='none';
  document.getElementById('batchSection').classList.remove('on');
  document.getElementById('singlePreview').classList.add('on');
  document.getElementById('origImg').src=it.url;
  document.getElementById('origBadge').innerText=`${it.origW}×${it.origH}`;
  document.getElementById('origDimF').innerText=`${it.origW} × ${it.origH} px`;
  document.getElementById('origSizeF').innerText=fmt(it.origSize);
  document.getElementById('singleFileName').innerText=it.name;
  // Reset output pane
  document.getElementById('outImg').style.display='none';
  document.getElementById('outPlaceholder').style.display='flex';
  document.getElementById('outBadge').innerText='—';
  document.getElementById('outDimF').innerText='—';
  document.getElementById('outSizeF').innerText='—';
  // Switch sidebar to single actions
  setActionsMode(true);
  setBtnDlDisabled(true);
  singleResult=null;
  // Show re-edit banner
  document.getElementById('reeditName').innerText=it.name.length>30?it.name.slice(0,27)+'…':it.name;
  document.getElementById('reeditBanner').classList.add('on');
  updateOutInfo();
}

window.dlItem=(id)=>{
  const it=items.find(i=>i.id===id);
  if(!it||!it.result)return;
  const ext=getExt();
  dl(it.result.blob,buildFname(it.name,it.result.w,it.result.h,items.indexOf(it)+1)+ext);
};

async function dlZip(){
  const done=items.filter(i=>i.status==='done');
  if(!done.length)return;
  const zip=new JSZip();
  const ext=getExt();
  done.forEach((it,idx)=>zip.file(buildFname(it.name,it.result.w,it.result.h,idx+1)+ext,it.result.blob));
  const b=await zip.generateAsync({type:'blob'});
  dl(b,'westcrest_resized.zip');
}

// ═══════════════ CANVAS MODAL ═══════════════
function openModal(type){
  const modal=document.getElementById('canvasModal');
  const img=document.getElementById('cmImg');
  const title=document.getElementById('cmTitle');
  const meta=document.getElementById('cmMeta');
  if(type==='orig'&&items.length){
    img.src=items[0].url;
    title.innerText='ORIGINAL IMAGE';
    meta.innerText=`${items[0].origW} × ${items[0].origH} px · ${fmt(items[0].origSize)}`;
  }else if(type==='out'&&singleResult){
    img.src=singleResult.url;
    title.innerText='RESIZED OUTPUT';
    meta.innerText=`${singleResult.w} × ${singleResult.h} px · ${fmt(singleResult.blob.size)} · ${dpiValue} DPI`;
  }else return;
  modal.classList.add('on');
}

function openBatchModal(id){
  const it=items.find(i=>i.id===id);
  if(!it)return;
  const modal=document.getElementById('canvasModal');
  const img=document.getElementById('cmImg');
  document.getElementById('cmTitle').innerText=it.status==='done'?'RESIZED OUTPUT':'ORIGINAL IMAGE';
  img.src=it.status==='done'?URL.createObjectURL(it.result.blob):it.url;
  document.getElementById('cmMeta').innerText=
    it.status==='done'
      ?`${it.result.w} × ${it.result.h} px · ${fmt(it.result.blob.size)} · ${dpiValue} DPI`
      :`${it.origW} × ${it.origH} px · ${fmt(it.origSize)} · Original`;
  modal.classList.add('on');
}

function closeModal(){document.getElementById('canvasModal').classList.remove('on');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeLightbox();}});

// Update iOutFmt when output format changes
document.getElementById('outFmt').addEventListener('change',()=>{
  document.getElementById('iOutFmt').innerText=getOutFmtLabel();
  updateFnamePreview();
});

// ═══════════════ OVERLAY ═══════════════
let _ovInterval;
function showOverlay(title,sub){
  document.getElementById('ovTitle').innerText=title;
  document.getElementById('ovSub').innerText=sub||'';
  document.getElementById('ovFill').style.width='0%';
  document.getElementById('ovResult').classList.remove('on');
  document.getElementById('overlay').classList.add('on');
  let p=0;
  clearInterval(_ovInterval);
  _ovInterval=setInterval(()=>{p=Math.min(88,p+Math.random()*10);document.getElementById('ovFill').style.width=p+'%';},80);
}
function showResult(txt){
  clearInterval(_ovInterval);
  document.getElementById('ovFill').style.width='100%';
  document.getElementById('ovTitle').innerText='Done ✓';
  document.getElementById('ovResult').innerText=txt;
  document.getElementById('ovResult').classList.add('on');
  setTimeout(hideOverlay,900);
}
function hideOverlay(){clearInterval(_ovInterval);document.getElementById('overlay').classList.remove('on');}

// ═══════════════ UTILS ═══════════════
function fmt(b){if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(2)+'MB';}
function getExt(){return{'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/bmp':'.bmp'}[document.getElementById('outFmt').value]||'.webp';}
function buildFname(origName,w,h,idx){
  const prefix=document.getElementById('fnPrefix').value||'resized';
  const pattern=document.getElementById('fnPattern').value;
  const name=origName.replace(/\.[^.]+$/,'');
  const idxStr=String(idx).padStart(3,'0');
  return pattern.replace('{prefix}',prefix).replace('{name}',name).replace('{w}',w).replace('{h}',h).replace('{index}',idxStr);
}
function dl(blob,fname){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;a.click();}

