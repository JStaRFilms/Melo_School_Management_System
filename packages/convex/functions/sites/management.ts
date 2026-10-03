import { v } from "convex/values";
import { action, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { SiteContentV1 } from "@school/shared/site-manifests";
type SchoolView = {
  canEdit: boolean;
  canRequestDomain: boolean;
  profile: { rendererKey?: string; rendererSchemaVersion?: string; status: string; publishedRevisionId?: Id<"schoolSiteRevisions"> } | null;
  draft: { content: SiteContentV1; version: number } | null;
  publications: { id: Id<"schoolSiteRevisions">; revisionNumber: number; publishedAt?: number; current: boolean }[];
  assets: { id: Id<"schoolSiteAssets">; kind: string; fileName: string; checksum: string; status: string; rightsStatus: string; rightsExpiresAt?: number; childApplicability: string; decorative: boolean; altText?: string }[];
  domains: { id: Id<"schoolDomains">; hostname: string; status: string; canonicalIntent: string; expiresAt?: number; renewalRequired: boolean }[];
};
type OperatorView = {
  school: { name: string; status?: string };
  profile: { rendererKey?: string; version?: string; status: string; published: boolean } | null;
  domains: { id: Id<"schoolDomains">; hostname: string; status: string; canonicalIntent: string; expiresAt: number | null; renewalRequired: boolean; ownershipObservedAt: number | null; routingObservedAt: number | null; tlsObservedAt: number | null; observationFresh: boolean; providerOperation: {operation:"attach"|"verify";state:"in_flight"|"uncertain";reconcileAfter:number} | null }[];
};
import { getAuthenticatedPlatformAdmin } from "../platform/auth";
import { schoolActor } from "./shared";

const schoolId = v.id("schools");

export const schoolView = action({
  args: { schoolId },
  handler: async (ctx, args): Promise<SchoolView> =>
    ctx.runQuery(internal.functions.sites.management.schoolViewAtTime, { ...args, now: Date.now() }),
});

export const schoolViewAtTime = internalQuery({
  args: { schoolId, now: v.number() },
  handler: async (ctx, { schoolId, now }) => {
    // This is a private management view; each operation still enforces its own capability.
    let fullAccess = false;
    for (const capability of ["settings.view", "settings.manage", "privacy.approve", "site.preview", "site.publish.standard"] as const) {
      try { await schoolActor(ctx, schoolId, capability, now); fullAccess = true; break; } catch { /* Try another school-wide site capability. */ }
    }
    let revertAccess = false;
    let domainAccess = false;
    if (!fullAccess) {
      try { await schoolActor(ctx, schoolId, "site.revert", now); revertAccess = true; } catch { /* Try another grant. */ }
    }
    try { await schoolActor(ctx, schoolId, "site.domain.request", now); domainAccess = true; } catch { /* No domain grant. */ }
    if (!fullAccess && !revertAccess && !domainAccess) throw Error("Site settings access denied");
    const canSeeHistory = fullAccess || revertAccess;
    const canSeeDomains = domainAccess;
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique();
    const draft = fullAccess && profile?.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    const publications = canSeeHistory ? await ctx.db.query("schoolSiteRevisions").withIndex("by_school_and_state_and_revision_number", q => q.eq("schoolId", schoolId).eq("state", "published")).order("desc").take(20) : [];
    const assets = fullAccess ? await ctx.db.query("schoolSiteAssets").withIndex("by_school", q => q.eq("schoolId", schoolId)).order("desc").take(30) : [];
    const domains = canSeeDomains ? await ctx.db.query("schoolDomains").withIndex("by_school", q => q.eq("schoolId", schoolId)).order("desc").take(30) : [];
    return {
      canEdit: fullAccess,
      canRequestDomain: canSeeDomains,
      profile: profile ? { rendererKey: profile.rendererKey, rendererSchemaVersion: profile.rendererSchemaVersion, status: profile.status, publishedRevisionId: canSeeHistory ? profile.publishedRevisionId : undefined } : null,
      draft: fullAccess && draft?.schoolId === schoolId && draft.state === "draft" ? { content: draft.content, version: draft.expectedDraftVersion } : null,
      publications: publications.map(r => ({ id: r._id, revisionNumber: r.revisionNumber, publishedAt: r.publishedAt, current: r._id === profile?.publishedRevisionId })),
      assets: assets.map(a => ({ id: a._id, kind: a.kind, fileName: a.fileName, checksum: a.checksum, status: a.status, rightsStatus: a.rightsStatus, rightsExpiresAt: a.rightsExpiresAt, childApplicability: a.childApplicability ?? "unknown", decorative: a.decorative, altText: a.altText })),
      domains: domains.map(d => ({ id: d._id, hostname: d.hostname, status: d.status, canonicalIntent: d.canonicalIntent, expiresAt: d.verificationExpiresAt, renewalRequired: !d.verificationExpiresAt || d.verificationExpiresAt <= now + 7 * 86_400_000 })),
    };
  },
});

export const operatorView = action({
  args: { schoolId },
  handler: async (ctx, args): Promise<OperatorView> =>
    ctx.runQuery(internal.functions.sites.management.operatorViewAtTime, { ...args, now: Date.now() }),
});

export const operatorViewAtTime = internalQuery({
  args: { schoolId, now: v.number() },
  handler: async (ctx, { schoolId, now }) => {
    await getAuthenticatedPlatformAdmin(ctx);
    const school = await ctx.db.get(schoolId);
    if (!school) throw Error("School not found");
    const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique();
    const domains = await ctx.db.query("schoolDomains").withIndex("by_school", q => q.eq("schoolId", schoolId)).order("desc").take(30);
    return { school: { name: school.name, status: school.status }, profile: profile ? { rendererKey: profile.rendererKey, version: profile.rendererSchemaVersion, status: profile.status, published: !!profile.publishedRevisionId } : null,
      domains: domains.map(d => ({ id: d._id, hostname: d.hostname, status: d.status, canonicalIntent: d.canonicalIntent, expiresAt: d.verificationExpiresAt ?? null, renewalRequired: !d.verificationExpiresAt || d.verificationExpiresAt <= now + 7 * 86_400_000,
        ownershipObservedAt: d.ownershipObservation?.observedAt ?? null, routingObservedAt: d.providerRoutingObservation?.observedAt ?? null, tlsObservedAt: d.tlsObservation?.observedAt ?? null, providerOperation: d.providerOperation ? {operation:d.providerOperation.operation,state:d.providerOperation.state,reconcileAfter:d.providerOperation.reconcileAfter} : null, observationFresh: !!(d.ownershipObservation && d.providerRoutingObservation && d.tlsObservation && d.verificationExpiresAt && d.verificationExpiresAt > now && [d.ownershipObservation.observedAt, d.providerRoutingObservation.observedAt, d.tlsObservation.observedAt].every(t => t > now - 15 * 60_000)) })),
    };
  },
});
