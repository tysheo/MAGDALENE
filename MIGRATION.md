# MAGDALENE — FOUND / FOOTAGE Migration & Wiring Plan

This is the engineering bridge between FOUND / FOOTAGE (FF) and MAGDALENE. It
records, in detail, **everything FF does automatically**, and **how each of
those automatic behaviors becomes a scriptable, wireable node** in MAGDALENE's
flow system.

PLAN.md and CONTEXT.md describe the product. This document describes the
mechanism: what to migrate, in what order, and the exact contract that makes a
hardwired engine become an editable graph.

---

## 1. The core realization

FF is **one hardwired render loop**. `FoundFootageApp.loop()`
(`public/src/FoundFootageApp.js`) runs every frame and does this:

1. Sample audio — live FFT (`AudioPlayer.update`) + analyzed brain
   (`AudioBrain.sample(t)`), events (`eventsBetween`), section (`sectionAt`),
   lyric signal (`_lyricSignal`).
2. `LivingEditScheduler.update()` — classify music state, synthesize beats from
   FFT, compute per-effect weights, rotate the "dominant set", pick a transition
   mode + recipe, apply holds / doctrine bias / ceilings.
3. `Choreography.update()` — on bar boundaries choose a layout for the section,
   pick images, cue `CellDirector.cueLayout`, fire particle moments
   (explode / vortex / wind / shatter / pulse), drive camera dwell.
4. `CameraRig.update()` — cinematic camera per section/forces.
5. `PersistentParticleField.update()` + `SceneBuilder.update()`.
6. `PassComposer.run()` — the 8-pass effect chain.
7. `EvidenceOverlay` — typography + lyric flashes.
8. `handleAutoSlideshow()` — schedule-driven cuts when choreography is off.

**Every "automatic" thing FF does is a decision made inside that loop.** Making
FF scriptable means lifting each decision out of the loop and turning it into a
**node** that produces or transforms a value. The loop itself becomes the
**graph runtime** that walks the nodes instead of calling hardcoded methods.

The default MAGDALENE project is FF's auto-maker wired explicitly as a graph, so
out of the box it behaves like FF — but every wire is visible and editable.

---

## 2. The linchpin: the RenderState contract

FF computes a per-frame `forces` object implicitly and threads it through the
loop. MAGDALENE makes the graph **produce that object explicitly**. This is the
single contract that lets preview and offline render be the same system.

```ts
type RenderState = {
  // time
  audioTime: number
  frame: number

  // structure (from analysis + classifier nodes)
  musicState: 'intro'|'verse'|'build'|'pre_drop'|'drop'|'breakdown'|'evidence'|'outro'
  section: { label: string; localT: number; boundaryHit: boolean } | null

  // media + composition (from picker / layout director)
  images: MediaRef[]            // one per active cell
  layoutId: string              // 'solo' | 'duo_h' | 'quad' | 'mondrian_a' | ...
  cellRects: CellRect[]         // resolved transforms (cx, cy, w, h, role, opacity, z)

  // motion (from particle modifier nodes)
  particleMods: {
    stutter: number; swarm: number; implode: number
    vortex: number; shatter: number; wind: number; pulse: number
  }

  // post-process (from FX chain node, after dominant-set gate)
  effectWeights: {
    feedback: number; rgbTear: number; slitScan: number; pixelSort: number
    datamosh: number; dither: number; bloom: number; flash: number
  }

  // transition (from transition map node)
  transitionMode: 'PATENT_TO_SCREAM'|'COLLAPSE_INTO_VOID'|'CLAIM_TO_BODY'|'TIME_DAMAGE'|'ARCHIVE_TO_GHOST'
  transitionT: number

  // framing + text
  camera: CameraCue
  typography: TextEvent[]

  // global feel (from doctrine node)
  macros: Macros

  // output intent
  record: boolean
  exportRequest: ExportSpec | null
}
```

The engine consumes `RenderState`. Nothing else. The graph runtime is the only
thing that produces it. Offline render evaluates the same graph at fixed `fps`
the way `renderOffline()` + `window.foundFootageOffline.step()` do today.

---

## 3. The interlock: typed ports

"Ways to interlock things" = a **typed port system**. An edge only connects if
the output port type is compatible with the input port type. This is the
contract that keeps the graph meaningful instead of a free-for-all.

