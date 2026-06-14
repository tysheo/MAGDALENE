export class AudioPlayer {
  constructor() {
    this.context = null;
    this.source = null;
    this.analyser = null;
    this.mediaDestination = null;
    this.sourceStartTime = 0;
    this.data = null;
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
    this.impact = 0;
    this.lastEnergy = 0;
  }

  async load(file) {
    if (this.context) await this.context.close();
    const context = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await context.decodeAudioData(arrayBuffer);
    const source = context.createBufferSource();
    const analyser = context.createAnalyser();
    const mediaDestination = context.createMediaStreamDestination();
    analyser.fftSize = 2048;
    source.buffer = buffer;
    source.loop = false;
    source.connect(analyser);
    analyser.connect(context.destination);
    analyser.connect(mediaDestination);
    source.start();
    this.context = context;
    this.source = source;
    this.analyser = analyser;
    this.mediaDestination = mediaDestination;
    this.sourceStartTime = context.currentTime;
    this.data = new Uint8Array(analyser.frequencyBinCount);
  }

  currentTime() {
    if (!this.context) return 0;
    return Math.max(0, this.context.currentTime - this.sourceStartTime);
  }

  duration() {
    return this.source?.buffer?.duration ?? null;
  }

  pause() {
    try { this.context?.suspend(); } catch {}
  }

  resume() {
    try { this.context?.resume(); } catch {}
  }

  audioStream() {
    return this.mediaDestination?.stream || null;
  }

  update() {
    if (!this.analyser) return { bass: 0, mid: 0, high: 0, impact: 0 };
    this.analyser.getByteFrequencyData(this.data);
    const bins = this.data.length;
    const band = (from, to) => {
      let sum = 0; let count = 0;
      for (let i = Math.floor(from * bins); i < Math.floor(to * bins); i++) {
        sum += this.data[i] / 255; count++;
      }
      return count ? sum / count : 0;
    };
    this.bass = smooth(this.bass, band(0.0, 0.09), 0.22);
    this.mid = smooth(this.mid, band(0.09, 0.42), 0.18);
    this.high = smooth(this.high, band(0.42, 0.92), 0.16);
    const energy = this.bass * 0.5 + this.mid * 0.32 + this.high * 0.18;
    this.impact = Math.max(0, smooth(this.impact, Math.max(0, energy - this.lastEnergy) * 8, 0.45));
    this.lastEnergy = smooth(this.lastEnergy, energy, 0.15);
    return { bass: this.bass, mid: this.mid, high: this.high, impact: this.impact };
  }
}

function smooth(a, b, k) { return a + (b - a) * k; }
