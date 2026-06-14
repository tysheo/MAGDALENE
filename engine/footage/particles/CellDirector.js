import { getLayout, layoutCellCount, LAYOUTS } from "./Layouts.js";
import { MAX_CELLS } from "./PersistentParticleField.js";

const MOD_ALIASES = {
  stutter: "stutter",
  stutter_chop: "stutter",
  swarm: "swarm",
  swarm_dispersal: "swarm",
  implode: "implode",
  implode_explode: "implode",
  tileflip: "tileFlip",
  tile_flip: "tileFlip",
  sub_clock_split: "clockSplit"
};

export { LAYOUTS, layoutCellCount };

export class CellDirector {
  constructor(particles, imageLoader) {
    this.particles = particles;
    this.loader = imageLoader;
    this.activeLayout = "solo";
    this.cells = Array.from({ length: MAX_CELLS }, () => ({
      image: null,
      data: null,
      role: "full",
      active: false
    }));
    this.activeCount = 1;
    this.cueSerial = 0;
    this.pending = null;
    this.lastStutterAt = 0;
    this.stutterCursor = 0;
    this.viewportFrame = { scale: 0.78 };
    this.stageTransform = { x: 0, y: 0, scale: 1 };
    this.activeBaseRects = getLayout("solo");
    this.activeFitToViewport = true;
  }

  async cueLayout(layoutId, images, opts = {}) {
    const baseRects = getLayout(layoutId);
    const fitToViewport = opts.fitToViewport !== false;
    if (opts.stage) {
      this.stageTransform = {
        x: opts.stage.x ?? this.stageTransform.x,
        y: opts.stage.y ?? this.stageTransform.y,
        scale: opts.stage.scale ?? this.stageTransform.scale
      };
    }
    const rects = baseRects.map((rect) => this._fitRect(rect, fitToViewport));
    const normalized = this._expandImages(images, rects.length);
    if (!normalized.length) return null;
    const serial = ++this.cueSerial;
    const datas = await Promise.all(normalized.map((image) => this.loader.load(image, opts.macros)));
    if (serial !== this.cueSerial && !opts.allowStale) return null;

    const previousPartitionMode = this.particles.partitionMode;
    const fullDensity = (opts.fullDensity ?? layoutId === "solo") && rects.length === 1;
    this.particles.beginLayout(rects, { fullDensity });
    const partitionChanged = previousPartitionMode !== this.particles.partitionMode;

    // Pick an entrance MOMENT for newly-activating cells. Default = SPLIT
    // (start at center, animate to layout target). Occasionally SLAM (start
    // off-screen) or CONVERGE (all from a single point). Manual cues from the
    // user (clicking a thumbnail) stay calm — moments only fire on choreography
    // or explicit opts.moment.
    const moment = opts.moment ?? this._pickEntryMoment(opts.source, rects.length);

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const role = rect.role || "full";
      const image = normalized[i];
      const data = datas[i];
      const cell = this.cells[i];
      const newlyActivating = !cell.active || !cell.data;

      if (newlyActivating && moment !== "split") {
        // Override the spawn position so smoothing animates from `spawnRect`
        // to `rect`. SPLIT uses the default parked center, so we only spawn
        // explicitly for SLAM/CONVERGE/etc.
        const spawnRect = this._spawnRectFor(moment, i, rect, rects.length);
        if (spawnRect) this.particles.setCellSpawn(i, spawnRect);
      }

      this.particles._writeCellTransform(i, rect, rect.opacity ?? 1, rect.z ?? 0);
      this.particles.setCellClockMultiplier(i, rect.clockMul || 1);

      if (newlyActivating) {
        this.particles.installCellInitial(i, data, role);
      } else if (opts.force || partitionChanged || cell.image?.id !== image?.id || cell.role !== role) {
        this.particles.cueCellTarget(i, data, cell.data, role);
      }

      cell.image = image;
      cell.data = data;
      cell.role = role;
      cell.active = true;
    }

    for (let i = rects.length; i < MAX_CELLS; i++) {
      this.cells[i].active = false;
      this.particles.hideCell(i);
    }

