const { contextBridge, ipcRenderer } = require('electron');

// Keep the privileged bridge deliberately small. Never expose ipcRenderer or an
// Electron event object to document content or the React renderer.
function subscribe(channel, callback) {
  if (typeof callback !== 'function') throw new TypeError('Expected a callback.');
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  platform: process.platform,
  openFiles: () => ipcRenderer.invoke('pdf:open'),
  saveFile: (name, data, path) => ipcRenderer.invoke('pdf:save', name, data, path),
  openRecent: (path) => ipcRenderer.invoke('pdf:recent-open', path),
  getRecent: () => ipcRenderer.invoke('pdf:recents'),
  print: (data) => ipcRenderer.invoke('pdf:print', data),
  windowControl: (action) => {
    if (['minimize', 'maximize', 'close'].includes(action)) ipcRenderer.send('window:control', action);
  },
  onOpenFile: (callback) => {
    const unsubscribe = subscribe('pdf:opened', callback);
    ipcRenderer.send('app:ready');
    return unsubscribe;
  },
  onMenuAction: (callback) => subscribe('app:menu', callback),
  aiModels: () => ipcRenderer.invoke('ai:models'),
  aiChat: (model, question, context) => ipcRenderer.invoke('ai:chat', model, question, context),
}));
