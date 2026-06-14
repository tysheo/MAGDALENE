import * as THREE from "three";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.setClearColor(0x000000, 1);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NoToneMapping;
    this.gl.autoClear = false;

    this.blitScene = new THREE.Scene();
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }",
      fragmentShader: "uniform sampler2D uTex; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTex, vUv); }"
    });
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blitMaterial);
    this.blitScene.add(this.blitQuad);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.gl.setSize(w, h, false);
      this.width = w;
      this.height = h;
      this.onResize?.(w, h);
    }
  }

  renderToTarget(scene, camera, target) {
    this.gl.setRenderTarget(target);
    this.gl.clear(true, true, true);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    return target.texture;
  }

  blit(texture) {
    this.blitMaterial.uniforms.uTex.value = texture;
    this.gl.setRenderTarget(null);
    this.gl.setClearColor(0x000000, 1);
    this.gl.clear(true, true, true);
    this.gl.render(this.blitScene, this.blitCamera);
  }
}
