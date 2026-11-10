import type { Provenance } from '@/types'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Data provenance labels (spec §19). Every statistic rendered anywhere in
 * the app must carry one of these labels or be directly accompanied by one.
 */

export const PROVENANCE_META: Record<
  Provenance,
  { label: string; description: string; variant: 'warning' | 'info' | 'muted' | 'accent' | 'positive' | 'default' }
> = {
  DEMO: {
    label: 'DEMO',
    description: 'Fictional data generated for interface testing. Not real football facts.',
    variant: 'warning',
  },
  IMPORTED: {
    label: 'IMPORTED',
    description: 'Loaded from a named external source; source, import time and attribution recorded.',
    variant: 'info',
  },
  CALCULATED: {
    label: 'CALCULATED',
    description: 'Metric derived from stored records using a documented definition and version.',
    variant: 'default',
  },
  MODEL_ESTIMATE: {
    label: 'MODEL EST.',
    description: 'Output of an analytical model (e.g. xG) — an interpretation layer, not a measured fact.',
    variant: 'info',
  },
  MANUAL: {
    label: 'MANUAL',
    description: 'Human-entered annotation, stored locally in this Phase 1 build.',
    variant: 'accent',
  },
  VERIFIED: {
    label: 'VERIFIED',
    description: 'Reviewed by an authorised person with the verification process recorded.',
    variant: 'positive',
  },
}

export function ProvenanceBadge({
  provenance,
  className,
  compact = false,
}: {
  provenance: Provenance
  className?: string
  compact?: boolean
}) {
  const meta = PROVENANCE_META[provenance]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn('cursor-help align-middle focus:outline-none', className)}
          aria-label={`Data provenance: ${meta.label}. ${meta.description}`}
        >
          <Badge variant={meta.variant} className="font-mono tracking-wider">
            {!compact && meta.label}
            <span
              aria-hidden
              className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                provenance === 'DEMO' && 'bg-warning',
                provenance === 'IMPORTED' && 'bg-info',
                provenance === 'CALCULATED' && 'bg-fg-faint',
                provenance === 'MODEL_ESTIMATE' && 'bg-info/70',
                provenance === 'MANUAL' && 'bg-accent-400',
                provenance === 'VERIFIED' && 'bg-positive',
              )}
            />
            {compact && <span className="sr-only">{meta.label}</span>}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold text-fg">{meta.label}</p>
        <p>{meta.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * "est." tag for model-estimate figures (metric registry: `estimate: true`,
 * provenance MODEL_ESTIMATE). Rendered next to the figure/label so modelled
 * numbers (xG, ratings, positioning intelligence) are never read as measured
 * facts. Pass `metricId` to borrow the registry definition for the tooltip.
 */
export function EstimateTag({ className, title }: { className?: string; title?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn('cursor-help align-middle focus:outline-none', className)}
          aria-label={`Estimate: ${title ?? PROVENANCE_META.MODEL_ESTIMATE.description}`}
        >
          <Badge variant="info" className="px-1 py-0 font-mono normal-case tracking-normal">
            est.
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold text-fg">Model estimate</p>
        <p>{title ?? PROVENANCE_META.MODEL_ESTIMATE.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function ProvenanceLegend() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {(Object.keys(PROVENANCE_META) as Provenance[]).map((key) => {
        const meta = PROVENANCE_META[key]
        return (
          <div key={key} className="rounded-md panel-border bg-ink-900/60 p-2.5">
            <div className="mb-1 flex items-center gap-1.5">
              <ProvenanceBadge provenance={key} />
            </div>
            <p className="text-[11px] leading-snug text-fg-muted">{meta.description}</p>
          </div>
        )
      })}
    </div>
  )
}
