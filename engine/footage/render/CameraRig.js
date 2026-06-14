import * as THREE from "three";

// Canonical world frame for cell layouts (matches CANONICAL_FRAME in PersistentParticleField).
const FRAME_RADIUS = 3.0;
// Want the frame to fit inside the viewport with this much padding around it.
const SAFE_FIT_PADDING = 0.88;

export class CameraRig {
  constructor(canvas) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.05, 120);
    this.safeZ = this._computeSafeZ();
    this.camera.position.set(0, 0, this.safeZ);
    this.basePos = new THREE.Vector3(0, 0, this.safeZ);
    this.targetPos = new THREE.Vector3(0, 0, this.safeZ);
    this.lookAt = new THREE.Vector3(0, 0, 0);
    this.lastSection = null;
    this.modeStartT = 0;
    this.mode = "parallax";
    this.modes = ["parallax", "dolly_in", "punch", "orbit", "freeze", "drift"];
    this.shake = new THREE.Vector3();
    this.shakeDecay = 0.9;
    this.dollyPunch = 0;
    this.lastDollyKickT = -Infinity;
  }

  // Compute the camera Z where the canonical 6-unit frame fits with padding.
  // For narrow viewports we have to back further away so width doesn't crop.
  _computeSafeZ() {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const halfFov = THREE.MathUtils.degToRad(50) * 0.5;
    const zForHeight = FRAME_RADIUS / Math.tan(halfFov);
    // For width, the camera sees aspect * tan(halfFov) units horizontally per unit Z.
    const zForWidth = FRAME_RADIUS / (Math.tan(halfFov) * Math.max(0.4, aspect));
    return Math.max(zForHeight, zForWidth) / SAFE_FIT_PADDING;
  }

  pickMode(section, t) {
    if (!section) return "parallax";
    const label = section.label || "";
    if (label === "intro") return "parallax";
    if (label === "verse") return "dolly_in";
    if (label === "build" || label === "pre_drop") return "orbit";
    if (label === "drop") return "punch";
    if (label === "breakdown") return "drift";
    return this.modes[Math.floor(t * 0.08) % this.modes.length];
  }

  update(forces, t) {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.safeZ = this._computeSafeZ();
    }
    const section = forces.section;
    if (section && section.label !== this.lastSection) {
      this.lastSection = section.label;
      this.modeStartT = t;
      this.mode = this.pickMode(section, t);
    }
    const lt = t - this.modeStartT;
    const c = forces.controls;
    const intensity = forces.macros.intensity;

    let px = 0;
    let py = 0;
    let pz = 6;
    let lx = 0;
    let ly = 0;
    let lz = 0;

    // Each mode picks an offset (delta from safeZ) for cinematic motion. The
    // base distance always respects safeZ so cells never get cropped on small
    // viewports.
    const baseZ = this.safeZ;
    switch (this.mode) {
      case "parallax": {
        const sx = Math.sin(t * 0.18);
        const sy = Math.cos(t * 0.14);
        const ease = (s, p) => Math.sign(s) * Math.pow(Math.abs(s), p);
        px = ease(sx, 2.2) * 1.4 * forces.macros.spatialTension;
        py = ease(sy, 2.2) * 0.75 * forces.macros.spatialTension;
        pz = baseZ + 0.5 - Math.sin(t * 0.07) * 0.5;
        break;
      }
      case "dolly_in": {
        const p = Math.min(1, lt / 8);
        pz = baseZ + 1.0 - p * 2.0 - c.pressure * 0.3;
        px = Math.sin(t * 0.05) * 0.3;
        py = Math.cos(t * 0.07) * 0.18 + c.humanPresence * 0.1;
        break;
      }
      case "punch": {
        pz = baseZ - 1.0 - c.collapse * 0.8 - c.pressure * 0.4 + Math.sin(t * 3.7) * 0.05;
        px = Math.sin(t * 1.2) * 0.4 + (Math.random() - 0.5) * c.violence * 0.4;
        py = Math.cos(t * 0.9) * 0.3 + (Math.random() - 0.5) * c.violence * 0.3;
        break;
      }
      case "orbit": {
        const ang = t * 0.34 + lt * 0.05;
        const rad = Math.max(0.4, (baseZ - 2.5)) * 0.4;
        px = Math.sin(ang) * rad;
        py = Math.cos(ang * 0.5) * 0.4;
        pz = baseZ + 0.2 + Math.cos(ang) * 0.7 - c.pressure * 0.25;
        break;
      }
      case "drift": {
        pz = baseZ + 0.4 + Math.sin(t * 0.12) * 0.5;
        px = Math.sin(t * 0.09) * 0.5;
        py = Math.cos(t * 0.11) * 0.3 + 0.1;
        break;
      }
      case "freeze": {
        pz = baseZ - 0.5;
        break;
      }
    }
    // Z range guards. Floor: no further-in than safeZ - 1.2 so punch mode can't
    // crop tiny viewports. Ceiling: never further OUT than safeZ + 1.8 so the
    // cloud stays readable on any layout.
    pz = Math.max(baseZ - 1.2, Math.min(baseZ + 1.8, pz));

    // SETTLE PHASE — right after a cue, hold a flat head-on view. Then ramp
    // back into the 3D motion mode. exploreFactor: 0 = locked flat, 1 = full
    // motion. Damps parallax/dolly XY drift AND pulls pz toward safeZ so the
    // image is readable before we start exploring it.
    const explore = forces.exploreFactor ?? 1;
    px *= explore;
    py *= explore;
    pz = pz * explore + baseZ * (1 - explore);

    const choreo = forces.choreoCamera;
    const centroid = forces.cellCentroid;
    if (choreo?.active) {
      const followX = centroid ? centroid.x : choreo.x;
      const followY = centroid ? centroid.y : choreo.y;
      const blend = 0.55;
      const targetX = choreo.x * (1 - blend) + followX * blend;
      const targetY = choreo.y * (1 - blend) + followY * blend;
      const driftX = Math.sin(t * 0.23) * 0.22 * forces.macros.spatialTension;
      const driftY = Math.cos(t * 0.19) * 0.14 * forces.macros.spatialTension;
      px = targetX + driftX;
      py = targetY + driftY;
      // Choreo passes a relative offset (was hardcoded 5.7-10.1, now an offset
      // from safeZ so it scales to the viewport). Old layouts that pass big z
      // values keep working — we just clamp to safeZ as a minimum.
      pz = Math.max(baseZ - 1.0, (choreo.zOffset != null ? baseZ + choreo.zOffset : choreo.z) - c.pressure * 0.25 + c.collapse * 0.18);
      lx = followX;
      ly = followY;
      lz = 0;
    } else if (centroid) {
      lx = centroid.x * 0.5;
      ly = centroid.y * 0.5;
    }

    // DOLLY PUNCH — big kicks (> 0.78) make the camera lurch toward the subject
    // then spring back. Capped at ~10% of safeZ so it never crops the layout.
    if (forces.events?.length) {
      for (const e of forces.events) {
        if (e.type === "kick" && e.strength > 0.78 && (t - this.lastDollyKickT) > 0.18) {
          this.dollyPunch = Math.max(this.dollyPunch, e.strength * 0.8);
          this.lastDollyKickT = t;
        }
      }
    }
    this.dollyPunch *= 0.86;
    if (this.dollyPunch < 0.003) this.dollyPunch = 0;
    pz -= this.dollyPunch * Math.min(0.9, baseZ * 0.12);

    if (forces.events?.length) {
      for (const e of forces.events) {
        const k = e.strength * (e.type === "kick" ? 0.06 : e.type === "snare" ? 0.07 : 0.04);
        this.shake.x += (Math.random() - 0.5) * k * intensity;
        this.shake.y += (Math.random() - 0.5) * k * intensity;
        this.shake.z += (Math.random() - 0.5) * k * intensity * 0.5;
      }
    }
    this.shake.multiplyScalar(0.82);

    px += this.shake.x;
    py += this.shake.y;
    pz += this.shake.z;

    this.targetPos.set(px, py, pz);
    this.camera.position.lerp(this.targetPos, choreo?.active ? 0.08 : 0.12);

    if (!choreo?.active && !centroid) {
      lx = Math.sin(t * 0.2) * 0.2 * forces.macros.reactivity;
      ly = Math.cos(t * 0.17) * 0.12 * forces.macros.reactivity - 0.05;
    }
    // Slow the lookAt lerp so the camera SETTLES on the centroid instead of
    // tracking every micro-drift. Big jumps soften into a chase, not a snap.
    this.lookAt.lerp(new THREE.Vector3(lx, ly, lz), choreo?.active ? 0.06 : 0.07);
    this.camera.lookAt(this.lookAt);

    const targetFov = choreo?.active
      ? choreo.fov + c.temporalInstability * 1.2 - c.collapse * 1.0
      : 50 - c.pressure * 2 - c.collapse * 3 + c.temporalInstability * 1.5;
    this.camera.fov += (targetFov - this.camera.fov) * 0.12;
    this.camera.updateProjectionMatrix();
  }
}
