import { mutation } from "../../_generated/server";
import { v } from "convex/values";
import { assertMigrationAccess } from "./migrationAuth";
import {
  parseHumanName,
  normalizePhoneNumber,
  evaluateClash,
  generateFamilyClusterKey,
} from "@school/shared";

const stagedRecordInputValidator = v.object({
  rowNumber: v.number(),
  rawPayload: v.record(v.string(), v.any()),
  parsedData: v.object({
    firstName: v.string(),
    lastName: v.string(),
    middleName: v.optional(v.string()),
    admissionNumber: v.optional(v.string()),
    gender: v.string(),
    dateOfBirth: v.optional(v.number()),
    className: v.string(),
    matchedClassId: v.optional(v.id("classes")),
    guardianName: v.optional(v.string()),
    guardianPhone: v.optional(v.string()),
    guardianEmail: v.optional(v.string()),
    address: v.optional(v.string()),
    customAttributes: v.optional(
      v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))
    ),
    unmappedFields: v.optional(v.record(v.string(), v.string())),
    subjectName: v.optional(v.string()),
    matchedSubjectId: v.optional(v.id("subjects")),
    ca1: v.optional(v.number()),
    ca2: v.optional(v.number()),
    exam: v.optional(v.number()),
  }),
  entityType: v.union(v.literal("student"), v.literal("grade_record")),
  unrecognizedHeaders: v.optional(
    v.array(
      v.object({
        header: v.string(),
        sampleValue: v.optional(v.string()),
        detectedType: v.string(),
      })
    )
  ),
});

/**
 * Stages a batch of parsed spreadsheet records into stagedImportRecords.
 * Performs clash detection against live students and workspace records,
 * registers feature signals, and computes validation statuses.
 */
