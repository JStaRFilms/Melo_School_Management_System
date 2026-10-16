import { ConvexError, v, type Infer } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { requireCapability, isMembershipProprietor, reviewStaffPermissions, saveMemberPermissionsHelper } from "./rbac";
import { getResolvedSchoolLeadAdminUserId } from "./adminLeadershipHelpers";
import { getTeacherArchiveBlockers } from "./archiveGuardrails";
import { staffEmploymentStatus, staffPermissionDecision, staffRole } from "./staffServiceContract";

type Context = QueryCtx | MutationCtx;
type Staff = Doc<"users"> & { role: Infer<typeof staffRole> };

export function assertStaffActive(user: Doc<"users">): void {
  if (user.employmentStatus === "departed")
    throw new ConvexError("Staff member has departed. Use reviewed rehire on the existing identity.");
}

export function effectiveStaffDay(value?: string, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10), result = value ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(Date.parse(result)) ||
      new Date(result).toISOString().slice(0, 10) !== result)
    throw new ConvexError("Effective date must be a valid YYYY-MM-DD calendar day");
  if (result > today) throw new ConvexError("Future service dates are not supported");
  return result;
}

async function target(ctx: Context, schoolId: Id<"schools">, userId: Id<"users">): Promise<Staff> {
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId ||
      (user.role !== "teacher" && user.role !== "admin" && user.role !== "staff"))
    throw new ConvexError("Staff member not found in this school");
  return { ...user, role: user.role };
}

export async function staffCanonicalLink(ctx: Context, user: Doc<"users">) {
  const links = await ctx.db.query("branchMemberships").withIndex("by_legacy_user", q => q.eq("legacyUserId", user._id)).take(2);
  if (!user.personId && !links.length) {
    if (user.authTokenIdentifier) {
      const identities = await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", user.authTokenIdentifier)).take(1);
      if (identities.length) throw new ConvexError("Staff canonical mapping requires reconciliation");
    }
    return null;
  }
  if (!user.personId) throw new ConvexError("Staff identity requires reconciliation");
  const personId = user.personId;
  const person = await ctx.db.get(personId);
  const memberships = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", user.schoolId)).take(2);
  const membership = memberships[0];
  if (!person || links.length !== 1 || memberships.length !== 1 || !membership ||
      membership.legacyUserId !== user._id || links[0]._id !== membership._id ||
      (user.authTokenIdentifier && person.authTokenIdentifier && user.authTokenIdentifier !== person.authTokenIdentifier))
    throw new ConvexError("Staff identity or membership requires reconciliation");
  if (person.authTokenIdentifier) {
    const tokenIdentifier = person.authTokenIdentifier;
    const identities = await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", tokenIdentifier)).take(2);
    if (identities.length !== 1) throw new ConvexError("Staff identity is ambiguous");
  }
  return { person, membership };
}

async function context(ctx: Context, schoolId: Id<"schools">) {
  const sessions = (await ctx.db.query("academicSessions").withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(2)).filter(s => !s.isArchived);
  const terms = (await ctx.db.query("academicTerms").withIndex("by_school_active", q => q.eq("schoolId", schoolId).eq("isActive", true)).take(2)).filter(t => !t.isArchived);
  if (sessions.length > 1 || terms.length > 1) throw new ConvexError("Academic context is ambiguous; review school setup");
  const session = sessions[0], term = terms[0]?.sessionId === session?._id ? terms[0] : undefined;
  return { ...(session ? { sessionId: session._id, sessionName: session.name } : {}),
    ...(term ? { termId: term._id, termName: term.name } : {}) };
}

async function returningLink(ctx: Context, user: Staff) {
  if (user.isArchived) throw new ConvexError("Restore the archived account before rehire");
  if (user.employmentStatus !== "departed") throw new ConvexError("Only departed staff can be rehired");
  const link = await staffCanonicalLink(ctx, user);
  if (link) {
    const { person, membership } = link;
    const evidence = membership.lifecycleSuspendedByEventId ? await ctx.db.get(membership.lifecycleSuspendedByEventId) : null;
    if (person.status !== "active" || person.identityReconciliationState === "reconciliation_required")
      throw new ConvexError("Global identity restriction requires separate review");
    if (membership.status !== "suspended" || !evidence || evidence.type !== "departed" ||
        evidence.userId !== user._id || evidence.schoolId !== user.schoolId || evidence.membershipId !== membership._id ||
        evidence.suspendedMembershipRevision !== membership.updatedAt)
      throw new ConvexError("Independent branch access restriction cannot be restored by rehire");
  }
  return link;
}

