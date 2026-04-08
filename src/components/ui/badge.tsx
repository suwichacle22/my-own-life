import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-[color-mix(in_oklab,var(--lagoon-deep)_30%,transparent)] bg-[color-mix(in_oklab,var(--lagoon)_18%,var(--surface-panel))] text-[var(--lagoon-deep)]',
        outline:
          'border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]',
        secondary:
          'border-[color-mix(in_oklab,var(--palm)_36%,transparent)] bg-[color-mix(in_oklab,var(--palm)_16%,var(--surface-panel))] text-[var(--palm)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ className, variant }))} {...props} />
}

export { Badge, badgeVariants }
