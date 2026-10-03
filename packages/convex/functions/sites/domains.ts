import { v } from "convex/values";
import type { MutationCtx } from "../../_generated/server";
import { mutation, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { getAuthenticatedPlatformAdmin } from "../platform/auth";
import { schoolActor, deny, ownedProfile, validatePublication, sha256 } from "./shared";
import { normalizeHostname, CHALLENGE_MS, currentProjectId, gatewayConfigured, ready } from "./domainRules";

const id = v.id("schoolDomains");
const audit = async (ctx: MutationCtx, schoolId: Parameters<typeof schoolActor>[1], operator: {adminId: import("../../_generated/dataModel").Id<"platformAdmins">}, summary: string, now: number) => {
  await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorPlatformAdminId: operator.adminId, eventType: "domain_changed", outcome: "success", summary, createdAt: now});
};
export const requestDomain = mutation({
  args: {schoolId: v.id("schools"), hostname: v.string(), canonicalIntent: v.union(v.literal("canonical"), v.literal("redirect"))},
  handler: async (ctx, args) => {
    const now = Date.now(); const actor = await schoolActor(ctx, args.schoolId, "site.domain.request", now);
    await ownedProfile(ctx, args.schoolId);
    const hostname = normalizeHostname(args.hostname);
    if (await ctx.db.query("schoolDomains").withIndex("by_hostname", q => q.eq("hostname", hostname)).take(2).then(rows => rows.length)) return deny();
    const token = crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID();
    const value = `school-site-v1=${token}`;
    const domainId = await ctx.db.insert("schoolDomains", {schoolId: args.schoolId, hostname, surface: "public", kind: "custom_domain", status: "verification_pending", canonicalIntent: args.canonicalIntent, ownership: "school_managed_dns", verificationTokenHash: await sha256(value), verificationRecordName: `_school-site-verify.${hostname}`, verificationRecordValue: value, verificationIssuedAt: now, verificationExpiresAt: now + CHALLENGE_MS, verificationGeneration: 1, nextVerificationCheckAt: now, createdAt: now, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId: args.schoolId, actorUserId: actor, eventType: "domain_changed", outcome: "success", summary: "Requested custom hostname", createdAt: now});
    return {domainId, hostname, recordName: `_school-site-verify.${hostname}`, recordValue: value, expiresAt: now + CHALLENGE_MS};
  },
});
export const getInstructions = mutation({
  args: {schoolId: v.id("schools"), domainId: id},
  handler: async (ctx, args) => {
    await schoolActor(ctx,args.schoolId,"site.domain.request",Date.now());
    const d = await ctx.db.get(args.domainId);
    if (!d || d.schoolId !== args.schoolId || d.status === "retired") return deny();
    return {hostname: d.hostname, status: d.status, recordName: d.verificationRecordName ?? null, recordValue: d.verificationExpiresAt && d.verificationExpiresAt > Date.now() ? d.verificationRecordValue ?? null : null, expiresAt: d.verificationExpiresAt ?? null, renewalRequired: !d.verificationExpiresAt || d.verificationExpiresAt <= Date.now() + 7 * 86_400_000};
  },
});
export const rotateChallenge = mutation({
  args: {schoolId: v.id("schools"), domainId: id},
  handler: async (ctx, args) => {
    const now = Date.now(); const actor = await schoolActor(ctx,args.schoolId,"site.domain.request",now);
    const d = await ctx.db.get(args.domainId);
    if (!d || d.schoolId !== args.schoolId || d.status === "retired" || d.status === "suspended" || d.providerOperation) return deny();
    const value = `school-site-v1=${crypto.randomUUID()}${crypto.randomUUID()}${crypto.randomUUID()}`;
    await ctx.db.patch(d._id, {verificationGeneration: (d.verificationGeneration ?? 0) + 1, verificationTokenHash: await sha256(value), verificationRecordName: `_school-site-verify.${d.hostname}`, verificationRecordValue: value, verificationIssuedAt: now, verificationExpiresAt: now + CHALLENGE_MS, ownershipObservation: undefined, providerRoutingObservation: undefined, tlsObservation: undefined, status: "verification_pending", nextVerificationCheckAt: now, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId: args.schoolId, actorUserId: actor, eventType: "domain_changed", outcome: "success", summary: "Rotated hostname proof", createdAt: now});
    return {recordName: `_school-site-verify.${d.hostname}`, recordValue: value, expiresAt: now + CHALLENGE_MS};
  },
});
// Both operator actions and scheduled read-only checks take snapshots; the commit
// transaction rejects a late result after any rotation, suspension or reassignment.
export const snapshot = internalQuery({args: {domainId: id, operator: v.boolean(), now: v.number()}, handler: async (ctx, args) => {
  if (args.operator) await getAuthenticatedPlatformAdmin(ctx);
  const d = await ctx.db.get(args.domainId);
  if (!d || d.status === "retired" || d.status === "suspended" || d.providerOperation || !d.verificationTokenHash || !d.verificationRecordValue || !d.verificationRecordName || !d.verificationGeneration || !d.verificationExpiresAt || d.verificationExpiresAt <= args.now) return deny();
  return {hostname: d.hostname, generation: d.verificationGeneration, hash: d.verificationTokenHash, value: d.verificationRecordValue, name: d.verificationRecordName, startedAt: args.now};
}});
// Authorize both ends of an informational provider fetch without changing observations.
export const instructionsSnapshot = internalQuery({args: {domainId: id, now: v.number()}, handler: async (ctx,{domainId}) => {
  await getAuthenticatedPlatformAdmin(ctx);
  const d = await ctx.db.get(domainId);
  if (!d || d.status === "retired" || d.status === "suspended" || d.providerOperation || !d.verificationGeneration || !d.verificationTokenHash) return deny();
  return {hostname:d.hostname,generation:d.verificationGeneration,hash:d.verificationTokenHash};
}});
export const commitCheck = internalMutation({args: {domainId: id, hostname: v.string(), generation: v.number(), hash: v.string(), operator: v.boolean(), ownership: v.boolean(), projectId: v.string(), configuredBy: v.union(v.literal("A"),v.literal("CNAME")), fingerprint: v.string(), notAfter: v.number()}, handler: async (ctx, args) => {
  const operator = args.operator ? await getAuthenticatedPlatformAdmin(ctx) : null;
  const now = Date.now(); const d = await ctx.db.get(args.domainId);
  if (!d || !["verification_pending", "ready", "active", "routing_pending", "certificate_pending", "verified"].includes(d.status) || d.hostname !== args.hostname || d.verificationGeneration !== args.generation || d.verificationTokenHash !== args.hash || d.providerOperation || !d.verificationExpiresAt || d.verificationExpiresAt <= now || !args.ownership || args.projectId !== currentProjectId() || !/^[a-f0-9]{64}$/.test(args.fingerprint) || args.notAfter <= now + 86_400_000) return deny();
  await ctx.db.patch(d._id, {ownershipObservation: {generation: args.generation, tokenHash: args.hash, observedAt: now}, providerRoutingObservation: {generation: args.generation, observedAt: now, projectId: args.projectId, projectDomainVerified: true, misconfigured: false, configuredBy: args.configuredBy}, tlsObservation: {generation: args.generation, observedAt: now, leafFingerprintSha256: args.fingerprint, leafNotAfter: args.notAfter, deploymentProbeMatched: true}, status: d.status === "active" ? "active" : "ready", nextVerificationCheckAt: now + 5 * 60_000, updatedAt: now});
  if (operator) await audit(ctx, d.schoolId, operator, "Read-only hostname readiness check passed", now);
  return {ready: true as const, observedAt: now};
}});
export const failedCheck = internalMutation({args: {domainId: id, hostname: v.string(), generation: v.number(), hash: v.string(), startedAt: v.number()}, handler: async (ctx, args) => {
  const d = await ctx.db.get(args.domainId); const now = Date.now();
  if (d && !d.providerOperation && d.hostname === args.hostname && d.verificationGeneration === args.generation && d.verificationTokenHash === args.hash && d.status !== "suspended" && d.status !== "retired" && ![d.ownershipObservation?.observedAt, d.providerRoutingObservation?.observedAt, d.tlsObservation?.observedAt].some(at => at !== undefined && at > args.startedAt)) {
    await ctx.db.patch(d._id, {ownershipObservation: undefined, providerRoutingObservation: undefined, tlsObservation: undefined, nextVerificationCheckAt: now + 5 * 60_000, updatedAt: now});
  }
  return null;
}});
export const activateDomain = mutation({args: {domainId: id, canonicalDomainId: v.optional(id)}, handler: async (ctx, args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const now = Date.now(); const d = await ctx.db.get(args.domainId);
  if (!d || d.providerOperation || !gatewayConfigured() || !currentProjectId() || !ready(d, now, currentProjectId()!) || !["ready", "active"].includes(d.status)) return deny();
  const profile = await ownedProfile(ctx,d.schoolId);
  if (profile.status !== "published" || !profile.publishedRevisionId) return deny();
  const revision = await ctx.db.get(profile.publishedRevisionId);
  if (!revision || revision.schoolId !== d.schoolId || revision.state !== "published" || !revision.publishedByUserId || revision.rendererKey !== profile.rendererKey || revision.rendererSchemaVersion !== profile.rendererSchemaVersion) return deny();
  const validated = await validatePublication(ctx,profile,revision.content,revision.publishedByUserId,now);
  if (validated.digest !== revision.contentDigest) return deny();
  const active = await ctx.db.query("schoolDomains").withIndex("by_school_and_surface_and_status", q => q.eq("schoolId", d.schoolId).eq("surface", "public").eq("status", "active")).take(101);
  if (active.length > 100) return deny();
  if (d.canonicalIntent === "canonical") {
    if (args.canonicalDomainId || active.some(row => row.canonicalIntent === "canonical" && row._id !== d._id) || (profile.canonicalDomainId && profile.canonicalDomainId !== d._id)) return deny();
    await ctx.db.patch(profile._id,{canonicalDomainId: d._id,updatedAt: now});
    await ctx.db.patch(d._id,{canonicalDomainId: undefined,status: "active",updatedAt: now,nextVerificationCheckAt: now + 5 * 60_000});
  } else {
    const canonical = args.canonicalDomainId ? await ctx.db.get(args.canonicalDomainId) : null;
    if (!canonical || canonical.schoolId !== d.schoolId || canonical.status !== "active" || canonical.canonicalIntent !== "canonical" || profile.canonicalDomainId !== canonical._id || !ready(canonical,now,currentProjectId()!)) return deny();
    await ctx.db.patch(d._id,{canonicalDomainId: canonical._id,status: "active",updatedAt: now,nextVerificationCheckAt: now + 5 * 60_000});
  }
  await audit(ctx,d.schoolId,operator,"Activated public hostname",now);
  return {active: true as const};
}});
export const suspendDomain = mutation({args: {domainId: id}, handler: async (ctx, args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const d = await ctx.db.get(args.domainId); if (!d || d.status === "retired" || d.providerOperation) return deny();
  const now = Date.now(); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school",q => q.eq("schoolId",d.schoolId)).unique();
  if (profile?.canonicalDomainId === d._id) await ctx.db.patch(profile._id,{canonicalDomainId: undefined,updatedAt: now});
  await ctx.db.patch(d._id,{status: "suspended",verificationGeneration: (d.verificationGeneration ?? 0) + 1,ownershipObservation: undefined,providerRoutingObservation: undefined,tlsObservation: undefined,updatedAt: now});
  await audit(ctx,d.schoolId,operator,"Suspended public hostname",now); return null;
}});
export const retireDomain = mutation({args: {domainId: id}, handler: async (ctx,args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const d = await ctx.db.get(args.domainId); if (!d || d.status === "retired" || d.providerOperation) return deny();
  const now = Date.now(); const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school",q => q.eq("schoolId",d.schoolId)).unique();
  if (profile?.canonicalDomainId === d._id) await ctx.db.patch(profile._id,{canonicalDomainId: undefined,updatedAt: now});
  await ctx.db.patch(d._id,{status: "retired",verificationGeneration: (d.verificationGeneration ?? 0) + 1,verificationRecordValue: undefined,ownershipObservation: undefined,providerRoutingObservation: undefined,tlsObservation: undefined,updatedAt: now});
  await audit(ctx,d.schoolId,operator,"Retired public hostname",now); return null;
}});
// External POSTs cannot be rolled back. Reserve before the write. Interrupted
// actions leave a durable block until a read-only provider confirmation.
const operationArgs = {domainId: id, hostname: v.string(), generation: v.number(), hash: v.string(), operation: v.union(v.literal("attach"),v.literal("verify"))};
export const reserveProviderOperation = internalMutation({args: operationArgs, handler: async (ctx,args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const now = Date.now(); const d = await ctx.db.get(args.domainId);
  if (!d || d.providerOperation || d.hostname !== args.hostname || d.verificationGeneration !== args.generation || d.verificationTokenHash !== args.hash || !d.verificationExpiresAt || d.verificationExpiresAt <= now || d.status === "retired" || d.status === "suspended") return deny();
  // The external POST can change routing immediately. Invalidate old proofs and
  // pre-write check snapshots in this transaction; the TXT token itself stays valid.
  await ctx.db.patch(d._id,{providerOperation: {operation: args.operation,state: "in_flight",generation: args.generation,tokenHash: args.hash,startedAt: now,reconcileAfter: now + 30_000},verificationGeneration: args.generation + 1,ownershipObservation: undefined,providerRoutingObservation: undefined,tlsObservation: undefined,updatedAt: now});
  await audit(ctx,d.schoolId,operator,`Reserved provider ${args.operation} write`,now);
  return null;
}});
export const finishProviderOperation = internalMutation({args: {...operationArgs, confirmed: v.boolean()}, handler: async (ctx,args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const now = Date.now(); const d = await ctx.db.get(args.domainId);
  if (!d || d.hostname !== args.hostname || d.providerOperation?.generation !== args.generation || d.providerOperation.tokenHash !== args.hash || d.providerOperation.operation !== args.operation) return deny();
  await ctx.db.patch(d._id,{providerOperation: args.confirmed ? undefined : {...d.providerOperation,state: "uncertain"},updatedAt: now});
  await audit(ctx,d.schoolId,operator, args.confirmed ? `Provider ${args.operation} response confirmed` : `Provider ${args.operation} outcome uncertain; reconciliation required`,now);
  return null;
}});
export const markInterruptedProviderOperation = internalMutation({args: {domainId: id},handler: async (ctx,{domainId}) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const now = Date.now(); const d = await ctx.db.get(domainId);
  if (!d?.providerOperation || now < d.providerOperation.reconcileAfter) return deny();
  if (d.providerOperation.state === "uncertain") return null;
  await ctx.db.patch(d._id,{providerOperation:{...d.providerOperation,state:"uncertain"},updatedAt:now});
  await audit(ctx,d.schoolId,operator,"Provider write interrupted; read-only reconciliation required",now);
  return null;
}});
export const operationSnapshot = internalQuery({args: {domainId: id, now: v.number()},handler: async (ctx,{domainId,now}) => {
  await getAuthenticatedPlatformAdmin(ctx); const d = await ctx.db.get(domainId);
  if (!d || d.providerOperation?.state !== "uncertain" || now < d.providerOperation.reconcileAfter) return deny();
  return {hostname: d.hostname,generation: d.providerOperation.generation,hash: d.providerOperation.tokenHash,operation: d.providerOperation.operation};
}});
export const reconcileProviderOperation = internalMutation({args: operationArgs,handler: async (ctx,args) => {
  const operator = await getAuthenticatedPlatformAdmin(ctx); const now = Date.now(); const d = await ctx.db.get(args.domainId);
  if (!d || d.providerOperation?.state !== "uncertain" || d.hostname !== args.hostname || d.providerOperation.generation !== args.generation || d.providerOperation.tokenHash !== args.hash || d.providerOperation.operation !== args.operation || now < d.providerOperation.reconcileAfter) return deny();
  await ctx.db.patch(d._id,{providerOperation: undefined,updatedAt: now});
  await audit(ctx,d.schoolId,operator,`Provider ${args.operation} reconciled by read-only confirmation`,now);
  return null;
}});
// Bounded five-minute sweep. Overdue rows are retried in later batches; the public
// gate still denies at the 15-minute bound even if a job is late.
export const maintenance = internalMutation({args: {}, handler: async ctx => { const rows = await ctx.db.query("schoolDomains").withIndex("by_status_and_next_verification_check_at",q => q.eq("status","active").lte("nextVerificationCheckAt",Date.now())).take(20); for (const row of rows) await ctx.db.patch(row._id,{nextVerificationCheckAt: Date.now() + 5 * 60_000}); for (const row of rows) await ctx.scheduler.runAfter(0,internal.functions.sites.domainActions.maintenanceCheck,{domainId: row._id}); return rows.length; }});
