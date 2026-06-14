// Minimal LRC parser. Turns standard `[mm:ss.xx] text` lyric files into a
// sorted list of timed lines, plus a helper to find the active line index for
// a playback time. Used by the stage's 3-line synced lyric overlay.

export type LyricLine = {
  time: number
  text: string
}

const TIME_TAG = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const line of raw.split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0
    const stamps: number[] = []
    let match: RegExpExecArray | null
    while ((match = TIME_TAG.exec(line))) {
      const min = Number(match[1])
      const sec = Number(match[2])
      const frac = match[3] ? Number(`0.${match[3]}`) : 0
      stamps.push(min * 60 + sec + frac)
    }
    if (!stamps.length) continue
    const text = line.replace(TIME_TAG, '').trim()
    if (!text) continue
    for (const time of stamps) lines.push({ time, text })
  }
  lines.sort((a, b) => a.time - b.time)
  return lines
}

// Index of the latest line whose timestamp has passed, or -1 before the first.
export function activeLyricIndex(lines: LyricLine[], t: number): number {
  let lo = 0
  let hi = lines.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].time <= t) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}