export const stageRecordsBatch = mutation({
  args: {
    schoolId: v.id("schools"),
    workspaceId: v.id("importWorkspaces"),
    records: v.array(stagedRecordInputValidator),
  },
  handler: async (ctx, args) => {
    await assertMigrationAccess(ctx, args.schoolId);

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || workspace.schoolId !== args.schoolId) {
      throw new Error("Workspace not found");
    }

    const now = Date.now();

    // 1. Fetch live classes and subjects for matching
    const liveClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    const liveSubjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(100);

    // 2. Fetch existing students for clash evaluation (bounded snapshot)
    const liveStudents = await ctx.db
      .query("students")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .take(500);

    // 3. Fetch already staged records in this workspace
    const existingStaged = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .take(500);

    // 4. Track feature signals to write
    const existingSignals = await ctx.db
      .query("migrationFeatureSignals")
      .withIndex("by_schoolId", (q) => q.eq("schoolId", args.schoolId))
      .take(200);

    const registeredHeaders = new Set(existingSignals.map((s) => s.rawHeader.toLowerCase().trim()));

    for (const rec of args.records) {
      if (rec.unrecognizedHeaders) {
        for (const sig of rec.unrecognizedHeaders) {
          const norm = sig.header.toLowerCase().trim();
          if (!registeredHeaders.has(norm)) {
            registeredHeaders.add(norm);
            await ctx.db.insert("migrationFeatureSignals", {
              schoolId: args.schoolId,
              workspaceId: args.workspaceId,
              rawHeader: sig.header,
              sampleValue: sig.sampleValue,
              detectedType: sig.detectedType,
              status: "new",
              createdAt: now,
            });
          }
        }
      }
    }

    // 5. Ingest each record in the batch
    const newlyStaged: any[] = [];

    for (const rec of args.records) {
      const data = { ...rec.parsedData };
      const validationErrors: string[] = [];

      // Normalize name & phone
      const parsedName = parseHumanName(
        data.middleName
          ? `${data.firstName} ${data.middleName} ${data.lastName}`
          : `${data.firstName} ${data.lastName}`
      );
      if (!data.firstName || data.firstName === "Unknown") {
        data.firstName = parsedName.firstName;
      }
      if (!data.lastName) {
        data.lastName = parsedName.lastName;
      }
      if (!data.middleName && parsedName.middleName) {
        data.middleName = parsedName.middleName;
      }

      if (data.guardianPhone) {
        data.guardianPhone = normalizePhoneNumber(data.guardianPhone) ?? data.guardianPhone;
      }

      // Match class
      const matchedClass = liveClasses.find(
        (c) => c.name.toLowerCase().trim() === data.className.toLowerCase().trim()
      );
      if (matchedClass) {
        data.matchedClassId = matchedClass._id;
      }

      // Match subject (for grade records)
      if (data.subjectName) {
        const matchedSubj = liveSubjects.find(
          (s) => s.name.toLowerCase().trim() === data.subjectName!.toLowerCase().trim()
        );
        if (matchedSubj) {
          data.matchedSubjectId = matchedSubj._id;
        }
      }

      // Validation Checks
      if (!data.firstName.trim()) {
        validationErrors.push("First name is required");
      }

      if (rec.entityType === "grade_record") {
        if (!data.subjectName) validationErrors.push("Subject name is required for grade records");
        if (data.ca1 !== undefined && (data.ca1 < 0 || data.ca1 > 100)) {
          validationErrors.push("CA1 score must be between 0 and 100");
        }
        if (data.ca2 !== undefined && (data.ca2 < 0 || data.ca2 > 100)) {
          validationErrors.push("CA2 score must be between 0 and 100");
        }
        if (data.exam !== undefined && (data.exam < 0 || data.exam > 100)) {
          validationErrors.push("Exam score must be between 0 and 100");
        }
      }

      // Clash Detection
      let clashCandidateId: any = undefined;
      let existingStudentId: any = undefined;
      let clashConfidence: number | undefined = undefined;
      let clashReason: string | undefined = undefined;

      const candidate = {
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        className: data.className,
        guardianPhone: data.guardianPhone,
        gender: data.gender,
        admissionNumber: data.admissionNumber,
      };

      // Check against existing live students
      for (const live of liveStudents) {
        const evalResult = evaluateClash(candidate, {
          firstName: live.guardianName?.split(" ")[0] || "",
          lastName: live.guardianName?.split(" ")[1] || "",
          className: liveClasses.find((c) => c._id === live.classId)?.name,
          guardianPhone: live.guardianPhone,
          gender: live.gender,
          admissionNumber: live.admissionNumber,
        });

        if (evalResult.isWarning || evalResult.isClash) {
          existingStudentId = live._id;
          clashConfidence = evalResult.confidence;
          clashReason = `Live student match: ${evalResult.reason}`;
          break;
        }
      }

      // Check against earlier staged rows in this workspace or current batch
      if (!existingStudentId) {
        for (const prev of [...existingStaged, ...newlyStaged]) {
          const evalResult = evaluateClash(candidate, {
            firstName: prev.parsedData.firstName,
            lastName: prev.parsedData.lastName,
            middleName: prev.parsedData.middleName,
            className: prev.parsedData.className,
            guardianPhone: prev.parsedData.guardianPhone,
            gender: prev.parsedData.gender,
            admissionNumber: prev.parsedData.admissionNumber,
          });

          if (evalResult.isWarning || evalResult.isClash) {
            clashCandidateId = prev._id ?? undefined;
            clashConfidence = evalResult.confidence;
            clashReason = `Staged duplicate (Row #${prev.rowNumber}): ${evalResult.reason}`;
            break;
          }
        }
      }

      const familyClusterKey = generateFamilyClusterKey(data.guardianPhone);

      let validationStatus: "valid" | "warning" | "error" = "valid";
      if (validationErrors.length > 0) {
        validationStatus = "error";
      } else if (clashConfidence && clashConfidence >= 50) {
        validationStatus = "warning";
      }

      const insertedId = await ctx.db.insert("stagedImportRecords", {
        workspaceId: args.workspaceId,
        schoolId: args.schoolId,
        rowNumber: rec.rowNumber,
        entityType: rec.entityType,
        rawPayload: rec.rawPayload,
        parsedData: data,
        validationStatus,
        validationErrors,
        clashCandidateId,
        existingStudentId,
        clashConfidence,
        clashReason,
        familyClusterKey,
        isResolved: !clashConfidence || clashConfidence < 50,
        updatedAt: now,
      });

      newlyStaged.push({
        _id: insertedId,
        rowNumber: rec.rowNumber,
        parsedData: data,
        validationStatus,
      });
    }

    // 6. Recalculate workspace counters
    const allStaged = await ctx.db
      .query("stagedImportRecords")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", args.workspaceId))
      .take(1000);

    const validCount = allStaged.filter((r) => r.validationStatus === "valid").length;
    const warningCount = allStaged.filter((r) => r.validationStatus === "warning").length;
    const errorCount = allStaged.filter((r) => r.validationStatus === "error").length;

    await ctx.db.patch(args.workspaceId, {
      totalRecords: allStaged.length,
      validRecords: validCount,
      warningRecords: warningCount,
      errorRecords: errorCount,
      status: "reviewing",
      updatedAt: now,
    });

    return {
      stagedCount: args.records.length,
      totalRecords: allStaged.length,
      validRecords: validCount,
      warningRecords: warningCount,
      errorRecords: errorCount,
    };
  },
});
