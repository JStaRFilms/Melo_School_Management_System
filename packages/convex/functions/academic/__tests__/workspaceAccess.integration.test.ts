import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
// Load the Better Auth module graph during collection, outside the transaction test budget.
import "../../auth";
import { api } from "../../../_generated/api";
import { assertAdminForSchool, assertTeacherAssignment, getAuthenticatedSchoolMembership } from "../auth";

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) => [
  `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module,
]));
const accessQuery = api.functions.auth.getViewerAccess;
const tokenIdentifier = "https://legacy-auth.test|viewer";

async function fixture(canonical = true) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolA = await ctx.db.insert("schools", { name: "A", slug: "a", status: "active", createdAt: 1, updatedAt: 1 });
    const schoolB = await ctx.db.insert("schools", { name: "B", slug: "b", status: "active", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId: schoolA, authId: "viewer", authTokenIdentifier: tokenIdentifier, name: "Viewer", email: "same@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 });
    if (!canonical) return { schoolA, schoolB, userId, personId: null, membershipId: null };
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: tokenIdentifier, name: "Viewer", email: "same@test.invalid", status: "active", createdAt: 1, updatedAt: 1 });
    const membershipId = await ctx.db.insert("branchMemberships", { personId, schoolId: schoolA, legacyUserId: userId, status: "active", displayTitle: "Custom title", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    return { schoolA, schoolB, userId, personId, membershipId };
  });
  return { t, viewer: t.withIdentity({ tokenIdentifier, subject: "viewer", issuer: "https://legacy-auth.test" }), ...ids };
}

describe("U1a selected workspace contract", () => {
  it("preserves default admin authority without claiming baseline parity or creating membership", async () => {
    const f = await fixture(false);
    const access = await f.viewer.query(accessQuery, {});
    expect(access).toMatchObject({ state: "ready", branch: { schoolId: f.schoolA }, membership: null, compatibility: { mode: "legacy_default", legacyIsSchoolAdmin: true, adminParity: "review_required" } });
    await expect(f.viewer.query(api.functions.auth.getViewerContext, {})).resolves.toMatchObject({ schoolId: f.schoolA, role: "admin" });
    await f.viewer.run(async (ctx) => {
      const user = await getAuthenticatedSchoolMembership(ctx);
      await assertAdminForSchool(ctx, user.userId, user.schoolId, user.role);
    });
    expect(await f.t.run((ctx) => ctx.db.query("branchMemberships").take(1))).toEqual([]);
    expect(await f.viewer.query(accessQuery, { schoolId: f.schoolB })).toMatchObject({ state: "forbidden" });
  });

  it("keeps legacy callers usable during managed-account cutover while enforcing migrated contracts", async () => {
    const f = await fixture();
    const membershipId = f.membershipId;
    if (!membershipId) throw new Error("Missing fixture membership");
    await f.t.run((ctx) => ctx.db.patch(membershipId, { permissionsManagedAt: 1 }));

    await expect(f.viewer.run((ctx) => getAuthenticatedSchoolMembership(ctx))).resolves.toMatchObject({
      schoolId: f.schoolA,
      role: "admin",
    });
    await expect(f.viewer.run((ctx) => getAuthenticatedSchoolMembership(ctx, {
      capability: "finance.reports.view",
    }))).rejects.toThrow("Required operation capability is missing");
  });

  it("preserves a reviewed canonical membership linked to an exact trusted-subject default", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.userId, { authTokenIdentifier: undefined }));
    expect(await f.viewer.query(api.functions.auth.getViewerContext, {})).toMatchObject({ schoolId: f.schoolA, role: "admin" });
    const personId = f.personId;
    if (!personId) throw new Error("Missing fixture person");
    await f.t.run((ctx) => ctx.db.patch(personId, { identityReconciliationState: "reconciliation_required" }));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "reconciliation_required" });
  });

  it("returns one capability summary matching enforcement and ignores cosmetic titles", async () => {
    const f = await fixture();
    const access = await f.viewer.query(accessQuery, {});
    expect(access).toMatchObject({
      state: "ready",
      displayTitle: "Custom title",
      membership: { isProprietor: false },
    });
    if (access.state !== "ready") throw new Error("Expected ready summary");
    for (const capability of ["academic.classes.manage", "finance.bank_details.manage", "staff.permissions.manage"]) {
      expect(await f.viewer.query(api.functions.academic.rbac.hasViewerCapability, { schoolId: f.schoolA, capability })).toBe(access.effectiveCapabilities.includes(capability));
    }
    expect(await f.viewer.query(accessQuery, { schoolId: f.schoolB })).toMatchObject({ state: "reconciliation_required" });
  });

  it.each(["suspended", "archived"] as const)("canonical %s cannot fall through to the legacy admin", async (status) => {
    const f = await fixture();
    const personId = f.personId;
    if (!personId) throw new Error("Missing fixture person");
    await f.t.run((ctx) => ctx.db.patch(personId, { status }));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "forbidden" });
    await expect(f.viewer.run((ctx) => getAuthenticatedSchoolMembership(ctx))).rejects.toThrow();
    expect(await f.viewer.query(api.functions.auth.getViewerContext, {})).toBeNull();
  });

  it("revoked, missing and duplicate memberships fail closed despite a live legacy row", async () => {
    const f = await fixture();
    const membershipId = f.membershipId;
    if (!membershipId) throw new Error("Missing fixture membership");
    await f.t.run((ctx) => ctx.db.patch(membershipId, { status: "suspended" }));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "forbidden" });
    await f.t.run((ctx) => ctx.db.delete(membershipId));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "reconciliation_required" });
    await f.t.run(async (ctx) => {
      if (!f.personId) throw new Error("Missing fixture person");
      const membership = { personId: f.personId, schoolId: f.schoolA, status: "active" as const, isDefaultBranch: true, joinedAt: 1, updatedAt: 1 };
      await ctx.db.insert("branchMemberships", membership);
      await ctx.db.insert("branchMemberships", membership);
    });
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "reconciliation_required" });
  });

  it("rejects ambiguous identity and cross-school legacy links without returning branch metadata", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.userId, { schoolId: f.schoolB }));
    expect(await f.viewer.query(accessQuery, { schoolId: f.schoolA })).toEqual({ state: "reconciliation_required", message: "Identity or branch mapping requires review" });
    await f.t.run((ctx) => ctx.db.insert("persons", { authTokenIdentifier: tokenIdentifier, name: "Duplicate", email: "different@test.invalid", status: "active", createdAt: 1, updatedAt: 1 }));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "reconciliation_required" });
  });

  it("reports school suspension and never authenticates by matching email", async () => {
    const f = await fixture();
    expect(await f.t.query(accessQuery, {})).toEqual({ state: "unauthenticated" });
    const impostor = f.t.withIdentity({ tokenIdentifier: "other|viewer", issuer: "other", subject: "viewer", email: "same@test.invalid" });
    expect(await impostor.query(api.functions.auth.getViewerContext, {})).toBeNull();
    await f.t.run((ctx) => ctx.db.patch(f.schoolA, { status: "suspended" }));
    expect(await f.viewer.query(accessQuery, {})).toMatchObject({ state: "suspended" });
  });

  it("scopes a teacher to the reviewed branch projection and exact assignments", async () => {
    const f = await fixture();
    const selected = await f.t.run(async (ctx) => {
      if (!f.personId) throw new Error("Missing fixture person");
      const teacherId = await ctx.db.insert("users", { schoolId: f.schoolB, authId: "branch-b", personId: f.personId, role: "teacher", name: "Teacher", email: "same@test.invalid", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("branchMemberships", { personId: f.personId, schoolId: f.schoolB, legacyUserId: teacherId, status: "active", isDefaultBranch: false, joinedAt: 1, updatedAt: 1 });
      const classId = await ctx.db.insert("classes", { schoolId: f.schoolB, name: "B class", level: "primary", createdAt: 1, updatedAt: 1 });
      const subjectId = await ctx.db.insert("subjects", { schoolId: f.schoolB, name: "Math", code: "M", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("teacherAssignments", { schoolId: f.schoolB, teacherId, classId, subjectId, createdAt: 1, updatedAt: 1 });
      return { teacherId, classId, subjectId };
    });
    expect(await f.viewer.query(accessQuery, { schoolId: f.schoolB })).toMatchObject({ state: "ready", branch: { schoolId: f.schoolB }, teacherAssignments: { legacyTeacherId: selected.teacherId }, compatibility: { legacyDefaultSchoolId: f.schoolA } });
    await f.viewer.run(async (ctx) => {
      const user = await getAuthenticatedSchoolMembership(ctx, { schoolId: f.schoolB });
      expect(user.userId).toBe(selected.teacherId);
      await assertTeacherAssignment(ctx, user.userId, selected.classId, selected.subjectId);
      await expect(assertTeacherAssignment(ctx, f.userId, selected.classId, selected.subjectId)).rejects.toThrow("Not assigned");
    });
  });
});
