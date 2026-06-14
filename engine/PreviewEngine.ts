import * as THREE from 'three'
import { ParticleField } from './particles/ParticleField'
import { buildGlyphAtlas } from './ascii/GlyphAtlas'
import { makeWordmarkCanvas, sampleCanvas, type SampledCloud } from './media/sampleSource'
import type { AudioLevels } from './audio/AudioEngine'

// PreviewEngine owns the WebGL context and runs its own render loop outside
// React. It renders the particle visualiser into an offscreen target, then a
// fullscreen ASCII pass re-renders that target as character glyphs — real ASCII
// art, recomputed every frame so it stays alive with the motion + audio.

export type AudioSource = { getLevels(): AudioLevels }

export type PreviewEngineOptions = {
  intensity?: number
  cell?: number
  audio?: AudioSource
}

const ASCII_FS = /* glsl */ `
  precision highp float;

  uniform sampler2D uScene;
  uniform sampler2D uGlyphs;
  uniform float uCount;
  uniform float uCell;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uBeat;

  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 fragPx = vUv * uResolution;
    vec2 cellId = floor(fragPx / uCell);
    vec2 cellCenter = (cellId + 0.5) * uCell / uResolution;

    vec3 sceneCol = texture2D(uScene, cellCenter).rgb;
    float l = luma(sceneCol);

    // Slight per-cell flicker keeps the field from looking static; a beat
    // momentarily lifts every cell up the density ramp.
    l *= 0.92 + 0.08 * sin(uTime * 3.0 + cellId.x * 0.7 + cellId.y * 1.3);
    l += uBeat * 0.18;

    float idx = floor(clamp(l, 0.0, 0.999) * uCount);
    vec2 local = fract(fragPx / uCell);
    vec2 guv = vec2((idx + local.x) / uCount, local.y);
    float g = texture2D(uGlyphs, guv).r;

    // Tint the glyph toward paper but keep a memory of the source color.
    // Beats flash the glyphs toward the signature red.
    vec3 paper = vec3(0.945, 0.945, 0.917);
    vec3 col = mix(sceneCol * 1.6, paper, 0.45) * g;
    col = mix(col, vec3(1.0, 0.14, 0.09) * g, uBeat * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`

export class PreviewEngine {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private field: ParticleField | null = null
  private plane: THREE.Mesh
  private canvas: HTMLCanvasElement
  private sceneTarget: THREE.WebGLRenderTarget
  private asciiScene: THREE.Scene
  private asciiCamera: THREE.OrthographicCamera
  private asciiMaterial: THREE.ShaderMaterial
  private resizeObserver: ResizeObserver | null = null
  private rafId = 0
  private startTime = performance.now()
  private running = false
  private audio: AudioSource | null = null
  private beatShake = 0

  constructor(canvas: HTMLCanvasElement, opts: PreviewEngineOptions = {}) {
    this.canvas = canvas
    this.audio = opts.audio ?? null

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance'
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x050505, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120)
    this.camera.position.set(0, 0, 9)

    // Build the source once; reuse it for both the particle cloud and a faint
    // backing plane so the ASCII pass has structure plus particle sparkle.
    const sourceCanvas = makeWordmarkCanvas()
    const cloud = sampleCanvas(sourceCanvas, { target: 95000 })
    this.setCloud(cloud, opts.intensity ?? 0.7)

    const planeTex = new THREE.CanvasTexture(sourceCanvas)
    planeTex.colorSpace = THREE.SRGBColorSpace
    const aspect = sourceCanvas.width / sourceCanvas.height
    const planeH = 7
    this.plane = new THREE.Mesh(
      new THREE.PlaneGeometry(planeH * aspect, planeH),
      new THREE.MeshBasicMaterial({ map: planeTex, transparent: true, opacity: 0.5, depthWrite: false })
    )
    this.plane.position.z = -0.6
    this.scene.add(this.plane)

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.sceneTarget = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    })

    const glyphs = buildGlyphAtlas()
    this.asciiScene = new THREE.Scene()
    this.asciiCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.asciiMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: this.sceneTarget.texture },
        uGlyphs: { value: glyphs.texture },
        uCount: { value: glyphs.count },
        uCell: { value: opts.cell ?? 12 },
        uResolution: { value: new THREE.Vector2(size.x, size.y) },
        uTime: { value: 0 },
        uBeat: { value: 0 }
      },
      vertexShader:
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: ASCII_FS,
      depthTest: false,
      depthWrite: false
    })
    this.asciiScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.asciiMaterial))

    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
  }

  setCloud(cloud: SampledCloud, intensity = 0.7) {
    if (this.field) {
      this.scene.remove(this.field.object)
      this.field.dispose()
    }
    this.field = new ParticleField(cloud)
    this.field.setIntensity(intensity)
    this.scene.add(this.field.object)
  }

  setIntensity(value: number) {
    this.field?.setIntensity(value)
  }

  start() {
    if (this.running) return
    this.running = true
    const loop = () => {
      this.rafId = requestAnimationFrame(loop)
      this.frame()
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private frame() {
    const t = (performance.now() - this.startTime) / 1000
    const levels = this.audio?.getLevels() ?? { bass: 0, mid: 0, high: 0, level: 0, beat: 0 }

    this.field?.update(t)
    this.field?.setAudio(levels.bass, levels.beat)
    this.asciiMaterial.uniforms.uTime.value = t
    this.asciiMaterial.uniforms.uBeat.value = levels.beat

    // Camera lurches on strong beats, then springs back.
    this.beatShake = Math.max(this.beatShake * 0.85, levels.beat)
    const shakeX = (Math.random() - 0.5) * this.beatShake * 0.5
    const shakeY = (Math.random() - 0.5) * this.beatShake * 0.5

    const orbit = Math.sin(t * 0.18)
    this.camera.position.x = orbit * 1.4 + shakeX
    this.camera.position.y = Math.cos(t * 0.14) * 0.6 + shakeY
    this.camera.position.z = 9 + Math.sin(t * 0.1) * 0.6 - levels.beat * 0.6
    this.camera.lookAt(0, 0, 0)

    this.renderer.setRenderTarget(this.sceneTarget)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    this.renderer.setRenderTarget(null)
    this.renderer.render(this.asciiScene, this.asciiCamera)
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    this.sceneTarget.setSize(Math.max(1, size.x), Math.max(1, size.y))
    this.asciiMaterial.uniforms.uResolution.value.set(size.x, size.y)
  }

  dispose() {
    this.stop()
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.field?.dispose()
    this.field = null
    this.sceneTarget.dispose()
    this.asciiMaterial.dispose()
    this.renderer.dispose()
  }
}
