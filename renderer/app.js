/* ===== Podgląd — interfejs ===== */
const $=s=>document.querySelector(s);
const EXT={jpg:'jpg',jpeg:'jpg',jpe:'jpg',jfif:'jpg',png:'png',psd:'psd',psb:'psd',tif:'tif',tiff:'tif',tga:'tga',exr:'exr',hdr:'hdr',
  webp:'webp',avif:'avif',gif:'gif',bmp:'bmp',dib:'bmp',ico:'ico',svg:'svg',
  dng:'raw',cr2:'raw',cr3:'raw',nef:'raw',nrw:'raw',arw:'raw',sr2:'raw',srf:'raw',orf:'raw',rw2:'raw',raf:'raw',pef:'raw',srw:'raw',
  '3fr':'raw',iiq:'raw',erf:'raw',kdc:'raw',mrw:'raw',rwl:'raw',x3f:'raw'};
const EXTS=Object.keys(EXT);
const TYPES=['jpg','png','psd','tif','tga','exr','hdr','raw','webp','avif','gif','bmp','ico','svg']; // kolejność filtrów
const NATIVE=new Set(['jpg','png','webp','avif','gif','bmp','ico','svg']);           // dekoduje silnik przeglądarki
const OPAQUE=new Set(['jpg','raw','hdr','exr']);                                     // nie mają przezroczystości
const on=t=>S.types[t]!==false;
const extOf=n=>{const i=n.lastIndexOf('.');return i<0?'':n.slice(i+1).toLowerCase();};
const coll=new Intl.Collator('pl',{numeric:true,sensitivity:'base'});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ł/g,'l');
const plural=(n,a,b,c)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?b:c;
const isMac=api.platform==='darwin', SEP=api.sep;
const FINDER=isMac?'Finderze':'Eksploratorze';
const TH=480;       // rozdzielczość miniatur w pikselach
const SKIM=12;      // ile obrazów folderu można przejrzeć na kafelku
const grid=$('#grid'), main=$('#main');

/* --- ustawienia (zapisywane lokalnie w programie) --- */
const S=Object.assign({types:{},sort:'name',dir:1,size:180,lic:28,mode:'icons',names:true,theme:null,favs:[],last:null},
  (()=>{try{return JSON.parse(localStorage.getItem('podglad')||'{}');}catch(e){return {};}})());
const save=()=>{try{localStorage.setItem('podglad',JSON.stringify(S));}catch(e){}};
const press=(b,v)=>b.setAttribute('aria-pressed',v?'true':'false');

function applyTheme(){
  const t=S.theme||'auto';
  const dark=t==='auto'?matchMedia('(prefers-color-scheme: dark)').matches:t==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelectorAll('#themeT button').forEach(b=>press(b,b.dataset.th===t));
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
document.querySelectorAll('#themeT button').forEach(b=>b.onclick=()=>{S.theme=b.dataset.th==='auto'?null:b.dataset.th;save();applyTheme();});
function cycleTheme(){S.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();}

/* rozmiar miniatur: suwak, + i −, Ctrl/⌘ + kółko lub gest szczypania na gładziku */
function setSize(v,tip){
  if(S.mode==='list'){S.lic=Math.round(Math.max(16,Math.min(96,v)));document.documentElement.style.setProperty('--lic',S.lic+'px');if(tip)zoomTip(S.lic+' px');}
  else{S.size=Math.round(Math.max(90,Math.min(420,v)));$('#size').value=S.size;document.documentElement.style.setProperty('--tile-w',S.size+'px');
    if(tip){const n=cols();zoomTip(n+' '+plural(n,'kolumna','kolumny','kolumn'));}}
  save();
}
const zcur=()=>S.mode==='list'?S.lic:S.size;
const zstep=d=>setSize(zcur()*(d>0?1.15:1/1.15),true);
let tipEl=null,tipT=0;
function zoomTip(t){if(!tipEl){tipEl=document.createElement('div');tipEl.className='zoomtip';document.body.appendChild(tipEl);}
  tipEl.textContent=t;tipEl.classList.add('on');clearTimeout(tipT);tipT=setTimeout(()=>tipEl.classList.remove('on'),800);}
document.documentElement.style.setProperty('--lic',S.lic+'px');
setSize(S.size);
$('#size').oninput=e=>{S.mode==='list'?setSize(+e.target.value/6):setSize(+e.target.value);};
$('#zminus').onclick=()=>zstep(-1); $('#zplus').onclick=()=>zstep(1);
main.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setSize(zcur()*Math.exp(-e.deltaY/100),true);},{passive:false});

/* filtry, sortowanie, widoki */
function typeCounts(){const n={}; for(const it of items) n[it.type]=(n[it.type]||0)+1; return n;}
function renderTypes(){
  const n=typeCounts(), present=TYPES.filter(t=>n[t]), hidden=present.filter(t=>!on(t)).length;
  const b=$('#typesBtn'); b.textContent=hidden?'Typy '+(present.length-hidden)+'/'+present.length+' ▾':'Typy ▾'; b.classList.toggle('on',!!hidden);
}
function refilter(){save();renderTypes();for(const d of dirs)resetDir(d);applyView(keep());}
function typesMenu(){
  const n=typeCounts(), r=$('#typesBtn').getBoundingClientRect();
  const present=TYPES.filter(t=>n[t]||!on(t));
  if(!present.length){showMenu(r.left,r.bottom+4,'Brak obrazów',[]);return;}
  showMenu(r.left,r.bottom+4,'Pokazuj typy',[
    ...present.map(t=>({label:(on(t)?'✓  ':'     ')+(t==='tif'?'tiff':t)+'  ('+(n[t]||0)+')',run:()=>{S.types[t]=!on(t);refilter();typesMenu();}})),
    '-',{label:'Pokaż wszystkie',run:()=>{S.types={};refilter();}}]);
}
$('#typesBtn').onclick=e=>{e.stopPropagation();ctx.hidden?typesMenu():hideMenu();};
const DEF_DIR={name:1,type:1,date:-1,size:-1,dims:-1};
function setSort(k){ if(S.sort===k) S.dir=-S.dir; else {S.sort=k;S.dir=DEF_DIR[k]||1;} save(); markSort(); applyView(keep()); }
function markSort(){$('#sortSel').value=S.sort;$('#sortDir').textContent=S.dir>0?'↑':'↓';$('#sortDir').title=S.dir>0?'Rosnąco — kliknij, żeby odwrócić':'Malejąco — kliknij, żeby odwrócić';}
$('#sortSel').onchange=e=>setSort(e.target.value);
$('#sortDir').onclick=()=>{S.dir=-S.dir;save();markSort();applyView(keep());};
function markModes(){
  document.querySelectorAll('#mode button').forEach(b=>press(b,b.dataset.v===S.mode));
  $('#size').min=S.mode==='list'?96:90; $('#size').max=S.mode==='list'?576:420;
  $('#size').value=S.mode==='list'?S.lic*6:S.size;
}
function setMode(m){if(S.mode===m)return;S.mode=m;save();markModes();render();}
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.v));
function setNames(v){S.names=v;save();document.body.classList.toggle('nonames',!v);$('#names').checked=v;}
$('#names').onchange=e=>setNames(e.target.checked);

