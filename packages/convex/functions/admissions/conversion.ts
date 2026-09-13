import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, mutation } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { normalizeCapability } from "../academic/rbac";
import { createCanonicalStudentEnrollmentHelper } from "../academic/studentEnrollment";
import { claimOnboardingDeliveryRef, conversionTransactionRef, finishOnboardingDeliveryRef, processConversionRef, processOnboardingRef, queueOnboardingRef } from "./refs";
import { configuredApplicationOrigin } from "../foundation/applicationLinks";
import { admissionsError, normalizeRequiredText, recordAdmissionsAudit, requireAdmissionsStaff } from "./shared";

const familyResolutionValidator = v.union(
  v.object({ kind: v.literal("create"), familyName: v.optional(v.string()) }),
  v.object({ kind: v.literal("existing"), familyId: v.id("families") }),
);

const successFields = {
  conversionId: v.id("admissionsConversions"), state: v.literal("succeeded"), familyId: v.id("families"), familyMemberId: v.id("familyMembers"), guardianUserId: v.id("users"), studentUserId: v.id("users"), studentId: v.id("students"), admissionNumber: v.string(), replayed: v.boolean(),
};
const conversionResultValidator = v.union(
  v.object(successFields),
  v.object({ conversionId: v.id("admissionsConversions"), state: v.union(v.literal("requested"), v.literal("running"), v.literal("failed_retryable"), v.literal("failed_terminal")), replayed: v.boolean(), errorCode: v.union(v.string(), v.null()) }),
);

function successfulResult(conversion: Doc<"admissionsConversions">, replayed: boolean) {
  if (conversion.state !== "succeeded" || !conversion.familyId || !conversion.familyMemberId || !conversion.guardianUserId || !conversion.studentUserId || !conversion.studentId || !conversion.admissionNumber) throw new ConvexError("Succeeded conversion ledger is incomplete");
  return { conversionId: conversion._id, state: "succeeded" as const, familyId: conversion.familyId, familyMemberId: conversion.familyMemberId, guardianUserId: conversion.guardianUserId, studentUserId: conversion.studentUserId, studentId: conversion.studentId, admissionNumber: conversion.admissionNumber, replayed };
}

function pendingResult(conversion: Doc<"admissionsConversions">, replayed: boolean) {
  if (conversion.state === "succeeded") return successfulResult(conversion, replayed);
  return { conversionId: conversion._id, state: conversion.state, replayed, errorCode: conversion.errorCode ?? null };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ConvexError(`${label} snapshot is invalid`);
  return Object.fromEntries(Object.entries(value));
}

