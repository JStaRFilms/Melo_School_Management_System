import { mutation, query, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { resolveActiveMembership, type ActiveMembershipContext } from "./auth";
import {
  evaluateEffectiveCapabilities,
  isMembershipProprietor,
  requireCapability,
} from "./rbac";
import { recordAuditEventHelper } from "./audit";
import { allocateNextAdmissionNumberHelper } from "./admissionNumbers";

/**
 * Validates that the caller holds authority to manage student transfers
 * in the specified school branch (admin, principal, registrar, proprietor, or super admin).
 */
async function assertTransferAuthority(
  ctx: MutationCtx | QueryCtx,
  schoolId: Id<"schools">
): Promise<ActiveMembershipContext> {
  const authContext = await resolveActiveMembership(ctx, schoolId);

  if (authContext.isPlatformAdmin || authContext.role === "admin") {
    return authContext;
  }

  if (authContext.membershipId) {
    const membership = await ctx.db.get(authContext.membershipId);
    if (membership) {
      const isProprietor = await isMembershipProprietor(ctx, membership);
      if (isProprietor) {
        return authContext;
      }
    }

    const caps = await evaluateEffectiveCapabilities(ctx, authContext.membershipId);
    if (
      caps.includes("enrollment.intakes.manage") ||
      caps.includes("academic.classes.manage") ||
      caps.includes("enrollment.decisions.record")
    ) {
      return authContext;
    }
  }

  throw new ConvexError({
    code: "FORBIDDEN",
    message: `Forbidden: Caller does not hold transfer authorization for school ${schoolId}`,
  });
}

type TransferScope = "source" | "destination" | "both" | "platform";

async function getAuthorizedTransferScope(
  ctx: QueryCtx,
  transfer: Doc<"studentTransfers">
): Promise<TransferScope> {
  let sourceAuthorized = false;
  let destinationAuthorized = false;
  let platformAuthorized = false;

  try {
    const sourceContext = await assertTransferAuthority(ctx, transfer.sourceSchoolId);
    sourceAuthorized = true;
    platformAuthorized = sourceContext.isPlatformAdmin;
  } catch {
    // Try the destination branch before denying access.
  }

  if (!platformAuthorized) {
    try {
      await assertTransferAuthority(ctx, transfer.destinationSchoolId);
      destinationAuthorized = true;
    } catch {
      // The caller may be authorized only in the source branch.
    }
  }

  if (platformAuthorized) return "platform";
  if (sourceAuthorized && destinationAuthorized) return "both";
  if (sourceAuthorized) return "source";
  if (destinationAuthorized) return "destination";

  throw new ConvexError({
    code: "FORBIDDEN",
    message: "Forbidden: Caller does not hold transfer authorization in either branch",
  });
}

async function assertGroupTransferAuthority(
  ctx: QueryCtx,
  groupId: Id<"schoolGroups">
): Promise<void> {
  const branches = await ctx.db
    .query("schoolGroupBranches")
    .withIndex("by_group", (q) => q.eq("groupId", groupId))
    .collect();

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
    message: "Forbidden: Caller does not hold transfer authorization in this school group",
  });
}

