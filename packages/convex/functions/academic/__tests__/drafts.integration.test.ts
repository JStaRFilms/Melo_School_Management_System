import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const convexRoot = new URL("../../../", import.meta.url).pathname;
const rawModules = import.meta.glob([
  "../../../**/*.ts",
  "!../../../**/*.test.ts",
]);
const modules = Object.fromEntries(
  Object.entries(rawModules).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    module,
  ]),
);

const draftsApi = (api as any).functions.academic.drafts;

const userAIdentity = {
  subject: "user-a-auth-id",
  tokenIdentifier: "https://auth.school.test|user-a",
};

const userBIdentity = {
  subject: "user-b-auth-id",
  tokenIdentifier: "https://auth.school.test|user-b",
};

async function setupTestHarness(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    // Create School
    const schoolId = await ctx.db.insert("schools", {
      name: "Olive Blessed Crest Lagos",
      slug: "obc",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Create User A
    const userAId = await ctx.db.insert("users", {
      schoolId,
      authId: userAIdentity.subject,
      authTokenIdentifier: userAIdentity.tokenIdentifier,
      name: "Dr. Aminat Adebayo",
      email: "aminat.adebayo@obc.edu.ng",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    // Create User B (different user in same or different school)
    const userBId = await ctx.db.insert("users", {
      schoolId,
      authId: userBIdentity.subject,
      authTokenIdentifier: userBIdentity.tokenIdentifier,
      name: "Mr. Babatunde Adeleke",
      email: "babatunde.adeleke@obc.edu.ng",
      role: "teacher",
      isSchoolAdmin: false,
      createdAt: now,
      updatedAt: now,
    });

    return { schoolId, userAId, userBId };
  });
}

describe("Form Drafts Persistence and Recovery", () => {
  it("saves a new form draft and retrieves it successfully", async () => {
    const t = convexTest(schema, modules);
    const { schoolId, userAId } = await setupTestHarness(t);

    const userAT = t.withIdentity(userAIdentity);

    // 1. Initially no draft exists
    const initialDraft = await userAT.query(draftsApi.getFormDraft, {
      formKey: "student_onboarding",
    });
    expect(initialDraft).toBeNull();

    // 2. Save active draft
    const saveResult = await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "student_onboarding",
      payload: {
        firstName: "Chidinma",
        lastName: "Okafor",
        classLevel: "JSS 1A",
      },
    });

    expect(saveResult.isNew).toBe(true);
    expect(saveResult.revision).toBe(1);
    expect(saveResult.draftId).toBeDefined();

    // 3. Retrieve draft
    const retrievedDraft = await userAT.query(draftsApi.getFormDraft, {
      formKey: "student_onboarding",
    });

    expect(retrievedDraft).not.toBeNull();
    expect(retrievedDraft?.schoolId).toBe(schoolId);
    expect(retrievedDraft?.userId).toBe(userAId);
    expect(retrievedDraft?.formKey).toBe("student_onboarding");
    expect(retrievedDraft?.status).toBe("active");
    expect(retrievedDraft?.revision).toBe(1);
    expect(retrievedDraft?.payload).toEqual({
      firstName: "Chidinma",
      lastName: "Okafor",
      classLevel: "JSS 1A",
    });
  });

  it("upserts existing active draft, bumping revision and timestamps without duplicate rows", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);
    const userAT = t.withIdentity(userAIdentity);

    // Save initial draft
    const save1 = await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "fee_plan_builder",
      payload: { planName: "Term 1 Tuition", amount: 150000 },
    });
    expect(save1.revision).toBe(1);

    // Update draft with second save
    const save2 = await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "fee_plan_builder",
      payload: { planName: "Term 1 Tuition Final", amount: 175000, discount: 5000 },
      expectedRevision: 1,
    });
    expect(save2.isNew).toBe(false);
    expect(save2.revision).toBe(2);
    expect(save2.draftId).toBe(save1.draftId);

    // Retrieve updated draft
    const updated = await userAT.query(draftsApi.getFormDraft, {
      formKey: "fee_plan_builder",
    });
    expect(updated?.revision).toBe(2);
    expect(updated?.payload).toEqual({
      planName: "Term 1 Tuition Final",
      amount: 175000,
      discount: 5000,
    });
  });

  it("detects revision conflict when expectedRevision does not match", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);
    const userAT = t.withIdentity(userAIdentity);

    // Save initial draft (rev 1)
    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "curriculum_plan",
      payload: { week: 1 },
    });

    // Save update (rev 2)
    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "curriculum_plan",
      payload: { week: 1, topic: "Algebra" },
    });

    // Stale client tries to save with expectedRevision: 1
    await expect(
      userAT.mutation(draftsApi.saveFormDraft, {
        formKey: "curriculum_plan",
        payload: { week: 1, topic: "Stale edit" },
        expectedRevision: 1,
      })
    ).rejects.toThrow(/Conflict detected/);
  });

  it("supports entity-scoped drafts alongside un-scoped drafts", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);
    const userAT = t.withIdentity(userAIdentity);

    // Un-scoped draft (e.g. creating new student)
    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "student_profile",
      payload: { mode: "create" },
    });

    // Entity-scoped draft (e.g. editing student 123)
    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "student_profile",
      entityId: "student_123",
      payload: { mode: "edit", studentId: "student_123" },
    });

    // Retrieve un-scoped
    const newStudentDraft = await userAT.query(draftsApi.getFormDraft, {
      formKey: "student_profile",
    });
    expect(newStudentDraft?.payload).toEqual({ mode: "create" });

    // Retrieve entity-scoped
    const editStudentDraft = await userAT.query(draftsApi.getFormDraft, {
      formKey: "student_profile",
      entityId: "student_123",
    });
    expect(editStudentDraft?.payload).toEqual({ mode: "edit", studentId: "student_123" });
  });

  it("discards draft so it is no longer retrieved", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);
    const userAT = t.withIdentity(userAIdentity);

    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "staff_onboarding",
      payload: { name: "New Teacher" },
    });

    // Discard via formKey
    const discardResult = await userAT.mutation(draftsApi.discardFormDraft, {
      formKey: "staff_onboarding",
    });
    expect(discardResult.success).toBe(true);
    expect(discardResult.discardedCount).toBe(1);

    // Query should now return null
    const check = await userAT.query(draftsApi.getFormDraft, {
      formKey: "staff_onboarding",
    });
    expect(check).toBeNull();
  });

  it("commits draft upon final submission", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);
    const userAT = t.withIdentity(userAIdentity);

    const save = await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "exam_entry",
      payload: { scores: [90, 85, 92] },
    });

    // Commit via draftId
    const commitResult = await userAT.mutation(draftsApi.commitFormDraft, {
      draftId: save.draftId,
    });
    expect(commitResult.success).toBe(true);
    expect(commitResult.committedCount).toBe(1);

    // Active query returns null
    const check = await userAT.query(draftsApi.getFormDraft, {
      formKey: "exam_entry",
    });
    expect(check).toBeNull();
  });

  it("enforces strict user isolation so User B cannot access User A's drafts", async () => {
    const t = convexTest(schema, modules);
    await setupTestHarness(t);

    const userAT = t.withIdentity(userAIdentity);
    const userBT = t.withIdentity(userBIdentity);

    // User A creates draft
    await userAT.mutation(draftsApi.saveFormDraft, {
      formKey: "confidential_notes",
      payload: { notes: "Confidential appraisal data" },
    });

    // User B attempts to query the same formKey
    const userBDraft = await userBT.query(draftsApi.getFormDraft, {
      formKey: "confidential_notes",
    });
    expect(userBDraft).toBeNull();
  });
});
