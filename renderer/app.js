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
// okno podglądu ze spacji w Eksploratorze (Windows): korzysta z ustawień, ale niczego w nich nie zmienia
const PEEK=!!api.peekPath;
const save=()=>{ if(PEEK) return; try{localStorage.setItem('podglad',JSON.stringify(S));}catch(e){} };
const press=(b,v)=>b.setAttribute('aria-pressed',v?'true':'false');

function applyTheme(){
  const t=S.theme||'auto';
  const dark=t==='auto'?matchMedia('(prefers-color-scheme: dark)').matches:t==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  chromeSync();
}
// przyciski okna (Windows) w kolorze tła; na Macu „światła” po lewej
if(!api.web) document.documentElement.classList.add(api.platform==='darwin'?'frame-mac':'frame-win');
// pełny ekran ze skrótu: obraz na całym ekranie, bez paska zadań, paska okna i interfejsu; wyjście tym samym skrótem albo Esc
let fsBare=null, fsWant=false;
if(api.onFullscreen) api.onFullscreen(v=>{
  document.documentElement.classList.toggle('fs',v);
  if(v&&fsWant&&fsBare===null){ fsBare=document.body.classList.contains('bare'); if(!fsBare) toggleBare(); }
  else if(!v&&fsBare!==null){ if(!fsBare&&document.body.classList.contains('bare')) toggleBare(); fsBare=null; }
  fsWant=false;
  // po zmianie rozmiaru okna przerysowujemy obraz albo arkusz w nowym rozmiarze
  setTimeout(()=>{ if(!viewer.classList.contains('open')) return; if(inSheet()) renderSheet(); else if(zm) renderZoom(); else if(vList[vi]) showV(); },180);
});
// ikona pełnego ekranu i pastylka w trybie minimal / pełnym ekranie
{ const FSK=isMac?'⌃⌘F':'Ctrl+spacja';
  const tips=()=>{ const fs=document.documentElement.classList.contains('fs');
    for(const b of [$('#vfs'),$('#pillFs')]) b.title=fs?'Wyjdź z pełnego ekranu ('+FSK+' / Esc)':'Pełny ekran ('+FSK+')';
    $('#pillUi').title=document.body.classList.contains('bare')?'Pokaż interfejs (Tab)':'Ukryj interfejs (Tab)'; };
  $('#vfs').onclick=e=>{ e.stopPropagation(); fullscreenToggle(); };
  $('#pillFs').onclick=e=>{ e.stopPropagation(); fullscreenToggle(); };
  $('#pillUi').onclick=e=>{ e.stopPropagation(); toggleBare(); tips(); };
  let idleT=0;
  addEventListener('mousemove',()=>{ const b=document.body; b.classList.add('moving'); b.classList.remove('idle'); tips(); clearTimeout(idleT);
    idleT=setTimeout(()=>{ if($('#fspill').matches(':hover')) return; b.classList.remove('moving'); b.classList.add('idle'); },2000); });
  if(api.onFullscreen) api.onFullscreen(()=>setTimeout(tips,50));
}
function fullscreenToggle(){ fsWant=!document.documentElement.classList.contains('fs'); if(api.fullscreenToggle) api.fullscreenToggle(); else if(document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(()=>{}); }
function chromeSync(){
  if(api.web||!api.chromeColors) return;
  const cs=getComputedStyle(document.documentElement), v=document.getElementById('viewer');
  const bg=(v&&v.classList.contains('open')?cs.getPropertyValue('--stage'):cs.getPropertyValue('--bg')).trim();
  // bez paska programu (Tab) przyciski okna stoją w cienkim pasku 36 px, żeby nie wchodzić na miniatury
  const slim=document.body.classList.contains('bare');
  api.chromeColors(bg,cs.getPropertyValue('--text2').trim(),slim?36:52);
}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
function setTheme(t){S.theme=t==='auto'?null:t;save();applyTheme();}
function cycleTheme(){S.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';save();applyTheme();}

/* rozmiar miniatur: liczony od liczby kolumn — każdy krok to jedna miniatura więcej albo mniej w rzędzie,
   a kafelki zawsze dokładnie wypełniają szerokość. Suwak, 1 i 2, Ctrl/⌘ + − +, kółko i szczypnięcie */
const gapK=()=>document.body.classList.contains('gridlines')?0:.15;     // odstęp między kolumnami = 15% kafelka
function gridW(){ const g=document.getElementById('grid'); return g&&g.clientWidth?g.clientWidth:((main&&main.clientWidth)||1200)-48; }
const tileFor=n=>Math.floor(gridW()/(n+gapK()*(n-1))-0.5);
const colsFor=px=>Math.max(1,Math.round((gridW()+gapK()*px)/(px*(1+gapK()))));
const nMax=()=>Math.max(2,Math.floor((gridW()+gapK()*90)/(90*(1+gapK()))));
function maxTile(){ return tileFor(2); }
let zAcc=null;                       // płynna wartość dla szczypnięcia i kółka; wyświetlamy najbliższą liczbę kolumn
function applyCols(n,tip){
  n=Math.max(2,Math.min(nMax(),n||2));
  const t=Math.max(60,tileFor(n)), ch=S.cols!==n||S.size!==t;
  S.cols=n; S.size=t;
  const sl=$('#size'), nm=nMax(); sl.min=0; sl.max=nm-2; sl.step=1; sl.value=nm-n;   // suwak: równy odcinek na każdą kolumnę, w prawo = większe
  document.documentElement.style.setProperty('--tile-w',t+'px'); sliderFill();
  if(ch&&typeof hdAll==='function') hdAll();
  if(tip&&ch) zoomTip(n+' '+plural(n,'kolumna','kolumny','kolumn'));
  save();
}
function setSize(v,tip){
  if(S.mode==='list'){S.lic=Math.round(Math.max(16,Math.min(96,v)));document.documentElement.style.setProperty('--lic',S.lic+'px');const sl=$('#size');sl.min=96;sl.max=576;sl.value=S.lic*6;sliderFill();if(tip)zoomTip(S.lic+' px');save();return;}
  zAcc=Math.max(70,Math.min(tileFor(2)*1.1,v));
  applyCols(colsFor(zAcc),tip);
}
// zmiana szerokości okna, panelu bocznego albo panelu informacji: ta sama liczba kolumn, nowa wielkość
new ResizeObserver(()=>{ if(S.mode!=='list'&&S.cols) requestAnimationFrame(()=>applyCols(S.cols)); }).observe(main);
const zcur=()=>S.mode==='list'?S.lic:(zAcc||S.size);
const zstep=d=>{ if(S.mode==='list') return setSize(S.lic*(d>0?1.15:1/1.15),true); applyCols((S.cols||colsFor(S.size))+(d>0?-1:1),true); zAcc=S.size; };
let tipEl=null,tipT=0;
function zoomTip(t){if(!tipEl){tipEl=document.createElement('div');tipEl.className='zoomtip';document.body.appendChild(tipEl);}
  tipEl.textContent=t;tipEl.classList.add('on');clearTimeout(tipT);tipT=setTimeout(()=>tipEl.classList.remove('on'),800);}
document.documentElement.style.setProperty('--lic',S.lic+'px');
setSize(S.size);
$('#size').oninput=e=>{ if(S.mode==='list') setSize(+e.target.value/6); else { applyCols(nMax()-(+e.target.value),true); zAcc=S.size; } };
$('#size').addEventListener('change',()=>{ if(!S.hints||S.hints.zoom) return; hint('zoom',$('#size'),KL.wheel+' nad miniaturami zmienia ich wielkość płynnie, bez sięgania po suwak. Klawisze <kbd>1</kbd> <kbd>2</kbd> robią to samo.'); });
function sliderFill(){const s=$('#size');s.style.setProperty('--p',((s.value-s.min)/(s.max-s.min)*100)+'%');}
$('#size').addEventListener('input',sliderFill);
// Ctrl/⌘ + kółko albo szczypnięcie: płynna zmiana wielkości miniatur (ząbek kółka ≈ 6%, gładzik jeszcze drobniej)
// szczypnięcie na gładziku daje gęste, drobne (często ułamkowe) kroki — ma dawną czułość;
// ząbek kółka myszy (duży, całkowity krok) zmienia rozmiar o kilka procent
const pinchLike=e=>e.deltaMode===0&&(!Number.isInteger(e.deltaY)||Math.abs(e.deltaY)<50);
main.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();hintDone('zoom');
  // siatka: ruchy kółka i gładzika się sumują; jedna kolumna dopiero po odpowiedniku jednego ząbka (także przy
  // powiększeniu ekranu w Windows, gdzie ząbek daje ułamkowe wartości), nie częściej niż co 150 ms
  if(S.mode!=='list'){
    const now=performance.now(), d=e.deltaMode===1?e.deltaY*33:e.deltaY;
    if(now-wheelLast>350) wheelAcc=0; wheelLast=now;
    wheelAcc+=d;
    if(Math.abs(wheelAcc)>=50&&now-wheelT>150){ wheelT=now; zstep(wheelAcc<0?1:-1); wheelAcc=0; }
    return;
  }
  const d=e.deltaMode===1?e.deltaY*33:e.deltaY; setSize(zcur()*Math.exp(-Math.max(-120,Math.min(120,d))/100),true);},{passive:false});
let wheelT=0, wheelAcc=0, wheelLast=0;