function requiredString(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) throw new ConvexError(`${label} is missing from the accepted snapshot`);
  return value.trim();
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function resolveGuardianUser(ctx: MutationCtx, guardian: Doc<"admissionsGuardians">, schoolId: Id<"schools">, signerName: string) {
  if (!guardian.betterAuthUserId || !guardian.emailVerifiedAt) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian authentication identity is incomplete");
  const persons = await ctx.db.query("persons").withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", guardian.authTokenIdentifier)).take(2);
  if (persons.length > 1) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian identity is ambiguous");
  const existingPerson = persons[0];
  if (existingPerson && (existingPerson.status !== "active" || existingPerson.identityReconciliationState === "reconciliation_required")) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian identity requires reconciliation");
  const tokenUsers = await ctx.db.query("users").withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", guardian.authTokenIdentifier)).take(101);
  if (tokenUsers.length > 100) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian identity spans too many school accounts for automatic conversion");
  const schoolUsers = tokenUsers.filter((user) => user.schoolId === schoolId && !user.isArchived);
  if (schoolUsers.length > 1 || schoolUsers.some((user) => user.role !== "parent")) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian school identity conflicts with an existing account");
  const emailUsers = await ctx.db.query("users").withIndex("by_school_and_email", (q) => q.eq("schoolId", schoolId).eq("email", guardian.normalizedEmail)).take(2);
  if (emailUsers.some((user) => user.authTokenIdentifier !== guardian.authTokenIdentifier)) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian email belongs to another school identity");
  const now = Date.now();
  let person: Doc<"persons">;
  if (existingPerson) person = existingPerson;
  else {
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: guardian.authTokenIdentifier, name: signerName, email: guardian.normalizedEmail, status: "active", createdAt: now, updatedAt: now });
    const createdPerson = await ctx.db.get(personId);
    if (!createdPerson) throw new ConvexError("Guardian person was not persisted");
    person = createdPerson;
  }
  const existingUser = schoolUsers[0];
  if (existingUser?.personId && existingUser.personId !== person._id) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian account has conflicting canonical identity");
  let user: Doc<"users">;
  if (existingUser) user = existingUser;
  else {
    const userId = await ctx.db.insert("users", { schoolId, authId: guardian.betterAuthUserId, authTokenIdentifier: guardian.authTokenIdentifier, personId: person._id, name: signerName, email: guardian.normalizedEmail, role: "parent", createdAt: now, updatedAt: now });
    const createdUser = await ctx.db.get(userId);
    if (!createdUser) throw new ConvexError("Guardian school account was not persisted");
    user = createdUser;
  }
  const memberships = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", person._id).eq("schoolId", schoolId)).take(2);
  if (memberships.length > 1 || (memberships[0] && memberships[0].status !== "active")) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian branch membership conflicts with conversion");
  if (!memberships[0]) await ctx.db.insert("branchMemberships", { schoolId, personId: person._id, legacyUserId: user._id, isDefaultBranch: false, status: "active", joinedAt: now, updatedAt: now });
  else if (memberships[0].legacyUserId && memberships[0].legacyUserId !== user._id) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Guardian membership points to another school account");
  else if (!memberships[0].legacyUserId) await ctx.db.patch(memberships[0]._id, { legacyUserId: user._id, updatedAt: now });
  return user;
}

