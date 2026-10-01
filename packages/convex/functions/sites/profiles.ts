import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { getAuthenticatedPlatformAdmin } from "../platform/auth";
import { deny } from "./shared";
import { siteManifest } from "@school/shared/site-manifests";

export const provisionProfile = mutation({
  args: {schoolId: v.id("schools"), rendererKey: v.string(), rendererSchemaVersion: v.string()},
  handler: async (ctx, {schoolId,rendererKey,rendererSchemaVersion}) => {
    const operator = await getAuthenticatedPlatformAdmin(ctx);
    const school = await ctx.db.get(schoolId);
    if (!school || school.status !== "active" || !siteManifest(rendererKey,rendererSchemaVersion)) return deny();
    const existing = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId",schoolId)).unique();
    if (existing) return deny(); // Renderer changes require a separately reviewed migration.
    const now = Date.now();
    const profileId = await ctx.db.insert("schoolSiteProfiles", {schoolId, mode: "managed", status: "draft", rendererKey, rendererSchemaVersion, createdAt: now, updatedAt: now});
    await ctx.db.insert("schoolSiteAuditEvents", {schoolId, actorPlatformAdminId: operator.adminId, eventType: "domain_changed", outcome: "success", summary: "Provisioned managed site profile", createdAt: now});
    return {profileId};
  },
});
