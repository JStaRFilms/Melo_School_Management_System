import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const rateModules = import.meta.glob("../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts");
const identity = { subject: "notice-admin", tokenIdentifier: "test|notice-admin" };
const notices = api.functions.academic.accountNotices;
const workers = internal.functions.academic.accountNotices;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("RESEND_API_KEY", "mock-key-never-sent");
  vi.stubEnv("MELO_EMAIL_FROM", "Melo <notices@jstarstudios.com>");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "provider-one" }), { status: 200 }));
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function fixture() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateModules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Notice School", slug: "notices", status: "active", createdAt: 1, updatedAt: 1 });
    const adminId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Admin", role: "admin", isSchoolAdmin: true, email: "admin@example.test", createdAt: 1, updatedAt: 1 });
    const token = "test|parent";
    const personId = await ctx.db.insert("persons", { name: "Parent", email: "parent@example.test", status: "active", authTokenIdentifier: token, identityReconciliationState: "resolved", primarySchoolId: schoolId, createdAt: 1, updatedAt: 1 });
    const parentId = await ctx.db.insert("users", { schoolId, authId: "parent", authTokenIdentifier: token, personId, name: "Parent", email: "parent@example.test", role: "parent", lastCredentialOperation: { operationId: "ready-one", kind: "ready", committedAt: 1 }, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId, personId, legacyUserId: parentId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    const familyId = await ctx.db.insert("families", { schoolId, name: "Family", createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    const memberId = await ctx.db.insert("familyMembers", { schoolId, familyId, parentUserId: parentId, isPrimaryContact: true, createdAt: 1, updatedAt: 1, createdBy: adminId, updatedBy: adminId });
    const studentPerson = await ctx.db.insert("persons", { name: "Student", email: "synthetic@student.publicschool.com", status: "active", authTokenIdentifier: "test|student", identityReconciliationState: "resolved", primarySchoolId: schoolId, createdAt: 1, updatedAt: 1 });
    const studentUserId = await ctx.db.insert("users", { schoolId, personId: studentPerson, authId: "student", authTokenIdentifier: "test|student", name: "Student", email: "synthetic@student.publicschool.com", role: "student", lastCredentialOperation: { operationId: "student-one", kind: "ready", committedAt: 1 }, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("branchMemberships", { schoolId, personId: studentPerson, legacyUserId: studentUserId, status: "active", isDefaultBranch: true, joinedAt: 1, updatedAt: 1 });
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "Primary", createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, classId, familyId, userId: studentUserId, admissionNumber: "ONE", createdAt: 1, updatedAt: 1 });
    return { schoolId, adminId, parentId, memberId, studentUserId, studentId };
  });
  const staff = t.withIdentity(identity);
  const row = (id: import("../../../_generated/dataModel").Id<"accountNoticeOutbox">) => t.run(ctx => ctx.db.get(id));
  return { t, staff, row, ...ids };
}

it("queues one durable event under concurrent identical requests and reports provider acceptance, not delivery", async () => {
  const f = await fixture();
  const args = { userId: f.parentId, operationId: "ready-one" };
  const [one, two] = await Promise.all([f.staff.mutation(notices.enqueueAccountNotice, args), f.staff.mutation(notices.enqueueAccountNotice, args)]);
  expect(one).toBe(two);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(one)).toMatchObject({ state: "accepted", providerId: "provider-one", attemptCount: 1 });
  expect(fetch).toHaveBeenCalledTimes(1);
  const call = vi.mocked(fetch).mock.calls[0][1];
  const payload = JSON.parse(String(call?.body));
  expect(payload).toMatchObject({ from: "Melo <notices@jstarstudios.com>", to: ["parent@example.test"] });
  expect(payload.text).not.toMatch(/https?:\/\//);
  expect(String(call?.body)).not.toContain("mock-key-never-sent");
  expect(JSON.stringify(await f.row(one))).not.toContain("mock-key-never-sent");
  expect(call?.headers).toMatchObject({ "Idempotency-Key": `account-notice/${one}` });
  await f.staff.mutation(notices.retryAccountNotice, { outboxId: one });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("suppresses per-school recipient notices for five minutes without changing successful credential evidence", async () => {
  const f = await fixture();
  await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  await f.t.run(ctx => ctx.db.patch(f.parentId, { lastCredentialOperation: { operationId: "reset-two", kind: "reset", committedAt: Date.now() } }));
  const two = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "reset-two" });
  expect(await f.row(two)).toMatchObject({ state: "suppressed", attemptCount: 0 });
  expect(await f.t.run(ctx => ctx.db.get(f.parentId))).toMatchObject({ authId: "parent", lastCredentialOperation: { operationId: "reset-two" } });
  await f.staff.mutation(notices.retryAccountNotice, { outboxId: two });
  expect(await f.row(two)).toMatchObject({ state: "suppressed" });
  vi.advanceTimersByTime(5 * 60_000);
  await f.staff.mutation(notices.retryAccountNotice, { outboxId: two });
  expect(await f.row(two)).toMatchObject({ state: "pending" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("never treats public-suffix student login IDs as inboxes and requires selected linked guardians", async () => {
  const f = await fixture();
  expect(await f.staff.mutation(workers.enqueueAccountNoticeInternal, { userId: f.studentUserId, operationId: "student-one" })).toBeNull();
  const state = await f.staff.query(notices.getAccountNoticeState, { userId: f.studentUserId });
  expect(state.ownRecipient).toBeNull();
  expect(state.guardians).toEqual([{ userId: f.parentId, name: "Parent", email: "parent@example.test" }]);
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.studentUserId, operationId: "student-one", guardianUserId: f.parentId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "accepted", recipientUserId: f.parentId });
  expect(JSON.stringify(vi.mocked(fetch).mock.calls)).not.toContain("synthetic@student.publicschool.com");
});

it("rechecks guardian links before delivery and retries", async () => {
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.studentUserId, operationId: "student-one", guardianUserId: f.parentId });
  await f.t.run(ctx => ctx.db.delete(f.memberId));
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "ineligible" });
  expect(fetch).not.toHaveBeenCalled();
  await expect(f.staff.mutation(notices.retryAccountNotice, { outboxId: id })).rejects.toThrow("no longer eligible");
});

