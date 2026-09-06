import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { resolveEffectiveTheme } from "../groupSettings";

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
const endpoints = api.functions.academic.groups;
const theme = { primaryColor: "#123456", accentColor: "#abcdef" };

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Headquarters",
      slug: "hq",
      status: "active",
      theme: { primaryColor: "#112233", accentColor: "#445566" },
      createdAt: 1,
      updatedAt: 1,
    });
    const branchId = await ctx.db.insert("schools", {
      name: "Other branch",
      slug: "other",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const outsiderSchoolId = await ctx.db.insert("schools", {
      name: "Unrelated",
      slug: "unrelated",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const ownerId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|owner",
      email: "owner@example.test",
      name: "Owner",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const memberId = await ctx.db.insert("persons", {
      authTokenIdentifier: "test|member",
      email: "member@example.test",
      name: "Manager",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Group",
      slug: "group",
      proprietorPersonId: ownerId,
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
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: branchId,
      isHeadquarters: false,
      linkedAt: 1,
    });
    const ownerMembership = await ctx.db.insert("branchMemberships", {
      personId: ownerId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: 1,
      updatedAt: 1,
    });
    const ownerUser = await ctx.db.insert("users", {
      schoolId,
      personId: ownerId,
      authId: "owner",
      authTokenIdentifier: "test|owner",
      name: "Owner",
      email: "owner@example.test",
      role: "admin",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.patch(ownerMembership, { legacyUserId: ownerUser });
    const memberMembership = await ctx.db.insert("branchMemberships", {
      personId: memberId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: 1,
      updatedAt: 1,
    });
    const grantId = await ctx.db.insert("membershipDirectGrants", {
      membershipId: memberMembership,
      capability: "settings.branding.manage",
      grantedAt: 1,
    });
    await ctx.db.insert("platformAdmins", {
      authId: "platform",
      authTokenIdentifier: "test|platform",
      email: "platform@example.test",
      name: "Platform",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    return {
      schoolId,
      branchId,
      outsiderSchoolId,
      groupId,
      ownerId,
      ownerMembership,
      ownerUser,
      memberMembership,
      grantId,
    };
  });
  return {
    t,
    ...ids,
    owner: t.withIdentity({ tokenIdentifier: "test|owner" }),
    member: t.withIdentity({ tokenIdentifier: "test|member" }),
    platform: t.withIdentity({ tokenIdentifier: "test|platform" }),
  };
}

async function seedOverviewData(f: Awaited<ReturnType<typeof fixture>>) {
  return f.t.run(async (ctx) => {
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId: f.schoolId,
      name: "2026/2027",
      startDate: 100,
      endDate: 900,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId: f.schoolId,
      sessionId,
      name: "First term",
      startDate: 200,
      endDate: 800,
      isActive: true,
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
    const studentUserId = await ctx.db.insert("users", {
      schoolId: f.schoolId,
      authId: "student",
      name: "Student",
      email: "student@example.test",
      role: "student",
      createdAt: 1,
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
    await ctx.db.insert("students", {
      schoolId: f.schoolId,
      classId,
      userId: studentUserId,
      admissionNumber: "HQ-DUPLICATE",
      enrollmentStatus: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const archivedUserId = await ctx.db.insert("users", {
      schoolId: f.schoolId,
      authId: "archived-student",
      name: "Archived Student",
      email: "archived@example.test",
      role: "student",
      isArchived: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("students", {
      schoolId: f.schoolId,
      classId,
      userId: archivedUserId,
      admissionNumber: "HQ-OLD",
      enrollmentStatus: "withdrawn",
      isArchived: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("reportCardAttendanceClassValues", {
      schoolId: f.schoolId,
      classId,
      sessionId,
      termId,
      timesSchoolOpened: 100,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: f.ownerUser,
    });
    await ctx.db.insert("reportCardAttendanceStudentValues", {
      schoolId: f.schoolId,
      classId,
      studentId,
      sessionId,
      termId,
      timesPresent: 80,
      createdAt: 1,
      updatedAt: 1,
      updatedBy: f.ownerUser,
    });
    const feePlanId = await ctx.db.insert("feePlans", {
      schoolId: f.schoolId,
      name: "Tuition",
      currency: "NGN",
      lineItems: [],
      installmentPolicy: {
        enabled: false,
        installmentCount: 1,
        intervalDays: 0,
        firstDueDays: 0,
      },
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
      createdBy: f.ownerUser,
      updatedBy: f.ownerUser,
    });
    const invoiceId = await ctx.db.insert("studentInvoices", {
      schoolId: f.schoolId,
      feePlanId,
      studentId,
      classId,
      sessionId,
      termId,
      invoiceNumber: "INV-1",
      feePlanNameSnapshot: "Tuition",
      currency: "NGN",
      lineItems: [],
      installmentSchedule: [],
      subtotal: 10000,
      waiverAmount: 1000,
      discountAmount: 0,
      totalAmount: 9000,
      amountPaid: 4000,
      balanceDue: 5000,
      status: "partially_paid",
      dueDate: 700,
      issuedAt: 400,
      issuedBy: f.ownerUser,
      createdAt: 400,
      updatedAt: 500,
    });
    await ctx.db.insert("billingPayments", {
      schoolId: f.schoolId,
      invoiceId,
      reference: "PAY-1",
      paymentMethod: "bank_transfer",
      amountReceived: 4000,
      amountApplied: 4000,
      unappliedAmount: 0,
      applicationStatus: "applied",
      status: "successful",
      receivedAt: 500,
      recordedBy: f.ownerUser,
      reconciliationStatus: "unreconciled",
      reconciledBy: null,
      createdAt: 500,
      updatedAt: 500,
    });
    await ctx.db.insert("issuedReportCards", {
      schoolId: f.schoolId,
      studentId,
      sessionId,
      termId,
      classId,
      issuedAt: 600,
      issuedBy: f.ownerUser,
      report: {
        schoolName: "Headquarters",
        schoolLogoUrl: null,
        sessionName: "2026/2027",
        termName: "First term",
        classId,
        className: "JSS 1",
        generatedAt: 600,
        assessmentConfig: { ca1Max: 10, ca2Max: 10, ca3Max: 10, examMax: 70 },
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
        summary: {
          totalSubjects: 1,
          recordedSubjects: 1,
          pendingSubjects: 0,
          averageScore: 75,
          totalScore: 75,
        },
        results: [],
        extras: [],
        classTeacherName: null,
        classTeacherComment: null,
        headTeacherComment: null,
      },
    });
    return { studentId };
  });
}

describe("U1f versioned branding defaults", () => {
  it("previews without writes, preserves legacy colors, explicitly inherits/overrides/resets and audits without school rewrites", async () => {
    const f = await fixture();
    const original = await f.t.run((ctx) => ctx.db.get(f.schoolId));
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: true,
    };
    expect(
      await f.owner.query(endpoints.previewGroupBranding, args),
    ).toMatchObject({ candidate: { version: 1, theme } });
    expect(
      (await f.owner.query(endpoints.getGroupBranding, { groupId: f.groupId }))
        .version,
    ).toBe(0);
    await f.owner.mutation(endpoints.saveGroupBranding, {
      ...args,
      confirmation: "group",
    });
    const branch = { groupId: f.groupId, schoolId: f.schoolId };
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "branch_legacy", groupVersion: 1, revision: 0 });
    const change = {
      ...branch,
      expectedVersion: 1,
      expectedRevision: 0,
      confirmation: "hq",
      change: { mode: "inherit" as const },
    };
    await f.member.mutation(endpoints.saveBranchBranding, change);
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "group", theme, revision: 1 });
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...change,
      expectedRevision: 1,
      change: {
        mode: "override",
        theme: { primaryColor: "#ffffff", accentColor: "#000000" },
      },
    });
    expect(
      await f.member.query(endpoints.getBranchBranding, branch),
    ).toMatchObject({ source: "branch_override", revision: 2 });
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...change,
      expectedRevision: 2,
    });
    const effective = await f.t.run(async (ctx) => {
      const school = await ctx.db.get(f.schoolId);
      if (!school) throw new Error("Missing fixture");
      return resolveEffectiveTheme(ctx, school);
    });
    expect(effective).toMatchObject({ source: "group", theme, revision: 3 });
    expect(
      await f.owner.query(
        api.functions.academic.schoolBranding.getCurrentSchoolBranding,
        {},
      ),
    ).toMatchObject({ schoolId: f.schoolId, theme });
    await expect(
      f.owner.mutation(
        api.functions.academic.schoolBranding.updateSchoolProfile,
        { name: "Headquarters", theme },
      ),
    ).rejects.toThrow("School group branding");
    expect(await f.t.run((ctx) => ctx.db.get(f.schoolId))).toEqual(original);
    const events = await f.t.run((ctx) =>
      ctx.db
        .query("auditEvents")
        .withIndex("by_school_and_timestamp", (q) =>
          q.eq("schoolId", f.schoolId),
        )
        .take(10),
    );
    expect(events).toHaveLength(4);
    expect(
      events.every((event) => event.retentionClass === "permanent_statutory"),
    ).toBe(true);
  });

  it("rejects outsiders/platform defaults and group linkage as branch authority, rechecks capability/revocation", async () => {
    const f = await fixture();
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: true,
      confirmation: "group",
    };
    await expect(
      f.member.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.platform.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.t.query(endpoints.getGroupBranding, { groupId: f.groupId }),
    ).rejects.toThrow("authentication");
    await f.owner.mutation(endpoints.saveGroupBranding, args);
    const metadata = await f.platform.query(endpoints.getGroupOverview, {
      groupId: f.groupId,
    });
    expect(metadata.group).not.toHaveProperty("brandingDefault");
    expect(metadata.branches[0]).not.toHaveProperty("brandingOverride");
    await expect(
      f.owner.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.branchId,
      }),
    ).rejects.toThrow("active membership");
    await expect(
      f.platform.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow("required capability");
    await f.t.run((ctx) => ctx.db.delete(f.grantId));
    await expect(
      f.member.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow("capability");
    await f.t.run((ctx) =>
      ctx.db.patch(f.ownerMembership, { status: "archived" }),
    );
    await expect(
      f.owner.query(endpoints.getBranchBranding, {
        groupId: f.groupId,
        schoolId: f.schoolId,
      }),
    ).rejects.toThrow();
  });

  it("blocks malformed colors, wrong confirmation, stale group/branch revisions and forbidden overrides", async () => {
    const f = await fixture();
    const args = {
      groupId: f.groupId,
      expectedVersion: 0,
      theme,
      allowBranchOverride: false,
      confirmation: "group",
    };
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, {
        ...args,
        theme: { ...theme, accentColor: "red" },
      }),
    ).rejects.toThrow("hex");
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, {
        ...args,
        confirmation: "wrong",
      }),
    ).rejects.toThrow("slug");
    await f.owner.mutation(endpoints.saveGroupBranding, args);
    await expect(
      f.owner.mutation(endpoints.saveGroupBranding, args),
    ).rejects.toThrow("Conflict");
    const branch = {
      groupId: f.groupId,
      schoolId: f.schoolId,
      expectedVersion: 1,
      expectedRevision: 0,
      confirmation: "hq",
      change: { mode: "override" as const, theme },
    };
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, branch),
    ).rejects.toThrow("disabled");
    await f.member.mutation(endpoints.saveBranchBranding, {
      ...branch,
      change: { mode: "inherit" },
    });
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, {
        ...branch,
        change: { mode: "inherit" },
      }),
    ).rejects.toThrow("Conflict");
    await f.owner.mutation(endpoints.saveGroupBranding, {
      ...args,
      expectedVersion: 1,
      allowBranchOverride: true,
    });
    await expect(
      f.member.mutation(endpoints.saveBranchBranding, {
        ...branch,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("Conflict");
  });
});

