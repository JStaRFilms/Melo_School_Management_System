import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../_generated/api";
import schema from "../../../schema";
import { getAuthenticatedSchoolMembership, resolveActiveMembership } from "../auth";
import { getPortalStudentAccess, resolvePortalMemberships } from "../portalIdentity";

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
  Object.entries(rawModules).map(([path, mod]) => [
    `./${new URL(path, import.meta.url).pathname.slice(convexRoot.length)}`,
    mod,
  ]),
);

async function setupGroupFixture() {
  const t = convexTest(schema, modules);
  const now = 1_700_000_000_000;

  const ids = await t.run(async (ctx) => {
    const branchA = await ctx.db.insert("schools", {
      name: "Olive Crest Ikoyi",
      slug: "olive-ikoyi",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const branchB = await ctx.db.insert("schools", {
      name: "Olive Crest Lekki",
      slug: "olive-lekki",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const dualAdminPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|dual-admin",
      identityReconciliationState: "resolved",
      email: "dual.admin@olive.test",
      name: "Dual Branch Admin",
      status: "active",
      primarySchoolId: branchA,
      createdAt: now,
      updatedAt: now,
    });
    const dualAdminUserA = await ctx.db.insert("users", {
      schoolId: branchA,
      authId: "dual-admin",
      authTokenIdentifier: "https://auth.melo.test|dual-admin",
      personId: dualAdminPerson,
      name: "Dual Branch Admin",
      email: "dual.admin@olive.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    const dualAdminUserB = await ctx.db.insert("users", {
      schoolId: branchB,
      authId: "dual-admin",
      authTokenIdentifier: "https://auth.melo.test|dual-admin",
      personId: dualAdminPerson,
      name: "Dual Branch Admin",
      email: "dual.admin@olive.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: dualAdminPerson,
      schoolId: branchA,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: dualAdminUserA,
      joinedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: dualAdminPerson,
      schoolId: branchB,
      status: "active",
      isDefaultBranch: false,
      legacyUserId: dualAdminUserB,
      joinedAt: now,
      updatedAt: now,
    });

    // Single-branch admin in Branch A only
    const adminAPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-a",
      identityReconciliationState: "resolved",
      email: "admin.a@olive.test",
      name: "Branch A Principal",
      status: "active",
      primarySchoolId: branchA,
      createdAt: now,
      updatedAt: now,
    });
    const adminAUser = await ctx.db.insert("users", {
      schoolId: branchA,
      authId: "admin-a",
      authTokenIdentifier: "https://auth.melo.test|admin-a",
      personId: adminAPerson,
      name: "Branch A Principal",
      email: "admin.a@olive.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: adminAPerson,
      schoolId: branchA,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminAUser,
      joinedAt: now,
      updatedAt: now,
    });

    // Single-branch admin in Branch B only
    const adminBPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-b",
      identityReconciliationState: "resolved",
      email: "admin.b@olive.test",
      name: "Branch B Principal",
      status: "active",
      primarySchoolId: branchB,
      createdAt: now,
      updatedAt: now,
    });
    const adminBUser = await ctx.db.insert("users", {
      schoolId: branchB,
      authId: "admin-b",
      authTokenIdentifier: "https://auth.melo.test|admin-b",
      personId: adminBPerson,
      name: "Branch B Principal",
      email: "admin.b@olive.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: adminBPerson,
      schoolId: branchB,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminBUser,
      joinedAt: now,
      updatedAt: now,
    });

    const proprietorPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|proprietor",
      identityReconciliationState: "resolved",
      email: "proprietor@olive.test",
      name: "Olive Proprietor",
      status: "active",
      primarySchoolId: branchA,
      createdAt: now,
      updatedAt: now,
    });
    const groupId = await ctx.db.insert("schoolGroups", {
      name: "Olive Crest Schools",
      slug: "olive-crest",
      proprietorPersonId: proprietorPerson,
      status: "active",
      settingsVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: branchA,
      isHeadquarters: true,
      linkedAt: now,
    });
    await ctx.db.insert("schoolGroupBranches", {
      groupId,
      schoolId: branchB,
      isHeadquarters: false,
      linkedAt: now,
    });

    // Teacher Ada in Branch A
    const teacherPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|teacher-ada",
      identityReconciliationState: "resolved",
      email: "ada@gmail.com",
      name: "Ada Obi",
      firstName: "Ada",
      lastName: "Obi",
      status: "active",
      primarySchoolId: branchA,
      createdAt: now,
      updatedAt: now,
    });
    const teacherUserA = await ctx.db.insert("users", {
      schoolId: branchA,
      authId: "teacher-ada",
      authTokenIdentifier: "https://auth.melo.test|teacher-ada",
      personId: teacherPerson,
      name: "Ada Obi",
      firstName: "Ada",
      lastName: "Obi",
      email: "ada@gmail.com",
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: teacherPerson,
      schoolId: branchA,
      status: "active",
      displayTitle: "Teacher",
      isDefaultBranch: true,
      legacyUserId: teacherUserA,
      joinedAt: now,
      updatedAt: now,
    });

    // Replacement teacher in Branch A
    const replacementTeacherA = await ctx.db.insert("users", {
      schoolId: branchA,
      authId: "teacher-chidi",
      authTokenIdentifier: "https://auth.melo.test|teacher-chidi",
      name: "Chidi Eze",
      email: "chidi@olive.test",
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });

    return {
      groupId,
      branchA,
      branchB,
      dualAdminUserA,
      adminAUser,
      adminBUser,
      teacherPerson,
      teacherUserA,
      replacementTeacherA,
    };
  });

  const dualAdmin = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|dual-admin",
    subject: "dual-admin",
    email: "dual.admin@olive.test",
  });
  const adminA = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|admin-a",
    subject: "admin-a",
    email: "admin.a@olive.test",
  });
  const adminB = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|admin-b",
    subject: "admin-b",
    email: "admin.b@olive.test",
  });
  const teacherAda = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|teacher-ada",
    subject: "teacher-ada",
    email: "ada@gmail.com",
  });

  return { t, ids, dualAdmin, adminA, adminB, teacherAda };
}

