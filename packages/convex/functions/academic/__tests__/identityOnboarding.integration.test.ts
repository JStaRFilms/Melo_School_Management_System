import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import schema from "../../../schema";
import { createCanonicalStudentEnrollmentHelper } from "../studentEnrollment";
import { getStudentClassForSession } from "../studentClassMembership";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
const rateModules = import.meta.glob("../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts");

const authStore = vi.hoisted(() => ({
  users: new Map<string, { id: string; email: string; name: string }>(),
  passwords: new Map<string, string>(),
  next: 0,
  resets: 0,
  failLink: false,
  failHash: false,
}));
vi.mock("../../../betterAuth", () => ({
  authComponent: { clientApi: () => ({ getAuthUser: () => null }), safeGetAuthUser: async () => null },
  createAuth: () => ({ $context: Promise.resolve({
    password: { config: { minPasswordLength: 8, maxPasswordLength: 128 }, hash: async (value: string) => {
      if (authStore.failHash) throw new Error("Mock password preparation failure");
      return `hashed:${value}`;
    } },
    internalAdapter: {
      findUserByEmail: async (email: string) => {
        const user = authStore.users.get(email);
        return user ? { user, accounts: authStore.passwords.has(user.id) ? [{ id: user.id, providerId: "credential" }] : [] } : null;
      },
      createUser: async (values: { email: string; name: string }) => {
        const user = { ...values, id: `portal-auth-${++authStore.next}` };
        authStore.users.set(user.email, user);
        return user;
      },
      linkAccount: async (values: { userId: string; password: string }) => {
        if (authStore.failLink) throw new Error("Mock credential link failure");
        authStore.passwords.set(values.userId, values.password);
      },
      updatePassword: async (id: string, password: string) => { authStore.passwords.set(id, password); authStore.resets++; },
      updateUser: async (id: string, values: { name: string; email: string }) => {
        for (const [email, user] of authStore.users) if (user.id === id) {
          authStore.users.delete(email); authStore.users.set(values.email, { ...user, ...values }); break;
        }
      },
      deleteSessions: async () => undefined,
      deleteUser: async (id: string) => {
        for (const [email, user] of authStore.users) if (user.id === id) authStore.users.delete(email);
        authStore.passwords.delete(id);
      },
    },
  }) }),
}));
declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}
const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
  `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module,
]));
const enrollment = api.functions.academic.studentEnrollment;
const identity = { subject: "b1-admin", tokenIdentifier: "https://auth.test|b1-admin" };

beforeEach(() => { authStore.users.clear(); authStore.passwords.clear(); authStore.next = 0; authStore.resets = 0; authStore.failLink = false; authStore.failHash = false; vi.stubEnv("CONVEX_SITE_URL", "https://school.convex.site"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const now = 1;
    const schoolId = await ctx.db.insert("schools", { name: "B1 School", slug: "b1", status: "active", createdAt: now, updatedAt: now });
    const foreignSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other", status: "active", createdAt: now, updatedAt: now });
    const adminId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "School Admin", email: "admin@school.test", role: "admin", createdAt: now, updatedAt: now });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "Primary", createdAt: now, updatedAt: now });
    const nextClassId = await ctx.db.insert("classes", { schoolId, name: "Primary 2", level: "Primary", createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026/27", startDate: 1, endDate: 100, isActive: true, createdAt: now, updatedAt: now });
    return { schoolId, foreignSchoolId, adminId, classId, nextClassId, sessionId };
  });
  const actor = t.withIdentity(identity);
  const studentId = await actor.mutation(enrollment.createStudent, { firstName: "Mary Anne", lastName: "Van Dyke", admissionNumber: "B1/001", gender: "Female", classId: ids.classId });
  const profile = await actor.query(enrollment.getStudentProfile, { studentId });
  return { t, actor, ids, studentId, userId: profile.userId };
}

test("identity saves preserve canonical links, promotion, historical and active subjects; stale assignment requires review", async () => {
  const f = await fixture();
  const seeded = await f.t.run(async ctx => {
    const personId = await ctx.db.insert("persons", { name: "Mary Anne Van Dyke", email: "legacy@school.test", authTokenIdentifier: "https://school.convex.site|existing-auth", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.patch(f.userId, { personId, authId: "existing-auth", authTokenIdentifier: "https://school.convex.site|existing-auth" });
    const promotionId = await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.studentId, fromClassId: f.ids.classId, fromSessionId: f.ids.sessionId, toClassId: f.ids.nextClassId, toSessionId: f.ids.sessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "b1-promotion", createdAt: 2, createdBy: f.ids.adminId });
    const subjectId = await ctx.db.insert("subjects", { schoolId: f.ids.schoolId, name: "Math", code: "MTH", createdAt: 1, updatedAt: 1 });
    const selectionId = await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, subjectId, createdAt: 1, updatedAt: 1 });
    return { personId, promotionId, selectionId };
  });
  const before = await f.t.run(async ctx => ({ promotion: await ctx.db.get(seeded.promotionId), selection: await ctx.db.get(seeded.selectionId), user: await ctx.db.get(f.userId) }));
  const promoted = await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId });
  expect(promoted).toMatchObject({ firstName: "Mary", middleName: "Anne", lastName: "Van Dyke", classId: f.ids.nextClassId, activeSessionId: f.ids.sessionId });
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, firstName: "Maria", admissionNumber: "B1/001", classId: f.ids.classId, address: "New road" });
  const after = await f.t.run(async ctx => ({ promotion: await ctx.db.get(seeded.promotionId), selection: await ctx.db.get(seeded.selectionId), user: await ctx.db.get(f.userId), student: await ctx.db.get(f.studentId) }));
  expect(after.promotion).toEqual(before.promotion);
  expect(after.selection).toEqual(before.selection);
  expect(after.user).toMatchObject({ personId: seeded.personId, authId: "existing-auth", authTokenIdentifier: before.user?.authTokenIdentifier, email: before.user?.email, middleName: "Anne" });
  expect(after.student?.classId).toBe(f.ids.classId);
  await expect(f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, classId: f.ids.classId, confirmClassAssignment: true, expectedClassId: f.ids.classId, expectedSessionId: f.ids.sessionId })).rejects.toThrow("Reload");
  expect(await f.t.run(ctx => ctx.db.get(seeded.promotionId))).toEqual(before.promotion);
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, classId: f.ids.classId, confirmClassAssignment: true, expectedClassId: f.ids.nextClassId, expectedSessionId: f.ids.sessionId });
  expect(await f.t.run(ctx => ctx.db.get(seeded.promotionId))).toBeNull();
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, middleName: null });
  expect((await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId })).middleName).toBeNull();
});

test("requires current explicit null-session class review and leaves inactive academic records unchanged", async () => {
  const f = await fixture();
  const records = await f.t.run(async ctx => {
    await ctx.db.patch(f.ids.sessionId, { isActive: false });
    const subjectId = await ctx.db.insert("subjects", { schoolId: f.ids.schoolId, name: "Math", code: "MTH", createdAt: 1, updatedAt: 1 });
    const selectionId = await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.classId, sessionId: f.ids.sessionId, subjectId, createdAt: 1, updatedAt: 1 });
    const promotionId = await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.studentId, fromClassId: f.ids.classId, fromSessionId: f.ids.sessionId, toClassId: f.ids.nextClassId, toSessionId: f.ids.sessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "inactive-review", createdAt: 2, createdBy: f.ids.adminId });
    return { selectionId, promotionId };
  });
  const history = () => f.t.run(async ctx => ({ selection: await ctx.db.get(records.selectionId), promotion: await ctx.db.get(records.promotionId) }));
  const before = await history();
  const reviewed = { studentId: f.studentId, classId: f.ids.nextClassId, confirmClassAssignment: true, expectedClassId: f.ids.classId };
  await expect(f.actor.mutation(enrollment.updateStudent, reviewed)).rejects.toThrow("Reload");
  await expect(f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, classId: f.ids.nextClassId, confirmClassAssignment: true, expectedSessionId: null })).rejects.toThrow("Reload");
  await expect(f.actor.mutation(enrollment.updateStudent, { ...reviewed, expectedSessionId: f.ids.sessionId })).rejects.toThrow("Reload");
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, firstName: "Maria", classId: f.ids.nextClassId, expectedSessionId: null });
  expect((await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId }))).toMatchObject({ classId: f.ids.classId, activeSessionId: null, firstName: "Maria" });
  expect(await history()).toEqual(before);

  await f.t.run(ctx => ctx.db.patch(f.ids.sessionId, { isActive: true }));
  await expect(f.actor.mutation(enrollment.updateStudent, { ...reviewed, classId: f.ids.classId, expectedClassId: f.ids.nextClassId, expectedSessionId: null })).rejects.toThrow("Reload");
  await f.t.run(ctx => ctx.db.patch(f.ids.sessionId, { isActive: false }));
  await f.actor.mutation(enrollment.updateStudent, { ...reviewed, expectedSessionId: null });
  expect((await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId }))).toMatchObject({ classId: f.ids.nextClassId, activeSessionId: null });
  await expect(f.actor.mutation(enrollment.updateStudent, { ...reviewed, classId: f.ids.classId, expectedSessionId: null })).rejects.toThrow("Reload");
  expect(await history()).toEqual(before);
});

test("promoted-session subject clear, all and toggle preserve base class and older results and issued snapshots", async () => {
  const f = await fixture();
  const ids = await f.t.run(async ctx => {
    const oldSessionId = await ctx.db.insert("academicSessions", { schoolId: f.ids.schoolId, name: "2025/26", startDate: 0, endDate: 1, isActive: false, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId: f.ids.schoolId, sessionId: oldSessionId, name: "Third", startDate: 0, endDate: 1, isActive: false, createdAt: 1, updatedAt: 1 });
    const subjectIds = await Promise.all(["Math", "Science"].map(name => ctx.db.insert("subjects", { schoolId: f.ids.schoolId, name, code: name, createdAt: 1, updatedAt: 1 })));
    for (const subjectId of subjectIds) await ctx.db.insert("classSubjects", { schoolId: f.ids.schoolId, classId: f.ids.nextClassId, subjectId, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classSubjects", { schoolId: f.ids.schoolId, classId: f.ids.classId, subjectId: subjectIds[0], createdAt: 1, updatedAt: 1 });
    const promotionId = await ctx.db.insert("studentPromotions", { schoolId: f.ids.schoolId, studentId: f.studentId, fromClassId: f.ids.classId, fromSessionId: oldSessionId, toClassId: f.ids.nextClassId, toSessionId: f.ids.sessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "subject-promotion", createdAt: 2, createdBy: f.ids.adminId });
    const historicalSelectionId = await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.classId, sessionId: oldSessionId, subjectId: subjectIds[0], createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("studentSubjectSelections", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, subjectId: subjectIds[0], createdAt: 1, updatedAt: 1 });
    const assessmentId = await ctx.db.insert("assessmentRecords", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.classId, sessionId: oldSessionId, termId, subjectId: subjectIds[0], ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "B", remark: "Good", examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: f.ids.adminId, updatedBy: f.ids.adminId, createdAt: 1, updatedAt: 1 });
    const foreignClassId = await ctx.db.insert("classes", { schoolId: f.ids.foreignSchoolId, name: "Foreign", level: "Primary", createdAt: 1, updatedAt: 1 });
    const foreignSessionId = await ctx.db.insert("academicSessions", { schoolId: f.ids.foreignSchoolId, name: "Foreign", startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 });
    const foreignStudentId = await ctx.db.insert("students", { schoolId: f.ids.foreignSchoolId, userId: f.userId, classId: foreignClassId, admissionNumber: "FOREIGN", createdAt: 1, updatedAt: 1 });
    return { oldSessionId, termId, subjectIds, promotionId, historicalSelectionId, assessmentId, foreignClassId, foreignSessionId, foreignStudentId };
  });
  const report = await f.actor.query(api.functions.academic.reportCards.getStudentReportCard, { studentId: f.studentId, classId: f.ids.classId, sessionId: ids.oldSessionId, termId: ids.termId });
  const reportId = await f.t.run(ctx => ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId: f.studentId, classId: f.ids.classId, sessionId: ids.oldSessionId, termId: ids.termId, issuedAt: 2, issuedBy: f.ids.adminId, report }));
  const history = () => f.t.run(async ctx => ({ selection: await ctx.db.get(ids.historicalSelectionId), result: await ctx.db.get(ids.assessmentId), report: await ctx.db.get(reportId), promotion: await ctx.db.get(ids.promotionId) }));
  const before = await history();
  expect(await f.t.run(async ctx => {
    const student = await ctx.db.get(f.studentId);
    if (!student) throw new Error("Missing student");
    return await getStudentClassForSession(ctx, { student, schoolId: f.ids.schoolId, sessionId: ids.oldSessionId });
  })).toBe(f.ids.classId);
  const args = { studentId: f.studentId, classId: f.ids.nextClassId, sessionId: f.ids.sessionId, subjectIds: ids.subjectIds };
  await f.actor.mutation(enrollment.setStudentSubjectSelections, { ...args, subjectIds: [] });
  expect(await f.actor.query(enrollment.getStudentSubjectSelections, { studentId: f.studentId, sessionId: f.ids.sessionId })).toEqual([]);
  await f.actor.mutation(enrollment.setStudentSubjectSelections, args);
  expect(await f.actor.query(enrollment.getStudentSubjectSelections, { studentId: f.studentId, sessionId: f.ids.sessionId })).toHaveLength(2);
  await f.actor.mutation(enrollment.setStudentSubjectSelections, { ...args, subjectIds: [ids.subjectIds[1]] });
  expect((await f.actor.query(enrollment.getStudentSubjectSelections, { studentId: f.studentId, sessionId: f.ids.sessionId })).map(row => row.subjectId)).toEqual([ids.subjectIds[1]]);
  await expect(f.actor.mutation(enrollment.setStudentSubjectSelections, { ...args, classId: f.ids.classId })).rejects.toThrow("not enrolled");
  await expect(f.actor.mutation(enrollment.setStudentSubjectSelections, { ...args, sessionId: ids.oldSessionId })).rejects.toThrow("not enrolled");
  for (const invalid of [{ classId: ids.foreignClassId }, { sessionId: ids.foreignSessionId }, { studentId: ids.foreignStudentId }]) await expect(f.actor.mutation(enrollment.setStudentSubjectSelections, { ...args, ...invalid })).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.studentId, { isArchived: true }));
  await expect(f.actor.mutation(enrollment.setStudentSubjectSelections, args)).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.studentId, { isArchived: undefined }));
  await f.t.run(ctx => ctx.db.patch(f.ids.sessionId, { isArchived: true }));
  await expect(f.actor.mutation(enrollment.setStudentSubjectSelections, args)).rejects.toThrow();
  await f.t.run(ctx => ctx.db.patch(f.ids.sessionId, { isArchived: undefined }));
  const teacherToken = "https://auth.test|subject-teacher";
  const teacherId = await f.t.run(async ctx => {
    const personId = await ctx.db.insert("persons", { name: "Subject Teacher", email: "teacher@school.test", authTokenIdentifier: teacherToken, status: "active", identityReconciliationState: "resolved", createdAt: 1, updatedAt: 1 });
    const userId = await ctx.db.insert("users", { schoolId: f.ids.schoolId, personId, authId: "subject-teacher", authTokenIdentifier: teacherToken, name: "Subject Teacher", email: "teacher@school.test", role: "teacher", createdAt: 1, updatedAt: 1 });
    const membershipId = await ctx.db.insert("branchMemberships", { personId, schoolId: f.ids.schoolId, legacyUserId: userId, status: "active", isDefaultBranch: true, permissionsManagedAt: 1, joinedAt: 1, updatedAt: 1 });
    await ctx.db.insert("membershipDirectGrants", { membershipId, capability: "enrollment.intakes.manage", grantedAt: 1 });
    return userId;
  });
  const teacher = f.t.withIdentity({ subject: "subject-teacher", tokenIdentifier: teacherToken });
  await expect(teacher.mutation(enrollment.setStudentSubjectSelections, args)).rejects.toThrow("Not assigned");
  await f.t.run(ctx => ctx.db.insert("teacherAssignments", { schoolId: f.ids.schoolId, teacherId, classId: f.ids.nextClassId, subjectId: ids.subjectIds[0], createdAt: 1, updatedAt: 1 }));
  await teacher.mutation(enrollment.setStudentSubjectSelections, args);
  expect(await f.actor.query(enrollment.getStudentSubjectSelections, { studentId: f.studentId, sessionId: f.ids.sessionId })).toHaveLength(2);
  expect((await f.t.run(ctx => ctx.db.get(f.studentId)))?.classId).toBe(f.ids.classId);
  expect(await history()).toEqual(before);
});

test("no-household admission keeps a captured address visible with the default address policy", async () => {
  const f = await fixture();
  const studentId = await f.actor.mutation(enrollment.createStudent, {
    firstName: "Ada", lastName: "Student", gender: "Female", admissionNumber: "ADDRESS/1",
    classId: f.ids.classId, parentGuardian: { kind: "none" }, address: "Captured student address",
  });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId })).toMatchObject({
    address: "Captured student address", storedAddress: "Captured student address",
    addressMode: "different", addressSource: "different",
  });
  expect((await f.t.run(ctx => ctx.db.get(studentId)))?.familyId).toBeUndefined();
});

test("standalone, family and canonical helper creation reopen every captured field and preserve legacy photos", async () => {
  const f = await fixture();
  const birth = Date.UTC(2018, 4, 12);
  const standaloneId = await f.actor.mutation(enrollment.createStudent, { firstName: "Mary Anne", middleName: "Grace", lastName: "Van Dyke", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Standalone home", addressMode: "different", emergencyContactMode: "override", guardianName: "Legacy carer", guardianPhone: "08012345678", admissionNumber: "ROUND/1", classId: f.ids.classId, parentGuardian: { kind: "none" } });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: standaloneId })).toMatchObject({ name: "Mary Anne Grace Van Dyke", firstName: "Mary Anne", middleName: "Grace", lastName: "Van Dyke", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Standalone home", storedAddress: "Standalone home", addressSource: "different", addressMode: "different", emergencyContactMode: "override", emergencyContact: { source: "override", name: "Legacy carer", phone: "08012345678" } });
  const familyId = await f.actor.mutation(enrollment.createStudent, { firstName: "Mary Anne", lastName: "Van Dyke", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Family home", emergencyContactMode: "primary", admissionNumber: "ROUND/2", classId: f.ids.classId, parentGuardian: { kind: "new", firstName: "Grace", middleName: "Helen", lastName: "Anthony", email: "roundtrip-parent@school.edu.ng", phone: "08012345678" } });
  const familyProfile = await f.actor.query(enrollment.getStudentFamilyProfile, { studentId: familyId });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: familyId })).toMatchObject({ name: "Mary Anne Van Dyke", firstName: "Mary", middleName: "Anne", lastName: "Van Dyke", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Family home", addressSource: "residential", addressMode: "residential", emergencyContactMode: "primary", emergencyContact: { source: "primary", name: "Grace Helen Anthony" } });
  const direct = await f.t.run(async ctx => {
    const photoStorageId = await ctx.storage.store(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }));
    const created = await createCanonicalStudentEnrollmentHelper(ctx, { schoolId: f.ids.schoolId, classId: f.ids.classId, name: "Ignored display cache", firstName: "Jo Anne", middleName: "Grace", lastName: "Van Dyke", admissionNumber: "ROUND/3", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Retained home", guardianName: "Retained legacy carer", guardianPhone: "08099887766", photo: { storageId: photoStorageId, fileName: "legacy.jpg", contentType: "image/jpeg" } });
    return { ...created, photoStorageId };
  });
  await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: direct.studentId, parentUserId: familyProfile.parents[0].parentUserId, confirmDuplicateLink: true });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: direct.studentId })).toMatchObject({ name: "Jo Anne Grace Van Dyke", firstName: "Jo Anne", middleName: "Grace", lastName: "Van Dyke", gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Retained home", addressSource: "legacy", emergencyContact: { source: "legacy", name: "Retained legacy carer" }, photoUrl: expect.any(String) });
  await f.actor.mutation(enrollment.updateStudent, { studentId: direct.studentId, middleName: "Helen" });
  expect(await f.t.run(ctx => ctx.db.get(direct.studentId))).toMatchObject({ familyId: familyProfile.family?._id, gender: "Female", dateOfBirth: birth, houseName: "Blue House", address: "Retained home", guardianName: "Retained legacy carer", photoStorageId: direct.photoStorageId, photoFileName: "legacy.jpg", photoContentType: "image/jpeg" });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: direct.studentId })).toMatchObject({ middleName: "Helen", address: "Retained home", addressMode: null, emergencyContactMode: null, emergencyContact: { source: "legacy" } });
});

test("atomic contact choice preserves existing identity and retries without another admission", async () => {
  const f = await fixture();
  const linked = await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, firstName: "Grace Helen", lastName: "Van Dyke", email: "parent@school.edu.ng", phone: "08012345678", relationship: "Foster carer" });
  const before = await f.t.run(ctx => ctx.db.get(linked.parentUserId));
  const args = { requestKey: "atomic-child", firstName: "Jo", lastName: "Van Dyke", admissionNumber: "B1/002", classId: f.ids.classId, gender: "Male", parentGuardian: { kind: "existing" as const, parentUserId: linked.parentUserId }, confirmDuplicateLink: true };
  const childId = await f.actor.mutation(enrollment.createStudent, args);
  expect(await f.actor.mutation(enrollment.createStudent, args)).toBe(childId);
  expect(await f.t.run(ctx => ctx.db.get(linked.parentUserId))).toEqual(before);
  await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: childId, parentUserId: linked.parentUserId, firstName: "Wrong", lastName: "Identity", phone: "99999999999", confirmDuplicateLink: true });
  expect(await f.t.run(ctx => ctx.db.get(linked.parentUserId))).toEqual(before);
  const profile = await f.actor.query(enrollment.getStudentProfile, { studentId: childId });
  expect(profile.emergencyContact).toMatchObject({ source: "primary", name: "Grace Helen Van Dyke", parentUserId: linked.parentUserId });
  const family = await f.actor.query(enrollment.getStudentFamilyProfile, { studentId: childId });
  expect(family.parents[0].relationship).toBe("Foster carer");
  await expect(f.actor.mutation(enrollment.createStudent, { ...args, firstName: "Changed" })).rejects.toThrow("intent changed");
  const failed = { ...args, requestKey: "invalid-contact", admissionNumber: "B1/003", confirmDuplicateLink: false };
  await expect(f.actor.mutation(enrollment.createStudent, failed)).rejects.toThrow("confirm");
  expect(await f.t.run(ctx => ctx.db.query("students").withIndex("by_school_and_admission_number", q => q.eq("schoolId", f.ids.schoolId).eq("admissionNumber", "B1/003")).first())).toBeNull();
});

test("notice configuration failure preserves committed parent access and the temporary password return", async () => {
  vi.useFakeTimers(); vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("MELO_EMAIL_FROM", "");
  const provider = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No real provider request allowed"));
  const f = await fixture(); f.t.registerComponent("rateLimiter", rateLimiterSchema, rateModules);
  const parent = await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, firstName: "Grace", lastName: "Anthony", email: "grace@example.test" });
  const result = await f.actor.action(enrollment.upsertPortalCredentials, { userId: parent.parentUserId, temporaryPassword: "transient-not-for-email", requestKey: "notice-ready" });
  expect(result).toMatchObject({ operationId: "notice-ready", temporaryPassword: "transient-not-for-email" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const notice = await f.actor.query(api.functions.academic.accountNotices.getAccountNoticeState, { userId: parent.parentUserId });
  expect(notice.notice?.state).toBe("not_configured");
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: parent.parentUserId })).state).toBe("provisioned");
  const reset = await f.actor.action(enrollment.upsertPortalCredentials, { userId: parent.parentUserId, temporaryPassword: "new-transient-not-for-email", requestKey: "notice-reset" });
  expect(reset).toMatchObject({ operationId: "notice-reset", temporaryPassword: "new-transient-not-for-email" });
  const stored = await f.t.run(ctx => ctx.db.get(parent.parentUserId));
  expect(stored?.lastCredentialOperation).toMatchObject({ kind: "reset", operationId: "notice-reset" });
  const rows = await f.t.run(ctx => ctx.db.query("accountNoticeOutbox").withIndex("by_target_user_and_operation", q => q.eq("targetUserId", parent.parentUserId)).take(3));
  expect(JSON.stringify(rows)).not.toContain("transient-not-for-email");
  expect(JSON.stringify(stored)).not.toContain("transient-not-for-email");
  expect(provider).not.toHaveBeenCalled();
});

test("exact-email Grace Anthony match ignores incoming identity typos and consumes one admission on retry", async () => {
  const f = await fixture();
  const parent = await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, firstName: "Grace", lastName: "Anthony", email: "grace.anthony@school.edu.ng", phone: "08012345678", addressMode: "different", addressOverride: "Grace retained address" });
  await f.actor.action(enrollment.upsertPortalCredentials, { userId: parent.parentUserId, temporaryPassword: "original-password", requestKey: "grace-access" });
  const before = await f.t.run(ctx => ctx.db.get(parent.parentUserId));
  if (!before?.personId) throw new Error("Missing provisioned parent");
  const personId = before.personId;
  const personBefore = await f.t.run(ctx => ctx.db.get(personId));
  const credentialBefore = authStore.passwords.get(before.authId);
  const review = await f.actor.query(enrollment.getParentEmailReview, { email: " Grace.Anthony@School.edu.ng " });
  expect(review.matches[0]).toMatchObject({ userId: parent.parentUserId, name: "Grace Anthony" });
  const policyId = await f.t.run(ctx => ctx.db.insert("admissionNumberPolicies", { schoolId: f.ids.schoolId, version: 1, resetPeriod: "continuous", pattern: "{SCHOOL}/{YEAR}/{SEQ:4}", schoolCode: "SCH", campusCode: "MAIN", currentSequence: 10, createdAt: 1, updatedAt: 1 }));
  const claimsBefore = await f.t.run(ctx => ctx.db.query("admissionNumberClaims").withIndex("by_school_number", q => q.eq("schoolId", f.ids.schoolId)).collect());
  const args = { requestKey: "grace-one-enrollment", firstName: "Child", lastName: "Anthony", admissionNumber: "", classId: f.ids.classId, gender: "Female", numberingVersion: 1, numberingFormatVersion: "branch:1:0", numberingCounterKey: "default", numberingCounterVersion: 0, numberingSessionId: f.ids.sessionId, numberingResetPeriod: "continuous", parentGuardian: { kind: "new" as const, firstName: "Mistyped", lastName: "Different", email: "Grace.Anthony@School.edu.ng", phone: "mistyped phone", addressMode: "residential" as const }, confirmDuplicateLink: true };
  const studentId = await f.actor.mutation(enrollment.createStudent, args);
  expect(await f.actor.mutation(enrollment.createStudent, args)).toBe(studentId);
  const profile = await f.actor.query(enrollment.getStudentProfile, { studentId });
  expect(profile.emergencyContact).toMatchObject({ name: "Grace Anthony", parentUserId: parent.parentUserId });
  expect((await f.t.run(ctx => ctx.db.get(policyId)))?.currentSequence).toBe(11);
  expect(await f.t.run(ctx => ctx.db.query("admissionNumberClaims").withIndex("by_school_number", q => q.eq("schoolId", f.ids.schoolId)).collect())).toHaveLength(claimsBefore.length + 1);
  expect(await f.t.run(ctx => ctx.db.query("students").withIndex("by_school_and_admission_number", q => q.eq("schoolId", f.ids.schoolId).eq("admissionNumber", profile.admissionNumber)).collect())).toHaveLength(1);
  await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId, parentUserId: parent.parentUserId, firstName: "Still Wrong", lastName: "Ignored", phone: "also ignored", addressMode: "residential", confirmDuplicateLink: true });
  expect(await f.t.run(ctx => ctx.db.get(parent.parentUserId))).toEqual(before);
  expect(await f.t.run(ctx => ctx.db.get(personId))).toEqual(personBefore);
  expect(authStore.passwords.get(before.authId)).toBe(credentialBefore);
  expect((await f.actor.query(enrollment.getStudentFamilyProfile, { studentId })).parents[0]).toMatchObject({ addressMode: "different", effectiveAddress: "Grace retained address" });
  expect(authStore.users.size).toBe(1);
  expect(authStore.resets).toBe(0);
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: parent.parentUserId })).state).toBe("provisioned");
  await f.actor.mutation(enrollment.updateStudentFamilyParentContact, { familyMemberId: parent.familyMemberId, firstName: "Grace", lastName: "Anthony-Corrected", phone: "08087654321" });
  expect(await f.t.run(ctx => ctx.db.get(parent.parentUserId))).toMatchObject({ name: "Grace Anthony-Corrected", phone: "08087654321", authId: before.authId, personId: before.personId });
  expect(authStore.passwords.get(before.authId)).toBe(credentialBefore);
});

test("household address inheritance, overrides, legacy text and labels stay separate", async () => {
  const f = await fixture();
  const studentId = await f.actor.mutation(enrollment.createStudent, { firstName: "Ada", lastName: "Okafor", admissionNumber: "ADDR/1", gender: "Female", classId: f.ids.classId, address: "Home road", parentGuardian: { kind: "new", firstName: "Grace", middleName: "Anne", lastName: "Okafor", email: "home@school.edu.ng", relationship: "Mother" } });
  const family = await f.actor.query(enrollment.getStudentFamilyProfile, { studentId });
  if (!family.family) throw new Error("Missing household");
  const second = await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId, firstName: "Joe", lastName: "Okafor", email: "away@school.edu.ng", addressMode: "different", addressOverride: "Other road", relationship: "Uncle" });
  await f.actor.mutation(enrollment.updateHousehold, { familyId: family.family._id, name: "Okafor home", residentialAddress: "Changed home", confirmed: true });
  const changed = await f.actor.query(enrollment.getStudentFamilyProfile, { studentId });
  expect(changed.parents.find(parent => parent.parentUserId === second.parentUserId)).toMatchObject({ effectiveAddress: "Other road", addressSource: "different" });
  expect(changed.parents.find(parent => parent.isPrimaryContact)).toMatchObject({ middleName: "Anne", effectiveAddress: "Changed home", addressSource: "residential" });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId })).toMatchObject({ address: "Changed home", storedAddress: "Home road", addressSource: "residential", emergencyContact: { source: "primary" } });
  await f.t.run(ctx => ctx.db.patch(f.studentId, { address: "Legacy road", addressMode: undefined, guardianName: "Old text", guardianPhone: "0123456789", emergencyContactMode: undefined }));
  await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, parentUserId: second.parentUserId, confirmDuplicateLink: true, familyName: "Must not rename" });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId })).toMatchObject({ address: "Legacy road", addressSource: "legacy", emergencyContact: { source: "legacy", name: "Old text" } });
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, emergencyContactMode: "primary" });
  expect((await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId })).emergencyContact.source).toBe("primary");
  expect((await f.actor.query(enrollment.getStudentFamilyProfile, { studentId: f.studentId })).family?.name).toBe("Okafor home");
  await expect(f.actor.mutation(enrollment.updateStudentFamilyParentContact, { familyMemberId: second.familyMemberId, isPrimaryContact: true })).rejects.toThrow("Confirm");
});

test("contact search paginates the school-wide name/email matches and retains directory exclusions", async () => {
  const f = await fixture();
  const ids = await f.t.run(async ctx => {
    for (let i = 0; i < 25; i++) await ctx.db.insert("users", {
      schoolId: f.ids.schoolId, authId: `unrelated-${i}`, name: `Unrelated Contact ${i}`,
      email: `unrelated${i}@mail.example`, role: "parent", createdAt: 1, updatedAt: 1,
    });
    const matches: Id<"users">[] = [];
    for (let i = 0; i < 5; i++) matches.push(await ctx.db.insert("users", {
      schoolId: f.ids.schoolId, authId: `matching-${i}`, name: `Needle Contact ${i}`,
      email: `emailneedle${i}@mail.example`, role: i === 4 ? "teacher" : "parent", createdAt: 1, updatedAt: 1,
    }));
    const excluded: Id<"users">[] = [];
    for (const entry of [
      { role: "parent", isArchived: true, schoolId: f.ids.schoolId },
      { role: "student", isArchived: false, schoolId: f.ids.schoolId },
      { role: "parent", isArchived: false, schoolId: f.ids.foreignSchoolId },
    ] as const) excluded.push(await ctx.db.insert("users", {
      ...entry, authId: `excluded-${excluded.length}`, name: "Needle Excluded",
      email: `emailneedleexcluded${excluded.length}@mail.example`, createdAt: 1, updatedAt: 1,
    }));
    return { matches, excluded };
  });
  for (const searchField of ["name", "email"] as const) {
    const search = searchField === "name" ? "NEED" : "EMAILNEED";
    const searchArgs = { search, ...(searchField === "email" ? { searchField } : {}) };
    const first = await f.actor.query(enrollment.searchParentContacts, { ...searchArgs, paginationOpts: { numItems: 2, cursor: null } });
    expect(first.page).toHaveLength(2);
    expect(first.isDone).toBe(false);
    const second = await f.actor.query(enrollment.searchParentContacts, { ...searchArgs, paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(second.page).toHaveLength(2);
    expect(second.isDone).toBe(false);
    const third = await f.actor.query(enrollment.searchParentContacts, { ...searchArgs, paginationOpts: { numItems: 2, cursor: second.continueCursor } });
    expect(third.page).toHaveLength(1);
    expect(third.isDone).toBe(true);
    expect([...first.page, ...second.page, ...third.page].map(contact => contact.userId).sort()).toEqual([...ids.matches].sort());
  }
  const legacyEmail = await f.actor.query(enrollment.searchParentContacts, { search: "emailneedle0@mail.example", paginationOpts: { numItems: 20, cursor: null } });
  expect(legacyEmail.page.map(contact => contact.userId)).toEqual([ids.matches[0]]);
  const blank = await f.actor.query(enrollment.searchParentContacts, { search: "  ", searchField: "email", paginationOpts: { numItems: 50, cursor: null } });
  expect(blank.isDone).toBe(true);
  expect(blank.page).toHaveLength(31);
  expect(blank.page.some(contact => ids.excluded.includes(contact.userId))).toBe(false);
  await expect(f.t.query(enrollment.searchParentContacts, { search: "Need", paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow();
});

test("picker isolation and deletion guard archived students, retained references and foreign identities", async () => {
  const f = await fixture();
  const linked = await f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, firstName: "Grace", lastName: "Okafor", email: "parent@school.edu.ng" });
  const foreign = await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.foreignSchoolId, authId: "foreign", name: "Foreign Parent", email: "foreign@school.edu.ng", role: "parent", createdAt: 1, updatedAt: 1 }));
  await expect(f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, parentUserId: foreign })).rejects.toThrow("not available");
  await expect(f.actor.mutation(enrollment.upsertStudentFamilyLink, { studentId: f.studentId, parentUserId: f.userId })).rejects.toThrow("not available");
  const picker = await f.actor.query(enrollment.searchParentContacts, { search: "parent@", paginationOpts: { numItems: 50, cursor: null } });
  expect(picker.page.map(parent => parent.userId)).toEqual([linked.parentUserId]);
  await f.t.run(ctx => ctx.db.patch(f.studentId, { isArchived: true }));
  await expect(f.actor.mutation(enrollment.deleteUnusedParent, { parentUserId: linked.parentUserId, confirmed: true })).rejects.toThrow("archived");
  await f.t.run(ctx => ctx.db.patch(f.studentId, { familyId: undefined }));
  await expect(f.actor.mutation(enrollment.deleteUnusedParent, { parentUserId: foreign, confirmed: true })).rejects.toThrow("not found");
  await expect(f.actor.mutation(enrollment.deleteUnusedParent, { parentUserId: linked.parentUserId, confirmed: false })).rejects.toThrow("Confirm");
  const retained = await f.t.run(ctx => ctx.db.insert("enrollmentRequests", { schoolId: f.ids.schoolId, key: "retained-parent-reference", userId: linked.parentUserId, studentId: f.studentId }));
  await expect(f.actor.mutation(enrollment.deleteUnusedParent, { parentUserId: linked.parentUserId, confirmed: true })).rejects.toThrow("retained references");
  await f.t.run(ctx => ctx.db.delete(retained));
  await f.actor.mutation(enrollment.deleteUnusedParent, { parentUserId: linked.parentUserId, confirmed: true });
  expect(await f.t.run(ctx => ctx.db.get(linked.parentUserId))).toBeNull();
  expect(await f.t.run(ctx => ctx.db.get(linked.familyId))).toBeNull();
});

test("stable school login IDs, domain governance, collision safety and existing unprovisioned logins", async () => {
  const f = await fixture();
  const before = await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId });
  expect(before.email).toContain(`@${f.ids.schoolId}.students.local`);
  const domains = api.functions.academic.institutionalEmail;
  const domainId = await f.t.run(ctx => ctx.db.insert("schoolEmailDomains", { schoolId: f.ids.schoolId, domain: "school.edu.ng", status: "verified", verifiedAt: 1, dnsTxtRecord: "proof", provider: "none", isDefault: false, createdAt: 1, updatedAt: 1 }));
  await f.actor.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.schoolId, domainId, expectedVersion: 0, confirmed: true });
  await expect(f.actor.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.schoolId, domainId: null, expectedVersion: 0, confirmed: true })).rejects.toThrow("Reload");
  const second = await f.actor.mutation(enrollment.createStudent, { firstName: "Mary", lastName: "Van Dyke", admissionNumber: "B1-001", gender: "Female", classId: f.ids.classId });
  const secondProfile = await f.actor.query(enrollment.getStudentProfile, { studentId: second });
  expect(secondProfile.email).toMatch(/@school\.edu\.ng$/);
  expect(secondProfile.email).not.toBe(before.email);
  await f.actor.mutation(enrollment.updateStudent, { studentId: f.studentId, name: "Unstructured Legacy Full Name" });
  expect(await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId })).toMatchObject({ name: "Unstructured Legacy Full Name", firstName: null, middleName: null, email: before.email });
  await f.t.run(ctx => ctx.db.patch(domainId, { status: "failed" }));
  expect((await f.actor.query(domains.getStudentLoginPolicy, { schoolId: f.ids.schoolId })).state).toBe("needs_review");
  await expect(f.actor.mutation(enrollment.createStudent, { firstName: "A", lastName: "B", admissionNumber: "B1/004", gender: "Male", classId: f.ids.classId })).rejects.toThrow("review");
  await expect(f.actor.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.foreignSchoolId, domainId, expectedVersion: 0, confirmed: true })).rejects.toThrow();
});

test("verified shared suffixes allocate different IDs across schools and revoked sharing blocks new admissions only", async () => {
  const f = await fixture();
  const foreignIdentity = { subject: "b1-foreign", tokenIdentifier: "https://auth.test|b1-foreign" };
  const ids = await f.t.run(async ctx => {
    await ctx.db.insert("users", { schoolId: f.ids.foreignSchoolId, authId: foreignIdentity.subject, authTokenIdentifier: foreignIdentity.tokenIdentifier, name: "Foreign Admin", email: "admin@foreign.edu.ng", role: "admin", createdAt: 1, updatedAt: 1 });
    const foreignClassId = await ctx.db.insert("classes", { schoolId: f.ids.foreignSchoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 });
    const domainId = await ctx.db.insert("schoolEmailDomains", { schoolId: f.ids.schoolId, domain: "shared.edu.ng", status: "pending_verification", dnsTxtRecord: "proof", provider: "none", isDefault: false, createdAt: 1, updatedAt: 1 });
    const proprietor = await ctx.db.insert("persons", { name: "Group Owner", email: "owner@shared.edu.ng", status: "active", createdAt: 1, updatedAt: 1 });
    const groupId = await ctx.db.insert("schoolGroups", { name: "Shared group", slug: "shared", proprietorPersonId: proprietor, status: "active", createdAt: 1, updatedAt: 1 });
    for (const schoolId of [f.ids.schoolId, f.ids.foreignSchoolId]) await ctx.db.insert("schoolGroupBranches", { schoolId, groupId, isHeadquarters: schoolId === f.ids.schoolId, linkedAt: 1 });
    return { foreignClassId, domainId, groupId };
  });
  const foreign = f.t.withIdentity(foreignIdentity);
  const domains = api.functions.academic.institutionalEmail;
  await expect(f.actor.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.schoolId, domainId: ids.domainId, expectedVersion: 0, confirmed: true })).rejects.toThrow("review");
  await f.t.run(ctx => ctx.db.patch(ids.domainId, { status: "verified", verifiedAt: 1 }));
  await expect(foreign.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.foreignSchoolId, domainId: ids.domainId, expectedVersion: 0, confirmed: true })).rejects.toThrow("does not belong");
  await f.t.run(ctx => ctx.db.patch(ids.domainId, { sharedGroupId: ids.groupId }));
  await foreign.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.foreignSchoolId, domainId: ids.domainId, expectedVersion: 0, confirmed: true });
  await f.actor.mutation(domains.saveStudentLoginPolicy, { schoolId: f.ids.schoolId, domainId: ids.domainId, expectedVersion: 0, confirmed: true });
  const studentA = await f.actor.mutation(enrollment.createStudent, { firstName: "A", lastName: "Student", gender: "Male", admissionNumber: "SAME/001", classId: f.ids.classId });
  const studentB = await foreign.mutation(enrollment.createStudent, { firstName: "B", lastName: "Student", gender: "Male", admissionNumber: "SAME/001", classId: ids.foreignClassId });
  const a = await f.actor.query(enrollment.getStudentProfile, { studentId: studentA });
  const b = await foreign.query(enrollment.getStudentProfile, { studentId: studentB });
  expect(a.email).toMatch(/@shared\.edu\.ng$/);
  expect(b.email).toMatch(/@shared\.edu\.ng$/);
  expect(a.email).not.toBe(b.email);
  await f.t.run(ctx => ctx.db.patch(ids.domainId, { sharedGroupId: undefined }));
  expect((await foreign.query(domains.getStudentLoginPolicy, { schoolId: f.ids.foreignSchoolId })).state).toBe("needs_review");
  expect((await foreign.query(enrollment.getStudentProfile, { studentId: studentB })).email).toBe(b.email);
});

test("portal success persists canonical membership, reopens truthfully, authorizes portal and never stores passwords", async () => {
  const f = await fixture();
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("not_provisioned");
  const result = await f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "transient-password", requestKey: "provision-once" });
  expect(result.operationId).toBe("provision-once");
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("provisioned");
  const user = await f.t.run(ctx => ctx.db.get(f.userId));
  if (!user) throw new Error("Missing user");
  expect(JSON.stringify(user)).not.toContain("transient-password");
  expect(user.authTokenIdentifier).toBe(`https://school.convex.site|${user.authId}`);
  expect(await f.t.withIdentity({ subject: user.authId, tokenIdentifier: user.authTokenIdentifier }).query(api.functions.portal.canAccessPortal, {})).toBe(true);
  await expect(f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "different-password", requestKey: "provision-once" })).rejects.toThrow("already run");
  await f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "different-password", requestKey: "reset-once" });
  expect(authStore.resets).toBe(1);
  expect((await f.t.run(ctx => ctx.db.get(f.userId)))?.email).toBe(result.email);
});

