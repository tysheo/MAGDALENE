// FootageEngine — the FOUND / FOOTAGE render engine, lifted out of the original
// FoundFootageApp and stripped of all DOM / server coupling so MAGDALENE can own
// it. It reproduces FF's boot() + loop() faithfully: particle field, cell
// director, scheduler, choreography, camera rig, post-process composer, and the
// typography overlay. The public surface (setManifest / loadAudio / run / halt /
// cueImage / cueLayout / applyPreset) is the same control surface the graph
// runtime will drive in Phase B.
//
// The ported engine modules are plain JS (see engine/footage/**). They are typed
// loosely here on purpose — they are dynamic, GLSL-heavy internals, not a public
// API.
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three'
import { Renderer } from './render/Renderer.js'
import { CameraRig } from './render/CameraRig.js'
import { RenderTargets } from './render/RenderTargets.js'
import { PassComposer } from './render/PassComposer.js'
import { SceneBuilder } from './render/SceneBuilder.js'
import { AudioPlayer } from './audio/AudioPlayer.js'
import { AudioBrain } from './audio/AudioBrain.js'
import { PersistentParticleField } from './particles/PersistentParticleField.js'
import { CellDirector, layoutCellCount } from './particles/CellDirector.js'
import type { Runtime, FrameInput } from '../runtime/Runtime'
import type { EffectWeights, EngineCommand, Macros, RenderState, RuntimeMarker } from '../runtime/types'
import { LivingEditScheduler } from './scheduler/LivingEditScheduler.js'
import { Choreography } from './scheduler/Choreography.js'
import { ImageLoader } from './media/ImageLoader.js'
import { EvidenceOverlay } from './overlay/EvidenceOverlay.js'
import { FeedbackPass } from './effects/FeedbackPass.js'
import { RGBTearPass } from './effects/RGBTearPass.js'
import { SlitScanPass } from './effects/SlitScanPass.js'
import { PixelSortPass } from './effects/PixelSortPass.js'
import { DitherPass } from './effects/DitherPass.js'
import { DatamoshPass } from './effects/DatamoshPass.js'
import { FlowComputePass } from './effects/FlowComputePass.js'
import { BloomPass } from './effects/BloomPass.js'

export type FootageImage = {
  id: string
  url: string
  name?: string
  maps?: Record<string, string>
  analysis?: any
}

export type FootageAnalysis = {
  controls?: any[]
  events?: any[]
  sections?: any[]
  beats?: number[]
  tempo?: number
}

export type FootageState = {
  frame: number
  audioTime: number
  musicState: string
  transitionMode: string
  running: boolean
  flash: boolean
}

// An external audio source can drive the engine instead of its own AudioPlayer
// (e.g. MAGDALENE's shared AudioEngine that also feeds the timeline + waveform).
// Shape matches FF's internal AudioPlayer so the loop is source-agnostic.
export interface AudioSource {
  currentTime(): number
  update(): { bass: number; mid: number; high: number; impact: number }
  resume?(): void
  pause?(): void
  duration?(): number | null
}

export type FootageEngineOptions = {
  doctrine?: string
  onState?: (state: FootageState) => void
  audioSource?: AudioSource
}

const DEFAULT_MACROS = {
  intensity: 0.78,
  violence: 0.62,
  decay: 0.55,
  reactivity: 0.7,
  temporalInstability: 0.5,
  spatialTension: 0.55,
  resolutionCollapse: 0.4,
  humanPresence: 0.5,
  growth: 0.6,
  compressionDamage: 0.45,
}

const NEUTRAL_EFFECT_BIAS = {
  feedback: 1, rgbTear: 1, slitScan: 1, pixelSort: 1, datamosh: 1, dither: 1, bloom: 1,
}

