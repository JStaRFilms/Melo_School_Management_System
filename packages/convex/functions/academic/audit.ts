import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability } from "./rbac";

/**
 * Pre-write sanitization function for audit logs.
 * Sanitizes bank account numbers, passwords, tokens, API keys, and government IDs.
 * Under NDPA 2023 and child privacy rules, audit logs must not leak PII or secrets.
 */
export function sanitizeAuditSummary(text: string): string {
  if (!text) return "";

  let sanitized = text;

  // 1. Redact JWTs (three base64url segments separated by dots starting with eyJ)
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    "[REDACTED_SECRET]"
  );

  // 2. Redact Bearer tokens (with optional 'token' keyword)
  sanitized = sanitized.replace(
    /\b(bearer(?:\s+token)?\s+)[A-Za-z0-9_\-\.]+/gi,
    "$1[REDACTED_SECRET]"
  );

  // 3. Redact key-value secrets (e.g. password=xyz, token: "xyz", secret="xyz")
  sanitized = sanitized.replace(
    /(["']?(?:password|token|bearer|secret|apiKey|authTokenIdentifier)["']?\s*[:=]\s*["']?)(?:[^"'}\s,]+)(["']?)/gi,
    "$1[REDACTED_SECRET]$2"
  );

  // 3. Mask bank account numbers (10-digit NUBAN numbers) -> ***-****-1234
  // Matches standalone 10 digit numbers or formatted 3-4-3/4 groups
  sanitized = sanitized.replace(/\b\d{6}(\d{4})\b/g, "***-****-$1");
  sanitized = sanitized.replace(/\b\d{3}[- ]?\d{3,4}[- ]?(\d{4})\b/g, "***-****-$1");

  // 4. Mask 11-digit Government IDs (e.g. NIN) -> ***-****-1234
  sanitized = sanitized.replace(/\b\d{7}(\d{4})\b/g, "***-****-$1");

  return sanitized;
}

export interface RecordAuditEventArgs {
  schoolId: Id<"schools">;
  groupId?: Id<"schoolGroups">;
  actorKind: "user" | "platform_admin" | "system";
  actorPersonId?: Id<"persons">;
  actorMembershipId?: Id<"branchMemberships">;
  actorEmailSnapshot: string;
  actorIpHash?: string;
  module: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: "success" | "denied" | "failed";
  safeSummary: string;
  beforeSummary?: string;
  afterSummary?: string;
  correlationId?: string;
  retentionClass?: "operational_7yr" | "permanent_statutory";
  alertTier?: "tier1_critical" | "tier2_warn" | "tier3_info";
}

/**
 * Shared transaction-safe helper for recording audit events and firing alerts.
 * Strictly append-only: this helper ONLY inserts, never updates or deletes.
 */
export async function recordAuditEventHelper(
  ctx: MutationCtx,
  args: RecordAuditEventArgs
): Promise<{ eventId: string; docId: Id<"auditEvents"> }> {
  const now = Date.now();
  const eventId = `aud_${now}_${Math.random().toString(36).slice(2, 11)}`;

  // Sanitize all textual summaries prior to persistence
  const sanitizedSafeSummary = sanitizeAuditSummary(args.safeSummary);
  const sanitizedBeforeSummary = args.beforeSummary
    ? sanitizeAuditSummary(args.beforeSummary)
    : undefined;
  const sanitizedAfterSummary = args.afterSummary
    ? sanitizeAuditSummary(args.afterSummary)
    : undefined;

  const docId = await ctx.db.insert("auditEvents", {
    eventId,
    timestamp: now,
    actorKind: args.actorKind,
    actorPersonId: args.actorPersonId,
    actorMembershipId: args.actorMembershipId,
    actorEmailSnapshot: args.actorEmailSnapshot,
    actorIpHash: args.actorIpHash,
    schoolId: args.schoolId,
    groupId: args.groupId,
    module: args.module,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId,
    outcome: args.outcome,
    safeSummary: sanitizedSafeSummary,
    beforeSummary: sanitizedBeforeSummary,
    afterSummary: sanitizedAfterSummary,
    correlationId: args.correlationId ?? eventId,
    retentionClass: args.retentionClass ?? "operational_7yr",
    alertTier: args.alertTier,
    createdAt: now,
  });

  // Multi-Tier Alerting: If Tier 1 Critical, automatically dispatch an auditAlert record
  if (args.alertTier === "tier1_critical") {
    const alertId = `alt_${now}_${Math.random().toString(36).slice(2, 11)}`;

    // Resolve school group proprietor if available to target alert recipient
    const groupLink = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .first();

    let targetRecipients: Id<"persons">[] | undefined = undefined;
    if (groupLink) {
      const group = await ctx.db.get(groupLink.groupId);
      if (group?.proprietorPersonId) {
        targetRecipients = [group.proprietorPersonId];
      }
    }

    await ctx.db.insert("auditAlerts", {
      alertId,
      schoolId: args.schoolId,
      eventId: docId,
      tier: "tier1_critical",
      title: `Critical Security Event: ${args.action}`,
      message: sanitizedSafeSummary,
      targetRecipientPersonIds: targetRecipients,
      isDismissed: false,
      createdAt: now,
    });
  }

  return { eventId, docId };
}

/**
 * Internal mutation for recording an append-only audit event.
 * No update or delete mutations exist on auditEvents.
 */
export const recordAuditEventInternal = internalMutation({
  args: {
    schoolId: v.id("schools"),
    groupId: v.optional(v.id("schoolGroups")),
    actorKind: v.union(
      v.literal("user"),
      v.literal("platform_admin"),
      v.literal("system")
    ),
    actorPersonId: v.optional(v.id("persons")),
    actorMembershipId: v.optional(v.id("branchMemberships")),
    actorEmailSnapshot: v.string(),
    actorIpHash: v.optional(v.string()),
    module: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    outcome: v.union(
      v.literal("success"),
      v.literal("denied"),
      v.literal("failed")
    ),
    safeSummary: v.string(),
    beforeSummary: v.optional(v.string()),
    afterSummary: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    retentionClass: v.optional(
      v.union(v.literal("operational_7yr"), v.literal("permanent_statutory"))
    ),
    alertTier: v.optional(
      v.union(
        v.literal("tier1_critical"),
        v.literal("tier2_warn"),
        v.literal("tier3_info")
      )
    ),
  },
  handler: async (ctx, args) => {
    return await recordAuditEventHelper(ctx, args);
  },
});

/**
 * Query paginated audit events for a school branch.
 * Enforces 'audit.branch.view' or 'audit.view' capability.
 */
export const listAuditEvents = query({
  args: {
    schoolId: v.id("schools"),
    module: v.optional(v.string()),
    action: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Capability enforcement: Requires audit view permissions
    await requireCapability(ctx, args.schoolId, "audit.branch.view");

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);

    const events = await ctx.db
      .query("auditEvents")
      .withIndex("by_school_and_timestamp", (q) => {
        if (args.startDate !== undefined) {
          return q.eq("schoolId", args.schoolId).gte("timestamp", args.startDate);
        }
        return q.eq("schoolId", args.schoolId);
      })
      .order("desc")
      .take(limit * 2);

    // Apply secondary filters in memory
    const filtered = events.filter((e) => {
      if (args.endDate !== undefined && e.timestamp > args.endDate) {
        return false;
      }
      if (args.module !== undefined && e.module !== args.module) {
        return false;
      }
      if (args.action !== undefined && e.action !== args.action) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, limit);
  },
});

/**
 * Query active (or dismissed) audit alerts for a school branch.
 */
export const listAuditAlerts = query({
  args: {
    schoolId: v.id("schools"),
    isDismissed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "audit.branch.view");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const dismissed = args.isDismissed ?? false;

    return await ctx.db
      .query("auditAlerts")
      .withIndex("by_school_and_dismissed", (q) =>
        q.eq("schoolId", args.schoolId).eq("isDismissed", dismissed)
      )
      .order("desc")
      .take(limit);
  },
});

/**
 * Dismiss an active audit alert.
 */
export const dismissAuditAlert = mutation({
  args: {
    schoolId: v.id("schools"),
    alertDocId: v.id("auditAlerts"),
  },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "audit.branch.view");
    const alert = await ctx.db.get(args.alertDocId);
    if (!alert || alert.schoolId !== args.schoolId) {
      throw new ConvexError("Alert not found for this school");
    }

    await ctx.db.patch(args.alertDocId, {
      isDismissed: true,
      dismissedAt: Date.now(),
      dismissedBy: auth.personId,
    });

    return { success: true };
  },
});
