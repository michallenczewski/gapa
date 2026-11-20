// Podgląd — proces główny: okno, dostęp do dysku, pamięć miniatur, integracja z systemem.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, nativeImage, Menu, Tray, screen, clipboard, powerMonitor, powerSaveBlocker, net } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');
const { spawn, execFile } = require('child_process');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

// pgf://f/<ścieżka>  — pliki z dysku (z obsługą zakresów, żeby PSD czytać kawałkami)
// pgf://c/<plik>     — miniatury z pamięci
protocol.registerSchemesAsPrivileged([{
  scheme: 'pgf',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true }
}]);

/* ---------- ustawienia ---------- */
// Program nazywa się „Gapa” (wcześniej „Podgląd”). Ustawienia i miniatury zostają w dotychczasowym folderze,
// żeby nic nie przepadło. Nazwy paczek są bez polskich znaków — „ą” w pakiecie macOS wywracało Electron przy starcie.
app.setPath('userData', path.join(app.getPath('appData'), process.platform === 'win32' ? 'Podgląd' : 'Podglad'));
const settingsFile = () => path.join(app.getPath('userData'), 'ustawienia.json');
let settings = { cacheDir: null, cacheLimitMB: 2048, editor: null, bounds: null, maximized: false, icon: '3d' };
function loadSettings() {
  try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {}
}
function saveSettings() {
  try { fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); } catch (e) {}
}

/* ---------- pamięć miniatur na dysku ---------- */
// Każda miniatura to plik .webp w podfolderze cacheDir/ab/, nazwany skrótem ścieżki, rozmiaru i daty zmiany.
// Indeks (wymiary, format, czas użycia, rozmiar) trzymamy w jednym pliku indeks.json.
const CACHE_VER = 'v2';
let cacheDir = '';
let idx = { items: {} };
let idxDirty = false, idxTimer = null, cacheBytes = 0;

function defaultCacheDir() { return path.join(app.getPath('userData'), 'miniatury'); }
function openCache(dir) {
  cacheDir = dir || defaultCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });
  try { idx = JSON.parse(fs.readFileSync(path.join(cacheDir, 'indeks.json'), 'utf8')); } catch (e) { idx = { items: {} }; }
  if (!idx.items) idx.items = {};
  // 0.9.0 źle odczytywała skompresowane podglądy Rhino: jednorazowo usuwamy miniatury plików .3dm
  // i większe wersje miniatur zapisane od tamtej wersji, żeby policzyły się od nowa
  if (idx.fix !== 2) {
    for (const [h, e] of Object.entries(idx.items)) {
      const m = e.m || {};
      if ((m.hd && !m.format) || /3DM|RHINO/i.test(m.format || '')) { try { fs.unlinkSync(path.join(cacheDir, h.slice(0, 2), h + '.webp')); } catch (err) {} delete idx.items[h]; }
    }
    idx.fix = 2; idxDirty = true; setTimeout(saveIndexNow, 1000);
  }
  cacheBytes = Object.values(idx.items).reduce((a, e) => a + (e.s || 0), 0);
}
function saveIndexSoon() {
  idxDirty = true;
  if (idxTimer) return;
  idxTimer = setTimeout(saveIndexNow, 3000);
}
function saveIndexNow() {
  clearTimeout(idxTimer); idxTimer = null;
  if (!idxDirty) return; idxDirty = false;
  try {
    const tmp = path.join(cacheDir, 'indeks.json.tmp');
    fs.writeFileSync(tmp, JSON.stringify(idx));
    fs.renameSync(tmp, path.join(cacheDir, 'indeks.json'));
  } catch (e) {}
}
const keyHash = k => crypto.createHash('sha1').update(CACHE_VER + '|' + k.path + '|' + k.size + '|' + k.mtime).digest('hex');
const thumbFile = h => path.join(cacheDir, h.slice(0, 2), h + '.webp');

function prune() {
  const limit = (settings.cacheLimitMB || 2048) * 1048576;
  if (cacheBytes <= limit) return;
  const target = limit * 0.9;
  const list = Object.entries(idx.items).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  for (const [h, e] of list) {
    if (cacheBytes <= target) break;
    try { fs.unlinkSync(thumbFile(h)); } catch (err) {}
    cacheBytes -= e.s || 0; delete idx.items[h];
  }
  saveIndexSoon();
}

// przeniesienie albo kopia pliku w Gapie: miniatury (zwykła i większa „|hd”) idą za plikiem, zamiast liczyć się od nowa
async function cacheCarry(from, to, copy) {
  const one = async (a, b, st) => {
    for (const suf of ['', '|hd']) {
      const k = { size: st.size, mtime: Math.round(st.mtimeMs) };
      const h = keyHash({ path: a + suf, ...k }), e = idx.items[h]; if (!e) continue;
      const nh = keyHash({ path: b + suf, ...k }); if (nh === h || idx.items[nh]) continue;
      try {
        await fsp.mkdir(path.dirname(thumbFile(nh)), { recursive: true });
        if (copy) { await fsp.copyFile(thumbFile(h), thumbFile(nh)); idx.items[nh] = { ...e, t: Date.now() }; cacheBytes += e.s || 0; }
        else { await fsp.rename(thumbFile(h), thumbFile(nh)); idx.items[nh] = e; delete idx.items[h]; }
      } catch (err) {}
    }
  };
  try {
    const st = await fsp.stat(to);
    if (st.isFile()) await one(from, to, st);
    else if (st.isDirectory()) {                       // cały folder: idziemy po plikach w środku (najwyżej 20 000)
      let n = 0; const walk = async rel => {
        let ents; try { ents = await fsp.readdir(path.join(to, rel), { withFileTypes: true }); } catch (err) { return; }
        for (const d of ents) { if (n > 20000) return; const r = rel ? path.join(rel, d.name) : d.name;
          if (d.isDirectory()) await walk(r); else if (d.isFile()) { n++; try { await one(path.join(from, r), path.join(to, r), await fsp.stat(path.join(to, r))); } catch (err) {} } }
      };
      await walk('');
    }
    saveIndexSoon();
  } catch (err) {}
}
ipcMain.handle('thumb-get', (e, k) => {
  const h = keyHash(k), it = idx.items[h];
  if (!it) return null;
  it.t = Date.now(); saveIndexSoon();
  return { url: 'pgf://c/' + h.slice(0, 2) + '/' + h + '.webp', dims: it.d || null, meta: it.m || null, hash: h };
});
ipcMain.handle('thumb-put', async (e, k, buf, dims, meta) => {
  const h = keyHash(k), f = thumbFile(h);
  try {
    await fsp.mkdir(path.dirname(f), { recursive: true });
    await fsp.writeFile(f, Buffer.from(buf));
    const old = idx.items[h]; if (old) cacheBytes -= old.s || 0;
    idx.items[h] = { d: dims || null, m: meta || null, t: Date.now(), s: buf.byteLength };
    cacheBytes += buf.byteLength; saveIndexSoon(); prune();
  } catch (err) {}
});
ipcMain.handle('thumb-forget', (e, h) => { const it = idx.items[h]; if (it) { cacheBytes -= it.s || 0; delete idx.items[h]; saveIndexSoon(); } });
ipcMain.handle('cache-info', () => ({ count: Object.keys(idx.items).length, bytes: cacheBytes, limitMB: settings.cacheLimitMB || 2048, dir: cacheDir }));
ipcMain.handle('cache-clear', async () => {
  saveIndexNow();
  for (const d of await fsp.readdir(cacheDir).catch(() => [])) {
    if (/^[0-9a-f]{2}$/.test(d)) await fsp.rm(path.join(cacheDir, d), { recursive: true, force: true }).catch(() => {});
  }
  idx = { items: {} }; cacheBytes = 0; idxDirty = true; saveIndexNow();
});
// ikona programu: „3d” (domyślna) albo „retro”; na Macu podmieniamy ikonę w Docku na czas działania programu
// na Windows ikona bez marginesów macOS — inaczej na pasku zadań wychodzi za mała
const iconFile = n => path.join(__dirname, 'renderer', (n === 'retro' ? 'icon-retro' : 'icon') + (process.platform === 'win32' ? '-win' : '') + '.png');
function applyIcon() {
  const img = nativeImage.createFromPath(iconFile(settings.icon));
  if (process.platform === 'darwin') app.dock.setIcon(img);
  else { for (const w of BrowserWindow.getAllWindows()) w.setIcon(img); winShortcutIcons(); }
}
// Windows: pasek zadań i menu Start biorą ikonę ze skrótów (.lnk), nie z okna — podmieniamy ją w skrótach Gapy.
// Plik .ico kopiujemy z programu do folderu ustawień, bo skrót nie umie wskazać pliku wewnątrz paczki programu.
function winShortcutIcons() {
  if (!isWin) return;
  try {
    const retro = settings.icon === 'retro';
    let icon = process.execPath;
    if (retro) {
      icon = path.join(app.getPath('userData'), 'gapa-1bit.ico');
      fs.writeFileSync(icon, fs.readFileSync(path.join(__dirname, 'renderer', 'icon-retro-win.ico')));
    }
    const ad = app.getPath('appData'), pd = process.env.ProgramData || 'C:\\ProgramData', pub = path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop');
    const links = [
      path.join(ad, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Gapa.lnk'),
      path.join(pd, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Gapa.lnk'),
      path.join(app.getPath('desktop'), 'Gapa.lnk'), path.join(pub, 'Gapa.lnk'),
      path.join(ad, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar', 'Gapa.lnk'),
    ];
    for (const l of links) {
      if (!fs.existsSync(l)) continue;
      try {
        const cur = shell.readShortcutLink(l);
        if ((cur.icon || '').toLowerCase() === icon.toLowerCase()) continue;
        shell.writeShortcutLink(l, 'update', { icon, iconIndex: 0 });
      } catch (e) {}   // skrót w ProgramData bywa tylko do odczytu — wtedy zostaje jak był
    }
  } catch (e) {}
}
ipcMain.handle('icon-get', () => settings.icon || '3d');
ipcMain.handle('icon-set', (e, n) => { settings.icon = n === 'retro' ? 'retro' : '3d'; saveSettings(); applyIcon(); return settings.icon; });
ipcMain.handle('cache-limit', (e, mb) => { settings.cacheLimitMB = Math.max(100, mb | 0); saveSettings(); prune(); });
ipcMain.handle('cache-choose', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    title: 'Folder na miniatury', properties: ['openDirectory', 'createDirectory'], defaultPath: cacheDir
  });
  if (r.canceled || !r.filePaths[0]) return null;
  saveIndexNow();
  settings.cacheDir = path.join(r.filePaths[0], 'Podglad-miniatury'); saveSettings();
  openCache(settings.cacheDir);
  return cacheDir;
});
ipcMain.handle('cache-reveal', () => shell.openPath(cacheDir));

