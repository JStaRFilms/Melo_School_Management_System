import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../_generated/api";
import schema from "../../../schema";
import rateLimiterSchema from "../../../node_modules/@convex-dev/rate-limiter/src/component/schema";
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
const rateModules = import.meta.glob(
  "../../../node_modules/@convex-dev/rate-limiter/src/component/**/*.ts",
);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function extractToken(invitePath: string): string {
  const parts = invitePath.split("/invite/");
  if (parts.length !== 2 || !parts[1]) throw new Error("Missing token in invitePath");
  return parts[1];
}

async function setupTwoUnrelatedSchools() {
  const t = convexTest(schema, modules);
  t.registerComponent("rateLimiter", rateLimiterSchema, rateModules);
  const now = 1_700_000_000_000;

  const ids = await t.run(async (ctx) => {
    const schoolA = await ctx.db.insert("schools", {
      name: "Sunrise Academy",
      slug: "sunrise-academy",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const schoolB = await ctx.db.insert("schools", {
      name: "Greenfield College",
      slug: "greenfield-college",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const adminAPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-sunrise",
      identityReconciliationState: "resolved",
      email: "admin@sunrise.test",
      name: "Sunrise Admin",
      status: "active",
      primarySchoolId: schoolA,
      createdAt: now,
      updatedAt: now,
    });
    const adminAUser = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "admin-sunrise",
      authTokenIdentifier: "https://auth.melo.test|admin-sunrise",
      personId: adminAPerson,
      name: "Sunrise Admin",
      email: "admin@sunrise.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: adminAPerson,
      schoolId: schoolA,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminAUser,
      joinedAt: now,
      updatedAt: now,
    });

    const adminBPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|admin-greenfield",
      identityReconciliationState: "resolved",
      email: "admin@greenfield.test",
      name: "Greenfield Admin",
      status: "active",
      primarySchoolId: schoolB,
      createdAt: now,
      updatedAt: now,
    });
    const adminBUser = await ctx.db.insert("users", {
      schoolId: schoolB,
      authId: "admin-greenfield",
      authTokenIdentifier: "https://auth.melo.test|admin-greenfield",
      personId: adminBPerson,
      name: "Greenfield Admin",
      email: "admin@greenfield.test",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: adminBPerson,
      schoolId: schoolB,
      status: "active",
      isDefaultBranch: true,
      legacyUserId: adminBUser,
      joinedAt: now,
      updatedAt: now,
    });

    // Existing teacher Ada in School A (uses personal Gmail)
    const adaPerson = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.melo.test|ada-gmail",
      identityReconciliationState: "resolved",
      email: "ada@gmail.com",
      name: "Ada Obi",
      firstName: "Ada",
      lastName: "Obi",
      status: "active",
      primarySchoolId: schoolA,
      createdAt: now,
      updatedAt: now,
    });
    const adaUserA = await ctx.db.insert("users", {
      schoolId: schoolA,
      authId: "ada-gmail",
      authTokenIdentifier: "https://auth.melo.test|ada-gmail",
      personId: adaPerson,
      name: "Ada Obi",
      firstName: "Ada",
      lastName: "Obi",
      email: "ada@gmail.com",
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("branchMemberships", {
      personId: adaPerson,
      schoolId: schoolA,
      status: "active",
      displayTitle: "Teacher",
      isDefaultBranch: true,
      legacyUserId: adaUserA,
      joinedAt: now,
      updatedAt: now,
    });

    return { schoolA, schoolB, adminAUser, adminBUser, adaPerson, adaUserA };
  });

  const adminA = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|admin-sunrise",
    subject: "admin-sunrise",
    email: "admin@sunrise.test",
  });
  const adminB = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|admin-greenfield",
    subject: "admin-greenfield",
    email: "admin@greenfield.test",
  });
  const ada = t.withIdentity({
    tokenIdentifier: "https://auth.melo.test|ada-gmail",
    subject: "ada-gmail",
    email: "ada@gmail.com",
  });

  return { t, ids, adminA, adminB, ada };
}

