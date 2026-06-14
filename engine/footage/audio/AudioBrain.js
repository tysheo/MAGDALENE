const ZERO = {
  kick: 0, snare: 0, hats: 0, bass: 0, vocals: 0, other: 0,
  pressure: 0, violence: 0, humanPresence: 0,
  temporalInstability: 0, spatialTension: 0, degradation: 0,
  growth: 0, collapse: 0, clarity: 1, density: 0
};

export class AudioBrain {
  constructor() {
    this.frames = [];
    this.events = [];
    this.sections = [];
    this.meta = null;
    this.tempo = 0;
    this.beats = [];
    this.status = "INERT";
  }

  markAnalyzing() {
    this.status = "ANALYZING";
    const el = typeof document !== "undefined" ? document.getElementById("brainStatus") : null;
    if (el) el.textContent = "N° BRAIN — ANALYZING";
  }

  async fetchAnalysis(file) {
    const response = await fetch("/api/analyze-audio", {
      method: "POST",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-file-name": file.name
      },
      body: file
    });
    const meta = await response.json();
    if (!meta.ok || !meta.controls) {
      this.status = "FAILED";
      return meta;
    }
    const [controls, events, sections] = await Promise.all([
      fetch(meta.controls).then((r) => r.json()).catch(() => []),
      meta.events ? fetch(meta.events).then((r) => r.json()).catch(() => []) : [],
      meta.sections ? fetch(meta.sections).then((r) => r.json()).catch(() => []) : []
    ]);
    this.frames = controls;
    this.events = events;
    this.sections = sections;
    this.meta = meta;
    this.tempo = Number(meta.tempo || 0);
    this.beats = Array.isArray(meta.beats) ? meta.beats : [];
    this.status = "READY";
    return meta;
  }

  sample(time) {
    if (!this.frames.length) return { ...ZERO };
    let lo = 0;
    let hi = this.frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.frames[mid].time < time) lo = mid + 1;
      else hi = mid;
    }
    const a = this.frames[Math.max(0, lo - 1)];
    const b = this.frames[Math.min(this.frames.length - 1, lo)];
    if (!a || !b) return { ...(b || a || ZERO) };
    const t = Math.max(0, Math.min(1, (time - a.time) / Math.max(0.0001, b.time - a.time)));
    const out = { ...ZERO };
    for (const key of Object.keys(out)) {
      out[key] = (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * t;
    }
    return out;
  }

  eventsBetween(from, to) {
    if (!this.events?.length) return [];
    if (to < from) return [];
    return this.events.filter((e) => e.time >= from && e.time <= to);
  }

  sectionAt(time) {
    if (!this.sections?.length) return null;
    const found = this.sections.find((s) => time >= s.start && time <= s.end);
    if (!found) return null;
    const localT = (time - found.start) / Math.max(0.0001, found.end - found.start);
    return { ...found, localT, boundaryHit: localT < 0.04 };
  }
}
