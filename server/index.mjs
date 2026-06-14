import { createServer } from 'node:http'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist', 'client')
const projectsDir = path.join(root, 'projects')
const outputDir = path.join(root, 'output')
const port = Number(process.env.PORT || 5178)

const DEFAULT_PROJECT = {
  version: '0.1.0',
  name: 'Untitled Magdalene',
  timeline: {
    duration: 186,
    bpm: 124,
    lanes: [
      { id: 'kick', label: 'KICK', kind: 'stem', color: '#d84c3f', events: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160] },
      { id: 'snare', label: 'SNARE', kind: 'stem', color: '#e0b75c', events: [6, 14, 22, 30, 46, 62, 94, 126, 158] },
      { id: 'lyrics', label: 'LYRICS', kind: 'text', color: '#7cbfa5', events: [18, 38, 72, 111, 144] },
      { id: 'sections', label: 'SECTIONS', kind: 'section', color: '#8a78d6', events: [0, 24, 64, 96, 128, 168] }
    ],
    markers: [
      { id: 'm1', time: 24, label: 'FIRST CUT', target: 'layout.mode', value: 'duo_h' },
      { id: 'm2', time: 64, label: 'RUPTURE', target: 'fx.datamosh', value: 0.72 },
      { id: 'm3', time: 128, label: 'TEXT BODY', target: 'typography.visible', value: true }
    ]
  },
  media: [
    { id: 'audio-1', type: 'audio', name: 'Track.wav', status: 'analysis ready' },
    { id: 'archive-1', type: 'image', name: 'Archive folder', status: 'unlinked' },
    { id: 'video-1', type: 'video', name: 'Fragment.mov', status: 'unlinked' },
    { id: 'text-1', type: 'text', name: 'Lyrics / evidence text', status: 'draft' }
  ],
  graph: {
    nodes: [
      { id: 'audio', type: 'magdalene', position: { x: -520, y: -160 }, data: { label: 'Audio Track', subtitle: 'waveform + analysis', tone: 'red' } },
      { id: 'beats', type: 'magdalene', position: { x: -250, y: -230 }, data: { label: 'Beat Grid', subtitle: 'bars / kicks / snares', tone: 'amber' } },
      { id: 'stems', type: 'magdalene', position: { x: -250, y: -90 }, data: { label: 'Stem Energy', subtitle: 'bass / hats / vocals', tone: 'moss' } },
      { id: 'archive', type: 'magdalene', position: { x: -520, y: 70 }, data: { label: 'Media Archive', subtitle: 'images / video / text', tone: 'bone' } },
      { id: 'picker', type: 'magdalene', position: { x: 30, y: -20 }, data: { label: 'Media Picker', subtitle: 'chooses source per moment', tone: 'bone' } },
      { id: 'layout', type: 'magdalene', position: { x: 320, y: -150 }, data: { label: 'Layout Director', subtitle: 'solo / quad / filmstrip', tone: 'violet' } },
      { id: 'particles', type: 'magdalene', position: { x: 610, y: -30 }, data: { label: 'Particle Field', subtitle: 'subject-aware image body', tone: 'moss' } },
      { id: 'typography', type: 'magdalene', position: { x: 320, y: 95 }, data: { label: 'Typography', subtitle: 'lyrics / witness text', tone: 'red' } },
      { id: 'fx', type: 'magdalene', position: { x: 890, y: -70 }, data: { label: 'FX Chain', subtitle: 'datamosh / tear / bloom', tone: 'amber' } },
      { id: 'render', type: 'magdalene', position: { x: 1180, y: -40 }, data: { label: 'Render Output', subtitle: 'preview + final mp4', tone: 'violet' } }
    ],
    edges: [
      { id: 'audio-beats', source: 'audio', target: 'beats', animated: true },
      { id: 'audio-stems', source: 'audio', target: 'stems', animated: true },
      { id: 'beats-picker', source: 'beats', target: 'picker' },
      { id: 'archive-picker', source: 'archive', target: 'picker' },
      { id: 'picker-layout', source: 'picker', target: 'layout' },
      { id: 'layout-particles', source: 'layout', target: 'particles', animated: true },
      { id: 'stems-fx', source: 'stems', target: 'fx' },
      { id: 'particles-fx', source: 'particles', target: 'fx' },
      { id: 'archive-typography', source: 'archive', target: 'typography' },
      { id: 'typography-fx', source: 'typography', target: 'fx' },
      { id: 'fx-render', source: 'fx', target: 'render', animated: true }
    ]
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body, null, 2))
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function contentType(filePath) {
  const ext = path.extname(filePath)
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

async function serveStatic(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const safePath = url.pathname === '/' ? '/index.html' : url.pathname
  const filePath = path.normalize(path.join(distDir, safePath))
  if (!filePath.startsWith(distDir) || !existsSync(filePath)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, { 'content-type': contentType(filePath) })
  res.end(await fs.readFile(filePath))
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, app: 'MAGDALENE', version: '0.1.0' })
    }
    if (url.pathname === '/api/project/default') {
      return sendJson(res, 200, DEFAULT_PROJECT)
    }
    if (url.pathname === '/api/project/save' && req.method === 'POST') {
      const body = await readBody(req)
      await fs.mkdir(projectsDir, { recursive: true })
      const name = String(body.name || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'
      const filePath = path.join(projectsDir, `${name}.magdalene`)
      await fs.writeFile(filePath, JSON.stringify(body.project || body, null, 2))
      return sendJson(res, 200, { ok: true, path: filePath })
    }
    if (url.pathname === '/api/export' && req.method === 'POST') {
      await fs.mkdir(outputDir, { recursive: true })
      return sendJson(res, 202, {
        ok: true,
        status: 'queued',
        note: 'Export queue is stubbed until the render engine is migrated.'
      })
    }
    if (existsSync(distDir)) return serveStatic(req, res)
    res.writeHead(404)
    res.end('MAGDALENE dev server: client is served by Vite on :5177')
  } catch (error) {
    sendJson(res, 500, { ok: false, error: String(error?.message || error) })
  }
}).listen(port, () => {
  console.log(`MAGDALENE server listening on http://localhost:${port}`)
})