async function departureBlockers(ctx: Context, user: Staff, actorUserId?: Id<"users">) {
  const blockers: string[] = [];
  const link = await staffCanonicalLink(ctx, user);
  const actor = actorUserId ? await ctx.db.get(actorUserId) : null;
  if (actorUserId === user._id || (actor?.personId && actor.personId === user.personId)) blockers.push("You cannot record your own departure");
  if (await getResolvedSchoolLeadAdminUserId(ctx, user.schoolId) === user._id)
    blockers.push("Transfer school leadership before departure");
  if (link && await isMembershipProprietor(ctx, link.membership)) blockers.push("The School Proprietor cannot depart through staff controls");
  const reports = await ctx.db.query("users").withIndex("by_school_and_manager_user", q => q.eq("schoolId", user.schoolId).eq("managerUserId", user._id)).take(101);
  if (reports.length > 100) blockers.push("Direct reports require bounded review");
  else if (reports.some(r => !r.isArchived && r.employmentStatus !== "departed")) blockers.push("Reassign active direct reports before departure");
  blockers.push(...await getTeacherArchiveBlockers(ctx, { schoolId: user.schoolId, teacherId: user._id }));
  return blockers;
}

/** Service periods and immutable evidence commit with the school-local projection. */
export async function recordStaffServiceEvent(ctx: MutationCtx, user: Doc<"users">, args: {
  type: Doc<"staffServiceEvents">["type"]; reason: string; actorUserId?: Id<"users">;
  effectiveDay?: string; operationKey?: string; intentFingerprint?: string;
  review?: Pick<Doc<"staffServiceEvents">, "permissionState" | "permissionDecision" | "previousPermissions" | "proposedPermissions">;
  reviewedEventId?: Id<"staffServiceEvents">;
}) {
  if (user.role !== "teacher" && user.role !== "admin" && user.role !== "staff") throw new ConvexError("Staff role required");
  const now = Date.now(), before = user.employmentStatus ?? "active";
  const departure = args.type === "departed", opening = args.type === "joined" || args.type === "rehired";
  const effectiveDay = effectiveStaffDay(args.effectiveDay, now);
  if ((departure || opening) && user.serviceEffectiveDay && effectiveDay < user.serviceEffectiveDay)
    throw new ConvexError("Effective date precedes the latest service action");
  const link = await staffCanonicalLink(ctx, user);
  const facts = await context(ctx, user.schoolId);
  let periodId = user.currentServicePeriodId;
  if (periodId) {
    const period = await ctx.db.get(periodId);
    if (!period || period.schoolId !== user.schoolId || period.userId !== user._id || period.closedByEventId)
      throw new ConvexError("Service period is inconsistent; reviewed repair required");
  }
  if (opening) {
    if (periodId) throw new ConvexError("Staff member already has an open service period");
    periodId = await ctx.db.insert("staffServicePeriods", {
      schoolId: user.schoolId, userId: user._id, personId: user.personId, membershipId: link?.membership._id,
      roleAtStart: user.role, startDay: effectiveDay, startProvenance: "recorded", recordedAt: now, ...facts,
    });
  } else if (departure && !periodId) {
    periodId = await ctx.db.insert("staffServicePeriods", {
      schoolId: user.schoolId, userId: user._id, personId: user.personId, membershipId: link?.membership._id,
      startProvenance: "legacy_unknown", recordedAt: now, ...facts,
    });
  }
  const revision = (user.serviceRevision ?? 0) + 1;
  const afterStatus = departure ? "departed" : opening ? "active" : before;
  const suspendAccess = departure && link?.membership.status === "active";
  const membershipRevision = suspendAccess ? Math.max(now, link.membership.updatedAt + 1) : undefined;
  const eventId = await ctx.db.insert("staffServiceEvents", {
    schoolId: user.schoolId, userId: user._id, personId: user.personId, membershipId: link?.membership._id,
    type: args.type, role: user.role, ...(args.type === "joined" ? {} : { beforeStatus: before }), afterStatus,
    revision, effectiveDay, recordedAt: now, reason: args.reason, actorUserId: args.actorUserId,
    operationKey: args.operationKey ?? `system:${revision}:${args.type}`, intentFingerprint: args.intentFingerprint,
    periodId, suspendedMembershipRevision: membershipRevision, reviewedEventId: args.reviewedEventId, ...args.review, ...facts,
  });
  if (periodId && opening) await ctx.db.patch(periodId, { openedByEventId: eventId });
  if (periodId && departure) await ctx.db.patch(periodId, { endDay: effectiveDay, closedByEventId: eventId });
  if (suspendAccess) await ctx.db.patch(link.membership._id, {
    status: "suspended", lifecycleSuspendedByEventId: eventId, updatedAt: membershipRevision,
  });
  await ctx.db.patch(user._id, {
    employmentStatus: afterStatus, serviceRevision: revision,
    ...(departure || opening ? { serviceEffectiveDay: effectiveDay } : {}),
    currentServicePeriodId: departure ? undefined : periodId,
    reviewedRehireEventId: args.type === "access_reviewed" ? eventId : undefined, updatedAt: now,
  });
  return { eventId, revision, status: afterStatus, periodId: periodId ?? null };
}

