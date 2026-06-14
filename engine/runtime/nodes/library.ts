import type { AudioSignal, EffectWeights, NodeEvaluator } from '../types'
import { DEFAULT_MACROS } from '../types'
import { Runtime } from '../Runtime'

// ── v1 node library ─────────────────────────────────────────────────────────
// Thin evaluators over the FOUND/FOOTAGE control surface. Each contributes a
// slice of the RenderState (macros / doctrineBias / effectWeights) and/or emits
// engine commands (cues / modifiers). Topological order makes later nodes win,
// so markers (downstream of FX Chain) can latch overrides on top of it.

const MACRO_KEYS = Object.keys(DEFAULT_MACROS) as (keyof typeof DEFAULT_MACROS)[]
const FX_KEYS: (keyof EffectWeights)[] = [
  'feedback',
  'rgbTear',
  'slitScan',
  'pixelSort',
  'datamosh',
  'dither',
  'bloom',
]

const DOCTRINE_BIAS: Record<string, Record<string, number>> = {
  minimal: { feedback: 0.55, rgbTear: 0.25, slitScan: 0.3, pixelSort: 0.15, datamosh: 0.45, dither: 0.4, bloom: 1.2 },
  standard: { feedback: 1, rgbTear: 1, slitScan: 1, pixelSort: 1, datamosh: 1, dither: 1, bloom: 1 },
  heavy: { feedback: 1.5, rgbTear: 1.5, slitScan: 1.4, pixelSort: 1.6, datamosh: 1.7, dither: 1.25, bloom: 1.3 },
  rupture: { feedback: 1.8, rgbTear: 2.2, slitScan: 1.9, pixelSort: 2.6, datamosh: 2.4, dither: 1.6, bloom: 1.0 },
}

const LAYOUT_OPTIONS = [
  'auto',
  'solo',
  'duo_h',
  'duo_v',
  'triptych',
  'quad',
  'hex',
  'ennead',
  'filmstrip_h',
  'center_ring',
  'mondrian_a',
]

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

// Audio Track — source. Forwards the live bands (optionally gained).
const audioTrack: NodeEvaluator = {
  type: 'audio.track',
  label: 'Audio Track',
  category: 'audio',
  inputs: [],
  outputs: [{ name: 'audio', type: 'audio' }],
  params: [{ name: 'gain', type: 'number', min: 0, max: 2, step: 0.01, default: 1 }],
  evaluate(node, _inputs, ctx) {
    const g = num(node.params.gain, 1)
    const audio: AudioSignal = {
      bass: ctx.audio.bass * g,
      mid: ctx.audio.mid * g,
      high: ctx.audio.high * g,
      impact: ctx.audio.impact * g,
    }
    return { audio }
  },
}

// Macro Bank — the 10 FF macros as editable params. Contributes macros override.
const macroBank: NodeEvaluator = {
  type: 'macro.bank',
  label: 'Macro Bank',
  category: 'control',
  inputs: [{ name: 'audio', type: 'audio' }],
  outputs: [{ name: 'macros', type: 'controls' }],
  params: [
    { name: 'intensity', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.intensity },
    { name: 'violence', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.violence },
    { name: 'reactivity', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.reactivity },
    { name: 'temporalInstability', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.temporalInstability },
    { name: 'resolutionCollapse', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.resolutionCollapse },
    { name: 'growth', type: 'number', min: 0, max: 1, step: 0.01, default: DEFAULT_MACROS.growth },
  ],
  evaluate(node) {
    const macros: Record<string, number> = {}
    for (const k of MACRO_KEYS) macros[k] = num(node.params[k], DEFAULT_MACROS[k])
    return { macros, __render: { macros } }
  },
}

// Doctrine — selects an effect signature (per-pass bias multipliers).
const doctrine: NodeEvaluator = {
  type: 'doctrine',
  label: 'Doctrine',
  category: 'control',
  inputs: [],
  outputs: [{ name: 'bias', type: 'weights' }],
  params: [
    { name: 'name', type: 'enum', options: Object.keys(DOCTRINE_BIAS), default: 'standard' },
  ],
  evaluate(node) {
    const bias = DOCTRINE_BIAS[str(node.params.name, 'standard')] || DOCTRINE_BIAS.standard
    return { bias, __render: { doctrineBias: bias } }
  },
}

