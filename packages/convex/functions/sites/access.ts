import { v } from "convex/values";
import { action, internalMutation } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";
import { getAuthenticatedPlatformAdmin } from "../platform/auth";
import { deny, ownedProfile } from "./shared";
import { provisionSiteAccessArgs, revokeSiteAccessArgs, siteAccessCapabilities, siteAccessRequest } from "./accessContract";
import type { AdmissionsPermissionV1 } from "@school/shared";

const MAX_ACCESS_MS = 30 * 24 * 60 * 60_000;
const provisionResult = v.object({ grantIds: v.array(v.id("schoolCapabilityGrants")) });
const revokeResult = v.object({ revoked: v.boolean() });
type AccessResult = { grantIds: Id<"schoolCapabilityGrants">[] } | { revoked: boolean };

function requireSetupWindow() {
  if (process.env.SITES_ALLOW_ACCESS_PROVISIONING !== "enabled") return deny();
}

// The authenticated action propagates identity; callers cannot supply an operator ID.
export const configureAccess = action({
  args: { request: siteAccessRequest },
  returns: v.union(provisionResult, revokeResult),
  handler: async (ctx, { request }): Promise<AccessResult> => {
    requireSetupWindow();
    if (!await ctx.auth.getUserIdentity()) return deny();
    if (request.operation === "provision") {
      const { operation: _, ...args } = request;
      return ctx.runMutation(internal.functions.sites.access.provision, args);
    }
    const { operation: _, ...args } = request;
    return ctx.runMutation(internal.functions.sites.access.revoke, args);
  },
});

async function operatorForSchool(
  ctx: MutationCtx,
  args: { schoolId: Id<"schools">; confirmation: string; reason: string },
) {
  requireSetupWindow();
  const operator = await getAuthenticatedPlatformAdmin(ctx);
  const school = await ctx.db.get(args.schoolId);
  if (!school || args.confirmation !== school.slug || args.reason.trim() !== args.reason ||
      args.reason.length < 8 || args.reason.length > 500 || /[<>\u0000-\u001f\u007f]/u.test(args.reason)) return deny();
  return { operator, school };
}

async function reviewedRecipient(ctx: MutationCtx, schoolId: Id<"schools">, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user || user.schoolId !== schoolId || user.isArchived || !user.authId ||
      !user.authTokenIdentifier?.endsWith(`|${user.authId}`) ||
      !["admin", "staff", "teacher"].includes(user.role)) return deny();
  const byToken = await ctx.db.query("users").withIndex("by_auth_token_identifier", q => q.eq("authTokenIdentifier", user.authTokenIdentifier)).take(101);
  const byAuth = await ctx.db.query("users").withIndex("by_auth", q => q.eq("authId", user.authId)).take(101);
  const byPerson = user.personId
    ? await ctx.db.query("users").withIndex("by_person", q => q.eq("personId", user.personId)).take(101)
    : [];
  if ([byToken, byAuth, byPerson].some(rows => rows.length > 100)) return deny();
  const matches = new Set([...byToken, ...byAuth, ...byPerson]
    .filter(row => row.schoolId === schoolId && !row.isArchived).map(row => row._id));
  if (matches.size !== 1) return deny();
  if (user.personId) {
    const person = await ctx.db.get(user.personId);
    if (!person || person.status !== "active" || person.identityReconciliationState === "reconciliation_required" ||
        person.authTokenIdentifier !== user.authTokenIdentifier) return deny();
  }
  return user;
}

function active(grant: Doc<"schoolCapabilityGrants">, now: number) {
  return grant.revokedAt === undefined && (grant.expiresAt === undefined || grant.expiresAt > now);
}

export const provision = internalMutation({
  args: provisionSiteAccessArgs,
  returns: provisionResult,
  handler: async (ctx, args) => {
    const { operator, school } = await operatorForSchool(ctx, args);
    const now = Date.now();
    if (school.status !== "active" || !Number.isFinite(args.expiresAt) ||
        args.expiresAt <= now || args.expiresAt > now + MAX_ACCESS_MS ||
        (args.sensitivePublishing && args.role !== "publisher")) return deny();
    await ownedProfile(ctx, args.schoolId);
    const user = await reviewedRecipient(ctx, args.schoolId, args.userId);
    if (user.authId === operator.authId) return deny();
    const capabilities: AdmissionsPermissionV1[] = [...siteAccessCapabilities[args.role]];
    if (args.sensitivePublishing) capabilities.push("site.publish.sensitive");
    const existing = await ctx.db.query("schoolCapabilityGrants")
      .withIndex("by_school_and_user", q => q.eq("schoolId", args.schoolId).eq("userId", args.userId)).take(101);
    // The authorization reader is bounded at 100, including historical rows.
    if (existing.length + capabilities.length > 100) return deny();
    const live = existing.filter(grant => grant.scope === "school" && active(grant, now));
    if (live.some(grant => capabilities.includes(grant.capability) ||
        ("provisioningSource" in grant && grant.provisioningSource === "site_operator") ||
        (args.role === "reviewer" && ["site.publish.standard", "site.publish.sensitive"].includes(grant.capability)) ||
        (args.role === "publisher" && grant.capability === "privacy.approve"))) return deny();
    const grantIds: Id<"schoolCapabilityGrants">[] = [];
    for (const capability of capabilities) {
      grantIds.push(await ctx.db.insert("schoolCapabilityGrants", {
        schoolId: args.schoolId, userId: args.userId, capability, scope: "school",
        provisioningSource: "site_operator", siteAccessRole: args.role,
        grantedByPlatformAdminId: operator.adminId, reason: args.reason,
        expiresAt: args.expiresAt, isBreakGlass: true, createdAt: now,
      }));
    }
    await ctx.db.insert("schoolSiteAuditEvents", {
      schoolId: args.schoolId, actorPlatformAdminId: operator.adminId,
      eventType: "grant_changed", outcome: "success", createdAt: now,
      summary: `Provisioned ${args.role}${args.sensitivePublishing ? " with sensitive publishing" : ""} for ${args.userId}; grants ${grantIds.join(",")}; expires ${args.expiresAt}; ${args.reason}`,
    });
    return { grantIds };
  },
});

export const revoke = internalMutation({
  args: revokeSiteAccessArgs,
  returns: revokeResult,
  handler: async (ctx, args) => {
    const { operator } = await operatorForSchool(ctx, args);
    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.schoolId !== args.schoolId || !("provisioningSource" in grant) ||
        grant.provisioningSource !== "site_operator") return deny();
    const user = await ctx.db.get(grant.userId);
    if (!user || user.authId === operator.authId) return deny();
    if (grant.revokedAt !== undefined) return { revoked: false };
    const now = Date.now();
    await ctx.db.patch(grant._id, { revokedAt: now, revokedByPlatformAdminId: operator.adminId });
    await ctx.db.insert("schoolSiteAuditEvents", {
      schoolId: args.schoolId, actorPlatformAdminId: operator.adminId,
      eventType: "grant_changed", outcome: "success", createdAt: now,
      summary: `Revoked operational grant ${args.grantId} for ${grant.userId}; ${args.reason}`,
    });
    return { revoked: true };
  },
});
