import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Coins,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

const TIME_CATEGORIES = [
  'Work',
  'Study',
  'Health',
  'Social',
  'Chores',
  'Travel',
  'Rest',
  'Fun',
]

const MONEY_CATEGORIES = [
  'Food',
  'Transport',
  'Bills',
  'Shopping',
  'Health',
  'Fun',
  'Other',
]

const moneyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  weekday: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

type TimeEntry = Doc<'timeEntries'>
type MoneyEntry = Doc<'moneyEntries'>

export const Route = createFileRoute('/')({
  component: App,
})

function getTodayDateString() {
  return formatDateInput(new Date())
}

function formatDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function shiftDate(dateString: string, days: number) {
  const [year, month, day] = dateString.split('-').map(Number)
  return formatDateInput(new Date(year, month - 1, day + days))
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (hours === 0) {
    return `${remainingMinutes}m`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}m`
}

function formatClockTime(value: string) {
  const [hoursString, minutesString] = value.split(':')
  const hours = Number(hoursString)
  const minutes = Number(minutesString)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return value
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const twelveHour = hours % 12 || 12
  return `${twelveHour}:${minutesString} ${period}`
}

function formatTimeRange(entry: TimeEntry) {
  if (entry.startTime && entry.endTime) {
    return `${formatClockTime(entry.startTime)} - ${formatClockTime(entry.endTime)}`
  }

  return formatDuration(entry.durationMinutes)
}

function formatDayLabel(dateString: string) {
  return dateFormatter.format(new Date(`${dateString}T00:00:00`))
}

function formatLoggedTime(timestamp: number) {
  return timeFormatter.format(new Date(timestamp))
}

function App() {
  const today = getTodayDateString()
  const [selectedDate, setSelectedDate] = useState(today)
  const deferredDate = useDeferredValue(selectedDate)
  const dashboard = useQuery(api.tracker.getDailySnapshot, {
    date: deferredDate,
  })

  const addTimeEntry = useMutation(api.tracker.addTimeEntry)
  const addMoneyEntry = useMutation(api.tracker.addMoneyEntry)
  const removeTimeEntry = useMutation(api.tracker.removeTimeEntry)
  const removeMoneyEntry = useMutation(api.tracker.removeMoneyEntry)

  const [timeCategory, setTimeCategory] = useState(TIME_CATEGORIES[0])
  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('10:00')
  const [timeNote, setTimeNote] = useState('')
  const [moneyCategory, setMoneyCategory] = useState(MONEY_CATEGORIES[0])
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyNote, setMoneyNote] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [moneyError, setMoneyError] = useState<string | null>(null)
  const [timeSubmitting, setTimeSubmitting] = useState(false)
  const [moneySubmitting, setMoneySubmitting] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const moneySectionRef = useRef<HTMLElement | null>(null)
  const moneyAmountInputRef = useRef<HTMLInputElement | null>(null)

  const isDateUpdating = deferredDate !== selectedDate

  async function handleAddTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!timeStart || !timeEnd) {
      setTimeError('Choose both a start time and an end time.')
      return
    }

    setTimeError(null)
    setTimeSubmitting(true)

    try {
      await addTimeEntry({
        category: timeCategory,
        date: selectedDate,
        endTime: timeEnd,
        note: timeNote.trim() || undefined,
        startTime: timeStart,
      })
      setTimeStart('09:00')
      setTimeEnd('10:00')
      setTimeNote('')
      requestAnimationFrame(() => {
        moneySectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
        moneyAmountInputRef.current?.focus()
      })
    } catch (error) {
      setTimeError(
        error instanceof Error ? error.message : 'Could not save time entry.',
      )
    } finally {
      setTimeSubmitting(false)
    }
  }

  async function handleAddMoneyEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = Number(moneyAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setMoneyError('Enter an amount greater than zero.')
      return
    }

    setMoneyError(null)
    setMoneySubmitting(true)

    try {
      await addMoneyEntry({
        amount,
        category: moneyCategory,
        date: selectedDate,
        note: moneyNote.trim() || undefined,
      })
      setMoneyAmount('')
      setMoneyNote('')
    } catch (error) {
      setMoneyError(
        error instanceof Error ? error.message : 'Could not save money entry.',
      )
    } finally {
      setMoneySubmitting(false)
    }
  }

  async function handleRemoveTimeEntry(id: Id<'timeEntries'>) {
    setRemovingKey(id)
    try {
      await removeTimeEntry({ id })
    } finally {
      setRemovingKey(null)
    }
  }

  async function handleRemoveMoneyEntry(id: Id<'moneyEntries'>) {
    setRemovingKey(id)
    try {
      await removeMoneyEntry({ id })
    } finally {
      setRemovingKey(null)
    }
  }

  return (
    <main className="page-wrap px-4 pb-10 pt-6 sm:pt-8">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-6 sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.28),transparent_68%)]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.16),transparent_72%)]" />

        <div className="relative flex justify-end">
          <Card className="w-full rounded-[1.6rem] border-[color-mix(in_oklab,var(--lagoon)_18%,var(--line))] bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-muted))] p-4 lg:max-w-[38rem]">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(shiftDate(selectedDate, -1))
                  })
                }}
              >
                <ArrowLeft size={16} />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--surface-panel))] text-[var(--lagoon-deep)]"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(today)
                  })
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(shiftDate(selectedDate, 1))
                  })
                }}
              >
                Next
                <ArrowRight size={16} />
              </Button>
            </div>

            <Label
              htmlFor="tracker-date"
              className="text-xs tracking-[0.18em] text-[var(--kicker)] uppercase"
            >
              Pick a day
            </Label>
            <Input
              id="tracker-date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                const nextDate = event.target.value
                startTransition(() => {
                  setSelectedDate(nextDate)
                })
              }}
              className="font-semibold"
            />
            <p className="m-0 min-h-6 text-sm text-[var(--sea-ink-soft)]">
              {isDateUpdating
                ? 'Updating entries...'
                : `Logging for ${selectedDate === today ? 'today' : formatDayLabel(selectedDate)}`}
            </p>
          </Card>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="rise-in bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(79,184,178,0.14)] p-3 text-[var(--lagoon-deep)]">
                <Clock3 size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Step 1</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Log a time range
                </h2>
              </div>
            </div>
            <Badge>First</Badge>
          </div>

          <form className="grid gap-4" onSubmit={handleAddTimeEntry}>
            <div>
              <Label className="mb-2 block">Category</Label>
              <div className="flex flex-wrap gap-2">
                {TIME_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-auto py-2',
                      timeCategory === category &&
                        'border-[color-mix(in_oklab,var(--lagoon)_36%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--chip-bg))] text-[var(--lagoon-deep)]',
                    )}
                    onClick={() => setTimeCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="block">
                <Label htmlFor="time-start" className="mb-2 block">
                  Start time
                </Label>
                <Input
                  id="time-start"
                  type="time"
                  value={timeStart}
                  onChange={(event) => setTimeStart(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="block">
                <Label htmlFor="time-end" className="mb-2 block">
                  End time
                </Label>
                <Input
                  id="time-end"
                  type="time"
                  value={timeEnd}
                  onChange={(event) => setTimeEnd(event.target.value)}
                />
              </div>
            </div>

            <div className="block">
              <Label htmlFor="time-note" className="mb-2 block">
                What did you do?
              </Label>
              <Textarea
                id="time-note"
                value={timeNote}
                onChange={(event) => setTimeNote(event.target.value)}
                className="resize-y"
                placeholder="Playing game"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                {timeError ?? 'Example: 10:00 to 13:00 for playing game.'}
              </p>
              <Button type="submit" disabled={timeSubmitting}>
                <Plus size={16} />
                {timeSubmitting ? 'Saving...' : 'Save time'}
              </Button>
            </div>
          </form>
        </Card>

        <Card
          ref={moneySectionRef}
          className="rise-in bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] p-5 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(47,106,74,0.14)] p-3 text-[var(--palm)]">
                <Coins size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Step 2</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Log money spent
                </h2>
              </div>
            </div>
            <Badge variant="secondary">Second</Badge>
          </div>

          <form className="grid gap-4" onSubmit={handleAddMoneyEntry}>
            <div>
              <Label className="mb-2 block">Category</Label>
              <div className="flex flex-wrap gap-2">
                {MONEY_CATEGORIES.map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'h-auto py-2',
                      moneyCategory === category &&
                        'border-[color-mix(in_oklab,var(--lagoon)_36%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--chip-bg))] text-[var(--lagoon-deep)]',
                    )}
                    onClick={() => setMoneyCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            <div className="block">
              <Label htmlFor="money-amount" className="mb-2 block">
                Amount
              </Label>
              <Input
                id="money-amount"
                ref={moneyAmountInputRef}
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={moneyAmount}
                onChange={(event) => setMoneyAmount(event.target.value)}
                placeholder="12.50"
              />
            </div>

            <div className="block">
              <Label htmlFor="money-note" className="mb-2 block">
                What was it for?
              </Label>
              <Textarea
                id="money-note"
                value={moneyNote}
                onChange={(event) => setMoneyNote(event.target.value)}
                className="resize-y"
                placeholder="Snack, transport, game top-up"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                {moneyError ?? 'Add the amount after you finish logging the time block.'}
              </p>
              <Button
                type="submit"
                disabled={moneySubmitting}
                className="bg-[linear-gradient(90deg,var(--palm),#55b482)] shadow-[0_16px_32px_rgba(47,106,74,0.22)]"
              >
                <Plus size={16} />
                {moneySubmitting ? 'Saving...' : 'Save money'}
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked time"
          value={dashboard ? formatDuration(dashboard.totalMinutes) : '--'}
          tone="time"
        />
        <StatCard
          label="Money spent"
          value={dashboard ? moneyFormatter.format(dashboard.totalSpent) : '--'}
          tone="money"
        />
        <StatCard
          label="Time entries"
          value={dashboard ? String(dashboard.timeEntries.length) : '--'}
          tone="neutral"
        />
        <StatCard
          label="Money entries"
          value={dashboard ? String(dashboard.moneyEntries.length) : '--'}
          tone="neutral"
        />
      </section>

      <section className="mt-8 grid gap-6">
        <Card className="rise-in bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="island-kicker mb-1">Breakdown</p>
              <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                Where the day went
              </h2>
            </div>
            <Badge variant="outline" className="m-0">
              {dashboard
                ? `${dashboard.timeEntries.length + dashboard.moneyEntries.length} entries`
                : 'Loading'}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SummaryList
              emptyLabel="No time logged yet."
              icon={<Clock3 size={16} />}
              items={
                dashboard?.timeBreakdown.map((item) => ({
                  label: item.category,
                  value: formatDuration(item.total),
                })) ?? []
              }
              title="Time by category"
            />
            <SummaryList
              emptyLabel="No money logged yet."
              icon={<ReceiptText size={16} />}
              items={
                dashboard?.moneyBreakdown.map((item) => ({
                  label: item.category,
                  value: moneyFormatter.format(item.total),
                })) ?? []
              }
              title="Money by category"
            />
          </div>
        </Card>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="rise-in bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(79,184,178,0.14)] p-3 text-[var(--lagoon-deep)]">
                <Clock3 size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Entries</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Time
                </h2>
              </div>
            </div>

              <div className="grid gap-3">
                {dashboard?.timeEntries.length ? (
                  dashboard.timeEntries.map((entry) => (
                    <TimeEntryCard
                      key={entry._id}
                      entry={entry}
                      isRemoving={removingKey === entry._id}
                      onRemove={handleRemoveTimeEntry}
                    />
                  ))
                ) : (
                  <EmptyState text="No time entries for this day yet." />
                )}
              </div>
          </Card>

          <Card className="rise-in bg-[linear-gradient(180deg,var(--surface-panel-strong),var(--surface-panel))] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(47,106,74,0.14)] p-3 text-[var(--palm)]">
                <Coins size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Entries</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Money
                </h2>
              </div>
            </div>

            <div className="grid gap-3">
              {dashboard?.moneyEntries.length ? (
                dashboard.moneyEntries.map((entry) => (
                  <MoneyEntryCard
                    key={entry._id}
                    entry={entry}
                    isRemoving={removingKey === entry._id}
                    onRemove={handleRemoveMoneyEntry}
                  />
                ))
              ) : (
                <EmptyState text="No money entries for this day yet." />
              )}
            </div>
          </Card>
        </section>
      </section>
    </main>
  )
}

function StatCard({
  label,
  tone,
  value,
}: {
  label: string
  tone: 'money' | 'neutral' | 'time'
  value: string
}) {
  const toneClass =
    tone === 'time'
      ? 'border-[color-mix(in_oklab,var(--lagoon)_26%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_14%,var(--surface-panel))]'
      : tone === 'money'
        ? 'border-[color-mix(in_oklab,var(--palm)_22%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_14%,var(--surface-panel))]'
        : 'border-[var(--line)] bg-[var(--surface-muted)]'

  return (
    <Card className={cn('metric-card rounded-[1.4rem] border p-4', toneClass)}>
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
        {label}
      </p>
      <p className="m-0 text-2xl font-semibold tracking-tight text-[var(--sea-ink)]">
        {value}
      </p>
    </Card>
  )
}

function SummaryList({
  emptyLabel,
  icon,
  items,
  title,
}: {
  emptyLabel: string
  icon: ReactNode
  items: Array<{ label: string; value: string }>
  title: string
}) {
  return (
    <Card className="rounded-[1.5rem] bg-[var(--surface-muted)] p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
        {icon}
        {title}
      </div>
      {items.length ? (
        <div className="grid gap-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-3"
            >
              <span className="text-sm text-[var(--sea-ink)]">{item.label}</span>
              <span className="text-sm font-semibold text-[var(--sea-ink)]">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={emptyLabel} />
      )}
    </Card>
  )
}

function TimeEntryCard({
  entry,
  isRemoving,
  onRemove,
}: {
  entry: TimeEntry
  isRemoving: boolean
  onRemove: (id: Id<'timeEntries'>) => Promise<void>
}) {
  return (
    <Card className="rounded-[1.4rem] bg-[linear-gradient(180deg,var(--surface-panel),var(--surface-muted))] p-4 shadow-[0_12px_28px_rgba(4,12,16,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {entry.category}
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onRemove(entry._id)}
          disabled={isRemoving}
          variant="outline"
          size="icon"
          className="h-9 w-9 border-[rgba(196,77,77,0.2)] bg-[var(--surface-inset)] text-[var(--sea-ink-soft)]"
        >
          <Trash2 size={15} />
        </Button>
      </div>
      <p className="mb-0 mt-3 text-lg font-semibold text-[var(--sea-ink)]">
        {formatTimeRange(entry)}
      </p>
      <p className="mb-0 mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--kicker)]">
        {formatDuration(entry.durationMinutes)}
      </p>
      {entry.note ? (
        <p className="mb-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {entry.note}
        </p>
      ) : null}
    </Card>
  )
}

function MoneyEntryCard({
  entry,
  isRemoving,
  onRemove,
}: {
  entry: MoneyEntry
  isRemoving: boolean
  onRemove: (id: Id<'moneyEntries'>) => Promise<void>
}) {
  return (
    <Card className="rounded-[1.4rem] bg-[linear-gradient(180deg,var(--surface-panel),var(--surface-muted))] p-4 shadow-[0_12px_28px_rgba(4,12,16,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {entry.category}
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => onRemove(entry._id)}
          disabled={isRemoving}
          variant="outline"
          size="icon"
          className="h-9 w-9 border-[rgba(196,77,77,0.2)] bg-[var(--surface-inset)] text-[var(--sea-ink-soft)]"
        >
          <Trash2 size={15} />
        </Button>
      </div>
      <p className="mb-0 mt-3 text-lg font-semibold text-[var(--sea-ink)]">
        {moneyFormatter.format(entry.amount)}
      </p>
      {entry.note ? (
        <p className="mb-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {entry.note}
        </p>
      ) : null}
    </Card>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="rounded-[1.4rem] border-dashed bg-[var(--surface-muted)] px-4 py-6 text-center text-sm text-[var(--sea-ink-soft)] shadow-none">
      {text}
    </Card>
  )
}
