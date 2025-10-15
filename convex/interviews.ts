import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAllInterviews = query({
  handler: async (ctx) => {
    // Require authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const interviews = await ctx.db.query("interviews").collect();
    return interviews;
  },
});

export const getMyInterviews = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    // If unauthenticated, return empty list instead of throwing to avoid UI errors
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const callerEmail = identity.email;
    if (!callerEmail || callerEmail !== args.userEmail) {
      throw new Error("Forbidden");
    }

    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.userEmail))
      .collect();

    return interviews;
  },
});

export const getInterviewByStreamCallId = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q) =>
        q.eq("streamCallId", args.streamCallId)
      )
      .first();
  },
});

export const createInterview = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    status: v.string(),
    streamCallId: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Require authenticated user and basic authorization: creator must be candidate or an interviewer
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const callerEmail = identity.email;
    if (!callerEmail || (callerEmail !== args.candidateId && !args.interviewerIds.includes(callerEmail))) {
      throw new Error("Forbidden");
    }

    return await ctx.db.insert("interviews", {
      ...args,
    });
  },
});

export const updateInterviewStatus = mutation({
  args: {
    id: v.id("interviews"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Require authenticated user and ensure they are one of the interviewers
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const callerEmail = identity.email;

    const interview = await ctx.db.get(args.id);
    if (!interview) throw new Error("Not found");

    if (!callerEmail || !(interview.interviewerIds as string[]).includes(callerEmail)) {
      throw new Error("Forbidden");
    }

    return await ctx.db.patch(args.id, {
      status: args.status,
      ...(args.status === "completed" ? { endTime: Date.now() } : {}),
    });
  },
});
