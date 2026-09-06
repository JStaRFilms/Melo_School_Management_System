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
const tenantOperatorToken = "https://auth.school.test|tenant-operator";

function tenantSession(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({
    tokenIdentifier: tenantOperatorToken,
    subject: "tenant-operator",
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

    // 2. Create an explicitly scoped tenant operator.
    const adminUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "tenant-operator",
      authTokenIdentifier: tenantOperatorToken,
      name: "Principal Oladipo",
      email: "principal@cedarwood.edu.ng",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    const operatorPersonId = await ctx.db.insert("persons", {
      authTokenIdentifier: tenantOperatorToken,
      email: "principal@cedarwood.edu.ng",
      name: "Principal Oladipo",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });
    const operatorMembershipId = await ctx.db.insert("branchMemberships", {
      personId: operatorPersonId,
      schoolId,
      legacyUserId: adminUserId,
      status: "active",
      isDefaultBranch: true,
      permissionsManagedAt: now,
      joinedAt: now,
      updatedAt: now,
    });
    const operatorRoleId = await ctx.db.insert("roleTemplates", {
      code: "email_import_test_operator",
      name: "Email and import test operator",
      scope: "branch",
      schoolId,
      capabilities: [
        "settings.domains.manage",
        "staff.onboard",
        "staff.list.view",
        "staff.account.suspend",
        "enrollment.intakes.manage",
      ],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("membershipRoleAssignments", {
      membershipId: operatorMembershipId,
      roleTemplateId: operatorRoleId,
      assignedAt: now,
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
      const expectDenied = async (operation: () => Promise<unknown>) => {
        await expect(operation()).rejects.toThrow(/UNAUTHENTICATED|Sign in required|Not authorized|Forbidden/);
      };
      const emailOperations = (client: TestClient) => [
        () => client.mutation(institutionalEmailApi.registerEmailDomain, { schoolId: schoolB, domain: "other.edu.ng", provider: "google" }),
        () => client.query(institutionalEmailApi.proposeEmailAddresses, { schoolId: schoolB, persons: [{ personId: personB, firstName: "Person", lastName: "B" }] }),
        () => client.mutation(institutionalEmailApi.assignInstitutionalMailbox, { schoolId: schoolB, personId: personB, email: "person-b@other.edu.ng" }),
        () => client.mutation(institutionalEmailApi.suspendOrArchiveMailbox, { mailboxId: mailboxB, action: "suspend" }),
        () => client.query(institutionalEmailApi.getInstitutionalMailboxes, { schoolId: schoolB }),
        () => client.query(institutionalEmailApi.getSchoolEmailDomains, { schoolId: schoolB }),
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
      for (const operation of [...emailOperations(t), ...importOperations(t), ...assetOperations(t)]) await expectDenied(operation);
      for (const operation of [...emailOperations(crossTenant), ...importOperations(crossTenant), ...assetOperations(crossTenant)]) await expectDenied(operation);
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
