import { convexTest } from "convex-test";
import { getFunctionName, makeFunctionReference } from "convex/server";
import { afterEach, expect, test, vi } from "vitest";
import { api } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import schema from "../../../schema";
import type { CorrectionScope, CorrectionPayload } from "../profileCorrectionContract";
const failures = vi.hoisted(() => ({ audit: false }));
vi.mock("../audit", async () => {
  const original = await vi.importActual<typeof import("../audit")>("../audit");
  return { ...original, recordAuditEventHelper: async (...args: Parameters<typeof original.recordAuditEventHelper>) => {
    if (failures.audit) throw new Error("test audit write failed");
    return original.recordAuditEventHelper(...args);
  } };
});
const convexRoot = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
  `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module,
]));
const refs = api.functions.academic.profileCorrections;
const parentIdentity = { subject: "parent", tokenIdentifier: "https://auth.test|parent" };
afterEach(() => { failures.audit = false; vi.restoreAllMocks(); });
async function fixture(role: "parent" | "teacher" | "student" = "parent") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "b4-school", status: "active", createdAt: 1, updatedAt: 1 });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "b4-other", status: "active", createdAt: 1, updatedAt: 1 });
    const adminId = await ctx.db.insert("users", { schoolId, authId: "admin", authTokenIdentifier: "https://auth.test|admin", name: "Admin", email: "admin@test.test", role: "admin", createdAt: 1, updatedAt: 1 });
    const personId = await ctx.db.insert("persons", { name: "Canonical Parent", email: "parent@test.test", authTokenIdentifier: parentIdentity.tokenIdentifier, status: "active", identityReconciliationState: "resolved", createdAt: 1, updatedAt: 1 });
    const parentId = await ctx.db.insert("users", { schoolId, personId, authId: "parent", authTokenIdentifier: parentIdentity.tokenIdentifier, name: "Pat Smith", firstName: "Pat", lastName: "Smith", phone: "08011111111", email: "parent@test.test", role, createdAt: 1, updatedAt: 1 });
    const membershipId = await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: parentId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    const otherParentId = await ctx.db.insert("users", { schoolId: otherSchoolId, personId, authId: "parent", authTokenIdentifier: parentIdentity.tokenIdentifier, name: "Other School Name", firstName: "Other", lastName: "Name", email: "parent@test.test", role: "parent", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId: otherSchoolId, personId, legacyUserId: otherParentId, status: "active", isDefaultBranch: false, joinedAt: 1, updatedAt: 1 });
    const familyId = await ctx.db.insert("families", { schoolId, name: "Household", residentialAddress: "Shared Road", createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    const otherFamilyId = await ctx.db.insert("families", { schoolId: otherSchoolId, name: "Other Household", createdAt: 1, updatedAt: 1, createdBy: otherParentId, updatedBy: otherParentId });
    await ctx.db.insert("familyMembers", { schoolId: otherSchoolId, familyId: otherFamilyId, parentUserId: otherParentId, isPrimaryContact: true, createdAt: 1, updatedAt: 1, createdBy: otherParentId, updatedBy: otherParentId });
    const memberId = await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, addressMode: "residential", isPrimaryContact: true, relationship: "Mother", createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Class", level: "Primary", createdAt: 1, updatedAt: 1 });
    const childUserId = await ctx.db.insert("users", { schoolId, authId: "child", authTokenIdentifier: "https://auth.test|child", name: "Sam Smith", firstName: "Sam", lastName: "Smith", email: "immutable.student@login.test", role: "student", createdAt: 1, updatedAt: 1 });
    const childId = await ctx.db.insert("students", { schoolId, userId: childUserId, classId, familyId, admissionNumber: "B4/001", dateOfBirth: 946684800000, gender: "Male", addressMode: "residential", enrollmentStatus: "active", createdAt: 1, updatedAt: 1 });
    return { schoolId, otherSchoolId, parentId, otherParentId, personId, membershipId, adminId, familyId, memberId, childUserId, childId, classId };
  });
  const parent = t.withIdentity(parentIdentity);
  const admin = t.withIdentity({ subject: "admin", tokenIdentifier: "https://auth.test|admin" });
  const scope: CorrectionScope = { parentFields: ["firstName", "middleName", "lastName", "phone", "address"], parentMemberId: ids.memberId, childFields: ["firstName", "middleName", "lastName", "dateOfBirth", "gender", "address"], childId: ids.childId };
  const request = (selected: CorrectionScope = scope, requestKey = "request-key-0001") => parent.mutation(refs.requestCorrection, { schoolId: ids.schoolId, scope: selected, reason: "Correct recorded details", requestKey });
  const context = (requestId: Id<"profileCorrectionRequests">) => ({ schoolId: ids.schoolId, requestId });
  const grant = (requestId: Id<"profileCorrectionRequests">, allowedScope = scope) => admin.mutation(refs.decide, { ...context(requestId), expectedRevision: 0, decision: "grant", allowedScope });
  const save = (requestId: Id<"profileCorrectionRequests">, payload: CorrectionPayload, expectedDraftRevision = 0, expectedRevision = 1) => parent.mutation(refs.saveDraft, { ...context(requestId), expectedRevision, expectedDraftRevision, payload });
  const review = (requestId: Id<"profileCorrectionRequests">, expectedDraftRevision = 1, expectedRevision = 1) => parent.query(refs.review, { ...context(requestId), expectedRevision, expectedDraftRevision });
  const prepare = async (payload: CorrectionPayload = { parent: { phone: "08022222222" } }) => {
    const requestId = await request(); await grant(requestId); await save(requestId, payload);
    const reviewed = await review(requestId);
    return { ...context(requestId), expectedRevision: 1, expectedDraftRevision: 1, reviewToken: reviewed.reviewToken, submissionKey: "submission-key-0001", acknowledged: true };
  };
  const rows = () => t.run(async ctx => ({ parent: await ctx.db.get(ids.parentId), childUser: await ctx.db.get(ids.childUserId), child: await ctx.db.get(ids.childId), member: await ctx.db.get(ids.memberId), family: await ctx.db.get(ids.familyId), other: await ctx.db.get(ids.otherParentId), person: await ctx.db.get(ids.personId) }));
  return { t, ids, parent, admin, scope, request, context, grant, save, review, prepare, rows };
}

test("invalid child links hide PII but can be revoked so a fresh own-profile request is possible", async () => {
  const f = await fixture(); const args = await f.prepare();
  await f.t.run(ctx => ctx.db.patch(f.ids.childId, { familyId: undefined }));
  const listed = await f.admin.query(refs.listRequests, { schoolId: f.ids.schoolId, state: "granted", paginationOpts: { cursor: null, numItems: 20 } });
  expect(listed.page[0]).toMatchObject({ requestId: args.requestId, currentAccess: false });
  expect(JSON.stringify(listed)).not.toContain("08022222222");
  await expect(f.admin.query(refs.getAdminRequest, f.context(args.requestId))).rejects.toThrow();
  await expect(f.parent.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "revoke", reason: "Attempt" })).rejects.toThrow();
  await f.admin.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "revoke", reason: "Child link changed" });
  expect(await f.request({ parentFields: ["phone"], childFields: [] }, "new-own-profile-request")).not.toBe(args.requestId);
});

test("strict validators reject authentication, household, academic and arbitrary patch fields", async () => {
  const f = await fixture();
  const rawRequest = makeFunctionReference<"mutation", Record<string, unknown>, unknown>(getFunctionName(refs.requestCorrection));
  for (const field of ["email", "password", "residentialAddress", "classId", "subjects", "relationship"]) await expect(f.parent.mutation(rawRequest, { schoolId: f.ids.schoolId, scope: { parentFields: [field], childFields: [] }, reason: "Attempt", requestKey: "forged-field-key" })).rejects.toThrow();
  await expect(f.parent.mutation(rawRequest, { schoolId: f.ids.schoolId, scope: f.scope, reason: "Attempt", requestKey: "forged-owner-key", requesterUserId: f.ids.otherParentId })).rejects.toThrow();
  const id = await f.request(); await f.grant(id);
  const rawSave = makeFunctionReference<"mutation", Record<string, unknown>, unknown>(getFunctionName(refs.saveDraft));
  await expect(f.parent.mutation(rawSave, { ...f.context(id), expectedRevision: 1, expectedDraftRevision: 0, payload: { parent: { email: "evil@test.test" } } })).rejects.toThrow();
  await expect(f.save(id, { parentAddress: { mode: "residential", value: "Unauthorized shared household edit" } })).rejects.toThrow("household");
});

test("a legitimate second school selects its own parent projection without identity bleed", async () => {
  const f = await fixture(); const id = await f.parent.mutation(refs.requestCorrection, { schoolId: f.ids.otherSchoolId, scope: { parentFields: ["phone"], childFields: [] }, reason: "Other school correction", requestKey: "other-school-request" });
  const request = await f.parent.query(refs.getRequest, { schoolId: f.ids.otherSchoolId, requestId: id });
  expect(request.requesterUserId).toBe(f.ids.otherParentId);
  expect((await f.parent.query(refs.getWorkspace, { schoolId: f.ids.otherSchoolId })).parent.name).toBe("Other School Name");
  await expect(f.parent.query(refs.getRequest, { schoolId: f.ids.schoolId, requestId: id })).rejects.toThrow("FORBIDDEN");
});

test("an unlinked same-school child cannot be requested or substituted into the grant", async () => {
  const f = await fixture(); const childId = await f.t.run(async ctx => {
    const familyId = await ctx.db.insert("families", { schoolId: f.ids.schoolId, name: "Unlinked", createdAt: 1, updatedAt: 1, createdBy: f.ids.adminId, updatedBy: f.ids.adminId });
    return ctx.db.insert("students", { schoolId: f.ids.schoolId, familyId, userId: f.ids.childUserId, classId: f.ids.classId, admissionNumber: "B4/002", createdAt: 1, updatedAt: 1 });
  });
  await expect(f.request({ parentFields: [], childFields: ["gender"], childId })).rejects.toThrow("linked child");
  const id = await f.request(); await expect(f.grant(id, { parentFields: [], childFields: ["gender"], childId })).rejects.toThrow("subset");
});

test("drafts recover only from the server, never write live values, discard keeps the grant", async () => {
  const f = await fixture(); const before = await f.rows(); const id = await f.request(); await f.grant(id);
  await f.save(id, { parent: { phone: "08022222222" }, child: { gender: "Female" } });
  const detail = await f.parent.query(refs.getRequest, f.context(id));
  expect(detail.draft).toEqual({ parent: { phone: "08022222222" }, child: { gender: "Female" } });
  expect(await f.admin.query(refs.getAdminRequest, f.context(id))).not.toHaveProperty("draft");
  await expect(f.parent.query(refs.getAdminRequest, f.context(id))).rejects.toThrow();
  expect(detail).not.toHaveProperty("baseline"); expect(detail).not.toHaveProperty("requesterTokenIdentifier");
  expect(await f.rows()).toEqual(before);
  await f.parent.mutation(refs.discardDraft, { ...f.context(id), expectedRevision: 1, expectedDraftRevision: 1 });
  expect(await f.parent.query(refs.getRequest, f.context(id))).toMatchObject({ state: "granted", draftRevision: 2 });
  await expect(f.review(id, 2)).rejects.toThrow("No changed fields");
});

test.each(["student", "teacher"] as const)("%s cannot borrow another parent's request or submit permission", async role => {
  const f = await fixture(); const args = await f.prepare();
  const actorId = await f.t.run(ctx => ctx.db.insert("users", { schoolId: f.ids.schoolId, authId: role, authTokenIdentifier: `https://auth.test|${role}`, name: "Intruder", email: `${role}@test.test`, role, createdAt: 1, updatedAt: 1 }));
  const actor = f.t.withIdentity({ subject: role, tokenIdentifier: `https://auth.test|${role}` });
  await expect(actor.query(refs.getWorkspace, { schoolId: f.ids.schoolId })).rejects.toThrow();
  await expect(actor.mutation(refs.requestCorrection, { schoolId: f.ids.schoolId, scope: f.scope, reason: "Attempt", requestKey: "forged-request-key" })).rejects.toThrow();
  await expect(actor.query(refs.getRequest, f.context(args.requestId))).rejects.toThrow();
  await expect(actor.mutation(refs.saveDraft, { ...f.context(args.requestId), expectedRevision: 1, expectedDraftRevision: 1, payload: {} })).rejects.toThrow();
  await expect(actor.query(refs.review, { ...f.context(args.requestId), expectedRevision: 1, expectedDraftRevision: 1 })).rejects.toThrow();
  await expect(actor.mutation(refs.submit, args)).rejects.toThrow();
  expect(actorId).toBeTruthy(); expect((await f.rows()).parent?.phone).toBe("08011111111");
});

