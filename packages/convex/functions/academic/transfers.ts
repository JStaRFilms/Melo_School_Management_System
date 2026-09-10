import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { type ActiveMembershipContext } from "./auth";
import { requireCapability } from "./rbac";
import { recordAuditEventHelper } from "./audit";
import {
  allocateNextAdmissionNumberHelper,
  commitManualAdmissionNumberHelper,
  proposeAdmissionNumberHelper,
} from "./admissionNumbers";

/**
 * Validates that the caller holds authority to manage student transfers
 * in the specified branch. Neither Platform status nor a legacy role overrides restrictions.
 */
async function assertTransferAuthority(
  ctx: MutationCtx | QueryCtx,
  schoolId: Id<"schools">,
): Promise<ActiveMembershipContext> {
  return requireCapability(ctx, schoolId, "enrollment.intakes.manage");
}

type TransferScope = "source" | "destination" | "both";

async function assertTransferPilotForSchool(
  ctx: MutationCtx | QueryCtx,
  schoolId: Id<"schools">,
): Promise<Id<"schoolGroups">> {
  const link = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .unique();
  const [school, group] = await Promise.all([
    ctx.db.get(schoolId),
    link ? ctx.db.get(link.groupId) : Promise.resolve(null),
  ]);
  if (
    !school ||
    (school.status !== undefined && school.status !== "active") ||
    !link ||
    group?.status !== "active" ||
    group.studentTransfersEnabled !== true
  )
    throw new ConvexError("Within-group transfers are not enabled for this pilot group");
  return group._id;
}

async function getAuthorizedTransferScope(
  ctx: QueryCtx,
  transfer: Doc<"studentTransfers">,
): Promise<TransferScope> {
  let sourceAuthorized = false;
  let destinationAuthorized = false;
  try {
    await assertTransferAuthority(ctx, transfer.sourceSchoolId);
    sourceAuthorized = true;
  } catch {
    // Try the destination branch before denying access.
  }
  try {
    await assertTransferAuthority(ctx, transfer.destinationSchoolId);
    destinationAuthorized = true;
  } catch {
    // The caller may be authorized only in the source branch.
  }

  if (sourceAuthorized && destinationAuthorized) return "both";
  if (sourceAuthorized) return "source";
  if (destinationAuthorized) return "destination";

  throw new ConvexError({
    code: "FORBIDDEN",
    message:
      "Forbidden: Caller does not hold transfer authorization in either branch",
  });
}

async function assertGroupTransferAuthority(
  ctx: QueryCtx,
  groupId: Id<"schoolGroups">,
): Promise<void> {
  const group = await ctx.db.get(groupId);
  if (group?.status !== "active" || group.studentTransfersEnabled !== true)
    throw new ConvexError("Within-group transfers are not enabled for this pilot group");
  const branches = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .take(501);

  for (const branch of branches) {
    try {
      await assertTransferAuthority(ctx, branch.schoolId);
      return;
    } catch {
      // Authorization is valid in any explicitly linked branch.
    }
  }

  throw new ConvexError({
    code: "FORBIDDEN",
    message:
      "Forbidden: Caller does not hold transfer authorization in this school group",
  });
}

function redactTransferForScope(
  record: Doc<"studentTransfers">,
  scope: TransferScope,
) {
  const {
    requestKey: _requestKey,
    initiationIntent: _initiationIntent,
    acceptanceIntent: _acceptanceIntent,
    sourceStudentUserId: _sourceStudentUserId,
    ...safeRecord
  } = record;
  const transfer = {
    ...safeRecord,
    sourceReleaseRecorded: record.sourceReleasedAt !== undefined,
  };
  if (transfer.portableRecordPackage) {
    const { medicalNotes: _medicalNotes, ...portable } =
      transfer.portableRecordPackage;
    transfer.portableRecordPackage = portable;
  }
  if (scope === "both") {
    return transfer;
  }

  if (scope === "source") {
    const {
      destinationClassName: _destinationClassName,
      destinationSessionName: _destinationSessionName,
      destinationSessionId: _destinationSessionId,
      destinationClassId: _destinationClassId,
      destinationStudentId: _destinationStudentId,
      destinationAdmissionNumber: _destinationAdmissionNumber,
      destinationAcceptedByUserId: _destinationAcceptedByUserId,
      destinationAcceptedAt: _destinationAcceptedAt,
      ...sourceView
    } = transfer;
    return sourceView;
  }

  const {
    sourceReleaseNote: _sourceReleaseNote,
    sourceReleasedByUserId: _sourceReleasedByUserId,
    sourceReleasedAt: _sourceReleasedAt,
    ...destinationView
  } = transfer;
  return destinationView;
}

/**
 * Phase 1 Step 1: Initiate Student Transfer Proposal.
 *
 * Enforces:
 * 1. Source and destination schools belong to the same verified schoolGroup.
 * 2. Independent Melo-to-Melo transfers are strictly gated/rejected.
 * 3. Verified guardian consent is affirmatively recorded.
 * 4. Compiles Portable Academic Record Package (PARS) strictly omitting safeguarding notes,
 *    child-protection flags, disciplinary records, and parent billing/debt history.
 * 5. Creates studentTransfers record with status "initiated" and records immutable audit event.
 */