/* ---------- dysk ---------- */
ipcMain.handle('list', async (e, dir, exts) => {
  const ok = new Set(exts || []);
  const skip = new Set(['$RECYCLE.BIN', 'System Volume Information', '$Recycle.Bin', 'node_modules']);
  try {
    const ents = await fsp.readdir(dir, { withFileTypes: true });
    const dirs = [], files = [], other = new Map();
    await Promise.all(ents.map(async d => {
      if (d.name.startsWith('.') || skip.has(d.name)) return;
      const p = path.join(dir, d.name);
      let isDir = d.isDirectory(), isFile = d.isFile();
      // dowiązania, pliki z OneDrive / chmury i niektóre dyski sieciowe nie podają typu od razu — wtedy pytamy system o szczegóły
      if (d.isSymbolicLink() || (!isDir && !isFile)) { try { const s = await fsp.stat(p); isDir = s.isDirectory(); isFile = s.isFile(); } catch (err) { return; } }
      if (isDir) { dirs.push({ name: d.name, path: p }); return; }
      if (!isFile) return;
      const i = d.name.lastIndexOf('.'); if (i < 0) return;
      const ext = d.name.slice(i + 1).toLowerCase();
      if (ok.size && !ok.has(ext)) { other.set(ext, (other.get(ext) || 0) + 1); return; }
      try { const s = await fsp.stat(p); files.push({ name: d.name, path: p, size: s.size, mtime: Math.round(s.mtimeMs) }); } catch (err) {}
    }));
    return { dirs, files, other: [...other].sort((a, b) => b[1] - a[1]) };
  } catch (err) { return { error: err.code === 'EACCES' || err.code === 'EPERM' ? 'brak dostępu do folderu' : err.message, dirs: [], files: [] }; }
});
// wklejona ścieżka: zdejmij cudzysłowy, rozwiń ~ i file://, sprawdź, czy to folder czy plik
ipcMain.handle('resolve-path', async (e, raw) => {
  let p = String(raw || '').trim().replace(/^["']|["']$/g, '');
  if (p.startsWith('file://')) { try { p = require('url').fileURLToPath(p); } catch (_) {} }
  if (p === '~' || p.startsWith('~/')) p = path.join(require('os').homedir(), p.slice(1));
  if (!p) return null;
  p = path.resolve(p);
  try { const st = await fsp.stat(p); return st.isDirectory() ? { dir: p } : { dir: path.dirname(p), file: p }; } catch (err) { return null; }
});
// usuwanie: zawsze do Kosza, nigdy na stałe
ipcMain.handle('trash', async (e, paths) => {
  const done = [], failed = [];
  for (const p of paths) { try { await shell.trashItem(p); done.push(p); } catch (err) { failed.push({ path: p, error: err.message }); } }
  return { done, failed };
});
// zapis nowego pliku obok oryginału; gdy nazwa zajęta — „nazwa (2).jpg”
ipcMain.handle('write-new', async (e, dir, name, buf) => {
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name), i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  await fsp.writeFile(p, Buffer.from(buf));
  return p;
});
// świeże dane plików (koszyk, wyniki z indeksu): null, gdy pliku już nie ma
async function statMany(paths) {
  const out = new Array(paths.length).fill(null); let i = 0;
  await Promise.all(Array.from({ length: 24 }, async () => {
    while (i < paths.length) { const k = i++; try { const s = await fsp.stat(paths[k]); if (s.isFile()) out[k] = { size: s.size, mtime: Math.round(s.mtimeMs) }; } catch (err) {} }
  }));
  return out;
}
ipcMain.handle('stat-files', (e, paths) => statMany(paths || []));
// kopiowanie zebranych plików do folderu projektu; zajęta nazwa → „nazwa (2).jpg”, nic nie jest nadpisywane
ipcMain.handle('copy-to', async (e, paths, dir) => {
  const done = [], failed = [];
  for (const src of paths) {
    const ext = path.extname(src), base = path.basename(src, ext);
    let p = path.join(dir, base + ext), n = 2;
    try {
      for (;;) {
        try { await fsp.copyFile(src, p, fs.constants.COPYFILE_EXCL); break; }
        catch (err) { if (err.code !== 'EEXIST') throw err; p = path.join(dir, `${base} (${n++})${ext}`); }
      }
      done.push(p);
    } catch (err) { failed.push({ path: src, error: err.message }); }
  }
  return { done, failed };
});

/* ---------- indeks biblioteki: nazwy plików we wszystkich ulubionych folderach ---------- */
// Zapamiętujemy tylko nazwy (bez odczytu dat i rozmiarów), więc przejście nawet przez setki tysięcy plików trwa krótko.
// Rozmiar i datę sprawdzamy dopiero dla znalezionych wyników.
const libFile = () => path.join(app.getPath('userData'), 'biblioteka.json');
let lib = { exts: [], roots: {} };        // root → { t, dirs:[ścieżki względne], files:[[nr folderu, nazwa]] }
let libLc = new Map();                     // root → { dirs:[małe litery], names:[małe litery] } — do szukania
let libWant = [];                          // foldery, które interfejs chce mieć w indeksie
const libBusy = new Map();                 // root → liczba plików znalezionych do tej pory
const lcn = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
const LIB_STALE = 10 * 60 * 1000;
function libLoad() {
  try { const j = JSON.parse(fs.readFileSync(libFile(), 'utf8')); if (j && j.roots) lib = j; } catch (e) {}
  for (const r of Object.keys(lib.roots)) libPrep(r);
}
function libPrep(r) { const x = lib.roots[r]; libLc.set(r, { dirs: x.dirs.map(lcn), names: x.files.map(f => lcn(f[1])) }); }
let libSaveT = 0;
function libSave() { clearTimeout(libSaveT); libSaveT = setTimeout(() => fsp.writeFile(libFile(), JSON.stringify(lib)).catch(() => {}), 1500); }
function libStatus() {
  let files = 0; for (const r of libWant) if (lib.roots[r]) files += lib.roots[r].files.length;
  let found = 0; for (const n of libBusy.values()) found += n;
  return { roots: libWant.length, files, busy: libBusy.size > 0, found };
}
let libSendT = 0;
function libTell(now) {
  if (libSendT && !now) return;
  const go = () => { libSendT = 0; for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('lib-status', libStatus()); };
  if (now) { clearTimeout(libSendT); go(); } else libSendT = setTimeout(go, 700);
}
async function libWalk(root) {
  if (libBusy.has(root)) return;
  libBusy.set(root, 0); libTell(true);
  const ok = new Set(lib.exts), skip = new Set(['$RECYCLE.BIN', 'System Volume Information', '$Recycle.Bin', 'node_modules']);
  const dirs = [''], files = [], queue = [0];
  const visit = async di => {
    const rel = dirs[di], abs = rel ? path.join(root, rel) : root;
    let ents; try { ents = await fsp.readdir(abs, { withFileTypes: true }); } catch (err) { return; }
    for (const d of ents) {
      if (d.name.startsWith('.') || skip.has(d.name) || d.isSymbolicLink()) continue;  // bez dowiązań — żadnych pętli
      let isDir = d.isDirectory(), isFile = d.isFile();
      if (!isDir && !isFile) { try { const s = await fsp.stat(path.join(abs, d.name)); isDir = s.isDirectory(); isFile = s.isFile(); } catch (err) { continue; } }
      if (isDir) { dirs.push(rel ? rel + path.sep + d.name : d.name); queue.push(dirs.length - 1); }
      else if (isFile) { const i = d.name.lastIndexOf('.'); if (i > 0 && ok.has(d.name.slice(i + 1).toLowerCase())) files.push([di, d.name]); }
    }
  };
  try {
    while (queue.length) {
      await Promise.all(queue.splice(0, 16).map(visit));
      libBusy.set(root, files.length); libTell();
      if (!libWant.includes(root)) return;             // folder usunięty z ulubionych w trakcie
    }
    lib.roots[root] = { t: Date.now(), dirs, files }; libPrep(root); libSave();
  } finally { libBusy.delete(root); libTell(true); }
}
const under = (p, r) => { const a = isMac ? p : p.toLowerCase(), b = isMac ? r : r.toLowerCase(); return a.startsWith(b.endsWith(path.sep) ? b : b + path.sep); };
ipcMain.handle('lib-roots', async (e, roots, exts, force) => {
  roots = [...new Set((roots || []).filter(Boolean))];
  libWant = roots.filter(r => !roots.some(o => o !== r && under(r, o)));   // folder w środku innego ulubionego nie liczy się dwa razy
  const ex = [...new Set(exts || [])].sort();
  if (ex.join() !== (lib.exts || []).join()) { lib.exts = ex; for (const r of Object.keys(lib.roots)) lib.roots[r].t = 0; }
  for (const r of Object.keys(lib.roots)) if (!libWant.includes(r)) { delete lib.roots[r]; libLc.delete(r); libSave(); }
  for (const r of libWant) {
    const x = lib.roots[r];
    if (force || !x || Date.now() - x.t > LIB_STALE) fsp.stat(r).then(s => { if (s.isDirectory()) libWalk(r); }).catch(() => {});
  }
  return libStatus();
});
ipcMain.handle('lib-search', async (e, q, exts, names) => {
  const toks = lcn(String(q || '')).split(/\s+/).filter(Boolean);
  const ok = exts && exts.length ? new Set(exts) : null;
  const LIMIT = 2000, hits = [];
  let total = 0;
  if (toks.length) for (const r of libWant) {
    const x = lib.roots[r], lc = libLc.get(r); if (!x || !lc) continue;
    // słowa pasujące do nazwy folderu liczą się dla wszystkich plików w środku („cegły czerwone”)
    const dm = lc.dirs.map(d => toks.map(t => d.includes(t)));
    for (let i = 0; i < x.files.length; i++) {
      const [di, name] = x.files[i], nm = lc.names[i], m = dm[di];
      let all = true; for (let k = 0; k < toks.length; k++) if (!m[k] && !nm.includes(toks[k])) { all = false; break; }
      if (!all) continue;
      if (ok) { const j = name.lastIndexOf('.'); if (!ok.has(name.slice(j + 1).toLowerCase())) continue; }
      total++;
      if (hits.length < LIMIT) { const rel = x.dirs[di]; hits.push({ name, dir: rel ? path.join(r, rel) : r, root: r, rel, name0: (names && names[r]) || path.basename(r) || r }); }
    }
  }
  const st = await statMany(hits.map(h => path.join(h.dir, h.name)));
  const files = [];
  hits.forEach((h, k) => { if (st[k]) files.push({ name: h.name, path: path.join(h.dir, h.name), size: st[k].size, mtime: st[k].mtime, dir: h.dir, label: [h.name0, ...(h.rel ? h.rel.split(path.sep) : [])].join(' / ') }); });
  return { files, total, st: libStatus() };
});

/* ---------- aktualizacje: nowa wersja z wydań na GitHubie ---------- */
// Repozytorium jest publiczne, więc pytamy API GitHuba bez logowania (raz po starcie i co 6 godzin).
// Windows: instalator pobiera się do folderu tymczasowego i instaluje po cichu, a Gapa uruchamia się ponownie.
// Mac: obraz .dmg trafia do Pobranych i się otwiera — Gapę przeciąga się do Aplikacji (aplikacja nie jest podpisana u Apple).
const REPO = 'michallenczewski/gapa';   // dawniej podglad — GitHub przekierowuje stary adres
let upd = { state: 'idle', version: null, url: null, name: null, size: 0, got: 0, notes: '', error: '' };
const verNum = v => String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function updTell() { const s = { ...upd, current: app.getVersion() }; for (const w of mainWindows()) w.webContents.send('update-status', s); }
async function updCheck() {
  if (upd.state === 'downloading') return upd;
  try {
    const r = await net.fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { 'User-Agent': 'Gapa', Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error('GitHub odpowiedział ' + r.status);
    const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
    const want = isWin ? /-win-x64\.exe$/ : isMac ? new RegExp('-mac-' + process.arch + '\\.dmg$') : null;
    const a = want && (j.assets || []).find(x => want.test(x.name));
    if (a && newer(v, app.getVersion())) Object.assign(upd, { state: 'available', version: v, url: a.browser_download_url, name: a.name, size: a.size, notes: String(j.body || '').slice(0, 600), error: '' });
    else Object.assign(upd, { state: 'none', version: v, error: '' });
  } catch (err) { upd.state = 'error'; upd.error = err.message; }
  updTell(); return { ...upd, current: app.getVersion() };
}
async function updInstall() {
  if (upd.state !== 'available' || !upd.url) return false;
  const dir = isMac ? app.getPath('downloads') : app.getPath('temp');
  const file = path.join(dir, upd.name);
  upd.state = 'downloading'; upd.got = 0; updTell();
  try {
    const r = await net.fetch(upd.url, { headers: { 'User-Agent': 'Gapa' } });
    if (!r.ok || !r.body) throw new Error('pobieranie nie powiodło się (' + r.status + ')');
    const out = fs.createWriteStream(file + '.part'); let last = 0;
    for await (const chunk of r.body) { out.write(chunk); upd.got += chunk.length; if (Date.now() - last > 400) { last = Date.now(); updTell(); } }
    await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
    await fsp.rename(file + '.part', file);
  } catch (err) { upd.state = 'available'; upd.error = err.message; updTell(); return false; }
  upd.state = 'ready'; updTell();
  if (isWin) {
    // cicha instalacja w to samo miejsce; --force-run uruchamia nową Gapę po instalacji
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => { quitting = true; app.quit(); }, 400);
  } else if (isMac) shell.openPath(file);
  return true;
}
ipcMain.handle('update-get', () => ({ ...upd, current: app.getVersion() }));
ipcMain.handle('update-check', () => updCheck());
ipcMain.handle('update-install', () => updInstall());

/* ---------- przygotowanie miniatur całej biblioteki (np. w nocy) ---------- */
// Lista plików pochodzi z indeksu biblioteki; pomijamy te, które mają już aktualną miniaturę.
// Miniatury liczy osobne, niewidoczne okno Gapy (ten sam kod co w siatce), więc okna, w których pracujesz, zostają płynne.
// Gdy używasz komputera, liczy jeden plik naraz; gdy komputer stoi bezczynnie, pełną mocą. Komputer nie zasypia do końca.
let prep = { on: false, paused: false, queue: [], total: 0, done: 0, failed: 0, busy: 0, auto: false, plan: null, msg: '' };
let prepWin = null, prepBlock = null, prepTellT = 0;
const prepRoots = () => (libWant.length ? libWant : Object.keys(lib.roots));
const today = () => new Date().toISOString().slice(0, 10);
function prepStatus() { return { on: prep.on, paused: prep.paused, total: prep.total, done: prep.done, failed: prep.failed, auto: prep.auto, msg: prep.msg, nightly: !!settings.prepNightly, last: settings.prepLast || null }; }
function prepTell(now) {
  const go = () => { prepTellT = 0; for (const w of mainWindows()) w.webContents.send('prep-status', prepStatus()); };
  if (now) { clearTimeout(prepTellT); go(); } else if (!prepTellT) prepTellT = setTimeout(go, 600);
}
async function prepPlan(refresh) {
  if (refresh) await Promise.all(prepRoots().map(r => fsp.stat(r).then(s => (s.isDirectory() ? libWalk(r) : null)).catch(() => {})));
  const paths = [];
  for (const r of prepRoots()) { const x = lib.roots[r]; if (!x) continue; for (const [di, name] of x.files) paths.push(path.join(r, x.dirs[di] || '', name)); }
  const st = await statMany(paths), list = [];
  paths.forEach((p, k) => { const s = st[k]; if (s && !idx.items[keyHash({ path: p, size: s.size, mtime: s.mtime })]) list.push({ path: p, name: path.basename(p), size: s.size, mtime: s.mtime }); });
  const n = Object.keys(idx.items).length, avg = n > 50 ? cacheBytes / n : 45000;
  const limit = (settings.cacheLimitMB || 2048) * 1048576;
  prep.plan = { files: paths.length, missing: list.length, est: Math.round(list.length * avg), used: cacheBytes, limitMB: settings.cacheLimitMB || 2048, list, avg };
  return { files: paths.length, missing: list.length, est: prep.plan.est, used: cacheBytes, limitMB: prep.plan.limitMB, fits: cacheBytes + prep.plan.est <= limit * 0.9 };
}
function prepStart(auto) {
  if (prep.on || !prep.plan || !prep.plan.list.length) return false;
  let list = prep.plan.list;
  // nie więcej, niż zmieści się w limicie pamięci miniatur — inaczej Gapa usuwałaby to, co przed chwilą zrobiła
  const room = Math.max(0, (settings.cacheLimitMB || 2048) * 1048576 * 0.9 - cacheBytes);
  if (list.length * prep.plan.avg > room) list = list.slice(0, Math.floor(room / prep.plan.avg));
  if (!list.length) { prep.msg = 'Limit pamięci miniatur jest pełny'; prepTell(true); return false; }
  Object.assign(prep, { on: true, paused: false, queue: list, total: list.length, done: 0, failed: 0, busy: 0, auto: !!auto, msg: list.length < prep.plan.list.length ? 'tyle, ile mieści limit' : '', plan: null });
  try { prepBlock = powerSaveBlocker.start('prevent-app-suspension'); } catch (e) {}
  prepWin = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false } });
  prepWin.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: { prep: '1' } });
  prepWin.on('closed', () => { prepWin = null; if (prep.on) prepEnd('przerwane'); });
  trayUpdate(); prepTell(true);
  return true;
}
function prepEnd(msg) {
  prep.on = false; prep.queue = []; prep.msg = msg || '';
  if (msg === 'gotowe') { settings.prepLast = today(); saveSettings(); }
  if (prepBlock !== null) { try { powerSaveBlocker.stop(prepBlock); } catch (e) {} prepBlock = null; }
  if (prepWin && !prepWin.isDestroyed()) { const w = prepWin; prepWin = null; w.destroy(); }
  saveIndexNow(); trayUpdate(); prepTell(true);
  if (isWin && !quitting && !keepAlive() && !mainWindows().length) app.quit();
}
ipcMain.handle('prep-get', () => prepStatus());
ipcMain.handle('prep-plan', () => prepPlan(true));
ipcMain.handle('prep-start', (e, raiseMB) => { if (raiseMB) { settings.cacheLimitMB = Math.max(settings.cacheLimitMB || 2048, raiseMB | 0); saveSettings(); } return prepStart(false); });
ipcMain.handle('prep-pause', (e, v) => { prep.paused = !!v; prepTell(true); });
ipcMain.handle('prep-stop', () => { if (prep.on) prepEnd('zatrzymane'); });
ipcMain.handle('prep-nightly', (e, v) => prepNightlySet(v));
function prepNightlySet(v) { settings.prepNightly = !!v; saveSettings(); trayUpdate(); prepTell(true); return settings.prepNightly; }
// okno liczące pyta o następny plik; „par” mówi, ile plików naraz wolno mu teraz liczyć
ipcMain.handle('prep-next', () => {
  if (!prep.on) return { end: true };
  let idle = 0; try { idle = powerMonitor.getSystemIdleTime(); } catch (e) {}
  const par = idle >= 60 ? 6 : 1;
  if (prep.paused) return { wait: true, par };
  const it = prep.queue.shift();
  if (!it) { if (!prep.busy) prepEnd('gotowe'); return { end: !prep.busy, wait: !!prep.busy, par }; }
  prep.busy++; return { it, par };
});
ipcMain.handle('prep-report', (e, ok) => {
  prep.busy = Math.max(0, prep.busy - 1); if (ok) prep.done++; else { prep.done++; prep.failed++; }
  prepTell(); if (prep.on && !prep.queue.length && !prep.busy) prepEnd('gotowe');
});
// co noc: między 2:00 a 6:00, raz na dobę, jeśli Gapa działa (choćby w tle)
async function prepNightlyTick() {
  const h = new Date().getHours();
  if (!settings.prepNightly || prep.on || h < 2 || h >= 6 || settings.prepLast === today()) return;
  const p = await prepPlan(true).catch(() => null);
  if (!p) return;
  if (!p.missing) { settings.prepLast = today(); saveSettings(); return; }
  prepStart(true);
}