it("rejects uncommitted operations, unauthorized reads/retries, and foreign targets", async () => {
  const f = await fixture();
  await expect(f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "invented" })).rejects.toThrow("Committed");
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  const parent = f.t.withIdentity({ subject: "parent", tokenIdentifier: "test|parent" });
  await expect(parent.query(notices.getAccountNoticeState, { userId: f.parentId })).rejects.toThrow();
  await expect(parent.mutation(notices.retryAccountNotice, { outboxId: id })).rejects.toThrow();
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("missing configuration never calls the provider or alters account evidence", async () => {
  vi.stubEnv("MELO_EMAIL_FROM", "");
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "not_configured" });
  expect(fetch).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.get(f.parentId))).toMatchObject({ authId: "parent", lastCredentialOperation: { operationId: "ready-one" } });
});

it("leases fence concurrent workers and late completion, and provider retries keep the payload/key", async () => {
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  const claims = await Promise.all([f.t.mutation(workers.claimNotice, { outboxId: id, from: "Melo <notices@jstarstudios.com>" }), f.t.mutation(workers.claimNotice, { outboxId: id })]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  vi.advanceTimersByTime(5 * 60_000);
  const second = await f.t.mutation(workers.claimNotice, { outboxId: id, from: "Changed <other@jstarstudios.com>" });
  expect(second).toMatchObject({ attemptNumber: 2, from: "Melo <notices@jstarstudios.com>" });
  await f.t.mutation(workers.finishNotice, { outboxId: id, attemptNumber: 1, providerId: "late" });
  expect(await f.row(id)).toMatchObject({ state: "sending", attemptCount: 2 });
  await f.t.mutation(workers.finishNotice, { outboxId: id, attemptNumber: 2, providerId: "confirmed" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "accepted", providerId: "confirmed" });
});

it("retries provider failure with the same privacy-safe body and stops after five attempts", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("provider-secret-body"));
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "failed", attemptCount: 5, lastErrorCode: "EMAIL_PROVIDER_UNCONFIRMED" });
  expect(fetch).toHaveBeenCalledTimes(5);
  const requests = vi.mocked(fetch).mock.calls.map(call => call[1]);
  expect(new Set(requests.map(request => request?.body)).size).toBe(1);
  expect(new Set(requests.map(request => JSON.stringify(request?.headers))).size).toBe(1);
  expect(JSON.stringify(await f.row(id))).not.toContain("provider-secret-body");
  await expect(f.staff.mutation(notices.retryAccountNotice, { outboxId: id })).rejects.toThrow("operator review");
});