/* filtry, sortowanie, widoki */
function typeCounts(){const n={}; const src=virt==='basket'?S.basket.map(b=>({type:EXT[extOf(b.name)]})):items; for(const it of src) n[it.type]=(n[it.type]||0)+1; return n;}
const TLABEL=t=>t==='tif'?'TIFF':t==='pln'?'Archicad':t==='vid'?'Wideo':t.toUpperCase();
const fmtDur=s=>{if(!isFinite(s))return '';s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0');};
const ICO_DOWN='<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m2.5 4 2.5 2.5L7.5 4"/></svg>';
function renderTypes(){
  const n=typeCounts(), present=TYPES.filter(t=>n[t]), shown=present.filter(t=>on(t));
  const b=$('#typesBtn'); let l='Filtr';
  if(shown.length<present.length) l='Filtr: '+(shown.length?shown.slice(0,2).map(TLABEL).join(', ')+(shown.length>2?' +'+(shown.length-2):''):'nic');
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
function setMode(m){if(S.mode===m)return;S.mode=m;save();markModes();render();if(m!=='list')requestAnimationFrame(()=>applyCols(S.cols||colsFor(S.size)));else setSize(S.lic);}
document.querySelectorAll('#mode button').forEach(b=>b.onclick=()=>setMode(b.dataset.v));
function setNames(v){S.names=v;save();document.body.classList.toggle('nonames',!v);}
function setGridLines(v){S.gridlines=v;save();document.body.classList.toggle('gridlines',!!v);if(S.mode!=='list'&&S.cols)applyCols(S.cols);}
function setDirNames(v){S.dirNames=v;save();document.body.classList.toggle('nodirnames',!v);}
function setSide(v){S.side=v;save();document.body.classList.toggle('noside',!v);press($('#sideBtn'),v);}
$('#sideBtn').onclick=()=>setSide(S.side===false);
function setInsp(v){S.insp=v;save();document.body.classList.toggle('insp',v);press($('#inspBtn'),v);if(v)renderInsp();requestAnimationFrame(()=>{if(S.mode!=='list'&&S.cols)applyCols(S.cols);});}
$('#inspBtn').onclick=()=>setInsp(!S.insp);
// zwijane sekcje paska bocznego
S.shut=S.shut||{};
document.querySelectorAll('.sec').forEach(b=>{const k=b.dataset.sec;
  const apply=()=>{b.classList.toggle('shut',!!S.shut[k]);$('#'+k).classList.toggle('shut',!!S.shut[k]);};
  b.onclick=()=>{S.shut[k]=!S.shut[k];save();apply();}; apply();});

/* wyszukiwanie: zwinięte do lupy, gdy puste i nieużywane */
function syncSearch(){ const q=$('#q'); $('.search').classList.toggle('min',!q.value&&document.activeElement!==q&&!(ctx&&!ctx.hidden&&ctx.dataset.of==='scope')); }
$('#q').addEventListener('focus',()=>$('.search').classList.remove('min'));
$('#q').addEventListener('blur',()=>setTimeout(syncSearch,160));
$('#qScope').addEventListener('mousedown',e=>e.preventDefault());
let qt=0;
$('#q').oninput=()=>{ if(api.libSearch&&S.qIn!=='lib'&&S.favs.length&&!S.hints.lib) hint('lib',$('#q'),'<kbd>⇧F</kbd> szuka od razu we wszystkich ulubionych folderach i ich podfolderach.');$('#qClear').hidden=!$('#q').value;clearTimeout(qt);qt=setTimeout(()=>applyView(keep()),120);};
$('#qClear').addEventListener('mousedown',e=>e.preventDefault());
$('#qClear').onclick=()=>{$('#q').value='';$('#qClear').hidden=true;applyView(keep());$('#q').focus();};
// zakres wyszukiwania: ten folder, z podfolderami albo cała biblioteka (wszystkie ulubione foldery, z indeksu)
if(!S.qIn) S.qIn=S.qAll?'deep':'here';
if(S.qIn==='lib'&&!api.libSearch) S.qIn='here';
const QIN={here:['tu','W tym folderze'],deep:['podfoldery','Z podfolderami'],lib:['biblioteka','W całej bibliotece (ulubione)']};
function markScope(){const b=$('#qScope');press(b,S.qIn!=='here');b.textContent=QIN[S.qIn][0];b.title='Szukam: '+QIN[S.qIn][1].toLowerCase()+' — kliknij, żeby zmienić';
  $('#q').placeholder=S.qIn==='lib'?'Szukaj w bibliotece':'Szukaj';}
function setQIn(v){if(v==='lib')hintDone('lib');if(S.qIn===v)return;S.qIn=v;save();markScope();if($('#q').value)applyView(keep());}
function scopeMenu(){
  const r=$('#qScope').getBoundingClientRect();
  showMenu(r.left-8,r.bottom+6,'Szukaj',[
    {label:QIN.here[1],check:S.qIn==='here',run:()=>{setQIn('here');$('#q').focus();}},
    {label:QIN.deep[1],check:S.qIn==='deep',run:()=>{setQIn('deep');$('#q').focus();}},
    ...(api.libSearch?[{label:QIN.lib[1],check:S.qIn==='lib',keys:[MOD.replace('+',''),'⇧','F'],run:()=>{setQIn('lib');$('#q').focus();}},
      {label:libLine(),dim:true,run:()=>{}}]:[])]);
  ctx.dataset.of='scope';
}
$('#qScope').onclick=e=>{e.preventDefault();e.stopPropagation();ctx.hidden||ctx.dataset.of!=='scope'?scopeMenu():hideMenu();};
markScope();

/* --- indeks biblioteki: proces główny pamięta nazwy plików ze wszystkich ulubionych folderów --- */
let libSt=null;
const libLine=()=>!S.favs.length?'Biblioteka to foldery z Ulubionych':!libSt?'Indeks…':libSt.busy?'Indeksuję… '+(libSt.files+libSt.found).toLocaleString('pl')+' plików':
  libSt.files.toLocaleString('pl')+' '+plural(libSt.files,'plik','pliki','plików')+' w '+libSt.roots+' '+plural(libSt.roots,'folderze','folderach','folderach');
async function libSync(force){ if(!api.libRoots) return; libSt=await api.libRoots(S.favs.map(f=>f.path),EXTS,!!force); }
if(api.onLibStatus) api.onLibStatus(s=>{ const was=libSt&&libSt.busy; libSt=s; if(libActive()&&(was&&!s.busy)) applyView(keep()); else if(libActive()) libNote(); });
addEventListener('focus',()=>libSync());
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
  if(!(await askConfirm('Wyczyścić miniatury?','Zapamiętane miniatury zostaną usunięte i policzą się od nowa przy następnym otwarciu folderów.','Wyczyść'))) return;
  await api.cacheClear();
  for(const it of items){it.thumb=null;it.state=null;it._tp=null;}
  for(const d of dirs) resetDir(d);
  render(); prefetch(); cacheInfo();
}
let curIcon='3d'; if(api.iconGet) api.iconGet().then(v=>curIcon=v);
/* --- zużycie pamięci RAM przez wszystkie procesy Gapy (włączane w ustawieniach) --- */
let memT=0;
async function memTick(){ if(!S.showMem||!api.mem) return; const m=await api.mem(); $('#mem').textContent='RAM '+fmtSize(m.total*1024); $('#mem').title='Pamięć RAM wszystkich procesów Gapy: '+fmtSize(m.total*1024)+' (okna: '+fmtSize(m.renderer*1024)+')'; }
function setShowMem(v){ S.showMem=v; save(); $('#mem').hidden=!v; clearInterval(memT); if(v){ memTick(); memT=setInterval(memTick,2000); } }
function settingsMenu(){
  const r=$('#setBtn').getBoundingClientRect(), t=S.theme||'auto', lim=cacheC?cacheC.limitMB:2048;
  const LIM=[[1024,'1 GB'],[2048,'2 GB'],[5120,'5 GB'],[10240,'10 GB']];
  showMenu(r.left-4,r.top-8,'Motyw',[
    {label:'Automatyczny',check:t==='auto',run:()=>setTheme('auto')},
    {label:'Jasny',check:t==='light',run:()=>setTheme('light')},
    {label:'Ciemny',check:t==='dark',keys:['T'],run:()=>setTheme('dark')},
    '-',
    {label:'Nazwy plików',box:S.names!==false,keys:['N'],keep:true,run:()=>{setNames(!(S.names!==false));settingsMenu();}},
    {label:'Siatka między miniaturami',box:!!S.gridlines,keys:['G'],keep:true,run:()=>{setGridLines(!S.gridlines);settingsMenu();}},
    {label:'Nazwy folderów',box:S.dirNames!==false,keys:['⇧','N'],keep:true,run:()=>{setDirNames(!(S.dirNames!==false));settingsMenu();}},
    {label:'Ukryj interfejs',keys:['Tab'],run:toggleBare},
    {label:'Skróty klawiszowe',keys:['?'],run:()=>toggleKeys(true)},
    ...(peekState&&peekState.available?[{label:'Podgląd spacją w Eksploratorze',box:!!peekState.peek,keep:true,run:async()=>{ peekState.peek=!peekState.peek; await api.peekSet(peekState.peek); if(peekState.peek) zoomTip('Zaznacz plik w Eksploratorze i naciśnij spację'); settingsMenu(); }},
      ...(peekState.peek?[{label:'Uruchamiaj razem z Windows',box:!!peekState.autostart,keep:true,run:async()=>{ peekState.autostart=!peekState.autostart; await api.autostartSet(peekState.autostart); settingsMenu(); }}]:[])]:[]),
    ...(api.mem?[{label:'Pokaż zużycie pamięci',box:!!S.showMem,keep:true,run:()=>{setShowMem(!S.showMem);settingsMenu();}}]:[]),
    {label:'Pokaż podpowiedzi od nowa',run:resetHints},
    {label:'Dźwięki',box:S.sound!==false,keys:['S'],keep:true,run:()=>{S.sound=!(S.sound!==false);save();if(S.sound)SFX('on');settingsMenu();}},
    ...(api.iconSet?['-',{head:'Ikona programu'},
      {label:'Gałka 3D',check:curIcon!=='retro',run:async()=>{curIcon=await api.iconSet('3d');}},
      {label:'Gałka 1-bit',check:curIcon==='retro',run:async()=>{curIcon=await api.iconSet('retro');}}]:[]),
    ...(api.libSearch?['-',{head:'Wyszukiwanie w bibliotece'},{label:libLine(),dim:true,run:()=>{}},
      {label:'Odśwież indeks',run:()=>{libSync(true);zoomTip('Odświeżam indeks biblioteki…');}}]:[]),
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
const STAR='<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="m7 1.8 1.6 3.3 3.6.5-2.6 2.5.6 3.6L7 10l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z"/></svg>';
function favBtn(cls,p){
  const b=document.createElement('button'); b.className=cls; b.innerHTML=STAR;
  const sync=()=>{const on=!!findFav(p);b.classList.toggle('on',on);b.querySelector('path').setAttribute('fill',on?'currentColor':'none');b.title=on?'Usuń z ulubionych':'Dodaj do ulubionych';b.setAttribute('aria-label',b.title);};
  b.onclick=e=>{e.stopPropagation();toggleFav(p);sync();for(const t of document.querySelectorAll('.tile.dir'))t._sync&&t._sync();};
  b.ondblclick=e=>e.stopPropagation(); sync(); b._sync=sync; return b;
}
function toggleFav(p){hintDone('fav');
  p=p||curPath; if(!p) return;
  const f=findFav(p);
  if(f) S.favs=S.favs.filter(x=>x!==f); else S.favs.push({name:api.basename(p)||p,path:p});
  SFX(f?'off':'on');
  save(); renderSide(); libSync();
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
// widok bez folderu: „basket” — Koszyk; wyniki z całej biblioteki pokazujemy, gdy jest zapytanie i zakres „biblioteka”
let virt=null;
const libActive=()=>!virt&&S.qIn==='lib'&&!!api.libSearch&&!!$('#q').value.trim();
const matchQ=(s,q)=>q.split(/\s+/).every(t=>s.includes(t));

/* --- Koszyk: podręczna kolekcja plików z różnych folderów; pliki zostają na swoich miejscach --- */
S.basket=Array.isArray(S.basket)?S.basket:[];
const bKey=p=>isMac?p:p.toLowerCase();
let bSet=new Set(S.basket.map(b=>bKey(b.path)));
const bItems=new Map();                       // ścieżka → obiekt pliku (z miniaturą, jeśli już była policzona)
const inBasket=p=>bSet.has(bKey(p));
function basketAdd(list){
  let n=0;
  for(const it of list){ if(!it||it.kind!=='file'||inBasket(it.path)) continue;
    S.basket.push({path:it.path,name:it.name,size:it.size,mtime:it.mtime}); bSet.add(bKey(it.path)); bItems.set(it.path,it); n++; }
  if(n){ save(); basketChanged(); } return n;
}
function basketRemove(list){
  const out=new Set(list.map(x=>bKey(x.path||x)));
  const before=S.basket.length; S.basket=S.basket.filter(b=>!out.has(bKey(b.path)));
  bSet=new Set(S.basket.map(b=>bKey(b.path)));
  const n=before-S.basket.length; if(n){ save(); basketChanged(); } return n;
}
function basketToggle(list){
  const fs=list.filter(x=>x&&x.kind==='file'); if(!fs.length) return;
  SFX('tick');
  if(fs.every(x=>inBasket(x.path))){ const n=basketRemove(fs); zoomTip((n===1?'Wyjęto z koszyka':'Wyjęto z koszyka: '+n)+' · zostało '+S.basket.length); }
  else { hintDone('basket'); const n=basketAdd(fs); zoomTip((n===1?'W koszyku':'Dodano do koszyka: '+n)+' · razem '+S.basket.length); }
}
function basketChanged(){
  renderBasketNav();
  for(const it of view) if(it.tile) it.tile.classList.toggle('inb',virt!=='basket'&&it.kind==='file'&&inBasket(it.path));
  if(virt==='basket'){
    if(viewer.classList.contains('open')){ vList=vList.filter(x=>inBasket(x.path)); if(!vList.length) closeViewer(); else { vi=Math.min(vi,vList.length-1); showV(); } }
    applyView(keep());
  }
  if(S.insp) renderInsp();
}
function renderBasketNav(){
  const t=$('#tray'); if(!t) return;
  $('#bCount').textContent=S.basket.length||'';
  t.classList.toggle('on',virt==='basket');
  const box=$('#bThumbs'); box.textContent='';
  if(!S.basket.length){ box.innerHTML='<div class="empty">Przeciągnij tu zdjęcia albo naciśnij B</div>'; return; }
  // ostatnio dodane, najnowsze pierwsze
  for(const b of S.basket.slice(-5).reverse()){
    const it=fileObj(bItems,b), c=document.createElement('canvas'); c.width=c.height=72; c.title=b.name; box.appendChild(c);
    const draw=()=>{ const src=it.thumb; if(!src) return; const g=c.getContext('2d'), k=Math.max(72/src.width,72/src.height), w=src.width*k, h=src.height*k; g.drawImage(src,(72-w)/2,(72-h)/2,w,h); };
    if(it.thumb) draw(); else thumbOf(it).then(()=>{ it.state='done'; draw(); },()=>{});
  }
}
async function openBasket(){
  if(virt==='basket') return;
  record({basket:true}); SFX('tok'); virt='basket'; deep=false; markDeep(); $('#q').value=''; $('#qClear').hidden=true;
  gen++; renderBasketNav(); renderSide(); renderTree(); renderCrumbs(); renderTypes(); applyView(null); main.scrollTop=0; prefetch();
  // pliki mogły się zmienić albo zniknąć od czasu dodania — sprawdź raz przy wejściu
  if(api.statFiles&&S.basket.length){
    const st=await api.statFiles(S.basket.map(b=>b.path)); if(virt!=='basket') return;
    let ch=false;
    S.basket.forEach((b,k)=>{ const s=st[k], it=bItems.get(b.path);
      if(!s){ if(it&&it.state!=='error'){ it.state='error'; it.err='Nie ma już tego pliku pod zapisaną ścieżką (przeniesiony, usunięty albo dysk odłączony).'; ch=true; } return; }
      if(s.size!==b.size||s.mtime!==b.mtime){ b.size=s.size; b.mtime=s.mtime; bItems.delete(b.path); ch=true; } });
    if(ch){ save(); applyView(keep()); prefetch(); }
  }
}
function closeVirt(){ virt=null; if(curPath) record({path:curPath}); renderBasketNav(); renderSide(); renderTree(); renderCrumbs(); renderTypes(); applyView(null); main.scrollTop=0; if(curPath) prefetch(); }
async function copyBasketTo(list){
  if(!api.copyTo){ zoomTip('Kopiowanie działa w programie, nie w przeglądarce'); return; }
  const dir=await api.pickFolder(); if(!dir) return;
  zoomTip('Kopiuję '+list.length+' '+plural(list.length,'plik','pliki','plików')+'…');
  const r=await api.copyTo(list.map(x=>x.path),dir);
  SFX('tick');
  zoomTip(r.failed.length?('Skopiowano '+r.done.length+', nie udało się '+r.failed.length):('Skopiowano '+r.done.length+' do „'+(api.basename(dir)||dir)+'”'));
}
async function basketClear(){
  if(!S.basket.length) return;
  if(!(await askConfirm('Wyczyścić koszyk?','Z koszyka zniknie '+S.basket.length+' '+plural(S.basket.length,'plik','pliki','plików')+'. Pliki na dysku zostają tam, gdzie są.','Wyczyść'))) return;
  S.basket=[]; bSet=new Set(); save(); basketChanged(); zoomTip('Koszyk jest pusty');
}

async function pickFolder(){ const p=await api.pickFolder(); if(p){ if(api.web) await loadRoots(); go(p); } }
/* --- dźwięki interfejsu: krótkie kliki syntezowane na żywo (Web Audio), bez plików; wyciszane w ustawieniach --- */
const SFX=(()=>{
  let ctx=null, last={};
  const ac=()=>{ if(!ctx){ try{ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } if(ctx&&ctx.state==='suspended') ctx.resume(); return ctx; };
  // jeden dźwięk: krótki ton z szybkim wygaszeniem albo trzask szumu przez filtr
  function blip({f=1200,to=null,d=.035,g=.05,type='sine',noise=false,bp=3000,at=0,ft='bandpass',q=1.2,att=.003}){
    const c=ac(); if(!c) return; const t=c.currentTime+at;
    const out=c.createGain(); out.gain.setValueAtTime(0,t); out.gain.linearRampToValueAtTime(g,t+att); out.gain.exponentialRampToValueAtTime(.0001,t+d); out.connect(c.destination);
    if(noise){
      const n=Math.ceil(c.sampleRate*d), buf=c.createBuffer(1,n,c.sampleRate), ch=buf.getChannelData(0);
      for(let i=0;i<n;i++) ch[i]=Math.random()*2-1;
      const src=c.createBufferSource(); src.buffer=buf; const fl=c.createBiquadFilter(); fl.type=ft; fl.frequency.value=bp; fl.Q.value=q;
      src.connect(fl); fl.connect(out); src.start(t); src.stop(t+d);
    }else{
      const o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); if(to) o.frequency.exponentialRampToValueAtTime(to,t+d);
      o.connect(out); o.start(t); o.stop(t+d+.01);
    }
  }
  // z próbnika: S2 (impuls z tonem, wysoki) wszędzie; S8 (pik prostokątny) przy otwieraniu i zamykaniu podglądu
  function impulse(f,q,g){ const c=ac(); if(!c) return; const n=Math.ceil(c.sampleRate*.06), buf=c.createBuffer(1,n,c.sampleRate), ch=buf.getChannelData(0); ch[0]=1; ch[1]=-.6;
    const src=c.createBufferSource(); src.buffer=buf; const fl=c.createBiquadFilter(); fl.type='bandpass'; fl.frequency.value=f; fl.Q.value=q; const out=c.createGain(); out.gain.value=g;
    src.connect(fl); fl.connect(out); out.connect(c.destination); src.start(); }
  function pip(f,d,g,type){ const c=ac(); if(!c) return; const t=c.currentTime, o=c.createOscillator(); o.type=type; o.frequency.value=f;
    const out=c.createGain(); out.gain.setValueAtTime(g,t); out.gain.exponentialRampToValueAtTime(.0001,t+d); o.connect(out); out.connect(c.destination); o.start(t); o.stop(t+d+.005); }
  const s2=()=>impulse(5200,10,.5), s8=()=>pip(3000,.003,.025,'square');
  const SOUNDS={tick:s2,click:s2,tok:s2,on:s2,off:s2,open:s2,close:s2};
  // jedna akcja = jeden dźwięk: drugi dźwięk w ciągu 60 ms (np. otwarcie podglądu + zaznaczenie) jest pomijany
  return name=>{ if(S.sound===false) return; const now=performance.now(); if(now-(last.any||0)<60) return; last.any=now; try{SOUNDS[name]&&SOUNDS[name]();}catch(e){} };
})();
// klik każdego przycisku interfejsu (poza tymi, które mają własny dźwięk)
document.addEventListener('pointerdown',e=>{ const b=e.target.closest('button,.seg button,.sec,#tree li,#favs li,#places li,#tray'); if(b&&!b.closest('.rf,.tf')) SFX('click'); },true);
/* --- historia miejsc: strzałki < > jak w Finderze (folder albo Koszyk) --- */
let hist=[], hi=-1, histNav=false;
const locKey=l=>l.basket?'#koszyk':bKey(l.path);
function record(loc){
  if(histNav) return;
  if(hi>=0&&locKey(hist[hi])===locKey(loc)) return;
  hist=hist.slice(0,hi+1); hist.push(loc); if(hist.length>100) hist.shift(); hi=hist.length-1; markHist();
}
function markHist(){ $('#backBtn').disabled=hi<=0; $('#fwdBtn').disabled=hi>=hist.length-1;
  const nm=l=>l?(l.basket?'Koszyk':(api.basename(l.path)||l.path)):'';
  $('#backBtn').title=hi>0?'Wstecz — '+nm(hist[hi-1])+' ('+(isMac?'⌘[':'Alt+←')+')':'Wstecz';
  $('#fwdBtn').title=hi<hist.length-1?'Dalej — '+nm(hist[hi+1])+' ('+(isMac?'⌘]':'Alt+→')+')':'Dalej'; }
async function histGo(d){
  const k=hi+d; if(k<0||k>=hist.length) return;
  const loc=hist[k], from=virt?null:curPath;
  if(!loc.basket&&!(await api.exists(loc.path))){ zoomTip('Tego folderu już nie ma: '+(api.basename(loc.path)||loc.path)); hist.splice(k,1); if(k<=hi) hi--; markHist(); return; }
  hi=k; histNav=true;
  try{ if(loc.basket) openBasket(); else go(loc.path,from); } finally { histNav=false; }
  markHist();
}
$('#backBtn').onclick=()=>histGo(-1); $('#fwdBtn').onclick=()=>histGo(1);
// boczne przyciski myszy (wstecz / dalej)
addEventListener('mouseup',e=>{ if(e.button===3||e.button===4){ e.preventDefault(); if(!viewer.classList.contains('open')) histGo(e.button===3?-1:1); } });
function go(p,selectPath,inside){ record({path:p}); if(!S.favs.length&&!S.hints.fav&&curPath&&p!==curPath) setTimeout(()=>{ const f=$('#favs'); if(S.side!==false&&f.getBoundingClientRect().width) hint('fav',f,'Gwiazdka przy folderze dodaje go do Ulubionych ('+KL.mod+'D). Ulubione tworzą też bibliotekę do wyszukiwania.','right'); },900); SFX('tok'); if(virt){ virt=null; renderBasketNav(); } curPath=p; S.last=p; save(); deep=!!inside; deepItems=null; deepFor=null; $('#q').value='';$('#qClear').hidden=true; syncSearch(); markDeep(); scan(false,selectPath); }
function setDeep(v){ if(virt){ virt=null; renderBasketNav(); renderSide(); renderCrumbs(); } deep=v; markDeep(); applyView(keep()); main.scrollTop=0; prefetch(); }
function markDeep(){ const c=$('#deepChip'); c.hidden=true; for(const b of $('#scope').children) b.setAttribute('aria-pressed',String(b.dataset.v==='1'===!!deep)); }
for(const b of $('#scope').children) b.onclick=()=>{ if((b.dataset.v==='1')!==!!deep) setDeep(b.dataset.v==='1'); };
async function scan(keepScroll,selectPath){
  if(!curPath) return;
  const tok=++scanTok, prevPath=selectPath||keep(), prevTop=main.scrollTop, here=curPath;
  if(keepScroll){ deepItems=null; deepFor=null; }
  status('Wczytywanie…');
  const r=await api.list(here,EXTS);
  if(tok!==scanTok) return;
  scanInfo={error:r.error||null,other:r.other||[]};
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
api.onDirChanged(d=>{
  if(viewer.classList.contains('open')) return;
  if(samePath(d,curPath)) scan(true);
  else if(curPath&&samePath(api.dirname(d),curPath)){ const dd=dirs.find(x=>samePath(x.path,d)); if(dd){ resetDir(dd); if(dd.tile&&dd.tile.isConnected) loadDir(dd,true); } }
  else if(virt==='basket') applyView(keep());
});
function goUp(){
  if(virt){ closeVirt(); return; }
  if(!curPath) return;
  if(deep&&!$('#q').value){ setDeep(false); return; }
  const p=api.dirname(curPath); if(!p||p===curPath) return;
  const from=curPath; record({path:p}); curPath=p; S.last=p; save(); deep=false; deepItems=null; deepFor=null; markDeep(); scan(false,from);
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
/* --- pole ścieżki --- */
const pathbox=$('#pathbox'), pathIn=$('#pathIn');
function editPath(){
  if(!curPath) return;
  pathbox.classList.add('edit'); $('#crumbs').hidden=true; pathIn.hidden=false;
  pathIn.value=curPath; pathIn.focus(); pathIn.select();
}
function endEditPath(){ pathbox.classList.remove('edit'); $('#crumbs').hidden=false; pathIn.hidden=true; }
async function goPath(raw){
  const r=api.resolvePath?await api.resolvePath(raw):null;
  if(!r){ zoomTip('Nie ma takiego folderu ani pliku'); return false; }
  endEditPath(); go(r.dir, r.file||null); return true;
}
pathbox.addEventListener('click',e=>{ if(e.target.closest('a,#pathCopy,input')) return; editPath(); });
pathIn.addEventListener('keydown',async e=>{
  e.stopPropagation();
  if(e.key==='Enter'){ e.preventDefault(); if(!(await goPath(pathIn.value))) pathIn.select(); }
  else if(e.key==='Escape'){ e.preventDefault(); endEditPath(); }
});
pathIn.addEventListener('blur',()=>setTimeout(()=>{ if(document.activeElement!==pathIn) endEditPath(); },120));
$('#pathCopy').onclick=e=>{ e.stopPropagation(); copyText(curPath); };
// wklejenie ścieżki gdziekolwiek w oknie (poza polami tekstowymi) przenosi do niej
// schowek plików wspólny dla wszystkich okien Gapy; dodatkowo pliki trafiają do schowka systemowego (wklejanie w Eksploratorze / Finderze)
let fileClip=null;
function clipLoad(){ try{ const c=JSON.parse(localStorage.getItem('gapaClip')||'null'); fileClip=c&&c.paths?c:null; }catch(e){ fileClip=null; } return fileClip; }
function clipSave(c){ fileClip=c; try{ if(c) localStorage.setItem('gapaClip',JSON.stringify(c)); else localStorage.removeItem('gapaClip'); }catch(e){} }
document.addEventListener('paste',async e=>{
  if(e.target.closest&&e.target.closest('input,textarea')) return;
  const t=(e.clipboardData&&e.clipboardData.getData('text')||'').trim();
  // pliki skopiowane albo wycięte w Gapie (⌘C / ⌘X, w dowolnym oknie) wklejamy do bieżącego folderu
  clipLoad();
  let src=null;
  if(!t&&api.clipReadFiles){
    // pliki w schowku systemowym: skopiowane w Gapie albo w Eksploratorze / Finderze
    const sys=await api.clipReadFiles();
    if(sys&&sys.length){ const k=new Set(sys.map(bKey)), same=fileClip&&fileClip.paths.length===sys.length&&fileClip.paths.every(p=>k.has(bKey(p))); src={paths:sys,cut:!!(same&&fileClip.cut)}; }
  } else if(fileClip&&t&&t===fileClip.text) src=fileClip;
  if(!src&&!t&&fileClip&&!api.clipReadFiles) src=fileClip;
  if(src){
    e.preventDefault();
    if(!curPath||virt||deep){ zoomTip('Otwórz folder, do którego mają trafić pliki'); return; }
    const c=src, r=await doTransfer(c.paths,{path:curPath,name:api.basename(curPath)||curPath},c.cut?'move':'copy');
    if(c.cut&&r&&r.done.length){ clipSave(null); navigator.clipboard.writeText('').catch(()=>{}); }
    return;
  }
  if(t&&!t.includes('\n')&&/^(["']?)(\/|~|[A-Za-z]:[\\/]|\\\\|file:\/\/)/.test(t)){ e.preventDefault(); goPath(t); }
});
function renderCrumbs(){
  const c=$('#crumbs'); c.textContent='';
  if(virt==='basket'){ const s=document.createElement('span'); s.textContent='Koszyk'; c.appendChild(s); document.title='Koszyk — Gapa'; return; }
  if(!curPath) return;
  const cs=crumbsOf(curPath);
  cs.forEach((x,i)=>{
    if(i){const s=document.createElement('i');s.textContent='/';c.appendChild(s);}
    const el=document.createElement(i===cs.length-1?'span':'a');
    el.textContent=x.name; el.title=x.path; if(i<cs.length-1) el.onclick=()=>go(x.path);
    c.appendChild(el);
  });
  document.title=cs[cs.length-1].name+' — Gapa';
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
    li.append(tw,nm,favBtn('rf',n.path)); if(n===treeCur) li.classList.add('on');
    tw.onclick=async e=>{e.stopPropagation();n.open=!n.open;if(n.open)await kidsOf(n);renderTree();};
    li.onclick=()=>go(n.path);
    if(virt) li.classList.remove('on');
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
    li.lastChild.onclick=e=>{e.stopPropagation();S.favs=S.favs.filter(x=>x!==f);save();renderSide();libSync();};
    if(!virt&&samePath(f.path,curPath)) li.classList.add('on');
    fl.appendChild(li);
  }
  if(!S.favs.length) fl.innerHTML='<li class="none"><span>Gwiazdka przy folderze dodaje go tutaj</span></li>';

}

/* --- widok --- */
function sortFiles(fs){
  const d=S.dir, byName=(a,b)=>coll.compare(a.name,b.name);
  const by={
    name:(a,b)=>byName(a,b)*d,
    date:(a,b)=>(a.mtime-b.mtime)*d||byName(a,b),
    size:(a,b)=>(a.size-b.size)*d||byName(a,b),
    type:(a,b)=>(a.type||'').localeCompare(b.type||'')*d||byName(a,b),
    dims:(a,b)=>((a.dims?a.dims[0]*a.dims[1]:0)-(b.dims?b.dims[0]*b.dims[1]:0))*d||byName(a,b)
  }[S.sort];
  return fs.sort(by);
}
// pliki pogrupowane nagłówkami folderów; head(klucz, pierwszy plik) → {label, target}
function setGrouped(fs,keyOf,order,head){
  const g=new Map(); for(const it of fs){ const k=keyOf(it); if(!g.has(k)) g.set(k,[]); g.get(k).push(it); }
  view=[]; heads=new Map();
  for(const k of [...g.keys()].sort(order)){ const list=g.get(k); heads.set(view.length,Object.assign({count:list.length},head(k,list[0]))); view.push(...list); }
}
function finishView(keepPath){
  sel=keepPath?view.findIndex(it=>samePath(it.path,keepPath)):-1; anchor=sel;
  picked=new Set(sel>=0?[view[sel]]:[]);
  render();
}
// obiekt pliku do widoku spoza folderu; ten sam obiekt wraca przy kolejnych wyszukiwaniach, więc miniatura zostaje
function fileObj(cache,f){
  let it=cache.get(f.path);
  if(!it||it.size!==f.size||it.mtime!==f.mtime){ it={kind:'file',name:f.name,path:f.path,size:f.size,mtime:f.mtime,type:EXT[extOf(f.name)],state:null}; cache.set(f.path,it); }
  if(it.state==='queued'&&it.gen!==gen) it.state=null;
  it.gen=gen; return it;
}
function applyView(keepPath){
  const q=norm($('#q').value.trim());
  if(virt==='basket') return basketView(q,keepPath);
  if(libActive()) return libView(q,keepPath);
  libInfo=null;
  const isDeep=deep||(S.qIn==='deep'&&!!q);
  if(isDeep&&!(deepFor===curPath&&deepItems)){
    loadDeep().then(ok=>{ if(ok){ applyView(keepPath); prefetch(); } });
    if(!view.length) status('Wczytywanie podfolderów…');
    return;
  }
  heads=null;
  const ds=isDeep?[]:dirs.filter(d=>!q||matchQ(norm(d.name),q));
  const fs=sortFiles((isDeep?deepItems:items).filter(it=>on(it.type)&&(!q||matchQ(norm(isDeep?(it.rel+'/'+it.name):it.name),q))));
  if(S.sort==='name'&&S.dir<0) ds.reverse();
  if(isDeep){ // grupy według podfolderów, najpierw sam folder
    const base=curPath.replace(/[\\/]+$/,'');
    setGrouped(fs,it=>it.rel,(a,b)=>a===''?-1:b===''?1:coll.compare(a,b),
      k=>({rel:k,label:k?k.split(/[\\/]/).join(' / '):(api.basename(curPath)||curPath),target:k?base+SEP+k:curPath}));
  } else view=[...ds,...fs];
  finishView(keepPath);
}
// wyniki z indeksu biblioteki
let libTok=0, libInfo=null; const libItems=new Map();
async function libView(q,keepPath){
  const tok=++libTok;
  const names={}; for(const f of S.favs) names[f.path]=f.name;
  const r=await api.libSearch(q,EXTS.filter(x=>on(EXT[x])),names);
  if(tok!==libTok||!libActive()) return;
  libInfo=r; libSt=r.st;
  if(libItems.size>6000) libItems.clear();
  const fs=sortFiles(r.files.map(f=>{ const it=fileObj(libItems,f); it.rel=f.label; it.dir=f.dir; return it; }));
  setGrouped(fs,it=>it.dir,(a,b)=>0,(k,first)=>({label:first.rel,target:k}));
  // kolejność grup: alfabetycznie po etykiecie (ulubiony folder / podfolder)
  const groups=[]; heads.forEach((h,i)=>groups.push({h,list:view.slice(i,i+h.count)}));
  groups.sort((a,b)=>coll.compare(a.h.label,b.h.label));
  view=[]; heads=new Map(); for(const g of groups){ heads.set(view.length,g.h); view.push(...g.list); }
  finishView(keepPath); prefetch();
}
function basketView(q,keepPath){
  libInfo=null;
  const fs=sortFiles(S.basket.map(b=>fileObj(bItems,b)).filter(it=>on(it.type)&&(!q||matchQ(norm(it.name),q))));
  setGrouped(fs,it=>api.dirname(it.path),(a,b)=>coll.compare(api.basename(a),api.basename(b))||coll.compare(a,b),
    k=>({label:crumbsOf(k).filter(x=>x.name).slice(-2).map(x=>x.name).join(' / '),target:k}));
  finishView(keepPath);
}
const io=new IntersectionObserver(es=>{for(const e of es){const it=e.target._it;if(!it)continue;it.visible=e.isIntersecting;
  if(!it.visible)continue; if(it.kind==='dir')loadDir(it,true); else { enqueue(it,true); if(it.thumb) wantHD(it); } }},{root:main,rootMargin:'600px'});

/* --- ostre miniatury dla dużych kafelków: zwykła miniatura ma 480 px; gdy komórka jest większa,
       widoczne pliki dostają wersję w rozdzielczości komórki (do 2048 px), trzymaną tylko w pamięci --- */
const hdQ=[]; let hdRun=0; const hdLRU=new Set(); let hdPx=0; const HD_PX=160e6;
function hdNeed(it){
  const box=it.tile&&it.tile.firstChild; if(!box||it.tile.tagName==='TR') return 0;
  const w=box.clientWidth*devicePixelRatio, h=box.clientHeight*devicePixelRatio; if(!w) return 0;
  const a=it.dims?it.dims[0]/it.dims[1]:(it.thumb?it.thumb.width/it.thumb.height:4/3);
  const need=Math.min(2048,Math.ceil(Math.max(Math.min(w,h*a),Math.min(h,w/a))/128)*128);   // dłuższy bok obrazu w komórce
  const base=it.thumb?Math.max(it.thumb.width,it.thumb.height):TH;
  if(need<=base*1.1) return 0;
  if(it.dims&&Math.max(it.dims[0],it.dims[1])<=base*1.05) return 0;       // oryginał nie jest większy od miniatury
  return need;
}
var hdT=0;
function wantHD(it){
  if(it.kind!=='file'||it.type==='vid'||DOCS.has(it.type)||it.state!=='done'||!it.visible) return;
  const need=hdNeed(it); if(!need) return;
  if(it.hd&&it.hd.size>=need*0.9) return;
  if(it.hdBusy||it.hdFail) return;
  if(!hdQ.includes(it)) hdQ.push(it); hdPump();
}
function hdAll(){ clearTimeout(hdT); hdT=setTimeout(()=>{ for(const it of view) if(it.visible&&it.thumb) wantHD(it); },250); }
function hdPump(){
  while(hdRun<2&&hdQ.length){
    const it=hdQ.shift(); if(!it.visible||!it.tile||!it.tile.isConnected) continue;
    const need=hdNeed(it); if(!need) continue;
    hdRun++; it.hdBusy=true;
    hdMake(it,need).then(c=>{
      if(!c) return;
      if(it.hd){ hdPx-=it.hd.c.width*it.hd.c.height; hdLRU.delete(it); }
      it.hd={c,size:need}; hdPx+=c.width*c.height; hdLRU.add(it);
      for(const x of hdLRU){ if(hdPx<=HD_PX) break; if(x.visible&&x!==it) continue; hdPx-=x.hd.c.width*x.hd.c.height; x.hd=null; hdLRU.delete(x); if(x.tile&&x.tile.isConnected) paint(x); }
      if(it.tile&&it.tile.isConnected) paint(it);
    },()=>{ it.hdFail=true; }).finally(()=>{ it.hdBusy=false; hdRun--; hdPump(); });
  }
}
async function hdMake(it,max){
  let bmp;
  if(it.type==='svg'){ const im=await loadImg(api.fileUrl(it.path)); const w=im.naturalWidth||1024,h=im.naturalHeight||1024,k=max/Math.max(w,h);
    const c=new OffscreenCanvas(Math.round(w*k),Math.round(h*k)); c.getContext('2d').drawImage(im,0,0,c.width,c.height); bmp=c.transferToImageBitmap(); }
  else if(NATIVE.has(it.type)) bmp=await createImageBitmap(await blobOf(it));
  else { const r=await decode(ref(it),it.type,max); bmp=await toBitmap(r); }
  const s=Math.min(1,max/Math.max(bmp.width,bmp.height)), w=Math.max(1,Math.round(bmp.width*s)), h=Math.max(1,Math.round(bmp.height*s));
  if(Math.max(w,h)<=Math.max(it.thumb.width,it.thumb.height)*1.05){ bmp.close(); return null; }
  const small=s<1?await createImageBitmap(bmp,{resizeWidth:w,resizeHeight:h,resizeQuality:'high'}):bmp;
  let c; if(OPAQUE.has(it.type)){ c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(small,0,0); }
  else c=paintOn(small,w,h,Math.max(4,Math.round(Math.max(w,h)/48)));
  if(small!==bmp) small.close(); bmp.close();
  return c;
}

let scanInfo={error:null,other:[]};
const hiddenByType=()=>!deep&&items.length>0&&!items.some(it=>on(it.type));
// pusty widok mówi, dlaczego jest pusty: błąd odczytu, filtr typów albo pliki w formatach, których Gapa nie pokazuje
function emptyText(){
  if(scanInfo.error) return 'Nie udało się odczytać folderu: '+scanInfo.error+'.';
  if(hiddenByType()) return 'Obrazy tu są ('+items.length+'), ale ukrywa je filtr typów.';
  const o=scanInfo.other; if(o.length){ const n=o.reduce((s,x)=>s+x[1],0); return 'W tym folderze jest '+n+' '+plural(n,'plik','pliki','plików')+', ale w formatach, których Gapa nie pokazuje: '+o.slice(0,6).map(x=>'.'+x[0]).join(', ')+(o.length>6?'…':'')+'.'; }
  return 'W tym folderze nie ma obrazów.';
}
function render(){
  io.disconnect(); grid.textContent=''; grid.className=S.mode==='list'?'list':'icons';
  if(S.mode==='list') renderList(); else renderIcons();
  const lib=libActive(), has=!!(curPath||virt||lib), q=$('#q').value;
  $('#empty').style.display=has?'none':'';
  if(virt==='basket'&&S.basket.length) grid.prepend(basketBar());
  if(lib) grid.prepend(libBar());
  const folderEmpty=!virt&&!lib&&(!view.length||(!q&&hiddenByType()));
  if(has&&(folderEmpty||((virt||lib)&&!view.length))){
    const p=document.createElement('p');p.className='ph';p.style.cssText='font-size:13px;margin:4px;text-transform:none;letter-spacing:0;grid-column:1/-1;max-width:640px;line-height:1.55';
    if(virt==='basket'&&!q&&!S.basket.length){ const d=document.createElement('div'); d.className='bempty'; d.innerHTML='<svg width="30" height="30" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M2.3 6.5h11.4l-1.25 6.2a1.3 1.3 0 0 1-1.27 1H4.82a1.3 1.3 0 0 1-1.27-1z"/><path d="M5.6 6.5 7.6 2.6M10.4 6.5 8.4 2.6"/></svg><b>Koszyk jest pusty</b><p>Zaznacz zdjęcia w dowolnym folderze i naciśnij B albo przeciągnij je na koszyk w panelu bocznym. Pliki zostają na swoich miejscach — koszyk tylko je zbiera, żeby potem przeciągnąć całość do Photoshopa albo Maxa albo skopiować do folderu projektu.</p>'; grid.appendChild(d); status(); return; }
    p.textContent=virt==='basket'?'Nic w koszyku nie pasuje do „'+q+'”.'
      :lib?(!S.favs.length?'Biblioteka to foldery z Ulubionych. Dodaj gwiazdką foldery z obrazami, a Gapa zapamięta nazwy plików w nich i we wszystkich podfolderach.'
        :!libInfo?'Szukam…':libSt&&libSt.busy?'Nic jeszcze nie pasuje do „'+q+'” — indeksuję bibliotekę, wyniki dojdą same.':'Nic w bibliotece nie pasuje do „'+q+'”.')
      :q?'Nic nie pasuje do „'+q+'”.':emptyText();
    grid.appendChild(p);
    if(folderEmpty&&!q&&hiddenByType()){const bt=document.createElement('button');bt.className='ok-show';bt.style.gridColumn='1/-1';bt.style.justifySelf='start';bt.textContent='Pokaż wszystkie typy';bt.onclick=()=>{S.types={};save();renderTypes();applyView(keep());};grid.appendChild(bt);}
  }
  status();
}
// pasek nad wynikami z biblioteki: ile znaleziono i co obejmuje indeks
function libBar(){
  const bar=document.createElement('div'); bar.className='vbar'; bar.id='libBar';
  bar.innerHTML='<span class="t"></span><span class="gap"></span><button class="lk">Odśwież indeks</button>';
  bar.querySelector('.lk').onclick=()=>{libSync(true);zoomTip('Odświeżam indeks biblioteki…');};
  libNote(bar); return bar;
}
function libNote(bar){
  bar=bar||$('#libBar'); if(!bar) return;
  const r=libInfo, n=r?r.files.length:0, a=[];
  if(r&&n){ a.push(n.toLocaleString('pl')+' '+plural(n,'wynik','wyniki','wyników')+(heads&&heads.size>1?' w '+heads.size+' folderach':''));
    if(r.total>n) a.push('pokazuję pierwsze '+n.toLocaleString('pl')+' z '+r.total.toLocaleString('pl')+' — dopisz słowo, żeby zawęzić'); }
  if(S.favs.length) a.push('biblioteka: '+libLine());
  bar.querySelector('.t').textContent=a.join('  ·  ');
}
// pasek koszyka: przeciągnięcie wszystkiego naraz, kopiowanie do folderu projektu, opróżnienie
const DRAG_ICO='<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11"/></svg>';
function basketBar(){
  const bar=document.createElement('div'); bar.className='vbar';
  const all=S.basket, size=all.reduce((s,b)=>s+(b.size||0),0);
  bar.innerHTML='<span class="t"></span><span class="gap"></span>'
    +(api.web?'':'<button class="bb drag" draggable="true" title="Złap i przeciągnij do Photoshopa, Maxa, Findera albo Eksploratora">'+DRAG_ICO+'<span>Przeciągnij wszystkie</span></button>'
    +'<button class="bb copy">Kopiuj do folderu…</button>')
    +'<button class="bb clear">Wyczyść</button>';
  bar.querySelector('.t').textContent=all.length+' '+plural(all.length,'plik','pliki','plików')+'  ·  '+fmtSize(size);
  const dr=bar.querySelector('.drag');
  if(dr){ dr.ondragstart=e=>{e.preventDefault();draggingOut=true;lastOut=S.basket.map(b=>b.path);dragCopy=true;api.dragOut(lastOut,dragImage(S.basket.map(b=>bItems.get(b.path))),true);};
    dr.onclick=()=>zoomTip('Złap ten przycisk i przeciągnij do innego programu'); }
  const cp=bar.querySelector('.copy'); if(cp) cp.onclick=()=>copyBasketTo(S.basket);
  bar.querySelector('.clear').onclick=basketClear;
  return bar;
}
function renderIcons(){
  const frag=document.createDocumentFragment();
  view.forEach((it,i)=>{
    if(heads&&heads.has(i)) frag.appendChild(groupHead(heads.get(i),'div'));
    const t=document.createElement('div'); t.className='tile'+(it.kind==='dir'?' dir':'')+(picked.has(it)?' sel':'')+(virt!=='basket'&&it.kind==='file'&&inBasket(it.path)?' inb':''); t.dataset.i=i; t._it=it;
    if(it.kind==='file') t.draggable=true;
    t.innerHTML='<div class="box"></div><div><span class="nm"></span><div class="sub"></div></div>';
    t.querySelector('.nm').textContent=it.kind==='dir'?it.name+'/':it.name;
    t.querySelector('.sub').textContent=it.kind==='dir'?dirSub(it):'';
    if(it.kind==='dir'){const fb=favBtn('tf',it.path);t.appendChild(fb);t._sync=fb._sync;}
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
    const r=document.createElement('tr'); r.dataset.i=i; r._it=it; if(picked.has(it)) r.className='sel'; if(virt!=='basket'&&it.kind==='file'&&inBasket(it.path)) r.classList.add('inb');
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
  const b=document.createElement('b'); b.textContent=g.label;
  b.title='Otwórz ten folder'; b.onclick=()=>go(g.target);
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
  if(it.thumb){const c=(it.hd&&it.hd.c)||it.thumb; c.className=c.width/c.height>=4/3?'w':'h'; box.appendChild(c); wantHD(it);if(it.type==='vid'){const d=document.createElement('span');d.className='dur';d.innerHTML='<svg width="7" height="8" viewBox="0 0 7 8" aria-hidden="true"><path d="M0 0v8l7-4z" fill="currentColor"/></svg>';d.append(it.meta&&it.meta.mode||'');box.appendChild(d);}return;}
  const s=document.createElement('span'); s.className='ph';
  s.textContent=extOf(it.name);
  if(it.state==='error'){const w=document.createElement('span');w.className='why';w.textContent=' · brak podglądu';s.appendChild(w);}
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
const FOLDERS_ICO_S='<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="M3 4.6a.9.9 0 0 1 .9-.9h1.8l.8 1h3a.9.9 0 0 1 .9.9v3.6a.9.9 0 0 1-.9.9H3.9a.9.9 0 0 1-.9-.9z"/><path d="M1.4 7.6V3.3a.9.9 0 0 1 .9-.9h1.6"/></svg>';
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
  if(d.count||(d.deep&&d.sub)){const c=document.createElement('span');c.className='chip';
    if(d.count){c.innerHTML=FOLDER_ICO_S;c.appendChild(document.createTextNode(d.count));}
    else{c.innerHTML=FOLDERS_ICO_S;c.appendChild(document.createTextNode(d.sub));const l=document.createElement('span');l.className='lbl';l.textContent=' '+plural(d.sub,'folder','foldery','folderów');c.appendChild(l);c.title=d.sub+' '+plural(d.sub,'podfolder','podfoldery','podfolderów');}
    box.appendChild(c);}
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
  if(!S.hints.skim) hint('skim',box,'Przesuń kursor w poziomie po folderze, żeby przejrzeć, co jest w środku.');
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
  SFX('tick');
  if(!view.length) return;
  i=Math.max(0,Math.min(view.length-1,i)); const it=view[i];
  if(how==='toggle'){picked.has(it)?picked.delete(it):picked.add(it);anchor=i;}
  else if(how==='range'&&anchor>=0){picked=new Set(view.slice(Math.min(anchor,i),Math.max(anchor,i)+1));}
  else{picked=new Set([it]);anchor=i;}
  sel=i; markSel(); if(it.tile) it.tile.scrollIntoView({block:'nearest'}); status();
  if(picked.size>1&&!S.hints.basket&&virt!=='basket'){ const r=$('#bRow'); hint('basket',S.side!==false&&r.getBoundingClientRect().width?r:it.tile,'<kbd>B</kbd> wrzuca zaznaczone do koszyka — zbiór plików z różnych folderów. <kbd>⇧B</kbd> go otwiera.',S.side!==false&&r.getBoundingClientRect().width?'right':undefined); }
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
let draggingOut=false, lastOut=[], lastOutItems=[];
grid.addEventListener('dragstart',e=>{
  const t=e.target.closest('[data-i]'); if(!t) return;
  const it=view[+t.dataset.i]; if(!it||it.kind!=='file') return;
  e.preventDefault();
  if(!picked.has(it)) select(+t.dataset.i);
  draggingOut=true; dragT=performance.now(); if(virt!=='basket') document.body.classList.add('dragout'); lastOutItems=pickedFiles(it); lastOut=lastOutItems.map(x=>x.path); dragCopy=virt==='basket'; api.dragOut(lastOut,dragImage(lastOutItems),dragCopy);
});
let dragT=0;
// obraz pod kursorem przy przeciąganiu: miniatury (do trzech, ułożone w stos) i liczba plików
function dragImage(list){
  const th=list.filter(x=>x&&x.thumb).slice(0,3); if(!th.length) return null;
  const W=150, R=2, c=document.createElement('canvas'); c.width=c.height=W*R; const g=c.getContext('2d'); g.scale(R,R);
  const n=th.length;
  for(let i=n-1;i>=0;i--){
    const s=th[i].thumb, m=112, k=Math.min(m/s.width,m/s.height), w=s.width*k, h=s.height*k;
    const x=(W-w)/2+i*7-(n-1)*3.5, y=(W-h)/2-i*7+(n-1)*3.5;
    g.save(); g.shadowColor='rgba(0,0,0,.28)'; g.shadowBlur=10; g.shadowOffsetY=3;
    g.beginPath(); g.roundRect(x,y,w,h,6); g.fillStyle='#fff'; g.fill(); g.restore();
    g.save(); g.beginPath(); g.roundRect(x,y,w,h,6); g.clip(); g.drawImage(s,x,y,w,h); g.restore();
  }
  if(list.length>1){ const t=String(list.length); g.font='600 12px -apple-system,Segoe UI,sans-serif'; const bw=Math.max(22,g.measureText(t).width+12);
    g.fillStyle='#1a1a19'; g.beginPath(); g.roundRect(W-bw-6,8,bw,22,11); g.fill(); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,W-6-bw/2,19.5); }
  return c.toDataURL('image/png');
}
const dragDone=()=>{draggingOut=false;document.body.classList.remove('dragout');$('#bdrop').classList.remove('over');};
addEventListener('pointermove',()=>{ if(draggingOut&&performance.now()-dragT>400) dragDone(); });
addEventListener('keydown',e=>{ if(e.key==='Escape'&&draggingOut) dragDone(); });

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
async function loadPdfjs(){
  if(!pdfjsTried){ pdfjsTried=true; try{ pdfjs=await import('../node_modules/pdfjs-dist/build/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc='../node_modules/pdfjs-dist/build/pdf.worker.min.mjs'; }catch(e){ pdfjs=null; } }
  return pdfjs;
}
// przeglądarka PDF: strony jedna pod drugą, rysowane dopiero, gdy wjeżdżają w widok.
// Przybliżanie (Ctrl/⌘ + kółko, szczypanie, + −, klik w stronę) przerysowuje widoczne strony w wyższej rozdzielczości,
// więc drobny tekst na planszach zostaje ostry. Z lewej opcjonalny pasek miniatur stron.
async function pdfViewer(it){
  const data=new Uint8Array(await (await blobOf(it)).arrayBuffer());
  const doc=await pdfjs.getDocument({data,isEvalSupported:false}).promise;
  it.pages=doc.numPages;
  const wrap=document.createElement('div'); wrap.className='pdfwrap'; wrap.isDoc=true; wrap._doc=doc;
  const side=document.createElement('div'); side.className='pdfside'; wrap.appendChild(side);
  const el=document.createElement('div'); el.className='pdfdoc'; el.tabIndex=-1; wrap.appendChild(el);
  if(S.pdfSide&&doc.numPages>1) wrap.classList.add('side');
  const pages=[], thumbs=[], N=Math.min(doc.numPages,200);
  let z=1, base=920, pw1=0;   // z — przybliżenie względem „dopasuj do szerokości”; pw1 — szerokość pierwszej strony w punktach PDF
  const MAXPX=8000;
  async function draw(box){
    const target=Math.min(MAXPX,Math.round(box.clientWidth*devicePixelRatio));
    if(box._rw&&box._rw>=target*0.92&&box._rw<=target*1.6) return;
    if(box._task){ try{box._task.cancel();}catch(e){} box._task=null; }
    const page=await doc.getPage(box._n), v1=page.getViewport({scale:1}), vp=page.getViewport({scale:target/v1.width});
    const c=document.createElement('canvas'); c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
    const task=page.render({canvasContext:c.getContext('2d'),viewport:vp}); box._task=task;
    try{ await task.promise; }catch(e){ return; }
    if(box._task!==task) return; box._task=null;
    box.textContent=''; box.appendChild(c); box._rw=c.width;
  }
  const vis=new Set();
  const io=new IntersectionObserver(es=>{for(const e of es){
    if(e.isIntersecting){ vis.add(e.target); draw(e.target); }
    else { vis.delete(e.target); const b=e.target; if(b._rw>2400){ if(b._task){try{b._task.cancel();}catch(_){}} b._task=null; b.textContent=''; b._rw=0; } }   // duże bitmapy daleko poza widokiem zwalniamy
  }},{root:el,rootMargin:'600px 600px'});
  for(let n=1;n<=N;n++){
    const p=await doc.getPage(n), v1=p.getViewport({scale:1});
    if(n===1) pw1=v1.width;
    const box=document.createElement('div'); box.className='pg'; box._n=n; box.style.aspectRatio=v1.width+' / '+v1.height;
    el.appendChild(box); pages.push(box); io.observe(box);
    if(doc.numPages>1){
      const t=document.createElement('button'); t.className='pt'; t._n=n; t.title='Strona '+n;
      const f=document.createElement('div'); f.className='pf'; f.style.aspectRatio=v1.width+' / '+v1.height; t.appendChild(f);
      const l=document.createElement('span'); l.textContent=n; t.appendChild(l);
      t.onclick=e=>{e.stopPropagation(); goPage(n,false);};
      side.appendChild(t); thumbs.push(t);
    }
  }
  // miniatury stron: małe bitmapy, rysowane po kolei, gdy pasek jest widoczny
  const tio=new IntersectionObserver(es=>{for(const e of es){ const t=e.target; if(!e.isIntersecting||t._done) continue; t._done=true;
    doc.getPage(t._n).then(page=>{ const v1=page.getViewport({scale:1}), vp=page.getViewport({scale:Math.round(96*devicePixelRatio)/v1.width});
      const c=document.createElement('canvas'); c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
      return page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise.then(()=>t.firstChild.appendChild(c)); }).catch(()=>{}); }},{root:side,rootMargin:'300px 0px'});
  for(const t of thumbs) tio.observe(t);

  const cur=()=>{const mid=el.scrollTop+el.clientHeight/2; let k=1; for(const b of pages){ if(b.offsetTop<=mid) k=b._n; } return k;};
  function goPage(k,smooth){ k=Math.max(1,Math.min(pages.length,k)); el.scrollTo({top:pages[k-1].offsetTop-12,behavior:smooth===false?'auto':'smooth'}); SFX('tick'); }
  wrap.pageBy=d=>goPage(cur()+d);

  // szerokość strony: dopasowanie do okna razy przybliżenie
  const fitW=()=>Math.max(200,Math.min(920,el.clientWidth-128));
  let redrawT=0;
  function layout(cx,cy){
    // punkt pod kursorem (albo środek widoku) zostaje na miejscu
    const r=el.getBoundingClientRect(); if(cx==null){cx=r.width/2;cy=r.height/2;} else {cx-=r.left;cy-=r.top;}
    const py=el.scrollTop+cy, px=el.scrollLeft+cx;
    let b=pages[0]; for(const p of pages){ if(p.offsetTop<=py) b=p; else break; }
    const fy=(py-b.offsetTop)/b.offsetHeight, fx=(px-b.offsetLeft)/b.offsetWidth;
    base=fitW(); el.style.setProperty('--pw',Math.round(base*z)+'px');
    el.classList.toggle('zoomed',z>1.001);
    el.scrollTop=b.offsetTop+fy*b.offsetHeight-cy; el.scrollLeft=b.offsetLeft+fx*b.offsetWidth-cx;
    upd(); clearTimeout(redrawT); redrawT=setTimeout(()=>{ for(const p of vis) draw(p); },160);
  }
  const pct=()=>Math.round(base*z/(pw1*96/72)*100);
  function zoomBy(f,cx,cy){ const nz=f===0?1:Math.max(0.35,Math.min(8,z*f)); if(Math.abs(nz-z)<1e-3&&f!==0) return; z=nz; layout(cx,cy); }
  wrap.zoomBy=zoomBy;
  new ResizeObserver(()=>layout()).observe(el);

  el.addEventListener('wheel',e=>{
    e.stopPropagation();
    if(e.ctrlKey||e.metaKey){ e.preventDefault(); const d=e.deltaMode===1?e.deltaY*33:e.deltaY; zoomBy(Math.exp(-Math.max(-120,Math.min(120,d))/(pinchLike(e)?160:600)),e.clientX,e.clientY); }
  },{passive:false});
  side.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  // przybliżoną stronę przesuwa się, ciągnąc myszą; zwykły klik przybliża albo wraca do dopasowania
  let drag=null, moved=false;
  el.addEventListener('pointerdown',e=>{ if(e.button!==0||!e.target.closest('.pg')) return; drag={x:e.clientX,y:e.clientY,l:el.scrollLeft,t:el.scrollTop}; moved=false; });
  addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; if(!moved&&Math.hypot(dx,dy)<4) return;
    if(!moved){ moved=true; el.classList.add('panning'); } el.scrollLeft=drag.l-dx; el.scrollTop=drag.t-dy; });
  addEventListener('pointerup',()=>{ if(drag){ drag=null; el.classList.remove('panning'); } });
  el.addEventListener('click',e=>{ e.stopPropagation(); if(moved){moved=false;return;} if(!e.target.closest('.pg')) return; if(z>1.001) zoomBy(0,e.clientX,e.clientY); else zoomBy(2.5,e.clientX,e.clientY); });

  // pasek na dole: miniatury stron · strony · przybliżenie
  const I=(d,w=14)=>'<svg width="'+w+'" height="'+w+'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
  const nav=document.createElement('div'); nav.className='pgnav';
  const mod=isMac?'⌘':'Ctrl+';
  nav.innerHTML=(thumbs.length?'<button class="sideb" aria-label="Miniatury stron" title="Miniatury stron">'+I('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11M3.6 5.2h.8M3.6 8h.8M3.6 10.8h.8"/>')+'</button><i></i>':'')
    +'<button class="pup" aria-label="Poprzednia strona" title="Poprzednia strona (↑)">'+I('<path d="m4 10 4-4 4 4"/>')+'</button><span class="pn"></span><button class="pdn" aria-label="Następna strona" title="Następna strona (↓)">'+I('<path d="m4 6 4 4 4-4"/>')+'</button>'
    +'<i></i><button class="zout" aria-label="Pomniejsz" title="Pomniejsz (−)">'+I('<path d="M4 8h8"/>')+'</button><button class="zl" title="Dopasuj do szerokości (0)"></button><button class="zin" aria-label="Powiększ" title="Powiększ (+ albo '+mod+'kółko)">'+I('<path d="M4 8h8M8 4v8"/>')+'</button>';
  const q=s=>nav.querySelector(s), pn=q('.pn'), zl=q('.zl');
  function upd(){ const k=cur(); pn.textContent=k+' / '+doc.numPages; zl.textContent=pct()+'%';
    $('#vinfo').textContent=info(it)+'  ·  strona '+k+' z '+doc.numPages;
    if(thumbs.length){ for(const t of thumbs) t.classList.toggle('on',t._n===k);
      const t=thumbs[k-1]; if(t&&wrap.classList.contains('side')){ const top=t.offsetTop, bot=top+t.offsetHeight; if(top<side.scrollTop+8||bot>side.scrollTop+side.clientHeight-8) side.scrollTo({top:top-side.clientHeight/2+t.offsetHeight/2}); } } }
  q('.pup').onclick=e=>{e.stopPropagation();wrap.pageBy(-1);}; q('.pdn').onclick=e=>{e.stopPropagation();wrap.pageBy(1);};
  q('.zout').onclick=e=>{e.stopPropagation();zoomBy(1/1.25);}; q('.zin').onclick=e=>{e.stopPropagation();zoomBy(1.25);}; zl.onclick=e=>{e.stopPropagation();zoomBy(0);};
  if(thumbs.length) q('.sideb').onclick=e=>{e.stopPropagation(); S.pdfSide=!wrap.classList.contains('side'); save(); wrap.classList.toggle('side',S.pdfSide); q('.sideb').classList.toggle('on',S.pdfSide); };
  if(thumbs.length) q('.sideb').classList.toggle('on',wrap.classList.contains('side'));
  el.addEventListener('scroll',upd,{passive:true});
  wrap.appendChild(nav); layout();
  return wrap;
}
async function pdfThumb(it){
  if(api.web) throw new Error('miniatury PDF są w programie; dwuklik otwiera dokument');
  await loadPdfjs();
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
  if(!curPath&&!virt&&!libActive()){s.textContent='';renderInsp();return;}
  const nf=view.filter(x=>x.kind==='file').length, q=$('#q').value;
  const nd=view.length-nf;
  let t=nf?nf.toLocaleString('pl'):(nd?nd+' '+plural(nd,'folder','foldery','folderów'):'0');
  if(heads) t+=' w '+heads.size+' '+plural(heads.size,'folderze','folderach','folderach');
  if(picked.size>1) t+=' · zaznaczone '+picked.size;
  s.textContent=t; s.title=(q?'Wyniki: ':'')+nf+' '+plural(nf,'obraz','obrazy','obrazów');
  renderInsp();
}

/* --- panel informacji (I) --- */
const bLabel=list=>list.every(x=>inBasket(x.path))?'Wyjmij z koszyka':'Dodaj do koszyka';

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
    act(bLabel(many)+' ('+many.length+')','B',()=>basketToggle(many));
    act('Kopiuj nazwy','',()=>copyText(many.map(x=>x.name).join('\n')));
    act('Kopiuj ścieżki','',()=>copyText(many.map(x=>x.path).join('\n')));
    return;
  }
  if(!it&&virt==='basket'){
    nm.textContent='Koszyk'; pa.textContent=S.basket.length?'Pliki zebrane z różnych folderów':'Pusty';
    row('Pliki',String(S.basket.length)); row('Rozmiar',fmtSize(S.basket.reduce((a,b)=>a+(b.size||0),0)));
    if(S.basket.length&&api.copyTo) act('Kopiuj do folderu…','',()=>copyBasketTo(S.basket),true);
    if(S.basket.length) act('Wyczyść koszyk','',basketClear);
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
  act(bLabel([it]),'B',()=>basketToggle([it]));
  act('Kopiuj obraz','C',()=>copyImage(it));
  act('Kopiuj ścieżkę','P',()=>copyText(it.path));
}

/* --- podgląd powiększony: natychmiast miniatura, potem pełny obraz; sąsiedzi wczytywani z wyprzedzeniem --- */
const viewer=$('#viewer'), stage=$('#stage');
let vTok=0, vEl=null, actual=false, zm=null, zx=0, zy=0, vList=[], vi=0, lastStep=0;
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
      const bad=()=>new Error('tego kodeka nie da się tu odtworzyć — otwórz w odtwarzaczu systemowym (E)');
      await new Promise((ok,no)=>{const t=setTimeout(()=>no(bad()),15000);vid.onloadedmetadata=()=>{clearTimeout(t);vid.videoWidth?ok():no(bad());};vid.onerror=()=>{clearTimeout(t);no(bad());};});
      it.dims=[vid.videoWidth,vid.videoHeight]; v={el:videoPlayer(vid),note:'',media:true,video:vid};
    }else if(it.type==='pdf'&&!api.web&&await loadPdfjs()){ // cały dokument, strony rysowane przez pdf.js w stylu programu
      v={el:await pdfViewer(it),note:'',doc:true,media:true};
    }else if(it.type==='pdf'){ // wersja HTML: wbudowana przeglądarka PDF
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
      // najpierw w rozdzielczości ekranu (PSD, TIFF, EXR, HDR, TGA) — pełna dopiero po przybliżeniu
      const r=await decode(ref(it),it.type,screenPx());
      it.meta=r.meta; it.dims=[r.meta.width,r.meta.height];
      const el=await viewCanvas(it,r);
      if(r.meta&&r.width&&r.meta.width>r.width*1.02){ el._fw=r.meta.width; el._fh=r.meta.height; el._reduced=true; }
      v={el,note:r.note||''};
    }
    if(v.media) return v; // filmów nie trzymamy w pamięci
    vCache.set(it,v);
    let tot=0; for(const x of vCache.values()) tot+=vpx(x);
    for(const k of vCache.keys()){ if(tot<=VC_PX||vCache.size<=2) break; if(vList[vi]===k) continue; tot-=vpx(vCache.get(k)); vCache.delete(k); }
    return v;
  })().finally(()=>vLoading.delete(it));
  vLoading.set(it,p); return p;
}
// dłuższy bok ekranu w pikselach urządzenia, z małym zapasem — tyle wystarcza do podglądu „dopasuj”
const screenPx=()=>Math.round(Math.max(screen.width,screen.height)*devicePixelRatio*1.1);
async function viewCanvas(it,r){
  const bmp=await toBitmap(r); let el;
  if(OPAQUE.has(it.type)||r.jpeg){el=document.createElement('canvas');el.width=bmp.width;el.height=bmp.height;el.getContext('2d').drawImage(bmp,0,0);}
  else el=paintOn(bmp,bmp.width,bmp.height,bigCell(bmp.width,bmp.height));
  bmp.close(); return el;
}
// po przybliżeniu podmieniamy obraz na pełną rozdzielczość; trzymamy ją tylko dla bieżącego pliku
async function upgradeFull(){
  const el=vEl, it=vList[vi]; if(!el||!el._reduced||el._upg||!it) return;
  el._upg=true; const tok=vTok, t=setTimeout(()=>zoomTip('Wczytuję pełną rozdzielczość…'),250);
  try{
    const r=await decode(ref(it),it.type,0); if(tok!==vTok||vEl!==el) return;
    const c=await viewCanvas(it,r); if(tok!==vTok||vEl!==el) return;
    c.className=el.className; c.style.cssText=el.style.cssText; c.draggable=false; c.onclick=el.onclick; c.ondragstart=el.ondragstart;
    el.replaceWith(c); vEl=c; if(zm) renderZoom();
  }catch(e){ el._upg=false; }
  finally{ clearTimeout(t); }
}
function openViewer(it){
  SFX('open');
  const files=view.filter(x=>x.kind==='file');
  vList=picked.size>1&&picked.has(it)?files.filter(x=>picked.has(x)):files;
  vi=Math.max(0,vList.indexOf(it)); viewer.classList.add('open'); chromeSync(); showV();
  if(!S.hints.viewer) setTimeout(()=>{ if(viewer.classList.contains('open')){ const r=stage.getBoundingClientRect(); hint('viewer',{left:r.left,top:r.bottom-70,width:r.width,height:1,right:r.right,bottom:r.bottom-70},'<kbd>A</kbd> <kbd>D</kbd> albo strzałki — poprzedni i następny · <kbd>Z</kbd> — 100% · <kbd>1</kbd> <kbd>2</kbd> — oddal, przybliż · spacja wraca do siatki','above'); } },700);
}
// odtwarzacz w stylu macOS (AVKit): pływający, przydymiony panel na dole obrazu, chowa się podczas odtwarzania
const IC_PLAY='<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M6.5 4.2v13.6c0 .8.9 1.3 1.6.9l11-6.8c.6-.4.6-1.3 0-1.7l-11-6.8c-.7-.4-1.6.1-1.6.8z" fill="currentColor"/></svg>';
const IC_PAUSE='<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="5" y="4" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="12.8" y="4" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>';
const IC_BACK='<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M4.5 10a5.5 5.5 0 1 0 1.8-4.1"/><path d="M6.3 2.9v3h3"/><text x="10" y="12.6" font-size="6.2" text-anchor="middle" fill="currentColor" stroke="none" font-family="-apple-system,Inter,sans-serif" font-weight="600">10</text></svg>';
const IC_FWD=IC_BACK.replace('M4.5 10a5.5 5.5 0 1 0 1.8-4.1','M15.5 10a5.5 5.5 0 1 1-1.8-4.1').replace('M6.3 2.9v3h3','M13.7 2.9v3h-3');
const IC_SND='<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M2 5.5h2.5L8.5 2v12L4.5 10.5H2z" fill="currentColor" stroke="none"/><path d="M11.5 5.2a3.6 3.6 0 0 1 0 5.6M13.8 3a6.8 6.8 0 0 1 0 10"/></svg>';
const IC_MUTE='<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M2 5.5h2.5L8.5 2v12L4.5 10.5H2z" fill="currentColor" stroke="none"/><path d="m11.5 5.5 5 5M16.5 5.5l-5 5"/></svg>';
const IC_PIP='<svg width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1.5" y="2" width="15" height="11" rx="2"/><rect x="9" y="7.5" width="5.5" height="3.8" rx=".8" fill="currentColor" stroke="none"/></svg>';
const IC_FS='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>';
function videoPlayer(vid){
  const w=document.createElement('div'); w.className='vwrap';
  const box=document.createElement('div'); box.className='vbox';
  const bar=document.createElement('div'); bar.className='avk';
  bar.innerHTML='<div class="avk-r1"><div class="avk-l"><button class="avk-b vm" aria-label="Dźwięk (M)"></button><div class="avk-s vv"><div class="avk-f"></div></div></div>'
    +'<div class="avk-c"><button class="avk-b vb" aria-label="10 s wstecz">'+IC_BACK+'</button><button class="avk-b vp big" aria-label="Odtwórz / pauza (K)"></button><button class="avk-b vf" aria-label="10 s naprzód">'+IC_FWD+'</button></div>'
    +'<div class="avk-r"><button class="avk-b vpip" aria-label="Obraz w obrazie">'+IC_PIP+'</button><button class="avk-b vfs" aria-label="Pełny ekran">'+IC_FS+'</button></div></div>'
    +'<div class="avk-r2"><span class="vt0">0:00</span><div class="avk-s vs"><div class="avk-f"></div></div><span class="vt1"></span></div>';
  box.append(vid,bar); w.appendChild(box);
  const q=s=>bar.querySelector(s);
  const bp=q('.vp'), bm=q('.vm'), t0=q('.vt0'), t1=q('.vt1'), sc=q('.vs'), fill=sc.firstChild, vv=q('.vv'), vf=vv.firstChild;
  vid.volume=S.vol!=null?S.vol:1; vid.muted=!!S.mute;
  const sync=()=>{bp.innerHTML=vid.paused?IC_PLAY:IC_PAUSE; const off=vid.muted||!vid.volume; bm.innerHTML=off?IC_MUTE:IC_SND; vf.style.width=(off?0:vid.volume*100)+'%'; box.classList.toggle('playing',!vid.paused);};
  const time=()=>{t0.textContent=fmtDur(vid.currentTime); t1.textContent='-'+fmtDur(Math.max(0,(vid.duration||0)-vid.currentTime)); fill.style.width=(vid.duration?vid.currentTime/vid.duration*100:0)+'%';};
  vid.addEventListener('play',sync); vid.addEventListener('pause',sync); vid.addEventListener('volumechange',sync); vid.addEventListener('timeupdate',time); vid.addEventListener('loadedmetadata',time);
  const tog=()=>vid.paused?vid.play().catch(()=>{}):vid.pause();
  // panel chowa się po chwili bez ruchu myszy, gdy film gra
  let hideT; const wake=()=>{box.classList.add('awake');clearTimeout(hideT);hideT=setTimeout(()=>box.classList.remove('awake'),2200);};
  box.onmousemove=wake; box.onmouseleave=()=>{clearTimeout(hideT);box.classList.remove('awake');};
  vid.onclick=e=>{e.stopPropagation();tog();wake();};
  vid.ondblclick=e=>{e.stopPropagation();box.requestFullscreen?.();};
  bar.onclick=e=>e.stopPropagation();
  bp.onclick=()=>tog();
  q('.vb').onclick=()=>{vid.currentTime=Math.max(0,vid.currentTime-10);time();};
  q('.vf').onclick=()=>{vid.currentTime=Math.min(vid.duration||0,vid.currentTime+10);time();};
  q('.vpip').onclick=()=>{if(document.pictureInPictureElement)document.exitPictureInPicture();else vid.requestPictureInPicture?.().catch(()=>{});};
  q('.vfs').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else box.requestFullscreen?.();};
  bm.onclick=()=>{vid.muted=!vid.muted;if(!vid.muted&&!vid.volume)vid.volume=.5;S.mute=vid.muted;S.vol=vid.volume;save();};
  const drag=(el,fn,end)=>{let on=false;el.onpointerdown=e=>{e.stopPropagation();on=true;el.setPointerCapture(e.pointerId);el.classList.add('drag');fn(e);};el.onpointermove=e=>{if(on)fn(e);};el.onpointerup=()=>{on=false;el.classList.remove('drag');end&&end();};};
  const frac=(el,e)=>{const r=el.getBoundingClientRect();return Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));};
  drag(sc,e=>{if(vid.duration){vid.currentTime=frac(sc,e)*vid.duration;time();}});
  drag(vv,e=>{const k=frac(vv,e);vid.volume=k;vid.muted=k===0;S.vol=k;S.mute=vid.muted;},save);
  vv.onwheel=e=>{e.preventDefault();e.stopPropagation();vid.volume=Math.max(0,Math.min(1,vid.volume-Math.sign(e.deltaY)*.05));vid.muted=!vid.volume;S.vol=vid.volume;S.mute=vid.muted;save();};
  w.onclick=e=>{if(e.target===w)closeViewer();};
  // dźwięk gra, a obrazu brak (np. ProRes) — powiedz o tym zamiast pokazywać czarne okno
  let frames=0; if(vid.requestVideoFrameCallback){const tick=()=>{frames++;vid.requestVideoFrameCallback(tick);};vid.requestVideoFrameCallback(tick);}
  vid.addEventListener('playing',()=>setTimeout(()=>{if(!frames&&!vid.paused&&vid.requestVideoFrameCallback){const m=document.createElement('div');m.className='vmsg';m.textContent='Tego kodeka obrazu nie da się tu odtworzyć (np. ProRes). Naciśnij E, żeby otworzyć w odtwarzaczu systemowym.';box.appendChild(m);}},2500),{once:true});
  sync(); time(); wake(); w.video=vid; return w;
}
function stopMedia(){for(const m of stage.querySelectorAll('video'))m.pause(); for(const d of stage.querySelectorAll('.pdfwrap')){try{d._doc.destroy();}catch(e){}}}
function mount(el,low,it){
  stopMedia(); stage.textContent=''; stage.appendChild(el); vEl=low?null:el;
  el.classList.toggle('low',!!low);
  el.style.width=el.style.height='';
  if(low){ // miniatura powiększona do docelowego rozmiaru, żeby nic nie skakało
    const r=stage.getBoundingClientRect(), aw=r.width-128, ah=r.height-38;
    const [dw,dh]=it.dims||[el.width,el.height];
    const s=Math.min(aw/dw,ah/dh,1); el.style.width=Math.round(dw*s)+'px'; el.style.height=Math.round(dh*s)+'px';
  } else {
    if(el.tagName!=='IFRAME'&&!el.video&&!el.isDoc) el.onclick=ev=>{ev.stopPropagation(); if(panMoved) return; if(zm) zoomFit(true); else zoomTo(Math.max(1,fitScale()*2),ev.clientX,ev.clientY,true);};
    if(!el.video) el.draggable=true; el.ondragstart=ev=>{ev.preventDefault();if(zm)return;draggingOut=true;lastOutItems=[it];api.dragOut([it.path],dragImage([it]));};
    applyZoom();
    if(el.video) el.video.play().catch(()=>{});
  }
}
async function showV(){
  const it=vList[vi]; if(!it) return; const tok=++vTok;
  const now=performance.now(), fast=now-lastStep<180; lastStep=now;
  const i=view.indexOf(it); if(i>=0&&picked.size<=1) select(i); else if(i>=0){sel=i;}
  $('#vname').textContent=it.name; $('#vname').title=it.path; $('#vinfo').textContent=info(it); $('#vcount').textContent=(vi+1)+' / '+vList.length;
  zm=null; stage.className='fit';
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
function stepV(d){if(!vList.length)return;SFX('tick');vi=(vi+d+vList.length)%vList.length;showV();}
function applyZoom(){ if(zm) renderZoom(); else { stage.className='fit'; if(vEl&&!vEl.video&&!vEl.isDoc){vEl.style.width=vEl.style.height='';vEl.style.transform='';if(vEl.tagName!=='IFRAME')vEl.draggable=true;} } }
const isImg=()=>vEl&&!vEl.video&&!vEl.isDoc&&vEl.tagName!=='IFRAME';
const natW=()=>(vEl._fw||vEl.naturalWidth||vEl.width)/devicePixelRatio, natH=()=>(vEl._fh||vEl.naturalHeight||vEl.height)/devicePixelRatio;
function fitScale(){ const r=stage.getBoundingClientRect(), m=document.body.classList.contains('bare'); return Math.min((r.width-(m?20:128))/natW(),(r.height-(m?20:38))/natH(),1); }
function zoomFit(tip){ zm=null; applyZoom(); if(tip){ zoomTip('Dopasuj'); SFX('tick'); } }
// przybliż do skali z (1 = 100%), trzymając pod kursorem ten sam punkt obrazu
function zoomTo(z,cx,cy,tip){
  if(!isImg()) return;
  const r=stage.getBoundingClientRect(), f=fitScale(); z=Math.min(Math.max(z,f),16);
  if(z<=f*1.001){ zoomFit(tip); return; }
  if(cx==null){cx=r.left+r.width/2;cy=r.top+r.height/2;}
  let s0,ox,oy;
  if(zm){s0=zm;ox=zx;oy=zy;} else { s0=f; const b=vEl.getBoundingClientRect(); const w=natW()*f,h=natH()*f; ox=b.left-r.left+(b.width-w)/2; oy=b.top-r.top+(b.height-h)/2; }
  const ix=(cx-r.left-ox)/s0, iy=(cy-r.top-oy)/s0;
  zm=z; zx=cx-r.left-ix*z; zy=cy-r.top-iy*z; renderZoom();
  if(vEl._reduced&&!vEl._upg&&z>f*1.05) upgradeFull();
  if(tip){ zoomTip(Math.round(z*100)+'%'); SFX('tick'); }
}
function renderZoom(){
  if(!isImg()) return;
  const r=stage.getBoundingClientRect(), w=natW()*zm, h=natH()*zm;
  zx=w<=r.width?(r.width-w)/2:Math.min(0,Math.max(r.width-w,zx));
  zy=h<=r.height?(r.height-h)/2:Math.min(0,Math.max(r.height-h,zy));
  stage.className='zoomed'; vEl.draggable=false; vEl.style.width=w+'px'; vEl.style.height=h+'px'; vEl.style.transform=`translate(${zx}px,${zy}px)`;
}
// przeciąganie powiększonego obrazu
let panMoved=false;
stage.addEventListener('pointerdown',e=>{
  if(!zm||!isImg()||e.button!==0) return; e.preventDefault();
  const sx=e.clientX, sy=e.clientY, x0=zx, y0=zy; panMoved=false; stage.setPointerCapture(e.pointerId);
  const mv=ev=>{ const dx=ev.clientX-sx, dy=ev.clientY-sy; if(Math.abs(dx)+Math.abs(dy)>3){panMoved=true;stage.classList.add('pan');} zx=x0+dx; zy=y0+dy; renderZoom(); stage.classList.toggle('pan',panMoved); };
  const up=()=>{ stage.removeEventListener('pointermove',mv); stage.removeEventListener('pointerup',up); stage.classList.remove('pan'); setTimeout(()=>panMoved=false,0); };
  stage.addEventListener('pointermove',mv); stage.addEventListener('pointerup',up);
});
addEventListener('resize',()=>{ if(zm) renderZoom(); hdAll(); });
let peekClosing=false;
function closeViewer(){ if(PEEK&&!peekClosing){ if(sheet&&!inSheet()){ renderSheet(); return; } api.peekClose(); return; }   /* z pojedynczego zdjęcia arkusza wracamy do arkusza */ if(hintId==='viewer')hideHint();if(viewer.classList.contains('open'))SFX('close');stopMedia();viewer.classList.remove('open');chromeSync();vTok++;stage.textContent='';vEl=null;main.focus();}
// trzy poziomy: siatka → podgląd → przybliżenie. Klik w obraz schodzi poziom niżej (przybliża, a przybliżony wraca do dopasowania),
// klik obok obrazu wraca o jeden poziom: z przybliżenia do dopasowania, z dopasowania do siatki
stage.addEventListener('click',e=>{ if(e.target!==stage&&!e.target.classList.contains('sheet')||panMoved) return; if(zm) zoomFit(true); else if(sheet&&!inSheet()) renderSheet(); else closeViewer(); });
// kółko myszy i gładzik przewijają obrazy (w trybie 100% przewijają sam obraz)
let wAcc=0, wT=0;
stage.addEventListener('wheel',e=>{
  if(vEl&&(vEl.tagName==='IFRAME'||vEl.isDoc)) return;
  // Ctrl/⌘ + kółko albo szczypnięcie gładzikiem: przybliżanie wokół kursora
  if((e.ctrlKey||e.metaKey)&&isImg()){ e.preventDefault(); { const d=e.deltaMode===1?e.deltaY*33:e.deltaY; zoomTo((zm||fitScale())*Math.exp(-Math.max(-120,Math.min(120,d))/(pinchLike(e)?240:900)),e.clientX,e.clientY); } return; }
  // po przybliżeniu kółko i gładzik przesuwają obraz
  if(zm){ e.preventDefault(); const k=e.deltaMode===1?30:1; if(e.shiftKey&&!e.deltaX){zx-=e.deltaY*k;}else{zx-=e.deltaX*k;zy-=e.deltaY*k;} renderZoom(); return; }
  e.preventDefault();
  const d=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
  wAcc+=e.deltaMode===1?d*30:d; clearTimeout(wT); wT=setTimeout(()=>wAcc=0,200);
  while(Math.abs(wAcc)>=70){ const s=Math.sign(wAcc); wAcc-=s*70; stepV(s); }
},{passive:false});
$('#vprev').onclick=()=>stepV(-1); $('#vnext').onclick=()=>stepV(1); $('#vclose').onclick=closeViewer;
/* --- przerób na JPG: pełna rozdzielczość, przezroczystość na białym tle, plik obok oryginału --- */
const canJpg=it=>it&&it.kind==='file'&&!DOCS.has(it.type)&&it.type!=='vid'&&it.type!=='jpg';
async function cleanBitmap(it){
  if(it.type==='svg'){ const im=await loadImg(api.fileUrl(it.path)); const w=im.naturalWidth||1024,h=im.naturalHeight||1024; return {src:im,w,h}; }
  if(NATIVE.has(it.type)){ const b=await createImageBitmap(await blobOf(it)); return {src:b,w:b.width,h:b.height,close:()=>b.close()}; }
  const r=await decode(ref(it),it.type,0); const b=await toBitmap(r); return {src:b,w:b.width,h:b.height,close:()=>b.close(),note:r.note};
}
async function toJpg(list){
  list=list.filter(canJpg);
  if(!list.length){ zoomTip('Nic do przerobienia — JPG, filmy i pliki projektowe są pomijane'); return; }
  if(!api.writeNew){ zoomTip('Zapis plików działa w programie, nie w przeglądarce'); return; }
  let ok=0, fail=0;
  for(let i=0;i<list.length;i++){
    const it=list[i]; zoomTip('Zapisuję JPG '+(i+1)+' / '+list.length+'…');
    try{
      const b=await cleanBitmap(it), c=document.createElement('canvas'); c.width=b.w; c.height=b.h;
      const g=c.getContext('2d'); g.fillStyle='#ffffff'; g.fillRect(0,0,b.w,b.h); g.drawImage(b.src,0,0,b.w,b.h); b.close&&b.close();
      const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));
      const name=it.name.replace(/\.[^.]+$/,'')+'.jpg';
      await api.writeNew(api.dirname(it.path),name,await blob.arrayBuffer()); ok++;
    }catch(e){ fail++; }
  }
  SFX('tick'); zoomTip(fail?('Zapisano '+ok+', nie udało się '+fail):(ok===1?'Zapisano JPG obok oryginału':'Zapisano '+ok+' plików JPG'));
  if(!viewer.classList.contains('open')) scan(true);
}
/* --- usuwanie: do Kosza, bez pytania (można przywrócić z Kosza) --- */
/* --- zmiana nazwy w miejscu (F2): Enter zapisuje, Esc anuluje --- */
function renameItem(it){
  if(!api.rename||!it||!it.tile||virt==='basket') return;
  const nm=it.tile.querySelector('.nm'); if(!nm) return;
  const inp=document.createElement('input'); inp.className='ren'; inp.value=it.name; inp.spellcheck=false;
  nm.after(inp); nm.hidden=true;
  const dot=it.kind==='file'?it.name.lastIndexOf('.'):-1; inp.focus(); inp.setSelectionRange(0,dot>0?dot:it.name.length);
  let done=false;
  const end=async ok=>{
    if(done) return; done=true;
    const v=inp.value.trim();
    if(ok&&v&&v!==it.name){
      const r=await api.rename(it.path,v);
      if(r.error){ zoomTip(r.error); done=false; inp.focus(); return; }
      applyMoves([{from:it.path,to:r.to,op:'move'}]); zoomTip('Zmieniono nazwę  ·  '+(isMac?'⌘Z':'Ctrl+Z')+' cofa');
      inp.remove(); nm.hidden=false; scan(true,r.to); return;
    }
    inp.remove(); nm.hidden=false; main.focus();
  };
  inp.addEventListener('keydown',e=>{ e.stopPropagation(); if(e.key==='Enter'){e.preventDefault();end(true);} else if(e.key==='Escape'){e.preventDefault();end(false);} });
  inp.addEventListener('blur',()=>end(true));
  inp.addEventListener('click',e=>e.stopPropagation()); inp.addEventListener('dblclick',e=>e.stopPropagation());
}
// foldery do Kosza tylko po potwierdzeniu — w środku może być dużo więcej, niż widać
async function trashSel(list){
  const ds=list.filter(x=>x.kind==='dir');
  if(ds.length&&!(await askConfirm(ds.length===1?'Przenieść folder „'+ds[0].name+'” do Kosza?':'Przenieść '+ds.length+' foldery do Kosza?','Razem z całą zawartością. Można je przywrócić z Kosza.','Przenieś do Kosza'))) return;
  trashItems(list);
}
async function trashItems(list){
  if(!api.trash||!list.length) return;
  const r=await api.trash(list.map(x=>x.path));
  if(r.failed.length) zoomTip('Nie udało się przenieść '+r.failed.length+' do Kosza');
  else { SFX('tick'); zoomTip(list.length===1?'Przeniesiono do Kosza':'Przeniesiono do Kosza: '+list.length); }
  const gone=new Set(r.done);
  if(viewer.classList.contains('open')){
    const cur=vList[vi]; vList=vList.filter(x=>!gone.has(x.path));
    if(!vList.length) closeViewer(); else { vi=Math.min(vi,vList.length-1); if(cur&&gone.has(cur.path)) showV(); }
  }
  picked=new Set([...picked].filter(x=>!gone.has(x.path)));
  scan(true);
}
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
    {label:zm?'Dopasuj do okna':'Rozmiar oryginalny (100%)',key:'Z',run:()=>{zm?zoomFit(true):zoomTo(1,null,null,true);}},
    {label:'Kopiuj obraz',key:'C',run:()=>copyImage(it)},
    {label:'Kopiuj ścieżkę',key:'P',run:()=>copyText(it.path)},
    ...(api.writeNew&&canJpg(it)?[{label:'Zapisz jako JPG',run:()=>toJpg([it])}]:[]),
    {label:bLabel([it]),key:'B',run:()=>basketToggle([it])},
    ...(api.trash&&virt!=='basket'?['-',{label:'Przenieś do Kosza',key:isMac?'⌘⌫':'Delete',run:()=>trashItems([it])}]:[]),
    '-',{label:'Ukryj interfejs',box:document.body.classList.contains('bare'),key:'Tab',run:toggleBare},
    {label:document.documentElement.dataset.theme==='dark'?'Tryb jasny':'Tryb ciemny',key:'T',run:cycleTheme}]);
}
$('#vmore').onclick=e=>{e.stopPropagation();ctx.hidden?viewerMenu():hideMenu();};
function toggleVMin(){ toggleBare(); }
function toggleBare(){document.body.classList.toggle('bare');chromeSync();if(viewer.classList.contains('open'))applyZoom();zoomTip(document.body.classList.contains('bare')?'Tab — pokaż interfejs':'Interfejs widoczny');}

