import type { Match, MatchEvent, Player } from '@/types'

/**
 * Season pass & carry maps for a player (ScoutLab-inspired), computed from
 * the stored two-point events.
 *
 * Orientation: stored coordinates are match-oriented (home attacks toward
 * x=100, away toward x=0 with a 180° rotation). Every segment here is
 * normalised into the player's attacking orientation (own goal x=0 →
 * opponent goal x=100, player's left flank stays left), so a season of
 * home+away matches draws as one coherent map attacking right.
 *
 * Honesty: the stored passes are a SAMPLE of each match's passing (see the
 * generator), so consumers must show the sample size next to the map. Rates
 * computed over the sample are labelled CALCULATED over stored events, not
 * full-match tracking data.
 */

export interface MapSegment {
  x: number
  y: number
  endX: number
  endY: number
  /** Forward progress toward the opponent goal (endX − x, pitch units). */
  progression: number
  /** Euclidean length in pitch units. */
  length: number
  progressive: boolean
  finalThirdEntry: boolean
}

/** Progressive = moves the ball at least 10 pitch units closer to goal. */
export const PROGRESSIVE_THRESHOLD = 10
const FINAL_THIRD_X = 66.7

function normalize(
  e: MatchEvent,
  match: Match | undefined,
): { x: number; y: number; endX: number; endY: number } | null {
  if (e.x === undefined || e.y === undefined || e.endX === undefined || e.endY === undefined) return null
  const attackingRight = match ? e.teamId === match.homeTeamId : true
  return attackingRight
    ? { x: e.x, y: e.y, endX: e.endX, endY: e.endY }
    : { x: 100 - e.x, y: 100 - e.y, endX: 100 - e.endX, endY: 100 - e.endY }
}

function toSegment(n: { x: number; y: number; endX: number; endY: number }): MapSegment {
  const progression = n.endX - n.x
  return {
    ...n,
    progression,
    length: Math.hypot(n.endX - n.x, n.endY - n.y),
    progressive: progression >= PROGRESSIVE_THRESHOLD,
    finalThirdEntry: n.x < FINAL_THIRD_X && n.endX >= FINAL_THIRD_X,
  }
}

const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
const round1 = (v: number) => Math.round(v * 10) / 10

export interface ChannelShares {
  left: number
  central: number
  right: number
}

function channelShares(segments: MapSegment[]): ChannelShares {
  if (segments.length === 0) return { left: 0, central: 0, right: 0 }
  let left = 0
  let central = 0
  let right = 0
  for (const s of segments) {
    if (s.y < 33.3) left += 1
    else if (s.y > 66.7) right += 1
    else central += 1
  }
  const n = segments.length
  return {
    left: round1((left / n) * 100),
    central: round1((central / n) * 100),
    right: round1((right / n) * 100),
  }
}

export interface PlayerPassMap {
  completed: MapSegment[]
  /** Counts over the stored pass SAMPLE for this player. */
  sampleCompleted: number
  sampleIncomplete: number
  completionPct: number | null
  progressiveCount: number
  progressiveSharePct: number | null
  finalThirdEntries: number
  avgLength: number
  avgProgression: number
  avgStartX: number
  channels: ChannelShares
  matchesSampled: number
}

export function computePlayerPassMap(
  events: MatchEvent[],
  matches: Match[],
  player: Player,
): PlayerPassMap {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const completed: MapSegment[] = []
  let incomplete = 0
  const matchIds = new Set<string>()

  for (const e of events) {
    if (e.playerId !== player.id) continue
    if (e.type === 'incomplete-pass') {
      incomplete += 1
      matchIds.add(e.matchId)
      continue
    }
    if (e.type !== 'pass') continue
    const n = normalize(e, matchById.get(e.matchId))
    if (!n) continue
    completed.push(toSegment(n))
    matchIds.add(e.matchId)
  }

  const total = completed.length + incomplete
  const progressive = completed.filter((s) => s.progressive)
  return {
    completed,
    sampleCompleted: completed.length,
    sampleIncomplete: incomplete,
    completionPct: total > 0 ? round1((completed.length / total) * 100) : null,
    progressiveCount: progressive.length,
    progressiveSharePct:
      completed.length > 0 ? round1((progressive.length / completed.length) * 100) : null,
    finalThirdEntries: completed.filter((s) => s.finalThirdEntry).length,
    avgLength: round1(avg(completed.map((s) => s.length))),
    avgProgression: round1(avg(completed.map((s) => s.progression))),
    avgStartX: round1(avg(completed.map((s) => s.x))),
    channels: channelShares(completed),
    matchesSampled: matchIds.size,
  }
}

export interface PlayerCarryMap {
  carries: MapSegment[]
  count: number
  totalDistance: number
  avgDistance: number
  intoFinalThird: number
  avgEndX: number
  channels: ChannelShares
}

export function computePlayerCarryMap(
  events: MatchEvent[],
  matches: Match[],
  player: Player,
): PlayerCarryMap {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const carries: MapSegment[] = []
  for (const e of events) {
    if (e.playerId !== player.id || e.type !== 'progressive-carry') continue
    const n = normalize(e, matchById.get(e.matchId))
    if (!n) continue
    carries.push(toSegment(n))
  }
  return {
    carries,
    count: carries.length,
    totalDistance: Math.round(carries.reduce((s, c) => s + c.length, 0)),
    avgDistance: round1(avg(carries.map((c) => c.length))),
    intoFinalThird: carries.filter((c) => c.finalThirdEntry).length,
    avgEndX: round1(avg(carries.map((c) => c.endX))),
    channels: channelShares(carries),
  }
}