it("rejects foreign-school reads, enqueue and retry without exposing recipient state", async () => {
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  await f.t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "Other", slug: "other-notices", status: "active", createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("users", { schoolId, authId: "other-admin", authTokenIdentifier: "test|other-admin", role: "admin", name: "Other admin", email: "other@example.test", isSchoolAdmin: true, createdAt: 1, updatedAt: 1 });
  });
  const other = f.t.withIdentity({ subject: "other-admin", tokenIdentifier: "test|other-admin" });
  await expect(other.query(notices.getAccountNoticeState, { userId: f.parentId })).rejects.toThrow("Account not found");
  await expect(other.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" })).rejects.toThrow("Account not found");
  await expect(other.mutation(notices.retryAccountNotice, { outboxId: id })).rejects.toThrow("Account not found");
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("rejects missing or unlinked guardian selections without consuming the credential operation", async () => {
  const f = await fixture();
  await expect(f.staff.mutation(notices.enqueueAccountNotice, { userId: f.studentUserId, operationId: "student-one" })).rejects.toThrow("eligible linked guardian");
  await expect(f.staff.mutation(notices.enqueueAccountNotice, { userId: f.studentUserId, operationId: "student-one", guardianUserId: f.adminId })).rejects.toThrow("eligible linked guardian");
  expect(await f.t.run(ctx => ctx.db.query("accountNoticeOutbox").collect())).toHaveLength(0);
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.studentUserId, operationId: "student-one", guardianUserId: f.parentId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.row(id)).toMatchObject({ state: "accepted", recipientEmail: "parent@example.test" });
});

it("ends a crashed fifth lease in reconciliation rather than submitting beyond the retry bound", async () => {
  const f = await fixture();
  const id = await f.staff.mutation(notices.enqueueAccountNotice, { userId: f.parentId, operationId: "ready-one" });
  await f.t.run(ctx => ctx.db.patch(id, { state: "sending", attemptCount: 5, nextAttemptAt: Date.now() }));
  expect(await f.t.mutation(workers.claimNotice, { outboxId: id })).toBeNull();
  expect(await f.row(id)).toMatchObject({ state: "reconciliation_required", attemptCount: 5 });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(fetch).not.toHaveBeenCalled();
});

it("records admin credential operations but queues only canonical linked accounts", async () => {
  const f = await fixture();
  const unlinked = await f.t.mutation(internal.functions.academic.adminLeadershipHelpers.upsertSchoolAdminRecordInternal, {
    schoolId: f.schoolId, adminName: "New Admin", adminEmail: "newadmin@example.test", adminAuthId: "new-admin-auth",
    credentialOperationId: "admin-ready", managerUserId: f.adminId, makeLead: false, createdBy: f.adminId,
  });
  const state = await f.staff.query(notices.getAccountNoticeState, { userId: unlinked.adminUserId });
  expect(state).toMatchObject({ operationId: "admin-ready", linked: false, notice: null });
  await expect(f.staff.mutation(workers.enqueueAccountNoticeInternal, { userId: unlinked.adminUserId, operationId: "admin-ready" })).rejects.toThrow("Committed linked-account");
  await f.t.run(ctx => ctx.db.patch(f.parentId, { role: "teacher" }));
  await f.t.mutation(internal.functions.academic.adminLeadershipHelpers.promoteTeacherToAdminInternal, {
    schoolId: f.schoolId, teacherUserId: f.parentId, managerUserId: f.adminId, credentialOperationId: "admin-reset",
  });
  const id = await f.staff.mutation(workers.enqueueAccountNoticeInternal, { userId: f.parentId, operationId: "admin-reset" });
  expect(id).not.toBeNull();
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.t.run(ctx => ctx.db.get(f.parentId))).toMatchObject({ isSchoolAdmin: true, lastCredentialOperation: { operationId: "admin-reset", kind: "reset" } });
  expect((await f.staff.query(notices.getAccountNoticeState, { userId: f.parentId })).notice).toMatchObject({ state: "accepted", recipientEmail: "parent@example.test" });
});
