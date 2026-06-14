import * as THREE from "three";

function makeTarget(w, h) {
  return new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    depthBuffer: true
  });
}

export class RenderTargets {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.scale = 1.0;
    this.targets = {};
    this.history = [];
    this.historyDepth = 32;
    this._ensure();
    window.addEventListener("resize", () => this._ensure());
  }

  size() {
    const rect = this.canvas.getBoundingClientRect();
    const pr = Math.min(window.devicePixelRatio, 2);
    return {
      w: Math.max(64, Math.floor(rect.width * pr * this.scale)),
      h: Math.max(64, Math.floor(rect.height * pr * this.scale))
    };
  }

  _ensure() {
    const { w, h } = this.size();
    for (const key of ["base", "a", "b", "feedback", "feedbackSwap"]) {
      const t = this.targets[key];
      if (!t || t.width !== w || t.height !== h) {
        t?.dispose();
        this.targets[key] = makeTarget(w, h);
      }
    }
    while (this.history.length < this.historyDepth) {
      this.history.push(makeTarget(w, h));
    }
    for (const t of this.history) {
      if (t.width !== w || t.height !== h) {
        t.setSize(w, h);
      }
    }
  }

  acquireBase() { return this.targets.base; }
  pingPong() {
    const out = [this.targets.a, this.targets.b];
    this.targets.a = out[1];
    this.targets.b = out[0];
    return { read: out[0], write: out[1] };
  }
  feedbackSwap() {
    const r = this.targets.feedback;
    const w = this.targets.feedbackSwap;
    this.targets.feedback = w;
    this.targets.feedbackSwap = r;
    return { read: r, write: w };
  }
  pushHistory(texture) {
    // shift ring
    const oldest = this.history.shift();
    this.history.push(oldest);
    return oldest;
  }
  historyAt(framesBack) {
    const idx = (this.history.length - 1 - framesBack + this.history.length) % this.history.length;
    return this.history[idx];
  }
}
