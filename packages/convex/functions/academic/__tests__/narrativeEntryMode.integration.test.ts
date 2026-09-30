import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob("../../../**/*.ts"))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const fn = api.functions.academic.narrativeReports;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Home", slug: "entry-mode-home", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "entry-mode-other", status: "active", createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "First", level: "Primary", createdAt: 1, updatedAt: 1 });
    const otherClassId = await ctx.db.insert("classes", { schoolId: otherSchoolId, name: "Other", level: "Primary", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const otherSessionId = await ctx.db.insert("academicSessions", { schoolId: otherSchoolId, name: "2025", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Music", code: "MUS", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: 1, updatedAt: 1 });
    const actors = [];
    for (const role of ["staff", "teacher", "parent"] as const) {
      const token = `test|entry-mode-${role}`;
      const actor = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], token, ["academic.assessments.enter"]);
      await ctx.db.patch(actor.memberships[0].userId, { role, isSchoolAdmin: false });
      actors.push({ role, token, membershipId: actor.memberships[0].membershipId, userId: actor.memberships[0].userId });
    }
    const adminToken = "test|entry-mode-admin";
    const admin = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], adminToken, ["academic.assessments.enter"]);
    return { schoolId, otherSchoolId, classId, otherClassId, sessionId, otherSessionId, termId, subjectId, adminId: admin.memberships[0].userId, adminToken, actors };
  });
  const viewer = (token: string) => t.withIdentity({ tokenIdentifier: token, subject: token, issuer: "test" });
  const admin = viewer(ids.adminToken);
  const choice = { schoolId: ids.schoolId, classId: ids.classId, sessionId: ids.sessionId };
  return { t, ids, viewer, admin, choice };
}

describe("exam-entry mode lookup", () => {
  it("accepts assessments-enter-only admin and officer without granting report preview", async () => {
    const { t, ids, viewer, admin, choice } = await fixture();
    const officer = viewer(ids.actors.find(actor => actor.role === "staff")!.token);
    expect(await admin.query(fn.getEntryClassMode, choice)).toEqual({ mode: "graded", canEnterNarrative: false });
    expect(await officer.query(fn.getEntryClassMode, choice)).toEqual({ mode: "graded", canEnterNarrative: false });
    await expect(admin.query(fn.getClassMode, { classId: ids.classId, sessionId: ids.sessionId })).rejects.toThrow("capability");
    await expect(officer.query(fn.getClassMode, { classId: ids.classId, sessionId: ids.sessionId })).rejects.toThrow("capability");
    await t.run(ctx => ctx.db.insert("classSessionReportModes", { schoolId: ids.schoolId, classId: ids.classId,
      sessionId: ids.sessionId, mode: "narrative", updatedAt: 1, updatedBy: ids.adminId }));
    expect(await admin.query(fn.getEntryClassMode, choice)).toEqual({ mode: "narrative", canEnterNarrative: false });
    expect(await officer.query(fn.getEntryClassMode, choice)).toEqual({ mode: "narrative", canEnterNarrative: false });
    await expect(officer.query(api.functions.academic.narrativeEntrySheet.getSubjectOptions, { ...choice, termId: ids.termId })).rejects.toThrow("capability");
  });

  it("returns a mode for an unassigned teacher's stale same-school class but never entry access", async () => {
    const { t, ids, viewer, choice } = await fixture();
    const teacher = viewer(ids.actors.find(actor => actor.role === "teacher")!.token);
    expect(await teacher.query(fn.getEntryClassMode, choice)).toEqual({ mode: "graded", canEnterNarrative: false });
    await expect(teacher.query(fn.getClassMode, { classId: ids.classId, sessionId: ids.sessionId })).rejects.toThrow("capability");
    await t.run(ctx => ctx.db.insert("classSessionReportModes", { schoolId: ids.schoolId, classId: ids.classId,
      sessionId: ids.sessionId, mode: "narrative", updatedAt: 1, updatedBy: ids.adminId }));
    expect(await teacher.query(fn.getEntryClassMode, choice)).toEqual({ mode: "narrative", canEnterNarrative: false });
    await t.run(ctx => ctx.db.insert("membershipDirectGrants", {
      membershipId: ids.actors.find(actor => actor.role === "teacher")!.membershipId,
      capability: "academic.report_cards.preview", grantedAt: 2,
    }));
    await expect(teacher.query(fn.getClassMode, { classId: ids.classId, sessionId: ids.sessionId })).rejects.toThrow("Not assigned");
    expect(await teacher.query(fn.getEntryClassMode, choice)).toEqual({ mode: "narrative", canEnterNarrative: false });
    await expect(teacher.query(api.functions.academic.narrativeEntrySheet.getSheet, {
      ...choice, termId: ids.termId, subjectId: ids.subjectId,
    })).rejects.toThrow("Not assigned");
    await t.run(async ctx => {
      const offering = await ctx.db.query("classSubjects").withIndex("by_class_and_subject", q =>
        q.eq("classId", ids.classId).eq("subjectId", ids.subjectId)).unique();
      await ctx.db.patch(offering!._id, { teacherId: ids.actors.find(actor => actor.role === "teacher")!.userId });
    });
    expect(await teacher.query(fn.getEntryClassMode, choice)).toEqual({ mode: "narrative", canEnterNarrative: true });
    expect((await teacher.query(api.functions.academic.narrativeEntrySheet.getSubjectOptions, {
      ...choice, termId: ids.termId,
    })).map(row => row.id)).toContain(ids.subjectId);
  });

  it("rejects parents, unauthenticated callers, and foreign class/session IDs", async () => {
    const { t, ids, viewer, admin, choice } = await fixture();
    const parent = viewer(ids.actors.find(actor => actor.role === "parent")!.token);
    await expect(parent.query(fn.getEntryClassMode, choice)).rejects.toThrow("Staff access");
    await expect(t.query(fn.getEntryClassMode, choice)).rejects.toThrow();
    await expect(admin.query(fn.getEntryClassMode, { ...choice, classId: ids.otherClassId })).rejects.toThrow("Invalid entry selection");
    await expect(admin.query(fn.getEntryClassMode, { ...choice, sessionId: ids.otherSessionId })).rejects.toThrow("Invalid entry selection");
    await expect(admin.query(fn.getEntryClassMode, { ...choice, schoolId: ids.otherSchoolId })).rejects.toThrow();
  });
});