/* wyszukiwanie */
let qt=0;
$('#q').oninput=()=>{$('#qClear').hidden=!$('#q').value;clearTimeout(qt);qt=setTimeout(()=>applyView(keep()),120);};
$('#qClear').onclick=()=>{$('#q').value='';$('#qClear').hidden=true;applyView(keep());$('#q').focus();};

/* --- pamięć miniatur (folder na dysku, obsługuje ją proces główny) --- */
const fmtSize=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':b<1073741824?(b/1048576).toLocaleString('pl',{maximumFractionDigits:1})+' MB':(b/1073741824).toLocaleString('pl',{maximumFractionDigits:1})+' GB';
async function cacheInfo(){
  const c=await api.cacheInfo();
  $('#cache').textContent=c.count.toLocaleString('pl')+' '+plural(c.count,'miniatura','miniatury','miniatur')+' · '+fmtSize(c.bytes);
  $('#cache').title=c.dir;
  $('#cacheLimit').value=String(c.limitMB);
}
let newThumbs=0; setInterval(()=>{if(newThumbs){newThumbs=0;cacheInfo();}},4000);
$('#cacheLimit').onchange=async e=>{await api.cacheLimit(+e.target.value);cacheInfo();};
$('#cacheDir').onclick=async()=>{const d=await api.cacheChoose(); if(d){zoomTip('Miniatury w: '+d);cacheInfo();}};
$('#cacheShow').onclick=()=>api.cacheReveal();
$('#cacheClear').onclick=async()=>{
  if(!confirm('Usunąć zapamiętane miniatury? Policzą się od nowa przy następnym otwarciu folderów.')) return;
  await api.cacheClear();
  for(const it of items){it.thumb=null;it.state=null;it._tp=null;}
  for(const d of dirs) resetDir(d);
  render(); prefetch(); cacheInfo();
};

/* --- pliki: odczyt przez protokół pgf:// (z zakresami, więc PSD czytamy kawałkami) --- */
const ref=f=>({name:f.name,size:f.size,url:api.fileUrl(f.path)});
function asFile(r){
  const rd=x=>{if(!x.ok)throw new Error('nie można odczytać pliku');return x.arrayBuffer();};
  const get=(a,b)=>{b=Math.min(b,r.size); if(a>=b) return Promise.resolve(new ArrayBuffer(0));
    return fetch(r.url,{headers:{Range:'bytes='+a+'-'+(b-1)}}).then(rd);};
  return {name:r.name,size:r.size,slice:(a,b)=>({arrayBuffer:()=>get(a,b===undefined?r.size:b)}),arrayBuffer:()=>fetch(r.url).then(rd)};
}
const blobOf=it=>fetch(api.fileUrl(it.path)).then(x=>{if(!x.ok)throw new Error('nie można odczytać pliku');return x.blob();});

/* --- ulubione --- */
const samePath=(a,b)=>a&&b&&(isMac?a===b:a.toLowerCase()===b.toLowerCase());
const findFav=p=>S.favs.find(f=>samePath(f.path,p));
function toggleFav(p){
  p=p||curPath; if(!p) return;
  const f=findFav(p);
  if(f) S.favs=S.favs.filter(x=>x!==f); else S.favs.push({name:api.basename(p)||p,path:p});
  save(); renderSide();
}
async function openFav(f){
  if(!(await api.exists(f.path))){status('Folderu „'+f.name+'” nie ma pod zapisaną ścieżką — mógł zostać przeniesiony.');return;}
  go(f.path);
}

/* --- foldery i pliki --- */
let curPath=null, dirs=[], items=[], view=[], sel=-1, anchor=-1, picked=new Set(), scanTok=0, gen=0;
const keep=()=>{const it=view[sel];return it?it.path:null;};

async function pickFolder(){ const p=await api.pickFolder(); if(p) go(p); }
function go(p,selectPath){ curPath=p; S.last=p; save(); $('#q').value='';$('#qClear').hidden=true; scan(false,selectPath); }
async function scan(keepScroll,selectPath){
  if(!curPath) return;
  const tok=++scanTok, prevPath=selectPath||keep(), prevTop=main.scrollTop, here=curPath;
  status('Wczytywanie…');
  const r=await api.list(here,EXTS);
  if(tok!==scanTok) return;
  if(r.error){status('Błąd: '+r.error);}
  // zachowaj już policzone miniatury tych samych plików
  const old=new Map(items.map(it=>[it.path+'|'+it.size+'|'+it.mtime,it]));
  const oldDirs=new Map(dirs.map(d=>[d.path,d]));
  gen++;
  items=r.files.map(f=>{
    const o=old.get(f.path+'|'+f.size+'|'+f.mtime);
    if(o&&o.state==='done'){o.gen=gen;o.tile=null;return o;}
    return {kind:'file',name:f.name,path:f.path,size:f.size,mtime:f.mtime,type:EXT[extOf(f.name)],gen,state:null};
  });
  dirs=r.dirs.map(d=>oldDirs.get(d.path)&&keepScroll?Object.assign(oldDirs.get(d.path),{tile:null}):{kind:'dir',name:d.name,path:d.path,files:null,count:null,state:null})
    .sort((a,b)=>coll.compare(a.name,b.name));
  renderTypes();
  applyView(prevPath);
  renderSide(); renderCrumbs(); syncTree();
  main.scrollTop=keepScroll?prevTop:0;
  if(sel>=0&&view[sel].tile&&!keepScroll) view[sel].tile.scrollIntoView({block:'center'});
  api.watch(here);
  prefetch();
}
api.onDirChanged(d=>{ if(samePath(d,curPath)&&!viewer.classList.contains('open')) scan(true); });
function goUp(){
  if(!curPath) return; const p=api.dirname(curPath); if(!p||p===curPath) return;
  const from=curPath; curPath=p; S.last=p; save(); scan(false,from);
}

function crumbsOf(p){
  const out=[], pr=api.parse(p);
  let acc=pr.root; out.push({name:pr.root.replace(/[\\/]+$/,'')||(isMac?'Dysk':'/'),path:pr.root});
  for(const seg of p.slice(pr.root.length).split(/[\\/]+/).filter(Boolean)){ acc=acc.endsWith(SEP)?acc+seg:acc+SEP+seg; out.push({name:seg,path:acc}); }
  return out;
}
function renderCrumbs(){
  const c=$('#crumbs'); c.textContent='';
  if(!curPath){$('#up').disabled=$('#refresh').disabled=$('#fav').disabled=true;return;}
  const cs=crumbsOf(curPath);
  cs.forEach((x,i)=>{
    if(i){const s=document.createElement('i');s.textContent='›';c.appendChild(s);}
    const el=document.createElement(i===cs.length-1?'span':'a');
    el.textContent=x.name; el.title=x.path; if(i<cs.length-1) el.onclick=()=>go(x.path);
    c.appendChild(el);
  });
  $('#up').disabled=cs.length<2;
  $('#refresh').disabled=$('#fav').disabled=false;
  document.title=cs[cs.length-1].name+' — Podgląd';
}

