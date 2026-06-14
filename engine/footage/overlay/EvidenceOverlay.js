export class EvidenceOverlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.phrases = ["NO CLAIM IS MADE FOR GRIEF"];
    this.currentPhrase = this.phrases[0];
    this.lastPhraseChange = 0;
    this.evidenceEl = document.getElementById("evidenceText");
    this.lyricEl = document.getElementById("lyricFlash");
    this._lyricHideAt = 0;
    this._lyricsOwnHeadline = false;
    this.lyricPhrases = [];
    this.currentLyricPhrase = "";
    this.lyricPulse = 0;
    this.tickers = [
      "DEPTH_ANYTHING_V2",
      "PRESSURE_FIELD",
      "FRAME_MEMORY",
      "SUBJECT_LOST",
      "HUMAN_PRESENCE_DETECTED",
      "DO_NOT_RESTORE",
      "PATENT_TO_SCREAM",
      "THE_BODY_IS_NOT_PRIOR_ART"
    ];
    this.glitchEvents = [];
  }

  setPhrases(phrases) {
    if (Array.isArray(phrases) && phrases.length) {
      this.phrases = phrases;
    }
  }

  // Tell the overlay that lyrics will be driving the headline element this
  // session, so the procedural ticker (DEPTH_ANYTHING_V2, SUBJECT_LOST, etc.)
  // stays silent and doesn't compete with the lyric flash for attention.
  setLyricsActive(active) {
    this._lyricsOwnHeadline = !!active;
    if (!active) {
      this.lyricPhrases = [];
      this.currentLyricPhrase = "";
      this.lyricPulse = 0;
    }
  }

  setLyricPhrases(events) {
    this.lyricPhrases = Array.isArray(events)
      ? events.map((e) => String(e.text || "").trim()).filter(Boolean)
      : [];
  }

  // Hard-cut a lyric phrase on screen. `holdMs` is how long it stays before
  // being hidden by the next tick of `updateLyric`. Snare/kick events firing
  // simultaneously make the chromatic aberration read as ON the beat.
  flashLyric(text, holdMs = 360) {
    if (!this.lyricEl || !text) return;
    this.lyricEl.textContent = text;
    this.lyricEl.setAttribute("data-text", text);
    this.lyricEl.hidden = false;
    // force reflow so the opacity transition runs cleanly when .live is added
    void this.lyricEl.offsetWidth;
    this.lyricEl.classList.add("live");
    this._lyricHideAt = performance.now() + holdMs;
  }

  triggerLyricPhrase(text, holdMs = 520) {
    const phrase = String(text || "").trim();
    if (!phrase) return;
    this.currentLyricPhrase = phrase;
    this.currentPhrase = phrase;
    this.lyricPulse = 1;
    this.lastPhraseChange = performance.now();
    this._lyricHideAt = performance.now() + holdMs;
  }

  // Called every frame. If the hold window has expired, hide the flash so the
  // text snaps off (no fade out — matches the song's energy).
  updateLyric(now = performance.now()) {
    if (!this.lyricEl) return;
    if (this._lyricHideAt && now >= this._lyricHideAt) {
      this.lyricEl.classList.remove("live");
      this.lyricEl.hidden = true;
      this._lyricHideAt = 0;
      this.lyricPulse = 0;
    }
  }

  pickPhrase() {
    return this.phrases[Math.floor(Math.random() * this.phrases.length)];
  }

  pickLyricPhrase() {
    if (!this.lyricPhrases.length) return this.pickPhrase();
    return this.lyricPhrases[Math.floor(Math.random() * this.lyricPhrases.length)];
  }

  draw(forces, audio, _phrases, now) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.scale(dpr, dpr);
    const W = w / dpr, H = h / dpr;

    // data block intentionally hidden — was bleeding through as a low-opacity
    // panel over the image. drawDataBlock(ctx, W, H, forces, audio, now);
    // big floating headline triggered on vocals/kicks
    this.drawHeadline(ctx, W, H, forces, audio, now);
    // event-driven scan strokes
    this.drawScans(ctx, W, H, forces, now);
    // poster-style red stripe overlay slice on drops
    this.drawStripe(ctx, W, H, forces, now);

    ctx.restore();

    // evidence text element
    if (now - this.lastPhraseChange > 4200 || forces.events?.some((e) => e.type === "collapse")) {
      this.currentPhrase = this._lyricsOwnHeadline && this.lyricPhrases.length ? this.pickLyricPhrase() : this.pickPhrase();
      this.lastPhraseChange = now;
    }
    if (this.evidenceEl) {
      this.evidenceEl.textContent = this.currentPhrase;
      this.evidenceEl.style.opacity = String(0.10 + audio.impact * 0.3 + forces.controls.collapse * 0.18);
    }
  }

  drawDataBlock(ctx, W, H, forces, audio, now) {
    const c = forces.controls;
    const rows = [
      `N°${String(Math.floor(now / 1000) % 99).padStart(2, "0")} // ${forces.section?.label?.toUpperCase() || "NO SECTION"}`,
      `PRES   ${c.pressure.toFixed(3)}`,
      `VIO    ${c.violence.toFixed(3)}`,
      `COLL   ${c.collapse.toFixed(3)}`,
      `TEMP   ${c.temporalInstability.toFixed(3)}`,
      `HUMAN  ${c.humanPresence.toFixed(3)}`,
      `GROW   ${c.growth.toFixed(3)}`,
      `CLAR   ${c.clarity.toFixed(3)}`,
      `BASS   ${audio.bass.toFixed(3)}`,
      `HIT    ${audio.impact.toFixed(3)}`,
      `MODE   ${forces.transitionMode}`,
      `T+     ${forces.transitionT.toFixed(3)}`
    ];
    ctx.font = "700 11px JetBrains Mono, Consolas, monospace";
    ctx.textAlign = "left";
    const x = 14, y0 = 60;
    const blockW = 220, blockH = rows.length * 14 + 12;
    ctx.fillStyle = "rgba(5,5,5,0.55)";
    ctx.fillRect(x, y0, blockW, blockH);
    ctx.strokeStyle = "rgba(241,241,234,0.4)";
    ctx.strokeRect(x, y0, blockW, blockH);
    ctx.fillStyle = "rgba(241,241,234,0.88)";
    for (let i = 0; i < rows.length; i++) {
      ctx.fillText(rows[i], x + 8, y0 + 18 + i * 14);
    }
    ctx.fillStyle = "rgba(255,36,24,1)";
    ctx.fillRect(x, y0 + blockH, 50, 4);
  }

  drawHeadline(ctx, W, H, forces, audio, now) {
    // Lyrics own the headline slot when active — suppress the procedural
    // ticker (DEPTH_ANYTHING_V2, SUBJECT_LOST, etc) so it doesn't compete.
    if (this._lyricsOwnHeadline) {
      const hit = (forces.events || []).some((e) =>
        (e.type === "kick" && e.strength > 0.55) ||
        (e.type === "snare" && e.strength > 0.50) ||
        e.type === "collapse"
      );
      if (hit && this.lyricPhrases.length && this.lyricPulse < 0.24) {
        this.currentLyricPhrase = this.pickLyricPhrase();
        this.currentPhrase = this.currentLyricPhrase;
        this.lyricPulse = 0.45 + Math.min(0.35, audio.impact * 0.5);
      }
      this.lyricPulse *= 0.91;
      const phrase = this.currentLyricPhrase || this.currentPhrase || this.pickLyricPhrase();
      if (!phrase || this.lyricPulse < 0.05) return;

      const text = String(phrase).toUpperCase().slice(0, 68);
      const size = Math.max(24, Math.min(72, Math.floor(W / Math.max(9, text.length * 0.58))));
      const y = H * (0.16 + ((Math.floor(now / 1700) % 3) * 0.055));
      const drift = Math.sin(now / 360) * 5;
      const alpha = Math.min(0.76, this.lyricPulse * 0.86 + audio.impact * 0.10);

      ctx.save();
      ctx.font = `950 ${size}px Helvetica Neue, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255, 36, 24, ${alpha * 0.32})`;
      ctx.fillText(text, W - 30 - drift, y + 9);
      ctx.fillStyle = `rgba(255, 36, 24, ${alpha})`;
      ctx.fillText(text, W - 18 + drift, y);
      ctx.restore();
      return;
    }
    // Only fire on strong explicit kick events — gives the image room to read.
    const eventKick = (forces.events || []).find((e) => e.type === "kick" && e.strength > 0.85);
    if (!eventKick) {
      this._headlinePulse = (this._headlinePulse ?? 0) * 0.88;
    } else {
      this._headlinePulse = Math.max(this._headlinePulse ?? 0, eventKick.strength);
    }
    const pulse = this._headlinePulse ?? 0;
    if (pulse < 0.15) return;
    const ticker = this.tickers[Math.floor(now / 800) % this.tickers.length];
    ctx.font = `950 ${Math.floor(H * 0.085)}px Helvetica Neue, Helvetica, Arial, sans-serif`;
    ctx.fillStyle = `rgba(255, 36, 24, ${Math.min(0.7, pulse * 0.65)})`;
    ctx.textAlign = "right";
    ctx.fillText(ticker, W - 18, H * 0.18 + Math.sin(now / 400) * 4);
  }

  drawScans(ctx, W, H, forces, now) {
    for (const e of forces.events || []) {
      if (e.type === "snare" || e.type === "kick" || e.type === "collapse") {
        this.glitchEvents.push({ start: now, dur: 240 + e.strength * 600, type: e.type });
      }
    }
    this.glitchEvents = this.glitchEvents.filter((g) => now - g.start < g.dur);
    for (const g of this.glitchEvents) {
      const p = (now - g.start) / g.dur;
      const a = Math.sin(p * Math.PI);
      ctx.strokeStyle = g.type === "snare" ? `rgba(255,36,24,${a})` : `rgba(241,241,234,${a * 0.6})`;
      ctx.lineWidth = 2 + a * 3;
      ctx.beginPath();
      if (g.type === "snare") {
        const x = p * W;
        ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 32, H);
      } else {
        const y = p * H;
        ctx.moveTo(0, y); ctx.lineTo(W, y + (Math.random() - 0.5) * 24);
      }
      ctx.stroke();
    }
  }

  drawStripe(ctx, W, H, forces, now) {
    if (forces.controls.collapse < 0.55 && !forces.events?.some((e) => e.type === "collapse")) return;
    const yC = H * (0.28 + Math.sin(now / 2200) * 0.04);
    ctx.fillStyle = "rgba(255,90,31,0.94)";
    ctx.fillRect(0, yC, W, Math.max(8, H * 0.018));
  }
}
