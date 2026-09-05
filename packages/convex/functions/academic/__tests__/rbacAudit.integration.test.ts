import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import {
  evaluateEffectiveCapabilities,
  previewEffectiveCapabilities,
  requireCapability,
  hasViewerCapability,
  assignRoleToMembership,
  grantDirectCapability,
  restrictDirectCapability,
  setDelegationCeiling,
  CAPABILITY_CATALOG,
  SENSITIVE_CAPABILITIES,
  FACTORY_ROLE_DEFINITIONS,
} from "../rbac";
import {
  sanitizeAuditSummary,
  recordAuditEventInternal,
  listAuditEvents,
  listAuditAlerts,
  dismissAuditAlert,
} from "../audit";

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
  ]),
);

import { api, internal } from "../../../_generated/api";

describe("Task B-03 / M2: Capability RBAC and Append-Only Audit Kernel (H2/F1)", () => {
  it("1. Evaluator calculates (Templates ∪ Grants) ∖ Restrictions accurately", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    // 1. Seed factory templates
    await t.mutation(internal.functions.academic.rbacMigration.seedFactoryRoleTemplates, {});

    // 2. Setup school, person, branch membership
    const { schoolId, personId, membershipId, academicDirectorTemplateId } = await t.run(
      async (ctx) => {
        const schoolId = await ctx.db.insert("schools", {
          name: "Olive Crest Ikoyi",
          slug: "olive-ikoyi",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        const personId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|academic-lead",
          email: "lead@olivecrest.test",
          name: "Academic Lead",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });

        const membershipId = await ctx.db.insert("branchMemberships", {
          personId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        const template = await ctx.db
          .query("roleTemplates")
          .withIndex("by_code", (q) => q.eq("code", "academic_director"))
          .unique();

        return {
          schoolId,
          personId,
          membershipId,
          academicDirectorTemplateId: template!._id,
        };
      }
    );

    // 3. Assign academic_director template to membership
    await t.run(async (ctx) => {
      await ctx.db.insert("membershipRoleAssignments", {
        membershipId,
        roleTemplateId: academicDirectorTemplateId,
        roleTemplateKey: "academic_director",
        assignedAt: now,
      });
    });

    // 4. Add direct grant: 'finance.reports.view'
    await t.run(async (ctx) => {
      await ctx.db.insert("membershipDirectGrants", {
        membershipId,
        capability: "finance.reports.view",
        grantedAt: now,
        reason: "Cross-department academic budgeting",
      });
    });

    // 5. Add direct restriction: 'academic.classes.manage' (which is in academic_director template)
    await t.run(async (ctx) => {
      await ctx.db.insert("membershipDirectRestrictions", {
        membershipId,
        capability: "academic.classes.manage",
        restrictedAt: now,
        reason: "Restricted from class creation",
      });
    });

    // 6. Evaluate effective capabilities
    const effective = await t.run(async (ctx) => {
      return await evaluateEffectiveCapabilities(ctx, membershipId);
    });

    // Assert: Included from template
    expect(effective).toContain("academic.curriculum.manage");
    expect(effective).toContain("academic.subjects.manage");
    // Assert: Included from direct grant (+)
    expect(effective).toContain("finance.reports.view");
    // Assert: Excluded by direct restriction (-)
    expect(effective).not.toContain("academic.classes.manage");

    // 7. Check previewEffectiveCapabilities query produces identical result
    const leadSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|academic-lead",
      subject: "lead-subject",
      email: "lead@olivecrest.test",
    });

    const preview = await leadSession.query(
      api.functions.academic.rbac.previewEffectiveCapabilities,
      {
        schoolId,
        membershipId,
      }
    );

    expect(preview).toEqual(effective);
  });

  it("2. Anti-self-escalation: Manager cannot assign permissions to their own membership", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.mutation(internal.functions.academic.rbacMigration.seedFactoryRoleTemplates, {});

    const { schoolId, managerMembershipId, bursarTemplateId } = await t.run(
      async (ctx) => {
        const schoolId = await ctx.db.insert("schools", {
          name: "Olive Crest Lekki",
          slug: "olive-lekki",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        const managerPersonId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|principal-carol",
          email: "carol@olivecrest.test",
          name: "Principal Carol",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });

        const managerMembershipId = await ctx.db.insert("branchMemberships", {
          personId: managerPersonId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        // Grant Carol staff.permissions.manage so she has management permission
        await ctx.db.insert("membershipDirectGrants", {
          membershipId: managerMembershipId,
          capability: "staff.permissions.manage",
          grantedAt: now,
        });

        const bursar = await ctx.db
          .query("roleTemplates")
          .withIndex("by_code", (q) => q.eq("code", "bursar"))
          .unique();

        return {
          schoolId,
          managerMembershipId,
          bursarTemplateId: bursar!._id,
        };
      }
    );

    const carolSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|principal-carol",
      subject: "carol-subject",
      email: "carol@olivecrest.test",
    });

    // Attempt 1: Self role assignment rejection
    await expect(
      carolSession.mutation(api.functions.academic.rbac.assignRoleToMembership, {
        schoolId,
        targetMembershipId: managerMembershipId,
        roleTemplateId: bursarTemplateId,
      })
    ).rejects.toThrow("Anti-self-edit violation");

    // Attempt 2: Self direct grant rejection
    await expect(
      carolSession.mutation(api.functions.academic.rbac.grantDirectCapability, {
        schoolId,
        targetMembershipId: managerMembershipId,
        capability: "finance.bank_details.manage",
      })
    ).rejects.toThrow("Anti-self-edit violation");

    // Attempt 3: Self direct restriction rejection
    await expect(
      carolSession.mutation(api.functions.academic.rbac.restrictDirectCapability, {
        schoolId,
        targetMembershipId: managerMembershipId,
        capability: "academic.curriculum.manage",
      })
    ).rejects.toThrow("Anti-self-edit violation");
  });

  it("3. Delegation ceiling: Manager cannot grant a capability outside their delegationCeiling", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.mutation(internal.functions.academic.rbacMigration.seedFactoryRoleTemplates, {});

    const {
      schoolId,
      managerMembershipId,
      staffMembershipId,
      bursarTemplateId,
    } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Olive Crest Ikoyi",
        slug: "olive-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Manager Carol
      const managerPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|manager-carol",
        email: "carol-mgr@olivecrest.test",
        name: "Carol Manager",
        status: "active",
        primarySchoolId: schoolId,
        createdAt: now,
        updatedAt: now,
      });

      const managerMembershipId = await ctx.db.insert("branchMemberships", {
        personId: managerPersonId,
        schoolId,
        status: "active",
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("membershipDirectGrants", {
        membershipId: managerMembershipId,
        capability: "staff.permissions.manage",
        grantedAt: now,
      });

      // Staff Dave
      const staffPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|teacher-dave",
        email: "dave@olivecrest.test",
        name: "Dave Teacher",
        status: "active",
        primarySchoolId: schoolId,
        createdAt: now,
        updatedAt: now,
      });

      const staffMembershipId = await ctx.db.insert("branchMemberships", {
        personId: staffPersonId,
        schoolId,
        status: "active",
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });

      // Set delegation ceiling for Carol: ONLY academic capabilities
      await ctx.db.insert("delegationCeilings", {
        membershipId: managerMembershipId,
        allowedCapabilities: [
          "academic.classes.manage",
          "academic.subjects.manage",
          "academic.assessments.enter",
        ],
        updatedAt: now,
      });

      const bursar = await ctx.db
        .query("roleTemplates")
        .withIndex("by_code", (q) => q.eq("code", "bursar"))
        .unique();

      return {
        schoolId,
        managerMembershipId,
        staffMembershipId,
        bursarTemplateId: bursar!._id,
      };
    });

    const carolSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|manager-carol",
      subject: "carol-subject",
      email: "carol-mgr@olivecrest.test",
    });

    // Attempt 1: Granting a financial capability not in ceiling -> Must FAIL
    await expect(
      carolSession.mutation(api.functions.academic.rbac.grantDirectCapability, {
        schoolId,
        targetMembershipId: staffMembershipId,
        capability: "finance.bank_details.manage",
      })
    ).rejects.toThrow("Delegation ceiling violation");

    // Attempt 2: Assigning bursar template (which contains finance capabilities not in ceiling) -> Must FAIL
    await expect(
      carolSession.mutation(api.functions.academic.rbac.assignRoleToMembership, {
        schoolId,
        targetMembershipId: staffMembershipId,
        roleTemplateId: bursarTemplateId,
      })
    ).rejects.toThrow("Delegation ceiling violation");

    // Attempt 3: Granting capability within ceiling ('academic.classes.manage') -> Must SUCCEED
    const grantResult = await carolSession.mutation(
      api.functions.academic.rbac.grantDirectCapability,
      {
        schoolId,
        targetMembershipId: staffMembershipId,
        capability: "academic.classes.manage",
      }
    );
    expect(grantResult).toEqual({ success: true });

    // Verify Dave now has 'academic.classes.manage'
    const daveEffective = await t.run(async (ctx) => {
      return await evaluateEffectiveCapabilities(ctx, staffMembershipId);
    });
    expect(daveEffective).toContain("academic.classes.manage");
  });

  it("4. No superior edit: Manager cannot alter permissions of School Proprietor", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await t.mutation(internal.functions.academic.rbacMigration.seedFactoryRoleTemplates, {});

    const { schoolId, proprietorMembershipId, managerMembershipId } = await t.run(
      async (ctx) => {
        const schoolId = await ctx.db.insert("schools", {
          name: "Olive Crest Ikoyi",
          slug: "olive-ikoyi",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        // Proprietor Paula
        const proprietorPersonId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
          email: "paula@olivecrest.test",
          name: "Paula Proprietor",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });

        const groupId = await ctx.db.insert("schoolGroups", {
          name: "Olive Crest Group",
          slug: "olive-group",
          proprietorPersonId,
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("schoolGroupBranches", {
          groupId,
          schoolId,
          isHeadquarters: true,
          linkedAt: now,
        });

        const proprietorMembershipId = await ctx.db.insert("branchMemberships", {
          personId: proprietorPersonId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        // Manager Carol
        const managerPersonId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|manager-carol",
          email: "carol@olivecrest.test",
          name: "Carol Principal",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });

        const managerMembershipId = await ctx.db.insert("branchMemberships", {
          personId: managerPersonId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        await ctx.db.insert("membershipDirectGrants", {
          membershipId: managerMembershipId,
          capability: "staff.permissions.manage",
          grantedAt: now,
        });

        return {
          schoolId,
          proprietorMembershipId,
          managerMembershipId,
        };
      }
    );

    const carolSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|manager-carol",
      subject: "carol-subject",
      email: "carol@olivecrest.test",
    });

    // Carol tries to alter Proprietor Paula's permissions -> Must be rejected with SUPERIOR_EDIT_DENIED
    await expect(
      carolSession.mutation(api.functions.academic.rbac.grantDirectCapability, {
        schoolId,
        targetMembershipId: proprietorMembershipId,
        capability: "academic.curriculum.manage",
      })
    ).rejects.toThrow("Forbidden: You cannot alter direct grants of the School Proprietor");
  });

  it("5. Audit sanitization: Pre-write redaction masks bank account numbers and secrets", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    // Unit check for regex sanitizer
    const rawBankText = "Settlement account 0123456789 updated for bursar";
    const sanitizedBank = sanitizeAuditSummary(rawBankText);
    expect(sanitizedBank).toBe("Settlement account ***-****-6789 updated for bursar");

    const rawSecretText = 'User updated password="SuperSecretPassword123!" and bearer token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.abc';
    const sanitizedSecret = sanitizeAuditSummary(rawSecretText);
    expect(sanitizedSecret).toContain('[REDACTED_SECRET]');
    expect(sanitizedSecret).not.toContain("SuperSecretPassword123!");
    expect(sanitizedSecret).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    const rawNIN = "National ID number 12345678901 verified";
    const sanitizedNIN = sanitizeAuditSummary(rawNIN);
    expect(sanitizedNIN).toBe("National ID number ***-****-8901 verified");

    // Integration check: Persisted audit event has sanitization applied
    const { schoolId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Olive Crest Ikoyi",
        slug: "olive-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      return { schoolId };
    });

    const result = await t.mutation(
      internal.functions.academic.audit.recordAuditEventInternal,
      {
        schoolId,
        actorKind: "user",
        actorEmailSnapshot: "admin@olivecrest.test",
        module: "finance",
        action: "bank_account_modified",
        targetType: "bank_account",
        targetId: "acct_01",
        outcome: "success",
        safeSummary: "Bank account 0987654321 modified with token=secret12345",
        beforeSummary: "Old account 1122334455",
        afterSummary: "New account 0987654321",
        alertTier: "tier1_critical",
      }
    );

    expect(result.eventId).toBeDefined();

    // Fetch the inserted event from the database
    const eventDoc = await t.run(async (ctx) => {
      return await ctx.db.get(result.docId);
    });

    expect(eventDoc).not.toBeNull();
    expect(eventDoc!.safeSummary).toBe("Bank account ***-****-4321 modified with token=[REDACTED_SECRET]");
    expect(eventDoc!.beforeSummary).toBe("Old account ***-****-4455");
    expect(eventDoc!.afterSummary).toBe("New account ***-****-4321");
    // Ensure raw numbers are never stored in plain text
    expect(eventDoc!.safeSummary).not.toContain("0987654321");
    expect(eventDoc!.safeSummary).not.toContain("secret12345");
  });

  it("6. Audit alerting: Sensitive critical action generates an auditAlerts notification", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const { schoolId, personId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Olive Crest Ikoyi",
        slug: "olive-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const personId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|proprietor-paula",
        email: "paula@olivecrest.test",
        name: "Paula Proprietor",
        status: "active",
        primarySchoolId: schoolId,
        createdAt: now,
        updatedAt: now,
      });

      const membershipId = await ctx.db.insert("branchMemberships", {
        personId,
        schoolId,
        status: "active",
        isDefaultBranch: true,
        joinedAt: now,
        updatedAt: now,
      });

      // Give Paula audit.view capability
      await ctx.db.insert("membershipDirectGrants", {
        membershipId,
        capability: "audit.branch.view",
        grantedAt: now,
      });

      return { schoolId, personId };
    });

    // Record a Tier 1 Critical event
    await t.mutation(internal.functions.academic.audit.recordAuditEventInternal, {
      schoolId,
      actorKind: "user",
      actorEmailSnapshot: "bursar@olivecrest.test",
      module: "finance",
      action: "settlement_bank_modified",
      targetType: "schoolBankAccounts",
      targetId: "bank_01",
      outcome: "success",
      safeSummary: "Bank account 0123456789 added for school settlements",
      alertTier: "tier1_critical",
      retentionClass: "permanent_statutory",
    });

    // Verify an alert was inserted into auditAlerts
    const paulaSession = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|proprietor-paula",
      subject: "paula-subject",
      email: "paula@olivecrest.test",
    });

    const activeAlerts = await paulaSession.query(
      api.functions.academic.audit.listAuditAlerts,
      {
        schoolId,
        isDismissed: false,
      }
    );

    expect(activeAlerts.length).toBe(1);
    expect(activeAlerts[0].tier).toBe("tier1_critical");
    expect(activeAlerts[0].title).toBe("Critical Security Event: settlement_bank_modified");
    expect(activeAlerts[0].message).toBe("Bank account ***-****-6789 added for school settlements");
    expect(activeAlerts[0].isDismissed).toBe(false);

    // Dismiss the alert
    await paulaSession.mutation(api.functions.academic.audit.dismissAuditAlert, {
      schoolId,
      alertDocId: activeAlerts[0]._id,
    });

    // Verify no active undismissed alerts remain
    const undismissed = await paulaSession.query(
      api.functions.academic.audit.listAuditAlerts,
      {
        schoolId,
        isDismissed: false,
      }
    );
    expect(undismissed.length).toBe(0);

    // Verify it appears under dismissed alerts
    const dismissedAlerts = await paulaSession.query(
      api.functions.academic.audit.listAuditAlerts,
      {
        schoolId,
        isDismissed: true,
      }
    );
    expect(dismissedAlerts.length).toBe(1);
    expect(dismissedAlerts[0].isDismissed).toBe(true);
  });

  it("7. Immutability: Audit log has no delete/update endpoints and query honors capability", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    // 1. Verify schema definition: auditEvents only has insert via internal writer
    const auditFunctions = Object.keys(api.functions.academic.audit);
    expect(auditFunctions).not.toContain("deleteAuditEvent");
    expect(auditFunctions).not.toContain("updateAuditEvent");
    expect(auditFunctions).not.toContain("patchAuditEvent");

    // 2. Setup school & users
    const { schoolId, unprivilegedSession, auditorSession } = await t.run(
      async (ctx) => {
        const schoolId = await ctx.db.insert("schools", {
          name: "Olive Crest Ikoyi",
          slug: "olive-ikoyi",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });

        // Teacher Dave (no audit view capability)
        const davePersonId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|teacher-dave",
          email: "dave@olivecrest.test",
          name: "Dave Teacher",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("branchMemberships", {
          personId: davePersonId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });

        // Auditor Alice (has audit.branch.view)
        const alicePersonId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.melo.test|auditor-alice",
          email: "alice@olivecrest.test",
          name: "Alice Auditor",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });
        const aliceMembershipId = await ctx.db.insert("branchMemberships", {
          personId: alicePersonId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          joinedAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("membershipDirectGrants", {
          membershipId: aliceMembershipId,
          capability: "audit.branch.view",
          grantedAt: now,
        });

        return {
          schoolId,
          unprivilegedSession: "https://auth.melo.test|teacher-dave",
          auditorSession: "https://auth.melo.test|auditor-alice",
        };
      }
    );

    // Record sample audit events
    await t.mutation(internal.functions.academic.audit.recordAuditEventInternal, {
      schoolId,
      actorKind: "system",
      actorEmailSnapshot: "system@melo.internal",
      module: "academic",
      action: "term_initialized",
      targetType: "session",
      targetId: "sess_01",
      outcome: "success",
      safeSummary: "Academic term 2026/2027 initialized",
      alertTier: "tier3_info",
    });

    const daveClient = t.withIdentity({
      tokenIdentifier: unprivilegedSession,
      subject: "dave-sub",
      email: "dave@olivecrest.test",
    });

    // Unprivileged user querying audit log must receive 403 FORBIDDEN
    await expect(
      daveClient.query(api.functions.academic.audit.listAuditEvents, {
        schoolId,
      })
    ).rejects.toThrow("Forbidden");

    // Authorized auditor querying audit log receives events
    const aliceClient = t.withIdentity({
      tokenIdentifier: auditorSession,
      subject: "alice-sub",
      email: "alice@olivecrest.test",
    });

    const events = await aliceClient.query(
      api.functions.academic.audit.listAuditEvents,
      {
        schoolId,
      }
    );

    expect(events.length).toBe(1);
    expect(events[0].safeSummary).toBe("Academic term 2026/2027 initialized");
  });

  it("8. Migration & Backfill: Existing admin memberships receive principal role template", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    // 1. Seed role templates first
    await t.mutation(internal.functions.academic.rbacMigration.seedFactoryRoleTemplates, {});

    // 2. Setup school with legacy admin user and unassigned branchMembership
    const { schoolId, adminMembershipId } = await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", {
        name: "Olive Crest Ikoyi",
        slug: "olive-ikoyi",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      const adminPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|legacy-admin",
        email: "legacyadmin@olivecrest.test",
        name: "Legacy Administrator",
        status: "active",
        primarySchoolId: schoolId,
        createdAt: now,
        updatedAt: now,
      });

      const legacyUserId = await ctx.db.insert("users", {
        schoolId,
        authId: "auth-legacy-admin",
        authTokenIdentifier: "https://auth.melo.test|legacy-admin",
        personId: adminPersonId,
        name: "Legacy Administrator",
        email: "legacyadmin@olivecrest.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });

      const adminMembershipId = await ctx.db.insert("branchMemberships", {
        personId: adminPersonId,
        schoolId,
        status: "active",
        isDefaultBranch: true,
        legacyUserId,
        joinedAt: now,
        updatedAt: now,
      });

      return { schoolId, adminMembershipId };
    });

    // 3. Lockout prevention verification: Even BEFORE backfill runs, evaluator grants baseline capabilities
    const preBackfillCaps = await t.run(async (ctx) => {
      return await evaluateEffectiveCapabilities(ctx, adminMembershipId);
    });
    expect(preBackfillCaps).toContain("academic.curriculum.manage");
    expect(preBackfillCaps).toContain("staff.onboard");

    // 4. Run backfill migration
    const backfillResult = await t.mutation(
      internal.functions.academic.rbacMigration.backfillExistingAdminCapabilities,
      {}
    );

    expect(backfillResult.backfilledCount).toBe(1);

    // 5. Verify explicit role assignment was created
    const assignments = await t.run(async (ctx) => {
      return await ctx.db
        .query("membershipRoleAssignments")
        .withIndex("by_membership", (q) => q.eq("membershipId", adminMembershipId))
        .collect();
    });

    expect(assignments.length).toBe(1);
    expect(assignments[0].roleTemplateKey).toBe("principal");

    // 6. Evaluator now returns principal capabilities via explicit assignment
    const postBackfillCaps = await t.run(async (ctx) => {
      return await evaluateEffectiveCapabilities(ctx, adminMembershipId);
    });
    expect(postBackfillCaps).toContain("academic.curriculum.manage");
    expect(postBackfillCaps).toContain("staff.onboard");
    expect(postBackfillCaps).toContain("audit.branch.view");
  });
});
