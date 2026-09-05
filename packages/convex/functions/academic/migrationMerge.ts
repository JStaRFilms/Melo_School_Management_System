import { getPrivateMigrationWorkspace } from "./migrationWorkspace";
import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { resolveSchoolAdminActorId } from "./migrationAuth";
import type { Doc, Id } from "../../_generated/dataModel";

/**
 * Executes atomic or batched migration merge from stagedImportRecords into live production tables.
 * Strict Invariants:
 * 1. Blocks if any unresolved error records exist in workspace (checked across full workspace).
 * 2. Blocks if any unresolved clash warnings exist in workspace.
 * 3. Never falls back to arbitrary student assignment for grade records.
 * 4. Provenance fields (createdBy, updatedBy, enteredBy) use schema-valid Id<"users">.
 * 5. Bounded, resumable batch processing within Convex transaction limits.
 * 6. Idempotent on retries.
 */
export const commitImportWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { auth, workspace } = await getPrivateMigrationWorkspace(ctx, args.schoolId, args.workspaceId);
    if (args.batchSize !== undefined && (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > 100)) {
      throw new ConvexError("Batch size must be an integer between 1 and 100");
    }

    if (workspace.status === "cancelled") {
      throw new ConvexError("Cannot commit a cancelled workspace");
    }

    if (workspace.status === "merged") {
      return {
        success: true,
        done: true,
        mergedStudents: workspace.totalRecords,
        processedRecords: workspace.totalRecords,
        totalRecords: workspace.totalRecords,
        workspaceId: args.workspaceId,
        mergedAt: workspace.mergedAt ?? workspace.updatedAt,
      };
    }

    // 0. Pre-condition checks across ENTIRE workspace:
    // A. Check for any blocking validation error records
    const firstError = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_validationStatus", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("validationStatus", "error")
      )
      .first();

    if (firstError) {
      throw new ConvexError(
        `Cannot commit workspace with blocking validation errors. Please correct row #${firstError.rowNumber} first.`
      );
    }

    // B. Check for any unresolved clash warnings
    const firstUnresolvedWarning = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_validationStatus", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("validationStatus", "warning")
      )
      .first();

    if (firstUnresolvedWarning) {
      throw new ConvexError(
        `Cannot commit workspace with unresolved clash warnings. Please resolve row #${firstUnresolvedWarning.rowNumber} first.`
      );
    }

    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const prefix = workspace.admissionNumberPrefix || `SCH/${currentYear}/`;
    let seq = workspace.nextAdmissionSequence ?? 1;

    // Resolve schema-valid Id<"users"> actor for user-required fields
    const actorUserId = await resolveSchoolAdminActorId(ctx, args.schoolId, auth);

    // --- PHASE 1: Classes & Subjects Auto-Creation Cache ---
    const existingClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    const classMap = new Map<string, Id<"classes">>();
    existingClasses.forEach((c) => classMap.set(c.name.toLowerCase().trim(), c._id));

    const existingSubjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    const subjectMap = new Map<string, Id<"subjects">>();
    existingSubjects.forEach((s) => subjectMap.set(s.name.toLowerCase().trim(), s._id));

    // Academic session & term for grade records
    const sessions = await ctx.db
      .query("academicSessions")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(10);
    const activeSession = sessions.find((s) => s.isActive) ?? sessions[0];

    let activeTerm: Doc<"academicTerms"> | undefined;
    if (activeSession) {
      const terms = await ctx.db
        .query("academicTerms")
        .withIndex("by_session", (q) => q.eq("sessionId", activeSession._id))
        .take(10);
      activeTerm = terms.find((t) => t.isActive) ?? terms[0];
    }

    // --- PHASE 2: Process Batch of Staged Records ---
    const batchLimit = Math.min(args.batchSize ?? 50, 100);
    const commitPhase = workspace.commitPhase ?? "students";
    const entityType = commitPhase === "students" ? "student" : "grade_record";
    const page = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId_and_entityType", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("entityType", entityType)
      )
      .paginate({ numItems: batchLimit, cursor: workspace.commitCursor ?? null });

    const familyMap = new Map<string, Id<"families">>();
    let batchProcessedCount = 0;

    for (const rec of page.page) {
      if (rec.isCommitted) continue;
      // Ensure target class exists
      const cName = rec.parsedData.className.trim() || "Unassigned";
      const cKey = cName.toLowerCase();
      let classId = classMap.get(cKey);
      if (!classId) {
        classId = await ctx.db.insert("classes", {
          schoolId: args.schoolId,
          name: cName,
          level: cName,
          createdAt: now,
          updatedAt: now,
        });
        classMap.set(cKey, classId);
      }

      // Ensure subject exists for grade records
      let subjectId: Id<"subjects"> | undefined = undefined;
      if (rec.parsedData.subjectName) {
        const sName = rec.parsedData.subjectName.trim();
        const sKey = sName.toLowerCase();
        subjectId = subjectMap.get(sKey);
        if (!subjectId) {
          subjectId = await ctx.db.insert("subjects", {
            schoolId: args.schoolId,
            name: sName,
            code: sName.slice(0, 4).toUpperCase(),
            createdAt: now,
            updatedAt: now,
          });
          subjectMap.set(sKey, subjectId);
        }
      }

      // Family & Guardian handling
      let familyId: Id<"families"> | undefined = undefined;
      if (rec.familyClusterKey) {
        familyId = familyMap.get(rec.familyClusterKey);
        if (!familyId) {
          const guardianName = rec.parsedData.guardianName || `${rec.parsedData.lastName} Household`;
          const familyName = `${guardianName} Family`;

          // Check if family already exists in this school
          const existingFamily = await ctx.db
            .query("families")
            .withIndex("by_school_and_name", (q) =>
              q.eq("schoolId", args.schoolId).eq("name", familyName)
            )
            .first();

          if (existingFamily) {
            familyId = existingFamily._id;
          } else {
            familyId = await ctx.db.insert("families", {
              schoolId: args.schoolId,
              name: familyName,
              createdAt: now,
              updatedAt: now,
              createdBy: actorUserId,
              updatedBy: actorUserId,
            });

            if (rec.parsedData.guardianPhone || rec.parsedData.guardianEmail) {
              const parentEmail =
                rec.parsedData.guardianEmail ||
                `parent_${rec.familyClusterKey}@guardians.local`;
              const parentUserId = await ctx.db.insert("users", {
                schoolId: args.schoolId,
                authId: `migrated_parent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                name: guardianName,
                email: parentEmail,
                phone: rec.parsedData.guardianPhone,
                role: "parent",
                createdAt: now,
                updatedAt: now,
              });

              await ctx.db.insert("familyMembers", {
                schoolId: args.schoolId,
                familyId,
                parentUserId,
                relationship: "Guardian",
                isPrimaryContact: true,
                createdAt: now,
                updatedAt: now,
                createdBy: actorUserId,
                updatedBy: actorUserId,
              });
            }
          }
          familyMap.set(rec.familyClusterKey, familyId);
        }
      }

      // Entity processing
      if (rec.entityType === "student") {
        if (rec.resolutionAction === "ignore") {
          await ctx.db.patch(rec._id, { isCommitted: true, updatedAt: now });
          batchProcessedCount++;
          continue;
        }

        if (rec.resolutionAction === "merge_existing") {
          if (!rec.existingStudentId) {
            throw new ConvexError(`Missing target student for merge_existing on row #${rec.rowNumber}`);
          }
          const targetStudent = await ctx.db.get(rec.existingStudentId);
          if (!targetStudent || targetStudent.schoolId !== args.schoolId) {
            throw new ConvexError(
              `Cross-tenant security violation: Target student on row #${rec.rowNumber} does not belong to this school`
            );
          }

          await ctx.db.patch(rec.existingStudentId, {
            customAttributes: rec.parsedData.customAttributes,
            unmappedData: rec.parsedData.unmappedFields,
            updatedAt: now,
          });

          await ctx.db.patch(rec._id, {
            isCommitted: true,
            committedStudentId: rec.existingStudentId,
            updatedAt: now,
          });
          batchProcessedCount++;
          continue;
        }

        // Create or reuse student (idempotent retry check)
        let admissionNumber = rec.parsedData.admissionNumber?.trim();
        if (!admissionNumber) {
          admissionNumber = `${prefix}${String(seq).padStart(4, "0")}`;
          seq++;
        }

        let studentId = rec.committedStudentId;
        if (!studentId) {
          // Check if admissionNumber already exists in students table
          const existingStudent = await ctx.db
            .query("students")
            .withIndex("by_school_and_admission_number", (q) =>
              q.eq("schoolId", args.schoolId).eq("admissionNumber", admissionNumber)
            )
            .first();

          if (existingStudent) {
            studentId = existingStudent._id;
          } else {
            const studentAuthId = `migrated_student_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const studentEmail = `${admissionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}@students.local`;
            const fullName = rec.parsedData.middleName
              ? `${rec.parsedData.firstName} ${rec.parsedData.middleName} ${rec.parsedData.lastName}`
              : `${rec.parsedData.firstName} ${rec.parsedData.lastName}`;

            const studentUserId = await ctx.db.insert("users", {
              schoolId: args.schoolId,
              authId: studentAuthId,
              name: fullName,
              firstName: rec.parsedData.firstName,
              lastName: rec.parsedData.lastName,
              email: studentEmail,
              phone: rec.parsedData.guardianPhone,
              role: "student",
              createdAt: now,
              updatedAt: now,
            });

            studentId = await ctx.db.insert("students", {
              schoolId: args.schoolId,
              classId,
              userId: studentUserId,
              familyId,
              admissionNumber,
              gender: rec.parsedData.gender || "Unspecified",
              dateOfBirth: rec.parsedData.dateOfBirth,
              guardianName: rec.parsedData.guardianName,
              guardianPhone: rec.parsedData.guardianPhone,
              address: rec.parsedData.address,
              customAttributes: rec.parsedData.customAttributes,
              unmappedData: rec.parsedData.unmappedFields,
              enrollmentStatus: "active",
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        await ctx.db.patch(rec._id, {
          isCommitted: true,
          committedStudentId: studentId,
          updatedAt: now,
        });
        batchProcessedCount++;
      } else if (rec.entityType === "grade_record") {
        // Deterministic student matching
        let matchedStudentId: Id<"students"> | null = null;

        // 1. Try exact matching by admission number
        if (rec.parsedData.admissionNumber?.trim()) {
          const studentByAdm = await ctx.db
            .query("students")
            .withIndex("by_school_and_admission_number", (q) =>
              q.eq("schoolId", args.schoolId).eq("admissionNumber", rec.parsedData.admissionNumber!.trim())
            )
            .first();
          if (studentByAdm) {
            matchedStudentId = studentByAdm._id;
          }
        }

        // 2. If no admission number match, match deterministically within class by student user names
        if (!matchedStudentId && classId) {
          const classStudents = await ctx.db
            .query("students")
            .withIndex("by_school_and_class", (q) =>
              q.eq("schoolId", args.schoolId).eq("classId", classId)
            )
            .take(100);

          const candidateMatches: Id<"students">[] = [];
          for (const s of classStudents) {
            const user = await ctx.db.get(s.userId);
            if (user) {
              const uFirst = (user.firstName || user.name.split(" ")[0] || "").toLowerCase().trim();
              const uLast = (user.lastName || user.name.split(" ")[1] || "").toLowerCase().trim();
              const recFirst = rec.parsedData.firstName.toLowerCase().trim();
              const recLast = rec.parsedData.lastName.toLowerCase().trim();

              if (
                (uFirst === recFirst && uLast === recLast) ||
                (user.name.toLowerCase().includes(recFirst) && user.name.toLowerCase().includes(recLast))
              ) {
                candidateMatches.push(s._id);
              }
            }
          }

          if (candidateMatches.length === 1) {
            matchedStudentId = candidateMatches[0];
          } else if (candidateMatches.length > 1) {
            throw new ConvexError(
              `Ambiguous grade match on row #${rec.rowNumber}: Multiple students in class "${cName}" match name "${rec.parsedData.firstName} ${rec.parsedData.lastName}". Please specify an admission number.`
            );
          }
        }

        if (!matchedStudentId) {
          throw new ConvexError(
            `Unmatched grade record on row #${rec.rowNumber}: No student found in class "${cName}" matching "${rec.parsedData.firstName} ${rec.parsedData.lastName}".`
          );
        }

        if (!activeSession) {
          throw new ConvexError(
            `Cannot import grade row #${rec.rowNumber}: This school has no academic session.`
          );
        }
        if (!activeTerm) {
          throw new ConvexError(
            `Cannot import grade row #${rec.rowNumber}: The selected academic session has no term.`
          );
        }
        if (!subjectId) {
          throw new ConvexError(
            `Cannot import grade row #${rec.rowNumber}: A subject is required.`
          );
        }

        {
          const ca1 = rec.parsedData.ca1 ?? 0;
          const ca2 = rec.parsedData.ca2 ?? 0;
          const exam = rec.parsedData.exam ?? 0;
          const total = ca1 + ca2 + exam;

          await ctx.db.insert("assessmentRecords", {
            schoolId: args.schoolId,
            sessionId: activeSession._id,
            termId: activeTerm._id,
            classId,
            subjectId,
            studentId: matchedStudentId,
            ca1,
            ca2,
            ca3: 0,
            examRawScore: exam,
            examScaledScore: exam,
            total,
            gradeLetter: total >= 70 ? "A" : total >= 60 ? "B" : total >= 50 ? "C" : "F",
            remark: total >= 50 ? "Pass" : "Needs Improvement",
            examInputModeSnapshot: "raw",
            examRawMaxSnapshot: 100,
            status: "draft",
            enteredBy: actorUserId,
            updatedBy: actorUserId,
            createdAt: now,
            updatedAt: now,
          });
        }

        await ctx.db.patch(rec._id, { isCommitted: true, updatedAt: now });
        batchProcessedCount++;
      }
    }

    const currentProcessed = (workspace.processedRecords ?? 0) + batchProcessedCount;

    // --- PHASE 3: Check Completion Status ---
    if (page.isDone && commitPhase === "students") {
      await ctx.db.patch(args.workspaceId, {
        status: "committing",
        processedRecords: currentProcessed,
        commitCursor: undefined,
        commitPhase: "grades",
        nextAdmissionSequence: seq,
        updatedAt: now,
      });

      return {
        success: true,
        done: false,
        mergedStudents: currentProcessed,
        processedRecords: currentProcessed,
        totalRecords: workspace.totalRecords,
        workspaceId: args.workspaceId,
      };
    }

    if (page.isDone) {
      await ctx.db.patch(args.workspaceId, {
        status: "merged",
        processedRecords: workspace.totalRecords,
        commitCursor: undefined,
        commitPhase: undefined,
        nextAdmissionSequence: seq,
        mergedAt: now,
        mergedBy: auth.callerId,
        updatedAt: now,
      });

      return {
        success: true,
        done: true,
        mergedStudents: currentProcessed,
        processedRecords: workspace.totalRecords,
        totalRecords: workspace.totalRecords,
        workspaceId: args.workspaceId,
        mergedAt: now,
      };
    }

    await ctx.db.patch(args.workspaceId, {
      status: "committing",
      processedRecords: currentProcessed,
      commitCursor: page.continueCursor,
      commitPhase,
      nextAdmissionSequence: seq,
      updatedAt: now,
    });

    return {
      success: true,
      done: false,
      mergedStudents: currentProcessed,
      processedRecords: currentProcessed,
      totalRecords: workspace.totalRecords,
      workspaceId: args.workspaceId,
    };
  },
});
