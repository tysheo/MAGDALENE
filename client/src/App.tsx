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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MagdaleneFlowNode, MagdaleneProject, TimelineLane } from './model/project'
import { api } from './api'
import { PreviewCanvas } from './preview/PreviewCanvas'
import { AudioEngine } from '@engine/audio/AudioEngine'
import { activeLyricIndex, parseLrc, type LyricLine } from '@engine/audio/lrc'
import type { AudioSource, FootageEngine, FootageState } from '@engine/footage/FootageEngine'
import type { Runtime } from '@engine/runtime/Runtime'
import type { RuntimeMarker } from '@engine/runtime/types'
import { buildRuntime, NODE_LIBRARY } from '@engine/runtime/nodes/library'

type ServerStatus = 'checking' | 'ready' | 'offline'

type LoadedTrack = {
  name: string
  duration: number
  peaks: Float32Array
}

function MagdaleneNode({ data, selected }: NodeProps<MagdaleneFlowNode>) {
  const node = data
  return (
    <div className={`m-node m-node--${node.tone} ${selected ? 'is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="m-node__cap">
        <span className="m-node__dot" />
        <span>{node.label}</span>
      </div>
      <div className="m-node__body">{node.subtitle}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { magdalene: MagdaleneNode }

function StageLyrics({ lines, time }: { lines: LyricLine[]; time: number }) {
  if (!lines.length) return null
  const idx = activeLyricIndex(lines, time)
  const prev = idx > 0 ? lines[idx - 1]?.text : ''
  const cur = idx >= 0 ? lines[idx]?.text : ''
  const next = lines[idx + 1]?.text ?? ''
  return (
    <div className="stage-lyrics">
      <span className="stage-lyrics__line stage-lyrics__line--ghost">{prev}</span>
      <span className="stage-lyrics__line stage-lyrics__line--now">{cur || '—'}</span>
      <span className="stage-lyrics__line stage-lyrics__line--ghost">{next}</span>
    </div>
  )
}

function Timeline({
  project,
  track,
  time,
  onSeek,
  onMarkerMove,
  onMarkerTrigger,
}: {
  project: MagdaleneProject
  track: LoadedTrack | null
  time: number
  onSeek: (t: number) => void
  onMarkerMove: (id: string, time: number) => void
  onMarkerTrigger: (target: string, value: string | number | boolean) => void
}) {
  const duration = track?.duration ?? project.timeline.duration
  const peaks = track?.peaks
  const playheadPct = Math.min(100, (time / duration) * 100)
  const markersRef = useRef<HTMLDivElement | null>(null)

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, frac)) * duration)
  }

  // Drag a marker to retime its trigger; a plain click fires it now.
  const onMarkerDown = (e: React.PointerEvent, markerId: string, target: string, value: string | number | boolean) => {
    e.preventDefault()
    e.stopPropagation()
    const container = markersRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    let dragged = false
    const move = (ev: PointerEvent) => {
      dragged = true
      const frac = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      onMarkerMove(markerId, frac * duration)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!dragged) onMarkerTrigger(target, value)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <section className="timeline">
      <div className="timeline__ruler">
        <span>N° 04 // TIMELINE</span>
        <span>{project.timeline.bpm} BPM</span>
        <span>
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>
      <div className="timeline__body">
        <div className="timeline__wave" aria-label="waveform" onClick={seek}>
          {peaks
            ? Array.from(peaks).map((p, i) => <span key={i} style={{ height: `${6 + p * 90}%` }} />)
            : Array.from({ length: 120 }).map((_, i) => (
                <span key={i} style={{ height: `${18 + Math.abs(Math.sin(i * 0.42) * 64)}%` }} />
              ))}
          <div className="timeline__playhead" style={{ left: `${playheadPct}%` }} />
        </div>
        <div className="timeline__lanes">
          {project.timeline.lanes.map((lane) => (
            <TimelineLaneRow key={lane.id} lane={lane} duration={project.timeline.duration} />
          ))}
        </div>
        <div className="timeline__markers" ref={markersRef}>
          {project.timeline.markers.map((marker) => (
            <button
              key={marker.id}
              className="marker"
              style={{ left: `${(marker.time / duration) * 100}%` }}
              title={`${marker.label} -> ${marker.target} = ${marker.value} (drag to retime, click to fire)`}
              onPointerDown={(e) => onMarkerDown(e, marker.id, marker.target, marker.value)}
            >
              {marker.label}
            </button>
          ))}
        </div>
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

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? seconds : 0
  const min = Math.floor(safe / 60)
  const sec = Math.floor(safe % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function App() {
  const audioRef = useRef<AudioEngine | null>(null)
  if (!audioRef.current) audioRef.current = new AudioEngine()
  const audio = audioRef.current

  const [project, setProject] = useState<MagdaleneProject | null>(null)
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<MagdaleneFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const [track, setTrack] = useState<LoadedTrack | null>(null)
  const [lyrics, setLyrics] = useState<LyricLine[]>([])
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)

  const engineRef = useRef<FootageEngine | null>(null)
  const [footage, setFootage] = useState<FootageState | null>(null)
  const [archiveCount, setArchiveCount] = useState(0)

  // Adapter so the FOUND/FOOTAGE engine reads levels + time from the same shared
  // AudioEngine that drives the timeline — one audio pipeline, no double output.
  const footageAudio = useMemo<AudioSource>(
    () => ({
      currentTime: () => audio.currentTime,
      update: () => {
        const l = audio.getLevels()
        return { bass: l.bass, mid: l.mid, high: l.high, impact: l.beat }
      },
      duration: () => audio.duration,
    }),
    [audio],
  )

  const runtimeRef = useRef<Runtime | null>(null)
  if (!runtimeRef.current) runtimeRef.current = buildRuntime()
  const [graphMode, setGraphMode] = useState(false)

  // Latest markers in RuntimeMarker shape — the engine pulls these each frame.
  const markersRef = useRef<RuntimeMarker[]>([])

  useEffect(() => {
    api
      .health()
      .then((res) => setServerStatus(res.ok ? 'ready' : 'offline'))
      .catch(() => setServerStatus('offline'))
    api
      .getDefaultProject()
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

  // Keep the runtime graph in sync with the editor graph so live param edits and
  // wiring changes drive the preview on the next frame.
  useEffect(() => {
    const rt = runtimeRef.current
    if (!rt) return
    const rnodes = nodes
      .filter((n) => n.data.nodeType)
      .map((n) => ({ id: n.id, type: n.data.nodeType as string, params: n.data.params ?? {} }))
    const redges = edges.map((e) => ({
      source: e.source,
      sourceHandle: e.sourceHandle ?? null,
      target: e.target,
      targetHandle: e.targetHandle ?? null,
    }))
    rt.setGraph(rnodes, redges)
  }, [nodes, edges])

  useEffect(() => {
    markersRef.current = project
      ? project.timeline.markers.map((m) => ({ id: m.id, time: m.time, target: m.target, value: m.value }))
      : []
  }, [project])

  // Poll playback position while playing (10fps) for the clock + playhead. The
  // visualiser reacts at full framerate independently via AudioEngine.getLevels.
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setTime(audio.currentTime)
      if (!audio.isPlaying) setPlaying(false)
    }, 100)
    return () => clearInterval(id)
  }, [playing, audio])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId])
  const selectedEval = useMemo(
    () => (selectedNode?.data.nodeType ? runtimeRef.current?.getEvaluator(selectedNode.data.nodeType) ?? null : null),
    [selectedNode],
  )

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges],
  )

  const setNodeParam = useCallback(
    (id: string, name: string, value: number | string | boolean) => {
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, params: { ...(n.data.params ?? {}), [name]: value } } } : n,
        ),
      )
    },
    [setNodes],
  )

  const toggleGraphMode = () => {
    const next = !graphMode
    setGraphMode(next)
    engineRef.current?.setMode(next ? 'driven' : 'auto')
  }

  const moveMarker = (id: string, time: number) => {
    setProject((p) =>
      p
        ? { ...p, timeline: { ...p.timeline, markers: p.timeline.markers.map((m) => (m.id === id ? { ...m, time } : m)) } }
        : p,
    )
  }

  const triggerMarker = (target: string, value: string | number | boolean) => {
    const e = engineRef.current
    if (!e) return
    if (target === 'doctrine' || target === 'doctrine.name') e.applyPreset(String(value))
    else if (target === 'layout.mode' || target === 'layout') e.cueLayoutId(String(value))
    else if (target.startsWith('mod.')) e.fireModifier(target.slice(4), Number(value) || 0.8)
  }

  const loadTrack = async () => {
    const res = await api.openAudio()
    if (!res.ok || !res.bytes) return
    const { duration, peaks } = await audio.loadBytes(res.bytes)
    setTrack({ name: res.name ?? 'TRACK', duration, peaks })
    setLyrics(res.lyrics ? parseLrc(res.lyrics) : [])
    setTime(0)
    setPlaying(false)
    // Native analysis (python brain) feeds real sections/events into the engine;
    // falls back to the live-FFT scheduler when no worker is present.
    if (res.path) {
      const analysis = await api.analyzeAudio(res.path)
      if (analysis.ok && analysis.analysis) engineRef.current?.setAnalysis(analysis.analysis)
    }
  }

  const linkArchive = async () => {
    const res = await api.scanArchive()
    if (res.ok && res.images?.length) {
      await engineRef.current?.setManifest(res.images)
      setArchiveCount(res.images.length)
    }
  }

  const togglePlay = () => {
    if (!track) return
    const isPlaying = audio.toggle()
    setPlaying(isPlaying)
    if (isPlaying) engineRef.current?.run()
    else engineRef.current?.halt()
  }

  const seek = (t: number) => {
    audio.seek(t)
    setTime(t)
  }

  const saveProject = async () => {
    if (!project) return
    await api.saveProject(project.name, project)
  }

  const openProject = async () => {
    const result = await api.openProject()
    if (result.ok && result.project) {
      setProject(result.project)
      setNodes(result.project.graph.nodes)
      setEdges(result.project.graph.edges)
    }
  }

  const requestExport = async () => {
    if (!project) return
    await api.exportProject(project)
  }

  if (!project) {
    return (
      <main className="boot">
        <span className="boot__mark">†</span>
        <span>LOADING MAGDALENE</span>
      </main>
    )
  }

  const trackName = track ? track.name.toUpperCase() : 'NO TRACK LOADED'

  return (
    <main className="shell">
      <header className="masthead">
        <h1 className="wordmark">
          MAGDALENE<span className="wordmark__mark">†</span>
        </h1>
        <div className="masthead-meta">
          <div className="meta-row">N° ENGINE &mdash; {serverStatus === 'ready' ? 'LIVE' : 'CHECK'}</div>
          <div className="meta-row">N° TRACK &mdash; {trackName}</div>
          <div className="meta-row">N° GRAPH &mdash; {nodes.length} NODES / {edges.length} LINKS</div>
          <div className="meta-row">N° PROJECT &mdash; {project.name.toUpperCase()}</div>
        </div>
        <div className="masthead-stripe" />
      </header>

      <section className="body">
        <aside className="panel media-panel">
          <div className="panel-label">
            <span>01 // MEDIA</span>
            <span className="panel-label__actions">
              <button type="button" className="ghost-btn" onClick={loadTrack}>LOAD TRACK</button>
              <button type="button" className="ghost-btn" onClick={linkArchive}>ARCHIVE</button>
              <button type="button" className="ghost-btn" onClick={openProject}>OPEN</button>
            </span>
          </div>
          <div className="track-name">{trackName}</div>
          <div className="track-name track-name--sub">
            ARCHIVE &mdash; {archiveCount > 0 ? `${archiveCount} LINKED` : 'SAMPLE SET'}
          </div>
          <div className="media-list">
            {project.media.map((item, idx) => (
              <button key={item.id} className="media-row" type="button">
                <span className="media-row__index">{String(idx + 1).padStart(2, '0')}</span>
                <span className="media-row__name">{item.name}</span>
                <span className="media-row__meta">{item.type} &mdash; {item.status}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="stage-region">
          <section className="workrow">
            <section className="center">
              <section className={`stage${footage?.flash ? ' is-flashing' : ''}`}>
                <PreviewCanvas
                  audioSource={footageAudio}
                  onReady={(e) => {
                    engineRef.current = e
                    e.setRuntime(runtimeRef.current, () => markersRef.current)
                    e.setMode(graphMode ? 'driven' : 'auto')
                  }}
                  onState={setFootage}
                />
                <div className="stage-frame">
                  <div className="stage-top">
                    <span>PREVIEW / {playing ? 'RUNNING' : serverStatus === 'ready' ? 'LIVE' : 'CHECK'}</span>
                    <span>FRAME {String(footage?.frame ?? 0).padStart(6, '0')}</span>
                  </div>
                  <div className="stage-bottom">
                    <span>TIMELINE &mdash; {project.timeline.bpm} BPM</span>
                    <span>STATE &mdash; {(footage?.musicState ?? 'INTRO').toUpperCase()}</span>
                    <span>CUT &mdash; {footage?.transitionMode ?? '—'}</span>
                    <span>EXPORT &mdash; IDLE</span>
                  </div>
                </div>
                <StageLyrics lines={lyrics} time={time} />
                <div className="stage-stripe" />
                <div className="stage-actions">
                  <button
                    type="button"
                    className={`stage-btn stage-btn--mode${graphMode ? ' is-on' : ''}`}
                    onClick={toggleGraphMode}
                    title="Toggle autonomous vs graph-driven"
                  >
                    {graphMode ? 'GRAPH' : 'AUTO'}
                  </button>
                  <button type="button" className="stage-btn" onClick={() => engineRef.current?.swapImage()}>
                    SWAP
                  </button>
                  <button type="button" className="stage-btn" onClick={() => engineRef.current?.cueLayoutId('quad')}>
                    QUAD
                  </button>
                  <button type="button" className="stage-btn" onClick={() => engineRef.current?.cueLayoutId('solo')}>
                    SOLO
                  </button>
                  <button type="button" className="stage-btn" onClick={() => engineRef.current?.fireModifier('shatter', 0.9)}>
                    SHATTER
                  </button>
                  <button type="button" className="stage-btn" onClick={() => engineRef.current?.applyPreset('rupture')}>
                    DOCTRINE
                  </button>
                </div>
              </section>

              <section className="graph-panel">
                <div className="panel-label panel-label--float">
                  <span>02 // SYSTEM GRAPH</span>
                  <strong>{nodes.length} NODES / {edges.length} LINKS</strong>
                </div>
                <ReactFlow<MagdaleneFlowNode, Edge>
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  onPaneClick={() => setSelectedNodeId(null)}
                  fitView
                >
                  <Background color="#1a1a1a" gap={26} size={1} />
                  <Controls showInteractive={false} />
                  <MiniMap pannable zoomable nodeStrokeWidth={3} />
                </ReactFlow>
              </section>
            </section>

            <aside className="panel controls-panel">
              <section className="ctrl-block">
                <header className="ctrl-header">
                  <span className="ctrl-num">N°01</span>
                  <span className="ctrl-title">INSPECTOR</span>
                  <span className="ctrl-status">{selectedNode ? 'NODE' : 'PROJECT'}</span>
                </header>
                {selectedNode ? (
                  <div className="inspect">
                    <h2 className="inspect__title">{selectedNode.data.label}</h2>
                    <p className="inspect__sub">{selectedNode.data.subtitle}</p>
                    {selectedEval && selectedEval.params.length ? (
                      selectedEval.params.map((p) => {
                        const cur = selectedNode.data.params?.[p.name] ?? p.default
                        if (p.type === 'enum') {
                          return (
                            <label className="macro" key={p.name}>
                              <span className="macro__top">
                                <span>{p.name.toUpperCase()}</span>
                                <span className="macro__value">{String(cur)}</span>
                              </span>
                              <select
                                className="macro__select"
                                value={String(cur)}
                                onChange={(e) => setNodeParam(selectedNode.id, p.name, e.target.value)}
                              >
                                {(p.options ?? []).map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )
                        }
                        if (p.type === 'boolean') {
                          return (
                            <label className="macro macro--bool" key={p.name}>
                              <span>{p.name.toUpperCase()}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(cur)}
                                onChange={(e) => setNodeParam(selectedNode.id, p.name, e.target.checked)}
                              />
                            </label>
                          )
                        }
                        return (
                          <label className="macro" key={p.name}>
                            <span className="macro__top">
                              <span>{p.name.toUpperCase()}</span>
                              <span className="macro__value">{Number(cur).toFixed(2)}</span>
                            </span>
                            <input
                              type="range"
                              min={p.min ?? 0}
                              max={p.max ?? 1}
                              step={p.step ?? 0.01}
                              value={Number(cur)}
                              onChange={(e) => setNodeParam(selectedNode.id, p.name, parseFloat(e.target.value))}
                            />
                          </label>
                        )
                      })
                    ) : (
                      <p className="inspect__sub">{selectedEval ? 'WIRING NODE — NO PARAMS' : 'COSMETIC NODE'}</p>
                    )}
                  </div>
                ) : (
                  <div className="inspect">
                    <h2 className="inspect__title">{project.name}</h2>
                    <p className="inspect__sub">
                      {project.media.length} MEDIA SOURCES / {project.timeline.markers.length} MARKERS
                    </p>
                  </div>
                )}
              </section>

              <section className="ctrl-block">
                <header className="ctrl-header">
                  <span className="ctrl-num">N°02</span>
                  <span className="ctrl-title">LIBRARY</span>
                  <span className="ctrl-status">NODES</span>
                </header>
                <div className="library-grid">
                  {NODE_LIBRARY.map((ev, idx) => (
                    <button key={ev.type} type="button" className="library-tile" title={ev.category}>
                      <span className="library-tile__num">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="library-tile__name">{ev.label.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="ctrl-block">
                <header className="ctrl-header">
                  <span className="ctrl-num">N°03</span>
                  <span className="ctrl-title">PROTOCOL</span>
                  <span className="ctrl-status">{track ? 'ARMED' : 'NO TRACK'}</span>
                </header>
                <button type="button" className="run-btn" onClick={requestExport}>
                  <span className="run-btn__glyph">▶</span>
                  <span className="run-btn__text">EXPORT VIDEO</span>
                </button>
                <div className="secondary-actions">
                  <button type="button" className="action-btn" onClick={saveProject}>
                    <span className="action-btn__key">SAVE</span>
                    <span className="action-btn__name">PROJECT</span>
                  </button>
                  <button type="button" className="action-btn">
                    <span className="action-btn__key">REC</span>
                    <span className="action-btn__name">CAPTURE</span>
                  </button>
                </div>
                <div className="transport">
                  <button
                    type="button"
                    className="transport__play"
                    title={playing ? 'Pause' : 'Play'}
                    onClick={togglePlay}
                  >
                    {playing ? '❚❚' : '▶'}
                  </button>
                  <span className="transport__time">{formatTime(time)}</span>
                  <span className="transport__cue">{project.timeline.markers[0].label}</span>
                </div>
              </section>
            </aside>
          </section>

          <Timeline
            project={project}
            track={track}
            time={time}
            onSeek={seek}
            onMarkerMove={moveMarker}
            onMarkerTrigger={triggerMarker}
          />
        </section>
      </section>

      <footer className="footer">
        <div className="footer-block">N° 01 &mdash; {project.name.toUpperCase()}</div>
        <div className="footer-block footer-block--center">EDIT WITH SOUND</div>
        <div className="footer-block footer-block--right">RELEASE // 0.1.0 &mdash; NATIVE BUILD</div>
      </footer>
    </main>
  )
}
