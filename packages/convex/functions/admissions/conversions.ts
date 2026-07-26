import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { audit, requireStaffScope } from "./helpers";

export const executeAcceptedConversion = mutation({
  args: { applicationId: v.id("admissionsApplications"), classId: v.id("classes"), admissionNumber: v.string(), familyId: v.optional(v.id("families")), photoDocumentId: v.optional(v.id("admissionsDocuments")), idempotencyKey: v.string() },
  returns: v.object({ conversionId: v.id("admissionsConversions"), studentId: v.union(v.id("students"), v.null()), state: v.string(), replayed: v.boolean() }),
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application || !application.currentDecisionId || !application.latestSnapshotId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "conversions.execute" });
    const decision = await ctx.db.get(application.currentDecisionId);
    if (!decision || decision.schoolId !== application.schoolId || decision.state !== "accepted") throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const existing = await ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique();
    if (existing) return { conversionId: existing._id, studentId: existing.studentId ?? null, state: existing.state, replayed: true };
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc || classDoc.schoolId !== application.schoolId || classDoc.isArchived) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const admissionNumber = args.admissionNumber.trim(); if (!admissionNumber || !args.idempotencyKey.trim()) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const duplicate = await ctx.db.query("students").withIndex("by_school_and_admission_number", (q) => q.eq("schoolId", application.schoolId).eq("admissionNumber", admissionNumber)).unique();
    if (duplicate) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const [guardian, snapshot] = await Promise.all([ctx.db.get(application.guardianId), ctx.db.get(application.latestSnapshotId)]);
    if (!guardian || !snapshot) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const profileItem = await ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshot._id).eq("itemKey", "profile")).unique();
    if (!profileItem) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    let profile: { firstName: string; lastName: string; dateOfBirth: number; gender?: string };
    try { profile = JSON.parse(profileItem.serializedValue); } catch { throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); }
    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const now = Date.now();
    const parentByIdentity = (await ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", guardian.authTokenIdentifier)).take(100)).find((user) => user.schoolId === application.schoolId) ?? null;
    if (parentByIdentity && parentByIdentity.role !== "parent") throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const parentByEmail = parentByIdentity ? null : await ctx.db.query("users").withIndex("by_school_and_email", (q) => q.eq("schoolId", application.schoolId).eq("email", guardian.normalizedEmail)).unique();
    if (parentByEmail && (parentByEmail.role !== "parent" || parentByEmail.authTokenIdentifier !== guardian.authTokenIdentifier)) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const parentUserId = parentByIdentity?._id ?? parentByEmail?._id ?? await ctx.db.insert("users", { schoolId: application.schoolId, authId: guardian.betterAuthUserId ?? guardian.authTokenIdentifier, authTokenIdentifier: guardian.authTokenIdentifier, name: guardian.normalizedEmail, email: guardian.normalizedEmail, role: "parent", createdAt: now, updatedAt: now });
    let familyId = args.familyId;
    if (familyId) {
      const [family, existingLink] = await Promise.all([
        ctx.db.get(familyId),
        ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique(),
      ]);
      if (!family || family.schoolId !== application.schoolId || !existingLink || existingLink.schoolId !== application.schoolId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    }
    if (!familyId) familyId = await ctx.db.insert("families", { schoolId: application.schoolId, name: `${profile.lastName.trim()} Family`, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });
    const link = await ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique();
    if (!link) await ctx.db.insert("familyMembers", { schoolId: application.schoolId, familyId: familyId!, parentUserId, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });
    let photo: any = null;
    if (args.photoDocumentId) { photo = await ctx.db.get(args.photoDocumentId); if (!photo || photo.schoolId !== application.schoolId || photo.applicationId !== application._id || photo.state !== "accepted") throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); }
    const studentUserId = await ctx.db.insert("users", { schoolId: application.schoolId, authId: `student:${String(application.schoolId)}:${admissionNumber.toLowerCase()}`, name: `${profile.firstName.trim()} ${profile.lastName.trim()}`, firstName: profile.firstName.trim(), lastName: profile.lastName.trim(), email: `${admissionNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@students.local`, role: "student", createdAt: now, updatedAt: now });
    const studentId = await ctx.db.insert("students", { schoolId: application.schoolId, classId: classDoc._id, userId: studentUserId, familyId, admissionNumber, ...(profile.gender ? { gender: profile.gender } : {}), dateOfBirth: profile.dateOfBirth, ...(photo ? { photoStorageId: photo.storageId, photoFileName: photo.fileName, photoContentType: photo.mimeType, photoUpdatedAt: now, photoProvenance: "application_upload" as const, photoSourceDocumentId: photo._id, photoRetentionHold: true } : {}), sourceApplicationId: application._id, createdAt: now, updatedAt: now });
    if (photo) await ctx.db.patch(photo._id, { retentionHold: true, updatedAt: now });
    const conversionId = await ctx.db.insert("admissionsConversions", { schoolId: application.schoolId, applicationId: application._id, acceptedDecisionId: decision._id, snapshotId: snapshot._id, idempotencyKey: args.idempotencyKey.trim(), state: "succeeded", classId: classDoc._id, admissionNumber, familyId, studentId, completedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.patch(application._id, { conversionId, updatedAt: now });
    await ctx.db.insert("admissionsConversionAttempts", { schoolId: application.schoolId, conversionId, attemptNumber: 1, workerKey: "inline", outcome: "succeeded", startedAt: now, finishedAt: now, createdAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "conversion.succeeded", entityType: "conversion", entityId: String(conversionId), applicationId: application._id, outcome: "success" });
    return { conversionId, studentId, state: "succeeded", replayed: false };
  },
});
