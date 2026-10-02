import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id, Doc } from "../../_generated/dataModel";
import { requireSchoolCapabilityV1, resolveSchoolMembershipV1 } from "../foundation/auth";
import type { AdmissionsPermissionV1 } from "@school/shared";
import { canonicalSiteContent, canonicalSiteFieldValue, siteManifest, validateSiteContent } from "@school/shared/site-manifests";
import type { SiteContentV1 } from "@school/shared/site-manifests";

export type SiteCtx = MutationCtx | QueryCtx;
export function deny(): never { throw new ConvexError("Not found or access denied"); }
export async function schoolActor(ctx: SiteCtx, schoolId: Id<"schools">, capability: AdmissionsPermissionV1, now: number) {
  const school = await ctx.db.get(schoolId);
  const membership = await resolveSchoolMembershipV1(ctx, schoolId);
  if (!school || school.status !== "active" || !membership) return deny();
  await requireSchoolCapabilityV1(ctx, membership, capability, {}, now);
  return membership.userId;
}
export async function ownedProfile(ctx: SiteCtx, schoolId: Id<"schools">) {
  const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId", schoolId)).unique();
  if (!profile || profile.mode !== "managed" || !profile.rendererKey || !profile.rendererSchemaVersion || !siteManifest(profile.rendererKey, profile.rendererSchemaVersion)) return deny();
  return profile;
}
export function checkedContent(profile: Doc<"schoolSiteProfiles">, content: SiteContentV1) {
  const manifest = siteManifest(profile.rendererKey ?? "", profile.rendererSchemaVersion ?? "");
  if (!manifest) return deny();
  validateSiteContent(content, manifest);
  return manifest;
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,"0")).join("");
}
export function fieldValueDigest(value: SiteContentV1["fields"][number]["value"]) { return canonicalSiteFieldValue(value); }
export function contentCanonical(content: SiteContentV1) { return canonicalSiteContent(content); }
// Site asset keys and persisted checksums use hex. Convex storage has returned
// both base64 and hex SHA-256 metadata across supported test/runtime versions.
export function storageDigest(value: string): string | null {
  if (/^[a-fA-F0-9]{64}$/.test(value)) return value.toLowerCase();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return null;
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length !== 32 || btoa(String.fromCharCode(...bytes)) !== value) return null;
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export function assetSubject(asset: Doc<"schoolSiteAssets">) { return `v1:${asset._id}:${asset.checksum}`; }
export async function currentEvidence(ctx: SiteCtx, schoolId: Id<"schools">, subjectType: string, subjectKey: string, approvalClass: Doc<"schoolApprovalEvidence">["approvalClass"], now: number, publisher?: Id<"users">, evidenceId?: Id<"schoolApprovalEvidence">, referencePrefix?: string) {
  const rows = await ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_subject_type_and_subject_key", q => q.eq("schoolId", schoolId).eq("subjectType", subjectType).eq("subjectKey", subjectKey)).take(101);
  if (rows.length > 100) return null;
  return rows.find(row => row.approvalClass === approvalClass && row.approvedByUserId && row.approvedByUserId !== publisher && (!evidenceId || row._id === evidenceId) && (!referencePrefix || row.evidenceReference.startsWith(referencePrefix)) && !row.revokedAt && row.expiresAt !== undefined && row.expiresAt > now) ?? null;
}
export async function approvedAsset(ctx: SiteCtx, schoolId: Id<"schools">, assetId: Id<"schoolSiteAssets">, kind: string, now: number, publisher: Id<"users">) {
  const asset = await ctx.db.get(assetId);
  if (!asset || asset.schoolId !== schoolId || asset.kind !== kind || asset.uploadProvenance !== "website_direct_upload_v1" || asset.rightsStatus !== "approved" || !asset.rightsExpiresAt || asset.rightsExpiresAt <= now || asset.status === "retired" || !asset.approvalEvidenceId || asset.childApplicability === "unknown" || !asset.childApplicability) return deny();
  const metadata = await ctx.db.system.get("_storage", asset.storageId);
  if (!metadata || storageDigest(metadata.sha256) !== asset.checksum || metadata.size !== asset.byteSize || (metadata.contentType !== undefined && metadata.contentType !== asset.mediaType)) return deny();
  const rights = await currentEvidence(ctx, schoolId, "site_asset_rights", assetSubject(asset), "privacy", now, publisher, asset.approvalEvidenceId);
  if (!rights) return deny();
  const assertions = await ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_subject_type_and_subject_key", q => q.eq("schoolId", schoolId).eq("subjectType", "site_asset_child_applicability").eq("subjectKey", assetSubject(asset))).order("desc").take(101);
  if (assertions.length > 100) return deny();
  // Latest explicit assertion for this classification wins. An older assertion
  // cannot silently revive after a changed classification or a revocation.
  const assertion = assertions.find(row => row.approvalClass === "privacy" && row.evidenceReference.startsWith(`${asset.childApplicability}: `));
  if (!assertion || assertion.approvedByUserId === publisher || assertion.revokedAt || !assertion.expiresAt || assertion.expiresAt <= now) return deny();
  if (asset.childApplicability === "contains_children") {
    if (!asset.childConsentEvidenceId) return deny();
    const consent = await currentEvidence(ctx, schoolId, "site_asset_child_consent", assetSubject(asset), "privacy", now, publisher, asset.childConsentEvidenceId);
    if (!consent) return deny();
  }
  return asset;
}
export async function validatePublication(ctx: SiteCtx, profile: Doc<"schoolSiteProfiles">, content: SiteContentV1, publisher: Id<"users">, now: number) {
  const manifest = checkedContent(profile, content);
  const evidenceIds: Id<"schoolApprovalEvidence">[] = [];
  const school = await ctx.db.get(profile.schoolId);
  if (!school || school.status !== "active") return deny();
  let sensitive = false;
  for (const {fieldId,value} of content.fields) {
    const def = manifest.fields.find(f => f.fieldId === fieldId)!;
    // The synthetic name must also agree with the school's persisted identity.
    // A reviewer cannot authorize an unrelated name by attaching a note alone.
    if (fieldId === "school_name" && (value.kind !== "text" || value.value !== school.name)) return deny();
    if (def.evidence) {
      const digest = await sha256(fieldValueDigest(value));
      const subject = `v1:${manifest.rendererKey}:${manifest.schemaVersion}:${fieldId}:${digest}`;
      const evidence = await currentEvidence(ctx, profile.schoolId, "site_content", subject, def.evidence, now, publisher);
      if (!evidence) return deny();
      evidenceIds.push(evidence._id);
      if (def.evidence === "sensitive_public") sensitive = true;
    }
    if (value.kind === "asset_ref") { await approvedAsset(ctx, profile.schoolId, value.assetId as Id<"schoolSiteAssets">, def.assetKind ?? "", now, publisher); sensitive = true; }
  }
  for (const seo of content.routeSeo) if (seo.shareAssetId) { await approvedAsset(ctx, profile.schoolId, seo.shareAssetId as Id<"schoolSiteAssets">, "social_share", now, publisher); sensitive = true; }
  return { evidenceIds, sensitive, digest: await sha256(contentCanonical(content)) };
}
