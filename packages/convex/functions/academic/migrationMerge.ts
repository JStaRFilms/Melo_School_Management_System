import { mutation } from "../../_generated/server";
import { ConvexError, v } from "convex/values";
import { assertMigrationAccess } from "./migrationAuth";
import { Id } from "../../_generated/dataModel";

/**
 * Executes atomic migration merge from stagedImportRecords into live production tables.
 * Strict Invariants:
 * 1. Blocks if any unresolved error records exist in workspace.
 * 2. Unrecognized fields are preserved in students.unmappedData.
 * 3. Permissible gaps (admission no., gender, DOB, etc.) are handled with safe fallbacks.
 */
export const commitImportWorkspace = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
  },
  handler: async (ctx, args) => {
    const auth = await assertMigrationAccess(ctx, args.schoolId);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      throw new ConvexError("Workspace not found");
    }

    if (workspace.status === "merged") {
      throw new ConvexError("This workspace has already been merged");
    }

    // 0. Pre-condition checks: fetch all staged records
    const allStaged = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

    const errorRecords = allStaged.filter((r) => r.validationStatus === "error");
    if (errorRecords.length > 0) {
      throw new ConvexError(
        `Cannot commit workspace with ${errorRecords.length} blocking validation errors. Please correct them first.`
      );
    }

    const unresolvedWarnings = allStaged.filter(
      (r) => r.validationStatus === "warning" && !r.isResolved
    );
    if (unresolvedWarnings.length > 0) {
      throw new ConvexError(
        `Cannot commit workspace with ${unresolvedWarnings.length} unresolved clash warnings. Please resolve them first.`
      );
    }

    const now = Date.now();
    const currentYear = new Date().getFullYear();
    const prefix = workspace.admissionNumberPrefix || `SCH/${currentYear}/`;
    let seq = workspace.nextAdmissionSequence ?? 1;

    // --- PHASE 1: Classes & Subjects Auto-Creation ---
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

    // Ensure all target classes exist
    for (const rec of allStaged) {
      const cName = rec.parsedData.className.trim() || "Unassigned";
      const key = cName.toLowerCase();
      if (!classMap.has(key)) {
        const newClassId = await ctx.db.insert("classes", {
          schoolId: args.schoolId,
          name: cName,
          level: cName,
          createdAt: now,
          updatedAt: now,
        });
        classMap.set(key, newClassId);
      }

      // Ensure subjects exist for grade records
      if (rec.parsedData.subjectName) {
        const sName = rec.parsedData.subjectName.trim();
        const sKey = sName.toLowerCase();
        if (!subjectMap.has(sKey)) {
          const newSubjId = await ctx.db.insert("subjects", {
            schoolId: args.schoolId,
            name: sName,
            code: sName.slice(0, 4).toUpperCase(),
            createdAt: now,
            updatedAt: now,
          });
          subjectMap.set(sKey, newSubjId);
        }
      }
    }

    // --- PHASE 2: Families & Guardians ---
    const familyMap = new Map<string, Id<"families">>();

    for (const rec of allStaged) {
      if (rec.familyClusterKey && !familyMap.has(rec.familyClusterKey)) {
        const guardianName = rec.parsedData.guardianName || `${rec.parsedData.lastName} Household`;
        const familyName = `${guardianName} Family`;

        const familyId = await ctx.db.insert("families", {
          schoolId: args.schoolId,
          name: familyName,
          createdAt: now,
          updatedAt: now,
          createdBy: (auth.userId ?? auth.callerId) as any,
          updatedBy: (auth.userId ?? auth.callerId) as any,
        });

        familyMap.set(rec.familyClusterKey, familyId);

        // Create Parent user account if guardian phone or email is available
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
            createdBy: (auth.userId ?? auth.callerId) as any,
            updatedBy: (auth.userId ?? auth.callerId) as any,
          });
        }
      }
    }

    // --- PHASE 3: Student Users & Profiles ---
    const studentStagedRows = allStaged.filter((r) => r.entityType === "student");
    const createdStudentMap = new Map<string, Id<"students">>();
    let mergedCount = 0;

    for (const rec of studentStagedRows) {
      if (rec.resolutionAction === "ignore") {
        continue;
      }

      const classId = classMap.get(rec.parsedData.className.toLowerCase().trim())!;
      const familyId = rec.familyClusterKey ? familyMap.get(rec.familyClusterKey) : undefined;

      // Admission number sequence fallback
      let admissionNumber = rec.parsedData.admissionNumber?.trim();
      if (!admissionNumber) {
        admissionNumber = `${prefix}${String(seq).padStart(4, "0")}`;
        seq++;
      }

      // Handle merge existing
      if (rec.resolutionAction === "merge_existing" && rec.existingStudentId) {
        await ctx.db.patch(rec.existingStudentId, {
          customAttributes: rec.parsedData.customAttributes,
          unmappedData: rec.parsedData.unmappedFields,
          updatedAt: now,
        });
        createdStudentMap.set(rec._id, rec.existingStudentId);
        mergedCount++;
        continue;
      }

      // Create Student User
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

      // Insert Student record
      const studentId = await ctx.db.insert("students", {
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

      createdStudentMap.set(rec._id, studentId);
      mergedCount++;
    }

    // --- PHASE 4: Academic Results (if grade_record rows present) ---
    const gradeRows = allStaged.filter((r) => r.entityType === "grade_record");
    if (gradeRows.length > 0) {
      // Find active academic session & term
      const sessions = await ctx.db
        .query("academicSessions")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
        .take(10);
      const activeSession = sessions.find((s) => s.isActive) ?? sessions[0];

      if (activeSession) {
        const terms = await ctx.db
          .query("academicTerms")
          .withIndex("by_session", (q) => q.eq("sessionId", activeSession._id))
          .take(10);
        const activeTerm = terms.find((t) => t.isActive) ?? terms[0];

        if (activeTerm) {
          for (const gr of gradeRows) {
            const classId = classMap.get(gr.parsedData.className.toLowerCase().trim());
            const subjectId = gr.parsedData.subjectName
              ? subjectMap.get(gr.parsedData.subjectName.toLowerCase().trim())
              : undefined;

            // Match student by name in current school
            const studentDoc = await ctx.db
              .query("students")
              .withIndex("by_school_and_class", (q) =>
                q.eq("schoolId", args.schoolId).eq("classId", classId!)
              )
              .take(50);

            const matchedStudent = studentDoc.find(
              (s) => s.guardianName?.toLowerCase().includes(gr.parsedData.firstName.toLowerCase())
            ) ?? studentDoc[0];

            if (classId && subjectId && matchedStudent) {
              const ca1 = gr.parsedData.ca1 ?? 0;
              const ca2 = gr.parsedData.ca2 ?? 0;
              const exam = gr.parsedData.exam ?? 0;
              const total = ca1 + ca2 + exam;

              await ctx.db.insert("assessmentRecords", {
                schoolId: args.schoolId,
                sessionId: activeSession._id,
                termId: activeTerm._id,
                classId,
                subjectId,
                studentId: matchedStudent._id,
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
                enteredBy: (auth.userId ?? auth.callerId) as any,
                updatedBy: (auth.userId ?? auth.callerId) as any,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        }
      }
    }

    // --- PHASE 5: Finalize ---
    await ctx.db.patch(args.workspaceId, {
      status: "merged",
      nextAdmissionSequence: seq,
      mergedAt: now,
      mergedBy: auth.callerId,
      updatedAt: now,
    });

    return {
      success: true,
      mergedStudents: mergedCount,
      workspaceId: args.workspaceId,
      mergedAt: now,
    };
  },
});
