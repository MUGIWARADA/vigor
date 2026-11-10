import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent-500 text-on-bright hover:bg-accent-400 font-semibold accent-glow',
        secondary: 'bg-ink-700 text-fg hover:bg-ink-600 border border-line-strong',
        outline: 'border border-line-strong bg-transparent text-fg hover:bg-ink-800 hover:border-accent-600',
        ghost: 'text-fg-muted hover:bg-ink-800 hover:text-fg',
        destructive: 'bg-negative/90 text-on-bright hover:bg-negative',
        link: 'text-accent-400 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        xs: 'h-7 px-2 text-xs rounded',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9',
        'icon-sm': 'h-7 w-7 rounded',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