/* --- drzewo folderów: miejsca w systemie i dyski, jak zakładka Folders w Bridge --- */
let roots=[], treeCur=null;
async function loadRoots(){ roots=(await api.roots()).map(r=>({path:r.path,name:r.name,drive:r.drive,kids:null,open:false,up:null})); renderTree(); }
async function kidsOf(n){
  if(n.kids) return n.kids;
  const r=await api.list(n.path,['__brak__']);
  n.kids=r.dirs.sort((a,b)=>coll.compare(a.name,b.name)).map(d=>({path:d.path,name:d.name,kids:null,open:false,up:n}));
  return n.kids;
}
const under=(p,root)=>samePath(p,root)||(isMac?p:p.toLowerCase()).startsWith((isMac?root:root.toLowerCase()).replace(/[\\/]?$/,SEP));
async function syncTree(){
  treeCur=null;
  if(curPath){
    let best=null; for(const r of roots) if(under(curPath,r.path)&&(!best||r.path.length>best.path.length)) best=r;
    if(best){
      let n=best; n.open=true;
      const rest=curPath.slice(best.path.replace(/[\\/]$/,'').length).split(/[\\/]+/).filter(Boolean);
      for(const seg of rest){const ks=await kidsOf(n);const m=ks.find(k=>samePath(k.name,seg));if(!m){n=null;break;}m.open=true;n=m;}
      treeCur=n; if(n) await kidsOf(n);
    }
  }
  renderTree();
  const el=$('#tree li.on'); if(el) el.scrollIntoView({block:'nearest'});
}
function renderTree(){
  const ul=$('#tree'); ul.textContent='';
  const add=(n,d)=>{
    const li=document.createElement('li'); li.style.paddingLeft=(8+d*12)+'px'; li.title=n.path;
    const tw=document.createElement('span'); tw.className='tw';
    tw.textContent=n.kids&&!n.kids.length?'':(n.open?'▾':'▸');
    const nm=document.createElement('span'); nm.textContent=n.name;
    li.append(tw,nm); if(n===treeCur) li.classList.add('on');
    if(n.drive&&d===0) li.classList.add('drive');
    tw.onclick=async e=>{e.stopPropagation();n.open=!n.open;if(n.open)await kidsOf(n);renderTree();};
    li.onclick=()=>go(n.path);
    ul.appendChild(li);
    if(n.open&&n.kids) for(const k of n.kids) add(k,d+1);
  };
  for(const r of roots) add(r,0);
}
function renderSide(){
  const fl=$('#favs'); fl.textContent='';
  for(const f of S.favs){
    const li=document.createElement('li');
    li.innerHTML='<span></span><button class="x" title="Usuń z ulubionych">×</button>';
    li.firstChild.textContent=f.name; li.title=f.path;
    li.onclick=()=>openFav(f);
    li.lastChild.onclick=e=>{e.stopPropagation();S.favs=S.favs.filter(x=>x!==f);save();renderSide();};
    if(samePath(f.path,curPath)) li.classList.add('on');
    fl.appendChild(li);
  }
  if(!S.favs.length) fl.innerHTML='<li class="none"><span>Otwórz folder i kliknij ☆</span></li>';
  const fv=!!findFav(curPath), fb=$('#fav'); fb.textContent=fv?'★':'☆'; fb.classList.toggle('on',fv);
  fb.title=fv?'Usuń ten folder z ulubionych':'Dodaj ten folder do ulubionych';
}

/* --- widok --- */
function applyView(keepPath){
  const q=norm($('#q').value.trim());
  const ds=dirs.filter(d=>!q||norm(d.name).includes(q));
  const fs=items.filter(it=>on(it.type)&&(!q||norm(it.name).includes(q)));
  const d=S.dir, byName=(a,b)=>coll.compare(a.name,b.name);
  const by={
    name:(a,b)=>byName(a,b)*d,
    date:(a,b)=>(a.mtime-b.mtime)*d||byName(a,b),
    size:(a,b)=>(a.size-b.size)*d||byName(a,b),
    type:(a,b)=>a.type.localeCompare(b.type)*d||byName(a,b),
    dims:(a,b)=>((a.dims?a.dims[0]*a.dims[1]:0)-(b.dims?b.dims[0]*b.dims[1]:0))*d||byName(a,b)
  }[S.sort];
  fs.sort(by);
  if(S.sort==='name'&&d<0) ds.reverse();
  view=[...ds,...fs];
  sel=keepPath?view.findIndex(it=>samePath(it.path,keepPath)):-1; anchor=sel;
  picked=new Set(sel>=0?[view[sel]]:[]);
  render();
}
const io=new IntersectionObserver(es=>{for(const e of es){const it=e.target._it;if(!it)continue;it.visible=e.isIntersecting;
  if(!it.visible)continue; if(it.kind==='dir')loadDir(it,true); else enqueue(it,true);}},{root:main,rootMargin:'600px'});

function render(){
  io.disconnect(); grid.textContent=''; grid.className=S.mode==='list'?'list':'icons';
  if(S.mode==='list') renderList(); else renderIcons();
  $('#empty').style.display=curPath?'none':'';
  if(curPath&&!view.length){const p=document.createElement('p');p.className='ph';p.style.cssText='font-size:13px;margin:4px;text-transform:none;letter-spacing:0';
    p.textContent=$('#q').value?'Nic nie pasuje do „'+$('#q').value+'”.':'W tym folderze nie ma obrazów.';grid.appendChild(p);}
  status();
}
function renderIcons(){
  const frag=document.createDocumentFragment();
  view.forEach((it,i)=>{
    const t=document.createElement('div'); t.className='tile'+(it.kind==='dir'?' dir':'')+(picked.has(it)?' sel':''); t.dataset.i=i; t._it=it;
    if(it.kind==='file') t.draggable=true;
    t.innerHTML='<div class="box"></div><div><span class="nm"></span><div class="sub"></div></div>';
    t.querySelector('.nm').textContent=it.kind==='dir'?it.name+'/':it.name;
    t.querySelector('.sub').textContent=it.kind==='dir'?dirSub(it):'';
    t.title=it.name; it.tile=t; paint(it); frag.appendChild(t); io.observe(t);
  });
  grid.appendChild(frag);
}
const COLS=[['name','Nazwa',''],['type','Rodzaj',''],['dims','Wymiary','num'],['size','Rozmiar','num'],['date','Data','']];
function renderList(){
  const tb=document.createElement('table'); tb.className='list';
  tb.innerHTML='<thead><tr>'+COLS.map(([k,l,c])=>'<th class="'+c+(S.sort===k?' on':'')+'"><button data-sort="'+k+'">'+l+(S.sort===k?(S.dir>0?' ↑':' ↓'):'')+'</button></th>').join('')+'</tr></thead><tbody></tbody>';
  tb.querySelectorAll('th button').forEach(b=>b.onclick=()=>setSort(b.dataset.sort));
  const body=tb.lastChild, frag=document.createDocumentFragment();
  view.forEach((it,i)=>{
    const r=document.createElement('tr'); r.dataset.i=i; r._it=it; if(picked.has(it)) r.className='sel';
    if(it.kind==='file') r.draggable=true;
    r.innerHTML='<td><div class="cell"><span class="ic"></span><span class="nm"></span></div></td><td class="m"></td><td class="num m"></td><td class="num m"></td><td class="m"></td>';
    r.querySelector('.nm').textContent=it.kind==='dir'?it.name+'/':it.name;
    r.title=it.name; it.tile=r; paint(it); frag.appendChild(r); io.observe(r);
  });
  body.appendChild(frag); grid.appendChild(tb);
}
const dirSub=d=>d.count==null?'folder':d.count?d.count+' '+plural(d.count,'obraz','obrazy','obrazów'):'brak obrazów';

