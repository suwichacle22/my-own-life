import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  moneyEntries: defineTable({
    amount: v.number(),
    category: v.string(),
    createdAt: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
  }).index('by_date', ['date']),
  timeEntries: defineTable({
    category: v.string(),
    createdAt: v.number(),
    date: v.string(),
    durationMinutes: v.number(),
    note: v.optional(v.string()),
  }).index('by_date', ['date']),
})
