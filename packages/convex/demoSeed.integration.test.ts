/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());
import { api, internal } from "./_generated/api";
import "./functions/auth";
import { DEMO_STUDENTS } from "./functions/academic/demoData";
import schema from "./schema";

// The cohort seed mutations accept existing auth IDs. Stub only the component
// lookup so the read-only inspector can verify their matching credential owners.
vi.mock("./betterAuth", async (importOriginal) => ({
  ...await importOriginal<typeof import("./betterAuth")>(),
  createAuth: () => ({ $context: Promise.resolve({ internalAdapter: {
    findUserByEmail: async (email: string) => {
      const index = ["admin@demo-academy.school", "teacher@demo-academy.school", "parent@demo-academy.school"].indexOf(email);
      if (index < 0) return null;
      const id = ["auth-admin-demo", "auth-teacher-demo", "auth-portal-demo"][index];
      return { user: { id }, accounts: [{ providerId: "credential", accountId: id }] };
    },
  } }) }),
}));

const modules = import.meta.glob("./**/*.ts");

type TestConvex = ReturnType<typeof convexTest>;

async function assets(t: TestConvex) {
  return await t.run(async (ctx) => ({
    logoStorageId: await ctx.storage.store(new Blob(["logo"], { type: "image/png" })),
    portraitStorageIds: await Promise.all(DEMO_STUDENTS.map(() => ctx.storage.store(new Blob(["portrait"], { type: "image/png" })))),
  }));
}

async function start(t: TestConvex, seedProfile: "demo" | "judge" = "demo") {
  const runId = await t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
    seedProfile, authIssuer: "https://seed-auth.test", adminAuthId: `auth-admin-${seedProfile}`, teacherAuthId: `auth-teacher-${seedProfile}`, portalAuthId: `auth-portal-${seedProfile}`, ...(await assets(t)),
  });
  await t.mutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
  return runId;
}

