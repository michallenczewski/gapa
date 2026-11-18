// Podgląd — proces główny: okno, dostęp do dysku, pamięć miniatur, integracja z systemem.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, nativeImage, Menu } = require('electron');
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
  else if (win) win.setIcon(img);
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
let watcher = null, watchTimer = null;
ipcMain.handle('watch', (e, dir) => {
  if (watcher) { watcher.close(); watcher = null; }
  if (!dir) return;
  try {
    watcher = fs.watch(dir, { persistent: false }, () => {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => { if (!e.sender.isDestroyed()) e.sender.send('dir-changed', dir); }, 600);
    });
    watcher.on('error', () => {});
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
ipcMain.on('chrome-colors', (e, c) => { try { if (win && process.platform !== 'darwin') win.setTitleBarOverlay({ color: c.bg, symbolColor: c.fg, height: c.h || 52 }); } catch (_) {} });
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
function launch(appPath, files) {
  if (isMac) execFile('open', ['-a', appPath, ...files]);
  else spawn(appPath, files, { detached: true, stdio: 'ignore' }).unref();
}
ipcMain.handle('open-editor', async (e, files, choose) => {
  let ed = !choose && (settings.editor && fs.existsSync(settings.editor) ? settings.editor : findPhotoshop());
  if (!ed) {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
      title: 'Wskaż program do edycji (np. Photoshop)',
      defaultPath: isMac ? '/Applications' : (process.env['ProgramFiles'] || 'C:\\'),
      properties: isMac ? ['openFile', 'treatPackageAsDirectory'] : ['openFile'],
      filters: isMac ? [{ name: 'Programy', extensions: ['app'] }] : [{ name: 'Programy', extensions: ['exe'] }]
    });
    if (r.canceled || !r.filePaths[0]) return null;
    ed = r.filePaths[0]; settings.editor = ed; saveSettings();
  }
  launch(ed, files);
  return path.basename(ed).replace(/\.(app|exe)$/i, '');
});
ipcMain.handle('editor-name', () => {
  const ed = settings.editor && fs.existsSync(settings.editor) ? settings.editor : findPhotoshop();
  return ed ? path.basename(ed).replace(/\.(app|exe)$/i, '') : null;
});

let dragIcon = null;
ipcMain.on('drag-out', (e, files) => {
  if (!files || !files.length) return;
  if (!dragIcon) dragIcon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'icon.png')).resize({ width: 48, height: 48 });
  e.sender.startDrag({ file: files[0], files, icon: dragIcon });
});

/* ---------- okno ---------- */
let win = null;
function createWindow() {
  const b = settings.bounds || { width: 1400, height: 900 };
  win = new BrowserWindow({
    ...b, minWidth: 720, minHeight: 480, show: false,
    title: 'Gapa', backgroundColor: '#1b1b1b',
    icon: iconFile(settings.icon),
    autoHideMenuBar: true,
    // pasek tytułu schowany — przyciski okna rysuje system w górnym pasku programu
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 19 } }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f5', symbolColor: '#4a4945', height: 52 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, plugins: true }
  });
  if (settings.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  const remember = () => { if (!win.isMaximized() && !win.isMinimized()) settings.bounds = win.getBounds(); settings.maximized = win.isMaximized(); };
  win.on('resize', remember); win.on('move', remember);
  // pełny ekran: przyciski okna znikają, więc pasek programu oddaje zarezerwowane dla nich miejsce
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  win.on('close', () => { remember(); saveSettings(); });
  // linki zewnętrzne w przeglądarce, nie w oknie programu
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function buildMenu() {
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Plik', submenu: [
      { label: 'Otwórz folder…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'open') },
      { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit', label: 'Zakończ' }] },
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
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    loadSettings();
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
    createWindow();
    if (settings.icon === 'retro') applyIcon();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('before-quit', () => { saveIndexNow(); saveSettings(); });
  app.on('window-all-closed', () => { saveIndexNow(); app.quit(); });
}