ipcMain.handle('exists', async (e, p) => { try { return (await fsp.stat(p)).isDirectory(); } catch (err) { return false; } });
ipcMain.handle('roots', async () => {
  const r = [];
  const add = (name, p, drive) => { try { if (fs.statSync(p).isDirectory()) r.push({ name, path: p, drive: !!drive }); } catch (e) {} };
  add('Pulpit', app.getPath('desktop'));
  add('Dokumenty', app.getPath('documents'));
  add('Obrazy', app.getPath('pictures'));
  add('Pobrane', app.getPath('downloads'));
  if (isWin) {
    for (const L of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      const p = L + ':\\';
      try { await fsp.access(p); r.push({ name: L + ':', path: p, drive: true }); } catch (e) {}
    }
  } else if (isMac) {
    add(os.userInfo().username, os.homedir());
    try { for (const v of fs.readdirSync('/Volumes')) add(v, '/Volumes/' + v, true); } catch (e) {}
  } else {
    add('Katalog domowy', os.homedir()); add('/', '/', true);
  }
  return r;
});
ipcMain.handle('pick-folder', async e => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

/* obserwowanie bieżącego folderu: nowy render pojawia się sam */
// obserwowanie bieżącego folderu — osobno dla każdego okna
const watchers = new Map();
ipcMain.handle('watch', (e, dir) => {
  const id = e.sender.id, old = watchers.get(id);
  if (old) { old.w.close(); clearTimeout(old.t); watchers.delete(id); }
  if (!dir) return;
  try {
    const rec = { w: null, t: 0 };
    rec.w = fs.watch(dir, { persistent: false }, () => {
      clearTimeout(rec.t);
      rec.t = setTimeout(() => { if (!e.sender.isDestroyed()) e.sender.send('dir-changed', dir); }, 600);
    });
    rec.w.on('error', () => {});
    watchers.set(id, rec);
    e.sender.once('destroyed', () => { const r = watchers.get(id); if (r) { r.w.close(); watchers.delete(id); } });
  } catch (err) {}
});

/* ---------- miniatury systemowe (Eksplorator / Quick Look): PDF, DWG, SKP, MAX, 3DM, Archicad… ---------- */
ipcMain.handle('os-thumb', async (e, p, size) => {
  try {
    const img = await nativeImage.createThumbnailFromPath(p, { width: size, height: size });
    if (!img || img.isEmpty()) return null;
    return img.toPNG();
  } catch (err) { return null; }
});

/* ---------- system: Finder/Eksplorator, programy, przeciąganie ---------- */
// własne przyciski okna (Windows)
ipcMain.on('win-ctl', (e, cmd) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (cmd === 'min') w.minimize(); else if (cmd === 'max') (w.isMaximized() ? w.unmaximize() : w.maximize()); else if (cmd === 'close') w.close();
});
ipcMain.handle('win-maxed', e => { const w = BrowserWindow.fromWebContents(e.sender); return !!(w && w.isMaximized()); });
ipcMain.handle('caption-set', (e, v) => { settings.ownCaption = !!v; saveSettings(); return settings.ownCaption; });
ipcMain.handle('relaunch', () => { app.relaunch(); quitting = true; app.quit(); });
ipcMain.on('chrome-colors', (e, c) => { try { const w = BrowserWindow.fromWebContents(e.sender); if (w && process.platform !== 'darwin') w.setTitleBarOverlay({ color: c.bg, symbolColor: c.fg, height: c.h || 52 }); } catch (_) {} });
ipcMain.handle('show-in-folder', (e, p) => shell.showItemInFolder(p));
ipcMain.handle('open-default', (e, p) => shell.openPath(p));

