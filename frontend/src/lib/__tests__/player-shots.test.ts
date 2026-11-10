import { describe, expect, it } from 'vitest'
import { buildDemoDataset } from '@/data/generate'
import { computePeerBandShares, computePlayerShotMap, XG_BANDS } from '@/lib/playerShots'
import { buildPlayerCardSvg } from '@/lib/playerCard'
import { computeAllRoundSeasonRatings } from '@/lib/ratings'

const ds = buildDemoDataset()

describe('season shot map', () => {
  it('reconciles event goals with the season goal tally and normalises orientation', () => {
    const scorer = [...ds.players].sort((a, b) => b.stats.goals - a.stats.goals)[0]!
    const sm = computePlayerShotMap(ds.events, ds.matches, scorer)
    expect(sm.goals).toBe(scorer.stats.goals)
    expect(sm.attempts).toBeGreaterThan(sm.goals)
    // Every goal event is generated at x 84–96 in attacking orientation:
    // after normalisation ALL goal points must sit in that window.
    for (const p of sm.points.filter((pt) => pt.goal)) {
      expect(p.x).toBeGreaterThanOrEqual(84)
      expect(p.x).toBeLessThanOrEqual(96)
    }
    const bandTotal = sm.bandShares.reduce((a, b) => a + b, 0)
    expect(bandTotal).toBeGreaterThan(99)
    expect(bandTotal).toBeLessThan(101)
    expect(sm.bandShares).toHaveLength(XG_BANDS.length)
  })

  it('returns zero attempts for a goalkeeper (card hides for them)', () => {
    const gk = ds.players.find((p) => p.position === 'GK')!
    expect(computePlayerShotMap(ds.events, ds.matches, gk).attempts).toBe(0)
  })

  it('builds peer band shares for the beeswarm', () => {
    const { shares, peerCount } = computePeerBandShares(ds.events, ds.matches, ds.players, 'ST')
    expect(peerCount).toBeGreaterThan(50)
    expect(shares).toHaveLength(XG_BANDS.length)
    expect(shares[0]!.length).toBe(peerCount)
  })
})

describe('exportable player card', () => {
  it('renders name, rating and the DEMO watermark into a standalone SVG', () => {
    const ratings = computeAllRoundSeasonRatings(ds.players, 450)
    const top = ratings[0]!
    const player = ds.players.find((p) => p.id === top.playerId)!
    const svg = buildPlayerCardSvg({
      player,
      team: ds.teams.find((t) => t.id === player.teamId),
      rating: top,
      shotPoints: computePlayerShotMap(ds.events, ds.matches, player).points,
      seasonLabel: ds.season.label,
    })
    expect(svg).toContain('<svg')
    expect(svg).toContain(player.name)
    expect(svg).toContain(top.rating.toFixed(1))
    expect(svg).toContain('DEMO — fictional data')
    // The wordmark is two-tone, so it is split across a <tspan> and the literal
    // string never appears in the markup. Assert the reader-visible text, not
    // the serialisation: strip tags, then look for the brand.
    expect(svg.replace(/<[^>]+>/g, '')).toContain('Vigor')
  })
})
