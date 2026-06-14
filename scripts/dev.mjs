import { spawn } from 'node:child_process'

const procs = [
  ['server', ['run', 'dev:server']],
  ['client', ['run', 'dev:client']]
]

const children = procs.map(([name, args]) => {
  const child = spawn('npm', args, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false
  })
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`))
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`))
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with ${code}`)
      for (const proc of children) proc.kill('SIGTERM')
      process.exit(code)
    }
  })
  return child
})

process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGTERM')
  process.exit(0)
})
