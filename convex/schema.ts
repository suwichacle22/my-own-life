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
    endMinute: v.optional(v.number()),
    endTime: v.optional(v.string()),
    note: v.optional(v.string()),
    startMinute: v.optional(v.number()),
    startTime: v.optional(v.string()),
  }).index('by_date', ['date']),
})
