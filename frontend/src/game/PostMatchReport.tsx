import { useMemo, useState } from 'react'
import { Award, BarChart3, Flame, Map as MapIcon, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { HexHeatMapLayer, Pitch, type PitchTemplate } from '@/components/pitch/Pitch'
import { cn } from '@/lib/utils'
import { getTeam, type TeamId } from './data'
import {
  POSITION_HEAT_COLS,
  POSITION_HEAT_ROWS,
  playerRating,
  type MatchState,
  type RuntimePlayer,
} from './engine'
import { displaySurname } from './MatchStage'
import { ShapePanel } from './ShapePanel'
import { TerritoryPanel, WorkRatePanel } from './AnalyticsPanels'
import { ratingReasons } from './engine'

const HOME: TeamId = 'bracelonia'
const AWAY: TeamId = 'banyarn'

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0
}

function StatBar({ label, homeDisplay, awayDisplay, homeValue, awayValue }: {
  label: string
  homeDisplay: string
  awayDisplay: string
  homeValue: number
  awayValue: number
}) {
  const total = homeValue + awayValue
  const homeShare = total > 0 ? Math.min(92, Math.max(8, (homeValue / total) * 100)) : 50
  return (
    <div>
      <div className="grid grid-cols-[minmax(52px,auto)_1fr_minmax(52px,auto)] items-center gap-2 text-xs">
        <span className="text-metric text-left font-semibold text-fg">{homeDisplay}</span>
        <span className="text-center text-[11px] font-medium uppercase tracking-wide text-fg-muted">{label}</span>
        <span className="text-metric text-right font-semibold text-fg">{awayDisplay}</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
        <div className="h-full bg-accent-500" style={{ width: `${homeShare}%` }} />
        <div className="h-full flex-1 bg-zinc-500" />
      </div>
    </div>
  )
}

function heatCells(players: RuntimePlayer[]) {
  const totals = Array(POSITION_HEAT_COLS * POSITION_HEAT_ROWS).fill(0)
  for (const p of players) {
    p.positionHeat.forEach((value, i) => { totals[i] += value })
  }
  return totals.map((value, i) => {
    const col = i % POSITION_HEAT_COLS
    const row = Math.floor(i / POSITION_HEAT_COLS)
    return {
      x: (col + 0.5) * (105 / POSITION_HEAT_COLS),
      y: (row + 0.5) * (68 / POSITION_HEAT_ROWS),
      value,
    }
  })
}

type MapMode = 'average' | 'heat'

function PositionsPanel({ state, pitchTemplate }: { state: MatchState; pitchTemplate: PitchTemplate }) {
  const [mode, setMode] = useState<MapMode>('average')
  const [teamId, setTeamId] = useState<TeamId>(HOME)
  const [heatSubject, setHeatSubject] = useState('team')
  const team = getTeam(teamId)

  const teamPlayers = useMemo(
    () => state.players.filter((p) => p.teamId === teamId && p.samples > 0).sort((a, b) => a.base.number - b.base.number),
    [state.players, teamId],
  )
  const heatPlayers = useMemo(
    () => [...teamPlayers].sort((a, b) => b.samples - a.samples),
    [teamPlayers],
  )
  const selectedHeatPlayer = heatSubject === 'team' ? undefined : heatPlayers.find((p) => p.id === heatSubject)
  const cells = useMemo(
    () => heatCells(selectedHeatPlayer ? [selectedHeatPlayer] : heatPlayers),
    [heatPlayers, selectedHeatPlayer],
  )
  const heatSamples = cells.reduce((sum, c) => sum + c.value, 0)

  const averagePlayers = useMemo(
    () => state.players
      .filter((p) => p.teamId === teamId && p.samples >= 3)
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 11)
      .sort((a, b) => a.avgX - b.avgX),
    [state.players, teamId],
  )

  const switchTeam = (next: TeamId) => {
    setTeamId(next)
    setHeatSubject('team')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {mode === 'average' ? <MapIcon className="size-4 text-accent-300" /> : <Flame className="size-4 text-accent-300" />}
              Positions
            </CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              One pitch, both teams. Average positions use one position sample per second; heat maps use the same samples and brighten where a player spent more time.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" variant={mode === 'average' ? 'default' : 'outline'} onClick={() => setMode('average')}>Average positions</Button>
            <Button type="button" size="sm" variant={mode === 'heat' ? 'default' : 'outline'} onClick={() => setMode('heat')}>Heat maps</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {([HOME, AWAY] as TeamId[]).map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={teamId === id ? 'default' : 'outline'}
                aria-pressed={teamId === id}
                onClick={() => switchTeam(id)}
              >
                {getTeam(id).name}
              </Button>
            ))}
          </div>
          <span className="ml-auto text-[11px] uppercase tracking-wide text-fg-muted">Attacking left → right</span>
        </div>

        <Pitch
          ariaLabel={mode === 'average' ? `${team.name} average positions` : `${team.name} hexagonal heat map`}
          template={pitchTemplate}
        >
          {mode === 'average' && averagePlayers.map((p) => (
            <g key={p.id} data-testid={`average-position-${p.id}`}>
              <circle cx={p.avgX} cy={p.avgY} r={2.05} fill={p.slotPosition === 'GK' ? team.gkColor : team.color} stroke="rgba(255,255,255,0.85)" strokeWidth={0.28} />
              <text x={p.avgX} y={p.avgY + 0.62} textAnchor="middle" fontSize={1.72} fontWeight={800} fill={p.slotPosition === 'GK' ? '#111827' : team.textColor}>{p.base.number}</text>
              <text x={p.avgX} y={p.avgY + 4.35} textAnchor="middle" fontFamily="'Times New Roman', Times, serif" fontSize={1.55} fontWeight={400} fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.35)" strokeWidth={0.13} paintOrder="stroke">
                {displaySurname(p.base.name)}
              </text>
            </g>
          ))}
          {mode === 'heat' && <HexHeatMapLayer cells={cells} />}
        </Pitch>

        {mode === 'heat' && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setHeatSubject('team')}
                aria-pressed={heatSubject === 'team'}
                className={cn(
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  heatSubject === 'team' ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:text-fg',
                )}
              >
                Whole team
              </button>
              {heatPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setHeatSubject(p.id)}
                  aria-pressed={heatSubject === p.id}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                    heatSubject === p.id ? 'bg-accent-500 text-on-bright' : 'bg-ink-800 text-fg-muted hover:text-fg',
                  )}
                >
                  #{p.base.number} {displaySurname(p.base.name)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
              <span>{heatSamples} one-second samples · {selectedHeatPlayer ? selectedHeatPlayer.base.name : team.name}</span>
              <span className="ml-auto flex items-center gap-1" aria-label="Heat intensity legend">
                Low
                {[0.08, 0.2, 0.34, 0.48, 0.62].map((opacity) => (
                  <span key={opacity} className="inline-block size-2.5 rounded-[2px] bg-white" style={{ opacity }} />
                ))}
                High
              </span>
            </div>
          </div>
        )}

        {mode === 'average' && (
          <p className="mt-2 text-[11px] text-fg-muted">Mean position across the match, normalised to {team.shortName}’s attacking direction.</p>
        )}
      </CardContent>
    </Card>
  )
}

