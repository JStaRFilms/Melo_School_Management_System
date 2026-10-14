import { RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { getAuthenticatedSchoolMembership, assertAdminForSchool } from "./auth";
import { isEmailAddress, normalizeEmailCase } from "../foundation/normalize";

const FIVE_MINUTES = 5 * 60_000;
const limiter = new RateLimiter(components.rateLimiter, {
  accountNotice: { kind: "token bucket", rate: 1, period: FIVE_MINUTES, capacity: 1 },
});
type ReadCtx = QueryCtx | MutationCtx;

async function authorizedTarget(ctx: ReadCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.isArchived) throw new ConvexError("Account not found");
  const actor = await getAuthenticatedSchoolMembership(ctx, { capability: user.role === "student" || user.role === "parent" ? "enrollment.intakes.manage" : user.lastCredentialOperation?.kind === "ready" ? "staff.onboard" : "staff.password.reset" });
  await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
  if (user.schoolId !== actor.schoolId) throw new ConvexError("Account not found");
  return user;
}

function deliverable(user: Doc<"users">) {
  const email = normalizeEmailCase(user.email);
  // The role, not the suffix, identifies synthetic student logins.
  return user.role !== "student" && !user.isArchived && isEmailAddress(email) && email.length <= 240 &&
    !email.endsWith(".local") && !/[\r\n]/.test(email) ? email : null;
}

async function linkedRecipient(ctx: ReadCtx, target: Doc<"users">, recipientUserId?: Id<"users">) {
  if (target.isArchived) return null;
  if (target.role !== "student") return !recipientUserId || recipientUserId === target._id ? target : null;
  if (!recipientUserId) return null;
  const students = await ctx.db.query("students").withIndex("by_school_and_user", q => q.eq("schoolId", target.schoolId).eq("userId", target._id)).take(2);
  const student = students.length === 1 ? students[0] : null;
  if (!student || student.schoolId !== target.schoolId || student.isArchived || !student.familyId) return null;
  const family = await ctx.db.get(student.familyId);
  const parent = await ctx.db.get(recipientUserId);
  if (!family || family.schoolId !== target.schoolId || !parent || parent.schoolId !== target.schoolId || parent.role !== "parent" || parent.isArchived) return null;
  const links = await ctx.db.query("familyMembers").withIndex("by_family_and_parent", q => q.eq("familyId", family._id).eq("parentUserId", parent._id)).take(2);
  return links.length === 1 && links[0].schoolId === target.schoolId ? parent : null;
}

async function linkedAccount(ctx: ReadCtx, target: Doc<"users">) {
  if (!target.personId || !target.authTokenIdentifier || target.isArchived) return false;
  const personId = target.personId;
  const person = await ctx.db.get(personId);
  const school = await ctx.db.get(target.schoolId);
  const links = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", target.schoolId)).take(2);
  return school?.status === "active" && person?.status === "active" && person.identityReconciliationState === "resolved" &&
    person.authTokenIdentifier === target.authTokenIdentifier && target.authTokenIdentifier.endsWith(`|${target.authId}`) && links.length === 1 && links[0].status === "active" && links[0].legacyUserId === target._id;
}

export const getAccountNoticeState = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const target = await authorizedTarget(ctx, args.userId);
    const operation = target.lastCredentialOperation;
    const notice = operation ? await ctx.db.query("accountNoticeOutbox").withIndex("by_target_user_and_operation", q => q.eq("targetUserId", target._id).eq("operationId", operation.operationId)).unique() : null;
    const guardians: Array<{ userId: Id<"users">; name: string; email: string }> = [];
    if (target.role === "student") {
      const students = await ctx.db.query("students").withIndex("by_school_and_user", q => q.eq("schoolId", target.schoolId).eq("userId", target._id)).take(2);
      const familyId = students.length === 1 ? students[0].familyId : undefined;
      if (familyId) {
        const members = await ctx.db.query("familyMembers").withIndex("by_family", q => q.eq("familyId", familyId)).take(50);
        for (const member of members) {
          const parent = await linkedRecipient(ctx, target, member.parentUserId);
          const email = parent && deliverable(parent);
          if (parent && email) guardians.push({ userId: parent._id, name: parent.name, email });
        }
      }
    }
    return { operationId: operation?.operationId ?? null, linked: await linkedAccount(ctx, target), student: target.role === "student", guardians,
      ownRecipient: deliverable(target), notice: notice ? { id: notice._id, state: notice.state, recipientEmail: notice.recipientEmail ?? null,
        nextAttemptAt: notice.nextAttemptAt, attemptCount: notice.attemptCount } : null };
  },
});

