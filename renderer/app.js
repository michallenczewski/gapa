/* ===== Podgląd — interfejs ===== */
const $=s=>document.querySelector(s);
const EXT={jpg:'jpg',jpeg:'jpg',jpe:'jpg',jfif:'jpg',png:'png',psd:'psd',psb:'psd',tif:'tif',tiff:'tif',tga:'tga',exr:'exr',hdr:'hdr',
  webp:'webp',avif:'avif',gif:'gif',bmp:'bmp',dib:'bmp',ico:'ico',svg:'svg',
  dng:'raw',cr2:'raw',cr3:'raw',nef:'raw',nrw:'raw',arw:'raw',sr2:'raw',srf:'raw',orf:'raw',rw2:'raw',raf:'raw',pef:'raw',srw:'raw',
  '3fr':'raw',iiq:'raw',erf:'raw',kdc:'raw',mrw:'raw',rwl:'raw',x3f:'raw',
  pdf:'pdf',dwg:'dwg',skp:'skp',max:'max','3dm':'3dm',pln:'pln',pla:'pln',tpl:'pln',
  mp4:'vid',m4v:'vid',mov:'vid',webm:'vid',mkv:'vid',avi:'vid',wmv:'vid',mpg:'vid',mpeg:'vid',ogv:'vid','3gp':'vid',mts:'vid',m2ts:'vid'};
const EXTS=Object.keys(EXT);
const TYPES=['jpg','png','psd','tif','tga','exr','hdr','raw','webp','avif','gif','bmp','ico','svg','pdf','dwg','skp','max','3dm','pln','vid'];
const DOCS=new Set(['pdf','dwg','skp','max','3dm','pln']);   // pliki projektowe: miniatura systemowa albo zapisana w pliku // kolejność filtrów
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
  chromeSync();
}
// przyciski okna (Windows) w kolorze tła; na Macu „światła” po lewej
if(!api.web) document.documentElement.classList.add(api.platform==='darwin'?'frame-mac':'frame-win');
function chromeSync(){
  if(api.web||!api.chromeColors) return;
  const cs=getComputedStyle(document.documentElement), v=document.getElementById('viewer');
  const bg=(v&&v.classList.contains('open')?cs.getPropertyValue('--stage'):cs.getPropertyValue('--bg')).trim();
  api.chromeColors(bg,cs.getPropertyValue('--text2').trim());
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
function setTheme(t){S.theme=t==='auto'?null:t;save();applyTheme();}
function cycleTheme(){S.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();}

/* rozmiar miniatur: suwak, + i −, Ctrl/⌘ + kółko lub gest szczypania na gładziku */
function setSize(v,tip){
  if(S.mode==='list'){S.lic=Math.round(Math.max(16,Math.min(96,v)));document.documentElement.style.setProperty('--lic',S.lic+'px');if(tip)zoomTip(S.lic+' px');}
  else{S.size=Math.round(Math.max(90,Math.min(420,v)));$('#size').value=S.size;document.documentElement.style.setProperty('--tile-w',S.size+'px');sliderFill();
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
function sliderFill(){const s=$('#size');s.style.setProperty('--p',((s.value-s.min)/(s.max-s.min)*100)+'%');}
$('#size').addEventListener('input',sliderFill);
main.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setSize(zcur()*Math.exp(-e.deltaY/100),true);},{passive:false});

/* filtry, sortowanie, widoki */
function typeCounts(){const n={}; for(const it of items) n[it.type]=(n[it.type]||0)+1; return n;}
const TLABEL=t=>t==='tif'?'TIFF':t==='pln'?'Archicad':t==='vid'?'Wideo':t.toUpperCase();
const fmtDur=s=>{if(!isFinite(s))return '';s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
const ICO_DOWN='<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m2.5 4 2.5 2.5L7.5 4"/></svg>';
function renderTypes(){
  const n=typeCounts(), present=TYPES.filter(t=>n[t]), shown=present.filter(t=>on(t));
  const b=$('#typesBtn'); let l='Wszystkie typy';
  if(shown.length<present.length) l=shown.length?shown.slice(0,2).map(TLABEL).join(', ')+(shown.length>2?' +'+(shown.length-2):''):'Żaden typ';
  b.innerHTML='<span></span>'+ICO_DOWN; b.firstChild.textContent=l; b.classList.toggle('on',shown.length<present.length);
}
function refilter(){save();renderTypes();for(const d of dirs)resetDir(d);applyView(keep());}
function typesMenu(){
  const n=typeCounts(), r=$('#typesBtn').getBoundingClientRect();
  const present=TYPES.filter(t=>n[t]||!on(t));
  $('#typesBtn').classList.add('open');
  if(!present.length){showMenu(r.left,r.bottom+6,'Brak obrazów w tym folderze',[]);return;}
  showMenu(r.left,r.bottom+6,null,[
    ...present.map(t=>({label:TLABEL(t),box:on(t),n:n[t]||0,keep:true,run:()=>{S.types[t]=!on(t);refilter();typesMenu();}})),
    '-',{label:'Pokaż wszystkie',dim:true,run:()=>{S.types={};refilter();}}]);
}
$('#typesBtn').onclick=e=>{e.stopPropagation();ctx.hidden||ctx.dataset.of!=='types'?(typesMenu(),ctx.dataset.of='types'):hideMenu();};
const DEF_DIR={name:1,type:1,date:-1,size:-1,dims:-1};
const SORTS=[['name','Nazwa','A → Z','Z → A'],['date','Data zmiany','Od najstarszych','Od najnowszych'],['size','Rozmiar pliku','Od najmniejszych','Od największych'],['dims','Wymiary','Od najmniejszych','Od największych'],['type','Rodzaj','A → Z','Z → A']];
function setSort(k){ if(S.sort===k) S.dir=-S.dir; else {S.sort=k;S.dir=DEF_DIR[k]||1;} save(); markSort(); applyView(keep()); }
function markSort(){
  const s=SORTS.find(x=>x[0]===S.sort)||SORTS[0], b=$('#sortBtn');
  b.innerHTML='<span></span><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="'+(S.dir>0?'M5 8V2M2.5 4.5 5 2l2.5 2.5':'M5 2v6M2.5 5.5 5 8l2.5-2.5')+'"/></svg>';
  b.firstChild.textContent=s[1]; b.title='Sortowanie: '+s[1]+', '+(S.dir>0?s[2]:s[3]).replace(/^Od /,'od ');
}
function sortMenu(){
  const r=$('#sortBtn').getBoundingClientRect(), s=SORTS.find(x=>x[0]===S.sort)||SORTS[0];
  $('#sortBtn').classList.add('open');
  showMenu(r.left,r.bottom+6,'Sortuj według',[
    ...SORTS.map(x=>({label:x[1],check:x[0]===S.sort,run:()=>{if(S.sort!==x[0])setSort(x[0]);}})),
    '-',
    {label:s[2],check:S.dir>0,run:()=>{S.dir=1;save();markSort();applyView(keep());}},
    {label:s[3],check:S.dir<0,run:()=>{S.dir=-1;save();markSort();applyView(keep());}}]);
}
$('#sortBtn').onclick=e=>{e.stopPropagation();ctx.hidden||ctx.dataset.of!=='sort'?(sortMenu(),ctx.dataset.of='sort'):hideMenu();};
function markModes(){
  document.querySelectorAll('#mode button').forEach(b=>press(b,b.dataset.v===S.mode));
  $('#size').min=S.mode==='list'?96:90; $('#size').max=S.mode==='list'?576:420;
  $('#size').value=S.mode==='list'?S.lic*6:S.size; sliderFill();
}
function setMode(m){if(S.mode===m)return;S.mode=m;save();markModes();render();}
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.v));
function setNames(v){S.names=v;save();document.body.classList.toggle('nonames',!v);}
function setSide(v){S.side=v;save();document.body.classList.toggle('noside',!v);press($('#sideBtn'),v);}
$('#sideBtn').onclick=()=>setSide(S.side===false);
function setInsp(v){S.insp=v;save();document.body.classList.toggle('insp',v);press($('#inspBtn'),v);if(v)renderInsp();requestAnimationFrame(()=>{if(S.mode!=='list'&&curPath)setSize(S.size);});}
$('#inspBtn').onclick=()=>setInsp(!S.insp);
// zwijane sekcje paska bocznego
S.shut=S.shut||{};
document.querySelectorAll('.sec').forEach(b=>{const k=b.dataset.sec;
  const apply=()=>{b.classList.toggle('shut',!!S.shut[k]);$('#'+k).classList.toggle('shut',!!S.shut[k]);};
  b.onclick=()=>{S.shut[k]=!S.shut[k];save();apply();}; apply();});

