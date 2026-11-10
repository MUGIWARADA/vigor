import { useMemo } from 'react'
import { Activity, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { attackDir, type MatchState } from './engine'
import { getTeam, type TeamId } from './data'
import { tacticalProfile } from './tactics'

/**
 * Territory and work rate — the two analytics that possession percentage and
 * distance-alone both fail to answer.
 *
 * Where the ball was is not where the team was, and how far a player ran is not
 * how hard he ran. Both come out of per-frame sums the engine keeps: the ball's
 * position in each side's own attacking frame, and each player's distance above
 * the 19.8 km/h and 25.2 km/h bands.
 */

const W = 105

function ThirdsBar({ shares, color }: { shares: [number, number, number]; color: string }) {
  const total = shares[0] + shares[1] + shares[2] || 1
  const parts = shares.map((s) => (s / total) * 100)
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-900/70" data-testid="thirds-bar">
      {parts.map((part, i) => (
        <div
          key={i}
          style={{ width: `${part}%`, background: color, opacity: 0.35 + i * 0.32 }}
          title={`${['own third', 'middle third', 'final third'][i]}: ${part.toFixed(0)}%`}
        />
      ))}
    </div>
  )
}

export function TerritoryPanel({ state }: { state: MatchState }) {
  const rows = useMemo(
    () => (['bracelonia', 'banyarn'] as TeamId[]).map((teamId) => ({
      teamId,
      team: getTeam(teamId),
      profile: tacticalProfile(state, teamId),
    })),
    [state],
  )

  return (
    <Card data-testid="territory-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="size-4 text-accent-300" /> Possession and territory</CardTitle>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          Possession says how long you had the ball. Territory says where you had it: the ball&rsquo;s mean position over the frames each side was on it, measured from that side&rsquo;s own goal. Sixty per cent possession in your own third is a different team from sixty per cent in theirs.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map(({ teamId, team, profile }) => (
          <div key={teamId} className="rounded-md border border-line/60 bg-ink-900/40 p-2.5" data-testid={`territory-${teamId}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: team.color }}>{team.shortName}</span>
              <span className="text-metric text-sm font-semibold text-fg">
                {profile.territory.toFixed(0)} <span className="text-[11px] font-normal text-fg-muted">m from own goal</span>
              </span>
            </div>
            <div className="mt-2"><ThirdsBar shares={profile.possessionThirds as [number, number, number]} color={team.color} /></div>
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-fg-muted">
              <span>own {profile.possessionThirds[0].toFixed(0)}%</span>
              <span>middle {profile.possessionThirds[1].toFixed(0)}%</span>
              <span>final {profile.possessionThirds[2].toFixed(0)}%</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
              With the ball they played {Math.round((profile.territory / W) * 100)} % of the way up the pitch; without it the ball sat {profile.territoryOutOfPossession.toFixed(0)} m from their goal. Their shape still averages {profile.blockHeight.toFixed(0)} m, so the ball {profile.territory > profile.blockHeight ? 'was ahead of' : 'sat behind'} the block.
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function WorkRatePanel({ state }: { state: MatchState }) {
  // The engine plays a short match while the clock displays ninety, so metres
  // per minute of *engine* play is the only rate that is honest without a
  // fudge factor. A real player covers ~122 of these; these players cover far
  // more because they never walk.
  const engineMinutes = Math.max(1, (state.config.halfSeconds * 2) / 60)
  const rows = useMemo(
    () => state.players
      .filter((p) => p.samples > 0)
      .sort((a, b) => b.distance - a.distance)
      .slice(0, 10),
    [state],
  )
  const teamTotal = useMemo(
    () => (['bracelonia', 'banyarn'] as TeamId[]).map((teamId) => {
      const squad = state.players.filter((p) => p.teamId === teamId)
      const distance = squad.reduce((sum, p) => sum + p.distance, 0)
      const sprint = squad.reduce((sum, p) => sum + p.sprintDistance, 0)
      return { teamId, team: getTeam(teamId), distance, sprint, top: Math.max(...squad.map((p) => p.topSpeedMps), 0) }
    }),
    [state],
  )

  return (
    <Card data-testid="work-rate-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-accent-300" /> Work rate</CardTitle>
        <p className="mt-1 text-xs leading-relaxed text-fg-muted">
          Sprint share is the part of a player&rsquo;s running above 25.2 km/h and top speed is his fastest frame — the two figures that separate the midfielder who jogged to the right places from the one who had to get there. Distance is in simulated metres: this engine plays a short match, so a starter covers 3&ndash;4.5 km and the shares, not the totals, are what compare between players.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
          {teamTotal.map(({ teamId, team, distance, sprint, top }) => (
            <div key={teamId} className="rounded-md border border-line/60 bg-ink-900/40 px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: team.color }}>{team.shortName}</span>
                <span className="text-metric text-sm font-semibold text-fg">{(distance / 1000).toFixed(1)} km</span>
              </div>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                {((sprint / Math.max(1, distance)) * 100).toFixed(1)} % of running above 25.2 km/h · fastest {((top * 3.6)).toFixed(1)} km/h
              </p>
            </div>
          ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Distance (sim)</TableHead>
              <TableHead>m/min</TableHead>
              <TableHead>With ball</TableHead>
              <TableHead>Without ball</TableHead>
              <TableHead>Sprint share</TableHead>
              <TableHead>Top speed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>#{p.base.number} {p.base.name}</TableCell>
                <TableCell>{p.slotPosition}</TableCell>
                <TableCell>{(p.distance / 1000).toFixed(2)} km</TableCell>
                <TableCell>{(p.distance / engineMinutes).toFixed(0)}</TableCell>
                <TableCell>{((p.distanceInPossession / Math.max(1, p.distance)) * 100).toFixed(0)} %</TableCell>
                <TableCell>{((p.distanceOutOfPossession / Math.max(1, p.distance)) * 100).toFixed(0)} %</TableCell>
                <TableCell>{((p.sprintDistance / Math.max(1, p.distance)) * 100).toFixed(1)} %</TableCell>
                <TableCell className="text-metric font-semibold text-accent-300">{(p.topSpeedMps * 3.6).toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-[11px] text-fg-muted">
          Counted per frame against the thresholds, so a player who slows through a turn registers each resumption. The with-ball and without-ball columns are shares of the same metres, attributed to the phase they were run in — a full-back who overlapped reads differently from one who spent the match shuffling across a block. Metres per minute is measured against engine play, not the displayed clock: a real player covers about 122 a minute, and these players cover far more because they never walk.
        </p>
      </CardContent>
    </Card>
  )
}

export function attackDirLabel(state: MatchState, teamId: TeamId): string {
  return attackDir(state, teamId) === 1 ? 'left to right' : 'right to left'
}
