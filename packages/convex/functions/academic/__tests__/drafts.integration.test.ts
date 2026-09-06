import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"]);
const modules = Object.fromEntries(Object.entries(rawModules).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`, module]));
const drafts = api.functions.academic.drafts;
const identity = { subject: "draft-owner", tokenIdentifier: "https://auth.test|draft-owner" };
const otherIdentity = { subject: "other", tokenIdentifier: "https://auth.test|other" };
async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "draft-school", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other", slug: "draft-other", status: "active", createdAt: now, updatedAt: now });
    const userId = await ctx.db.insert("users", { schoolId, authId: identity.subject, authTokenIdentifier: identity.tokenIdentifier, name: "Owner", email: "owner@example.test", role: "admin", isSchoolAdmin: true, createdAt: now, updatedAt: now });
    const otherUserId = await ctx.db.insert("users", { schoolId, authId: otherIdentity.subject, authTokenIdentifier: otherIdentity.tokenIdentifier, name: "Other", email: "other@example.test", role: "admin", createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, userId, otherUserId };
  });
  const user = t.withIdentity(identity);
  const scope = { schoolId: ids.schoolId, formKey: "student_onboarding" };
  const begin = () => user.mutation(drafts.beginFormDraft, { ...scope, schemaVersion: 1 });
  return { t, user, other: t.withIdentity(otherIdentity), ...ids, scope, begin };
}

describe("Private registered draft lifecycle", () => {
  it("allocates explicitly, saves a validated projection, and audits lifecycle only", async () => {
    const h = await setup();
    const instance = await h.begin();
    const saved = await h.user.mutation(drafts.saveFormDraft, { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload: { firstName: "Ada" } });
    expect(saved.revision).toBe(1);
    expect(await h.user.query(drafts.getFormDraft, h.scope)).toMatchObject({ userId: h.userId, schoolId: h.schoolId, payload: { firstName: "Ada" }, revision: 1 });
    const events = await h.t.run(ctx => ctx.db.query("auditEvents").take(10));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("Ada");
    expect(instance.expiresAt - Date.now()).toBeGreaterThan(89 * 86400000);
  });
  it("requires explicit recovery and rejects concurrent stale writes", async () => {
    const h = await setup(); const instance = await h.begin();
    await expect(h.begin()).rejects.toThrow(/Preview, resume or discard/);
    const args = { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload: { firstName: "First tab" } };
    await h.user.mutation(drafts.saveFormDraft, args);
    await expect(h.user.mutation(drafts.saveFormDraft, { ...args, payload: { firstName: "Stale tab" } })).rejects.toThrow(/Conflict/);
    expect((await h.user.query(drafts.getFormDraft, h.scope))?.payload).toMatchObject({ firstName: "First tab" });
  });
  it("rejects unknown schemas, versions, entity context, secret and file fields", async () => {
    const h = await setup();
    await expect(h.user.mutation(drafts.beginFormDraft, { ...h.scope, formKey: "secret_notes", schemaVersion: 1 })).rejects.toThrow(/reviewed/);
    await expect(h.user.mutation(drafts.beginFormDraft, { ...h.scope, schemaVersion: 2 })).rejects.toThrow(/version/);
    await expect(h.user.mutation(drafts.beginFormDraft, { ...h.scope, schemaVersion: 1, entityId: "foreign-student" })).rejects.toThrow(/new records/);
    const instance = await h.begin();
    for (const payload of [{ password: "secret" }, { token: "secret" }, { fileUrl: "https://public.test/file" }, { storageId: "raw-file" }, { firstName: 42 }]) {
      await expect(h.user.mutation(drafts.saveFormDraft, { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload })).rejects.toThrow(/unapproved/);
    }
  });
  it("closes staff onboarding in the successful local teacher-record transaction", async () => {
    const h = await setup();
    const scope = { schoolId: h.schoolId, formKey: "staff_onboarding" };
    const instance = await h.user.mutation(drafts.beginFormDraft, { ...scope, schemaVersion: 1 });
    const saved = await h.user.mutation(drafts.saveFormDraft, {
      schoolId: h.schoolId,
      draftId: instance.draftId,
      expectedRevision: 0,
      schemaVersion: 1,
      payload: { name: "Synthetic Teacher", email: "teacher@example.test" },
    });
    const teacherId = await h.user.mutation(
      internal.functions.academic.academicSetup.createTeacherRecordInternal,
      {
        schoolId: h.schoolId,
        name: "Synthetic Teacher",
        email: "teacher@example.test",
        authId: "synthetic-provider-id",
        draftId: instance.draftId,
        expectedDraftRevision: saved.revision,
      },
    );
    expect(await h.t.run(ctx => ctx.db.get(teacherId))).toMatchObject({ email: "teacher@example.test", role: "teacher" });
    expect(await h.user.query(drafts.getFormDraft, scope)).toBeNull();
    expect(await h.t.run(ctx => ctx.db.get(instance.draftId))).toMatchObject({ status: "committed", payload: {} });
  }, 10000);

  it("atomically closes an academic-session draft and rejects delayed resurrection", async () => {
    const h = await setup();
    const scope = { schoolId: h.schoolId, formKey: "academic_setup" };
    const instance = await h.user.mutation(drafts.beginFormDraft, { ...scope, schemaVersion: 1 });
    const saved = await h.user.mutation(drafts.saveFormDraft, {
      schoolId: h.schoolId,
      draftId: instance.draftId,
      expectedRevision: 0,
      schemaVersion: 1,
      payload: { name: "2030/2031", startDate: "2030-09-01", endDate: "2031-07-01", isActive: false, autoGenerateTerms: false },
    });
    const sessionId = await h.user.mutation(api.functions.academic.academicSetup.createSession, {
      name: "2030/2031",
      startDate: Date.UTC(2030, 8, 1),
      endDate: Date.UTC(2031, 6, 1),
      isActive: false,
      autoGenerateTerms: false,
      draftId: instance.draftId,
      expectedDraftRevision: saved.revision,
    });
    expect(await h.t.run(ctx => ctx.db.get(sessionId))).toMatchObject({ name: "2030/2031" });
    expect(await h.user.query(drafts.getFormDraft, scope)).toBeNull();
    expect(await h.t.run(ctx => ctx.db.get(instance.draftId))).toMatchObject({ status: "committed", payload: {} });
    await expect(h.user.mutation(drafts.saveFormDraft, {
      schoolId: h.schoolId,
      draftId: instance.draftId,
      expectedRevision: saved.revision,
      schemaVersion: 1,
      payload: { name: "resurrect", startDate: "", endDate: "", isActive: false, autoGenerateTerms: false },
    })).rejects.toThrow(/already/);

    const stale = await h.user.mutation(drafts.beginFormDraft, { ...scope, schemaVersion: 1 });
    await h.user.mutation(drafts.saveFormDraft, {
      schoolId: h.schoolId,
      draftId: stale.draftId,
      expectedRevision: 0,
      schemaVersion: 1,
      payload: { name: "Must roll back", startDate: "2032-09-01", endDate: "2033-07-01", isActive: false, autoGenerateTerms: false },
    });
    await expect(h.user.mutation(api.functions.academic.academicSetup.createSession, {
      name: "Must roll back",
      startDate: Date.UTC(2032, 8, 1),
      endDate: Date.UTC(2033, 6, 1),
      isActive: false,
      autoGenerateTerms: false,
      draftId: stale.draftId,
      expectedDraftRevision: 0,
    })).rejects.toThrow(/Conflict/);
    const sessions = await h.t.run(ctx => ctx.db.query("academicSessions").withIndex("by_school", q => q.eq("schoolId", h.schoolId)).collect());
    expect(sessions.map(row => row.name)).not.toContain("Must roll back");
    expect(await h.user.query(drafts.getFormDraft, scope)).toMatchObject({ draftId: stale.draftId, revision: 1 });
  });

  it("denies cross-user, branch, suspended, revoked and unauthenticated access", async () => {
    const h = await setup(); const instance = await h.begin();
    const args = { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0 };
    await expect(h.other.mutation(drafts.discardFormDraft, args)).rejects.toThrow(/unavailable/);
    expect(await h.other.query(drafts.getFormDraft, h.scope)).toBeNull();
    await h.t.run(ctx => ctx.db.patch(h.otherUserId, { role: "teacher" }));
    await expect(h.other.query(drafts.getFormDraft, h.scope)).rejects.toThrow(/not permitted/);
    await expect(h.user.query(drafts.getFormDraft, { ...h.scope, schoolId: h.otherSchoolId })).rejects.toThrow();
    await expect(h.t.query(drafts.getFormDraft, h.scope)).rejects.toThrow(/Unauthorized/);
    await h.t.run(ctx => ctx.db.patch(h.schoolId, { status: "suspended" }));
    await expect(h.user.query(drafts.getFormDraft, h.scope)).rejects.toThrow();
    await h.t.run(async ctx => { await ctx.db.patch(h.schoolId, { status: "active" }); await ctx.db.patch(h.userId, { isArchived: true }); });
    await expect(h.user.mutation(drafts.discardFormDraft, args)).rejects.toThrow();
  });
  it.each(["discardFormDraft", "commitFormDraft"] as const)("%s erases payload and permanently rejects delayed autosave", async endpoint => {
    const h = await setup(); const instance = await h.begin();
    await h.user.mutation(drafts.saveFormDraft, { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload: { firstName: "Remove me" } });
    const args = { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 1 };
    await h.user.mutation(drafts[endpoint], args);
    await expect(h.user.mutation(drafts.saveFormDraft, { ...args, schemaVersion: 1, payload: { firstName: "late" } })).rejects.toThrow(/already/);
    expect(await h.user.query(drafts.getFormDraft, h.scope)).toBeNull();
    expect((await h.t.run(ctx => ctx.db.get(instance.draftId)))?.payload).toEqual({});
    const next = await h.begin(); expect(next.draftId).not.toBe(instance.draftId);
  });
  it("recovers the indexed active draft behind more than 100 newer tombstones and rejects a second begin", async () => {
    const h = await setup();
    const active = await h.begin();
    await h.t.run(async ctx => {
      const now = Date.now();
      for (let index = 0; index < 101; index++) {
        await ctx.db.insert("formDrafts", {
          schoolId: h.schoolId,
          userId: h.userId,
          formKey: h.scope.formKey,
          payload: {},
          schemaVersion: 1,
          status: "committed",
          revision: 1,
          lastSavedAt: now + index + 1,
          createdAt: now + index + 1,
          updatedAt: now + index + 1,
        });
      }
    });
    expect(await h.user.query(drafts.getFormDraft, h.scope)).toMatchObject({ draftId: active.draftId });
    await expect(h.begin()).rejects.toThrow(/Preview, resume or discard/);
    const activeRows = await h.t.run(ctx => ctx.db.query("formDrafts").withIndex("by_school_and_user_and_form_and_status", q => q.eq("schoolId", h.schoolId).eq("userId", h.userId).eq("formKey", h.scope.formKey).eq("status", "active")).take(10));
    expect(activeRows).toHaveLength(1);
  });
  it("serializes concurrent begins through the deterministic active scope claim", async () => {
    const h = await setup();
    const results = await Promise.allSettled([h.begin(), h.begin()]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const activeRows = await h.t.run(ctx => ctx.db.query("formDrafts").withIndex("by_school_and_user_and_form_and_status", q => q.eq("schoolId", h.schoolId).eq("userId", h.userId).eq("formKey", h.scope.formKey).eq("status", "active")).take(10));
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].activeScopeKey).toContain(String(h.schoolId));
  });
  it("expires more than 100 due payloads from scheduling, retains newer drafts and audits no content", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      const h = await setup();
      const scheduled = await h.begin();
      const dueAt = scheduled.expiresAt;
      const newerId = await h.t.run(async ctx => {
        for (let index = 0; index < 120; index++) {
          await ctx.db.insert("formDrafts", {
            schoolId: h.schoolId,
            userId: h.userId,
            formKey: `historic_${index}`,
            payload: { privateName: `Child ${index}` },
            schemaVersion: 1,
            expiresAt: dueAt,
            status: "committed",
            revision: 1,
            lastSavedAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        return await ctx.db.insert("formDrafts", {
          schoolId: h.schoolId,
          userId: h.userId,
          formKey: "newer",
          payload: { privateName: "Keep until due" },
          schemaVersion: 1,
          expiresAt: dueAt + 365 * 86400000,
          status: "committed",
          revision: 1,
          lastSavedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
      await h.t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(90 * 86400000 + 1));
      const dueRows = await h.t.run(ctx => ctx.db.query("formDrafts").withIndex("by_expiresAt", q => q.gt("expiresAt", 0).lte("expiresAt", dueAt)).take(200));
      expect(dueRows).toHaveLength(0);
      expect(await h.t.run(ctx => ctx.db.get(newerId))).toMatchObject({ payload: { privateName: "Keep until due" } });
      const events = await h.t.run(ctx => ctx.db.query("auditEvents").withIndex("by_school_and_timestamp", q => q.eq("schoolId", h.schoolId)).take(200));
      expect(events.filter(event => event.action === "expired")).toHaveLength(121);
      expect(JSON.stringify(events)).not.toContain("Child 0");
      expect(JSON.stringify(events)).not.toContain("Keep until due");
    } finally {
      vi.useRealTimers();
    }
  });
  it("hides expired drafts and rejects both stale saves and closure", async () => {
    const h = await setup(); const instance = await h.begin();
    await h.t.run(ctx => ctx.db.patch(instance.draftId, { expiresAt: Date.now() - 1 }));
    expect(await h.user.query(drafts.getFormDraft, h.scope)).toBeNull();
    await expect(h.user.mutation(drafts.saveFormDraft, { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload: {} })).rejects.toThrow(/expired/);
  });
});