// DOCTRINE presets — macro profile + per-pass effect bias, lifted from FF.
const PRESETS: Record<string, any> = {
  minimal: {
    visualMode: 'default',
    macros: {
      intensity: 0.42, violence: 0.22, decay: 0.40, reactivity: 0.55,
      temporalInstability: 0.25, spatialTension: 0.45, resolutionCollapse: 0.18,
      humanPresence: 0.55, growth: 0.35, compressionDamage: 0.20,
    },
    effects: { feedback: 0.55, rgbTear: 0.25, slitScan: 0.30, pixelSort: 0.15, datamosh: 0.45, dither: 0.40, bloom: 1.20 },
  },
  standard: {
    visualMode: 'default',
    macros: { ...DEFAULT_MACROS },
    effects: { ...NEUTRAL_EFFECT_BIAS },
  },
  heavy: {
    visualMode: 'default',
    macros: {
      intensity: 0.90, violence: 0.82, decay: 0.68, reactivity: 0.85,
      temporalInstability: 0.72, spatialTension: 0.70, resolutionCollapse: 0.62,
      humanPresence: 0.50, growth: 0.72, compressionDamage: 0.65,
    },
    effects: { feedback: 1.5, rgbTear: 1.5, slitScan: 1.4, pixelSort: 1.6, datamosh: 1.7, dither: 1.25, bloom: 1.3 },
  },
  rupture: {
    visualMode: 'default',
    macros: {
      intensity: 1.00, violence: 0.95, decay: 0.85, reactivity: 0.95,
      temporalInstability: 0.90, spatialTension: 0.88, resolutionCollapse: 0.85,
      humanPresence: 0.45, growth: 0.85, compressionDamage: 0.82,
    },
    effects: { feedback: 1.8, rgbTear: 2.2, slitScan: 1.9, pixelSort: 2.6, datamosh: 2.4, dither: 1.6, bloom: 1.0 },
  },
}

export class FootageEngine {
  private canvas!: HTMLCanvasElement
  private overlayCanvas!: HTMLCanvasElement
  private onState?: (state: FootageState) => void
  private audioSource?: AudioSource

  private renderer: any
  private scene!: THREE.Scene
  private cameraRig: any
  private targets: any
  private composer: any
  private scheduler: any
  private audioPlayer: any
  private audioBrain: any
  private imageLoader: any
  private sceneBuilder: any
  private particles: any
  private cellDirector: any
  private choreography: any
  private evidence: any

  private images: FootageImage[] = []
  private activeId: string | null = null
  private currentImage: FootageImage | null = null
  private nextImage: FootageImage | null = null

  private macros: any = { ...DEFAULT_MACROS }
  private doctrineBias: any = { ...NEUTRAL_EFFECT_BIAS }
  private activeDoctrine = 'standard'
  private visualMode = 'default'
  private phrases = ['NO CLAIM IS MADE FOR GRIEF']

  private running = false
  private booted = false
  private frame = 0
  private startTime = performance.now()
  private lastTransitionAt = 0
  private lastSampledTime = 0

  private imageBag: FootageImage[] = []
  private imageBagIdx = 0

  private boundLoop = (now: number) => this.loop(now)
  private rafId = 0

  // driven mode — the graph runtime overrides macros/doctrine/weights + commands
  private mode: 'auto' | 'driven' = 'auto'
  private runtime: Runtime | null = null
  private markersProvider: () => RuntimeMarker[] = () => []
  private rsMacros: Partial<Macros> | undefined
  private rsDoctrineBias: Partial<Record<string, number>> | undefined
  private rsWeights: Partial<EffectWeights> | undefined
  private lastNow = performance.now()

  constructor(opts: FootageEngineOptions = {}) {
    this.onState = opts.onState
    this.audioSource = opts.audioSource
    if (opts.doctrine && PRESETS[opts.doctrine]) this.activeDoctrine = opts.doctrine
  }

  // Active audio source — external (shared AudioEngine) when provided, otherwise
  // the engine's own AudioPlayer (standalone use).
  private audioSrc(): AudioSource {
    return this.audioSource || this.audioPlayer
  }

  setAudioSource(source: AudioSource | undefined) {
    this.audioSource = source
  }

  // ── graph runtime (driven mode) ───────────────────────────────────────────

