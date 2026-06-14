import * as THREE from "three";
import { BaseEffectPass, FULLSCREEN_VS } from "./BaseEffectPass.js";

// DatamoshPass — pixel-vector smear using an optional optical-flow texture
// uFlow channels: rg = dx,dy in normalized uv space (centered around 0.5)
// When no flow texture is bound, the pass uses a synthetic radial flow
// scaled by violence/temporal so it still does something on cold-boot.

const FRAG = `
  uniform sampler2D uInput;
  uniform sampler2D uPrev;
  uniform sampler2D uFlow;
  uniform bool uHasFlow;
  uniform float uTransitionT;
  uniform float uTime;
  uniform float uMix;
  uniform float uTemporal;
  uniform float uCollapse;
  uniform float uViolence;
  uniform vec2 uResolution;
  varying vec2 vUv;

  void main() {
    vec2 flow = vec2(0.0);
    if (uHasFlow) {
      vec2 f = texture2D(uFlow, vUv).rg - 0.5;
      flow = f * 2.5;
    } else {
      // Synthetic flow when no flowTexture is bound — pushed up significantly
      // (was 0.02-0.11, now 0.15-0.45) so datamosh is visible even on static
      // material without computed optical flow. Without this the pass did
      // nothing on cold-boot or single-image holds.
      vec2 d = vUv - 0.5;
      flow = -d * (0.15 + uViolence * 0.15 + uCollapse * 0.15);
    }
    float t = clamp(uTransitionT, 0.0, 1.0);
    // smearAmount baseline raised from 0.2 → 0.5 so the pass is visible at
    // moderate weight even without strong audio-driven temporal/collapse
    // signals. Was effectively invisible at uMix < 0.3 before.
    float smearAmount = uMix * (uTemporal * 0.6 + uCollapse * 0.4 + 0.5);

    // datamosh: walk along flow and accumulate previous pixels
    vec3 acc = vec3(0.0);
    float weight = 0.0;
    for (int i = 0; i < 12; i++) {
      float step = float(i) / 11.0;
      vec2 sUv = vUv - flow * step * smearAmount * (0.5 + t);
      vec3 s = texture2D(uPrev, sUv).rgb;
      float w = 1.0 - step;
      acc += s * w;
      weight += w;
    }
    acc /= max(0.0001, weight);

    vec3 cur = texture2D(uInput, vUv).rgb;
    // during transition, lean on smeared prev (image A bleeding into image B)
    float bleed = clamp(uMix * (0.3 + t * 0.7 + uCollapse * 0.5), 0.0, 0.95);
    vec3 outc = mix(cur, max(acc, cur * 0.85), bleed);
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export class DatamoshPass extends BaseEffectPass {
  constructor(gl) {
    super(gl, FRAG, {
      uPrev: { value: null },
      uFlow: { value: null },
      uHasFlow: { value: false },
      uTransitionT: { value: 0 }
    });
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

  setFlow(texture) {
    this.material.uniforms.uFlow.value = texture;
    this.material.uniforms.uHasFlow.value = !!texture;
  }

  render(gl, inputTexture, target, forces, time) {
    if (!this.prevTarget || this.prevTarget.width !== target.width || this.prevTarget.height !== target.height) {
      this.prevTarget?.dispose();
      this.prevTarget = new THREE.WebGLRenderTarget(target.width, target.height, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
      });
    }
    this.material.uniforms.uPrev.value = this.prevTarget.texture;
    this.material.uniforms.uTransitionT.value = forces.transitionT ?? 0;
    const tex = super.render(gl, inputTexture, target, forces, time);
    this.blitMaterial.uniforms.uTex.value = tex;
    gl.setRenderTarget(this.prevTarget);
    gl.clear(true, true, true);
    gl.render(this.blitScene, this.blitCamera);
    gl.setRenderTarget(null);
    return tex;
  }
}
