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
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
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

const DURATION_PRESETS = [30, 60, 90, 120]

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
  ssr: false,
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
  const [timeDuration, setTimeDuration] = useState('60')
  const [timeNote, setTimeNote] = useState('')
  const [moneyCategory, setMoneyCategory] = useState(MONEY_CATEGORIES[0])
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyNote, setMoneyNote] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [moneyError, setMoneyError] = useState<string | null>(null)
  const [timeSubmitting, setTimeSubmitting] = useState(false)
  const [moneySubmitting, setMoneySubmitting] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)

  const isDateUpdating = deferredDate !== selectedDate

  async function handleAddTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const durationMinutes = Number(timeDuration)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setTimeError('Enter a duration greater than zero.')
      return
    }

    setTimeError(null)
    setTimeSubmitting(true)

    try {
      await addTimeEntry({
        category: timeCategory,
        date: selectedDate,
        durationMinutes,
        note: timeNote.trim() || undefined,
      })
      setTimeDuration('60')
      setTimeNote('')
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
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.28),transparent_68%)]" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.16),transparent_72%)]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="island-kicker mb-3">Daily tracker</p>
            <h1 className="display-title mb-3 text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
              {selectedDate === today ? 'Today' : formatDayLabel(selectedDate)}
            </h1>
            <p className="m-0 max-w-xl text-sm leading-7 text-[var(--sea-ink-soft)] sm:text-base">
              Track what your day actually cost in time and money. Keep entries
              quick, consistent, and easy enough to log from your phone.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-[1.6rem] border border-[var(--line)] bg-white/60 p-4 shadow-[0_18px_38px_rgba(23,58,64,0.08)] sm:min-w-[23rem]">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(shiftDate(selectedDate, -1))
                  })
                }}
              >
                <ArrowLeft size={16} />
                Prev
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--chip-line)] bg-[rgba(79,184,178,0.14)] px-4 py-2 text-sm font-semibold text-[var(--lagoon-deep)]"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(today)
                  })
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)]"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(shiftDate(selectedDate, 1))
                  })
                }}
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>

            <label
              htmlFor="tracker-date"
              className="text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase"
            >
              Pick a day
            </label>
            <input
              id="tracker-date"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                const nextDate = event.target.value
                startTransition(() => {
                  setSelectedDate(nextDate)
                })
              }}
              className="tracker-input px-4 py-3 text-base font-semibold"
            />
            <p className="m-0 min-h-6 text-sm text-[var(--sea-ink-soft)]">
              {isDateUpdating
                ? 'Updating entries...'
                : `Viewing ${formatDayLabel(selectedDate)}`}
            </p>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <div className="grid gap-6">
          <section className="tracker-panel rise-in rounded-[1.8rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(79,184,178,0.14)] p-3 text-[var(--lagoon-deep)]">
                <Clock3 size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Add time</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Log minutes for {selectedDate === today ? 'today' : 'this day'}
                </h2>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={handleAddTimeEntry}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIME_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`tracker-chip ${
                        timeCategory === category ? 'tracker-chip-active' : ''
                      }`}
                      onClick={() => setTimeCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                    Duration in minutes
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    inputMode="numeric"
                    value={timeDuration}
                    onChange={(event) => setTimeDuration(event.target.value)}
                    className="tracker-input w-full px-4 py-3 text-base"
                    placeholder="60"
                  />
                </label>
                <div>
                  <span className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                    Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_PRESETS.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className="tracker-chip"
                        onClick={() => setTimeDuration(String(minutes))}
                      >
                        {formatDuration(minutes)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                  Note
                </span>
                <textarea
                  value={timeNote}
                  onChange={(event) => setTimeNote(event.target.value)}
                  className="tracker-input min-h-24 w-full resize-y px-4 py-3 text-base"
                  placeholder="Optional note"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                  {timeError ?? 'Minutes are easier to log consistently than start/end times.'}
                </p>
                <button
                  type="submit"
                  disabled={timeSubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--lagoon-deep),#61cbc2)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(50,143,151,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {timeSubmitting ? 'Saving...' : 'Save time'}
                </button>
              </div>
            </form>
          </section>

          <section className="tracker-panel rise-in rounded-[1.8rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-[rgba(47,106,74,0.14)] p-3 text-[var(--palm)]">
                <Coins size={20} />
              </div>
              <div>
                <p className="island-kicker mb-1">Add money</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Log cash outflow for the same day
                </h2>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={handleAddMoneyEntry}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {MONEY_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`tracker-chip ${
                        moneyCategory === category ? 'tracker-chip-active' : ''
                      }`}
                      onClick={() => setMoneyCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                  Amount
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={moneyAmount}
                  onChange={(event) => setMoneyAmount(event.target.value)}
                  className="tracker-input w-full px-4 py-3 text-base"
                  placeholder="12.50"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[var(--sea-ink)]">
                  Note
                </span>
                <textarea
                  value={moneyNote}
                  onChange={(event) => setMoneyNote(event.target.value)}
                  className="tracker-input min-h-24 w-full resize-y px-4 py-3 text-base"
                  placeholder="Optional note"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                  {moneyError ?? 'Use a short merchant or purpose note if it helps later.'}
                </p>
                <button
                  type="submit"
                  disabled={moneySubmitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,var(--palm),#55b482)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(47,106,74,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {moneySubmitting ? 'Saving...' : 'Save money'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="grid gap-6">
          <section className="tracker-panel rise-in rounded-[1.8rem] p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="island-kicker mb-1">Breakdown</p>
                <h2 className="m-0 text-lg font-semibold text-[var(--sea-ink)]">
                  Where the day went
                </h2>
              </div>
              <p className="m-0 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)]">
                {dashboard
                  ? `${dashboard.timeEntries.length + dashboard.moneyEntries.length} entries`
                  : 'Loading'}
              </p>
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
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <section className="tracker-panel rise-in rounded-[1.8rem] p-5 sm:p-6">
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
            </section>

            <section className="tracker-panel rise-in rounded-[1.8rem] p-5 sm:p-6">
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
            </section>
          </section>
        </div>
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
      ? 'border-[rgba(50,143,151,0.2)] bg-[rgba(79,184,178,0.12)]'
      : tone === 'money'
        ? 'border-[rgba(47,106,74,0.2)] bg-[rgba(47,106,74,0.1)]'
        : 'border-[var(--line)] bg-white/52'

  return (
    <article className={`metric-card rounded-[1.4rem] border p-4 ${toneClass}`}>
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[var(--kicker)] uppercase">
        {label}
      </p>
      <p className="m-0 text-2xl font-semibold tracking-tight text-[var(--sea-ink)]">
        {value}
      </p>
    </article>
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
    <section className="rounded-[1.5rem] border border-[var(--line)] bg-white/42 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--sea-ink)]">
        {icon}
        {title}
      </div>
      {items.length ? (
        <div className="grid gap-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-[rgba(23,58,64,0.08)] bg-white/62 px-3 py-3"
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
    </section>
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
    <article className="rounded-[1.4rem] border border-[var(--line)] bg-white/56 p-4 shadow-[0_12px_28px_rgba(23,58,64,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {entry.category}
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(entry._id)}
          disabled={isRemoving}
          className="rounded-full border border-[rgba(196,77,77,0.18)] bg-[rgba(255,255,255,0.72)] p-2 text-[var(--sea-ink-soft)] disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <p className="mb-0 mt-3 text-lg font-semibold text-[var(--sea-ink)]">
        {formatDuration(entry.durationMinutes)}
      </p>
      {entry.note ? (
        <p className="mb-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {entry.note}
        </p>
      ) : null}
    </article>
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
    <article className="rounded-[1.4rem] border border-[var(--line)] bg-white/56 p-4 shadow-[0_12px_28px_rgba(23,58,64,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {entry.category}
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(entry._id)}
          disabled={isRemoving}
          className="rounded-full border border-[rgba(196,77,77,0.18)] bg-[rgba(255,255,255,0.72)] p-2 text-[var(--sea-ink-soft)] disabled:opacity-50"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <p className="mb-0 mt-3 text-lg font-semibold text-[var(--sea-ink)]">
        {moneyFormatter.format(entry.amount)}
      </p>
      {entry.note ? (
        <p className="mb-0 mt-2 text-sm leading-6 text-[var(--sea-ink-soft)]">
          {entry.note}
        </p>
      ) : null}
    </article>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[1.4rem] border border-dashed border-[var(--line)] bg-white/34 px-4 py-6 text-center text-sm text-[var(--sea-ink-soft)]">
      {text}
    </div>
  )
}
