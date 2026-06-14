export class PassComposer {
  constructor(gl, targets) {
    this.gl = gl;
    this.targets = targets;
    this.passes = [];
    this.passByName = new Map();
    this.weights = {};
  }
  add(name, pass) {
    pass.name = name;
    pass.composer = this;
    this.passes.push(pass);
    this.passByName.set(name, pass);
  }
  get(name) { return this.passByName.get(name); }
  setWeights(weights) { this.weights = weights || {}; }

  run(inputTexture, forces, time) {
    let tex = inputTexture;
    for (const pass of this.passes) {
      const w = this.weights[pass.name] ?? 0;
      pass.mix = w;
      if (!pass.alwaysRun && w <= 0.001) continue;
      const { write } = this.targets.pingPong();
      tex = pass.render(this.gl, tex, write, forces, time);
    }
    return tex;
  }
}