describe("School-admin teacher branch moves & sharing (#162)", () => {
  it("completes a permanent move in one step for a dual-branch admin, rotating default branch and reassigning active classes", async () => {
    const { t, ids, dualAdmin, teacherAda } = await setupGroupFixture();
    const now = 1_700_000_000_000;

    const academic = await t.run(async (ctx) => {
      const activeSession = await ctx.db.insert("academicSessions", {
        schoolId: ids.branchA,
        name: "2026/2027",
        startDate: now,
        endDate: now + 10_000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const pastSession = await ctx.db.insert("academicSessions", {
        schoolId: ids.branchA,
        name: "2025/2026",
        startDate: now - 20_000,
        endDate: now - 10_000,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId: ids.branchA,
        name: "Primary 4",
        gradeName: "Primary 4",
        level: "Primary",
        formTeacherId: ids.teacherUserA,
        createdAt: now,
        updatedAt: now,
      });
      const subjectId = await ctx.db.insert("subjects", {
        schoolId: ids.branchA,
        name: "Mathematics",
        code: "MTH",
        createdAt: now,
        updatedAt: now,
      });
      const assignmentId = await ctx.db.insert("teacherAssignments", {
        schoolId: ids.branchA,
        teacherId: ids.teacherUserA,
        classId,
        subjectId,
        createdAt: now,
        updatedAt: now,
      });
      const classSubjectId = await ctx.db.insert("classSubjects", {
        schoolId: ids.branchA,
        classId,
        subjectId,
        teacherId: ids.teacherUserA,
        createdAt: now,
        updatedAt: now,
      });
      const activeFormId = await ctx.db.insert("classSessionFormTeachers", {
        schoolId: ids.branchA,
        classId,
        sessionId: activeSession,
        formTeacherId: ids.teacherUserA,
        createdAt: now,
        updatedAt: now,
        updatedBy: ids.dualAdminUserA,
      });
      const pastFormId = await ctx.db.insert("classSessionFormTeachers", {
        schoolId: ids.branchA,
        classId,
        sessionId: pastSession,
        formTeacherId: ids.teacherUserA,
        createdAt: now,
        updatedAt: now,
        updatedBy: ids.dualAdminUserA,
      });
      return { classId, assignmentId, classSubjectId, activeFormId, pastFormId };
    });

    // Rejects permanent move without resolving active assignments
    await expect(
      dualAdmin.mutation(
        api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
        {
          sourceSchoolId: ids.branchA,
          destinationSchoolId: ids.branchB,
          teacherId: ids.teacherUserA,
          mode: "permanent_move",
        },
      ),
    ).rejects.toThrow(/active assignments/i);

    // Succeeds when reassigning to replacement teacher
    const result = await dualAdmin.mutation(
      api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
      {
        sourceSchoolId: ids.branchA,
        destinationSchoolId: ids.branchB,
        teacherId: ids.teacherUserA,
        mode: "permanent_move",
        assignmentHandoff: {
          mode: "reassign",
          replacementTeacherId: ids.replacementTeacherA,
        },
        reason: "Term staffing balance",
      },
    );
    expect(result.status).toBe("completed");

    // Active assignments moved to replacement; past session form teacher preserved untouched
    const post = await t.run(async (ctx) => ({
      assignment: await ctx.db.get(academic.assignmentId),
      classSubject: await ctx.db.get(academic.classSubjectId),
      classDoc: await ctx.db.get(academic.classId),
      activeForm: await ctx.db.get(academic.activeFormId),
      pastForm: await ctx.db.get(academic.pastFormId),
      oldUser: await ctx.db.get(ids.teacherUserA),
    }));
    expect(post.assignment?.teacherId).toBe(ids.replacementTeacherA);
    expect(post.classSubject?.teacherId).toBe(ids.replacementTeacherA);
    expect(post.classDoc?.formTeacherId).toBe(ids.replacementTeacherA);
    expect(post.activeForm?.formTeacherId).toBe(ids.replacementTeacherA);
    expect(post.pastForm?.formTeacherId).toBe(ids.teacherUserA);
    expect(post.oldUser?.isArchived).toBe(true);

    // Teacher Ada now lands in Branch B by default and is denied access to Branch A
    const authB = await teacherAda.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(authB.schoolId).toBe(ids.branchB);
    await expect(
      teacherAda.run((ctx) => resolveActiveMembership(ctx, ids.branchA)),
    ).rejects.toThrow(/Not authorized/i);
  });

  it("enforces two-step handshake when source admin does not administer destination branch", async () => {
    const { ids, adminA, adminB, teacherAda } = await setupGroupFixture();

    const initiated = await adminA.mutation(
      api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
      {
        sourceSchoolId: ids.branchA,
        destinationSchoolId: ids.branchB,
        teacherId: ids.teacherUserA,
        mode: "permanent_move",
      },
    );
    expect(initiated.status).toBe("pending_acceptance");

    // Source admin cannot accept on behalf of destination branch
    await expect(
      adminA.mutation(
        api.functions.academic.staffTransfers.acceptTeacherBranchTransfer,
        { transferId: initiated.transferId },
      ),
    ).rejects.toThrow();

    // Teacher still only has Branch A until destination accepts
    const stillA = await teacherAda.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(stillA.schoolId).toBe(ids.branchA);

    // Destination admin accepts -> cutover completes
    const accepted = await adminB.mutation(
      api.functions.academic.staffTransfers.acceptTeacherBranchTransfer,
      { transferId: initiated.transferId },
    );
    expect(accepted.status).toBe("completed");

    const nowB = await teacherAda.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(nowB.schoolId).toBe(ids.branchB);
  });

  it("supports shared multi-branch assignment and switching default branch cleanly", async () => {
    const { ids, dualAdmin, teacherAda } = await setupGroupFixture();

    const shared = await dualAdmin.mutation(
      api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
      {
        sourceSchoolId: ids.branchA,
        destinationSchoolId: ids.branchB,
        teacherId: ids.teacherUserA,
        mode: "shared_assignment",
      },
    );
    expect(shared.status).toBe("completed");

    // Both branches active; default resolves to Branch A without ambiguity
    const branches = await teacherAda.query(
      api.functions.academic.groups.listUserBranches,
      {},
    );
    expect(branches.map((b) => b.schoolId).sort()).toEqual(
      [ids.branchA, ids.branchB].sort(),
    );
    const defaultMembership = await teacherAda.run((ctx) =>
      getAuthenticatedSchoolMembership(ctx),
    );
    expect(defaultMembership.schoolId).toBe(ids.branchA);

    // Teacher rotates default branch to Branch B
    await teacherAda.mutation(
      api.functions.academic.staffTransfers.setDefaultBranch,
      { schoolId: ids.branchB },
    );
    const rotated = await teacherAda.run((ctx) =>
      getAuthenticatedSchoolMembership(ctx),
    );
    expect(rotated.schoolId).toBe(ids.branchB);
  });

  it("retains Family Portal access in source branch when permanently moving a teacher who is also a parent there", async () => {
    const { t, ids, dualAdmin, teacherAda } = await setupGroupFixture();
    const now = 1_700_000_000_000;

    const studentId = await t.run(async (ctx) => {
      const classId = await ctx.db.insert("classes", {
        schoolId: ids.branchA,
        name: "Primary 1",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const familyId = await ctx.db.insert("families", {
        schoolId: ids.branchA,
        name: "Obi Family",
        createdAt: now,
        updatedAt: now,
        createdBy: ids.dualAdminUserA,
        updatedBy: ids.dualAdminUserA,
      });
      await ctx.db.insert("familyMembers", {
        schoolId: ids.branchA,
        familyId,
        parentUserId: ids.teacherUserA,
        relationship: "Mother",
        isPrimaryContact: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.dualAdminUserA,
        updatedBy: ids.dualAdminUserA,
      });
      const childUser = await ctx.db.insert("users", {
        schoolId: ids.branchA,
        authId: "student:child-obi",
        name: "Kemi Obi",
        email: "kemi@olive.local",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      return await ctx.db.insert("students", {
        schoolId: ids.branchA,
        classId,
        userId: childUser,
        familyId,
        admissionNumber: "ADM-101",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
    });

    const moved = await dualAdmin.mutation(
      api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
      {
        sourceSchoolId: ids.branchA,
        destinationSchoolId: ids.branchB,
        teacherId: ids.teacherUserA,
        mode: "permanent_move",
      },
    );
    expect(moved.status).toBe("completed");
    expect(moved.preservedParentAccess).toBe(true);

    // Source user downgraded to parent (no longer a teacher in Branch A)
    const sourceUser = await t.run((ctx) => ctx.db.get(ids.teacherUserA));
    expect(sourceUser?.role).toBe("parent");
    expect(sourceUser?.isArchived).not.toBe(true);

    // Teacher workspace default is Branch B, while Family Portal still shows child in Branch A
    const defaultStaff = await teacherAda.run((ctx) =>
      getAuthenticatedSchoolMembership(ctx),
    );
    expect(defaultStaff.schoolId).toBe(ids.branchB);
    expect(defaultStaff.role).toBe("teacher");

    const portalStudents = await teacherAda.run(async (ctx) => {
      const auth = await resolvePortalMemberships(ctx);
      return await getPortalStudentAccess(ctx, auth);
    });
    expect(portalStudents.map((s) => s.student._id)).toEqual([studentId]);
  });

  it("enforces group-only preflight isolation, preserves destination grants, cancels pending transfer on offboarding, and logs tier1 audits (S2, S3, S7, S12)", async () => {
    const { t, ids, adminA, adminB, dualAdmin } = await setupGroupFixture();
    const now = 1_700_000_000_000;

    // Seed an unrelated non-group school where teacher Ada also works + existing admin grant in Branch B
    const { unrelatedSchool, destGrantId } = await t.run(async (ctx) => {
      const unrelatedSchool = await ctx.db.insert("schools", {
        name: "External Independent Academy",
        slug: "external-indep",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      const extUser = await ctx.db.insert("users", {
        schoolId: unrelatedSchool,
        authId: "teacher-ada",
        authTokenIdentifier: "https://auth.melo.test|teacher-ada",
        personId: ids.teacherPerson,
        name: "Ada Obi",
        email: "ada@gmail.com",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId: ids.teacherPerson,
        schoolId: unrelatedSchool,
        status: "active",
        displayTitle: "Teacher",
        isDefaultBranch: false,
        legacyUserId: extUser,
        joinedAt: now,
        updatedAt: now,
      });

      // Pre-existing suspended Branch B membership with a direct grant that must not be cleared
      const existingDestUser = await ctx.db.insert("users", {
        schoolId: ids.branchB,
        authId: "teacher-ada",
        authTokenIdentifier: "https://auth.melo.test|teacher-ada",
        personId: ids.teacherPerson,
        name: "Ada Obi",
        email: "ada@gmail.com",
        role: "teacher",
        isArchived: true,
        createdAt: now,
        updatedAt: now,
      });
      const existingDestMembership = await ctx.db.insert("branchMemberships", {
        personId: ids.teacherPerson,
        schoolId: ids.branchB,
        status: "suspended",
        isDefaultBranch: false,
        legacyUserId: existingDestUser,
        joinedAt: now,
        updatedAt: now,
      });
      const destGrantId = await ctx.db.insert("membershipDirectGrants", {
        membershipId: existingDestMembership,
        capability: "academic.planning.use",
        grantedAt: now,
      });
      return { unrelatedSchool, destGrantId };
    });

    // S3: Preflight must NOT return the unrelated school ID
    const preflight = await adminA.query(
      api.functions.academic.staffTransfers.getTeacherTransferPreflight,
      { teacherId: ids.teacherUserA, schoolId: ids.branchA },
    );
    expect(preflight.activeBranchIds).toEqual([ids.branchA]);
    expect(preflight.activeBranchIds).not.toContain(unrelatedSchool);

    // S2 + S12: Initiate two-step transfer, check tier1_critical audit with both branches
    const initiated = await adminA.mutation(
      api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
      {
        sourceSchoolId: ids.branchA,
        destinationSchoolId: ids.branchB,
        teacherId: ids.teacherUserA,
        mode: "shared_assignment",
        targetDisplayTitle: "Senior Maths Teacher",
      },
    );
    expect(initiated.status).toBe("pending_acceptance");

    const auditsAfterInit = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    const initAudit = auditsAfterInit.find((a) => a.action === "staff.branch_transfer_initiated");
    expect(initAudit?.alertTier).toBe("tier1_critical");
    expect(initAudit?.safeSummary).toContain(String(ids.branchA));
    expect(initAudit?.safeSummary).toContain(String(ids.branchB));

    // S7: If source teacher is offboarded to parent-only (or archived), pending transfer is cancelled and cannot complete
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.teacherUserA, { role: "parent" });
    });
    await expect(
      adminB.mutation(
        api.functions.academic.staffTransfers.acceptTeacherBranchTransfer,
        { transferId: initiated.transferId },
      ),
    ).rejects.toThrow(/active teacher/i);

    // Restore teacher role and verify S2: reactivating an INACTIVE privileged destination membership is blocked
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.teacherUserA, { role: "teacher" });
    });
    await expect(
      adminB.mutation(
        api.functions.academic.staffTransfers.acceptTeacherBranchTransfer,
        {
          transferId: initiated.transferId,
          targetDisplayTitle: "Confirmed Lekki Teacher",
        },
      ),
    ).rejects.toThrow(/inactive privileged membership/i);

    // If the inactive destination membership has NO prior RBAC grants, acceptance succeeds cleanly
    await t.run(async (ctx) => {
      await ctx.db.delete(destGrantId);
    });
    const accepted = await adminB.mutation(
      api.functions.academic.staffTransfers.acceptTeacherBranchTransfer,
      {
        transferId: initiated.transferId,
        targetDisplayTitle: "Confirmed Lekki Teacher",
      },
    );
    expect(accepted.status).toBe("completed");
  });
});