// FX Chain — final per-pass weights. Audio-reactive scaling via `react`.
const fxChain: NodeEvaluator = {
  type: 'fx.chain',
  label: 'FX Chain',
  category: 'effects',
  inputs: [
    { name: 'audio', type: 'audio' },
    { name: 'bias', type: 'weights' },
  ],
  outputs: [{ name: 'weights', type: 'weights' }],
  params: [
    { name: 'feedback', type: 'number', min: 0, max: 2, step: 0.01, default: 0.4 },
    { name: 'rgbTear', type: 'number', min: 0, max: 2, step: 0.01, default: 0.3 },
    { name: 'slitScan', type: 'number', min: 0, max: 2, step: 0.01, default: 0.25 },
    { name: 'pixelSort', type: 'number', min: 0, max: 2, step: 0.01, default: 0.2 },
    { name: 'datamosh', type: 'number', min: 0, max: 2, step: 0.01, default: 0.35 },
    { name: 'dither', type: 'number', min: 0, max: 2, step: 0.01, default: 0.3 },
    { name: 'bloom', type: 'number', min: 0, max: 2, step: 0.01, default: 0.8 },
    { name: 'react', type: 'number', min: 0, max: 1, step: 0.01, default: 0.4 },
  ],
  evaluate(node, inputs, ctx) {
    const audio = (inputs.audio as AudioSignal | undefined) ?? ctx.audio
    const bias = (inputs.bias as Record<string, number> | undefined) || null
    const react = num(node.params.react, 0.4)
    const live = 1 + (audio?.impact ?? 0) * react * 2
    const weights: Record<string, number> = {}
    for (const k of FX_KEYS) {
      const b = bias ? bias[k] ?? 1 : 1
      weights[k] = num(node.params[k], 0) * b * live
    }
    weights.flash = num(node.params.feedback, 0) > 0 ? (audio?.impact ?? 0) * 0.6 : 0
    return { weights, __render: { effectWeights: weights } }
  },
}

// Cut Scheduler — drives the auto-maker in driven mode: emits a layout cut on a
// musical interval. `layout: auto` picks a random layout per cut.
const cutScheduler: NodeEvaluator = (() => {
  const last = new Map<string, number>()
  return {
    type: 'cut.scheduler',
    label: 'Cut Scheduler',
    category: 'edit',
    inputs: [{ name: 'audio', type: 'audio' }],
    outputs: [{ name: 'layout', type: 'layout' }],
    params: [
      { name: 'intervalSec', type: 'number', min: 1, max: 30, step: 0.5, default: 6 },
      { name: 'layout', type: 'enum', options: LAYOUT_OPTIONS, default: 'auto' },
    ],
    evaluate(node, _inputs, ctx) {
      const interval = num(node.params.intervalSec, 6)
      const prev = last.get(node.id)
      if (prev === undefined) {
        last.set(node.id, ctx.audioTime)
        return {}
      }
      if (ctx.audioTime - prev >= interval) {
        last.set(node.id, ctx.audioTime)
        const chosen = str(node.params.layout, 'auto')
        const layoutId =
          chosen === 'auto' ? LAYOUT_OPTIONS[1 + ((Math.random() * (LAYOUT_OPTIONS.length - 1)) | 0)] : chosen
        ctx.emit({ kind: 'cueLayout', layoutId })
      }
      return {}
    },
  }
})()

// Markers — applies timeline marker triggers as they're crossed. Latches fx.*
// overrides; emits doctrine / layout / modifier commands.
const markers: NodeEvaluator = (() => {
  const latched = new Map<string, Record<string, number>>()
  return {
    type: 'markers',
    label: 'Marker Gate',
    category: 'edit',
    inputs: [{ name: 'weights', type: 'weights' }],
    outputs: [{ name: 'weights', type: 'weights' }],
    params: [],
    evaluate(node, _inputs, ctx) {
      let fx = latched.get(node.id)
      if (!fx) {
        fx = {}
        latched.set(node.id, fx)
      }
      for (const m of ctx.firedMarkers) {
        const target = m.target
        if (target.startsWith('fx.')) {
          fx[target.slice(3)] = Number(m.value) || 0
        } else if (target === 'doctrine' || target === 'doctrine.name') {
          ctx.emit({ kind: 'applyDoctrine', name: String(m.value) })
        } else if (target === 'layout.mode' || target === 'layout') {
          ctx.emit({ kind: 'cueLayout', layoutId: String(m.value) })
        } else if (target.startsWith('mod.')) {
          ctx.emit({ kind: 'fireModifier', mod: target.slice(4), strength: Number(m.value) || 0.8 })
        }
      }
      return { __render: { effectWeights: { ...fx } } }
    },
  }
})()

// Render Out — sink. Contributions are merged upstream; this anchors the graph.
const renderOut: NodeEvaluator = {
  type: 'render.out',
  label: 'Render Out',
  category: 'output',
  inputs: [
    { name: 'weights', type: 'weights' },
    { name: 'macros', type: 'controls' },
  ],
  outputs: [],
  params: [],
  evaluate() {
    return {}
  },
}

export const NODE_LIBRARY: NodeEvaluator[] = [
  audioTrack,
  macroBank,
  doctrine,
  fxChain,
  cutScheduler,
  markers,
  renderOut,
]

export function buildRuntime(): Runtime {
  const runtime = new Runtime()
  for (const ev of NODE_LIBRARY) runtime.register(ev)
  return runtime
}

export const LAYOUT_IDS = LAYOUT_OPTIONS