export function PostMatchReport({ state, pitchTemplate }: { state: MatchState; pitchTemplate: PitchTemplate }) {
  const home = state.stats[HOME]
  const away = state.stats[AWAY]
  const totalPossession = home.possessionSeconds + away.possessionSeconds
  const homePossession = totalPossession ? Math.round((home.possessionSeconds / totalPossession) * 100) : 50
  const played = state.players.filter((p) => p.samples > 0 || p.touches > 0)
  const ratings = [...played].sort((a, b) => playerRating(b) - playerRating(a))
  const playerOfMatch = ratings[0]
  const eventsAscending = [...state.events].reverse()
  const goals = eventsAscending.filter((e) => e.kind === 'goal')
  const playerById = useMemo(() => new Map(state.players.map((p) => [p.id, p])), [state.players])

  const cards = (teamId: TeamId) => ({
    yellow: state.players.filter((p) => p.teamId === teamId).reduce((sum, p) => sum + p.yellowCards, 0),
    red: state.players.filter((p) => p.teamId === teamId && p.sentOff).length,
  })
  const homeCards = cards(HOME)
  const awayCards = cards(AWAY)

  const statRows = [
    { label: 'Possession', homeDisplay: `${homePossession}%`, awayDisplay: `${100 - homePossession}%`, homeValue: homePossession, awayValue: 100 - homePossession },
    { label: 'Shots', homeDisplay: String(home.shots), awayDisplay: String(away.shots), homeValue: home.shots, awayValue: away.shots },
    { label: 'On target', homeDisplay: String(home.shotsOnTarget), awayDisplay: String(away.shotsOnTarget), homeValue: home.shotsOnTarget, awayValue: away.shotsOnTarget },
    { label: 'Expected goals', homeDisplay: home.xg.toFixed(2), awayDisplay: away.xg.toFixed(2), homeValue: home.xg, awayValue: away.xg },
    { label: 'Passes', homeDisplay: `${home.completedPasses}/${home.passes}`, awayDisplay: `${away.completedPasses}/${away.passes}`, homeValue: home.passes, awayValue: away.passes },
    { label: 'Pass accuracy', homeDisplay: `${pct(home.completedPasses, home.passes)}%`, awayDisplay: `${pct(away.completedPasses, away.passes)}%`, homeValue: pct(home.completedPasses, home.passes), awayValue: pct(away.completedPasses, away.passes) },
    { label: 'Corners', homeDisplay: String(home.corners), awayDisplay: String(away.corners), homeValue: home.corners, awayValue: away.corners },
    { label: 'Saves', homeDisplay: String(home.saves), awayDisplay: String(away.saves), homeValue: home.saves, awayValue: away.saves },
    { label: 'Tackles won', homeDisplay: String(home.tackles), awayDisplay: String(away.tackles), homeValue: home.tackles, awayValue: away.tackles },
    { label: 'Fouls', homeDisplay: String(home.fouls), awayDisplay: String(away.fouls), homeValue: home.fouls, awayValue: away.fouls },
    { label: 'Offsides', homeDisplay: String(home.offsides), awayDisplay: String(away.offsides), homeValue: home.offsides, awayValue: away.offsides },
    { label: 'Yellow / red', homeDisplay: `${homeCards.yellow}/${homeCards.red}`, awayDisplay: `${awayCards.yellow}/${awayCards.red}`, homeValue: homeCards.yellow + homeCards.red, awayValue: awayCards.yellow + awayCards.red },
  ]

  return (
    <div className="space-y-4" data-testid="post-match-report">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-accent-300" /> Full-time report</CardTitle>
              <p className="mt-1 text-xs text-fg-muted">Bracelonia {state.score[HOME]} — {state.score[AWAY]} Banyarn Munic</p>
            </div>
            {playerOfMatch && (
              <Badge variant="accent"><Award className="size-3" /> Player of the match: #{playerOfMatch.base.number} {playerOfMatch.base.name} · {playerRating(playerOfMatch).toFixed(1)}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <div>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Scorers</h4>
              {goals.length ? (
                <div className="space-y-1.5">
                  {goals.map((event, i) => {
                    const scorer = event.playerId ? playerById.get(event.playerId) : undefined
                    return (
                      <div key={i} className="flex items-baseline gap-2 text-xs">
                        <span className="w-8 shrink-0 text-metric text-accent-300">{event.minute}′</span>
                        <span className="text-fg">{scorer ? `#${scorer.base.number} ${scorer.base.name}` : event.text}</span>
                        {event.teamId && <span className="text-fg-muted">({getTeam(event.teamId).shortName})</span>}
                      </div>
                    )
                  })}
                </div>
              ) : <p className="text-xs text-fg-muted">No goals.</p>}
              <h4 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Match timeline</h4>
              <div className="max-h-52 space-y-1.5 overflow-auto pr-1">
                {eventsAscending.length ? eventsAscending.map((event, i) => (
                  <div key={i} className="flex gap-2 text-xs leading-relaxed">
                    <span className="w-8 shrink-0 text-metric text-accent-300">{event.minute}′</span>
                    <span className="text-fg-muted">{event.text}</span>
                  </div>
                )) : <p className="text-xs text-fg-muted">No recorded events.</p>}
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted"><BarChart3 className="size-3.5" /> Team statistics</h4>
              <div className="grid grid-cols-[52px_1fr_52px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                <span>BRA</span><span /><span className="text-right">BAM</span>
              </div>
              {statRows.map((row) => <StatBar key={row.label} {...row} />)}
            </div>
          </div>
        </CardContent>
      </Card>

      <ShapePanel state={state} pitchTemplate={pitchTemplate} />

      <PositionsPanel state={state} pitchTemplate={pitchTemplate} />

      <TerritoryPanel state={state} />

      <WorkRatePanel state={state} />

      <Card>
        <CardHeader><CardTitle>Player ratings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Player</TableHead><TableHead>Team</TableHead><TableHead>Pos</TableHead><TableHead>G</TableHead><TableHead>Shots</TableHead><TableHead>Passes</TableHead><TableHead>Tck/Int</TableHead><TableHead>Saves</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
            <TableBody>
              {ratings.slice(0, 22).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>#{p.base.number} {p.base.name}{p.yellowCards ? ` · ${p.yellowCards}Y` : ''}{p.sentOff ? ' · R' : ''}</TableCell>
                  <TableCell>{getTeam(p.teamId).shortName}</TableCell>
                  <TableCell>{p.slotPosition}</TableCell>
                  <TableCell>{p.goals}</TableCell>
                  <TableCell>{p.shots}</TableCell>
                  <TableCell>{p.completedPasses}/{p.passes}</TableCell>
                  <TableCell>{p.tackles}/{p.interceptions}</TableCell>
                  <TableCell>{p.saves}</TableCell>
                  <TableCell className="text-metric font-semibold text-accent-300">
                    <details className="group" data-testid={`rating-reasons-${p.id}`}>
                      <summary className="cursor-pointer list-none underline decoration-dotted underline-offset-2" title="Why this rating">{playerRating(p).toFixed(1)}</summary>
                      <ul className="mt-1.5 w-56 space-y-1 rounded-md border border-line/60 bg-ink-900/70 p-2 text-left text-[11px] font-normal text-fg-muted">
                        <li className="flex justify-between gap-2 text-fg"><span>Base</span><span>6.05</span></li>
                        {ratingReasons(p).map((r) => (
                          <li key={r.key} className="flex justify-between gap-2">
                            <span className="min-w-0">
                              <span className="text-fg">{r.label}</span>
                              <span className="block leading-snug opacity-80">{r.reason}</span>
                            </span>
                            <span className={r.delta < 0 ? 'text-red-300' : r.delta > 0 ? 'text-accent-300' : 'opacity-70'}>
                              {r.delta > 0 ? '+' : ''}{r.delta.toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
