import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";
import type { PermissionCapability } from "../rbac";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const academic = api.functions.academic;

async function scopedFixture(
  capabilities: readonly PermissionCapability[],
  options?: { role?: "admin" | "teacher"; token?: string },
) {
  const t = convexTest(schema, modules);
  const token = options?.token ?? `test|scoped-${capabilities.join("-") || "none"}`;
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Scoped School",
      slug: `scoped-${Math.random()}`,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherSchoolId = await ctx.db.insert("schools", {
      name: "Other School",
      slug: `other-${Math.random()}`,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const operator = await seedReviewedTenantOperatorWithCapabilities(
      ctx,
      [schoolId],
      token,
      capabilities,
      { role: options?.role },
    );
    const operatorUserId = operator.memberships[0].userId;
    const teacherId = await ctx.db.insert("users", {
      schoolId,
      authId: `teacher-${token}`,
      name: "Projected Teacher",
      email: `teacher-${token.replace(/[^a-z0-9]/gi, "")}@test.invalid`,
      role: "teacher",
      createdAt: 2,
      updatedAt: 2,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "Primary 1",
      gradeName: "Primary 1",
      level: "primary",
      formTeacherId: options?.role === "teacher" ? operatorUserId : teacherId,
      createdAt: 1,
      updatedAt: 1,
    });
    const subjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "Mathematics",
      code: "MTH",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId,
      teacherId,
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026",
      startDate: 1,
      endDate: 100,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First",
      startDate: 1,
      endDate: 50,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const studentUserId = await ctx.db.insert("users", {
      schoolId,
      authId: `student-${token}`,
      name: "Private Student",
      email: `student-${token.replace(/[^a-z0-9]/gi, "")}@test.invalid`,
      role: "student",
      createdAt: 1,
      updatedAt: 1,
    });
    const studentId = await ctx.db.insert("students", {
      schoolId,
      userId: studentUserId,
      classId,
      admissionNumber: "A-1",
      gender: "female",
      createdAt: 1,
      updatedAt: 1,
    });
    const domainId = await ctx.db.insert("schoolEmailDomains", {
      schoolId,
      domain: "scoped.edu.test",
      status: "pending_verification",
      dnsTxtRecord: "melo-verify=secret-challenge",
      provider: "google",
      isDefault: true,
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      schoolId,
      otherSchoolId,
      operatorPersonId: operator.personId,
      operatorMembershipId: operator.memberships[0].membershipId,
      operatorUserId,
      teacherId,
      classId,
      subjectId,
      sessionId,
      termId,
      studentId,
      domainId,
    };
  });
  return {
    t,
    viewer: t.withIdentity({
      tokenIdentifier: token,
      issuer: "test",
      subject: token,
    }),
    ...ids,
  };
}

const commentArgs = (f: Awaited<ReturnType<typeof scopedFixture>>) => ({
  studentId: f.studentId,
  sessionId: f.sessionId,
  termId: f.termId,
  classTeacherComment: "Reviewed progress",
});
const extrasArgs = (f: Awaited<ReturnType<typeof scopedFixture>>) => ({
  studentId: f.studentId,
  classId: f.classId,
  sessionId: f.sessionId,
  termId: f.termId,
  bundleValues: [],
});

describe("S0 operation-specific authorization remediation", () => {
  it.each(["admin", "teacher"] as const)(
    "denies preview-only %s writes and permits assessment-entry writes within role scope",
    async (role) => {
      const preview = await scopedFixture(["academic.report_cards.preview"], {
        role,
        token: `test|preview-${role}`,
      });
      await expect(
        preview.viewer.mutation(
          academic.reportCards.saveStudentReportCardComments,
          commentArgs(preview),
        ),
      ).rejects.toThrow("capability");
      await expect(
        preview.viewer.mutation(
          academic.reportCardExtras.saveStudentReportCardExtrasEntry,
          extrasArgs(preview),
        ),
      ).rejects.toThrow("capability");

      const writer = await scopedFixture(["academic.assessments.enter"], {
        role,
        token: `test|writer-${role}`,
      });
      await expect(
        writer.viewer.mutation(
          academic.reportCards.saveStudentReportCardComments,
          commentArgs(writer),
        ),
      ).resolves.toBeNull();
      await expect(
        writer.viewer.mutation(
          academic.reportCardExtras.saveStudentReportCardExtrasEntry,
          extrasArgs(writer),
        ),
      ).resolves.toBeNull();

      if (role === "teacher") {
        await writer.t.run((ctx) =>
          ctx.db.patch(writer.classId, { formTeacherId: writer.teacherId }),
        );
        await expect(
          writer.viewer.mutation(
            academic.reportCards.saveStudentReportCardComments,
            commentArgs(writer),
          ),
        ).rejects.toThrow("assigned");
        await expect(
          writer.viewer.mutation(
            academic.reportCardExtras.saveStudentReportCardExtrasEntry,
            extrasArgs(writer),
          ),
        ).rejects.toThrow("assigned");
      }
    },
  );

  it.each(["finance.reports.view", "system.migration.execute"] as const)(
    "keeps staff identities and student counts out of the %s selector projection",
    async (capability) => {
      const f = await scopedFixture([capability], {
        token: `test|selector-${capability}`,
      });
      const classes = await f.viewer.query(academic.academicSetup.listClasses, {});
      expect(classes[0]).not.toHaveProperty("formTeacherId");
      expect(classes[0]).not.toHaveProperty("formTeacherName");
      expect(classes[0]).not.toHaveProperty("studentCount");

      const subjects = await f.viewer.query(
        academic.academicSetup.getClassSubjects,
        { classId: f.classId },
      );
      expect(subjects[0]).not.toHaveProperty("teacherId");
      expect(subjects[0]).not.toHaveProperty("teacherName");
    },
  );

  it("returns DNS challenges only to domain managers", async () => {
    const staff = await scopedFixture(["staff.onboard"], {
      token: "test|email-staff",
    });
    const safeDomains = await staff.viewer.query(
      academic.institutionalEmail.getSchoolEmailDomains,
      { schoolId: staff.schoolId },
    );
    expect(safeDomains[0]).toMatchObject({
      domain: "scoped.edu.test",
      status: "pending_verification",
    });
    expect(safeDomains[0]).not.toHaveProperty("dnsTxtRecord");

    const manager = await scopedFixture(["settings.domains.manage"], {
      token: "test|email-manager",
    });
    const managedDomains = await manager.viewer.query(
      academic.institutionalEmail.getSchoolEmailDomains,
      { schoolId: manager.schoolId },
    );
    expect(managedDomains[0]).toHaveProperty(
      "dnsTxtRecord",
      "melo-verify=secret-challenge",
    );
    await expect(
      staff.viewer.query(academic.institutionalEmail.getSchoolEmailDomains, {
        schoolId: staff.otherSchoolId,
      }),
    ).rejects.toThrow();
  });

  it("lets a payment-only reconciler execute the empty school-bound scan without report access", async () => {
    const reconciler = await scopedFixture(["finance.payments.record_manual"], {
      token: "test|payment-reconciler",
    });
    await expect(
      reconciler.viewer.action(api.functions.billing.verifyOnlinePaymentByReference, {
        reference: "missing-reference",
      }),
    ).rejects.toThrow("could not be resolved");
    await expect(
      reconciler.viewer.action(api.functions.billing.reconcilePendingOnlinePayments, {
        force: false,
      }),
    ).resolves.toEqual({
      scannedCount: 0,
      checkedCount: 0,
      resolvedCount: 0,
      pendingCount: 0,
      manualAttentionCount: 0,
    });

    const reporter = await scopedFixture(["finance.reports.view"], {
      token: "test|payment-reporter",
    });
    await expect(
      reporter.viewer.action(api.functions.billing.verifyOnlinePaymentByReference, {
        reference: "missing-reference",
      }),
    ).rejects.toThrow("capability");
    await expect(
      reporter.viewer.action(api.functions.billing.reconcilePendingOnlinePayments, {
        force: false,
      }),
    ).rejects.toThrow("capability");
  });

  it("uses separate leadership capabilities while retaining lead and direct-report invariants", async () => {
    const directory = await scopedFixture(["staff.list.view"], {
      token: "test|leadership-directory",
    });
    await expect(
      directory.viewer.query(academic.adminLeadership.listSchoolAdmins, {}),
    ).resolves.toMatchObject({ viewerUserId: directory.operatorUserId });
    await expect(
      directory.viewer.mutation(academic.adminLeadership.promoteTeacherToAdmin, {
        teacherId: directory.teacherId,
      }),
    ).rejects.toThrow("capability");
    for (const call of [
      () => directory.viewer.mutation(academic.adminLeadership.promoteSchoolAdmin, { adminId: directory.teacherId }),
      () => directory.viewer.mutation(academic.adminLeadership.demoteAdminToTeacher, { adminId: directory.teacherId }),
      () => directory.viewer.mutation(academic.adminLeadership.archiveSchoolAdmin, { adminId: directory.teacherId }),
      () => directory.viewer.mutation(academic.adminLeadership.transferSchoolAdminLeadership, { adminId: directory.teacherId }),
      () => directory.viewer.mutation(academic.adminLeadership.restoreSchoolAdmin, { adminId: directory.teacherId }),
    ]) {
      await expect(call()).rejects.toThrow("capability");
    }

    const onboarding = await scopedFixture(["staff.onboard"], {
      token: "test|leadership-onboarding",
    });
    await expect(
      onboarding.viewer.query(api.functions.auth.getViewerContext, {
        capability: "staff.onboard",
      }),
    ).resolves.toMatchObject({ appUserId: onboarding.operatorUserId });
    await expect(
      onboarding.viewer.query(
        academic.adminLeadership.getCreateSchoolAdminAuthority,
        {},
      ),
    ).rejects.toThrow("staff.permissions.manage");
    await expect(
      directory.viewer.action(academic.adminLeadership.createSchoolAdmin, {
        name: "Denied Admin",
        email: "denied-admin@test.invalid",
        temporaryPassword: "Not-dispatched-123!",
        origin: "https://test.invalid",
      }),
    ).rejects.toThrow("capability");

    const permissions = await scopedFixture(["staff.permissions.manage"], {
      token: "test|leadership-permissions",
    });
    const permissionTargets = await permissions.t.run(async (ctx) => {
      const groupId = await ctx.db.insert("schoolGroups", {
        name: "Owner Group",
        slug: "owner-group",
        proprietorPersonId: permissions.operatorPersonId,
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: permissions.schoolId,
        isHeadquarters: true,
        linkedAt: 1,
      });
      const promotedAdminId = await ctx.db.insert("users", {
        schoolId: permissions.schoolId,
        authId: "promoted-admin-target",
        name: "Promoted Admin",
        email: "promoted-admin@test.invalid",
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: permissions.operatorUserId,
        createdAt: 3,
        updatedAt: 3,
      });
      const demotedAdminId = await ctx.db.insert("users", {
        schoolId: permissions.schoolId,
        authId: "demoted-admin-target",
        name: "Demoted Admin",
        email: "demoted-admin@test.invalid",
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: permissions.operatorUserId,
        createdAt: 4,
        updatedAt: 4,
      });
      return { promotedAdminId, demotedAdminId };
    });
    await expect(
      permissions.viewer.mutation(
        academic.adminLeadership.promoteTeacherToAdmin,
        { teacherId: permissions.teacherId },
      ),
    ).resolves.toBeNull();
    await expect(
      permissions.viewer.mutation(academic.adminLeadership.promoteSchoolAdmin, {
        adminId: permissionTargets.promotedAdminId,
      }),
    ).resolves.toBeNull();
    await expect(
      permissions.viewer.mutation(academic.adminLeadership.demoteAdminToTeacher, {
        adminId: permissionTargets.demotedAdminId,
      }),
    ).resolves.toBeNull();
    await expect(
      permissions.viewer.mutation(
        academic.adminLeadership.transferSchoolAdminLeadership,
        { adminId: permissions.teacherId },
      ),
    ).resolves.toBeNull();

    const delegated = await scopedFixture(["staff.permissions.manage"], {
      token: "test|leadership-delegated",
    });
    const delegatedTarget = await delegated.t.run(async (ctx) => {
      const target = await seedReviewedTenantOperatorWithCapabilities(
        ctx,
        [delegated.schoolId],
        "test|leadership-managed-target",
        ["staff.list.view"],
        { role: "teacher" },
      );
      return target.memberships[0].userId;
    });
    await expect(
      delegated.viewer.mutation(
        academic.adminLeadership.promoteTeacherToAdmin,
        { teacherId: delegatedTarget },
      ),
    ).rejects.toThrow("ceiling");
    await delegated.t.run((ctx) =>
      ctx.db.insert("delegationCeilings", {
        membershipId: delegated.operatorMembershipId,
        allowedCapabilities: ["staff.list.view"],
        updatedBy: delegated.operatorPersonId,
        updatedAt: 1,
      }),
    );
    await expect(
      delegated.viewer.mutation(
        academic.adminLeadership.promoteTeacherToAdmin,
        { teacherId: delegatedTarget },
      ),
    ).resolves.toBeNull();

    const creator = await scopedFixture(
      ["staff.onboard", "staff.permissions.manage"],
      { token: "test|leadership-creator" },
    );
    await creator.t.run(async (ctx) => {
      const groupId = await ctx.db.insert("schoolGroups", {
        name: "Creator Group",
        slug: "creator-group",
        proprietorPersonId: creator.operatorPersonId,
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: creator.schoolId,
        isHeadquarters: true,
        linkedAt: 1,
      });
    });
    await expect(
      creator.viewer.query(
        academic.adminLeadership.getCreateSchoolAdminAuthority,
        {},
      ),
    ).resolves.toEqual({
      appUserId: creator.operatorUserId,
      schoolId: creator.schoolId,
    });

    const lifecycle = await scopedFixture(["staff.account.suspend"], {
      token: "test|leadership-lifecycle",
    });
    await lifecycle.t.run((ctx) =>
      ctx.db.patch(lifecycle.teacherId, {
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: lifecycle.operatorUserId,
      }),
    );
    await expect(
      lifecycle.viewer.mutation(academic.adminLeadership.archiveSchoolAdmin, {
        adminId: lifecycle.teacherId,
      }),
    ).resolves.toBeNull();
    await expect(
      lifecycle.viewer.mutation(academic.adminLeadership.restoreSchoolAdmin, {
        adminId: lifecycle.teacherId,
      }),
    ).resolves.toBeNull();
    await expect(
      lifecycle.viewer.query(academic.adminLeadership.listSchoolAdmins, {}),
    ).rejects.toThrow("capability");

    const proprietorAdminId = await lifecycle.t.run(async (ctx) => {
      const proprietor = await seedReviewedTenantOperatorWithCapabilities(
        ctx,
        [lifecycle.schoolId],
        "test|protected-proprietor",
        ["staff.list.view"],
      );
      const groupId = await ctx.db.insert("schoolGroups", {
        name: "Protected Group",
        slug: "protected-group",
        proprietorPersonId: proprietor.personId,
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("schoolGroupBranches", {
        groupId,
        schoolId: lifecycle.schoolId,
        isHeadquarters: true,
        linkedAt: 1,
      });
      return proprietor.memberships[0].userId;
    });
    await expect(
      lifecycle.viewer.mutation(academic.adminLeadership.archiveSchoolAdmin, {
        adminId: proprietorAdminId,
      }),
    ).rejects.toThrow("Proprietor");
  });
});
