/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("./betterAuth", async (importOriginal) => ({
  ...await importOriginal<typeof import("./betterAuth")>(),
  createAuth: () => ({ $context: Promise.resolve({ internalAdapter: { findUserByEmail: lookup } }) }),
}));

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); lookup.mockReset(); });

test("an empty deployment passes inspection with server URL and no school", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  await expect(t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "wrong", targetIdentity: "test-target",
  })).rejects.toThrow("Development demo preflight operator gate failed");
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(result).toEqual({ cloudUrl: "https://test.convex.cloud", e2eOriginsTrusted: false, school: null, tables: [], blockers: [], ready: true });
});

test("preflight reports all three server auth origins without modifying them", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  const inspect = () => t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  for (const port of [3101, 3102, 3103]) {
    vi.stubEnv("TRUSTED_ORIGINS", [3101, 3102, 3103].filter((p) => p !== port).map((p) => `http://localhost:${p}`).join(","));
    expect((await inspect()).e2eOriginsTrusted).toBe(false);
  }
  const configured = "http://localhost:3101, http://localhost:3102,http://localhost:3103";
  vi.stubEnv("TRUSTED_ORIGINS", configured);
  expect((await inspect()).e2eOriginsTrusted).toBe(true);
  expect(process.env.TRUSTED_ORIGINS).toBe(configured);
});

test.each(["schoolGroups", "platformAdmins"] as const)("orphaned %s blocks preflight and seed before auth access", async (tableName) => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://seed-auth.test");
  const t = convexTest(schema, modules);
  const inspectedEmpty = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(inspectedEmpty.ready).toBe(true);
  await t.run(async (ctx) => {
    if (tableName === "schoolGroups") {
      const personId = await ctx.db.insert("persons", { name: "Orphan", email: "orphan@example.test", status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("schoolGroups", { name: "Orphan group", slug: "orphan", proprietorPersonId: personId, status: "active", createdAt: 1, updatedAt: 1 });
      await ctx.db.delete(personId);
    } else {
      await ctx.db.insert("platformAdmins", { authId: "foreign-auth", email: "private@example.test", name: "Foreign", isActive: true, createdAt: 1, updatedAt: 1 });
    }
  });
  const preflight = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(preflight.school).toBeNull();
  expect(preflight.ready).toBe(false);
  expect(preflight.blockers).toContain(`${tableName}: deployment table is not empty`);
  expect(JSON.stringify(preflight)).not.toContain("private@example.test");
  lookup.mockClear();
  await expect(t.action(api.functions.academic.seedRunner.seedDemoSchool, {
    confirmation: "RESET demo-school", operatorToken: "preflight-test-token", targetIdentity: "test-target",
    deploymentEnvironment: "development", inspectedSchoolId: null, inspectedSchoolSlug: "demo-school",
  })).rejects.toThrow(`${tableName}: deployment table is not empty`);
  expect(lookup).not.toHaveBeenCalled();
  expect(await t.run((ctx) => ctx.db.query(tableName).first())).not.toBeNull();
});

test("an unrelated existing school blocks first-run inspection", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  await t.run((ctx) => ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 }));
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(result.school).toBeNull();
  expect(result.ready).toBe(false);
  expect(result.blockers).toContain("schools: deployment is not empty");
});

test("orphaned demo credentials and cleanup block first-run inspection", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  lookup.mockImplementation(async (email: string) => email === "admin@demo-academy.school" ? { user: { id: "orphan" } } : null);
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["orphan"]));
    const schoolId = await ctx.db.insert("schools", { name: "Temporary", slug: "temporary", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("demoSeedStorageCleanup", { schoolId, schoolSlug: "demo-school", storageId, createdAt: 1 });
    await ctx.db.delete(schoolId);
  });
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(result.school).toBeNull();
  expect(result.ready).toBe(false);
  expect(result.blockers).toEqual(expect.arrayContaining([
    "Better Auth: demo credential 1 already exists",
    "demoSeedStorageCleanup: pending storage claims",
  ]));
});

test("a populated demo school reports bounded direct counts and unresolved blockers", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("admissionNumberClaims", { schoolId, number: "A1", createdAt: 1 });
    await ctx.db.insert("academicSessions", { schoolId, name: "Term", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
  });
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(result.ready).toBe(false);
  expect(result.blockers).toContain("admissionNumberClaims: generic purge does not delete claims");
  expect(result.tables.find((table) => table.name === "admissionNumberClaims")).toMatchObject({ count: 1, truncated: false });
  expect(result.tables.find((table) => table.name === "academicSessions")).toMatchObject({ count: 1, truncated: false });
});

test("foreign canonical membership blocks inspection", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const demo = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { name: "Shared", email: "shared@test.school", status: "active", primarySchoolId: other, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { personId, schoolId: demo, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { personId, schoolId: other, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
  });
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, {
    operatorToken: "preflight-test-token", targetIdentity: "test-target",
  });
  expect(result.ready).toBe(false);
  expect(result.tables.find((table) => table.name === "branchMembershipsVerified")?.count).toBe(1);
  expect(result.blockers).toContain("persons/branchMemberships: foreign or ambiguous ownership");
  expect(result.blockers).toContain("demoSeedRuns: one succeeded demo cohort with three distinct auth IDs required");
});

