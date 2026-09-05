import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability, isMembershipProprietor } from "./rbac";
import { resolveActiveMembership } from "./auth";
import { getGroupOverviewHelper, isGroupPlatformOperator } from "./groups";
import { paginationOptsValidator } from "convex/server";
import type { QueryCtx } from "../../_generated/server";

/**
 * Pre-write sanitization function for audit logs.
 * Sanitizes bank account numbers, passwords, tokens, API keys, and government IDs.
 * Under NDPA 2023 and child privacy rules, audit logs must not leak PII or secrets.
 */
export function sanitizeAuditSummary(text: string): string {
  if (!text) return "";

  if (
    /\b(?:medical|health|allergies|safeguarding|prompt|documentContent|base64|passport)["']?\s*[=:]/i.test(
      text,
    )
  )
    return "[REDACTED_SENSITIVE_SUMMARY]";
  let sanitized = text.replace(
    /(["']?(?:password|hash|token|secret|apiKey|authTokenIdentifier)["']?\s*[:=]\s*)(["'])(.*?)\2/gi,
    "$1[REDACTED_SECRET]",
  );

  // 1. Redact JWTs (three base64url segments separated by dots starting with eyJ)
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    "[REDACTED_SECRET]",
  );

  // 2. Redact Bearer tokens (with optional 'token' keyword)
  sanitized = sanitized.replace(
    /\b(bearer(?:\s+token)?\s+)[A-Za-z0-9_\-\.]+/gi,
    "$1[REDACTED_SECRET]",
  );

  // 3. Redact key-value secrets (e.g. password=xyz, token: "xyz", secret="xyz")
  sanitized = sanitized.replace(
    /(["']?(?:password|token|bearer|secret|apiKey|authTokenIdentifier)["']?\s*[:=]\s*["']?)(?:[^"'}\s,]+)(["']?)/gi,
    "$1[REDACTED_SECRET]$2",
  );

  // 3. Mask bank account numbers (10-digit NUBAN numbers) -> ***-****-1234
  // Matches standalone 10 digit numbers or formatted 3-4-3/4 groups
  sanitized = sanitized.replace(/\b\d{6}(\d{4})\b/g, "***-****-$1");
  sanitized = sanitized.replace(
    /\b\d{3}[- ]?\d{3,4}[- ]?(\d{4})\b/g,
    "***-****-$1",
  );

  // 4. Mask 11-digit Government IDs (e.g. NIN) -> ***-****-1234
  sanitized = sanitized.replace(/\b\d{7}(\d{4})\b/g, "***-****-$1");

  return sanitized.slice(0, 2000);
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
  args: RecordAuditEventArgs,
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

  const identity =
    args.actorKind === "platform_admin"
      ? await ctx.auth.getUserIdentity()
      : null;
  const operators = identity
    ? await ctx.db
        .query("platformAdmins")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", identity.tokenIdentifier),
        )
        .take(2)
    : [];
  const actorPlatformAdminId =
    operators.length === 1 && operators[0].isActive
      ? operators[0]._id
      : undefined;
  const docId = await ctx.db.insert("auditEvents", {
    eventId,
    actorPlatformAdminId,
    timestamp: now,
    actorKind: args.actorKind,
    actorPersonId: args.actorPersonId,
    actorMembershipId: args.actorMembershipId,
    actorEmailSnapshot: sanitizeAuditSummary(args.actorEmailSnapshot),
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
    retentionClass:
      [
        "finance",
        "billing",
        "rbac",
        "groups",
        "asset_security",
        "commercial",
        "auth",
      ].includes(args.module) ||
      /(?:password|security|permission|ownership|certif|publish_final)/i.test(
        args.action,
      )
        ? "permanent_statutory"
        : (args.retentionClass ?? "operational_7yr"),
    alertTier: args.alertTier,
    createdAt: now,
  });

  // In-app leadership notifications only; no email/SMS delivery is implied.
  if (args.alertTier === "tier1_critical" || args.alertTier === "tier2_warn") {
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
      tier: args.alertTier,
      title:
        args.alertTier === "tier1_critical"
          ? `Critical Security Event: ${args.action}`
          : `Audit notice: ${args.action}`,
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
      v.literal("system"),
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
      v.literal("failed"),
    ),
    safeSummary: v.string(),
    beforeSummary: v.optional(v.string()),
    afterSummary: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    retentionClass: v.optional(
      v.union(v.literal("operational_7yr"), v.literal("permanent_statutory")),
    ),
    alertTier: v.optional(
      v.union(
        v.literal("tier1_critical"),
        v.literal("tier2_warn"),
        v.literal("tier3_info"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    return await recordAuditEventHelper(ctx, args);
  },
});

export const AUDIT_MODULES = [
  "academic",
  "enrollment",
  "finance",
  "staff",
  "settings",
  "assets",
  "asset_security",
  "groups",
  "rbac",
  "institutional_email",
  "ai_import",
  "commercial",
  "audit",
  "system",
  "auth",
  "billing",
] as const;
const scopeValidator = v.union(
  v.object({ kind: v.literal("branch"), schoolId: v.id("schools") }),
  v.object({ kind: v.literal("group"), groupId: v.id("schoolGroups") }),
  v.object({ kind: v.literal("platform") }),
);
type AuditScope =
  | { kind: "branch"; schoolId: Id<"schools"> }
  | { kind: "group"; groupId: Id<"schoolGroups"> }
  | { kind: "platform" };
type Context = QueryCtx | MutationCtx;

async function auditAuthority(ctx: Context, scope: AuditScope) {
  if (scope.kind === "platform") {
    if (!(await isGroupPlatformOperator(ctx)))
      throw new ConvexError("Forbidden: Platform audit authority required");
    return {
      schoolIds: null,
      modules: null,
      platformOnly: true,
      personId: undefined,
      owner: false,
      canCsv: true,
      canPdf: true,
    };
  }
  if (scope.kind === "group") {
    const overview = await getGroupOverviewHelper(ctx, scope.groupId);
    const platformOnly = await isGroupPlatformOperator(ctx);
    return {
      schoolIds: overview.branches.map((b) => b.schoolId),
      modules: null,
      platformOnly,
      personId: platformOnly ? undefined : overview.group.proprietorPersonId,
      owner: !platformOnly,
      canCsv: true,
      canPdf: true,
    };
  }
  const auth = await requireCapability(
    ctx,
    scope.schoolId,
    "audit.branch.view",
  );
  const membership = auth.membershipId
    ? await ctx.db.get(auth.membershipId)
    : null;
  const owner = Boolean(
    membership && (await isMembershipProprietor(ctx, membership)),
  );
  const modules =
    owner || auth.isPlatformAdmin ? null : (membership?.auditModules ?? []);
  const caps = auth.effectiveCapabilities;
  return {
    schoolIds: [scope.schoolId],
    modules,
    platformOnly: auth.isPlatformAdmin,
    personId: auth.personId,
    owner,
    canCsv: caps.includes("audit.export.csv"),
    canPdf: caps.includes("audit.export.pdf"),
  };
}
type AuditAuthority = Awaited<ReturnType<typeof auditAuthority>>;
function visibleEvent(event: Doc<"auditEvents">, auth: AuditAuthority) {
  return (
    (!auth.schoolIds || auth.schoolIds.includes(event.schoolId)) &&
    (!auth.platformOnly || event.actorKind === "platform_admin") &&
    (!auth.modules || auth.modules.includes(event.module))
  );
}
function safeEvent(event: Doc<"auditEvents">) {
  return {
    id: event._id,
    eventId: event.eventId,
    timestamp: event.timestamp,
    schoolId: event.schoolId,
    groupId: event.groupId ?? null,
    actor:
      event.actorPersonId ??
      event.actorMembershipId ??
      event.actorPlatformAdminId ??
      event.actorKind,
    actorKind: event.actorKind,
    module: sanitizeAuditSummary(event.module),
    action: sanitizeAuditSummary(event.action),
    targetType: sanitizeAuditSummary(event.targetType),
    targetId: sanitizeAuditSummary(event.targetId),
    outcome: event.outcome,
    summary: sanitizeAuditSummary(event.safeSummary),
    before: event.beforeSummary
      ? sanitizeAuditSummary(event.beforeSummary)
      : null,
    after: event.afterSummary ? sanitizeAuditSummary(event.afterSummary) : null,
    correlationId: sanitizeAuditSummary(event.correlationId),
    retentionClass: event.retentionClass,
  };
}
const filterArgs = {
  search: v.optional(v.string()),
  module: v.optional(v.string()),
  action: v.optional(v.string()),
  actor: v.optional(v.string()),
  target: v.optional(v.string()),
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  branchId: v.optional(v.id("schools")),
};
type Filters = {
  search?: string;
  module?: string;
  action?: string;
  actor?: string;
  target?: string;
  startDate?: number;
  endDate?: number;
  branchId?: Id<"schools">;
};

export const getAuditAccess = query({
  args: { scope: scopeValidator },
  handler: async (ctx, args) => {
    const auth = await auditAuthority(ctx, args.scope);
    return {
      modules: auth.modules ?? [...AUDIT_MODULES],
      scopeConfigured: auth.modules === null || auth.modules.length > 0,
      canCsv: auth.canCsv,
      canPdf: auth.canPdf,
      canConfigureScope: auth.owner && args.scope.kind === "branch",
      platformOnly: auth.platformOnly,
    };
  },
});

async function auditPage(
  ctx: Context,
  args: Filters & {
    scope: AuditScope;
    paginationOpts: { numItems: number; cursor: string | null };
    exportFormat?: "csv" | "pdf";
  },
) {
  const auth = await auditAuthority(ctx, args.scope);
  if (
    args.exportFormat &&
    !(args.exportFormat === "csv" ? auth.canCsv : auth.canPdf)
  )
    throw new ConvexError("Forbidden: Audit export capability required");
  if (args.module && auth.modules && !auth.modules.includes(args.module))
    throw new ConvexError("Forbidden: Module outside delegated audit scope");
  if (
    args.branchId &&
    auth.schoolIds &&
    !auth.schoolIds.includes(args.branchId)
  )
    throw new ConvexError("Forbidden: Branch outside audit scope");
  if (
    [args.startDate, args.endDate].some(
      (date) => date !== undefined && !Number.isFinite(date),
    )
  )
    throw new ConvexError("Dates must be finite timestamps");
  if (
    args.startDate !== undefined &&
    args.endDate !== undefined &&
    args.startDate > args.endDate
  )
    throw new ConvexError("Start date must precede end date");
  if (
    [args.search, args.action, args.actor, args.target].some(
      (s) => s && s.length > 160,
    )
  )
    throw new ConvexError("Filter text is too long");
  // Page the source, then filter. Empty matching pages still carry the continuation cursor;
  // no recent-window truncation, including old group events lacking a groupId snapshot.
  const schoolId =
    args.scope.kind === "branch" ? args.scope.schoolId : args.branchId;
  const source = schoolId
    ? ctx.db.query("auditEvents").withIndex("by_school_and_timestamp", (q) => {
        const branch = q.eq("schoolId", schoolId);
        if (args.startDate !== undefined && args.endDate !== undefined)
          return branch
            .gte("timestamp", args.startDate)
            .lte("timestamp", args.endDate);
        if (args.startDate !== undefined)
          return branch.gte("timestamp", args.startDate);
        if (args.endDate !== undefined)
          return branch.lte("timestamp", args.endDate);
        return branch;
      })
    : ctx.db.query("auditEvents").withIndex("by_timestamp", (q) => {
        if (args.startDate !== undefined && args.endDate !== undefined)
          return q
            .gte("timestamp", args.startDate)
            .lte("timestamp", args.endDate);
        if (args.startDate !== undefined)
          return q.gte("timestamp", args.startDate);
        if (args.endDate !== undefined) return q.lte("timestamp", args.endDate);
        return q;
      });
  const result = await source
    .order("desc")
    .paginate({
      ...args.paginationOpts,
      numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 100),
    });
  const page = result.page
    .filter((event) => visibleEvent(event, auth))
    .map(safeEvent)
    .filter((event) => {
      if (args.module && event.module !== args.module) return false;
      if (
        args.action &&
        !event.action.toLowerCase().includes(args.action.toLowerCase())
      )
        return false;
      if (
        args.actor &&
        !event.actor.toLowerCase().includes(args.actor.toLowerCase())
      )
        return false;
      if (
        args.target &&
        !`${event.targetType} ${event.targetId}`
          .toLowerCase()
          .includes(args.target.toLowerCase())
      )
        return false;
      if (args.startDate !== undefined && event.timestamp < args.startDate)
        return false;
      if (args.endDate !== undefined && event.timestamp > args.endDate)
        return false;
      if (
        args.search &&
        !`${event.summary} ${event.action} ${event.module} ${event.targetType} ${event.targetId}`
          .toLowerCase()
          .includes(args.search.toLowerCase())
      )
        return false;
      return true;
    });
  return { ...result, page };
}