describe("Cross-school Invite & Claim, concurrent multi-school teachers, and same-school teacher-parents (#164)", () => {
  it("lets a teacher who left School A join unrelated School B with the same personal email", async () => {
    const { t, ids, adminA, adminB, ada } = await setupTwoUnrelatedSchools();

    // School A archives Ada (leaves School A -> person archived since no other active schools yet)
    await adminA.mutation(api.functions.academic.academicSetup.archiveTeacher, {
      teacherId: ids.adaUserA,
    });
    const archivedPerson = await t.run((ctx) => ctx.db.get(ids.adaPerson));
    expect(archivedPerson?.status).toBe("archived");

    // School B invites ada@gmail.com without any email conflict or tenant leakage
    const invite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      {
        name: "Ada Obi",
        firstName: "Ada",
        lastName: "Obi",
        email: "ada@gmail.com",
      },
    );
    expect(invite.invitePath).toMatch(/^\/invite\/[a-f0-9]+$/);
    expect(invite.inviteUrl).toBe(`http://localhost:3101${invite.invitePath}`);

    // Ada accepts with her existing Melo identity
    const token = extractToken(invite.invitePath);
    const inspected = await ada.query(
      api.functions.academic.invitations.inspectInvitation,
      { token },
    );
    expect(inspected).toMatchObject({
      state: "pending",
      schoolName: "Greenfield College",
      intendedRole: "teacher",
      viewerSignedIn: true,
      viewerEmailMatches: true,
    });

    const accepted = await ada.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token },
    );
    expect(accepted.schoolId).toBe(ids.schoolB);

    // Ada is active at School B and stays locked out of School A
    const activeCtx = await ada.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(activeCtx.schoolId).toBe(ids.schoolB);
    await expect(
      ada.run((ctx) => resolveActiveMembership(ctx, ids.schoolA)),
    ).rejects.toThrow(/Not authorized/i);

    // Single-use token replay is rejected
    await expect(
      ada.mutation(
        api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
        { token },
      ),
    ).rejects.toThrow(/no longer valid/i);
  }, 15_000);

  it("supports a teacher working concurrently at two unrelated Melo schools without ambiguous identity errors", async () => {
    const { ids, adminB, ada } = await setupTwoUnrelatedSchools();

    // School B invites ada@gmail.com while Ada is STILL active at School A
    const invite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      {
        name: "Ada Obi",
        email: "ada@gmail.com",
      },
    );
    const token = extractToken(invite.invitePath);
    await ada.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token },
    );

    // Both unrelated schools appear in workspace switcher (groupId: null)
    const branches = await ada.query(
      api.functions.academic.groups.listUserBranches,
      {},
    );
    expect(branches).toHaveLength(2);
    expect(branches.every((b) => b.groupId === null)).toBe(true);

    // Default school access works cleanly (no ambiguous canonical identity!)
    const defaultAuth = await ada.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(defaultAuth.schoolId).toBe(ids.schoolA);

    // Explicit School B access also works cleanly
    const schoolBAuth = await ada.run((ctx) =>
      getAuthenticatedSchoolMembership(ctx, { schoolId: ids.schoolB }),
    );
    expect(schoolBAuth.schoolId).toBe(ids.schoolB);

    // getViewerAccess exposes valid default school so standard routes stay accessible
    const viewerAccess = await ada.query(api.functions.auth.getViewerAccess, {});
    expect(viewerAccess).toMatchObject({
      state: "ready",
      branch: { schoolId: ids.schoolA },
      compatibility: { legacyDefaultSchoolId: ids.schoolA },
    });
  });

  it("links one parent login across two unrelated Melo schools via Invite & Claim and blocks shared-identity admin password overwrites", async () => {
    const { t, ids, adminB } = await setupTwoUnrelatedSchools();
    const now = 1_700_000_000_000;

    const { studentAId, studentBId, parentBUserId } = await t.run(async (ctx) => {
      const parentPerson = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|parent-blessing",
        identityReconciliationState: "resolved",
        email: "blessing@gmail.com",
        name: "Blessing Okafor",
        status: "active",
        primarySchoolId: ids.schoolA,
        createdAt: now,
        updatedAt: now,
      });
      const parentAUserId = await ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "parent-blessing",
        authTokenIdentifier: "https://auth.melo.test|parent-blessing",
        personId: parentPerson,
        name: "Blessing Okafor",
        email: "blessing@gmail.com",
        role: "parent",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId: parentPerson,
        schoolId: ids.schoolA,
        status: "active",
        isDefaultBranch: true,
        legacyUserId: parentAUserId,
        joinedAt: now,
        updatedAt: now,
      });

      const classA = await ctx.db.insert("classes", {
        schoolId: ids.schoolA,
        name: "Primary 3",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const familyA = await ctx.db.insert("families", {
        schoolId: ids.schoolA,
        name: "Okafor Family",
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminAUser,
        updatedBy: ids.adminAUser,
      });
      await ctx.db.insert("familyMembers", {
        schoolId: ids.schoolA,
        familyId: familyA,
        parentUserId: parentAUserId,
        relationship: "Mother",
        isPrimaryContact: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminAUser,
        updatedBy: ids.adminAUser,
      });
      const childAUser = await ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "student:okafor-a",
        name: "Tunde Okafor",
        email: "tunde@sunrise.local",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const studentAId = await ctx.db.insert("students", {
        schoolId: ids.schoolA,
        classId: classA,
        userId: childAUser,
        familyId: familyA,
        admissionNumber: "SR-001",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Unlinked parent record in School B with same email
      const parentBUserId = await ctx.db.insert("users", {
        schoolId: ids.schoolB,
        authId: "parent:greenfield-pending",
        name: "Blessing Okafor",
        email: "blessing@gmail.com",
        role: "parent",
        createdAt: now,
        updatedAt: now,
      });
      const classB = await ctx.db.insert("classes", {
        schoolId: ids.schoolB,
        name: "JSS 1",
        level: "Secondary",
        createdAt: now,
        updatedAt: now,
      });
      const familyB = await ctx.db.insert("families", {
        schoolId: ids.schoolB,
        name: "Okafor Family",
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminBUser,
        updatedBy: ids.adminBUser,
      });
      await ctx.db.insert("familyMembers", {
        schoolId: ids.schoolB,
        familyId: familyB,
        parentUserId: parentBUserId,
        relationship: "Mother",
        isPrimaryContact: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminBUser,
        updatedBy: ids.adminBUser,
      });
      const childBUser = await ctx.db.insert("users", {
        schoolId: ids.schoolB,
        authId: "student:okafor-b",
        name: "Ngozi Okafor",
        email: "ngozi@greenfield.local",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const studentBId = await ctx.db.insert("students", {
        schoolId: ids.schoolB,
        classId: classB,
        userId: childBUser,
        familyId: familyB,
        admissionNumber: "GF-001",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      return { studentAId, studentBId, parentBUserId };
    });

    const invite = await adminB.mutation(
      api.functions.academic.invitations.createParentInvitation,
      { userId: parentBUserId },
    );

    const blessing = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|parent-blessing",
      subject: "parent-blessing",
      email: "blessing@gmail.com",
    });

    // Wrong account cannot claim Blessing's invite
    const wrongUser = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|ada-gmail",
      subject: "ada-gmail",
      email: "ada@gmail.com",
    });
    await expect(
      wrongUser.mutation(
        api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
        { token: extractToken(invite.invitePath) },
      ),
    ).rejects.toThrow(/different email address/i);

    // Blessing accepts invite -> sees BOTH children from School A & School B in Family Portal
    await blessing.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token: extractToken(invite.invitePath) },
    );
    const accessible = await blessing.run(async (ctx) => {
      const auth = await resolvePortalMemberships(ctx);
      return await getPortalStudentAccess(ctx, auth);
    });
    expect(accessible.map((entry) => entry.student._id).sort()).toEqual(
      [studentAId, studentBId].sort(),
    );

    // Admin at School B cannot overwrite password on a shared multi-school parent account
    await expect(
      adminB.mutation(
        internal.functions.academic.studentEnrollment.beginPortalProvisionInternal,
        { userId: parentBUserId, operationId: "op-shared-reset" },
      ),
    ).rejects.toThrow(/shared across multiple schools/i);
  });

  it("handles same-school Parent -> Teacher promotion and Teacher -> Parent-only offboarding safely", async () => {
    const { t, ids, adminA } = await setupTwoUnrelatedSchools();
    const now = 1_700_000_000_000;

    const { parentUserId, studentId } = await t.run(async (ctx) => {
      const personId = await ctx.db.insert("persons", {
        authTokenIdentifier: "https://auth.melo.test|parent-turned-teacher",
        identityReconciliationState: "resolved",
        email: "segun@gmail.com",
        name: "Segun Adeyemi",
        status: "active",
        primarySchoolId: ids.schoolA,
        createdAt: now,
        updatedAt: now,
      });
      const parentUserId = await ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "parent-turned-teacher",
        authTokenIdentifier: "https://auth.melo.test|parent-turned-teacher",
        personId,
        name: "Segun Adeyemi",
        email: "segun@gmail.com",
        role: "parent",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId,
        schoolId: ids.schoolA,
        status: "active",
        isDefaultBranch: true,
        legacyUserId: parentUserId,
        joinedAt: now,
        updatedAt: now,
      });
      const classId = await ctx.db.insert("classes", {
        schoolId: ids.schoolA,
        name: "Primary 2",
        level: "Primary",
        createdAt: now,
        updatedAt: now,
      });
      const familyId = await ctx.db.insert("families", {
        schoolId: ids.schoolA,
        name: "Adeyemi Family",
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminAUser,
        updatedBy: ids.adminAUser,
      });
      await ctx.db.insert("familyMembers", {
        schoolId: ids.schoolA,
        familyId,
        parentUserId,
        relationship: "Father",
        isPrimaryContact: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ids.adminAUser,
        updatedBy: ids.adminAUser,
      });
      const childUser = await ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "student:segun-child",
        name: "Tolu Adeyemi",
        email: "tolu@sunrise.local",
        role: "student",
        createdAt: now,
        updatedAt: now,
      });
      const studentId = await ctx.db.insert("students", {
        schoolId: ids.schoolA,
        classId,
        userId: childUser,
        familyId,
        admissionNumber: "SR-202",
        enrollmentStatus: "active",
        createdAt: now,
        updatedAt: now,
      });
      return { parentUserId, studentId };
    });

    // Inviting the same email directly guides admin to same-school promotion
    await expect(
      adminA.mutation(api.functions.academic.invitations.createTeacherInvitation, {
        name: "Segun Adeyemi",
        email: "segun@gmail.com",
      }),
    ).rejects.toThrow(/already belongs to a parent in this school/i);

    // Promote parent to teacher -> immediately active with existing login + keeps Family Portal
    const promoted = await adminA.mutation(
      api.functions.academic.academicSetup.promoteParentToTeacher,
      { parentUserId },
    );
    expect(promoted.alreadyHasLogin).toBe(true);

    const segun = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|parent-turned-teacher",
      subject: "parent-turned-teacher",
      email: "segun@gmail.com",
    });

    const staffCtx = await segun.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(staffCtx.role).toBe("teacher");
    const portalWhileTeacher = await segun.run(async (ctx) => {
      const auth = await resolvePortalMemberships(ctx);
      return await getPortalStudentAccess(ctx, auth);
    });
    expect(portalWhileTeacher.map((e) => e.student._id)).toEqual([studentId]);

    // Now Segun stops teaching while his child stays enrolled -> offboard downgrades to parent only
    await adminA.mutation(api.functions.academic.academicSetup.archiveTeacher, {
      teacherId: parentUserId,
    });
    const afterOffboard = await t.run((ctx) => ctx.db.get(parentUserId));
    expect(afterOffboard?.role).toBe("parent");
    expect(afterOffboard?.isArchived).not.toBe(true);

    // Family Portal access remains completely uninterrupted!
    const portalAfterOffboard = await segun.run(async (ctx) => {
      const auth = await resolvePortalMemberships(ctx);
      return await getPortalStudentAccess(ctx, auth);
    });
    expect(portalAfterOffboard.map((e) => e.student._id)).toEqual([studentId]);
  });

  it("reports honest delivery state when Resend is unconfigured and rejects revoked invites", async () => {
    const { ids, adminB } = await setupTwoUnrelatedSchools();

    const invite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      {
        name: "New Teacher",
        email: "new.teacher@gmail.com",
      },
    );

    // Simulate Resend delivery claim without API key
    const claimed = await adminB.mutation(
      internal.functions.academic.invitations.claimInvitationDeliveryInternal,
      {
        invitationId: invite.invitationId,
        hasApiKey: false,
      },
    );
    expect(claimed).toBeNull();

    const list = await adminB.query(
      api.functions.academic.invitations.listSchoolInvitations,
      { schoolId: ids.schoolB },
    );
    expect(list[0]).toMatchObject({
      invitationId: invite.invitationId,
      status: "pending",
      deliveryState: "not_configured",
    });

    // Revoking marks invite revoked and archives the unclaimed placeholder user
    await adminB.mutation(
      api.functions.academic.invitations.revokeSchoolInvitation,
      { invitationId: invite.invitationId },
    );
    const inspected = await adminB.query(
      api.functions.academic.invitations.inspectInvitation,
      { token: extractToken(invite.invitePath) },
    );
    expect(inspected.state).toBe("revoked");
  }, 15_000);

  it("dispatches invitation email through Resend with idempotency key and marks provider-accepted state", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("MELO_EMAIL_FROM", "Melo <invites@jstarstudios.com>");
    vi.stubEnv("TEACHER_APP_URL", "https://teacher.meloschool.test");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "re_invite_123" }), { status: 200 }),
    );
    const { t, ids, adminB } = await setupTwoUnrelatedSchools();

    const invite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      {
        name: "Resend Teacher",
        email: "resend.teacher@gmail.com",
      },
    );
    expect(invite.inviteUrl).toBe(`https://teacher.meloschool.test${invite.invitePath}`);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      `school-invitation/${invite.invitationId}`,
    );

    const list = await adminB.query(
      api.functions.academic.invitations.listSchoolInvitations,
      { schoolId: ids.schoolB },
    );
    expect(list[0]).toMatchObject({
      invitationId: invite.invitationId,
      deliveryState: "accepted",
      deliveryAttemptCount: 1,
    });
  }, 15_000);

  it("enforces stale-invite revalidation, single-school self-managed credential protection, legacy canonicalization, and unactivated parent promotion (S4, S5, S6, S8, S9)", async () => {
    const { t, ids, adminA, adminB } = await setupTwoUnrelatedSchools();
    const now = 1_700_000_000_000;

    // S4: Production rejects issuing an invite when TEACHER_APP_URL is unset
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEACHER_APP_URL", "");
    await expect(
      adminB.mutation(api.functions.academic.invitations.createTeacherInvitation, {
        name: "Prod Teacher",
        email: "prod.teacher@gmail.com",
      }),
    ).rejects.toThrow(/TEACHER_APP_URL/i);
    vi.unstubAllEnvs();

    // S8: Existing legacy user (no persons row yet) in School A claims School B and retains access to School A
    const legacyUserA = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "legacy-kofi",
        authTokenIdentifier: "https://auth.melo.test|legacy-kofi",
        name: "Kofi Mensah",
        email: "kofi@gmail.com",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      }),
    );
    const kofiInvite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      { name: "Kofi Mensah", email: "kofi@gmail.com" },
    );
    const kofi = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|legacy-kofi",
      subject: "legacy-kofi",
      email: "kofi@gmail.com",
    });
    await kofi.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token: extractToken(kofiInvite.invitePath) },
    );
    const kofiBranches = await kofi.query(api.functions.academic.groups.listUserBranches, {});
    expect(kofiBranches.map((b) => b.schoolId).sort()).toEqual([ids.schoolA, ids.schoolB].sort());
    const kofiLegacyRow = await t.run((ctx) => ctx.db.get(legacyUserA));
    expect(kofiLegacyRow?.personId).toBeTruthy();

    // S6: Even with ONE school membership, an invite-claimed account is self-managed and blocks admin password reset & email edit
    const soloInvite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      { name: "Solo Teacher", email: "solo@gmail.com" },
    );
    const solo = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|solo-teacher",
      subject: "solo-teacher",
      email: "solo@gmail.com",
    });
    await solo.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token: extractToken(soloInvite.invitePath) },
    );
    await expect(
      adminB.mutation(
        internal.functions.academic.academicSetup.beginTeacherPasswordResetInternal,
        { teacherId: soloInvite.targetUserId, operationId: "op-self-managed" },
      ),
    ).rejects.toThrow(/self-managed or shared/i);
    await expect(
      adminB.mutation(
        internal.functions.academic.academicSetup.updateTeacherRecordInternal,
        {
          teacherId: soloInvite.targetUserId,
          schoolId: ids.schoolB,
          email: "hijack@gmail.com",
        },
      ),
    ).rejects.toThrow(/Shared or self-managed/i);

    // S5: Changing target email revokes pending invitation and blocks claim
    const staleInvite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      { name: "Stale Teacher", email: "stale@gmail.com" },
    );
    await adminB.mutation(
      internal.functions.academic.academicSetup.updateTeacherRecordInternal,
      {
        teacherId: staleInvite.targetUserId,
        schoolId: ids.schoolB,
        email: "updated.stale@gmail.com",
      },
    );
    const staleIdentity = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|stale-teacher",
      subject: "stale-teacher",
      email: "stale@gmail.com",
    });
    await expect(
      staleIdentity.mutation(
        api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
        { token: extractToken(staleInvite.invitePath) },
      ),
    ).rejects.toThrow(/no longer valid/i);

    // S9: Promoting an unactivated parent returns invite URL and marks lifecycle details as pending invitation
    const unactivatedParent = await t.run((ctx) =>
      ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "parent:unactivated-1",
        name: "Bola Ade",
        email: "bola@gmail.com",
        role: "parent",
        createdAt: now,
        updatedAt: now,
      }),
    );
    const promoted = await adminA.mutation(
      api.functions.academic.academicSetup.promoteParentToTeacher,
      { parentUserId: unactivatedParent },
    );
    expect(promoted.alreadyHasLogin).toBe(false);
    expect(promoted.inviteUrl).toMatch(/^http:\/\/localhost:3101\/invite\/[a-f0-9]+$/);
    const lifecycle = await adminA.query(
      api.functions.academic.academicSetup.getTeacherLifecycleDetails,
      { teacherId: unactivatedParent, schoolId: ids.schoolA },
    );
    expect(lifecycle.isPendingInvitation).toBe(true);

    // S14: After correcting a pending teacher's email (which revokes the old invite), admin can reissue a fresh invite
    const reissued = await adminB.mutation(
      api.functions.academic.invitations.reissueTeacherInvitation,
      { teacherId: staleInvite.targetUserId, schoolId: ids.schoolB },
    );
    expect(reissued.email).toBe("updated.stale@gmail.com");
    expect(reissued.inviteUrl).toMatch(/^http:\/\/localhost:3101\/invite\/[a-f0-9]+$/);

    // S15: Archiving a default membership clears isDefaultBranch and promotes another active membership; restoring never creates two defaults
    const archiveRestoredTarget = await t.run((ctx) => ctx.db.get(ids.adaUserA));
    expect(archiveRestoredTarget).not.toBeNull();
    // Give Ada a second school membership in School B first
    const adaBInvite = await adminB.mutation(
      api.functions.academic.invitations.createTeacherInvitation,
      { name: "Ada Obi", email: "ada@gmail.com" },
    );
    const ada = t.withIdentity({
      tokenIdentifier: "https://auth.melo.test|ada-gmail",
      subject: "ada-gmail",
      email: "ada@gmail.com",
    });
    await ada.mutation(
      api.functions.academic.invitations.acceptInvitationAsAuthenticatedUser,
      { token: extractToken(adaBInvite.invitePath) },
    );
    // Archive Ada in School A (was default) -> School B becomes default
    await adminA.mutation(api.functions.academic.academicSetup.archiveTeacher, {
      teacherId: ids.adaUserA,
      schoolId: ids.schoolA,
    });
    const afterArchiveDefault = await ada.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(afterArchiveDefault.schoolId).toBe(ids.schoolB);

    // Restore Ada in School A -> still exactly ONE default membership (School B) and sign-in stays resolved
    await adminA.mutation(api.functions.academic.academicSetup.restoreTeacher, {
      teacherId: ids.adaUserA,
    });
    const adaMemberships = await t.run((ctx) =>
      ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_status", (q) =>
          q.eq("personId", ids.adaPerson).eq("status", "active"),
        )
        .collect(),
    );
    expect(adaMemberships.filter((m) => m.isDefaultBranch)).toHaveLength(1);
    const afterRestoreAccess = await ada.query(api.functions.auth.getViewerAccess, {});
    expect(afterRestoreAccess.state).toBe("ready");

    // S6: Real acquired lock that expires after 60s cannot commit a late email update in updateTeacherRecordInternal
    await adminB.mutation(
      internal.functions.academic.academicSetup.beginTeacherEmailUpdateInternal,
      {
        teacherId: staleInvite.targetUserId,
        schoolId: ids.schoolB,
        normalizedEmail: "late@gmail.com",
        operationId: "real-expiring-op-id",
      },
    );
    vi.advanceTimersByTime(61_000);
    await expect(
      adminB.mutation(
        internal.functions.academic.academicSetup.updateTeacherRecordInternal,
        {
          teacherId: staleInvite.targetUserId,
          schoolId: ids.schoolB,
          email: "late@gmail.com",
          operationId: "real-expiring-op-id",
        },
      ),
    ).rejects.toThrow(/lock expired or was superseded/i);
    await adminB.mutation(
      internal.functions.academic.academicSetup.releaseTeacherCredentialLockInternal,
      { teacherId: staleInvite.targetUserId, operationId: "real-expiring-op-id" },
    );

    // S17: Legacy teacher with a real authId (no personId yet) is NOT marked isUnboundLogin
    const legacyAuthTeacher = await t.run((ctx) =>
      ctx.db.insert("users", {
        schoolId: ids.schoolA,
        authId: "ba-legacy-real-id",
        name: "Legacy Teacher",
        email: "legacy.auth@gmail.com",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      }),
    );
    const legacyLifecycle = await adminA.query(
      api.functions.academic.academicSetup.getTeacherLifecycleDetails,
      { teacherId: legacyAuthTeacher, schoolId: ids.schoolA },
    );
    expect(legacyLifecycle.isUnboundLogin).toBe(false);
    expect(legacyLifecycle.isPendingInvitation).toBe(false);

    // S18: Archiving default membership prefers an active school (including omitted status) even when a suspended school appears first
    const { suspendedSchool, omittedStatusSchool } = await t.run(async (ctx) => {
      // Archive Ada's original School A membership so only newly created memberships remain after School B is archived
      const existingA = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", ids.adaPerson).eq("schoolId", ids.schoolA),
        )
        .unique();
      if (existingA) {
        await ctx.db.patch(existingA._id, { status: "archived", isDefaultBranch: false });
      }
      const suspendedSchool = await ctx.db.insert("schools", {
        name: "Suspended School",
        slug: "suspended-school",
        status: "suspended",
        createdAt: now,
        updatedAt: now,
      });
      const suspUser = await ctx.db.insert("users", {
        schoolId: suspendedSchool,
        authId: "ada-gmail",
        authTokenIdentifier: "https://auth.melo.test|ada-gmail",
        personId: ids.adaPerson,
        name: "Ada Obi",
        email: "ada@gmail.com",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      // Inserted BEFORE omittedStatusSchool so it appears first in by_person_and_status
      await ctx.db.insert("branchMemberships", {
        personId: ids.adaPerson,
        schoolId: suspendedSchool,
        status: "active",
        isDefaultBranch: false,
        legacyUserId: suspUser,
        joinedAt: now,
        updatedAt: now,
      });

      const omittedStatusSchool = await ctx.db.insert("schools", {
        name: "Omitted Status School",
        slug: "omitted-status-school",
        createdAt: now,
        updatedAt: now,
      });
      const omittedUser = await ctx.db.insert("users", {
        schoolId: omittedStatusSchool,
        authId: "ada-gmail",
        authTokenIdentifier: "https://auth.melo.test|ada-gmail",
        personId: ids.adaPerson,
        name: "Ada Obi",
        email: "ada@gmail.com",
        role: "teacher",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("branchMemberships", {
        personId: ids.adaPerson,
        schoolId: omittedStatusSchool,
        status: "active",
        isDefaultBranch: false,
        legacyUserId: omittedUser,
        joinedAt: now,
        updatedAt: now,
      });
      return { suspendedSchool, omittedStatusSchool };
    });
    // Archive Ada in School B (default) -> omittedStatusSchool (active via default) must be promoted ahead of suspendedSchool
    await adminB.mutation(api.functions.academic.academicSetup.archiveTeacher, {
      teacherId: adaBInvite.targetUserId,
      schoolId: ids.schoolB,
    });
    const promotedDefault = await ada.run((ctx) => getAuthenticatedSchoolMembership(ctx));
    expect(promotedDefault.schoolId).toBe(omittedStatusSchool);
    expect(promotedDefault.schoolId).not.toBe(suspendedSchool);
  }, 15_000);
});
