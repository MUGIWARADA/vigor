import type { LucideIcon } from 'lucide-react'
import { Database, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

/**
 * Explicit empty state (spec §19): when demo data is disabled and no real
 * source is connected, we show this instead of silently substituting values.
 */
export function EmptyState({
  icon: Icon = Database,
  title,
  description,
  showSettingsAction = false,
}: {
  icon?: LucideIcon
  title: string
  description: string
  showSettingsAction?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-ink-900/40 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-line-strong bg-ink-800">
        <Icon className="h-5 w-5 text-fg-faint" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-fg-muted">{description}</p>
      {showSettingsAction && (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/settings">
            <Settings aria-hidden />
            Open settings
          </Link>
        </Button>
      )}
    </div>
  )
}
