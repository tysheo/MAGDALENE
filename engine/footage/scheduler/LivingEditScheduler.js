// Effect intensities are intentionally restrained — the point cloud IS the
// composition, post-process should punctuate, not bury it. Drops cap mid-range
// instead of 0.65-0.85 so the image stays legible at peak intensity.
//
// Feedback + bloom baselines are LOWER than before — they were always-on
// background haze that hid the punctuation effects. Now they're closer to
// peer-level with the other passes and only spike when their section/event
// gates fire. Dominant-set selection (below) does the rest of the work to
// make sure 2-3 effects ride at any given moment instead of all 7 stacking.
const SECTION_DEFAULTS = {
  intro:     { feedback: 0.12, rgbTear: 0.04, slitScan: 0.04, pixelSort: 0.02, datamosh: 0.08, dither: 0.08, bloom: 0.10 },
  verse:     { feedback: 0.13, rgbTear: 0.045, slitScan: 0.08, pixelSort: 0.035, datamosh: 0.08, dither: 0.10, bloom: 0.14 },
  build:     { feedback: 0.17, rgbTear: 0.11, slitScan: 0.18, pixelSort: 0.08, datamosh: 0.12, dither: 0.16, bloom: 0.18 },
  pre_drop:  { feedback: 0.20, rgbTear: 0.16, slitScan: 0.26, pixelSort: 0.16, datamosh: 0.18, dither: 0.20, bloom: 0.21 },
  drop:      { feedback: 0.24, rgbTear: 0.34, slitScan: 0.34, pixelSort: 0.34, datamosh: 0.38, dither: 0.28, bloom: 0.30 },
  breakdown: { feedback: 0.22, rgbTear: 0.10, slitScan: 0.24, pixelSort: 0.08, datamosh: 0.30, dither: 0.28, bloom: 0.18 },
  evidence:  { feedback: 0.16, rgbTear: 0.10, slitScan: 0.20, pixelSort: 0.08, datamosh: 0.16, dither: 0.32, bloom: 0.24 },
  outro:     { feedback: 0.14, rgbTear: 0.06, slitScan: 0.10, pixelSort: 0.03, datamosh: 0.14, dither: 0.28, bloom: 0.12 }
};

// Dominant-set: at any given moment, only 2-3 effects are "live." Effects in
// the dominant set keep their full calculated weight; everything else is
// suppressed to ~12% of that weight (still nonzero so transient kicks/snares
// register, but not enough to compete with the dominant trio for attention).
//
// Each section lists 2-4 candidate dominants, and within the section we rotate
// through them every SWAP_BAR_S seconds so the look keeps changing instead of
// the same trio riding the whole verse.
const SECTION_DOMINANTS = {
  intro:     [ ["dither"], ["feedback", "dither"] ],
  verse:     [ ["bloom", "dither"], ["slitScan", "dither"], ["feedback", "bloom"], ["datamosh", "dither"] ],
  build:     [ ["slitScan", "dither"], ["datamosh", "bloom"], ["pixelSort", "slitScan"] ],
  pre_drop:  [ ["pixelSort", "datamosh"], ["slitScan", "bloom"], ["rgbTear", "pixelSort"] ],
  drop:      [ ["pixelSort", "datamosh"], ["pixelSort", "rgbTear"], ["datamosh", "slitScan", "bloom"] ],
  breakdown: [ ["feedback", "datamosh"], ["dither", "datamosh"] ],
  evidence:  [ ["bloom", "dither"], ["feedback", "bloom"], ["slitScan", "dither"] ],
  outro:     [ ["dither"], ["feedback", "dither"] ]
};

const TESTIMONY_DOMINANTS = {
  intro:     [ ["dither"], ["feedback", "dither"] ],
  verse:     [ ["feedback", "bloom"], ["dither", "bloom"], ["feedback", "dither"] ],
  build:     [ ["feedback", "bloom"], ["slitScan", "dither"], ["bloom", "dither"] ],
  pre_drop:  [ ["slitScan", "bloom"], ["feedback", "slitScan"] ],
  drop:      [ ["datamosh", "bloom"], ["slitScan", "dither"], ["feedback", "datamosh"] ],
  breakdown: [ ["dither"], ["feedback", "dither"] ],
  evidence:  [ ["feedback", "bloom"], ["dither", "bloom"], ["feedback", "dither"] ],
  outro:     [ ["dither"], ["feedback", "dither"] ]
};