test("students remain excluded even if someone links their account as a contact", async () => {
  const f = await fixture("student"); await expect(f.request()).rejects.toThrow("parent");
});

test("linked staff use effective parent membership without a student role or email fallback", async () => {
  const f = await fixture("teacher"); const args = await f.prepare(); await f.parent.mutation(refs.submit, args);
  expect((await f.rows()).parent).toMatchObject({ role: "teacher", phone: "08022222222" });
  expect(await f.parent.query(api.functions.portal.getWorkspaceData, { studentId: f.ids.childId, historyLimit: 4, now: 1 })).toMatchObject({ viewer: { role: "parent" } });
});

test("school, child, member and requester forgery fail at strict API and ownership boundaries", async () => {
  const f = await fixture(); const id = await f.request();
  await expect(f.parent.query(refs.getRequest, { schoolId: f.ids.otherSchoolId, requestId: id })).rejects.toThrow("FORBIDDEN");
  await expect(f.request({ parentFields: ["address"], parentMemberId: (await f.t.run(ctx => ctx.db.query("familyMembers").withIndex("by_parent_user", q => q.eq("parentUserId", f.ids.otherParentId)).first()))?._id, childFields: [] }, "forged-member-key")).rejects.toThrow();
  await expect(f.admin.mutation(refs.decide, { schoolId: f.ids.otherSchoolId, requestId: id, expectedRevision: 0, decision: "grant", allowedScope: f.scope })).rejects.toThrow();
});

