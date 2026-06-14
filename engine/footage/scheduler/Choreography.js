import { layoutCellCount, getLayout } from "../particles/Layouts.js";

// Layered layouts (ghost_overlay, center_ring, fg_bg_swap) were dropped —
// double-stacked images at the same position read as visual mush, can't see
// what's there. Only adjacent-panel layouts are used now.
export const SECTION_CHOREOGRAPHY = {
  intro: { layouts: ["solo", "solo", "duo_h"], barsPerSwitch: 2, modifiers: [] },
  verse: { layouts: ["solo", "duo_h", "solo", "duo_v", "triptych", "solo", "quad"], barsPerSwitch: 1, modifiers: [] },
  build: { layouts: ["solo", "duo_h", "triptych", "quad"], barsPerSwitch: 1, modifiers: ["sub_clock_split"], cumulative: true },
  pre_drop: { layouts: ["solo", "quad", "hex", "solo", "mondrian_a"], barsPerSwitch: 1, modifiers: ["sub_clock_split"] },
  drop: { layouts: ["solo", "quad", "hex", "solo", "ennead", "filmstrip_h"], barsPerSwitch: 0.5, modifiers: ["stutter_chop", "implode_explode"] },
  breakdown: { layouts: ["solo", "solo", "duo_h", "triptych"], barsPerSwitch: 2, modifiers: ["swarm_dispersal"] },
  evidence: { layouts: ["solo", "shear_h", "duo_v", "solo", "mondrian_b", "quad"], barsPerSwitch: 1, modifiers: [] },
  outro: { layouts: ["solo", "solo", "duo_h"], barsPerSwitch: 4, modifiers: [] }
};

const TESTIMONY_CHOREOGRAPHY = {
  intro: { layouts: ["solo", "solo"], barsPerSwitch: 4, modifiers: [] },
  verse: { layouts: ["solo", "solo", "duo_h", "solo"], barsPerSwitch: 3, modifiers: [] },
  build: { layouts: ["solo", "duo_h", "solo", "duo_v"], barsPerSwitch: 2, modifiers: [] },
  pre_drop: { layouts: ["solo", "duo_h", "solo"], barsPerSwitch: 2, modifiers: [] },
  drop: { layouts: ["solo", "duo_h", "triptych", "solo"], barsPerSwitch: 1.5, modifiers: ["sub_clock_split"] },
  breakdown: { layouts: ["solo", "solo"], barsPerSwitch: 4, modifiers: [] },
  evidence: { layouts: ["solo", "solo", "duo_v", "solo"], barsPerSwitch: 3, modifiers: [] },
  outro: { layouts: ["solo", "solo"], barsPerSwitch: 4, modifiers: [] }
};

const CUMULATIVE_SEQUENCE = ["solo", "duo_h", "triptych", "quad", "hex", "ennead"];

export class Choreography {
  constructor({ audioBrain, cellDirector, pickImages, cueLayout }) {
    this.audioBrain = audioBrain;
    this.cellDirector = cellDirector;
    this.pickImages = pickImages;
    this.cueLayout = cueLayout;
    this.lastSwitchKey = null;
    this.lastSectionLabel = null;
    this.layoutCursor = 0;
    this.lastKickAt = -Infinity;
    this.cumulativeIndex = 0;
    this.pending = null;
    this.stageCursor = 0;
    this.cameraCue = null;
    this.activeWave = null;          // { startT, strength, fired: Set<cid> }
    this.sectionStartT = null;       // audioTime at which the current section began
    this.cuePanWaypoints = null;     // [{x, y, zOffset, fov}] for camera dwell across cells
    this.cuePanStartT = null;
    this.cuePanDurationS = 0;
    this.lastMomentAt = -Infinity;
    this.lastMomentType = null;
    this.momentCursor = 0;
    this.lastPulseAt = -Infinity;
    this.multiLayoutStreak = 0;
  }

