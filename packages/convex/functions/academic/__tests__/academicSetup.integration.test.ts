import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import schema from "../../../schema";

declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../../../**/*.ts")).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const adminIdentity = {
  subject: "setup-regression-admin",
  tokenIdentifier: "https://auth.school.test|setup-regression-admin",
};

function teacherRecord(args: {
  schoolId: Id<"schools">;
  authId: string;
  name: string;
  email: string;
  now: number;
}) {
  return {
    schoolId: args.schoolId,
    authId: args.authId,
    authTokenIdentifier: `https://auth.school.test|${args.authId}`,
    name: args.name,
    email: args.email,
    role: "teacher" as const,
    createdAt: args.now,
    updatedAt: args.now,
  };
}

describe("academic setup registered functions", () => {
  it("keeps form teachers scoped to the selected session when listing classes", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Setup School", slug: "setup-session-switch", status: "active", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@setup.test", role: "admin", createdAt: now, updatedAt: now });
      const currentTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "current-teacher-auth", name: "Current Teacher", email: "current@setup.test", now }));
      const historicalTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "historical-teacher-auth", name: "Historical Teacher", email: "historical@setup.test", now }));
      const currentSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Current", startDate: 200, endDate: 300, isActive: true, createdAt: now, updatedAt: now });
      const historicalSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Historical", startDate: 100, endDate: 199, isActive: false, createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 3", gradeName: "Primary 3", level: "Primary", formTeacherId: currentTeacherId, createdAt: now, updatedAt: now });
      await ctx.db.insert("classSessionFormTeachers", { schoolId, classId, sessionId: currentSessionId, formTeacherId: currentTeacherId, createdAt: now, updatedAt: now, updatedBy: adminId });
      await ctx.db.insert("classSessionFormTeachers", { schoolId, classId, sessionId: historicalSessionId, formTeacherId: historicalTeacherId, createdAt: now, updatedAt: now, updatedBy: adminId });
      return { classId, currentSessionId, historicalSessionId, currentTeacherId, historicalTeacherId };
    });

    const [current, historical] = await Promise.all([
      t.withIdentity(adminIdentity).query(api.functions.academic.academicSetup.listClasses, { sessionId: ids.currentSessionId }),
      t.withIdentity(adminIdentity).query(api.functions.academic.academicSetup.listClasses, { sessionId: ids.historicalSessionId }),
    ]);

    expect(current).toContainEqual(expect.objectContaining({ _id: ids.classId, formTeacherId: ids.currentTeacherId, formTeacherName: "Current Teacher" }));
    expect(historical).toContainEqual(expect.objectContaining({ _id: ids.classId, formTeacherId: ids.historicalTeacherId, formTeacherName: "Historical Teacher" }));
  });

  it("updates session dates through the mutation, clamps affected terms, and rejects an empty term range", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Date School", slug: "setup-session-dates", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@dates.test", role: "admin", createdAt: now, updatedAt: now });
      const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/2027", startDate: 100, endDate: 400, isActive: true, createdAt: now, updatedAt: now });
      const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First Term", startDate: 100, endDate: 200, isActive: true, createdAt: now, updatedAt: now });
      return { sessionId, termId };
    });

    await t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.updateSessionDates, {
      sessionId: ids.sessionId,
      startDate: 150,
      endDate: 350,
    });
    const updated = await t.run(async (ctx) => ({ session: await ctx.db.get(ids.sessionId), term: await ctx.db.get(ids.termId) }));
    expect(updated.session).toMatchObject({ startDate: 150, endDate: 350 });
    expect(updated.term).toMatchObject({ startDate: 150, endDate: 200 });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.updateSessionDates, {
      sessionId: ids.sessionId,
      startDate: 200,
      endDate: 350,
    })).rejects.toThrow(/Session start date cannot be set after First Term end date/);
  });

  it("blocks archive for active form, class-subject, and assignment links while suppressing archived or missing subjects", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Archive School", slug: "setup-teacher-archive", status: "active", createdAt: now, updatedAt: now });
      const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@archive.test", role: "admin", createdAt: now, updatedAt: now });
      const activeFormTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "active-form-teacher", name: "Active Form Teacher", email: "active-form@archive.test", now }));
      const pastFormTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "past-form-teacher", name: "Past Form Teacher", email: "past-form@archive.test", now }));
      const classSubjectTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "class-subject-teacher", name: "Class Subject Teacher", email: "class-subject@archive.test", now }));
      const assignmentTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "assignment-teacher", name: "Assignment Teacher", email: "assignment@archive.test", now }));
      const suppressedTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "suppressed-teacher", name: "Suppressed Teacher", email: "suppressed@archive.test", now }));
      const activeSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/2027", startDate: 200, endDate: 300, isActive: true, createdAt: now, updatedAt: now });
      const pastSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2025/2026", startDate: 100, endDate: 199, isActive: false, createdAt: now, updatedAt: now });
      const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 4", gradeName: "Primary 4", level: "Primary", createdAt: now, updatedAt: now });
      const activeSubjectId = await ctx.db.insert("subjects", { schoolId, name: "Mathematics", code: "MTH", createdAt: now, updatedAt: now });
      const archivedSubjectId = await ctx.db.insert("subjects", { schoolId, name: "Archived Art", code: "ART", isArchived: true, createdAt: now, updatedAt: now });
      const missingSubjectId = await ctx.db.insert("subjects", { schoolId, name: "Removed Music", code: "MUS", createdAt: now, updatedAt: now });
      await ctx.db.insert("classSessionFormTeachers", { schoolId, classId, sessionId: activeSessionId, formTeacherId: activeFormTeacherId, createdAt: now, updatedAt: now, updatedBy: adminId });
      await ctx.db.insert("classSessionFormTeachers", { schoolId, classId, sessionId: pastSessionId, formTeacherId: pastFormTeacherId, createdAt: now, updatedAt: now, updatedBy: adminId });
      await ctx.db.insert("classSubjects", { schoolId, classId, subjectId: activeSubjectId, teacherId: classSubjectTeacherId, createdAt: now, updatedAt: now });
      await ctx.db.insert("teacherAssignments", { schoolId, classId, subjectId: activeSubjectId, teacherId: assignmentTeacherId, createdAt: now, updatedAt: now });
      await ctx.db.insert("classSubjects", { schoolId, classId, subjectId: archivedSubjectId, teacherId: suppressedTeacherId, createdAt: now, updatedAt: now });
      await ctx.db.insert("teacherAssignments", { schoolId, classId, subjectId: missingSubjectId, teacherId: suppressedTeacherId, createdAt: now, updatedAt: now });
      await ctx.db.delete(missingSubjectId);
      return { activeFormTeacherId, pastFormTeacherId, classSubjectTeacherId, assignmentTeacherId, suppressedTeacherId };
    });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId: ids.activeFormTeacherId })).rejects.toThrow(/form teacher for Primary 4 \(2026\/2027\)/);
    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId: ids.classSubjectTeacherId })).rejects.toThrow(/Mathematics in Primary 4/);
    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId: ids.assignmentTeacherId })).rejects.toThrow(/Mathematics in Primary 4/);
    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId: ids.pastFormTeacherId })).resolves.toBeNull();
    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId: ids.suppressedTeacherId })).resolves.toBeNull();
  });

  it("uses classes.formTeacherId as the archive blocker when no session is active", async () => {
    const t = convexTest(schema, modules);
    const teacherId = await t.run(async (ctx) => {
      const now = 1;
      const schoolId = await ctx.db.insert("schools", { name: "Legacy Archive School", slug: "legacy-form-teacher-archive", status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin User", email: "admin@legacy-archive.test", role: "admin", createdAt: now, updatedAt: now });
      const legacyTeacherId = await ctx.db.insert("users", teacherRecord({ schoolId, authId: "legacy-form-teacher", name: "Legacy Form Teacher", email: "legacy-form@archive.test", now }));
      await ctx.db.insert("classes", { schoolId, name: "Primary 5", gradeName: "Primary 5", level: "Primary", formTeacherId: legacyTeacherId, createdAt: now, updatedAt: now });
      return legacyTeacherId;
    });

    await expect(t.withIdentity(adminIdentity).mutation(api.functions.academic.academicSetup.archiveTeacher, { teacherId })).rejects.toThrow(/form teacher for Primary 5/);
  });
});
