import { v, type Infer } from "convex/values";

const nameFields = [v.literal("firstName"), v.literal("middleName"), v.literal("lastName")] as const;
export const correctionScope = v.object({
  parentFields: v.array(v.union(...nameFields, v.literal("phone"), v.literal("address"))),
  parentMemberId: v.optional(v.id("familyMembers")),
  childId: v.optional(v.id("students")),
  childFields: v.array(v.union(...nameFields, v.literal("dateOfBirth"), v.literal("gender"), v.literal("address"))),
});
export type CorrectionScope = Infer<typeof correctionScope>;
const names = {
  firstName: v.optional(v.string()), middleName: v.optional(v.union(v.string(), v.null())), lastName: v.optional(v.string()),
};
export const correctionAddress = v.object({
  mode: v.union(v.literal("residential"), v.literal("different")), value: v.optional(v.string()),
});
export const correctionPayload = v.object({
  parent: v.optional(v.object({ ...names, phone: v.optional(v.union(v.string(), v.null())) })),
  parentAddress: v.optional(correctionAddress),
  child: v.optional(v.object({ ...names,
    dateOfBirth: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(v.union(v.literal("Male"), v.literal("Female"), v.null())),
    address: v.optional(correctionAddress),
  })),
});
export type CorrectionPayload = Infer<typeof correctionPayload>;
export const correctionState = v.union(v.literal("requested"), v.literal("granted"), v.literal("applied"), v.literal("rejected"), v.literal("revoked"));
export const correctionChange = v.object({
  target: v.union(v.literal("parent"), v.literal("parentAddress"), v.literal("child")),
  targetId: v.string(),
  field: v.union(...nameFields, v.literal("name"), v.literal("phone"), v.literal("dateOfBirth"), v.literal("gender"), v.literal("address")),
  before: v.union(v.string(), v.number(), v.null()), after: v.union(v.string(), v.number(), v.null()),
});
export type CorrectionChange = Infer<typeof correctionChange>;
export const correctionRequestFields = {
  schoolId: v.id("schools"), requesterUserId: v.id("users"),
  requesterPersonId: v.optional(v.id("persons")), requesterMembershipId: v.optional(v.id("branchMemberships")),
  requesterAuthId: v.string(), requesterTokenIdentifier: v.optional(v.string()),
  parentFamilyId: v.optional(v.id("families")), childFamilyId: v.optional(v.id("families")),
  childLinkId: v.optional(v.id("familyMembers")), childUserId: v.optional(v.id("users")),
  requestKey: v.string(), reason: v.string(), requestedScope: correctionScope,
  state: correctionState, revision: v.number(), draftRevision: v.number(),
  allowedScope: v.optional(correctionScope), baseline: v.optional(v.string()),
  draft: v.optional(correctionPayload),
  decisionBy: v.optional(v.id("users")), decisionReason: v.optional(v.string()),
  createdAt: v.number(), updatedAt: v.number(), lastSavedAt: v.optional(v.number()),
  applied: v.optional(v.object({ key: v.string(), reviewToken: v.string(), appliedAt: v.number(),
    grantRevision: v.number(), draftRevision: v.number(), changes: v.array(correctionChange),
  })),
};