export const executeAcceptedConversion = mutation({
  args: {
    schoolId: v.id("schools"), applicationId: v.id("admissionsApplications"), idempotencyKey: v.string(), classId: v.id("classes"), admissionNumber: v.string(), familyResolution: familyResolutionValidator, photoDocumentKey: v.optional(v.string()), overrideReason: v.optional(v.string()), overrideConfirmed: v.optional(v.boolean()), overrideCounterDecision: v.optional(v.union(v.literal("keep"), v.literal("advance"))), advanceCounterTo: v.optional(v.number()), numberingVersion: v.optional(v.number()), numberingFormatVersion: v.optional(v.string()), numberingCounterKey: v.optional(v.string()), numberingCounterVersion: v.optional(v.number()), numberingSessionId: v.optional(v.id("academicSessions")), numberingResetPeriod: v.optional(v.string()),
  },
  returns: conversionResultValidator,
  handler: async (ctx, args) => {
    const actor = await requireAdmissionsStaff(ctx, args.schoolId, ["enrollment.intakes.manage", "enrollment.decisions.record"]);
    const idempotencyKey = normalizeRequiredText(args.idempotencyKey, "Conversion idempotency key", 128);
    const application = await ctx.db.get(args.applicationId);
    if (!application || application.schoolId !== args.schoolId) admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
    const existing = await ctx.db.query("admissionsConversions").withIndex("by_application", (q) => q.eq("applicationId", application._id)).unique();
    if (existing) {
      if (existing.idempotencyKey !== idempotencyKey) throw new ConvexError("Application conversion is already bound to another idempotency key");
      if (existing.state === "failed_retryable") await ctx.scheduler.runAfter(0, processConversionRef, { conversionId: existing._id });
      return pendingResult(existing, true);
    }
    const [decision, snapshot, selectedClass, numberingPolicy] = await Promise.all([
      application.currentDecisionId ? ctx.db.get(application.currentDecisionId) : null,
      application.latestSnapshotId ? ctx.db.get(application.latestSnapshotId) : null,
      ctx.db.get(args.classId),
      ctx.db.query("admissionNumberPolicies").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId)).unique(),
    ]);
    if (application.state !== "accepted" || application.financialHoldAt !== undefined || !decision || decision.state !== "accepted" || decision.applicationId !== application._id || !snapshot || snapshot.applicationId !== application._id) admissionsError("CONVERSION_RESOLUTION_REQUIRED", "Only the accepted immutable submission can be converted");
    if (!selectedClass || selectedClass.schoolId !== args.schoolId || selectedClass.isArchived) admissionsError("NOT_FOUND_OR_DENIED", "Class not found");
    const requestedAdmissionNumber = args.admissionNumber.trim();
    if (numberingPolicy && requestedAdmissionNumber && !new Set(actor.capabilities.map(normalizeCapability)).has(normalizeCapability("enrollment.admissions.override_number"))) admissionsError("FORBIDDEN", "Manual admission numbering requires enrollment.admissions.override_number");
    const now = Date.now();
    const conversionId = await ctx.db.insert("admissionsConversions", {
      schoolId: args.schoolId, applicationId: application._id, acceptedDecisionId: decision._id, snapshotId: snapshot._id, idempotencyKey, state: "requested", requestedByUserId: actor.userId, attemptCount: 0, classId: selectedClass._id, requestedAdmissionNumber,
      familyResolutionKind: args.familyResolution.kind, ...(args.familyResolution.kind === "existing" ? { requestedFamilyId: args.familyResolution.familyId } : args.familyResolution.familyName ? { requestedFamilyName: args.familyResolution.familyName } : {}),
      ...(args.photoDocumentKey ? { photoDocumentKey: args.photoDocumentKey } : {}), ...(args.overrideReason ? { overrideReason: args.overrideReason } : {}), ...(args.overrideConfirmed !== undefined ? { overrideConfirmed: args.overrideConfirmed } : {}), ...(args.overrideCounterDecision ? { overrideCounterDecision: args.overrideCounterDecision } : {}), ...(args.advanceCounterTo !== undefined ? { advanceCounterTo: args.advanceCounterTo } : {}), ...(args.numberingVersion !== undefined ? { numberingVersion: args.numberingVersion } : {}), ...(args.numberingFormatVersion ? { numberingFormatVersion: args.numberingFormatVersion } : {}), ...(args.numberingCounterKey ? { numberingCounterKey: args.numberingCounterKey } : {}), ...(args.numberingCounterVersion !== undefined ? { numberingCounterVersion: args.numberingCounterVersion } : {}), ...(args.numberingSessionId ? { numberingSessionId: args.numberingSessionId } : {}), ...(args.numberingResetPeriod ? { numberingResetPeriod: args.numberingResetPeriod } : {}), createdAt: now, updatedAt: now,
    });
    await ctx.db.patch(application._id, { conversionId, updatedAt: now });
    await ctx.scheduler.runAfter(0, processConversionRef, { conversionId });
    await recordAdmissionsAudit(ctx, { schoolId: args.schoolId, actorKind: "staff", actorUserId: actor.userId, action: "conversion.requested", entityType: "admissionsConversion", entityId: conversionId, applicationId: application._id });
    const conversion = await ctx.db.get(conversionId);
    if (!conversion) throw new ConvexError("Conversion request was not persisted");
    return pendingResult(conversion, false);
  },
});

export const processAcceptedConversion = internalMutation({
  args: { conversionId: v.id("admissionsConversions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(conversionTransactionRef, args);
    } catch (error) {
      const conversion = await ctx.db.get(args.conversionId);
      if (!conversion || conversion.state === "succeeded" || conversion.state === "failed_terminal") return null;
      const message = error instanceof Error ? error.message : "CONVERSION_FAILED";
      const terminal = /CONFLICT|AMBIGUOUS|INVALID|RECONCILIATION|SNAPSHOT|CONTEXT_CHANGED|already assigned|already linked/i.test(message);
      const now = Date.now();
      const attemptNumber = (conversion.attemptCount ?? 0) + 1;
      const errorCode = terminal ? "CONVERSION_RESOLUTION_REQUIRED" : "CONVERSION_RETRY_REQUIRED";
      await ctx.db.patch(conversion._id, { state: terminal ? "failed_terminal" : "failed_retryable", attemptCount: attemptNumber, leaseExpiresAt: undefined, errorCode, updatedAt: now });
      await ctx.db.insert("admissionsConversionAttempts", { schoolId: conversion.schoolId, conversionId: conversion._id, attemptNumber, workerKey: conversion.idempotencyKey, outcome: terminal ? "terminal_failure" : "retryable_failure", errorCode, startedAt: now, finishedAt: now, createdAt: now });
      if (!terminal && attemptNumber < 5) await ctx.scheduler.runAfter(60_000, processConversionRef, { conversionId: conversion._id });
    }
    return null;
  },
});

