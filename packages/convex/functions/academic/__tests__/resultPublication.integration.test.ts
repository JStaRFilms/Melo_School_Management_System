declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import { reportCardReviewKey } from "@school/shared/exam-recording";
import schema from "../../../schema";
import { getReleasedGradedReport } from "../resultPublication";

const modules = import.meta.glob("../../../**/*.ts");
const convexRoot = new URL("../../../", import.meta.url).pathname;
const mapped = Object.fromEntries(Object.entries(modules).map(([path, module]) =>
  [`./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module]));
const adminIdentity = { subject: "release-admin", tokenIdentifier: "https://school.test|release-admin" };
const officerIdentity = { subject: "release-officer", tokenIdentifier: "https://school.test|release-officer" };
const confirmation = "I reviewed this roster and understand that releasing it makes these reports visible to families.";

async function fixture() {
  const t = convexTest(schema, mapped);
  const ids = await t.run(async ctx => {
    const now = 1;
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "release-test", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-release", status: "active", createdAt: now, updatedAt: now });
    const adminId = await ctx.db.insert("users", { schoolId, authId: adminIdentity.subject,
      authTokenIdentifier: adminIdentity.tokenIdentifier, name: "Admin", email: "release-admin@test.invalid", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const officerId = await ctx.db.insert("users", { schoolId, authId: officerIdentity.subject,
      authTokenIdentifier: officerIdentity.tokenIdentifier, name: "Officer", email: "release-officer@test.invalid", role: "staff", createdAt: now, updatedAt: now });
    const personId = await ctx.db.insert("persons", { authTokenIdentifier: officerIdentity.tokenIdentifier,
      email: "release-officer@test.invalid", name: "Officer", status: "active", primarySchoolId: schoolId, createdAt: now, updatedAt: now });
    const membershipId = await ctx.db.insert("branchMemberships", { personId, schoolId, status: "active", isDefaultBranch: true,
      legacyUserId: officerId, joinedAt: now, updatedAt: now });
    for (const capability of ["academic.report_cards.preview", "academic.report_cards.publish_final"]) {
      await ctx.db.insert("membershipDirectGrants", { membershipId, capability, grantedAt: now });
    }
    const studentUserId = await ctx.db.insert("users", { schoolId, authId: "student-release", name: "Student", email: "student-release@test.invalid", role: "student", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "JSS 1", level: "Junior", createdAt: now, updatedAt: now });
    const otherClassId = await ctx.db.insert("classes", { schoolId: otherSchoolId, name: "Other", level: "Junior", createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/27", startDate: 1, endDate: Date.now() + 100000, isActive: true, createdAt: now, updatedAt: now });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 2, endDate: Date.now() + 100000, isActive: true, createdAt: now, updatedAt: now });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "MAT", createdAt: now, updatedAt: now });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: now, updatedAt: now });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, admissionNumber: "STU-1", createdAt: now, updatedAt: now });
    await ctx.db.insert("studentSubjectSelections", { schoolId, studentId, classId, sessionId, subjectId, createdAt: now, updatedAt: now });
    await ctx.db.insert("gradingBands", { schoolId, minScore: 0, maxScore: 100, gradeLetter: "A", remark: "Pass", isActive: true, version: 1, createdAt: now, updatedAt: now, updatedBy: adminId });
    await ctx.db.insert("assessmentRecords", { schoolId, studentId, classId, sessionId, termId, subjectId, ca1: 10, ca2: 10, ca3: 10,
      examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "A", remark: "Pass", examInputModeSnapshot: "raw_70", examRawMaxSnapshot: 70,
      status: "draft", enteredBy: adminId, updatedBy: adminId, createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, adminId, classId, otherClassId, sessionId, termId, studentId, subjectId, studentUserId };
  });
  const admin = t.withIdentity(adminIdentity);
  const officer = t.withIdentity(officerIdentity);
  const tuple = { classId: ids.classId, sessionId: ids.sessionId, termId: ids.termId };
  const read = () => t.run(ctx => getReleasedGradedReport(ctx, { ...tuple, schoolId: ids.schoolId, studentId: ids.studentId }));
  const readiness = () => officer.query(api.functions.academic.resultPublication.getClassReadiness, tuple);
  const certify = async () => {
    const report = await admin.query(api.functions.academic.reportCards.getStudentReportCard, { ...tuple, studentId: ids.studentId });
    await admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard, {
      ...tuple, studentId: ids.studentId, confirmation: "STU-1", reviewedKey: reportCardReviewKey(report),
    });
  };
  return { t, ids, admin, officer, tuple, read, readiness, certify };
}

async function multiSubjectClass() {
  const f = await fixture();
  await f.certify();
  const studentIds = await f.t.run(async ctx => {
    const snapshot = (await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q =>
      q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.termId)).unique())!;
    const assessment = (await ctx.db.query("assessmentRecords").withIndex("by_student_and_session", q =>
      q.eq("schoolId", f.ids.schoolId).eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId)).first())!;
    const { _id: _recordId, _creationTime: _recordTime, ...record } = assessment;
    const { _id: _snapshotId, _creationTime: _snapshotTime, ...issued } = snapshot;
    const subjectIds = [f.ids.subjectId];
    for (let i = 1; i < 11; i++) {
      const subjectId = await ctx.db.insert("subjects", { schoolId: f.ids.schoolId,
        name: `Subject ${i}`, code: `SUB${i}`, createdAt: 1, updatedAt: 1 });
      subjectIds.push(subjectId);
      await ctx.db.insert("classSubjects", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        subjectId, createdAt: 1, updatedAt: 1 });
    }
    const students = [f.ids.studentId];
    for (let i = 1; i < 50; i++) {
      const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: `capacity-${i}`,
        name: `Student ${i}`, email: `capacity-${i}@test.invalid`, role: "student", createdAt: 1, updatedAt: 1 });
      students.push(await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        userId, admissionNumber: `CAP-${i}`, createdAt: 1, updatedAt: 1 }));
    }
    for (const [i, studentId] of students.entries()) {
      for (const [j, subjectId] of subjectIds.entries()) {
        if (i === 0 && j === 0) continue;
        await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId,
          classId: f.ids.classId, sessionId: f.ids.sessionId, subjectId, createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("assessmentRecords", { ...record, studentId, subjectId });
      }
      const report = { ...issued.report,
        student: { ...issued.report.student, _id: studentId, admissionNumber: i ? `CAP-${i}` : "STU-1" },
        results: subjectIds.map((subjectId, j) => ({ ...issued.report.results[0], subjectId,
          subjectName: `Subject ${j}`, subjectCode: `SUB${j}` })),
        summary: { ...issued.report.summary, totalSubjects: 11, recordedSubjects: 11,
          totalScore: 770, averageScore: 70, pendingSubjects: 0 },
      };
      if (i === 0) await ctx.db.patch(snapshot._id, { report });
      else await ctx.db.insert("issuedReportCards", { ...issued, studentId, report });
    }
    return students;
  });
  return { ...f, studentIds };
}

describe("graded result release", () => {
  it("reviews and releases 50 certified students with 550 rows per subject evidence source", async () => {
    const f = await multiSubjectClass();
    const ready = await f.readiness();
    expect(ready).toMatchObject({ ready: true, eligibleCount: 50, certifiedCount: 50 });
    const published = await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(published.eligibleCount).toBe(50);
    expect(await f.t.run(ctx => ctx.db.query("classResultPublicationStudents")
      .withIndex("by_publication_and_student", q => q.eq("publicationId", published._id)).take(81)))
      .toHaveLength(50);
  });

  it("checks candidates beyond subject row 512 and refuses a stale or oversized unique roster", async () => {
    const f = await multiSubjectClass();
    const ready = await f.readiness();
    await f.t.run(async ctx => {
      const outsideClass = await ctx.db.insert("classes", { schoolId: f.ids.schoolId,
        name: "Other active class", level: "Junior", createdAt: 1, updatedAt: 1 });
      for (let i = 0; i < 31; i++) {
        const studentId = await ctx.db.insert("students", { schoolId: f.ids.schoolId,
          classId: outsideClass, userId: f.ids.studentUserId, admissionNumber: `LATE-EVIDENCE-${i}`,
          createdAt: 1, updatedAt: 1 });
        await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId,
          classId: f.ids.classId, sessionId: f.ids.sessionId, subjectId: f.ids.subjectId, createdAt: 2, updatedAt: 2 });
      }
    });
    await expect(f.readiness()).rejects.toThrow("Roster exceeds atomic review limit");
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow("Roster exceeds atomic review limit");
    expect(await f.t.run(ctx => ctx.db.query("classResultPublications").withIndex("by_school", q =>
      q.eq("schoolId", f.ids.schoolId)).take(2))).toHaveLength(0);
    expect(await f.t.run(ctx => ctx.db.query("classResultPublicationStudents").withIndex("by_school", q =>
      q.eq("schoolId", f.ids.schoolId)).take(2))).toHaveLength(0);
  });

  it("keeps a separate subject-evidence budget without publishing a truncated class", async () => {
    const f = await fixture();
    await f.certify();
    const ready = await f.readiness();
    await f.t.run(async ctx => {
      for (let i = 0; i < 4096; i++) await ctx.db.insert("studentSubjectSelections", {
        schoolId: f.ids.schoolId, studentId: f.ids.studentId, classId: f.ids.classId,
        sessionId: f.ids.sessionId, subjectId: f.ids.subjectId, createdAt: 1, updatedAt: 1,
      });
    });
    await expect(f.readiness()).rejects.toThrow("Class subject evidence exceeds the atomic read budget");
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow("Class subject evidence exceeds the atomic read budget");
    expect(await f.read()).toBeNull();
  });
  it("opens a non-default branch release blocker in staff preview and certifies only that branch", async () => {
    const f = await fixture();
    const foreignSchoolId = await f.t.run(async ctx => {
      const now = 1;
      const personId = await ctx.db.insert("persons", { authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Admin", email: "admin-default@test.invalid", status: "active", primarySchoolId: f.ids.otherSchoolId,
        createdAt: now, updatedAt: now });
      await ctx.db.insert("branchMemberships", { personId, schoolId: f.ids.schoolId,
        status: "active", isDefaultBranch: false, legacyUserId: f.ids.adminId, joinedAt: now, updatedAt: now });
      const otherUserId = await ctx.db.insert("users", { schoolId: f.ids.otherSchoolId,
        authId: adminIdentity.subject, authTokenIdentifier: adminIdentity.tokenIdentifier,
        name: "Admin Default", email: "admin-default@test.invalid", role: "admin", createdAt: now, updatedAt: now });
      await ctx.db.insert("branchMemberships", { personId, schoolId: f.ids.otherSchoolId,
        status: "active", isDefaultBranch: true, legacyUserId: otherUserId, joinedAt: now, updatedAt: now });
      return await ctx.db.insert("schools", { name: "Foreign", slug: "foreign-preview",
        status: "active", createdAt: now, updatedAt: now });
    });
    const args = { schoolId: f.ids.schoolId, ...f.tuple, studentId: f.ids.studentId };
    expect((await f.officer.query(api.functions.academic.resultPublication.getClassReadiness,
      { schoolId: f.ids.schoolId, ...f.tuple })).rows[0].status).toBe("blocked");
    const report = await f.admin.query(api.functions.academic.reportCards.getStudentReportCard, args);
    expect(report.student._id).toBe(f.ids.studentId);
    expect(await f.admin.query(api.functions.academic.reportCards.getStudentsForReportCardBatch,
      { schoolId: f.ids.schoolId, ...f.tuple })).toHaveLength(1);
    expect(await f.admin.query(api.functions.academic.reportCards.getClassReportCards,
      { schoolId: f.ids.schoolId, ...f.tuple })).toHaveLength(1);
    await expect(f.admin.query(api.functions.academic.reportCards.getStudentReportCard,
      { ...args, schoolId: f.ids.otherSchoolId })).rejects.toThrow();
    await expect(f.admin.query(api.functions.academic.reportCards.getStudentsForReportCardBatch,
      { ...f.tuple, schoolId: f.ids.otherSchoolId })).rejects.toThrow();
    await expect(f.admin.query(api.functions.academic.reportCards.getClassReportCards,
      { ...f.tuple, schoolId: foreignSchoolId })).rejects.toThrow();
    const certifyArgs = { ...args, confirmation: "STU-1", reviewedKey: reportCardReviewKey(report) };
    await expect(f.admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard,
      { ...certifyArgs, schoolId: f.ids.otherSchoolId })).rejects.toThrow();
    await expect(f.admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard,
      { ...certifyArgs, schoolId: foreignSchoolId })).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.reportCards.certifyStudentReportCard, certifyArgs);
    const ready = await f.officer.query(api.functions.academic.resultPublication.getClassReadiness,
      { schoolId: f.ids.schoolId, ...f.tuple });
    expect(ready.ready).toBe(true);
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { schoolId: f.ids.schoolId, ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect((await f.read())?.report.student._id).toBe(f.ids.studentId);
  });
  it("binds selectors, pause, exclusions and release to a selected non-default branch", async () => {
    const f = await fixture();
    await f.certify();
    const foreignSchoolId = await f.t.run(async ctx => {
      const now = 1;
      const foreign = await ctx.db.insert("schools", { name: "Foreign", slug: "foreign-release", status: "active", createdAt: now, updatedAt: now });
      for (const identity of [adminIdentity, officerIdentity]) {
        const isAdmin = identity === adminIdentity;
        const existingUser = await ctx.db.query("users").withIndex("by_auth_token_identifier_and_archived", q =>
          q.eq("authTokenIdentifier", identity.tokenIdentifier).eq("isArchived", undefined)).unique();
        const person = isAdmin
          ? await ctx.db.insert("persons", { authTokenIdentifier: identity.tokenIdentifier, email: "admin@branch.test",
            name: "Admin", status: "active", primarySchoolId: f.ids.otherSchoolId, createdAt: now, updatedAt: now })
          : (await ctx.db.query("persons").withIndex("by_token_identifier", q => q.eq("authTokenIdentifier", identity.tokenIdentifier)).unique())!._id;
        await ctx.db.patch(person, { primarySchoolId: f.ids.otherSchoolId });
        const original = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q =>
          q.eq("personId", person).eq("schoolId", f.ids.schoolId)).unique();
        if (original) await ctx.db.patch(original._id, { isDefaultBranch: false });
        else await ctx.db.insert("branchMemberships", { personId: person, schoolId: f.ids.schoolId, status: "active",
          isDefaultBranch: false, legacyUserId: existingUser!._id, joinedAt: now, updatedAt: now });
        const otherUser = await ctx.db.insert("users", { schoolId: f.ids.otherSchoolId,
          authId: identity.subject, name: isAdmin ? "Admin B" : "Officer B", email: `${identity.subject}@branch.test`,
          role: isAdmin ? "admin" : "staff", isSchoolAdmin: isAdmin, createdAt: now, updatedAt: now });
        const otherMembership = await ctx.db.insert("branchMemberships", { personId: person,
          schoolId: f.ids.otherSchoolId, status: "active", isDefaultBranch: true, legacyUserId: otherUser, joinedAt: now, updatedAt: now });
        if (!isAdmin) {
          for (const capability of ["academic.report_cards.preview", "academic.report_cards.publish_final"])
            await ctx.db.insert("membershipDirectGrants", { membershipId: otherMembership, capability, grantedAt: now });
        }
      }
      const second = await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        userId: f.ids.studentUserId, admissionNumber: "REVIEW-EXCLUSION", createdAt: now, updatedAt: now });
      await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: second,
        classId: f.ids.classId, sessionId: f.ids.sessionId, subjectId: f.ids.subjectId, createdAt: now, updatedAt: now });
      return { foreign, second };
    });
    const schoolId = f.ids.schoolId;
    await f.t.run(async ctx => {
      const person = await ctx.db.query("persons").withIndex("by_token_identifier", q =>
        q.eq("authTokenIdentifier", officerIdentity.tokenIdentifier)).unique();
      const otherMembership = await ctx.db.query("branchMemberships").withIndex("by_person_and_school", q =>
        q.eq("personId", person!._id).eq("schoolId", f.ids.otherSchoolId)).unique();
      for (const capability of ["academic.report_cards.preview", "academic.report_cards.publish_final"])
        await ctx.db.insert("membershipDirectRestrictions", { membershipId: otherMembership!._id,
          capability, restrictedAt: 1 });
    });
    await expect(f.officer.query(api.functions.academic.resultPublication.getReleaseContext,
      { schoolId: f.ids.otherSchoolId })).rejects.toThrow();
    // Legacy calls without schoolId may still resolve the user's legacy school;
    // the workspace always supplies the selected branch instead.
    const paginationOpts = { numItems: 10, cursor: null };
    expect((await f.officer.query(api.functions.academic.resultPublication.getReleaseContext, { schoolId })).schoolId).toBe(schoolId);
    expect((await f.officer.query(api.functions.academic.resultPublication.listReleaseSessions, { schoolId, paginationOpts })).page[0].id).toBe(f.ids.sessionId);
    expect((await f.officer.query(api.functions.academic.resultPublication.listReleaseTerms,
      { schoolId, sessionId: f.ids.sessionId, paginationOpts })).page[0].id).toBe(f.ids.termId);
    expect((await f.officer.query(api.functions.academic.resultPublication.listReleaseClasses, { schoolId, paginationOpts })).page[0].id).toBe(f.ids.classId);
    expect((await f.officer.query(api.functions.academic.resultPublication.getReleaseSelection, { schoolId, ...f.tuple }))?.klass.id).toBe(f.ids.classId);
    await expect(f.officer.query(api.functions.academic.resultPublication.getClassReadiness,
      { schoolId: foreignSchoolId.foreign, ...f.tuple })).rejects.toThrow();
    await expect(f.officer.query(api.functions.academic.resultPublication.listReleasedClasses,
      { schoolId: foreignSchoolId.foreign, paginationOpts })).rejects.toThrow();
    await expect(f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { schoolId: foreignSchoolId.foreign, releasesPaused: true, reason: "Unauthorized branch attempt" })).rejects.toThrow();
    await expect(f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { schoolId: foreignSchoolId.foreign, ...f.tuple, studentId: foreignSchoolId.second, reason: "Unauthorized branch attempt" })).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { schoolId, releasesPaused: true, reason: "School roster needs review" });
    const paused = await f.officer.query(api.functions.academic.resultPublication.getReleaseContext, { schoolId });
    expect(paused.releasesPaused).toBe(true);
    await f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { schoolId, releasesPaused: false, reason: "School roster reviewed" });
    await f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { schoolId, ...f.tuple, studentId: foreignSchoolId.second, reason: "No scores after enrollment review" });
    const ready = await f.officer.query(api.functions.academic.resultPublication.getClassReadiness, { schoolId, ...f.tuple });
    expect(ready).toMatchObject({ ready: true, excludedCount: 1 });
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { schoolId: foreignSchoolId.foreign, ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow();
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { schoolId, ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect((await f.officer.query(api.functions.academic.resultPublication.listReleasedClasses,
      { schoolId, paginationOpts })).page).toHaveLength(1);
    expect(await f.read()).not.toBeNull();
  });

  it("withholds drafts and certified reports until an atomic, idempotent release", async () => {
    const f = await fixture();
    expect(await f.read()).toBeNull();
    expect((await f.readiness()).rows[0].reason).toBe("Report not certified");
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: (await f.readiness()).reviewKey!, confirmation })).rejects.toThrow();
    await f.certify();
    expect(await f.read()).toBeNull();
    const ready = await f.readiness();
    expect(ready.ready).toBe(true);
    expect(ready.certifiedCount).toBe(1);
    const release = await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    const retry = await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(retry._id).toEqual(release._id);
    const staffView = await f.officer.query(api.functions.academic.resultPublication.getClassReadiness, f.tuple);
    expect(staffView.released?.releasedByName).toBe("Officer");
    await f.t.run(async ctx => {
      const officer = await ctx.db.query("users").withIndex("by_auth_token_identifier_and_archived", q =>
        q.eq("authTokenIdentifier", officerIdentity.tokenIdentifier).eq("isArchived", undefined)).unique();
      await ctx.db.patch(officer!._id, { name: " " });
    });
    expect((await f.admin.query(api.functions.academic.resultPublication.getClassReadiness, f.tuple)).released?.releasedByName).toBe("Staff member");
    expect((await f.read())?.report.summary.totalScore).toBeGreaterThan(0);
    expect(await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect()
      .then(events => events.filter(e => e.action === "result_release.publish")))).toHaveLength(1);
    // Newly added students are not included even if a snapshot appears later.
    const added = await f.t.run(ctx => ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
      userId: f.ids.studentUserId, admissionNumber: "LATE", createdAt: Date.now(), updatedAt: Date.now() }));
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, schoolId: f.ids.schoolId, studentId: added }))).toBeNull();
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: "stale", confirmation })).rejects.toThrow();
  });

  it("keeps the pinned issued card visible after draft changes and class archival", async () => {
    const f = await fixture();
    await f.certify();
    const ready = await f.readiness();
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    const issued = await f.read();
    expect(issued).not.toBeNull();
    await f.t.run(async ctx => {
      const record = await ctx.db.query("assessmentRecords").withIndex("by_student_and_term", q =>
        q.eq("schoolId", f.ids.schoolId).eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.termId)).unique();
      await ctx.db.patch(record!._id, { total: 1, remark: "Changed after release" });
      const selection = await ctx.db.query("studentSubjectSelections").withIndex("by_student_and_session", q =>
        q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId)).unique();
      const newClassId = await ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "JSS 2", level: "Junior", createdAt: 2, updatedAt: 2 });
      await ctx.db.patch(selection!._id, { classId: newClassId });
      // A later card cannot replace the ID selected at release either.
      await ctx.db.insert("issuedReportCards", { schoolId: issued!.schoolId, studentId: issued!.studentId,
        classId: issued!.classId, sessionId: issued!.sessionId, termId: issued!.termId,
        issuedAt: issued!.issuedAt, issuedBy: issued!.issuedBy, report: issued!.report });
      await ctx.db.patch(f.ids.classId, { isArchived: true });
    });
    expect(await f.read()).toEqual(issued);
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.sessionId, { isArchived: true, isActive: false });
      await ctx.db.patch(f.ids.termId, { isArchived: true, isActive: false });
    });
    const inspected = await f.admin.query(api.functions.academic.resultPublication.getClassReadiness, f.tuple);
    expect(inspected.released?._id).toBeDefined();
    expect(inspected.rows[0].status).toBe("certified");
    expect((await f.admin.query(api.functions.academic.resultPublication.listReleaseClasses,
      { paginationOpts: { numItems: 24, cursor: null } })).page)
      .toContainEqual({ id: f.ids.classId, name: "JSS 1", isArchived: true });
    expect(await f.read()).toEqual(issued);
    const late = await f.t.run(ctx => ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
      userId: f.ids.studentUserId, admissionNumber: "LATE", createdAt: 2, updatedAt: 2 }));
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, schoolId: f.ids.schoolId, studentId: late }))).toBeNull();
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, schoolId: f.ids.otherSchoolId, studentId: f.ids.studentId }))).toBeNull();
    const otherClass = await f.t.run(ctx => ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "JSS 3", level: "Junior", createdAt: 2, updatedAt: 2 }));
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, classId: otherClass,
      schoolId: f.ids.schoolId, studentId: f.ids.studentId }))).toBeNull();
  });

  it("serializes competing releases to one audit and frozen roster", async () => {
    const f = await fixture();
    await f.certify();
    const reviewedKey = (await f.readiness()).reviewKey!;
    const attempts = await Promise.allSettled([f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey, confirmation }), f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey, confirmation })]);
    expect(attempts.some(a => a.status === "fulfilled")).toBe(true);
    expect(await f.t.run(ctx => ctx.db.query("classResultPublications").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("classResultPublicationStudents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect())).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect()
      .then(events => events.filter(e => e.action === "result_release.publish")))).toHaveLength(1);
  });

  it("rejects cross-school tuple and denies officer exclusion; admin reasoned exclusion is audited", async () => {
    const f = await fixture();
    await expect(f.admin.query(api.functions.academic.resultPublication.getClassReadiness,
      { ...f.tuple, classId: f.ids.otherClassId })).rejects.toThrow();
    await expect(f.officer.mutation(api.functions.academic.resultPublication.excludeStudent,
      { ...f.tuple, studentId: f.ids.studentId, reason: "Reviewed student omission" })).rejects.toThrow();
    await expect(f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { ...f.tuple, studentId: f.ids.studentId, reason: " " })).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { ...f.tuple, studentId: f.ids.studentId, reason: "Reviewed student omission" });
    const ready = await f.readiness();
    expect(ready.excludedCount).toBe(1);
    expect(ready.ready).toBe(false); // no eligible certified student
    expect(await f.read()).toBeNull();
  });

  it("freezes admin-reviewed exclusions and refuses incomplete historical evidence", async () => {
    const f = await fixture();
    await f.certify();
    const second = await f.t.run(async ctx => {
      const studentId = await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        userId: f.ids.studentUserId, admissionNumber: "STU-2", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId, classId: f.ids.classId,
        sessionId: f.ids.sessionId, subjectId: f.ids.subjectId, createdAt: 1, updatedAt: 1 });
      const record = await ctx.db.query("assessmentRecords").withIndex("by_student_and_term", q =>
        q.eq("schoolId", f.ids.schoolId).eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.termId)).unique();
      const { _id: recordId, _creationTime: created, ...recordData } = record!;
      await ctx.db.insert("assessmentRecords", { ...recordData, studentId });
      const issued = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q =>
        q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.termId)).unique();
      await ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId, classId: f.ids.classId,
        sessionId: f.ids.sessionId, termId: f.ids.termId, issuedAt: issued!.issuedAt, issuedBy: f.ids.adminId,
        report: { ...issued!.report, student: { ...issued!.report.student, _id: studentId, admissionNumber: "STU-2" } } });
      return studentId;
    });
    await f.admin.mutation(api.functions.academic.resultPublication.excludeStudent, { ...f.tuple,
      studentId: f.ids.studentId, reason: "School administrator approved this omission" });
    const ready = await f.readiness();
    expect(ready).toMatchObject({ ready: true, certifiedCount: 1, excludedCount: 1 });
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(await f.read()).toBeNull();
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, schoolId: f.ids.schoolId, studentId: second }))).not.toBeNull();
    await expect(f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { ...f.tuple, studentId: second, reason: "Late change not permitted" })).rejects.toThrow();
    expect(await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect()
      .then(events => events.filter(e => e.action === "result_release.exclude")))).toHaveLength(1);
  });

  it("blocks ambiguous class, duplicate cards, and a stale review", async () => {
    const f = await fixture();
    await f.certify();
    const ready = await f.readiness();
    await f.t.run(ctx => ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: f.ids.studentId,
      classId: f.ids.otherClassId, sessionId: f.ids.sessionId, subjectId: f.ids.subjectId, createdAt: 2, updatedAt: 2 }));
    expect((await f.readiness()).ready).toBe(false);
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow();
    await f.t.run(async ctx => {
      const selections = await ctx.db.query("studentSubjectSelections")
        .withIndex("by_student_and_session", q => q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId)).collect();
      await ctx.db.delete(selections[1]._id);
      const issued = await ctx.db.query("issuedReportCards").withIndex("by_student_session_term", q => q.eq("studentId", f.ids.studentId).eq("sessionId", f.ids.sessionId).eq("termId", f.ids.termId)).unique();
      await ctx.db.insert("issuedReportCards", { schoolId: issued!.schoolId, studentId: issued!.studentId, classId: issued!.classId,
        sessionId: issued!.sessionId, termId: issued!.termId, issuedAt: issued!.issuedAt, issuedBy: issued!.issuedBy, report: issued!.report });
    });
    expect((await f.readiness()).rows[0].reason).toBe("Conflicting report records");
    expect(await f.read()).toBeNull();
  });

  it("blocks inactive terms and sessions even when an old no-evidence student is absent from the current class", async () => {
    const f = await fixture();
    await f.certify();
    await f.t.run(async ctx => {
      const oldClass = await ctx.db.insert("classes", { schoolId: f.ids.schoolId, name: "Former", level: "Junior", createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: oldClass,
        userId: f.ids.studentUserId, admissionNumber: "UNKNOWN-HISTORY", createdAt: 1, updatedAt: 1 });
      await ctx.db.patch(f.ids.termId, { isActive: false });
    });
    await expect(f.readiness()).rejects.toThrow("Historical roster needs authoritative reconciliation");
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: "forged", confirmation })).rejects.toThrow("Historical roster needs authoritative reconciliation");
    await f.t.run(async ctx => {
      await ctx.db.patch(f.ids.termId, { isActive: true });
      await ctx.db.patch(f.ids.sessionId, { isActive: false });
    });
    await expect(f.readiness()).rejects.toThrow("Historical roster needs authoritative reconciliation");
    expect(await f.read()).toBeNull();
  });

  it("blocks a no-score current student until an admin reviews an explicit exclusion", async () => {
    const f = await fixture();
    await f.certify();
    const second = await f.t.run(async ctx => {
      const studentId = await ctx.db.insert("students", { schoolId: f.ids.schoolId, classId: f.ids.classId,
        userId: f.ids.studentUserId, admissionNumber: "NO-SCORE", createdAt: 1, updatedAt: 1 });
      return studentId;
    });
    expect((await f.readiness()).rows.find(r => r.studentId === second))
      .toMatchObject({ status: "blocked", canExclude: false });
    await f.t.run(ctx => ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId,
      studentId: second, classId: f.ids.classId, sessionId: f.ids.sessionId,
      subjectId: f.ids.subjectId, createdAt: 1, updatedAt: 1 }));
    const blocked = await f.readiness();
    expect(blocked.ready).toBe(false);
    expect(blocked.rows.find(r => r.studentId === second)).toMatchObject({ status: "blocked", canExclude: true, reasonCode: "evidence_missing" });
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: blocked.reviewKey!, confirmation })).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.resultPublication.excludeStudent,
      { ...f.tuple, studentId: second, reason: "No scores after reviewed class enrollment" });
    const ready = await f.readiness();
    expect(ready).toMatchObject({ ready: true, eligibleCount: 1, excludedCount: 1 });
    expect(ready.rows.find(r => r.status === "excluded")?.approvedByName).toBe("Admin");
    await f.t.run(ctx => ctx.db.patch(f.ids.adminId, { name: "  " }));
    expect((await f.readiness()).rows.find(r => r.status === "excluded")?.approvedByName).toBe("Staff member");
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(await f.t.run(ctx => getReleasedGradedReport(ctx, { ...f.tuple, schoolId: f.ids.schoolId, studentId: second }))).toBeNull();
  });

  it("permits a small current class at a school with more than 512 students", async () => {
    const f = await fixture();
    const otherClass = await f.t.run(ctx => ctx.db.insert("classes", { schoolId: f.ids.schoolId,
      name: "Other class", level: "Junior", createdAt: 1, updatedAt: 1 }));
    for (let batch = 0; batch < 13; batch++) {
      await f.t.run(async ctx => {
        for (let i = 0; i < 40; i++) await ctx.db.insert("students", { schoolId: f.ids.schoolId,
          classId: otherClass, userId: f.ids.studentUserId, admissionNumber: `O-${batch}-${i}`, createdAt: 1, updatedAt: 1 });
      });
    }
    await f.certify();
    const ready = await f.readiness();
    expect(ready).toMatchObject({ ready: true, certifiedCount: 1 });
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(await f.read()).not.toBeNull();
  });

  it("pages past 257 published and archived classes without blocking active release", async () => {
    const f = await fixture();
    const archived = await f.t.run(async ctx => {
      const sessionId = await ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId, name: "Old session",
        startDate: 1, endDate: 2, isActive: false, isArchived: true, createdAt: 1, updatedAt: 1 });
      const termId = await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId, name: "Old term",
        startDate: 1, endDate: 2, isActive: false, isArchived: true, createdAt: 1, updatedAt: 1 });
      return { sessionId, termId };
    });
    for (let batch = 0; batch < 13; batch++) {
      await f.t.run(async ctx => {
        for (let i = 0; i < 20 && batch * 20 + i < 257; i++) {
          const classId = await ctx.db.insert("classes", { schoolId: f.ids.schoolId,
            name: `Old ${batch * 20 + i}`, level: "Junior", isArchived: true, createdAt: 1, updatedAt: 1 });
          await ctx.db.insert("classResultPublications", { schoolId: f.ids.schoolId, ...archived, classId,
            releasedAt: 1, releasedBy: f.ids.adminId, reviewKey: `old-${batch * 20 + i}`,
            eligibleCount: 0, certifiedCount: 0, excludedCount: 0 });
        }
      });
    }
    for (let batch = 0; batch < 13; batch++) {
      await f.t.run(async ctx => {
        for (let i = 0; i < 20 && batch * 20 + i < 257; i++) {
          await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: f.ids.sessionId,
            name: `Older term ${batch * 20 + i}`, startDate: 1, endDate: 2,
            isActive: false, createdAt: 1, updatedAt: 1 });
        }
      });
    }
    for (let batch = 0; batch < 13; batch++) {
      await f.t.run(async ctx => {
        for (let i = 0; i < 20 && batch * 20 + i < 257; i++) {
          await ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId,
            name: `Past session ${batch * 20 + i}`, startDate: 1, endDate: 2,
            isActive: false, createdAt: 1, updatedAt: 1 });
        }
      });
    }
    const context = await f.admin.query(api.functions.academic.resultPublication.getReleaseContext, {});
    expect(context.canRelease).toBe(true);
    await expect(f.t.query(api.functions.academic.resultPublication.listReleasedClasses,
      { paginationOpts: { numItems: 24, cursor: null } })).rejects.toThrow();
    const opts = { numItems: 24, cursor: null as string | null };
    const first = await f.admin.query(api.functions.academic.resultPublication.listReleasedClasses, { paginationOpts: opts });
    expect(first.page).toHaveLength(24);
    const archivedTuple = { sessionId: first.page[0].sessionId, termId: first.page[0].termId, classId: first.page[0].classId };
    const selected = await f.admin.query(api.functions.academic.resultPublication.getReleaseSelection, archivedTuple);
    expect(selected).toMatchObject({ released: true, session: { isArchived: true }, term: { isArchived: true }, klass: { isArchived: true } });
    expect((await f.admin.query(api.functions.academic.resultPublication.getClassReadiness, archivedTuple)).released).not.toBeNull();
    let cursor = first.continueCursor;
    let total = first.page.length;
    while (true) {
      const page = await f.admin.query(api.functions.academic.resultPublication.listReleasedClasses,
        { paginationOpts: { ...opts, cursor } });
      total += page.page.length;
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(total).toBe(257);
    const classPage = await f.admin.query(api.functions.academic.resultPublication.listReleaseClasses, { paginationOpts: opts });
    expect(classPage.page).toHaveLength(24);
    expect(classPage.isDone).toBe(false);
    const termPage = await f.admin.query(api.functions.academic.resultPublication.listReleaseTerms,
      { sessionId: f.ids.sessionId, paginationOpts: opts });
    expect(termPage.page).toHaveLength(24);
    expect(termPage.isDone).toBe(false);
    const sessionPage = await f.admin.query(api.functions.academic.resultPublication.listReleaseSessions, { paginationOpts: opts });
    expect(sessionPage.page).toHaveLength(24);
    expect(sessionPage.isDone).toBe(false);
    expect((await f.admin.query(api.functions.academic.resultPublication.getReleaseSelection, f.tuple))?.session)
      .toMatchObject({ id: f.ids.sessionId, isActive: true });
    expect((await f.admin.query(api.functions.academic.resultPublication.getReleaseSelection, f.tuple))?.released).toBe(false);
    expect(await f.officer.query(api.functions.academic.resultPublication.getReleaseSelection,
      { ...f.tuple, classId: f.ids.otherClassId })).toBeNull();
    const otherSessionId = await f.t.run(ctx => ctx.db.insert("academicSessions", {
      schoolId: f.ids.otherSchoolId, name: "Other school session", startDate: 1, endDate: 2,
      isActive: true, createdAt: 1, updatedAt: 1 }));
    await expect(f.officer.query(api.functions.academic.resultPublication.listReleaseTerms,
      { sessionId: otherSessionId, paginationOpts: opts })).rejects.toThrow("Invalid session");
    await f.certify();
    const ready = await f.readiness();
    expect(ready.ready).toBe(true);
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    expect(await f.read()).not.toBeNull();
  });

  it("does not permit a new release for an archived tuple", async () => {
    const f = await fixture();
    await f.certify();
    const ready = await f.readiness();
    await f.t.run(ctx => ctx.db.patch(f.ids.classId, { isArchived: true }));
    await expect(f.readiness()).rejects.toThrow("Archived class");
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow("Archived class");
  });

  it("audits admin pause and blocks direct new releases without hiding existing issued results", async () => {
    const f = await fixture();
    await f.certify();
    const ready = await f.readiness();
    await expect(f.officer.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { releasesPaused: true, reason: "Emergency school rollback" })).rejects.toThrow();
    await f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { releasesPaused: true, reason: "Emergency school rollback" });
    expect((await f.officer.query(api.functions.academic.resultPublication.getReleaseContext, {})).canRelease).toBe(false);
    await expect(f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation })).rejects.toThrow("paused");
    expect(await f.read()).toBeNull();
    await f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { releasesPaused: false, reason: "Rollback review completed" });
    await f.officer.mutation(api.functions.academic.resultPublication.releaseClassResults,
      { ...f.tuple, reviewedKey: ready.reviewKey!, confirmation });
    const issued = await f.read();
    await f.admin.mutation(api.functions.academic.resultPublication.setReleasesPaused,
      { releasesPaused: true, reason: "Stop further school releases" });
    expect(await f.read()).toEqual(issued);
    const events = await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school", q => q.eq("schoolId", f.ids.schoolId)).collect());
    expect(events.filter(e => e.action === "result_release.pause")).toHaveLength(2);
    expect(events.filter(e => e.action === "result_release.resume")).toHaveLength(1);
  });
});
