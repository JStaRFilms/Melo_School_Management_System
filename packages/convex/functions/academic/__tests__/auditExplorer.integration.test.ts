import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import type { FunctionReturnType } from "convex/server";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { recordAuditEventHelper, sanitizeAuditSummary } from "../audit";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(
    import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]),
  ).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const audit = api.functions.academic.audit;

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", {
      name: "Audit school",
      slug: "audit-school",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const otherSchoolId = await ctx.db.insert("schools", {
      name: "Other school",
      slug: "other",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerId = await ctx.db.insert("persons", {
      name: "Owner",
      email: "owner@example.test",
      authTokenIdentifier: "https://auth.melo.test|owner",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const readerId = await ctx.db.insert("persons", {
      name: "Academic auditor",
      email: "reader@example.test",
      authTokenIdentifier: "https://auth.melo.test|reader",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const ownerMembershipId = await ctx.db.insert("branchMemberships", {
      personId: ownerId,
      schoolId,
      status: "active",
      isDefaultBranch: true,
      joinedAt: now,
      updatedAt: now,
    });
    const readerMembershipId = await ctx.db.insert("branchMemberships", {
      personId: readerId,
      schoolId,
      status: "active",
      auditModules: ["academic"],
      isDefaultBranch: true,
      joinedAt: now,
      updatedAt: now,
    });
    for (const capability of [
      "audit.branch.view",
      "audit.export.csv",
      "audit.export.pdf",
    ])
      await ctx.db.insert("membershipDirectGrants", {
        membershipId: readerMembershipId,
        capability,
        grantedAt: now,
      });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Audit group",
      slug: "audit-group",
      proprietorPersonId: ownerId,
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
    await ctx.db.insert("platformAdmins", {
      authId: "operator",
      authTokenIdentifier: "https://auth.melo.test|operator",
      name: "Platform",
      email: "operator@example.test",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return {
      schoolId,
      otherSchoolId,
      ownerId,
      ownerMembershipId,
      readerId,
      readerMembershipId,
      groupId,
    };
  });
  return {
    t,
    ...ids,
    reader: t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|reader",
    }),
    owner: t.withIdentity({ tokenIdentifier: "https://auth.melo.test|owner" }),
    operator: t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|operator",
    }),
  };
}

it("paginates past recent nonmatches, enforces branch/module boundaries and keeps export projections identical", async () => {
  const f = await setup();
  await f.t.run(async (ctx) => {
    // Older matching row deliberately omits groupId, as existing producers may.
    await recordAuditEventHelper(ctx, {
      schoolId: f.schoolId,
      actorKind: "user",
      actorPersonId: f.readerId,
      actorEmailSnapshot: "private-reader@example.test",
      module: "academic",
      action: "historic_result",
      targetType: "result",
      targetId: "result_1",
      outcome: "success",
      safeSummary: "Needle account 0123456789 password=secret",
      beforeSummary: "token=secret",
      afterSummary: "Updated",
    });
    for (let n = 0; n < 155; n++)
      await recordAuditEventHelper(ctx, {
        schoolId: f.schoolId,
        actorKind: "user",
        actorEmailSnapshot: "private@example.test",
        module: "finance",
        action: "recent_noise",
        targetType: "invoice",
        targetId: `invoice_${n}`,
        outcome: "success",
        safeSummary: "Private finance event",
      });
    await recordAuditEventHelper(ctx, {
      schoolId: f.otherSchoolId,
      actorKind: "user",
      actorEmailSnapshot: "private@example.test",
      module: "academic",
      action: "foreign",
      targetType: "result",
      targetId: "foreign",
      outcome: "success",
      safeSummary: "Needle foreign school",
    });
  });
  const args = {
    scope: { kind: "branch" as const, schoolId: f.schoolId },
    search: "Needle",
    module: "academic",
  };
  let cursor: string | null = null;
  let scanned = 0;
  const rows = [];
  do {
    const page: FunctionReturnType<typeof audit.queryAuditPage> =
      await f.reader.query(audit.queryAuditPage, {
        ...args,
        paginationOpts: { numItems: 50, cursor },
      });
    const exported = await f.reader.query(audit.queryAuditPage, {
      ...args,
      exportFormat: "csv",
      paginationOpts: { numItems: 50, cursor },
    });
    expect(exported.page).toEqual(page.page);
    rows.push(...page.page);
    scanned++;
    if (page.isDone) break;
    cursor = page.continueCursor;
  } while (scanned < 10);
  expect(scanned).toBeGreaterThan(3);
  expect(rows).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain("0123456789");
  expect(JSON.stringify(rows)).not.toContain("private-reader@example.test");
  expect(JSON.stringify(rows)).not.toContain("password=secret");
  await expect(
    f.reader.query(audit.queryAuditPage, {
      ...args,
      module: "finance",
      paginationOpts: { numItems: 50, cursor: null },
    }),
  ).rejects.toThrow("Module outside");
  await expect(
    f.reader.query(audit.queryAuditPage, {
      ...args,
      branchId: f.otherSchoolId,
      paginationOpts: { numItems: 50, cursor: null },
    }),
  ).rejects.toThrow("Branch outside");
  await expect(
    f.reader.query(audit.queryAuditPage, {
      scope: { kind: "branch", schoolId: f.otherSchoolId },
      paginationOpts: { numItems: 50, cursor: null },
    }),
  ).rejects.toThrow("active membership");
  const ownerPage = await f.owner.query(audit.queryAuditPage, {
    scope: { kind: "group", groupId: f.groupId },
    paginationOpts: { numItems: 100, cursor: null },
  });
  expect(ownerPage.page.every((row) => row.schoolId === f.schoolId)).toBe(true);
  await expect(
    f.reader.query(audit.queryAuditPage, {
      scope: { kind: "group", groupId: f.groupId },
      paginationOpts: { numItems: 100, cursor: null },
    }),
  ).rejects.toThrow("Forbidden");
});

it("restricts Platform views, scopes alert recipients and records safe export outcomes", async () => {
  const f = await setup();
  const alertId = await f.t.run(async (ctx) => {
    await recordAuditEventHelper(ctx, {
      schoolId: f.schoolId,
      actorKind: "user",
      actorEmailSnapshot: "owner@example.test",
      module: "academic",
      action: "sensitive_change",
      targetType: "result",
      targetId: "result",
      outcome: "success",
      safeSummary: "Changed academic authority",
      alertTier: "tier1_critical",
    });
    await recordAuditEventHelper(ctx, {
      schoolId: f.schoolId,
      actorKind: "platform_admin",
      actorEmailSnapshot: "operator@example.test",
      module: "groups",
      action: "group_review",
      targetType: "group",
      targetId: f.groupId,
      outcome: "success",
      safeSummary: "Reviewed group metadata",
    });
    return (await ctx.db.query("auditAlerts").first())!._id;
  });
  expect(
    await f.reader.query(audit.listAuditAlerts, { schoolId: f.schoolId }),
  ).toEqual([]);
  await expect(
    f.reader.mutation(audit.dismissAuditAlert, {
      schoolId: f.schoolId,
      alertDocId: alertId,
    }),
  ).rejects.toThrow("not addressed");
  expect(
    await f.owner.query(audit.listAuditAlerts, { schoolId: f.schoolId }),
  ).toHaveLength(1);
  await f.owner.mutation(audit.dismissAuditAlert, {
    schoolId: f.schoolId,
    alertDocId: alertId,
  });
  expect(
    await f.owner.query(audit.listAuditAlerts, { schoolId: f.schoolId }),
  ).toEqual([]);
  const platform = await f.operator.query(audit.queryAuditPage, {
    scope: { kind: "platform" },
    paginationOpts: { numItems: 100, cursor: null },
  });
  expect(platform.page).toHaveLength(1);
  expect(platform.page[0].action).toBe("group_review");
  expect(
    await f.reader.mutation(audit.recordAuditExport, {
      scope: { kind: "branch", schoolId: f.schoolId },
      format: "csv",
      stage: "attempt",
      correlationId: "export_test_1",
    }),
  ).toEqual({ permitted: true });
  await f.t.run(async (ctx) => {
    const grants = await ctx.db
      .query("membershipDirectGrants")
      .withIndex("by_membership", (q) =>
        q.eq("membershipId", f.readerMembershipId),
      )
      .collect();
    for (const g of grants)
      if (g.capability === "audit.export.csv") await ctx.db.delete(g._id);
  });
  expect(
    await f.reader.mutation(audit.recordAuditExport, {
      scope: { kind: "branch", schoolId: f.schoolId },
      format: "csv",
      stage: "attempt",
      correlationId: "export_test_2",
    }),
  ).toEqual({ permitted: false });
  await expect(
    f.reader.query(audit.queryAuditPage, {
      scope: { kind: "branch", schoolId: f.schoolId },
      exportFormat: "csv",
      paginationOpts: { numItems: 100, cursor: null },
    }),
  ).rejects.toThrow("export capability");
});

it("proprietor scope changes are explicit, optimistic and do not grant audit capabilities", async () => {
  const f = await setup();
  const config = await f.owner.query(audit.getAuditScopeConfiguration, {
    schoolId: f.schoolId,
  });
  const member = config.find((m) => m.membershipId === f.readerMembershipId)!;
  const args = {
    schoolId: f.schoolId,
    targetMembershipId: f.readerMembershipId,
    modules: [],
    expectedRevision: member.revision,
    reason: "Revoke delegated department visibility",
  };
  await expect(
    f.reader.mutation(audit.setAuditModuleScope, args),
  ).rejects.toThrow("proprietor");
  await f.owner.mutation(audit.setAuditModuleScope, args);
  await expect(
    f.owner.mutation(audit.setAuditModuleScope, args),
  ).rejects.toThrow("CONFLICT");
  expect(
    await f.reader.query(audit.getAuditAccess, {
      scope: { kind: "branch", schoolId: f.schoolId },
    }),
  ).toMatchObject({ scopeConfigured: false, modules: [] });
  expect(sanitizeAuditSummary('password="two word secret"')).not.toContain(
    "word secret",
  );
  expect(sanitizeAuditSummary("medical=private note")).toBe(
    "[REDACTED_SENSITIVE_SUMMARY]",
  );
});
