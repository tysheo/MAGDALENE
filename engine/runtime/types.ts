// MAGDALENE graph runtime — the contract that turns FOUND / FOOTAGE's hardwired
// loop into an editable graph. See MIGRATION.md sections 2-3.
//
// The runtime evaluates a node graph each frame into a RenderState. The engine
// (FootageEngine) consumes the RenderState as a set of overrides + commands on
// top of its own faithful FF simulation, so the graph can influence cuts,
// layouts, macros, doctrine, and per-pass effect weights without re-deriving the
// entire forces object.

// ── typed ports (the interlock) ────────────────────────────────────────────
export type PortType =
  | 'audio' // scalar bands + time
  | 'controls' // analyzed control lanes
  | 'events' // discrete event stream
  | 'gate' // on/off + strength
  | 'media' // image/video references
  | 'layout' // layout id + cell rects
  | 'weights' // effect weight map
  | 'mods' // particle modifier map
  | 'camera' // camera cue
  | 'text' // timed text events
  | 'render' // a RenderState contribution
  | 'number'
  | 'string'

export type PortSpec = { name: string; type: PortType; label?: string }

export type ParamType = 'number' | 'string' | 'boolean' | 'enum'
export type ParamSpec = {
  name: string
  type: ParamType
  label?: string
  min?: number
  max?: number
  step?: number
  options?: string[]
  default: number | string | boolean
}

// ── signals carried on edges ───────────────────────────────────────────────
export type AudioSignal = { bass: number; mid: number; high: number; impact: number }
export type MediaSignal = { id: string; url: string; name?: string }
export type EventSignal = { type: string; strength: number; time: number }

export type Macros = {
  intensity: number
  violence: number
  decay: number
  reactivity: number
  temporalInstability: number
  spatialTension: number
  resolutionCollapse: number
  humanPresence: number
  growth: number
  compressionDamage: number
}

export type EffectKey =
  | 'feedback'
  | 'rgbTear'
  | 'slitScan'
  | 'pixelSort'
  | 'datamosh'
  | 'dither'
  | 'bloom'
  | 'flash'

export type EffectWeights = Record<EffectKey, number>

// ── engine commands (the scriptable actions) ───────────────────────────────
export type EngineCommand =
  | { kind: 'cueImage'; imageId?: string }
  | { kind: 'cueLayout'; layoutId: string; imageIds?: string[] }
  | { kind: 'applyDoctrine'; name: string }
  | { kind: 'fireModifier'; mod: string; strength?: number; cell?: number }

// ── the per-frame contract ─────────────────────────────────────────────────
export type RenderState = {
  audioTime: number
  frame: number
  musicState?: string
  macros?: Partial<Macros>
  doctrineBias?: Partial<Record<string, number>>
  effectWeights?: Partial<EffectWeights>
  commands: EngineCommand[]
}

// ── timeline markers at runtime ────────────────────────────────────────────
export type RuntimeMarker = {
  id: string
  time: number
  target: string // dotted path, e.g. 'fx.datamosh' | 'layout.mode' | 'doctrine'
  value: string | number | boolean
}

// ── evaluation context passed to every node each frame ─────────────────────
export type EvalContext = {
  audioTime: number
  dt: number
  frame: number
  audio: AudioSignal
  markers: RuntimeMarker[]
  // markers whose time has just been crossed this frame (rising edge)
  firedMarkers: RuntimeMarker[]
  emit: (cmd: EngineCommand) => void
}

// ── node model ─────────────────────────────────────────────────────────────
export type RuntimeNode = {
  id: string
  type: string
  params: Record<string, number | string | boolean>
}

export type RuntimeEdge = {
  source: string
  sourceHandle?: string | null
  target: string
  targetHandle?: string | null
}

export type NodeInputs = Record<string, unknown>
export type NodeOutputs = Record<string, unknown>

export interface NodeEvaluator {
  type: string
  label: string
  category: string
  inputs: PortSpec[]
  outputs: PortSpec[]
  params: ParamSpec[]
  evaluate(node: RuntimeNode, inputs: NodeInputs, ctx: EvalContext): NodeOutputs
}

export const DEFAULT_MACROS: Macros = {
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

export const ZERO_WEIGHTS: EffectWeights = {
  feedback: 0,
  rgbTear: 0,
  slitScan: 0,
  pixelSort: 0,
  datamosh: 0,
  dither: 0,
  bloom: 0,
  flash: 0,
}
