import { internalMutation, mutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { audit, requireStaffScope } from "./helpers";

const conversionResult = v.object({ conversionId: v.id("admissionsConversions"), studentId: v.union(v.id("students"), v.null()), state: v.string(), replayed: v.boolean() });

type ConversionResult = { conversionId: Id<"admissionsConversions">; studentId: Id<"students"> | null; state: string; replayed: boolean };

/** Persists the human identity/family/student decision before any canonical write. */
export const resolveConversion = mutation({
  args: { applicationId: v.id("admissionsApplications"), parentMode: v.union(v.literal("create"), v.literal("existing")), parentUserId: v.optional(v.id("users")), familyMode: v.union(v.literal("create"), v.literal("existing")), familyId: v.optional(v.id("families")), studentMode: v.union(v.literal("create"), v.literal("existing")), existingStudentId: v.optional(v.id("students")), reason: v.string() },
  returns: v.id("admissionsConversionResolutions"),
  handler: async (ctx, args): Promise<Id<"admissionsConversionResolutions">> => {
    const application = await ctx.db.get("admissionsApplications", args.applicationId); if (!application) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "conversions.execute" });
    const guardian = await ctx.db.get("admissionsGuardians", application.guardianId); if (!guardian || !args.reason.trim()) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const parent = args.parentUserId ? await ctx.db.get("users", args.parentUserId) : null; const family = args.familyId ? await ctx.db.get("families", args.familyId) : null; const student = args.existingStudentId ? await ctx.db.get("students", args.existingStudentId) : null;
    if ((args.parentMode === "existing") !== Boolean(parent) || (parent && (parent.schoolId !== application.schoolId || parent.role !== "parent" || parent.isArchived || parent.authTokenIdentifier !== guardian.authTokenIdentifier)) || (args.familyMode === "existing") !== Boolean(family) || (family && family.schoolId !== application.schoolId) || (args.studentMode === "existing") !== Boolean(student) || (student && (student.schoolId !== application.schoolId || student.isArchived || (student.sourceApplicationId && student.sourceApplicationId !== application._id)))) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const existing = await ctx.db.query("admissionsConversionResolutions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(); const now = Date.now();
    const row = { schoolId: application.schoolId, applicationId: application._id, parentMode: args.parentMode, ...(args.parentUserId ? { parentUserId: args.parentUserId } : {}), familyMode: args.familyMode, ...(args.familyId ? { familyId: args.familyId } : {}), studentMode: args.studentMode, ...(args.existingStudentId ? { existingStudentId: args.existingStudentId } : {}), guardianAuthTokenIdentifier: guardian.authTokenIdentifier, resolvedByUserId: membership.userId, reason: args.reason.trim().slice(0, 1_000), createdAt: existing?.createdAt ?? now, updatedAt: now };
    if (existing) { await ctx.db.replace(existing._id, row); return existing._id; } return await ctx.db.insert("admissionsConversionResolutions", row);
  },
});

/**
 * Server-authorized, transactional conversion. A successful response is the
 * durable ledger result; a retry never manufactures another canonical child.
 */