  setMode(mode: 'auto' | 'driven') {
    this.mode = mode
    if (mode === 'auto') {
      this.rsMacros = undefined
      this.rsDoctrineBias = undefined
      this.rsWeights = undefined
    }
  }

  getMode() {
    return this.mode
  }

  setRuntime(runtime: Runtime | null, markersProvider?: () => RuntimeMarker[]) {
    this.runtime = runtime
    if (markersProvider) this.markersProvider = markersProvider
  }

  private applyRenderState(rs: RenderState) {
    this.rsMacros = rs.macros
    this.rsDoctrineBias = rs.doctrineBias
    this.rsWeights = rs.effectWeights
    for (const cmd of rs.commands) this.runCommand(cmd)
  }

  private runCommand(cmd: EngineCommand) {
    if (cmd.kind === 'cueImage') {
      const img = cmd.imageId ? this.images.find((i) => i.id === cmd.imageId) : this.pickImageBatch(1)[0]
      if (img && img.id !== this.currentImage?.id) void this.cueImage(img)
    } else if (cmd.kind === 'cueLayout') {
      const count = layoutCellCount(cmd.layoutId) || 1
      let imgs = (cmd.imageIds || [])
        .map((id) => this.images.find((i) => i.id === id))
        .filter(Boolean) as FootageImage[]
      if (!imgs.length) imgs = this.pickImageBatch(count)
      void this.cueLayout(cmd.layoutId, imgs, { source: 'choreography', fullDensity: cmd.layoutId === 'solo' })
    } else if (cmd.kind === 'applyDoctrine') {
      this.applyPreset(cmd.name)
    } else if (cmd.kind === 'fireModifier') {
      const active: number[] = this.particles.activeCellIndices?.() || [0]
      const cell = cmd.cell ?? active[(Math.random() * active.length) | 0]
      const s = cmd.strength ?? 0.7
      if (cmd.mod === 'shatter') this.particles.triggerShatter?.(cell, s)
      else if (cmd.mod === 'wind') this.particles.triggerWind?.(s)
      else if (cmd.mod === 'pulse') this.particles.pokeCellPulse?.(cell, s)
      else this.particles.setCellModifier?.(cell, cmd.mod, s)
    }
  }

  boot(canvas: HTMLCanvasElement, overlayCanvas: HTMLCanvasElement) {
    if (this.booted) return
    this.canvas = canvas
    this.overlayCanvas = overlayCanvas

    this.renderer = new Renderer(canvas)
    this.scene = new THREE.Scene()
    this.scene.background = null
    this.cameraRig = new CameraRig(canvas)
    this.targets = new RenderTargets(this.renderer.gl, canvas)
    this.composer = new PassComposer(this.renderer.gl, this.targets)

    this.scheduler = new LivingEditScheduler()
    this.audioPlayer = new AudioPlayer()
    this.audioBrain = new AudioBrain()
    this.imageLoader = new ImageLoader()
    this.sceneBuilder = new SceneBuilder(this.scene)
    this.particles = new PersistentParticleField(this.scene, { count: 1000000 })
    this.cellDirector = new CellDirector(this.particles, this.imageLoader)
    this.choreography = new Choreography({
      audioBrain: this.audioBrain,
      cellDirector: this.cellDirector,
      pickImages: (count: number) => this.pickImageBatch(count),
      cueLayout: (layoutId: string, images: any, opts: any) => this.cueLayout(layoutId, images, opts),
    })
    this.evidence = new EvidenceOverlay(overlayCanvas)
    this.evidence.setPhrases(this.phrases)

    // Pass order matches FF exactly: flowCompute first (captures motion),
    // datamosh reads its texture, bloom after the smear, dither last.
    this.composer.add('flowCompute', new FlowComputePass(this.renderer.gl))
    this.composer.add('feedback', new FeedbackPass(this.renderer.gl))
    this.composer.add('rgbTear', new RGBTearPass(this.renderer.gl))
    this.composer.add('slitScan', new SlitScanPass(this.renderer.gl))
    this.composer.add('pixelSort', new PixelSortPass(this.renderer.gl))
    this.composer.add('datamosh', new DatamoshPass(this.renderer.gl))
    this.composer.add('bloom', new BloomPass(this.renderer.gl))
    this.composer.add('dither', new DitherPass(this.renderer.gl))

    if (PRESETS[this.activeDoctrine]) this.applyPreset(this.activeDoctrine)

    this.booted = true
    this.startTime = performance.now()
    this.rafId = requestAnimationFrame(this.boundLoop)
  }

