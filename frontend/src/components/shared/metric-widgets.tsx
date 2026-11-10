import { AlertTriangle, Info } from 'lucide-react'
import type { Provenance } from '@/types'
import { METRICS } from '@/lib/metrics'
import { cn, fmt } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ProvenanceBadge } from './provenance'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Info icon that opens the full metric definition (numerator, denominator, source…). */
export function MetricInfoTrigger({ metricId, className }: { metricId: string; className?: string }) {
  const def = METRICS[metricId]
  if (!def) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Definition of ${def.label}`}
          className={cn(
            'inline-flex h-4 w-4 items-center justify-center rounded-full text-fg-faint hover:text-accent-300 focus:outline-none',
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="w-80">
        <p className="mb-1 text-[13px] font-semibold text-fg">{def.label}</p>
        <dl className="space-y-1">
          <div>
            <dt className="text-label inline">Numerator — </dt>
            <dd className="inline text-fg-muted">{def.numerator}</dd>
          </div>
          <div>
            <dt className="text-label inline">Denominator — </dt>
            <dd className="inline text-fg-muted">{def.denominator}</dd>
          </div>
          <div>
            <dt className="text-label inline">Unit — </dt>
            <dd className="inline text-fg-muted">{def.unit} · {def.direction === 'higher' ? 'higher is better' : 'lower is better'}</dd>
          </div>
          <div>
            <dt className="text-label inline">Source — </dt>
            <dd className="inline text-fg-muted">{def.sourceVersion} · provenance {def.provenance}</dd>
          </div>
        </dl>
        <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] leading-relaxed">{def.definition}</p>
        {!def.available && def.unavailableReason && (
          <p className="mt-1.5 rounded bg-warning/10 p-1.5 text-[11px] text-warning">Not available: {def.unavailableReason}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** A labelled statistic with provenance and optional sample-size warning. */
export function StatValue({
  label,
  value,
  unit,
  metricId,
  provenance,
  warning,
  className,
  valueClassName,
  hue = 1,
}: {
  label: string
  value: number | null
  unit?: string
  metricId?: string
  provenance?: Provenance
  warning?: string
  className?: string
  valueClassName?: string
  /** Daylight palette slot 1–6 for the value tint. */
  hue?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const def = metricId ? METRICS[metricId] : undefined
  return (
    <div className={cn('stat-tile flex flex-col gap-0.5', className)} data-hue={hue}>
      <div className="flex items-center gap-1">
        <span className="text-label">{label}</span>
        {metricId && <MetricInfoTrigger metricId={metricId} />}
        {provenance && <ProvenanceBadge provenance={provenance} compact />}
      </div>
      <div className={cn('text-metric flex items-baseline gap-1 text-fg', valueClassName)}>
        <span className="text-lg font-semibold leading-none">{fmt(value, def?.decimals ?? 1)}</span>
        {unit && <span className="text-[10px] text-fg-faint">{unit}</span>}
      </div>
      {warning && (
        <p className="flex items-center gap-1 text-[10px] text-warning">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {warning}
        </p>
      )}
    </div>
  )
}

/** Horizontal percentile bar (0–100) with peer-median marker. */
export function PercentileBar({
  value,
  peerMedian,
  className,
  label,
}: {
  value: number | null
  peerMedian?: number | null
  className?: string
  label?: string
}) {
  const v = value === null ? null : Math.max(0, Math.min(100, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-2 w-full min-w-[72px] overflow-hidden rounded-full bg-ink-700">
        <div className="absolute left-0 top-0 h-full w-full">
          <div className="h-full w-[70%] bg-ink-700" />
        </div>
        {v !== null && (
          <div
            className="metric-bar h-full rounded-full bg-accent-500/80"
            style={{ width: `${v}%` }}
            role="meter"
            aria-valuenow={Math.round(v)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label ?? 'Percentile vs peer group'}
          />
        )}
        {peerMedian !== null && peerMedian !== undefined && (
          <div
            className="absolute top-[-2px] h-[calc(100%+4px)] w-px bg-fg/60"
            style={{ left: `${Math.max(0, Math.min(100, peerMedian))}%` }}
            aria-hidden
          />
        )}
      </div>
      <span className="text-metric w-9 shrink-0 text-right text-xs text-fg-muted">
        {v === null ? '—' : Math.round(v)}
      </span>
    </div>
  )
}

export function SmallSampleWarning({ minutes }: { minutes: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="warning" className="cursor-help font-mono">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          small n
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Only {minutes} minutes played — below the 270-minute stability threshold. Interpret percentiles with caution.
      </TooltipContent>
    </Tooltip>
  )
}