test.each(["membership", "archive", "parentArchive", "transfer", "unlink", "replaceLink", "childUser", "school"]) ("current %s changes deny profile reads/writes/grants; authorized admin can close invalid permission", async mode => {
  const f = await fixture(); const args = await f.prepare();
  await f.t.run(async ctx => {
    if (mode === "membership") await ctx.db.patch(f.ids.membershipId, { status: "archived" });
    if (mode === "archive") await ctx.db.patch(f.ids.childId, { isArchived: true });
    if (mode === "parentArchive") await ctx.db.patch(f.ids.parentId, { isArchived: true });
    if (mode === "transfer") await ctx.db.patch(f.ids.childId, { enrollmentStatus: "transferred_out" });
    if (mode === "unlink") await ctx.db.patch(f.ids.childId, { familyId: undefined });
    if (mode === "replaceLink") { const link = await ctx.db.get(f.ids.memberId); if (link) { await ctx.db.delete(link._id); const { _id, _creationTime, ...value } = link; await ctx.db.insert("familyMembers", value); } }
    if (mode === "childUser") await ctx.db.patch(f.ids.childId, { userId: f.ids.parentId });
    if (mode === "school") await ctx.db.patch(f.ids.schoolId, { status: "suspended" });
  });
  await expect(f.parent.query(refs.getRequest, f.context(args.requestId))).rejects.toThrow();
  await expect(f.save(args.requestId, { parent: { phone: "08033333333" } }, 1)).rejects.toThrow();
  await expect(f.review(args.requestId)).rejects.toThrow();
  await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow();
  await expect(f.admin.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "grant", allowedScope: f.scope })).rejects.toThrow();
  if (mode === "school") await expect(f.admin.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "revoke", reason: "Changed access" })).rejects.toThrow();
  else {
    await f.admin.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "revoke", reason: "Changed access" });
    expect(await f.t.run(ctx => ctx.db.get(args.requestId))).toMatchObject({ state: "revoked" });
  }
  expect((await f.rows()).parent?.phone).toBe("08011111111");
});

