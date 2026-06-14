import type {
  AudioSignal,
  EngineCommand,
  EvalContext,
  NodeEvaluator,
  NodeInputs,
  NodeOutputs,
  RenderState,
  RuntimeEdge,
  RuntimeMarker,
  RuntimeNode,
} from './types'

export type FrameInput = {
  audioTime: number
  dt: number
  frame: number
  audio: AudioSignal
  markers: RuntimeMarker[]
}

// The graph runtime. Holds a node graph + a registry of evaluators, topologically
// orders the nodes, and evaluates them every frame into a RenderState. Nodes read
// their inputs from connected upstream outputs (by port handle, with a positional
// fallback) and may emit engine commands.
export class Runtime {
  private registry = new Map<string, NodeEvaluator>()
  private nodes: RuntimeNode[] = []
  private edges: RuntimeEdge[] = []
  private order: string[] = []
  private nodeById = new Map<string, RuntimeNode>()
  private prevAudioTime = 0

  register(evaluator: NodeEvaluator) {
    this.registry.set(evaluator.type, evaluator)
  }

  getEvaluator(type: string) {
    return this.registry.get(type)
  }

  listEvaluators(): NodeEvaluator[] {
    return [...this.registry.values()]
  }

  setGraph(nodes: RuntimeNode[], edges: RuntimeEdge[]) {
    this.nodes = nodes
    this.edges = edges
    this.nodeById = new Map(nodes.map((n) => [n.id, n]))
    this.order = topoSort(nodes, edges)
  }

  evaluate(input: FrameInput): RenderState {
    const commands: EngineCommand[] = []
    const firedMarkers = this.firedBetween(this.prevAudioTime, input.audioTime, input.markers)
    this.prevAudioTime = input.audioTime

    const ctx: EvalContext = {
      audioTime: input.audioTime,
      dt: input.dt,
      frame: input.frame,
      audio: input.audio,
      markers: input.markers,
      firedMarkers,
      emit: (cmd) => commands.push(cmd),
    }

    const outputs = new Map<string, NodeOutputs>()
    const rs: RenderState = { audioTime: input.audioTime, frame: input.frame, commands }

    for (const id of this.order) {
      const node = this.nodeById.get(id)
      if (!node) continue
      const evaluator = this.registry.get(node.type)
      if (!evaluator) {
        outputs.set(id, {})
        continue
      }
      const inputs = this.resolveInputs(node, outputs)
      let result: NodeOutputs = {}
      try {
        result = evaluator.evaluate(node, inputs, ctx) || {}
      } catch (err) {
        console.warn(`[runtime] node ${node.type} (${id}) failed`, err)
      }
      outputs.set(id, result)

      // A render-out contribution is merged into the RenderState.
      const contribution = result.__render as Partial<RenderState> | undefined
      if (contribution) {
        if (contribution.macros) rs.macros = { ...rs.macros, ...contribution.macros }
        if (contribution.doctrineBias) rs.doctrineBias = { ...rs.doctrineBias, ...contribution.doctrineBias }
        if (contribution.effectWeights) rs.effectWeights = { ...rs.effectWeights, ...contribution.effectWeights }
        if (contribution.musicState) rs.musicState = contribution.musicState
      }
    }

    return rs
  }

  private resolveInputs(node: RuntimeNode, outputs: Map<string, NodeOutputs>): NodeInputs {
    const inputs: NodeInputs = {}
    const incoming: unknown[] = []
    const targetEval = this.registry.get(node.type)
    const used = new Set<string>()
    for (const edge of this.edges) {
      if (edge.target !== node.id) continue
      const srcOut = outputs.get(edge.source) || {}
      const srcEval = this.registry.get(this.nodeById.get(edge.source)?.type ?? '')

      let value: unknown
      let srcType: string | undefined
      if (edge.sourceHandle && edge.sourceHandle in srcOut) {
        value = srcOut[edge.sourceHandle]
        srcType = srcEval?.outputs.find((p) => p.name === edge.sourceHandle)?.type
      } else {
        const firstOut = srcEval?.outputs[0]
        value = firstOut ? srcOut[firstOut.name] : firstValue(srcOut)
        srcType = firstOut?.type
      }
      if (value === undefined) continue
      incoming.push(value)

      // Resolve the target input port: explicit handle, else first unused input
      // port whose type matches the source output type, else positional.
      let key = edge.targetHandle || undefined
      if (!key && targetEval) {
        const match = targetEval.inputs.find((p) => p.type === srcType && !used.has(p.name))
        key = match?.name
      }
      if (!key) key = `in${incoming.length - 1}`
      used.add(key)
      inputs[key] = value
    }
    inputs._incoming = incoming
    return inputs
  }

  private firedBetween(from: number, to: number, markers: RuntimeMarker[]): RuntimeMarker[] {
    if (to < from) return []
    return markers.filter((m) => m.time > from && m.time <= to)
  }
}

function firstValue(obj: NodeOutputs): unknown {
  for (const k of Object.keys(obj)) {
    if (k === '__render') continue
    return obj[k]
  }
  return undefined
}

// Kahn topological sort; falls back to declaration order on cycle.
function topoSort(nodes: RuntimeNode[], edges: RuntimeEdge[]): string[] {
  const indeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    indeg.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!indeg.has(e.target) || !adj.has(e.source)) continue
    adj.get(e.source)!.push(e.target)
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1)
  }
  const queue = nodes.filter((n) => (indeg.get(n.id) || 0) === 0).map((n) => n.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adj.get(id) || []) {
      indeg.set(next, (indeg.get(next) || 0) - 1)
      if ((indeg.get(next) || 0) === 0) queue.push(next)
    }
  }
  if (order.length !== nodes.length) return nodes.map((n) => n.id)
  return order
}
