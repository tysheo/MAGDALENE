import * as THREE from 'three'

// Builds a single-row glyph atlas texture: each character of the ramp is drawn
// into its own square cell, ordered dark -> light. The ASCII pass indexes into
// this by luminance. Real character-based ASCII, not pixel blocks.

export type GlyphAtlas = {
  texture: THREE.Texture
  count: number
}

// Dark to light density ramp. Leading space = empty cell for black regions.
export const ASCII_RAMP = ' .,:;i1tfLCG08@'

export function buildGlyphAtlas(ramp = ASCII_RAMP, cell = 24): GlyphAtlas {
  const count = ramp.length
  const canvas = document.createElement('canvas')
  canvas.width = cell * count
  canvas.height = cell
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.floor(cell * 0.92)}px "JetBrains Mono", "IBM Plex Mono", "Consolas", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < count; i++) {
    ctx.fillText(ramp[i], i * cell + cell / 2, cell / 2 + cell * 0.06)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  // Draw order is top-left origin; keep it so glyph orientation matches.
  texture.flipY = false
  texture.colorSpace = THREE.NoColorSpace

  return { texture, count }
}