// Off-set suppression — effects not in the current dominant trio are scaled
// to this fraction of their calculated weight. Low enough they don't compete
// for attention, high enough that transient events still nudge them.
const OFF_SET_GAIN = 0.10;

// Effects in the current dominant trio get this multiplier. Asymmetric with
// OFF_SET_GAIN — dominant effects shouldn't just be 8x louder than off-set,
// they should READ. Especially important for atmospheric effects (feedback,
// bloom) that don't have transient snare/kick boosts to push them visually
// the way the punctuation effects do.
const DOMINANT_BOOST = 1.7;

// How long each dominant-trio rotation stays active before swapping. Tuned
// to roughly one phrase (4 bars at ~120bpm = ~8s). Section-aware swap could
// snap to bar boundaries; for now a fixed timer keeps the implementation
// simple and the effect is the same: the look mutates over the section.
const DOMINANT_SWAP_S = 8.0;

// When the audio brain hasn't found structural cuts (single-section tracks
// labelled as one big "intro") we cycle through ALL the rich palettes so
// effect variety isn't gated on section detection working. Rebalanced so
// every effect appears at least twice — earlier version had bloom in only
// one entry, so on tracks where we missed that entry bloom never fired.
const FALLBACK_PALETTE = [
  ["pixelSort", "rgbTear"],
  ["slitScan", "dither"],
  ["datamosh", "bloom"],
  ["feedback", "rgbTear"],
  ["pixelSort", "datamosh"],
  ["bloom", "slitScan"],
  ["rgbTear", "datamosh", "pixelSort"],
  ["feedback", "dither"],
  ["slitScan", "rgbTear", "datamosh"],
  ["bloom", "feedback"]
];

// Hard ceilings per pass — even if section + boosts push weights above this,
// clamp so the image never gets fully eaten. Raised across the board so
// RUPTURE doctrine and drop sections can actually push effects to genuinely
// loud peaks (was 0.45-0.55, now 0.65-0.80).
const PASS_CEILING = {
  feedback: 0.75,
  rgbTear: 0.62,
  slitScan: 0.64,
  pixelSort: 0.75,
  datamosh: 0.72,
  dither: 0.65,
  bloom: 0.70
};

const TESTIMONY_PASS_CEILING = {
  feedback: 0.42,
  rgbTear: 0.22,
  slitScan: 0.34,
  pixelSort: 0.20,
  datamosh: 0.30,
  dither: 0.46,
  bloom: 0.52
};

const MODE_PROFILE = {
  default: {
    dominants: SECTION_DOMINANTS,
    offSetGain: OFF_SET_GAIN,
    dominantBoost: DOMINANT_BOOST,
    dominantSwapS: DOMINANT_SWAP_S,
    ceilings: PASS_CEILING
  },
  testimony: {
    dominants: TESTIMONY_DOMINANTS,
    offSetGain: 0.18,
    dominantBoost: 1.25,
    dominantSwapS: 14.0,
    ceilings: TESTIMONY_PASS_CEILING
  }
};

// Per-transition-mode multipliers applied to each pass weight during the
// transition window. Each mode picks 1-3 passes that DEFINE it visually so
// the four modes become distinguishable rather than four labels on the same
// morph. Multipliers ride a `transitionFade = 1 - transitionT` curve so the
// recipe is loudest at the cut moment and decays as the new image settles.
// Tuned DOWN from the original 1.5-2.6x peaks — they were burying the image
// behind a strobe instead of punctuating it. Punctuation should make the cut
// land, not erase the new image for the first second of its life.
const TRANSITION_RECIPES = {
  PATENT_TO_SCREAM:   { pixelSort: 1.5, datamosh: 1.2, bloom: 1.3, rgbTear: 1.15 },
  COLLAPSE_INTO_VOID: { datamosh: 1.4, feedback: 1.2, dither: 1.15, bloom: 0.7 },
  CLAIM_TO_BODY:      { feedback: 1.2, bloom: 1.25, dither: 0.6, rgbTear: 0.5 },
  TIME_DAMAGE:        { slitScan: 1.5, datamosh: 1.25, rgbTear: 1.2 },
  ARCHIVE_TO_GHOST:   { feedback: 1.25, datamosh: 1.15, dither: 1.1 }
};