/* --- programy zewnętrzne --- */
let editorName=null;
api.editorName().then(n=>{editorName=n;});
async function openInEditor(paths,choose){
  const n=await api.openEditor(paths,choose);
  if(n){editorName=n;zoomTip('Otwieram w: '+n);}
}

/* --- menu pod prawym przyciskiem --- */
const ctx=$('#ctx');
function hideMenu(){ctx.hidden=true;ctx.dataset.of='';setTimeout(syncSearch,0);document.querySelectorAll('.tb.open').forEach(b=>b.classList.remove('open'));}
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
    if(virt==='basket'){
      if(!S.basket.length) return;
      showMenu(e.clientX,e.clientY,'Koszyk',[
        {label:'Zaznacz wszystkie',key:MOD+'A',run:selectAll},
        ...(api.copyTo?[{label:'Kopiuj wszystkie do folderu…',run:()=>copyBasketTo(S.basket)}]:[]),
        {label:'Kopiuj ścieżki',run:()=>copyText(S.basket.map(b=>b.path).join('\n'))},
        '-',{label:'Wyczyść koszyk',run:basketClear}]);
      return;
    }
    if(!curPath) return;
    showMenu(e.clientX,e.clientY,api.basename(curPath)||curPath,[
      {label:'Odśwież',key:'R',run:()=>scan(true)},
      ...(clipLoad()&&api.transfer?[{label:(fileClip.cut?'Wklej (przenieś) ':'Wklej ')+fileClip.paths.length,key:MOD+'V',run:async()=>{ const c=fileClip, r=await doTransfer(c.paths,{path:curPath,name:api.basename(curPath)||curPath},c.cut?'move':'copy'); if(c.cut&&r&&r.done.length) clipSave(null); }},'-']:[]),
      {label:'Kopiuj ścieżkę folderu',run:()=>copyText(curPath)},
      {label:'Przejdź do ścieżki…',key:MOD+'L',run:editPath},
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
      '-',{label:'Kopiuj ścieżkę',run:()=>copyText(it.path)},
      ...(api.rename?[{label:'Zmień nazwę…',key:'F2',run:()=>renameItem(it)}]:[]),
      ...(api.trash?['-',{label:'Przenieś do Kosza',key:isMac?'⌘⌫':'Delete',run:()=>trashSel([it])}]:[])]);
    return;
  }
  const many=pickedFiles(it), n=many.length, en=[];
  if(n>1) en.push({label:'Pokaż zaznaczone ('+n+')',key:'Enter',run:()=>openViewer(it)});
  else en.push({label:'Otwórz podgląd',key:'Enter',run:()=>openViewer(it)});
  en.push({label:'Otwórz w '+(editorName||'Photoshopie')+(n>1?' ('+n+')':''),key:MOD+'E',run:()=>openInEditor(many.map(x=>x.path))});
  if(n===1) en.push({label:'Otwórz w domyślnym programie',key:MOD+'Enter',run:()=>api.openDefault(it.path)});
  if(n===1&&(heads||virt)) en.push({label:'Przejdź do folderu „'+(api.basename(api.dirname(it.path))||api.dirname(it.path))+'”',run:()=>go(api.dirname(it.path),it.path)});
  en.push({label:'Pokaż w '+FINDER,run:()=>api.showInFolder(it.path)});
  en.push('-');
  en.push({label:bLabel(many)+(n>1?' ('+n+')':''),key:'B',run:()=>basketToggle(many)});
  if(n===1&&api.rename&&virt!=='basket') en.push({label:'Zmień nazwę…',key:'F2',run:()=>renameItem(it)});
  if(virt==='basket'&&api.copyTo) en.push({label:'Kopiuj do folderu…'+(n>1?' ('+n+')':''),run:()=>copyBasketTo(many)});
  en.push('-');
  en.push({label:n>1?'Kopiuj nazwy ('+n+')':'Kopiuj nazwę',run:()=>copyText(many.map(x=>x.name).join('\n'))});
  en.push({label:n>1?'Kopiuj ścieżki ('+n+')':'Kopiuj ścieżkę',run:()=>copyText(many.map(x=>x.path).join('\n'))});
  if(api.writeNew&&many.some(canJpg)) en.push('-',{label:n>1?'Zapisz jako JPG ('+many.filter(canJpg).length+')':'Zapisz jako JPG',run:()=>toJpg(many)});
  if(api.trash&&virt!=='basket') en.push('-',{label:n>1?'Przenieś do Kosza ('+n+')':'Przenieś do Kosza',key:isMac?'⌘⌫':'Delete',run:()=>trashItems(many)});
  en.push('-',{label:'Zmień program do edycji…',run:()=>openInEditor(many.map(x=>x.path),true)});
  showMenu(e.clientX,e.clientY,n>1?'Zaznaczone: '+n:it.name,en);
});
document.addEventListener('pointerdown',e=>{if(!ctx.hidden&&!ctx.contains(e.target)&&!e.target.closest('#typesBtn,#sortBtn,#setBtn,#vmore,#qScope'))hideMenu();});
addEventListener('blur',hideMenu); main.addEventListener('scroll',hideMenu);

