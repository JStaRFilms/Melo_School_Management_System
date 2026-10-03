import { v } from "convex/values";
import { mutation, action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { SiteFieldValueV1, SiteEvidenceClass } from "@school/shared/site-manifests";
import { assetSubject, checkedContent, deny, fieldValueDigest, ownedProfile, schoolActor, sha256, storageDigest } from "./shared";

export const getFieldCandidate = action({
  args: {schoolId: v.id("schools"), fieldId: v.string()},
  handler: async (ctx, {schoolId,fieldId}): Promise<{fieldId: string; value: SiteFieldValueV1; evidenceClass: SiteEvidenceClass; digest: string}> =>
    ctx.runQuery(internal.functions.sites.reads.candidateAtTime, {schoolId,fieldId,now: Date.now()}),
});

export const approveCandidate = mutation({
  args: { schoolId: v.id("schools"), candidate: v.union(
    v.object({kind: v.literal("field"), fieldId: v.string(), expectedDigest: v.string()}),
    v.object({kind: v.literal("asset_rights"), assetId: v.id("schoolSiteAssets"), expectedChecksum: v.string()}),
    v.object({kind: v.literal("asset_child_applicability"), assetId: v.id("schoolSiteAssets"), expectedChecksum: v.string(), classification: v.union(v.literal("no_children"), v.literal("contains_children"))}),
    v.object({kind: v.literal("asset_child_consent"), assetId: v.id("schoolSiteAssets"), expectedChecksum: v.string()}),
  ), evidenceReference: v.string(), expiresAt: v.number(), confirmed: v.boolean() },
  handler: async (ctx, {schoolId, candidate, evidenceReference, expiresAt, confirmed}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "privacy.approve", now);
    if (!confirmed || expiresAt <= now || expiresAt > now + 366 * 86400_000 || evidenceReference.length < 8 || evidenceReference.length > 500 || /[<>\u0000-\u001f]/.test(evidenceReference)) return deny();
    let subjectType: string, subjectKey: string, approvalClass: "identity" | "sensitive_public" | "privacy";
    let storedReference = evidenceReference;
    if (candidate.kind === "field") {
      const profile = await ownedProfile(ctx, schoolId);
      const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
      if (!draft || draft.schoolId !== schoolId || draft.state !== "draft") return deny();
      const manifest = checkedContent(profile, draft.content);
      const def = manifest.fields.find(f => f.fieldId === candidate.fieldId);
      const field = draft.content.fields.find(f => f.fieldId === candidate.fieldId);
      if (!def?.evidence || !field || !/^[a-f0-9]{64}$/.test(candidate.expectedDigest)) return deny();
      const school = await ctx.db.get(schoolId);
      if (candidate.fieldId === "school_name" && (!school || field.value.kind !== "text" || field.value.value !== school.name)) return deny();
      const digest = await sha256(fieldValueDigest(field.value));
      if (digest !== candidate.expectedDigest) return deny();
      subjectType = "site_content";
      subjectKey = `v1:${manifest.rendererKey}:${manifest.schemaVersion}:${def.fieldId}:${digest}`;
      approvalClass = def.evidence;
    } else {
      const asset = await ctx.db.get(candidate.assetId);
      if (!asset || asset.schoolId !== schoolId || asset.uploadProvenance !== "website_direct_upload_v1" || asset.status === "retired" || asset.checksum !== candidate.expectedChecksum) return deny();
      const metadata = await ctx.db.system.get("_storage", asset.storageId);
      if (!metadata || storageDigest(metadata.sha256) !== asset.checksum || metadata.size !== asset.byteSize) return deny();
      subjectType = `site_${candidate.kind}`;
      subjectKey = assetSubject(asset);
      approvalClass = "privacy";
      if (candidate.kind === "asset_child_applicability") {
        storedReference = `${candidate.classification}: ${evidenceReference}`;
        await ctx.db.patch(asset._id, {childApplicability: candidate.classification, ...(asset.childApplicability !== candidate.classification ? {childConsentEvidenceId: undefined} : {}), updatedAt: now});
      }
      if (candidate.kind === "asset_child_consent" && asset.childApplicability !== "contains_children") return deny();
    }
    const id = await ctx.db.insert("schoolApprovalEvidence", {schoolId, subjectType, subjectKey, approvalClass, evidenceReference: storedReference, approvedByUserId: actor, approvedAt: now, expiresAt, createdAt: now});
    if (candidate.kind === "asset_rights") await ctx.db.patch(candidate.assetId, {approvalEvidenceId: id, rightsStatus: "approved", rightsExpiresAt: expiresAt, updatedAt: now});
    if (candidate.kind === "asset_child_consent") await ctx.db.patch(candidate.assetId, {childConsentEvidenceId: id, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "evidence_recorded", outcome: "success", summary: `Approved ${candidate.kind}`, createdAt: now});
    return {evidenceId: id, subjectKey};
  },
});

export const revokeEvidence = mutation({
  args: {schoolId: v.id("schools"), evidenceId: v.id("schoolApprovalEvidence")},
  handler: async (ctx, {schoolId, evidenceId}) => {
    const now = Date.now();
    const actor = await schoolActor(ctx, schoolId, "privacy.approve", now);
    const evidence = await ctx.db.get(evidenceId);
    if (!evidence || evidence.schoolId !== schoolId || !evidence.subjectType.startsWith("site_") || evidence.revokedAt) return deny();
    await ctx.db.patch(evidenceId, {revokedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorUserId: actor, eventType: "evidence_recorded", outcome: "success", summary: "Revoked site evidence", createdAt: now});
    return null;
  },
});
