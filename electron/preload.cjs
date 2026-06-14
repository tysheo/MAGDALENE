const { contextBridge, ipcRenderer } = require('electron')

// The native bridge. The renderer talks to the main process through this
// instead of HTTP, which is the whole reason MAGDALENE is a native app:
// real filesystem, native dialogs, and managed worker processes.
contextBridge.exposeInMainWorld('magdalene', {
  isNative: true,
  health: () => ipcRenderer.invoke('app:health'),
  getDefaultProject: () => ipcRenderer.invoke('project:default'),
  saveProject: (name, project) => ipcRenderer.invoke('project:save', { name, project }),
  exportProject: (project) => ipcRenderer.invoke('project:export', { project }),
  openProject: () => ipcRenderer.invoke('dialog:openProject'),
  openAudio: () => ipcRenderer.invoke('dialog:openAudio'),
  scanArchive: () => ipcRenderer.invoke('media:scanArchive'),
  analyzeAudio: (filePath) => ipcRenderer.invoke('audio:analyze', { path: filePath })
})