export const initiateStudentTransfer = mutation({
  args: {
    requestKey: v.optional(v.string()),
    proposalClassName: v.optional(v.string()),
    proposalSessionName: v.optional(v.string()),
    sourceSchoolId: v.id("schools"),
    destinationSchoolId: v.id("schools"),
    studentId: v.id("students"),
    guardianConsentRecorded: v.boolean(),
    guardianConsentMethod: v.string(),
    academicHistorySummary: v.optional(v.string()),
    attendanceSummaryPct: v.optional(v.number()),
    // Compatibility input only: never retained or shared. Health transfer is not supported.
    medicalNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller authority in source school
    const authContext = await assertTransferAuthority(ctx, args.sourceSchoolId);
    await assertTransferPilotForSchool(ctx, args.sourceSchoolId);

    const initiationIntent = JSON.stringify([
      args.studentId,
      args.destinationSchoolId,
      args.proposalClassName,
      args.proposalSessionName,
      args.guardianConsentRecorded,
      args.guardianConsentMethod,
      args.academicHistorySummary,
      args.attendanceSummaryPct,
    ]);
    if (args.requestKey !== undefined) {
      if (!args.requestKey.trim() || args.requestKey.length > 100)
        throw new ConvexError("Invalid operation key");
      const replay = await ctx.db
        .query("studentTransfers")
        .withIndex("by_source_request", (q) =>
          q
            .eq("sourceSchoolId", args.sourceSchoolId)
            .eq("requestKey", args.requestKey),
        )
        .unique();
      if (replay) {
        if (replay.initiationIntent !== initiationIntent) {
          throw new ConvexError(
            "Operation already submitted with different proposal; open its history",
          );
        }
        return {
          transferId: replay._id,
          status: "initiated" as const,
          studentName: replay.studentName,
        };
      }
    }
    for (const text of [
      args.guardianConsentMethod,
      args.proposalClassName,
      args.proposalSessionName,
      args.academicHistorySummary,
    ]) {
      if (text !== undefined && (!text.trim() || text.length > 500))
        throw new ConvexError("Proposal fields require 1–500 characters");
    }
    if (
      args.attendanceSummaryPct !== undefined &&
      (!Number.isFinite(args.attendanceSummaryPct) ||
        args.attendanceSummaryPct < 0 ||
        args.attendanceSummaryPct > 100)
    ) {
      throw new ConvexError("Attendance percentage must be between 0 and 100");
    }

    // 2. Reject same-branch transfer
    if (args.sourceSchoolId === args.destinationSchoolId) {
      throw new ConvexError(
        "Source and destination schools cannot be the same",
      );
    }

    // 3. Strict Boundary Gate: Verify within-group membership (F4 / MX-15)
    const sourceGroupBranch = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.sourceSchoolId))
      .first();

    const destGroupBranch = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", args.destinationSchoolId))
      .first();

    if (
      !sourceGroupBranch ||
      !destGroupBranch ||
      sourceGroupBranch.groupId !== destGroupBranch.groupId
    ) {
      throw new ConvexError(
        "Cross-group transfers are not permitted. Transferee schools must belong to the same verified school group.",
      );
    }

    const groupId = sourceGroupBranch.groupId;
    await assertActiveTransferGroup(
      ctx,
      args.sourceSchoolId,
      args.destinationSchoolId,
      groupId,
    );

    // 4. Guardian consent gate
    if (!args.guardianConsentRecorded) {
      throw new ConvexError(
        "Guardian consent must be explicitly recorded prior to initiating transfer",
      );
    }
    if (
      !args.guardianConsentMethod ||
      args.guardianConsentMethod.trim().length === 0
    ) {
      throw new ConvexError("Guardian consent method must be specified");
    }

    // 5. Validate student record in source school
    const student = await ctx.db.get(args.studentId);
    if (!student || student.schoolId !== args.sourceSchoolId) {
      throw new ConvexError("Student not found in source school branch");
    }
    if (student.isArchived) {
      throw new ConvexError("Cannot transfer an archived student record");
    }
    if (
      student.enrollmentStatus === "graduated" ||
      student.enrollmentStatus === "transferred_out" ||
      student.enrollmentStatus === "withdrawn"
    ) {
      throw new ConvexError(
        `Cannot transfer student with enrollment status '${student.enrollmentStatus}'`,
      );
    }

    // Historical attempts never block a new proposal; only active states do.
    const [initiatedTransfer, releasedTransfer] = await Promise.all([
      ctx.db
        .query("studentTransfers")
        .withIndex("by_student_and_status", (q) =>
          q.eq("studentId", args.studentId).eq("status", "initiated"),
        )
        .first(),
      ctx.db
        .query("studentTransfers")
        .withIndex("by_student_and_status", (q) =>
          q.eq("studentId", args.studentId).eq("status", "source_released"),
        )
        .first(),
    ]);
    if (initiatedTransfer || releasedTransfer) {
      throw new ConvexError(
        "An active transfer already exists for this student in this school group",
      );
    }

    // 6. Selective Disclosure Compilation:
    // Strictly compile ONLY permitted non-sensitive fields.
    // Prohibited: debt records, unpaid invoices, safeguarding referrals, disciplinary notes.
    const studentUser = student.userId
      ? await ctx.db.get(student.userId)
      : null;
    if (
      !studentUser ||
      studentUser.schoolId !== args.sourceSchoolId ||
      studentUser.isArchived ||
      studentUser.role !== "student"
    ) {
      throw new ConvexError(
        "Student account link requires reconciliation before transfer",
      );
    }
    const studentName = studentUser.name;

    const currentClass = await ctx.db.get(student.classId);
    if (
      !currentClass ||
      currentClass.schoolId !== args.sourceSchoolId ||
      currentClass.isArchived
    )
      throw new ConvexError("Source class requires reconciliation before transfer");
    const academicHistorySummary =
      args.academicHistorySummary ??
      `Enrolled in ${currentClass.name} with admission number ${student.admissionNumber}`;

    const attendanceSummaryPct = args.attendanceSummaryPct;

    const dateOfBirth = student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().split("T")[0]
      : undefined;

    const portableRecordPackage = {
      studentName,
      dateOfBirth,
      gender: student.gender,
      academicHistorySummary,
      attendanceSummaryPct,
    };

    const now = Date.now();
    const transferId = await ctx.db.insert("studentTransfers", {
      groupId,
      requestKey: args.requestKey,
      initiationIntent,
      proposalClassName: args.proposalClassName,
      proposalSessionName: args.proposalSessionName,
      sourceSchoolId: args.sourceSchoolId,
      destinationSchoolId: args.destinationSchoolId,
      sourceSchoolName: (await ctx.db.get(args.sourceSchoolId))?.name,
      destinationSchoolName: (await ctx.db.get(args.destinationSchoolId))?.name,
      studentId: args.studentId,
      sourceStudentUserId: studentUser._id,
      studentName,
      guardianConsentRecorded: args.guardianConsentRecorded,
      guardianConsentMethod: args.guardianConsentMethod,
      status: "initiated",
      portableRecordPackage,
      createdAt: now,
      updatedAt: now,
    });

    // 7. Immutable audit logging
    await recordAuditEventHelper(ctx, {
      schoolId: args.sourceSchoolId,
      groupId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "enrollment",
      action: "student_transfer.initiate",
      targetType: "studentTransfers",
      targetId: transferId,
      outcome: "success",
      safeSummary: `Initiated within-group transfer for student ${studentName} (${args.studentId}) from source branch to destination branch`,
      retentionClass: "permanent_statutory",
      alertTier: "tier3_info",
    });

    return {
      transferId,
      status: "initiated" as const,
      studentName,
    };
  },
});

