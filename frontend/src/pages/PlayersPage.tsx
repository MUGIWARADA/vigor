import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpDown, GitCompareArrows, Search, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { datasetScopeLabel } from '@/data/generate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GlobalFilterBar } from '@/components/shared/global-filter-bar'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { PlayerAvatar, PositionBadge } from '@/components/shared/player-bits'
import { ProvenanceBadge } from '@/components/shared/provenance'
import { useData } from '@/state/data'
import { useFilteredPlayers } from '@/hooks/useFilteredPlayers'
import { useSettings } from '@/state/settings'
import { metricPer90Value } from '@/lib/metrics'
import { playerAge } from '@/lib/analysis'
import { fmt } from '@/lib/utils'

const PAGE_SIZE = 12

type SortKey =
  | 'name'
  | 'team'
  | 'age'
  | 'minutes'
  | 'goals'
  | 'assists'
  | 'xg'
  | 'xa'
  | 'prgp90'
  | 'pass'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'minutes', label: 'Minutes played' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'xg', label: 'Expected goals' },
  { key: 'xa', label: 'Expected assists' },
  { key: 'prgp90', label: 'Progressive passes /90' },
  { key: 'pass', label: 'Pass completion %' },
  { key: 'age', label: 'Age' },
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'team', label: 'Team (A–Z)' },
]

export function PlayersPage() {
  const { data, teamById } = useData()
  const { settings } = useSettings()
  const base = useFilteredPlayers()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [foot, setFoot] = useState<'all' | 'Left' | 'Right' | 'Both'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('minutes')
  const [page, setPage] = useState(0)
  const [compare, setCompare] = useState<string[]>([])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return base
      .filter((p) => (foot === 'all' ? true : p.foot === foot))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        switch (sortKey) {
          case 'name': return a.name.localeCompare(b.name)
          case 'team': return (teamById(a.teamId)?.name ?? '').localeCompare(teamById(b.teamId)?.name ?? '')
          case 'age': return playerAge(a) - playerAge(b)
          case 'minutes': return b.stats.minutes - a.stats.minutes
          case 'goals': return b.stats.goals - a.stats.goals
          case 'assists': return b.stats.assists - a.stats.assists
          case 'xg': return b.stats.xg - a.stats.xg
          case 'xa': return b.stats.xa - a.stats.xa
          case 'prgp90':
            return (metricPer90Value(b.stats, 'progressive_passes') ?? 0) - (metricPer90Value(a.stats, 'progressive_passes') ?? 0)
          case 'pass':
            return (metricPer90Value(b.stats, 'pass_completion') ?? 0) - (metricPer90Value(a.stats, 'pass_completion') ?? 0)
        }
      })
  }, [base, search, foot, sortKey, teamById])

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Player database"
        description={`Browse every player in the loaded dataset. ${data ? `Dataset: ${datasetScopeLabel(data.dataset)}, ${data.dataset.season.label} (fictional demo records).` : ''}`}
        actions={
          compare.length >= 2 ? (
            <Button size="sm" onClick={() => navigate(`/compare?ids=${compare.join(',')}`)}>
              <GitCompareArrows aria-hidden />
              Compare {compare.length} selected
            </Button>
          ) : undefined
        }
      />

      <GlobalFilterBar />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-64 flex-col gap-1">
          <Label htmlFor="pd-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden />
            <Input
              id="pd-search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Player name…"
              className="pl-8"
              disabled={!data}
            />
          </div>
        </div>
        <div className="flex w-40 flex-col gap-1">
          <Label htmlFor="pd-foot">Preferred foot</Label>
          <Select value={foot} onValueChange={(v) => setFoot(v as typeof foot)} disabled={!data}>
            <SelectTrigger id="pd-foot">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any foot</SelectItem>
              <SelectItem value="Left">Left</SelectItem>
              <SelectItem value="Right">Right</SelectItem>
              <SelectItem value="Both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-56 flex-col gap-1">
          <Label htmlFor="pd-sort">Sort by</Label>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)} disabled={!data}>
            <SelectTrigger id="pd-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="muted" className="mb-2 normal-case tracking-normal">
          {rows.length} players
        </Badge>
      </div>

      {!data ? (
        <EmptyState
          icon={Users}
          title="No player data available"
          description={
            settings.demoMode
              ? 'Data is loading or unavailable.'
              : 'Demo data is disabled and no real data source is connected in Phase 1. Enable demo data in Settings to browse fictional records, clearly labelled as DEMO.'
          }
          showSettingsAction={!settings.demoMode}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No players match these filters" description="Try widening the age range, position group or minimum minutes." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <span className="sr-only">Select for comparison</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden />
                  </TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead>Foot</TableHead>
                  <TableHead className="text-right">Apps</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">G</TableHead>
                  <TableHead className="text-right">A</TableHead>
                  <TableHead className="text-right">xG</TableHead>
                  <TableHead className="text-right">xA</TableHead>
                  <TableHead className="text-right">PrgP/90</TableHead>
                  <TableHead className="text-right">Pass%</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/players/${p.id}`)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={compare.includes(p.id)}
                        onCheckedChange={() => toggleCompare(p.id)}
                        aria-label={`Select ${p.name} for comparison`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar name={p.name} position={p.position} size="sm" />
                        <div className="flex flex-col">
                          <span className="font-medium text-fg">{p.name}</span>
                          <span className="text-[10px] text-fg-faint">
                            {p.secondaryPosition ? `${p.position} / ${p.secondaryPosition}` : p.position}
                          </span>
                        </div>
                        <PositionBadge position={p.position} />
                      </div>
                    </TableCell>
                    <TableCell className="text-fg-muted">{teamById(p.teamId)?.shortName}</TableCell>
                    <TableCell className="text-metric text-right">{playerAge(p)}</TableCell>
                    <TableCell>
                      <span className="text-[11px] text-fg-muted">{p.foot}</span>
                    </TableCell>
                    <TableCell className="text-metric text-right">{p.stats.appearances}</TableCell>
                    <TableCell className="text-metric text-right">{p.stats.minutes}</TableCell>
                    <TableCell className="text-metric text-right text-fg">{p.stats.goals}</TableCell>
                    <TableCell className="text-metric text-right text-fg">{p.stats.assists}</TableCell>
                    <TableCell className="text-metric text-right">{fmt(p.stats.xg, 1)}</TableCell>
                    <TableCell className="text-metric text-right">{fmt(p.stats.xa, 1)}</TableCell>
                    <TableCell className="text-metric text-right">{fmt(metricPer90Value(p.stats, 'progressive_passes'), 2)}</TableCell>
                    <TableCell className="text-metric text-right">{fmt(metricPer90Value(p.stats, 'pass_completion'), 1)}</TableCell>
                    <TableCell className="text-right">
                      <ProvenanceBadge provenance="DEMO" compact />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
            <span className="text-[11px] text-fg-faint">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of {rows.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="xs" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Previous
              </Button>
              <span className="text-metric px-1 text-xs text-fg-muted">
                {safePage + 1} / {pageCount}
              </span>
              <Button variant="outline" size="xs" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      <p className="text-[11px] text-fg-faint">
        All rows are fictional demo records. xG/xA are model estimates — hover the provenance dot on any
        profile page for details.{' '}
        <Link to="/settings" className="underline decoration-line-strong underline-offset-2 hover:text-fg-muted">
          Manage demo data
        </Link>
      </p>
    </div>
  )
}