test("grant is a nonempty requested subset; normalized induced middle change requires scope", async () => {
  const f = await fixture(); const selected: CorrectionScope = { parentFields: ["firstName"], childFields: [] }; const id = await f.request(selected);
  await expect(f.grant(id, { parentFields: [], childFields: [] })).rejects.toThrow("at least one");
  await expect(f.grant(id, { parentFields: ["phone"], childFields: [] })).rejects.toThrow("subset");
  await f.grant(id, selected);
  await expect(f.save(id, { parent: { firstName: "Pat Anne" } })).rejects.toThrow("middleName");
  await expect(f.save(id, { parent: { phone: "08033333333" } })).rejects.toThrow("not granted");
  expect((await f.rows()).parent?.firstName).toBe("Pat");
});

test("normalized names are revealed in review and explicit middle clears do not guess legacy names", async () => {
  const f = await fixture(); const args = await f.prepare({ parent: { firstName: "pat anne" }, child: { firstName: "sam Jo" } });
  const review = await f.review(args.requestId);
  expect(review.changes).toEqual(expect.arrayContaining([expect.objectContaining({ target: "parent", field: "middleName", after: "Anne" }), expect.objectContaining({ target: "child", field: "middleName", after: "Jo" })]));
  await f.parent.mutation(refs.submit, args);
  const id = await f.request(f.scope, "second-request-key"); await f.grant(id); await f.save(id, { parent: { middleName: null } });
  const next = await f.review(id); await f.parent.mutation(refs.submit, { ...f.context(id), expectedRevision: 1, expectedDraftRevision: 1, reviewToken: next.reviewToken, submissionKey: "second-submit-key", acknowledged: true });
  expect((await f.rows()).parent?.middleName).toBeUndefined();
  await f.t.run(ctx => ctx.db.patch(f.ids.parentId, { name: "Unsplit Legacy Name", firstName: undefined, lastName: undefined }));
  const legacy = await f.request(f.scope, "legacy-request-key"); await f.grant(legacy); await f.save(legacy, { parent: { phone: "08044444444" } });
  expect((await f.review(legacy)).changes.map(c => c.field)).toEqual(["phone"]);
});

