import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../../_generated/dataModel";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import * as auth from "../../auth";
import * as academicSetup from "../academicSetup";
import * as groups from "../groups";
import * as migrationWorkspace from "../migrationWorkspace";
import * as lessonKnowledgePortal from "../lessonKnowledgePortal";
import { isTrustedLegacySubjectIssuer } from "../identityResolver";

declare global {
  interface ImportMeta {
    glob(pattern: string | string[]): Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("../../../**/*.ts");

type MutationRef = FunctionReference<"mutation", "public", any, any>;
type QueryRef = FunctionReference<"query", "public", any, any>;

const createWorkspace = migrationWorkspace.createWorkspace as unknown as MutationRef;
const getPortalTopicIndexData = lessonKnowledgePortal.getPortalTopicIndexData as unknown as QueryRef;
const getViewerAccess = auth.getViewerAccess as unknown as QueryRef;
const listUserBranches = groups.listUserBranches as unknown as QueryRef;
const createTeacherRecordInternal = academicSetup.createTeacherRecordInternal as unknown as MutationRef;
const updateTeacherRecordInternal = academicSetup.updateTeacherRecordInternal as unknown as MutationRef;
const archiveTeacher = academicSetup.archiveTeacher as unknown as MutationRef;
const restoreTeacher = academicSetup.restoreTeacher as unknown as MutationRef;

describe("token-first trusted legacy identity endpoints", () => {
  it("keeps same-deployment subject fallback behind an explicit switch", () => {
    const original = process.env.LEGACY_SUBJECT_FALLBACK_ENABLED;
    try {
      process.env.LEGACY_SUBJECT_FALLBACK_ENABLED = "false";
      expect(isTrustedLegacySubjectIssuer("https://deployment-auth.test")).toBe(false);
      process.env.LEGACY_SUBJECT_FALLBACK_ENABLED = "true";
      expect(isTrustedLegacySubjectIssuer("https://deployment-auth.test/")).toBe(true);
    } finally {
      process.env.LEGACY_SUBJECT_FALLBACK_ENABLED = original;
    }
  });

  it("denies untrusted legacy issuers at migration and portal endpoints", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Identity Academy",
        slug: "identity-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: "legacy-student",
        name: "Legacy Student",
        email: "student@identity.test",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const attacker = t.withIdentity({
      subject: "legacy-student",
      issuer: "https://untrusted-auth.test",
    });

    await expect(
      attacker.mutation(createWorkspace, {
        schoolId,
        name: "Denied migration",
        mode: "school_admin",
      })
    ).rejects.toThrow("untrusted legacy identity issuer");
    await expect(attacker.query(getPortalTopicIndexData, {})).rejects.toThrow(
      "untrusted legacy identity issuer"
    );
    await expect(
      attacker.query(listUserBranches, {}),
    ).resolves.toEqual([]);
  });

  it("accepts exact legacy identities issued by the current deployment", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Existing Production School",
        slug: "existing-production-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("users", {
        schoolId,
        authId: "existing-admin",
        name: "Existing Administrator",
        email: "admin@existing.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });
    const viewer = t.withIdentity({
      tokenIdentifier: "https://deployment-auth.test|existing-admin",
      subject: "existing-admin",
      issuer: "https://deployment-auth.test/",
    });

    const branches = await viewer.query(
      listUserBranches,
      {},
    );
    expect(branches).toEqual([
      expect.objectContaining({ schoolId, slug: "existing-production-school" }),
    ]);
  });

  it("provisions new teachers with a canonical person and active default membership", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("schools", {
        name: "New Production School",
        slug: "new-production-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    });
    const teacherId = await t.mutation(
      createTeacherRecordInternal,
      {
        schoolId,
        name: "New Teacher",
        email: "teacher@new.test",
        authId: "new-teacher",
      },
    );
    const canonicalTeacherId = teacherId as Id<"users">;
    const records = await t.run(async (ctx) => {
      const teacher = await ctx.db.get(canonicalTeacherId);
      const person = teacher?.personId
        ? await ctx.db.get(teacher.personId)
        : null;
      const membership = person
        ? await ctx.db
            .query("branchMemberships")
            .withIndex("by_person_and_school", (q) =>
              q.eq("personId", person._id).eq("schoolId", schoolId),
            )
            .unique()
        : null;
      return { teacher, person, membership };
    });
    expect(records.teacher).toMatchObject({
      authTokenIdentifier: "https://deployment-auth.test|new-teacher",
      personId: records.person?._id,
    });
    expect(records.person).toMatchObject({
      authTokenIdentifier: "https://deployment-auth.test|new-teacher",
      identityReconciliationState: "resolved",
      primarySchoolId: schoolId,
    });
    expect(records.membership).toMatchObject({
      schoolId,
      personId: records.person?._id,
      legacyUserId: canonicalTeacherId,
      status: "active",
      isDefaultBranch: true,
    });

    const viewer = t.withIdentity({
      tokenIdentifier: "https://deployment-auth.test|new-teacher",
      subject: "new-teacher",
      issuer: "https://deployment-auth.test",
    });
    await expect(
      viewer.query(listUserBranches, {}),
    ).resolves.toEqual([
      expect.objectContaining({ schoolId, membershipRoleTitle: "Teacher" }),
    ]);

    await t.mutation(updateTeacherRecordInternal, {
      teacherId: canonicalTeacherId,
      schoolId,
      name: "Updated Teacher",
      email: "updated@new.test",
    });
    const adminToken = "https://deployment-auth.test|school-admin";
    await t.run(ctx =>
      ctx.db.insert("users", {
        schoolId,
        authId: "school-admin",
        authTokenIdentifier: adminToken,
        name: "School Admin",
        email: "admin@new.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const admin = t.withIdentity({
      tokenIdentifier: adminToken,
      subject: "school-admin",
      issuer: "https://deployment-auth.test",
    });
    await admin.mutation(archiveTeacher, { teacherId: canonicalTeacherId });
    let lifecycle = await t.run(async ctx => ({
      teacher: await ctx.db.get(canonicalTeacherId),
      person: records.person ? await ctx.db.get(records.person._id) : null,
      membership: records.membership
        ? await ctx.db.get(records.membership._id)
        : null,
    }));
    expect(lifecycle.teacher).toMatchObject({
      name: "Updated Teacher",
      email: "updated@new.test",
      isArchived: true,
    });
    expect(lifecycle.person).toMatchObject({
      name: "Updated Teacher",
      email: "updated@new.test",
      status: "archived",
    });
    expect(lifecycle.membership).toMatchObject({ status: "archived" });

    await admin.mutation(restoreTeacher, { teacherId: canonicalTeacherId });
    lifecycle = await t.run(async ctx => ({
      teacher: await ctx.db.get(canonicalTeacherId),
      person: records.person ? await ctx.db.get(records.person._id) : null,
      membership: records.membership
        ? await ctx.db.get(records.membership._id)
        : null,
    }));
    expect(lifecycle.teacher?.isArchived).toBe(false);
    expect(lifecycle.teacher?.archivedAt).toBeUndefined();
    expect(lifecycle.person?.status).toBe("active");
    expect(lifecycle.membership?.status).toBe("active");
  });

  it("allows a trusted prelinked legacy identity only through its exact active membership", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Migrated School",
        slug: "migrated-school",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const personId = await ctx.db.insert("persons", {
        email: "admin@migrated.test",
        name: "Migrated Administrator",
        status: "active",
        primarySchoolId: schoolId,
        createdAt: now,
        updatedAt: now,
      });
      const userId = await ctx.db.insert("users", {
        schoolId,
        personId,
        authId: "migrated-admin",
        name: "Migrated Administrator",
        email: "admin@migrated.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      const membershipId = await ctx.db.insert("branchMemberships", {
        personId,
        schoolId,
        status: "active",
        isDefaultBranch: true,
        legacyUserId: userId,
        joinedAt: now,
        updatedAt: now,
      });
      return { schoolId, membershipId };
    });
    const viewer = t.withIdentity({
      tokenIdentifier: "https://deployment-auth.test|migrated-admin",
      subject: "migrated-admin",
      issuer: "https://deployment-auth.test",
    });
    await expect(
      viewer.query(getViewerAccess, {}),
    ).resolves.toMatchObject({
      state: "ready",
      branch: { schoolId: ids.schoolId },
    });

    await t.run((ctx) =>
      ctx.db.patch(ids.membershipId, { status: "suspended", updatedAt: Date.now() }),
    );
    await expect(viewer.query(getViewerAccess, {})).resolves.toMatchObject({
      state: "forbidden",
    });
  });

  it("fails closed on duplicate canonical rows and mismatched subject prelinks", async () => {
    const t = convexTest(schema, modules);
    const schoolId = await t.run(async (ctx) => {
      const now = Date.now();
      const schoolId = await ctx.db.insert("schools", {
        name: "Ambiguity Academy",
        slug: "ambiguity-academy",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      for (const suffix of ["one", "two"]) {
        await ctx.db.insert("users", {
          schoolId,
          authId: `duplicate-${suffix}`,
          authTokenIdentifier: "https://auth.test|duplicate",
          name: `Duplicate ${suffix}`,
          email: `duplicate-${suffix}@identity.test`,
          role: "admin",
          isSchoolAdmin: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      await ctx.db.insert("users", {
        schoolId,
        authId: "mismatched-subject",
        authTokenIdentifier: "https://auth.test|other-token",
        name: "Mismatched Admin",
        email: "mismatched@identity.test",
        role: "admin",
        isSchoolAdmin: true,
        createdAt: now,
        updatedAt: now,
      });
      return schoolId;
    });

    const duplicate = t.withIdentity({
      tokenIdentifier: "https://auth.test|duplicate",
      subject: "duplicate-one",
      issuer: "https://legacy-auth.test",
    });
    await expect(duplicate.query(getPortalTopicIndexData, {})).rejects.toThrow("ambiguous canonical identity");

    const mismatch = t.withIdentity({
      tokenIdentifier: "https://auth.test|unknown-token",
      subject: "mismatched-subject",
      issuer: "https://legacy-auth.test",
    });
    await expect(mismatch.mutation(createWorkspace, {
      schoolId,
      name: "Mismatched prelink",
      mode: "school_admin",
    })).rejects.toThrow("mismatched canonical identity link");
  });
});
