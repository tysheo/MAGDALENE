import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import { DEFAULT_PROJECT } from './defaultProject.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const APP_VERSION = '0.1.0'
const DEV_URL = process.env.MAGDALENE_DEV_URL || null
const isDev = !!DEV_URL

const projectsDir = path.join(app.getPath('documents'), 'MAGDALENE', 'projects')
const outputDir = path.join(app.getPath('documents'), 'MAGDALENE', 'output')

/** @type {BrowserWindow | null} */
let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#151311',
    autoHideMenuBar: true,
    title: 'MAGDALENE',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Dev utility: MAGDALENE_CAPTURE=/path.png renders the app, grabs a frame of
  // the live engine, writes it, and quits. Used for automated visual checks.
  if (process.env.MAGDALENE_CAPTURE) {
    mainWindow.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 4500))
      try {
        const image = await mainWindow.webContents.capturePage()
        await fs.writeFile(process.env.MAGDALENE_CAPTURE, image.toPNG())
      } catch (err) {
        console.error('capture failed', err)
      }
      app.quit()
    })
  }

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(root, 'dist', 'client', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function slugify(name) {
  return (
    String(name || 'untitled')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  )
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }
const MAX_ARCHIVE = 80

// Run a short-lived child process and resolve with its stdout, or reject on
// failure / non-zero exit. Used to detect ffmpeg and to drive python workers.
function runProcess(cmd, args, { input, timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      reject(err)
      return
    }
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('timeout'))
    }, timeoutMs)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(out)
      else reject(new Error(err || `exit ${code}`))
    })
    if (input != null) {
      child.stdin.write(input)
      child.stdin.end()
    }
  })
}

// Locate a bundled python worker. Override with the MAGDALENE_*_WORKER env vars
// (used during dev) or drop the scripts in <root>/workers/.
function workerPath(envVar, file) {
  return process.env[envVar] || path.join(root, 'workers', file)
}

async function pythonBin() {
  for (const bin of [process.env.MAGDALENE_PYTHON, 'python3', 'python']) {
    if (!bin) continue
    try {
      await runProcess(bin, ['--version'], { timeoutMs: 5000 })
      return bin
    } catch {
      /* try next */
    }
  }
  return null
}

function registerIpc() {
  ipcMain.handle('app:health', () => ({ ok: true, app: 'MAGDALENE', version: APP_VERSION }))

  ipcMain.handle('project:default', () => DEFAULT_PROJECT)

  ipcMain.handle('project:save', async (_event, payload) => {
    const { name, project } = payload || {}
    await fs.mkdir(projectsDir, { recursive: true })
    const filePath = path.join(projectsDir, `${slugify(name)}.magdalene`)
    await fs.writeFile(filePath, JSON.stringify(project ?? payload, null, 2))
    return { ok: true, path: filePath }
  })

  ipcMain.handle('project:export', async () => {
    await fs.mkdir(outputDir, { recursive: true })
    let hasFfmpeg = false
    try {
      await runProcess('ffmpeg', ['-version'], { timeoutMs: 5000 })
      hasFfmpeg = true
    } catch {
      hasFfmpeg = false
    }
    return {
      ok: true,
      status: hasFfmpeg ? 'ready' : 'no-ffmpeg',
      outputDir,
      hasFfmpeg,
      note: hasFfmpeg
        ? `ffmpeg detected — deterministic offline render writes to ${outputDir}.`
        : 'ffmpeg not found on PATH; install it to enable offline mp4 export. Live capture still works.'
    }
  })

  // Scan an image archive folder. Returns images as data URLs so the renderer's
  // ImageLoader can fetch them under contextIsolation without a file:// fetch.
  ipcMain.handle('media:scanArchive', async () => {
    if (!mainWindow) return { ok: false, canceled: true }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Link image archive',
      properties: ['openDirectory']
    })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return { ok: false, canceled: true }

    let entries = []
    try {
      entries = await fs.readdir(dir)
    } catch {
      return { ok: false, error: 'read failed' }
    }
    const files = entries.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase())).slice(0, MAX_ARCHIVE)
    const images = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const bytes = await fs.readFile(path.join(dir, file))
        const mime = MIME[path.extname(file).toLowerCase()] || 'image/jpeg'
        images.push({
          id: `arch-${i}-${slugify(file)}`,
          name: file,
          url: `data:${mime};base64,${bytes.toString('base64')}`
        })
      } catch {
        /* skip unreadable */
      }
    }
    return { ok: true, dir, total: entries.length, count: images.length, images }
  })

  // Analyze a track with the python audio brain if available; otherwise signal a
  // browser FFT fallback (the engine's scheduler synthesizes beats from FFT).
  ipcMain.handle('audio:analyze', async (_event, payload) => {
    const filePath = payload?.path
    if (!filePath) return { ok: false, backend: 'FFT FALLBACK' }
    const script = workerPath('MAGDALENE_AUDIO_WORKER', 'guernica_audio_brain.py')
    try {
      await fs.access(script)
    } catch {
      return { ok: false, backend: 'FFT FALLBACK', note: 'no audio worker bundled' }
    }
    const py = await pythonBin()
    if (!py) return { ok: false, backend: 'FFT FALLBACK', note: 'python not found' }
    try {
      const out = await runProcess(py, [script, filePath], { timeoutMs: 300000 })
      const analysis = JSON.parse(out)
      return { ok: true, backend: analysis.backend || 'BRAIN', analysis }
    } catch (err) {
      return { ok: false, backend: 'FFT FALLBACK', note: String(err?.message || err) }
    }
  })

  ipcMain.handle('dialog:openAudio', async () => {
    if (!mainWindow) return { ok: false, canceled: true }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Load track',
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'] }],
      properties: ['openFile']
    })
    const filePath = result.filePaths[0]
    if (result.canceled || !filePath) return { ok: false, canceled: true }

    const bytes = await fs.readFile(filePath)
    const name = path.basename(filePath)

    // Pick up a sibling .lrc (same basename) for synced lyrics, if present.
    let lyrics = null
    const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc')
    try {
      lyrics = await fs.readFile(lrcPath, 'utf8')
    } catch {
      lyrics = null
    }

    return { ok: true, path: filePath, name, bytes, lyrics }
  })

  ipcMain.handle('dialog:openProject', async () => {
    if (!mainWindow) return { ok: false, canceled: true }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open MAGDALENE project',
      defaultPath: projectsDir,
      filters: [{ name: 'MAGDALENE project', extensions: ['magdalene'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true }
    const raw = await fs.readFile(result.filePaths[0], 'utf8')
    return { ok: true, path: result.filePaths[0], project: JSON.parse(raw) }
  })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
