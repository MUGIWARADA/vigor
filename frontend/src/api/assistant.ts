import type { Player, ReferenceType } from '@/types'
import type { PlatformData } from '@/data/platform'
import {
  METRICS,
  PHASES,
  metricPer90Value,
} from '@/lib/metrics'
import {
  buildPeerGroupWithContext,
  computeMetricRow,
  computeSimilarity,
  defaultWeightsForRole,
} from '@/lib/analysis'
import { groupOf } from '@/lib/positions'
import { ageAt } from '@/lib/utils'

/**
 * AI research assistant — provider interface (spec §15).
 *
 * Phase 1 ships a DETERMINISTIC MOCK PROVIDER, clearly labelled as a
 * demonstration. It retrieves real (demo-dataset) application data and
 * answers from it — it never invents statistics, matches or video
 * observations. A future provider implementation will forward the retrieved
 * context to a real LLM API through the backend, keeping API keys
 * server-side.
 */

export interface AssistantCitation {
  label: string
  refType: ReferenceType
  refId: string
}

export interface AssistantAnswer {
  id: string
  question: string
  body: string
  citations: AssistantCitation[]
  limitations: string[]
  providerLabel: string
  isMock: boolean
  createdAt: string
}

export interface AssistantProvider {
  id: string
  label: string
  isMock: boolean
  answer(question: string): Promise<AssistantAnswer>
}

/* ------------------------------------------------------------------ */
/* Deterministic mock provider                                         */
/* ------------------------------------------------------------------ */

const MOCK_LABEL = 'Deterministic mock provider — demonstration only (no live AI connected)'

function findPlayerMentions(text: string, players: Player[]): Player[] {
  const lower = text.toLowerCase()
  const found: Player[] = []
  for (const p of players) {
    if (lower.includes(p.name.toLowerCase())) found.push(p)
  }
  // Longest names first for stable ordering in answers.
  return found.sort((a, b) => b.name.length - a.name.length)
}

function fmtMetric(player: Player, metricId: string): string {
  const def = METRICS[metricId]
  const v = metricPer90Value(player.stats, metricId)
  if (v === null) return 'not available'
  const unit = def.unit === '%' ? '%' : ' per 90'
  return `${v.toFixed(def.decimals)}${unit}`
}

