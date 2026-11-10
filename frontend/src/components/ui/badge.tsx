import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-line-strong bg-ink-800 text-fg-muted',
        accent: 'border-accent-700 bg-accent-400/10 text-accent-300',
        outline: 'border-line-strong bg-transparent text-fg-muted',
        positive: 'border-positive/30 bg-positive/10 text-positive',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        negative: 'border-negative/30 bg-negative/10 text-negative',
        info: 'border-info/30 bg-info/10 text-info',
        muted: 'border-transparent bg-ink-700 text-fg-faint',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