export const processAcceptedConversionTransaction = internalMutation({
  args: { conversionId: v.id("admissionsConversions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion || conversion.state === "succeeded" || conversion.state === "failed_terminal" || !conversion.classId || !conversion.familyResolutionKind) return null;
    if (conversion.state === "running" && (conversion.leaseExpiresAt ?? 0) > Date.now()) return null;
    const attemptNumber = (conversion.attemptCount ?? 0) + 1;
    const startedAt = Date.now();
    await ctx.db.patch(conversion._id, { state: "running", attemptCount: attemptNumber, leaseExpiresAt: startedAt + 5 * 60_000, errorCode: undefined, updatedAt: startedAt });
    const application = await ctx.db.get(conversion.applicationId);
    if (!application) throw new ConvexError("CONVERSION_CONTEXT_CHANGED");
    const [decision, snapshot, guardian, selectedClass, items] = await Promise.all([
      ctx.db.get(conversion.acceptedDecisionId), ctx.db.get(conversion.snapshotId), ctx.db.get(application.guardianId), ctx.db.get(conversion.classId),
      ctx.db.query("admissionsSubmissionSnapshotItems").withIndex("by_snapshot_and_item_key", (q) => q.eq("snapshotId", conversion.snapshotId)).take(202),
    ]);
    if (application.state !== "accepted" || application.financialHoldAt !== undefined || application.currentDecisionId !== conversion.acceptedDecisionId || application.latestSnapshotId !== conversion.snapshotId || !decision || decision.state !== "accepted" || !snapshot || snapshot.applicationId !== application._id || !guardian || !selectedClass || selectedClass.schoolId !== conversion.schoolId) throw new ConvexError("CONVERSION_CONTEXT_CHANGED");
    if (items.length > 201) throw new ConvexError("CONVERSION_SNAPSHOT_TOO_LARGE");
    const profileItem = items.find((item) => item.itemKey === "profile" && item.kind === "profile");
    const contactItem = items.find((item) => item.itemKey === "primaryContact" && item.kind === "contact");
    if (!profileItem || !contactItem) throw new ConvexError("CONVERSION_SNAPSHOT_INCOMPLETE");
    let profileUnknown: unknown;
    let contactUnknown: unknown;
    try { profileUnknown = JSON.parse(profileItem.serializedValue) as unknown; contactUnknown = JSON.parse(contactItem.serializedValue) as unknown; } catch { throw new ConvexError("CONVERSION_SNAPSHOT_INVALID"); }
    const profile = objectValue(profileUnknown, "Applicant profile");
    const contact = objectValue(contactUnknown, "Primary contact");
    const firstName = requiredString(profile, "firstName", "First name");
    const lastName = requiredString(profile, "lastName", "Last name");
    const dateOfBirth = profile.dateOfBirth;
    if (typeof dateOfBirth !== "number" || !Number.isSafeInteger(dateOfBirth) || dateOfBirth <= 0) throw new ConvexError("Date of birth is missing from the accepted snapshot");
    const guardianUser = await resolveGuardianUser(ctx, guardian, conversion.schoolId, snapshot.signerName);
    const now = Date.now();
    let family: Doc<"families">;
    if (conversion.familyResolutionKind === "existing") {
      const existingFamily = conversion.requestedFamilyId ? await ctx.db.get(conversion.requestedFamilyId) : null;
      if (!existingFamily || existingFamily.schoolId !== conversion.schoolId) throw new ConvexError("FAMILY_RESOLUTION_INVALID");
      family = existingFamily;
    } else {
      const familyName = conversion.requestedFamilyName?.trim() || `${lastName} Family`;
      const exactFamily = await ctx.db.query("families").withIndex("by_school_and_name", (q) => q.eq("schoolId", conversion.schoolId).eq("name", familyName)).first();
      if (exactFamily) throw new ConvexError("FAMILY_RESOLUTION_AMBIGUOUS");
      const familyId = await ctx.db.insert("families", { schoolId: conversion.schoolId, name: normalizeRequiredText(familyName, "Family name", 160), createdAt: now, updatedAt: now, createdBy: conversion.requestedByUserId ?? guardianUser._id, updatedBy: conversion.requestedByUserId ?? guardianUser._id });
      const created = await ctx.db.get(familyId);
      if (!created) throw new ConvexError("Family was not persisted");
      family = created;
    }
    let familyMember = await ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", family._id).eq("parentUserId", guardianUser._id)).unique();
    if (!familyMember) {
      const familyMemberId = await ctx.db.insert("familyMembers", { schoolId: conversion.schoolId, familyId: family._id, parentUserId: guardianUser._id, relationship: snapshot.signerRelationship, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: conversion.requestedByUserId ?? guardianUser._id, updatedBy: conversion.requestedByUserId ?? guardianUser._id });
      const created = await ctx.db.get(familyMemberId);
      if (!created) throw new ConvexError("Family membership was not persisted");
      familyMember = created;
    }
    const existingStudents = await ctx.db.query("students").withIndex("by_source_application", (q) => q.eq("sourceApplicationId", application._id)).take(2);
    if (existingStudents.length) throw new ConvexError("STUDENT_ORIGIN_REQUIRES_RECONCILIATION");
    let photo: { storageId: Id<"_storage">; fileName: string; contentType: string; sourceApplicationId: Id<"admissionsApplications">; sourceDocumentId: Id<"admissionsDocuments"> } | undefined;
    if (conversion.photoDocumentKey) {
      const manifest = items.find((item) => item.itemKey === `document:${conversion.photoDocumentKey}` && item.kind === "document_manifest");
      const document = await ctx.db.query("admissionsDocuments").withIndex("by_document_key", (q) => q.eq("documentKey", conversion.photoDocumentKey!)).unique();
      if (!manifest || !document || document.schoolId !== conversion.schoolId || document.applicationId !== application._id || document.state !== "accepted" || !document.mimeType.startsWith("image/")) throw new ConvexError("PHOTO_NOT_IN_ACCEPTED_SNAPSHOT");
      photo = { storageId: document.storageId, fileName: document.fileName, contentType: document.mimeType, sourceApplicationId: application._id, sourceDocumentId: document._id };
    }
    const enrollment = await createCanonicalStudentEnrollmentHelper(ctx, { schoolId: conversion.schoolId, classId: selectedClass._id, name: [firstName, optionalString(profile, "middleName"), lastName].filter(Boolean).join(" "), firstName, lastName, admissionNumber: conversion.requestedAdmissionNumber ?? "", ...(optionalString(profile, "gender") ? { gender: optionalString(profile, "gender") } : {}), dateOfBirth, guardianName: requiredString(contact, "fullName", "Primary contact name"), address: optionalString(profile, "address"), sourceApplicationId: application._id, ...(photo ? { photo } : {}), overrideReason: conversion.overrideReason, overrideConfirmed: conversion.overrideConfirmed, overrideCounterDecision: conversion.overrideCounterDecision, advanceCounterTo: conversion.advanceCounterTo, numberingVersion: conversion.numberingVersion, numberingFormatVersion: conversion.numberingFormatVersion, numberingCounterKey: conversion.numberingCounterKey, numberingCounterVersion: conversion.numberingCounterVersion, numberingSessionId: conversion.numberingSessionId, numberingResetPeriod: conversion.numberingResetPeriod });
    const guardianEmail = requiredString(contact, "email", "Primary contact email");
    await ctx.db.patch(enrollment.studentId, { familyId: family._id, guardianEmail, updatedAt: now });
    await ctx.db.patch(conversion._id, { state: "succeeded", admissionNumber: enrollment.admissionNumber, familyId: family._id, familyMemberId: familyMember._id, guardianUserId: guardianUser._id, studentUserId: enrollment.studentUserId, studentId: enrollment.studentId, completedAt: now, leaseExpiresAt: undefined, errorCode: undefined, updatedAt: now });
    await ctx.db.insert("admissionsConversionAttempts", { schoolId: conversion.schoolId, conversionId: conversion._id, attemptNumber, workerKey: conversion.idempotencyKey, outcome: "succeeded", startedAt, finishedAt: now, createdAt: now });
    await ctx.scheduler.runAfter(0, queueOnboardingRef, { conversionId: conversion._id });
    return null;
  },
});

export const queueOnboarding = internalMutation({
  args: { conversionId: v.id("admissionsConversions") }, returns: v.null(),
  handler: async (ctx, args) => {
    const conversion = await ctx.db.get(args.conversionId);
    if (!conversion || conversion.state !== "succeeded") return null;
    const application = await ctx.db.get(conversion.applicationId);
    if (!application || application.schoolId !== conversion.schoolId) return null;
    let outbox = await ctx.db.query("admissionsCommunicationOutbox").withIndex("by_conversion_and_event_key", (q) => q.eq("conversionId", conversion._id).eq("eventKey", "portal_parent_linkage")).unique();
    if (!outbox) {
      const now = Date.now();
      const id = await ctx.db.insert("admissionsCommunicationOutbox", { schoolId: conversion.schoolId, applicationId: application._id, conversionId: conversion._id, eventKey: "portal_parent_linkage", recipientGuardianId: application.guardianId, channel: "email", templateKey: "accepted_student_onboarding", templateVersion: "1", state: "pending", nextAttemptAt: now, createdAt: now, updatedAt: now });
      const createdOutbox = await ctx.db.get(id);
      if (!createdOutbox) throw new ConvexError("Onboarding work was not persisted");
      outbox = createdOutbox;
      await ctx.db.patch(conversion._id, { onboardingQueuedAt: now, updatedAt: now });
    }
    if (outbox && outbox.state !== "sent") await ctx.scheduler.runAfter(0, processOnboardingRef, { outboxId: outbox._id });
    return null;
  },
});

export const claimOnboardingDelivery = internalMutation({
  args: { outboxId: v.id("admissionsCommunicationOutbox"), now: v.number() },
  returns: v.union(v.null(), v.object({ attemptNumber: v.number(), recipientEmail: v.string(), schoolName: v.string(), schoolSlug: v.string(), studentName: v.string(), applicationPublicId: v.string() })),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.state === "sent" || row.channel !== "email" || !row.conversionId || row.nextAttemptAt > args.now) return null;
    const attemptNumber = (row.attemptCount ?? 0) + 1;
    if (attemptNumber > 5) return null;
    const conversion = await ctx.db.get(row.conversionId);
    if (!conversion || conversion.state !== "succeeded" || !conversion.guardianUserId || !conversion.studentUserId || !conversion.studentId || !conversion.familyId || !row.applicationId) {
      await ctx.db.patch(row._id, { state: "failed", attemptCount: attemptNumber, nextAttemptAt: args.now, lastErrorCode: "ONBOARDING_DELIVERY_CONTEXT_INVALID", updatedAt: args.now });
      return null;
    }
    const student = await ctx.db.get(conversion.studentId);
    const [application, guardian, school, studentUser, member] = await Promise.all([
      ctx.db.get(row.applicationId),
      ctx.db.get(row.recipientGuardianId),
      ctx.db.get(row.schoolId),
      student ? ctx.db.get(student.userId) : Promise.resolve(null),
      ctx.db.query("familyMembers").withIndex("by_family_and_parent", (q) => q.eq("familyId", conversion.familyId!).eq("parentUserId", conversion.guardianUserId!)).unique(),
    ]);
    if (!application || application.schoolId !== row.schoolId || application.guardianId !== row.recipientGuardianId || application.conversionId !== conversion._id || !guardian?.emailVerifiedAt || !school || !student || student.familyId !== conversion.familyId || !studentUser || studentUser._id !== conversion.studentUserId || student.userId !== studentUser._id || studentUser.schoolId !== row.schoolId || !member) {
      await ctx.db.patch(row._id, { state: "failed", attemptCount: attemptNumber, nextAttemptAt: args.now, lastErrorCode: "ONBOARDING_DELIVERY_CONTEXT_INVALID", updatedAt: args.now });
      return null;
    }
    await ctx.db.patch(row._id, { state: "sending", attemptCount: attemptNumber, nextAttemptAt: args.now + 5 * 60_000, lastErrorCode: undefined, updatedAt: args.now });
    return { attemptNumber, recipientEmail: guardian.normalizedEmail, schoolName: school.name, schoolSlug: school.slug, studentName: studentUser.name, applicationPublicId: application.publicId };
  },
});

