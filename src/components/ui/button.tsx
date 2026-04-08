import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[rgba(79,184,178,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
  {
    variants: {
      size: {
        default: 'h-11 px-4 py-2',
        icon: 'h-10 w-10 rounded-full',
        lg: 'h-12 px-5 text-sm',
        sm: 'h-9 px-3 text-xs',
      },
      variant: {
        default:
          'border border-transparent bg-[linear-gradient(135deg,var(--lagoon-deep),color-mix(in_oklab,var(--lagoon)_72%,white_28%))] text-[#041114] shadow-[0_18px_36px_rgba(21,97,102,0.3)] hover:-translate-y-0.5',
        ghost:
          'border border-transparent bg-transparent text-[var(--sea-ink-soft)] hover:bg-[var(--surface-muted)] hover:text-[var(--sea-ink)]',
        outline:
          'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] shadow-[0_12px_28px_rgba(4,12,16,0.16)] hover:-translate-y-0.5 hover:bg-[color-mix(in_oklab,var(--chip-bg)_78%,var(--lagoon)_22%)]',
        secondary:
          'border border-[color-mix(in_oklab,var(--palm)_42%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_18%,var(--surface-panel))] text-[var(--palm)] shadow-[0_14px_30px_rgba(24,63,48,0.18)] hover:-translate-y-0.5',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
)

function Button({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