/* wyszukiwanie */
let qt=0;
$('#q').oninput=()=>{$('#qClear').hidden=!$('#q').value;clearTimeout(qt);qt=setTimeout(()=>applyView(keep()),120);};
$('#qClear').onclick=()=>{$('#q').value='';$('#qClear').hidden=true;applyView(keep());$('#q').focus();};
function markScope(){const b=$('#qScope');press(b,!!S.qAll);b.textContent=S.qAll?'wszędzie':'tu';b.title=S.qAll?'Szukam też w podfolderach — kliknij, żeby szukać tylko tutaj':'Szukam tylko w tym folderze — kliknij, żeby szukać też w podfolderach';}
$('#qScope').onclick=()=>{S.qAll=!S.qAll;save();markScope();if($('#q').value)applyView(keep());$('#q').focus();};
markScope();
$('#deepChip').onclick=()=>setDeep(false);

/* --- pamięć miniatur (folder na dysku, obsługuje ją proces główny) --- */
const fmtSize=b=>b<1024?b+' B':b<1048576?(b/1024).toFixed(0)+' KB':b<1073741824?(b/1048576).toLocaleString('pl',{maximumFractionDigits:1})+' MB':(b/1073741824).toLocaleString('pl',{maximumFractionDigits:1})+' GB';
let cacheC=null;
async function cacheInfo(){
  const c=cacheC=await api.cacheInfo();
  $('#cache').textContent=c.count.toLocaleString('pl')+' miniatur · '+fmtSize(c.bytes)+(api.web?'':' z '+fmtSize(c.limitMB*1048576));
  $('#cache').title='Pamięć miniatur: '+c.dir;
}
let newThumbs=0; setInterval(()=>{if(newThumbs){newThumbs=0;cacheInfo();}},4000);
async function cacheClear(){
  if(!confirm('Usunąć zapamiętane miniatury? Policzą się od nowa przy następnym otwarciu folderów.')) return;
  await api.cacheClear();
  for(const it of items){it.thumb=null;it.state=null;it._tp=null;}
  for(const d of dirs) resetDir(d);
  render(); prefetch(); cacheInfo();
}
function settingsMenu(){
  const r=$('#setBtn').getBoundingClientRect(), t=S.theme||'auto', lim=cacheC?cacheC.limitMB:2048;
  const LIM=[[1024,'1 GB'],[2048,'2 GB'],[5120,'5 GB'],[10240,'10 GB']];
  showMenu(r.left-4,r.top-8,'Motyw',[
    {label:'Automatyczny',check:t==='auto',run:()=>setTheme('auto')},
    {label:'Jasny',check:t==='light',run:()=>setTheme('light')},
    {label:'Ciemny',check:t==='dark',keys:['T'],run:()=>setTheme('dark')},
    '-',
    {label:'Nazwy pod miniaturami',box:S.names!==false,keys:['N'],keep:true,run:()=>{setNames(!(S.names!==false));settingsMenu();}},
    {label:'Ukryj interfejs',keys:['Tab'],run:toggleBare},
    '-',{head:'Pamięć miniatur'+(api.web?' w przeglądarce':'')},
    ...(api.web?[]:LIM.map(([mb,l])=>({label:'Limit '+l,check:lim===mb,run:async()=>{await api.cacheLimit(mb);cacheInfo();}}))),
    ...(api.web?[]:[{label:'Przenieś do innego folderu…',run:async()=>{const d=await api.cacheChoose();if(d){zoomTip('Miniatury w: '+d);cacheInfo();}}},
      {label:'Pokaż folder z miniaturami',run:()=>api.cacheReveal()}]),
    {label:'Wyczyść miniatury',run:cacheClear}],true);
}
$('#setBtn').onclick=e=>{e.stopPropagation();ctx.hidden||ctx.dataset.of!=='set'?(settingsMenu(),ctx.dataset.of='set'):hideMenu();};

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
// „wszystko w środku”: obrazy z podfolderów w jednej siatce, pogrupowane nagłówkami folderów
let deep=false, deepItems=null, deepFor=null, deepTok=0, heads=null;
const keep=()=>{const it=view[sel];return it?it.path:null;};