function intent(args: { operationKey: string; reason: string; expectedRevision: number }) {
  const reason = args.reason.trim();
  if (!reason || reason.length > 500) throw new ConvexError("Provide a reason of 1-500 characters");
  if (!args.operationKey.trim() || args.operationKey.length > 100 || args.operationKey.startsWith("system:"))
    throw new ConvexError("Provide a nonreserved operation key of at most 100 characters");
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0) throw new ConvexError("Invalid service revision");
  return reason;
}
async function replay(ctx: MutationCtx, user: Staff, args: { operationKey: string; expectedRevision: number }, fingerprint: string) {
  const event = await ctx.db.query("staffServiceEvents").withIndex("by_schoolId_and_userId_and_operationKey", q =>
    q.eq("schoolId", user.schoolId).eq("userId", user._id).eq("operationKey", args.operationKey)).unique();
  if (event) {
    if (event.intentFingerprint !== fingerprint) throw new ConvexError("Operation key already used for different intent");
    return { eventId: event._id, revision: event.revision, status: event.afterStatus, periodId: event.periodId ?? null };
  }
  if ((user.serviceRevision ?? 0) !== args.expectedRevision) throw new ConvexError("CONFLICT: Service state changed. Reload and review again.");
  return null;
}

const operationArgs = {
  schoolId: v.id("schools"), userId: v.id("users"), expectedRevision: v.number(), operationKey: v.string(), reason: v.string(),
};
export const transitionStaffService = mutation({
  args: { ...operationArgs, action: v.union(v.literal("depart"), v.literal("rehire")), effectiveDay: v.optional(v.string()), reviewedEventId: v.optional(v.id("staffServiceEvents")) },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, args.action === "depart" ? "staff.account.suspend" : "staff.onboard");
    if (!auth.userId) throw new ConvexError("Reviewed operator user mapping required");
    const user = await target(ctx, args.schoolId, args.userId), reason = intent(args);
    const fingerprint = JSON.stringify({ ...args, reason });
    const old = await replay(ctx, user, args, fingerprint);
    if (old) return old;
    if (user.isArchived) throw new ConvexError("Restore the archived account before changing service");
    if (args.action === "depart") {
      if (args.reviewedEventId) throw new ConvexError("Permission review is only used for rehire");
      assertStaffActive(user);
      const blockers = await departureBlockers(ctx, user, auth.userId);
      if (blockers.length) throw new ConvexError(blockers.join("; "));
      return recordStaffServiceEvent(ctx, user, { type: "departed", reason, actorUserId: auth.userId, effectiveDay: args.effectiveDay, operationKey: args.operationKey, intentFingerprint: fingerprint });
    }
    const link = await returningLink(ctx, user);
    const review = args.reviewedEventId ? await ctx.db.get(args.reviewedEventId) : null;
    if (!review || review._id !== user.reviewedRehireEventId || review.type !== "access_reviewed" ||
        review.schoolId !== user.schoolId || review.userId !== user._id || review.revision !== args.expectedRevision ||
        review.actorUserId !== auth.userId || !review.permissionDecision)
      throw new ConvexError("An authorized review of previous and proposed permissions is required");
    const access = await reviewStaffPermissions(ctx, user, link?.membership ?? null, review.permissionDecision);
    if (access.permissionState !== review.permissionState) throw new ConvexError("CONFLICT: Reviewed access changed. Review again.");
    if (link) {
      if (review.permissionDecision.mode === "replace") await saveMemberPermissionsHelper(ctx, {
        schoolId: user.schoolId, targetMembershipId: link.membership._id, expectedRevision: link.membership.updatedAt,
        ...review.permissionDecision, reason: review.reason,
      }, true);
      await ctx.db.patch(link.membership._id, { status: "active", lifecycleSuspendedByEventId: undefined, updatedAt: Math.max(Date.now(), link.membership.updatedAt + 1) });
    }
    return recordStaffServiceEvent(ctx, user, { type: "rehired", reason, actorUserId: auth.userId, effectiveDay: args.effectiveDay,
      operationKey: args.operationKey, intentFingerprint: fingerprint, reviewedEventId: review._id });
  },
});