/**
 * Phase 1 Step 2: Authorize Source Branch Release.
 *
 * Enforces:
 * 1. Authority over source branch.
 * 2. Transfer status must be "initiated".
 * 3. Transitions status to "source_released".
 * 4. Logs audit event.
 */
export const authorizeSourceRelease = mutation({
  args: {
    transferId: v.id("studentTransfers"),
    sourceReleaseNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new ConvexError("Transfer record not found");
    }

    const authContext = await assertTransferAuthority(
      ctx,
      transfer.sourceSchoolId,
    );
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
    );
    if (
      transfer.sourceReleasedAt &&
      transfer.sourceReleaseNote === args.sourceReleaseNote
    ) {
      return { transferId: transfer._id, status: "source_released" as const };
    }
    if (
      args.sourceReleaseNote !== undefined &&
      (!args.sourceReleaseNote.trim() || args.sourceReleaseNote.length > 500)
    )
      throw new ConvexError("Release note requires 1–500 characters");
    if (!transfer.guardianConsentRecorded)
      throw new ConvexError("Guardian consent is required for release");
    if (transfer.status !== "initiated") {
      throw new ConvexError(
        `Cannot authorize release: transfer is in status '${transfer.status}', expected 'initiated'`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(transfer._id, {
      status: "source_released",
      sourceReleaseNote: args.sourceReleaseNote,
      sourceReleasedByUserId: authContext.userId,
      sourceReleasedAt: now,
      updatedAt: now,
    });

    // Immutable audit logging
    await recordAuditEventHelper(ctx, {
      schoolId: transfer.sourceSchoolId,
      groupId: transfer.groupId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "enrollment",
      action: "student_transfer.source_release",
      targetType: "studentTransfers",
      targetId: transfer._id,
      outcome: "success",
      safeSummary: `Authorized source branch release for student ${transfer.studentName}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });

    return {
      transferId: transfer._id,
      status: "source_released" as const,
    };
  },
});

/**
 * Phase 2: Accept Destination Transfer.
 *
 * Enforces:
 * 1. Authority over destination branch.
 * 2. Transfer status must be "source_released" (two-phase commit).
 * 3. Target destinationClassId must exist in destination school branch.
 * 4. Allocates destination branch admission number via policy sequence.
 * 5. Preserves the source student row and creates a destination student context.
 * 6. Transitions transfer status to "completed".
 * 7. Logs audit event.
 */
export const acceptDestinationTransfer = mutation({
  args: {
    transferId: v.id("studentTransfers"),
    destinationClassId: v.id("classes"),
    destinationSessionId: v.optional(v.id("academicSessions")),
    expectedPolicyVersion: v.optional(v.number()),
    expectedFormatVersion: v.optional(v.string()),
    expectedCounterKey: v.optional(v.string()),
    expectedCounterVersion: v.optional(v.number()),
    expectedResetPeriod: v.optional(v.string()),
    expectedAdmissionNumber: v.optional(v.string()),
    expectedSequenceNumber: v.optional(v.number()),
    advanceCounterTo: v.optional(v.number()),
    admissionNumberOverride: v.optional(v.string()),
    admissionNumberOverrideReason: v.optional(v.string()),
    admissionNumberOverrideConfirmed: v.optional(v.boolean()),
    admissionNumberCounterDecision: v.optional(
      v.union(v.literal("keep"), v.literal("advance")),
    ),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new ConvexError("Transfer record not found");
    }

    const authContext = await assertTransferAuthority(
      ctx,
      transfer.destinationSchoolId,
    );
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
    );
    const acceptanceIntent = JSON.stringify([
      args.destinationClassId,
      args.destinationSessionId,
      args.expectedPolicyVersion,
      args.expectedFormatVersion,
      args.expectedCounterKey,
      args.expectedCounterVersion,
      args.expectedResetPeriod,
      args.expectedAdmissionNumber,
      args.expectedSequenceNumber,
      args.admissionNumberOverride?.trim(),
      args.admissionNumberOverrideReason,
      args.admissionNumberOverrideConfirmed,
      args.admissionNumberCounterDecision,
      args.advanceCounterTo,
    ]);
    if (
      transfer.status === "completed" &&
      transfer.acceptanceIntent === acceptanceIntent &&
      transfer.destinationStudentId &&
      transfer.destinationAdmissionNumber
    ) {
      return {
        transferId: transfer._id,
        status: "completed" as const,
        destinationStudentId: transfer.destinationStudentId,
        destinationAdmissionNumber: transfer.destinationAdmissionNumber,
      };
    }

    // Two-Phase Commit Hard Gate: Must be released by source branch first
    if (transfer.status !== "source_released") {
      throw new ConvexError(
        `Cannot accept transfer: transfer is in status '${transfer.status}', expected 'source_released'`,
      );
    }

    // Verify destination class belongs to destination branch
    const destClass = await ctx.db.get(args.destinationClassId);
    if (
      !destClass ||
      destClass.isArchived ||
      destClass.schoolId !== transfer.destinationSchoolId
    ) {
      throw new ConvexError(
        "Destination class not found or does not belong to destination school branch",
      );
    }

    const active = await ctx.db
      .query("academicSessions")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", transfer.destinationSchoolId).eq("isActive", true),
      )
      .filter((q) => q.neq(q.field("isArchived"), true))
      .take(2);
    if (
      active.length !== 1 ||
      (args.destinationSessionId && args.destinationSessionId !== active[0]._id)
    ) {
      throw new ConvexError(
        "Select the destination's one active academic session; refresh stale proposals",
      );
    }
    const destinationSessionId = active[0]._id;
    if (
      args.advanceCounterTo !== undefined &&
      !args.admissionNumberOverride?.trim()
    )
      throw new ConvexError("Counter advancement requires a manual override");

    let destinationAdmissionNumber: string;
    const manualAdmissionNumber = args.admissionNumberOverride?.trim();
    if (manualAdmissionNumber) {
      await requireCapability(
        ctx,
        transfer.destinationSchoolId,
        "enrollment.admissions.override_number",
      );
      if (!args.admissionNumberOverrideConfirmed) {
        throw new ConvexError(
          "Manual admission number override must be explicitly confirmed",
        );
      }
      if (!args.admissionNumberOverrideReason?.trim()) {
        throw new ConvexError(
          "Manual admission number override requires a reason",
        );
      }
      await commitManualAdmissionNumberHelper(ctx, {
        schoolId: transfer.destinationSchoolId,
        level: destClass.level,
        number: manualAdmissionNumber,
        reason: args.admissionNumberOverrideReason,
        confirmed: args.admissionNumberOverrideConfirmed,
        counterDecision: args.admissionNumberCounterDecision,
        advanceTo: args.advanceCounterTo,
        expectedVersion: args.expectedPolicyVersion,
        expectedFormatVersion: args.expectedFormatVersion,
        expectedCounterKey: args.expectedCounterKey,
        expectedCounterVersion: args.expectedCounterVersion,
        expectedSessionId: args.destinationSessionId,
        expectedResetPeriod: args.expectedResetPeriod,
      });
      destinationAdmissionNumber = manualAdmissionNumber;
    } else {
      if (
        args.expectedPolicyVersion === undefined ||
        !args.expectedFormatVersion ||
        !args.expectedCounterKey ||
        args.expectedCounterVersion === undefined ||
        args.destinationSessionId === undefined ||
        !args.expectedResetPeriod ||
        !args.expectedAdmissionNumber ||
        args.expectedSequenceNumber === undefined
      ) {
        throw new ConvexError("Automatic acceptance requires the complete reviewed numbering proposal");
      }
      const allocation = await allocateNextAdmissionNumberHelper(ctx, {
        schoolId: transfer.destinationSchoolId,
        level: destClass.level,
        expectedVersion: args.expectedPolicyVersion,
        expectedFormatVersion: args.expectedFormatVersion,
        expectedCounterKey: args.expectedCounterKey,
        expectedCounterVersion: args.expectedCounterVersion,
        expectedSessionId: args.destinationSessionId,
        expectedResetPeriod: args.expectedResetPeriod,
      });
      if (
        allocation.allocatedNumber !== args.expectedAdmissionNumber ||
        allocation.sequenceNumber !== args.expectedSequenceNumber
      ) {
        throw new ConvexError("Admission number proposal changed; refresh and review again");
      }
      destinationAdmissionNumber = allocation.allocatedNumber;
    }

    const sourceStudent = await ctx.db.get(transfer.studentId);
    if (
      !sourceStudent ||
      sourceStudent.schoolId !== transfer.sourceSchoolId ||
      sourceStudent.isArchived ||
      (sourceStudent.enrollmentStatus &&
        sourceStudent.enrollmentStatus !== "active")
    ) {
      throw new ConvexError(
        "Source student record is unavailable for transfer",
      );
    }
    if (!transfer.sourceStudentUserId)
      throw new ConvexError("Legacy transfer lacks a reviewed source identity; cancel and restart the transfer");
    const sourceStudentUser = await ctx.db.get(sourceStudent.userId);
    if (
      sourceStudent.userId !== transfer.sourceStudentUserId ||
      !sourceStudentUser ||
      sourceStudentUser.schoolId !== transfer.sourceSchoolId ||
      sourceStudentUser.role !== "student" ||
      sourceStudentUser.isArchived
    ) {
      throw new ConvexError(
        "Source student account changed after review; restart the transfer",
      );
    }
    const canonicalIdentity = await resolveTransferStudentIdentity(ctx, {
      sourceUser: sourceStudentUser,
      sourceSchoolId: transfer.sourceSchoolId,
      destinationSchoolId: transfer.destinationSchoolId,
    });

    const now = Date.now();
    const destinationUserWasCreated = !canonicalIdentity.destinationUser;
    const destinationUserWasArchived = canonicalIdentity.destinationUser?.isArchived === true;
    const destinationUserPriorArchivedAt = canonicalIdentity.destinationUser?.archivedAt;
    const destinationUserPriorArchivedBy = canonicalIdentity.destinationUser?.archivedBy;
    let destinationStudentUserId = canonicalIdentity.destinationUser?._id;
    const existingDestinationUserId = destinationStudentUserId;
    if (existingDestinationUserId) {
      const existingEnrollments = await ctx.db
        .query("students")
        .withIndex("by_school_and_user", (q) =>
          q
            .eq("schoolId", transfer.destinationSchoolId)
            .eq("userId", existingDestinationUserId),
        )
        .take(101);
      if (existingEnrollments.length > 100) {
        throw new ConvexError(
          "Canonical student enrollment history exceeds supported bounds; reviewed repair required",
        );
      }
      if (
        existingEnrollments.some(
          (student) =>
            !student.isArchived && student.enrollmentStatus === "active",
        )
      ) {
        throw new ConvexError(
          "Canonical student already has an active destination enrollment; reviewed repair required",
        );
      }
      await ctx.db.patch(existingDestinationUserId, {
        isArchived: false,
        archivedAt: undefined,
        archivedBy: undefined,
        updatedAt: now,
      });
    } else {
      destinationStudentUserId = await ctx.db.insert("users", {
        schoolId: transfer.destinationSchoolId,
        // authId is a compatibility projection, never a new credential owner.
        authId: sourceStudentUser.authId,
        authTokenIdentifier: canonicalIdentity.tokenIdentifier,
        personId: canonicalIdentity.person._id,
        name: sourceStudentUser.name,
        ...(sourceStudentUser.firstName
          ? { firstName: sourceStudentUser.firstName }
          : {}),
        ...(sourceStudentUser.lastName
          ? { lastName: sourceStudentUser.lastName }
          : {}),
        email: sourceStudentUser.email,
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
    }
    if (!destinationStudentUserId) {
      throw new ConvexError("Destination student projection was not created");
    }
    const destinationMemberships = await ctx.db.query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", canonicalIdentity.person._id).eq("schoolId", transfer.destinationSchoolId))
      .take(2);
    if (destinationMemberships.length > 1)
      throw new ConvexError("Destination canonical membership is ambiguous; reviewed repair required");
    const destinationMembershipWasCreated = !destinationMemberships[0];
    const destinationMembershipPriorStatus = destinationMemberships[0]?.status;
    const destinationMembershipPriorLegacyUserId = destinationMemberships[0]?.legacyUserId;
    if (destinationMemberships[0]) {
      await ctx.db.patch(destinationMemberships[0]._id, {
        status: "active",
        legacyUserId: destinationStudentUserId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("branchMemberships", {
        personId: canonicalIdentity.person._id,
        schoolId: transfer.destinationSchoolId,
        status: "active",
        isDefaultBranch: false,
        legacyUserId: destinationStudentUserId,
        joinedAt: now,
        updatedAt: now,
      });
    }
    const destinationStudentId = await ctx.db.insert("students", {
      schoolId: transfer.destinationSchoolId,
      classId: args.destinationClassId,
      userId: destinationStudentUserId,
      admissionNumber: destinationAdmissionNumber,
      ...(sourceStudent.gender ? { gender: sourceStudent.gender } : {}),
      ...(sourceStudent.dateOfBirth
        ? { dateOfBirth: sourceStudent.dateOfBirth }
        : {}),
      enrollmentStatus: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Preserve the source row and all source-scoped records as historical evidence.
    await ctx.db.patch(sourceStudent._id, {
      enrollmentStatus: "transferred_out",
      updatedAt: now,
    });
    await ctx.db.patch(sourceStudentUser._id, {
      isArchived: true,
      archivedAt: now,
      archivedBy: authContext.userId,
      updatedAt: now,
    });

    // Mark transfer as completed
    await ctx.db.patch(transfer._id, {
      status: "completed",
      acceptanceIntent,
      destinationSessionId,
      destinationClassName: destClass.name,
      destinationSessionName: active[0].name,
      destinationClassId: args.destinationClassId,
      destinationStudentId,
      destinationAdmissionNumber,
      destinationUserWasCreated,
      destinationUserWasArchived,
      destinationUserPriorArchivedAt,
      destinationUserPriorArchivedBy,
      destinationMembershipWasCreated,
      destinationMembershipPriorStatus,
      destinationMembershipPriorLegacyUserId,
      destinationAcceptedByUserId: authContext.userId,
      destinationAcceptedAt: now,
      updatedAt: now,
    });

    // Audit logging at destination branch
    await recordAuditEventHelper(ctx, {
      schoolId: transfer.destinationSchoolId,
      groupId: transfer.groupId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "enrollment",
      action: "student_transfer.destination_accept",
      targetType: "studentTransfers",
      targetId: transfer._id,
      outcome: "success",
      safeSummary:
        `Accepted transfer for student ${transfer.studentName} into class ${destClass.name} with admission number ${destinationAdmissionNumber}` +
        (manualAdmissionNumber
          ? ` via confirmed manual override: ${args.admissionNumberOverrideReason!.trim()}`
          : ""),
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });

    return {
      transferId: transfer._id,
      status: "completed" as const,
      destinationStudentId,
      destinationAdmissionNumber,
    };
  },
});

export const reverseCompletedTransfer = mutation({
  args: {
    transferId: v.id("studentTransfers"),
    reason: v.string(),
    confirmation: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirmation !== "REVERSE COMPLETED TRANSFER")
      throw new ConvexError("Type REVERSE COMPLETED TRANSFER to confirm this correction");
    const reason = args.reason.trim();
    if (reason.length < 12 || reason.length > 500)
      throw new ConvexError("A 12–500 character correction reason is required");
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer || transfer.status !== "completed" || !transfer.destinationStudentId)
      throw new ConvexError("Only a completed transfer can be reversed");
    const [sourceAuthority, destinationAuthority] = await Promise.all([
      assertTransferAuthority(ctx, transfer.sourceSchoolId),
      assertTransferAuthority(ctx, transfer.destinationSchoolId),
    ]);
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
      false,
    );
    const [sourceStudent, destinationStudent] = await Promise.all([
      ctx.db.get(transfer.studentId),
      ctx.db.get(transfer.destinationStudentId),
    ]);
    if (
      !sourceStudent || sourceStudent.schoolId !== transfer.sourceSchoolId ||
      sourceStudent.enrollmentStatus !== "transferred_out" ||
      !destinationStudent || destinationStudent.schoolId !== transfer.destinationSchoolId ||
      destinationStudent.isArchived || destinationStudent.enrollmentStatus !== "active"
    ) throw new ConvexError("Transfer enrollment state changed; reviewed repair is required");
    const [sourceUser, destinationUser] = await Promise.all([
      ctx.db.get(sourceStudent.userId),
      ctx.db.get(destinationStudent.userId),
    ]);
    if (
      !sourceUser || !destinationUser ||
      sourceUser.personId === undefined ||
      sourceUser.personId !== destinationUser.personId
    ) throw new ConvexError("Canonical transfer identity changed; reviewed repair is required");
    const [sourceMemberships, destinationMemberships, otherDestinationEnrollments] = await Promise.all([
      ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) =>
        q.eq("personId", sourceUser.personId!).eq("schoolId", transfer.sourceSchoolId)).take(2),
      ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) =>
        q.eq("personId", sourceUser.personId!).eq("schoolId", transfer.destinationSchoolId)).take(2),
      ctx.db.query("students").withIndex("by_school_and_user", (q) =>
        q.eq("schoolId", transfer.destinationSchoolId).eq("userId", destinationStudent.userId)).take(2),
    ]);
    if (sourceMemberships.length !== 1 || destinationMemberships.length !== 1)
      throw new ConvexError("Canonical branch membership is missing or ambiguous; reviewed repair is required");
    if (otherDestinationEnrollments.some((student) =>
      student._id !== destinationStudent._id && !student.isArchived && student.enrollmentStatus === "active"))
      throw new ConvexError("Another active destination enrollment prevents automatic reversal");
    const now = Date.now();
    await ctx.db.patch(destinationStudent._id, {
      isArchived: true,
      enrollmentStatus: "transferred_out",
      updatedAt: now,
    });
    await ctx.db.patch(destinationUser._id, transfer.destinationUserWasCreated !== false
      ? {
          isArchived: true,
          archivedAt: now,
          archivedBy: destinationAuthority.userId,
          updatedAt: now,
        }
      : {
          isArchived: transfer.destinationUserWasArchived,
          archivedAt: transfer.destinationUserPriorArchivedAt,
          archivedBy: transfer.destinationUserPriorArchivedBy,
          updatedAt: now,
        });
    await ctx.db.patch(destinationMemberships[0]._id, transfer.destinationMembershipWasCreated !== false
      ? { status: "suspended", legacyUserId: undefined, updatedAt: now }
      : {
          status: transfer.destinationMembershipPriorStatus ?? "active",
          legacyUserId: transfer.destinationMembershipPriorLegacyUserId,
          updatedAt: now,
        });
    await ctx.db.patch(sourceStudent._id, { enrollmentStatus: "active", isArchived: false, updatedAt: now });
    await ctx.db.patch(sourceUser._id, {
      isArchived: false,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: now,
    });
    await ctx.db.patch(sourceMemberships[0]._id, { status: "active", updatedAt: now });
    await ctx.db.patch(transfer._id, {
      status: "cancelled",
      cancellationReason: `Completed transfer reversed: ${reason}`,
      reversedAt: now,
      reversedByUserId: destinationAuthority.userId ?? sourceAuthority.userId,
      reversalReason: reason,
      updatedAt: now,
    });
    for (const schoolId of [transfer.sourceSchoolId, transfer.destinationSchoolId]) {
      await recordAuditEventHelper(ctx, {
        schoolId,
        groupId: transfer.groupId,
        actorKind: destinationAuthority.isPlatformAdmin ? "platform_admin" : "user",
        actorPersonId: destinationAuthority.personId,
        actorMembershipId: destinationAuthority.membershipId,
        actorEmailSnapshot: destinationAuthority.role ?? "transfer operator",
        module: "enrollment",
        action: "student_transfer.completed_reversed",
        targetType: "studentTransfers",
        targetId: transfer._id,
        outcome: "success",
        safeSummary: "Completed within-group transfer reversed after dual-branch authorization; admission-number history remains reserved",
        retentionClass: "permanent_statutory",
        alertTier: "tier1_critical",
      });
    }
    return { transferId: transfer._id, status: "cancelled" as const, reversedAt: now };
  },
});

/**
 * Abort Transfer (Cancellation or Rejection).
 *
 * Can be called by:
 * - Source branch authority -> status transitions to "cancelled"
 * - Destination branch authority -> status transitions to "rejected"
 *
 * Source enrollment is not modified by release or abort.
 */
export const rejectOrCancelTransfer = mutation({
  args: {
    transferId: v.id("studentTransfers"),
    reason: v.string(),
    action: v.optional(v.union(v.literal("cancelled"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new ConvexError("Transfer record not found");
    }
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
      false,
    );

    // Resolve caller authority: check destination branch first, then source branch
    let actingSchoolId: Id<"schools">;
    let authContext: ActiveMembershipContext;
    let newStatus: "cancelled" | "rejected";

    try {
      if (args.action === "cancelled")
        throw new ConvexError("Source action requested");
      authContext = await assertTransferAuthority(
        ctx,
        transfer.destinationSchoolId,
      );
      actingSchoolId = transfer.destinationSchoolId;
      newStatus = "rejected";
    } catch {
      if (args.action === "rejected")
        throw new ConvexError("Not authorized to reject in destination branch");
      try {
        authContext = await assertTransferAuthority(
          ctx,
          transfer.sourceSchoolId,
        );
        actingSchoolId = transfer.sourceSchoolId;
        newStatus = "cancelled";
      } catch {
        throw new ConvexError(
          "Not authorized: Must hold transfer authority in source or destination branch",
        );
      }
    }

    if (!args.reason.trim() || args.reason.length > 500)
      throw new ConvexError(
        "A reason of 1–500 characters must be provided to abort a transfer",
      );
    if (
      transfer.status === newStatus &&
      transfer.cancellationReason === args.reason
    )
      return { transferId: transfer._id, status: newStatus };
    if (
      transfer.status !== "initiated" &&
      transfer.status !== "source_released"
    )
      throw new ConvexError("Transfer is already finalized");
    const now = Date.now();
    // Release never changes source enrollment; cancellation must not overwrite later source edits.

    // Update transfer status
    await ctx.db.patch(transfer._id, {
      status: newStatus,
      cancellationReason: args.reason,
      updatedAt: now,
    });

    // Record audit event
    await recordAuditEventHelper(ctx, {
      schoolId: actingSchoolId,
      groupId: transfer.groupId,
      actorKind: authContext.isPlatformAdmin ? "platform_admin" : "user",
      actorPersonId: authContext.personId,
      actorMembershipId: authContext.membershipId,
      actorEmailSnapshot: authContext.role ?? "user@school",
      module: "enrollment",
      action: `student_transfer.${newStatus}`,
      targetType: "studentTransfers",
      targetId: transfer._id,
      outcome: "success",
      safeSummary: `${newStatus === "rejected" ? "Rejected" : "Cancelled"} transfer ${transfer._id}; reason retained in scoped transfer history`,
      retentionClass: "permanent_statutory",
      alertTier: "tier3_info",
    });

    return {
      transferId: transfer._id,
      status: newStatus,
    };
  },
});

/**
 * Get transfer record by ID.
 */
export const getTransfer = query({
  args: {
    transferId: v.id("studentTransfers"),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      return null;
    }
    const scope = await getAuthorizedTransferScope(ctx, transfer);
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
      false,
    );
    return redactTransferForScope(transfer, scope);
  },
});

/**
 * List transfers for a school branch (as source, destination, or either).
 */
export const listTransfersBySchool = query({
  args: {
    schoolId: v.id("schools"),
    direction: v.union(v.literal("source"), v.literal("destination")),
    status: v.optional(
      v.union(
        v.literal("initiated"),
        v.literal("source_released"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rejected"),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertTransferAuthority(ctx, args.schoolId);

    const page = args.direction === "source"
      ? args.status
        ? await ctx.db
            .query("studentTransfers")
            .withIndex("by_source_school_and_status", (q) =>
              q.eq("sourceSchoolId", args.schoolId).eq("status", args.status!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("studentTransfers")
            .withIndex("by_source_school", (q) =>
              q.eq("sourceSchoolId", args.schoolId),
            )
            .order("desc")
            .paginate(args.paginationOpts)
      : args.status
        ? await ctx.db
            .query("studentTransfers")
            .withIndex("by_destination_school_and_status", (q) =>
              q.eq("destinationSchoolId", args.schoolId).eq("status", args.status!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("studentTransfers")
            .withIndex("by_destination_school", (q) =>
              q.eq("destinationSchoolId", args.schoolId),
            )
            .order("desc")
            .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((record) =>
        redactTransferForScope(record, args.direction),
      ),
    };
  },
});

/**
 * List transfers for a school group.
 */
export const listTransfersByGroup = query({
  args: {
    groupId: v.id("schoolGroups"),
    status: v.optional(
      v.union(
        v.literal("initiated"),
        v.literal("source_released"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rejected"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await assertGroupTransferAuthority(ctx, args.groupId);

    const records = args.status
      ? await ctx.db
          .query("studentTransfers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", args.groupId).eq("status", args.status!),
          )
          .take(501)
      : await ctx.db
          .query("studentTransfers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", args.groupId),
          )
          .take(501);

    if (records.length > 500)
      throw new ConvexError(
        "Group transfer list exceeds supported bounds; use branch history",
      );
    const visible = [];
    for (const record of records.sort((a, b) => b.createdAt - a.createdAt)) {
      try {
        visible.push(
          redactTransferForScope(
            record,
            await getAuthorizedTransferScope(ctx, record),
          ),
        );
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
      }
    }
    return visible;
  },
});

/**
 * Get transfer history for a specific student.
 */
export const getStudentTransferHistory = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    const studentId = ctx.db.normalizeId("students", args.studentId);
    if (!studentId) return [];
    const student = await ctx.db.get(studentId);
    if (!student) return [];
    await assertTransferAuthority(ctx, student.schoolId);
    await assertTransferPilotForSchool(ctx, student.schoolId);
    const queue: Id<"students">[] = [student._id];
    const visited = new Set<string>();
    const visible = new Map<
      string,
      ReturnType<typeof redactTransferForScope>
    >();
    while (queue.length) {
      const studentId = queue.shift();
      if (!studentId || visited.has(studentId)) continue;
      if (visited.size >= 100)
        throw new ConvexError(
          "Transfer history exceeds supported 100 enrollment contexts",
        );
      visited.add(studentId);
      const [outgoing, incoming] = await Promise.all([
        ctx.db
          .query("studentTransfers")
          .withIndex("by_student", (q) => q.eq("studentId", studentId))
          .take(101),
        ctx.db
          .query("studentTransfers")
          .withIndex("by_destination_student", (q) =>
            q.eq("destinationStudentId", studentId),
          )
          .take(101),
      ]);
      if (outgoing.length > 100 || incoming.length > 100)
        throw new ConvexError("Transfer history exceeds supported bounds");
      for (const transfer of [...outgoing, ...incoming]) {
        let scope: TransferScope;
        try {
          scope = await getAuthorizedTransferScope(ctx, transfer);
        } catch (error) {
          if (!(error instanceof ConvexError)) throw error;
          continue;
        }
        visible.set(transfer._id, redactTransferForScope(transfer, scope));
        queue.push(transfer.studentId);
        if (transfer.destinationStudentId)
          queue.push(transfer.destinationStudentId);
      }
    }
    return [...visible.values()].sort((a, b) => b.createdAt - a.createdAt);
  },
});

async function resolveTransferStudentIdentity(
  ctx: MutationCtx,
  args: {
    sourceUser: Doc<"users">;
    sourceSchoolId: Id<"schools">;
    destinationSchoolId: Id<"schools">;
  },
) {
  if (!args.sourceUser.personId || !args.sourceUser.authTokenIdentifier) {
    throw new ConvexError(
      "Student identity requires reviewed canonical person and source membership repair before transfer acceptance",
    );
  }
  const person = await ctx.db.get(args.sourceUser.personId);
  if (
    !person ||
    person.status !== "active" ||
    person.identityReconciliationState === "reconciliation_required" ||
    !person.authTokenIdentifier ||
    person.authTokenIdentifier !== args.sourceUser.authTokenIdentifier
  ) {
    throw new ConvexError(
      "Student canonical identity is inactive or inconsistent; reviewed repair required",
    );
  }
  const sourceMemberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_school", (q) =>
      q.eq("personId", person._id).eq("schoolId", args.sourceSchoolId),
    )
    .take(2);
  if (
    sourceMemberships.length !== 1 ||
    sourceMemberships[0].status !== "active" ||
    sourceMemberships[0].legacyUserId !== args.sourceUser._id
  ) {
    throw new ConvexError(
      "Student source membership requires reviewed canonical repair before transfer acceptance",
    );
  }

  const destinationMemberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_school", (q) =>
      q.eq("personId", person._id).eq("schoolId", args.destinationSchoolId),
    )
    .take(2);
  if (destinationMemberships.length > 1) {
    throw new ConvexError(
      "Ambiguous destination membership; reviewed repair required",
    );
  }
  const destinationMembership = destinationMemberships[0];
  if (!destinationMembership)
    return {
      person,
      tokenIdentifier: person.authTokenIdentifier,
      destinationUser: null,
    };
  if (
    destinationMembership.status !== "active" ||
    !destinationMembership.legacyUserId
  ) {
    throw new ConvexError(
      "Destination membership is inactive or incomplete; reviewed repair required",
    );
  }
  const destinationUser = await ctx.db.get(destinationMembership.legacyUserId);
  if (
    !destinationUser ||
    destinationUser.schoolId !== args.destinationSchoolId ||
    destinationUser.personId !== person._id ||
    destinationUser.authTokenIdentifier !== person.authTokenIdentifier ||
    destinationUser.role !== "student"
  ) {
    throw new ConvexError(
      "Destination portal projection is inconsistent; reviewed repair required",
    );
  }
  return {
    person,
    tokenIdentifier: person.authTokenIdentifier,
    destinationUser,
  };
}

async function assertActiveTransferGroup(
  ctx: QueryCtx | MutationCtx,
  sourceSchoolId: Id<"schools">,
  destinationSchoolId: Id<"schools">,
  groupId: Id<"schoolGroups">,
  requirePilotEnabled = true,
) {
  const [source, destination, group, sourceLink, destinationLink] =
    await Promise.all([
      ctx.db.get(sourceSchoolId),
      ctx.db.get(destinationSchoolId),
      ctx.db.get(groupId),
      ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", sourceSchoolId))
        .unique(),
      ctx.db
        .query("schoolGroupBranches")
        .withIndex("by_school", (q) => q.eq("schoolId", destinationSchoolId))
        .unique(),
    ]);
  if (
    sourceSchoolId === destinationSchoolId ||
    !source ||
    (source.status !== undefined && source.status !== "active") ||
    !destination ||
    (destination.status !== undefined && destination.status !== "active") ||
    group?.status !== "active" ||
    (requirePilotEnabled && group.studentTransfersEnabled !== true) ||
    sourceLink?.groupId !== groupId ||
    destinationLink?.groupId !== groupId
  ) {
    throw new ConvexError(
      "Transfer requires two active branches in the same active school group with the transfer pilot enabled",
    );
  }
}

async function hasOpenTransferForSchool(ctx: QueryCtx, schoolId: Id<"schools">): Promise<boolean> {
  const rows = await Promise.all([
    ctx.db.query("studentTransfers").withIndex("by_source_school_and_status", (q) =>
      q.eq("sourceSchoolId", schoolId).eq("status", "initiated")).first(),
    ctx.db.query("studentTransfers").withIndex("by_source_school_and_status", (q) =>
      q.eq("sourceSchoolId", schoolId).eq("status", "source_released")).first(),
    ctx.db.query("studentTransfers").withIndex("by_destination_school_and_status", (q) =>
      q.eq("destinationSchoolId", schoolId).eq("status", "initiated")).first(),
    ctx.db.query("studentTransfers").withIndex("by_destination_school_and_status", (q) =>
      q.eq("destinationSchoolId", schoolId).eq("status", "source_released")).first(),
  ]);
  return rows.some(Boolean);
}

export const getTransferPilotAccess = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    try {
      await assertTransferAuthority(ctx, schoolId);
      try {
        await assertTransferPilotForSchool(ctx, schoolId);
        return { allowed: true as const, rollbackOnly: false as const };
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        return await hasOpenTransferForSchool(ctx, schoolId)
          ? { allowed: true as const, rollbackOnly: true as const }
          : { allowed: false as const, rollbackOnly: false as const };
      }
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return { allowed: false as const, rollbackOnly: false as const };
    }
  },
});

/** Dedicated, minimized proposal seam: group membership exposes destination names, not rosters or dossiers. */
export const getTransferWorkspace = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, { schoolId }) => {
    try {
      await assertTransferAuthority(ctx, schoolId);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return { allowed: false as const };
    }
    let pilotEnabled = true;
    try {
      await assertTransferPilotForSchool(ctx, schoolId);
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      pilotEnabled = false;
    }
    const school = await ctx.db.get(schoolId);
    if (!pilotEnabled) {
      if (!await hasOpenTransferForSchool(ctx, schoolId)) return { allowed: false as const };
      return {
        allowed: true as const,
        rollbackOnly: true as const,
        schoolName: school?.name ?? "Current branch",
        destinations: [],
        canOverrideNumber: false,
        classes: [],
        sessions: [],
      };
    }
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    const branches = group
      ? await ctx.db
          .query("schoolGroupBranches")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .take(101)
      : [];
    if (branches.length > 100)
      throw new ConvexError(
        "Group directory exceeds the supported 100 branches",
      );
    const destinations: { _id: Id<"schools">; name: string }[] = [];
    for (const branch of branches) {
      const target = await ctx.db.get(branch.schoolId);
      if (
        target &&
        target._id !== schoolId &&
        (target.status === undefined || target.status === "active")
      ) destinations.push({ _id: target._id, name: target.name });
    }
    const legacyActiveClasses = await ctx.db
      .query("classes")
      .withIndex("by_school_and_archived", (q) =>
        q.eq("schoolId", schoolId).eq("isArchived", undefined),
      )
      .take(501);
    const currentActiveClasses = legacyActiveClasses.length > 500
      ? []
      : await ctx.db
          .query("classes")
          .withIndex("by_school_and_archived", (q) =>
            q.eq("schoolId", schoolId).eq("isArchived", false),
          )
          .take(501 - legacyActiveClasses.length);
    const classes = [...legacyActiveClasses, ...currentActiveClasses];
    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school_active", (q) =>
        q.eq("schoolId", schoolId).eq("isActive", true),
      )
      .filter((q) => q.neq(q.field("isArchived"), true))
      .take(101);
    if (classes.length > 500 || sessions.length > 100)
      throw new ConvexError("School directory exceeds supported bounds");
    let canOverrideNumber = false;
    try {
      await requireCapability(
        ctx,
        schoolId,
        "enrollment.admissions.override_number",
      );
      canOverrideNumber = true;
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
    }
    return {
      allowed: true as const,
      schoolName: school?.name ?? "Current branch",
      destinations,
      canOverrideNumber,
      classes: classes
        .filter((c) => !c.isArchived)
        .map((c) => ({ _id: c._id, name: c.name, level: c.level })),
      sessions: sessions
        .filter((s) => s.isActive && !s.isArchived)
        .map((s) => ({ _id: s._id, name: s.name })),
    };
  },
});

export const listTransferCandidates = query({
  args: { schoolId: v.id("schools"), classId: v.id("classes") },
  handler: async (ctx, args) => {
    await assertTransferAuthority(ctx, args.schoolId);
    await assertTransferPilotForSchool(ctx, args.schoolId);
    const classroom = await ctx.db.get(args.classId);
    if (
      !classroom ||
      classroom.schoolId !== args.schoolId ||
      classroom.isArchived
    )
      throw new ConvexError("Class unavailable in this branch");
    const activeStates = [
      [undefined, undefined],
      [undefined, "active" as const],
      [false, undefined],
      [false, "active" as const],
    ] as const;
    const pages = await Promise.all(activeStates.map(([isArchived, enrollmentStatus]) =>
      ctx.db
        .query("students")
        .withIndex("by_school_class_archived_enrollment", (q) =>
          q.eq("schoolId", args.schoolId)
            .eq("classId", args.classId)
            .eq("isArchived", isArchived)
            .eq("enrollmentStatus", enrollmentStatus),
        )
        .take(501),
    ));
    const rows = pages.flat();
    if (rows.length > 500)
      throw new ConvexError("Class exceeds supported 500-student selector");
    const candidates = [];
    for (const student of rows) {
      if (
        student.schoolId !== args.schoolId ||
        student.isArchived ||
        (student.enrollmentStatus && student.enrollmentStatus !== "active")
      )
        continue;
      const user = await ctx.db.get(student.userId);
      if (
        !user ||
        user.schoolId !== args.schoolId ||
        user.isArchived ||
        user.role !== "student"
      )
        continue;
      candidates.push({
        _id: student._id,
        name: user.name,
        admissionNumber: student.admissionNumber,
      });
    }
    return candidates;
  },
});

export const previewTransferNumber = query({
  args: { schoolId: v.id("schools"), classId: v.id("classes") },
  handler: async (ctx, args) => {
    await assertTransferAuthority(ctx, args.schoolId);
    await assertTransferPilotForSchool(ctx, args.schoolId);
    const classroom = await ctx.db.get(args.classId);
    if (
      !classroom ||
      classroom.schoolId !== args.schoolId ||
      classroom.isArchived
    )
      throw new ConvexError("Class unavailable in this branch");
    try {
      return {
        available: true as const,
        ...(await proposeAdmissionNumberHelper(ctx, {
          schoolId: args.schoolId,
          level: classroom.level,
        })),
      };
    } catch (error) {
      if (!(error instanceof ConvexError)) throw error;
      return {
        available: false as const,
        message:
          "Configure destination numbering and one active session before automatic acceptance.",
      };
    }
  },
});