for (const provisioned of [false, true]) {
  test(`password preparation failure preserves ${provisioned ? "provisioned reset" : "unprovisioned"} state`, async () => {
    const f = await fixture();
    if (provisioned) await f.actor.action(enrollment.upsertPortalCredentials, {
      userId: f.userId, temporaryPassword: "original-password", requestKey: "initial-provision",
    });
    const before = await f.t.run(ctx => ctx.db.get(f.userId));
    const hashes = [...authStore.passwords.entries()];
    const users = [...authStore.users.entries()];
    authStore.failHash = true;
    const args = { userId: f.userId, temporaryPassword: "correct-password", requestKey: "preparation-retry" };
    await expect(f.actor.action(enrollment.upsertPortalCredentials, args)).rejects.toThrow("preparation failure");
    expect(await f.t.run(ctx => ctx.db.get(f.userId))).toEqual(before);
    expect([...authStore.passwords.entries()]).toEqual(hashes);
    expect([...authStore.users.entries()]).toEqual(users);
    authStore.failHash = false;
    await f.actor.action(enrollment.upsertPortalCredentials, args);
    expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("provisioned");
  });
  test.each([
    ["short", "short", "at least 8"],
    ["long", "x".repeat(129), "at most 128"],
  ])(`invalid %s password preserves ${provisioned ? "provisioned reset" : "unprovisioned"} state and permits correction`, async (_label, password, error) => {
    const f = await fixture();
    if (provisioned) await f.actor.action(enrollment.upsertPortalCredentials, {
      userId: f.userId, temporaryPassword: "original-password", requestKey: "initial-provision",
    });
    const before = await f.t.run(ctx => ctx.db.get(f.userId));
    const hashes = [...authStore.passwords.entries()];
    const users = [...authStore.users.entries()];
    const args = { userId: f.userId, temporaryPassword: password, requestKey: "correctable-operation" };
    await expect(f.actor.action(enrollment.upsertPortalCredentials, args)).rejects.toThrow(error);
    expect(await f.t.run(ctx => ctx.db.get(f.userId))).toEqual(before);
    expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe(provisioned ? "provisioned" : "not_provisioned");
    expect([...authStore.passwords.entries()]).toEqual(hashes);
    expect([...authStore.users.entries()]).toEqual(users);
    expect(authStore.resets).toBe(0);
    await f.actor.action(enrollment.upsertPortalCredentials, { ...args, temporaryPassword: "corrected-password" });
    expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("provisioned");
    expect(authStore.resets).toBe(provisioned ? 1 : 0);
  });
}