export function createMockAssistantProvider(data: PlatformData): AssistantProvider {
  const { dataset, content } = data
  const { players, teams, matches, events, playerMatchMinutes } = dataset

  const peersFor = (player: Player): Player[] =>
    buildPeerGroupWithContext(
      players,
      new Map(teams.map((t) => [t.id, t])),
      { positionGroup: groupOf(player.position), minMinutes: 270 },
    )

  function answerBuildUp(player: Player): { body: string; citations: AssistantCitation[] } {
    const peers = peersFor(player)
    const { rows, unavailableRows } = (() => {
      const result = computeMetricRow(player, peers, 'build_up_receptions')
      const prog = computeMetricRow(player, peers, 'progressive_passes')
      const comp = computeMetricRow(player, peers, 'pass_completion')
      const buTurn = computeMetricRow(player, peers, 'build_up_turnovers')
      const lb = computeMetricRow(player, peers, 'line_breaking_passes')
      const rows = [result, prog, comp, buTurn, lb].filter((r): r is NonNullable<typeof r> => r !== null)
      const unavailable = PHASES['build-up'].metricIds
        .filter((id) => !METRICS[id]!.available)
        .map((id) => METRICS[id]!)
      return { rows, unavailableRows: unavailable }
    })()

    const lines: string[] = []
    lines.push(`**${player.name}** — build-up phase profile (demo dataset, ${player.stats.appearances} appearances, ${player.stats.minutes} minutes).`)
    for (const row of rows) {
      const def = METRICS[row.metricId]!
      const pct = row.percentile !== null ? `${row.percentile.toFixed(0)}th percentile` : 'percentile unavailable'
      lines.push(
        `• ${def.label}: **${fmtMetric(player, row.metricId)}** (${pct} among ${row.peerCount} same-position peers; ${def.direction === 'higher' ? 'higher is better' : 'lower is better'})`,
      )
    }
    if (unavailableRows.length > 0) {
      lines.push('')
      lines.push('Metrics not available in the current dataset for this question:')
      for (const def of unavailableRows) {
        lines.push(`• ${def.label} — ${def.unavailableReason}`)
      }
    }
    return {
      body: lines.join('\n'),
      citations: [
        { label: `Player record: ${player.name} (DEMO)`, refType: 'player', refId: player.id },
        ...rows.slice(0, 3).map((r) => ({
          label: `${METRICS[r.metricId]!.label} — definition & values`,
          refType: 'metric' as ReferenceType,
          refId: r.metricId,
        })),
      ],
    }
  }

  function answerSimilar(player: Player): { body: string; citations: AssistantCitation[] } {
    const weights = defaultWeightsForRole(player.role)
    const candidates = buildPeerGroupWithContext(
      players,
      new Map(teams.map((t) => [t.id, t])),
      { positionGroup: groupOf(player.position), minMinutes: 270 },
    ).filter((p) => p.id !== player.id)
    const results = computeSimilarity(player, { weights, candidates }).slice(0, 3)
    const lines: string[] = []
    lines.push(
      `Most similar statistical profiles to **${player.name}** among same-position players with ≥270 minutes (demo dataset):`,
    )
    for (const r of results) {
      const top = r.contributions[0]
      const topLabel = top ? METRICS[top.metricId]?.label ?? top.metricId : 'n/a'
      lines.push(
        `• **${r.player.name}** (${r.player.position}, ${teams.find((t) => t.id === r.player.teamId)?.shortName}) — similarity **${r.score}/100**, biggest gap: ${topLabel}`,
      )
    }
    lines.push('')
    lines.push(
      'Method: per-metric z-scores within the pool, weighted by role dimensions, mean absolute distance → 0–100 score. Deterministic and reproducible — not an LLM judgement.',
    )
    return {
      body: lines.join('\n'),
      citations: [
        { label: `Player record: ${player.name} (DEMO)`, refType: 'player', refId: player.id },
        ...results.map((r) => ({
          label: `Player record: ${r.player.name} (DEMO)`,
          refType: 'player' as ReferenceType,
          refId: r.player.id,
        })),
      ],
    }
  }

  function answerEvidence(player: Player): { body: string; citations: AssistantCitation[] } {
    const peers = peersFor(player)
    const metricIds = Object.keys(METRICS).filter((id) => METRICS[id]!.available)
    const rows = metricIds
      .map((id) => computeMetricRow(player, peers, id))
      .filter((r): r is NonNullable<typeof r> => r !== null && r.percentile !== null)
      .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
    const strengths = rows.filter((r) => (r.percentile ?? 0) >= 75).slice(0, 5)
    const playerMatches = playerMatchMinutes.filter((r) => r.playerId === player.id)
    const playerGoals = events.filter((e) => e.type === 'goal' && e.playerId === player.id)
    const lines: string[] = []
    lines.push(
      `**${player.name}** — strongest evidence vs same-position peers (demo dataset, ${playerMatches.length} appearances):`,
    )
    for (const row of strengths) {
      const def = METRICS[row.metricId]!
      lines.push(
        `• ${def.label}: **${fmtMetric(player, row.metricId)}** — ${(row.percentile ?? 0).toFixed(0)}th percentile (n=${row.peerCount})`,
      )
    }
    lines.push('')
    lines.push('Supporting match evidence:')
    if (playerGoals.length > 0) {
      const g = playerGoals[0]!
      const m = matches.find((x) => x.id === g.matchId)
      lines.push(
        `• ${playerGoals.length} goal events on record — e.g. minute ${g.minute} in ${m ? `${teams.find((t) => t.id === m.homeTeamId)?.shortName} vs ${teams.find((t) => t.id === m.awayTeamId)?.shortName}` : g.matchId} (match record ${g.matchId}).`,
      )
    } else {
      lines.push(`• No goal events on record for ${player.name}; performance evidence rests on ${playerMatches.length} rated appearances.`)
    }
    lines.push(
      `• Mean synthetic match rating: ${(playerMatches.reduce((s, r) => s + r.rating, 0) / Math.max(1, playerMatches.length)).toFixed(2)}/10 (demo rating model).`,
    )
    lines.push('')
    lines.push(
      'Note: the figures above are measured (demo) statistics; describing them as "strengths" is an interpretation based on peer percentile position.',
    )
    return {
      body: lines.join('\n'),
      citations: [
        { label: `Player record: ${player.name} (DEMO)`, refType: 'player', refId: player.id },
        ...strengths.slice(0, 3).map((r) => ({
          label: `${METRICS[r.metricId]!.label} — definition & values`,
          refType: 'metric' as ReferenceType,
          refId: r.metricId,
        })),
        ...(playerGoals[0]
          ? [{ label: `Match ${playerGoals[0].matchId} (DEMO)`, refType: 'match' as ReferenceType, refId: playerGoals[0].matchId }]
          : []),
      ],
    }
  }

  function answerCompare(a: Player, b: Player): { body: string; citations: AssistantCitation[] } {
    const metricIds = ['goals', 'assists', 'xg', 'xa', 'progressive_passes', 'progressive_carries', 'pass_completion', 'tackles', 'recoveries', 'turnovers']
    const lines: string[] = []
    lines.push(`**${a.name}** vs **${b.name}** — per-90 comparison (demo dataset):`)
    for (const id of metricIds) {
      const def = METRICS[id]!
      const va = metricPer90Value(a.stats, id)
      const vb = metricPer90Value(b.stats, id)
      if (va === null || vb === null) {
        lines.push(`• ${def.label}: not available for both players`)
        continue
      }
      const diff = def.direction === 'higher' ? va - vb : vb - va
      const leader = diff > 0 ? a.name : diff < 0 ? b.name : 'level'
      lines.push(
        `• ${def.label}: ${va.toFixed(def.decimals)} vs ${vb.toFixed(def.decimals)} ${def.unit === '%' ? '%' : ''} — advantage ${leader}`,
      )
    }
    return {
      body: lines.join('\n'),
      citations: [
        { label: `Player record: ${a.name} (DEMO)`, refType: 'player', refId: a.id },
        { label: `Player record: ${b.name} (DEMO)`, refType: 'player', refId: b.id },
      ],
    }
  }

  function answerLimitations(): { body: string; citations: AssistantCitation[] } {
    const unavailable = Object.values(METRICS).filter((m) => !m.available)
    const lines = [
      'Main limitations of the current evidence base (demo dataset v0.1):',
      '• All player, team and match records are FICTIONAL demonstration data (provenance label DEMO).',
      '• No opponent-pressure events: pass completion under pressure and pressures applied are gated, not estimated.',
      '• No spatial opponent-block data: passes/receipts between the lines are gated.',
      '• No expected-threat model: xT added is gated until a validated model is available.',
      '• Percentiles need ≥5 peer values and warn below 270 player minutes.',
      '• xG and xA are model estimates, not measured facts.',
      `• ${unavailable.length} of ${Object.keys(METRICS).length} registered metrics are currently unavailable and never zero-filled.`,
      '• No video-processing pipeline exists: no video-based observations are ever claimed.',
    ]
    return { body: lines.join('\n'), citations: [] }
  }

  function answerDefault(question: string, mentions: Player[]): { body: string; citations: AssistantCitation[] } {
    const lines = [
      'I can answer from the application\'s (demo) data. Try questions like:',
      '• "How does [player name] perform during build-up?"',
      '• "Which players have a similar statistical profile to [player name]?"',
      '• "What evidence supports [player name]\'s strengths?"',
      '• "Compare [player A] and [player B]"',
      '• "What are the main limitations of the available evidence?"',
    ]
    if (mentions.length > 0) {
      const p = mentions[0]!
      lines.unshift(
        `I found ${mentions.length} player record(s) matching your question, starting with **${p.name}** (${p.position}, ${ageAt(p.dob)} yrs). Ask about their build-up play, similar players, or supporting evidence.`,
      )
    } else {
      lines.unshift(`I could not find a player named in: "${question}".`)
    }
    return { body: lines.join('\n'), citations: mentions.slice(0, 2).map((p) => ({ label: `Player record: ${p.name} (DEMO)`, refType: 'player' as ReferenceType, refId: p.id })) }
  }

  let seq = 0

  return {
    id: 'mock-deterministic',
    label: MOCK_LABEL,
    isMock: true,
    async answer(question: string): Promise<AssistantAnswer> {
      const q = question.toLowerCase()
      const mentions = findPlayerMentions(question, players)
      const player = mentions[0]
      const second = mentions[1]

      let result: { body: string; citations: AssistantCitation[] }

      if (q.includes('limitation') || q.includes('data quality') || q.includes('available data')) {
        result = answerLimitations()
      } else if (q.includes('compare') && player && second) {
        result = answerCompare(player, second)
      } else if ((q.includes('build') || q.includes('build-up')) && player) {
        result = answerBuildUp(player)
      } else if (q.includes('similar') && player) {
        result = answerSimilar(player)
      } else if ((q.includes('evidence') || q.includes('strength') || q.includes('good at')) && player) {
        result = answerEvidence(player)
      } else {
        result = answerDefault(question, mentions)
      }

      return {
        id: `mock-a-${(seq += 1)}`,
        question,
        body: result.body,
        citations: result.citations,
        limitations: [
          'Deterministic mock response — demonstration only, no live AI is connected.',
          'All statistics are fictional demo values; interpretation is template-generated, not model-generated.',
          `Dataset: ${content.shortlists.length} demo shortlists, ${players.length} demo players, ${matches.length} demo matches.`,
        ],
        providerLabel: MOCK_LABEL,
        isMock: true,
        createdAt: new Date().toISOString(),
      }
    },
  }
}