describe("U1g bounded operational aggregates", () => {
  it("returns genuine enrollment, attendance, finance, staffing and published-academic summaries without raw records", async () => {
    const f = await fixture();
    await seedOverviewData(f);
    const args = {
      groupId: f.groupId,
      branchId: f.schoolId,
      startDate: 0,
      endDate: 1000,
    };
    const overview = await f.owner.query(
      endpoints.getOperationalOverview,
      args,
    );
    const branch = overview.branches[0];
    expect(overview.limits).toEqual({
      sourceRowsPerTable: 500,
      termsPerBranch: 100,
      branchesPerAggregate: 3,
    });
    expect(branch).toMatchObject({
      access: "scoped",
      drilldown: { auditPath: "/admin/audit" },
    });
    expect(
      branch.metrics.find((item) => item.key === "enrollment"),
    ).toMatchObject({ state: "available", value: 1 });
    expect(
      branch.metrics.find((item) => item.key === "attendance"),
    ).toMatchObject({ state: "available", value: 80 });
    expect(
      branch.metrics.find((item) => item.key === "staffing"),
    ).toMatchObject({ state: "available", value: 1 });
    expect(
      branch.metrics.find((item) => item.key === "academics"),
    ).toMatchObject({ state: "available", value: 75 });
    expect(branch.metrics.find((item) => item.key === "finance")).toMatchObject(
      {
        state: "available",
        value: null,
        details: expect.arrayContaining([
          { label: "NGN assessed", value: 9000, unit: "minor units" },
          { label: "NGN collected", value: 4000, unit: "minor units" },
        ]),
      },
    );
    expect(
      overview.totals.find((item) => item.key === "enrollment")?.value,
    ).toBe(1);
    expect(JSON.stringify(overview)).not.toMatch(
      /owner@example|student@example|HQ-001|invoiceNumber|payer/,
    );
    const outside = await f.owner.query(endpoints.getOperationalOverview, {
      ...args,
      startDate: 1000,
      endDate: 2000,
    });
    expect(
      outside.branches[0].metrics.find((item) => item.key === "attendance")
        ?.state,
    ).toBe("empty");
    expect(
      outside.branches[0].metrics.find((item) => item.key === "finance")?.state,
    ).toBe("empty");
    expect(
      outside.branches[0].metrics.find((item) => item.key === "academics")
        ?.state,
    ).toBe("empty");
  });

  it("distinguishes denied, inactive and module-disabled branches without partial group totals", async () => {
    const f = await fixture();
    const args = { groupId: f.groupId, startDate: 0, endDate: 86400000 };
    const overview = await f.owner.query(
      endpoints.getOperationalOverview,
      args,
    );
    expect(overview.totals).toHaveLength(5);
    expect(overview.totals.every((item) => item.state === "unavailable")).toBe(
      true,
    );
    expect(
      overview.branches.find((branch) => branch.schoolId === f.branchId),
    ).toMatchObject({ access: "denied", metrics: [], drilldown: null });
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.branchId, { status: "suspended" });
      await ctx.db.patch(f.schoolId, {
        features: {
          billing: false,
          curriculum: true,
          admissions: true,
          knowledgeLibrary: true,
        },
      });
    });
    const next = await f.owner.query(endpoints.getOperationalOverview, args);
    expect(
      next.branches.find((branch) => branch.schoolId === f.branchId)?.access,
    ).toBe("inactive");
    expect(
      next.branches
        .find((branch) => branch.schoolId === f.schoolId)
        ?.metrics.find((item) => item.key === "finance")?.state,
    ).toBe("module_disabled");
  });

  it("withholds a source that exceeds its reviewed bound instead of returning a prefix count", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let index = 0; index < 500; index += 1) {
        await ctx.db.insert("users", {
          schoolId: f.schoolId,
          authId: `staff-${index}`,
          name: `Staff ${index}`,
          email: `staff-${index}@example.test`,
          role: "teacher",
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });
    const overview = await f.owner.query(endpoints.getOperationalOverview, {
      groupId: f.groupId,
      branchId: f.schoolId,
      startDate: 0,
      endDate: 1000,
    });
    expect(
      overview.branches[0].metrics.find((item) => item.key === "staffing"),
    ).toMatchObject({
      state: "unavailable",
      value: null,
      reason: expect.stringContaining("500-row"),
    });
    expect(overview.totals.find((item) => item.key === "staffing")?.state).toBe(
      "unavailable",
    );
  });

  it("rejects Platform/ordinary membership, unrelated branch injection and invalid periods; filters exact linked branch", async () => {
    const f = await fixture();
    const args = { groupId: f.groupId, startDate: 0, endDate: 86400000 };
    await expect(
      f.platform.query(endpoints.getOperationalOverview, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.member.query(endpoints.getOperationalOverview, args),
    ).rejects.toThrow("proprietor");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, {
        ...args,
        branchId: f.outsiderSchoolId,
      }),
    ).rejects.toThrow("not in this group");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, { ...args, endDate: 0 }),
    ).rejects.toThrow("valid UTC period");
    await expect(
      f.owner.query(endpoints.getOperationalOverview, {
        ...args,
        endDate: 367 * 86400000,
      }),
    ).rejects.toThrow("366 days");
    const filtered = await f.owner.query(endpoints.getOperationalOverview, {
      ...args,
      branchId: f.schoolId,
    });
    expect(filtered.branches).toHaveLength(1);
    expect(filtered.period).toEqual({
      startDate: 0,
      endDate: 86400000,
      timezone: "UTC",
      endExclusive: true,
    });
    await f.t.run((ctx) =>
      ctx.db.patch(f.ownerMembership, { status: "archived" }),
    );
    expect(
      (
        await f.owner.query(endpoints.getOperationalOverview, {
          ...args,
          branchId: f.schoolId,
        })
      ).branches[0],
    ).toMatchObject({ access: "denied", metrics: [] });
  });
});
