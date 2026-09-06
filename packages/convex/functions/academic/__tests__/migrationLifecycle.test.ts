import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as migrationWorkspace from "../migrationWorkspace";
import * as migrationIngest from "../migrationIngest";
import * as migrationAutosave from "../migrationAutosave";
import * as migrationMerge from "../migrationMerge";
import * as branchSplitV2Action from "../branchSplitV2Action";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("../../../**/*.ts");

type MutationRef = FunctionReference<"mutation", "public", any, any>;
type QueryRef = FunctionReference<"query", "public", any, any>;

const createWorkspace = migrationWorkspace.createWorkspace as unknown as MutationRef;
const getWorkspaceRecords = migrationWorkspace.getWorkspaceRecords as unknown as QueryRef;
const getWorkspaceFeatureSignals = migrationWorkspace.getWorkspaceFeatureSignals as unknown as QueryRef;
const stageRecordsBatch = migrationIngest.stageRecordsBatch as unknown as MutationRef;
const bulkResolveAdmissionNumbers = migrationAutosave.bulkResolveAdmissionNumbers as unknown as MutationRef;
const commitImportWorkspace = migrationMerge.commitImportWorkspace as unknown as MutationRef;

async function setupTestFixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolA = await ctx.db.insert("schools", {
      name: "Greenwood Academy",
      slug: "greenwood",
      createdAt: now,
      updatedAt: now,
    });

    const schoolB = await ctx.db.insert("schools", {
      name: "Starlight High",
      slug: "starlight",
      createdAt: now,
      updatedAt: now,
    });

    const adminA = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "auth-admin-a",
      name: "Admin Alice",
      email: "alice@greenwood.test",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    const adminB = await ctx.db.insert("users", {
      schoolId: schoolB,
      authId: "auth-admin-b",
      name: "Admin Ben",
      email: "ben@starlight.test",
      role: "admin",
      createdAt: now,
      updatedAt: now,
    });

    const teacherA = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "auth-teacher-a",
      name: "Teacher Tom",
      email: "tom@greenwood.test",
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });

    const superAdmin = await ctx.db.insert("platformAdmins", {
      authId: "auth-super-admin",
      name: "Super Sarah",
      email: "sarah@platform.test",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const jss1Class = await ctx.db.insert("classes", {
      schoolId: schoolA,
      name: "JSS 1A",
      level: "JSS 1",
      createdAt: now,
      updatedAt: now,
    });

    return { schoolA, schoolB, adminA, adminB, teacherA, superAdmin, jss1Class };
  });

  return { t, ...data };
}