| Port type | Carries | Example producer → consumer |
|---|---|---|
| `audio` | scalar bands (bass/mid/high/impact) + time | Audio Track → FX Chain |
| `controls` | analyzed control lanes (pressure, violence, collapse, …) | Stem Energy → Music State |
| `events` | discrete event stream (kick/snare/collapse/lyric) | Beat Grid → Cut Scheduler |
| `gate` | on/off + strength (section active, marker active) | Section Gate → Layout Director |
| `media` | image/video references | Media Archive → Media Picker |
| `layout` | layout id + cell rects | Layout Director → Cell Layout |
| `weights` | effect weight map | FX Chain → Render Output |
| `mods` | particle modifier map | Particle Modifier → Particle Field |
| `camera` | camera cue | Camera Rig → Render Output |
| `text` | timed text events | Typography → Render Output |
| `render` | a RenderState contribution | any → Render Output |

Three ways things interlock:
- **Edges** — node output → node input (the patch).
- **Markers** — a timeline marker writes into a named node param
  (`target: 'fx.datamosh'`, already sketched in `defaultProject.mjs`).
- **Automation lanes** — a curve over time drives a node param continuously.

---

## 4. What FF does automatically → the node it becomes

Grouped to match PLAN.md's library. Each node is a thin wrapper over migrated FF
logic; the FF source column is the migration target.

### Inputs
| Node | FF source | Out ports |
|---|---|---|
| **Audio Track** | `AudioPlayer` + upload via `/api/analyze-audio` | `audio`, time |
| **Media Archive** | `Manifest`, `/api/manifest`, `serveAsset` | `media` |
| **Video Source** *(new, beyond FF)* | — | `media` |
| **Text Source / Lyrics** | `/api/phrases`, `/api/lyrics`, `parseLrc/parseSrt` | `text`, `events` (lyric) |

### Audio Analysis
| Node | FF source | Out ports |
|---|---|---|
| **Beat Grid** | `AudioBrain.beats/tempo`, `Choreography._beatIndex` | `events` (beats), tempo |
| **Stem Energy** | `AudioBrain.sample` control lanes | `controls` |
| **Section Gate** | `AudioBrain.sectionAt` | `gate` per section |
| **Lyric Cue** | `_lyricSignal`, `_fireLyricsUpTo` | `events` (lyric), `text` |
| **Beat Synth** | synthetic kick/snare in `scheduler.update` | `events` |

### Edit Logic
| Node | FF source | Behavior |
|---|---|---|
| **Music State** | `classifyMusicState` / `classifyTestimonyState` + `smoothMusicState` | `controls`+`events` → state enum |
| **Cut Scheduler** | `SectionSchedule.buildCutTimes` (minHold/maxGap) | `events`+duration → cut times |
| **Media Picker** | `pickImageBatch` (shuffle-bag + match-on-action by avgColor) | `media`+cut → image(s) |
| **Layout Director** | `Choreography` + `SECTION_CHOREOGRAPHY` (bar switching, cumulative, solo-balance) | state+beats → `layout` |
| **Transition Map** | `pickTransitionMode` + `TRANSITION_RECIPES` + `smoothTransitionMode` | state+controls → mode + recipe |

### Visuals
| Node | FF source | Behavior |
|---|---|---|
| **Particle Field** | `PersistentParticleField` (1M points, GPU) | `layout`+`mods` → point cloud |
| **Cell Layout** | `Layouts.js` + `CellDirector` (fit, spawn moments, modifiers) | `layout`+`media` → cell rects |
| **Camera Rig** | `CameraRig` + `Choreography._cameraForLayout` / dwell | state+centroid → `camera` |
| **Typography / Evidence** | `EvidenceOverlay` + phrases | `text`+events → `text` events |
| **Particle Modifier** | `setCellModifier`, `triggerShatter`, `triggerWind`, `pokeCellPulse` | event+cell → `mods` |

### Effects (each a `PassComposer` pass)
`Feedback`, `RGB Tear`, `Slit Scan`, `Pixel Sort`, `Datamosh`, `Dither`, `Bloom`
+ the **FX Chain** node, which is the important one: it reproduces the
**dominant-set gate** (`LivingEditScheduler` — only 2–3 effects "live" at once,
rotated every `DOMINANT_SWAP_S`, with `OFF_SET_GAIN`/`DOMINANT_BOOST`,
`PASS_CEILING`, holds, and doctrine bias). Out: `weights`.

### Doctrine
| Node | FF source | Behavior |
|---|---|---|
| **Doctrine** | `PRESETS` (minimal/standard/heavy/rupture/testimony) | name → `macros` + effect bias + schedule params + visualMode |

### Output
| Node | FF source | Behavior |
|---|---|---|
| **Preview** | `renderer.blit` | `render` → viewer |
| **Record** | `CanvasRecorder` + `/api/recording` | `render` → webm/mp4 |
| **Offline Render** | `renderOffline` (deterministic step) | graph → mp4 |

---

## 5. Everything-as-a-command (scriptable actions)

FF performs implicit actions inside the loop. MAGDALENE exposes each as a
**named command** that is BOTH a UI button AND a graph-triggerable input (a
marker, a gate edge, or an automation step can fire it):

