import type { Player } from '@/types'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useData } from '@/state/data'

/** Player dropdown grouped by team. */
export function PlayerSelect({
  value,
  onChange,
  placeholder = 'Select a player',
  disabled,
  className,
  id,
}: {
  value: string | undefined
  onChange: (playerId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}) {
  const { players, teams } = useData()
  const byTeam = new Map<string, Player[]>()
  for (const p of players) {
    const list = byTeam.get(p.teamId) ?? []
    list.push(p)
    byTeam.set(p.teamId, list)
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {[...byTeam.entries()].map(([teamId, list]) => (
          <SelectGroup key={teamId}>
            <SelectLabel>{teams.find((t) => t.id === teamId)?.name ?? teamId}</SelectLabel>
            {list
              .sort((a, b) => a.position.localeCompare(b.position) || a.name.localeCompare(b.name))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.position}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
