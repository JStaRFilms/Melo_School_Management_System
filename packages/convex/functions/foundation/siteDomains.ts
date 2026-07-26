import { ConvexError, v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireSchoolCapabilityV1, resolveSchoolMembershipV1 } from "./auth";

function normalizeHostname(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(normalized) ? normalized : null;
}

async function requireDomainPublisher(ctx: Parameters<typeof resolveSchoolMembershipV1>[0], schoolId: Parameters<typeof resolveSchoolMembershipV1>[1]) {
  const membership = await resolveSchoolMembershipV1(ctx, schoolId);
  if (!membership) throw new ConvexError("Not found or access denied");
  await requireSchoolCapabilityV1(ctx, membership, "site.domain.request");
  return membership;
}

/** Transactional hostname claim: a hostname can never be silently reused by another tenant. */
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

/** Selects the one active canonical domain and turns every other active host into a bound alias. */
export const setCanonicalDomain = mutation({
  args: { schoolId: v.id("schools"), domainId: v.id("schoolDomains") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const membership = await requireDomainPublisher(ctx, args.schoolId);
    const selected = await ctx.db.get(args.domainId);
    if (!selected || selected.schoolId !== args.schoolId || selected.surface !== "public" || selected.status !== "active") throw new ConvexError("Active school domain not found");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique();
    if (!profile || profile.mode !== "managed") throw new ConvexError("Managed site profile not found");
    const active = await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", (q) => q.eq("schoolId", args.schoolId).eq("surface", "public").eq("status", "active")).take(20);
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
