import type { FootageImage } from '@engine/footage/FootageEngine'

// Bundled sample images live in client/public/sample-archive/ and are served at
// /sample-archive/*. Replace or extend this set, or wire a real archive via the
// media node + worker in Phase D.
const BUNDLED = ['01.jpg', '02.jpg', '03.jpg', '04.jpg', '05.jpg', '06.jpg', '07.jpg', '08.jpg']

export function bundledArchive(): FootageImage[] {
  return BUNDLED.map((file, i) => ({
    id: `sample-${String(i + 1).padStart(2, '0')}`,
    name: file,
    url: `${import.meta.env.BASE_URL}sample-archive/${file}`,
  }))
}

// Procedural fallback — if no bundled or imported images are present, generate a
// handful of visually distinct frames so the point cloud + choreography still
// have something to chew on (and match-on-action has color variety).
export function proceduralArchive(count = 6): FootageImage[] {
  const palettes: Array<[string, string, string]> = [
    ['#ff2418', '#1f4dff', '#f1f1ea'],
    ['#c8ff2f', '#050505', '#ff5a1f'],
    ['#1f4dff', '#f1f1ea', '#ff2418'],
    ['#ff5a1f', '#050505', '#c8ff2f'],
    ['#f1f1ea', '#ff2418', '#1f4dff'],
    ['#7cbfa5', '#050505', '#e0b75c'],
  ]
  const out: FootageImage[] = []
  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = 768
    canvas.height = 768
    const ctx = canvas.getContext('2d')!
    const [a, b, c] = palettes[i % palettes.length]
    ctx.fillStyle = '#050505'
    ctx.fillRect(0, 0, 768, 768)
    const g = ctx.createLinearGradient(0, 0, 768, 768)
    g.addColorStop(0, a)
    g.addColorStop(0.55, b)
    g.addColorStop(1, c)
    ctx.fillStyle = g
    ctx.globalAlpha = 0.85
    ctx.fillRect(40, 40, 688, 688)
    ctx.globalAlpha = 1
    ctx.strokeStyle = c
    ctx.lineWidth = 8
    for (let k = 0; k < 6; k++) {
      ctx.beginPath()
      ctx.arc(384, 384, 60 + k * 52, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = a
    ctx.font = '900 140px "Helvetica Neue", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1).padStart(2, '0'), 384, 384)
    out.push({ id: `proc-${i}`, name: `procedural ${i + 1}`, url: canvas.toDataURL('image/png') })
  }
  return out
}
