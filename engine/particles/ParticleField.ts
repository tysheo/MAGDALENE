import * as THREE from 'three'
import type { SampledCloud } from '../media/sampleSource'

// A persistent point cloud built from a sampled source. Each particle keeps its
// origin, color, and a random vector used to drive idle drift. This is the
// minimal, reliable ancestor of FOUND / FOOTAGE's PersistentParticleField —
// the multi-cell / morph machinery gets ported once the graph runtime drives it.

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aColor;
  attribute vec3 aRandom;
  attribute float aSize;

  uniform float uTime;
  uniform float uIntensity;
  uniform float uPointScale;
  uniform float uBass;
  uniform float uBeat;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    vColor = aColor;

    vec3 pos = position;

    // Idle drift: each particle breathes along its random vector, phase-offset
    // so the cloud shimmers instead of pulsing as one mass. Bass widens the
    // breathing; a beat shoves particles outward along their random vector.
    float phase = aRandom.x * 6.2831853 + uTime * 0.6;
    float amp = (0.04 + uIntensity * 0.08) + uBass * 0.35;
    pos += aRandom * sin(phase) * amp;
    pos += aRandom * uBeat * 0.45;
    pos.z += sin(uTime * 0.4 + aRandom.y * 4.0) * 0.05;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective size attenuation, swollen on bass + beat.
    float swell = 1.0 + uBass * 0.6 + uBeat * 0.8;
    gl_PointSize = aSize * uPointScale * swell * (1.0 / -mv.z);
    vFade = clamp(1.0 / -mv.z, 0.0, 1.5) * (1.0 + uBeat * 0.6);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = dot(c, c);
    if (d > 0.25) discard;
    float alpha = smoothstep(0.25, 0.02, d);
    gl_FragColor = vec4(vColor, alpha * vFade);
  }
`

export class ParticleField {
  readonly object: THREE.Points
  private geometry: THREE.BufferGeometry
  private material: THREE.ShaderMaterial

  constructor(cloud: SampledCloud) {
    const { count, positions, colors } = cloud

    const sizes = new Float32Array(count)
    const randoms = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      sizes[i] = 14 + Math.random() * 22
      randoms[i * 3] = Math.random()
      randoms[i * 3 + 1] = Math.random() * 2 - 1
      randoms[i * 3 + 2] = Math.random() * 2 - 1
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 3))
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.7 },
        uPointScale: { value: 26 },
        uBass: { value: 0 },
        uBeat: { value: 0 }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    })

    this.object = new THREE.Points(this.geometry, this.material)
    this.object.frustumCulled = false
  }

  setIntensity(value: number) {
    this.material.uniforms.uIntensity.value = value
  }

  setAudio(bass: number, beat: number) {
    this.material.uniforms.uBass.value = bass
    this.material.uniforms.uBeat.value = beat
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
