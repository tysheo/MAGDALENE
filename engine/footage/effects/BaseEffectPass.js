import * as THREE from "three";

export const FULLSCREEN_VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export class BaseEffectPass {
  constructor(gl, fragmentShader, extraUniforms = {}) {
    this.gl = gl;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uInput: { value: null },
        uTime: { value: 0 },
        uMix: { value: 1 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uIntensity: { value: 1 },
        uViolence: { value: 0 },
        uPressure: { value: 0 },
        uCollapse: { value: 0 },
        uTemporal: { value: 0 },
        uDegradation: { value: 0 },
        uClarity: { value: 1 },
        uHats: { value: 0 },
        uKick: { value: 0 },
        uSnare: { value: 0 },
        ...extraUniforms
      },
      vertexShader: FULLSCREEN_VS,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      transparent: false
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
    this.mix = 0;
    this.alwaysRun = false;
  }

  applyForces(forces, time) {
    const u = this.material.uniforms;
    const c = forces.controls;
    u.uTime.value = time;
    u.uMix.value = this.mix;
    u.uViolence.value = c.violence;
    u.uPressure.value = c.pressure;
    u.uCollapse.value = c.collapse;
    u.uTemporal.value = c.temporalInstability;
    u.uDegradation.value = c.degradation;
    u.uClarity.value = c.clarity;
    u.uHats.value = c.hats;
    u.uKick.value = c.kick;
    u.uSnare.value = c.snare;
    u.uIntensity.value = forces.macros.intensity;
  }

  render(gl, inputTexture, target, forces, time) {
    const u = this.material.uniforms;
    u.uInput.value = inputTexture;
    u.uResolution.value.set(target.width, target.height);
    this.applyForces(forces, time);
    gl.setRenderTarget(target);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);
    gl.setRenderTarget(null);
    return target.texture;
  }
}