test("stale values and address sources require explicit refresh even when timestamps do not change", async () => {
  const f = await fixture(); const args = await f.prepare({ parent: { phone: "08022222222" }, child: { address: { mode: "residential" } } });
  await f.t.run(ctx => ctx.db.patch(f.ids.parentId, { phone: "Admin's newer phone" }));
  await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow("STALE_PROFILE");
  const stale = await f.parent.query(refs.getRequest, f.context(args.requestId)); expect(stale.stale).toBe(true); expect(stale.draft).toBeTruthy();
  await f.parent.mutation(refs.refreshBaseline, { ...f.context(args.requestId), expectedRevision: 1, expectedDraftRevision: 1 });
  await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow("CONFLICT");
  const review = await f.review(args.requestId, 1, 2); expect(review.changes[0].before).toBe("Admin's newer phone");
  await f.t.run(ctx => ctx.db.patch(f.ids.familyId, { residentialAddress: "Admin's newer household address" }));
  await expect(f.parent.mutation(refs.submit, { ...args, expectedRevision: 2, reviewToken: review.reviewToken })).rejects.toThrow("STALE_PROFILE");
});

test("revoked grants and stale draft reviews cannot submit or consume permission", async () => {
  const f = await fixture(); const args = await f.prepare(); await f.save(args.requestId, { parent: { phone: "08033333333" } }, 1);
  await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow("CONFLICT");
  await f.admin.mutation(refs.decide, { ...f.context(args.requestId), expectedRevision: 1, decision: "revoke", reason: "Permission withdrawn" });
  await expect(f.parent.mutation(refs.submit, { ...args, expectedRevision: 2, expectedDraftRevision: 2 })).rejects.toThrow("permission");
  await expect(f.grant(args.requestId)).rejects.toThrow();
});

test("acknowledgement, empty and no-op drafts cannot falsely consume a grant", async () => {
  const f = await fixture(); const args = await f.prepare(); await expect(f.parent.mutation(refs.submit, { ...args, acknowledged: false })).rejects.toThrow("Acknowledge");
  await f.save(args.requestId, { parent: { phone: "08011111111" } }, 1);
  await expect(f.review(args.requestId, 2)).rejects.toThrow("No changed fields");
  await expect(f.parent.mutation(refs.submit, { ...args, expectedDraftRevision: 2 })).rejects.toThrow("No changed fields");
  expect((await f.parent.query(refs.getRequest, f.context(args.requestId))).state).toBe("granted");
});

