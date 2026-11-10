import { Link } from 'react-router-dom'
import type { Player, Position, PositionGroup } from '@/types'
import { POSITION_GROUP_COLORS, groupOf } from '@/lib/positions'
import { cn, initials } from '@/lib/utils'

export function PositionBadge({ position, className }: { position: Position; className?: string }) {
  const group = groupOf(position)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none',
        className,
      )}
      style={{
        color: POSITION_GROUP_COLORS[group],
        borderColor: `${POSITION_GROUP_COLORS[group]}55`,
        backgroundColor: `${POSITION_GROUP_COLORS[group]}14`,
      }}
    >
      {position}
    </span>
  )
}

export function PlayerAvatar({
  name,
  position,
  size = 'md',
  className,
}: {
  name: string
  position: Position
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const group = groupOf(position)
  const dims = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-9 w-9 text-xs'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex select-none items-center justify-center rounded-full border font-semibold',
        dims,
        className,
      )}
      style={{
        color: POSITION_GROUP_COLORS[group],
        borderColor: `${POSITION_GROUP_COLORS[group]}66`,
        backgroundColor: `${POSITION_GROUP_COLORS[group]}1a`,
      }}
    >
      {initials(name)}
    </span>
  )
}

export function PlayerLink({
  player,
  className,
  showPosition = false,
}: {
  player: Player
  className?: string
  showPosition?: boolean
}) {
  return (
    <Link
      to={`/players/${player.id}`}
      className={cn('inline-flex items-center gap-1.5 font-medium text-fg hover:text-accent-300', className)}
    >
      {player.name}
      {showPosition && <PositionBadge position={player.position} />}
    </Link>
  )
}

export function positionGroupColor(group: PositionGroup): string {
  return POSITION_GROUP_COLORS[group]
}
