import type { Edge, Node } from '@xyflow/react'

export type MediaType = 'audio' | 'image' | 'video' | 'text'
export type TimelineLaneKind = 'stem' | 'section' | 'text' | 'marker'

export type MediaItem = {
  id: string
  type: MediaType
  name: string
  status: string
}

export type TimelineLane = {
  id: string
  label: string
  kind: TimelineLaneKind
  color: string
  events: number[]
}

export type TimelineMarker = {
  id: string
  time: number
  label: string
  target: string
  value: string | number | boolean
}

export type MagdaleneNodeData = {
  label: string
  subtitle: string
  tone: 'red' | 'amber' | 'moss' | 'bone' | 'violet'
  // evaluator id in the graph runtime (engine/runtime registry). Cosmetic-only
  // nodes leave this undefined.
  nodeType?: string
  params?: Record<string, number | string | boolean>
}

export type MagdaleneFlowNode = Node<MagdaleneNodeData, 'magdalene'>

export type MagdaleneProject = {
  version: string
  name: string
  timeline: {
    duration: number
    bpm: number
    lanes: TimelineLane[]
    markers: TimelineMarker[]
  }
  media: MediaItem[]
  graph: {
    nodes: MagdaleneFlowNode[]
    edges: Edge[]
  }
}

export type ServerStatus = 'checking' | 'ready' | 'offline'