async function enqueue(ctx: MutationCtx, target: Doc<"users">, operationId: string, recipientUserId?: Id<"users">) {
  const operation = target.lastCredentialOperation;
  if (!operation || operation.operationId !== operationId || !await linkedAccount(ctx, target)) throw new ConvexError("Committed linked-account operation required");
  const existing = await ctx.db.query("accountNoticeOutbox").withIndex("by_target_user_and_operation", q => q.eq("targetUserId", target._id).eq("operationId", operationId)).unique();
  if (existing) {
    if (recipientUserId && existing.recipientUserId !== recipientUserId) throw new ConvexError("This operation already has a selected recipient");
    return existing._id;
  }
  const recipient = await linkedRecipient(ctx, target, recipientUserId);
  const email = recipient && deliverable(recipient);
  if (target.role === "student" && !email) throw new ConvexError("Select an eligible linked guardian");
  const school = await ctx.db.get(target.schoolId);
  if (!school) throw new ConvexError("School not found");
  const now = Date.now();
  const quota = email ? await limiter.limit(ctx, "accountNotice", { key: `${target.schoolId}:${email}` }) : null;
  const state = !email ? "ineligible" as const : !quota?.ok ? "suppressed" as const : "pending" as const;
  const subject = `${school.name}: account ${operation.kind === "ready" ? "ready" : "password reset"}`;
  const text = `${school.name}\n\n${target.role === "student" ? "The linked student's account" : "Your school account"} ${operation.kind === "ready" ? "is ready" : "password has been reset"}. Contact the school for the login details through its usual private handoff. This notice contains no password or sign-in link.\n\nIf you did not expect this change, contact the school.`;
  const id = await ctx.db.insert("accountNoticeOutbox", { schoolId: target.schoolId, targetUserId: target._id, operationId, kind: operation.kind,
    ...(recipient && email ? { recipientUserId: recipient._id, recipientEmail: email } : {}), subject, text, state,
    attemptCount: 0, nextAttemptAt: now + (quota && !quota.ok ? quota.retryAfter : 0), createdAt: now, updatedAt: now });
  if (state === "pending") await ctx.scheduler.runAfter(0, internal.functions.academic.accountNotices.processNotice, { outboxId: id });
  return id;
}

