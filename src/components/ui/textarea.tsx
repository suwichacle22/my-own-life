import type * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-24 w-full rounded-[18px] border border-[color-mix(in_oklab,var(--line)_88%,transparent_12%)] bg-[var(--surface-inset)] px-4 py-3 text-base text-[var(--sea-ink)] shadow-[0_1px_0_var(--inset-glint)_inset,0_14px_28px_rgba(4,12,16,0.12)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[color-mix(in_oklab,var(--sea-ink-soft)_78%,transparent)] focus-visible:border-[color-mix(in_oklab,var(--lagoon-deep)_52%,var(--line))] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--lagoon)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
