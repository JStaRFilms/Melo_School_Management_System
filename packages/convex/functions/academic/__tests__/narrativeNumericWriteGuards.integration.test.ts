import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob("../../../**/*.ts"))
  .map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const identity = { tokenIdentifier: "https://auth.school.test|numeric-guard-admin", subject: "numeric-guard-admin" };

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "numeric-guard", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "numeric-guard-other", status: "active", createdAt: 1, updatedAt: 1 });
    const adminId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier,
      name: "Admin", email: "admin@numeric.test", role: "admin", createdAt: 1, updatedAt: 1 });
    const studentUserId = await ctx.db.insert("users", { schoolId, authId: "numeric-pupil", name: "Pupil",
      email: "pupil@numeric.test", role: "student", createdAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Year 2", level: "Primary", createdAt: 1, updatedAt: 1 });
    const otherClassId = await ctx.db.insert("classes", { schoolId: otherSchoolId, name: "Foreign", level: "Primary", createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId,
      admissionNumber: "S-1", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025", startDate: 1, endDate: 100,
      isActive: true, createdAt: 1, updatedAt: 1 });
    const termIds = [];
    for (let i = 0; i < 3; i++) termIds.push(await ctx.db.insert("academicTerms", { schoolId, sessionId,
      name: `Term ${i + 1}`, startDate: i * 10 + 1, endDate: i * 10 + 10,
      isActive: i === 2, reportCardCalculationMode: i === 2 ? "cumulative_annual" : "standalone",
      createdAt: 1, updatedAt: 1 }));
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Art", code: "ART", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: 1, updatedAt: 1 });
    return { schoolId, otherSchoolId, adminId, classId, otherClassId, studentId, sessionId, termId: termIds[2], subjectId };
  });
  const admin = t.withIdentity(identity);
  const selection = { sessionId: ids.sessionId, termId: ids.termId, classId: ids.classId };
  const historical = { ...selection, entries: [{ studentId: ids.studentId, subjectId: ids.subjectId, total: 75 }] };
  const adjustments = { ...selection, studentId: ids.studentId, entries: [{ subjectId: ids.subjectId,
    reset: true, includedTerms: ["current" as const], reason: "Reset recorded total" }] };
  const mode = () => t.run(ctx => ctx.db.insert("classSessionReportModes", { schoolId: ids.schoolId, classId: ids.classId,
    sessionId: ids.sessionId, mode: "narrative", updatedAt: 1, updatedBy: ids.adminId }));
  return { t, ids, admin, historical, adjustments, mode };
}

describe("numeric report writes in narrative mode", () => {
  it("keeps default graded historical totals writable and blocks all narrative totals without changing rows", async () => {
    const { t, ids, admin, historical, mode } = await fixture();
    expect(await admin.mutation(api.functions.academic.historicalTermTotals.saveHistoricalTermTotalsBulk, historical))
      .toEqual({ created: 1, updated: 0 });
    await mode();
    await expect(admin.mutation(api.functions.academic.historicalTermTotals.saveHistoricalTermTotalsBulk, {
      ...historical, entries: [{ ...historical.entries[0], total: 42 }],
    })).rejects.toThrow("narrative reports");
    await expect(admin.mutation(api.functions.academic.historicalTermTotals.saveHistoricalTermTotalsBulk, {
      ...historical, entries: [],
    })).rejects.toThrow("narrative reports");
    await expect(admin.mutation(api.functions.academic.historicalTermTotals.saveHistoricalTermTotalsBulk, {
      ...historical, classId: ids.otherClassId,
    })).rejects.toThrow("Class not found");
    const rows = await t.run(ctx => ctx.db.query("historicalTermTotals").withIndex("by_class_session_term", q =>
      q.eq("classId", ids.classId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(10));
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(75);
  });

  it("blocks both manual override and reset in narrative mode before any numeric write or audit event", async () => {
    const { t, ids, admin, adjustments, mode } = await fixture();
    await t.run(ctx => ctx.db.insert("reportCardManualAdjustments", { schoolId: ids.schoolId, classId: ids.classId,
      sessionId: ids.sessionId, termId: ids.termId, studentId: ids.studentId, subjectId: ids.subjectId,
      includedTerms: ["current"], finalTotalOverride: 80, reason: "Existing graded override",
      createdAt: 1, updatedAt: 1, createdBy: ids.adminId, updatedBy: ids.adminId }));
    await mode();
    await expect(admin.mutation(api.functions.academic.reportCardManualAdjustments.saveManualAdjustmentsBulk, adjustments))
      .rejects.toThrow("narrative reports");
    await expect(admin.mutation(api.functions.academic.reportCardManualAdjustments.saveManualAdjustmentsBulk, {
      ...adjustments, entries: [{ ...adjustments.entries[0], reset: false, finalTotalOverride: 55 }],
    })).rejects.toThrow("narrative reports");
    await expect(admin.mutation(api.functions.academic.reportCardManualAdjustments.saveManualAdjustmentsBulk, {
      ...adjustments, entries: [],
    })).rejects.toThrow("narrative reports");
    const state = await t.run(async ctx => ({
      rows: await ctx.db.query("reportCardManualAdjustments").withIndex("by_student_and_report_term", q =>
        q.eq("schoolId", ids.schoolId).eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(10),
      events: await ctx.db.query("reportCardManualAdjustmentEvents").withIndex("by_school", q => q.eq("schoolId", ids.schoolId)).take(10),
    }));
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].finalTotalOverride).toBe(80);
    expect(state.events).toEqual([]);
  });

  it("allows the existing graded manual-adjustment reset workflow", async () => {
    const { t, ids, admin, adjustments } = await fixture();
    await t.run(ctx => ctx.db.insert("reportCardManualAdjustments", { schoolId: ids.schoolId, classId: ids.classId,
      sessionId: ids.sessionId, termId: ids.termId, studentId: ids.studentId, subjectId: ids.subjectId,
      includedTerms: ["current"], finalTotalOverride: 80, reason: "Existing graded override",
      createdAt: 1, updatedAt: 1, createdBy: ids.adminId, updatedBy: ids.adminId }));
    expect(await admin.mutation(api.functions.academic.reportCardManualAdjustments.saveManualAdjustmentsBulk, adjustments))
      .toEqual({ created: 0, updated: 0, reset: 1 });
    const state = await t.run(async ctx => ({
      rows: await ctx.db.query("reportCardManualAdjustments").withIndex("by_student_and_report_term", q =>
        q.eq("schoolId", ids.schoolId).eq("studentId", ids.studentId).eq("sessionId", ids.sessionId).eq("termId", ids.termId)).take(1),
      events: await ctx.db.query("reportCardManualAdjustmentEvents").withIndex("by_school", q => q.eq("schoolId", ids.schoolId)).take(10),
    }));
    expect(state.rows).toEqual([]);
    expect(state.events).toMatchObject([{ action: "reset", finalTotalOverride: 80 }]);
  });
});