test("unowned global auth email fails closed; partial credential failure is reconciliation, not success", async () => {
  const f = await fixture();
  const profile = await f.actor.query(enrollment.getStudentProfile, { studentId: f.studentId });
  authStore.users.set(profile.email, { id: "unowned-auth", name: "Someone else", email: profile.email });
  authStore.passwords.set("unowned-auth", "untouched-hash");
  await expect(f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "new-password" })).rejects.toThrow("Reconciliation");
  expect(authStore.passwords.get("unowned-auth")).toBe("untouched-hash");
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("reconciliation_required");
  authStore.users.clear(); authStore.passwords.clear(); authStore.failLink = true;
  await expect(f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "new-password" })).rejects.toThrow("Failed to link");
  expect(authStore.users.size).toBe(0);
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("reconciliation_required");
  authStore.failLink = false;
  await f.actor.action(enrollment.upsertPortalCredentials, { userId: f.userId, temporaryPassword: "new-password" });
  expect((await f.actor.query(enrollment.getPortalAccountState, { userId: f.userId })).state).toBe("provisioned");
});

test("teacher full-name renames clear stale parts; structured middle edits preserve explicit omission", async () => {
  const f = await fixture();
  const teacherId = await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: "teacher", name: "Jane Helen Smith", firstName: "Jane", middleName: "Helen", lastName: "Smith", email: "teacher@school.edu.ng", role: "teacher", createdAt: 1, updatedAt: 1 }));
  await f.t.mutation(internal.functions.academic.academicSetup.updateTeacherRecordInternal, { teacherId, schoolId: f.ids.schoolId, name: "Jane Jones", email: "teacher@school.edu.ng" });
  expect(await f.t.run(ctx => ctx.db.get(teacherId))).toMatchObject({ name: "Jane Jones" });
  expect((await f.t.run(ctx => ctx.db.get(teacherId)))?.lastName).toBeUndefined();
  await f.t.mutation(internal.functions.academic.academicSetup.updateTeacherRecordInternal, { teacherId, schoolId: f.ids.schoolId, firstName: "Jane Anne", lastName: "Van Jones", email: "teacher@school.edu.ng" });
  expect(await f.t.run(ctx => ctx.db.get(teacherId))).toMatchObject({ name: "Jane Anne Van Jones", firstName: "Jane", middleName: "Anne", lastName: "Van Jones" });
  const shared = await f.t.run(async ctx => {
    const personId = await ctx.db.insert("persons", { name: "Global Staff Name", email: "teacher@school.edu.ng", status: "active", authTokenIdentifier: "https://school.convex.site|teacher", createdAt: 1, updatedAt: 1 });
    await ctx.db.patch(teacherId, { personId, authTokenIdentifier: "https://school.convex.site|teacher" });
    const foreignUserId = await ctx.db.insert("users", { schoolId: f.ids.foreignSchoolId, personId, authId: "teacher", authTokenIdentifier: "https://school.convex.site|teacher", name: "Foreign Staff Name", email: "teacher@school.edu.ng", role: "teacher", createdAt: 1, updatedAt: 1 });
    for (const [schoolId, userId] of [[f.ids.schoolId, teacherId], [f.ids.foreignSchoolId, foreignUserId]] as const)
      await ctx.db.insert("branchMemberships", { personId, schoolId, legacyUserId: userId, status: "active", isDefaultBranch: schoolId === f.ids.schoolId, joinedAt: 1, updatedAt: 1 });
    return { personId, foreignUserId };
  });
  authStore.users.set("teacher@school.edu.ng", { id: "teacher", email: "teacher@school.edu.ng", name: "Global Staff Name" });
  await f.actor.action(api.functions.academic.academicSetup.updateTeacherProfile, { teacherId, name: "School Local Name", email: "teacher@school.edu.ng" });
  expect((await f.t.run(ctx => ctx.db.get(teacherId)))?.name).toBe("School Local Name");
  expect((await f.t.run(ctx => ctx.db.get(shared.personId)))?.name).toBe("Global Staff Name");
  expect((await f.t.run(ctx => ctx.db.get(shared.foreignUserId)))?.name).toBe("Foreign Staff Name");
  expect(authStore.users.get("teacher@school.edu.ng")?.name).toBe("Global Staff Name");
});