async function pickFolder(){ const p=await api.pickFolder(); if(p){ if(api.web) await loadRoots(); go(p); } }
function go(p,selectPath,inside){ curPath=p; S.last=p; save(); deep=!!inside; deepItems=null; deepFor=null; $('#q').value='';$('#qClear').hidden=true; markDeep(); scan(false,selectPath); }
function setDeep(v){ deep=v; markDeep(); applyView(keep()); main.scrollTop=0; prefetch(); }
function markDeep(){ const c=$('#deepChip'); c.hidden=!deep; }
async function scan(keepScroll,selectPath){
  if(!curPath) return;
  const tok=++scanTok, prevPath=selectPath||keep(), prevTop=main.scrollTop, here=curPath;
  if(keepScroll){ deepItems=null; deepFor=null; }
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
  if(!curPath) return;
  if(deep&&!$('#q').value){ setDeep(false); return; }
  const p=api.dirname(curPath); if(!p||p===curPath) return;
  const from=curPath; curPath=p; S.last=p; save(); deep=false; deepItems=null; deepFor=null; markDeep(); scan(false,from);
}
// wczytanie całego drzewa pod bieżącym folderem
async function loadDeep(){
  if(deepFor===curPath&&deepItems) return true;
  const here=curPath, tok=++deepTok, out=[], known=new Map(items.map(it=>[it.path,it]));
  const base=here.replace(/[\\/]+$/,'');
  const relOf=p=>{const d=api.dirname(p); return d.length>base.length?d.slice(base.length+1):'';};
  let queue=[here], n=0;
  while(queue.length){
    const batch=queue.splice(0,6);
    const res=await Promise.all(batch.map(d=>api.list(d,EXTS)));
    if(tok!==deepTok||here!==curPath) return false;
    for(const r of res){
      for(const f of r.files){
        const o=known.get(f.path);
        const it=o&&o.size===f.size&&o.mtime===f.mtime?o:{kind:'file',name:f.name,path:f.path,size:f.size,mtime:f.mtime,type:EXT[extOf(f.name)],gen,state:null};
        it.rel=relOf(f.path); out.push(it);
      }
      for(const d of r.dirs) queue.push(d.path);
    }
    n=out.length; status('Wczytywanie podfolderów… '+n+' '+plural(n,'obraz','obrazy','obrazów'));
    if(out.length>40000) break;
  }
  deepItems=out; deepFor=here; return true;
}

