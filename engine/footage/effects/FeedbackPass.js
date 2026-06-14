import * as THREE from "three";
import { BaseEffectPass, FULLSCREEN_VS } from "./BaseEffectPass.js";

const FRAG = `
  uniform sampler2D uInput;
  uniform sampler2D uPrev;
  uniform float uTime;
  uniform float uMix;
  uniform float uViolence;
  uniform float uPressure;
  uniform float uCollapse;
  uniform float uTemporal;
  uniform float uHats;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 center = vec2(0.5);
    vec2 dir = vUv - center;
    float zoom = 1.0 - uPressure * 0.014 * uMix - uCollapse * 0.022 * uMix;
    float rot = (uViolence - 0.5) * 0.018 * uMix;
    float cz = cos(rot); float sz = sin(rot);
    vec2 rotated = vec2(dir.x * cz - dir.y * sz, dir.x * sz + dir.y * cz);
    vec2 prevUv = center + rotated * zoom;

    vec2 jitter = vec2(
      sin(prevUv.y * 80.0 + uTime * 4.0) * 0.0024 * uMix * uViolence,
      cos(prevUv.x * 60.0 - uTime * 3.0) * 0.0018 * uMix * uTemporal
    );

    vec3 prev = texture2D(uPrev, prevUv + jitter).rgb;
    vec3 cur  = texture2D(uInput, vUv).rgb;

    float decay = mix(0.74, 0.97, clamp(uMix * (0.5 + uCollapse + uPressure * 0.55), 0.0, 1.0));
    vec3 trail = prev * decay;
    float grain = (gHash(vUv * uResolution + uTime) - 0.5) * 0.04 * uHats * uMix;
    vec3 outc = max(cur, trail + grain);
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export class FeedbackPass extends BaseEffectPass {
  constructor(gl) {
    super(gl, FRAG, { uPrev: { value: null } });
    this.alwaysRun = true;
    this.prevTarget = null;
    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: FULLSCREEN_VS,
      fragmentShader: "uniform sampler2D uTex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTex, vUv); }",
      depthTest: false, depthWrite: false
    });
    this.blitScene = new THREE.Scene();
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMaterial);
    this.blitScene.add(this.blitQuad);
  }

  ensureHistory(width, height) {
    if (!this.prevTarget || this.prevTarget.width !== width || this.prevTarget.height !== height) {
      this.prevTarget?.dispose();
      this.prevTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      });
    }
  }

  render(gl, inputTexture, target, forces, time) {
    this.ensureHistory(target.width, target.height);
    this.material.uniforms.uPrev.value = this.prevTarget.texture;
    const tex = super.render(gl, inputTexture, target, forces, time);
    this.blitMaterial.uniforms.uTex.value = tex;
    gl.setRenderTarget(this.prevTarget);
    gl.clear(true, true, true);
    gl.render(this.blitScene, this.blitCamera);
    gl.setRenderTarget(null);
    return tex;
  }
}
