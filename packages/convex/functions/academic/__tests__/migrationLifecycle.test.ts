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
const listWorkspaces = migrationWorkspace.listWorkspaces as unknown as QueryRef;
const getWorkspaceRecords = migrationWorkspace.getWorkspaceRecords as unknown as QueryRef;
const getWorkspaceFeatureSignals = migrationWorkspace.getWorkspaceFeatureSignals as unknown as QueryRef;
const stageRecordsBatch = migrationIngest.stageRecordsBatch as unknown as MutationRef;
const bulkResolveAdmissionNumbers = migrationAutosave.bulkResolveAdmissionNumbers as unknown as MutationRef;
const resolveRecordClash = migrationAutosave.resolveRecordClash as unknown as MutationRef;
const patchStagedRecord = migrationAutosave.patchStagedRecord as unknown as MutationRef;
const reviewStagedRecord = migrationAutosave.reviewStagedRecord as unknown as MutationRef;
const cancelWorkspace = migrationWorkspace.cancelWorkspace as unknown as MutationRef;
const approveImportWorkspace = migrationMerge.approveImportWorkspace as unknown as MutationRef;
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
  it("keeps staging private from peer and platform admins and freezes committing rows", async () => {
    const { t, schoolA } = await setupTestFixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "peer-admin",
        role: "admin",
        name: "Peer",
        email: "peer@example.test",
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const owner = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const workspaceId = await owner.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Private",
      mode: "school_admin",
    });
    const row = {
      rowNumber: 1,
      entityType: "student" as const,
      rawPayload: { password: "must-not-persist" },
      parsedData: { firstName: "Ada", lastName: "Example", gender: "Female", className: "JSS 1A" },
      unrecognizedHeaders: [{ header: "Extra", sampleValue: "private-source-value", detectedType: "string" }],
    };
    await owner.mutation(stageRecordsBatch, { schoolId: schoolA, workspaceId, records: [row] });
    const records = await t.run((ctx) => ctx.db.query("stagedImportRecords").collect());
    expect(records[0].rawPayload).toEqual({});
    const signals = await owner.query(getWorkspaceFeatureSignals, { schoolId: schoolA, workspaceId });
    expect(signals[0]).not.toHaveProperty("sampleValue");

    const peer = t.withIdentity({ subject: "peer-admin", issuer: "https://legacy-auth.test" });
    expect(await peer.query(migrationWorkspace.listWorkspaces as unknown as QueryRef, { schoolId: schoolA })).toEqual([]);
    await expect(peer.query(migrationWorkspace.getWorkspaceSummary as unknown as QueryRef, { schoolId: schoolA, workspaceId })).rejects.toThrow("Workspace not found");
    await expect(peer.mutation(migrationAutosave.patchStagedRecord as unknown as MutationRef, { schoolId: schoolA, recordId: records[0]._id, parsedDataPatch: { firstName: "Changed" } })).rejects.toThrow("Workspace not found");
    await expect(peer.mutation(commitImportWorkspace, { schoolId: schoolA, workspaceId })).rejects.toThrow("Workspace not found");

    const platform = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    await expect(platform.query(migrationWorkspace.listWorkspaces as unknown as QueryRef, { schoolId: schoolA })).rejects.toThrow();
    await expect(platform.query(migrationWorkspace.getWorkspaceSummary as unknown as QueryRef, { schoolId: schoolA, workspaceId })).rejects.toThrow();
    await expect(owner.mutation(commitImportWorkspace, { schoolId: schoolA, workspaceId, batchSize: 0 })).rejects.toThrow("Batch size");
    await t.run((ctx) => ctx.db.patch(workspaceId, { status: "committing" }));
    await expect(owner.mutation(stageRecordsBatch, { schoolId: schoolA, workspaceId, records: [row] })).rejects.toThrow("committing");
    await owner.mutation(migrationAutosave.patchStagedRecord as unknown as MutationRef, { schoolId: schoolA, recordId: records[0]._id, parsedDataPatch: { firstName: "Recovered" } });
    expect(await t.run((ctx) => ctx.db.get(records[0]._id))).toMatchObject({ parsedData: { firstName: "Recovered" } });
    const recoveredWorkspace = await t.run((ctx) =>
      ctx.db
        .query("importWorkspaces")
        .filter((q) => q.eq(q.field("_id"), workspaceId))
        .unique(),
    );
    expect(recoveredWorkspace?.status).toBe("reviewing");
    expect(recoveredWorkspace).not.toHaveProperty("reviewedAt");
    await t.run((ctx) => ctx.db.patch(records[0]._id, { isCommitted: true }));
    await expect(owner.mutation(migrationAutosave.patchStagedRecord as unknown as MutationRef, { schoolId: schoolA, recordId: records[0]._id, parsedDataPatch: { firstName: "Changed" } })).rejects.toThrow("already committed");
    await expect(owner.mutation(bulkResolveAdmissionNumbers, { schoolId: schoolA, workspaceId })).rejects.toThrow("Import-local numbering is disabled");
  });

  it("filters private workspaces before limiting and scopes feature signals to each creator workspace", async () => {
    const { t, schoolA } = await setupTestFixture();
    const peerId = await t.run((ctx) => ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "auth-peer-a",
      name: "Peer Admin",
      email: "peer@greenwood.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    }));
    const owner = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const peer = t.withIdentity({ subject: "auth-peer-a", issuer: "https://legacy-auth.test" });
    const ownerWorkspaceId = await owner.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Older private workspace",
      mode: "school_admin",
    });
    await t.run(async (ctx) => {
      for (let index = 0; index < 50; index += 1) {
        await ctx.db.insert("importWorkspaces", {
          schoolId: schoolA,
          name: `Peer workspace ${index}`,
          mode: "school_admin",
          status: "draft",
          totalRecords: 0,
          validRecords: 0,
          warningRecords: 0,
          errorRecords: 0,
          sourceFiles: [],
          nextAdmissionSequence: 1,
          createdAt: index + 2,
          updatedAt: index + 2,
          createdBy: peerId,
        });
      }
    });
    expect(await owner.query(listWorkspaces, { schoolId: schoolA })).toEqual([
      expect.objectContaining({ _id: ownerWorkspaceId }),
    ]);

    const peerWorkspaceId = await peer.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Peer signal workspace",
      mode: "school_admin",
    });
    const record = (rowNumber: number) => ({
      rowNumber,
      rawPayload: {},
      parsedData: { firstName: `Student${rowNumber}`, lastName: "Example", gender: "Female", className: "JSS 1A" },
      entityType: "student" as const,
      unrecognizedHeaders: [{ header: "Transport Route", detectedType: "string" }],
    });
    await owner.mutation(stageRecordsBatch, { schoolId: schoolA, workspaceId: ownerWorkspaceId, records: [record(1)] });
    await peer.mutation(stageRecordsBatch, { schoolId: schoolA, workspaceId: peerWorkspaceId, records: [record(2)] });
    await owner.mutation(stageRecordsBatch, { schoolId: schoolA, workspaceId: ownerWorkspaceId, records: [record(3)] });

    expect(await owner.query(getWorkspaceFeatureSignals, { schoolId: schoolA, workspaceId: ownerWorkspaceId })).toEqual([
      expect.objectContaining({ workspaceId: ownerWorkspaceId, rawHeader: "Transport Route" }),
    ]);
    expect(await peer.query(getWorkspaceFeatureSignals, { schoolId: schoolA, workspaceId: peerWorkspaceId })).toEqual([
      expect.objectContaining({ workspaceId: peerWorkspaceId, rawHeader: "Transport Route" }),
    ]);
    await expect(peer.query(getWorkspaceFeatureSignals, { schoolId: schoolA, workspaceId: ownerWorkspaceId })).rejects.toThrow("Workspace not found");
    expect(await t.run((ctx) => ctx.db.query("migrationFeatureSignals").collect())).toHaveLength(2);
  });

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

  it("Clash Detection: retains the strongest staged candidate instead of the first warning", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminSession = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const workspaceId = await adminSession.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Strongest Match Intake",
      mode: "school_admin",
    });

    await adminSession.mutation(stageRecordsBatch, {
      schoolId: schoolA,
      workspaceId,
      records: [
        {
          rowNumber: 1,
          rawPayload: {},
          parsedData: {
            firstName: "Jon",
            lastName: "Smith",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "08011111111",
          },
          entityType: "student",
        },
        {
          rowNumber: 2,
          rawPayload: {},
          parsedData: {
            firstName: "Jonathan",
            lastName: "Smith",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "08022222222",
          },
          entityType: "student",
        },
        {
          rowNumber: 3,
          rawPayload: {},
          parsedData: {
            firstName: "Jonathan",
            lastName: "Smith",
            className: "JSS 1A",
            gender: "Male",
            guardianPhone: "+2348022222222",
          },
          entityType: "student",
        },
      ],
    });

    const staged = await adminSession.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });
    const secondRow = staged.find((record: any) => record.rowNumber === 2);
    const thirdRow = staged.find((record: any) => record.rowNumber === 3);

    expect(thirdRow?.clashCandidateId).toBe(secondRow?._id);
    expect(thirdRow?.clashConfidence).toBe(100);
    expect(thirdRow?.clashReason).toContain("Row #2");
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
    }) as Array<{ rawHeader: string }>;

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
    const adminB = t.withIdentity({ subject: "auth-admin-b", issuer: "https://legacy-auth.test" });

    const workspaceB = await adminB.mutation(createWorkspace, {
      schoolId: schoolB,
      name: "School B Intake",
      mode: "school_admin",
    });

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

  it("School admin creates valid user actor provenance", async () => {
    const { t, schoolA, adminA, jss1Class } = await setupTestFixture();
    const admin = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
    const { importedUserId, personId, membershipId } = await t.run(async (ctx) => {
      const personId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://legacy-auth.test|auth-admin-a",
        email: "alice@greenwood.test",
        name: "Admin Alice",
        status: "active",
        primarySchoolId: schoolA,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.patch(adminA, {
        authTokenIdentifier: "https://legacy-auth.test|auth-admin-a",
        personId,
      });
      const membershipId = await ctx.db.insert("branchMemberships", {
        schoolId: schoolA,
        personId,
        legacyUserId: adminA,
        status: "active",
        isDefaultBranch: true,
        joinedAt: 1,
        updatedAt: 1,
      });
      for (const capability of [
        "system.migration.execute",
        "enrollment.intakes.manage",
        "enrollment.admissions.override_number",
      ] as const) {
        await ctx.db.insert("membershipDirectGrants", {
          membershipId,
          capability,
          grantedAt: 1,
        });
      }
      const importedUserId = await ctx.db.insert("users", {
        schoolId: schoolA,
        authId: "imported-ibrahim",
        name: "Ibrahim Musa",
        email: "ibrahim@greenwood.test",
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      return { importedUserId, personId, membershipId };
    });

    const workspaceId = await admin.mutation(createWorkspace, {
      schoolId: schoolA,
      name: "Admin Provenance Intake",
      mode: "school_admin",
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
            admissionNumber: "SCH/SA/0001",
            guardianName: "Musa Ibrahim",
            guardianPhone: "08012345678",
            gender: "Male",
          },
          entityType: "student",
        },
      ],
    });

    const [record] = await admin.query(getWorkspaceRecords, {
      schoolId: schoolA,
      workspaceId,
    });
    await admin.mutation(reviewStagedRecord, {
      schoolId: schoolA,
      recordId: record._id,
      expectedRowRevision: record.rowRevision ?? 1,
      resolutionAction: "create_new",
      selectedClassId: jss1Class,
      selectedUserId: importedUserId,
      admissionNumberMode: "supplied",
      manualNumberConfirmed: true,
      manualNumberReason: "Reviewed historical provenance fixture",
    });
    await admin.mutation(approveImportWorkspace, { schoolId: schoolA, workspaceId });
    const mergeResult = await admin.mutation(commitImportWorkspace, {
      schoolId: schoolA,
      workspaceId,
    });
    expect(mergeResult.success).toBe(true);

    await t.run(async (ctx) => {
      const students = await ctx.db
        .query("students")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolA))
        .collect();
      expect(students).toHaveLength(1);
      expect(students[0].userId).toBe(importedUserId);
      const audit = await ctx.db
        .query("auditEvents")
        .withIndex("by_module_and_action", (q) =>
          q.eq("module", "migration").eq("action", "reviewed_import.batch_commit"),
        )
        .first();
      expect(audit).toMatchObject({
        actorKind: "user",
        actorPersonId: personId,
        actorMembershipId: membershipId,
      });
    });
  });

  it("Platform cannot manufacture or impersonate a tenant migration actor", async () => {
    const { t, schoolA } = await setupTestFixture();
    const platform = t.withIdentity({ subject: "auth-super-admin", issuer: "https://legacy-auth.test" });
    const before = await t.run((ctx) => ctx.db.query("users").take(20));
    await expect(platform.mutation(createWorkspace, { schoolId: schoolA, name: "Unauthorized", mode: "super_admin" })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("users").take(20))).toEqual(before);
    expect(await t.run((ctx) => ctx.db.query("importWorkspaces").take(1))).toEqual([]);
  });

  it("State Transitions & Cancelled Workspaces: rejects staging, patching, resolving, and committing on cancelled workspace", async () => {
    const { t, schoolA } = await setupTestFixture();
    const adminA = t.withIdentity({ subject: "auth-admin-a", issuer: "https://legacy-auth.test" });
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
