// Web Audio playback + live analysis. Owns one AudioContext, decodes a track,
// plays/pauses/seeks it, and exposes per-frame levels (bass/mid/high + an
// energy-based beat envelope) plus precomputed waveform peaks for the timeline.
// This is the browser-side analysis path; a librosa/Demucs worker can replace
// the band/beat estimates later without changing this interface.

export type AudioLevels = {
  bass: number
  mid: number
  high: number
  level: number
  beat: number
}

const ZERO_LEVELS: AudioLevels = { bass: 0, mid: 0, high: 0, level: 0, beat: 0 }

export type LoadResult = {
  duration: number
  peaks: Float32Array
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private gain: GainNode | null = null
  private freq: Uint8Array<ArrayBuffer> = new Uint8Array(0)

  private playing = false
  private offset = 0
  private startedAt = 0

  private beatEnv = 0
  private bassAvg = 0
  private lastBeatAt = -1

  peaks: Float32Array = new Float32Array(0)
  duration = 0
  loaded = false

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
    }
    return this.ctx
  }

  async loadBytes(bytes: ArrayBuffer): Promise<LoadResult> {
    const ctx = this.ensureContext()
    this.stopSource()
    this.buffer = await ctx.decodeAudioData(bytes.slice(0))
    this.duration = this.buffer.duration
    this.peaks = computePeaks(this.buffer, 200)
    this.offset = 0
    this.playing = false
    this.loaded = true
    return { duration: this.duration, peaks: this.peaks }
  }

  private buildGraph() {
    const ctx = this.ensureContext()
    if (!this.analyser) {
      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 1024
      this.analyser.smoothingTimeConstant = 0.7
      this.freq = new Uint8Array(this.analyser.frequencyBinCount)
    }
    if (!this.gain) {
      this.gain = ctx.createGain()
      this.gain.gain.value = 0.9
      this.gain.connect(ctx.destination)
      this.analyser.connect(this.gain)
    }
  }

  play() {
    if (!this.buffer) return
    const ctx = this.ensureContext()
    void ctx.resume()
    this.buildGraph()
    this.stopSource()

    const source = ctx.createBufferSource()
    source.buffer = this.buffer
    source.connect(this.analyser!)
    source.onended = () => {
      if (this.playing && this.currentTime >= this.duration - 0.05) {
        this.playing = false
        this.offset = 0
      }
    }
    source.start(0, Math.min(this.offset, this.duration))
    this.source = source
    this.startedAt = ctx.currentTime
    this.playing = true
  }

  pause() {
    if (!this.playing) return
    this.offset = this.currentTime
    this.stopSource()
    this.playing = false
  }

  toggle(): boolean {
    if (this.playing) this.pause()
    else this.play()
    return this.playing
  }

  seek(t: number) {
    const clamped = Math.max(0, Math.min(t, this.duration))
    this.offset = clamped
    if (this.playing) this.play()
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.onended = null
        this.source.stop()
      } catch {
        /* already stopped */
      }
      this.source.disconnect()
      this.source = null
    }
  }

  get isPlaying() {
    return this.playing
  }

  get currentTime(): number {
    if (!this.ctx) return this.offset
    if (!this.playing) return this.offset
    return Math.min(this.duration, this.offset + (this.ctx.currentTime - this.startedAt))
  }

  getLevels(): AudioLevels {
    if (!this.analyser || !this.playing) {
      this.beatEnv *= 0.85
      return { ...ZERO_LEVELS, beat: this.beatEnv }
    }
    this.analyser.getByteFrequencyData(this.freq)
    const n = this.freq.length

    const bass = bandAvg(this.freq, 0, Math.floor(n * 0.06))
    const mid = bandAvg(this.freq, Math.floor(n * 0.06), Math.floor(n * 0.25))
    const high = bandAvg(this.freq, Math.floor(n * 0.25), n)
    const level = bandAvg(this.freq, 0, n)

    // Energy-based beat: trigger when bass spikes above its rolling average.
    this.bassAvg = this.bassAvg * 0.92 + bass * 0.08
    const now = this.currentTime
    if (bass > this.bassAvg * 1.35 && bass > 0.18 && now - this.lastBeatAt > 0.16) {
      this.beatEnv = 1
      this.lastBeatAt = now
    }
    this.beatEnv *= 0.86

    return { bass, mid, high, level, beat: this.beatEnv }
  }

  dispose() {
    this.stopSource()
    this.gain?.disconnect()
    this.analyser?.disconnect()
    void this.ctx?.close()
    this.ctx = null
    this.loaded = false
  }
}

function bandAvg(freq: Uint8Array, start: number, end: number): number {
  let sum = 0
  const a = Math.max(0, start)
  const b = Math.min(freq.length, end)
  if (b <= a) return 0
  for (let i = a; i < b; i++) sum += freq[i]
  return sum / (b - a) / 255
}

function computePeaks(buffer: AudioBuffer, buckets: number): Float32Array {
  const data = buffer.getChannelData(0)
  const out = new Float32Array(buckets)
  const step = Math.floor(data.length / buckets) || 1
  let max = 0
  for (let b = 0; b < buckets; b++) {
    let peak = 0
    const start = b * step
    for (let i = 0; i < step; i++) {
      const v = Math.abs(data[start + i] || 0)
      if (v > peak) peak = v
    }
    out[b] = peak
    if (peak > max) max = peak
  }
  if (max > 0) for (let b = 0; b < buckets; b++) out[b] /= max
  return out
}