    this.activeLayout = layoutId;
    this.activeCount = rects.length;
    this.activeBaseRects = baseRects;
    this.activeFitToViewport = fitToViewport;
    this.applyModifiers(opts.modifiers || [], opts.forces || null);
    return { layoutId, images: normalized, datas };
  }

  setViewportFrame(width, height) {
    // Scale cells to fit the actual viewport. Use the SHORTER axis so narrow
    // browser windows shrink cells too instead of letting them overflow.
    // Reference dims: 1600x900 → scale = 0.82 (max). At 800x500 → ~0.55.
    const shortAxis = Math.min(width, height * 1.6); // 1.6 = our preferred aspect target
    const stageScale = Math.max(0.42, Math.min(0.82, (shortAxis / 1600) * 0.82));
    if (Math.abs(stageScale - this.viewportFrame.scale) < 0.005) return;
    this.viewportFrame = { scale: stageScale };
    this._refreshActiveTransforms();
  }

  _refreshActiveTransforms() {
    if (!this.activeBaseRects?.length || !this.activeFitToViewport) return;
    for (let i = 0; i < this.activeBaseRects.length; i++) {
      const rect = this._fitRect(this.activeBaseRects[i], true);
      this.particles._writeCellTransform(i, rect, rect.opacity ?? 1, rect.z ?? 0);
    }
  }

  _fitRect(rect, fitToViewport) {
    if (!fitToViewport) return { ...rect };
    const s = this.viewportFrame.scale * (this.stageTransform.scale || 1);
    return {
      ...rect,
      cx: (rect.cx ?? 0) * s + (this.stageTransform.x || 0),
      cy: (rect.cy ?? 0) * s + (this.stageTransform.y || 0),
      w: (rect.w ?? 6) * s,
      h: (rect.h ?? 6) * s
    };
  }

  cueLayoutFireAndForget(layoutId, images, opts = {}) {
    if (this.pending) return false;
    this.pending = this.cueLayout(layoutId, images, opts)
      .catch((err) => console.warn("cueLayout failed", err))
      .finally(() => {
        this.pending = null;
      });
    return true;
  }

  applyModifiers(modifiers, forces = null, opts = {}) {
    const names = Array.isArray(modifiers) ? modifiers : [modifiers];
    const mapped = names.map((name) => MOD_ALIASES[name]).filter(Boolean);
    if (!mapped.length && !forces) return;

    const active = Math.max(1, this.activeCount);
    if (mapped.includes("clockSplit")) {
      for (let i = 0; i < active; i++) {
        this.particles.setCellClockMultiplier(i, i % 2 === 0 ? 1.85 : 0.85);
      }
    }

    const events = forces?.events || [];
    const controls = forces?.controls || {};
    const now = forces?.audioTime ?? 0;
    const force = !!opts.force;
    const readDamp = 1 - Math.max(0, Math.min(1, forces?.readabilityHold ?? 0)) * 0.75;
    // Continuous-valued intensity multiplier passed by Choreography during
    // build sections — ramps modifier strength from ~0 to 1 across the bars
    // so the field crescendos instead of stepping on. Falls back to 1 when
    // absent so other sections behave unchanged.
    const intensity = Math.max(0, Math.min(1.4, forces?.modIntensity ?? 1));
    const strongCollapse = events.some((e) => e.type === "collapse" && e.strength > 0.35);
    const strongKick = events.some((e) => e.type === "kick" && e.strength > 0.45);
    const strongSnare = events.some((e) => e.type === "snare" && e.strength > 0.35);

    if (mapped.includes("swarm") && (force || strongCollapse)) {
      for (let i = 0; i < active; i++) this.particles.setCellModifier(i, "swarm", 0.65 * intensity * readDamp);
    }
    if (mapped.includes("implode") && (force || controls.collapse > 0.55 || strongKick)) {
      for (let i = 0; i < active; i++) this.particles.setCellModifier(i, "implode", 0.65 * intensity * readDamp);
    }
    if (mapped.includes("tileFlip")) {
      for (let i = 0; i < active; i++) this.particles.setCellModifier(i, "tileFlip", 0.35 * intensity * readDamp);
    }
    // Stutter is discrete; we still gate it by intensity threshold so build
    // sections don't fire stutter at all until the ramp passes ~0.25.
    if (mapped.includes("stutter") && readDamp > 0.45 && intensity > 0.35 && (force || strongSnare || controls.hats > 0.68) && now - this.lastStutterAt > 0.18) {
      const cellIdx = this.stutterCursor % active;
      this.particles.setCellModifier(cellIdx, "stutter", 0.72 * intensity);
      this.stutterCursor++;
      this.lastStutterAt = now;
    }
  }

  _pickEntryMoment(source, cellCount) {
    // Manual user clicks stay calm — no dramatic entrances when clicking a
    // thumbnail. Only choreography-driven cues roll the moment dice.
    if (source !== "choreography") return "split";
    if (cellCount === 1) {
      // Even solo cues occasionally do something dramatic.
      const roll = Math.random();
      if (roll < 0.55) return "split";
      if (roll < 0.78) return "assemble";
      return "converge";
    }
    const roll = Math.random();
    if (roll < 0.30) return "split";
    if (roll < 0.55) return "slam";
    if (roll < 0.80) return "converge";
    return "assemble";
  }

  _spawnRectFor(moment, cellIdx, finalRect, totalCells) {
    if (moment === "slam") {
      // Cells fly in from a randomly chosen screen edge. Same direction for
      // all cells in a single cue so the layout reads as a coordinated entry.
      if (this._slamDir == null || this._slamDirAt !== this.cueSerial) {
        this._slamDir = ["left", "right", "top", "bottom"][(Math.random() * 4) | 0];
        this._slamDirAt = this.cueSerial;
      }
      const off = 8;
      const base = { ...finalRect };
      if (this._slamDir === "left") base.cx = -off;
      else if (this._slamDir === "right") base.cx = off;
      else if (this._slamDir === "top") base.cy = off;
      else base.cy = -off;
      return base;
    }
    if (moment === "converge") {
      // All cells emerge from a single tiny point at the layout's centroid.
      return { ...finalRect, cx: 0, cy: 0, w: 0.4, h: 0.4 };
    }
    if (moment === "assemble") {
      // Particles start spread VERY wide and contract into the final layout —
      // reads as a flock converging from all directions into formation.
      return { ...finalRect, cx: 0, cy: 0, w: 10.0, h: 10.0 };
    }
    return null;
  }

  _expandImages(images, needed) {
    const source = Array.isArray(images) ? images.filter(Boolean) : images ? [images] : [];
    if (!source.length || needed <= 0) return [];
    const out = [];
    for (let i = 0; i < needed; i++) out.push(source[i % source.length]);
    return out;
  }
}
