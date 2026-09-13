import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import { ConvexError } from "convex/values";
import { getOrCreateVerifiedGuardian, normalizeSlug, requireGuardian } from "./shared";

export const getOrCreateIdentity = mutation({
  args: {},
  returns: v.object({
    guardianId: v.id("admissionsGuardians"),
    normalizedEmail: v.string(),
    emailVerifiedAt: v.number(),
  }),
  handler: async (ctx) => {
    const guardian = await getOrCreateVerifiedGuardian(ctx);
    if (guardian.emailVerifiedAt === undefined) throw new Error("Verified guardian state was not persisted");
    return {
      guardianId: guardian._id,
      normalizedEmail: guardian.normalizedEmail,
      emailVerifiedAt: guardian.emailVerifiedAt,
    };
  },
});

const workspaceResultValidator = v.object({
  schoolId: v.id("schools"),
  entitlements: v.array(v.object({ entitlementId: v.id("admissionsEntitlements"), state: v.string(), applicationId: v.union(v.id("admissionsApplications"), v.null()), createdAt: v.number() })),
  applications: v.array(v.object({ applicationId: v.id("admissionsApplications"), publicId: v.string(), state: v.string(), draftVersion: v.number(), currentRevision: v.number(), updatedAt: v.number() })),
  attempts: v.array(v.object({ reference: v.string(), state: v.string(), amountMinor: v.number(), currency: v.string(), entitlementId: v.union(v.id("admissionsEntitlements"), v.null()), createdAt: v.number() })),
});

/** Guardian workspace resolved from the public route slug; ownership remains server-derived. */
export const listWorkspaceBySlug = query({
  args: { schoolSlug: v.string(), limit: v.optional(v.number()) },
  returns: workspaceResultValidator,
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const school = await ctx.db.query("schools").withIndex("by_slug", (q) => q.eq("slug", normalizeSlug(args.schoolSlug, "School slug"))).unique();
    if (!school || school.status !== "active") throw new ConvexError("School application workspace is unavailable");
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    const [entitlementRows, applicationRows, attemptRows] = await Promise.all([
      ctx.db.query("admissionsEntitlements").withIndex("by_school_and_guardian_and_created_at", (q) => q.eq("schoolId", school._id).eq("guardianId", guardian._id)).order("desc").take(limit),
      ctx.db.query("admissionsApplications").withIndex("by_school_and_guardian_and_updated_at", (q) => q.eq("schoolId", school._id).eq("guardianId", guardian._id)).order("desc").take(limit),
      ctx.db.query("admissionsPurchaseAttempts").withIndex("by_guardian_and_created_at", (q) => q.eq("guardianId", guardian._id)).order("desc").filter((q) => q.eq(q.field("schoolId"), school._id)).take(limit),
    ]);
    return { schoolId: school._id, entitlements: entitlementRows.map((row) => ({ entitlementId: row._id, state: row.state, applicationId: row.applicationId ?? null, createdAt: row.createdAt })), applications: applicationRows.map((row) => ({ applicationId: row._id, publicId: row.publicId, state: row.state, draftVersion: row.draftVersion, currentRevision: row.currentRevision, updatedAt: row.updatedAt })), attempts: attemptRows.map((row) => ({ reference: row.reference, state: row.state, amountMinor: row.amountMinor, currency: row.currency, entitlementId: row.entitlementId ?? null, createdAt: row.createdAt })) };
  },
});

export const listWorkspace = query({
  args: { schoolId: v.id("schools"), limit: v.optional(v.number()) },
  returns: v.object({
    entitlements: v.array(v.object({
      entitlementId: v.id("admissionsEntitlements"),
      state: v.string(),
      applicationId: v.union(v.id("admissionsApplications"), v.null()),
      createdAt: v.number(),
    })),
    applications: v.array(v.object({
      applicationId: v.id("admissionsApplications"),
      publicId: v.string(),
      state: v.string(),
      draftVersion: v.number(),
      currentRevision: v.number(),
      updatedAt: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const guardian = await requireGuardian(ctx);
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 50), 1), 100);
    const entitlementRows = await ctx.db.query("admissionsEntitlements")
      .withIndex("by_school_and_guardian_and_created_at", (q) => q.eq("schoolId", args.schoolId).eq("guardianId", guardian._id))
      .order("desc").take(limit);
    const applicationRows = await ctx.db.query("admissionsApplications")
      .withIndex("by_school_and_guardian_and_updated_at", (q) => q.eq("schoolId", args.schoolId).eq("guardianId", guardian._id))
      .order("desc").take(limit);
    return {
      entitlements: entitlementRows.map((row) => ({ entitlementId: row._id, state: row.state, applicationId: row.applicationId ?? null, createdAt: row.createdAt })),
      applications: applicationRows.map((row) => ({ applicationId: row._id, publicId: row.publicId, state: row.state, draftVersion: row.draftVersion, currentRevision: row.currentRevision, updatedAt: row.updatedAt })),
    };
  },
});