function crumbsOf(p){
  const out=[], pr=api.parse(p);
  let acc=pr.root; out.push({name:(api.web?pr.root.replace(/^\/|\/$/g,''):pr.root.replace(/[\\/]+$/,''))||(isMac?'Dysk':'/'),path:api.web?pr.root.replace(/\/$/,''):pr.root});
  for(const seg of p.slice(pr.root.length).split(/[\\/]+/).filter(Boolean)){ acc=acc.endsWith(SEP)?acc+seg:acc+SEP+seg; out.push({name:seg,path:acc}); }
  return out;
}
function renderCrumbs(){
  const c=$('#crumbs'); c.textContent='';
  if(!curPath){$('#fav').disabled=true;return;}
  const cs=crumbsOf(curPath);
  cs.forEach((x,i)=>{
    if(i){const s=document.createElement('i');s.textContent='/';c.appendChild(s);}
    const el=document.createElement(i===cs.length-1?'span':'a');
    el.textContent=x.name; el.title=x.path; if(i<cs.length-1) el.onclick=()=>go(x.path);
    c.appendChild(el);
  });
  $('#fav').disabled=false;
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
const TW='<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M3 1.5 5.5 4 3 6.5"/></svg>';
let treeRoot=null;
function renderTree(){
  const ul=$('#tree'); ul.textContent='';
  let best=null; if(curPath) for(const r of roots) if(under(curPath,r.path)&&(!best||r.path.length>best.path.length)) best=r;
  treeRoot=best;
  if(!best){ul.innerHTML='<li class="none"><span>Otwórz folder, żeby zobaczyć drzewo</span></li>';}
  const add=(n,d)=>{
    const li=document.createElement('li'); li.style.paddingLeft=(22+d*14)+'px'; li.title=n.path;
    const tw=document.createElement('span'); tw.className='tw'+(n.open?' open':'');
    if(!(n.kids&&!n.kids.length)) tw.innerHTML=TW;
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=n.name;
    li.append(tw,nm); if(n===treeCur) li.classList.add('on');
    tw.onclick=async e=>{e.stopPropagation();n.open=!n.open;if(n.open)await kidsOf(n);renderTree();};
    li.onclick=()=>go(n.path);
    ul.appendChild(li);
    if(n.open&&n.kids) for(const k of n.kids) add(k,d+1);
  };
  if(best) add(best,0);
  const pl=$('#places'); pl.textContent='';
  for(const r of roots){
    const li=document.createElement('li'); li.title=r.path;
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=r.name; li.appendChild(nm);
    if(best===r&&samePath(curPath,r.path)) li.classList.add('on');
    li.onclick=()=>go(r.path); pl.appendChild(li);
  }
  if(!roots.length) pl.innerHTML='<li class="none"><span>Brak</span></li>';
  document.documentElement.classList.toggle('oneroot',roots.length<2);
}
function renderSide(){
  const fl=$('#favs'); fl.textContent='';
  for(const f of S.favs){
    const li=document.createElement('li');
    li.innerHTML='<span class="nm"></span><button class="x" title="Usuń z ulubionych" aria-label="Usuń z ulubionych">×</button>';
    li.firstChild.textContent=f.name; li.title=f.path;
    li.onclick=()=>openFav(f);
    li.lastChild.onclick=e=>{e.stopPropagation();S.favs=S.favs.filter(x=>x!==f);save();renderSide();};
    if(samePath(f.path,curPath)) li.classList.add('on');
    fl.appendChild(li);
  }
  if(!S.favs.length) fl.innerHTML='<li class="none"><span>Dodaj folder przyciskiem +</span></li>';
  const fv=!!findFav(curPath), fb=$('#fav'); fb.classList.toggle('on',fv); fb.disabled=!curPath;
  fb.title=fv?'Usuń ten folder z ulubionych':'Dodaj ten folder do ulubionych';
}

/* --- widok --- */
function applyView(keepPath){
  const q=norm($('#q').value.trim());
  const isDeep=deep||(S.qAll&&!!q);
  if(isDeep&&!(deepFor===curPath&&deepItems)){
    loadDeep().then(ok=>{ if(ok){ applyView(keepPath); prefetch(); } });
    if(!view.length) status('Wczytywanie podfolderów…');
    return;
  }
  heads=null;
  const ds=isDeep?[]:dirs.filter(d=>!q||norm(d.name).includes(q));
  const fs=(isDeep?deepItems:items).filter(it=>on(it.type)&&(!q||norm(isDeep?(it.rel+'/'+it.name):it.name).includes(q)));
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
  if(isDeep){ // grupy według podfolderów, najpierw sam folder
    const g=new Map(); for(const it of fs){ if(!g.has(it.rel)) g.set(it.rel,[]); g.get(it.rel).push(it); }
    const keys=[...g.keys()].sort((a,b)=>a===''?-1:b===''?1:coll.compare(a,b));
    view=[]; heads=new Map();
    for(const k of keys){ heads.set(view.length,{rel:k,count:g.get(k).length}); view.push(...g.get(k)); }
  } else view=[...ds,...fs];
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
    if(heads&&heads.has(i)) frag.appendChild(groupHead(heads.get(i),'div'));
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
    if(heads&&heads.has(i)) frag.appendChild(groupHead(heads.get(i),'tr'));
    const r=document.createElement('tr'); r.dataset.i=i; r._it=it; if(picked.has(it)) r.className='sel';
    if(it.kind==='file') r.draggable=true;
    r.innerHTML='<td><div class="cell"><span class="ic"></span><span class="nm"></span></div></td><td class="m"></td><td class="num m"></td><td class="num m"></td><td class="m"></td>';
    r.querySelector('.nm').textContent=it.kind==='dir'?it.name+'/':it.name;
    r.title=it.name; it.tile=r; paint(it); frag.appendChild(r); io.observe(r);
  });
  body.appendChild(frag); grid.appendChild(tb);
}
function groupHead(g,tag){
  const el=document.createElement(tag); el.className='grp';
  const box=tag==='tr'?el.appendChild(document.createElement('td')):el; if(tag==='tr') box.colSpan=5;
  const b=document.createElement('b'); b.textContent=g.rel?g.rel.split(/[\\/]/).join(' / '):(api.basename(curPath)||curPath);
  const target=g.rel?curPath.replace(/[\\/]+$/,'')+SEP+g.rel:curPath;
  b.title='Otwórz ten folder'; b.onclick=()=>go(target);
  const c=document.createElement('span'); c.textContent=g.count+' '+plural(g.count,'obraz','obrazy','obrazów');
  box.append(b,c); return el;
}
const dirSub=d=>d.count==null?'folder':d.count?d.count+' '+plural(d.count,'obraz','obrazy','obrazów'):d.sub?d.sub+' '+plural(d.sub,'folder','foldery','folderów'):'brak obrazów';

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
  if(it.thumb){box.appendChild(it.thumb);if(it.type==='vid'){const d=document.createElement('span');d.className='dur';d.innerHTML='<svg width="7" height="8" viewBox="0 0 7 8" aria-hidden="true"><path d="M0 0v8l7-4z" fill="currentColor"/></svg>';d.append(it.meta&&it.meta.mode||'');box.appendChild(d);}return;}
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
    const mk=f=>({kind:'file',name:f.name,path:f.path,size:f.size,mtime:f.mtime,type:EXT[extOf(f.name)],state:null,gen});
    const r=await api.list(d.path,EXTS);
    let all=r.files.map(mk).filter(f=>on(f.type));
    all.sort((a,b)=>coll.compare(a.name,b.name));
    d.count=all.length; d.sub=r.dirs.length;
    // folder tylko z podfolderami: okładka i przewijanie z obrazów w podfolderach
    if(!all.length&&r.dirs.length){
      const queue=r.dirs.map(x=>x.path).sort(coll.compare); let seen=0;
      while(queue.length&&all.length<SKIM*6&&seen<40){
        const batch=queue.splice(0,4); seen+=batch.length;
        const res=await Promise.all(batch.map(x=>api.list(x,EXTS)));
        for(const s of res){
          const fs=s.files.map(mk).filter(f=>on(f.type)).sort((a,b)=>coll.compare(a.name,b.name));
          all.push(...fs.slice(0,SKIM));            // po kilka z każdego podfolderu, żeby było widać różnorodność
          queue.push(...s.dirs.map(x=>x.path).sort(coll.compare));
        }
      }
      d.deep=true;
    }
    d.files=all.length<=SKIM?all:Array.from({length:SKIM},(_,k)=>all[Math.floor(k*all.length/SKIM)]);
    d.si=0; d.state='done';
    coverFrom(d,0,hi||d.visible);
    paint(d);
  })();
}
const FOLDER_ICO='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width=".9" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h2.2l1 1.2h3.8a1 1 0 0 1 1 1v4.3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z"/></svg>';
const FOLDER_ICO_S='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M1.5 3.5a1 1 0 0 1 1-1h2.2l1 1.2h3.8a1 1 0 0 1 1 1v4.3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z"/></svg>';
function coverFrom(d,i,hi){ // okładka: pierwszy plik, który da się pokazać (najwyżej 6 prób)
  const f=d.files&&d.files[i]; if(!f||i>5){ paint(d); return; }
  f.cb=()=>{ if(f.thumb){ if(i){ d.files.splice(i,1); d.files.unshift(f); } paint(d); } else coverFrom(d,i+1,hi); };
  enqueue(f,hi);
}
function paintDir(d){
  if(!d.tile||d.tile.tagName==='TR'){ if(d.tile) paint(d); return; }
  const box=d.tile.firstChild; box.textContent='';
  const f=d.files&&d.files[d.si||0];
  if(f&&f.thumb) box.appendChild(f.thumb);
  else if(d.state==='done'&&!(d.files&&d.files.length)){const s=document.createElement('span');s.className='ph';s.innerHTML=FOLDER_ICO;box.appendChild(s);}
  if(d.count||(d.deep&&d.sub)){const c=document.createElement('span');c.className='chip';c.innerHTML=FOLDER_ICO_S;
    c.appendChild(document.createTextNode(d.count?d.count:d.sub+' '+plural(d.sub,'folder','foldery','folderów')));box.appendChild(c);}
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
      const b=await fetch(hit.url).then(x=>{if(!x.ok)throw 0;return x.blob();}).finally(()=>{if(hit.url.startsWith('blob:'))URL.revokeObjectURL(hit.url);});
      const bmp=await createImageBitmap(b);
      const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);bmp.close();
      it.thumb=c; it.dims=hit.dims||it.dims; it.meta=hit.meta||it.meta; return;
    }catch(e){ api.thumbForget(hit.hash); }
  }
  let bmp;
  if(it.type==='vid'){ // klatka z ~10% długości filmu; gdy przeglądarka nie zna kodeka — miniatura systemowa
    let f=null; try{f=await videoFrame(api.fileUrl(it.path));}catch(e){}
    const fmt=extOf(it.name).toUpperCase();
    if(f){bmp=f.bmp;it.dims=[f.w,f.h];it.meta={format:fmt,mode:fmtDur(f.dur)};}
    else{const png=await api.osThumb(it.path,TH); if(!png) throw new Error('nie można odtworzyć tego formatu — otwórz w programie');
      bmp=await createImageBitmap(new Blob([png],{type:'image/png'})); it.meta={format:fmt,mode:'',noplay:true};}
    const s=Math.min(1,TH/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(bmp.width*s)); c.height=Math.max(1,Math.round(bmp.height*s));
    const g=c.getContext('2d'); g.imageSmoothingQuality='high'; g.drawImage(bmp,0,0,c.width,c.height); bmp.close();
    it.thumb=c;
    c.toBlob(b=>{ if(b) b.arrayBuffer().then(buf=>api.thumbPut(key,buf,it.dims||null,it.meta)).then(()=>newThumbs++); },'image/webp',0.82);
    return;
  }
  if(DOCS.has(it.type)){
    const png=await api.osThumb(it.path,TH);
    if(png) bmp=await createImageBitmap(new Blob([png],{type:'image/png'}));
    else if(it.type==='pdf') bmp=await pdfThumb(it);
    else { const r=await decode(ref(it),'embedded',0); bmp=await toBitmap(r); }
    if(!bmp) throw new Error('brak podglądu — '+(api.web?'w przeglądarce tylko w programie':'otwórz w programie'));
    it.meta={format:TLABEL(it.type),mode:it.type==='pdf'?(it.pages?it.pages+' '+plural(it.pages,'strona','strony','stron'):''):(png?'':'podgląd zapisany w pliku')};
    const c=document.createElement('canvas'), s=Math.min(1,TH/Math.max(bmp.width,bmp.height));
    c.width=Math.max(1,Math.round(bmp.width*s)); c.height=Math.max(1,Math.round(bmp.height*s));
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.imageSmoothingQuality='high'; g.drawImage(bmp,0,0,c.width,c.height); bmp.close();
    it.thumb=c;
    c.toBlob(b=>{ if(b) b.arrayBuffer().then(buf=>api.thumbPut(key,buf,null,it.meta)).then(()=>newThumbs++); },'image/webp',0.85);
    return;
  }
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
function videoFrame(url){
  return new Promise((res,rej)=>{
    const v=document.createElement('video'); v.muted=true; v.preload='auto'; v.crossOrigin='anonymous';
    let done=false; const end=(e,r)=>{if(done)return;done=true;clearTimeout(t);v.removeAttribute('src');v.load();e?rej(e):res(r);};
    const t=setTimeout(()=>end(new Error('limit czasu')),12000);
    v.onerror=()=>end(new Error('kodek'));
    v.onloadedmetadata=()=>{ if(!v.videoWidth) return end(new Error('brak obrazu')); v.currentTime=Math.min((v.duration||0)*0.1,8); };
    v.onseeked=async()=>{try{const b=await createImageBitmap(v);end(null,{bmp:b,dur:v.duration,w:v.videoWidth,h:v.videoHeight});}catch(e){end(e);}};
    v.src=url;
  });
}
// PDF: pierwsza strona rysowana przez pdf.js (tylko w programie — biblioteka jest dołączana przy budowaniu)
let pdfjs=null, pdfjsTried=false;
async function pdfThumb(it){
  if(api.web) throw new Error('miniatury PDF są w programie; dwuklik otwiera dokument');
  if(!pdfjsTried){ pdfjsTried=true; try{ pdfjs=await import('../node_modules/pdfjs-dist/build/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc='../node_modules/pdfjs-dist/build/pdf.worker.min.mjs'; }catch(e){ pdfjs=null; } }
  if(!pdfjs) throw new Error('brak podglądu PDF');
  const data=new Uint8Array(await (await blobOf(it)).arrayBuffer());
  const doc=await pdfjs.getDocument({data,isEvalSupported:false}).promise;
  try{
    const page=await doc.getPage(1), v1=page.getViewport({scale:1});
    const vp=page.getViewport({scale:Math.min(4,TH*1.5/Math.max(v1.width,v1.height))});
    const c=document.createElement('canvas'); c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
    await page.render({canvasContext:g,viewport:vp}).promise;
    it.pages=doc.numPages;
    return await createImageBitmap(c);
  } finally { doc.destroy(); }
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
  if(r.img) return createImageBitmap(new Blob([r.img],{type:r.mime}));
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
  const s=$('#count');
  if(msg){if(/^(Folderu|Błąd)/.test(msg))zoomTip(msg);return;}
  if(!curPath){s.textContent='';renderInsp();return;}
  const nf=view.filter(x=>x.kind==='file').length, q=$('#q').value;
  const nd=view.length-nf;
  let t=nf?nf.toLocaleString('pl'):(nd?nd+' '+plural(nd,'folder','foldery','folderów'):'0');
  if(heads) t+=' w '+heads.size+' '+plural(heads.size,'folderze','folderach','folderach');
  if(picked.size>1) t+=' · zaznaczone '+picked.size;
  s.textContent=t; s.title=(q?'Wyniki: ':'')+nf+' '+plural(nf,'obraz','obrazy','obrazów');
  renderInsp();
}

/* --- panel informacji (I) --- */
let inspTok=0;
function renderInsp(){
  if(!S.insp) return;
  const tok=++inspTok, it=view[sel], many=[...picked].filter(x=>x.kind==='file');
  const pv=$('#iprev'), nm=$('#iname'), pa=$('#ipath'), me=$('#imeta'), ac=$('#iacts');
  pv.textContent=''; pv.classList.remove('has'); me.textContent=''; ac.textContent='';
  const row=(k,v)=>{const dt=document.createElement('dt');dt.textContent=k;const dd=document.createElement('dd');dd.textContent=v;me.append(dt,dd);};
  const act=(label,key,run,primary)=>{const b=document.createElement('button');b.className='act'+(primary?' primary':'');b.textContent=label;
    if(key){const s=document.createElement('span');s.textContent=key;b.appendChild(s);}b.onclick=run;ac.appendChild(b);};
  const rel=p=>{const d=api.dirname(p);return crumbsOf(d).slice(-2).map(x=>x.name).join(' / ');};
  if(many.length>1){
    nm.textContent='Zaznaczone: '+many.length; pa.textContent='';
    row('Łącznie',fmtSize(many.reduce((a,x)=>a+x.size,0)));
    const ty={}; for(const x of many) ty[TLABEL(x.type)]=(ty[TLABEL(x.type)]||0)+1;
    row('Typy',Object.entries(ty).map(([k,v])=>v+'× '+k).join(', '));
    const src=many[0].thumb; if(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);pv.appendChild(c);pv.classList.add('has');}
    act('Otwórz w '+(editorName||'Photoshopie')+' ('+many.length+')',MOD.replace('+',' ')+'E',()=>openInEditor(many.map(x=>x.path)),true);
    act('Pokaż zaznaczone',' Enter',()=>openViewer(it&&picked.has(it)?it:many[0]));
    act('Kopiuj nazwy','',()=>copyText(many.map(x=>x.name).join('\n')));
    act('Kopiuj ścieżki','',()=>copyText(many.map(x=>x.path).join('\n')));
    return;
  }
  if(!it){
    nm.textContent=curPath?(api.basename(curPath)||curPath):'Nic nie wybrano'; pa.textContent=curPath?'Zaznacz plik, żeby zobaczyć szczegóły':'';
    if(curPath){const nf=view.filter(x=>x.kind==='file');row('Obrazy',String(nf.length));row('Rozmiar',fmtSize(nf.reduce((a,x)=>a+x.size,0)));}
    return;
  }
  nm.textContent=it.name; pa.textContent=rel(it.path); pa.title=it.path;
  if(it.kind==='dir'){
    row('Obrazy',it.count==null?'…':String(it.count));
    const src=it.files&&it.files[0]&&it.files[0].thumb; if(src){const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);pv.appendChild(c);pv.classList.add('has');}
    act('Otwórz folder','Enter',()=>go(it.path),true);
    act('Pokaż wszystko w środku','⇧ Enter',()=>go(it.path,null,true));
    if(!api.web) act('Pokaż w '+FINDER,'',()=>api.showInFolder(it.path));
    act(findFav(it.path)?'Usuń z ulubionych':'Dodaj do ulubionych','',()=>{toggleFav(it.path);renderInsp();});
    return;
  }
  if(it.thumb){const c=document.createElement('canvas');c.width=it.thumb.width;c.height=it.thumb.height;c.getContext('2d').drawImage(it.thumb,0,0);pv.appendChild(c);pv.classList.add('has');}
  if(it.dims) row('Wymiary',it.dims[0]+' × '+it.dims[1]+' px');
  row('Rozmiar',fmtSize(it.size));
  let f=it.meta?it.meta.format:(it.type==='raw'?extOf(it.name):it.type).toUpperCase();
  if(it.meta&&it.meta.mode) f+=' · '+it.meta.mode; if(it.meta&&it.meta.depth) f+=' · '+it.meta.depth+'-bit';
  row('Format',f);
  row('Zmieniony',fmtDate(it.mtime));
  if(!api.web) act('Otwórz w '+(editorName||'Photoshopie'),MOD.replace('+',' ')+'E',()=>openInEditor([it.path]),true);
  else act('Otwórz podgląd','Spacja',()=>openViewer(it),true);
  if(!api.web) act('Pokaż w '+FINDER,'R',()=>api.showInFolder(it.path));
  act('Kopiuj obraz','C',()=>copyImage(it));
  act('Kopiuj ścieżkę','P',()=>copyText(it.path));
}

/* --- podgląd powiększony: natychmiast miniatura, potem pełny obraz; sąsiedzi wczytywani z wyprzedzeniem --- */
const viewer=$('#viewer'), stage=$('#stage');
let vTok=0, vEl=null, actual=false, vList=[], vi=0, lastStep=0;
const vCache=new Map(); // pełne obrazy ostatnio oglądane i wczytane z wyprzedzeniem
const VC_PX=180e6;      // limit pamięci podglądów (w pikselach)
const bigCell=(w,h)=>Math.max(8,Math.round(Math.max(w,h)/80));
const vpx=v=>v.media?0:(v.el.naturalWidth||v.el.width)*(v.el.naturalHeight||v.el.height);
const vLoading=new Map();
function fullOf(it){
  if(vCache.has(it)){const v=vCache.get(it);vCache.delete(it);vCache.set(it,v);return Promise.resolve(v);}
  if(vLoading.has(it)) return vLoading.get(it);
  const p=(async()=>{
    let v;
    if(it.type==='vid'){
      const vid=document.createElement('video'); vid.src=api.fileUrl(it.path); vid.preload='metadata'; vid.loop=true; vid.playsInline=true;
      await new Promise((ok,no)=>{vid.onloadedmetadata=ok;vid.onerror=()=>no(new Error('tego formatu nie da się tu odtworzyć — otwórz w programie (E)'));});
      it.dims=[vid.videoWidth,vid.videoHeight]; v={el:videoPlayer(vid),note:'',media:true,video:vid};
    }else if(it.type==='pdf'){ // cały dokument we wbudowanej przeglądarce PDF
      const el=document.createElement('iframe'); el.src=api.fileHref(it.path); el.className='doc'; el.title=it.name;
      v={el,note:'',doc:true};
    }else if(DOCS.has(it.type)){ // model / rysunek: powiększony podgląd zapisany w pliku
      await thumbOf(it).catch(()=>{});
      if(!it.thumb) throw new Error('brak podglądu — otwórz plik w programie');
      const el=document.createElement('canvas'); el.width=it.thumb.width; el.height=it.thumb.height; el.getContext('2d').drawImage(it.thumb,0,0);
      el.className='docthumb'; v={el,note:'pełny plik otworzysz w programie (E)',doc:true};
    }else if(NATIVE.has(it.type)&&it.type!=='jpg'&&it.type!=='gif'&&it.type!=='svg'){
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
    if(v.media) return v; // filmów nie trzymamy w pamięci
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
  vi=Math.max(0,vList.indexOf(it)); viewer.classList.add('open'); chromeSync(); showV();
}
// własny, cichy odtwarzacz: film, a pod nim jedna linia — odtwórz, czas, pasek, dźwięk
const IC_PLAY='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>';
const IC_PAUSE='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h2v8H3zM7 2h2v8H7z" fill="currentColor"/></svg>';
const IC_SND='<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1.5 4.5h2l3-2.5v8l-3-2.5h-2z" fill="currentColor" stroke="none"/><path d="M9 4a2.6 2.6 0 0 1 0 4M10.8 2.4a5 5 0 0 1 0 7.2"/></svg>';
const IC_MUTE='<svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1.5 4.5h2l3-2.5v8l-3-2.5h-2z" fill="currentColor" stroke="none"/><path d="m9 4.2 3.4 3.6M12.4 4.2 9 7.8"/></svg>';
function videoPlayer(vid){
  const w=document.createElement('div'); w.className='vwrap';
  const box=document.createElement('div'); box.className='vbox';
  const bar=document.createElement('div'); bar.className='vbar';
  bar.innerHTML='<button class="ib vp" aria-label="Odtwórz / pauza (K)"></button><span class="vt0">0:00</span><div class="vs"><div class="vs-f"></div></div><span class="vt1"></span><button class="ib vm" aria-label="Dźwięk (M)"></button><div class="vs vv" title="Głośność"><div class="vs-f"></div></div>';
  box.append(vid,bar); w.appendChild(box);
  const bp=bar.querySelector('.vp'), bm=bar.querySelector('.vm'), t0=bar.querySelector('.vt0'), t1=bar.querySelector('.vt1'), sc=bar.querySelector('.vs'), fill=bar.querySelector('.vs-f');
  const vv=bar.querySelector('.vv'), vf=vv.firstChild;
  vid.volume=S.vol!=null?S.vol:1; vid.muted=!!S.mute;
  const sync=()=>{bp.innerHTML=vid.paused?IC_PLAY:IC_PAUSE; const off=vid.muted||!vid.volume; bm.innerHTML=off?IC_MUTE:IC_SND; vf.style.width=(off?0:vid.volume*100)+'%';};
  const time=()=>{t0.textContent=fmtDur(vid.currentTime); t1.textContent=fmtDur(vid.duration); fill.style.width=(vid.duration?vid.currentTime/vid.duration*100:0)+'%';};
  vid.addEventListener('play',sync); vid.addEventListener('pause',sync); vid.addEventListener('volumechange',sync); vid.addEventListener('timeupdate',time);
  const tog=()=>vid.paused?vid.play().catch(()=>{}):vid.pause();
  vid.onclick=e=>{e.stopPropagation();tog();};
  bp.onclick=e=>{e.stopPropagation();tog();};
  bm.onclick=e=>{e.stopPropagation();vid.muted=!vid.muted;if(!vid.muted&&!vid.volume)vid.volume=.5;S.mute=vid.muted;S.vol=vid.volume;save();};
  let vdrag=false;
  const setVol=e=>{const r=vv.getBoundingClientRect();const k=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));vid.volume=k;vid.muted=k===0;S.vol=k;S.mute=vid.muted;};
  vv.onpointerdown=e=>{e.stopPropagation();vdrag=true;vv.setPointerCapture(e.pointerId);vv.classList.add('drag');setVol(e);};
  vv.onpointermove=e=>{if(vdrag)setVol(e);};
  vv.onpointerup=()=>{vdrag=false;vv.classList.remove('drag');save();};
  vv.onwheel=e=>{e.preventDefault();e.stopPropagation();vid.volume=Math.max(0,Math.min(1,vid.volume-Math.sign(e.deltaY)*.05));vid.muted=!vid.volume;S.vol=vid.volume;S.mute=vid.muted;save();};
  let drag=false;
  const seek=e=>{const r=sc.getBoundingClientRect();const k=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));if(vid.duration){vid.currentTime=k*vid.duration;time();}};
  sc.onpointerdown=e=>{e.stopPropagation();drag=true;sc.setPointerCapture(e.pointerId);sc.classList.add('drag');seek(e);};
  sc.onpointermove=e=>{if(drag)seek(e);};
  sc.onpointerup=e=>{drag=false;sc.classList.remove('drag');};
  bar.onclick=e=>e.stopPropagation();
  w.onclick=e=>{if(e.target===w)closeViewer();};
  sync(); time(); w.video=vid; return w;
}
function stopMedia(){for(const m of stage.querySelectorAll('video'))m.pause();}
function mount(el,low,it){
  stopMedia(); stage.textContent=''; stage.appendChild(el); vEl=low?null:el;
  el.classList.toggle('low',!!low);
  el.style.width=el.style.height='';
  if(low){ // miniatura powiększona do docelowego rozmiaru, żeby nic nie skakało
    const r=stage.getBoundingClientRect(), aw=r.width-128, ah=r.height-38;
    const [dw,dh]=it.dims||[el.width,el.height];
    const s=Math.min(aw/dw,ah/dh,1); el.style.width=Math.round(dw*s)+'px'; el.style.height=Math.round(dh*s)+'px';
  } else {
    if(el.tagName!=='IFRAME'&&!el.video) el.onclick=ev=>{ev.stopPropagation();actual=!actual;applyZoom(true);};
    if(!el.video) el.draggable=true; el.ondragstart=ev=>{ev.preventDefault();api.dragOut([it.path]);};
    applyZoom();
    if(el.video) el.video.play().catch(()=>{});
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
  try{v=await fullOf(it);}catch(e){if(tok!==vTok)return;if(!it.thumb){stage.innerHTML='<div class="msg"></div>';stage.firstChild.textContent='Nie udało się otworzyć: '+(e.message||e);}else $('#vinfo').textContent=info(it)+'  ·  '+(e.message||e);return;}
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
  if(vEl&&!vEl.video){const w=(vEl.naturalWidth||vEl.width)/devicePixelRatio;vEl.style.width=actual?w+'px':'';vEl.style.height='';}
  if(tip) zoomTip(actual?'100%':'Dopasuj');
}
function closeViewer(){stopMedia();viewer.classList.remove('open');chromeSync();vTok++;stage.textContent='';vEl=null;main.focus();}
stage.addEventListener('click',e=>{if(e.target===stage)closeViewer();});
// kółko myszy i gładzik przewijają obrazy (w trybie 100% przewijają sam obraz)
let wAcc=0, wT=0;
stage.addEventListener('wheel',e=>{
  if(actual||e.ctrlKey||e.metaKey||(vEl&&vEl.tagName==='IFRAME')) return;
  e.preventDefault();
  const d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
  wAcc+=e.deltaMode===1?d*30:d; clearTimeout(wT); wT=setTimeout(()=>wAcc=0,200);
  while(Math.abs(wAcc)>=70){ const s=Math.sign(wAcc); wAcc-=s*70; stepV(s); }
},{passive:false});
$('#vprev').onclick=()=>stepV(-1); $('#vnext').onclick=()=>stepV(1); $('#vclose').onclick=closeViewer;
async function copyImage(it){
  try{
    const v=await fullOf(it); let c=v.el;
    if(v.video){const k=document.createElement('canvas');k.width=v.video.videoWidth;k.height=v.video.videoHeight;k.getContext('2d').drawImage(v.video,0,0);c=k;}
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
function hideMenu(){ctx.hidden=true;ctx.dataset.of='';document.querySelectorAll('.tb.open').forEach(b=>b.classList.remove('open'));}
const CHECK='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m2.5 6.2 2.3 2.3 4.7-5"/></svg>';
function showMenu(x,y,title,entries,up){
  ctx.textContent=''; delete ctx.dataset.of;
  if(title){const h=document.createElement('div');h.className='ch';h.textContent=title;ctx.appendChild(h);}
  const anyCheck=entries.some(e=>e&&e.check!==undefined);
  for(const en of entries){
    if(en==='-'){ctx.appendChild(document.createElement('hr'));continue;}
    if(en.head){const h=document.createElement('div');h.className='ch';h.textContent=en.head;ctx.appendChild(h);continue;}
    const b=document.createElement('button'); b.setAttribute('role','menuitem');
    if(en.box!==undefined){const x=document.createElement('span');x.className='box'+(en.box?' on':'');if(en.box)x.innerHTML=CHECK;b.appendChild(x);}
    const l=document.createElement('span'); l.className='l'; l.textContent=en.label; if(en.dim) l.style.color='var(--muted)'; b.appendChild(l);
    if(en.n!==undefined){const n=document.createElement('span');n.className='n';n.textContent=en.n;b.appendChild(n);}
    if(anyCheck){const c=document.createElement('span');c.className='c';if(en.check)c.innerHTML=CHECK;b.appendChild(c);}
    const keys=en.keys||(en.key?String(en.key).replace(/^(⌘|Ctrl\+)(.)$/,'$1 $2').split(' '):null);
    if(keys){const k=document.createElement('span');k.className='keys';for(const t of keys){const kb=document.createElement('kbd');kb.textContent=t.replace(/\+$/,'');k.appendChild(kb);}b.appendChild(k);}
    b.onclick=e=>{e.stopPropagation(); if(!en.keep) hideMenu(); en.run();};
    ctx.appendChild(b);
  }
  ctx.hidden=false;
  const r=ctx.getBoundingClientRect();
  ctx.style.left=Math.max(6,Math.min(x,innerWidth-r.width-8))+'px';
  ctx.style.top=Math.max(6,Math.min(up?y-r.height:y,innerHeight-r.height-8))+'px';
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
      {label:deep?'Pokaż tylko ten folder':'Pokaż wszystko z podfolderów',key:'W',run:()=>setDeep(!deep)},
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
      {label:'Pokaż wszystko w środku',key:'⇧Enter',run:()=>go(it.path,null,true)},
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
  if(n===1&&heads&&it.rel) en.push({label:'Przejdź do folderu „'+it.rel.split(/[\\/]/).pop()+'”',run:()=>go(api.dirname(it.path),it.path)});
  en.push({label:'Pokaż w '+FINDER,run:()=>api.showInFolder(it.path)});
  en.push('-');
  en.push({label:n>1?'Kopiuj nazwy ('+n+')':'Kopiuj nazwę',run:()=>copyText(many.map(x=>x.name).join('\n'))});
  en.push({label:n>1?'Kopiuj ścieżki ('+n+')':'Kopiuj ścieżkę',run:()=>copyText(many.map(x=>x.path).join('\n'))});
  en.push('-',{label:'Zmień program do edycji…',run:()=>openInEditor(many.map(x=>x.path),true)});
  showMenu(e.clientX,e.clientY,n>1?'Zaznaczone: '+n:it.name,en);
});
document.addEventListener('pointerdown',e=>{if(!ctx.hidden&&!ctx.contains(e.target)&&!e.target.closest('#typesBtn,#sortBtn,#setBtn,#vmore'))hideMenu();});
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
    else if((k==='k'||k==='m')&&vEl&&vEl.video){const m=vEl.video; if(k==='k') m.paused?m.play().catch(()=>{}):m.pause(); else {m.muted=!m.muted;if(!m.muted&&!m.volume)m.volume=.5;S.mute=m.muted;S.vol=m.volume;save();}}
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
  if(mod&&k.toLowerCase()==='d'){e.preventDefault();if(curPath){const had=!!findFav(curPath);toggleFav();zoomTip(had?'Usunięto z ulubionych':'Dodano do ulubionych');}return;}
  if(mod||e.altKey) return;
  const c=cols(), how=e.shiftKey?'range':undefined;
  const mv=d=>{e.preventDefault();select(sel<0?0:sel+d,how);};
  if(k==='ArrowRight')mv(1); else if(k==='ArrowLeft')mv(-1);
  else if(k==='ArrowDown')mv(c); else if(k==='ArrowUp')mv(-c);
  else if(k==='Home'){e.preventDefault();select(0,how);}
  else if(k==='End'){e.preventDefault();select(view.length-1,how);}
  else if(k==='Enter'&&e.shiftKey&&view[sel]&&view[sel].kind==='dir'){e.preventDefault();go(view[sel].path,null,true);}
  else if(k===' '||k==='Enter'){e.preventDefault();if(sel>=0)open(sel);}
  else if(k==='w'){setDeep(!deep);}
  else if(k==='i'){setInsp(!S.insp);}
  else if(k==='\\'){setSide(S.side===false);}
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
  if(api.addDropped){ const it=[...e.dataTransfer.items].find(i=>i.kind==='file'); if(it){ const p=await api.addDropped(it); if(p){ await loadRoots(); go(p); } } return; }
  const f=e.dataTransfer.files[0]; if(!f) return;
  const p=api.pathForFile(f); if(!p) return;
  if(await api.exists(p)) go(p); else go(api.dirname(p),p);
});