export const executeAcceptedConversion = mutation({
  args: { applicationId: v.id("admissionsApplications"), classId: v.id("classes"), admissionNumber: v.string(), familyId: v.optional(v.id("families")), existingStudentId: v.optional(v.id("students")), photoDocumentId: v.optional(v.id("admissionsDocuments")), idempotencyKey: v.string() },
  returns: conversionResult,
  handler: async (ctx, args): Promise<ConversionResult> => {
    const application = await ctx.db.get("admissionsApplications", args.applicationId);
    if (!application || !application.currentDecisionId || !application.latestSnapshotId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const membership = await requireStaffScope(ctx, { schoolId: application.schoolId, programmeId: application.programmeId, intakeId: application.intakeId, capability: "conversions.execute" });
    const [decision, hold, existing, resolution, studentFromApplication] = await Promise.all([
      ctx.db.get("admissionsDecisions", application.currentDecisionId),
      ctx.db.query("admissionsFinanceHolds").withIndex("by_application_and_state", (q) => q.eq("applicationId", application._id).eq("state", "active")).unique(),
      ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("admissionsConversionResolutions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique(),
      ctx.db.query("students").withIndex("by_source_application", (q) => q.eq("sourceApplicationId", application._id)).unique(),
    ]);
    if (!decision || decision.schoolId !== application.schoolId || decision.state !== "accepted" || application.state !== "accepted" || !resolution || resolution.guardianAuthTokenIdentifier.trim() === "" || hold || application.financeBlockedReason) throw new ConvexError(hold || application.financeBlockedReason ? "FINANCE_HOLD" : "CONVERSION_RESOLUTION_REQUIRED");
    if (existing) {
      if (existing.state === "succeeded") return { conversionId: existing._id, studentId: existing.studentId ?? null, state: existing.state, replayed: true };
      throw new ConvexError("CONVERSION_RECOVERY_REQUIRED");
    }
    if (studentFromApplication || resolution.familyId !== args.familyId || resolution.existingStudentId !== args.existingStudentId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const classDoc = await ctx.db.get("classes", args.classId);
    const admissionNumber = args.admissionNumber.trim();
    if (!classDoc || classDoc.schoolId !== application.schoolId || classDoc.isArchived || !admissionNumber || !args.idempotencyKey.trim()) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const duplicate = await ctx.db.query("students").withIndex("by_school_and_admission_number", (q) => q.eq("schoolId", application.schoolId).eq("admissionNumber", admissionNumber)).unique();
    if (duplicate && duplicate._id !== args.existingStudentId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const [guardian, snapshot] = await Promise.all([
      ctx.db.get("admissionsGuardians", application.guardianId),
      ctx.db.get("admissionsSubmissionSnapshots", application.latestSnapshotId),
    ]);
    if (!guardian || !snapshot) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const profileItem = await ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshot._id).eq("itemKey", "profile")).unique();
    if (!profileItem) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    let profile: { firstName: string; lastName: string; dateOfBirth: number; gender?: string };
    try { profile = JSON.parse(profileItem.serializedValue); } catch { throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); }
    if (!profile.firstName || !profile.lastName || !profile.dateOfBirth) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const now = Date.now();

    if (resolution.guardianAuthTokenIdentifier !== guardian.authTokenIdentifier) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    const identityMatches = (await ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", guardian.authTokenIdentifier)).take(100)).filter((user) => user.schoolId === application.schoolId && !user.isArchived);
    if (identityMatches.length > 1 || identityMatches.some((user) => user.role !== "parent")) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    let parentUserId = resolution.parentUserId;
    if (resolution.parentMode === "existing") { if (!parentUserId || identityMatches[0]?._id !== parentUserId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); }
    else { if (identityMatches.length) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED"); parentUserId = await ctx.db.insert("users", { schoolId: application.schoolId, authId: guardian.betterAuthUserId ?? guardian.authTokenIdentifier, authTokenIdentifier: guardian.authTokenIdentifier, name: guardian.normalizedEmail, email: guardian.normalizedEmail, role: "parent", createdAt: now, updatedAt: now }); }

    let familyId = resolution.familyId;
    if (familyId) {
      const [family, link] = await Promise.all([ctx.db.get("families", familyId), ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique()]);
      if (!family || family.schoolId !== application.schoolId || !link || link.schoolId !== application.schoolId) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
    } else {
      familyId = await ctx.db.insert("families", { schoolId: application.schoolId, name: `${profile.lastName.trim()} Family`, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });
    }
    const familyLink = await ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", familyId!).eq("parentUserId", parentUserId)).unique();
    if (!familyLink) await ctx.db.insert("familyMembers", { schoolId: application.schoolId, familyId: familyId!, parentUserId, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: membership.userId, updatedBy: membership.userId });

    let photo: Doc<"admissionsDocuments"> | null = null;
    if (args.photoDocumentId) {
      const loadedPhoto = await ctx.db.get("admissionsDocuments", args.photoDocumentId);
      const manifest = loadedPhoto && await ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", snapshot._id).eq("itemKey", `document:${loadedPhoto.documentKey}`)).unique();
      if (!loadedPhoto || !manifest || loadedPhoto.schoolId !== application.schoolId || loadedPhoto.applicationId !== application._id || loadedPhoto.state !== "accepted" || loadedPhoto.category !== "photo") throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
      photo = loadedPhoto;
    }
    const photoFields = photo ? { photoStorageId: photo.storageId, photoFileName: photo.fileName, photoContentType: photo.mimeType, photoUpdatedAt: now, photoProvenance: "application_upload" as const, photoSourceDocumentId: photo._id, photoRetentionHold: true } : {};
    let studentId = resolution.existingStudentId;
    let studentUserId: Id<"users">;
    if (studentId) {
      const student = await ctx.db.get("students", studentId);
      if (!student || student.schoolId !== application.schoolId || student.isArchived || (student.sourceApplicationId && student.sourceApplicationId !== application._id)) throw new ConvexError("CONVERSION_RESOLUTION_REQUIRED");
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