export const queryAuditPage = query({
  args: {
    scope: scopeValidator,
    paginationOpts: paginationOptsValidator,
    ...filterArgs,
    exportFormat: v.optional(v.union(v.literal("csv"), v.literal("pdf"))),
  },
  handler: auditPage,
});

/** Compatibility read: explicitly bounded recent page; new explorer uses queryAuditPage. */
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
    const auth = await auditAuthority(ctx, {
      kind: "branch",
      schoolId: args.schoolId,
    });
    if (args.module && auth.modules && !auth.modules.includes(args.module))
      throw new ConvexError("Forbidden: Module outside delegated audit scope");
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_school_and_timestamp", (q) =>
        q.eq("schoolId", args.schoolId),
      )
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 50, 1), 100));
    return rows
      .filter(
        (event) =>
          visibleEvent(event, auth) &&
          (!args.module || event.module === args.module) &&
          (!args.action || event.action === args.action) &&
          (args.startDate === undefined || event.timestamp >= args.startDate) &&
          (args.endDate === undefined || event.timestamp <= args.endDate),
      )
      .map((event) => ({
        ...safeEvent(event),
        _id: event._id,
        safeSummary: sanitizeAuditSummary(event.safeSummary),
        beforeSummary: event.beforeSummary
          ? sanitizeAuditSummary(event.beforeSummary)
          : undefined,
        afterSummary: event.afterSummary
          ? sanitizeAuditSummary(event.afterSummary)
          : undefined,
      }));
  },
});