function findPhotoshop() {
  try {
    if (isMac) {
      const apps = fs.readdirSync('/Applications').filter(n => /^Adobe Photoshop/.test(n)).sort().reverse();
      for (const d of apps) {
        const inside = path.join('/Applications', d);
        if (d.endsWith('.app')) return inside;
        const a = fs.readdirSync(inside).find(n => /^Adobe Photoshop.*\.app$/.test(n));
        if (a) return path.join(inside, a);
      }
    } else if (isWin) {
      for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)']].filter(Boolean)) {
        const adobe = path.join(base, 'Adobe');
        const dirs = fs.readdirSync(adobe).filter(n => /^Adobe Photoshop/.test(n)).sort().reverse();
        for (const d of dirs) { const exe = path.join(adobe, d, 'Photoshop.exe'); if (fs.existsSync(exe)) return exe; }
      }
    }
  } catch (e) {}
  return null;
}
// Affinity: na Macu zwykła aplikacja w /Applications; na Windows albo klasyczna instalacja w Program Files\Affinity,
// albo pakiet MSIX — wtedy uruchamiamy go przez alias w %LOCALAPPDATA%\Microsoft\WindowsApps (np. AffinityPhoto2.exe)
function findAffinity() {
  try {
    if (isMac) {
      const apps = fs.readdirSync('/Applications').filter(n => /^Affinity( Photo)?( \d)?\.app$/.test(n));
      const pick = apps.find(n => n === 'Affinity.app') || apps.sort().reverse()[0];
      return pick ? path.join('/Applications', pick) : null;
    }
    if (isWin) {
      const base = path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Affinity');
      if (fs.existsSync(base)) for (const d of fs.readdirSync(base).sort().reverse()) {
        for (const exe of ['Affinity.exe', 'Photo.exe']) { const p = path.join(base, d, exe); if (fs.existsSync(p)) return p; }
      }
      const wa = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps');
      const al = fs.readdirSync(wa).filter(n => /^Affinity.*\.exe$/i.test(n));
      const pick = al.find(n => /^Affinity\.exe$/i.test(n)) || al.filter(n => /photo/i.test(n)).sort().reverse()[0] || al[0];
      if (pick) return path.join(wa, pick);
    }
  } catch (e) {}
  return null;
}
const editorLabel = p => {
  let n = path.basename(p).replace(/\.(app|exe)$/i, '');
  if (/^AffinityPhoto(\d*)$/i.test(n)) n = 'Affinity Photo' + (n.match(/\d+$/) ? ' ' + n.match(/\d+$/)[0] : '');
  else if (/^Photo$/i.test(n) && /Affinity/i.test(p)) n = 'Affinity Photo';
  else if (/^Photoshop$/i.test(n)) n = 'Photoshop';
  return n.replace(/^Adobe Photoshop.*/, 'Photoshop');
};
const currentEditor = () => (settings.editor && fs.existsSync(settings.editor) ? settings.editor : findPhotoshop() || findAffinity());
ipcMain.handle('editors', () => {
  const list = [], add = p => { if (p && !list.some(x => x.path === p)) list.push({ path: p, name: editorLabel(p) }); };
  add(findPhotoshop()); add(findAffinity()); if (settings.editor && fs.existsSync(settings.editor)) add(settings.editor);
  const cur = currentEditor();
  return { list, current: cur || null };
});
ipcMain.handle('editor-set', (e, p) => { settings.editor = p || null; saveSettings(); const c = currentEditor(); return c ? editorLabel(c) : null; });
function launch(appPath, files) {
  if (isMac) execFile('open', ['-a', appPath, ...files]);
  else spawn(appPath, files, { detached: true, stdio: 'ignore' }).unref();
}
ipcMain.handle('open-editor', async (e, files, choose) => {
  let ed = !choose && currentEditor();
  if (!ed) {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Wskaż program do edycji (np. Photoshop albo Affinity)',
      defaultPath: isMac ? '/Applications' : (process.env['ProgramFiles'] || 'C:\\'),
      properties: isMac ? ['openFile', 'treatPackageAsDirectory'] : ['openFile'],
      filters: isMac ? [{ name: 'Programy', extensions: ['app'] }] : [{ name: 'Programy', extensions: ['exe'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    ed = r.filePaths[0]; settings.editor = ed; saveSettings();
  }
  if (files && files.length) launch(ed, files);   // sama zmiana programu (bez plików) niczego nie uruchamia
  return editorLabel(ed);
});
ipcMain.handle('editor-name', () => {
  const ed = currentEditor();
  return ed ? editorLabel(ed) : null;
});

/* ---------- przenoszenie i kopiowanie przeciąganiem (jak w Finderze) ---------- */
// ten sam dysk → przeniesienie, inny dysk albo z Alt / ⌥ → kopia; nic nie jest nadpisywane („nazwa (2).jpg”)
const transfers = [];                       // historia do cofania (⌘Z / Ctrl+Z), ostatnie 20 operacji
let lastDrag = null;                        // pliki przeciągane właśnie z któregoś okna Gapy
const lc = p => isMac ? p : p.toLowerCase();
const inside = (p, dir) => { const a = lc(p), b = lc(dir).replace(/[\\/]+$/, '') + path.sep; return a.startsWith(b); };
async function freePath(dir, name) {
  const ext = path.extname(name), base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name), n = 2;
  for (;;) { try { await fsp.access(p); p = path.join(dir, `${base} (${n++})${ext}`); } catch (err) { return p; } }
}
async function moveTo(src, to) {
  try { await fsp.rename(src, to); }
  catch (err) {
    if (err.code !== 'EXDEV') throw err;
    // inny wolumin mimo wszystko: kopia, a oryginał do Kosza (nie kasujemy na stałe)
    await fsp.cp(src, to, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    await shell.trashItem(src);
  }
}
function tellDirs(dirs) { for (const w of BrowserWindow.getAllWindows()) for (const d of dirs) if (!w.isDestroyed()) w.webContents.send('dir-changed', d); }
// pamięć RAM wszystkich procesów programu (w KB): główny, okna, karta graficzna, pomocnicze
ipcMain.handle('mem', () => {
  let total = 0, renderer = 0;
  for (const m of app.getAppMetrics()) { const k = (m.memory && m.memory.workingSetSize) || 0; total += k; if (m.type === 'Tab' || m.type === 'Renderer') renderer += k; }
  return { total, renderer };
});
ipcMain.handle('dev-of', (e, paths) => Promise.all((paths || []).map(p => fsp.stat(p).then(s => s.dev).catch(() => null))));
ipcMain.handle('current-drag', () => lastDrag && Date.now() - lastDrag.t < 120000 ? { files: lastDrag.files, copy: lastDrag.copy } : null);
// schowek systemowy z plikami: Gapa → Eksplorator / Finder (⌘C / Ctrl+C) i z powrotem (⌘V / Ctrl+V w Gapie)
const psq = s => "'" + String(s).replace(/'/g, "''") + "'";
// schowek plików na Macu przez AppKit (JavaScript for Automation) — Finder czyta i zapisuje adresy plików (NSURL)
const MAC_CLIP_WRITE = "ObjC.import('AppKit');function run(a){const pb=$.NSPasteboard.generalPasteboard;pb.clearContents;const arr=$.NSMutableArray.array;for(const p of a)arr.addObject($.NSURL.fileURLWithPath(p));return pb.writeObjects(arr);}";
const MAC_CLIP_READ = "ObjC.import('AppKit');function run(){const pb=$.NSPasteboard.generalPasteboard;const o=$.NSDictionary.dictionaryWithObjectForKey($.NSNumber.numberWithBool(true),$.NSPasteboardURLReadingFileURLsOnlyKey);const r=pb.readObjectsForClassesOptions($.NSArray.arrayWithObject($.NSURL),o);if(!r||r.isNil())return '';const out=[];for(let i=0;i<r.count;i++)out.push(ObjC.unwrap(r.objectAtIndex(i).path));return out.join('\\n');}";
ipcMain.handle('clip-files', async (e, paths) => {
  paths = (paths || []).filter(Boolean);
  if (!paths.length) return false;
  try {
    if (isWin) {
      await new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -LiteralPath ' + paths.map(psq).join(',')], { windowsHide: true }, () => res()));
    } else if (isMac) {
      // pliki do schowka tak jak robi to Finder: adresy plików przez NSPasteboard (⌘V w Finderze wkleja kopie)
      const ok = await new Promise(res => execFile('osascript', ['-l', 'JavaScript', '-e', MAC_CLIP_WRITE, ...paths], (err, so) => res(!err && /true/.test(so))));
      if (!ok) {   // zapas: stary typ schowka
        const esc = p => p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const plist = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array>' + paths.map(p => '<string>' + esc(p) + '</string>').join('') + '</array></plist>';
        clipboard.clear();
        clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(plist, 'utf8'));
      }
    } else clipboard.writeText(paths.join('\n'));
    return true;
  } catch (err) { return false; }
});
ipcMain.handle('clip-read-files', async () => {
  try {
    if (isWin) {
      const out = await new Promise(res => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }'], { windowsHide: true, encoding: 'utf8' }, (err, so) => res(err ? '' : so)));
      return out.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    }
    if (isMac) {
      const out = await new Promise(res => execFile('osascript', ['-l', 'JavaScript', '-e', MAC_CLIP_READ], { encoding: 'utf8' }, (err, so) => res(err ? '' : so)));
      const list = out.split('\n').map(x => x.trim()).filter(Boolean);
      if (list.length) return list;
      const b = clipboard.readBuffer('NSFilenamesPboardType').toString('utf8');
      return [...b.matchAll(/<string>([\s\S]*?)<\/string>/g)].map(m => m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    }
  } catch (err) {}
  return [];
});
ipcMain.handle('transfer', async (e, paths, dest, mode) => {
  const done = [], failed = [], dirs = new Set([dest]);
  let dst; try { dst = await fsp.stat(dest); if (!dst.isDirectory()) throw new Error(); } catch (err) { return { done, failed: paths.map(p => ({ path: p, error: 'nie ma folderu docelowego' })) }; }
  for (const src of paths || []) {
    try {
      const here = lc(path.dirname(src)) === lc(dest);
      if (here && mode !== 'copy') continue;                                   // już tam jest (kopia w tym samym folderze dostaje „(2)”)
      if (lc(src) === lc(dest) || inside(dest, src)) { failed.push({ path: src, error: 'folderu nie da się włożyć do niego samego' }); continue; }
      const st = await fsp.stat(src);
      const op = mode === 'copy' ? 'copy' : mode === 'move' || st.dev === dst.dev ? 'move' : 'copy';
      const to = await freePath(dest, path.basename(src));
      if (op === 'move') await moveTo(src, to);
      else await fsp.cp(src, to, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
      done.push({ from: src, to, op }); dirs.add(path.dirname(src));
      cacheCarry(src, to, op === 'copy');
    } catch (err) { failed.push({ path: src, error: err.message }); }
  }
  if (done.length) { transfers.push(done); if (transfers.length > 20) transfers.shift(); }
  tellDirs(dirs);
  return { done, failed };
});
// zmiana nazwy: bez nadpisywania; ⌘Z / Ctrl+Z cofa jak przeniesienie
ipcMain.handle('rename', async (e, src, name) => {
  name = String(name || '').trim();
  if (!name || name === '.' || name === '..' || /[\\/:*?"<>|\x00-\x1f]/.test(name)) return { error: 'Nazwa nie może zawierać znaków \\ / : * ? " < > |' };
  const to = path.join(path.dirname(src), name);
  if (to === src) return { to };
  try {
    if (lc(to) !== lc(src)) { try { await fsp.access(to); return { error: 'Plik o tej nazwie już tu jest' }; } catch (err) {} }
    await fsp.rename(src, to); cacheCarry(src, to, false);
    transfers.push([{ from: src, to, op: 'move' }]); if (transfers.length > 20) transfers.shift();
    tellDirs([path.dirname(src)]);
    return { to };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('undo-transfer', async () => {
  const last = transfers.pop(); if (!last) return null;
  const back = [], failed = [], dirs = new Set();
  for (const r of [...last].reverse()) {
    try {
      if (r.op === 'move') { const to = await freePath(path.dirname(r.from), path.basename(r.from)); await moveTo(r.to, to); cacheCarry(r.to, to, false); back.push({ from: r.to, to, op: 'move' }); }
      else { await shell.trashItem(r.to); back.push({ from: r.to, to: null, op: 'trash' }); }   // cofnięta kopia trafia do Kosza
      dirs.add(path.dirname(r.from)); dirs.add(path.dirname(r.to));
    } catch (err) { failed.push({ path: r.to, error: err.message }); }
  }
  tellDirs(dirs);
  return { op: last[0].op, back, failed };
});

let dragIcon = null;
ipcMain.on('drag-out', (e, files, icon, copy) => {
  if (!files || !files.length) return;
  // pod kursorem miniatury przeciąganych plików (przygotowane w oknie); ikona programu tylko awaryjnie
  let img = null;
  if (typeof icon === 'string' && icon.startsWith('data:image/png;base64,')) {
    try { img = nativeImage.createFromBuffer(Buffer.from(icon.slice(22), 'base64'), { scaleFactor: 2 }); if (img.isEmpty()) img = null; } catch (err) { img = null; }
  }
  if (!img) { if (!dragIcon) dragIcon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'icon.png')).resize({ width: 48, height: 48 }); img = dragIcon; }
  lastDrag = { files, copy: !!copy, t: Date.now() };
  e.sender.startDrag({ file: files[0], files, icon: img });
});

/* ---------- okno ---------- */
// nowe okno: zaczyna w podanym folderze (zwykle tym samym co okno, z którego je otwarto), lekko przesunięte
function createWindow(startPath) {
  let b = settings.bounds || { width: 1400, height: 900 };
  let from = BrowserWindow.getFocusedWindow(); if (from && from === peekWin) from = null;
  if (from && !from.isFullScreen()) { const r = from.getBounds(); b = { x: r.x + 28, y: r.y + 28, width: r.width, height: r.height }; }
  const win = new BrowserWindow({
    ...b, minWidth: 720, minHeight: 480, show: false,
    title: 'Gapa', backgroundColor: '#1b1b1b',
    icon: iconFile(settings.icon),
    autoHideMenuBar: true,
    // pasek tytułu schowany — przyciski okna rysuje system w górnym pasku programu
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 19 } }
      // Windows: przyciski okna systemowe (pole rysowane przez Windows) albo własne Gapy (opcja w ustawieniach)
      : settings.ownCaption ? { titleBarStyle: 'hidden' }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f5', symbolColor: '#4a4945', height: 52 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, plugins: true,
      additionalArguments: isWin && settings.ownCaption ? ['--gapa-caption=own'] : [] }
  });
  win.on('maximize', () => win.webContents.send('win-max', true));
  win.on('unmaximize', () => win.webContents.send('win-max', false));
  if (settings.maximized && !from) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), startPath ? { query: { p: startPath } } : undefined);
  const remember = () => { if (!win.isMaximized() && !win.isMinimized()) settings.bounds = win.getBounds(); settings.maximized = win.isMaximized(); };
  win.on('resize', remember); win.on('move', remember);
  // pełny ekran: przyciski okna znikają, więc pasek programu oddaje zarezerwowane dla nich miejsce
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  win.on('close', () => { remember(); saveSettings(); });
  win.on('closed', () => { if (isWin && !keepAlive() && !quitting && !mainWindows().length) app.quit(); });
  // linki zewnętrzne w przeglądarce, nie w oknie programu
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  return win;
}
ipcMain.on('new-window', (e, p) => createWindow(p || null));

/* ---------- Windows: spacja w Eksploratorze otwiera podgląd w Gapie ---------- */
// Pomocnik GapaSpacja.exe (helper/GapaSpacja.cs) słucha klawiatury i czyta zaznaczenie w Eksploratorze.
// Podgląd to osobne, lekkie okno Gapy: pokazuje się bez odbierania fokusu Eksploratorowi, więc strzałki
// w Eksploratorze dalej zmieniają zaznaczenie, a podgląd za nim podąża. Spacja albo Esc zamykają podgląd.
// Gapa zostaje wtedy w tle (ikona w zasobniku), żeby podgląd otwierał się od razu.
let peekProc = null, peekWin = null, peekVisible = false, peekMulti = false, peekReady = false, peekPending = null, tray = null, quitting = false;
const mainWindows = () => BrowserWindow.getAllWindows().filter(w => w !== peekWin && w !== prepWin && !w.isDestroyed());
// Gapa zostaje w tle bez okien: podgląd spacją, nocne miniatury albo trwające przygotowanie miniatur
const keepAlive = () => !!(settings.peek || settings.prepNightly || prep.on);
const PEEK_EXTS_FALLBACK = ['jpg','jpeg','png','webp','avif','gif','bmp','tif','tiff','psd','psb','tga','exr','hdr','svg','pdf','mp4','mov','m4v','webm','mkv','avi','dwg','skp','max','3dm','pln','heic','cr2','cr3','nef','arw','dng','raf','orf','rw2'];
function peekSupported(p) {
  const ext = path.extname(p || '').slice(1).toLowerCase();
  return !!ext && (lib.exts && lib.exts.length ? lib.exts : PEEK_EXTS_FALLBACK).includes(ext);
}
function peekSend(line) { try { if (peekProc && peekProc.stdin.writable) peekProc.stdin.write(line + '\n'); } catch (e) {} }
function peekStart() {
  if (!isWin || peekProc || !settings.peek) return;
  const exe = app.isPackaged ? path.join(process.resourcesPath, 'GapaSpacja.exe') : path.join(__dirname, 'helper', 'GapaSpacja.exe');
  if (!fs.existsSync(exe)) return;
  try { peekProc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }); } catch (e) { peekProc = null; return; }
  let buf = '';
  peekProc.stdout.on('data', d => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { continue; }
      if (m.t === 'space') {
        const many = (m.paths || []).filter(peekSupported);
        if (peekVisible) peekHide();
        else if (many.length > 1) peekShow({ path: peekSupported(m.path) ? m.path : many[0], paths: many });   // kilka plików: arkusz
        else if (m.path && peekSupported(m.path)) peekShow(m.path);
        else peekSend('pass');                                  // nieobsługiwany plik — spacja wraca do Eksploratora
      } else if (m.t === 'esc') { if (peekMulti && peekWin) peekWin.webContents.send('peek-key', 'Escape'); else peekHide(); }   // arkusz: Esc najpierw wraca z pojedynczego zdjęcia
      else if (m.t === 'key' && peekVisible && peekWin) peekWin.webContents.send('peek-key', m.k);
      else if (m.t === 'sel' && peekVisible && m.path && peekSupported(m.path)) peekWin.webContents.send('peek-open', m.path);
    }
  });
  peekProc.on('exit', () => { peekProc = null; if (settings.peek && !quitting) setTimeout(peekStart, 3000); });
}
function peekStop() { if (peekProc) { try { peekProc.kill(); } catch (e) {} peekProc = null; } peekHide(); }
function peekCreate(first) {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const w = Math.round(d.width * 0.72), h = Math.round(d.height * 0.8);
  peekWin = new BrowserWindow({
    x: d.x + Math.round((d.width - w) / 2), y: d.y + Math.round((d.height - h) / 2), width: w, height: h,
    show: false, title: 'Gapa — podgląd', backgroundColor: '#1b1b1b', icon: iconFile(settings.icon), autoHideMenuBar: true,
    alwaysOnTop: true, skipTaskbar: false, minimizable: false, fullscreenable: true,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f5', symbolColor: '#4a4945', height: 52 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, plugins: true }
  });
  peekReady = false;
  peekWin.loadFile(path.join(__dirname, 'renderer', 'index.html'), { query: typeof first === 'string' ? { peek: first } : { peek: first.path, multi: '1' } });
  if (typeof first !== 'string') peekPending = first;
  peekWin.webContents.once('did-finish-load', () => { peekReady = true; if (peekPending) { peekWin.webContents.send('peek-open', peekPending); peekPending = null; } });
  peekWin.on('close', e => { if (!quitting) { e.preventDefault(); peekHide(); } });   // zostaje w pamięci — następny podgląd otwiera się od razu
  peekWin.on('closed', () => { peekWin = null; peekVisible = false; });
  peekWin.on('enter-full-screen', () => peekWin.webContents.send('fullscreen', true));
  peekWin.on('leave-full-screen', () => peekWin.webContents.send('fullscreen', false));
}
function peekShow(p) {
  if (!peekWin) peekCreate(p);
  else if (peekReady) peekWin.webContents.send('peek-open', p);
  else peekPending = p;
  peekWin.setAlwaysOnTop(true, 'floating');
  if (!peekWin.isVisible()) peekWin.showInactive();                 // bez zabierania fokusu Eksploratorowi
  peekWin.moveTop();
  peekMulti = !!(p && p.paths); peekVisible = true; peekSend('multi ' + (peekMulti ? 1 : 0)); peekSend('open 1');
}
function peekHide() {
  if (peekWin && peekWin.isVisible()) { peekWin.webContents.send('peek-hidden'); peekWin.hide(); }
  peekVisible = false; peekMulti = false; peekSend('open 0'); peekSend('multi 0');
}
ipcMain.on('peek-close', () => peekHide());
function trayUpdate() {
  if (!isWin) return;
  if (!keepAlive()) { if (tray) { tray.destroy(); tray = null; } return; }
  if (!tray) {
    tray = new Tray(nativeImage.createFromPath(iconFile(settings.icon)).resize({ width: 16, height: 16 }));
    tray.setToolTip(settings.peek ? 'Gapa — spacja w Eksploratorze otwiera podgląd' : 'Gapa — działa w tle');
    tray.on('click', () => { const w = mainWindows()[0]; if (w) { w.show(); w.focus(); } else createWindow(); });
  }
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Otwórz Gapę', click: () => { const w = mainWindows()[0]; if (w) { w.show(); w.focus(); } else createWindow(); } },
    { type: 'separator' },
    { label: 'Podgląd spacją w Eksploratorze', type: 'checkbox', checked: !!settings.peek, click: () => peekSet(!settings.peek) },
    { label: 'Przygotowuj miniatury biblioteki co noc', type: 'checkbox', checked: !!settings.prepNightly, click: () => prepNightlySet(!settings.prepNightly) },
    { label: 'Uruchamiaj razem z Windows', type: 'checkbox', checked: !!settings.autostart, click: () => autostartSet(!settings.autostart) },
    { type: 'separator' },
    { label: 'Zakończ Gapę', click: () => { quitting = true; app.quit(); } }
  ]));
}
function peekSet(v) { settings.peek = !!v; saveSettings(); if (v) peekStart(); else peekStop(); trayUpdate(); }
function autostartSet(v) {
  settings.autostart = !!v; saveSettings();
  try { app.setLoginItemSettings({ openAtLogin: !!v, args: ['--hidden'] }); } catch (e) {}
  trayUpdate();
}
// pełny ekran 100% (bez paska zadań i paska okna): Ctrl+spacja na Windows, ⌃⌘F na Macu
ipcMain.on('fullscreen-toggle', e => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!w.isFullScreen()); });
ipcMain.handle('peek-get', () => ({ available: isWin, peek: !!settings.peek, autostart: !!settings.autostart }));
ipcMain.handle('peek-set', (e, v) => { peekSet(v); return true; });
ipcMain.handle('autostart-set', (e, v) => { autostartSet(v); return true; });

