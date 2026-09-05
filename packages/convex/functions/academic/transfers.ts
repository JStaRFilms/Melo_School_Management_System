import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
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

    // Check for existing active transfer
    const existingTransfers = await ctx.db
      .query("studentTransfers")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .take(501);

    if (existingTransfers.length > 500)
      throw new ConvexError(
        "Student transfer history exceeds supported bounds",
      );
    const hasActiveTransfer = existingTransfers.some(
      (t) => t.status === "initiated" || t.status === "source_released",
    );
    if (hasActiveTransfer) {
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
    const studentName = studentUser?.name ?? "Student";

    const currentClass = await ctx.db.get(student.classId);
    const academicHistorySummary =
      args.academicHistorySummary ??
      (currentClass
        ? `Enrolled in ${currentClass.name} with admission number ${student.admissionNumber}`
        : `Admission number ${student.admissionNumber}`);

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
    if (
      transfer.sourceReleasedAt &&
      transfer.sourceReleaseNote === args.sourceReleaseNote
    ) {
      return { transferId: transfer._id, status: "source_released" as const };
    }
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
    );
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
    advanceCounterTo: v.optional(v.number()),
    admissionNumberOverride: v.optional(v.string()),
    admissionNumberOverrideReason: v.optional(v.string()),
    admissionNumberOverrideConfirmed: v.optional(v.boolean()),
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
    const acceptanceIntent = JSON.stringify([
      args.destinationClassId,
      args.destinationSessionId,
      args.expectedPolicyVersion,
      args.admissionNumberOverride?.trim(),
      args.admissionNumberOverrideReason,
      args.admissionNumberOverrideConfirmed,
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
    await assertActiveTransferGroup(
      ctx,
      transfer.sourceSchoolId,
      transfer.destinationSchoolId,
      transfer.groupId,
    );

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

    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q) =>
        q.eq("schoolId", transfer.destinationSchoolId),
      )
      .take(101);
    const active = sessions.filter(
      (session) => session.isActive && !session.isArchived,
    );
    if (
      sessions.length > 100 ||
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
        number: manualAdmissionNumber,
        reason: args.admissionNumberOverrideReason,
        confirmed: args.admissionNumberOverrideConfirmed,
        advanceTo: args.advanceCounterTo,
      });
      destinationAdmissionNumber = manualAdmissionNumber;
    } else {
      const { allocatedNumber } = await allocateNextAdmissionNumberHelper(ctx, {
        schoolId: transfer.destinationSchoolId,
        level: destClass.level,
        expectedVersion: args.expectedPolicyVersion,
      });
      destinationAdmissionNumber = allocatedNumber;
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
    const sourceStudentUser = await ctx.db.get(sourceStudent.userId);
    if (!sourceStudentUser || sourceStudentUser.isArchived) {
      throw new ConvexError(
        "Source student account is unavailable for transfer",
      );
    }

    const now = Date.now();
    const destinationStudentUserId = await ctx.db.insert("users", {
      schoolId: transfer.destinationSchoolId,
      authId: `student:${transfer.destinationSchoolId}:${destinationAdmissionNumber.toLowerCase()}`,
      ...(sourceStudentUser.authTokenIdentifier
        ? { authTokenIdentifier: sourceStudentUser.authTokenIdentifier }
        : {}),
      ...(sourceStudentUser.personId
        ? { personId: sourceStudentUser.personId }
        : {}),
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
    return redactTransferForScope(transfer, scope);
  },
});

/**
 * List transfers for a school branch (as source, destination, or either).
 */
export const listTransfersBySchool = query({
  args: {
    schoolId: v.id("schools"),
    direction: v.optional(
      v.union(v.literal("source"), v.literal("destination"), v.literal("all")),
    ),
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
    await assertTransferAuthority(ctx, args.schoolId);

    const direction = args.direction ?? "all";
    let records: Doc<"studentTransfers">[] = [];

    if (direction === "source" || direction === "all") {
      const sourceTransfers = await ctx.db
        .query("studentTransfers")
        .withIndex("by_source_school", (q) =>
          q.eq("sourceSchoolId", args.schoolId),
        )
        .take(501);
      if (sourceTransfers.length > 500)
        throw new ConvexError(
          "Transfer list exceeds 500 records; use student history",
        );
      records.push(...sourceTransfers);
    }

    if (direction === "destination" || direction === "all") {
      const destTransfers = await ctx.db
        .query("studentTransfers")
        .withIndex("by_destination_school", (q) =>
          q.eq("destinationSchoolId", args.schoolId),
        )
        .take(501);
      if (destTransfers.length > 500)
        throw new ConvexError(
          "Transfer list exceeds 500 records; use student history",
        );
      records.push(...destTransfers);
    }

    // Deduplicate by _id
    const seen = new Set<string>();
    records = records.filter((r) => {
      if (seen.has(r._id)) return false;
      seen.add(r._id);
      return true;
    });

    if (args.status) {
      records = records.filter((r) => r.status === args.status);
    }

    return records
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((record) =>
        redactTransferForScope(
          record,
          record.sourceSchoolId === args.schoolId &&
            record.destinationSchoolId === args.schoolId
            ? "both"
            : record.sourceSchoolId === args.schoolId
              ? "source"
              : "destination",
        ),
      );
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
    studentId: v.id("students"),
  },
  handler: async (ctx, args) => {
    const student = await ctx.db.get(args.studentId);
    if (!student) return [];
    await assertTransferAuthority(ctx, student.schoolId);
    const queue = [args.studentId];
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

async function assertActiveTransferGroup(
  ctx: QueryCtx | MutationCtx,
  sourceSchoolId: Id<"schools">,
  destinationSchoolId: Id<"schools">,
  groupId: Id<"schoolGroups">,
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
    source?.status !== "active" ||
    destination?.status !== "active" ||
    group?.status !== "active" ||
    sourceLink?.groupId !== groupId ||
    destinationLink?.groupId !== groupId
  ) {
    throw new ConvexError(
      "Transfer requires two active branches in the same active school group",
    );
  }
}

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
    const school = await ctx.db.get(schoolId);
    const link = await ctx.db
      .query("schoolGroupBranches")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique();
    const group = link ? await ctx.db.get(link.groupId) : null;
    const branches =
      group?.status === "active"
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
      if (target && target._id !== schoolId && target.status === "active")
        destinations.push({ _id: target._id, name: target.name });
    }
    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .take(501);
    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
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
    const classroom = await ctx.db.get(args.classId);
    if (
      !classroom ||
      classroom.schoolId !== args.schoolId ||
      classroom.isArchived
    )
      throw new ConvexError("Class unavailable in this branch");
    const rows = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .take(501);
    if (rows.length > 500)
      throw new ConvexError("Class exceeds supported 500-student selector");
    return await Promise.all(
      rows
        .filter(
          (s) =>
            s.schoolId === args.schoolId &&
            !s.isArchived &&
            (!s.enrollmentStatus || s.enrollmentStatus === "active"),
        )
        .map(async (s) => ({
          _id: s._id,
          name: (await ctx.db.get(s.userId))?.name ?? "Student",
          admissionNumber: s.admissionNumber,
        })),
    );
  },
});

export const previewTransferNumber = query({
  args: { schoolId: v.id("schools"), classId: v.id("classes") },
  handler: async (ctx, args) => {
    await assertTransferAuthority(ctx, args.schoolId);
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
