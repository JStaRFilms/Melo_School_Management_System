import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as migrationWorkspace from "../migrationWorkspace";
import * as migrationIngest from "../migrationIngest";
import * as migrationAutosave from "../migrationAutosave";
import * as migrationMerge from "../migrationMerge";

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

    return { schoolA, schoolB, adminA, teacherA, superAdmin, jss1Class };
  });

  return { t, ...data };
}

describe("Migration Lifecycle Engine", () => {
  it("Authentication Guard: rejects non-admins and allows schoolAdmin & platformSuperAdmin", async () => {
    const { t, schoolA, schoolB } = await setupTestFixture();

    // 1. Unauthenticated -> fails
    await expect(
      t.mutation(createWorkspace, {
        schoolId: schoolA,
        name: "Test Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("Unauthorized");

    // 2. Teacher (non-admin) -> fails
    const teacherSession = t.withIdentity({ subject: "auth-teacher-a" });
    await expect(
      teacherSession.mutation(createWorkspace, {
        schoolId: schoolA,
        name: "Test Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("Admin access required");

    // 3. Cross-school access -> fails
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });
    await expect(
      adminSession.mutation(createWorkspace, {
        schoolId: schoolB,
        name: "Cross School Import",
        mode: "school_admin",
      })
    ).rejects.toThrow("Cross-school access denied");

    // 4. School Admin on own school -> succeeds
    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "2026 Intake",
      mode: "school_admin",
    });
    expect(workspaceId).toBeDefined();

    // 5. Platform Super Admin on any school -> succeeds
    const superSession = t.withIdentity({ subject: "auth-super-admin" });
    const superWorkspaceId = await superSession.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "Super Admin Import",
      mode: "super_admin",
    });
    expect(superWorkspaceId).toBeDefined();
  });

  it("Clash Detection: flags warning with >= 80% confidence for similar names in same class", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });

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
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });

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
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });

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
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });

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
    const adminSession = t.withIdentity({ subject: "auth-admin-a" });

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
    ).rejects.toThrow("Cannot commit workspace with 1 blocking validation errors");

    // Live student table remains completely empty
    await t.run(async (ctx) => {
      const liveStudents = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(liveStudents.length).toBe(0);
    });
  });
});
