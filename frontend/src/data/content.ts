import type {
  DiscussionPost,
  FormChange,
  NewsArticle,
  Player,
  Shortlist,
  TacticalScenario,
} from '@/types'
import type { DemoDataset } from './generate'
import { metricPer90Value } from '@/lib/metrics'
import { groupOf } from '@/lib/positions'
import { last3Rating, seasonRating } from './generate'
import { ageAt } from '@/lib/utils'

/**
 * Derived DEMO content: news articles, discussion posts, shortlists and
 * form changes. All authors, outlets and headlines are fictional. Where a
 * post cites a statistic, the number is computed from the demo dataset so
 * the platform's numbers stay internally consistent.
 */

export interface DemoContent {
  news: NewsArticle[]
  discussions: DiscussionPost[]
  shortlists: Shortlist[]
  formChanges: FormChange[]
  demoScenarios: TacticalScenario[]
}

const OUTLETS = [
  'The Atlantic Football Chronicle (demo source)',
  'Matchday Weekly (demo source)',
  'Set Piece Journal (demo source)',
  'Terrace Analytics (demo source)',
] as const

function withMinMinutes(players: Player[], minMinutes: number): Player[] {
  return players.filter((p) => p.stats.minutes >= minMinutes)
}

function topBy(
  players: Player[],
  metricId: string,
  filter?: (p: Player) => boolean,
): Player[] {
  return players
    .filter((p) => (filter ? filter(p) : true))
    .filter((p) => metricPer90Value(p.stats, metricId) !== null)
    .sort(
      (a, b) =>
        (metricPer90Value(b.stats, metricId) ?? -Infinity) -
        (metricPer90Value(a.stats, metricId) ?? -Infinity),
    )
}