test("shared file claims fail closed even if another school also blocks the target", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const demo = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other", status: "active", createdAt: 1, updatedAt: 1 });
    const storageId = await ctx.storage.store(new Blob(["shared"]));
    for (const schoolId of [demo, other]) {
      await ctx.db.insert("schoolAssets", { schoolId, storageId, fileName: "shared", mimeType: "text/plain", byteSize: 6, sha256: "hash", category: "test", scanStatus: "clean", isTrashed: false, createdAt: 1, updatedAt: 1 });
    }
  });
  const result = await t.action(api.functions.academic.demoPreflightAction.inspectDemoSchool, { operatorToken: "preflight-test-token", targetIdentity: "test-target" });
  expect(result.ready).toBe(false);
  expect(result.blockers).toContain("schools: more than one school in deployment");
  expect(result.blockers).toContain("storage: schoolAssets has retained/shared claims");
});

test("a full unindexed global window cannot prove zero target allocations", async () => {
  const t = convexTest(schema, modules);
  const schoolId = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    for (let i = 0; i < 1001; i++) {
      await ctx.db.insert("admissionNumberClaims", { schoolId, number: `A${i}`, createdAt: 1 });
    }
    return schoolId;
  });
  const result = await t.query(internal.functions.academic.demoPreflight.inspectDemoOwnershipInternal, { schoolId });
  expect(result.counts.find((row) => row.name === "admissionNumberClaims")).toMatchObject({ count: 1000, truncated: true });
  expect(result.blockers).toContain("admissionNumberClaims: global inspection truncated");
});

test("global scan overflow is not reported as proven empty when target has no rows", async () => {
  const t = convexTest(schema, modules);
  const demo = await t.run(async (ctx) => {
    const demo = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other", status: "active", createdAt: 1, updatedAt: 1 });
    for (let i = 0; i < 1001; i++) await ctx.db.insert("admissionNumberClaims", { schoolId: other, number: `F${i}`, createdAt: 1 });
    return demo;
  });
  const result = await t.query(internal.functions.academic.demoPreflight.inspectDemoOwnershipInternal, { schoolId: demo });
  expect(result.counts.find((row) => row.name === "admissionNumberClaims")).toMatchObject({ count: 0, truncated: true });
  expect(result.blockers).toContain("admissionNumberClaims: global inspection truncated");
});

test("public seed blocks populated demo data before auth reconciliation", async () => {
  vi.stubEnv("DEMO_SEED_OPERATOR_TOKEN", "preflight-test-token");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_IDENTITY", "test-target");
  vi.stubEnv("DEMO_SEED_DEPLOYMENT_ENV", "development");
  vi.stubEnv("DEMO_SEED_EXPECTED_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://seed-auth.test");
  const t = convexTest(schema, modules);
  const { demo, other } = await t.run(async (ctx) => {
    const demo = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("users", { schoolId: demo, authId: "credential", name: "Admin", email: "admin@demo-academy.school", role: "admin", createdAt: 1, updatedAt: 1 });
    return { demo, other };
  });
  const args = { confirmation: "RESET demo-school", operatorToken: "preflight-test-token", targetIdentity: "test-target", deploymentEnvironment: "development" as const, inspectedSchoolSlug: "demo-school", inspectedSchoolId: demo };
  await expect(t.action(api.functions.academic.seedRunner.seedDemoSchool, { ...args, inspectedSchoolId: other })).rejects.toThrow("Inspected demo-school ID changed");
  await expect(t.action(api.functions.academic.seedRunner.seedDemoSchool, { ...args, inspectedSchoolSlug: "other-school" })).rejects.toThrow("slug does not match");
  await expect(t.action(api.functions.academic.seedRunner.seedDemoSchool, args)).rejects.toThrow("No auth credentials were changed");
  await expect(t.action(api.functions.academic.seedRunner.seedDemoSchool, { ...args, confirmation: "wrong" })).rejects.toThrow("confirmation");
  expect(await t.run((ctx) => ctx.db.get(other))).not.toBeNull();
  expect(await t.run((ctx) => ctx.db.get(demo))).not.toBeNull();
});

test("other-school shares and migrations block inspection without exposing rows", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const demo = await ctx.db.insert("schools", { name: "Demo", slug: "demo-school", status: "active", createdAt: 1, updatedAt: 1 });
    const other = await ctx.db.insert("schools", { name: "Other", slug: "other-school", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("migrationState", { phase: "test", sourceSchoolId: other, targetSchoolId: demo, currentTable: "", idMaps: "{}", tablesCompleted: [], status: "idle", createdAt: 1, updatedAt: 1 });
    const storageId = await ctx.storage.store(new Blob(["asset"]));
    const assetId = await ctx.db.insert("schoolAssets", { schoolId: other, storageId, fileName: "asset", mimeType: "text/plain", byteSize: 5, sha256: "hash", category: "test", scanStatus: "clean", isTrashed: false, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("assetBranchShares", { assetId, ownerSchoolId: other, recipientSchoolId: demo, createdAt: 1 });
  });
  const result = await t.query(internal.functions.academic.demoPreflight.inspectDemoLinksInternal, {});
  expect(result.school?.name).toBe("Demo");
  expect(result.blockers).toEqual(expect.arrayContaining([
    expect.stringContaining("assetBranchShares"), expect.stringContaining("migrationState"),
  ]));
  expect(JSON.stringify(result)).not.toContain("Other");
});
