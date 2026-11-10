import { describe, expect, it } from 'vitest'
import { mapFixtures, mapScorers, mapStandings } from '@/lib/footballData'
import {
  matchesPlEnv,
  scorersPlEnv,
  standingsClEnv,
  standingsPlEnv,
} from './fixtures/football-data-fixtures'

/* ------------------------------------------------------------------ */
/* football-data.org mappers: known real inputs → expected outputs.     */
/* The fixtures are trimmed copies of actual free-tier API responses    */
/* captured 2026-10-16 (Premier League 2026/27 matchday 7).             */
/* ------------------------------------------------------------------ */

describe('mapStandings', () => {
  it('maps the TOTAL table with real values', () => {
    const view = mapStandings(standingsPlEnv)
    expect(view.stageLabel).toBe('Regular season')
    expect(view.competitionName).toBe('Premier League')
    expect(view.currentMatchday).toBe(7)
    expect(view.rows).toHaveLength(8)
    const top = view.rows[0]!
    expect(top.position).toBe(1)
    expect(top.teamName).toBe('Manchester City FC')
    expect(top.teamTla).toBe('MCI')
    expect(top.played).toBe(6)
    expect(top.won).toBe(6)
    expect(top.drawn).toBe(0)
    expect(top.lost).toBe(0)
    expect(top.goalsFor).toBe(16)
    expect(top.goalsAgainst).toBe(5)
    expect(top.goalDifference).toBe(11)
    expect(top.points).toBe(18)
  })

  it('maps the Champions League league-phase table (36-team single table)', () => {
    const view = mapStandings(standingsClEnv)
    expect(view.stageLabel).toBe('League phase')
    expect(view.rows).toHaveLength(6)
    expect(view.rows[0]!.teamName).toBe('Paris Saint-Germain FC')
    expect(view.rows[0]!.points).toBe(6)
  })

  it('keeps the provenance envelope data (source, fetch time)', () => {
    expect(standingsPlEnv.source).toContain('football-data.org')
    expect(standingsPlEnv.fetchedAt).toBe('2026-10-16T13:14:07Z')
    expect(standingsPlEnv.cached).toBe(false)
  })
})

describe('mapFixtures', () => {
  it('maps finished matches with scores', () => {
    const fixtures = mapFixtures(matchesPlEnv)
    expect(fixtures).toHaveLength(6)
    const first = fixtures[0]!
    expect(first.homeName).toBe('Arsenal FC')
    expect(first.finished).toBe(true)
    expect(first.homeGoals).toBe(2)
    expect(first.awayGoals).toBe(1)
    expect(first.stageLabel).toBe('Regular season')
    expect(first.matchday).toBe(6)
  })

  it('maps upcoming matches with null scores, never zero-filled', () => {
    const fixtures = mapFixtures(matchesPlEnv)
    const timed = fixtures.filter((f) => !f.finished)
    expect(timed.length).toBe(2)
    for (const f of timed) {
      expect(f.homeGoals).toBeNull()
      expect(f.awayGoals).toBeNull()
    }
  })
})

describe('mapScorers', () => {
  it('maps real scorer values including null assists/penalties', () => {
    const scorers = mapScorers(scorersPlEnv)
    expect(scorers).toHaveLength(5)
    const top = scorers[0]!
    expect(top.playerName).toBe('Erling Haaland')
    expect(top.nationality).toBe('Norway')
    expect(top.teamTla).toBe('MCI')
    expect(top.goals).toBe(6)
    expect(top.assists).toBeNull()
    expect(top.penalties).toBeNull()
    // goals must be non-increasing down the list (provider sorts by goals)
    for (let i = 1; i < scorers.length; i++) {
      expect(scorers[i]!.goals).toBeLessThanOrEqual(scorers[i - 1]!.goals)
    }
  })
})
