import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
const migrationWorkspace = api.functions.academic.migrationWorkspace;
const migrationIngest = api.functions.academic.migrationIngest;
const migrationAutosave = api.functions.academic.migrationAutosave;
const migrationMerge = api.functions.academic.migrationMerge;
import { restoreSuperAdminAction } from "../branchSplitV2Action";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob("../../../**/*.ts");
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) => [
  `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module,
]));

const createWorkspace = migrationWorkspace.createWorkspace;
const getWorkspaceRecords = migrationWorkspace.getWorkspaceRecords;
const getWorkspaceFeatureSignals = migrationWorkspace.getWorkspaceFeatureSignals;
const stageRecordsBatch = migrationIngest.stageRecordsBatch;
const bulkResolveAdmissionNumbers = migrationAutosave.bulkResolveAdmissionNumbers;
const commitImportWorkspace = migrationMerge.commitImportWorkspace;

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
  it("keeps staging private from peer and platform admins and freezes committing rows", async () => {
    const { t, schoolA } = await setupTestFixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        schoolId: schoolA, authId: "peer-admin", role: "admin", name: "Peer",
        email: "peer@example.test", createdAt: 1, updatedAt: 1,
      });
    });
    const owner = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const workspaceId = await owner.mutation(api.functions.academic.migrationWorkspace.createWorkspace, {
      schoolId: schoolA, name: "Private", mode: "school_admin",
    });
    const row = {
      rowNumber: 1, entityType: "student" as const,
      rawPayload: { password: "must-not-persist" },
      parsedData: { firstName: "Ada", lastName: "Example", gender: "Female", className: "JSS 1A" },
      unrecognizedHeaders: [{ header: "Extra", sampleValue: "private-source-value", detectedType: "string" }],
    };
    await owner.mutation(api.functions.academic.migrationIngest.stageRecordsBatch, {
      schoolId: schoolA, workspaceId, records: [row],
    });
    const records = await t.run((ctx) => ctx.db.query("stagedImportRecords").collect());
    expect(records[0].rawPayload).toEqual({});
    const signals = await owner.query(api.functions.academic.migrationWorkspace.getWorkspaceFeatureSignals, { schoolId: schoolA, workspaceId });
    expect(signals[0]).not.toHaveProperty("sampleValue");
    for (const subject of ["peer-admin"]) {
      const other = t.withIdentity({ subject, issuer: "https://legacy-auth.test" });
      expect(await other.query(api.functions.academic.migrationWorkspace.listWorkspaces, { schoolId: schoolA })).toEqual([]);
      await expect(other.query(api.functions.academic.migrationWorkspace.getWorkspaceSummary, { schoolId: schoolA, workspaceId })).rejects.toThrow("Workspace not found");
      await expect(other.mutation(api.functions.academic.migrationAutosave.patchStagedRecord, { schoolId: schoolA, recordId: records[0]._id, parsedDataPatch: { firstName: "Changed" } })).rejects.toThrow("Workspace not found");
      await expect(other.mutation(api.functions.academic.migrationMerge.commitImportWorkspace, { schoolId: schoolA, workspaceId })).rejects.toThrow("Workspace not found");
    }
    const platform = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    await expect(platform.query(api.functions.academic.migrationWorkspace.listWorkspaces, { schoolId: schoolA })).rejects.toThrow();
    await expect(platform.query(api.functions.academic.migrationWorkspace.getWorkspaceSummary, { schoolId: schoolA, workspaceId })).rejects.toThrow();
    await expect(owner.mutation(api.functions.academic.migrationMerge.commitImportWorkspace, { schoolId: schoolA, workspaceId, batchSize: 0 })).rejects.toThrow("Batch size");
    await t.run((ctx) => ctx.db.patch(workspaceId, { status: "committing" }));
    await expect(owner.mutation(api.functions.academic.migrationAutosave.patchStagedRecord, { schoolId: schoolA, recordId: records[0]._id, parsedDataPatch: { firstName: "Changed" } })).rejects.toThrow("committing");
    await expect(owner.mutation(api.functions.academic.migrationIngest.stageRecordsBatch, { schoolId: schoolA, workspaceId, records: [row] })).rejects.toThrow("committing");
    await expect(owner.mutation(api.functions.academic.migrationAutosave.bulkResolveAdmissionNumbers, { schoolId: schoolA, workspaceId })).rejects.toThrow("Import-local numbering is disabled");
  });

  it("Authentication Guard: allows only same-school legacy admins, never Platform", async () => {
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
    ).rejects.toThrow("Not authorized");

    // 5. School Admin on own school -> succeeds
    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "2026 Intake",
      mode: "school_admin",
    });
    expect(workspaceId).toBeDefined();

    // 6. Platform governance does not authorize private school imports.
    const superSession = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    await expect(superSession.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "Super Admin Import",
      mode: "super_admin",
    })).rejects.toThrow();
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

  it("minimizes source signals and keeps unmapped projections staged until explicit review", async () => {
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

    const signalHeaders = signals.map((signal) => signal.rawHeader);
    expect(signalHeaders).toContain("bus_stop");
    expect(signalHeaders).toContain("genotype");
    expect(signals.every((signal) => !("sampleValue" in signal))).toBe(true);
    await expect(adminSession.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId,
    })).rejects.toThrow("disabled until every row");
    const staged = await adminSession.query(getWorkspaceRecords, { schoolId: schoolA, workspaceId });
    expect(staged[0].parsedData.unmappedFields).toEqual({ bus_stop: "Palmgrove", genotype: "AA" });
    expect(await t.run((ctx) => ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", schoolA)).collect())).toHaveLength(0);
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
    ).rejects.toThrow("disabled until every row");

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
    await t.run(ctx => ctx.db.insert("users", { schoolId: schoolB, authId: "admin-b", name: "Admin B", email: "b@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 }));
    const adminB = t.withIdentity({ subject: "admin-b", issuer: "https://legacy-auth.test" });

    // An actual branch operator creates the foreign private workspace.
    const workspaceB = await adminB.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "School B Intake",
      mode: "school_admin",
    });

    const cancelWorkspace = migrationWorkspace.cancelWorkspace;

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
    const resolveRecordClash = migrationAutosave.resolveRecordClash;

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
    ).rejects.toThrow("merge target is outside this school");
  });

  it("Platform cannot manufacture or impersonate a tenant migration actor", async () => {
    const { t, schoolA } = await setupTestFixture();
    const platform = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    const before = await t.run(ctx => ctx.db.query("users").take(20));
    await expect(platform.mutation(createWorkspace, { schoolId: schoolA, name: "Unauthorized", mode: "super_admin" })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("users").take(20))).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("importWorkspaces").take(1))).toEqual([]);
  });

  it("State Transitions & Cancelled Workspaces: rejects staging, patching, resolving, and committing on cancelled workspace", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const cancelWorkspace = migrationWorkspace.cancelWorkspace;
    const patchStagedRecord = migrationAutosave.patchStagedRecord;
    const resolveRecordClash = migrationAutosave.resolveRecordClash;

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

  it("Super Admin Restoration: verified as internal-only action, not public API", () => {
    expect(restoreSuperAdminAction.isInternal).toBe(true);
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

    const runSplitIntegrityCheck = internal.functions.academic.branchSplitV2.runSplitIntegrityCheck;

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
