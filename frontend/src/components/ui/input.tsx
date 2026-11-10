import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-line-strong bg-ink-900 px-3 py-1 text-sm text-fg shadow-sm transition-colors',
        'placeholder:text-fg-faint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:border-accent-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[72px] w-full rounded-md border border-line-strong bg-ink-900 px-3 py-2 text-sm text-fg shadow-sm transition-colors',
        'placeholder:text-fg-faint',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:border-accent-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      ref={ref}
      className={cn('text-label select-none', className)}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

export { Input, Textarea, Label }
