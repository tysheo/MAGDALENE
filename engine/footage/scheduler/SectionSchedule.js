// Cut-time placement + shuffle-bag image assignment for the pre-built
// schedule. Lives here (not in FoundFootageApp) so it can be unit-tested without a
// browser — accepts plain arrays in, returns plain arrays out.

const DEFAULTS = {
  minHold: 2.5,
  maxGap: 5.0,
  kickThreshold: 0.45,
  snareThreshold: 0.72,
  collapseThreshold: 0.35,
  vocalThreshold: 0.66,
  lyricThreshold: 0.45,
  includeSnare: false,
  includeVocal: false,
  includeLyric: false
};

export function buildCutTimes(events, duration, opts = {}) {
  const {
    minHold,
    maxGap,
    kickThreshold,
    snareThreshold,
    collapseThreshold,
    vocalThreshold,
    lyricThreshold,
    includeSnare,
    includeVocal,
    includeLyric
  } = { ...DEFAULTS, ...opts };
  const candidates = (events || [])
    .filter((e) => {
      if (e.type === "kick") return e.strength > kickThreshold;
      if (e.type === "collapse") return e.strength > collapseThreshold;
      if (includeSnare && e.type === "snare") return e.strength > snareThreshold;
      if (includeVocal && e.type === "vocal_phrase") return e.strength > vocalThreshold;
      if (includeLyric && e.type === "lyric") return e.strength > lyricThreshold;
      return false;
    })
    .map((e) => e.time)
    .sort((a, b) => a - b);

  const cuts = [];
  let last = -Infinity;
  for (const t of candidates) {
    if (t > 0 && t < duration && t - last >= minHold) {
      cuts.push(t);
      last = t;
    }
  }

  // Fill any gap > maxGap with time-based cuts, including the tail after the
  // last beat event. Without this, sparse beat detection leaves long stretches
  // of the song without a single cut.
  cuts.sort((a, b) => a - b);
  const filled = [];
  let prev = 0;
  for (const t of cuts) {
    while (t - prev > maxGap) {
      const insertAt = prev + maxGap;
      filled.push(insertAt);
      prev = insertAt;
    }
    filled.push(t);
    prev = t;
  }
  while (duration - prev > maxGap) {
    const insertAt = prev + maxGap;
    filled.push(insertAt);
    prev = insertAt;
  }
  return filled;
}

export function assignImagesToSchedule(cutTimes, imageIds, rng = Math.random) {
  if (!imageIds.length) return [];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  let bag = shuffle(imageIds);
  let bagIdx = 0;
  const nextFromBag = (excludeId) => {
    if (bagIdx >= bag.length) { bag = shuffle(imageIds); bagIdx = 0; }
    if (bagIdx === 0 && bag[0] === excludeId && bag.length > 1) {
      [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    return bag[bagIdx++];
  };

  const schedule = [];
  let lastId = null;
  schedule.push({ time: 0, imageId: nextFromBag(null) });
  lastId = schedule[0].imageId;
  for (const t of cutTimes) {
    const id = nextFromBag(lastId);
    schedule.push({ time: t, imageId: id });
    lastId = id;
  }
  return schedule;
}

export function buildSchedule(events, duration, images, opts = {}) {
  if (!images?.length) return [];
  const cuts = buildCutTimes(events, duration, opts);
  return assignImagesToSchedule(cuts, images.map((i) => i.id), opts.rng);
}