export const previewStaffRehirePermissions = query({
  args: { schoolId: v.id("schools"), userId: v.id("users"), decision: v.optional(staffPermissionDecision) },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "staff.onboard");
    if (!auth.userId) throw new ConvexError("Reviewed operator user mapping required");
    const user = await target(ctx, args.schoolId, args.userId), link = await returningLink(ctx, user);
    const access = await reviewStaffPermissions(ctx, user, link?.membership ?? null, args.decision);
    return { ...access, revision: user.serviceRevision ?? 0, userId: user._id, personId: user.personId ?? null,
      membershipId: link?.membership._id ?? null, role: user.role, name: user.name, schoolId: user.schoolId };
  },
});

export const confirmStaffRehireReview = mutation({
  args: { ...operationArgs, decision: staffPermissionDecision, expectedPermissionState: v.string() },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "staff.onboard");
    if (!auth.userId) throw new ConvexError("Reviewed operator user mapping required");
    const user = await target(ctx, args.schoolId, args.userId), reason = intent(args);
    if (reason.length < 8 || reason.length > 240) throw new ConvexError("Provide an access review reason of 8-240 characters");
    const fingerprint = JSON.stringify({ ...args, reason });
    // An old review retry is not a new access decision, but still requires permission authority.
    await requireCapability(ctx, args.schoolId, "staff.permissions.manage");
    const old = await replay(ctx, user, args, fingerprint);
    if (old) return old;
    const link = await returningLink(ctx, user);
    const access = await reviewStaffPermissions(ctx, user, link?.membership ?? null, args.decision);
    if (args.expectedPermissionState !== access.permissionState) throw new ConvexError("CONFLICT: Access changed since preview. Review again.");
    return recordStaffServiceEvent(ctx, user, { type: "access_reviewed", reason, actorUserId: auth.userId,
      operationKey: args.operationKey, intentFingerprint: fingerprint, review: {
        permissionState: access.permissionState, permissionDecision: args.decision,
        previousPermissions: access.previous, proposedPermissions: access.proposed,
      } });
  },
});

export const setStaffAccountArchive = mutation({
  args: { schoolId: v.id("schools"), userId: v.id("users"), archived: v.boolean() },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "staff.account.suspend");
    if (!auth.userId) throw new ConvexError("Reviewed operator user mapping required");
    const user = await target(ctx, args.schoolId, args.userId);
    if (user.role !== "staff") throw new ConvexError("Use the existing teacher or admin archive controls");
    if ((user.isArchived === true) === args.archived) return null;
    if (args.archived) {
      const blockers = await departureBlockers(ctx, user, auth.userId);
      if (blockers.length) throw new ConvexError(blockers.join("; "));
    }
    await recordStaffServiceEvent(ctx, user, { type: args.archived ? "archive" : "restore", reason: "Account visibility changed; service status unchanged", actorUserId: auth.userId });
    await ctx.db.patch(user._id, { isArchived: args.archived, archivedAt: args.archived ? Date.now() : undefined,
      archivedBy: args.archived ? auth.userId : undefined });
    return null;
  },
});

