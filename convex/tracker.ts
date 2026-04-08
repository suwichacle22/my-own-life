import { v } from 'convex/values'
import { mutation, query } from './_generated/server'

function sortTotals<T extends { total: number }>(items: T[]) {
  return items.sort((left, right) => right.total - left.total)
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
      timeEntries,
      totalMinutes: timeEntries.reduce(
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
    durationMinutes: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const durationMinutes = Math.round(args.durationMinutes)
    if (durationMinutes <= 0) {
      throw new Error('Duration must be greater than zero.')
    }

    return await ctx.db.insert('timeEntries', {
      category: args.category.trim(),
      createdAt: Date.now(),
      date: args.date,
      durationMinutes,
      note: args.note?.trim() || undefined,
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
