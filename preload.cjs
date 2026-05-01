// preload.js — CommonJS (Electron preload cannot use ESM)
const { contextBridge, ipcRenderer } = require('electron')

async function invoke(channel, ...args) {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    return {
      status: 'error',
      reason: 'ipc_failed',
      message: error.message,
    }
  }
}

contextBridge.exposeInMainWorld('nitro', {
  readFan: () => invoke('fan:read'),
  writeFan: (cpu, gpu) => invoke('fan:write', cpu, gpu),
  getDiagnostics: () => invoke('fan:diagnostics'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isElectron: true,
})
