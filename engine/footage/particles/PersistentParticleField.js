import * as THREE from "three";

// Must match MAX_LAYERS in worker/guernica_worker.py
const MAX_LAYERS = 16;
export const MAX_CELLS = 16;
const CANONICAL_FRAME = 6.0;

const CELL_ACCESSORS = `
  vec4 getCellRect(float cid) {
    if (cid < 0.5) return uCellRect[0];
    if (cid < 1.5) return uCellRect[1];
    if (cid < 2.5) return uCellRect[2];
    if (cid < 3.5) return uCellRect[3];
    if (cid < 4.5) return uCellRect[4];
    if (cid < 5.5) return uCellRect[5];
    if (cid < 6.5) return uCellRect[6];
    if (cid < 7.5) return uCellRect[7];
    if (cid < 8.5) return uCellRect[8];
    if (cid < 9.5) return uCellRect[9];
    if (cid < 10.5) return uCellRect[10];
    if (cid < 11.5) return uCellRect[11];
    if (cid < 12.5) return uCellRect[12];
    if (cid < 13.5) return uCellRect[13];
    if (cid < 14.5) return uCellRect[14];
    return uCellRect[15];
  }

  vec4 getCellRot(float cid) {
    if (cid < 0.5) return uCellRot[0];
    if (cid < 1.5) return uCellRot[1];
    if (cid < 2.5) return uCellRot[2];
    if (cid < 3.5) return uCellRot[3];
    if (cid < 4.5) return uCellRot[4];
    if (cid < 5.5) return uCellRot[5];
    if (cid < 6.5) return uCellRot[6];
    if (cid < 7.5) return uCellRot[7];
    if (cid < 8.5) return uCellRot[8];
    if (cid < 9.5) return uCellRot[9];
    if (cid < 10.5) return uCellRot[10];
    if (cid < 11.5) return uCellRot[11];
    if (cid < 12.5) return uCellRot[12];
    if (cid < 13.5) return uCellRot[13];
    if (cid < 14.5) return uCellRot[14];
    return uCellRot[15];
  }

  float getCellMorph(float cid) {
    if (cid < 0.5) return uCellMorph[0];
    if (cid < 1.5) return uCellMorph[1];
    if (cid < 2.5) return uCellMorph[2];
    if (cid < 3.5) return uCellMorph[3];
    if (cid < 4.5) return uCellMorph[4];
    if (cid < 5.5) return uCellMorph[5];
    if (cid < 6.5) return uCellMorph[6];
    if (cid < 7.5) return uCellMorph[7];
    if (cid < 8.5) return uCellMorph[8];
    if (cid < 9.5) return uCellMorph[9];
    if (cid < 10.5) return uCellMorph[10];
    if (cid < 11.5) return uCellMorph[11];
    if (cid < 12.5) return uCellMorph[12];
    if (cid < 13.5) return uCellMorph[13];
    if (cid < 14.5) return uCellMorph[14];
    return uCellMorph[15];
  }

  vec4 getCellMods(float cid) {
    if (cid < 0.5) return uCellMods[0];
    if (cid < 1.5) return uCellMods[1];
    if (cid < 2.5) return uCellMods[2];
    if (cid < 3.5) return uCellMods[3];
    if (cid < 4.5) return uCellMods[4];
    if (cid < 5.5) return uCellMods[5];
    if (cid < 6.5) return uCellMods[6];
    if (cid < 7.5) return uCellMods[7];
    if (cid < 8.5) return uCellMods[8];
    if (cid < 9.5) return uCellMods[9];
    if (cid < 10.5) return uCellMods[10];
    if (cid < 11.5) return uCellMods[11];
    if (cid < 12.5) return uCellMods[12];
    if (cid < 13.5) return uCellMods[13];
    if (cid < 14.5) return uCellMods[14];
    return uCellMods[15];
  }

  vec4 getCellTrail(float cid) {
    if (cid < 0.5) return uCellTrail[0];
    if (cid < 1.5) return uCellTrail[1];
    if (cid < 2.5) return uCellTrail[2];
    if (cid < 3.5) return uCellTrail[3];
    if (cid < 4.5) return uCellTrail[4];
    if (cid < 5.5) return uCellTrail[5];
    if (cid < 6.5) return uCellTrail[6];
    if (cid < 7.5) return uCellTrail[7];
    if (cid < 8.5) return uCellTrail[8];
    if (cid < 9.5) return uCellTrail[9];
    if (cid < 10.5) return uCellTrail[10];
    if (cid < 11.5) return uCellTrail[11];
    if (cid < 12.5) return uCellTrail[12];
    if (cid < 13.5) return uCellTrail[13];
    if (cid < 14.5) return uCellTrail[14];
    return uCellTrail[15];
  }

  float getCellShatter(float cid) {
    if (cid < 0.5) return uCellShatter[0];
    if (cid < 1.5) return uCellShatter[1];
    if (cid < 2.5) return uCellShatter[2];
    if (cid < 3.5) return uCellShatter[3];
    if (cid < 4.5) return uCellShatter[4];
    if (cid < 5.5) return uCellShatter[5];
    if (cid < 6.5) return uCellShatter[6];
    if (cid < 7.5) return uCellShatter[7];
    if (cid < 8.5) return uCellShatter[8];
    if (cid < 9.5) return uCellShatter[9];
    if (cid < 10.5) return uCellShatter[10];
    if (cid < 11.5) return uCellShatter[11];
    if (cid < 12.5) return uCellShatter[12];
    if (cid < 13.5) return uCellShatter[13];
    if (cid < 14.5) return uCellShatter[14];
    return uCellShatter[15];
  }
`;