  update({ running, audioTime, section, forces }) {
    this._lastUpdateAudioTime = audioTime;
    this._updateCameraDwell(audioTime);
    if (!running) return false;
    const label = forces?.musicState || "verse";
    const testimony = forces?.visualMode === "testimony";
    const configMap = testimony ? TESTIMONY_CHOREOGRAPHY : SECTION_CHOREOGRAPHY;
    const config = configMap[label] || configMap.verse;
    const events = forces?.events || [];
    this._lastForces = forces || null;

    if (label !== this.lastSectionLabel) {
      this.lastSectionLabel = label;
      this.sectionStartT = audioTime;
      this.layoutCursor = 0;
      this.lastSwitchKey = null;
      this.cumulativeIndex = 0;
      this.multiLayoutStreak = 0;
    }

    // BUILD RAMP — modifier strength climbs from ~0 to 1 over BUILD_RAMP_S
    // seconds into the build section. Without this, all build modifiers fire
    // at full strength on bar 1, which kills the crescendo. Other sections
    // run at intensity=1 so existing behavior is preserved.
    const BUILD_RAMP_S = 10;
    let modIntensity = 1;
    if (label === "build" && this.sectionStartT != null) {
      const tIn = Math.max(0, audioTime - this.sectionStartT);
      modIntensity = Math.min(1, 0.08 + tIn / BUILD_RAMP_S);
    }

    this.cellDirector.applyModifiers(config.modifiers, { ...forces, audioTime, modIntensity });
    this._pulseCellsOnEvents(events, audioTime);
    this._stepActiveWave(audioTime);
    // BAR-DRIVEN FORCE-FIRES — even when audio events are sparse (no demucs
    // brain), force a moment on bar boundaries so the field stays alive.
    this._maybeFireBarMoment(audioTime, label);

    if (config.cumulative) {
      return this._updateCumulative({ audioTime, events, forces, config });
    }

    const beatIndex = this._beatIndex(audioTime);
    const barPosition = beatIndex / 4;
    const switchKey = `${label}:${Math.floor(barPosition / config.barsPerSwitch)}`;
    if (switchKey === this.lastSwitchKey) return false;
    this.lastSwitchKey = switchKey;

    let layoutId = config.layouts[this.layoutCursor % config.layouts.length];
    this.layoutCursor++;
    layoutId = this._balanceSolo(layoutId, label);
    return this._cue(layoutId, config, forces);
  }

  _balanceSolo(layoutId, label) {
    const isSolo = layoutCellCount(layoutId) === 1;
    if (isSolo) {
      this.multiLayoutStreak = 0;
      return layoutId;
    }
    this.multiLayoutStreak++;
    const maxMulti = label === "drop" ? 2 : label === "pre_drop" ? 2 : 3;
    if (this.multiLayoutStreak > maxMulti) {
      this.multiLayoutStreak = 0;
      return "solo";
    }
    return layoutId;
  }

  // Probability-per-bar that we force a "between cue" moment, by section.
  // These fire WITHOUT needing kicks/snares from the brain.
  _maybeFireBarMoment(audioTime, label) {
    const beatIndex = this._beatIndex(audioTime);
    const barKey = `${label}:${Math.floor(beatIndex / 4)}`;
    if (barKey === this._lastBarMomentKey) return;
    this._lastBarMomentKey = barKey;

    const particles = this.cellDirector?.particles;
    if (!particles) return;
    const active = particles.activeCellIndices();
    if (!active.length) return;

    const testimony = this._lastForces?.visualMode === "testimony";
    if ((this._lastForces?.readabilityHold || 0) > (testimony ? 0.40 : 0.62) && label !== "drop") return;
    const baseCooldown = label === "drop" ? 0.65 : label === "pre_drop" ? 0.95 : 1.25;
    const cooldown = testimony ? baseCooldown * 2.2 : baseCooldown;
    if (audioTime - this.lastMomentAt < cooldown) return;
    const odds = testimony
      ? { drop: 0.22, pre_drop: 0.16, build: 0.14, evidence: 0.12, verse: 0.08, breakdown: 0.04, intro: 0.03, outro: 0.03 }
      : { drop: 0.60, pre_drop: 0.44, build: 0.34, evidence: 0.32, verse: 0.20, breakdown: 0.20, intro: 0.05, outro: 0.05 };
    if (Math.random() > (odds[label] ?? 0.30)) return;

    // Pick a moment based on section character.
    const pool = testimony ? (label === "drop" ? ["wind", "vortex"] : ["wind"])
               : label === "drop" ? ["explode", "vortex", "wind", "shatter", "explode"]
               : label === "pre_drop" ? ["explode", "wind", "shatter", "vortex"]
               : label === "build" ? ["wind", "explode", "shatter"]
               : label === "evidence" ? ["shatter", "vortex"]
               : ["wind", "explode"];
    let moment = pool[(this.momentCursor + ((Math.random() * pool.length) | 0)) % pool.length];
    if (moment === this.lastMomentType && pool.length > 1) {
      moment = pool[(pool.indexOf(moment) + 1) % pool.length];
    }
    this.momentCursor++;
    this.lastMomentAt = audioTime;
    this.lastMomentType = moment;
    this._emitDebugEvent("particleMoment", moment, audioTime);

    if (moment === "explode") {
      const cid = active[(Math.random() * active.length) | 0];
      particles.setCellModifier(cid, "swarm", 0.9);
      particles.pokeCellPulse(cid, 0.75);
    } else if (moment === "vortex") {
      const cid = active[(Math.random() * active.length) | 0];
      particles.setCellModifier(cid, "vortex", 0.58);
    } else if (moment === "wind") {
      particles.triggerWind(0.48 + Math.random() * 0.24);
    } else if (moment === "shatter") {
      const cid = active[(Math.random() * active.length) | 0];
      particles.triggerShatter(cid, 0.7);
    }
  }