/* --- dymki: własne zamiast systemowych; przy nazwach tylko, gdy są ucięte --- */
let tipBox=null, tipFor=null, tipT2=0;
function hideTip(){ clearTimeout(tipT2); tipFor=null; if(tipBox) tipBox.classList.remove('on'); }
function showTip(el){
  if(!el.isConnected) return;
  if(!tipBox){ tipBox=document.createElement('div'); tipBox.className='tip'; tipBox.setAttribute('role','tooltip'); document.body.appendChild(tipBox); }
  tipBox.textContent=el.dataset.tip; tipBox.classList.add('on');
  const r=el.getBoundingClientRect(), b=tipBox.getBoundingClientRect();
  let x=r.left+r.width/2-b.width/2, y=r.bottom+6;
  if(el.closest('.nav')){ x=r.left+8; }
  if(y+b.height>innerHeight-6) y=r.top-b.height-6;
  tipBox.style.left=Math.max(6,Math.min(x,innerWidth-b.width-6))+'px'; tipBox.style.top=y+'px';
}
document.addEventListener('mouseover',e=>{
  const el=e.target.closest('[title],[data-tip]'); if(!el||el===tipFor) return;
  if(el.hasAttribute('title')){ el.dataset.tip=el.getAttribute('title'); el.removeAttribute('title'); }
  hideTip(); if(!el.dataset.tip) return;
  const nm=el.matches('.nav li,.tile,tr')?el.querySelector('.nm'):null;
  if(nm&&getComputedStyle(nm).display!=='none'&&nm.scrollWidth<=nm.clientWidth+1) return; // nazwa widoczna w całości
  tipFor=el; tipT2=setTimeout(()=>showTip(el),450);
});
document.addEventListener('mouseout',e=>{ if(tipFor&&!(e.relatedTarget&&tipFor.contains(e.relatedTarget))) hideTip(); });
addEventListener('mousedown',hideTip,true); addEventListener('keydown',hideTip,true); addEventListener('blur',hideTip); main.addEventListener('scroll',hideTip,{passive:true});

/* --- start --- */
$('#empty-open').onclick=pickFolder;
$('#fav').onclick=()=>toggleFav();
markSort(); markModes(); setNames(S.names!==false); setSide(S.side!==false); setInsp(!!S.insp);
renderSide(); renderCrumbs(); renderTypes(); cacheInfo();
loadRoots().then(async()=>{ if(S.last&&await api.exists(S.last)) go(S.last); else { render(); syncTree(); } });
