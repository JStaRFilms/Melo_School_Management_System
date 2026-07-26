import { internalMutation, mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { audit, requireStaffScope } from "./helpers";

const conversionResult = v.object({ conversionId: v.id("admissionsConversions"), studentId: v.union(v.id("students"), v.null()), state: v.string(), replayed: v.boolean() });

/**
 * Server-authorized, transactional conversion. A successful response is the
 * durable ledger result; a retry never manufactures another canonical child.
 */
export const executeAcceptedConversion = mutation({
  args: { applicationId: v.id("admissionsApplications"), classId: v.id("classes"), admissionNumber: v.string(), familyId: v.optional(v.id("families")), existingStudentId: v.optional(v.id("students")), photoDocumentId: v.optional(v.id("admissionsDocuments")), idempotencyKey: v.string() },
  returns: conversionResult,
  handler: async (ctx, args) => {
    const application = await ctx.db.get(args.applicationId);
    if (!application || !application.currentDecisionId || !application.latestSnapshotId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "conversions.execute" });
    const [decision, hold, existing] = await Promise.all([
      ctx.db.get(application.currentDecisionId),
      ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique(),
      ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
    ]);
    if (!decision || decision.schoolId !== application.schoolId || decision.state !== "accepted" || application.state !== "accepted" || hold || application.financeBlockedReason) throw new ConvexError(hold || application.financeBlockedReason ? "FINANCE_HOLD" : "CONVERSION_RESOLUTION_REQUIRED");
    if (existing) {
      if (existing.state === "succeeded") return { conversionId: existing._id, studentId: existing.studentId ?? null, state: existing.state, replayed: true };
      throw new ConvexError("CONVERSION_RECOVERY_REQUIRED");
    }
    const classDoc = await ctx.db.get(args.classId);
    const admissionNumber = args.admissionNumber.trim();
    if (!classDoc || classDoc.schoolId !== application.schoolId || classDoc.isArchived || !admissionNumber || !args.idempotencyKey.trim()) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const duplicate = await ctx.db.query("students").withIndex("by_school_and_admission_number", (q) => q.eq("schoolId", application.schoolId).eq("admissionNumber", admissionNumber)).unique();
    if (duplicate && duplicate._id !== args.existingStudentId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const [guardian, snapshot] = await Promise.all([ctx.db.get(application.guardianId), ctx.db.get(application.latestSnapshotId)]);
    if (!guardian || !snapshot) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const profileItem = await ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshot._id).eq("itemKey", "profile")).unique();
    if (!profileItem) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    let profile: { firstName: string; lastName: string; dateOfBirth: number; gender?: string };
    try { profile = JSON.parse(profileItem.serializedValue); } catch { throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); }
    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const now = Date.now();

    // Identity resolution is school-only and deliberately rejects ambiguity.
    const identityMatches = (await ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", guardian.authTokenIdentifier)).take(100)).filter((user) => user.schoolId === application.schoolId && !user.isArchived);
    if (identityMatches.length > 1 || identityMatches.some((user) => user.role !== "parent")) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    // Email likeness is never an identity resolver. Only the authenticated token bridge
    // may reuse a parent; otherwise this conversion creates a distinct parent record.
    const identityParent = identityMatches[0] ?? null;
    const parentUserId = identityParent?._id ?? await ctx.db.insert("users", { schoolId: application.schoolId, authId: guardian.betterAuthUserId ?? guardian.authTokenIdentifier, authTokenIdentifier: guardian.authTokenIdentifier, name: guardian.normalizedEmail, email: guardian.normalizedEmail, role: "parent", createdAt: now, updatedAt: now });

    let familyId = args.familyId;
    if (familyId) {
      const [family, link] = await Promise.all([ctx.db.get(familyId), ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique()]);
      if (!family || family.schoolId !== application.schoolId || !link || link.schoolId !== application.schoolId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    } else {
      const links = await ctx.db.query("familyMembers").withIndex("by_parent_user", (q) => q.eq("parentUserId", parentUserId)).take(100);
      const candidates = links.filter((link) => link.schoolId === application.schoolId).map((link) => link.familyId);
      if (candidates.length > 1) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
      familyId = candidates[0] ?? await ctx.db.insert("families", { schoolId: application.schoolId, name: `${profile.lastName.trim()} Family`, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });
    }
    const familyLink = await ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique();
    if (!familyLink) await ctx.db.insert("familyMembers", { schoolId: application.schoolId, familyId: familyId!, parentUserId, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });

    let photo: any = null;
    if (args.photoDocumentId) {
      photo = await ctx.db.get(args.photoDocumentId);
      const manifest = photo && await ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshot._id).eq("itemKey", `document:${photo.documentKey}`)).unique();
      if (!photo || !manifest || photo.schoolId !== application.schoolId || photo.applicationId !== application._id || photo.state !== "accepted" || photo.category !== "photo") throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    }
    const photoFields = photo ? { photoStorageId: photo.storageId, photoFileName: photo.fileName, photoContentType: photo.mimeType, photoUpdatedAt: now, photoProvenance: "application_upload" as const, photoSourceDocumentId: photo._id, photoRetentionHold: true } : {};
    let studentId = args.existingStudentId;
    let studentUserId: any;
    if (studentId) {
      const student = await ctx.db.get(studentId);
      if (!student || student.schoolId !== application.schoolId || student.isArchived) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
      studentUserId = student.userId;
      await ctx.db.patch(studentId, { classId: classDoc._id, familyId, admissionNumber, ...photoFields, sourceApplicationId: application._id, updatedAt: now });
    } else {
      studentUserId = await ctx.db.insert("users", { schoolId: application.schoolId, authId: `student:${String(application.schoolId)}:${admissionNumber.toLowerCase()}`, name: `${profile.firstName.trim()} ${profile.lastName.trim()}`, firstName: profile.firstName.trim(), lastName: profile.lastName.trim(), email: `${admissionNumber.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}@students.local`, role: "student", createdAt: now, updatedAt: now });
      studentId = await ctx.db.insert("students", { schoolId: application.schoolId, classId: classDoc._id, userId: studentUserId, familyId, admissionNumber, ...(profile.gender ? { gender: profile.gender } : {}), dateOfBirth: profile.dateOfBirth, ...photoFields, sourceApplicationId: application._id, createdAt: now, updatedAt: now });
    }
    if (photo) await ctx.db.patch(photo._id, { retentionHold: true, updatedAt: now });
    const conversionId = await ctx.db.insert("admissionsConversions", { schoolId: application.schoolId, applicationId: application._id, acceptedDecisionId: decision._id, snapshotId: snapshot._id, idempotencyKey: args.idempotencyKey.trim(), state: "succeeded", leaseOwner: "transactional", leaseExpiresAt: now, attemptCount: 1, parentUserId, studentUserId, classId: classDoc._id, admissionNumber, familyId, studentId, completedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.patch(application._id, { conversionId, updatedAt: now });
    await ctx.db.insert("admissionsConversionAttempts", { schoolId: application.schoolId, conversionId, attemptNumber: 1, workerKey: "transactional", outcome: "succeeded", startedAt: now, finishedAt: now, createdAt: now });
    // This row is written only in the committed conversion transaction and is deduped by the ledger key.
    const outbox = await ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", conversionId).eq("eventKey", "portal_onboarding")).unique();
    if (!outbox) await ctx.db.insert("admissionsCommunicationOutbox", { schoolId: application.schoolId, applicationId: application._id, conversionId, eventKey: "portal_onboarding", recipientGuardianId: guardian._id, channel: "email", templateKey: "admissions_portal_onboarding", templateVersion: "1", state: "pending", nextAttemptAt: now, createdAt: now, updatedAt: now });
    await audit({ ctx, schoolId: application.schoolId, actor: { kind: "staff", userId: membership.userId }, action: "conversion.succeeded", entityType: "conversion", entityId: String(conversionId), applicationId: application._id, outcome: "success" });
    return { conversionId, studentId, state: "succeeded", replayed: false };
  },
});

/** Internal, bounded recovery only marks an expired lease retryable; it never guesses a conversion result. */
export const recoverStaleLeases = internalMutation({
  args: { schoolId: v.id("schools"), staleBefore: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("admissionsConversions").withIndex("by_school_and_state_and_updated_at", (q) => q.eq("schoolId", args.schoolId).eq("state", "running")).take(Math.min(Math.max(args.limit, 1), 100));
    let recovered = 0;
    for (const row of rows) if ((row.leaseExpiresAt ?? row.updatedAt) <= args.staleBefore) {
      const now = Date.now();
      await ctx.db.patch(row._id, { state: "failed_retryable", errorCode: "STALE_LEASE", leaseExpiresAt: undefined, updatedAt: now });
      await ctx.db.insert("admissionsConversionAttempts", { schoolId: row.schoolId, conversionId: row._id, attemptNumber: (row.attemptCount ?? 0) + 1, workerKey: "stale_recovery", outcome: "retryable_failure", errorCode: "STALE_LEASE", startedAt: now, finishedAt: now, createdAt: now });
      recovered += 1;
    }
    return recovered;
  },
});