  _updateCumulative({ audioTime, events, forces, config }) {
    const collapse = events.some((e) => e.type === "collapse" && e.strength > 0.35);
    if (collapse) {
      this.cumulativeIndex = 0;
      this.lastKickAt = audioTime;
      this.multiLayoutStreak = 0;
      return this._cue("solo", config, forces);
    }

    const kick = events.find((e) => e.type === "kick" && e.strength > 0.42);
    if (!kick || Math.abs(kick.time - this.lastKickAt) < 0.16) return false;
    this.lastKickAt = kick.time;
    this.cumulativeIndex = Math.min(CUMULATIVE_SEQUENCE.length - 1, this.cumulativeIndex + 1);
    const layoutId = this._balanceSolo(CUMULATIVE_SEQUENCE[this.cumulativeIndex], "build");
    return this._cue(layoutId, config, forces);
  }

  _cue(layoutId, config, forces) {
    if (this.pending) return false;
    const count = layoutCellCount(layoutId);
    const images = this.pickImages(count);
    if (!images.length) return false;
    const stage = this._nextStage(layoutId);
    this.cameraCue = this._cameraForLayout(layoutId, stage);
    // Set up camera dwell waypoints for multi-cell layouts. Single-cell cues
    // keep the existing single-cue behavior (no pan).
    this._setupCameraDwell(layoutId, stage, forces?.audioTime ?? this._lastUpdateAudioTime ?? 0, config.barsPerSwitch);
    this.pending = Promise.resolve(this.cueLayout(layoutId, images, {
      source: "choreography",
      modifiers: config.modifiers,
      forces,
      stage
    }))
      .catch((err) => console.warn("choreography cue failed", err))
      .finally(() => {
        this.pending = null;
      });
    return true;
  }

  // Build the pan path for the current cue. For 2+ cell layouts, the camera
  // dwells on each cell center in turn, walking the panel order so a duo /
  // triptych / mondrian reads as composed shots instead of a held wide.
  // Pan duration follows barsPerSwitch so we finish the walk before the next cue.
  _setupCameraDwell(layoutId, stage, audioTime, barsPerSwitch) {
    const count = layoutCellCount(layoutId);
    if (count < 2) {
      this.cuePanWaypoints = null;
      this.cuePanStartT = null;
      return;
    }
    const layout = getLayout(layoutId);
    // Cells are in (cx,cy) world units; pull them toward center by 0.22 so the
    // camera sweep is a small dolly across panels, not a violent jump.
    const waypoints = layout.map((cell) => ({
      x: stage.x + (cell.cx ?? 0) * 0.22,
      y: stage.y + (cell.cy ?? 0) * 0.22
    }));
    // Start with stage center so the camera eases INTO the first cell.
    waypoints.unshift({ x: stage.x, y: stage.y });
    this.cuePanWaypoints = waypoints;
    this.cuePanStartT = audioTime;
    const tempo = this.audioBrain?.tempo || 120;
    const beatsPerBar = 4;
    const barsTotal = Math.max(0.25, barsPerSwitch ?? 2);
    // Finish the pan in ~55% of the bar window so each cell gets a brief
    // hold at the end of the dolly before the next cue arrives. Clamped to a
    // [0.5s, 2.0s] band so very fast sections (drop @ 0.25 bars) still get a
    // legible camera move and slow sections don't crawl indefinitely.
    const raw = (barsTotal * beatsPerBar * 60) / tempo * 0.55;
    this.cuePanDurationS = Math.max(0.5, Math.min(2.0, raw));
  }

