import { seedReviewedTenantOperator } from "./securityFixtures";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob([
  "../../../**/*.ts",
  "!../../../**/*.test.ts",
]);
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ])
);

const institutionalEmailApi = api.functions.academic.institutionalEmail;
const aiImportApi = api.functions.academic.aiImport;
const assetsApi = api.functions.academic.assets;
const institutionalEmailInternal = internal.functions.academic.institutionalEmail;

function tenantSession(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({
    tokenIdentifier: "test|reviewed",
    subject: "reviewed",
  });
}

function assertExists<T>(value: T): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Expected a result");
}

type AuthenticatedTest = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
type TestClient = ReturnType<typeof convexTest> | AuthenticatedTest;

async function setupTestHarness(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    // 1. Create School
    const schoolId = await ctx.db.insert("schools", {
      name: "Cedarwood International Academy",
      slug: "cedarwood",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("platformAdmins", {
      authId: "platform-admin",
      authTokenIdentifier: "https://auth.school.test|platform-admin",
      email: "platform-admin@school.test",
      name: "Test Platform Administrator",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await seedReviewedTenantOperator(ctx, [schoolId], "test|reviewed");

    // 2. Create Admin User
    const adminUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "auth-admin-1",
      authTokenIdentifier: "https://auth.school.test|admin-1",
      name: "Principal Oladipo",
      email: "principal@cedarwood.edu.ng",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    const importStudentUserIds = await Promise.all(
      ["one", "two", "three", "four"].map((suffix) =>
        ctx.db.insert("users", {
          schoolId,
          authId: `preprovisioned-student-${suffix}`,
          name: `Imported Student ${suffix}`,
          email: `imported-student-${suffix}@cedarwood.edu.ng`,
          role: "student",
          isSchoolAdmin: false,
          createdAt: now,
          updatedAt: now,
        })
      )
    );

    // 3. Create Person 1
    const person1Id = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.school.test|person-1",
      email: "john.doe.personal@gmail.com",
      name: "John Doe",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    const membership1Id = await ctx.db.insert("branchMemberships", {
      personId: person1Id,
      schoolId,
      status: "active",
      displayTitle: "Student",
      isDefaultBranch: true,
      joinedAt: now,
      updatedAt: now,
    });

    // 4. Create Person 2
    const person2Id = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.school.test|person-2",
      email: "john.m.doe.personal@gmail.com",
      name: "John M. Doe",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Create Person 3
    const person3Id = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.school.test|person-3",
      email: "john.doe3.personal@gmail.com",
      name: "John Doe",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    // 6. Create Minor Person 4
    const person4Id = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.school.test|person-4",
      email: "david.adeleke.personal@gmail.com",
      name: "David Adeleke",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    for (const personId of [person2Id, person3Id, person4Id]) {
      await ctx.db.insert("branchMemberships", {
        personId,
        schoolId,
        status: "active",
        isDefaultBranch: false,
        joinedAt: now,
        updatedAt: now,
      });
    }

    return {
      schoolId,
      adminUserId,
      importStudentUserIds,
      person1Id,
      membership1Id,
      person2Id,
      person3Id,
      person4Id,
    };
  });
}

describe("B-07: Institutional Email Operations and AI Import Review Pipeline", () => {
  describe("1. Address Proposal Workbench & Deterministic Collision Pipeline", () => {
    it("proposes deterministic handles and resolves collisions across the 4 stages", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, person3Id } =
        await setupTestHarness(t);

      // Register and verify institutional domain
      const reg = await tenantSession(t).mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "google",
        isDefault: true,
      });

      await t.mutation(institutionalEmailInternal.verifyDomain, {
        domainId: reg.domainId,
        observedDnsTxtRecord: reg.dnsTxtRecord,
        providerOperationId: "dns-op-1",
      });

      // Propose batch of 3 persons sharing the same base name 'John Doe'
      const proposals = await tenantSession(t).query(
        institutionalEmailApi.proposeEmailAddresses,
        {
          schoolId,
          domainId: reg.domainId,
          persons: [
            {
              personId: person1Id,
              firstName: "John",
              lastName: "Doe",
            },
            {
              personId: person2Id,
              firstName: "John",
              lastName: "Doe",
              middleName: "Michael",
            },
            {
              personId: person3Id,
              firstName: "John",
              lastName: "Doe",
            },
          ],
        }
      );

      expect(proposals).toHaveLength(3);

      // Person 1 gets Stage 1: firstname.lastname@domain
      expect(proposals[0]).toMatchObject({
        personId: person1Id,
        proposedEmail: "john.doe@cedarwood.edu.ng",
        stage: 1,
        collisionDetected: false,
        needsManualReview: false,
        state: "login_only",
      });

      // Person 2 collides with Person 1 -> Stage 2: firstname.m.lastname@domain
      expect(proposals[1]).toMatchObject({
        personId: person2Id,
        proposedEmail: "john.m.doe@cedarwood.edu.ng",
        stage: 2,
        collisionDetected: true,
        needsManualReview: false,
        state: "login_only",
      });

      // Person 3 collides with Person 1 (no middle name) -> Stage 3: firstname.lastname2@domain
      expect(proposals[2]).toMatchObject({
        personId: person3Id,
        proposedEmail: "john.doe2@cedarwood.edu.ng",
        stage: 3,
        collisionDetected: true,
        needsManualReview: false,
        state: "login_only",
      });
    });

    it("triggers Stage 4 manual edit required when all deterministic stages collide", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, person3Id } =
        await setupTestHarness(t);

      const reg = await tenantSession(t).mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "microsoft",
        isDefault: true,
      });
      await t.mutation(institutionalEmailInternal.verifyDomain, {
        domainId: reg.domainId,
        observedDnsTxtRecord: reg.dnsTxtRecord,
        providerOperationId: "dns-op-2",
      });

      // Pre-allocate requested addresses. Provisioning state is internal and not
      // needed for collision detection.
      await tenantSession(t).mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person1Id,
        email: "john.doe@cedarwood.edu.ng",
      });
      await tenantSession(t).mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person2Id,
        email: "john.m.doe@cedarwood.edu.ng",
      });
      await tenantSession(t).mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person3Id,
        email: "john.doe2@cedarwood.edu.ng",
      });

      // Now propose for a 4th person with same name and middle name
      const fourthPersonId = await t.run(async (ctx) => {
        return await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.school.test|person-4-col",
          email: "john.m.doe.fourth@test.com",
          name: "John Michael Doe",
          status: "active",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("branchMemberships", { personId: fourthPersonId, schoolId, status: "active", isDefaultBranch: false, joinedAt: now, updatedAt: now });
      });

      const proposals = await tenantSession(t).query(
        institutionalEmailApi.proposeEmailAddresses,
        {
          schoolId,
          domainId: reg.domainId,
          persons: [
            {
              personId: fourthPersonId,
              firstName: "John",
              lastName: "Doe",
              middleName: "Michael",
            },
          ],
        }
      );

      expect(proposals[0]).toMatchObject({
        personId: fourthPersonId,
        stage: 4,
        collisionDetected: true,
        needsManualReview: true,
      });
    });
  });

  describe("2. Minor Naming Privacy Safeguards", () => {
    it("produces masked/initial handle (f.lastname@domain) when minor privacy is requested", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person4Id } = await setupTestHarness(t);

      const reg = await tenantSession(t).mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "zoho",
        isDefault: true,
      });
      await t.mutation(institutionalEmailInternal.verifyDomain, {
        domainId: reg.domainId,
        observedDnsTxtRecord: reg.dnsTxtRecord,
        providerOperationId: "dns-op-3",
      });

      const proposals = await tenantSession(t).query(
        institutionalEmailApi.proposeEmailAddresses,
        {
          schoolId,
          domainId: reg.domainId,
          persons: [
            {
              personId: person4Id,
              firstName: "David",
              lastName: "Adeleke",
              isMinor: true,
              minorPrivacyRequested: true,
            },
          ],
        }
      );

      expect(proposals[0]).toMatchObject({
        personId: person4Id,
        proposedEmail: "d.adeleke@cedarwood.edu.ng",
        localPart: "d.adeleke",
        stage: 1,
        isMinor: true,
        minorPrivacyApplied: true,
      });
    });
  });

  describe("3. Domain Registration and Verification State Transitions", () => {
    it("registers domain in pending_verification with DNS TXT challenge and transitions to verified", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);

      // 1. Register domain
      const reg = await tenantSession(t).mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "stgregorys.edu.ng",
        provider: "google",
      });

      expect(reg.status).toBe("pending_verification");
      expect(reg.dnsTxtRecord).toMatch(/^melo-verify=/);

      // Verify domain state before verification
      const domainsBefore = await tenantSession(t).query(
        institutionalEmailApi.getSchoolEmailDomains,
        { schoolId }
      );
      expect(domainsBefore[0].status).toBe("pending_verification");

      // 2. Verify domain challenge
      const verified = await t.mutation(institutionalEmailInternal.verifyDomain, {
        domainId: reg.domainId,
        observedDnsTxtRecord: reg.dnsTxtRecord,
        providerOperationId: "dns-op-4",
      });

      expect(verified.status).toBe("verified");
      expect(verified.verified).toBe(true);

      const domainsAfter = await tenantSession(t).query(
        institutionalEmailApi.getSchoolEmailDomains,
        { schoolId }
      );
      expect(domainsAfter[0].status).toBe("verified");
      expect(domainsAfter[0].verifiedAt).toBeDefined();

      // 3. Failed verification test
      const failedReg = await tenantSession(t).mutation(
        institutionalEmailApi.registerEmailDomain,
        {
          schoolId,
          domain: "unverified-school.edu.ng",
          provider: "none",
        }
      );

      const failedVerify = await t.mutation(
        institutionalEmailInternal.verifyDomain,
        {
          domainId: failedReg.domainId,
          observedDnsTxtRecord: "melo-verify=incorrect",
          providerOperationId: "dns-op-failed",
        }
      );

      expect(failedVerify.status).toBe("failed");
      expect(failedVerify.verified).toBe(false);
    });
  });

  describe("4. AI Import Review Pipeline (Zero Direct Commits)", () => {
    it("stages raw rows, catches validation errors deterministically, and isolates operational tables", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId, importStudentUserIds } = await setupTestHarness(t);

      // Raw AI extraction rows with errors:
      // Row 0: Valid
      // Row 1: Missing lastName
      // Row 2: Invalid future dateOfBirth
      // Row 3: Duplicate admission number with Row 0
      const rawRows = [
        {
          firstName: "Chinedu",
          lastName: "Eze",
          admissionNumber: "ADM-2026-001",
          gender: "Male",
          dateOfBirth: Date.now() - 10 * 365 * 24 * 60 * 60 * 1000,
          userId: importStudentUserIds[0],
          rawSecretToken: "secret_token_12345", // sensitive credential
          passwordHash: "bcrypt$123456", // sensitive credential
        },
        {
          firstName: "Fatima",
          // Missing lastName
          admissionNumber: "ADM-2026-002",
          userId: importStudentUserIds[1],
          gender: "Female",
        },
        {
          firstName: "Babajide",
          lastName: "Sanwo",
          admissionNumber: "ADM-2026-003",
          userId: importStudentUserIds[2],
          dateOfBirth: Date.now() + 10000000, // Invalid: in the future!
        },
        {
          firstName: "Emeka",
          lastName: "Okafor",
          admissionNumber: "ADM-2026-001", // Duplicate admission number!
          userId: importStudentUserIds[3],
        },
      ];

      // 1. Stage raw data
      const stageResult = await tenantSession(t).mutation(aiImportApi.stageImportData, {
        schoolId,
        importerUserId: adminUserId,
        entityType: "students",
        rawRows,
      });

      expect(stageResult.status).toBe("staged");
      expect(stageResult.rowCount).toBe(4);
      expect(stageResult.errorCount).toBeGreaterThanOrEqual(3);

      // Sensitive credentials must be stripped from staged rows
      const workspace = await tenantSession(t).query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      assertExists(workspace);
      expect(workspace.stagedRows[0].rawSecretToken).toBeUndefined();
      expect(workspace.stagedRows[0].passwordHash).toBeUndefined();

      // STRICT INVARIANT: ZERO DIRECT COMMITS TO OPERATIONAL TABLES
      const operationalStudentsCount = await t.run(async (ctx) => {
        const list = await ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
          .collect();
        return list.length;
      });
      expect(operationalStudentsCount).toBe(0);

      // 2. Committing with unresolved validation errors must be strictly rejected
      await expect(
        tenantSession(t).mutation(aiImportApi.commitImportWorkspace, {
          workspaceId: stageResult.workspaceId,
        })
      ).rejects.toThrow("Workspace requires explicit reviewed approval");

      // Operational tables must still be untouched
      const countAfterRejectedCommit = await t.run(async (ctx) => {
        return (
          await ctx.db
            .query("students")
            .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
            .collect()
        ).length;
      });
      expect(countAfterRejectedCommit).toBe(0);

      // 3. Human reviewer fixes errors on staged rows
      // Fix Row 1 (missing lastName)
      await tenantSession(t).mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 1,
        updatedFields: { lastName: "Abdullahi" },
      });

      // Fix Row 2 (future dateOfBirth -> past date)
      await tenantSession(t).mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 2,
        updatedFields: {
          dateOfBirth: Date.now() - 11 * 365 * 24 * 60 * 60 * 1000,
        },
      });

      // Fix Row 3 (duplicate admissionNumber -> unique)
      const fixResult = await tenantSession(t).mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 3,
        updatedFields: { admissionNumber: "ADM-2026-004" },
      });

      expect(fixResult.remainingErrors).toHaveLength(0);

      // Row edits leave the workspace staged until a reviewer explicitly approves it.
      const reviewedWorkspace = await tenantSession(t).query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      assertExists(reviewedWorkspace);
      expect(reviewedWorkspace.status).toBe("staged");
      expect(reviewedWorkspace.validationErrors).toHaveLength(0);

      // 4. A human explicitly approves the clean workspace before commit.
      const approval = await tenantSession(t).mutation(aiImportApi.approveImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      expect(approval.status).toBe("reviewed");

      // 5. Commit workspace atomically into official operational tables
      const commitResult = await tenantSession(t).mutation(aiImportApi.commitImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });

      expect(commitResult.success).toBe(true);
      expect(commitResult.committedCount).toBe(4);

      // Verify operational database records now exist
      const operationalStudents = await t.run(async (ctx) => {
        return await ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
          .collect();
      });
      expect(operationalStudents).toHaveLength(4);

      // Verify final workspace status is 'committed'
      const finalWorkspace = await tenantSession(t).query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      assertExists(finalWorkspace);
      expect(finalWorkspace.status).toBe("committed");
      expect(finalWorkspace.committedAt).toBeDefined();
    });
  });

  describe("4b. Review, entity support, and allocator prerequisites", () => {
    it("blocks unapproved and allocator-incomplete imports without fabricating identities", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, importStudentUserIds } = await setupTestHarness(t);
      const session = tenantSession(t);

      const validWorkspace = await session.mutation(aiImportApi.stageImportData, {
        schoolId,
        entityType: "students",
        rawRows: [{
          firstName: "Ada",
          lastName: "Okafor",
          admissionNumber: "ADM-HIST-001",
          userId: importStudentUserIds[0],
        }],
      });
      await expect(session.mutation(aiImportApi.commitImportWorkspace, {
        workspaceId: validWorkspace.workspaceId,
      })).rejects.toThrow("requires explicit reviewed approval");

      const missingNumber = await session.mutation(aiImportApi.stageImportData, {
        schoolId,
        entityType: "students",
        rawRows: [{ firstName: "Bola", lastName: "Ade", userId: importStudentUserIds[1] }],
      });
      expect(missingNumber.validationErrors).toContainEqual(expect.objectContaining({
        field: "admissionNumber",
      }));
      await expect(session.mutation(aiImportApi.approveImportWorkspace, {
        workspaceId: missingNumber.workspaceId,
      })).rejects.toThrow("Cannot approve workspace");

      await expect(session.mutation(aiImportApi.stageImportData, {
        schoolId,
        entityType: "teachers",
        rawRows: [],
      })).rejects.toThrow("not supported for commit");
      const users = await t.run(async (ctx) => ctx.db.query("users").collect());
      expect(users.every((user) => !user.authTokenIdentifier?.startsWith("imported_student_"))).toBe(true);
    });
  });

  describe("5. Public entry-point authorization", () => {
    it("denies unauthenticated and cross-tenant institutional email and AI import operations", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const { schoolB, personB, mailboxB, workspaceB, uploadIntentB, assetB, storageId, holdB } = await t.run(async (ctx) => {
        const now = Date.now();
        const schoolB = await ctx.db.insert("schools", { name: "Other Academy", slug: "other-academy", status: "active", createdAt: now, updatedAt: now });
        const personB = await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.school.test|person-b", email: "person-b@other.test", name: "Person B", status: "active", primarySchoolId: schoolB, createdAt: now, updatedAt: now });
        await ctx.db.insert("branchMemberships", { personId: personB, schoolId: schoolB, status: "active", isDefaultBranch: true, joinedAt: now, updatedAt: now });
        const mailboxB = await ctx.db.insert("institutionalMailboxes", { personId: personB, schoolId: schoolB, email: "person-b@other.edu.ng", state: "login_only", providerType: "none", status: "active", createdAt: now, updatedAt: now });
        const workspaceB = await ctx.db.insert("aiImportWorkspaces", { schoolId: schoolB, importer: "other", entityType: "students", status: "staged", stagedRows: [], validationErrors: [], createdAt: now, updatedAt: now });
        const uploadIntentB = await ctx.db.insert("assetUploadIntents", { schoolId: schoolB, status: "pending", createdAt: now, updatedAt: now });
        const storageId = await ctx.storage.store(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }));
        const assetB = await ctx.db.insert("schoolAssets", { schoolId: schoolB, storageId, fileName: "other.png", mimeType: "image/png", byteSize: 8, sha256: "test-sha", category: "test", validationStatus: "valid", scanStatus: "clean", isTrashed: false, createdAt: now, updatedAt: now });
        const holdB = await ctx.db.insert("assetRetentionHolds", { schoolId: schoolB, assetId: assetB, holdReason: "test", appliedAt: now });
        const personA = await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.school.test|school-a", email: "school-a@test", name: "School A", status: "active", primarySchoolId: schoolId, createdAt: now, updatedAt: now });
        await ctx.db.insert("branchMemberships", { personId: personA, schoolId, status: "active", isDefaultBranch: true, joinedAt: now, updatedAt: now });
        return { schoolB, personB, mailboxB, workspaceB, uploadIntentB, assetB, storageId, holdB };
      });
      const crossTenant = t.withIdentity({ tokenIdentifier: "https://auth.school.test|school-a", subject: "school-a" });
      const expectDenied = async (operation: () => Promise<unknown>, message = "Not authorized") => {
        await expect(operation()).rejects.toThrow(message);
      };
      const emailOperations = (client: TestClient) => [
        () => client.mutation(institutionalEmailApi.registerEmailDomain, { schoolId: schoolB, domain: "other.edu.ng", provider: "google" }),
        () => client.query(institutionalEmailApi.proposeEmailAddresses, { schoolId: schoolB, persons: [{ personId: personB, firstName: "Person", lastName: "B" }] }),
        () => client.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: schoolB, personId: personB, email: "person-b@other.edu.ng" }),
        () => client.mutation(institutionalEmailApi.suspendOrArchiveMailbox, { mailboxId: mailboxB, action: "suspend" }),
        () => client.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId: schoolB }),
        () => client.query(institutionalEmailApi.getSchoolEmailDomains, { schoolId: schoolB }),
        () => client.query(institutionalEmailApi.getEmailWorkbench, { schoolId: schoolB }),
        () => client.query(institutionalEmailApi.reviewEmailAddress, { schoolId: schoolB, personId: personB, localPart: "person.b", expectedPolicyVersion: 0 }),
      ];
      const importOperations = (client: TestClient) => [
        () => client.mutation(aiImportApi.stageImportData, { schoolId: schoolB, entityType: "students", rawRows: [] }),
        () => client.mutation(aiImportApi.updateStagedRow, { workspaceId: workspaceB, rowIndex: 0, updatedFields: {} }),
        () => client.mutation(aiImportApi.approveImportWorkspace, { workspaceId: workspaceB }),
        () => client.mutation(aiImportApi.commitImportWorkspace, { workspaceId: workspaceB }),
        () => client.query(aiImportApi.getImportWorkspace, { workspaceId: workspaceB }),
        () => client.query(aiImportApi.listImportWorkspaces, { schoolId: schoolB }),
      ];
      const assetOperations = (client: TestClient) => [
        () => client.mutation(assetsApi.createAssetUploadIntent, { schoolId: schoolB }),
        () => client.mutation(assetsApi.finalizeAssetUpload, { schoolId: schoolB, uploadIntentId: uploadIntentB, storageId, fileName: "other.png", category: "test" }),
        () => client.query(assetsApi.getDownloadableAssetUrl, { schoolId: schoolB, assetId: assetB }),
        () => client.mutation(assetsApi.trashAsset, { schoolId: schoolB, assetId: assetB }),
        () => client.query(assetsApi.listTrashedAssets, { schoolId: schoolB }),
        () => client.mutation(assetsApi.restoreAsset, { schoolId: schoolB, assetId: assetB }),
        () => client.mutation(assetsApi.applyRetentionHold, { schoolId: schoolB, assetId: assetB, holdReason: "test" }),
        () => client.mutation(assetsApi.removeRetentionHold, { schoolId: schoolB, holdId: holdB }),
        () => client.mutation(assetsApi.permanentPurgeAsset, { schoolId: schoolB, assetId: assetB, confirmation: "PURGE other.png" }),
        () => client.query(assetsApi.listSchoolAssets, { schoolId: schoolB }),
      ];
      for (const operation of [...emailOperations(t), ...importOperations(t), ...assetOperations(t)]) await expectDenied(operation, "UNAUTHENTICATED");
      for (const operation of [...emailOperations(crossTenant), ...importOperations(crossTenant), ...assetOperations(crossTenant)]) await expectDenied(operation);
    });
  });

  describe("U4a policy, shared namespace and review safety", () => {
    it("inherits only an active group domain and revalidates cross-branch reservations at approval", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, person3Id } = await setupTestHarness(t);
      const viewer = tenantSession(t);
      const domain = await viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "shared.example", provider: "none" });
      const { branchId, outsiderId, groupId } = await t.run(async ctx => {
        const groupId = await ctx.db.insert("schoolGroups", { name: "Synthetic Group", slug: "synthetic-group", proprietorPersonId: person1Id, status: "active", createdAt: 1, updatedAt: 1 });
        const branchId = await ctx.db.insert("schools", { name: "Branch B", slug: "branch-b", status: "active", createdAt: 1, updatedAt: 1 });
        const outsiderId = await ctx.db.insert("schools", { name: "Independent", slug: "independent", status: "active", createdAt: 1, updatedAt: 1 });
        for (const id of [schoolId, branchId]) await ctx.db.insert("schoolGroupBranches", { groupId, schoolId: id, isHeadquarters: id === schoolId, linkedAt: 1 });
        for (const personId of [person1Id, person3Id]) await ctx.db.insert("branchMemberships", { personId, schoolId: branchId, status: "active", isDefaultBranch: false, joinedAt: 1, updatedAt: 1 });
        await seedReviewedTenantOperator(ctx, [branchId, outsiderId], "test|reviewed");
        return { branchId, outsiderId, groupId };
      });
      await expect(viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId: outsiderId, domain: "shared.example", provider: "none" })).rejects.toThrow("Domain already registered");
      const policy = { domainId: domain.domainId, staffTemplate: "firstname.lastname" as const, studentTemplate: "f.lastname" as const, expectedVersion: 0, confirmed: true };
      await expect(viewer.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId: outsiderId, ...policy })).rejects.toThrow("active group");
      await expect(viewer.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId: branchId, ...policy })).rejects.toThrow("active group");
      await viewer.mutation(institutionalEmailApi.setEmailDomainSharing, { domainId: domain.domainId, sharedWithGroup: true, confirmed: true });
      await viewer.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId: branchId, ...policy });
      const first = await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "john.doe@shared.example" });
      const retained = await viewer.query(institutionalEmailApi.proposeEmailAddresses, { schoolId: branchId, persons: [{ personId: person1Id, firstName: "John", lastName: "Doe" }] });
      expect(retained[0]).toMatchObject({ proposedEmail: first.email, retainedExistingAddress: true });
      expect(await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: branchId, personId: person1Id, email: first.email, expectedPolicyVersion: 1 })).toMatchObject({ mailboxId: first.mailboxId });
      expect(await t.run(ctx => ctx.db.get(first.mailboxId))).toMatchObject({ schoolId });
      await viewer.mutation(institutionalEmailApi.suspendOrArchiveMailbox, { mailboxId: first.mailboxId, action: "archive" });
      const proposals = await viewer.query(institutionalEmailApi.proposeEmailAddresses, { schoolId: branchId, persons: [{ personId: person3Id, firstName: "John", lastName: "Doe" }] });
      expect(proposals[0]).toMatchObject({ proposedEmail: "john.doe2@shared.example", collisionDetected: true, policyVersion: 1, state: "login_only" });
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: branchId, personId: person3Id, email: first.email, expectedPolicyVersion: 1 })).rejects.toThrow("frozen");
      // Another approval wins after dry run: the stale candidate is rejected transactionally.
      await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person2Id, email: proposals[0].proposedEmail });
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: branchId, personId: person3Id, email: proposals[0].proposedEmail, expectedPolicyVersion: 1 })).rejects.toThrow("frozen");
      expect(await viewer.query(institutionalEmailApi.reviewEmailAddress, { schoolId: branchId, personId: person3Id, localPart: "admin", expectedPolicyVersion: 1 })).toMatchObject({ valid: false, reason: "Invalid syntax or reserved local part" });
      await viewer.mutation(institutionalEmailApi.setEmailDomainSharing, { domainId: domain.domainId, sharedWithGroup: false, confirmed: true });
      expect(await viewer.query(institutionalEmailApi.getEmailWorkbench, { schoolId: branchId })).toMatchObject({ policyDomainUnavailable: true });
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: branchId, personId: person3Id, email: "john.doe3@shared.example", expectedPolicyVersion: 1 })).rejects.toThrow("active group");
      await viewer.mutation(institutionalEmailApi.setEmailDomainSharing, { domainId: domain.domainId, sharedWithGroup: true, confirmed: true });
      await t.run(ctx => ctx.db.patch(groupId, { status: "archived" }));
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: branchId, personId: person3Id, email: "john.doe3@shared.example", expectedPolicyVersion: 1 })).rejects.toThrow("active group");
    });

    it("scopes registrar/student and staff approval independently, including mailbox reads and policy writes", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id } = await setupTestHarness(t);
      const viewer = tenantSession(t);
      const domain = await viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "scoped.example", provider: "none" });
      await viewer.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId, domainId: domain.domainId, staffTemplate: "firstname.lastname", studentTemplate: "f.lastname", expectedVersion: 0, confirmed: true });
      await t.run(async ctx => {
        for (const [personId, role] of [[person1Id, "student"], [person2Id, "teacher"]] as const) {
          const person = await ctx.db.get(personId); assertExists(person);
          const userId = await ctx.db.insert("users", { schoolId, personId, name: person.name, email: person.email, authId: String(personId), role, createdAt: 1, updatedAt: 1 });
          const membership = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q => q.eq("personId", personId).eq("schoolId", schoolId)).unique(); assertExists(membership);
          await ctx.db.patch(membership._id, { legacyUserId: userId });
        }
        for (const [name, capability] of [["registrar", "enrollment.intakes.manage"], ["staff", "staff.onboard"]]) {
          const personId = await ctx.db.insert("persons", { name, email: `${name}@example.test`, authTokenIdentifier: `test|${name}`, status: "active", createdAt: 1, updatedAt: 1 });
          const membershipId = await ctx.db.insert("branchMemberships", { schoolId, personId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
          await ctx.db.insert("membershipDirectGrants", { membershipId, capability, grantedAt: 1 });
        }
      });
      const registrar = t.withIdentity({ subject: "registrar", tokenIdentifier: "test|registrar" });
      await expect(registrar.mutation(institutionalEmailApi.setEmailDomainSharing, { domainId: domain.domainId, sharedWithGroup: true, confirmed: true })).rejects.toThrow("settings.domains.manage");
      const staff = t.withIdentity({ subject: "staff", tokenIdentifier: "test|staff" });
      const studentProposal = await registrar.query(institutionalEmailApi.proposeEmailAddresses, { schoolId, persons: [{ personId: person1Id, firstName: "John", lastName: "Doe" }] });
      expect(studentProposal[0].localPart).toBe("j.doe");
      const staffProposal = await staff.query(institutionalEmailApi.proposeEmailAddresses, { schoolId, persons: [{ personId: person2Id, firstName: "John", lastName: "Doe" }] });
      expect(staffProposal[0].localPart).toBe("john.doe");
      await expect(staff.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "student@scoped.example", expectedPolicyVersion: 1 })).rejects.toThrow("scoped");
      await expect(registrar.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person2Id, email: "teacher@scoped.example", expectedPolicyVersion: 1 })).rejects.toThrow("scoped");
      await expect(registrar.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId, domainId: domain.domainId, staffTemplate: "f.lastname", studentTemplate: "f.lastname", expectedVersion: 1, confirmed: true })).rejects.toThrow("settings.domains.manage");
      await registrar.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: studentProposal[0].proposedEmail, expectedPolicyVersion: 1 });
      await staff.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person2Id, email: staffProposal[0].proposedEmail, expectedPolicyVersion: 1 });
      expect((await registrar.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId })).map(m => m.personId)).toEqual([person1Id]);
      expect((await staff.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId })).map(m => m.personId)).toEqual([person2Id]);
    });

    it("rejects syntax/reserved names, unknown domains and stale policy; independent domains remain separate", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id } = await setupTestHarness(t);
      const viewer = tenantSession(t);
      await expect(viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "https://bad.example/path", provider: "none" })).rejects.toThrow("Invalid domain");
      const domain = await viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "first.example", provider: "none" });
      await expect(viewer.query(institutionalEmailApi.proposeEmailAddresses, { schoolId, customDomain: "unregistered.example", persons: [{ personId: person1Id, firstName: "John", lastName: "Doe" }] })).rejects.toThrow("Custom domain");
      for (const email of ["admin@first.example", "a..b@first.example", "@first.example", "a@first.example@other.example", `${"a".repeat(65)}@first.example`])
        await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email })).rejects.toThrow("Invalid address");
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "valid@unknown.example" })).rejects.toThrow("configured school domain");
      await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "valid@first.example" });
      await viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "second.example", provider: "none" });
      await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "valid@second.example" });
      await viewer.mutation(institutionalEmailApi.saveEmailPolicy, { schoolId, domainId: domain.domainId, staffTemplate: "firstname.lastname", studentTemplate: "firstname.lastname", expectedVersion: 0, confirmed: true });
      for (const expectedPolicyVersion of [undefined, 0]) await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId, personId: person1Id, email: "next@first.example", expectedPolicyVersion })).rejects.toThrow("Policy changed");
      expect((await viewer.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId })).length).toBe(2);
    });

    it("preserves canonical identity, aliases, lifecycle and provider failure on safe retries with attributable audit", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, membership1Id } = await setupTestHarness(t);
      const viewer = tenantSession(t);
      const domain = await viewer.mutation(institutionalEmailApi.registerEmailDomain, { schoolId, domain: "lifecycle.example", provider: "none" });
      const originalPerson = await t.run(ctx => ctx.db.get(person1Id));
      const originalMembership = await t.run(ctx => ctx.db.get(membership1Id));
      const args = { schoolId, personId: person1Id, email: "john.doe@lifecycle.example" };
      const first = await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, args);
      const alias = await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { ...args, email: "john.newname@lifecycle.example", aliasOfMailboxId: first.mailboxId });
      expect(await t.run(ctx => ctx.db.get(alias.mailboxId))).toMatchObject({ aliasOfMailboxId: first.mailboxId, state: "login_only" });
      await expect(viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, { ...args, personId: person2Id, email: "other.person@lifecycle.example", aliasOfMailboxId: first.mailboxId })).rejects.toThrow("Additional address");
      await t.mutation(institutionalEmailInternal.verifyDomain, { domainId: domain.domainId, observedDnsTxtRecord: domain.dnsTxtRecord, providerOperationId: "dns-test" });
      const evidence = { mailboxId: first.mailboxId, providerType: "none" as const, providerOperationId: "evidence-1" };
      await t.mutation(institutionalEmailInternal.applyProviderMailboxResult, evidence);
      await t.mutation(institutionalEmailInternal.recordProviderFailure, { mailboxId: first.mailboxId, failure: "unknown" });
      // Replayed success must not erase a later failure that needs reconciliation.
      await t.mutation(institutionalEmailInternal.applyProviderMailboxResult, evidence);
      expect(await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, args)).toMatchObject({ mailboxId: first.mailboxId, state: "external_verified" });
      const visible = await viewer.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId });
      expect(visible.find(m => m._id === first.mailboxId)).toMatchObject({ state: "external_verified", reconciliationRequired: true, failureClass: "unknown" });
      expect(JSON.stringify(visible)).not.toContain("evidence-1");
      await viewer.mutation(institutionalEmailApi.suspendOrArchiveMailbox, { mailboxId: first.mailboxId, action: "archive" });
      await viewer.mutation(institutionalEmailApi.assignInstitutionalMailbox, args);
      expect(await t.run(ctx => ctx.db.get(first.mailboxId))).toMatchObject({ status: "archived", email: args.email });
      await expect(t.mutation(institutionalEmailInternal.applyProviderMailboxResult, { ...evidence, providerOperationId: "late-operation" })).rejects.toThrow("lifecycle reconciliation");
      expect(await t.run(ctx => ctx.db.get(person1Id))).toEqual(originalPerson);
      expect(await t.run(ctx => ctx.db.get(membership1Id))).toEqual(originalMembership);
      const events = await t.run(ctx => ctx.db.query("auditEvents").collect());
      const approvals = events.filter(e => e.action === "approve_address");
      expect(approvals).toHaveLength(1);
      expect(approvals[0]).toMatchObject({ actorKind: "user", actorEmailSnapshot: "reviewed@test.invalid" });
      expect(events.some(e => e.action === "approve_additional_address")).toBe(true);
      expect(events.some(e => e.action === "provider_reconciliation_required")).toBe(true);
    });
  });

  describe("6. External Directory Provider Fault Isolation", () => {
    it("keeps public mailbox requests in login_only until an internal provider result validates the domain", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, membership1Id } =
        await setupTestHarness(t);
      const domain = await tenantSession(t).mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "google",
      });
      await t.mutation(institutionalEmailInternal.verifyDomain, {
        domainId: domain.domainId,
        observedDnsTxtRecord: domain.dnsTxtRecord,
        providerOperationId: "dns-op-provider",
      });

      const request = await tenantSession(t).mutation(
        institutionalEmailApi.assignInstitutionalMailbox,
        { schoolId, personId: person1Id, email: "john.doe@cedarwood.edu.ng" }
      );
      expect(request.state).toBe("login_only");

      const personAfterRequest = await t.run(async (ctx) => ctx.db.get(person1Id));
      const membershipAfterRequest = await t.run(async (ctx) => ctx.db.get(membership1Id));
      expect(personAfterRequest?.status).toBe("active");
      expect(membershipAfterRequest?.status).toBe("active");

      const provisioned = await t.mutation(institutionalEmailInternal.applyProviderMailboxResult, {
        mailboxId: request.mailboxId,
        providerType: "google",
        providerAccountId: "google-account-1",
        providerOperationId: "directory-op-1",
      });
      expect(provisioned.state).toBe("provider_provisioned");

      const suspendResult = await tenantSession(t).mutation(
        institutionalEmailApi.suspendOrArchiveMailbox,
        { mailboxId: request.mailboxId, action: "suspend", reason: "Student graduated" }
      );
      expect(suspendResult.status).toBe("suspended");

      const archiveResult = await tenantSession(t).mutation(
        institutionalEmailApi.suspendOrArchiveMailbox,
        { mailboxId: request.mailboxId, action: "archive", reason: "Statutory retention window reached" }
      );
      expect(archiveResult.status).toBe("archived");

      await expect(
        tenantSession(t).mutation(institutionalEmailApi.assignInstitutionalMailbox, {
          schoolId,
          personId: person2Id,
          email: "john.doe@cedarwood.edu.ng",
        })
      ).rejects.toThrow("Address already allocated and frozen for another person");
    });
  });
});
