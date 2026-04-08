import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

const DEFAULT_ENTRY_CATEGORY = 'General'
const FULL_DAY_MINUTES = 24 * 60

function parseTimeString(value: string, options?: { allowEndOfDay?: boolean }) {
  if (options?.allowEndOfDay && value === '24:00') {
    return FULL_DAY_MINUTES
  }

  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error('Time must use HH:MM format.')
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error('Time must be a valid 24-hour value.')
  }

  return hours * 60 + minutes
}

function trimOptionalString(value?: string) {
  return value?.trim() || undefined
}

function formatMinuteRange(startMinute: number, endMinute: number) {
  return { endMinute, startMinute }
}

function buildCoverageSummary(
  entries: Array<{
    endMinute?: number
    startMinute?: number
  }>,
) {
  const orderedEntries = entries
    .filter(
      (entry): entry is { endMinute: number; startMinute: number } =>
        entry.startMinute !== undefined && entry.endMinute !== undefined,
    )
    .sort((left, right) => left.startMinute - right.startMinute)

  const missingRanges: Array<{ endMinute: number; startMinute: number }> = []
  const overlapRanges: Array<{ endMinute: number; startMinute: number }> = []

  let cursor = 0
  for (const entry of orderedEntries) {
    if (entry.startMinute > cursor) {
      missingRanges.push(formatMinuteRange(cursor, entry.startMinute))
    }

    if (entry.startMinute < cursor) {
      const overlapEnd = Math.min(entry.endMinute, cursor)
      if (overlapEnd > entry.startMinute) {
        overlapRanges.push(
          formatMinuteRange(entry.startMinute, overlapEnd),
        )
      }
    }

    cursor = Math.max(cursor, entry.endMinute)
  }

  if (cursor < FULL_DAY_MINUTES) {
    missingRanges.push(formatMinuteRange(cursor, FULL_DAY_MINUTES))
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

async function ensureNoTimeOverlap(
  ctx: { db: any },
  args: {
    date: string
    endMinute: number
    excludeId?: string
    startMinute: number
  },
) {
  const entries = await ctx.db
    .query('timeEntries')
    .withIndex('by_date', (query) => query.eq('date', args.date))
    .collect()

  for (const entry of entries) {
    if (
      entry._id === args.excludeId ||
      entry.startMinute === undefined ||
      entry.endMinute === undefined
    ) {
      continue
    }

    const overlaps =
      args.startMinute < entry.endMinute && args.endMinute > entry.startMinute

    if (overlaps) {
      throw new Error('This time range overlaps with another entry.')
    }
  }
}

export const getDailySnapshot = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const [timeEntries, moneyEntries] = await Promise.all([
      ctx.db
        .query('timeEntries')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .order('desc')
        .collect(),
      ctx.db
        .query('moneyEntries')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .order('desc')
        .collect(),
    ])

    const sortedTimeEntries = [...timeEntries].sort((left, right) => {
      if (left.startMinute !== undefined && right.startMinute !== undefined) {
        return left.startMinute - right.startMinute
      }

      if (left.startMinute !== undefined) {
        return -1
      }

      if (right.startMinute !== undefined) {
        return 1
      }

      return left.createdAt - right.createdAt
    })

    const coverage = buildCoverageSummary(sortedTimeEntries)

    return {
      coverage,
      date: args.date,
      moneyEntries,
      timeEntries: sortedTimeEntries,
      totalMinutes: sortedTimeEntries.reduce(
        (runningTotal, entry) => runningTotal + entry.durationMinutes,
        0,
      ),
      totalSpent: moneyEntries.reduce(
        (runningTotal, entry) => runningTotal + entry.amount,
        0,
      ),
    }
  },
})

export const addTimeEntry = mutation({
  args: {
    date: v.string(),
    endTime: v.string(),
    note: v.optional(v.string()),
    startTime: v.string(),
  },
  handler: async (ctx, args) => {
    const startMinute = parseTimeString(args.startTime)
    const endMinute = parseTimeString(args.endTime, { allowEndOfDay: true })
    const durationMinutes = endMinute - startMinute

    if (durationMinutes <= 0) {
      throw new Error('End time must be later than start time.')
    }

    await ensureNoTimeOverlap(ctx, {
      date: args.date,
      endMinute,
      startMinute,
    })

    return await ctx.db.insert('timeEntries', {
      category: DEFAULT_ENTRY_CATEGORY,
      createdAt: Date.now(),
      date: args.date,
      durationMinutes,
      endMinute,
      endTime: args.endTime,
      note: trimOptionalString(args.note),
      startMinute,
      startTime: args.startTime,
    })
  },
})

export const addMoneyEntry = mutation({
  args: {
    amount: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const amount = Number(args.amount.toFixed(2))
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero.')
    }

    return await ctx.db.insert('moneyEntries', {
      amount,
      category: DEFAULT_ENTRY_CATEGORY,
      createdAt: Date.now(),
      date: args.date,
      note: trimOptionalString(args.note),
    })
  },
})

export const updateTimeEntry = mutation({
  args: {
    endTime: v.string(),
    id: v.id('timeEntries'),
    note: v.optional(v.string()),
    startTime: v.string(),
  },
  handler: async (ctx, args) => {
    const existingEntry = await ctx.db.get(args.id)

    if (!existingEntry) {
      throw new Error('Time entry not found.')
    }

    const startMinute = parseTimeString(args.startTime)
    const endMinute = parseTimeString(args.endTime, { allowEndOfDay: true })
    const durationMinutes = endMinute - startMinute

    if (durationMinutes <= 0) {
      throw new Error('End time must be later than start time.')
    }

    await ensureNoTimeOverlap(ctx, {
      date: existingEntry.date,
      endMinute,
      excludeId: args.id,
      startMinute,
    })

    await ctx.db.patch(args.id, {
      category: DEFAULT_ENTRY_CATEGORY,
      durationMinutes,
      endMinute,
      endTime: args.endTime,
      note: trimOptionalString(args.note),
      startMinute,
      startTime: args.startTime,
    })
  },
})

export const updateMoneyEntry = mutation({
  args: {
    amount: v.number(),
    id: v.id('moneyEntries'),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingEntry = await ctx.db.get(args.id)

    if (!existingEntry) {
      throw new Error('Money entry not found.')
    }

    const amount = Number(args.amount.toFixed(2))
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero.')
    }

    await ctx.db.patch(args.id, {
      amount,
      category: DEFAULT_ENTRY_CATEGORY,
      note: trimOptionalString(args.note),
    })
  },
})

export const removeTimeEntry = mutation({
  args: { id: v.id('timeEntries') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

export const removeMoneyEntry = mutation({
  args: { id: v.id('moneyEntries') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})