function recipientCanRead(alert: Doc<"auditAlerts">, auth: AuditAuthority) {
  // Untargeted critical alerts are leadership-only, never every audit reader.
  return (
    auth.platformOnly ||
    (alert.targetRecipientPersonIds
      ? Boolean(
          auth.personId &&
          alert.targetRecipientPersonIds.includes(auth.personId),
        )
      : auth.owner)
  );
}
export const listAuditAlerts = query({
  args: {
    schoolId: v.id("schools"),
    isDismissed: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const auth = await auditAuthority(ctx, {
      kind: "branch",
      schoolId: args.schoolId,
    });
    const alerts = await ctx.db
      .query("auditAlerts")
      .withIndex("by_school_and_dismissed", (q) =>
        q
          .eq("schoolId", args.schoolId)
          .eq("isDismissed", args.isDismissed ?? false),
      )
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 20, 1), 50));
    const visible = [];
    for (const alert of alerts) {
      const event = await ctx.db.get(alert.eventId);
      if (event && visibleEvent(event, auth) && recipientCanRead(alert, auth))
        visible.push({
          _id: alert._id,
          tier: alert.tier,
          title: sanitizeAuditSummary(alert.title),
          message: sanitizeAuditSummary(alert.message),
          isDismissed: alert.isDismissed,
          createdAt: alert.createdAt,
        });
    }
    return visible;
  },
});
export const dismissAuditAlert = mutation({
  args: { schoolId: v.id("schools"), alertDocId: v.id("auditAlerts") },
  handler: async (ctx, args) => {
    const auth = await auditAuthority(ctx, {
      kind: "branch",
      schoolId: args.schoolId,
    });
    const alert = await ctx.db.get(args.alertDocId);
    const event = alert ? await ctx.db.get(alert.eventId) : null;
    if (
      !alert ||
      alert.schoolId !== args.schoolId ||
      !event ||
      !visibleEvent(event, auth) ||
      !recipientCanRead(alert, auth)
    )
      throw new ConvexError("Forbidden: Alert is not addressed to this viewer");
    if (alert.isDismissed) return { success: true };
    await ctx.db.patch(alert._id, {
      isDismissed: true,
      dismissedAt: Date.now(),
      dismissedBy: auth.personId,
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: auth.platformOnly ? "platform_admin" : "user",
      actorPersonId: auth.personId,
      actorEmailSnapshot: "authenticated recipient",
      module: "audit",
      action: "leadership_alert_acknowledged",
      targetType: "auditAlert",
      targetId: alert._id,
      outcome: "success",
      safeSummary: "Addressed leadership recipient acknowledged alert",
      retentionClass: "permanent_statutory",
    });
    return { success: true };
  },
});

