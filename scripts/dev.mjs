import { spawn } from 'node:child_process'
import http from 'node:http'

const RENDERER_PORT = Number(process.env.MAGDALENE_PORT || 5177)
const RENDERER_URL = `http://localhost:${RENDERER_PORT}`

const children = []
let shuttingDown = false

function run(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, ...extraEnv }
  })
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
  child.on('exit', (code) => {
    if (shuttingDown) return
    if (name === 'electron') {
      shutdown(code ?? 0)
    } else if (code && code !== 0) {
      console.error(`[${name}] exited with ${code}`)
      shutdown(code)
    }
  })
  children.push(child)
  return child
}

function shutdown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    try {
      child.kill('SIGTERM')
    } catch {
      /* ignore */
    }
  }
  process.exit(code)
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Renderer did not start within ${timeoutMs}ms`))
        } else {
          setTimeout(attempt, 300)
        }
      })
    }
    attempt()
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

run('vite', 'node', ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', String(RENDERER_PORT), '--strictPort'])

waitForServer(RENDERER_URL)
  .then(() => {
    run('electron', 'node', ['node_modules/electron/cli.js', '.'], { MAGDALENE_DEV_URL: RENDERER_URL })
  })
  .catch((error) => {
    console.error(error.message)
    shutdown(1)
  })
