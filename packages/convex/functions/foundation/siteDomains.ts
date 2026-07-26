import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "../../_generated/server";
import { requireSchoolCapabilityV1, resolveSchoolMembershipV1 } from "./auth";

const MAX_ACTIVE_PUBLIC_DOMAINS = 20;
const domainStatusValidator = v.union(v.literal("requested"), v.literal("verification_pending"), v.literal("verified"), v.literal("routing_pending"), v.literal("certificate_pending"), v.literal("ready"), v.literal("active"));

function normalizeHostname(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized) ? normalized : null;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function secureToken(): string {
  const bytes = new Uint8Array(32); crypto.getRandomValues(bytes);
  return [...bytes].map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function requireDomainPublisher(ctx: Parameters<typeof resolveSchoolMembershipV1>[0], schoolId: Parameters<typeof resolveSchoolMembershipV1>[1]) {
  const membership = await resolveSchoolMembershipV1(ctx, schoolId);
  if (!membership) throw new ConvexError("Not found or access denied");
  await requireSchoolCapabilityV1(ctx, membership, "site.domain.request");
  return membership;
}

/** Transactional hostname claim: a normalized hostname can never cross tenant boundaries. */
export const requestDomain = mutation({
  args: { schoolId: v.id("schools"), hostname: v.string(), kind: v.union(v.literal("platform_subdomain"), v.literal("custom_domain"), v.literal("school_subdomain")), ownership: v.union(v.literal("school_managed_dns"), v.literal("platform_managed_dns")) },
  returns: v.id("schoolDomains"),
  handler: async (ctx, args) => {
    const membership = await requireDomainPublisher(ctx, args.schoolId);
    const hostname = normalizeHostname(args.hostname);
    if (!hostname) throw new ConvexError("Invalid hostname");
    const existing = await ctx.db.query("schoolDomains").withIndex("by_hostname", (q) => q.eq("hostname", hostname)).unique();
    if (existing) throw new ConvexError("Hostname is already claimed");
    const now = Date.now();
    const domainId = await ctx.db.insert("schoolDomains", { schoolId: args.schoolId, hostname, surface: "public", kind: args.kind, status: "requested", canonicalIntent: "redirect", ownership: args.ownership, createdAt: now, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "domain_changed", outcome: "success", summary: "Requested globally unique hostname", createdAt: now });
    return domainId;
  },
});

/** Starts DNS verification and returns a one-time proof value. Only its hash is persisted. */
export const beginDomainVerification = mutation({
  args: { schoolId: v.id("schools"), domainId: v.id("schoolDomains") },
  returns: v.object({ verificationToken: v.string() }),
  handler: async (ctx, args) => {
    const membership = await requireDomainPublisher(ctx, args.schoolId);
    const domain = await ctx.db.get(args.domainId);
    if (!domain || domain.schoolId !== args.schoolId || domain.status !== "requested") throw new ConvexError("Domain is not ready for verification");
    const verificationToken = secureToken(); const now = Date.now();
    await ctx.db.patch(domain._id, { status: "verification_pending", verificationTokenHash: await sha256(verificationToken), nextVerificationCheckAt: now, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "domain_changed", outcome: "success", summary: "Started domain ownership verification", createdAt: now });
    return { verificationToken };
  },
});

/** Trusted DNS/TLS worker only: moves a domain through verified → ready → active. */
export const advanceDomainLifecycleInternal = internalMutation({
  args: { domainId: v.id("schoolDomains"), nextStatus: domainStatusValidator, verificationToken: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) throw new ConvexError("Domain not found");
    const transitions: Record<string, readonly string[]> = {
      verification_pending: ["verified"], verified: ["routing_pending"], routing_pending: ["certificate_pending"], certificate_pending: ["ready"], ready: ["active"],
    };
    if (!transitions[domain.status]?.includes(args.nextStatus)) throw new ConvexError("Invalid domain lifecycle transition");
    if (args.nextStatus === "verified" && (!args.verificationToken || !domain.verificationTokenHash || await sha256(args.verificationToken) !== domain.verificationTokenHash)) throw new ConvexError("Domain ownership verification failed");
    const now = Date.now();
    if (args.nextStatus === "active") {
      const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", domain.schoolId)).unique();
      if (!profile || profile.mode !== "managed") throw new ConvexError("Managed site profile not found");
      const active = await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", domain.schoolId).eq("surface", "public").eq("status", "active")).take(MAX_ACTIVE_PUBLIC_DOMAINS + 1);
      const expected = profile.activePublicDomainCount;
      if (expected === undefined || active.length !== expected || expected >= MAX_ACTIVE_PUBLIC_DOMAINS) throw new ConvexError("Active domain count requires reconciliation");
      await ctx.db.patch(profile._id, { activePublicDomainCount: expected + 1, updatedAt: now });
    }
    await ctx.db.patch(domain._id, { status: args.nextStatus, ...(args.nextStatus === "verified" ? { nextVerificationCheckAt: undefined } : {}), updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: domain.schoolId, eventType: "domain_changed", outcome: "success", summary: `Advanced domain lifecycle to ${args.nextStatus}`, createdAt: now });
    return null;
  },
});

/** Selects exactly one active canonical domain and binds every bounded active alias to it. */
export const setCanonicalDomain = mutation({
  args: { schoolId: v.id("schools"), domainId: v.id("schoolDomains") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membership = await requireDomainPublisher(ctx, args.schoolId);
    const selected = await ctx.db.get(args.domainId);
    if (!selected || selected.schoolId !== args.schoolId || selected.surface !== "public" || selected.status !== "active") throw new ConvexError("Active school domain not found");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!profile || profile.mode !== "managed" || profile.activePublicDomainCount === undefined) throw new ConvexError("Managed site profile not found");
    const active = await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", args.schoolId).eq("surface", "public").eq("status", "active")).take(MAX_ACTIVE_PUBLIC_DOMAINS + 1);
    if (active.length === 0 || active.length > MAX_ACTIVE_PUBLIC_DOMAINS || active.length !== profile.activePublicDomainCount || !active.some((domain) => domain._id === selected._id)) throw new ConvexError("Active domain count requires reconciliation");
    const now = Date.now();
    for (const domain of active) {
      if (domain._id === selected._id) await ctx.db.patch(domain._id, { canonicalIntent: "canonical", canonicalDomainId: undefined, updatedAt: now });
      else await ctx.db.patch(domain._id, { canonicalIntent: "redirect", canonicalDomainId: selected._id, updatedAt: now });
    }
    await ctx.db.patch(profile._id, { canonicalDomainId: selected._id, updatedAt: now });
    await ctx.db.insert("schoolSiteAuditEvents", { schoolId: args.schoolId, actorUserId: membership.userId, eventType: "domain_changed", outcome: "success", summary: "Set one active canonical domain and bound active aliases", createdAt: now });
    return null;
  },
});
