import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { POSITION_GROUP_LABELS, POSITION_GROUP_ORDER } from '@/lib/positions'
import { useGlobalFilters } from '@/state/filters'
import { useData } from '@/state/data'
import { cn } from '@/lib/utils'

/**
 * Shared analysis filters (spec §5/§6): competition, season, position, team,
 * age range and minimum minutes. Consistent across every module that uses it;
 * persisted globally.
 */

const ALL = '__all__'

export function GlobalFilterBar({ className }: { className?: string }) {
  const { filters, setFilters, reset } = useGlobalFilters()
  const { data } = useData()
  const disabled = !data

  const teams = data?.dataset.teams ?? []
  const competitions = data?.dataset.competitions ?? []
  const seasons = data?.dataset.seasons ?? []

  return (
    <div
      className={cn(
        'flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg panel-border bg-ink-850/80 px-4 py-3',
        className,
      )}
      role="group"
      aria-label="Global analysis filters"
    >
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-44">
        <Label htmlFor="gf-competition">Competition</Label>
        <Select
          value={filters.competitionId}
          onValueChange={(v) => setFilters({ competitionId: v === ALL ? 'all' : v })}
          disabled={disabled}
        >
          <SelectTrigger id="gf-competition" aria-label="Competition">
            <SelectValue placeholder="All competitions" className="min-w-0 flex-1 truncate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All competitions</SelectItem>
            {competitions.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-40">
        <Label htmlFor="gf-season">Season</Label>
        <Select
          value={filters.seasonId}
          onValueChange={(v) => setFilters({ seasonId: v === ALL ? 'all' : v })}
          disabled={disabled}
        >
          <SelectTrigger id="gf-season" aria-label="Season">
            <SelectValue placeholder="All seasons" className="min-w-0 flex-1 truncate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All seasons</SelectItem>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-44">
        <Label htmlFor="gf-position">Position</Label>
        <Select
          value={filters.positionGroup}
          onValueChange={(v) => setFilters({ positionGroup: v === ALL ? 'all' : (v as typeof filters.positionGroup) })}
          disabled={disabled}
        >
          <SelectTrigger id="gf-position" aria-label="Position group">
            <SelectValue placeholder="All positions" className="min-w-0 flex-1 truncate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All positions</SelectItem>
            {POSITION_GROUP_ORDER.map((g) => (
              <SelectItem key={g} value={g}>{POSITION_GROUP_LABELS[g]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-48">
        <Label htmlFor="gf-team">Team</Label>
        <Select
          value={filters.teamId}
          onValueChange={(v) => setFilters({ teamId: v === ALL ? 'all' : v })}
          disabled={disabled}
        >
          <SelectTrigger id="gf-team" aria-label="Team">
            <SelectValue placeholder="All teams" className="min-w-0 flex-1 truncate" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-24">
        <Label htmlFor="gf-age-min">Age min</Label>
        <Input
          id="gf-age-min"
          type="number"
          min={15}
          max={45}
          value={filters.ageMin}
          disabled={disabled}
          onChange={(e) => setFilters({ ageMin: Number(e.target.value) || 0 })}
          aria-label="Minimum age"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-24">
        <Label htmlFor="gf-age-max">Age max</Label>
        <Input
          id="gf-age-max"
          type="number"
          min={15}
          max={45}
          value={filters.ageMax}
          disabled={disabled}
          onChange={(e) => setFilters({ ageMax: Number(e.target.value) || 45 })}
          aria-label="Maximum age"
        />
      </div>

      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-28">
        <Label htmlFor="gf-min-minutes">Min minutes</Label>
        <Input
          id="gf-min-minutes"
          type="number"
          min={0}
          max={2000}
          step={10}
          value={filters.minMinutes}
          disabled={disabled}
          onChange={(e) => setFilters({ minMinutes: Math.max(0, Number(e.target.value) || 0) })}
          aria-label="Minimum minutes played"
        />
      </div>

      <Button variant="ghost" size="sm" onClick={reset} disabled={disabled} className="mb-px">
        <RotateCcw aria-hidden />
        Reset
      </Button>
    </div>
  )
}
