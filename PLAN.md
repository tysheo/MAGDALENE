# MAGDALENE Plan

## Summary

MAGDALENE is a standalone graph-and-timeline editor for making music visuals
from images, video, audio, lyrics, and text. It should feel like an actual
creative program, not a website with presets. The first build should let a user
load media, analyze a song, build a node-based visual system, place or edit
timeline moments, preview the result, save the project, and export a finished
video.

The core product idea is not a generic procedural node environment. MAGDALENE
understands music-video editing concepts directly: songs, stems, beats,
sections, lyrics, archive images, video fragments, typography, cuts,
transitions, particle layouts, and degradation.

## First Build Decisions

- Build MAGDALENE in its own repo: `tysheo/MAGDALENE`.
- Treat FOUND / FOOTAGE as reference/source material, not as the app being
  extended.
- Use React, TypeScript, and Vite for the editor.
- Use a graph editor library such as React Flow / `@xyflow/react`.
- Keep a local Node server for media indexing, analysis, project I/O, and
  export.
- Save projects as `.magdalene` JSON files.
- Reuse or migrate the proven render/effect/audio ideas from FOUND / FOOTAGE.
- Keep DDJ, MIDI, and live-controller support out of the first build.

## Product Surface

The first real version should have five primary areas:

- **Graph**: node canvas for visual systems and signal routing.
- **Timeline**: waveform, beats, stems, sections, lyrics, and manual markers.
- **Media Library**: images, video, audio, text, and project assets.
- **Preview**: live render output from the current graph and timeline state.
- **Inspector**: selected node, edge, marker, media item, and export settings.

The default project template should recreate the FOUND / FOOTAGE auto-maker
behavior as a graph, so users start with something alive and can break it open.

## Core Architecture

MAGDALENE should be organized around a graph runtime, not around a hidden global
scheduler. Each frame, the runtime evaluates:

1. Current project state.
2. Current timeline/audio time.
3. Active audio analysis lanes.
4. Manual markers and overrides.
5. Node graph connections and parameters.

The runtime outputs a render state for the engine:

- selected media sources
- layout and particle-field instructions
- typography/text events
- effect weights
- camera/framing state
- export/record state

Offline render must evaluate the same graph deterministically, so preview and
export are the same system.

## Initial Node Library

V1 should start with a medium-sized expressive library rather than a tiny MVP or
a TouchDesigner-scale low-level system.

- **Inputs**: Audio Track, Image Archive, Video Source, Text Source, Lyrics
- **Audio Analysis**: Beat Grid, Stem Energy, Section Gate, Lyric Cue
- **Timeline**: Manual Marker, Marker Gate, Automation Lane
- **Edit Logic**: Media Picker, Cut Scheduler, Transition Map, Layout Director
- **Visuals**: Particle Field, Cell Layout, Typography, Evidence Text
- **Effects**: Feedback, RGB Tear, Slit Scan, Pixel Sort, Datamosh, Dither,
  Bloom, FX Chain
- **Output**: Preview, Record, Offline Render

## Media Scope

V1 supports images, audio, video, and text.

Images can use subject-aware archive analysis and particle sampling. Video
clips should be first-class media sources, but the initial implementation can
treat them as visual sources/textures rather than trying to become a full
nonlinear video editor. Text supports lyrics, captions, phrases, evidence
cards, and timed typography flashes.

## Project File

`.magdalene` files are JSON and should store:

- project metadata
- media references
- graph nodes and edges
- node parameter values
- timeline markers and automation
- audio analysis references
- export settings
- editor UI layout where useful

The file should reference large media and cache files by path or project asset
ID, not inline them.

## First Milestone

The first milestone is not final polish. It is a usable vertical slice:

1. Create/import a project.
2. Add an audio track and media assets.
3. Run audio analysis.
4. See analysis lanes on a timeline.
5. Open a default generated graph.
6. Edit a node parameter and see the preview change.
7. Add a manual marker that drives a transition or effect.
8. Save and reload the `.magdalene` project.
9. Export an MP4.

## Test Plan

- Clean clone boots the local editor.
- Project creation writes a valid `.magdalene` file.
- Imported audio produces waveform, beat, section, stem, and lyric lanes.
- Imported images, video, and text appear in the media library.
- Default graph plays a generated music visual.
- Node parameter edits update preview.
- Timeline markers can drive graph parameters.
- Saved projects reload with graph, timeline, media refs, and export settings.
- Offline render produces an MP4 from the saved project.
- Migrated render/effect modules have smoke tests so MAGDALENE does not regress
  the FOUND / FOOTAGE visual engine.

## Out Of Scope For First Build

- DDJ and MIDI controller support.
- Multiplayer/collaborative editing.
- Cloud accounts or hosted rendering.
- Full TouchDesigner-style low-level math/operator/shader graph.
- Full nonlinear video editing with many conventional clip tracks.

