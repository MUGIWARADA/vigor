import { describe, expect, it } from 'vitest'
import {
  filterTeamMatches,
  opponentIdForTeam,
  resultForTeam,
  teamsInCompetition,
} from '@/lib/matchPreview'
import type { Match, Team } from '@/types'

const match = (patch: Partial<Match>): Match => ({
  id: 'm-1',
  competitionId: 'league',
  seasonId: 'season-1',
  round: 1,
  kickoff: '2026-08-01T15:00:00Z',
  homeTeamId: 'alpha',
  awayTeamId: 'beta',
  homeGoals: 2,
  awayGoals: 1,
  venue: 'Test Stadium',
  possessionHome: 50,
  shotsHome: 10,
  shotsAway: 8,
  provenance: 'DEMO',
  ...patch,
})

const teams: Team[] = ['alpha', 'beta', 'gamma', 'delta'].map((id) => ({
  id,
  name: id[0]!.toUpperCase() + id.slice(1),
  shortName: id.slice(0, 3).toUpperCase(),
  city: 'Test City',
  style: 'Direct',
  formation: '4-3-3',
  color: '#ffffff',
  provenance: 'DEMO',
  sourceName: 'Test',
}))

const matches = [
  match({ id: 'old-win', kickoff: '2026-08-01T15:00:00Z' }),
  match({
    id: 'cup-loss',
    competitionId: 'cup',
    seasonId: 'season-cup',
    kickoff: '2026-09-01T15:00:00Z',
    homeTeamId: 'gamma',
    awayTeamId: 'alpha',
    homeGoals: 3,
    awayGoals: 1,
  }),
  match({
    id: 'new-draw',
    kickoff: '2026-10-01T15:00:00Z',
    homeTeamId: 'alpha',
    awayTeamId: 'gamma',
    homeGoals: 1,
    awayGoals: 1,
  }),
  match({ id: 'unrelated', homeTeamId: 'beta', awayTeamId: 'delta' }),
]

describe('match preview helpers', () => {
  it('reads results and opponents from the selected team perspective', () => {
    expect(resultForTeam(matches[0]!, 'alpha')).toBe('W')
    expect(resultForTeam(matches[0]!, 'beta')).toBe('L')
    expect(resultForTeam(matches[1]!, 'alpha')).toBe('L')
    expect(resultForTeam(matches[2]!, 'alpha')).toBe('D')
    expect(resultForTeam(matches[0]!, 'gamma')).toBeNull()
    expect(opponentIdForTeam(matches[1]!, 'alpha')).toBe('gamma')
  })

  it('derives competition participants from played fixtures', () => {
    expect(teamsInCompetition(matches, teams, 'cup').map((team) => team.id)).toEqual(['alpha', 'gamma'])
  })

  it('filters by competition, opponent, result and season, latest first', () => {
    expect(
      filterTeamMatches(matches, 'alpha', { competitionId: 'all', opponentId: 'all', result: 'all' }).map((m) => m.id),
    ).toEqual(['new-draw', 'cup-loss', 'old-win'])

    expect(
      filterTeamMatches(matches, 'alpha', { competitionId: 'league', opponentId: 'all', result: 'all' }).map((m) => m.id),
    ).toEqual(['new-draw', 'old-win'])

    expect(
      filterTeamMatches(matches, 'alpha', { competitionId: 'all', opponentId: 'gamma', result: 'L' }).map((m) => m.id),
    ).toEqual(['cup-loss'])

    expect(
      filterTeamMatches(matches, 'alpha', {
        competitionId: 'all',
        opponentId: 'all',
        result: 'all',
        seasonIds: new Set(['season-cup']),
      }).map((m) => m.id),
    ).toEqual(['cup-loss'])
  })
})
