import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type NoteVariant = 'info' | 'warning' | 'scope'

/** Restrained callout for disclaimers, scope notes and honest limitations. */
export function InfoNote({
  variant = 'info',
  title,
  children,
  className,
  icon,
}: {
  variant?: NoteVariant
  title?: string
  children: React.ReactNode
  className?: string
  icon?: LucideIcon
}) {
  const Icon = icon ?? (variant === 'warning' ? AlertTriangle : variant === 'scope' ? ShieldAlert : Info)
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-md border p-3 text-xs leading-relaxed',
        variant === 'info' && 'border-info/25 bg-info/[0.07] text-fg-muted',
        variant === 'warning' && 'border-warning/25 bg-warning/[0.07] text-fg-muted',
        variant === 'scope' && 'border-accent-500/40 bg-ink-800/60 text-fg-muted',
        className,
      )}
      role="note"
    >
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          variant === 'warning' ? 'text-warning' : variant === 'scope' ? 'text-fg-faint' : 'text-info',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-semibold text-fg">{title}</p>}
        {children}
      </div>
    </div>
  )
}
