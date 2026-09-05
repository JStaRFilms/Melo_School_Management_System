import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
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
    expect((await h.user.query(drafts.getFormDraft, h.scope))?.payload).toEqual({ firstName: "First tab" });
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
  it("hides expired drafts and rejects both stale saves and closure", async () => {
    const h = await setup(); const instance = await h.begin();
    await h.t.run(ctx => ctx.db.patch(instance.draftId, { expiresAt: Date.now() - 1 }));
    expect(await h.user.query(drafts.getFormDraft, h.scope)).toBeNull();
    await expect(h.user.mutation(drafts.saveFormDraft, { schoolId: h.schoolId, draftId: instance.draftId, expectedRevision: 0, schemaVersion: 1, payload: {} })).rejects.toThrow(/expired/);
  });
});