export const listStaffServiceDirectory = query({
  args: { schoolId: v.id("schools"), status: staffEmploymentStatus, role: v.optional(staffRole), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "staff.list.view");
    if (args.paginationOpts.numItems > 100) throw new ConvexError("Request at most 100 staff per page");
    const page = await ctx.db.query("users").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).paginate(args.paginationOpts);
    return { ...page, page: page.page.filter((u): u is Staff => !u.isArchived && (u.employmentStatus ?? "active") === args.status &&
      (u.role === "teacher" || u.role === "admin" || u.role === "staff") && (!args.role || u.role === args.role)).map(u => ({
        userId: u._id, name: u.name, email: u.email, role: u.role, isSchoolAdmin: u.role === "admin" || u.isSchoolAdmin === true,
        status: u.employmentStatus ?? "active", revision: u.serviceRevision ?? 0,
      })) };
  },
});

export const getStaffServiceProfile = query({
  args: { schoolId: v.id("schools"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await requireCapability(ctx, args.schoolId, "staff.list.view");
    const user = await target(ctx, args.schoolId, args.userId);
    let canDepart = false, canReviewRehire = false;
    const rehireBlockers: string[] = [];
    try { await requireCapability(ctx, args.schoolId, "staff.account.suspend"); canDepart = true; }
    catch (error) { if (!(error instanceof ConvexError)) throw error; }
    if (user.employmentStatus === "departed" && user.isArchived) rehireBlockers.push("Restore the archived account before rehire");
    if (user.employmentStatus === "departed" && !user.isArchived) {
      try {
        await requireCapability(ctx, args.schoolId, "staff.onboard");
        const link = await returningLink(ctx, user);
        await reviewStaffPermissions(ctx, user, link?.membership ?? null);
        canReviewRehire = true;
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        const data: unknown = error.data;
        rehireBlockers.push(typeof data === "string" ? data : typeof data === "object" && data !== null &&
          "message" in data && typeof data.message === "string" ? data.message : "Access review requires separate authorization");
      }
    }
    return { userId: user._id, personId: user.personId ?? null, name: user.name, email: user.email, role: user.role,
      status: user.employmentStatus ?? "active", revision: user.serviceRevision ?? 0, isArchived: user.isArchived === true,
      isSchoolAdmin: user.role === "admin" || user.isSchoolAdmin === true,
      currentPeriodId: user.currentServicePeriodId ?? null, reviewedEventId: user.reviewedRehireEventId ?? null,
      canDepart: canDepart && Boolean(auth.userId) && !user.isArchived && user.employmentStatus !== "departed", canReviewRehire: canReviewRehire && Boolean(auth.userId), rehireBlockers,
      departureBlockers: canDepart ? await departureBlockers(ctx, user, auth.userId) : [], context: await context(ctx, user.schoolId) };
  },
});

export const getStaffServiceHistory = query({
  args: { schoolId: v.id("schools"), userId: v.id("users"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "staff.list.view"); await target(ctx, args.schoolId, args.userId);
    if (args.paginationOpts.numItems > 100) throw new ConvexError("Request at most 100 events per page");
    return ctx.db.query("staffServiceEvents").withIndex("by_schoolId_and_userId_and_revision", q => q.eq("schoolId", args.schoolId).eq("userId", args.userId)).order("desc").paginate(args.paginationOpts);
  },
});
export const getStaffServicePeriods = query({
  args: { schoolId: v.id("schools"), userId: v.id("users"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireCapability(ctx, args.schoolId, "staff.list.view"); await target(ctx, args.schoolId, args.userId);
    if (args.paginationOpts.numItems > 100) throw new ConvexError("Request at most 100 periods per page");
    return ctx.db.query("staffServicePeriods").withIndex("by_schoolId_and_userId_and_recordedAt", q => q.eq("schoolId", args.schoolId).eq("userId", args.userId)).order("desc").paginate(args.paginationOpts);
  },
});
