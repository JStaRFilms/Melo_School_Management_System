import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { api } from "../../_generated/api";

const root = new URL("../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../**/*.ts", "!../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));

const TOKEN = "test|p9-parent";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolA = await ctx.db.insert("schools", { name: "A", slug: "p9-a", status: "active", createdAt: now, updatedAt: now });
    const schoolB = await ctx.db.insert("schools", { name: "B", slug: "p9-b", status: "active", createdAt: now, updatedAt: now });
    const parentUser = await ctx.db.insert("users", { schoolId: schoolA, authId: TOKEN, authTokenIdentifier: TOKEN, name: "Parent", email: "parent@p9.test", role: "parent", createdAt: now, updatedAt: now });
    const classA = await ctx.db.insert("classes", { schoolId: schoolA, name: "P1", level: "primary", createdAt: now, updatedAt: now });
    const classB = await ctx.db.insert("classes", { schoolId: schoolB, name: "P1", level: "primary", createdAt: now, updatedAt: now });
    const familyA = await ctx.db.insert("families", { schoolId: schoolA, name: "Fam", createdAt: now, updatedAt: now, createdBy: parentUser, updatedBy: parentUser });
    await ctx.db.insert("familyMembers", { schoolId: schoolA, familyId: familyA, parentUserId: parentUser, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: parentUser, updatedBy: parentUser });
    const studentUser = async (schoolId: string, name: string) =>
      ctx.db.insert("users", { schoolId: schoolId as never, authId: `${TOKEN}-${name}`, name, email: `${name}@p9.test`, role: "student", createdAt: now, updatedAt: now });
    // Two active children in school A (multi-child), one inactive.
    const active1 = await ctx.db.insert("students", { schoolId: schoolA, classId: classA, familyId: familyA, userId: await studentUser(schoolA, "kid1"), admissionNumber: "A1", enrollmentStatus: "active", createdAt: now, updatedAt: now });
    const active2 = await ctx.db.insert("students", { schoolId: schoolA, classId: classA, familyId: familyA, userId: await studentUser(schoolA, "kid2"), admissionNumber: "A2", enrollmentStatus: "active", createdAt: now, updatedAt: now });
    const inactive = await ctx.db.insert("students", { schoolId: schoolA, classId: classA, familyId: familyA, userId: await studentUser(schoolA, "kid3"), admissionNumber: "A3", enrollmentStatus: "withdrawn", createdAt: now, updatedAt: now });
    // Cross-school family link: student in school B under a B family row.
    const familyB = await ctx.db.insert("families", { schoolId: schoolB, name: "FamB", createdAt: now, updatedAt: now, createdBy: parentUser, updatedBy: parentUser });
    await ctx.db.insert("familyMembers", { schoolId: schoolA, familyId: familyB, parentUserId: parentUser, isPrimaryContact: true, createdAt: now, updatedAt: now, createdBy: parentUser, updatedBy: parentUser });
    const foreign = await ctx.db.insert("students", { schoolId: schoolB, classId: classB, userId: await studentUser(schoolB, "kidB"), admissionNumber: "B1", enrollmentStatus: "active", createdAt: now, updatedAt: now });
    // Archived student user with transferred_out enrollment (archived exception):
    // reachable only through the canonical person+membership path, since the
    // legacy lookup excludes archived rows.
    const archPerson = await ctx.db.insert("persons", { authTokenIdentifier: `${TOKEN}-arch`, name: "Arch", email: "arch@p9.test", status: "active", createdAt: now, updatedAt: now });
    const archivedUser = await ctx.db.insert("users", { schoolId: schoolA, authId: `${TOKEN}-arch`, authTokenIdentifier: `${TOKEN}-arch`, personId: archPerson, name: "Arch", email: "arch@p9.test", role: "student", isArchived: true, createdAt: now, updatedAt: now });
    await ctx.db.insert("branchMemberships", { personId: archPerson, schoolId: schoolA, legacyUserId: archivedUser, isDefaultBranch: true, status: "active", joinedAt: now, updatedAt: now });
    const archivedStudent = await ctx.db.insert("students", { schoolId: schoolA, classId: classA, userId: archivedUser, admissionNumber: "A4", enrollmentStatus: "transferred_out", createdAt: now, updatedAt: now });
    return { schoolA, schoolB, active1, active2, inactive, foreign, archivedStudent };
  });
  const parent = t.withIdentity({ tokenIdentifier: TOKEN, subject: TOKEN, issuer: "test", authenticatedAt: Date.now() });
  const archivedIdentity = t.withIdentity({ tokenIdentifier: `${TOKEN}-arch`, subject: `${TOKEN}-arch`, issuer: "test", authenticatedAt: Date.now() });
  return { t, parent, archivedIdentity, ...ids };
}

describe("portal selection ownership (consolidation P9)", () => {
  it("defaults to an active child and selects explicit ids", async () => {
    const f = await fixture();
    const def = await f.parent.query(api.functions.portal.getPortalShellContext, {});
    expect([f.active1, f.active2]).toContainEqual(def.selectedStudentId);
    expect(def.schoolId).toEqual(f.schoolA);
    const explicit = await f.parent.query(api.functions.portal.getPortalShellContext, { studentId: f.active2 });
    expect(explicit.selectedStudentId).toEqual(f.active2);
    // Withdrawn but unarchived students stay accessible by explicit id.
    const withdrawn = await f.parent.query(api.functions.portal.getPortalShellContext, { studentId: f.inactive });
    expect(withdrawn.selectedStudentId).toEqual(f.inactive);
  });

  it("excludes cross-school students from selection", async () => {
    const f = await fixture();
    await expect(
      f.parent.query(api.functions.portal.getPortalShellContext, { studentId: f.foreign }),
    ).rejects.toThrow("Student not found");
  });

  it("keeps the transferred-out archived exception resolvable by id", async () => {
    const f = await fixture();
    const explicit = await f.archivedIdentity.query(api.functions.portal.getPortalShellContext, { studentId: f.archivedStudent });
    expect(explicit.selectedStudentId).toEqual(f.archivedStudent);
  });
});