export class LivingEditScheduler {
  constructor() {
    this.lastSection = null;
    this.transitionT = 0;
    this.transitionMode = "ARCHIVE_TO_GHOST";
    this.lastImpact = 0;
    this.lastHigh = 0;
    this.lastSyntheticKickT = 0;
    this.lastSyntheticSnareT = 0;
    this.lastSectionLabel = null;
    this.holdUntilT = 0;
    this._dominantCursor = 0;
    this._lastDominantSwapT = -Infinity;
    this._dominantSectionLabel = null;
    this._activeDominant = null;
    this._musicState = null;
    this._musicStateSince = 0;
    this._transitionModeSince = 0;
  }

  // Pick the current dominant-trio for this section. Rotates through the
  // section's candidate sets every DOMINANT_SWAP_S seconds.
  //
  // FALLBACK PALETTE: when the audio brain reports only an `intro` for the
  // whole track (section detection couldn't find structural cuts), cycle
  // through ALL the rich palettes — verse, build, pre_drop, drop, breakdown,
  // evidence — so effect variety still happens regardless of section
  // labelling. Without this, single-section tracks get stuck with whatever
  // tiny palette the labelled section happens to have.
  _currentDominantSet(label, audioTime, visualMode = "default") {
    const profile = MODE_PROFILE[visualMode] || MODE_PROFILE.default;
    const sectionDominants = profile.dominants || SECTION_DOMINANTS;
    const useFallback = !label || !sectionDominants[label];
    const candidates = useFallback ? FALLBACK_PALETTE : (sectionDominants[label] || sectionDominants.verse);
    if (!candidates || !candidates.length) return new Set();
    // Track the dominant-rotation's own section memory (separate from the
    // hold-trigger's `lastSectionLabel`, which is set later in update()).
    // Without this we used the wrong field, the condition was always true,
    // and the cursor advanced on EVERY frame instead of every 8 seconds.
    const sectionKey = `${visualMode}:${label}`;
    const sectionChanged = sectionKey !== this._dominantSectionLabel;
    if (sectionChanged || audioTime - this._lastDominantSwapT >= profile.dominantSwapS) {
      this._dominantCursor = (this._dominantCursor + 1) % candidates.length;
      this._lastDominantSwapT = audioTime;
      this._dominantSectionLabel = sectionKey;
    }
    this._activeDominant = candidates[this._dominantCursor];
    return new Set(this._activeDominant);
  }

  pickTransitionMode(section, controls, lyricSignal = null, visualMode = "default") {
    if (visualMode === "testimony") {
      if (controls.collapse > 0.70) return "COLLAPSE_INTO_VOID";
      if (lyricSignal?.active || controls.humanPresence > 0.48) return "CLAIM_TO_BODY";
      if (controls.temporalInstability > 0.70) return "TIME_DAMAGE";
      return "ARCHIVE_TO_GHOST";
    }
    if (controls.collapse > 0.6) return "COLLAPSE_INTO_VOID";
    if (section?.label === "drop") return "PATENT_TO_SCREAM";
    if (controls.temporalInstability > 0.62) return "TIME_DAMAGE";
    if ((section?.label === "evidence" && controls.humanPresence > 0.46) ||
        (controls.humanPresence > 0.62 && controls.pressure < 0.62)) return "CLAIM_TO_BODY";
    return "ARCHIVE_TO_GHOST";
  }

  smoothTransitionMode(candidate, audioTime) {
    const now = audioTime ?? 0;
    if (!this.transitionMode) {
      this.transitionMode = candidate;
      this._transitionModeSince = now;
      return candidate;
    }
    if (candidate === this.transitionMode) return this.transitionMode;
    const elapsed = now - this._transitionModeSince;
    const urgent = candidate === "COLLAPSE_INTO_VOID" || candidate === "PATENT_TO_SCREAM";
    if (urgent && elapsed >= 0.08) {
      this.transitionMode = candidate;
      this._transitionModeSince = now;
      return candidate;
    }
    const minHold = urgent ? 0.32 : 0.85;
    if (elapsed < minHold) return this.transitionMode;
    this.transitionMode = candidate;
    this._transitionModeSince = now;
    return candidate;
  }

