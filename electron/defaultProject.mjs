// Canonical default project template for MAGDALENE.
// Shared by the Electron main process (IPC) and the legacy web server.
export const DEFAULT_PROJECT = {
  version: '0.1.0',
  name: 'Untitled Magdalene',
  timeline: {
    duration: 186,
    bpm: 124,
    lanes: [
      { id: 'kick', label: 'KICK', kind: 'stem', color: '#d84c3f', events: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160] },
      { id: 'snare', label: 'SNARE', kind: 'stem', color: '#e0b75c', events: [6, 14, 22, 30, 46, 62, 94, 126, 158] },
      { id: 'lyrics', label: 'LYRICS', kind: 'text', color: '#7cbfa5', events: [18, 38, 72, 111, 144] },
      { id: 'sections', label: 'SECTIONS', kind: 'section', color: '#8a78d6', events: [0, 24, 64, 96, 128, 168] }
    ],
    markers: [
      { id: 'm1', time: 24, label: 'FIRST CUT', target: 'layout.mode', value: 'duo_h' },
      { id: 'm2', time: 64, label: 'RUPTURE', target: 'fx.datamosh', value: 1.4 },
      { id: 'm3', time: 128, label: 'DOCTRINE', target: 'doctrine', value: 'rupture' }
    ]
  },
  media: [
    { id: 'audio-1', type: 'audio', name: 'Track.wav', status: 'analysis ready' },
    { id: 'archive-1', type: 'image', name: 'Archive folder', status: 'unlinked' },
    { id: 'video-1', type: 'video', name: 'Fragment.mov', status: 'unlinked' },
    { id: 'text-1', type: 'text', name: 'Lyrics / evidence text', status: 'draft' }
  ],
  graph: {
    nodes: [
      {
        id: 'audio',
        type: 'magdalene',
        position: { x: -560, y: -40 },
        data: { label: 'Audio Track', subtitle: 'live bands + impact', tone: 'red', nodeType: 'audio.track', params: { gain: 1 } }
      },
      {
        id: 'macros',
        type: 'magdalene',
        position: { x: -280, y: -200 },
        data: {
          label: 'Macro Bank',
          subtitle: 'intensity / violence / growth',
          tone: 'moss',
          nodeType: 'macro.bank',
          params: { intensity: 0.78, violence: 0.62, reactivity: 0.7, temporalInstability: 0.5, resolutionCollapse: 0.4, growth: 0.6 }
        }
      },
      {
        id: 'doctrine',
        type: 'magdalene',
        position: { x: -280, y: 80 },
        data: { label: 'Doctrine', subtitle: 'effect signature', tone: 'violet', nodeType: 'doctrine', params: { name: 'standard' } }
      },
      {
        id: 'cut',
        type: 'magdalene',
        position: { x: -280, y: -60 },
        data: { label: 'Cut Scheduler', subtitle: 'auto layout cuts', tone: 'amber', nodeType: 'cut.scheduler', params: { intervalSec: 6, layout: 'auto' } }
      },
      {
        id: 'fx',
        type: 'magdalene',
        position: { x: 40, y: -20 },
        data: {
          label: 'FX Chain',
          subtitle: 'datamosh / tear / bloom',
          tone: 'amber',
          nodeType: 'fx.chain',
          params: { feedback: 0.4, rgbTear: 0.3, slitScan: 0.25, pixelSort: 0.2, datamosh: 0.35, dither: 0.3, bloom: 0.8, react: 0.4 }
        }
      },
      {
        id: 'markers',
        type: 'magdalene',
        position: { x: 340, y: 0 },
        data: { label: 'Marker Gate', subtitle: 'timeline triggers', tone: 'red', nodeType: 'markers', params: {} }
      },
      {
        id: 'render',
        type: 'magdalene',
        position: { x: 640, y: -20 },
        data: { label: 'Render Out', subtitle: 'preview + final mp4', tone: 'violet', nodeType: 'render.out', params: {} }
      }
    ],
    edges: [
      { id: 'audio-macros', source: 'audio', target: 'macros', animated: true },
      { id: 'audio-cut', source: 'audio', target: 'cut', animated: true },
      { id: 'audio-fx', source: 'audio', target: 'fx', animated: true },
      { id: 'doctrine-fx', source: 'doctrine', target: 'fx' },
      { id: 'fx-markers', source: 'fx', target: 'markers', animated: true },
      { id: 'macros-render', source: 'macros', target: 'render' },
      { id: 'markers-render', source: 'markers', target: 'render', animated: true }
    ]
  }
}