const VS = `
  attribute vec3 aOriginA;
  attribute vec3 aOriginB;
  attribute vec3 aRandom;
  attribute vec3 aColorA;
  attribute vec3 aColorB;
  attribute vec2 aOriginAUv;
  attribute float aSize;
  attribute float aFlight;
  attribute float aCellId;

  uniform float uMorph;
  uniform float uTime;
  uniform float uViolence;
  uniform float uPressure;
  uniform float uCollapse;
  uniform float uTemporal;
  uniform float uGrowth;
  uniform float uHumanPresence;
  uniform float uIntensity;
  uniform float uSpatialTension;
  uniform float uKickPulse;
  uniform float uSnarePulse;
  uniform float uClarity;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uExplore;  // 0 = held flat after cue, 1 = full 3D motion
  uniform vec2 uCameraAngle;
  uniform vec3 uCameraPos;
  uniform vec4 uCellRect[16];
  uniform vec4 uCellRot[16];
  uniform float uCellMorph[16];
  uniform vec4 uCellMods[16];
  uniform vec4 uCellTrail[16];   // xy = rect velocity, z = settle phase, w = pulse
  uniform float uCellShatter[16]; // per-cell SHATTER magnitude (decays)
  uniform vec3 uWind;             // xy = direction, z = strength (global)

  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;
  varying float vCellOpacity;

  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

${CELL_ACCESSORS}

  void main() {
    float cid = aCellId;
    vec4 rect = getCellRect(cid);
    vec4 rot = getCellRot(cid);
    vec4 mods = getCellMods(cid);
    vec4 trail = getCellTrail(cid);
    float cellMorph = getCellMorph(cid);
    float opacity = rot.w;

    // Bass breathing - cell rect inflates/deflates with bass amplitude.
    // Gated by uExplore so the cell stays at its target size during the
    // ANCHOR phase right after a cue (otherwise the bounce reads as a dark
    // circle at center while the image should be settling for legibility).
    // Magnitudes reduced from 0.06/0.08 — old values pushed particles far
    // enough outward that the center went dark on each pulse.
    float bassPulse = (uBass * 0.025 + trail.w * 0.03) * uExplore;
    rect.zw *= 1.0 + bassPulse;

    // IDLE BOBBING - each cell drifts gently in XY, phase-offset by cid.
    // Always-on baseline, intensified by mid energy. Damped during SETTLE.
    float bobAmp = (0.06 + uMid * 0.10) * uExplore;
    rect.xy += vec2(
      sin(uTime * 0.45 + cid * 1.7),
      cos(uTime * 0.38 + cid * 2.3)
    ) * bobAmp * opacity;

    // Per-particle morph stagger: tighter spread so the morph resolves
    // synchronously instead of trailing leftover particles into the new image.
    float stutterGate = step(0.5, fract(uTime * 12.0 * max(0.1, mods.x)));
    float morphBase = mix(cellMorph, stutterGate, step(0.001, mods.x));
    float morphPhase = clamp(morphBase + (aFlight - 0.5) * 0.22, 0.0, 1.0);
    float curve = smoothstep(0.0, 1.0, morphPhase);
    vec3 origin = mix(aOriginA, aOriginB, curve);

    // Converge through the cell center, then bloom into the target image.
    float implodeEnv = smoothstep(0.25, 0.52, cellMorph) * (1.0 - smoothstep(0.58, 0.90, cellMorph));
    origin = mix(origin, vec3(0.0, 0.0, origin.z * 0.25), implodeEnv * mods.z);

    // VORTEX — rotate particles around the cell center on the XY plane. Outer
    // particles spin faster than inner ones so the field swirls like a galaxy.
    // Driven by mods.w (set briefly on collapse events) — decays to nothing.
    if (mods.w > 0.001) {
      vec2 local = origin.xy;
      float radius = max(0.001, length(local));
      float theta = atan(local.y, local.x);
      float life = smoothstep(0.02, 0.22, mods.w);
      float centerPull = 1.0 - smoothstep(0.08, 0.34, radius);
      float arm = sin(theta * 3.0 - radius * 2.8 + uTime * (1.15 + mods.w * 1.8) + aRandom.y * 2.4);
      float armMask = smoothstep(-0.35, 0.85, arm);
      float lag = mix(0.42, 1.25, aFlight) * (0.78 + aRandom.x * 0.46);
      float innerSpeed = 1.0 / (0.45 + radius * 0.55);
      float outerDrag = smoothstep(0.65, 2.9, radius);
      float spinAngle = mods.w * life * lag * (1.15 + innerSpeed * 2.2 + armMask * 0.75);
      float cs = cos(spinAngle);
      float ss = sin(spinAngle);
      vec2 spun = vec2(local.x * cs - local.y * ss, local.x * ss + local.y * cs);
      vec2 tangent = normalize(vec2(-spun.y, spun.x) + vec2(0.001));
      float suction = mods.w * life * (0.035 + armMask * 0.10) * (1.0 - centerPull) * (1.0 - outerDrag * 0.35);
      float trailing = mods.w * life * armMask * outerDrag * (0.04 + aRandom.z * 0.08);
      origin.xy = spun * (1.0 - suction) - tangent * trailing;
      origin.z += (sin(theta * 2.0 + radius * 3.7 - uTime * 1.6 + aRandom.z * 4.0) * armMask) * radius * 0.075 * mods.w * life;
      origin.z += centerPull * mods.w * life * 0.10;
    }

    // FLIGHT ARC - subtle curved trajectory so particles look like they are
    // moving from A to B, not exploding. Magnitude capped so it never dominates
    // the image. Heavier-traveling particles get a bit more arc, but bounded.
    vec3 travel = aOriginB - aOriginA;
    float dist = length(travel);
    float distCapped = min(dist, 2.0);
    vec3 perp = normalize(cross(travel + vec3(0.001), vec3(0.0, 0.0, 1.0)) + aRandom * 0.25);
    float flightEnv = sin(curve * 3.14159);
    float flightAmt = flightEnv * distCapped * (0.08 + uViolence * 0.12 + uCollapse * 0.08);
    origin += perp * flightAmt;

    // Tiny z bow - depth motion, not lift-off.
    origin.z += flightEnv * aRandom.z * distCapped * 0.08;

    // Chaos noise on top - gentle, only adds character during the morph middle.
    vec3 chaos = aRandom * sin(uTime * 2.1 + aFlight * 12.0);
    float arcShape = smoothstep(0.0, 0.35, curve) * (1.0 - smoothstep(0.65, 0.9, curve));
    float arc = arcShape * (0.08 + uViolence * 0.22 + uCollapse * 0.16 + uTemporal * 0.12) * uExplore;
    origin += chaos * arc * (0.2 + uIntensity * 0.3);

    // Shockwave on kick - subtle outward jitter, not an explosion.
    origin += normalize(vec3(aOriginA.xy, 0.5)) * uKickPulse * (0.10 + aFlight * 0.10);

    // Pressure adds a tiny breathing motion outward.
    origin += normalize(vec3(aOriginA.xy + 0.0001, 0.0)) * uPressure * 0.06 * uIntensity;

    // Collapse pulls slightly inward.
    origin = mix(origin, vec3(0.0, 0.0, origin.z * 0.5), uCollapse * 0.18 * uIntensity);

    // Depth modulation.
    origin.z *= mix(0.82, 1.55, uSpatialTension) * (0.82 + uGrowth * 0.22);

    // Snare ripples sideways in image-local space.
    float ripple = sin(origin.y * 12.0 + uTime * 6.0) * uSnarePulse * 0.08;
    origin.x += ripple;

    // Map image-local positions into the assigned cell rect.
    float cellScale = min(rect.z, rect.w) / 6.0;
    vec2 scaled = origin.xy * cellScale;
    // PER-CELL ROTATION DRIFT — each cell tilts on a slow phase + mid-driven
    // wobble. Plus a hit-driven rotation kick from trail.w so pulsed cells
    // visibly twist on the beat. Drift damps during SETTLE; the hit-driven
    // kick stays so beats still punch.
    float midRot = (sin(uTime * 1.7 + cid * 0.43) * uMid * 0.10
                 + sin(uTime * 0.27 + cid * 0.91) * 0.05) * uExplore
                 + trail.w * sin(cid * 4.7) * 0.18;
    float cR = cos(midRot) * rot.x - sin(midRot) * rot.y;
    float sR = cos(midRot) * rot.y + sin(midRot) * rot.x;
    vec2 rotated = vec2(scaled.x * cR - scaled.y * sR, scaled.x * sR + scaled.y * cR);
    origin.xy = rect.xy + rotated;
    origin.z += rot.z;

    // Z-POP — cell pulse punches the whole cell forward toward the camera,
    // then springs back as trail.w decays. Magnitude reduced from 0.55 — old
    // value pushed particles so far forward on heavy hits the image went out
    // of focus / unreadable. 0.25 still reads as a punch but keeps depth sane.
    origin.z += trail.w * 0.14 * uExplore;

    // MOTH CHASE - particles trail behind the cell's velocity. Particles with
    // low aFlight lag harder; high-aFlight particles arrive first. Combined with
    // the rect's own damped follow of its target, this reads as the field
    // "catching up" to the camera/layout instead of snapping with it.
    vec2 lag = trail.xy * mix(0.65, 0.05, aFlight) * 3.2 * uExplore;
    origin.xy -= lag;
    // The slowest particles overshoot slightly to fill out the moth-swarm look.
    float jitterPhase = trail.z + aFlight * 6.28;
    origin.xy += vec2(sin(jitterPhase * 3.1), cos(jitterPhase * 2.7)) * length(trail.xy) * (1.0 - aFlight) * 0.38 * uExplore;

    // Swarm dispersal happens after cell placement so it moves away from the
    // visible panel center. Per-cell pulse (trail.w) adds a smaller scatter so
    // individual cells flinch on the beats that picked them.
    vec2 fromCenter = origin.xy - rect.xy;
    vec2 outward = normalize(fromCenter + vec2(0.0001));
    origin.xy += outward * mods.y * (0.28 + aFlight * 0.22) * uExplore;
    origin.xy += outward * trail.w * (0.08 + aFlight * 0.12) * uExplore;

    // SHATTER — cell breaks into 4 quadrants that fly apart, then re-form
    // as the per-cell shatter decays. Each particle picks its quadrant by
    // which side of the UV centre it sits on.
    float shatter = getCellShatter(cid);
    if (shatter > 0.001) {
      vec2 quad = sign(aOriginAUv - 0.5);
      origin.xy += quad * shatter * (0.34 + aFlight * 0.14) * uExplore;
      origin.z += shatter * 0.10 * uExplore;
    }

    // WIND PUSH — global directional gust. All particles drift in one
    // direction briefly. aFlight stagger so the gust visibly sweeps through.
    origin.xy += uWind.xy * uWind.z * (0.24 + aFlight * 0.42) * uExplore;

    // Camera-driven parallax tilt - applied after layout transform.
    origin.x += uCameraAngle.x * origin.z * 0.28;
    origin.y += uCameraAngle.y * origin.z * 0.19;

    // High shimmer - each particle wobbles around its position with hat energy.
    // Damped during SETTLE so the image is still during the read window.
    float shimmer = uHigh * (0.5 + aFlight) * 0.025 * uExplore;
    origin.x += sin(uTime * 18.0 + aFlight * 31.0 + cid) * shimmer;
    origin.y += cos(uTime * 17.0 + aFlight * 29.0 + cid) * shimmer;

    vec3 col = mix(aColorA, aColorB, curve);
    col *= 0.85 + uClarity * 0.35 + uHumanPresence * 0.2;
    // Per-cell pulse briefly brightens the cell so the kick scatter reads.
    col *= 1.0 + trail.w * 0.35;
    vColor = col;

    vDepth = clamp(origin.z * 0.32 + 0.5, 0.0, 1.0);
    vAlpha = 0.55 + vDepth * 0.45;
    vAlpha *= mix(0.4, 1.2, uClarity);
    vCellOpacity = opacity;

    if (opacity <= 0.001) {
      origin.z -= 100.0;
    }

    vec4 mv = modelViewMatrix * vec4(origin, 1.0);
    float bounce = 1.0 + uKickPulse * 0.55 + uSnarePulse * 0.32 + uHigh * 0.18;
    gl_PointSize = aSize * bounce * (40.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FS = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDepth;
  varying float vCellOpacity;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d);
    if (r2 > 0.25) discard;
    float a = smoothstep(0.25, 0.12, r2);
    vec3 c = vColor * mix(0.82, 1.12, vDepth);
    gl_FragColor = vec4(c, a * vAlpha * vCellOpacity);
  }
`;

