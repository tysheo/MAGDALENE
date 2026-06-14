import * as THREE from "three";

export class SceneBuilder {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.imagePlane = null;
    this.warpPlane = null;
    this.morphState = 0;
    this.currentTexture = null;
    this.nextTexture = null;
  }

  installInitial(data) {
    this.currentTexture = data.texture;
    if (!this.imagePlane) {
      const geometry = new THREE.PlaneGeometry(data.scaleX, data.scaleY, 96, 96);
      this.imageMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: data.texture },
          uMapNext: { value: data.texture },
          uFlow: { value: null },
          uHasFlow: { value: false },
          uMorph: { value: 0 },
          uOpacity: { value: 0.0 },
          uTime: { value: 0 },
          uViolence: { value: 0 },
          uCollapse: { value: 0 },
          uTemporal: { value: 0 }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uViolence;
          uniform float uCollapse;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            float n = sin(p.x * 8.0 + uTime * 0.6) * cos(p.y * 7.3 - uTime * 0.4);
            p.z += n * uViolence * 0.04;
            p.xy *= 1.0 + uCollapse * 0.04;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uMap;
          uniform sampler2D uMapNext;
          uniform sampler2D uFlow;
          uniform bool uHasFlow;
          uniform float uMorph;
          uniform float uOpacity;
          uniform float uTemporal;
          varying vec2 vUv;
          void main() {
            vec2 uvA = vUv;
            vec2 uvB = vUv;
            if (uHasFlow) {
              vec2 f = texture2D(uFlow, vUv).rg - 0.5;
              vec2 disp = f * 0.5;
              uvA = vUv + disp * uMorph * (1.0 + uTemporal * 0.4);
              uvB = vUv - disp * (1.0 - uMorph) * (1.0 + uTemporal * 0.4);
            }
            vec3 a = texture2D(uMap, uvA).rgb;
            vec3 b = texture2D(uMapNext, uvB).rgb;
            // S-curve the morph so it lingers in the middle smear
            float t = smoothstep(0.0, 1.0, uMorph);
            vec3 c = mix(a, b, t);
            gl_FragColor = vec4(c, uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false
      });
      this.imagePlane = new THREE.Mesh(geometry, this.imageMaterial);
      this.imagePlane.position.z = -0.4;
      this.imagePlane.visible = false; // point cloud only — no raw image bleed-through
      this.group.add(this.imagePlane);
    } else {
      this.imagePlane.geometry.dispose();
      this.imagePlane.geometry = new THREE.PlaneGeometry(data.scaleX, data.scaleY, 96, 96);
      this.imageMaterial.uniforms.uMap.value = data.texture;
      this.imageMaterial.uniforms.uMapNext.value = data.texture;
      this.imageMaterial.uniforms.uMorph.value = 0;
    }
  }

  cueTarget(data, currentData) {
    this.nextTexture = data.texture;
    this.imageMaterial.uniforms.uMapNext.value = data.texture;
    this.imageMaterial.uniforms.uMorph.value = 0;
    const flowTex = currentData?.flowTexture || null;
    this.imageMaterial.uniforms.uFlow.value = flowTex;
    this.imageMaterial.uniforms.uHasFlow.value = !!flowTex;
  }

  update(forces, t) {
    if (!this.imageMaterial) return;
    this.imageMaterial.uniforms.uTime.value = t;
    this.imageMaterial.uniforms.uViolence.value = forces.controls.violence;
    this.imageMaterial.uniforms.uCollapse.value = forces.controls.collapse;
    this.imageMaterial.uniforms.uTemporal.value = forces.controls.temporalInstability;
    this.imageMaterial.uniforms.uMorph.value = forces.transitionT;
    this.imageMaterial.uniforms.uOpacity.value = 0;
    if (forces.transitionT >= 0.99 && this.nextTexture) {
      this.imageMaterial.uniforms.uMap.value = this.nextTexture;
      this.imageMaterial.uniforms.uMapNext.value = this.nextTexture;
      this.imageMaterial.uniforms.uMorph.value = 0;
      this.imageMaterial.uniforms.uHasFlow.value = false;
      this.imageMaterial.uniforms.uFlow.value = null;
      this.currentTexture = this.nextTexture;
      this.nextTexture = null;
    }
  }
}
