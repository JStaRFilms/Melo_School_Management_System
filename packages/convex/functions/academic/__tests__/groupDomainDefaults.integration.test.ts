import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type {
  GroupDefaultDomain,
  GroupDefaultSetting,
} from "../../foundation/groupDefaultsContract";
import { resolveEffectiveReportCardTermSettings } from "../reportCardTermSettings";

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);
const endpoints = api.functions.academic.groups;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Headquarters",
      slug: "hq",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const unrelatedSchoolId = await ctx.db.insert("schools", {
      name: "Unrelated",
      slug: "unrelated",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const userId = await ctx.db.insert("users", {
      schoolId,
      personId,
      authId: "owner",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("branchMemberships", {
      schoolId,
      personId,
      legacyUserId: userId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: 1,
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Group",
      slug: "group",
      proprietorPersonId: personId,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId,
      isHeadquarters: true,
      linkedAt: 1,
    });
    const groupRoleId = await ctx.db.insert("roleTemplates", {
      code: "group_academic",
      name: "Group academic reviewer",
      scope: "group",
      groupId,
      capabilities: ["academic.report_cards.preview"],
      createdAt: 1,
      updatedAt: 1,
    });
    const branchRoleId = await ctx.db.insert("roleTemplates", {
      code: "branch_academic",
      name: "Branch academic reviewer",
      scope: "branch",
      schoolId,
      capabilities: ["academic.report_cards.preview"],
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("schoolAssessmentSettings", {
      schoolId,
      examInputMode: "raw40",
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examContributionMax: 40,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: userId,
    });
    return {
      schoolId,
      unrelatedSchoolId,
      groupId,
      groupRoleId,
      branchRoleId,
    };
  });
  return {
    t,
    ...ids,
    owner: t.withIdentity({ tokenIdentifier: "test|owner" }),
  };
}

function settingsFor(f: Awaited<ReturnType<typeof fixture>>): Array<{
  domain: GroupDefaultDomain;
  group: GroupDefaultSetting;
  branch: GroupDefaultSetting;
}> {
  return [
    {
      domain: "role_templates",
      group: { domain: "role_templates", value: { templateIds: [f.groupRoleId] } },
      branch: { domain: "role_templates", value: { templateIds: [f.branchRoleId] } },
    },
    {
      domain: "report_card_template",
      group: { domain: "report_card_template", value: { resultCalculationMode: "cumulative_annual", defaultTimesSchoolOpened: 180 } },
      branch: { domain: "report_card_template", value: { resultCalculationMode: "standalone", defaultTimesSchoolOpened: 160 } },
    },
    {
      domain: "notification_preferences",
      group: { domain: "notification_preferences", value: { showReportUpdates: false, showTeacherComments: true, showUpcomingEvents: false } },
      branch: { domain: "notification_preferences", value: { showReportUpdates: true, showTeacherComments: false, showUpcomingEvents: true } },
    },
    {
      domain: "academic_policy",
      group: { domain: "academic_policy", value: { examInputMode: "raw60_scaled_to_40" } },
      branch: { domain: "academic_policy", value: { examInputMode: "raw40" } },
    },
    {
      domain: "calendar_template",
      group: { domain: "calendar_template", value: { terms: [{ name: "Group Term", startOffsetDays: 0, endOffsetDays: 80, resultCalculationMode: "standalone" }] } },
      branch: { domain: "calendar_template", value: { terms: [{ name: "Branch Term", startOffsetDays: 5, endOffsetDays: 70, resultCalculationMode: "cumulative_annual" }] } },
    },
  ];
}

describe("U1f typed group domain defaults", () => {
  for (const domain of [
    "role_templates",
    "report_card_template",
    "notification_preferences",
    "academic_policy",
    "calendar_template",
  ] as const) {
    it(`${domain} requires explicit inherit, supports override/reset, and rejects stale or unrelated access`, async () => {
      const f = await fixture();
      const setting = settingsFor(f).find((item) => item.domain === domain)!;
      const before = await f.owner.query(endpoints.getBranchDomainSetting, {
        groupId: f.groupId,
        schoolId: f.schoolId,
        domain,
      });
      expect(before.source).not.toBe("group");
      expect(
        await f.owner.query(endpoints.previewGroupDomainSetting, {
          groupId: f.groupId,
          expectedVersion: 0,
          allowBranchOverride: true,
          setting: setting.group,
        }),
      ).toMatchObject({ candidate: { domain, version: 1 } });
      expect(
        await f.owner.query(endpoints.getGroupDomainSetting, {
          groupId: f.groupId,
          domain,
        }),
      ).toMatchObject({ version: 0, defaults: null });
      await f.owner.mutation(endpoints.saveGroupDomainSetting, {
        groupId: f.groupId,
        expectedVersion: 0,
        allowBranchOverride: true,
        confirmation: "group",
        setting: setting.group,
      });
      expect(
        (await f.owner.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          domain,
        })).source,
      ).not.toBe("group");
      await f.owner.mutation(endpoints.saveBranchDomainSetting, {
        groupId: f.groupId,
        schoolId: f.schoolId,
        expectedGroupVersion: 1,
        expectedRevision: 0,
        confirmation: "hq",
        change: { domain, mode: "inherit" },
      });
      expect(
        await f.owner.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          domain,
        }),
      ).toMatchObject({ source: "group", mode: "inherit", revision: 1 });
      await f.owner.mutation(endpoints.saveBranchDomainSetting, {
        groupId: f.groupId,
        schoolId: f.schoolId,
        expectedGroupVersion: 1,
        expectedRevision: 1,
        confirmation: "hq",
        change: { ...setting.branch, mode: "override" },
      });
      expect(
        await f.owner.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          domain,
        }),
      ).toMatchObject({ source: "branch_override", mode: "override", revision: 2 });
      await f.owner.mutation(endpoints.saveBranchDomainSetting, {
        groupId: f.groupId,
        schoolId: f.schoolId,
        expectedGroupVersion: 1,
        expectedRevision: 2,
        confirmation: "hq",
        change: { domain, mode: "inherit" },
      });
      expect(
        await f.owner.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          domain,
        }),
      ).toMatchObject({ source: "group", mode: "inherit", revision: 3 });
      await expect(
        f.owner.mutation(endpoints.saveBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          expectedGroupVersion: 1,
          expectedRevision: 2,
          confirmation: "hq",
          change: { domain, mode: "inherit" },
        }),
      ).rejects.toThrow("Conflict");
      await f.owner.mutation(endpoints.saveGroupDomainSetting, {
        groupId: f.groupId,
        expectedVersion: 1,
        allowBranchOverride: false,
        confirmation: "group",
        setting: setting.group,
      });
      await expect(
        f.owner.mutation(endpoints.saveBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          expectedGroupVersion: 2,
          expectedRevision: 3,
          confirmation: "hq",
          change: { ...setting.branch, mode: "override" },
        }),
      ).rejects.toThrow("disabled");
      await expect(
        f.t.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.schoolId,
          domain,
        }),
      ).rejects.toThrow();
      await expect(
        f.owner.query(endpoints.getBranchDomainSetting, {
          groupId: f.groupId,
          schoolId: f.unrelatedSchoolId,
          domain,
        }),
      ).rejects.toThrow();
    });
  }

  it("real role, academic, report and calendar consumers use only explicitly adopted prospective defaults", async () => {
    const f = await fixture();
    for (const item of settingsFor(f)) {
      await f.owner.mutation(endpoints.saveGroupDomainSetting, {
        groupId: f.groupId,
        expectedVersion: 0,
        allowBranchOverride: true,
        confirmation: "group",
        setting: item.group,
      });
      await f.owner.mutation(endpoints.saveBranchDomainSetting, {
        groupId: f.groupId,
        schoolId: f.schoolId,
        expectedGroupVersion: 1,
        expectedRevision: 0,
        confirmation: "hq",
        change: { domain: item.domain, mode: "inherit" },
      });
    }
    const workspace = await f.owner.query(
      api.functions.academic.rbac.getPermissionWorkspace,
      { schoolId: f.schoolId },
    );
    expect(workspace.templates.map((template) => template._id)).toContain(f.groupRoleId);
    expect(workspace.templates.map((template) => template._id)).not.toContain(f.branchRoleId);
    expect(
      await f.owner.query(
        api.functions.academic.settings.getSchoolAssessmentSettings,
        {},
      ),
    ).toMatchObject({
      examInputMode: "raw60_scaled_to_40",
      governance: { source: "group", groupVersion: 1 },
    });
    const timeline = await f.t.run(async (ctx) => {
      const sessionId = await ctx.db.insert("academicSessions", {
        schoolId: f.schoolId,
        name: "Existing session",
        startDate: 1,
        endDate: 500,
        isActive: true,
        createdAt: 1,
        updatedAt: 1,
      });
      const termId = await ctx.db.insert("academicTerms", {
        schoolId: f.schoolId,
        sessionId,
        name: "Existing term",
        startDate: 10,
        endDate: 400,
        isActive: true,
        reportCardCalculationMode: "standalone",
        createdAt: 1,
        updatedAt: 1,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId: f.schoolId,
        name: "JSS 1",
        level: "JSS 1",
        createdAt: 1,
        updatedAt: 1,
      });
      const studentPersonId = await ctx.db.insert("persons", {
        authTokenIdentifier: "test|student",
        name: "Student",
        email: "student@example.test",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      const studentUserId = await ctx.db.insert("users", {
        schoolId: f.schoolId,
        personId: studentPersonId,
        authId: "student",
        authTokenIdentifier: "test|student",
        name: "Student",
        email: "student@example.test",
        role: "student",
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("branchMemberships", {
        schoolId: f.schoolId,
        personId: studentPersonId,
        legacyUserId: studentUserId,
        status: "active",
        isDefaultBranch: true,
        joinedAt: 1,
        updatedAt: 1,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId: f.schoolId,
        classId,
        userId: studentUserId,
        admissionNumber: "HQ-001",
        enrollmentStatus: "active",
        createdAt: 1,
        updatedAt: 1,
      });
      const eventId = await ctx.db.insert("schoolEvents", {
        schoolId: f.schoolId,
        title: "Hidden group event",
        startDate: Date.now() + 86_400_000,
        endDate: Date.now() + 86_400_000,
        isAllDay: true,
        createdAt: 1,
        updatedAt: 1,
        updatedBy: studentUserId,
      });
      const issuedReportId = await ctx.db.insert("issuedReportCards", {
        schoolId: f.schoolId,
        studentId,
        sessionId,
        termId,
        classId,
        issuedAt: 2,
        issuedBy: studentUserId,
        report: {
          schoolName: "Headquarters",
          schoolLogoUrl: null,
          sessionName: "Existing session",
          termName: "Existing term",
          classId,
          className: "JSS 1",
          generatedAt: 2,
          assessmentConfig: { ca1Max: 20, ca2Max: 20, ca3Max: 20, examMax: 40 },
          resultCalculationMode: "standalone",
          student: {
            _id: studentId,
            name: "Student",
            displayName: "Student",
            firstName: null,
            lastName: null,
            admissionNumber: "HQ-001",
            gender: null,
            dateOfBirth: null,
            guardianName: null,
            guardianPhone: null,
            address: null,
            houseName: null,
            nextTermBegins: null,
            photoUrl: null,
          },
          summary: { totalSubjects: 0, recordedSubjects: 0, pendingSubjects: 0, averageScore: 0, totalScore: 0 },
          results: [],
          extras: [],
          classTeacherName: null,
          classTeacherComment: null,
          headTeacherComment: null,
        },
      });
      return { sessionId, termId, classId, studentId, eventId, issuedReportId };
    });
    expect(
      await f.t.run((ctx) =>
        resolveEffectiveReportCardTermSettings(ctx, {
          schoolId: f.schoolId,
          classId: timeline.classId,
          termId: timeline.termId,
        }),
      ),
    ).toMatchObject({ resultCalculationMode: "cumulative_annual", timesSchoolOpened: 180 });
    const issuedBefore = await f.t.run((ctx) => ctx.db.get(timeline.issuedReportId));
    const existingTermBefore = await f.t.run((ctx) => ctx.db.get(timeline.termId));
    for (const domain of ["report_card_template", "calendar_template"] as const) {
      const item = settingsFor(f).find((candidate) => candidate.domain === domain)!;
      await f.owner.mutation(endpoints.saveGroupDomainSetting, {
        groupId: f.groupId,
        expectedVersion: 1,
        allowBranchOverride: true,
        confirmation: "group",
        setting: item.group,
      });
    }
    expect(await f.t.run((ctx) => ctx.db.get(timeline.issuedReportId))).toEqual(issuedBefore);
    expect(await f.t.run((ctx) => ctx.db.get(timeline.termId))).toEqual(existingTermBefore);
    const portal = f.t.withIdentity({ tokenIdentifier: "test|student" });
    const portalData = await portal.query(api.functions.portal.getWorkspaceData, {
      studentId: timeline.studentId,
    });
    expect(portalData.notifications.some((item) => item.id === `event-${timeline.eventId}`)).toBe(false);
    expect(
      await f.t.run((ctx) =>
        ctx.db.query("membershipRoleAssignments").take(10),
      ),
    ).toEqual([]);
    const sessionId = await f.owner.mutation(
      api.functions.academic.academicSetup.createSession,
      {
        name: "New session",
        startDate: Date.UTC(2030, 0, 1),
        endDate: Date.UTC(2030, 5, 1),
        isActive: false,
        autoGenerateTerms: true,
      },
    );
    const generated = await f.t.run((ctx) =>
      ctx.db
        .query("academicTerms")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .take(10),
    );
    expect(generated).toMatchObject([{ name: "Group Term" }]);
    expect(generated[0].startDate).toBe(Date.UTC(2030, 0, 1));
  });

  it("rejects invalid or overlapping calendar templates before creating a version", async () => {
    const f = await fixture();
    await expect(
      f.owner.mutation(endpoints.saveGroupDomainSetting, {
        groupId: f.groupId,
        expectedVersion: 0,
        allowBranchOverride: true,
        confirmation: "group",
        setting: {
          domain: "calendar_template",
          value: {
            terms: [
              { name: "First", startOffsetDays: 0, endOffsetDays: 50, resultCalculationMode: "standalone" },
              { name: "Second", startOffsetDays: 40, endOffsetDays: 80, resultCalculationMode: "standalone" },
            ],
          },
        },
      }),
    ).rejects.toThrow("cannot overlap");
    expect(
      await f.owner.query(endpoints.getGroupDomainSetting, {
        groupId: f.groupId,
        domain: "calendar_template",
      }),
    ).toMatchObject({ version: 0, defaults: null });
  });
});
