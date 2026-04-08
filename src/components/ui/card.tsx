import { forwardRef, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const Card = forwardRef<HTMLSectionElement, ComponentProps<'section'>>(
  ({ className, ...props }, ref) => {
    return (
      <section
        ref={ref}
        className={cn(
          'rounded-[1.8rem] border border-[var(--line)] bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] shadow-[0_1px_0_var(--inset-glint)_inset,0_24px_50px_rgba(5,12,16,0.18)] backdrop-blur-xl',
          className,
        )}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'

function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
}

function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-lg font-semibold tracking-tight text-[var(--sea-ink)]', className)}
      {...props}
    />
  )
}

function CardDescription({
  className,
  ...props
}: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-sm leading-6 text-[var(--sea-ink-soft)]', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />
}

function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center px-6 pb-6', className)} {...props} />
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