function paint(it){
  const el=it.tile; if(!el) return;
  if(el.tagName==='TR'){
    const c=el.cells, ic=el.querySelector('.ic'); ic.textContent='';
    const src=it.kind==='dir'?(it.files&&it.files[0]&&it.files[0].thumb):it.thumb;
    if(src){const s=document.createElement('canvas');const k=Math.min(1,160/Math.max(src.width,src.height));s.width=Math.max(1,src.width*k);s.height=Math.max(1,src.height*k);s.getContext('2d').drawImage(src,0,0,s.width,s.height);ic.appendChild(s);}
    if(it.kind==='dir'){c[1].textContent='folder';c[2].textContent='';c[3].textContent=it.count!=null?it.count+' '+plural(it.count,'obraz','obrazy','obrazów'):'';c[4].textContent='';}
    else{c[1].textContent=(it.meta?it.meta.format:(it.type==='raw'?extOf(it.name):it.type).toUpperCase());c[2].textContent=it.dims?it.dims[0]+' × '+it.dims[1]:(it.state==='error'?'—':'');
      c[3].textContent=fmtSize(it.size);c[4].textContent=fmtDate(it.mtime);}
    return;
  }
  const box=el.firstChild;
  if(it.kind==='dir'){ el.querySelector('.sub').textContent=dirSub(it); return paintDir(it); }
  box.textContent='';
  if(it.thumb){box.appendChild(it.thumb);return;}
  const s=document.createElement('span'); s.className='ph';
  s.textContent=(it.state==='error'?extOf(it.name)+' · brak podglądu':extOf(it.name));
  if(it.err) el.title=it.name+'\n'+it.err;
  box.appendChild(s);
}

/* --- foldery w siatce: okładka i przeglądanie zawartości ruchem myszy --- */
function resetDir(d){d.files=null;d.count=null;d.state=null;d._p=null;d.si=0;}
function loadDir(d,hi){
  if(d._p){ if(hi&&d.files&&d.files[0]) enqueue(d.files[0],true); return d._p; }
  d.state='loading';
  return d._p=(async()=>{
    const r=await api.list(d.path,EXTS);
    const all=r.files.map(f=>({kind:'file',name:f.name,path:f.path,size:f.size,mtime:f.mtime,type:EXT[extOf(f.name)],state:null,gen})).filter(f=>on(f.type));
    all.sort((a,b)=>coll.compare(a.name,b.name));
    d.count=all.length;
    d.files=all.length<=SKIM?all:Array.from({length:SKIM},(_,k)=>all[Math.floor(k*all.length/SKIM)]);
    d.si=0; d.state='done';
    if(d.files[0]){ d.files[0].cb=()=>paint(d); enqueue(d.files[0],hi||d.visible); }
    paint(d);
  })();
}
function paintDir(d){
  if(!d.tile||d.tile.tagName==='TR'){ if(d.tile) paint(d); return; }
  const box=d.tile.firstChild; box.textContent='';
  const f=d.files&&d.files[d.si||0];
  if(f&&f.thumb) box.appendChild(f.thumb);
  else{const s=document.createElement('span');s.className='ph';s.textContent=d.state==='done'&&!d.count?'∅':'';box.appendChild(s);}
  if(d.files&&d.files.length>1){
    const sk=document.createElement('div');sk.className='sk';
    for(let k=0;k<d.files.length;k++){const i=document.createElement('i');if(k===(d.si||0))i.className='on';sk.appendChild(i);}
    const cn=document.createElement('span');cn.className='cnt';cn.textContent=((d.si||0)+1)+'/'+d.files.length;
    box.append(sk,cn);
  }
}
grid.addEventListener('pointermove',e=>{
  const box=e.target.closest('.tile.dir .box'); if(!box) return;
  const d=box.parentNode._it; if(!d||!d.files||d.files.length<2) return;
  const r=box.getBoundingClientRect(), x=Math.min(.999,Math.max(0,(e.clientX-r.left)/r.width));
  const i=Math.floor(x*d.files.length); if(i===d.si) return;
  d.si=i; const f=d.files[i];
  if(f.thumb) paintDir(d); else { f.cb=()=>{if(d.si===i)paintDir(d);}; enqueue(f,true,true); }
});
grid.addEventListener('pointerout',e=>{
  const box=e.target.closest('.tile.dir .box'); if(!box||box.contains(e.relatedTarget)) return;
  const d=box.parentNode._it; if(d&&d.si){d.si=0;paintDir(d);}
});

/* --- zaznaczanie: klik, ⌘/Ctrl+klik, Shift+klik, ⌘/Ctrl+A --- */
function markSel(){for(const it of view) if(it.tile) it.tile.classList.toggle('sel',picked.has(it));}
function select(i,how){
  if(!view.length) return;
  i=Math.max(0,Math.min(view.length-1,i)); const it=view[i];
  if(how==='toggle'){picked.has(it)?picked.delete(it):picked.add(it);anchor=i;}
  else if(how==='range'&&anchor>=0){picked=new Set(view.slice(Math.min(anchor,i),Math.max(anchor,i)+1));}
  else{picked=new Set([it]);anchor=i;}
  sel=i; markSel(); if(it.tile) it.tile.scrollIntoView({block:'nearest'}); status();
}
function selectAll(){picked=new Set(view.filter(x=>x.kind==='file'));markSel();status();}
const pickedFiles=it=>{const m=[...picked].filter(x=>x.kind==='file');return it&&!picked.has(it)?[it]:m;};
function open(i){const it=view[i];if(!it)return;if(it.kind==='dir')go(it.path);else openViewer(it);}
grid.addEventListener('click',e=>{
  const t=e.target.closest('[data-i]'); if(!t||e.target.closest('th'))return;
  const i=+t.dataset.i;
  if(e.metaKey||e.ctrlKey) select(i,'toggle');
  else if(e.shiftKey) select(i,'range');
  else if(i===sel&&picked.size===1) open(i);
  else select(i);
});
grid.addEventListener('dblclick',e=>{const t=e.target.closest('[data-i]');if(t&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey)open(+t.dataset.i);});
main.addEventListener('click',e=>{if(e.target===main||e.target===grid){picked=new Set();sel=-1;markSel();status();}});
function cols(){if(S.mode==='list')return 1;const n=getComputedStyle(grid).gridTemplateColumns.split(' ').length;return n||1;}

