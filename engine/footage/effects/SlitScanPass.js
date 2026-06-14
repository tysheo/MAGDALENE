import * as THREE from "three";
import { BaseEffectPass, FULLSCREEN_VS } from "./BaseEffectPass.js";

const FRAG = `
  uniform sampler2D uInput;
  uniform sampler2D uHistory;
  uniform float uTime;
  uniform float uMix;
  uniform float uTemporal;
  uniform float uSnare;
  uniform float uHats;
  uniform float uHistoryAge;
  uniform vec2 uResolution;
  varying vec2 vUv;

  void main() {
    float row = floor(vUv.y * uResolution.y);
    float band = fract(sin(row * 12.9898) * 43758.5453);
    float wobble = sin(uTime * 1.2 + row * 0.03) * 0.4 + 0.6;
    float age = uMix * uTemporal * wobble * (0.4 + uHats * 0.6);
    float displaceX = (band - 0.5) * uMix * uSnare * 0.04;
    vec2 currentUv = vUv + vec2(displaceX, 0.0);
    vec3 cur = texture2D(uInput, currentUv).rgb;
    vec3 hist = texture2D(uHistory, currentUv).rgb;
    vec3 mixed = mix(cur, hist, clamp(age, 0.0, 0.85));
    gl_FragColor = vec4(mixed, 1.0);
  }
`;

export class SlitScanPass extends BaseEffectPass {
  constructor(gl) {
    super(gl, FRAG, {
      uHistory: { value: null },
      uHistoryAge: { value: 0.5 }
    });
    this.historyTarget = null;
    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uAmount: { value: 0.1 } },
      vertexShader: FULLSCREEN_VS,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform float uAmount;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(uTex, vUv).rgb;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthTest: false, depthWrite: false
    });
    this.blitScene = new THREE.Scene();
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMaterial);
    this.blitScene.add(this.blitQuad);
  }

  render(gl, inputTexture, target, forces, time) {
    if (!this.historyTarget || this.historyTarget.width !== target.width || this.historyTarget.height !== target.height) {
      this.historyTarget?.dispose();
      this.historyTarget = new THREE.WebGLRenderTarget(target.width, target.height, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
      });
    }
    this.material.uniforms.uHistory.value = this.historyTarget.texture;
    const tex = super.render(gl, inputTexture, target, forces, time);
    this.blitMaterial.uniforms.uTex.value = inputTexture;
    gl.setRenderTarget(this.historyTarget);
    gl.clear(true, true, true);
    gl.render(this.blitScene, this.blitCamera);
    gl.setRenderTarget(null);
    return tex;
  }
}
