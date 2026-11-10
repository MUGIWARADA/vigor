import type { Match, MatchEvent, Player, PositionGroup } from '@/types'
import { groupOf } from './positions'

/**
 * Season shot map + xG-per-shot profile (ScoutLab-inspired), computed from
 * stored shot and goal events.
 *
 * Attempts = shot events + goal events (in this dataset goals are stored as
 * their own event type with an xG payload). Outcomes beyond goal / no-goal
 * (saved, blocked, off-target) and shot body part are NOT stored — the UI
 * must not present them. Coordinates are normalised into attacking
 * orientation exactly like the pass/carry maps.
 */

export interface ShotPoint {
  x: number
  y: number
  /** Shot xG (model estimate stored on the event). */
  xg: number
  goal: boolean
}

export interface XgBand {
  label: string
  min: number
  max: number
}

export const XG_BANDS: XgBand[] = [
  { label: '<.05', min: 0, max: 0.05 },
  { label: '.05–.10', min: 0.05, max: 0.1 },
  { label: '.10–.20', min: 0.1, max: 0.2 },
  { label: '.20–.30', min: 0.2, max: 0.3 },
  { label: '.30–.50', min: 0.3, max: 0.5 },
  { label: '.50+', min: 0.5, max: 1.01 },
]

const BIG_CHANCE_XG = 0.3
const BOX_X = 83
const BOX_Y_MIN = 20.4
const BOX_Y_MAX = 79.6

const round2 = (v: number) => Math.round(v * 100) / 100

function normalizePoint(e: MatchEvent, match: Match | undefined): { x: number; y: number } | null {
  if (e.x === undefined || e.y === undefined) return null
  const attackingRight = match ? e.teamId === match.homeTeamId : true
  return attackingRight ? { x: e.x, y: e.y } : { x: 100 - e.x, y: 100 - e.y }
}

/** Collect every stored attempt for one player, attacking-right. */
export function collectPlayerShots(
  events: MatchEvent[],
  matches: Match[],
  playerId: string,
): ShotPoint[] {
  const matchById = new Map(matches.map((m) => [m.id, m]))
  const out: ShotPoint[] = []
  for (const e of events) {
    if (e.playerId !== playerId) continue
    if (e.type !== 'shot' && e.type !== 'goal') continue
    const p = normalizePoint(e, matchById.get(e.matchId))
    if (!p) continue
    out.push({ ...p, xg: e.value ?? 0, goal: e.type === 'goal' })
  }
  return out
}

export interface PlayerShotSummary {
  attempts: number
  goals: number
  conversionPct: number | null
  totalXg: number
  avgXgPerShot: number
  goalsMinusXg: number
  bigChances: number
  insideBoxSharePct: number | null
  points: ShotPoint[]
  /** Share of attempts (%) per XG_BANDS entry. */
  bandShares: number[]
}

export function summarizeShots(points: ShotPoint[]): Omit<PlayerShotSummary, 'points'> {
  const attempts = points.length
  const goals = points.filter((p) => p.goal).length
  const totalXg = points.reduce((s, p) => s + p.xg, 0)
  const bandShares = XG_BANDS.map((b) => {
    if (attempts === 0) return 0
    const n = points.filter((p) => p.xg >= b.min && p.xg < b.max).length
    return round2((n / attempts) * 100)
  })
  return {
    attempts,
    goals,
    conversionPct: attempts > 0 ? round2((goals / attempts) * 100) : null,
    totalXg: round2(totalXg),
    avgXgPerShot: attempts > 0 ? round2(totalXg / attempts) : 0,
    goalsMinusXg: round2(goals - totalXg),
    bigChances: points.filter((p) => p.xg >= BIG_CHANCE_XG).length,
    insideBoxSharePct:
      attempts > 0
        ? round2(
            (points.filter((p) => p.x >= BOX_X && p.y >= BOX_Y_MIN && p.y <= BOX_Y_MAX).length /
              attempts) *
              100,
          )
        : null,
    bandShares,
  }
}

export function computePlayerShotMap(
  events: MatchEvent[],
  matches: Match[],
  player: Player,
): PlayerShotSummary {
  const points = collectPlayerShots(events, matches, player.id)
  return { ...summarizeShots(points), points }
}

/**
 * Peer shot-quality distributions for the beeswarm: for each xG band, the
 * share (%) of each qualifying peer's attempts in that band. Peers = same
 * position group, >= minAttempts stored attempts. Capped for rendering.
 */
export function computePeerBandShares(
  events: MatchEvent[],
  matches: Match[],
  players: Player[],
  group: PositionGroup,
  minAttempts = 8,
  cap = 140,
): { shares: number[][]; peerCount: number } {
  const peers = players.filter((p) => groupOf(p.position) === group)
  const peerIds = new Set(peers.map((p) => p.id))
  const matchById = new Map(matches.map((m) => [m.id, m]))

  // One pass over events, bucketed by player.
  const byPlayer = new Map<string, number[]>()
  for (const e of events) {
    if (!e.playerId || !peerIds.has(e.playerId)) continue
    if (e.type !== 'shot' && e.type !== 'goal') continue
    const p = normalizePoint(e, matchById.get(e.matchId))
    if (!p) continue
    const list = byPlayer.get(e.playerId) ?? []
    list.push(e.value ?? 0)
    byPlayer.set(e.playerId, list)
  }

  const qualifying = [...byPlayer.entries()]
    .filter(([, xgs]) => xgs.length >= minAttempts)
    .sort((a, b) => a[0].localeCompare(b[0]))

  const shares: number[][] = XG_BANDS.map(() => [])
  for (const [, xgs] of qualifying.slice(0, cap)) {
    XG_BANDS.forEach((b, i) => {
      const n = xgs.filter((v) => v >= b.min && v < b.max).length
      shares[i]!.push(round2((n / xgs.length) * 100))
    })
  }
  return { shares, peerCount: Math.min(qualifying.length, cap) }
}

/** Diverging shot-quality colour (matches the map legend: low→high xG). */
export function xgColor(xg: number): string {
  if (xg < 0.05) return '#3e8fbF'.toLowerCase()
  if (xg < 0.1) return '#63c5b5'
  if (xg < 0.2) return '#a8dd70'
  if (xg < 0.3) return '#f2d13c'
  if (xg < 0.5) return '#f4902a'
  return '#e53a2e'
}