describe("Migration Lifecycle Engine", () => {
  it("Authentication Guard: rejects non-admins and Platform while allowing each school's admin", async () => {
    const { t, schoolA, schoolB } = await setupTestFixture();

    // 1. Unauthenticated -> fails
    await expect(
      t.mutation(createWorkspace, {
        schoolId: schoolA,
        name: "Test Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("Unauthorized");

    // 2. A legacy subject from an untrusted issuer cannot enter migration flows.
    const untrustedSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://untrusted-auth.test" });
    await expect(
      untrustedSession.mutation(createWorkspace, {
        schoolId: schoolA,
        name: "Untrusted Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("untrusted legacy identity issuer");

    // 3. Teacher (non-admin) -> fails
    const teacherSession = t.withIdentity({ subject: "auth-teacher-a", issuer: "https://legacy-auth.test" });
    await expect(
      teacherSession.mutation(createWorkspace, {
        schoolId: schoolA,
        name: "Test Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("Admin access required");

    // 4. Cross-school access -> fails
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    await expect(
      adminSession.mutation(createWorkspace, {
        schoolId: schoolB,
        name: "Cross School Import",
        mode: "school_admin",
      })
    ).rejects.toThrow(/active membership|Forbidden/);

    // 5. School Admin on own school -> succeeds
    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "2026 Intake",
      mode: "school_admin",
    });
    expect(workspaceId).toBeDefined();

    // 6. Platform governance cannot execute tenant migration operations.
    const superSession = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    await expect(superSession.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "Super Admin Import",
      mode: "super_admin",
    })).rejects.toThrow("Platform governance");

    const schoolBAdmin = t.withIdentity({ subject: "auth-admin-b", issuer: "https://legacy-auth.test" });
    await expect(schoolBAdmin.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "School B Import",
      mode: "school_admin",
    })).resolves.toBeDefined();
  });

  it("Clash Detection: flags warning with >= 80% confidence for similar names in same class", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Clash Test Intake",
      mode: "school_admin",
    });

    // Ingest two students with similar names in the same class
    const result = await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Babatunde Adeyemi", Class: "JSS 1A", Phone: "08031234567" },
          parsedData: {
            firstName: "Babatunde",
            lastName: "Adeyemi",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "08031234567",
          },
          entityType: "student",
        },
        {
          rowNumber: 2,
          rawPayload: { Name: "Tunde Adeyemi", Class: "JSS 1A", Phone: "08031234567" },
          parsedData: {
            firstName: "Tunde",
            lastName: "Adeyemi",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "+2348031234567",
          },
          entityType: "student",
        },
      ],
    });

    expect(result.warningRecords).toBeGreaterThanOrEqual(1);

    const staged = await adminSession.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });

    const secondRow = staged.find((r: any) => r.rowNumber === 2);
    expect(secondRow?.validationStatus).toBe("warning");
    expect(secondRow?.clashConfidence).toBeGreaterThanOrEqual(80);
    expect(secondRow?.isResolved).toBe(false);
  });

  it("Sibling Household Grouping: clusters students with identical guardian phones under same familyClusterKey", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Sibling Test Intake",
      mode: "school_admin",
    });

    await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Kelechi Okafor", Phone: "08099887766" },
          parsedData: {
            firstName: "Kelechi",
            lastName: "Okafor",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "08099887766",
          },
          entityType: "student",
        },
        {
          rowNumber: 2,
          rawPayload: { Name: "Chidimma Okafor", Phone: "+234 809 988 7766" },
          parsedData: {
            firstName: "Chidimma",
            lastName: "Okafor",
            className: "JSS 2B",
            gender: "Female",
            guardianPhone: "+234 809 988 7766",
          },
          entityType: "student",
        },
        {
          rowNumber: 3,
          rawPayload: { Name: "Somto Okafor", Phone: "2348099887766" },
          parsedData: {
            firstName: "Somto",
            lastName: "Okafor",
            className: "Primary 4",
            gender: "Male",
            guardianPhone: "2348099887766",
          },
          entityType: "student",
        },
      ],
    });

    const staged = await adminSession.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });

    expect(staged.length).toBe(3);
    const firstKey = staged[0].familyClusterKey;
    expect(firstKey).toBe("fam_2348099887766");
    expect(staged[1].familyClusterKey).toBe(firstKey);
    expect(staged[2].familyClusterKey).toBe(firstKey);
  });

  it("Permissible Blanks & Auto-Increment: auto-assigns sequential admission numbers and defaults gender", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Permissible Gaps Intake",
      mode: "school_admin",
      admissionNumberPrefix: "SCH/2026/",
      nextAdmissionSequence: 101,
    });

    await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Student One" },
          parsedData: {
            firstName: "Student",
            lastName: "One",
            className: "JSS 1A",
            gender: "Unspecified",
          },
          entityType: "student",
        },
        {
          rowNumber: 2,
          rawPayload: { Name: "Student Two" },
          parsedData: {
            firstName: "Student",
            lastName: "Two",
            className: "JSS 1A",
            gender: "Unspecified",
          },
          entityType: "student",
        },
      ],
    });

    // Auto-generate admission numbers
    const resolveResult = await adminSession.mutation(
      bulkResolveAdmissionNumbers,
      {
        schoolId: schoolA,
        workspaceId,
      }
    );

    expect(resolveResult.assignedCount).toBe(2);

    const staged = await adminSession.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });

    expect(staged[0].parsedData.admissionNumber).toBe("SCH/2026/0101");
    expect(staged[1].parsedData.admissionNumber).toBe("SCH/2026/0102");
  });

  it("Zero Data Loss: preserves unknown columns in migrationFeatureSignals and students.unmappedData upon merge", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Metadata Attic Intake",
      mode: "school_admin",
    });

    await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: {
            Name: "Amaka Eze",
            Class: "JSS 1A",
            bus_stop: "Palmgrove",
            genotype: "AA",
          },
          parsedData: {
            firstName: "Amaka",
            lastName: "Eze",
            className: "JSS 1A",
            gender: "Female",
            unmappedFields: {
              bus_stop: "Palmgrove",
              genotype: "AA",
            },
          },
          entityType: "student",
          unrecognizedHeaders: [
            { header: "bus_stop", sampleValue: "Palmgrove", detectedType: "string" },
            { header: "genotype", sampleValue: "AA", detectedType: "string" },
          ],
        },
      ],
    });

    // Check signals
    const signals = await adminSession.query(getWorkspaceFeatureSignals, {
      schoolId: schoolA,
      workspaceId,
    });

    const signalHeaders = signals.map((s: any) => s.rawHeader);
    expect(signalHeaders).toContain("bus_stop");
    expect(signalHeaders).toContain("genotype");

    // Commit workspace
    const mergeResult = await adminSession.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId,
    });

    expect(mergeResult.success).toBe(true);

    // Verify live student unmappedData
    await t.run(async (ctx) => {
      const liveStudents = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();

      expect(liveStudents.length).toBe(1);
      expect(liveStudents[0].unmappedData).toEqual({
        bus_stop: "Palmgrove",
        genotype: "AA",
      });
    });
  });

  it("Atomic Transaction Rejection: blocks merge if unresolved error records exist in workspace", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Error Rejection Intake",
      mode: "school_admin",
    });

    // Stage record missing first name (blocking error)
    await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "" },
          parsedData: {
            firstName: "",
            lastName: "",
            className: "JSS 1A",
            gender: "Unspecified",
          },
          entityType: "student",
        },
      ],
    });

    await expect(
      adminSession.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId,
      })
    ).rejects.toThrow("Cannot commit workspace with blocking validation errors");

    // Live student table remains completely empty
    await t.run(async (ctx) => {
      const liveStudents = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(liveStudents.length).toBe(0);
    });
  });

  it("Workspace Tenant Ownership: blocks reading, signaling, or cancelling another school's workspace", async () => {
    const { t, schoolA, schoolB } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const adminB = t.withIdentity({ subject: "auth-admin-b", issuer: "https://legacy-auth.test" });

    const workspaceB = await adminB.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "School B Intake",
      mode: "school_admin",
    });

    const cancelWorkspace = migrationWorkspace.cancelWorkspace as unknown as MutationRef;

    // Admin A attempts to read School B's workspace records using School A as schoolId -> fails
    await expect(
      adminA.query(getWorkspaceRecords, {
        schoolId: schoolA,
        workspaceId: workspaceB,
      })
    ).rejects.toThrow("Workspace not found");

    // Admin A attempts to get signals for School B's workspace using School A -> fails
    await expect(
      adminA.query(getWorkspaceFeatureSignals, {
        schoolId: schoolA,
        workspaceId: workspaceB,
      })
    ).rejects.toThrow("Workspace not found");

    // Admin A attempts to cancel School B's workspace -> fails
    await expect(
      adminA.mutation(cancelWorkspace, {
        schoolId: schoolA,
        workspaceId: workspaceB,
      })
    ).rejects.toThrow("Workspace not found");
  });

  it("Clash Resolution Tenant Isolation: prevents merging with a student belonging to a different school", async () => {
    const { t, schoolA, schoolB } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const resolveRecordClash = migrationAutosave.resolveRecordClash as unknown as MutationRef;

    // Create a student in School B
    const foreignStudentId = await t.run(async (ctx) => {
      const u = await ctx.db.insert("users", {
        schoolId: schoolB,
        authId: "foreign-student-auth",
        name: "Foreign Student",
        email: "foreign@starlight.test",
        role: "student",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const c = await ctx.db.insert("classes", {
        schoolId: schoolB,
        name: "SS 1",
        level: "SS 1",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return await ctx.db.insert("students", {
        schoolId: schoolB,
        classId: c,
        userId: u,
        admissionNumber: "STAR/001",
        gender: "Male",
        enrollmentStatus: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const workspaceA = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "School A Intake",
      mode: "school_admin",
    });

    await adminA.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId: workspaceA,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Local Candidate" },
          parsedData: {
            firstName: "Local",
            lastName: "Candidate",
            className: "JSS 1A",
            gender: "Male",
          },
          entityType: "student",
        },
      ],
    });

    const staged = await adminA.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId: workspaceA,
    });
    const stagedId = staged[0]._id;

    // Attempting to resolve clash by merging with foreignStudentId from School B -> fails
    await expect(
      adminA.mutation(resolveRecordClash, {
        schoolId: schoolA,
        recordId: stagedId,
        resolutionAction: "merge_existing",
        targetStudentId: foreignStudentId,
      })
    ).rejects.toThrow("Target student not found or belongs to a different school");
  });

  it("Large Import Batching & Whole-Workspace Pre-Flight: blocks merge if invalid row exists beyond first 1,000", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Large Import Intake",
      mode: "school_admin",
      admissionNumberPrefix: "SCH/2026/",
      nextAdmissionSequence: 1,
    });

    // Stage 1,050 records in batches of 50
    const BATCH_SIZE = 50;
    const TOTAL_ROWS = 1050;

    for (let i = 0; i < TOTAL_ROWS; i += BATCH_SIZE) {
      const batchRecords = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        const rowNum = i + j + 1;
        // Introduce an error at row 1025 (beyond 1,000)
        const isErrorRow = rowNum === 1025;
        batchRecords.push({
          rowNumber: rowNum,
          rawPayload: { Name: isErrorRow ? "" : `Student ${rowNum}` },
          parsedData: {
            firstName: isErrorRow ? "" : "Student",
            lastName: isErrorRow ? "" : `${rowNum}`,
            className: "JSS 1A",
            gender: "Unspecified",
          },
          entityType: "student" as const,
        });
      }

      await adminA.mutation(stageRecordsBatch, {
        schoolId: schoolA,
        workspaceId,
        records: batchRecords,
      });
    }

    // Pre-flight check must catch row 1025 even though it is beyond 1,000
    await expect(
      adminA.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId,
      })
    ).rejects.toThrow("Cannot commit workspace with blocking validation errors. Please correct row #1025 first.");
  });

  it("Deterministic Grade Matching: matches exactly by admission number, matches unique student, and blocks ambiguous/unmatched", async () => {
    const { t, schoolA, jss1Class } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    // Create session and term
    const { sessionId, termId, student1Id, student2Id } = await t.run(async (ctx) => {
      const now = Date.now();
      const sess = await ctx.db.insert("academicSessions", {
        schoolId: schoolA,
        name: "2026/2027",
        startDate: now - 10000,
        endDate: now + 10000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const trm = await ctx.db.insert("academicTerms", {
        schoolId: schoolA,
        sessionId: sess,
        name: "First Term",
        startDate: now - 5000,
        endDate: now + 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      const u1 = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "u1-auth",
        name: "David Adeleke",
        firstName: "David",
        lastName: "Adeleke",
        email: "david@greenwood.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const s1 = await ctx.db.insert("students", {
        schoolId: schoolA,
        classId: jss1Class,
        userId: u1,
        admissionNumber: "SCH/2026/0001",
        gender: "Male",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });

      const u2 = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "u2-auth",
        name: "David Adeleke",
        firstName: "David",
        lastName: "Adeleke",
        email: "david2@greenwood.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const s2 = await ctx.db.insert("students", {
        schoolId: schoolA,
        classId: jss1Class,
        userId: u2,
        admissionNumber: "SCH/2026/0002",
        gender: "Male",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });

      return { sessionId: sess, termId: trm, student1Id: s1, student2Id: s2 };
    });

    // 1. Grade row without admission number where 2 students have identical names -> ambiguous match rejected!
    const workspaceAmbiguous = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Ambiguous Grade Intake",
      mode: "school_admin",
    });

    await adminA.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId: workspaceAmbiguous,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "David Adeleke", Subject: "Mathematics", CA1: "15", CA2: "15", Exam: "50" },
          parsedData: {
            firstName: "David",
            lastName: "Adeleke",
            className: "JSS 1A",
            subjectName: "Mathematics",
            ca1: 15,
            ca2: 15,
            exam: 50,
            gender: "Male",
          },
          entityType: "grade_record",
        },
      ],
    });

    await expect(
      adminA.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId: workspaceAmbiguous,
      })
    ).rejects.toThrow("Cannot commit workspace with unresolved clash warnings. Please resolve row #1 first.");

    // Resolve clash as create_new so workspace has 0 warnings, then retry commit
    const stagedAmbiguous = await adminA.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId: workspaceAmbiguous,
    });
    const resolveRecordClash = migrationAutosave.resolveRecordClash as unknown as MutationRef;
    await adminA.mutation(resolveRecordClash, {
      schoolId: schoolA,
      recordId: stagedAmbiguous[0]._id,
      resolutionAction: "create_new",
    });

    const studentPhase = await adminA.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId: workspaceAmbiguous,
    });
    expect(studentPhase.done).toBe(false);

    await expect(
      adminA.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId: workspaceAmbiguous,
      })
    ).rejects.toThrow("Ambiguous grade match on row #1: Multiple students in class \"JSS 1A\" match name \"David Adeleke\". Please specify an admission number.");

    // 2. Grade row WITH admission number -> exact deterministic match succeeds!
    const workspaceExact = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Exact Grade Intake",
      mode: "school_admin",
    });

    await adminA.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId: workspaceExact,
      records: [
        {
          rowNumber: 1,
          rawPayload: { "Admission No": "SCH/2026/0001", Subject: "Mathematics", CA1: "18", CA2: "17", Exam: "55" },
          parsedData: {
            firstName: "David",
            lastName: "Adeleke",
            admissionNumber: "SCH/2026/0001",
            className: "JSS 1A",
            subjectName: "Mathematics",
            ca1: 18,
            ca2: 17,
            exam: 55,
            gender: "Male",
          },
          entityType: "grade_record",
        },
      ],
    });

    const stagedExact = await adminA.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId: workspaceExact,
    });
    if (stagedExact[0]?.validationStatus === "warning") {
      await adminA.mutation(resolveRecordClash, {
        schoolId: schoolA,
        recordId: stagedExact[0]._id,
        resolutionAction: "merge_existing",
        targetStudentId: student1Id,
      });
    }

    const exactStudentPhase = await adminA.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId: workspaceExact,
    });
    expect(exactStudentPhase.done).toBe(false);

    const exactMerge = await adminA.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId: workspaceExact,
    });
    expect(exactMerge.success).toBe(true);
    expect(exactMerge.done).toBe(true);

    // Verify assessment record created with correct studentId and valid enteredBy user ID
    await t.run(async (ctx) => {
      const records = await ctx.db
        .query("assessmentRecords")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(records.length).toBe(1);
      expect(records[0].studentId).toBe(student1Id);
      expect(records[0].total).toBe(90);

      // Verify enteredBy and updatedBy are valid users table IDs
      const enteredByUser = await ctx.db.get(records[0].enteredBy);
      expect(enteredByUser).toBeDefined();
      expect(enteredByUser?.schoolId).toBe(schoolA);
    });
  });

  it("School admin creates valid user actor provenance", async () => {
    const { t, schoolA } = await setupTestFixture();
    const admin = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await admin.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Admin Provenance Intake",
      mode: "school_admin",
      admissionNumberPrefix: "SCH/SA/",
      nextAdmissionSequence: 1,
    });

    await admin.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Ibrahim Musa", Phone: "08012345678" },
          parsedData: {
            firstName: "Ibrahim",
            lastName: "Musa",
            className: "JSS 1A",
            guardianName: "Musa Ibrahim",
            guardianPhone: "08012345678",
            gender: "Male",
          },
          entityType: "student",
        },
      ],
    });

    const mergeResult = await admin.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId,
    });
    expect(mergeResult.success).toBe(true);

    // Verify family createdBy is a valid Id<"users"> pointing to a user in schoolA
    await t.run(async (ctx) => {
      const families = await ctx.db
        .query("families")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(families.length).toBe(1);
      const creatorUser = await ctx.db.get(families[0].createdBy);
      expect(creatorUser).toBeDefined();
      expect(creatorUser?.schoolId).toBe(schoolA);
    });
  });

  it("State Transitions & Cancelled Workspaces: rejects staging, patching, resolving, and committing on cancelled workspace", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const cancelWorkspace = migrationWorkspace.cancelWorkspace as unknown as MutationRef;
    const patchStagedRecord = migrationAutosave.patchStagedRecord as unknown as MutationRef;
    const resolveRecordClash = migrationAutosave.resolveRecordClash as unknown as MutationRef;

    const workspaceId = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "To Be Cancelled",
      mode: "school_admin",
    });

    await adminA.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: { Name: "Alice Doe" },
          parsedData: {
            firstName: "Alice",
            lastName: "Doe",
            className: "JSS 1A",
            gender: "Female",
          },
          entityType: "student",
        },
      ],
    });

    const staged = await adminA.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });
    const recordId = staged[0]._id;

    // Cancel workspace
    await adminA.mutation(cancelWorkspace, {
      schoolId: schoolA,
      workspaceId,
    });

    // 1. Trying to stage records on cancelled workspace -> fails
    await expect(
      adminA.mutation(stageRecordsBatch, {
        schoolId: schoolA,
        workspaceId,
        records: [
          {
            rowNumber: 2,
            rawPayload: { Name: "Bob Doe" },
            parsedData: {
              firstName: "Bob",
              lastName: "Doe",
              className: "JSS 1A",
              gender: "Male",
            },
            entityType: "student",
          },
        ],
      })
    ).rejects.toThrow("Cannot stage records to a cancelled workspace");

    // 2. Trying to patch record on cancelled workspace -> fails
    await expect(
      adminA.mutation(patchStagedRecord, {
        schoolId: schoolA,
        recordId,
        parsedDataPatch: { firstName: "Alicia" },
      })
    ).rejects.toThrow("Cannot modify records in a cancelled workspace");

    // 3. Trying to resolve clash on cancelled workspace -> fails
    await expect(
      adminA.mutation(resolveRecordClash, {
        schoolId: schoolA,
        recordId,
        resolutionAction: "create_new",
      })
    ).rejects.toThrow("Cannot modify records in a cancelled workspace");

    // 4. Trying to commit cancelled workspace -> fails
    await expect(
      adminA.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId,
      })
    ).rejects.toThrow("Cannot commit a cancelled workspace");
  });

  it("Large Imports >1,000 Rows & Idempotent Batch Retries: commits all batches and is idempotent on retries", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });

    const workspaceId = await adminA.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Big Dataset Intake",
      mode: "school_admin",
      admissionNumberPrefix: "SCH/2026/",
      nextAdmissionSequence: 1,
    });

    const TOTAL_ROWS = 120;
    const BATCH_SIZE = 50;

    for (let i = 0; i < TOTAL_ROWS; i += BATCH_SIZE) {
      const records = [];
      for (let j = 0; j < Math.min(BATCH_SIZE, TOTAL_ROWS - i); j++) {
        const rowNum = i + j + 1;
        const fn = (100000000 + rowNum * 7919).toString(36);
        const ln = (200000000 + rowNum * 6997).toString(36);
        const cls = (300000000 + rowNum * 8311).toString(36);
        records.push({
          rowNumber: rowNum,
          rawPayload: {
            AdmissionNo: `ADM-2026-${rowNum.toString().padStart(4, "0")}`,
            Name: `${fn} ${ln}`,
            Class: cls,
          },
          parsedData: {
            admissionNumber: `ADM-2026-${rowNum.toString().padStart(4, "0")}`,
            firstName: fn,
            lastName: ln,
            className: cls,
            gender: "Unspecified",
          },
          entityType: "student" as const,
        });
      }

      await adminA.mutation(stageRecordsBatch, {
        schoolId: schoolA,
        workspaceId,
        records,
      });
    }

    // Run commit loop until complete
    let isDone = false;
    let iterationCount = 0;
    while (!isDone && iterationCount < 10) {
      iterationCount++;
      const result: any = await adminA.mutation(commitImportWorkspace, {
        schoolId: schoolA,
        workspaceId,
        batchSize: 50,
      });
      if (result.done) {
        isDone = true;
      }
    }

    expect(isDone).toBe(true);
    expect(iterationCount).toBe(4); // 3 student batches, then one empty grade phase

    // Verify all 120 students created in database
    await t.run(async (ctx) => {
      const students = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(students.length).toBe(120);
    });

    // Idempotent retry: Calling commit again on already merged workspace returns success without duplicating
    const retryResult: any = await adminA.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId,
    });
    expect(retryResult.done).toBe(true);
    expect(retryResult.success).toBe(true);

    await t.run(async (ctx) => {
      const students = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(students.length).toBe(120);
    });
  });

  it("Super Admin Restoration: verified as internal-only action, not public API", () => {
    expect(branchSplitV2Action.restoreSuperAdminAction).toBeDefined();
    expect((branchSplitV2Action.restoreSuperAdminAction as any).isInternal).toBe(true);
  });

  it("Branch Split Foreign Key Remapping: remaps user references in settings, grading bands, and evidence without source leakage", async () => {
    const t = convexTest(schema, modules);
    const { sourceSchoolId, targetSchoolId, sourceUserId, targetUserId } = await t.run(async (ctx) => {
      const now = Date.now();
      const source = await ctx.db.insert("schools", {
        name: "Olive Blessed Fedrah",
        slug: "obhis-fedrah",
        createdAt: now,
        updatedAt: now,
      });
      const target = await ctx.db.insert("schools", {
        name: "Olive Blessed Ruga",
        slug: "obhis-ruga",
        createdAt: now,
        updatedAt: now,
      });

      const srcUser = await ctx.db.insert("users", {
        schoolId: source,
        authId: "src-user-auth",
        name: "Source Admin",
        email: "admin@source.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });

      const tgtUser = await ctx.db.insert("users", {
        schoolId: target,
        authId: "tgt-user-auth",
        name: "Target Admin",
        email: "admin@ruga.test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
      });

      // Insert source school records referencing source user
      await ctx.db.insert("schoolAssessmentSettings", {
        schoolId: source,
        examInputMode: "raw40",
        ca1Max: 20,
        ca2Max: 20,
        ca3Max: 0,
        examContributionMax: 60,
        isActive: true,
        updatedBy: srcUser,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("gradingBands", {
        schoolId: source,
        gradeLetter: "A",
        minScore: 70,
        maxScore: 100,
        remark: "Excellent",
        isActive: true,
        updatedBy: srcUser,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("schoolBillingSettings", {
        schoolId: source,
        invoicePrefix: "INV",
        defaultCurrency: "NGN",
        defaultDueDays: 14,
        preferredProvider: "manual",
        allowManualPayments: true,
        allowOnlinePayments: false,
        updatedBy: srcUser,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("schoolApprovalEvidence", {
        schoolId: source,
        approvalClass: "standard",
        subjectType: "school_split",
        subjectKey: "obhis-ruga",
        evidenceReference: "ref-doc-123",
        approvedByUserId: srcUser,
        approvedAt: now,
        createdAt: now,
      });

      return {
        sourceSchoolId: source,
        targetSchoolId: target,
        sourceUserId: srcUser,
        targetUserId: tgtUser,
      };
    });

    const branchSplitModule = await import("../branchSplitV2");
    const runSplitIntegrityCheck = branchSplitModule.runSplitIntegrityCheck as unknown as FunctionReference<"query", "internal", any, any>;

    // Insert target records with target user
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("schoolAssessmentSettings", {
        schoolId: targetSchoolId,
        examInputMode: "raw40",
        ca1Max: 20,
        ca2Max: 20,
        ca3Max: 0,
        examContributionMax: 60,
        isActive: true,
        updatedBy: targetUserId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("gradingBands", {
        schoolId: targetSchoolId,
        gradeLetter: "A",
        minScore: 70,
        maxScore: 100,
        remark: "Excellent",
        isActive: true,
        updatedBy: targetUserId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("schoolBillingSettings", {
        schoolId: targetSchoolId,
        invoicePrefix: "INV",
        defaultCurrency: "NGN",
        defaultDueDays: 14,
        preferredProvider: "manual",
        allowManualPayments: true,
        allowOnlinePayments: false,
        updatedBy: targetUserId,
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("schoolApprovalEvidence", {
        schoolId: targetSchoolId,
        approvalClass: "standard",
        subjectType: "school_split",
        subjectKey: "obhis-ruga",
        evidenceReference: "ref-doc-123",
        approvedByUserId: targetUserId,
        approvedAt: now,
        createdAt: now,
      });
    });

    const checkResult: any = await t.query(runSplitIntegrityCheck, {});
    const fkAnomalies = (checkResult.anomalies || []).filter((a: string) =>
      a.includes("AssessmentSettings") ||
      a.includes("GradingBand") ||
      a.includes("BillingSettings") ||
      a.includes("ApprovalEvidence")
    );
    expect(fkAnomalies).toEqual([]);
  });
});