export const enqueueAccountNotice = mutation({
  args: { userId: v.id("users"), operationId: v.string(), guardianUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => enqueue(ctx, await authorizedTarget(ctx, args.userId), args.operationId, args.guardianUserId),
});
export const enqueueAccountNoticeInternal = internalMutation({
  args: { userId: v.id("users"), operationId: v.string() },
  handler: async (ctx, args) => {
    const target = await authorizedTarget(ctx, args.userId);
    // Student delivery requires a deliberate guardian selection in the completed record panel.
    if (target.role === "student") return null;
    return enqueue(ctx, target, args.operationId);
  },
});

export const retryAccountNotice = mutation({
  args: { outboxId: v.id("accountNoticeOutbox") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row) throw new ConvexError("Notice not found");
    const target = await authorizedTarget(ctx, row.targetUserId);
    if (row.schoolId !== target.schoolId || !await linkedAccount(ctx, target)) throw new ConvexError("Notice context changed");
    if (row.state === "accepted" || row.state === "pending" || row.state === "sending") return null;
    const recipient = await linkedRecipient(ctx, target, row.recipientUserId);
    if (!recipient || deliverable(recipient) !== row.recipientEmail) throw new ConvexError("Notice recipient is no longer eligible");
    const now = Date.now();
    if (row.attemptCount >= 5 || row.firstAttemptAt !== undefined && now - row.firstAttemptAt >= 23 * 60 * 60_000) throw new ConvexError("Notice needs operator review; provider deduplication can no longer be assumed");
    const quota = await limiter.limit(ctx, "accountNotice", { key: `${row.schoolId}:${row.recipientEmail}` });
    if (!quota.ok) { await ctx.db.patch(row._id, { nextAttemptAt: now + quota.retryAfter }); return null; }
    await ctx.db.patch(row._id, { state: "pending", nextAttemptAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.functions.academic.accountNotices.processNotice, args);
    return null;
  },
});

export const claimNotice = internalMutation({
  args: { outboxId: v.id("accountNoticeOutbox"), hasApiKey: v.boolean(), from: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    const now = Date.now();
    if (!row || !["pending", "sending", "failed"].includes(row.state) || row.nextAttemptAt > now) return null;
    if (row.attemptCount >= 5) {
      if (row.state === "sending") await ctx.db.patch(row._id, { state: "reconciliation_required", updatedAt: now });
      return null;
    }
    if (row.firstAttemptAt !== undefined && now - row.firstAttemptAt >= 23 * 60 * 60_000) {
      await ctx.db.patch(row._id, { state: "reconciliation_required", updatedAt: now }); return null;
    }
    const target = await ctx.db.get(row.targetUserId);
    const recipient = target && await linkedRecipient(ctx, target, row.recipientUserId);
    if (!target || target.schoolId !== row.schoolId || !await linkedAccount(ctx, target) || !recipient || !row.recipientEmail || deliverable(recipient) !== row.recipientEmail) {
      await ctx.db.patch(row._id, { state: "ineligible", updatedAt: now }); return null;
    }
    const from = row.providerFrom ?? args.from;
    // Configuration failures are not provider submissions and must not consume a lease number or start the deduplication window.
    if (!args.hasApiKey || !from) {
      await ctx.db.patch(row._id, { state: "not_configured", lastErrorCode: "EMAIL_NOT_CONFIGURED", nextAttemptAt: now + 60_000, updatedAt: now });
      return null;
    }
    const attemptNumber = row.attemptCount + 1;
    await ctx.db.patch(row._id, { state: "sending", attemptCount: attemptNumber, nextAttemptAt: now + FIVE_MINUTES,
      ...(row.firstAttemptAt === undefined ? { firstAttemptAt: now } : {}), providerFrom: from, updatedAt: now });
    // Recover a crashed worker. Attempt-number fencing prevents a late worker from finishing a later lease.
    await ctx.scheduler.runAfter(FIVE_MINUTES, internal.functions.academic.accountNotices.processNotice, { outboxId: row._id });
    return { attemptNumber, from, to: row.recipientEmail, subject: row.subject, text: row.text };
  },
});

export const finishNotice = internalMutation({
  args: { outboxId: v.id("accountNoticeOutbox"), attemptNumber: v.number(), providerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.state !== "sending" || row.attemptCount !== args.attemptNumber) return null;
    const now = Date.now();
    const state = args.providerId ? "accepted" as const : "failed" as const;
    const retryAt = now + 60_000 * 2 ** (args.attemptNumber - 1);
    await ctx.db.patch(row._id, { state, ...(args.providerId ? { providerId: args.providerId } : {}),
      lastErrorCode: args.providerId ? undefined : "EMAIL_PROVIDER_UNCONFIRMED", nextAttemptAt: retryAt, updatedAt: now });
    if (state === "failed" && args.attemptNumber < 5) await ctx.scheduler.runAfter(retryAt - now, internal.functions.academic.accountNotices.processNotice, { outboxId: row._id });
    return null;
  },
});

export const processNotice = internalAction({
  args: { outboxId: v.id("accountNoticeOutbox") },
  handler: async (ctx, args): Promise<null> => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const configuredFrom = process.env.MELO_EMAIL_FROM?.trim();
    const from = apiKey && configuredFrom && /@jstarstudios\.com>?$/i.test(configuredFrom) && !/[\r\n]/.test(configuredFrom) ? configuredFrom : undefined;
    const delivery = await ctx.runMutation(internal.functions.academic.accountNotices.claimNotice, { ...args, hasApiKey: Boolean(apiKey), ...(from ? { from } : {}) });
    if (!delivery) return null;
    let providerId: string | undefined;
    try {
      const response = await fetch("https://api.resend.com/emails", { method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `account-notice/${args.outboxId}` },
        body: JSON.stringify({ from: delivery.from, to: [delivery.to], subject: delivery.subject, text: delivery.text }) });
      if (response.ok) {
        const result: unknown = await response.json();
        if (result && typeof result === "object" && "id" in result && typeof result.id === "string" && result.id.length <= 200) providerId = result.id;
      }
    } catch { /* Never persist or log provider response bodies, credentials or secrets. */ }
    await ctx.runMutation(internal.functions.academic.accountNotices.finishNotice, { ...args, attemptNumber: delivery.attemptNumber,
      ...(providerId ? { providerId } : {}) });
    return null;
  },
});