function buildMenu() {
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Plik', submenu: [
      { label: 'Nowe okno', accelerator: 'CmdOrCtrl+N', click: () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('menu', 'new-window'); else createWindow(); } },
      { label: 'Otwórz folder…', accelerator: 'CmdOrCtrl+O', click: () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('menu', 'open'); } },
      { type: 'separator' }, { role: 'close', label: 'Zamknij okno' }, ...(isMac ? [] : [{ role: 'quit', label: 'Zakończ' }])] },
    { role: 'editMenu', label: 'Edycja' },
    { label: 'Widok', submenu: [
      { role: 'reload', label: 'Przeładuj' }, { role: 'toggleDevTools', label: 'Narzędzia deweloperskie' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Pełny ekran' }] },
    { role: 'windowMenu', label: 'Okno' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length' };
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', dib: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml', tif: 'image/tiff', tiff: 'image/tiff',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', webm: 'video/webm', mkv: 'video/webm', ogv: 'video/ogg' };

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = mainWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } else createWindow(); });
  app.whenReady().then(() => {
    loadSettings(); libLoad();
    openCache(settings.cacheDir);
    protocol.handle('pgf', async req => {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const u = new URL(req.url);
      let p;
      if (u.host === 'f') p = decodeURIComponent(u.pathname.slice(1));
      else if (u.host === 'c') p = path.join(cacheDir, ...u.pathname.slice(1).split('/').map(s => s.replace(/[^0-9a-f.webp]/gi, '')));
      else return new Response('', { status: 404 });
      try {
        const st = await fsp.stat(p);
        const ext = (p.split('.').pop() || '').toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';
        const range = req.headers.get('range');
        if (range) {
          const m = /bytes=(\d+)-(\d*)/.exec(range);
          const s = +m[1], end = Math.min(m[2] ? +m[2] : st.size - 1, st.size - 1);
          if (s > end) return new Response(new Uint8Array(0), { status: 206, headers: { ...CORS, 'Content-Range': 'bytes */' + st.size } });
          return new Response(Readable.toWeb(fs.createReadStream(p, { start: s, end })), {
            status: 206, headers: { ...CORS, 'Content-Type': type, 'Content-Length': String(end - s + 1), 'Content-Range': `bytes ${s}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' } });
        }
        return new Response(Readable.toWeb(fs.createReadStream(p)), {
          status: 200, headers: { ...CORS, 'Content-Type': type, 'Content-Length': String(st.size), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' } });
      } catch (err) { return new Response('', { status: 404 }); }
    });
    buildMenu();
    // uruchomienie razem z Windows (--hidden): tylko w tle, z ikoną w zasobniku, bez okna
    if (!(isWin && (settings.peek || settings.prepNightly) && process.argv.includes('--hidden'))) createWindow();
    setInterval(prepNightlyTick, 5 * 60 * 1000);
    setTimeout(updCheck, 15000); setInterval(updCheck, 6 * 3600 * 1000);
    if (isWin) { peekStart(); trayUpdate(); }
    if (settings.icon === 'retro') applyIcon();
    else if (isWin) setTimeout(winShortcutIcons, 3000);   // po powrocie do zwykłej ikony albo po reinstalacji
    app.on('activate', () => { if (!mainWindows().length) createWindow(); });
  });
  app.on('before-quit', () => { quitting = true; saveIndexNow(); saveSettings(); if (peekProc) try { peekProc.kill(); } catch (e) {} });
  // na Macu zamknięcie ostatniego okna nie kończy programu (zostaje w Docku, ⌘Q kończy); na Windows kończy
  app.on('window-all-closed', () => { saveIndexNow(); saveSettings(); if (!isMac && !keepAlive()) app.quit(); });
}
