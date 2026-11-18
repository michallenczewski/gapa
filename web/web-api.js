/* Podgląd w przeglądarce: zastępuje most Electronu (preload.js).
   Foldery otwierane przez File System Access API (Chrome/Edge), miniatury w IndexedDB.
   Ścieżki są wirtualne: /<nazwa folderu>/podfolder/plik. */
(()=>{
  if(window.api) return;
  const handles=new Map();   // ścieżka → uchwyt folderu lub pliku
  const files=new Map();     // ścieżka → File
  const urls=new Map();      // ścieżka → blob: URL
  let roots=[];              // [{name,path,handle}]
  let tip=null;
  const say=t=>{ if(typeof zoomTip==='function') zoomTip(t); };
  const onlyApp=()=>say('Dostępne w programie Gapa');

  const db=new Promise((res,rej)=>{const r=indexedDB.open('podglad-web',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('roots',{keyPath:'name'});d.createObjectStore('thumbs',{keyPath:'k'}).createIndex('t','t');};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const tx=async(store,mode,fn)=>{const d=await db;return new Promise((res,rej)=>{const t=d.transaction(store,mode);const r=fn(t.objectStore(store));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});};

  const dirname=p=>{const s=p.replace(/\/+$/,'');const i=s.lastIndexOf('/');return i<=0?'/':s.slice(0,i);};
  const basename=p=>p.replace(/\/+$/,'').split('/').pop()||'/';
  const join=(a,b)=>a.replace(/\/+$/,'')+'/'+b;

  async function permitted(h,ask){
    try{ let p=await h.queryPermission({mode:'read'}); if(p!=='granted'&&ask) p=await h.requestPermission({mode:'read'}); return p==='granted'; }catch(e){ return true; }
  }
  async function loadRoots(){
    try{ const rs=await tx('roots','readonly',s=>s.getAll())||[]; for(const r of rs){ const p='/'+r.name; if(!roots.find(x=>x.path===p)){ roots.push({name:r.name,path:p,handle:r.handle}); handles.set(p,r.handle);} } }catch(e){}
  }
  async function addRoot(h){
    for(const r of roots){ try{ if(await r.handle.isSameEntry(h)) return r.path; }catch(e){} }
    let name=h.name, k=2; while(roots.find(r=>r.name===name)) name=h.name+' ('+(k++)+')';
    const p='/'+name; roots.push({name,path:p,handle:h}); handles.set(p,h);
    tx('roots','readwrite',s=>s.put({name,handle:h})).catch(()=>{});
    return p;
  }
  // uchwyt dla ścieżki: korzeń + kolejne podfoldery
  async function resolve(p,ask){
    if(handles.has(p)){ const h=handles.get(p); const r=roots.find(x=>p===x.path||p.startsWith(x.path+'/')); if(r&&!(await permitted(r.handle,ask))) return null; return h; }
    const r=roots.find(x=>p===x.path||p.startsWith(x.path+'/')); if(!r) return null;
    if(!(await permitted(r.handle,ask))) return null;
    let h=r.handle, acc=r.path;
    for(const seg of p.slice(r.path.length).split('/').filter(Boolean)){
      try{ h=await h.getDirectoryHandle(seg); }catch(e){ return null; }
      acc+='/'+seg; handles.set(acc,h);
    }
    return h;
  }

  document.documentElement.classList.add('web');
  window.api={
    platform:/Mac/.test(navigator.platform)?'darwin':'win32', sep:'/', web:true,
    dirname, basename, parse:p=>{const r=roots.find(x=>p===x.path||p.startsWith(x.path+'/'));return {root:r?r.path+'/':'/'};},
    fileUrl:p=>{ if(urls.has(p)) return urls.get(p); const f=files.get(p); if(!f) return ''; const u=URL.createObjectURL(/\.pdf$/i.test(p)&&f.type!=='application/pdf'?new Blob([f],{type:'application/pdf'}):f); urls.set(p,u); return u; },

    async list(dir,exts){
      const h=await resolve(dir,true); if(!h) return {error:'brak dostępu do folderu',dirs:[],files:[]};
      const ok=new Set(exts||[]), ds=[], fs=[];
      try{
        for await(const e of h.values()){
          if(e.name.startsWith('.')) continue;
          const p=join(dir,e.name);
          if(e.kind==='directory'){ handles.set(p,e); ds.push({name:e.name,path:p}); continue; }
          const i=e.name.lastIndexOf('.'); if(i<0||(ok.size&&!ok.has(e.name.slice(i+1).toLowerCase()))) continue;
          try{ const f=await e.getFile(); if(files.get(p)!==f&&urls.has(p)){URL.revokeObjectURL(urls.get(p));urls.delete(p);} files.set(p,f); fs.push({name:f.name,path:p,size:f.size,mtime:f.lastModified}); }catch(err){}
        }
      }catch(err){ return {error:err.message,dirs:ds,files:fs}; }
      return {dirs:ds,files:fs};
    },
    async exists(p){ return !!(await resolve(p,false)); },
    async resolvePath(raw){
      const p=String(raw||'').trim().replace(/^["']|["']$/g,'').replace(/\/+$/,'');
      if(!p) return null;
      if(await resolve(p,false)) return {dir:p};
      const i=p.lastIndexOf('/'); if(i>0&&await resolve(p.slice(0,i),false)) return {dir:p.slice(0,i),file:p};
      return null;
    },
    async roots(){ await loadRoots(); return roots.map(r=>({name:r.name,path:r.path,drive:false})); },
    async pickFolder(){
      if(!window.showDirectoryPicker){ say('Ta przeglądarka nie otwiera folderów — użyj Chrome albo Edge'); return null; }
      try{ const h=await showDirectoryPicker({id:'podglad',mode:'read'}); const p=await addRoot(h); if(typeof loadRoots==='function') setTimeout(()=>window.dispatchEvent(new Event('podglad-roots')),0); return p; }catch(e){ return null; }
    },
    async addDropped(item){ // folder upuszczony na okno
      try{ const h=await item.getAsFileSystemHandle(); if(h&&h.kind==='directory') return addRoot(h); }catch(e){} return null;
    },
    watch:async()=>{}, onDirChanged:()=>{}, onMenu:()=>{},

    async thumbGet(k){
      const key=k.path+'|'+k.size+'|'+k.mtime;
      const r=await tx('thumbs','readonly',s=>s.get(key)).catch(()=>null);
      if(!r) return null;
      return {url:URL.createObjectURL(r.blob),dims:r.dims,meta:r.meta,hash:key};
    },
    async thumbPut(k,buf,dims,meta){
      const key=k.path+'|'+k.size+'|'+k.mtime;
      await tx('thumbs','readwrite',s=>s.put({k:key,t:Date.now(),blob:new Blob([buf],{type:'image/webp'}),dims,meta,s:buf.byteLength})).catch(()=>{});
    },
    thumbForget:async h=>{ await tx('thumbs','readwrite',s=>s.delete(h)).catch(()=>{}); },
    async cacheInfo(){
      let count=0,bytes=0;
      await tx('thumbs','readonly',s=>{const r=s.openCursor();r.onsuccess=()=>{const c=r.result;if(c){count++;bytes+=c.value.s||0;c.continue();}};}).catch(()=>{});
      return {count,bytes,limitMB:+(localStorage.getItem('podglad-limit')||2048),dir:'pamięć przeglądarki'};
    },
    cacheClear:async()=>{ await tx('thumbs','readwrite',s=>s.clear()).catch(()=>{}); },
    cacheChoose:async()=>{ say('Wybór folderu na miniatury jest w programie'); return null; },
    cacheLimit:async mb=>{ localStorage.setItem('podglad-limit',String(mb)); },
    cacheReveal:onlyApp,

    showInFolder:onlyApp, openDefault:onlyApp,
    openEditor:async()=>{ onlyApp(); return null; },
    editorName:async()=>null,
    dragOut:()=>{},
    osThumb:async()=>null,
    fileHref:p=>window.api.fileUrl(p),
    pathForFile:()=>null
  };
})();
