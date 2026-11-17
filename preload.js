// Most między oknem a procesem głównym: tylko te funkcje są dostępne dla interfejsu.
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  sep: path.sep,
  dirname: p => path.dirname(p),
  basename: p => path.basename(p),
  parse: p => path.parse(p),
  fileUrl: p => 'pgf://f/' + encodeURIComponent(p),

  list: (dir, exts) => ipcRenderer.invoke('list', dir, exts),
  exists: p => ipcRenderer.invoke('exists', p),
  roots: () => ipcRenderer.invoke('roots'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  watch: dir => ipcRenderer.invoke('watch', dir),
  onDirChanged: cb => ipcRenderer.on('dir-changed', (e, d) => cb(d)),
  onMenu: cb => ipcRenderer.on('menu', (e, a) => cb(a)),

  thumbGet: k => ipcRenderer.invoke('thumb-get', k),
  thumbPut: (k, buf, dims, meta) => ipcRenderer.invoke('thumb-put', k, buf, dims, meta),
  thumbForget: h => ipcRenderer.invoke('thumb-forget', h),
  cacheInfo: () => ipcRenderer.invoke('cache-info'),
  cacheClear: () => ipcRenderer.invoke('cache-clear'),
  cacheChoose: () => ipcRenderer.invoke('cache-choose'),
  cacheLimit: mb => ipcRenderer.invoke('cache-limit', mb),
  cacheReveal: () => ipcRenderer.invoke('cache-reveal'),

  showInFolder: p => ipcRenderer.invoke('show-in-folder', p),
  openDefault: p => ipcRenderer.invoke('open-default', p),
  openEditor: (files, choose) => ipcRenderer.invoke('open-editor', files, choose),
  editorName: () => ipcRenderer.invoke('editor-name'),
  dragOut: files => ipcRenderer.send('drag-out', files),
  osThumb: (p, size) => ipcRenderer.invoke('os-thumb', p, size),
  fileHref: p => require('url').pathToFileURL(p).href,
  pathForFile: f => { try { return webUtils.getPathForFile(f); } catch (e) { return null; } }
});