  // ── media ────────────────────────────────────────────────────────────────

  async setManifest(images: FootageImage[]) {
    this.images = Array.isArray(images) ? images.filter((i) => i && i.url) : []
    this.imageBag = []
    this.imageBagIdx = 0
    if (!this.currentImage && this.images.length) {
      await this.cueImage(this.images[0])
    }
  }

  setAnalysis(analysis: FootageAnalysis) {
    if (!this.audioBrain) return
    this.audioBrain.frames = analysis.controls || []
    this.audioBrain.events = analysis.events || []
    this.audioBrain.sections = analysis.sections || []
    this.audioBrain.beats = Array.isArray(analysis.beats) ? analysis.beats : []
    this.audioBrain.tempo = Number(analysis.tempo || 0)
    this.audioBrain.status = 'EXTERNAL_LOAD'
  }

  async loadAudio(file: File | Blob) {
    if (!this.audioPlayer) return
    await this.audioPlayer.load(file)
    this.audioPlayer.pause?.()
  }

  hasAudio() {
    return !!this.audioSource || !!this.audioPlayer?.context
  }

  // ── transport ──────────────────────────────────────────────────────────--

  run() {
    if (!this.booted) return
    this.running = true
    this.lastTransitionAt = performance.now() / 1000
    // When an external source drives audio, the host controls playback; only
    // manage our own AudioPlayer in standalone mode.
    if (!this.audioSource) this.audioPlayer?.resume?.()
  }

  halt() {
    this.running = false
    if (!this.audioSource) this.audioPlayer?.pause?.()
  }

  toggle() {
    if (this.running) this.halt()
    else this.run()
  }

  isRunning() {
    return this.running
  }

  // ── doctrine ─────────────────────────────────────────────────────────────

  applyPreset(name: string) {
    const preset = PRESETS[name]
    if (!preset) return
    this.activeDoctrine = name
    this.visualMode = preset.visualMode || 'default'
    Object.assign(this.macros, preset.macros)
    this.doctrineBias = { ...NEUTRAL_EFFECT_BIAS, ...(preset.effects || {}) }
    if (this.scheduler) {
      this.scheduler._activeDominant = null
      this.scheduler._dominantSectionLabel = null
      this.scheduler._musicState = null
    }
  }

  // ── cueing (verbatim FF logic, manifest internalized) ─────────────────────

  // ── scriptable command surface (viewer buttons + markers) ─────────────────

  swapImage() {
    const img = this.pickImageBatch(1)[0]
    if (img) void this.cueImage(img)
  }

  cueLayoutId(layoutId: string) {
    const imgs = this.pickImageBatch(layoutCellCount(layoutId) || 1)
    void this.cueLayout(layoutId, imgs, { source: 'choreography', fullDensity: layoutId === 'solo' })
  }

  fireModifier(mod: string, strength = 0.8) {
    this.runCommand({ kind: 'fireModifier', mod, strength })
  }

  async cueImage(image: FootageImage | null) {
    if (!image) return null
    return this.cueLayout('solo', [image], {
      source: 'manual',
      fullDensity: true,
      fitToViewport: true,
    })
  }