export const recordAuditExport = mutation({
  args: {
    scope: scopeValidator,
    format: v.union(v.literal("csv"), v.literal("pdf")),
    stage: v.union(
      v.literal("attempt"),
      v.literal("client_prepared"),
      v.literal("client_failed"),
    ),
    correlationId: v.string(),
    rowCount: v.optional(v.number()),
    journalSchoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const auth = await auditAuthority(ctx, args.scope);
    const permitted = args.format === "csv" ? auth.canCsv : auth.canPdf;
    if (
      !/^[a-zA-Z0-9_-]{8,80}$/.test(args.correlationId) ||
      (args.rowCount !== undefined &&
        (!Number.isInteger(args.rowCount) ||
          args.rowCount < 0 ||
          args.rowCount > 5000))
    )
      throw new ConvexError("Invalid export metadata");
    // The existing journal schema requires a tenant context. Platform-wide exports
    // must explicitly identify one represented school; never pick an unrelated tenant.
    const schoolId = auth.schoolIds?.[0] ?? args.journalSchoolId;
    if (!schoolId || !(await ctx.db.get(schoolId)))
      throw new ConvexError(
        "Choose an explicit school journal context for the export",
      );
    await recordAuditEventHelper(ctx, {
      schoolId,
      groupId: args.scope.kind === "group" ? args.scope.groupId : undefined,
      actorKind: auth.platformOnly ? "platform_admin" : "user",
      actorPersonId: auth.personId,
      actorEmailSnapshot:
        (await ctx.auth.getUserIdentity())?.email ?? "authenticated exporter",
      module: "audit",
      action: `audit_export_${args.format}_${args.stage}`,
      targetType: "auditExport",
      targetId: args.correlationId,
      outcome: permitted
        ? args.stage === "client_failed"
          ? "failed"
          : "success"
        : "denied",
      correlationId: args.correlationId,
      safeSummary: `Audit ${args.format} export ${args.stage}; scope ${args.scope.kind}; client-reported rows ${args.rowCount ?? 0}. Preparation is not proof of download or PDF save.`,
      retentionClass: "permanent_statutory",
      alertTier: args.stage === "attempt" ? "tier2_warn" : undefined,
    });
    return { permitted };
  },
});