export function buildDemoContent(ds: DemoDataset): DemoContent {
  const { players, matches, playerMatchMinutes, teams } = ds
  const teamById = new Map(teams.map((t) => [t.id, t]))

  const topScorer = [...players].sort((a, b) => b.stats.goals - a.stats.goals)[0]!
  const topCreator = [...players].sort((a, b) => b.stats.assists - a.stats.assists)[0]!
  const progressiveCB = topBy(players, 'progressive_passes', (p) => p.position === 'CB')[0]!
  const presser = topBy(players, 'recoveries_final_third')[0]!
  const youngCandidates = players.filter((p) => ageAt(p.dob) <= 21 && groupOf(p.position) !== 'GK')
  const youngGun =
    topBy(youngCandidates.length > 0 ? youngCandidates : players.filter((p) => groupOf(p.position) !== 'GK'), 'xa')[0]
      ?? topCreator
  const veteran =
    [...players]
      .filter((p) => ageAt(p.dob) >= 30 && p.stats.minutes > 400)
      .sort((a, b) => b.stats.minutes - a.stats.minutes)[0]
      ?? [...players].sort((a, b) => b.stats.minutes - a.stats.minutes)[0]!
  const busiestMatch = [...matches].sort(
    (a, b) => b.homeGoals + b.awayGoals - (a.homeGoals + a.awayGoals),
  )[0]!
  const favourite = teamById.get('t-brm-01')!

  /* ---------------- News ---------------- */

  const news: NewsArticle[] = [
    {
      id: 'n-001',
      title: `${teamById.get(busiestMatch.homeTeamId)!.name} and ${teamById.get(busiestMatch.awayTeamId)!.name} serve up ${busiestMatch.homeGoals + busiestMatch.awayGoals}-goal classic`,
      source: OUTLETS[0],
      publishedAt: '2026-10-14T08:30:00Z',
      category: 'match-report',
      teamId: busiestMatch.homeTeamId,
      summary:
        `A frantic contest at ${busiestMatch.venue} ended ${busiestMatch.homeGoals}–${busiestMatch.awayGoals}. ` +
        'Demo article generated from fictional league data — no real match took place.',
      provenance: 'DEMO',
    },
    {
      id: 'n-002',
      title: `${topScorer.name} leads the golden-boot race, but what do the underlying numbers say?`,
      source: OUTLETS[3],
      publishedAt: '2026-10-13T15:00:00Z',
      category: 'analysis',
      playerId: topScorer.id,
      teamId: topScorer.teamId,
      summary:
        `${topScorer.stats.goals} goals from ${topScorer.stats.xg.toFixed(1)} xG — ` +
        'our (fictional) analytics desk looks at whether the rate is sustainable. Demo article.',
      provenance: 'DEMO',
    },
    {
      id: 'n-003',
      title: `Scouts flock to ${youngGun.name} after breakout run for ${teamById.get(youngGun.teamId)!.name}`,
      source: OUTLETS[1],
      publishedAt: '2026-10-12T11:45:00Z',
      category: 'transfer',
      playerId: youngGun.id,
      teamId: youngGun.teamId,
      summary:
        `The ${ageAt(youngGun.dob)}-year-old's creative numbers have caught the eye of several fictional clubs. Demo article.`,
      provenance: 'DEMO',
    },
    {
      id: 'n-004',
      title: `How ${favourite.name} use their double pivot to control build-up`,
      source: OUTLETS[2],
      publishedAt: '2026-10-11T09:15:00Z',
      category: 'tactical',
      teamId: favourite.id,
      summary:
        'A (fictional) tactical review of the league leaders\' structured progression patterns. Demo article.',
      provenance: 'DEMO',
    },
    {
      id: 'n-005',
      title: `${progressiveCB.name}: the centre-back teams are building around`,
      source: OUTLETS[2],
      publishedAt: '2026-10-10T14:20:00Z',
      category: 'analysis',
      playerId: progressiveCB.id,
      teamId: progressiveCB.teamId,
      summary:
        `${(metricPer90Value(progressiveCB.stats, 'progressive_passes') ?? 0).toFixed(1)} progressive passes per 90 lead all centre-backs in the (fictional) APL. Demo article.`,
      provenance: 'DEMO',
    },
    {
      id: 'n-006',
      title: `${teamById.get(presser.teamId)!.name} top the field-position battle thanks to relentless high pressing`,
      source: OUTLETS[3],
      publishedAt: '2026-10-09T17:00:00Z',
      category: 'tactical',
      playerId: presser.id,
      teamId: presser.teamId,
      summary:
        `${presser.name} leads the (fictional) league for final-third recoveries. Demo article about pressing proxies in event data.`,
      provenance: 'DEMO',
    },
    {
      id: 'n-007',
      title: 'Cape Lancers consider January rebuild after slow start',
      source: OUTLETS[1],
      publishedAt: '2026-10-08T12:10:00Z',
      category: 'transfer',
      teamId: 't-brm-17',
      summary: 'The (fictional) club sit bottom of the table after eight rounds. Demo article.',
      provenance: 'DEMO',
    },
    {
      id: 'n-008',
      title: `${veteran.name} signs one-year extension at ${teamById.get(veteran.teamId)!.name}`,
      source: OUTLETS[0],
      publishedAt: '2026-10-07T10:00:00Z',
      category: 'general',
      playerId: veteran.id,
      teamId: veteran.teamId,
      summary: `The ${ageAt(veteran.dob)}-year-old will remain for a further (fictional) season. Demo article.`,
      provenance: 'DEMO',
    },
    {
      id: 'n-009',
      title: 'Bremya League to trial semi-automated offside in the spring',
      source: OUTLETS[0],
      publishedAt: '2026-10-05T16:40:00Z',
      category: 'general',
      summary: 'A (fictional) league office announcement about officiating technology. Demo article.',
      provenance: 'DEMO',
    },
    {
      id: 'n-010',
      title: `${topCreator.name} quietly assembling an assists record season`,
      source: OUTLETS[3],
      publishedAt: '2026-10-03T13:25:00Z',
      category: 'analysis',
      playerId: topCreator.id,
      teamId: topCreator.teamId,
      summary:
        `${topCreator.stats.assists} assists already, ahead of his (fictional) expected-assists figure of ${topCreator.stats.xa.toFixed(1)}. Demo article.`,
      provenance: 'DEMO',
    },
    {
      id: 'n-011',
      title: 'Kestrel Athletic’s 3-4-3: width, overloads and the cost in transition',
      source: OUTLETS[2],
      publishedAt: '2026-10-02T09:50:00Z',
      category: 'tactical',
      teamId: 't-brm-07',
      summary: 'A (fictional) deep dive into the wing-back system and its turnover risks. Demo article.',
      provenance: 'DEMO',
    },
    {
      id: 'n-012',
      title: 'Injury roundup: rotations tight ahead of the autumn run',
      source: OUTLETS[1],
      publishedAt: '2026-10-01T08:05:00Z',
      category: 'injury',
      summary: 'The (fictional) medical latest from around the league. Demo article.',
      provenance: 'DEMO',
    },
  ]

  /* ---------------- Discussions ---------------- */

  const p90 = (p: Player, id: string) => (metricPer90Value(p.stats, id) ?? 0).toFixed(2)
  const topScorerName = topScorer.name
  const rivalCreator = topBy(players, 'xa', (p) => p.id !== topCreator.id && groupOf(p.position) === 'AM')[0]

  const discussions: DiscussionPost[] = [
    {
      id: 'd-001',
      playerId: topScorer.id,
      kind: 'question',
      author: 'demo_scout_lfa',
      authorBadge: 'Scout (demo user)',
      publishedAt: '2026-10-13T18:22:00Z',
      body:
        `${topScorerName} is on ${topScorer.stats.goals} goals from ${topScorer.stats.xg.toFixed(1)} xG. ` +
        'Is this finishing overperformance sustainable, or should we expect regression to the xG baseline over a full season? ' +
        'Sample is only 8 matchdays — curious how people weight that.',
      link: { type: 'metric', targetId: 'xg', label: 'xG per 90' },
      replies: [
        {
          id: 'd-001-r1',
          author: 'data_dev',
          authorBadge: 'Analyst (demo user)',
          publishedAt: '2026-10-13T19:40:00Z',
          body:
            'Eight matchdays is a small sample for finishing skill inference. Career-long conversion stabilises much slower. ' +
            'I would flag him as "finishing hot streak, unproven over time" rather than "elite finisher".',
          provenance: 'DEMO',
        },
      ],
      provenance: 'DEMO',
    },
    {
      id: 'd-002',
      playerId: topScorer.id,
      kind: 'observation',
      author: 'tactical_tom',
      authorBadge: 'Coach (demo user)',
      publishedAt: '2026-10-11T16:05:00Z',
      body:
        `Watched his receipts in the build-up phase: ${(metricPer90Value(topScorer.stats, 'build_up_receptions') ?? 0).toFixed(1)} per 90 ` +
        'is modest for a striker — he clearly saves his runs for the final third. Fits a team that progresses through midfield.',
      link: { type: 'metric', targetId: 'build_up_receptions', label: 'Build-up receptions per 90' },
      replies: [],
      provenance: 'DEMO',
    },
    {
      id: 'd-003',
      playerId: topCreator.id,
      kind: 'comparison',
      author: 'midfield_maestro',
      authorBadge: 'Analyst (demo user)',
      publishedAt: '2026-10-12T20:15:00Z',
      body:
        `Chance creation comparison: ${topCreator.name} sits at ${p90(topCreator, 'xa')} xA per 90 and ` +
        `${p90(topCreator, 'assists')} assists per 90${rivalCreator ? `, while ${rivalCreator.name} is at ${p90(rivalCreator, 'xa')} and ${p90(rivalCreator, 'assists')} respectively` : ''}. ` +
        'Both are demo numbers, but the gap in expected output is what matters for recruitment weighting.',
      link: { type: 'player', targetId: rivalCreator?.id ?? topCreator.id, label: rivalCreator?.name ?? topCreator.name },
      replies: [
        {
          id: 'd-003-r1',
          author: 'demo_scout_lfa',
          authorBadge: 'Scout (demo user)',
          publishedAt: '2026-10-12T21:02:00Z',
          body: 'Also worth comparing turnover numbers — creation usually comes with risk. Run them through the similarity engine with creation and retention weighted.',
          provenance: 'DEMO',
        },
      ],
      provenance: 'DEMO',
    },
    {
      id: 'd-004',
      playerId: progressiveCB.id,
      kind: 'observation',
      author: 'coach_okafor',
      authorBadge: 'Coach (demo user)',
      publishedAt: '2026-10-10T09:30:00Z',
      body:
        `His line-breaking numbers (${p90(progressiveCB, 'line_breaking_passes')} per 90) are elite for the role, but remember the dataset caveat: ` +
        '"passes between the lines" as a strict spatial metric is not available yet — line-breaking here is an approximation from pass direction and distance.',
      link: { type: 'scenario', targetId: 'sc-demo-1', label: 'Demo: 4-3-3 build-up vs 4-4-2 mid-block' },
      replies: [],
      provenance: 'DEMO',
    },
    {
      id: 'd-005',
      playerId: presser.id,
      kind: 'question',
      author: 'data_dev',
      authorBadge: 'Analyst (demo user)',
      publishedAt: '2026-10-08T14:48:00Z',
      body:
        `Final-third recoveries of ${p90(presser, 'recoveries_final_third')} per 90 — but the dataset has no pressure events, so how much of this is ` +
        'system pressing vs individual intent? Until pressure data arrives I would treat it as a team-style indicator more than a player skill.',
      link: { type: 'metric', targetId: 'recoveries_final_third', label: 'Recoveries in the final third' },
      replies: [],
      provenance: 'DEMO',
    },
    {
      id: 'd-006',
      playerId: youngGun.id,
      kind: 'observation',
      author: 'demo_scout_lfa',
      authorBadge: 'Scout (demo user)',
      publishedAt: '2026-10-07T11:12:00Z',
      body:
        `U23 watch: ${youngGun.name} at ${p90(youngGun, 'xa')} xA per 90 with ${youngGun.stats.minutes} minutes played. ` +
        'Minutes are still below the 270-minute stability threshold used by the analysis engine, so percentiles carry a small-sample warning.',
      link: { type: 'player', targetId: youngGun.id, label: youngGun.name },
      replies: [],
      provenance: 'DEMO',
    },
    {
      id: 'd-007',
      playerId: veteran.id,
      kind: 'question',
      author: 'tactical_tom',
      authorBadge: 'Coach (demo user)',
      publishedAt: '2026-10-05T10:20:00Z',
      body:
        `Age curve question: at ${ageAt(veteran.dob)}, his pressing contribution has dipped but retention remains strong ` +
        `(pass completion ${p90(veteran, 'pass_completion')}%). Is a deeper role the right long-term conversion?`,
      link: { type: 'metric', targetId: 'pass_completion', label: 'Pass completion' },
      replies: [],
      provenance: 'DEMO',
    },
  ]

  /* ---------------- Shortlists ---------------- */

  const progressiveCBs = topBy(
    withMinMinutes(players, 400),
    'progressive_passes',
    (p) => p.position === 'CB',
  ).slice(0, 5)
  const u23Creators = topBy(
    withMinMinutes(players.filter((p) => ageAt(p.dob) <= 23 && groupOf(p.position) !== 'GK'), 270),
    'xa',
  ).slice(0, 5)

  const shortlists: Shortlist[] = [
    {
      id: 'sl-001',
      name: 'Progressive CBs — winter window watch (demo)',
      note: 'Centre-backs ranked by progressive passes per 90, minimum 400 minutes (fictional demo data).',
      playerIds: progressiveCBs.map((p) => p.id),
      createdAt: '2026-10-06T09:00:00Z',
      provenance: 'DEMO',
    },
    {
      id: 'sl-002',
      name: 'U23 creators to monitor (demo)',
      note: 'Under-23 outfield players by expected assists per 90, minimum 270 minutes (fictional demo data).',
      playerIds: u23Creators.map((p) => p.id),
      createdAt: '2026-10-09T15:30:00Z',
      provenance: 'DEMO',
    },
  ]

  /* ---------------- Form changes ---------------- */

  const changeCandidates = players.filter((p) => {
    const mine = playerMatchMinutes.filter((r) => r.playerId === p.id)
    return mine.length >= 5
  })
  const changes: FormChange[] = changeCandidates
    .map((p): FormChange | null => {
      const season = seasonRating(playerMatchMinutes, p.id)
      const last3 = last3Rating(playerMatchMinutes, matches, p.id)
      if (season === null || last3 === null) return null
      return {
        playerId: p.id,
        seasonRating: Math.round(season * 10) / 10,
        last3Rating: Math.round(last3 * 10) / 10,
        windowLabel: 'Last 3 matches vs season average',
        provenance: 'DEMO',
      }
    })
    .filter((x): x is FormChange => x !== null)
    .sort((a, b) => (b.last3Rating - b.seasonRating) - (a.last3Rating - a.seasonRating))

  const formChanges = [...changes.slice(0, 4), ...changes.slice(-3)]

  /* ---------------- Demo tactical scenario ---------------- */

  const atlXI = (position: string) =>
    [...players]
      .filter((p) => p.teamId === 't-brm-01' && p.position === position)
      .sort((a, b) => b.stats.minutes - a.stats.minutes)[0]

  const gk = atlXI('GK')
  const rcb = atlXI('CB')
  const lb = atlXI('LB')
  const dm = atlXI('DM')
  const cm = atlXI('CM')

  const demoScenarios: TacticalScenario[] = [
    {
      id: 'sc-demo-1',
      name: '4-3-3 build-up vs 4-4-2 mid-block (demo seed)',
      description:
        'Illustrative build-up pattern: press-resistant progression through the left channel. Seeded demo scenario — players are fictional and linked for demonstration.',
      provenance: 'DEMO',
      createdAt: '2026-10-04T10:00:00Z',
      updatedAt: '2026-10-04T10:00:00Z',
      attack: {
        formation: '4-3-3',
        players: [
          { id: 'a1', label: gk ? `${gk.name.split(' ')[1]} (GK)` : 'GK', x: 6, y: 50, role: 'GK', linkedPlayerId: gk?.id },
          { id: 'a2', label: 'LCB', x: 33, y: 57 },
          { id: 'a3', label: rcb ? `${rcb.name.split(' ')[1]} (RCB)` : 'RCB', x: 33, y: 43, role: 'RCB', linkedPlayerId: rcb?.id },
          { id: 'a4', label: lb ? `${lb.name.split(' ')[1]} (LB)` : 'LB', x: 45, y: 81, role: 'LB', linkedPlayerId: lb?.id },
          { id: 'a5', label: 'RB', x: 45, y: 19 },
          { id: 'a6', label: dm ? `${dm.name.split(' ')[1]} (DM)` : 'DM', x: 43, y: 50, role: 'DM', linkedPlayerId: dm?.id },
          { id: 'a7', label: 'LCM', x: 51, y: 63 },
          { id: 'a8', label: cm ? `${cm.name.split(' ')[1]} (RCM)` : 'RCM', x: 51, y: 37, role: 'RCM', linkedPlayerId: cm?.id },
          { id: 'a9', label: 'LW', x: 63, y: 87 },
          { id: 'a10', label: 'ST', x: 67, y: 50 },
          { id: 'a11', label: 'RW', x: 63, y: 13 },
        ],
      },
      /* Defending 4-4-2 mid-block, rotated 180° like a real match map: their
         left is the viewer's top, so the defending RB shares the bottom flank
         with the attacking LB. Flat banks of four with the striker pair
         screening around x≈44. */
      defence: {
        formation: '4-4-2',
        players: [
          { id: 'd1', label: 'ST', x: 44, y: 44 },
          { id: 'd2', label: 'ST', x: 44, y: 56 },
          { id: 'd3', label: 'LM', x: 55, y: 20 },
          { id: 'd4', label: 'LCM', x: 58, y: 56 },
          { id: 'd5', label: 'RCM', x: 58, y: 44 },
          { id: 'd6', label: 'RM', x: 55, y: 80 },
          { id: 'd7', label: 'LB', x: 74, y: 19 },
          { id: 'd8', label: 'LCB', x: 76, y: 56 },
          { id: 'd9', label: 'RCB', x: 76, y: 44 },
          { id: 'd10', label: 'RB', x: 74, y: 81 },
          { id: 'd11', label: 'GK', x: 94, y: 50 },
        ],
      },
      actions: [
        {
          id: 'ac1', order: 1, type: 'pass',
          from: { x: 33, y: 43 }, to: { x: 43, y: 50 },
          note: 'RCB breaks the first line with a pass into the DM between the opposition forwards.',
        },
        {
          id: 'ac2', order: 2, type: 'carry',
          from: { x: 43, y: 50 }, to: { x: 49, y: 38 },
          note: 'DM carries past the first pressing wave to unbalance the mid-block.',
        },
        {
          id: 'ac3', order: 3, type: 'pass',
          from: { x: 49, y: 38 }, to: { x: 63, y: 87 },
          note: 'Switch released into the left channel where the winger is 1-v-1 with the opposing full-back.',
        },
        {
          id: 'ac4', order: 4, type: 'run',
          from: { x: 67, y: 50 }, to: { x: 81, y: 42 },
          note: 'Striker attacks the space behind as the wide isolation is created.',
        },
      ],
    },
  ]

  return { news, discussions, shortlists, formChanges, demoScenarios }
}