test("atomic multi-target apply consumes once; retry has one immutable receipt and privacy-safe audit", async () => {
  const f = await fixture(); const before = await f.rows(); const args = await f.prepare({ parent: { firstName: "Pat Anne", phone: "08022222222" }, parentAddress: { mode: "different", value: "Private Parent Lane" }, child: { dateOfBirth: 978307200000, gender: "Female", address: { mode: "different", value: "Private Child Road" } } });
  const receipt = await f.parent.mutation(refs.submit, args); expect(receipt.replayed).toBe(false);
  expect(await f.parent.mutation(refs.submit, args)).toMatchObject({ ...receipt, replayed: true });
  const after = await f.rows(); expect(after.parent).toMatchObject({ firstName: "Pat", middleName: "Anne", phone: "08022222222", email: before.parent?.email, authId: before.parent?.authId, personId: before.parent?.personId });
  expect(after.child).toMatchObject({ dateOfBirth: 978307200000, gender: "Female", address: "Private Child Road", admissionNumber: "B4/001", classId: f.ids.classId });
  expect(after.member).toMatchObject({ addressMode: "different", addressOverride: "Private Parent Lane", relationship: "Mother", isPrimaryContact: true });
  expect(after.family).toEqual(before.family); expect(after.other).toEqual(before.other); expect(after.person).toEqual(before.person);
  const applied = await f.parent.query(refs.getRequest, f.context(args.requestId)); expect(applied.state).toBe("applied"); expect(applied.draft).toBeUndefined(); expect(applied.applied?.changes).toHaveLength(7);
  await expect(f.save(args.requestId, {}, 1, 2)).rejects.toThrow("permission");
  await expect(f.parent.mutation(refs.submit, { ...args, reviewToken: "different-content" })).rejects.toThrow("does not match");
  const events = await f.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school_and_timestamp", q => q.eq("schoolId", f.ids.schoolId)).take(20));
  expect(events.filter(e => e.action === "profile_correction_applied")).toHaveLength(1);
  expect(JSON.stringify(events)).not.toContain("Private Parent Lane"); expect(JSON.stringify(events)).not.toContain("08022222222"); expect(JSON.stringify(events)).not.toContain("978307200000");
  expect(await f.request(f.scope, "new-after-applied")).not.toBe(args.requestId);
});

test("child identity apply preserves promotion, subjects, assessment history, invoices and issued snapshots", async () => {
  const f = await fixture();
  const ids = await f.t.run(async ctx => {
    const schoolId = f.ids.schoolId, studentId = f.ids.childId, classId = f.ids.classId;
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Old session", startDate: 1, endDate: 2, isActive: false, createdAt: 1, updatedAt: 1 });
    const nextSessionId = await ctx.db.insert("academicSessions", { schoolId, name: "Current session", startDate: 3, endDate: 4, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "Third", startDate: 1, endDate: 2, isActive: false, createdAt: 1, updatedAt: 1 });
    const nextClassId = await ctx.db.insert("classes", { schoolId, name: "Promoted", level: "Primary", createdAt: 1, updatedAt: 1 });
    const promotionId = await ctx.db.insert("studentPromotions", { schoolId, studentId, fromClassId: classId, fromSessionId: sessionId, toClassId: nextClassId, toSessionId: nextSessionId, subjectEnrollmentMode: "none", subjectEnrollmentCount: 0, batchKey: "b4-history", createdAt: 2, createdBy: f.ids.adminId });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Math", code: "MTH", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: 1, updatedAt: 1 });
    const selectionId = await ctx.db.insert("studentSubjectSelections", { schoolId, studentId, classId, sessionId, subjectId, createdAt: 1, updatedAt: 1 });
    const resultId = await ctx.db.insert("assessmentRecords", { schoolId, studentId, classId, sessionId, termId, subjectId, ca1: 10, ca2: 10, ca3: 10, examRawScore: 40, examScaledScore: 40, total: 70, gradeLetter: "B", remark: "Good", examInputModeSnapshot: "raw40", examRawMaxSnapshot: 40, status: "draft", enteredBy: f.ids.adminId, updatedBy: f.ids.adminId, createdAt: 1, updatedAt: 1 });
    const feePlanId = await ctx.db.insert("feePlans", { schoolId, name: "Fees", currency: "NGN", lineItems: [], installmentPolicy: { enabled: false, installmentCount: 1, intervalDays: 0, firstDueDays: 0 }, isActive: true, createdAt: 1, updatedAt: 1, createdBy: f.ids.adminId, updatedBy: f.ids.adminId });
    const invoiceId = await ctx.db.insert("studentInvoices", { schoolId, feePlanId, studentId, classId, sessionId, termId, invoiceNumber: "B4/INV", feePlanNameSnapshot: "Fees", currency: "NGN", lineItems: [], installmentSchedule: [], subtotal: 1000, waiverAmount: 0, discountAmount: 0, totalAmount: 1000, amountPaid: 100, balanceDue: 900, status: "partially_paid", dueDate: 2, issuedAt: 1, issuedBy: f.ids.adminId, createdAt: 1, updatedAt: 1 });
    return { sessionId, termId, promotionId, selectionId, resultId, invoiceId };
  });
  const report = await f.admin.query(api.functions.academic.reportCards.getStudentReportCard, { studentId: f.ids.childId, sessionId: ids.sessionId, termId: ids.termId, classId: f.ids.classId });
  const issuedId = await f.t.run(ctx => ctx.db.insert("issuedReportCards", { schoolId: f.ids.schoolId, studentId: f.ids.childId, classId: f.ids.classId, sessionId: ids.sessionId, termId: ids.termId, report, issuedAt: 2, issuedBy: f.ids.adminId }));
  const history = () => f.t.run(async ctx => ({ promotion: await ctx.db.get(ids.promotionId), selection: await ctx.db.get(ids.selectionId), result: await ctx.db.get(ids.resultId), invoice: await ctx.db.get(ids.invoiceId), issued: await ctx.db.get(issuedId) }));
  const before = await history(); const args = await f.prepare({ child: { firstName: "Samuel", dateOfBirth: 978307200000, gender: "Female" } });
  await f.parent.mutation(refs.submit, args);
  expect(await history()).toEqual(before); expect((await f.rows()).child).toMatchObject({ classId: f.ids.classId, admissionNumber: "B4/001", familyId: f.ids.familyId });
  expect((await f.rows()).childUser).toMatchObject({ firstName: "Samuel", authId: "child", authTokenIdentifier: "https://auth.test|child", email: "immutable.student@login.test" });
});