  // Each frame, if a pan is active, interpolate the camera cue's x/y across
  // the waypoint path. Keeps zOffset/fov stable so only the framing pans.
  _updateCameraDwell(audioTime) {
    if (!this.cuePanWaypoints || this.cuePanWaypoints.length < 2 || !this.cameraCue) return;
    const elapsed = Math.max(0, audioTime - (this.cuePanStartT ?? audioTime));
    const t = Math.min(0.999, this.cuePanDurationS > 0 ? elapsed / this.cuePanDurationS : 0);
    const segs = this.cuePanWaypoints.length - 1;
    const segF = t * segs;
    const segI = Math.min(segs - 1, Math.floor(segF));
    const segT = segF - segI;
    const a = this.cuePanWaypoints[segI];
    const b = this.cuePanWaypoints[segI + 1];
    // Ease-in-out cubic — softens the arrival into each cell.
    const e = segT * segT * (3 - 2 * segT);
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e;
    this.cameraCue.x = x;
    this.cameraCue.y = y;
    this.cameraCue.lookX = x;
    this.cameraCue.lookY = y;
  }

  getCameraCue() {
    return this.cameraCue;
  }

  // Per-event scatter: each kick/snare picks 1-2 active cells at random and
  // pokes their pulse. With multiple cells, this is what stops the field from
  // pulsing as a single blob and gives the layout per-panel reactivity.
  _pulseCellsOnEvents(events, audioTime = 0) {
    if (!events?.length) return;
    const particles = this.cellDirector?.particles;
    if (!particles?.pokeCellPulse) return;
    const active = particles.activeCellIndices();
    if (!active.length) return;
    const testimony = this._lastForces?.visualMode === "testimony";
    const inReadWindow = (this._lastForces?.readabilityHold || 0) > 0.45;
    for (const e of events) {
      if (e.type === "kick" && e.strength > 0.22) {
        if (testimony && e.strength < 0.74) continue;
        if (audioTime - this.lastPulseAt < 0.18) continue;
        this.lastPulseAt = audioTime;
        const count = !testimony && !inReadWindow && e.strength > 0.82 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const cid = active[(Math.random() * active.length) | 0];
          particles.pokeCellPulse(cid, (testimony ? 0.10 : inReadWindow ? 0.14 : 0.24) + e.strength * (testimony ? 0.12 : 0.26));
        }
        // EXPLODE — really heavy kicks scatter one picked cell hard via the
        // swarm modifier. Particles fly past the cell bounds, then snap back.
        if (!inReadWindow && e.strength > 0.88) {
          const cid = active[(Math.random() * active.length) | 0];
          particles.setCellModifier(cid, "swarm", 0.95);
          this._emitDebugEvent("particleMoment", "kick_swarm", audioTime);
        }
      } else if (e.type === "lyric" && e.strength > 0.20) {
        if (audioTime - this.lastPulseAt < (testimony ? 0.55 : 0.26)) continue;
        this.lastPulseAt = audioTime;
        const cid = active[(Math.random() * active.length) | 0];
        particles.pokeCellPulse(cid, (testimony ? 0.12 : 0.18) + e.strength * (testimony ? 0.16 : 0.20));
      } else if (e.type === "snare" && e.strength > 0.20) {
        if (testimony && e.strength < 0.82) continue;
        if (audioTime - this.lastPulseAt < 0.20) continue;
        this.lastPulseAt = audioTime;
        const cid = active[(Math.random() * active.length) | 0];
        particles.pokeCellPulse(cid, (inReadWindow ? 0.12 : 0.20) + e.strength * 0.22);
      } else if (!inReadWindow && e.type === "collapse" && e.strength > 0.4 && audioTime - this.lastMomentAt > 0.75) {
        // Collapse fires a WAVE — cells pulse in sequence, not all at once.
        // 80ms per cell, randomised cid order so it cascades unpredictably.
        const order = active.slice().sort(() => Math.random() - 0.5);
        this.activeWave = {
          startT: audioTime,
          strength: 0.42 + e.strength * 0.20,
          order,
          spacing: 0.08,
          fired: new Set()
        };
        // VORTEX — collapse also spins every cell briefly. Big drama moment.
        const cid = active[(Math.random() * active.length) | 0];
        particles.setCellModifier(cid, "vortex", 0.68);
        this.lastMomentAt = audioTime;
        this.lastMomentType = "collapse_wave";
        this._emitDebugEvent("particleMoment", "collapse_wave", audioTime);
      }
    }
  }

  _emitDebugEvent(type, name, audioTime) {
    if (typeof window !== "undefined" && typeof window.foundFootageDebugEvent === "function") {
      window.foundFootageDebugEvent({ type, name, time: audioTime });
    }
  }

  _stepActiveWave(audioTime) {
    if (!this.activeWave) return;
    const particles = this.cellDirector?.particles;
    if (!particles?.pokeCellPulse) { this.activeWave = null; return; }
    const w = this.activeWave;
    for (let i = 0; i < w.order.length; i++) {
      if (w.fired.has(i)) continue;
      const fireAt = w.startT + i * w.spacing;
      if (audioTime >= fireAt) {
        particles.pokeCellPulse(w.order[i], w.strength);
        w.fired.add(i);
      }
    }
    // Clear once the last cell has fired (with a small grace window for decay).
    if (audioTime - w.startT > w.order.length * w.spacing + 0.4) {
      this.activeWave = null;
    }
  }

  _nextStage(layoutId) {
    const count = layoutCellCount(layoutId);
    // Stage offset is a SMALL perturbation away from center — was previously
    // ±2.5..4.1 which pushed entire layouts off-screen. Most cues stay near
    // center, occasionally drift slightly so the camera composition varies.
    const path = [
      { x: 0.0,  y: 0.0  },
      { x: -0.45, y: 0.20 },
      { x: 0.50, y: -0.15 },
      { x: 0.0,  y: 0.30 },
      { x: -0.30, y: -0.25 },
      { x: 0.35, y: 0.10 }
    ];
    const point = path[this.stageCursor % path.length];
    this.stageCursor++;
    const scale = count === 1 ? 1.05 : count <= 3 ? 0.95 : count <= 6 ? 0.88 : 0.78;
    return { x: point.x, y: point.y, scale };
  }

  _cameraForLayout(layoutId, stage) {
    // zOffset is RELATIVE to the viewport-safe Z. Negative = punch in, positive
    // = step back. Capped tight so we never pull so far that the cloud becomes
    // unreadable. safeZ already fits the 6-unit frame, so we mostly punch in.
    const count = layoutCellCount(layoutId);
    let zOffset = -1.4;
    if (count === 2) zOffset = -0.9;
    else if (count <= 4) zOffset = -0.5;
    else if (count <= 6) zOffset = -0.1;
    else zOffset = 0.3;
    if (layoutId === "filmstrip_h") zOffset = -0.5;
    return {
      active: true,
      x: stage.x,
      y: stage.y,
      zOffset,
      lookX: stage.x,
      lookY: stage.y,
      fov: count > 6 ? 52 : count > 3 ? 49 : 46
    };
  }

  _beatIndex(audioTime) {
    const beats = this._beats();
    if (beats.length >= 2) {
      let lo = 0;
      let hi = beats.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (beats[mid] <= audioTime) lo = mid;
        else hi = mid - 1;
      }
      return Math.max(0, lo);
    }
    const tempo = this.audioBrain?.tempo || 120;
    return Math.max(0, Math.floor(audioTime / Math.max(0.05, 60 / tempo)));
  }

  _beats() {
    if (Array.isArray(this.audioBrain?.beats) && this.audioBrain.beats.length) {
      return this.audioBrain.beats;
    }
    const kickTimes = (this.audioBrain?.events || [])
      .filter((e) => e.type === "kick")
      .map((e) => e.time)
      .sort((a, b) => a - b);
    return kickTimes;
  }
}