  classifyMusicState(controls, allEvents, audioTime, lyricSignal = null) {
    const recentKick = allEvents.some((e) => e.type === "kick" && e.strength > 0.55);
    const recentSnare = allEvents.some((e) => e.type === "snare" && e.strength > 0.45);
    const recentCollapse = allEvents.some((e) => e.type === "collapse" && e.strength > 0.35);
    const pressure = Math.max(controls.pressure || 0, controls.bass || 0);
    const violence = controls.violence || 0;
    const hats = controls.hats || 0;
    const collapse = controls.collapse || 0;
    const temporal = controls.temporalInstability || 0;
    const density = controls.density || 0;
    const energy = Math.max(pressure, violence, hats, collapse, density);

    if ((audioTime ?? 0) < 6 && energy < 0.55) return "intro";
    if (lyricSignal?.active && energy < 0.58 && collapse < 0.45) return "evidence";
    if (recentCollapse || collapse > 0.62 || (pressure > 0.70 && violence > 0.52 && (recentKick || recentSnare))) return "drop";
    if (hats > 0.68 || temporal > 0.68 || (recentSnare && violence > 0.55 && pressure > 0.48)) return "pre_drop";
    if (pressure > 0.58 || density > 0.62 || (recentKick && pressure > 0.48 && violence > 0.36)) return "build";
    if (energy < 0.20 && (controls.clarity ?? 1) > 0.68) return "breakdown";
    if ((controls.humanPresence || 0) > 0.48 && energy < 0.42) return "evidence";
    return "verse";
  }

  classifyTestimonyState(controls, allEvents, audioTime, lyricSignal = null) {
    const recentCollapse = allEvents.some((e) => e.type === "collapse" && e.strength > 0.45);
    const recentLyric = allEvents.some((e) => e.type === "lyric" && e.strength > 0.35);
    const pressure = Math.max(controls.pressure || 0, controls.bass || 0);
    const violence = controls.violence || 0;
    const human = controls.humanPresence || 0;
    const growth = controls.growth || 0;
    const collapse = controls.collapse || 0;
    const testimonyEnergy = human * 0.45 + (controls.vocals || 0) * 0.25 + growth * 0.20 + (lyricSignal?.strength || 0) * 0.10;

    if ((audioTime ?? 0) < 8 && testimonyEnergy < 0.50) return "intro";
    if (recentCollapse || (collapse > 0.68 && pressure > 0.45 && violence > 0.42)) return "drop";
    if (lyricSignal?.active || recentLyric || human > 0.44) return "evidence";
    if (growth > 0.58 || testimonyEnergy > 0.58) return "build";
    if (violence < 0.18 && human < 0.30 && (controls.clarity ?? 1) > 0.70) return "breakdown";
    return "verse";
  }

  smoothMusicState(candidate, audioTime) {
    const now = audioTime ?? 0;
    if (!this._musicState) {
      this._musicState = candidate;
      this._musicStateSince = now;
      return candidate;
    }
    if (candidate === this._musicState) return this._musicState;
    const elapsed = now - this._musicStateSince;
    const urgent = candidate === "drop";
    const leavingDrop = this._musicState === "drop" && elapsed < 0.8;
    const minHold = this._musicState === "build" ? 2.25 : this._musicState === "pre_drop" ? 1.9 : 1.55;
    if (!urgent && (elapsed < minHold || leavingDrop)) return this._musicState;
    this._musicState = candidate;
    this._musicStateSince = now;
    return candidate;
  }

