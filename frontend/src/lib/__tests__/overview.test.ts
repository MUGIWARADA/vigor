import { describe, expect, it } from 'vitest'
import {
  buildRealTrendingTopics,
  matchHighlightsUrl,
  playerHighlightsUrl,
  rankRealScorers,
  xSearchUrl,
  youtubeSearchUrl,
} from '@/lib/overview'
import type { FixtureView, ScorerView, StandingsView } from '@/lib/footballData'

const scorers: ScorerView[] = [
  { playerName: 'Bruno Fernandes', nationality: 'Portugal', teamName: 'Manchester United', teamTla: 'MUN', playedMatches: 10, goals: 9, assists: 2, penalties: 1 },
  { playerName: 'Creator Man', nationality: null, teamName: 'Playmakers', teamTla: 'PLY', playedMatches: 11, goals: 3, assists: 10, penalties: 0 },
  { playerName: 'No Assists Data', nationality: null, teamName: 'Gaps FC', teamTla: 'GAP', playedMatches: null, goals: 12, assists: null, penalties: null },
]

const fixtures: FixtureView[] = [
  {
    id: 1, utcDate: '2026-10-17T19:45:00Z', status: 'FINISHED', matchday: 8, stageLabel: 'Regular season',
    groupLabel: null, homeName: 'Big FC', homeTla: 'BIG', awayName: 'Small United', awayTla: 'SMA',
    homeGoals: 6, awayGoals: 0, finished: true,
  },
  {
    id: 2, utcDate: '2026-10-24T19:45:00Z', status: 'TIMED', matchday: 9, stageLabel: 'Regular season',
    groupLabel: null, homeName: 'Big FC', homeTla: 'BIG', awayName: 'Mid Town', awayTla: 'MID',
    homeGoals: null, awayGoals: null, finished: false,
  },
]

const standings: StandingsView = {
  stageLabel: 'Regular season',
  competitionName: 'Premier League',
  currentMatchday: 9,
  rows: [
    { position: 1, teamName: 'Big FC', teamTla: 'BIG', played: 8, won: 7, drawn: 1, lost: 0, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, points: 22 },
  ],
}

describe('overview external links (real data only)', () => {
  it('builds encoded YouTube and X search URLs', () => {
    expect(youtubeSearchUrl('Bruno Fernandes goals')).toBe(
      'https://www.youtube.com/results?search_query=Bruno%20Fernandes%20goals',
    )
    expect(xSearchUrl('Big FC 6-0')).toContain('https://x.com/search?q=Big%20FC%206-0')
    expect(playerHighlightsUrl('Bruno Fernandes', 'Manchester United')).toContain(
      encodeURIComponent('Bruno Fernandes Manchester United highlights'),
    )
    expect(matchHighlightsUrl('Big FC', 'Small United')).toContain(
      encodeURIComponent('Big FC vs Small United highlights'),
    )
  })
})

describe('rankRealScorers', () => {
  it('ranks by goal involvement and treats missing assists as 0 (gated, not invented)', () => {
    const ranked = rankRealScorers(scorers)
    expect(ranked.map((r) => r.playerName)).toEqual(['Creator Man', 'No Assists Data', 'Bruno Fernandes'])
    expect(ranked[0]!.involvement).toBe(13)
    expect(ranked[1]!.involvement).toBe(12)
    // Missing feed fields stay missing.
    expect(ranked[1]!.assists).toBeNull()
    expect(ranked[1]!.playedMatches).toBeNull()
  })
})

describe('buildRealTrendingTopics', () => {
  it('derives factual topics, each with an X search query', () => {
    const topics = buildRealTrendingTopics('Premier League', scorers, fixtures, standings)
    expect(topics.map((t) => t.id)).toEqual([
      'real-top-scorer',
      'real-top-assister',
      'real-leader',
      'real-big-result',
    ])
    for (const t of topics) expect(t.xQuery).toBeTruthy()
    expect(topics[3]!.title).toContain('6–0')
  })

  it('omits topics the feed cannot support', () => {
    expect(buildRealTrendingTopics('Premier League', [], [], null)).toEqual([])
  })
})