export class PersistentParticleField {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.count = opts.count ?? 140000;
    this.maxCells = MAX_CELLS;
    this.cellChunk = Math.max(1, Math.floor(this.count / MAX_CELLS));
    this.partitionMode = null;

    this.uCellRect = new Float32Array(MAX_CELLS * 4);        // smoothed (read by shader)
    this.uCellRectTarget = new Float32Array(MAX_CELLS * 4);  // where rect wants to be
    this.uCellRot = new Float32Array(MAX_CELLS * 4);
    this.uCellRotTarget = new Float32Array(MAX_CELLS * 4);
    this.uCellMorph = new Float32Array(MAX_CELLS);
    this.uCellMods = new Float32Array(MAX_CELLS * 4);
    this.uCellTrail = new Float32Array(MAX_CELLS * 4);       // xy = velocity, z = phase, w = pulse
    this.uCellShatter = new Float32Array(MAX_CELLS);
    this.uWind = new THREE.Vector3(0, 0, 0);
    this.cellClockMul = new Float32Array(MAX_CELLS).fill(1);
    this.cellSeenOnce = new Uint8Array(MAX_CELLS);            // first install skips smoothing
    this.cells = Array.from({ length: MAX_CELLS }, (_, i) => ({
      index: i,
      active: i === 0,
      haveA: false,
      haveB: false,
      morphActual: 0,
      morphTarget: 0,
      role: "full",
      start: i * this.cellChunk,
      count: i === MAX_CELLS - 1 ? this.count - i * this.cellChunk : this.cellChunk
    }));
    this.cells[0].start = 0;
    this.cells[0].count = this.count;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMorph: { value: 0 },
        uTime: { value: 0 },
        uViolence: { value: 0 },
        uPressure: { value: 0 },
        uCollapse: { value: 0 },
        uTemporal: { value: 0 },
        uGrowth: { value: 0 },
        uHumanPresence: { value: 0 },
        uIntensity: { value: 0.7 },
        uSpatialTension: { value: 0.5 },
        uKickPulse: { value: 0 },
        uSnarePulse: { value: 0 },
        uClarity: { value: 1 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uExplore: { value: 1 },
        uCameraAngle: { value: new THREE.Vector2() },
        uCameraPos: { value: new THREE.Vector3(0, 0, 9) },
        uCellRect: { value: this.uCellRect },
        uCellRot: { value: this.uCellRot },
        uCellMorph: { value: this.uCellMorph },
        uCellMods: { value: this.uCellMods },
        uCellTrail: { value: this.uCellTrail },
        uCellShatter: { value: this.uCellShatter },
        uWind: { value: this.uWind }
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    const geometry = new THREE.BufferGeometry();
    const N = this.count;
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aOriginA", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aOriginB", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aColorA", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aColorB", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geometry.setAttribute("aOriginAUv", new THREE.BufferAttribute(new Float32Array(N * 2), 2));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(N), 1));
    geometry.setAttribute("aFlight", new THREE.BufferAttribute(new Float32Array(N), 1));
    geometry.setAttribute("aCellId", new THREE.BufferAttribute(new Float32Array(N), 1));
    this.aOriginAUv = geometry.attributes.aOriginAUv.array;
    this._aOriginBUv = new Float32Array(N * 2);

    const rnd = geometry.attributes.aRandom.array;
    const flight = geometry.attributes.aFlight.array;
    const size = geometry.attributes.aSize.array;
    for (let i = 0; i < N; i++) {
      rnd[i * 3 + 0] = Math.random() - 0.5;
      rnd[i * 3 + 1] = Math.random() - 0.5;
      rnd[i * 3 + 2] = Math.random() - 0.5;
      flight[i] = Math.random();
      size[i] = 0.10 + Math.random() * 0.20;
    }

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.geometry = geometry;

    this.kickPulse = 0;
    this.snarePulse = 0;
    this.morphTarget = 0;
    this.morphActual = 0;
    this.haveA = false;
    this.haveB = false;

    this._initCellUniforms();
    this._assignSoloCellIds();
  }

  _initCellUniforms() {
    for (let i = 0; i < MAX_CELLS; i++) {
      this._writeCellTransform(i, { cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, rot: 0, z: -100 }, 0, -100);
      this._snapCellToTarget(i);
      this.uCellMorph[i] = 0;
      this.cellClockMul[i] = 1;
    }
    this._writeCellTransform(0, { cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, rot: 0, z: 0 }, 1, 0);
    this._snapCellToTarget(0);
  }

  // Set the SMOOTHED rect directly so the next frame's smoothing animates
  // from `rect` → current target. Used by SLAM/CONVERGE entrances where we
  // want particles to visibly fly in from a spawn position.
  setCellSpawn(cid, rect) {
    if (cid < 0 || cid >= MAX_CELLS) return;
    const r = cid * 4;
    this.uCellRect[r + 0] = rect.cx ?? 0;
    this.uCellRect[r + 1] = rect.cy ?? 0;
    this.uCellRect[r + 2] = rect.w ?? CANONICAL_FRAME;
    this.uCellRect[r + 3] = rect.h ?? CANONICAL_FRAME;
    // Reset velocity so the trail doesn't think the cell moved this frame.
    this.uCellTrail[r + 0] = 0;
    this.uCellTrail[r + 1] = 0;
  }

  _snapCellToTarget(cid) {
    if (cid < 0 || cid >= MAX_CELLS) return;
    const r = cid * 4;
    this.uCellRect[r + 0] = this.uCellRectTarget[r + 0];
    this.uCellRect[r + 1] = this.uCellRectTarget[r + 1];
    this.uCellRect[r + 2] = this.uCellRectTarget[r + 2];
    this.uCellRect[r + 3] = this.uCellRectTarget[r + 3];
    this.uCellRot[r + 0] = this.uCellRotTarget[r + 0];
    this.uCellRot[r + 1] = this.uCellRotTarget[r + 1];
    this.uCellRot[r + 2] = this.uCellRotTarget[r + 2];
    this.uCellRot[r + 3] = this.uCellRotTarget[r + 3];
    this.uCellTrail[r + 0] = 0;
    this.uCellTrail[r + 1] = 0;
    this.uCellTrail[r + 2] = 0;
    this.uCellTrail[r + 3] = 0;
    this.cellSeenOnce[cid] = 1;
  }

  _assignSoloCellIds() {
    if (this.partitionMode === "solo") return;
    const ids = this.geometry.attributes.aCellId.array;
    ids.fill(0);
    this.geometry.attributes.aCellId.needsUpdate = true;
    this.partitionMode = "solo";
    this.cells[0].start = 0;
    this.cells[0].count = this.count;
    for (let i = 1; i < MAX_CELLS; i++) {
      this.cells[i].start = i * this.cellChunk;
      this.cells[i].count = i === MAX_CELLS - 1 ? this.count - i * this.cellChunk : this.cellChunk;
    }
  }

  _assignPartitionedCellIds() {
    if (this.partitionMode === "partitioned") return;
    const ids = this.geometry.attributes.aCellId.array;
    for (let i = 0; i < this.count; i++) {
      ids[i] = Math.min(MAX_CELLS - 1, Math.floor(i / this.cellChunk));
    }
    this.geometry.attributes.aCellId.needsUpdate = true;
    this.partitionMode = "partitioned";
    for (let i = 0; i < MAX_CELLS; i++) {
      this.cells[i].start = i * this.cellChunk;
      this.cells[i].count = i === MAX_CELLS - 1 ? this.count - i * this.cellChunk : this.cellChunk;
    }
  }

  beginLayout(layoutCells, opts = {}) {
    const activeCount = Math.min(MAX_CELLS, Math.max(1, layoutCells?.length || 1));
    const fullDensity = opts.fullDensity !== false && activeCount === 1;
    if (fullDensity) this._assignSoloCellIds();
    else this._assignPartitionedCellIds();

    for (let i = 0; i < MAX_CELLS; i++) {
      const def = layoutCells?.[i];
      if (i < activeCount && def) {
        this.cells[i].active = true;
        this.cells[i].role = def.role || "full";
        this.cellClockMul[i] = def.clockMul || 1;
        this._writeCellTransform(i, def, def.opacity ?? 1, def.z ?? 0);
      } else {
        this.cells[i].active = false;
        this.cellClockMul[i] = 1;
        this._writeCellTransform(i, { cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, rot: 0, z: -100 }, 0, -100);
      }
    }
  }

  _writeCellTransform(cid, rect, opacity = 1, zOff = 0) {
    if (cid < 0 || cid >= MAX_CELLS) return;
    const r = cid * 4;
    const rot = rect.rot || 0;
    this.uCellRectTarget[r + 0] = rect.cx ?? 0;
    this.uCellRectTarget[r + 1] = rect.cy ?? 0;
    this.uCellRectTarget[r + 2] = rect.w ?? CANONICAL_FRAME;
    this.uCellRectTarget[r + 3] = rect.h ?? CANONICAL_FRAME;
    this.uCellRotTarget[r + 0] = Math.cos(rot);
    this.uCellRotTarget[r + 1] = Math.sin(rot);
    this.uCellRotTarget[r + 2] = zOff;
    this.uCellRotTarget[r + 3] = opacity;
    // Only the very first placement snaps. After that, smoothing animates ALL
    // transitions — including parked→active — so cells visibly SPLIT outward
    // from their last position (usually canonical center) into the new layout.
    if (!this.cellSeenOnce[cid]) {
      this._snapCellToTarget(cid);
    }
    // A fresh cue bumps the pulse channel so the cell breathes briefly.
    this.uCellTrail[r + 3] = Math.max(this.uCellTrail[r + 3], 0.6);
  }

  hideCell(cid) {
    this.cells[cid].active = false;
    this._writeCellTransform(cid, { cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, rot: 0, z: -100 }, 0, -100);
  }

  _rangeForCell(cellIdx) {
    const cell = this.cells[Math.max(0, Math.min(MAX_CELLS - 1, cellIdx))];
    return {
      start: Math.max(0, Math.min(this.count, cell.start)),
      count: Math.max(0, Math.min(this.count - cell.start, cell.count))
    };
  }

  // Copy worker-precomputed particle data into a destination range.
  // Returns true if data was applied, false when JS sampling should be used.
  _applyPrecomputedRange(data, outPositions, outColors, outUvs, start, count) {
    const pre = data?.precomputed;
    if (!pre) return false;
    if (pre.count !== this.count || start + count > pre.count) {
      console.warn(`particle count mismatch: file=${pre.count} vs config=${this.count}, falling back to JS sampling`);
      return false;
    }
    outPositions.set(pre.positions.subarray(start * 3, (start + count) * 3), start * 3);
    outColors.set(pre.colors.subarray(start * 3, (start + count) * 3), start * 3);
    if (outUvs && pre.uvs) outUvs.set(pre.uvs.subarray(start * 2, (start + count) * 2), start * 2);
    return true;
  }

  _applyPrecomputed(data, outPositions, outColors, outUvs) {
    return this._applyPrecomputedRange(data, outPositions, outColors, outUvs, 0, this.count);
  }

  _sampleImage(data, outPositions, outColors, outUvs) {
    this._sampleImageRange(data, outPositions, outColors, outUvs, 0, this.count, "full");
  }

  _sampleImageRange(data, outPositions, outColors, outUvs, start, count, role = "full") {
    const imageData = data?.imageData;
    if (!imageData || count <= 0) return;
    const w = imageData.width;
    const h = imageData.height;
    const pixels = imageData.data;
    const depth = data.depthData;
    const edge = data.edgeData;
    const sal = data.salData;
    const layers = data.layersData;
    const hasLayers = !!data.hasLayers;
    const isGray = !!data.isGrayscale;
    const hasRealDepth = !!data.hasRealDepth;
    const depthCut = data.depthThreshold ?? 0.32;
    const scaleX = data.scaleX ?? CANONICAL_FRAME;
    const scaleY = data.scaleY ?? CANONICAL_FRAME;
    const depthBias = data.depthBias ?? 0.55;
    const validIdx = new Int32Array(w * h);
    let validCount = 0;

    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const pIdx = (yy * w + xx) * 4;
        if (pixels[pIdx + 3] < 51) continue;
        const u0 = xx / Math.max(1, w - 1);
        const v0 = 1 - yy / Math.max(1, h - 1);
        const radial = Math.hypot(u0 - 0.5, v0 - 0.5);
        const rr = pixels[pIdx];
        const gg = pixels[pIdx + 1];
        const bb = pixels[pIdx + 2];
        const ll = (rr * 0.299 + gg * 0.587 + bb * 0.114) / 255;
        const sat0 = (Math.max(rr, gg, bb) - Math.min(rr, gg, bb)) / 255;
        const eV0 = edge ? edge[pIdx] / 255 : 0;
        const depthVal = depth ? depth[pIdx] / 255 : 0;
        const layerVal = hasLayers ? layers[pIdx] : 0;
        const isLayerBackground = hasLayers && layerVal === 255;
        const heuristicBackground = !hasLayers && (
          (hasRealDepth && depthVal < depthCut) ||
          (!hasRealDepth && ((ll > 0.82 && sat0 < 0.12 && eV0 < 0.18) || (ll < 0.10 && sat0 < 0.12 && eV0 < 0.10)))
        );

        if (role === "background") {
          if (!(isLayerBackground || heuristicBackground)) continue;
        } else {
          if (role === "ring" && radial < 0.33) continue;
          if (hasLayers) {
            if (isLayerBackground) continue;
          } else if (hasRealDepth) {
            if (depthVal < depthCut) continue;
          } else if (heuristicBackground) {
            continue;
          }
        }

        validIdx[validCount++] = pIdx;
      }
    }

    if (validCount === 0) {
      for (let i = 0; i < count; i++) {
        const dst = start + i;
        outPositions[dst * 3 + 0] = 0;
        outPositions[dst * 3 + 1] = 0;
        outPositions[dst * 3 + 2] = -100;
        outColors[dst * 3 + 0] = 0;
        outColors[dst * 3 + 1] = 0;
        outColors[dst * 3 + 2] = 0;
        if (outUvs) {
          outUvs[dst * 2 + 0] = 0.5;
          outUvs[dst * 2 + 1] = 0.5;
        }
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      const dst = start + i;
      const pIdx = validIdx[(Math.random() * validCount) | 0];
      const flatPx = pIdx >> 2;
      const px = flatPx % w;
      const py = (flatPx / w) | 0;
      const tier = Math.random();
      const jSpread = tier < 0.6 ? 1.0 : tier < 0.9 ? 3.0 : 8.0;
      const u = (px + (Math.random() - 0.5) * jSpread) / Math.max(1, w - 1);
      const v = 1 - (py + (Math.random() - 0.5) * jSpread) / Math.max(1, h - 1);
      const radial = Math.hypot(u - 0.5, v - 0.5);
      const r = pixels[pIdx];
      const g = pixels[pIdx + 1];
      const b = pixels[pIdx + 2];
      const l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const eVal = edge ? edge[pIdx] / 255 : 0;
      const sVal = sal ? sal[pIdx] / 255 : 0;
      const layerVal = hasLayers ? layers[pIdx] : 0;

      const nx = (u - 0.5) * scaleX;
      const ny = (v - 0.5) * scaleY;
      let nz = depthZ(depth, pIdx, l, eVal, sVal, isGray, radial, depthBias);
      if (hasLayers && layerVal !== 255) {
        const layerFrac = (MAX_LAYERS - 1 - Math.min(MAX_LAYERS - 1, layerVal)) / (MAX_LAYERS - 1);
        nz += (layerFrac - 0.5) * 0.15 * depthBias;
      }
      if (role === "background") nz -= 0.12;

      outPositions[dst * 3 + 0] = nx;
      outPositions[dst * 3 + 1] = ny;
      outPositions[dst * 3 + 2] = nz;
      if (outUvs) {
        outUvs[dst * 2 + 0] = u;
        outUvs[dst * 2 + 1] = v;
      }
      outColors[dst * 3 + 0] = r / 255;
      outColors[dst * 3 + 1] = g / 255;
      outColors[dst * 3 + 2] = b / 255;
    }
  }

  _markAttributes(side = "both") {
    if (side === "A" || side === "both") {
      this.geometry.attributes.aOriginA.needsUpdate = true;
      this.geometry.attributes.aColorA.needsUpdate = true;
      this.geometry.attributes.aOriginAUv.needsUpdate = true;
    }
    if (side === "B" || side === "both") {
      this.geometry.attributes.aOriginB.needsUpdate = true;
      this.geometry.attributes.aColorB.needsUpdate = true;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  _copyRange(src, dst, start, count, itemSize) {
    dst.set(src.subarray(start * itemSize, (start + count) * itemSize), start * itemSize);
  }

  installCellInitial(cellIdx, data, role = "full") {
    const { start, count } = this._rangeForCell(cellIdx);
    const aOriginA = this.geometry.attributes.aOriginA.array;
    const aOriginB = this.geometry.attributes.aOriginB.array;
    const aColorA = this.geometry.attributes.aColorA.array;
    const aColorB = this.geometry.attributes.aColorB.array;
    const usePrecomputed = role === "full" || role === "ghost";
    if (!usePrecomputed || !this._applyPrecomputedRange(data, aOriginA, aColorA, this.aOriginAUv, start, count)) {
      this._sampleImageRange(data, aOriginA, aColorA, this.aOriginAUv, start, count, role);
    }
    this._copyRange(aOriginA, aOriginB, start, count, 3);
    this._copyRange(aColorA, aColorB, start, count, 3);
    this._copyRange(aOriginA, this.geometry.attributes.position.array, start, count, 3);
    this._copyRange(this.aOriginAUv, this._aOriginBUv, start, count, 2);
    const cell = this.cells[cellIdx];
    cell.haveA = true;
    cell.haveB = false;
    cell.morphActual = 0;
    cell.morphTarget = 0;
    cell.role = role;
    this.uCellMorph[cellIdx] = 0;
    this._markAttributes("both");
    this.haveA = this.cells.some((c) => c.haveA);
    this.haveB = this.cells.some((c) => c.haveB);
  }

  cueCellTarget(cellIdx, nextData, _currentData, role = "full") {
    const cell = this.cells[cellIdx];
    if (cell.haveB) this._commitCellMorph(cellIdx);
    const { start, count } = this._rangeForCell(cellIdx);
    const aOriginB = this.geometry.attributes.aOriginB.array;
    const aColorB = this.geometry.attributes.aColorB.array;
    // Flow was per-pair (worker computes flow[i → i+1] only). Applying it to
    // arbitrary user-driven cuts produced a mask-carryover bug: particles
    // stayed at A's pixel positions and just picked up B's colors. Always
    // sample B's actual positions via precomputed buffer or fresh sampler.
    const usePrecomputed = role === "full" || role === "ghost";
    if (!usePrecomputed || !this._applyPrecomputedRange(nextData, aOriginB, aColorB, this._aOriginBUv, start, count)) {
      this._sampleImageRange(nextData, aOriginB, aColorB, this._aOriginBUv, start, count, role);
    }
    cell.haveB = true;
    cell.morphActual = 0;
    cell.morphTarget = 1;
    cell.role = role;
    this.uCellMorph[cellIdx] = 0;
    this._markAttributes("B");
    this.haveB = true;
  }

  installInitial(data) {
    this.beginLayout([{ cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, role: "full" }], { fullDensity: true });
    this.installCellInitial(0, data, "full");
    this.morphActual = 0;
    this.morphTarget = 0;
    this.material.uniforms.uMorph.value = 0;
    this.haveA = true;
    this.haveB = false;
  }

  // currentData = data of image currently bound as A. If absent, falls back to random.
  cueTarget(nextData, currentData) {
    this.beginLayout([{ cx: 0, cy: 0, w: CANONICAL_FRAME, h: CANONICAL_FRAME, role: "full" }], { fullDensity: true });
    this.cueCellTarget(0, nextData, currentData, "full");
    this.morphActual = 0;
    this.morphTarget = 1;
    this.material.uniforms.uMorph.value = 0;
    this.haveB = true;
  }

  _commitCellMorph(cellIdx) {
    const { start, count } = this._rangeForCell(cellIdx);
    const aOriginA = this.geometry.attributes.aOriginA.array;
    const aOriginB = this.geometry.attributes.aOriginB.array;
    const aColorA = this.geometry.attributes.aColorA.array;
    const aColorB = this.geometry.attributes.aColorB.array;
    this._copyRange(aOriginB, aOriginA, start, count, 3);
    this._copyRange(aColorB, aColorA, start, count, 3);
    this._copyRange(this._aOriginBUv, this.aOriginAUv, start, count, 2);
    this._copyRange(aOriginA, this.geometry.attributes.position.array, start, count, 3);
    const cell = this.cells[cellIdx];
    cell.morphActual = 0;
    cell.morphTarget = 0;
    cell.haveB = false;
    this.uCellMorph[cellIdx] = 0;
    this._markAttributes("A");
    this.haveB = this.cells.some((c) => c.haveB);
  }

  _commitMorph() {
    this._commitCellMorph(0);
    this.morphActual = 0;
    this.morphTarget = 0;
    this.material.uniforms.uMorph.value = 0;
  }

  setCellModifier(cellIdx, key, value) {
    const map = { stutter: 0, swarm: 1, implode: 2, vortex: 3, tileFlip: 3 };
    const slot = map[key];
    if (slot == null || cellIdx < 0 || cellIdx >= MAX_CELLS) return;
    const idx = cellIdx * 4 + slot;
    this.uCellMods[idx] = Math.max(this.uCellMods[idx], value);
  }

  // Bump the per-cell pulse channel (uCellTrail.w). Used so kicks scatter at
  // individual cells instead of pulsing the whole field at once — keeps the
  // beat response varied across the layout.
  pokeCellPulse(cellIdx, strength) {
    if (cellIdx < 0 || cellIdx >= MAX_CELLS) return;
    const w = cellIdx * 4 + 3;
    this.uCellTrail[w] = Math.max(this.uCellTrail[w], Math.min(1.2, strength));
  }

  // SHATTER — cell breaks into 4 quadrants. Decays back to 0 over ~0.8s.
  triggerShatter(cellIdx, strength = 1.0) {
    if (cellIdx < 0 || cellIdx >= MAX_CELLS) return;
    this.uCellShatter[cellIdx] = Math.max(this.uCellShatter[cellIdx], strength);
  }

  // WIND PUSH — global directional gust. Random direction, decays over ~0.5s.
  triggerWind(strength = 1.0) {
    const angle = Math.random() * Math.PI * 2;
    this.uWind.set(Math.cos(angle), Math.sin(angle), Math.min(1.2, strength));
  }

  activeCellIndices() {
    const out = [];
    for (let i = 0; i < MAX_CELLS; i++) if (this.cells[i].active) out.push(i);
    return out;
  }

  setCellClockMultiplier(cellIdx, value) {
    if (cellIdx < 0 || cellIdx >= MAX_CELLS) return;
    this.cellClockMul[cellIdx] = Math.max(0.1, value || 1);
  }

  _smoothCellTransforms() {
    // Per-frame critical-damped follow. Slower rect rate (0.07) so SPLIT/MERGE
    // moments are visible (~400ms to settle). Opacity ramps faster (0.18) so
    // newly-activating cells appear immediately at their spawn position and
    // then drift out via the position smoothing.
    const RECT_RATE = 0.07;
    const ROT_RATE = 0.18;
    for (let i = 0; i < MAX_CELLS; i++) {
      const r = i * 4;
      const px = this.uCellRect[r + 0];
      const py = this.uCellRect[r + 1];
      // Lerp rect XY/WH
      this.uCellRect[r + 0] += (this.uCellRectTarget[r + 0] - this.uCellRect[r + 0]) * RECT_RATE;
      this.uCellRect[r + 1] += (this.uCellRectTarget[r + 1] - this.uCellRect[r + 1]) * RECT_RATE;
      this.uCellRect[r + 2] += (this.uCellRectTarget[r + 2] - this.uCellRect[r + 2]) * RECT_RATE;
      this.uCellRect[r + 3] += (this.uCellRectTarget[r + 3] - this.uCellRect[r + 3]) * RECT_RATE;
      // Lerp rot (cos/sin/z/opacity)
      this.uCellRot[r + 0] += (this.uCellRotTarget[r + 0] - this.uCellRot[r + 0]) * ROT_RATE;
      this.uCellRot[r + 1] += (this.uCellRotTarget[r + 1] - this.uCellRot[r + 1]) * ROT_RATE;
      this.uCellRot[r + 2] += (this.uCellRotTarget[r + 2] - this.uCellRot[r + 2]) * ROT_RATE;
      this.uCellRot[r + 3] += (this.uCellRotTarget[r + 3] - this.uCellRot[r + 3]) * ROT_RATE;
      // Velocity = how far rect moved this frame (drives the moth trail).
      const vx = this.uCellRect[r + 0] - px;
      const vy = this.uCellRect[r + 1] - py;
      // Low-pass the velocity so the trail doesn't flicker every frame.
      this.uCellTrail[r + 0] = this.uCellTrail[r + 0] * 0.75 + vx * 0.25;
      this.uCellTrail[r + 1] = this.uCellTrail[r + 1] * 0.75 + vy * 0.25;
      // Settle-phase clock for the slowest particles' jitter.
      this.uCellTrail[r + 2] += 0.02;
      if (this.uCellTrail[r + 2] > 1000) this.uCellTrail[r + 2] -= 1000;
      // Cue pulse decays.
      this.uCellTrail[r + 3] *= 0.86;
      if (this.uCellTrail[r + 3] < 0.005) this.uCellTrail[r + 3] = 0;
    }
  }

  _decayCellModifiers() {
    for (let i = 0; i < MAX_CELLS; i++) {
      const o = i * 4;
      this.uCellMods[o + 0] *= 0.74;
      this.uCellMods[o + 1] *= 0.86;
      this.uCellMods[o + 2] *= 0.88;
      this.uCellMods[o + 3] *= 0.94;
      if (this.uCellMods[o + 0] < 0.002) this.uCellMods[o + 0] = 0;
      if (this.uCellMods[o + 1] < 0.002) this.uCellMods[o + 1] = 0;
      if (this.uCellMods[o + 2] < 0.002) this.uCellMods[o + 2] = 0;
      if (this.uCellMods[o + 3] < 0.002) this.uCellMods[o + 3] = 0;
      // Shatter decays slower so the break-and-reform motion is readable.
      this.uCellShatter[i] *= 0.91;
      if (this.uCellShatter[i] < 0.002) this.uCellShatter[i] = 0;
    }
    // Global wind decays fast so it's a punctuation gust, not a constant breeze.
    this.uWind.z *= 0.85;
    if (this.uWind.z < 0.005) this.uWind.z = 0;
  }

  update(forces, t) {
    const c = forces.controls;
    const u = this.material.uniforms;
    const reactivity = forces.macros.reactivity;
    const baseSpeed = 0.065 + c.collapse * 0.04 + c.violence * 0.022 + c.temporalInstability * 0.016;
    const k = Math.min(1, baseSpeed * (0.7 + reactivity));

    for (let i = 0; i < MAX_CELLS; i++) {
      const cell = this.cells[i];
      const speed = Math.min(1, k * (this.cellClockMul[i] || 1));
      cell.morphActual += (cell.morphTarget - cell.morphActual) * speed;
      if (cell.morphActual > 0.995 && cell.haveB) {
        this._commitCellMorph(i);
      } else {
        this.uCellMorph[i] = cell.morphActual;
      }
    }

    this.morphActual = this.cells[0].morphActual;
    this.morphTarget = this.cells[0].morphTarget;
    u.uMorph.value = this.morphActual;
    u.uTime.value = t;
    u.uViolence.value = c.violence;
    u.uPressure.value = c.pressure;
    u.uCollapse.value = c.collapse;
    u.uTemporal.value = c.temporalInstability;
    u.uGrowth.value = c.growth;
    u.uHumanPresence.value = c.humanPresence;
    u.uIntensity.value = forces.macros.intensity;
    u.uSpatialTension.value = forces.macros.spatialTension;
    u.uClarity.value = c.clarity;
    u.uBass.value = (forces.audio?.bass ?? 0) * 0.7 + (c.bass ?? 0) * 0.3;
    u.uMid.value = (forces.audio?.mid ?? 0) * 0.7 + (c.violence ?? 0) * 0.2;
    u.uHigh.value = (forces.audio?.high ?? 0) * 0.7 + (c.hats ?? 0) * 0.3;
    u.uExplore.value = forces.exploreFactor ?? 1;

    // Smooth each cell's rect toward its target and feed the per-frame XY
    // velocity to the shader. Particles read this trail as a "moth lag" so
    // when the camera/layout moves, the cloud catches up to the new spot
    // instead of snapping there with it.
    this._smoothCellTransforms();

    if (forces.events?.length) {
      for (const e of forces.events) {
        if (e.type === "kick") this.kickPulse = Math.max(this.kickPulse, e.strength);
        if (e.type === "snare") this.snarePulse = Math.max(this.snarePulse, e.strength);
      }
    }
    this.kickPulse *= 0.86;
    this.snarePulse *= 0.82;
    u.uKickPulse.value = this.kickPulse + c.kick * 0.4;
    u.uSnarePulse.value = this.snarePulse + c.snare * 0.4;
    this._decayCellModifiers();

    const ease = (s, p) => Math.sign(s) * Math.pow(Math.abs(s), p);
    const explore = forces.exploreFactor ?? 1;
    // Group rotation is the biggest "tilted/messy" contributor. Held flat
    // during SETTLE, ramps back in during EXPLORE.
    this.points.rotation.y = (ease(Math.sin(t * 0.11), 2.2) * 0.22 + c.pressure * 0.04) * explore;
    this.points.rotation.x = (ease(Math.cos(t * 0.085), 2.2) * 0.10 + c.collapse * 0.03) * explore;
    this.points.rotation.z = ease(Math.sin(t * 0.065), 2.2) * 0.03 * explore;
  }

  morphProgress() {
    const activeMorphs = this.cells.filter((c) => c.active && c.haveB).map((c) => c.morphActual);
    if (!activeMorphs.length) return 1;
    return Math.min(...activeMorphs);
  }

  setCameraAngle(x, y) {
    this.material.uniforms.uCameraAngle.value.set(x, y);
  }

  setCameraPosition(x, y, z) {
    this.material.uniforms.uCameraPos.value.set(x, y, z);
  }

  // Returns the smoothed (visible) XY of an active cell's rect center. The
  // camera should aim here, not at the layout's target, so it doesn't outrun
  // the moth-chase trail.
  getCellCenter(cellIdx) {
    const cid = Math.max(0, Math.min(MAX_CELLS - 1, cellIdx));
    const r = cid * 4;
    return { x: this.uCellRect[r + 0], y: this.uCellRect[r + 1], w: this.uCellRect[r + 2], h: this.uCellRect[r + 3] };
  }

  // Centroid of all active cells' smoothed centers, weighted by their opacity.
  // Camera lookAt target = "where the field actually is right now".
  getActiveCentroid() {
    let wx = 0, wy = 0, w = 0;
    for (let i = 0; i < MAX_CELLS; i++) {
      if (!this.cells[i].active) continue;
      const r = i * 4;
      const op = this.uCellRot[r + 3];
      if (op < 0.02) continue;
      wx += this.uCellRect[r + 0] * op;
      wy += this.uCellRect[r + 1] * op;
      w += op;
    }
    if (w < 0.001) return { x: 0, y: 0 };
    return { x: wx / w, y: wy / w };
  }
}

// Subject-forward depth: edges + saliency push pixels toward the camera regardless
// of luminance. For grayscale images we ignore the often inverted luminance fallback.
function depthZ(depthArr, idx, luminance, edge, saliency, isGrayscale, radial, depthBias) {
  const subjectLift = edge * 0.85 + saliency * 1.0;
  let base;
  if (depthArr && !isGrayscale) {
    base = depthArr[idx] / 255;
  } else if (depthArr && isGrayscale) {
    base = (depthArr[idx] / 255) * 0.4 + luminance * 0.4;
  } else {
    base = isGrayscale ? luminance * 0.6 : 1 - luminance;
  }
  return (base * 1.2 + subjectLift - radial * 0.35) * depthBias;
}