async function auditScopeOwner(ctx: Context, schoolId: Id<"schools">) {
  const auth = await resolveActiveMembership(ctx, schoolId);
  const membership = auth.membershipId
    ? await ctx.db.get(auth.membershipId)
    : null;
  if (!membership || !(await isMembershipProprietor(ctx, membership)))
    throw new ConvexError(
      "Forbidden: Only the branch proprietor configures audit module scopes",
    );
  return auth;
}
export const getAuditScopeConfiguration = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    await auditScopeOwner(ctx, args.schoolId);
    const rows = await ctx.db
      .query("branchMemberships")
      .withIndex("by_school_and_status", (q) =>
        q.eq("schoolId", args.schoolId).eq("status", "active"),
      )
      .take(101);
    if (rows.length > 100)
      throw new ConvexError("Directory exceeds supported size");
    return Promise.all(
      rows.map(async (m) => ({
        membershipId: m._id,
        name: (await ctx.db.get(m.personId))?.name ?? "Unavailable person",
        modules: m.auditModules ?? [],
        revision: m.updatedAt,
      })),
    );
  },
});
export const setAuditModuleScope = mutation({
  args: {
    schoolId: v.id("schools"),
    targetMembershipId: v.id("branchMemberships"),
    modules: v.array(v.string()),
    expectedRevision: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = await auditScopeOwner(ctx, args.schoolId);
    const target = await ctx.db.get(args.targetMembershipId);
    if (
      !target ||
      target.schoolId !== args.schoolId ||
      target.status !== "active"
    )
      throw new ConvexError("Target membership not found in this branch");
    if (
      target.personId === auth.personId ||
      (await isMembershipProprietor(ctx, target))
    )
      throw new ConvexError("Forbidden: Ownership scope is protected");
    const person = await ctx.db.get(target.personId);
    if (
      !person ||
      person.status !== "active" ||
      person.identityReconciliationState === "reconciliation_required"
    )
      throw new ConvexError("Target identity requires review");
    const platform = person.authTokenIdentifier
      ? await ctx.db
          .query("platformAdmins")
          .withIndex("by_auth_token_identifier", (q) =>
            q.eq("authTokenIdentifier", person.authTokenIdentifier),
          )
          .take(2)
      : [];
    if (platform.length)
      throw new ConvexError("Forbidden: Platform identity is protected");
    if (target.updatedAt !== args.expectedRevision)
      throw new ConvexError("CONFLICT: Reload audit scope before saving");
    const allowed: ReadonlySet<string> = new Set(AUDIT_MODULES);
    if (
      args.modules.length > AUDIT_MODULES.length ||
      args.modules.some((m) => !allowed.has(m)) ||
      args.reason.trim().length < 8 ||
      args.reason.length > 240
    )
      throw new ConvexError(
        "Select supported modules and provide a concise reason",
      );
    await ctx.db.patch(target._id, {
      auditModules: [...new Set(args.modules)],
      updatedAt: Math.max(Date.now(), target.updatedAt + 1),
    });
    await recordAuditEventHelper(ctx, {
      schoolId: args.schoolId,
      actorKind: "user",
      actorPersonId: auth.personId,
      actorMembershipId: auth.membershipId,
      actorEmailSnapshot: "proprietor",
      module: "rbac",
      action: "audit_module_scope_changed",
      targetType: "branchMembership",
      targetId: target._id,
      outcome: "success",
      safeSummary: `Configured audit visibility modules: ${args.modules.join(", ") || "none"}; reason: ${args.reason.trim()}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier1_critical",
    });
    return { success: true };
  },
});