| Command | FF equivalent | Trigger sources |
|---|---|---|
| `archive.import(file)` | manual rescan / `/api/refresh` | button, drag-drop |
| `archive.rescan()` | `runWorkerScan` | button, watcher |
| `media.swap(cellId, imageId?)` | `cueImage`, `pickImageBatch` | per-cell button, marker, event edge |
| `layout.cue(layoutId)` | `cueLayout` | button, marker, Layout Director |
| `particles.fire(mod, cellId, strength)` | `triggerShatter` / `triggerWind` / `setCellModifier` / `pokeCellPulse` | button, event edge, marker |
| `doctrine.apply(name)` | `applyPreset` | palette, marker |
| `transport.run()` / `transport.halt()` | `toggleRun` (+ WARNING card) | RUN button |
| `audio.analyze(file)` | `/api/analyze-audio` → `guernica_audio_brain.py` | import |
| `render.export(spec)` | `requestOfflineRender` | button |

The Media Picker's `next()` and per-cell `swap()` are the literal "add a new
image / swap image" functions you asked for — surfaced as viewer buttons and as
node inputs.

---

## 6. UI surfaces

1. **Trackspace (run space)** — the graph canvas IS the patch. The transport's
   RUN actually starts the runtime evaluating the graph against audio time.
   This is "a space to run things."
2. **Viewer** — the WebGL stage (already promoted in `PreviewCanvas` /
   `PreviewEngine`). Gains per-cell controls: swap, lock, solo.
3. **Timeline** — waveform + real analysis lanes (beats / stems / sections /
   lyrics from the worker) + manual markers + automation lanes.
4. **Interlock** — the typed-port edges + markers + automation from §3.

---

## 7. Server / worker contract to migrate into Electron

FF's `server/index.mjs` does this automatically; fold each into the Electron
main process as IPC + child-process spawns (`electron/main.mjs`):

- **Archive scan** → `spawn(python, guernica_worker.py --scan)` → per-image SAM3
  / depth / flow cache maps; manifest with `workerStatus`, progress via SSE →
  becomes IPC events.
- **Audio analysis** → `spawn(python, guernica_audio_brain.py --input … --fps 60)`
  → writes `summary.json` + `controls`/`events`/`sections` consumed by
  `AudioBrain`.
- **Lyrics** → local LRC/SRT/JSON match + remote LRCLIB fallback.
- **Offline render** → today uses Playwright screenshots + ffmpeg; in Electron
  this becomes an offscreen `BrowserWindow` (or headless render) stepping the
  same deterministic graph, then ffmpeg encode.
- **Assets** → `serveAsset` / cache serving → Electron `file://` or a custom
  protocol.

Progress signals (`PROGRESS:` lines on stderr/stdout) map cleanly to IPC
progress events.

---

## 8. Migration order (the keystone-first sequence)

The **graph runtime is the keystone** — nothing is scriptable without it.

1. **Engine core** — port `PersistentParticleField`, `CellDirector`,
   `Layouts`, `CameraRig`, `PassComposer` + 8 passes, `SceneBuilder`,
   `ImageLoader` into `engine/` (fix `/src/` imports). Real visuals.
2. **Backend/worker** — fold FF's media + analysis routes into Electron main as
   IPC; spawn the two Python workers. Real archive scan + audio analysis.
3. **Graph runtime** — the evaluator that walks nodes → `RenderState` each
   frame, replacing `FoundFootageApp.loop`. Define the typed port system (§3).
4. **Node library v1** — the nodes in §4, each wrapping migrated FF logic.
5. **Trackspace + commands** — RUN drives the runtime; the §5 commands as
   buttons + marker triggers.
6. **Timeline lanes** — real analysis data + markers/automation writing into
   node params.
7. **Record / Render** — offscreen render → ffmpeg, native (no Playwright).

### Beyond-FF additions for v1 (per scope decision)
- **Video Source** node — clips as first-class visual sources/textures.
- **Manual Marker / Marker Gate / Automation Lane** — author events that drive
  any node param, not just audio-derived ones.

---

## 9. Current state vs. target

The scaffold today (`defaultProject.mjs`, `client/src/model/project.ts`) renders
the FF auto-maker as a **cosmetic** graph: nodes are labels + tones, edges are
decorative, markers already hint at the interlock (`target: 'fx.datamosh'`).

The work in §8 turns that cosmetic graph into a **live** one:
- node data gains typed ports + params + an `evaluate()` contribution,
- edges carry typed signals,
- markers/automation write params,
- the runtime produces `RenderState`,
- the engine renders it.

When step 4 lands, editing a node param or moving a marker visibly changes the
preview — the first proof that FF's automatic engine has become editable
software.