function redactTransferForScope(
  transfer: Doc<"studentTransfers">,
  scope: TransferScope
) {
  if (scope === "platform" || scope === "both") {
    return transfer;
  }

  if (scope === "source") {
    const {
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
    sourceSchoolId: v.id("schools"),
    destinationSchoolId: v.id("schools"),
    studentId: v.id("students"),
    guardianConsentRecorded: v.boolean(),
    guardianConsentMethod: v.string(),
    academicHistorySummary: v.optional(v.string()),
    attendanceSummaryPct: v.optional(v.number()),
    medicalNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Verify caller authority in source school
    const authContext = await assertTransferAuthority(ctx, args.sourceSchoolId);

    // 2. Reject same-branch transfer
    if (args.sourceSchoolId === args.destinationSchoolId) {
      throw new ConvexError("Source and destination schools cannot be the same");
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
        "Cross-group transfers are not permitted. Transferee schools must belong to the same verified school group."
      );
    }

    const groupId = sourceGroupBranch.groupId;

    // 4. Guardian consent gate
    if (!args.guardianConsentRecorded) {
      throw new ConvexError(
        "Guardian consent must be explicitly recorded prior to initiating transfer"
      );
    }
    if (!args.guardianConsentMethod || args.guardianConsentMethod.trim().length === 0) {
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
        `Cannot transfer student with enrollment status '${student.enrollmentStatus}'`
      );
    }

    // Check for existing active transfer
    const existingTransfers = await ctx.db
      .query("studentTransfers")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const hasActiveTransfer = existingTransfers.some(
      (t) => t.status === "initiated" || t.status === "source_released"
    );
    if (hasActiveTransfer) {
      throw new ConvexError(
        "An active transfer already exists for this student in this school group"
      );
    }

    // 6. Selective Disclosure Compilation:
    // Strictly compile ONLY permitted non-sensitive fields.
    // Prohibited: debt records, unpaid invoices, safeguarding referrals, disciplinary notes.
    const studentUser = student.userId ? await ctx.db.get(student.userId) : null;
    const studentName = studentUser?.name ?? "Student";

    const currentClass = await ctx.db.get(student.classId);
    const academicHistorySummary =
      args.academicHistorySummary ??
      (currentClass
        ? `Enrolled in ${currentClass.name} with admission number ${student.admissionNumber}`
        : `Admission number ${student.admissionNumber}`);

    const attendanceSummaryPct =
      args.attendanceSummaryPct !== undefined ? args.attendanceSummaryPct : 100;

    const dateOfBirth = student.dateOfBirth
      ? new Date(student.dateOfBirth).toISOString().split("T")[0]
      : undefined;

    const portableRecordPackage = {
      studentName,
      dateOfBirth,
      gender: student.gender,
      academicHistorySummary,
      attendanceSummaryPct,
      medicalNotes: args.medicalNotes,
    };

    const now = Date.now();
    const transferId = await ctx.db.insert("studentTransfers", {
      groupId,
      sourceSchoolId: args.sourceSchoolId,
      destinationSchoolId: args.destinationSchoolId,
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

    if (transfer.status !== "initiated") {
      throw new ConvexError(
        `Cannot authorize release: transfer is in status '${transfer.status}', expected 'initiated'`
      );
    }

    // Enforce authority in source branch
    const authContext = await assertTransferAuthority(ctx, transfer.sourceSchoolId);

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
    admissionNumberOverride: v.optional(v.string()),
    admissionNumberOverrideReason: v.optional(v.string()),
    admissionNumberOverrideConfirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new ConvexError("Transfer record not found");
    }

    // Two-Phase Commit Hard Gate: Must be released by source branch first
    if (transfer.status !== "source_released") {
      throw new ConvexError(
        `Cannot accept transfer: transfer is in status '${transfer.status}', expected 'source_released'`
      );
    }

    // Enforce authority in destination branch
    const authContext = await assertTransferAuthority(ctx, transfer.destinationSchoolId);

    // Verify destination class belongs to destination branch
    const destClass = await ctx.db.get(args.destinationClassId);
    if (!destClass || destClass.schoolId !== transfer.destinationSchoolId) {
      throw new ConvexError(
        "Destination class not found or does not belong to destination school branch"
      );
    }

    let destinationAdmissionNumber: string;
    const manualAdmissionNumber = args.admissionNumberOverride?.trim();
    if (manualAdmissionNumber) {
      if (!args.admissionNumberOverrideConfirmed) {
        throw new ConvexError("Manual admission number override must be explicitly confirmed");
      }
      if (!args.admissionNumberOverrideReason?.trim()) {
        throw new ConvexError("Manual admission number override requires a reason");
      }
      await requireCapability(
        ctx,
        transfer.destinationSchoolId,
        "enrollment.admissions.override_number"
      );

      const existingDestinationStudent = await ctx.db
        .query("students")
        .withIndex("by_school_and_admission_number", (q) =>
          q
            .eq("schoolId", transfer.destinationSchoolId)
            .eq("admissionNumber", manualAdmissionNumber)
        )
        .first();
      if (existingDestinationStudent) {
        throw new ConvexError("A student with this admission number already exists in the destination school");
      }
      destinationAdmissionNumber = manualAdmissionNumber;
    } else {
      const { allocatedNumber } = await allocateNextAdmissionNumberHelper(ctx, {
        schoolId: transfer.destinationSchoolId,
        level: destClass.level,
      });
      destinationAdmissionNumber = allocatedNumber;
    }

    const sourceStudent = await ctx.db.get(transfer.studentId);
    if (!sourceStudent || sourceStudent.schoolId !== transfer.sourceSchoolId) {
      throw new ConvexError("Source student record is unavailable for transfer");
    }
    const sourceStudentUser = await ctx.db.get(sourceStudent.userId);
    if (!sourceStudentUser || sourceStudentUser.isArchived) {
      throw new ConvexError("Source student account is unavailable for transfer");
    }

    const now = Date.now();
    const destinationStudentUserId = await ctx.db.insert("users", {
      schoolId: transfer.destinationSchoolId,
      authId: `student:${transfer.destinationSchoolId}:${destinationAdmissionNumber.toLowerCase()}`,
      ...(sourceStudentUser.authTokenIdentifier
        ? { authTokenIdentifier: sourceStudentUser.authTokenIdentifier }
        : {}),
      ...(sourceStudentUser.personId ? { personId: sourceStudentUser.personId } : {}),
      name: sourceStudentUser.name,
      ...(sourceStudentUser.firstName ? { firstName: sourceStudentUser.firstName } : {}),
      ...(sourceStudentUser.lastName ? { lastName: sourceStudentUser.lastName } : {}),
      email: sourceStudentUser.email,
      ...(sourceStudentUser.phone ? { phone: sourceStudentUser.phone } : {}),
      role: "student",
      createdAt: now,
      updatedAt: now,
    });
    const destinationStudentId = await ctx.db.insert("students", {
      schoolId: transfer.destinationSchoolId,
      classId: args.destinationClassId,
      userId: destinationStudentUserId,
      admissionNumber: destinationAdmissionNumber,
      ...(sourceStudent.houseName ? { houseName: sourceStudent.houseName } : {}),
      ...(sourceStudent.gender ? { gender: sourceStudent.gender } : {}),
      ...(sourceStudent.dateOfBirth ? { dateOfBirth: sourceStudent.dateOfBirth } : {}),
      ...(sourceStudent.guardianName ? { guardianName: sourceStudent.guardianName } : {}),
      ...(sourceStudent.guardianPhone ? { guardianPhone: sourceStudent.guardianPhone } : {}),
      ...(sourceStudent.address ? { address: sourceStudent.address } : {}),
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
 * Ensures student retains/returns to active status in source school.
 */
export const rejectOrCancelTransfer = mutation({
  args: {
    transferId: v.id("studentTransfers"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const transfer = await ctx.db.get(args.transferId);
    if (!transfer) {
      throw new ConvexError("Transfer record not found");
    }

    if (transfer.status === "completed") {
      throw new ConvexError("Cannot cancel or reject an already completed transfer");
    }

    if (transfer.status === "cancelled" || transfer.status === "rejected") {
      throw new ConvexError(`Transfer is already finalized with status '${transfer.status}'`);
    }

    if (!args.reason || args.reason.trim().length === 0) {
      throw new ConvexError("A reason must be provided to abort a transfer");
    }

    // Resolve caller authority: check destination branch first, then source branch
    let actingSchoolId: Id<"schools">;
    let authContext: ActiveMembershipContext;
    let newStatus: "cancelled" | "rejected";

    try {
      authContext = await assertTransferAuthority(ctx, transfer.destinationSchoolId);
      actingSchoolId = transfer.destinationSchoolId;
      newStatus = "rejected";
    } catch {
      try {
        authContext = await assertTransferAuthority(ctx, transfer.sourceSchoolId);
        actingSchoolId = transfer.sourceSchoolId;
        newStatus = "cancelled";
      } catch {
        throw new ConvexError(
          "Not authorized: Must hold transfer authority in source or destination branch"
        );
      }
    }

    const now = Date.now();

    // Ensure student record remains active in source school
    const student = await ctx.db.get(transfer.studentId);
    if (student && student.schoolId === transfer.sourceSchoolId) {
      await ctx.db.patch(student._id, {
        enrollmentStatus: "active",
        updatedAt: now,
      });
    }

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
      safeSummary: `${newStatus === "rejected" ? "Rejected" : "Cancelled"} transfer for student ${transfer.studentName}. Reason: ${args.reason}`,
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
      v.union(v.literal("source"), v.literal("destination"), v.literal("all"))
    ),
    status: v.optional(
      v.union(
        v.literal("initiated"),
        v.literal("source_released"),
        v.literal("completed"),
        v.literal("cancelled"),
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    await assertTransferAuthority(ctx, args.schoolId);

    const direction = args.direction ?? "all";
    let records: Doc<"studentTransfers">[] = [];

    if (direction === "source" || direction === "all") {
      const sourceTransfers = await ctx.db
        .query("studentTransfers")
        .withIndex("by_source_school", (q) => q.eq("sourceSchoolId", args.schoolId))
        .collect();
      records.push(...sourceTransfers);
    }

    if (direction === "destination" || direction === "all") {
      const destTransfers = await ctx.db
        .query("studentTransfers")
        .withIndex("by_destination_school", (q) => q.eq("destinationSchoolId", args.schoolId))
        .collect();
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
              : "destination"
        )
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
        v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    await assertGroupTransferAuthority(ctx, args.groupId);

    const records = args.status
      ? await ctx.db
          .query("studentTransfers")
          .withIndex("by_group_and_status", (q) =>
            q.eq("groupId", args.groupId).eq("status", args.status!)
          )
          .collect()
      : await ctx.db
          .query("studentTransfers")
          .withIndex("by_group_and_status", (q) => q.eq("groupId", args.groupId))
          .collect();

    return await Promise.all(
      records
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (record) =>
          redactTransferForScope(record, await getAuthorizedTransferScope(ctx, record))
        )
    );
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
    const [sourceTransfers, destinationTransfers] = await Promise.all([
      ctx.db
        .query("studentTransfers")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
        .collect(),
      ctx.db
        .query("studentTransfers")
        .withIndex("by_destination_student", (q) =>
          q.eq("destinationStudentId", args.studentId)
        )
        .collect(),
    ]);
    const transfers = [...sourceTransfers, ...destinationTransfers];

    if (transfers.length === 0) {
      const student = await ctx.db.get(args.studentId);
      if (!student) return [];
      await assertTransferAuthority(ctx, student.schoolId);
      return [];
    }

    return await Promise.all(
      transfers
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (transfer) =>
          redactTransferForScope(
            transfer,
            await getAuthorizedTransferScope(ctx, transfer)
          )
        )
    );
  },
});