async function finish(t: TestConvex, runId: Awaited<ReturnType<typeof start>>) {
  for (let index = 0; index < 3; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
  for (let index = 0; index < 6; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
  for (let index = 0; index < 3; index += 1) await t.mutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
  return await t.mutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
}

describe("demo-school phased seed integration", () => {
  test("completed single-school cohort passes bounded read-only inspection", async () => {
    vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
    vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
    vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
    vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
    const t = convexTest(schema, modules);
    await finish(t, await start(t));
    const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
      operatorToken: "preflight-test-token", targetIdentity: "test-target",
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.tables.find((table) => table.name === "demoSeedRunsVerified")).toMatchObject({ count: 1, truncated: false });
    expect(result.tables.find((table) => table.name === "branchMembershipsVerified")).toMatchObject({ count: 3, truncated: false });
    expect(result.tables.find((table) => table.name === "usageBranchPoolAllocations")).toMatchObject({ count: 0, truncated: false });
    expect(result.tables.every((table) => !table.truncated)).toBe(true);
  });
  test("legacy demo reset refuses to touch a populated tenant or another school", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const demoSchoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
      const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
      const demoUserId = await ctx.db.insert("users", { schoolId: demoSchoolId, authId: "demo", name: "Demo", email: "demo@example.test", role: "admin", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("users", { schoolId: otherSchoolId, authId: "other", name: "Other", email: "other@example.test", role: "admin", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("families", { schoolId: demoSchoolId, name: "Demo family", createdAt: 1, updatedAt: 1, createdBy: demoUserId, updatedBy: demoUserId });
    });
    await expect(t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {})).rejects.toThrow("disabled");
    expect((await t.run((ctx) => ctx.db.query("schools").collect())).map((school) => school.slug)).toEqual(["demo-school", "other-school"]);
  });

  test("auth conflict inspection rejects an email attached to another tenant", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("users", { schoolId, authId: "external-auth", name: "External", email: "admin@demo-academy.school", role: "admin", createdAt: 1, updatedAt: 1 });
    });
    const inspection = await t.query(internal.functions.academic.seed.inspectDemoAuthUsageInternal, { authIds: ["external-auth"], emails: ["admin@demo-academy.school"] });
    expect(inspection.conflicts.join(" ")).toContain("other-school");
  });

  test("auth preflight catches orphan canonical credential emails", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const other = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
      const personId = await ctx.db.insert("persons", { email: "admin@demo-academy.school", name: "Shared", status: "active", primarySchoolId: other, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("branchMemberships", { personId, schoolId: other, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    });
    const result = await t.query(internal.functions.academic.seed.inspectDemoAuthUsageInternal, {
      authIds: [], emails: ["admin@demo-academy.school"], seedProfile: "demo",
    });
    expect(result.conflicts).toEqual([expect.stringContaining("canonical person")]);
  });

  test("storage cleanup consumes duplicate history sentinels and deduplicates retry acknowledgements", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["portrait"], { type: "image/png" })));
    await t.run(async (ctx) => {
      const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("demoSeedStorageCleanup", { schoolId, schoolSlug: "demo-school", storageId, createdAt: 1 });
      return await ctx.db.insert("demoSeedStorageCleanup", { schoolId, schoolSlug: "demo-school", storageId, createdAt: 2 });
    });
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([storageId]);
    // A failed storage delete leaves the ID available to the next retry.
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([storageId]);
    await t.mutation(internal.functions.academic.seed.acknowledgeDemoStorageCleanupInternal, { storageIds: [storageId, storageId] });
    expect(await t.query(internal.functions.academic.seed.getPendingDemoStorageCleanupInternal, {})).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("demoSeedStorageCleanup").collect())).toEqual([]);
  });

  test("persists cursors but refuses to reset an incomplete run", async () => {
    const t = convexTest(schema, modules);
    const runId = await start(t);
    const firstBatch = await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
    expect(firstBatch).toMatchObject({ phase: "students", cursor: 12 });
    const persisted = await t.run((ctx) => ctx.db.get(runId));
    expect(persisted?.studentCursor).toBe(12);
    await expect(t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, {})).rejects.toThrow("disabled");
    expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ studentCursor: 12 });
  });

  test("rejects an invalid authentication issuer before starting a run", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
      seedProfile: "demo", authIssuer: "admin@demo-academy.school", adminAuthId: "admin", teacherAuthId: "teacher", portalAuthId: "parent", ...(await assets(t)),
    })).rejects.toThrow("valid CONVEX_SITE_URL issuer");
    expect(await t.run((ctx) => ctx.db.query("schools").take(1))).toEqual([]);
  });

  test("credential accounts resolve through canonical active memberships, not email or subject", async () => {
    const t = convexTest(schema, modules);
    const runId = await start(t);
    const run = await t.run((ctx) => ctx.db.get(runId));
    if (!run) throw new Error("Missing seed run");
    for (const [role, authId] of [["admin", run.adminAuthId], ["teacher", run.teacherAuthId], ["parent", run.portalAuthId]] as const) {
      const tokenIdentifier = `${run.authIssuer}|${authId}`;
      const access = await t.withIdentity({ issuer: run.authIssuer, subject: authId, tokenIdentifier }).query(api.functions.auth.getViewerAccess, {});
      expect(access).toMatchObject({
        state: "ready",
        branch: { schoolId: run.schoolId },
        membership: { personId: expect.any(String) },
        compatibility: { mode: "canonical", legacyRole: role },
      });
      const links = await t.run(async (ctx) => {
        const person = await ctx.db.query("persons").withIndex("by_token_identifier", (q) => q.eq("authTokenIdentifier", tokenIdentifier)).unique();
        const membership = person && await ctx.db.query("branchMemberships").withIndex("by_person_and_school", (q) => q.eq("personId", person._id).eq("schoolId", run.schoolId)).unique();
        const user = membership?.legacyUserId && await ctx.db.get(membership.legacyUserId);
        return { person, membership, user };
      });
      expect(links.person).toMatchObject({ status: "active" });
      expect(links.membership).toMatchObject({ status: "active", isDefaultBranch: true, personId: links.person?._id });
      expect(links.user).toMatchObject({ role, personId: links.person?._id, authTokenIdentifier: tokenIdentifier });
      if (access.state !== "ready") throw new Error("Expected ready access");
      expect(access.membership?.membershipId).toBe(links.membership?._id);
    }
    for (const [issuer, tokenIdentifier] of [[run.authIssuer, `${run.authIssuer}|wrong-token`], ["https://other-auth.test", `https://other-auth.test|${run.adminAuthId}`]] as const) {
      expect(await t.withIdentity({ issuer, subject: run.adminAuthId, tokenIdentifier, email: "admin@demo-academy.school" }).query(api.functions.auth.getViewerAccess, {}))
        .not.toMatchObject({ state: "ready" });
    }
  });

  test("phases create correct family, billing, and portal relationships", async () => {
    const t = convexTest(schema, modules); const seeded = await finish(t, await start(t));
    const counts = await t.run(async (ctx) => ({
      families: await ctx.db.query("families").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      members: await ctx.db.query("familyMembers").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      applications: await ctx.db.query("feePlanApplications").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      portalMaterials: await ctx.db.query("knowledgeMaterials").withIndex("by_school_and_visibility", (q) => q.eq("schoolId", seeded.schoolId).eq("visibility", "student_approved")).collect(),
      topics: await ctx.db.query("knowledgeTopics").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      bindings: await ctx.db.query("knowledgeMaterialClassBindings").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      classes: await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).collect(),
      run: await ctx.db.query("demoSeedRuns").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).unique(),
    }));
    expect(counts.families).toHaveLength(18); expect(counts.members).toHaveLength(18);
    expect(counts.applications.map((row) => row.createdInvoiceCount)).toEqual([12, 12, 12]);
    expect(counts.portalMaterials).toHaveLength(6); expect(counts.topics).toHaveLength(6);
    expect(counts.bindings).toHaveLength(12);
    expect(new Set(counts.bindings.map((binding) => binding.classId))).toEqual(new Set(counts.classes.slice(0, 2).map((classDoc) => classDoc._id)));
    expect(counts.run).toMatchObject({ status: "succeeded", phase: "complete" });
  });

  test("judge can seed again after bounded reset without leaving canonical accounts", async () => {
    const t = convexTest(schema, modules);
    for (let run = 0; run < 2; run += 1) {
      const seeded = await finish(t, await start(t, "judge"));
      const accounts = await t.run(async (ctx) => ({
        users: await ctx.db.query("users").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(80),
        persons: await ctx.db.query("persons").take(4),
        memberships: await ctx.db.query("branchMemberships").take(4),
      }));
      expect(accounts.users).toHaveLength(58);
      for (const [authId, role] of [["auth-admin-judge", "admin"], ["auth-teacher-judge", "teacher"], ["auth-portal-judge", "parent"]] as const) {
        const matches = accounts.users.filter((user) => user.authId === authId);
        expect(matches).toHaveLength(1);
        expect(matches[0]).toMatchObject({ role });
        expect(matches[0]).not.toHaveProperty("personId");
        expect(matches[0]).not.toHaveProperty("authTokenIdentifier");
      }
      expect(accounts.persons).toEqual([]);
      expect(accounts.memberships).toEqual([]);
      if (run === 0) {
        let complete = false;
        for (let attempt = 0; attempt < 120; attempt += 1) {
          const batch = await t.mutation(internal.functions.academic.seed.clearDemoSchoolBatchInternal, { seedProfile: "judge" });
          if (batch.complete) { complete = true; break; }
        }
        expect(complete).toBe(true);
        expect(await t.run((ctx) => ctx.db.query("schools").take(2))).toEqual([]);
      }
    }
  });

  test("judge profile creates a full school plus the curriculum demo journey", async () => {
    const t = convexTest(schema, modules);
    const seeded = await finish(t, await start(t, "judge"));
    const fixture = await t.run(async (ctx) => {
      const school = await ctx.db.get(seeded.schoolId);
      return {
        school,
        students: await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(50),
        classes: await ctx.db.query("classes").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(10),
        subjects: await ctx.db.query("subjects").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(10),
        materials: await ctx.db.query("knowledgeMaterials").withIndex("by_school_and_source_type", (q) => q.eq("schoolId", seeded.schoolId).eq("sourceType", "imported_curriculum")).take(5),
        imports: await ctx.db.query("curriculumImports").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(5),
        units: await ctx.db.query("curriculumUnits").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(5),
        artifacts: await ctx.db.query("instructionArtifacts").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(20),
        artifactSources: await ctx.db.query("instructionArtifactSources").withIndex("by_school", (q) => q.eq("schoolId", seeded.schoolId)).take(20),
      };
    });
    expect(seeded).toMatchObject({ studentCount: 36, classCount: 3, invoiceCount: 36, assessmentRecordCount: 756 });
    expect(fixture.school).toMatchObject({ name: "Codex Academy", slug: "codex-academy" });
    expect(fixture.students).toHaveLength(36);
    expect(fixture.classes).toHaveLength(3);
    expect(fixture.subjects).toHaveLength(7);
    expect(fixture.materials[0]).toMatchObject({ title: "JSS 1 Social Studies — Second Term Scheme of Work", chunkCount: 5, processingStatus: "ready", searchStatus: "indexed" });
    expect(fixture.imports[0]).toMatchObject({ status: "approved", approvedUnitCount: 1 });
    expect(fixture.units[0]).toMatchObject({ reviewStatus: "approved", title: "Revision of Last Term's Work" });
    const lesson = fixture.artifacts.find((artifact) => String(artifact.topicId) === String(fixture.units[0].knowledgeTopicId));
    expect(lesson).toMatchObject({ outputType: "lesson_plan", reviewStatus: "approved" });
    expect(fixture.artifactSources).toContainEqual(expect.objectContaining({ artifactId: lesson?._id, materialId: fixture.materials[0]._id }));
  });
});