test("failed final audit rolls back all profile writes, permission consumption and receipt", async () => {
  const f = await fixture(); const before = await f.rows(); const args = await f.prepare({ parent: { phone: "08022222222" }, child: { gender: "Female" } });
  failures.audit = true; await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow("audit write failed"); failures.audit = false;
  expect(await f.rows()).toEqual(before); const request = await f.parent.query(refs.getRequest, f.context(args.requestId)); expect(request.state).toBe("granted"); expect(request.applied).toBeUndefined(); expect(request.draft).toBeTruthy();
  expect((await f.parent.mutation(refs.submit, args)).replayed).toBe(false);
});

test("identical concurrent submissions return one receipt without duplicate audit", async () => {
  const f = await fixture(); const args = await f.prepare();
  const results = await Promise.all([f.parent.mutation(refs.submit, args), f.parent.mutation(refs.submit, args)]);
  expect(results.filter(r => r.replayed)).toHaveLength(1);
  expect(await f.t.run(ctx => ctx.db.query("auditEvents").filter(q => q.eq(q.field("action"), "profile_correction_applied")).take(10))).toHaveLength(1);
  await f.t.run(ctx => ctx.db.patch(f.ids.membershipId, { status: "archived" }));
  await expect(f.parent.mutation(refs.submit, args)).rejects.toThrow();
});

test("request keys are content-bound, rejected requests are terminal, retained requests block parent deletion", async () => {
  const f = await fixture(); const selected: CorrectionScope = { parentFields: ["phone"], childFields: [] }; const id = await f.request(selected);
  expect(await f.request(selected)).toBe(id);
  await expect(f.request({ parentFields: ["firstName"], childFields: [] })).rejects.toThrow("different content");
  await f.admin.mutation(refs.decide, { ...f.context(id), expectedRevision: 0, decision: "reject", reason: "Not needed" });
  await expect(f.admin.mutation(refs.decide, { ...f.context(id), expectedRevision: 1, decision: "grant", allowedScope: selected })).rejects.toThrow("requested");
  expect(await f.request(selected, "new-after-rejected")).not.toBe(id);
  await f.t.run(async ctx => { await ctx.db.delete(f.ids.childId); await ctx.db.delete(f.ids.membershipId); await ctx.db.patch(f.ids.parentId, { personId: undefined }); });
  await expect(f.admin.mutation(api.functions.academic.studentEnrollment.deleteUnusedParent, { parentUserId: f.ids.parentId, confirmed: true })).rejects.toThrow("profileCorrectionRequests");
});
