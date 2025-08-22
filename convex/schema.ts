import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    userId: v.string(),
    role: v.string(),     // "user" | "assistant" | "tool"
    content: v.string(),
    createdAt: v.number()
  })
    .index("by_userId", ["userId"]),
});
