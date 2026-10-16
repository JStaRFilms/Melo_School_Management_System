import { v } from "convex/values";

export const staffEmploymentStatus = v.union(v.literal("active"), v.literal("departed"));
export const staffRole = v.union(v.literal("teacher"), v.literal("admin"), v.literal("staff"));
export const staffPermissionDecision = v.object({
  mode: v.union(v.literal("retain"), v.literal("replace")),
  displayTitle: v.string(),
  roleTemplateIds: v.array(v.id("roleTemplates")),
  grants: v.array(v.string()),
  restrictions: v.array(v.string()),
});
export const staffCompatibilityGrant = v.object({
  grantId: v.id("schoolCapabilityGrants"), capability: v.string(),
  scope: v.union(v.literal("school"), v.literal("programme"), v.literal("intake")),
  programmeId: v.optional(v.id("admissionsProgrammes")), intakeId: v.optional(v.id("admissionsIntakes")),
  expiresAt: v.optional(v.number()), revokedAt: v.optional(v.number()),
});
export const staffPermissionConfiguration = v.object({
  compatibilityGrants: v.array(staffCompatibilityGrant),
  displayTitle: v.string(),
  roleTemplateIds: v.array(v.id("roleTemplates")),
  grants: v.array(v.string()),
  restrictions: v.array(v.string()),
  ceiling: v.array(v.string()),
  effective: v.array(v.string()),
  legacyBaseline: v.boolean(),
});
export const staffServiceContext = {
  sessionId: v.optional(v.id("academicSessions")),
  sessionName: v.optional(v.string()),
  termId: v.optional(v.id("academicTerms")),
  termName: v.optional(v.string()),
};
