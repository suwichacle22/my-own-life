import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

function sortTotals<T extends { total: number }>(items: T[]) {
  return items.sort((left, right) => right.total - left.total)
}

function parseTimeString(value: string) {
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

    const timeTotals = new Map<string, number>()
    const moneyTotals = new Map<string, number>()

    for (const entry of timeEntries) {
      timeTotals.set(
        entry.category,
        (timeTotals.get(entry.category) ?? 0) + entry.durationMinutes,
      )
    }

    for (const entry of moneyEntries) {
      moneyTotals.set(
        entry.category,
        (moneyTotals.get(entry.category) ?? 0) + entry.amount,
      )
    }

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

    return {
      date: args.date,
      moneyBreakdown: sortTotals(
        Array.from(moneyTotals.entries()).map(([category, total]) => ({
          category,
          total,
        })),
      ),
      moneyEntries,
      timeBreakdown: sortTotals(
        Array.from(timeTotals.entries()).map(([category, total]) => ({
          category,
          total,
        })),
      ),
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
    category: v.string(),
    date: v.string(),
    endTime: v.string(),
    note: v.optional(v.string()),
    startTime: v.string(),
  },
  handler: async (ctx, args) => {
    const startMinute = parseTimeString(args.startTime)
    const endMinute = parseTimeString(args.endTime)
    const durationMinutes = endMinute - startMinute

    if (durationMinutes <= 0) {
      throw new Error('End time must be later than start time.')
    }

    return await ctx.db.insert('timeEntries', {
      category: args.category.trim(),
      createdAt: Date.now(),
      date: args.date,
      durationMinutes,
      endMinute,
      endTime: args.endTime,
      note: args.note?.trim() || undefined,
      startMinute,
      startTime: args.startTime,
    })
  },
})

export const addMoneyEntry = mutation({
  args: {
    amount: v.number(),
    category: v.string(),
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
      category: args.category.trim(),
      createdAt: Date.now(),
      date: args.date,
      note: args.note?.trim() || undefined,
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
