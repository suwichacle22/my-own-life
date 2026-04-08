import { createFileRoute } from '@tanstack/react-router'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Clock3,
  Coins,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'

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
type CoverageRange = {
  endMinute: number
  startMinute: number
}
type CoverageSummary = {
  isComplete: boolean
  missingRanges: CoverageRange[]
  overlapRanges: CoverageRange[]
}
type TimeTableRow = {
  createdAt: number
  date: string
  entry: TimeEntry
  id: Id<'timeEntries'>
  note: string
  sortMinute: number
  timeRange: string
}
const FULL_DAY_MINUTES = 24 * 60

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
  if (value === '24:00') {
    return '24:00'
  }

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

function formatMinuteInput(minute: number) {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatCoverageMinute(minute: number) {
  if (minute === FULL_DAY_MINUTES) {
    return '24:00'
  }

  return formatMinuteInput(minute)
}

function formatCoverageRange(range: CoverageRange) {
  return `${formatCoverageMinute(range.startMinute)} - ${formatCoverageMinute(range.endMinute)}`
}

function buildCoverageSummary(entries: TimeEntry[]): CoverageSummary {
  const orderedEntries = [...entries]
    .filter(
      (entry): entry is TimeEntry & { endMinute: number; startMinute: number } =>
        entry.startMinute !== undefined && entry.endMinute !== undefined,
    )
    .sort((left, right) => left.startMinute - right.startMinute)

  const missingRanges: CoverageRange[] = []
  const overlapRanges: CoverageRange[] = []
  let cursor = 0

  for (const entry of orderedEntries) {
    if (entry.startMinute > cursor) {
      missingRanges.push({
        endMinute: entry.startMinute,
        startMinute: cursor,
      })
    }

    if (entry.startMinute < cursor) {
      const overlapEnd = Math.min(entry.endMinute, cursor)
      if (overlapEnd > entry.startMinute) {
        overlapRanges.push({
          endMinute: overlapEnd,
          startMinute: entry.startMinute,
        })
      }
    }

    cursor = Math.max(cursor, entry.endMinute)
  }

  if (cursor < FULL_DAY_MINUTES) {
    missingRanges.push({
      endMinute: FULL_DAY_MINUTES,
      startMinute: cursor,
    })
  }

  return {
    isComplete:
      missingRanges.length === 0 &&
      overlapRanges.length === 0 &&
      cursor === FULL_DAY_MINUTES,
    missingRanges,
    overlapRanges,
  }
}

function getCoverageSummary(
  entries: TimeEntry[],
  coverage?: CoverageSummary,
): CoverageSummary {
  return coverage ?? buildCoverageSummary(entries)
}

function getEntryStartTime(entry: TimeEntry) {
  if (entry.startTime) {
    return entry.startTime
  }

  if (typeof entry.startMinute === 'number') {
    return formatMinuteInput(entry.startMinute)
  }

  return '09:00'
}

function getEntryEndTime(entry: TimeEntry) {
  if (entry.endTime) {
    return entry.endTime
  }

  if (typeof entry.endMinute === 'number') {
    return formatMinuteInput(entry.endMinute)
  }

  if (typeof entry.startMinute === 'number') {
    return formatMinuteInput(entry.startMinute + entry.durationMinutes)
  }

  return '10:00'
}

function createTimeDraft(entry: TimeEntry) {
  const entryEndTime = getEntryEndTime(entry)
  return {
    endTime: entryEndTime === '24:00' ? '23:59' : entryEndTime,
    note: entry.note ?? '',
    startTime: getEntryStartTime(entry),
    useEndOfDay: entryEndTime === '24:00',
  }
}

function createMoneyDraft(entry: MoneyEntry) {
  return {
    amount: entry.amount.toFixed(2),
    note: entry.note ?? '',
  }
}

function openTimePicker(input: HTMLInputElement | null) {
  if (!input) {
    return
  }

  input.focus()

  try {
    ;(input as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
  } catch {
    // Some browsers expose time inputs without supporting programmatic picker open.
  }
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
  const updateTimeEntry = useMutation(api.tracker.updateTimeEntry)
  const updateMoneyEntry = useMutation(api.tracker.updateMoneyEntry)

  const [timeStart, setTimeStart] = useState('09:00')
  const [timeEnd, setTimeEnd] = useState('10:00')
  const [timeUseEndOfDay, setTimeUseEndOfDay] = useState(false)
  const [timeNote, setTimeNote] = useState('')
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyNote, setMoneyNote] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)
  const [moneyError, setMoneyError] = useState<string | null>(null)
  const [timeSubmitting, setTimeSubmitting] = useState(false)
  const [moneySubmitting, setMoneySubmitting] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const [editingTimeEntryId, setEditingTimeEntryId] =
    useState<Id<'timeEntries'> | null>(null)
  const moneySectionRef = useRef<HTMLElement | null>(null)
  const moneyAmountInputRef = useRef<HTMLInputElement | null>(null)
  const timeStartInputRef = useRef<HTMLInputElement | null>(null)
  const timeEndInputRef = useRef<HTMLInputElement | null>(null)

  const isDateUpdating = deferredDate !== selectedDate
  const editingTimeEntry =
    dashboard?.timeEntries.find((entry) => entry._id === editingTimeEntryId) ?? null
  const coverage = dashboard
    ? getCoverageSummary(
        dashboard.timeEntries,
        (dashboard as { coverage?: CoverageSummary }).coverage,
      )
    : null

  async function handleAddTimeEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!timeStart || (!timeUseEndOfDay && !timeEnd)) {
      setTimeError('Choose both a start time and an end time.')
      return
    }

    setTimeError(null)
    setTimeSubmitting(true)

    try {
      await addTimeEntry({
        date: selectedDate,
        endTime: timeUseEndOfDay ? '24:00' : timeEnd,
        note: timeNote.trim() || undefined,
        startTime: timeStart,
      })
      setTimeStart('09:00')
      setTimeEnd('10:00')
      setTimeUseEndOfDay(false)
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
    setEditingTimeEntryId((current) => (current === id ? null : current))
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

  async function handleUpdateTimeEntry(
    id: Id<'timeEntries'>,
    values: {
      endTime: string
      note?: string
      startTime: string
    },
  ) {
    await updateTimeEntry({
      id,
      ...values,
    })
    setEditingTimeEntryId(null)
  }

  async function handleUpdateMoneyEntry(
    id: Id<'moneyEntries'>,
    values: {
      amount: number
      note?: string
    },
  ) {
    await updateMoneyEntry({
      id,
      ...values,
    })
  }

  return (
    <main className="page-wrap px-4 pb-10 pt-4 sm:pt-8">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-4 py-4 sm:px-8 sm:py-7">
        <div className="relative">
          <Card className="w-full rounded-[1.6rem] border-[color-mix(in_oklab,var(--lagoon)_18%,var(--line))] bg-[var(--surface-panel-strong)] p-3 sm:p-4">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-0 justify-center"
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
                className="min-w-0 justify-center bg-[color-mix(in_oklab,var(--lagoon)_22%,var(--surface-panel))] text-[var(--lagoon-deep)]"
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
                className="min-w-0 justify-center"
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
        <Card className="rise-in bg-[var(--surface-panel-strong)] p-4 sm:p-6">
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
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
            <Badge className="self-start sm:self-auto">First</Badge>
          </div>

          <form className="grid gap-4" onSubmit={handleAddTimeEntry}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeField
                id="time-start"
                label="Start time"
                value={timeStart}
                onChange={setTimeStart}
                inputRef={timeStartInputRef}
                autoFocus
              />
              <EndTimeField
                id="time-end"
                label="End time"
                value={timeEnd}
                onChange={setTimeEnd}
                inputRef={timeEndInputRef}
                useEndOfDay={timeUseEndOfDay}
                onToggleUseEndOfDay={setTimeUseEndOfDay}
              />
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                {timeError ?? 'Example: 10:00 to 13:00 for playing game.'}
              </p>
              <Button type="submit" disabled={timeSubmitting} className="w-full sm:w-auto">
                <Plus size={16} />
                {timeSubmitting ? 'Saving...' : 'Save time'}
              </Button>
            </div>
          </form>
        </Card>

        <Card
          ref={moneySectionRef}
          className="rise-in bg-[var(--surface-panel-strong)] p-4 sm:p-6"
        >
          <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
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
            <Badge variant="secondary" className="self-start sm:self-auto">
              Second
            </Badge>
          </div>

          <form className="grid gap-4" onSubmit={handleAddMoneyEntry}>
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
                {moneyError ?? 'Add the amount after you finish logging the time block.'}
              </p>
              <Button
                type="submit"
                disabled={moneySubmitting}
                className="w-full bg-[linear-gradient(90deg,var(--palm),#55b482)] shadow-[0_16px_32px_rgba(47,106,74,0.22)] sm:w-auto"
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

      <section className="mt-8">
        <Card className="rise-in bg-[var(--surface-panel-strong)] p-4 sm:p-6">
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

          {coverage ? <DayCoverageNotice coverage={coverage} /> : null}

          {dashboard?.timeEntries.length ? (
            <div className="grid gap-4">
              <TimeEntriesTable
                entries={dashboard.timeEntries}
                editingId={editingTimeEntryId}
                onEdit={setEditingTimeEntryId}
                onRemove={handleRemoveTimeEntry}
                removingKey={removingKey}
              />
              {editingTimeEntry ? (
                <TimeEntryEditor
                  key={editingTimeEntry._id}
                  entry={editingTimeEntry}
                  onCancel={() => setEditingTimeEntryId(null)}
                  onSave={handleUpdateTimeEntry}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState text="No time entries for this day yet." />
          )}
        </Card>
      </section>

      <section className="mt-6">
        <Card className="rise-in bg-[var(--surface-panel-strong)] p-4 sm:p-6">
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
                  onSave={handleUpdateMoneyEntry}
                />
              ))
            ) : (
              <EmptyState text="No money entries for this day yet." />
            )}
          </div>
        </Card>
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
      <p className="m-0 text-xl font-semibold tracking-tight text-[var(--sea-ink)] sm:text-2xl">
        {value}
      </p>
    </Card>
  )
}