/* przeciąganie plików z Podglądu do Photoshopa, 3ds Maxa, Findera… */
let draggingOut=false;
grid.addEventListener('dragstart',e=>{
  const t=e.target.closest('[data-i]'); if(!t) return;
  const it=view[+t.dataset.i]; if(!it||it.kind!=='file') return;
  e.preventDefault();
  if(!picked.has(it)) select(+t.dataset.i);
  draggingOut=true; api.dragOut(pickedFiles(it).map(x=>x.path));
});
addEventListener('pointermove',()=>{draggingOut=false;});

/* --- kolejka miniatur: najpierw widoczne, potem w tle cały folder i okładki podfolderów --- */
const hiQ=[], loQ=[]; let running=0;
const MAXRUN=Math.min(6,Math.max(2,(navigator.hardwareConcurrency||4)-1));
function enqueue(it,hi,front){
  if(it.state==='done'||it.state==='loading'||it.state==='error'){ if(it.state==='done'&&it.cb){const c=it.cb;it.cb=null;c();} return; }
  if(it.state==='queued'){ if(hi&&!it.hi){it.hi=true;front?hiQ.unshift(it):hiQ.push(it);pump();} return; }
  it.state='queued'; it.hi=!!hi; (hi?(front?a=>hiQ.unshift(a):a=>hiQ.push(a)):a=>loQ.push(a))(it); pump();
}
function take(){
  while(hiQ.length){const x=hiQ.shift(); if(x.state==='queued'&&x.gen===gen) return x;}
  while(loQ.length){const x=loQ.shift(); if(x.state==='queued'&&x.gen===gen) return x;}
  return null;
}
function pump(){
  while(running<MAXRUN){
    const it=take(); if(!it) break;
    running++; it.state='loading';
    thumbOf(it).then(()=>{it.state='done';},e=>{it.state='error';it.err=e&&e.message||String(e);})
      .finally(()=>{running--;
        if(it.tile&&it.tile.isConnected) paint(it);
        if(it.cb){const c=it.cb;it.cb=null;c();}
        if(view[sel]===it) status();
        progress(); pump();});
  }
  progress();
}
async function prefetch(){
  const g=gen;
  for(const it of view) if(it.kind==='file') enqueue(it,false);
  for(const d of dirs){ if(g!==gen) return; await loadDir(d,false); }
}
let progT=0;
function progress(){
  if(progT) return;
  progT=requestAnimationFrame(()=>{progT=0;
    const total=items.length, done=items.filter(x=>x.state==='done'||x.state==='error').length;
    $('#prog').textContent=total&&done<total?'Miniatury: '+done+' / '+total:'';
  });
}
function thumbOf(it){ return it._tp||(it._tp=buildThumb(it)); }
async function buildThumb(it){
  const key={path:it.path,size:it.size,mtime:it.mtime};
  const hit=await api.thumbGet(key);
  if(hit){
    try{
      const b=await fetch(hit.url).then(x=>{if(!x.ok)throw 0;return x.blob();});
      const bmp=await createImageBitmap(b);
      const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);bmp.close();
      it.thumb=c; it.dims=hit.dims||it.dims; it.meta=hit.meta||it.meta; return;
    }catch(e){ api.thumbForget(hit.hash); }
  }
  let bmp;
  if(it.type==='svg'){const im=await loadImg(api.fileUrl(it.path));const w=im.naturalWidth||1024,h=im.naturalHeight||1024;
    const k=Math.min(4,TH*2/Math.max(w,h));const c=new OffscreenCanvas(Math.round(w*k),Math.round(h*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);
    bmp=c.transferToImageBitmap();it.dims=[w,h];}
  else if(NATIVE.has(it.type)){bmp=await createImageBitmap(await blobOf(it));it.dims=[bmp.width,bmp.height];}
  else{
    if(it.type==='psd'&&!it.thumb){ // od razu mała miniatura zapisana w PSD, potem ostra
      try{const q=await decode(ref(it),'psdthumb',0); const b=await toBitmap(q); const c=document.createElement('canvas');c.width=b.width;c.height=b.height;c.getContext('2d').drawImage(b,0,0);b.close();
        it.thumb=c; it.dims=[q.meta.width,q.meta.height]; it.meta=q.meta; if(it.tile&&it.tile.isConnected) paint(it);}catch(e){}
    }
    const r=await decode(ref(it),it.type,TH*2);it.meta=r.meta;it.dims=[r.meta.width,r.meta.height];bmp=await toBitmap(r);}
  const s=Math.min(1,TH/Math.max(bmp.width,bmp.height));
  const w=Math.max(1,Math.round(bmp.width*s)),h=Math.max(1,Math.round(bmp.height*s));
  const small=s<1?await createImageBitmap(bmp,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'}):bmp;
  let c;
  if(OPAQUE.has(it.type)){c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(small,0,0);}
  else c=paintOn(small,w,h,Math.max(4,Math.round(Math.max(w,h)/48)));
  if(small!==bmp)small.close(); bmp.close();
  it.thumb=c;
  c.toBlob(b=>{ if(b) b.arrayBuffer().then(buf=>api.thumbPut(key,buf,it.dims,it.meta||null)).then(()=>newThumbs++); },'image/webp',0.82);
}
async function loadImg(url){const im=new Image();im.crossOrigin='anonymous';im.src=url;await im.decode();return im;}
// szachownica pod przezroczystymi pikselami
let chkTile=null;
function paintOn(bmp,w,h,cell){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(!chkTile){chkTile=document.createElement('canvas');chkTile.width=chkTile.height=2;const t=chkTile.getContext('2d');t.fillStyle='#fff';t.fillRect(0,0,2,2);t.fillStyle='#d4d4d4';t.fillRect(1,0,1,1);t.fillRect(0,1,1,1);}
  const p=g.createPattern(chkTile,'repeat');p.setTransform(new DOMMatrix().scale(cell));g.imageSmoothingEnabled=false;
  g.fillStyle=p;g.fillRect(0,0,w,h);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(bmp,0,0,w,h);return c;
}
function toBitmap(r){
  return r.jpeg?createImageBitmap(new Blob([r.jpeg],{type:'image/jpeg'})):createImageBitmap(new ImageData(r.data,r.width,r.height));
}

/* --- wątki robocze do PSD, TIFF, EXR, HDR, TGA, RAW --- */
const pool=[], jobs=new Map(); let jobId=0, lib=null;
const direct=(r,t,m)=>(lib=lib||decoderLib()).decode(asFile(r),t,m);
try{
  const src='const asFile='+asFile.toString()+';const lib=('+decoderLib.toString()+')();self.onmessage=async e=>{const{id,file,type,max}=e.data;try{const r=await lib.decode(asFile(file),type,max);self.postMessage({id,r},r.data?[r.data.buffer]:[])}catch(err){self.postMessage({id,error:String(err&&err.message||err)})}}';
  const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));
  for(let i=0;i<MAXRUN;i++){
    const w=new Worker(url); w.busy=0;
    w.onmessage=e=>{const j=jobs.get(e.data.id);if(!j)return;jobs.delete(e.data.id);w.busy--;e.data.error?j.rej(new Error(e.data.error)):j.res(e.data.r);};
    w.onerror=ev=>{ev.preventDefault();const k=pool.indexOf(w);if(k>=0)pool.splice(k,1);
      for(const [id,j] of jobs) if(j.w===w){jobs.delete(id);direct(j.f,j.t,j.m).then(j.res,j.rej);}};
    pool.push(w);
  }
}catch(e){}
function decode(f,t,m){
  if(!pool.length) return direct(f,t,m);
  const w=pool.reduce((a,b)=>a.busy<=b.busy?a:b); w.busy++;
  return new Promise((res,rej)=>{const id=++jobId;jobs.set(id,{res,rej,w,f,t,m});w.postMessage({id,file:f,type:t,max:m});});
}