/* --- klawiatura --- */
document.addEventListener('keydown',e=>{
  const k=e.key;
  if(!isMac&&e.ctrlKey&&!e.shiftKey&&!e.altKey&&k===' '){ e.preventDefault(); fullscreenToggle(); return; }
  if(k==='Escape'&&document.documentElement.classList.contains('fs')&&fsBare!==null&&!dlgDone&&ctx.hidden){ e.preventDefault(); fullscreenToggle(); return; }
  if(dlgDone){ if(k==='Escape'){e.preventDefault();dlgDone(false);} else if(k==='Enter'){e.preventDefault();dlgDone(true);} return; }
  if(!ctx.hidden&&k==='Escape'){hideMenu();return;}
  if($('#keys').classList.contains('on')){ if(k==='Escape'||k==='?'){e.preventDefault();toggleKeys(false);} return; }
  if(k==='?'&&!e.target.matches('input,textarea')){e.preventDefault();toggleKeys(true);return;}
  if(hintEl&&k==='Escape'&&!viewer.classList.contains('open')){hideHint();}
  if(e.target.matches('input[type=search]')){
    if(k==='Escape'){if(e.target.value){$('#qClear').click();}else e.target.blur();}
    else if(k==='Enter'||k==='ArrowDown'){e.target.blur();main.focus();if(view.length&&sel<0)select(0);}
    return;
  }
  const mod=e.metaKey||e.ctrlKey;
  const open_=viewer.classList.contains('open');
  if(mod&&k.toLowerCase()==='e'){e.preventDefault();const f=open_?[vList[vi]]:pickedFiles();if(f.length&&f[0])openInEditor(f.map(x=>x.path));return;}
  if(open_&&inSheet()){
    const n=sheet.list.length, c=sheetCols(n);
    if(k==='Escape'||k===' '){e.preventDefault();closeViewer();}
    else if(k==='ArrowRight'||e.code==='KeyD'){e.preventDefault();sheet.at=Math.min(n-1,sheet.at+1);sheetMark();}
    else if(k==='ArrowLeft'||e.code==='KeyA'){e.preventDefault();sheet.at=Math.max(0,sheet.at-1);sheetMark();}
    else if(k==='ArrowDown'){e.preventDefault();sheet.at=Math.min(n-1,sheet.at+c);sheetMark();}
    else if(k==='ArrowUp'){e.preventDefault();sheet.at=Math.max(0,sheet.at-c);sheetMark();}
    else if(k==='Home'){e.preventDefault();sheet.at=0;sheetMark();}
    else if(k==='End'){e.preventDefault();sheet.at=n-1;sheetMark();}
    else if(k==='Enter'){e.preventDefault();sheetOpen();}
    return;
  }
  if(open_){
    if(sheet&&k==='Backspace'){e.preventDefault();renderSheet();return;}
    if(k===' '&&PEEK){e.preventDefault();api.peekClose();}      // spacja w podglądzie z Eksploratora zamyka od razu, jak na Macu
    else if(k==='Escape'||k===' '){e.preventDefault();closeViewer();}
    else if(vEl&&vEl.pageBy&&(k==='ArrowDown'||k==='PageDown')){e.preventDefault();vEl.pageBy(1);}
    else if(vEl&&vEl.pageBy&&(k==='ArrowUp'||k==='PageUp')){e.preventDefault();vEl.pageBy(-1);}
    else if(k==='ArrowRight'||k==='ArrowDown'||e.code==='KeyD'){e.preventDefault();stepV(1);}
    else if(k==='ArrowLeft'||k==='ArrowUp'||e.code==='KeyA'){e.preventDefault();stepV(-1);}
    else if(vEl&&vEl.zoomBy&&!e.altKey&&((k==='+'||k==='=')||e.code==='Digit2')){e.preventDefault();vEl.zoomBy(1.25);}
    else if(vEl&&vEl.zoomBy&&!e.altKey&&(k==='-'||e.code==='Digit1')){e.preventDefault();vEl.zoomBy(1/1.25);}
    else if(vEl&&vEl.zoomBy&&(k==='0'||k==='z')){e.preventDefault();vEl.zoomBy(0);}
    else if(mod&&(k==='='||k==='+')&&isImg()){e.preventDefault();zoomTo((zm||fitScale())*1.25,null,null,true);}
    else if(mod&&k==='-'&&isImg()){e.preventDefault();zoomTo((zm||fitScale())/1.25,null,null,true);}
    else if(mod&&k==='0'){e.preventDefault();zoomFit(true);}
    else if(e.code==='Digit2'&&isImg()){zoomTo((zm||fitScale())*1.25,null,null,true);}
    else if(e.code==='Digit1'&&isImg()){zoomTo((zm||fitScale())/1.25,null,null,true);}
    else if((k==='+'||k==='=')&&isImg()){zoomTo((zm||fitScale())*1.25,null,null,true);}
    else if(k==='-'&&isImg()){zoomTo((zm||fitScale())/1.25,null,null,true);}
    else if(k==='0'){zoomFit(true);}
    else if((k==='t'||k==='T')&&!e.metaKey&&!e.ctrlKey){cycleTheme();}
    else if((k==='s'||k==='S')&&!e.metaKey&&!e.ctrlKey){S.sound=!(S.sound!==false);save();if(S.sound)SFX('tick');zoomTip(S.sound?'Dźwięki włączone':'Dźwięki wyciszone');}
    else if((k==='k'||k==='m')&&vEl&&vEl.video){const m=vEl.video; if(k==='k') m.paused?m.play().catch(()=>{}):m.pause(); else {m.muted=!m.muted;if(!m.muted&&!m.volume)m.volume=.5;S.mute=m.muted;S.vol=m.volume;save();}}
    else if(k==='z'){zm?zoomFit(true):zoomTo(1,null,null,true);}
    else if(k==='r'){api.showInFolder(vList[vi].path);}
    else if((isMac&&(e.metaKey||e.ctrlKey)&&k==='Backspace')||(!isMac&&k==='Delete')){e.preventDefault();if(virt==='basket')basketRemove([vList[vi]]);else if(api.trash)trashItems([vList[vi]]);}
    else if((k==='b'||k==='B')&&!mod){basketToggle([vList[vi]]);}
    else if(k==='e'){const c=vList[vi]; if(c.type==='vid') api.openDefault(c.path); else openInEditor([c.path]);}
    else if(e.code==='KeyC'&&e.shiftKey&&!mod){copyText(vList[vi].path);}
    else if(k==='c'&&!mod){copyImage(vList[vi]);}
    else if(e.code==='KeyQ'){e.preventDefault();closeViewer();}
    else if(k==='p'){copyText(vList[vi].path);}
    else if(k==='Tab'){e.preventDefault();toggleVMin();}
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
  if(mod&&e.shiftKey&&e.code==='KeyF'&&api.libSearch){e.preventDefault();if(virt)closeVirt();setQIn('lib');$('#q').focus();$('#q').select();return;}
  if(mod&&k.toLowerCase()==='f'){e.preventDefault();$('#q').focus();return;}
  if((mod&&!e.shiftKey&&e.code==='KeyL')||(mod&&e.shiftKey&&e.code==='KeyG')){e.preventDefault();editPath();return;}
  if(mod&&e.altKey&&e.code==='KeyC'){e.preventDefault();const s=[...picked];copyText(s.length?s.map(x=>x.path).join('\n'):curPath);return;}
  if(mod&&k.toLowerCase()==='d'){e.preventDefault();if(curPath){const had=!!findFav(curPath);toggleFav();zoomTip(had?'Usunięto z ulubionych':'Dodano do ulubionych');}return;}
  if((isMac&&e.metaKey&&(e.code==='BracketLeft'||e.code==='BracketRight'))||(!isMac&&e.altKey&&(k==='ArrowLeft'||k==='ArrowRight'))){
    e.preventDefault(); histGo(e.code==='BracketLeft'||k==='ArrowLeft'?-1:1); return; }
  if(mod&&!e.shiftKey&&e.code==='KeyZ'){e.preventDefault();undoTransfer();return;}
  if(mod&&!e.altKey&&(k==='='||k==='+'||k==='-'||k==='0')){e.preventDefault();if(k==='0')setSize(180,true);else zstep(k==='-'?-1:1);return;}
  if(mod&&!e.shiftKey&&!e.altKey&&(e.code==='KeyC'||e.code==='KeyX')&&api.transfer){
    const s=[...picked]; if(!s.length) return;
    if(e.code==='KeyX'&&virt==='basket'){ zoomTip('W koszyku pliki można skopiować, nie wyciąć'); return; }
    e.preventDefault(); clipSave({paths:s.map(x=>x.path),cut:e.code==='KeyX',text:s.map(x=>x.path).join('\n')});
    if(api.clipFiles) api.clipFiles(fileClip.paths); else navigator.clipboard.writeText(fileClip.text).catch(()=>{});
    zoomTip((fileClip.cut?'Wycięto ':'Skopiowano ')+s.length+' — wklej ('+(isMac?'⌘V':'Ctrl+V')+') w docelowym folderze'); return;
  }
  if(mod&&k==='Enter'){ e.preventDefault(); const s=[...picked].slice(0,12); for(const x of s) api.openDefault(x.path); return; }
  if(k==='F2'){ e.preventDefault(); const it=view[sel]; if(it) renameItem(it); return; }
  // usuwanie: w koszyku tylko wyjmuje z koszyka, gdzie indziej przenosi do Kosza systemu
  if((isMac&&mod&&!e.shiftKey&&k==='Backspace')||k==='Delete'){
    e.preventDefault(); const s=[...picked]; if(!s.length) return;
    if(virt==='basket'){ basketRemove(s.filter(x=>x.kind==='file')); SFX('tick'); zoomTip('Wyjęto z koszyka: '+s.length); }
    else if(api.trash&&(!isMac||k==='Backspace')) trashSel(s);
    return;
  }
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
  else if(k==='i'||k===']'||(mod&&e.altKey&&e.code==='KeyI')){e.preventDefault();setInsp(!S.insp);}
  else if(k==='\\'||k==='['||(mod&&e.altKey&&e.code==='KeyS')){e.preventDefault();setSide(S.side===false);}
  else if(k==='B'||(k==='b'&&e.shiftKey)){e.preventDefault();openBasket();}
  else if(k==='b'){const s=[...picked].filter(x=>x.kind==='file');if(s.length)basketToggle(s);else zoomTip('Zaznacz pliki, które mają trafić do koszyka');}
  else if(k==='Backspace'){e.preventDefault();goUp();}
  else if(k==='+'||k==='='){zstep(1);}
  else if(k==='-'){zstep(-1);}
  // lewa ręka (prawa zostaje na myszce): A D poprzedni/następny, Q w górę, E edycja, R pokaż w Finderze, F szukaj,
  // X panel boczny (⇧X informacje), C kopiuj obraz (⇧C ścieżki), V ikony/lista, 1 2 mniejsze/większe
  else if(e.code==='KeyA'){mv(-1);}
  else if(e.code==='KeyD'){mv(1);}
  else if(e.code==='KeyQ'){e.preventDefault();goUp();}
  else if(e.code==='KeyE'){const f=pickedFiles();if(f.length)openInEditor(f.map(x=>x.path));}
  else if(e.code==='KeyR'&&e.shiftKey){scan(true);zoomTip('Odświeżono');}
  else if(e.code==='KeyR'){const it=view[sel];if(it)api.showInFolder(it.path);else if(curPath)api.openDefault(curPath);}
  else if(e.code==='KeyF'){e.preventDefault();if(e.shiftKey&&api.libSearch){if(virt)closeVirt();setQIn('lib');}$('#q').focus();$('#q').select();}
  else if(e.code==='KeyX'){e.preventDefault();e.shiftKey?setInsp(!S.insp):setSide(S.side===false);}
  else if(e.code==='KeyC'&&e.shiftKey){const s=[...picked];copyText(s.length?s.map(x=>x.path).join('\n'):curPath||'');}
  else if(e.code==='KeyC'){const it=view[sel];if(it&&it.kind==='file')copyImage(it);}
  else if(e.code==='KeyV'){setMode(S.mode==='list'?'icons':'list');}
  else if(e.code==='Digit1'){zstep(-1);}
  else if(e.code==='Digit2'){zstep(1);}
  else if(k==='t'){cycleTheme();}
  else if(k==='g'&&!mod){setGridLines(!S.gridlines);zoomTip(S.gridlines?'Siatka włączona':'Siatka wyłączona');}
  else if(k==='s'&&!mod){S.sound=!(S.sound!==false);save();if(S.sound)SFX('on');zoomTip(S.sound?'Dźwięki włączone':'Dźwięki wyciszone');}
  else if(k==='N'||(k==='n'&&e.shiftKey)){setDirNames(!(S.dirNames!==false));}
  else if(k==='n'){setNames(!(S.names!==false));}
  else if(k==='l'){setMode(S.mode==='list'?'icons':'list');}
  else if(k==='/'){e.preventDefault();$('#q').focus();}
  else if(k==='Tab'){e.preventDefault();toggleBare();}
});
api.onMenu(a=>{ if(a==='open') pickFolder(); else if(a==='new-window') newWindow(); });
// nowe okno startuje w tym samym folderze; Koszyk i Ulubione są wspólne dla wszystkich okien
function newWindow(){ if(!api.newWindow){ zoomTip('Nowe okna są w programie, nie w przeglądarce'); return; } api.newWindow(virt?null:curPath); }
addEventListener('storage',e=>{
  if(e.key!=='podglad'||!e.newValue) return;
  let o; try{ o=JSON.parse(e.newValue); }catch(err){ return; }
  const favCh=JSON.stringify(o.favs||[])!==JSON.stringify(S.favs), bCh=JSON.stringify(o.basket||[])!==JSON.stringify(S.basket);
  if(favCh){ S.favs=o.favs||[]; renderSide(); for(const t of document.querySelectorAll('.tile.dir'))t._sync&&t._sync(); }
  if(bCh){ S.basket=o.basket||[]; bSet=new Set(S.basket.map(b=>bKey(b.path))); basketChanged(); }
});

/* --- Koszyk w panelu bocznym: klik otwiera, upuszczenie plików z siatki dodaje --- */
{ const r=$('#tray');
  r.onclick=openBasket;
  r.addEventListener('dragover',e=>{ e.preventDefault(); r.classList.add('drop'); });
  r.addEventListener('dragleave',e=>{ if(!r.contains(e.relatedTarget)) r.classList.remove('drop'); });
  const z=$('#bdrop');
  z.addEventListener('dragover',e=>{ if(draggingOut){ e.preventDefault(); z.classList.add('over'); } });
  z.addEventListener('dragleave',()=>z.classList.remove('over')); }
/* --- upuszczanie: na folder (kafelek, drzewo, ulubione) albo na siatkę bieżącego folderu przenosi lub kopiuje pliki,
       jak w Finderze: ten sam dysk — przenosi, inny dysk albo z Alt / ⌥ — kopiuje; ⌘Z / Ctrl+Z cofa --- */
let dragN=0, dropOn=null, dragSrc=null, dragSrcDev=null, dragCopy=false, dragSrcCopy=false;   // z koszyka zawsze kopiujemy
const devCache=new Map();
const hasFiles=e=>e.dataTransfer&&[...e.dataTransfer.types].includes('Files');
const dropLab=document.createElement('div'); dropLab.id='droplab'; document.body.appendChild(dropLab);
function dropTarget(e){
  const el=e.target&&e.target.closest?e.target:null; if(!el) return null;
  if(el.closest('#tray,#bdrop')) return {kind:'basket'};
  if(!api.transfer) return null;
  const t=el.closest('.tile.dir'); if(t&&t._it) return {kind:'dir',path:t._it.path,el:t,name:t._it.name};
  const li=el.closest('#tree li,#favs li,#places li'); if(li&&li.title&&!li.classList.contains('none')) return {kind:'dir',path:li.title,el:li,name:(li.querySelector('.nm')||li).textContent};
  if(el.closest('#main')&&curPath&&!virt&&!deep&&!libActive()) return {kind:'here',path:curPath,el:null,name:api.basename(curPath)||curPath};
  return null;
}
async function learnDrag(){            // co jest przeciągane: z tego okna wiemy od razu, z innego okna Gapy pytamy proces główny
  const cd=draggingOut?{files:lastOut,copy:dragCopy}:(api.currentDrag?await api.currentDrag():null);
  dragSrc=cd&&cd.files||null; dragSrcCopy=!!(cd&&cd.copy);
  dragSrcDev=null; if(dragSrc&&dragSrc.length&&api.devOf) dragSrcDev=(await api.devOf([dragSrc[0]]))[0];
}
function devOfDest(p){ if(devCache.has(p)) return devCache.get(p); devCache.set(p,undefined); if(api.devOf) api.devOf([p]).then(r=>devCache.set(p,r[0])); return undefined; }
function clearDrop(){ if(dropOn&&dropOn.el) dropOn.el.classList.remove('dropon'); dropOn=null; dropLab.classList.remove('on'); $('#tray').classList.remove('drop'); }
function showDrop(t,e){
  if(!dropOn||!t||dropOn.el!==t.el||dropOn.path!==t.path){ if(dropOn&&dropOn.el) dropOn.el.classList.remove('dropon'); dropOn=t; if(t&&t.el) t.el.classList.add('dropon'); }
  if(!t||t.kind==='basket'){ dropLab.classList.remove('on'); return; }
  const same=dragSrc&&dragSrc.length&&dragSrc.every(p=>samePath(api.dirname(p),t.path));
  if(same){ dropLab.classList.remove('on'); e.dataTransfer.dropEffect='none'; return; }
  let verb;
  if(e.altKey||dragSrcCopy) verb='Kopiuj';
  else { const d=devOfDest(t.path); verb=dragSrcDev==null||d==null?'Przenieś':(d===dragSrcDev?'Przenieś':'Kopiuj'); }
  e.dataTransfer.dropEffect=verb==='Kopiuj'?'copy':'move';
  dropLab.textContent=verb+' do „'+t.name+'”'+(verb==='Przenieś'&&!dragSrcCopy?'  ·  '+(isMac?'⌥':'Alt')+' kopiuje':'');
  dropLab.style.left=(e.clientX+16)+'px'; dropLab.style.top=(e.clientY+18)+'px'; dropLab.classList.add('on');
}
document.addEventListener('dragenter',e=>{ if(!hasFiles(e)) return; if(dragN++===0) learnDrag(); if(!curPath&&!draggingOut) document.body.dataset.drop='1'; });
document.addEventListener('dragleave',e=>{ if(!hasFiles(e)) return; if(--dragN<=0){ dragN=0; delete document.body.dataset.drop; clearDrop(); } });
document.addEventListener('dragover',e=>{ e.preventDefault(); if(hasFiles(e)) showDrop(dropTarget(e),e); });
function applyMoves(list){        // przeniesione pliki w koszyku dostają nowe ścieżki
  let ch=false;
  for(const r of list){ if(r.op!=='move'||!inBasket(r.from)) continue; const b=S.basket.find(x=>samePath(x.path,r.from)); if(b){ bItems.delete(b.path); b.path=r.to; b.name=api.basename(r.to); ch=true; } }
  if(ch){ bSet=new Set(S.basket.map(b=>bKey(b.path))); save(); basketChanged(); }
}
async function doTransfer(paths,t,mode){
  if(mode!=='copy') paths=paths.filter(p=>!samePath(api.dirname(p),t.path));
  if(!paths.length) return null;
  const r=await api.transfer(paths,t.path,mode||'auto');
  applyMoves(r.done);
  const mv=r.done.filter(x=>x.op==='move').length, cp=r.done.length-mv, a=[];
  if(mv) a.push('Przeniesiono '+mv); if(cp) a.push((mv?'skopiowano ':'Skopiowano ')+cp);
  SFX('tick');
  zoomTip(r.done.length?a.join(', ')+' do „'+t.name+'”'+(r.failed.length?' · nie udało się '+r.failed.length:'')+'  ·  '+(isMac?'⌘Z':'Ctrl+Z')+' cofa':'Nie udało się: '+(r.failed[0]&&r.failed[0].error||''));
  return r;
}
async function undoTransfer(){
  if(!api.undoTransfer) return;
  const r=await api.undoTransfer(); if(!r){ zoomTip('Nie ma czego cofnąć'); return; }
  applyMoves(r.back.filter(x=>x.op==='move'));
  SFX('tick'); zoomTip((r.op==='move'?'Cofnięto przeniesienie: ':'Cofnięto kopiowanie (kopie w Koszu): ')+r.back.length+(r.failed.length?' · nie udało się '+r.failed.length:''));
}
document.addEventListener('drop',async e=>{
  e.preventDefault(); dragN=0; delete document.body.dataset.drop;
  const t=dropTarget(e); clearDrop();
  const wasOut=draggingOut, outItems=lastOutItems, outPaths=lastOut; if(draggingOut) dragDone();
  // na koszyk: z tego okna, z innego okna Gapy, z Findera albo Eksploratora
  if(t&&t.kind==='basket'){
    if(wasOut){ const n=basketAdd(outItems); SFX('tick'); zoomTip(n?(n===1?'W koszyku':'Dodano do koszyka: '+n)+' · razem '+S.basket.length:'Już są w koszyku'); return; }
    if(!api.statFiles) return;
    const ps=[...e.dataTransfer.files].map(f=>api.pathForFile(f)).filter(p=>p&&EXT[extOf(p)]);
    if(!ps.length){ zoomTip('Do koszyka trafiają tylko obrazy i pliki, które Gapa pokazuje'); return; }
    const st=await api.statFiles(ps);
    const n=basketAdd(ps.map((p,k)=>st[k]&&{kind:'file',name:api.basename(p),path:p,size:st[k].size,mtime:st[k].mtime,type:EXT[extOf(p)],state:null}).filter(Boolean));
    SFX('tick'); zoomTip(n?(n===1?'W koszyku':'Dodano do koszyka: '+n)+' · razem '+S.basket.length:'Już są w koszyku'); return;
  }
  const dropped=wasOut?outPaths:[...e.dataTransfer.files].map(f=>api.pathForFile(f)).filter(Boolean);
  if(t&&(t.kind==='dir'||t.kind==='here')&&dropped.length){
    // pojedynczy folder z zewnątrz upuszczony na siatkę — otwieramy go, jak dotąd
    if(!wasOut&&t.kind==='here'&&dropped.length===1&&await api.exists(dropped[0])){ go(dropped[0]); return; }
    await doTransfer(dropped,t,e.altKey||dragSrcCopy?'copy':'auto'); return;
  }
  if(wasOut) return;
  if(api.addDropped){ const it=[...e.dataTransfer.items].find(i=>i.kind==='file'); if(it){ const p=await api.addDropped(it); if(p){ await loadRoots(); go(p); } } return; }
  const p=dropped[0]; if(!p) return;
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


/* --- okienko potwierdzenia w stylu programu (zamiast systemowego confirm) --- */
let dlgDone=null;
function askConfirm(title,body,ok){
  return new Promise(res=>{
    const o=$('#dlg'); o.innerHTML='<div class="dc"><b></b><p></p><div class="db"><button class="no">Anuluj</button><button class="yes"></button></div></div>';
    o.querySelector('b').textContent=title; o.querySelector('p').textContent=body; o.querySelector('.yes').textContent=ok||'OK';
    const end=v=>{ o.classList.remove('on'); dlgDone=null; res(v); };
    dlgDone=end; o.querySelector('.yes').onclick=()=>end(true); o.querySelector('.no').onclick=()=>end(false);
    o.onclick=e=>{ if(e.target===o) end(false); };
    o.classList.add('on'); o.querySelector('.yes').focus();
  });
}
/* --- ściąga skrótów (?) i jednorazowe podpowiedzi; opisy zależą od systemu (Mac / Windows) --- */
const KL={mod:isMac?'⌘':'Ctrl+',del:isMac?'⌘⌫':'Delete',back:isMac?'⌘[':'Alt+←',fwd:isMac?'⌘]':'Alt+→',wheel:isMac?'⌘ + kółko albo szczypnięcie':'Ctrl + kółko'};
function renderKeys(){
  const K=(k,t,c)=>'<div class="k'+(c?' '+c:'')+'"><i>'+k+'</i><small>'+t+'</small></div>';
  const row=(m,ks)=>'<div class="kr" style="margin-left:'+m+'px">'+ks.join('')+'</div>';
  $('#keys').innerHTML='<div class="kc"><div class="kh"><b>Skróty klawiszowe</b><span>? otwiera tę ściągę · Esc zamyka</span></div>'
    +row(0,[K('1','mniejsze'),K('2','większe')])
    +row(20,[K('Q','wyżej'),K('W','wszystko w środku'),K('E','Photoshop'),K('R',isMac?'Finder':'Eksplorator'),K('T','jasny / ciemny')])
    +row(34,[K('A','poprzedni'),K('S','dźwięki'),K('D','następny'),K('F','szukaj<em>⇧ biblioteka</em>'),K('G','linie siatki')])
    +row(54,[K('Z','100% / dopasuj'),K('X','panel<em>⇧ info</em>'),K('C','kopiuj obraz<em>⇧ ścieżki</em>'),K('V','ikony / lista'),K('B','koszyk<em>⇧ otwórz</em>')])
    +row(0,[K('Tab','ukryj interfejs','w'),K('spacja','podgląd / wróć do siatki','sp')])
    +'<div class="km">'+[[KL.mod+'N','nowe okno'],[KL.back+' '+KL.fwd,'wstecz / dalej'],[KL.wheel,'wielkość miniatur'],[KL.del,'przenieś do Kosza'],[KL.mod+'L','wpisz ścieżkę'],[KL.mod+'D','dodaj do ulubionych']]
      .map(([k,t])=>'<div><kbd>'+k+'</kbd>'+t+'</div>').join('')+'</div></div>';
}
function toggleKeys(v){ const o=$('#keys'); v=v===undefined?!o.classList.contains('on'):v; if(v){ renderKeys(); hideHint(); } o.classList.toggle('on',v); if(v&&!S.seenKeys){ S.seenKeys=true; save(); } }
$('#keys').addEventListener('click',e=>{ if(!e.target.closest('.kc')) toggleKeys(false); });
// podpowiedź pokazuje się raz w życiu programu, przy elemencie, którego dotyczy
S.hints=S.hints||{};
let hintEl=null, hintT=0, hintId=null;
function hideHint(){ clearTimeout(hintT); if(hintEl){ const h=hintEl; h.classList.remove('on'); setTimeout(()=>h.remove(),200); hintEl=null; hintId=null; } }
function hintDone(id){ if(!S.hints[id]){ S.hints[id]=1; save(); } if(hintId===id) hideHint(); }
function hint(id,anchor,html,where){
  if(PEEK||S.hints[id]||hintEl||$('#keys').classList.contains('on')) return;
  const r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():anchor; if(!r||!r.width) return;
  S.hints[id]=1; save();
  const h=document.createElement('div'); h.className='hint'; h.innerHTML=html+'<button aria-label="Zamknij">×</button>';
  h.lastChild.onclick=hideHint; document.body.appendChild(h);
  const b=h.getBoundingClientRect();
  let x=r.left+r.width/2-b.width/2, y=where==='above'?r.top-b.height-10:r.bottom+10;
  if(where==='right'){ x=r.right+10; y=r.top+r.height/2-b.height/2; }
  h.style.left=Math.max(10,Math.min(x,innerWidth-b.width-10))+'px'; h.style.top=Math.max(10,Math.min(y,innerHeight-b.height-10))+'px';
  requestAnimationFrame(()=>h.classList.add('on'));
  hintEl=h; hintId=id; hintT=setTimeout(hideHint,9000);
}
function resetHints(){ S.hints={}; S.seenKeys=false; save(); zoomTip('Podpowiedzi pokażą się od nowa'); }

/* --- start --- */
$('#empty-open').onclick=pickFolder;
markSort(); markModes(); setNames(S.names!==false); setDirNames(S.dirNames!==false); setGridLines(!!S.gridlines); setSide(S.side!==false); setInsp(!!S.insp);
renderSide(); renderCrumbs(); renderTypes(); cacheInfo(); renderBasketNav(); libSync(); setShowMem(!!S.showMem);
if(!S.seenKeys&&!api.startPath&&!PEEK) setTimeout(()=>{ if(!S.seenKeys) toggleKeys(true); },1400);
/* --- tryb podglądu: otwiera wskazany plik, strzałki w Eksploratorze przesuwają podgląd --- */
// kilka zaznaczonych plików: arkusz ze wszystkimi naraz; klik / Enter otwiera jeden, strzałki chodzą tylko po zaznaczonych
let sheet=null;                       // {list, at} gdy pokazujemy podgląd kilku plików
async function peekLoad(d,paths){
  if(!samePath(curPath,d)||!paths.every(p=>items.some(x=>samePath(x.path,p)))){
    go(d,paths[0]);
    for(let i=0;i<80&&!paths.every(p=>items.some(x=>samePath(x.path,p)));i++) await new Promise(r=>setTimeout(r,40));
  }
}
async function peekOpen(p){
  if(p&&typeof p==='object'){
    if(!(p.paths&&p.paths.length>1)) return peekOpen(p.path);
    await peekLoad(api.dirname(p.paths[0]),p.paths);
    const list=p.paths.map(x=>items.find(y=>samePath(y.path,x))).filter(Boolean);
    if(list.length<2) return list[0]?peekOpen(list[0].path):undefined;
    sheet={list,at:Math.max(0,list.findIndex(x=>samePath(x.path,p.path)))};
    vList=list; vi=sheet.at;
    if(!viewer.classList.contains('open')){ viewer.classList.add('open'); chromeSync(); }
    renderSheet(); return;
  }
  sheet=null;
  const d=api.dirname(p);
  if(!samePath(curPath,d)||!items.some(x=>samePath(x.path,p))){
    go(d,p);
    for(let i=0;i<80&&!items.some(x=>samePath(x.path,p));i++) await new Promise(r=>setTimeout(r,40));
  }
  const it=items.find(x=>samePath(x.path,p)); if(!it) return;
  if(viewer.classList.contains('open')){ const k=vList.indexOf(it); if(k>=0){ if(k!==vi){ vi=k; showV(); } return; } }
  openViewer(it);
}
if(PEEK){
  document.body.classList.add('peekmode'); S.types={}; S.insp=false;
  api.onPeekOpen(p=>peekOpen(p));
  api.onPeekHidden(()=>{ peekClosing=true; closeViewer(); peekClosing=false; sheet=null; });
  // klawisze przechwycone w Eksploratorze przy podglądzie kilku plików
  if(api.onPeekKey) api.onPeekKey(k=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:k,code:k,bubbles:true})));
}
function sheetCols(n){                // tyle kolumn, żeby obrazy 4:3 były jak największe
  // rozmiar sceny bywa chwilowo zerowy (np. tuż po wejściu w pełny ekran) — wtedy liczymy od okna
  const r=stage.getBoundingClientRect(), W=Math.max(r.width,innerWidth*0.6)-48, H=Math.max(r.height,innerHeight*0.6)-32;   // bez marginesów sceny
  let best=1,bs=0;
  // kolumny dobrane tak, żeby zdjęcia (średnio ok. 4:3) były jak największe
  for(let c=1;c<=n;c++){ const rows=Math.ceil(n/c), cw=(W-18*(c-1))/c, ch=(H-18*(rows-1))/rows-24, sz=Math.min(cw,ch*4/3); if(sz>bs){bs=sz;best=c;} }
  return best;
}
function renderSheet(){
  if(!sheet) return;
  vTok++; zm=null; vEl=null; stopMedia(); stage.className='sheetmode'; stage.textContent='';
  $('#vname').textContent='Zaznaczone pliki'; $('#vname').title=''; $('#vinfo').textContent=api.dirname(sheet.list[0].path);
  $('#vcount').textContent=sheet.list.length+' '+plural(sheet.list.length,'plik','pliki','plików');
  // arkusz zawsze mieści się w oknie: stała siatka kolumn × wierszy, każde zdjęcie wpasowane w swoje pole
  const nc=sheetCols(sheet.list.length), nr=Math.ceil(sheet.list.length/nc);
  const g=document.createElement('div'); g.className='sheet'; g.style.gridTemplateColumns='repeat('+nc+',minmax(0,1fr))'; g.style.gridTemplateRows='repeat('+nr+',minmax(0,1fr))';
  sheet.list.forEach((it,i)=>{
    const c=document.createElement('div'); c.className='sc'+(i===sheet.at?' on':''); c.title=it.name;
    const b=document.createElement('div'); b.className='sb'; c.appendChild(b);
    const n=document.createElement('div'); n.className='sn'; n.textContent=it.name; c.appendChild(n);
    c.onclick=e=>{ e.stopPropagation(); sheet.at=i; sheetOpen(); };
    g.appendChild(c);
    const put=cv=>{ b.textContent=''; b.appendChild(cv); fitSheet(cv,b); };
    const draw=()=>{ if(!it.thumb) return; const k=document.createElement('canvas'); k.width=it.thumb.width; k.height=it.thumb.height; k.getContext('2d').drawImage(it.thumb,0,0); put(k);
      // większa komórka niż miniatura — ostrzejsza wersja w rozdzielczości komórki
      requestAnimationFrame(async()=>{ const need=Math.min(2048,Math.ceil(Math.max(b.clientWidth,b.clientHeight)*devicePixelRatio));
        if(need>Math.max(it.thumb.width,it.thumb.height)*1.1&&it.type!=='vid'&&!DOCS.has(it.type)){ try{ const h=(it.hd&&it.hd.size>=need*0.9)?it.hd.c:await hdMake(it,need); if(h&&sheet&&b.isConnected){ const k2=document.createElement('canvas'); k2.width=h.width; k2.height=h.height; k2.getContext('2d').drawImage(h,0,0); put(k2); } }catch(e){} } }); };
    if(it.thumb) draw(); else thumbOf(it).then(()=>{ it.state='done'; draw(); },()=>{ b.textContent=extOf(it.name); });
  });
  stage.appendChild(g);
}
function fitSheet(cv,b){ const W=b.clientWidth, H=b.clientHeight; if(!W||!H) return requestAnimationFrame(()=>fitSheet(cv,b)); const k=Math.min(W/cv.width,H/cv.height); cv.style.width=Math.floor(cv.width*k)+'px'; cv.style.height=Math.floor(cv.height*k)+'px'; }
let sheetRT=0; addEventListener('resize',()=>{ clearTimeout(sheetRT); sheetRT=setTimeout(()=>{ if(inSheet()) renderSheet(); },120); });
function sheetOpen(){ if(!sheet) return; vList=sheet.list; vi=sheet.at; stage.className='fit'; showV(); }
function sheetMark(){ stage.querySelectorAll('.sc').forEach((x,i)=>x.classList.toggle('on',i===sheet.at)); }
const inSheet=()=>!!(sheet&&stage.classList.contains('sheetmode'));
// ustawienia podglądu spacją (tylko Windows)
let peekState=null; if(api.peekGet&&!PEEK) api.peekGet().then(r=>{ peekState=r; });
loadRoots().then(async()=>{ if(PEEK){ if(!api.peekMulti) peekOpen(api.peekPath); return; } const sp=api.startPath; if(sp&&await api.exists(sp)) go(sp); else if(S.last&&await api.exists(S.last)) go(S.last); else { render(); syncTree(); } });