  async cueLayout(layoutId: string, images: any, opts: any = {}) {
    const list = Array.isArray(images) ? images.filter(Boolean) : images ? [images] : []
    if (!list.length) return null
    const primary = list[0]
    const previousImage = this.currentImage
    const previousData = previousImage ? this.imageLoader.cache.get(previousImage.id) : null
    const result = await this.cellDirector.cueLayout(layoutId, list, {
      macros: this.macros,
      fullDensity: opts.fullDensity,
      fitToViewport: opts.fitToViewport,
      stage: opts.stage,
      force: opts.force,
      modifiers: opts.modifiers,
      forces: opts.forces,
    })
    if (!result) return null

    const primaryData = result.datas?.[0] || this.imageLoader.cache.get(primary.id)
    if (primaryData) {
      if (!previousImage) {
        this.sceneBuilder.installInitial(primaryData)
      } else if (previousImage.id !== primary.id || opts.source === 'choreography') {
        const flowTex = previousData?.flowTexture || primaryData.flowTexture
        this.composer.get('datamosh')?.setFlow(flowTex)
        this.sceneBuilder.cueTarget(primaryData, previousData)
      }
    }

    this.currentImage = primary
    this.nextImage = null
    this.lastTransitionAt = performance.now() / 1000
    this.activeId = primary.id
    return result
  }

  pickImageBatch(count: number, excludeId = this.currentImage?.id): FootageImage[] {
    const images = this.images
    if (!images.length || count <= 0) return []
    if (!this.imageBag.length || this.imageBagIdx >= this.imageBag.length) {
      this.imageBag = this._shuffleImages(images)
      this.imageBagIdx = 0
      if (this.imageBag[0]?.id === excludeId && this.imageBag.length > 1) {
        const last = this.imageBag.length - 1
        ;[this.imageBag[0], this.imageBag[last]] = [this.imageBag[last], this.imageBag[0]]
      }
    }
    // MATCH-ON-ACTION — bias adjacent cuts toward chromatic continuity.
    const currentColor = excludeId ? this.imageLoader.cache.get(excludeId)?.avgColor : null
    if (currentColor && Math.random() < 0.55 && this.imageBag.length - this.imageBagIdx > 1) {
      let bestI = -1
      let bestDist = Infinity
      for (let i = this.imageBagIdx; i < this.imageBag.length; i++) {
        const c = this.imageLoader.cache.get(this.imageBag[i].id)?.avgColor
        if (!c) continue
        const d = (c[0] - currentColor[0]) ** 2 + (c[1] - currentColor[1]) ** 2 + (c[2] - currentColor[2]) ** 2
        if (d < bestDist) { bestDist = d; bestI = i }
      }
      if (bestI > this.imageBagIdx) {
        ;[this.imageBag[this.imageBagIdx], this.imageBag[bestI]] = [this.imageBag[bestI], this.imageBag[this.imageBagIdx]]
      }
    }
    const out: FootageImage[] = []
    while (out.length < count) {
      if (this.imageBagIdx >= this.imageBag.length) {
        this.imageBag = this._shuffleImages(images)
        this.imageBagIdx = 0
      }
      const next = this.imageBag[this.imageBagIdx++]
      if (next) out.push(next)
    }
    return out
  }