export const finishOnboardingDelivery = internalMutation({
  args: { outboxId: v.id("admissionsCommunicationOutbox"), attemptNumber: v.number(), succeeded: v.boolean(), errorCode: v.optional(v.string()), now: v.number() },
  returns: v.object({ retryAt: v.union(v.number(), v.null()) }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.outboxId);
    if (!row || row.state !== "sending" || row.attemptCount !== args.attemptNumber) return { retryAt: null };
    if (args.succeeded) {
      await ctx.db.patch(row._id, { state: "sent", sentAt: args.now, nextAttemptAt: args.now, lastErrorCode: undefined, updatedAt: args.now });
      return { retryAt: null };
    }
    const retryAt = args.attemptNumber < 5 ? args.now + Math.min(60 * 60_000, 60_000 * 2 ** (args.attemptNumber - 1)) : null;
    await ctx.db.patch(row._id, { state: "failed", nextAttemptAt: retryAt ?? args.now, lastErrorCode: args.errorCode?.slice(0, 120) || "ONBOARDING_EMAIL_FAILED", updatedAt: args.now });
    return { retryAt };
  },
});

export const processOnboarding = internalAction({
  args: { outboxId: v.id("admissionsCommunicationOutbox") }, returns: v.null(),
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const delivery = await ctx.runMutation(claimOnboardingDeliveryRef, { outboxId: args.outboxId, now: startedAt });
    if (!delivery) return null;
    await ctx.scheduler.runAfter(5 * 60_000, processOnboardingRef, args);
    let succeeded = false;
    let errorCode = "ONBOARDING_EMAIL_FAILED";
    try {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const from = process.env.MELO_EMAIL_FROM?.trim();
      if (!apiKey || !from) throw new Error("ONBOARDING_EMAIL_NOT_CONFIGURED");
      const applicationUrl = new URL(`/s/${encodeURIComponent(delivery.schoolSlug)}/applications/${encodeURIComponent(delivery.applicationPublicId)}`, configuredApplicationOrigin()).toString();
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": String(args.outboxId) },
        body: JSON.stringify({ from, to: [delivery.recipientEmail], subject: `${delivery.schoolName} enrollment setup`, text: `${delivery.studentName}'s enrollment setup is complete. View the application status: ${applicationUrl}\n\nIf you did not expect this message, contact the school.` }),
      });
      if (!response.ok) throw new Error(`ONBOARDING_EMAIL_PROVIDER_${response.status}`);
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || typeof Reflect.get(result, "id") !== "string") throw new Error("ONBOARDING_EMAIL_UNCONFIRMED");
      succeeded = true;
    } catch (error) {
      errorCode = error instanceof Error && /^ONBOARDING_EMAIL_[A-Z0-9_]+$/.test(error.message) ? error.message : "ONBOARDING_EMAIL_FAILED";
    }
    const finishedAt = Date.now();
    const result = await ctx.runMutation(finishOnboardingDeliveryRef, { outboxId: args.outboxId, attemptNumber: delivery.attemptNumber, succeeded, ...(succeeded ? {} : { errorCode }), now: finishedAt });
    if (result.retryAt !== null) await ctx.scheduler.runAfter(Math.max(0, result.retryAt - finishedAt), processOnboardingRef, args);
    return null;
  },
});
