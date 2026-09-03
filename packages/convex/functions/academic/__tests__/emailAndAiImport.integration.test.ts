import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
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

const institutionalEmailApi = (api as any).functions.academic.institutionalEmail;
const aiImportApi = (api as any).functions.academic.aiImport;

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

    return {
      schoolId,
      adminUserId,
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
      const reg = await t.mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "google",
        isDefault: true,
      });

      await t.mutation(institutionalEmailApi.verifyDomain, {
        domainId: reg.domainId,
        simulateSuccess: true,
      });

      // Propose batch of 3 persons sharing the same base name 'John Doe'
      const proposals = await t.query(
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
        state: "provider_provisioned",
      });

      // Person 2 collides with Person 1 -> Stage 2: firstname.m.lastname@domain
      expect(proposals[1]).toMatchObject({
        personId: person2Id,
        proposedEmail: "john.m.doe@cedarwood.edu.ng",
        stage: 2,
        collisionDetected: true,
        needsManualReview: false,
        state: "provider_provisioned",
      });

      // Person 3 collides with Person 1 (no middle name) -> Stage 3: firstname.lastname2@domain
      expect(proposals[2]).toMatchObject({
        personId: person3Id,
        proposedEmail: "john.doe2@cedarwood.edu.ng",
        stage: 3,
        collisionDetected: true,
        needsManualReview: false,
        state: "provider_provisioned",
      });
    });

    it("triggers Stage 4 manual edit required when all deterministic stages collide", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, person2Id, person3Id } =
        await setupTestHarness(t);

      const reg = await t.mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "microsoft",
        isDefault: true,
      });
      await t.mutation(institutionalEmailApi.verifyDomain, {
        domainId: reg.domainId,
      });

      // Pre-allocate john.doe@, john.m.doe@, and john.doe2@
      await t.mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person1Id,
        email: "john.doe@cedarwood.edu.ng",
        state: "provider_provisioned",
      });
      await t.mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person2Id,
        email: "john.m.doe@cedarwood.edu.ng",
        state: "provider_provisioned",
      });
      await t.mutation(institutionalEmailApi.assignInstitutionalMailbox, {
        schoolId,
        personId: person3Id,
        email: "john.doe2@cedarwood.edu.ng",
        state: "provider_provisioned",
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

      const proposals = await t.query(
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

      const reg = await t.mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "cedarwood.edu.ng",
        provider: "zoho",
        isDefault: true,
      });
      await t.mutation(institutionalEmailApi.verifyDomain, {
        domainId: reg.domainId,
      });

      const proposals = await t.query(
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
      const reg = await t.mutation(institutionalEmailApi.registerEmailDomain, {
        schoolId,
        domain: "stgregorys.edu.ng",
        provider: "google",
      });

      expect(reg.status).toBe("pending_verification");
      expect(reg.dnsTxtRecord).toMatch(/^melo-verify=/);

      // Verify domain state before verification
      const domainsBefore = await t.query(
        institutionalEmailApi.getSchoolEmailDomains,
        { schoolId }
      );
      expect(domainsBefore[0].status).toBe("pending_verification");

      // 2. Verify domain challenge
      const verified = await t.mutation(institutionalEmailApi.verifyDomain, {
        domainId: reg.domainId,
        simulateSuccess: true,
      });

      expect(verified.status).toBe("verified");
      expect(verified.verified).toBe(true);

      const domainsAfter = await t.query(
        institutionalEmailApi.getSchoolEmailDomains,
        { schoolId }
      );
      expect(domainsAfter[0].status).toBe("verified");
      expect(domainsAfter[0].verifiedAt).toBeDefined();

      // 3. Failed verification test
      const failedReg = await t.mutation(
        institutionalEmailApi.registerEmailDomain,
        {
          schoolId,
          domain: "unverified-school.edu.ng",
          provider: "none",
        }
      );

      const failedVerify = await t.mutation(
        institutionalEmailApi.verifyDomain,
        {
          domainId: failedReg.domainId,
          simulateSuccess: false,
        }
      );

      expect(failedVerify.status).toBe("failed");
      expect(failedVerify.verified).toBe(false);
    });
  });

  describe("4. AI Import Review Pipeline (Zero Direct Commits)", () => {
    it("stages raw rows, catches validation errors deterministically, and isolates operational tables", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId } = await setupTestHarness(t);

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
          rawSecretToken: "secret_token_12345", // sensitive credential
          passwordHash: "bcrypt$123456", // sensitive credential
        },
        {
          firstName: "Fatima",
          // Missing lastName
          admissionNumber: "ADM-2026-002",
          gender: "Female",
        },
        {
          firstName: "Babajide",
          lastName: "Sanwo",
          admissionNumber: "ADM-2026-003",
          dateOfBirth: Date.now() + 10000000, // Invalid: in the future!
        },
        {
          firstName: "Emeka",
          lastName: "Okafor",
          admissionNumber: "ADM-2026-001", // Duplicate admission number!
        },
      ];

      // 1. Stage raw data
      const stageResult = await t.mutation(aiImportApi.stageImportData, {
        schoolId,
        importerUserId: adminUserId,
        entityType: "students",
        rawRows,
      });

      expect(stageResult.status).toBe("staged");
      expect(stageResult.rowCount).toBe(4);
      expect(stageResult.errorCount).toBeGreaterThanOrEqual(3);

      // Sensitive credentials must be stripped from staged rows
      const workspace = await t.query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
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
        t.mutation(aiImportApi.commitImportWorkspace, {
          workspaceId: stageResult.workspaceId,
        })
      ).rejects.toThrow("Cannot commit workspace with");

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
      await t.mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 1,
        updatedFields: { lastName: "Abdullahi" },
      });

      // Fix Row 2 (future dateOfBirth -> past date)
      await t.mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 2,
        updatedFields: {
          dateOfBirth: Date.now() - 11 * 365 * 24 * 60 * 60 * 1000,
        },
      });

      // Fix Row 3 (duplicate admissionNumber -> unique)
      const fixResult = await t.mutation(aiImportApi.updateStagedRow, {
        workspaceId: stageResult.workspaceId,
        rowIndex: 3,
        updatedFields: { admissionNumber: "ADM-2026-004" },
      });

      expect(fixResult.remainingErrors).toHaveLength(0);

      // Verify workspace transitioned to 'reviewed'
      const reviewedWorkspace = await t.query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      expect(reviewedWorkspace.status).toBe("reviewed");
      expect(reviewedWorkspace.validationErrors).toHaveLength(0);

      // 4. Commit workspace atomically into official operational tables
      const commitResult = await t.mutation(aiImportApi.commitImportWorkspace, {
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
      const finalWorkspace = await t.query(aiImportApi.getImportWorkspace, {
        workspaceId: stageResult.workspaceId,
      });
      expect(finalWorkspace.status).toBe("committed");
      expect(finalWorkspace.committedAt).toBeDefined();
    });
  });

  describe("5. External Directory Provider Fault Isolation", () => {
    it("guarantees external provider errors leave internal membership and identity intact", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, person1Id, membership1Id } =
        await setupTestHarness(t);

      // 1. Attempt assigning mailbox with simulated provider API failure (HTTP 503)
      const failResult = await t.mutation(
        institutionalEmailApi.assignInstitutionalMailbox,
        {
          schoolId,
          personId: person1Id,
          email: "john.doe@cedarwood.edu.ng",
          state: "provider_provisioned",
          providerType: "google",
          simulateProviderFailure: true,
        }
      );

      expect(failResult.success).toBe(false);
      expect(failResult.internalStateIntact).toBe(true);
      expect(failResult.error).toContain("HTTP 503");

      // Verify internal person identity remains completely intact
      const personAfterFailure = await t.run(async (ctx) => {
        return await ctx.db.get(person1Id);
      });
      expect(personAfterFailure).toBeDefined();
      expect(personAfterFailure!.status).toBe("active");
      expect(personAfterFailure!.name).toBe("John Doe");

      // Verify internal branch membership remains completely intact
      const membershipAfterFailure = await t.run(async (ctx) => {
        return await ctx.db.get(membership1Id);
      });
      expect(membershipAfterFailure).toBeDefined();
      expect(membershipAfterFailure!.status).toBe("active");

      // 2. Re-attempt assignment with provider recovery
      const successResult = await t.mutation(
        institutionalEmailApi.assignInstitutionalMailbox,
        {
          schoolId,
          personId: person1Id,
          email: "john.doe@cedarwood.edu.ng",
          state: "provider_provisioned",
          providerType: "google",
          simulateProviderFailure: false,
        }
      );

      expect(successResult.success).toBe(true);
      expect(successResult.state).toBe("provider_provisioned");

      // 3. User departure: suspend and archive mailbox without deleting
      const suspendResult = await t.mutation(
        institutionalEmailApi.suspendOrArchiveMailbox,
        {
          mailboxId: successResult.mailboxId,
          action: "suspend",
          reason: "Student graduated",
        }
      );
      expect(suspendResult.status).toBe("suspended");

      const archiveResult = await t.mutation(
        institutionalEmailApi.suspendOrArchiveMailbox,
        {
          mailboxId: successResult.mailboxId,
          action: "archive",
          reason: "Statutory retention window reached",
        }
      );
      expect(archiveResult.status).toBe("archived");

      // Permanent Re-allocation Freeze: Attempting to assign this frozen address to person2Id must fail
      const { person2Id } = await setupTestHarness(t);
      await expect(
        t.mutation(institutionalEmailApi.assignInstitutionalMailbox, {
          schoolId,
          personId: person2Id,
          email: "john.doe@cedarwood.edu.ng",
          state: "provider_provisioned",
        })
      ).rejects.toThrow("Address already allocated and frozen for another person");
    });
  });
});