function TimeField({
  autoFocus = false,
  compact = false,
  disabled = false,
  helperText = 'Click the field to open the time picker, or type a time like 09:00.',
  id,
  inputRef,
  label,
  onChange,
  value,
}: {
  autoFocus?: boolean
  compact?: boolean
  disabled?: boolean
  helperText?: string | null
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <div className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Label htmlFor={id} className="block">
          {label}
        </Label>
        <span
          className={cn(
            'hidden text-xs font-semibold tracking-[0.12em] text-[var(--kicker)] uppercase sm:inline',
            compact && 'sm:hidden',
          )}
        >
          Pick or type
        </span>
      </div>

      <div
        className={cn(
          'border border-[color-mix(in_oklab,var(--line)_88%,transparent_12%)] bg-[var(--surface-inset)] transition-[border-color,box-shadow] focus-within:border-[color-mix(in_oklab,var(--lagoon-deep)_52%,var(--line))] focus-within:ring-2 focus-within:ring-[color-mix(in_oklab,var(--lagoon)_30%,transparent)]',
          compact
            ? 'rounded-[18px] p-1.5 shadow-none'
            : 'rounded-[20px] p-1.5 shadow-[0_1px_0_var(--inset-glint)_inset,0_14px_28px_rgba(4,12,16,0.12)] sm:p-2',
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id={id}
            ref={inputRef}
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onClick={(event) => openTimePicker(event.currentTarget)}
            autoFocus={autoFocus}
            disabled={disabled}
            className="h-10 w-full border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'hidden shrink-0 rounded-2xl border-[color-mix(in_oklab,var(--lagoon)_26%,var(--line))] bg-[color-mix(in_oklab,var(--lagoon)_14%,var(--surface-panel))] px-3 text-[var(--lagoon-deep)] sm:inline-flex',
              compact && 'shadow-none',
            )}
            onClick={() => openTimePicker(inputRef.current)}
          >
            <Clock3 size={16} />
            Pick
          </Button>
        </div>
        {helperText ? (
          <p className="mb-0 mt-2 hidden px-2 text-xs text-[var(--sea-ink-soft)] sm:block">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function EndTimeField({
  compact = false,
  id,
  inputRef,
  label,
  onChange,
  onToggleUseEndOfDay,
  useEndOfDay,
  value,
}: {
  compact?: boolean
  id: string
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  onChange: (value: string) => void
  onToggleUseEndOfDay: (value: boolean) => void
  useEndOfDay: boolean
  value: string
}) {
  if (useEndOfDay) {
    return (
      <div className="grid gap-2">
        <div className="rounded-[18px] border border-[color-mix(in_oklab,var(--line)_88%,transparent_12%)] bg-[var(--surface-inset)] p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label htmlFor={id} className="block">
              {label}
            </Label>
            <Badge>24:00</Badge>
          </div>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            This entry runs until the end of the day.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(compact && 'shadow-none')}
          onClick={() => onToggleUseEndOfDay(false)}
        >
          Choose a time instead
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <TimeField
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        inputRef={inputRef}
        helperText={compact ? null : 'Click the field to open the time picker, or use 24:00 for the end of the day.'}
        compact={compact}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('justify-center', compact && 'shadow-none')}
        onClick={() => onToggleUseEndOfDay(true)}
      >
        Use end of day
      </Button>
    </div>
  )
}

function DayCoverageNotice({ coverage }: { coverage: CoverageSummary }) {
  const hasIssues =
    coverage.missingRanges.length > 0 || coverage.overlapRanges.length > 0

  return (
    <Card className="mb-4 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface-inset)] p-4 shadow-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            {coverage.isComplete ? 'Day complete' : 'Day not complete'}
          </p>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            {coverage.isComplete
              ? 'You have logged the full 24 hours with no overlaps.'
              : 'The app checks the full day from 00:00 to 24:00 and flags missing or overlapping time.'}
          </p>
        </div>
        <Badge variant={coverage.isComplete ? 'secondary' : 'outline'}>
          {coverage.isComplete ? '24h covered' : 'Needs attention'}
        </Badge>
      </div>

      {hasIssues ? (
        <div className="mt-3 grid gap-2 text-sm">
          {coverage.missingRanges.length ? (
            <p className="m-0 text-[var(--sea-ink)]">
              Missing time: {coverage.missingRanges.map(formatCoverageRange).join(', ')}
            </p>
          ) : null}
          {coverage.overlapRanges.length ? (
            <p className="m-0 text-[var(--sea-ink)]">
              Overlap detected: {coverage.overlapRanges.map(formatCoverageRange).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function TimeEntriesTable({
  editingId,
  entries,
  onEdit,
  onRemove,
  removingKey,
}: {
  editingId: Id<'timeEntries'> | null
  entries: TimeEntry[]
  onEdit: (id: Id<'timeEntries'>) => void
  onRemove: (id: Id<'timeEntries'>) => Promise<void>
  removingKey: string | null
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { desc: false, id: 'timeRange' },
  ])

  const rows = useMemo<TimeTableRow[]>(
    () =>
      entries.map((entry) => ({
        createdAt: entry.createdAt,
        date: entry.date,
        entry,
        id: entry._id,
        note: entry.note?.trim() || 'No note',
        sortMinute: entry.startMinute ?? Number.MAX_SAFE_INTEGER,
        timeRange: formatTimeRange(entry),
      })),
    [entries],
  )

  const columns = useMemo<ColumnDef<TimeTableRow>[]>(
    () => [
      {
        accessorKey: 'date',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--sea-ink)]">
            {row.original.date}
          </span>
        ),
        header: 'Date',
      },
      {
        accessorKey: 'timeRange',
        cell: ({ row }) => (
          <div>
            <p className="m-0 font-semibold text-[var(--sea-ink)]">
              {row.original.timeRange}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--kicker)]">
              {formatDuration(row.original.entry.durationMinutes)}
            </p>
          </div>
        ),
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 px-3 text-[var(--sea-ink)]"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === 'asc')
            }
          >
            Time range
            <ArrowUpDown size={14} />
          </Button>
        ),
        sortingFn: (left, right) => {
          const minuteDelta =
            left.original.sortMinute - right.original.sortMinute
          if (minuteDelta !== 0) {
            return minuteDelta
          }

          return left.original.createdAt - right.original.createdAt
        },
      },
      {
        accessorKey: 'note',
        cell: ({ row }) => (
          <span className="max-w-[22rem] whitespace-normal text-[var(--sea-ink-soft)]">
            {row.original.note}
          </span>
        ),
        header: 'What I did',
      },
      {
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onEdit(row.original.id)}
            >
              {editingId === row.original.id ? 'Editing' : 'Edit'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 border-[rgba(196,77,77,0.2)] bg-[var(--surface-inset)] text-[var(--sea-ink-soft)]"
              disabled={removingKey === row.original.id}
              onClick={() => onRemove(row.original.id)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ),
        header: () => <span className="sr-only">Actions</span>,
        id: 'actions',
      },
    ],
    [editingId, onEdit, onRemove, removingKey],
  )

  const table = useReactTable({
    columns,
    data: rows,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface-inset)]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.id === 'actions' ? 'text-right' : undefined}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                editingId === row.original.id &&
                  'bg-[color-mix(in_oklab,var(--lagoon)_12%,var(--surface-inset))]',
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cell.column.id === 'actions' ? 'w-28 text-right' : undefined}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TimeEntryEditor({
  entry,
  onCancel,
  onSave,
}: {
  entry: TimeEntry
  onCancel: () => void
  onSave: (
    id: Id<'timeEntries'>,
    values: {
      endTime: string
      note?: string
      startTime: string
    },
  ) => Promise<void>
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => createTimeDraft(entry))
  const startInputRef = useRef<HTMLInputElement | null>(null)
  const endInputRef = useRef<HTMLInputElement | null>(null)

  function resetDraft() {
    setDraft(createTimeDraft(entry))
    setError(null)
  }

  function handleCancelEdit() {
    resetDraft()
    onCancel()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draft.startTime || (!draft.useEndOfDay && !draft.endTime)) {
      setError('Choose both a start time and an end time.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(entry._id, {
        endTime: draft.useEndOfDay ? '24:00' : draft.endTime,
        note: draft.note.trim() || undefined,
        startTime: draft.startTime,
      })
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update time entry.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-[1.4rem] bg-[var(--surface-panel)] p-4 shadow-[0_12px_28px_rgba(4,12,16,0.16)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
            Edit time entry
          </p>
          <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <Badge variant="outline">Editing</Badge>
      </div>

      <form className="grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TimeField
            id={`time-start-${entry._id}`}
            label="Start time"
            value={draft.startTime}
            onChange={(value) =>
              setDraft((current) => ({ ...current, startTime: value }))
            }
            inputRef={startInputRef}
            helperText={null}
            compact
          />
          <EndTimeField
            id={`time-end-${entry._id}`}
            label="End time"
            value={draft.endTime}
            onChange={(value) =>
              setDraft((current) => ({ ...current, endTime: value }))
            }
            inputRef={endInputRef}
            useEndOfDay={draft.useEndOfDay}
            onToggleUseEndOfDay={(useEndOfDay) =>
              setDraft((current) => ({ ...current, useEndOfDay }))
            }
            compact
          />
        </div>

        <div>
          <Label htmlFor={`time-note-${entry._id}`} className="mb-2 block">
            What did you do?
          </Label>
          <Textarea
            id={`time-note-${entry._id}`}
            value={draft.note}
            onChange={(event) =>
              setDraft((current) => ({ ...current, note: event.target.value }))
            }
            className="min-h-20 resize-y"
            placeholder="Playing game"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
            {error ?? 'Update the time range or note, then save.'}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}

function MoneyEntryCard({
  entry,
  isRemoving,
  onRemove,
  onSave,
}: {
  entry: MoneyEntry
  isRemoving: boolean
  onRemove: (id: Id<'moneyEntries'>) => Promise<void>
  onSave: (
    id: Id<'moneyEntries'>,
    values: {
      amount: number
      note?: string
    },
  ) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => createMoneyDraft(entry))

  function resetDraft() {
    setDraft(createMoneyDraft(entry))
    setError(null)
  }

  function handleStartEdit() {
    resetDraft()
    setIsEditing(true)
  }

  function handleCancelEdit() {
    resetDraft()
    setIsEditing(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(entry._id, {
        amount,
        note: draft.note.trim() || undefined,
      })
      setIsEditing(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update money entry.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <Card className="rounded-[1.4rem] bg-[var(--surface-panel)] p-4 shadow-[0_12px_28px_rgba(4,12,16,0.16)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
              Edit money entry
            </p>
            <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">
              Logged {formatLoggedTime(entry.createdAt)}
            </p>
          </div>
          <Badge variant="secondary">Editing</Badge>
        </div>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor={`money-amount-${entry._id}`} className="mb-2 block">
              Amount
            </Label>
            <Input
              id={`money-amount-${entry._id}`}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) =>
                setDraft((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="12.50"
            />
          </div>

          <div>
            <Label htmlFor={`money-note-${entry._id}`} className="mb-2 block">
              What was it for?
            </Label>
            <Textarea
              id={`money-note-${entry._id}`}
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({ ...current, note: event.target.value }))
              }
              className="min-h-20 resize-y"
              placeholder="Snack, transport, game top-up"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 min-h-5 text-sm text-[var(--sea-ink-soft)]">
              {error ?? 'Adjust the amount or note, then save.'}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    )
  }

  return (
    <Card className="rounded-[1.4rem] bg-[var(--surface-panel)] p-4 shadow-[0_12px_28px_rgba(4,12,16,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
            Logged {formatLoggedTime(entry.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleStartEdit}
            disabled={isRemoving}
            variant="outline"
            size="sm"
          >
            Edit
          </Button>
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
