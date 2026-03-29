import { mutation, query } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { assertAdminForSchool, getAuthenticatedSchoolMembership } from "./auth";
import { normalizeHumanName } from "@school/shared/name-format";

function normalizeEventTitle(value: string) {
  const normalized = normalizeHumanName(value);
  if (!normalized) {
    throw new ConvexError("Event title is required");
  }

  return normalized;
}

function normalizeOptionalEventText(value?: string | null) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function assertEventDateRange(startDate: number, endDate: number) {
  if (endDate < startDate) {
    throw new ConvexError("Event end date must be on or after the start date");
  }
}

export const listEvents = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("schoolEvents"),
      title: v.string(),
      description: v.union(v.string(), v.null()),
      location: v.union(v.string(), v.null()),
      startDate: v.number(),
      endDate: v.number(),
      isAllDay: v.boolean(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const events = await ctx.db
      .query("schoolEvents")
      .withIndex("by_school_and_start", (q) => q.eq("schoolId", schoolId))
      .collect();

    return events
      .filter((event) => !event.isArchived)
      .sort((a, b) => a.startDate - b.startDate)
      .map((event) => ({
        _id: event._id,
        title: event.title,
        description: event.description ?? null,
        location: event.location ?? null,
        startDate: event.startDate,
        endDate: event.endDate,
        isAllDay: event.isAllDay,
        createdAt: event.createdAt,
      }));
  },
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    startDate: v.number(),
    endDate: v.number(),
    isAllDay: v.boolean(),
  },
  returns: v.id("schoolEvents"),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const title = normalizeEventTitle(args.title);
    const description = normalizeOptionalEventText(args.description);
    const location = normalizeOptionalEventText(args.location);
    assertEventDateRange(args.startDate, args.endDate);

    const now = Date.now();
    return await ctx.db.insert("schoolEvents", {
      schoolId,
      title,
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
      startDate: args.startDate,
      endDate: args.endDate,
      isAllDay: args.isAllDay,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      updatedBy: userId,
    });
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("schoolEvents"),
    title: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    startDate: v.number(),
    endDate: v.number(),
    isAllDay: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const event = await ctx.db.get(args.eventId);
    if (!event || event.schoolId !== schoolId || event.isArchived) {
      throw new ConvexError("Event not found");
    }

    const title = normalizeEventTitle(args.title);
    const description = normalizeOptionalEventText(args.description);
    const location = normalizeOptionalEventText(args.location);
    assertEventDateRange(args.startDate, args.endDate);

    const replacement: Record<string, unknown> = {
      schoolId: event.schoolId,
      title,
      startDate: args.startDate,
      endDate: args.endDate,
      isAllDay: args.isAllDay,
      isArchived: event.isArchived ?? false,
      createdAt: event.createdAt,
      updatedAt: Date.now(),
      updatedBy: userId,
      ...(event.archivedAt !== undefined ? { archivedAt: event.archivedAt } : {}),
      ...(event.archivedBy !== undefined ? { archivedBy: event.archivedBy } : {}),
      ...(description ? { description } : {}),
      ...(location ? { location } : {}),
    };

    await ctx.db.replace(args.eventId, replacement as any);
    return null;
  },
});

export const archiveEvent = mutation({
  args: {
    eventId: v.id("schoolEvents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const event = await ctx.db.get(args.eventId);
    if (!event || event.schoolId !== schoolId) {
      throw new ConvexError("Event not found");
    }

    if (event.isArchived) {
      throw new ConvexError("Event is already archived");
    }

    await ctx.db.patch(args.eventId, {
      isArchived: true,
      archivedAt: Date.now(),
      archivedBy: userId,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});

export const restoreEvent = mutation({
  args: {
    eventId: v.id("schoolEvents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, schoolId, role } =
      await getAuthenticatedSchoolMembership(ctx);
    await assertAdminForSchool(ctx, userId, schoolId, role);

    const event = await ctx.db.get(args.eventId);
    if (!event || event.schoolId !== schoolId) {
      throw new ConvexError("Event not found");
    }

    if (!event.isArchived) {
      throw new ConvexError("Event is not archived");
    }

    await ctx.db.patch(args.eventId, {
      isArchived: false,
      updatedAt: Date.now(),
      updatedBy: userId,
    });

    return null;
  },
});
