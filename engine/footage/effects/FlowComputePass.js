import * as THREE from "three";
import { BaseEffectPass, FULLSCREEN_VS } from "./BaseEffectPass.js";

// FlowComputePass — frame-to-frame motion estimation using brightness
// constancy. Output is a single RGBA texture where R,G encode (dx, dy)
// centered around 0.5 in normalized UV space. Plugged into DatamoshPass.setFlow
// so the smear follows real motion instead of the radial fallback.
//
// Algorithm: spatial gradient via 4-tap Sobel + temporal gradient via
// (curr-prev) luma. Flow direction = -grad / |grad|^2 * dt, clamped.
// Not Lucas-Kanade — cheaper, noisier, but visually directional enough.
// alwaysRun so it tracks every frame and never goes stale.
const FRAG = `
  uniform sampler2D uInput;
  uniform sampler2D uPrev;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 px = 1.0 / uResolution;
    float lC = luma(texture2D(uInput, vUv).rgb);
    float lL = luma(texture2D(uInput, vUv - vec2(px.x, 0.0)).rgb);
    float lR = luma(texture2D(uInput, vUv + vec2(px.x, 0.0)).rgb);
    float lD = luma(texture2D(uInput, vUv - vec2(0.0, px.y)).rgb);
    float lU = luma(texture2D(uInput, vUv + vec2(0.0, px.y)).rgb);
    float lP = luma(texture2D(uPrev, vUv).rgb);

    vec2 grad = vec2(lR - lL, lU - lD);
    float dt = lC - lP;

    // Flow = -dt * grad / (|grad|^2 + eps). Clamp + scale to fit [-0.5, 0.5].
    float gMag = dot(grad, grad) + 0.0005;
    vec2 flow = -dt * grad / gMag * 0.04;
    flow = clamp(flow, vec2(-0.5), vec2(0.5));

    gl_FragColor = vec4(flow + 0.5, 0.0, 1.0);
  }
`;

export class FlowComputePass extends BaseEffectPass {
  constructor(gl) {
    super(gl, FRAG, { uPrev: { value: null } });
    this.alwaysRun = true;
    this.prevTarget = null;
    this.lastFlowTexture = null;
    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: FULLSCREEN_VS,
      fragmentShader: "uniform sampler2D uTex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTex, vUv); }",
      depthTest: false,
      depthWrite: false
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
    // We DON'T overwrite `target` — we render flow into our own scratch target
    // so the composer's ping-pong chain still gets the unmodified input
    // forwarded along. Effects that want flow read it via lastFlowTexture.
    this.material.uniforms.uInput.value = inputTexture;
    this.material.uniforms.uResolution.value.set(target.width, target.height);
    // Render flow into prevTarget's slot — we double-buffer by swapping each frame.
    const flowTarget = this._flowTarget ?? (this._flowTarget = new THREE.WebGLRenderTarget(target.width, target.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    }));
    if (flowTarget.width !== target.width || flowTarget.height !== target.height) {
      flowTarget.setSize(target.width, target.height);
    }
    gl.setRenderTarget(flowTarget);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(null);
    this.lastFlowTexture = flowTarget.texture;

    // Snapshot current frame into prevTarget for the next pass.
    this.blitMaterial.uniforms.uTex.value = inputTexture;
    gl.setRenderTarget(this.prevTarget);
    gl.clear(true, true, true);
    gl.render(this.blitScene, this.blitCamera);
    gl.setRenderTarget(null);

    // Forward input unchanged so downstream passes see the original frame.
    return inputTexture;
  }
}
