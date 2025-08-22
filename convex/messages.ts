import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insertMessage = mutation({
    args: {
        userId: v.string(),
        role: v.string(),
        content: v.string()
    },
    handler: async(ctx, args) => {
       return await ctx.db.insert("messages", { ...args, createdAt: Date.now()});
    },
}); 

export const list = query({
    args: {
        userId: v.string()
    },
    handler: async(ctx, { userId }) => {
        return await ctx.db.query("messages").withIndex("by_userId", q => q.eq("userId", userId)).order("desc").collect();
    },
});