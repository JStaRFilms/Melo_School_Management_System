import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, type QueryCtx, type MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { correctionScope, correctionPayload, correctionState, type CorrectionScope } from "./profileCorrectionContract";
import { parentInSchool, parentProjection, correctionTargets, targetBaseline, normalizedCorrection, applyCorrection, validateScope, validateCorrectionNameScope, correctionError } from "./profileCorrectionTargets";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import { recordAuditEventHelper } from "./audit";
import { requiresCorrectionNamePair } from "@school/shared/profile-corrections";

type Context = QueryCtx | MutationCtx;
const contextArgs = { schoolId: v.id("schools"), requestId: v.id("profileCorrectionRequests") };
const versionArgs = { ...contextArgs, expectedRevision: v.number(), expectedDraftRevision: v.number() };
function boundedReason(value: string) {
  const reason = value.trim();
  if (!reason || reason.length > 500) correctionError("Provide a reason of 1 to 500 characters");
  return reason;
}
function key(value: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(value)) correctionError("Invalid request or submission key");
}
async function adminInSchool(ctx: Context, schoolId: Id<"schools">) {
  const actor = await getAuthenticatedSchoolMembership(ctx, { schoolId, capability: "enrollment.intakes.manage" });
  await assertAdminForSchool(ctx, actor.userId, schoolId, actor.role);
  return actor;
}
async function loadRequest(ctx: Context, args: { schoolId: Id<"schools">; requestId: Id<"profileCorrectionRequests"> }, admin = false) {
  const actor = admin ? await adminInSchool(ctx, args.schoolId) : await parentInSchool(ctx, args.schoolId);
  const request = await ctx.db.get(args.requestId);
  const actorUserId = "user" in actor ? actor.user._id : actor.userId;
  if (!request || request.schoolId !== args.schoolId || (!admin && request.requesterUserId !== actorUserId)) correctionError("FORBIDDEN: Correction request not found");
  const parent = await ctx.db.get(request.requesterUserId);
  if (!parent || parent.schoolId !== args.schoolId) correctionError("FORBIDDEN: Parent not found");
  const identity = await parentProjection(ctx, parent);
  if (identity.personId !== request.requesterPersonId || identity.membershipId !== request.requesterMembershipId)
    correctionError("FORBIDDEN: Requester identity changed");
  // Recheck the entire original target selection, including fields the admin did not grant.
  const original = await correctionTargets(ctx, parent, request.requestedScope);
  if (parent.authId !== request.requesterAuthId || parent.authTokenIdentifier !== request.requesterTokenIdentifier ||
      original.member?.familyId !== request.parentFamilyId || original.child?.familyId !== request.childFamilyId ||
      original.childLink?._id !== request.childLinkId || original.child?.userId !== request.childUserId)
    correctionError("FORBIDDEN: Original identity or exact family links changed");
  const targets = await correctionTargets(ctx, parent, request.allowedScope ?? request.requestedScope);
  return { request, parent, targets, original, actorUserId };
}
function requireVersion(request: Doc<"profileCorrectionRequests">, args: { expectedRevision: number; expectedDraftRevision?: number }) {
  if (request.revision !== args.expectedRevision || (args.expectedDraftRevision !== undefined && request.draftRevision !== args.expectedDraftRevision))
    correctionError("CONFLICT: Reload and explicitly recover the saved draft before continuing");
}
function requireGrant(request: Doc<"profileCorrectionRequests">) {
  if (request.state !== "granted" || !request.allowedScope || !request.baseline) correctionError("Editing permission is not available");
  return request.allowedScope;
}
function requireBaseline(request: Doc<"profileCorrectionRequests">, targets: Awaited<ReturnType<typeof correctionTargets>>, scope: CorrectionScope) {
  if (targetBaseline(targets, scope) !== request.baseline) correctionError("STALE_PROFILE: Refresh the baseline and review again. Your draft has not been applied.");
}
async function audit(ctx: MutationCtx, request: Doc<"profileCorrectionRequests">, action: string, actorUserId: Id<"users">, fields: string[] = []) {
  await recordAuditEventHelper(ctx, { schoolId: request.schoolId, actorKind: "user", actorEmailSnapshot: "authenticated profile correction actor",
    module: "enrollment", action: `profile_correction_${action}`, targetType: "profileCorrectionRequest", targetId: request._id,
    outcome: "success", correlationId: request._id, retentionClass: "permanent_statutory",
    safeSummary: `Profile correction ${action}; actor ${actorUserId}; requester ${request.requesterUserId}; child ${request.requestedScope.childId ?? "none"}; member ${request.requestedScope.parentMemberId ?? "none"}; fields ${fields.join(", ")}` });
}
function summary(request: Doc<"profileCorrectionRequests">) {
  return { requestId: request._id, requesterUserId: request.requesterUserId, state: request.state, requestedScope: request.requestedScope,
    allowedScope: request.allowedScope, revision: request.revision, createdAt: request.createdAt, appliedAt: request.applied?.appliedAt };
}
async function checkedSummary(ctx: Context, request: Doc<"profileCorrectionRequests">, admin = false) {
  try { await loadRequest(ctx, { schoolId: request.schoolId, requestId: request._id }, admin); return { ...summary(request), currentAccess: true }; }
  catch (error) { if (!(error instanceof ConvexError)) throw error; return { ...summary(request), currentAccess: false }; }
}
export const getWorkspace = query({
  args: { schoolId: v.id("schools"), studentId: v.optional(v.id("students")) },
  handler: async (ctx, args) => {
    const membership = await parentInSchool(ctx, args.schoolId);
    const parent = membership.user;
    const links = await ctx.db.query("familyMembers").withIndex("by_parent_user", q => q.eq("parentUserId", parent._id)).take(101);
    if (links.length > 100) correctionError("Family links exceed supported bounds");
    const addresses = [];
    for (const link of links) {
      const family = await ctx.db.get(link.familyId);
      if (link.schoolId === args.schoolId && family?.schoolId === args.schoolId) addresses.push({ memberId: link._id, familyName: family.name,
        mode: link.addressMode ?? null, value: link.addressOverride ?? null, residential: family.residentialAddress ?? null });
    }
    const scope: CorrectionScope = { parentFields: ["phone"], childFields: args.studentId ? ["dateOfBirth"] : [], childId: args.studentId };
    const targets = await correctionTargets(ctx, parent, scope);
    const requests = await ctx.db.query("profileCorrectionRequests").withIndex("by_schoolId_and_requesterUserId", q =>
      q.eq("schoolId", args.schoolId).eq("requesterUserId", parent._id)).order("desc").take(20);
    return { parent: { name: parent.name, firstName: parent.firstName ?? null, middleName: parent.middleName ?? null, lastName: parent.lastName ?? null, phone: parent.phone ?? null },
      addresses, child: targets.child && targets.childUser ? { studentId: targets.child._id, name: targets.childUser.name,
        firstName: targets.childUser.firstName ?? null, middleName: targets.childUser.middleName ?? null, lastName: targets.childUser.lastName ?? null,
        dateOfBirth: targets.child.dateOfBirth ?? null, gender: targets.child.gender ?? null, addressMode: targets.child.addressMode ?? null,
        address: targets.child.address ?? null, residential: targets.childFamily?.residentialAddress ?? null } : null,
      requests: await Promise.all(requests.map(request => checkedSummary(ctx, request))) };
  },
});
export const requestCorrection = mutation({
  args: { schoolId: v.id("schools"), scope: correctionScope, reason: v.string(), requestKey: v.string() },
  handler: async (ctx, args) => {
    key(args.requestKey); const reason = boundedReason(args.reason); const scope = validateScope(args.scope);
    const { user } = await parentInSchool(ctx, args.schoolId);
    const targets = await correctionTargets(ctx, user, scope);
    validateCorrectionNameScope(targets, scope);
    const existing = await ctx.db.query("profileCorrectionRequests").withIndex("by_schoolId_and_requesterUserId_and_requestKey", q =>
      q.eq("schoolId", args.schoolId).eq("requesterUserId", user._id).eq("requestKey", args.requestKey)).unique();
    if (existing) {
      if (existing.reason !== reason || JSON.stringify(existing.requestedScope) !== JSON.stringify(scope)) correctionError("Request key was already used for different content");
      await loadRequest(ctx, { schoolId: args.schoolId, requestId: existing._id });
      return existing._id;
    }
    for (const state of ["requested", "granted"] as const) {
      const open = await ctx.db.query("profileCorrectionRequests").withIndex("by_schoolId_and_requesterUserId_and_state", q =>
        q.eq("schoolId", args.schoolId).eq("requesterUserId", user._id).eq("state", state)).first();
      if (open) correctionError("An open correction request already exists in this school");
    }
    const now = Date.now();
    const requestId = await ctx.db.insert("profileCorrectionRequests", { schoolId: args.schoolId, requesterUserId: user._id,
      requesterPersonId: targets.identity.personId, requesterMembershipId: targets.identity.membershipId,
      requesterAuthId: user.authId, requesterTokenIdentifier: user.authTokenIdentifier,
      parentFamilyId: targets.member?.familyId, childFamilyId: targets.child?.familyId,
      childLinkId: targets.childLink?._id, childUserId: targets.child?.userId,
      requestKey: args.requestKey, reason, requestedScope: scope, state: "requested", revision: 0, draftRevision: 0, createdAt: now, updatedAt: now });
    const request = await ctx.db.get(requestId);
    if (!request) correctionError("Correction request could not be saved");
    await audit(ctx, request, "requested", user._id, [...scope.parentFields, ...scope.childFields]);
    return requestId;
  },
});
export const getRequest = query({ args: contextArgs, handler: async (ctx, args) => {
  const { request, targets } = await loadRequest(ctx, args);
  const { baseline, requesterAuthId, requesterTokenIdentifier, ...detail } = request;
  return { ...detail, stale: Boolean(request.allowedScope && targetBaseline(targets, request.allowedScope) !== request.baseline) };
} });
export const saveDraft = mutation({ args: { ...versionArgs, payload: correctionPayload }, handler: async (ctx, args) => {
  const { request, targets } = await loadRequest(ctx, args); requireVersion(request, args);
  const scope = requireGrant(request);
  normalizedCorrection(targets, scope, args.payload, Date.now());
  await ctx.db.patch(request._id, { draft: args.payload, draftRevision: request.draftRevision + 1, lastSavedAt: Date.now(), updatedAt: Date.now() });
  return { draftRevision: request.draftRevision + 1 };
} });
export const discardDraft = mutation({ args: versionArgs, handler: async (ctx, args) => {
  const { request } = await loadRequest(ctx, args); requireVersion(request, args); requireGrant(request);
  await ctx.db.patch(request._id, { draft: undefined, draftRevision: request.draftRevision + 1, lastSavedAt: undefined, updatedAt: Date.now() });
  return null;
} });
export const refreshBaseline = mutation({ args: versionArgs, handler: async (ctx, args) => {
  const { request, targets } = await loadRequest(ctx, args); requireVersion(request, args); const scope = requireGrant(request);
  await ctx.db.patch(request._id, { baseline: targetBaseline(targets, scope), revision: request.revision + 1, updatedAt: Date.now() });
  return null;
} });
async function reviewToken(request: Doc<"profileCorrectionRequests">, changes: ReturnType<typeof normalizedCorrection>["changes"]) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([request._id, request.revision, request.draftRevision, request.baseline, changes, "immediate-apply-v1"])));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
export const review = query({ args: versionArgs, handler: async (ctx, args) => {
  const { request, targets } = await loadRequest(ctx, args); requireVersion(request, args); const scope = requireGrant(request); requireBaseline(request, targets, scope);
  const prepared = normalizedCorrection(targets, scope, request.draft ?? {});
  if (!prepared.changes.length) correctionError("No changed fields to submit");
  return { changes: prepared.changes, reviewToken: await reviewToken(request, prepared.changes) };
} });
export const submit = mutation({ args: { ...versionArgs, reviewToken: v.string(), submissionKey: v.string(), acknowledged: v.boolean() }, handler: async (ctx, args) => {
  key(args.submissionKey);
  const { request, targets, actorUserId } = await loadRequest(ctx, args);
  if (!args.acknowledged) correctionError("Acknowledge the immediate-effect warning");
  if (request.state === "applied" && request.applied) {
    if (request.applied.key !== args.submissionKey || request.applied.reviewToken !== args.reviewToken ||
        request.applied.grantRevision !== args.expectedRevision || request.applied.draftRevision !== args.expectedDraftRevision)
      correctionError("Submission key or reviewed content does not match the applied receipt");
    return { requestId: request._id, appliedAt: request.applied.appliedAt, replayed: true };
  }
  requireVersion(request, args); const scope = requireGrant(request); requireBaseline(request, targets, scope);
  const prepared = normalizedCorrection(targets, scope, request.draft ?? {}, Date.now());
  if (!prepared.changes.length) correctionError("No changed fields to submit");
  if (await reviewToken(request, prepared.changes) !== args.reviewToken) correctionError("Review changed. Review and acknowledge again.");
  await applyCorrection(ctx, targets, prepared);
  const appliedAt = Date.now();
  await audit(ctx, request, "applied", actorUserId, prepared.changes.map(change => `${change.target}.${change.field}`));
  await ctx.db.patch(request._id, { state: "applied", revision: request.revision + 1, draft: undefined, lastSavedAt: undefined,
    applied: { key: args.submissionKey, reviewToken: args.reviewToken, appliedAt, grantRevision: request.revision, draftRevision: request.draftRevision, changes: prepared.changes }, updatedAt: appliedAt });
  return { requestId: request._id, appliedAt, replayed: false };
} });
export const listRequests = query({ args: { schoolId: v.id("schools"), state: correctionState, paginationOpts: paginationOptsValidator }, handler: async (ctx, args) => {
  await adminInSchool(ctx, args.schoolId);
  const page = await ctx.db.query("profileCorrectionRequests").withIndex("by_schoolId_and_state", q => q.eq("schoolId", args.schoolId).eq("state", args.state)).order("desc").paginate(args.paginationOpts);
  return { ...page, page: await Promise.all(page.page.map(request => checkedSummary(ctx, request, true))) };
} });
export const getAdminRequest = query({ args: contextArgs, handler: async (ctx, args) => {
  const { request, targets, original } = await loadRequest(ctx, args, true);
  const { baseline, requesterAuthId, requesterTokenIdentifier, draft, ...detail } = request;
  return { ...detail, requesterName: original.parent.name, childName: original.childUser?.name ?? null,
    parentRequiresNamePair: requiresCorrectionNamePair(original.parent), childRequiresNamePair: original.childUser ? requiresCorrectionNamePair(original.childUser) : false, stale: Boolean(request.allowedScope && targetBaseline(targets, request.allowedScope) !== request.baseline) };
} });
export const decide = mutation({ args: { ...contextArgs, expectedRevision: v.number(), decision: v.union(v.literal("grant"), v.literal("reject"), v.literal("revoke")), allowedScope: v.optional(correctionScope), reason: v.optional(v.string()) }, handler: async (ctx, args) => {
  const actor = await adminInSchool(ctx, args.schoolId);
  const request = await ctx.db.get(args.requestId);
  if (!request || request.schoolId !== args.schoolId) correctionError("FORBIDDEN: Correction request not found");
  requireVersion(request, args);
  const actorUserId = actor.userId;
  if (args.decision === "grant") {
    const { parent } = await loadRequest(ctx, args, true);
    if (request.state !== "requested" || !args.allowedScope) correctionError("Only a requested correction can be granted");
    const scope = validateScope(args.allowedScope); const requested = request.requestedScope;
    if (scope.parentFields.some(f => !requested.parentFields.includes(f)) || scope.childFields.some(f => !requested.childFields.includes(f)) ||
        (scope.parentMemberId && scope.parentMemberId !== requested.parentMemberId) || (scope.childId && scope.childId !== requested.childId)) correctionError("Grant must be a subset of the requested exact targets and fields");
    const targets = await correctionTargets(ctx, parent, scope);
    validateCorrectionNameScope(targets, scope);
    await ctx.db.patch(request._id, { state: "granted", allowedScope: scope, baseline: targetBaseline(targets, scope), decisionBy: actorUserId, revision: request.revision + 1, updatedAt: Date.now() });
    await audit(ctx, request, "granted", actorUserId, [...scope.parentFields, ...scope.childFields]);
  } else {
    if (request.state !== (args.decision === "reject" ? "requested" : "granted")) correctionError("This correction request is not open for that decision");
    if (args.allowedScope) correctionError("Only grant decisions accept scope");
    const reason = boundedReason(args.reason ?? "");
    // Recheck current identity/links, but allow the school admin to CLOSE invalid
    // permission. Otherwise a transfer or archive strands an open request forever.
    // This path exposes no draft/evidence and never authorizes a profile write.
    try { await loadRequest(ctx, args, true); }
    catch (error) { if (!(error instanceof ConvexError)) throw error; }
    await ctx.db.patch(request._id, { state: args.decision === "reject" ? "rejected" : "revoked", decisionBy: actorUserId, decisionReason: reason,
      draft: undefined, lastSavedAt: undefined, revision: request.revision + 1, updatedAt: Date.now() });
    await audit(ctx, request, args.decision === "reject" ? "rejected" : "revoked", actorUserId);
  }
  return null;
} });
