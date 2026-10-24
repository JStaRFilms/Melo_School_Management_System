import { v } from "convex/values";
import type { Infer } from "convex/values";
import { admissionsPermissionValidator, capabilityScopeValidator } from "../foundation/contracts";

export const siteAccessRole = v.union(v.literal("editor"), v.literal("reviewer"), v.literal("publisher"), v.literal("domain_requester"));
export type SiteAccessRole = Infer<typeof siteAccessRole>;

export const siteAccessCapabilities = {
  editor: ["settings.view", "settings.manage", "site.preview"],
  reviewer: ["settings.view", "privacy.approve", "site.preview"],
  publisher: ["settings.view", "site.preview", "site.publish.standard"],
  domain_requester: ["site.domain.request"],
} as const;

const grantFields = {
  schoolId: v.id("schools"),
  userId: v.id("users"),
  capability: admissionsPermissionValidator,
  scope: capabilityScopeValidator,
  programmeId: v.optional(v.id("admissionsProgrammes")),
  intakeId: v.optional(v.id("admissionsIntakes")),
  reason: v.string(),
  expiresAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  revokedByUserId: v.optional(v.id("users")),
  isBreakGlass: v.boolean(),
  createdAt: v.number(),
};

// Preserve school-issued rows while requiring truthful operational provenance.
export const schoolCapabilityGrantValidator = v.union(
  v.object({ ...grantFields, grantedByUserId: v.id("users") }),
  v.object({
    ...grantFields,
    scope: v.literal("school"),
    programmeId: v.optional(v.null()),
    intakeId: v.optional(v.null()),
    provisioningSource: v.literal("site_operator"),
    siteAccessRole,
    grantedByPlatformAdminId: v.id("platformAdmins"),
    revokedByPlatformAdminId: v.optional(v.id("platformAdmins")),
    expiresAt: v.number(),
    isBreakGlass: v.literal(true),
  }),
);

const operationFields = {
  schoolId: v.id("schools"),
  confirmation: v.string(),
  reason: v.string(),
};
export const provisionSiteAccessArgs = {
  ...operationFields,
  userId: v.id("users"),
  role: siteAccessRole,
  sensitivePublishing: v.boolean(),
  expiresAt: v.number(),
};
export const revokeSiteAccessArgs = {
  ...operationFields,
  grantId: v.id("schoolCapabilityGrants"),
};
export const siteAccessRequest = v.union(
  v.object({ operation: v.literal("provision"), ...provisionSiteAccessArgs }),
  v.object({ operation: v.literal("revoke"), ...revokeSiteAccessArgs }),
);