/* --- informacje --- */
const fmtDate=t=>new Date(t).toLocaleString('pl',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function info(it){
  const a=[];
  if(it.dims) a.push(it.dims[0]+' × '+it.dims[1]+' px');
  a.push(fmtSize(it.size), fmtDate(it.mtime));
  let f=it.meta?it.meta.format:(it.type==='raw'?extOf(it.name):it.type).toUpperCase();
  if(it.meta&&it.meta.mode) f+=' '+it.meta.mode; if(it.meta&&it.meta.depth) f+=' '+it.meta.depth+'-bit';
  a.push(f);
  return a.join('  ·  ');
}
function status(msg){
  const s=$('#status');
  if(msg){s.textContent=msg;return;}
  const it=view[sel];
  if(picked.size>1){const n=picked.size,b=[...picked].reduce((a,x)=>a+(x.size||0),0);
    s.textContent='Zaznaczone: '+n+'  ·  '+fmtSize(b);}
  else if(it&&it.kind==='dir'){s.innerHTML='<b></b>  ·  ';s.firstChild.textContent=it.name+'/';s.appendChild(document.createTextNode(dirSub(it)));}
  else if(it){s.innerHTML='<b></b>  ·  ';s.firstChild.textContent=it.name;s.appendChild(document.createTextNode(info(it)));}
  else if(curPath){
    const nf=view.filter(x=>x.kind==='file').length, nd=view.length-nf, q=$('#q').value;
    s.textContent=(q?'Wyniki: ':'')+nf+' '+plural(nf,'obraz','obrazy','obrazów')+(nd?'  ·  '+nd+' '+plural(nd,'folder','foldery','folderów'):'');}
  else s.textContent='';
}

/* --- podgląd powiększony: natychmiast miniatura, potem pełny obraz; sąsiedzi wczytywani z wyprzedzeniem --- */
const viewer=$('#viewer'), stage=$('#stage');
let vTok=0, vEl=null, actual=false, vList=[], vi=0, lastStep=0;
const vCache=new Map(); // pełne obrazy ostatnio oglądane i wczytane z wyprzedzeniem
const VC_PX=180e6;      // limit pamięci podglądów (w pikselach)
const bigCell=(w,h)=>Math.max(8,Math.round(Math.max(w,h)/80));
const vpx=v=>(v.el.naturalWidth||v.el.width)*(v.el.naturalHeight||v.el.height);
const vLoading=new Map();
function fullOf(it){
  if(vCache.has(it)){const v=vCache.get(it);vCache.delete(it);vCache.set(it,v);return Promise.resolve(v);}
  if(vLoading.has(it)) return vLoading.get(it);
  const p=(async()=>{
    let v;
    if(NATIVE.has(it.type)&&it.type!=='jpg'&&it.type!=='gif'&&it.type!=='svg'){
      const bmp=await createImageBitmap(await blobOf(it)); it.dims=[bmp.width,bmp.height];
      v={el:paintOn(bmp,bmp.width,bmp.height,bigCell(bmp.width,bmp.height)),note:''}; bmp.close();
    }else if(NATIVE.has(it.type)){
      const el=await loadImg(api.fileUrl(it.path));
      if(el.naturalWidth) it.dims=[el.naturalWidth,el.naturalHeight];
      if(it.type==='svg'&&!el.naturalWidth){el.style.width='80%';}
      v={el,note:''};
    }else{
      const r=await decode(ref(it),it.type,0);
      it.meta=r.meta; it.dims=[r.meta.width,r.meta.height];
      const bmp=await toBitmap(r); let el;
      if(OPAQUE.has(it.type)||r.jpeg){el=document.createElement('canvas');el.width=bmp.width;el.height=bmp.height;el.getContext('2d').drawImage(bmp,0,0);}
      else el=paintOn(bmp,bmp.width,bmp.height,bigCell(bmp.width,bmp.height));
      bmp.close(); v={el,note:r.note||''};
    }
    vCache.set(it,v);
    let tot=0; for(const x of vCache.values()) tot+=vpx(x);
    for(const k of vCache.keys()){ if(tot<=VC_PX||vCache.size<=2) break; if(vList[vi]===k) continue; tot-=vpx(vCache.get(k)); vCache.delete(k); }
    return v;
  })().finally(()=>vLoading.delete(it));
  vLoading.set(it,p); return p;
}
function openViewer(it){
  const files=view.filter(x=>x.kind==='file');
  vList=picked.size>1&&picked.has(it)?files.filter(x=>picked.has(x)):files;
  vi=Math.max(0,vList.indexOf(it)); viewer.classList.add('open'); showV();
}
function mount(el,low,it){
  stage.textContent=''; stage.appendChild(el); vEl=low?null:el;
  el.classList.toggle('low',!!low);
  el.style.width=el.style.height='';
  if(low){ // miniatura powiększona do docelowego rozmiaru, żeby nic nie skakało
    const r=stage.getBoundingClientRect(), aw=r.width-128, ah=r.height-38;
    const [dw,dh]=it.dims||[el.width,el.height];
    const s=Math.min(aw/dw,ah/dh,1); el.style.width=Math.round(dw*s)+'px'; el.style.height=Math.round(dh*s)+'px';
  } else {
    el.onclick=ev=>{ev.stopPropagation();actual=!actual;applyZoom(true);};
    el.draggable=true; el.ondragstart=ev=>{ev.preventDefault();api.dragOut([it.path]);};
    applyZoom();
  }
}
async function showV(){
  const it=vList[vi]; if(!it) return; const tok=++vTok;
  const now=performance.now(), fast=now-lastStep<180; lastStep=now;
  const i=view.indexOf(it); if(i>=0&&picked.size<=1) select(i); else if(i>=0){sel=i;}
  $('#vname').textContent=it.name; $('#vname').title=it.path; $('#vinfo').textContent=info(it); $('#vcount').textContent=(vi+1)+' / '+vList.length;
  stage.className=actual?'actual':'fit';
  if(vCache.has(it)){ const v=await fullOf(it); if(tok!==vTok) return; mount(v.el,false,it); afterShow(it,v,tok); return; }
  // od razu: miniatura z pamięci
  if(it.thumb){ const c=document.createElement('canvas'); c.width=it.thumb.width; c.height=it.thumb.height; c.getContext('2d').drawImage(it.thumb,0,0); mount(c,true,it); }
  else { stage.innerHTML='<div class="msg">Wczytywanie…</div>'; vEl=null; enqueue(it,true,true); }
  // przy szybkim przewijaniu czekamy chwilę, zanim zaczniemy dekodować pełny plik
  if(fast){ await new Promise(r=>setTimeout(r,140)); if(tok!==vTok) return; }
  let v;
  try{v=await fullOf(it);}catch(e){if(tok===vTok&&!it.thumb){stage.innerHTML='<div class="msg"></div>';stage.firstChild.textContent='Nie udało się otworzyć: '+(e.message||e);}return;}
  if(tok!==vTok) return;
  mount(v.el,false,it); afterShow(it,v,tok);
}
function afterShow(it,v,tok){
  $('#vinfo').textContent=info(it)+(v.note?'  ·  '+v.note:''); status();
  // wczytaj z wyprzedzeniem: następny, poprzedni, jeszcze jeden dalej
  setTimeout(async()=>{
    const n=vList.length;
    for(const d of [1,-1,2,3]){
      if(tok!==vTok||n<2) return;
      const nx=vList[((vi+d)%n+n)%n]; if(nx===it) continue;
      if(!nx.thumb) enqueue(nx,true);
      try{await fullOf(nx);}catch(e){}
    }
  },60);
}
function stepV(d){if(!vList.length)return;vi=(vi+d+vList.length)%vList.length;showV();}
function applyZoom(tip){
  stage.className=actual?'actual':'fit';
  if(vEl){const w=(vEl.naturalWidth||vEl.width)/devicePixelRatio;vEl.style.width=actual?w+'px':'';vEl.style.height='';}
  if(tip) zoomTip(actual?'100%':'Dopasuj');
}
function closeViewer(){viewer.classList.remove('open');vTok++;stage.textContent='';vEl=null;main.focus();}
stage.addEventListener('click',e=>{if(e.target===stage)closeViewer();});
// kółko myszy i gładzik przewijają obrazy (w trybie 100% przewijają sam obraz)
let wAcc=0, wT=0;
stage.addEventListener('wheel',e=>{
  if(actual||e.ctrlKey||e.metaKey) return;
  e.preventDefault();
  const d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
  wAcc+=e.deltaMode===1?d*30:d; clearTimeout(wT); wT=setTimeout(()=>wAcc=0,200);
  while(Math.abs(wAcc)>=70){ const s=Math.sign(wAcc); wAcc-=s*70; stepV(s); }
},{passive:false});
$('#vprev').onclick=()=>stepV(-1); $('#vnext').onclick=()=>stepV(1); $('#vclose').onclick=closeViewer;
async function copyImage(it){
  try{
    const v=await fullOf(it); let c=v.el;
    if(c.tagName==='IMG'){const k=document.createElement('canvas');k.width=c.naturalWidth;k.height=c.naturalHeight;k.getContext('2d').drawImage(c,0,0);c=k;}
    const b=await new Promise(r=>c.toBlob(r,'image/png'));
    await navigator.clipboard.write([new ClipboardItem({'image/png':b})]);
    zoomTip('Skopiowano obraz');
  }catch(e){zoomTip('Nie udało się skopiować');}
}
function viewerMenu(){
  const it=vList[vi]; if(!it) return; const r=$('#vmore').getBoundingClientRect();
  showMenu(r.right-230,r.bottom+6,null,[
    {label:'Pokaż w '+FINDER,key:'R',run:()=>api.showInFolder(it.path)},
    {label:'Otwórz w '+(editorName||'Photoshopie'),key:'E',run:()=>openInEditor([it.path])},
    {label:actual?'Dopasuj do okna':'Rozmiar oryginalny',key:'Z',run:()=>{actual=!actual;applyZoom(true);}},
    {label:'Kopiuj obraz',key:'C',run:()=>copyImage(it)},
    {label:'Kopiuj ścieżkę',key:'P',run:()=>copyText(it.path)},
    '-',{label:'Ukryj interfejs',key:'Tab',run:toggleBare}]);
}
$('#vmore').onclick=e=>{e.stopPropagation();ctx.hidden?viewerMenu():hideMenu();};
function toggleBare(){document.body.classList.toggle('bare');zoomTip(document.body.classList.contains('bare')?'Tab — pokaż interfejs':'Interfejs widoczny');}

/* --- programy zewnętrzne --- */
let editorName=null;
api.editorName().then(n=>{editorName=n;});
async function openInEditor(paths,choose){
  const n=await api.openEditor(paths,choose);
  if(n){editorName=n;zoomTip('Otwieram w: '+n);}
}

/* --- menu pod prawym przyciskiem --- */
const ctx=$('#ctx');
function hideMenu(){ctx.hidden=true;}
function showMenu(x,y,title,entries){
  ctx.textContent='';
  if(title){const h=document.createElement('div');h.className='ch';h.textContent=title;ctx.appendChild(h);}
  for(const en of entries){
    if(en==='-'){ctx.appendChild(document.createElement('hr'));continue;}
    const b=document.createElement('button');b.textContent=en.label;
    if(en.key){const k=document.createElement('kbd');k.textContent=en.key;b.appendChild(k);}
    b.onclick=()=>{hideMenu();en.run();};ctx.appendChild(b);
  }
  ctx.hidden=false;
  const r=ctx.getBoundingClientRect();
  ctx.style.left=Math.max(4,Math.min(x,innerWidth-r.width-8))+'px'; ctx.style.top=Math.max(4,Math.min(y,innerHeight-r.height-8))+'px';
}
async function copyText(t){ await navigator.clipboard.writeText(t).catch(()=>{}); zoomTip('Skopiowano'); }
const MOD=isMac?'⌘':'Ctrl+';
document.addEventListener('contextmenu',e=>{
  if(viewer.classList.contains('open')||!e.target.closest('#main')) return;
  e.preventDefault();
  const t=e.target.closest('[data-i]');
  if(!t){
    if(!curPath) return;
    showMenu(e.clientX,e.clientY,api.basename(curPath)||curPath,[
      {label:'Odśwież',key:'R',run:()=>scan(true)},
      {label:'Pokaż folder w '+FINDER,run:()=>api.openDefault(curPath)},
      {label:'Zaznacz wszystkie obrazy',key:MOD+'A',run:selectAll},
      {label:S.mode==='list'?'Pokaż jako ikony':'Pokaż jako listę',key:'L',run:()=>setMode(S.mode==='list'?'icons':'list')},
      '-',{label:'Otwórz inny folder…',key:MOD+'O',run:pickFolder}]);
    return;
  }
  const i=+t.dataset.i, it=view[i];
  if(!picked.has(it)) select(i);
  if(it.kind==='dir'){
    const f=findFav(it.path);
    showMenu(e.clientX,e.clientY,it.name+'/',[
      {label:'Otwórz',key:'Enter',run:()=>go(it.path)},
      {label:f?'Usuń z ulubionych':'Dodaj do ulubionych',run:()=>toggleFav(it.path)},
      {label:'Pokaż w '+FINDER,run:()=>api.showInFolder(it.path)},
      '-',{label:'Kopiuj ścieżkę',run:()=>copyText(it.path)}]);
    return;
  }
  const many=pickedFiles(it), n=many.length, en=[];
  if(n>1) en.push({label:'Pokaż zaznaczone ('+n+')',key:'Enter',run:()=>openViewer(it)});
  else en.push({label:'Otwórz podgląd',key:'Enter',run:()=>openViewer(it)});
  en.push({label:'Otwórz w '+(editorName||'Photoshopie')+(n>1?' ('+n+')':''),key:MOD+'E',run:()=>openInEditor(many.map(x=>x.path))});
  if(n===1) en.push({label:'Otwórz w domyślnym programie',run:()=>api.openDefault(it.path)});
  en.push({label:'Pokaż w '+FINDER,run:()=>api.showInFolder(it.path)});
  en.push('-');
  en.push({label:n>1?'Kopiuj nazwy ('+n+')':'Kopiuj nazwę',run:()=>copyText(many.map(x=>x.name).join('\n'))});
  en.push({label:n>1?'Kopiuj ścieżki ('+n+')':'Kopiuj ścieżkę',run:()=>copyText(many.map(x=>x.path).join('\n'))});
  en.push('-',{label:'Zmień program do edycji…',run:()=>openInEditor(many.map(x=>x.path),true)});
  showMenu(e.clientX,e.clientY,n>1?'Zaznaczone: '+n:it.name,en);
});
document.addEventListener('pointerdown',e=>{if(!ctx.hidden&&!ctx.contains(e.target)&&e.target!==$('#typesBtn')&&e.target!==$('#vmore'))hideMenu();});
addEventListener('blur',hideMenu); main.addEventListener('scroll',hideMenu);

/* --- klawiatura --- */
document.addEventListener('keydown',e=>{
  const k=e.key;
  if(!ctx.hidden&&k==='Escape'){hideMenu();return;}
  if(e.target.matches('input[type=search]')){
    if(k==='Escape'){if(e.target.value){$('#qClear').click();}else e.target.blur();}
    else if(k==='Enter'||k==='ArrowDown'){e.target.blur();main.focus();if(view.length&&sel<0)select(0);}
    return;
  }
  const mod=e.metaKey||e.ctrlKey;
  const open_=viewer.classList.contains('open');
  if(mod&&k.toLowerCase()==='e'){e.preventDefault();const f=open_?[vList[vi]]:pickedFiles();if(f.length&&f[0])openInEditor(f.map(x=>x.path));return;}
  if(open_){
    if(k==='Escape'||k===' '){e.preventDefault();closeViewer();}
    else if(k==='ArrowRight'||k==='ArrowDown'){e.preventDefault();stepV(1);}
    else if(k==='ArrowLeft'||k==='ArrowUp'){e.preventDefault();stepV(-1);}
    else if(k==='z'||k==='1'){actual=!actual;applyZoom(true);}
    else if(k==='r'){api.showInFolder(vList[vi].path);}
    else if(k==='e'){openInEditor([vList[vi].path]);}
    else if(k==='c'&&!mod){copyImage(vList[vi]);}
    else if(k==='p'){copyText(vList[vi].path);}
    else if(k==='Tab'){e.preventDefault();toggleBare();}
    else if(k==='PageDown'){e.preventDefault();stepV(1);}
    else if(k==='PageUp'){e.preventDefault();stepV(-1);}
    else if(k==='Home'){e.preventDefault();vi=0;showV();}
    else if(k==='End'){e.preventDefault();vi=vList.length-1;showV();}
    return;
  }
  if(e.target.matches('input,select')) return;
  if(mod&&k.toLowerCase()==='a'){e.preventDefault();selectAll();return;}
  if(mod&&k==='ArrowUp'){e.preventDefault();goUp();return;}
  if(mod&&k==='ArrowDown'){e.preventDefault();if(sel>=0)open(sel);return;}
  if(mod&&k.toLowerCase()==='f'){e.preventDefault();$('#q').focus();return;}
  if(mod||e.altKey) return;
  const c=cols(), how=e.shiftKey?'range':undefined;
  const mv=d=>{e.preventDefault();select(sel<0?0:sel+d,how);};
  if(k==='ArrowRight')mv(1); else if(k==='ArrowLeft')mv(-1);
  else if(k==='ArrowDown')mv(c); else if(k==='ArrowUp')mv(-c);
  else if(k==='Home'){e.preventDefault();select(0,how);}
  else if(k==='End'){e.preventDefault();select(view.length-1,how);}
  else if(k===' '||k==='Enter'){e.preventDefault();if(sel>=0)open(sel);}
  else if(k==='Backspace'){e.preventDefault();goUp();}
  else if(k==='+'||k==='='){zstep(1);}
  else if(k==='-'){zstep(-1);}
  else if(k==='r'){scan(true);}
  else if(k==='t'){cycleTheme();}
  else if(k==='n'){setNames(!(S.names!==false));}
  else if(k==='l'){setMode(S.mode==='list'?'icons':'list');}
  else if(k==='/'){e.preventDefault();$('#q').focus();}
  else if(k==='Tab'){e.preventDefault();toggleBare();}
});
api.onMenu(a=>{ if(a==='open') pickFolder(); });

/* --- upuszczenie folderu lub pliku na okno --- */
let dragN=0;
const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
document.addEventListener('dragenter',e=>{if(!hasFiles(e)||draggingOut)return;dragN++;document.body.dataset.drop='1';});
document.addEventListener('dragleave',e=>{if(!hasFiles(e))return;if(--dragN<=0){dragN=0;delete document.body.dataset.drop;}});
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',async e=>{
  e.preventDefault(); dragN=0; delete document.body.dataset.drop;
  if(draggingOut){draggingOut=false;return;}
  const f=e.dataTransfer.files[0]; if(!f) return;
  const p=api.pathForFile(f); if(!p) return;
  if(await api.exists(p)) go(p); else go(api.dirname(p),p);
});

/* --- start --- */
$('#side-open').onclick=$('#empty-open').onclick=pickFolder;
$('#up').onclick=goUp; $('#refresh').onclick=()=>scan(true); $('#fav').onclick=()=>toggleFav();
markSort(); markModes(); setNames(S.names!==false);
renderSide(); renderCrumbs(); cacheInfo();
loadRoots().then(async()=>{ if(S.last&&await api.exists(S.last)) go(S.last); else { render(); syncTree(); } });
