import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { createServer } from 'net'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1'
const BRIDGE_PORT = 7337

let mainWindow = null
let bridgeProcess = null
let bridgeReady = false

// ─── Resolve paths (works both in dev and packaged AppImage) ──────────────────

function getResourcePath(rel) {
  if (app.isPackaged) {
    // Inside AppImage: resources are in process.resourcesPath
    return join(process.resourcesPath, rel)
  }
  return join(__dirname, rel)
}

// ─── Wait for bridge port to be available ────────────────────────────────────

function waitForBridge(port, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function attempt() {
      const sock = createServer()
      sock.once('error', () => {
        // Port is in use = bridge is up
        resolve()
      })
      sock.once('listening', () => {
        sock.close()
        if (Date.now() - start > timeout) {
          reject(new Error('Bridge timeout'))
        } else {
          setTimeout(attempt, 200)
        }
      })
      sock.listen(port, '127.0.0.1')
    }
    attempt()
  })
}

// ─── Start Python bridge ──────────────────────────────────────────────────────

async function startBridge() {
  const bridgePath = getResourcePath('nitro-bridge.py')

  if (!existsSync(bridgePath)) {
    console.error('[main] nitro-bridge.py not found at:', bridgePath)
    return false
  }

  console.log('[main] Starting bridge:', bridgePath)

  bridgeProcess = spawn('python3', [bridgePath], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  bridgeProcess.stdout.on('data', (d) => console.log('[bridge]', d.toString().trim()))
  bridgeProcess.stderr.on('data', (d) => console.error('[bridge:err]', d.toString().trim()))

  bridgeProcess.on('exit', (code, signal) => {
    console.log(`[main] Bridge exited: code=${code} signal=${signal}`)
    bridgeProcess = null
    bridgeReady = false
  })

  bridgeProcess.on('error', (err) => {
    console.error('[main] Bridge spawn error:', err.message)
  })

  try {
    await waitForBridge(BRIDGE_PORT, 8000)
    bridgeReady = true
    console.log('[main] Bridge ready on port', BRIDGE_PORT)
    return true
  } catch {
    console.error('[main] Bridge did not start in time')
    return false
  }
}

// ─── IPC handlers (renderer calls these instead of fetch) ────────────────────

async function bridgeRequest(path, options = {}) {
  if (!bridgeReady) {
    return {
      status: 'error',
      reason: 'bridge_not_ready',
      message: 'Python bridge is not ready.',
    }
  }

  try {
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}${path}`, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(4000),
    })
    const payload = await res.json().catch(() => ({
      status: 'error',
      reason: 'invalid_bridge_response',
      message: `Bridge returned HTTP ${res.status} with invalid JSON.`,
    }))

    if (!res.ok && payload.status !== 'error') {
      return {
        status: 'error',
        reason: 'bridge_http_error',
        message: payload.message || `Bridge returned HTTP ${res.status}.`,
      }
    }

    return payload
  } catch (error) {
    return {
      status: 'error',
      reason: 'bridge_request_failed',
      message: error.message,
    }
  }
}

ipcMain.handle('fan:read', async () => {
  return bridgeRequest('/read', { signal: AbortSignal.timeout(2500) })
})

ipcMain.handle('fan:write', async (_event, cpu, gpu) => {
  return bridgeRequest('/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpu, gpu }),
    signal: AbortSignal.timeout(10000),
  })
})

ipcMain.handle('fan:diagnostics', async () => {
  return bridgeRequest('/diagnostics', { signal: AbortSignal.timeout(2500) })
})

// ─── Create window ────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0d0d0d',
      symbolColor: '#FF4400',
      height: 32,
    },
    frame: false,
    show: false,
    icon: getResourcePath('icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
    },
  })

  // Load built dist or dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const distPath = join(getResourcePath('dist'), 'index.html')
    mainWindow.loadFile(distPath)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ─── Custom title bar controls ────────────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Start bridge first (non-blocking — window opens while bridge warms up)
  startBridge().catch(console.error)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killBridge()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', killBridge)
app.on('will-quit', killBridge)

function killBridge() {
  if (bridgeProcess) {
    console.log('[main] Killing bridge...')
    try {
      bridgeProcess.kill('SIGTERM')
      // Force kill after 1s if still running
      setTimeout(() => {
        if (bridgeProcess) bridgeProcess.kill('SIGKILL')
      }, 1000)
    } catch {}
    bridgeProcess = null
    bridgeReady = false
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})