  private _shuffleImages(images: FootageImage[]) {
    const out = images.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  private pickRandom(excludeId?: string): FootageImage | null {
    const pool = this.images.filter((i) => i.id !== excludeId)
    if (!pool.length) return this.images[0] || null
    return pool[Math.floor(Math.random() * pool.length)]
  }

  // ── render loop (faithful to FoundFootageApp.loop) ─────────────────────────

  private loop(now: number) {
    if (!this.booted) return
    this.rafId = requestAnimationFrame(this.boundLoop)
    this.renderer.resize()
    const t = (now - this.startTime) / 1000
    const dt = Math.max(0, (now - this.lastNow) / 1000)
    this.lastNow = now
    const src = this.audioSrc()
    const audioTime = src.currentTime()
    const audio = src.update()
    const brain = this.audioBrain.sample(audioTime)
    const events = this.audioBrain.eventsBetween(this.lastSampledTime ?? audioTime, audioTime)
    this.lastSampledTime = audioTime
    const section = this.audioBrain.sectionAt(audioTime)
    const lyricSignal = null

    // Driven mode: evaluate the graph into a RenderState and apply its overrides
    // + commands before the FF simulation runs this frame.
    if (this.mode === 'driven' && this.runtime) {
      const frameInput: FrameInput = {
        audioTime,
        dt,
        frame: this.frame,
        audio: { bass: audio.bass, mid: audio.mid, high: audio.high, impact: audio.impact },
        markers: this.markersProvider(),
      }
      this.applyRenderState(this.runtime.evaluate(frameInput))
    }
    const macros = this.mode === 'driven' && this.rsMacros ? { ...this.macros, ...this.rsMacros } : this.macros
    const doctrineBias =
      this.mode === 'driven' && this.rsDoctrineBias ? { ...this.doctrineBias, ...this.rsDoctrineBias } : this.doctrineBias

    const forces = this.scheduler.update({
      t,
      audioTime,
      audio,
      brain,
      events,
      section,
      macros,
      doctrineBias,
      lyricSignal,
      visualMode: this.visualMode,
      transitionTime: t - this.lastTransitionAt,
    })

    // Driven mode: the graph's FX Chain owns the final per-pass weights.
    if (this.mode === 'driven' && this.rsWeights && forces.weights) {
      for (const k of Object.keys(this.rsWeights)) {
        forces.weights[k] = (this.rsWeights as Record<string, number>)[k]
      }
    }

    const sinceCue = performance.now() / 1000 - this.lastTransitionAt
    forces.readabilityHold = Math.max(0, Math.min(1, 1 - (sinceCue - 0.25) / 0.85))
    forces.exploreFactor = Math.max(0, Math.min(1, (sinceCue - 1.0) / 0.75))

    // In auto mode the choreography makes the cut/layout/camera decisions; in
    // driven mode the graph nodes do, via emitted commands.
    if (this.mode === 'auto') {
      this.choreography.update({ running: this.running, audioTime, section, forces })
    }
    forces.choreoCamera = this.mode === 'auto' ? this.choreography.getCameraCue() : null

    forces.cellCentroid = this.particles.getActiveCentroid()

    this.cameraRig.update(forces, t)
    this.cellDirector.setViewportFrame(this.canvas.clientWidth, this.canvas.clientHeight, this.cameraRig.camera)
    this.particles.setCameraAngle(this.cameraRig.camera.position.x / 4, this.cameraRig.camera.position.y / 4)
    this.particles.setCameraPosition(
      this.cameraRig.camera.position.x,
      this.cameraRig.camera.position.y,
      this.cameraRig.camera.position.z,
    )
    this.particles.update(forces, t)
    this.sceneBuilder.update(forces, t)

    // Post-process only runs while armed; idle archive view shows clean cloud.
    const effectiveWeights: Record<string, number> | null = this.running ? { ...forces.weights } : null
    if (effectiveWeights && forces.readabilityHold > 0) {
      const damp = 1 - forces.readabilityHold * 0.72
      for (const k of Object.keys(effectiveWeights)) {
        effectiveWeights[k] *= k === 'bloom' ? 1 - forces.readabilityHold * 0.35 : damp
      }
    }
    this.composer.setWeights(effectiveWeights)

    const baseTex = this.renderer.renderToTarget(this.scene, this.cameraRig.camera, this.targets.acquireBase())
    const finalTex = this.composer.run(baseTex, forces, t)
    const flowPass = this.composer.get('flowCompute')
    if (flowPass?.lastFlowTexture) {
      this.composer.get('datamosh')?.setFlow(flowPass.lastFlowTexture)
    }
    this.renderer.blit(finalTex)
    this.evidence.draw(forces, audio, this.phrases, now)
    this.evidence.updateLyric(now)

    this.frame++
    this.onState?.({
      frame: this.frame,
      audioTime,
      musicState: forces.musicState || section?.label || '—',
      transitionMode: forces.transitionMode || '—',
      running: this.running,
      flash: (effectiveWeights?.flash ?? 0) > 0.4,
    })
  }

  dispose() {
    this.booted = false
    this.running = false
    cancelAnimationFrame(this.rafId)
    try { this.audioPlayer?.pause?.() } catch { /* noop */ }
    try { this.renderer?.gl?.dispose?.() } catch { /* noop */ }
  }
}