  update({ t, audioTime, audio, brain, events, section, macros, transitionTime, doctrineBias, lyricSignal, visualMode = "default" }) {
    const isTestimony = visualMode === "testimony";
    const modeProfile = MODE_PROFILE[visualMode] || MODE_PROFILE.default;
    const controls = { ...brain };
    // augment with raw FFT — kept low so live audio doesn't peg effects to max
    controls.kick = Math.max(controls.kick, audio.impact * (isTestimony ? 0.34 : 0.7));
    controls.bass = Math.max(controls.bass, audio.bass * (isTestimony ? 0.58 : 0.8));
    controls.pressure = Math.max(controls.pressure, audio.bass * (isTestimony ? 0.36 : 0.55));
    controls.violence = Math.max(controls.violence, audio.mid * (isTestimony ? 0.24 : 0.4));
    controls.hats = Math.max(controls.hats, audio.high * (isTestimony ? 0.24 : 0.5));
    controls.snare = Math.max(controls.snare, audio.high * (isTestimony ? 0.20 : 0.4) + audio.mid * (isTestimony ? 0.10 : 0.18));
    controls.temporalInstability = Math.max(controls.temporalInstability, audio.high * (isTestimony ? 0.14 : 0.25));
    if (isTestimony) {
      controls.violence *= 0.72;
      controls.collapse *= 0.72;
      controls.temporalInstability *= 0.76;
      controls.degradation *= 0.72;
      if (lyricSignal?.active) {
        controls.humanPresence = Math.max(controls.humanPresence || 0, 0.46 + (lyricSignal.strength || 0) * 0.36);
        controls.clarity = Math.max(controls.clarity || 0, 0.64);
      }
    }

    const ignoredSectionLabel = section?.label || "unclassified";
    // SECTION SUBSTITUTION: when the audio brain only ever reports "intro"
    // or "outro" (no real section structure detected on this track), we'd
    // otherwise stay at intro-level intensity for the entire song. Substitute
    // "build" intensity so the track actually hits — the DOCTRINE preset
    // controls overall loudness, not section detection accidents.
    let label = "verse";
    let baseW = SECTION_DEFAULTS.verse;

    // Synthesize beat events from raw FFT so flashes / scan strokes / camera shake
    // fire on every detectable hit, even without worker analysis. Thresholds
    // lowered from impact>0.2/high>0.22 → 0.10/0.12 so soft tracks still hit;
    // gap timers shortened so dense kicks / hat patterns don't get throttled.
    const allEvents = events ? events.slice() : [];
    const impactRise = audio.impact - this.lastImpact;
    const kickRiseThreshold = isTestimony ? 0.085 : 0.035;
    const kickFloor = isTestimony ? 0.30 : 0.10;
    const kickTrigger = isTestimony ? 0.72 : 0.35;
    const kickCooldown = isTestimony ? 0.42 : 0.07;
    if ((impactRise > kickRiseThreshold || audio.impact > kickTrigger) && audio.impact > kickFloor && (t - this.lastSyntheticKickT) > kickCooldown) {
      const strength = Math.min(1, audio.impact * 1.6 + audio.bass * 0.55);
      allEvents.push({ type: "kick", strength, time: audioTime, synthetic: true });
      this.lastSyntheticKickT = t;
    }
    const highRise = audio.high - this.lastHigh;
    const snareRiseThreshold = isTestimony ? 0.085 : 0.035;
    const snareFloor = isTestimony ? 0.34 : 0.12;
    const snareTrigger = isTestimony ? 0.74 : 0.40;
    const snareCooldown = isTestimony ? 0.48 : 0.09;
    if ((highRise > snareRiseThreshold || audio.high > snareTrigger) && audio.high > snareFloor && (t - this.lastSyntheticSnareT) > snareCooldown) {
      const strength = Math.min(1, audio.high * 1.5 + audio.mid * 0.4);
      allEvents.push({ type: "snare", strength, time: audioTime, synthetic: true });
      this.lastSyntheticSnareT = t;
    }
    this.lastImpact = audio.impact;
    this.lastHigh = audio.high;
    const lyricHit = lyricSignal?.hit || lyricSignal?.upcoming;
    if (lyricHit) {
      allEvents.push({ type: "lyric", strength: isTestimony ? Math.max(0.72, lyricSignal.strength || 0.7) : (lyricSignal.strength || 0.7), time: audioTime, synthetic: true });
    }
    const classified = isTestimony
      ? this.classifyTestimonyState(controls, allEvents, audioTime ?? t, lyricSignal)
      : this.classifyMusicState(controls, allEvents, audioTime ?? t, lyricSignal);
    label = this.smoothMusicState(classified, audioTime ?? t);
    baseW = SECTION_DEFAULTS[label] || SECTION_DEFAULTS.verse;

    // event-driven boosts (additive, decays via composer ignoring sub-threshold)
    let kickBoost = 0, snareBoost = 0, dropBoost = 0;
    for (const e of allEvents) {
      if (e.type === "kick") kickBoost = Math.max(kickBoost, e.strength);
      if (e.type === "snare") snareBoost = Math.max(snareBoost, e.strength);
      if (e.type === "collapse") dropBoost = Math.max(dropBoost, e.strength);
    }

    const intensity = macros.intensity;
    const violence = macros.violence;
    const decay = macros.decay;
    const reactivity = macros.reactivity;
    const ti = macros.temporalInstability;
    const collapseDial = macros.resolutionCollapse;
    const damage = macros.compressionDamage;

    const weights = {
      // Feedback + bloom additive sources trimmed — they used to take growth,
      // pressure, dropBoost AND kickBoost on top of an already-high baseline,
      // so they were never below 0.15 and dominated every frame.
      feedback: baseW.feedback * (0.5 + decay * 0.5) + dropBoost * 0.10,
      // rgbTear / slitScan / pixelSort are PUNCTUATION — they only spike on
      // a snare/kick boost and quickly decay. Base contribution is tiny so
      // they don't sit on top of the image as constant texture.
      rgbTear: baseW.rgbTear * (0.25 + violence * 0.32) + snareBoost * 0.30 + controls.snare * 0.08,
      slitScan: baseW.slitScan * (0.22 + ti * 0.40) + snareBoost * 0.20 + controls.temporalInstability * 0.12,
      pixelSort: baseW.pixelSort * (0.25 + violence * 0.7) + snareBoost * 0.30 + controls.violence * controls.pressure * 0.4,
      datamosh: baseW.datamosh * (0.28 + collapseDial * 0.42) + controls.collapse * 0.26 + dropBoost * 0.28,
      dither: baseW.dither * (0.3 + damage * 0.7) + controls.degradation * 0.35 + controls.hats * 0.08,
      bloom: baseW.bloom * (0.5 + intensity * 0.3) + kickBoost * 0.12 + (lyricSignal?.active ? 0.24 * (lyricSignal.strength || 0.7) : 0),
      // Full-stage flash gated MUCH higher than before (0.92 vs 0.75) so only
      // the absolute hardest kicks white-out the screen. The mid-band fires
      // a softer pulse rather than the old aggressive flash.
      flash: lyricHit ? 0.34 : (kickBoost > 0.92 ? 0.55 : (kickBoost > 0.7 ? kickBoost * 0.22 : 0))
    };

    if (isTestimony) {
      const testimonyEnergy = Math.min(1, (controls.humanPresence || 0) * 0.45 + (controls.vocals || 0) * 0.25 + (controls.growth || 0) * 0.20 + (lyricSignal?.strength || 0) * 0.10);
      weights.feedback = weights.feedback * 0.86 + testimonyEnergy * 0.08;
      weights.dither = weights.dither * 1.18 + testimonyEnergy * 0.07;
      weights.bloom = weights.bloom * 1.10 + testimonyEnergy * 0.10;
      weights.slitScan = weights.slitScan * 0.72 + (lyricHit ? 0.05 : 0);
      weights.rgbTear *= 0.38;
      weights.pixelSort *= 0.32;
      weights.datamosh *= lyricHit ? 0.56 : 0.42;
      weights.flash *= 0.22;
    }

    if (lyricSignal?.active) {
      weights.rgbTear *= 0.62;
      weights.datamosh *= 0.72;
      weights.pixelSort *= 0.80;
    }

    // DOMINANT-SET GATE — suppress non-dominant effects to OFF_SET_GAIN of
    // their calculated weight so 2-3 effects ride at any moment instead of
    // all 7 stacking into a soup. Dominant effects get DOMINANT_BOOST so the
    // featured trio actually reads. Set rotates every DOMINANT_SWAP_S seconds.
    //
    // Critically we pass RAW label here — the substituted "build" label was
    // bypassing the fallback-palette detection and reusing the small build
    // candidate list (only 3 entries), which is why feedback + bloom never
    // appeared in earlier reports. The fallback palette has 10 entries with
    // every effect featured at least twice.
    const dominant = this._currentDominantSet(label, audioTime ?? t, visualMode);
    for (const k of Object.keys(weights)) {
      if (k === "flash") continue;
      weights[k] *= dominant.has(k) ? modeProfile.dominantBoost : modeProfile.offSetGain;
    }

    // transition T (used by morph + datamosh + image plane). Shortened from
    // 1.6-4.0s down to 0.7-2.2s so on fast-cutting drops the image actually
    // RESOLVES before the next cut lands. The old timing meant cuts every
    // 1.5s would chain morphs that never finished — image never readable.
    const transitionDuration = isTestimony
      ? Math.max(1.65, 4.4 - controls.humanPresence * 0.95 - controls.collapse * 0.65)
      : Math.max(0.7, 2.2 - controls.violence * 1.0 - controls.collapse * 0.8);
    const transitionT = Math.min(1, Math.max(0, transitionTime / transitionDuration));
    const transitionMode = this.smoothTransitionMode(this.pickTransitionMode({ label }, controls, lyricSignal, visualMode), audioTime ?? t);

    // Per-transition recipe: while transitionT < 1, multiply each named pass by
    // its mode-specific factor, scaled by a transitionFade curve so it peaks at
    // the cut and decays as the new image resolves. Without this, every
    // transition mode would just be a relabeled morph.
    const recipe = TRANSITION_RECIPES[transitionMode];
    if (recipe && transitionT < 1) {
      const transitionFade = (1 - transitionT) * (1 - transitionT);
      for (const [pass, mult] of Object.entries(recipe)) {
        if (weights[pass] == null) continue;
        // Lerp between baseline (mult=1) and recipe mult, weighted by fade.
        const effective = 1 + (mult - 1) * transitionFade;
        weights[pass] *= effective;
      }
    }

    // NEGATIVE-SPACE HOLD — at section boundaries that mark a drop approach,
    // hold a beat of stillness so the next hit lands. Triggers on the cut
    // INTO pre_drop (from breakdown) and INTO drop (from pre_drop). Duration
    // is ~0.45s, which is roughly a half-bar at 120bpm and falls naturally
    // inside the morph window so the image is mid-transition during silence.
    if (this.lastSectionLabel !== label) {
      if ((this.lastSectionLabel === "breakdown" && label === "pre_drop") ||
          (this.lastSectionLabel === "pre_drop" && label === "drop") ||
          (this.lastSectionLabel === "build" && label === "drop")) {
        this.holdUntilT = t + 0.45;
      }
      this.lastSectionLabel = label;
    }
    const holdActive = t < this.holdUntilT;
    if (holdActive) {
      for (const k of Object.keys(weights)) weights[k] *= 0.06;
    }

    // DOCTRINE bias — multiply per-pass weight by the active preset's signature.
    // Applied BEFORE ceilings so a preset can suppress an effect (multiplier < 1)
    // without the ceiling kicking back in, and so an uplifted effect still
    // respects the legibility cap.
    if (doctrineBias) {
      for (const k of Object.keys(weights)) {
        if (k === "flash") continue;
        const bias = doctrineBias[k];
        if (bias != null) weights[k] *= bias;
      }
    }

    // Apply ceilings AFTER recipes + holds + doctrine so transition boosts
    // can't push the image past the legibility cap, but punctuation effects
    // still hit hard.
    for (const k of Object.keys(weights)) {
      if (k === "flash") continue;
      const ceiling = modeProfile.ceilings[k];
      if (ceiling != null) weights[k] = Math.max(0, Math.min(ceiling, weights[k]));
    }

    return {
      controls,
      audio,
      events: allEvents,
      section,
      sourceSection: ignoredSectionLabel,
      musicState: label,
      macros,
      weights,
      transitionT,
      transitionMode,
      holdActive,
      activeDominant: this._activeDominant,
      visualMode
    };
  }
}

function clamp(v) { return Math.max(0, Math.min(1, v)); }
function capped(name, v) { return Math.max(0, Math.min(PASS_CEILING[name] ?? 1, v)); }
