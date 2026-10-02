import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { checkedContent, deny, ownedProfile, schoolActor, validatePublication, sha256, fieldValueDigest } from "./shared";
import type { PreviewSiteV1 } from "@school/shared/site-manifests";

export const validateDraftAtTime = internalQuery({
  args: { schoolId: v.id("schools"), now: v.number() },
  handler: async (ctx, {schoolId, now}) => {
    const actor = await schoolActor(ctx, schoolId, "site.preview", now);
    const profile = await ownedProfile(ctx, schoolId);
    const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (!draft || draft.schoolId !== schoolId || draft.state !== "draft") return deny();
    try { await validatePublication(ctx, profile, draft.content, actor, now); return {valid: true, draftVersion: draft.expectedDraftVersion}; }
    catch { return {valid: false, draftVersion: draft.expectedDraftVersion}; }
  },
});
export const candidateAtTime = internalQuery({
  args: {schoolId: v.id("schools"), fieldId: v.string(), now: v.number()},
  handler: async (ctx, {schoolId,fieldId,now}) => {
    await schoolActor(ctx,schoolId,"privacy.approve",now);
    const profile = await ownedProfile(ctx,schoolId);
    const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (!draft || draft.schoolId !== schoolId || draft.state !== "draft") return deny();
    const manifest = checkedContent(profile,draft.content);
    const def = manifest.fields.find(f => f.fieldId === fieldId);
    const field = draft.content.fields.find(f => f.fieldId === fieldId);
    if (!def?.evidence || !field) return deny();
    return {fieldId, value: field.value, evidenceClass: def.evidence, digest: await sha256(fieldValueDigest(field.value))};
  },
});
export const previewAtTime = internalQuery({
  args: { schoolId: v.id("schools"), now: v.number() },
  handler: async (ctx, {schoolId, now}): Promise<PreviewSiteV1 & {draftVersion: number}> => {
    await schoolActor(ctx, schoolId, "site.preview", now);
    const profile = await ownedProfile(ctx, schoolId);
    const draft = profile.draftRevisionId ? await ctx.db.get(profile.draftRevisionId) : null;
    if (!draft || draft.schoolId !== schoolId || draft.state !== "draft") return deny();
    checkedContent(profile, draft.content);
    return {
      status: "preview", watermark: "Draft - not public", robots: "noindex,nofollow", canonical: null, sitemap: null, draftVersion: draft.expectedDraftVersion,
      fields: draft.content.fields.map(({fieldId,value}) => ({fieldId, value: value.kind === "asset_ref" ? {kind: "asset_placeholder" as const, message: "Asset approval required"} : value})),
      routeSeo: draft.content.routeSeo.map(({routeId,title,description}) => ({routeId,title,description})),
    };
  },
});
