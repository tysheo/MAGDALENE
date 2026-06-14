import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import {
  AudioLines,
  Boxes,
  CircleDot,
  Download,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  GitBranch,
  Play,
  Save,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MagdaleneFlowNode, MagdaleneProject, MediaItem, ServerStatus, TimelineLane } from './model/project'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function mediaIcon(type: MediaItem['type']) {
  if (type === 'audio') return <FileAudio size={16} />
  if (type === 'video') return <FileVideo size={16} />
  if (type === 'text') return <FileText size={16} />
  return <FileImage size={16} />
}

function MagdaleneNode({ data, selected }: NodeProps<MagdaleneFlowNode>) {
  const node = data
  return (
    <div className={`m-node m-node--${node.tone} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="m-node__cap">
        <CircleDot size={13} />
        <span>{node.label}</span>
      </div>
      <div className="m-node__body">{node.subtitle}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { magdalene: MagdaleneNode }

function Timeline({ project }: { project: MagdaleneProject }) {
  return (
    <section className="timeline">
      <div className="timeline__ruler">
        <span>00:00</span>
        <span>{project.timeline.bpm} BPM</span>
        <span>{formatTime(project.timeline.duration)}</span>
      </div>
      <div className="timeline__wave" aria-label="waveform">
        {Array.from({ length: 96 }).map((_, i) => (
          <span key={i} style={{ height: `${24 + Math.abs(Math.sin(i * 0.45) * 52)}%` }} />
        ))}
      </div>
      <div className="timeline__lanes">
        {project.timeline.lanes.map((lane) => (
          <TimelineLaneRow key={lane.id} lane={lane} duration={project.timeline.duration} />
        ))}
      </div>
      <div className="timeline__markers">
        {project.timeline.markers.map((marker) => (
          <button
            key={marker.id}
            className="marker"
            style={{ left: `${(marker.time / project.timeline.duration) * 100}%` }}
            title={`${marker.label} -> ${marker.target}`}
          >
            {marker.label}
          </button>
        ))}
      </div>
    </section>
  )
}

function TimelineLaneRow({ lane, duration }: { lane: TimelineLane; duration: number }) {
  return (
    <div className="lane">
      <span className="lane__label">{lane.label}</span>
      <div className="lane__track">
        {lane.events.map((time, idx) => (
          <i
            key={`${lane.id}-${idx}`}
            className={`lane__event lane__event--${lane.kind}`}
            style={{ left: `${(time / duration) * 100}%`, backgroundColor: lane.color }}
          />
        ))}
      </div>
    </div>
  )
}

function Preview({ project, serverStatus }: { project: MagdaleneProject; serverStatus: ServerStatus }) {
  const marker = project.timeline.markers[1]
  return (
    <section className="preview">
      <div className="preview__frame">
        <div className="preview__grid" />
        <div className="preview__cell preview__cell--a" />
        <div className="preview__cell preview__cell--b" />
        <div className="preview__cell preview__cell--c" />
        <div className="preview__text">MAGDALENE</div>
      </div>
      <div className="preview__meta">
        <span>{serverStatus === 'ready' ? 'ENGINE READY' : 'ENGINE CHECK'}</span>
        <span>{marker.label} / {marker.target}</span>
      </div>
    </section>
  )
}

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function App() {
  const [project, setProject] = useState<MagdaleneProject | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<MagdaleneFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => res.ok ? setServerStatus('ready') : setServerStatus('offline'))
      .catch(() => setServerStatus('offline'))
    fetch(`${API_BASE}/api/project/default`)
      .then((res) => res.json())
      .then((data: MagdaleneProject) => {
        setProject(data)
        setNodes(data.graph.nodes)
        setEdges(data.graph.edges)
      })
      .catch(() => setServerStatus('offline'))
  }, [setEdges, setNodes])

  useEffect(() => {
    if (!project) return
    setProject({ ...project, graph: { nodes, edges } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  )

  const saveProject = async () => {
    if (!project) return
    await fetch(`${API_BASE}/api/project/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: project.name, project }),
    })
  }

  const requestExport = async () => {
    await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project }),
    })
  }

  if (!project) {
    return (
      <main className="boot">
        <Sparkles size={18} />
        <span>LOADING MAGDALENE</span>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">M</span>
          <div>
            <h1>MAGDALENE</h1>
            <p>{project.name}</p>
          </div>
        </div>
        <div className="topbar__actions">
          <button type="button" className="icon-btn" title="Open project">
            <FolderOpen size={17} />
          </button>
          <button type="button" className="icon-btn" title="Save project" onClick={saveProject}>
            <Save size={17} />
          </button>
          <button type="button" className="primary-btn" onClick={requestExport}>
            <Download size={17} />
            <span>Export</span>
          </button>
        </div>
      </header>

      <section className="workbench">
        <aside className="media-rail">
          <div className="panel-heading">
            <Boxes size={16} />
            <span>Media</span>
          </div>
          <div className="media-list">
            {project.media.map((item) => (
              <button key={item.id} className="media-item" type="button">
                {mediaIcon(item.type)}
                <span>{item.name}</span>
                <small>{item.status}</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="graph-panel">
          <div className="panel-heading panel-heading--graph">
            <GitBranch size={16} />
            <span>Graph</span>
            <strong>{nodes.length} nodes / {edges.length} links</strong>
          </div>
          <ReactFlow<MagdaleneFlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background color="#3a352f" gap={28} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={3} />
          </ReactFlow>
        </section>

        <aside className="inspector">
          <div className="panel-heading">
            <AudioLines size={16} />
            <span>Inspector</span>
          </div>
          {selectedNode ? (
            <div className="inspect-card">
              <span className="inspect-card__eyebrow">NODE</span>
              <h2>{selectedNode.data.label}</h2>
              <p>{selectedNode.data.subtitle}</p>
              <label>
                Intensity
                <input type="range" min="0" max="1" step="0.01" defaultValue="0.72" />
              </label>
              <label>
                Reactivity
                <input type="range" min="0" max="1" step="0.01" defaultValue="0.58" />
              </label>
            </div>
          ) : (
            <div className="inspect-card">
              <span className="inspect-card__eyebrow">PROJECT</span>
              <h2>{project.name}</h2>
              <p>{project.media.length} media sources / {project.timeline.markers.length} markers</p>
            </div>
          )}
          <div className="node-palette">
            <span>Node Library</span>
            {['Lyric Cue', 'Transition Map', 'Cell Layout', 'Datamosh', 'Render Output'].map((name) => (
              <button key={name} type="button">{name}</button>
            ))}
          </div>
        </aside>
      </section>

      <section className="lower-deck">
        <Preview project={project} serverStatus={serverStatus} />
        <Timeline project={project} />
        <div className="transport">
          <button type="button" className="transport__play" title="Play">
            <Play size={18} fill="currentColor" />
          </button>
          <span>00:24.000</span>
          <span>{project.timeline.markers[0].label}</span>
        </div>
      </section>
    </main>
  )
}
