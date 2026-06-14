# MAGDALENE

MAGDALENE is a node-based music-video editor for building visual systems from
images, video, audio, lyrics, text, and archive fragments.

The project starts from the strongest ideas in FOUND / FOOTAGE, but it is a new
program rather than a continuation of that repo. FOUND / FOOTAGE proved the
audio-led image rupture engine. MAGDALENE is the broader editor around that
idea: a place to compose, map, automate, preview, save, and render full music
visuals through a graph and timeline.

## Current Status

This repository now contains the first local editor scaffold:

- React + TypeScript editor shell
- React Flow node graph
- audio timeline mock with waveform, beat/stem/section/lyric lanes
- media library for image, video, audio, and text sources
- preview viewport placeholder
- inspector and node palette
- local Node API for health, default project, save, and export stubs

Read:

- [PLAN.md](PLAN.md) for the build direction
- [CONTEXT.md](CONTEXT.md) for product positioning and relationship to FOUND /
  FOOTAGE

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5177`.

The local API runs on `http://localhost:5178` and Vite proxies `/api/*` to it.

## Check

```bash
npm run check
npm run build
```
