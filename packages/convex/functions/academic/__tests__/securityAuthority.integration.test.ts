import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import "../../auth";
import { api } from "../../../_generated/api";
import { seedReviewedTenantOperator } from "./securityFixtures";
import { getAuthenticatedSchoolMembership } from "../auth";
import { getContextCapabilities, evaluateEffectiveCapabilities } from "../rbac";
import { getAccessibleWorkspaceSections } from "../../../../shared/src/workspace-navigation";
import { getWorkspaceCapabilityDenial } from "../../../../shared/src/workspace-route-access";
const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [`./${new URL(path, import.meta.url).pathname.slice(root.length)}`, module]));
const a = api.functions.academic;
async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools", { name: "School", slug: "school", status: "active", createdAt: 1, updatedAt: 1 });
    const otherId = await ctx.db.insert("schools", { name: "Other", slug: "other", status: "active", createdAt: 1, updatedAt: 1 });
    const operator = await seedReviewedTenantOperator(ctx, [schoolId], "test|tenant");
    const [member] = operator.memberships;
    const classId = await ctx.db.insert("classes", { schoolId, name: "Primary 1", level: "primary", createdAt: 1, updatedAt: 1 });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: 1, endDate: 9999999999999, isActive: true, createdAt: 1, updatedAt: 1 });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: 1, endDate: 9999999999999, isActive: true, createdAt: 1, updatedAt: 1 });
    const childUserId = await ctx.db.insert("users", { schoolId, authId: "child", name: "Private Child", email: "child@test.invalid", role: "student", createdAt: 1, updatedAt: 1 });
    const studentId = await ctx.db.insert("students", { schoolId, userId: childUserId, classId, admissionNumber: "A-1", gender: "female", createdAt: 1, updatedAt: 1 });
    const bankAccountId = await ctx.db.insert("schoolBankAccounts", { schoolId, bankName: "Bank", accountName: "School", accountNumber: "SECRET-123456789", currency: "NGN", isDefault: true, status: "active", createdAt: 1, updatedAt: 1 });
    const storageId = await ctx.storage.store(new Blob(["private"]));
    const assetId = await ctx.db.insert("schoolAssets", { schoolId, storageId, fileName: "Private.pdf", category: "General", mimeType: "application/pdf", byteSize: 7, sha256: "fixture", scanStatus: "quarantined", isTrashed: false, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("platformAdmins", { authId: "platform", authTokenIdentifier: "test|platform", name: "Platform", email: "platform@test.invalid", isActive: true, createdAt: 1, updatedAt: 1 });
    return { otherId, ...member, classId, studentId, sessionId, termId, bankAccountId, assetId, storageId };
  });
  const viewer = t.withIdentity({ tokenIdentifier: "test|tenant", issuer: "test", subject: "tenant" });
  const platform = t.withIdentity({ tokenIdentifier: "test|platform", issuer: "test", subject: "platform" });
  const restrict = (capability: string) => t.run(ctx => ctx.db.insert("membershipDirectRestrictions", { membershipId: ids.membershipId, capability, restrictedAt: 1 }));
  return { t, viewer, platform, restrict, ...ids };
}

describe("R1 authority, not legacy-role or UI bypass", () => {
  it("retains enrollment lifecycle parity for an explicitly migrated unrestricted admin", async () => {
    const f = await fixture();
    const studentId = await f.viewer.mutation(a.studentEnrollment.createStudent, { classId: f.classId, firstName: "New", lastName: "Student", admissionNumber: "A-2", gender: "female", overrideConfirmed: true, overrideReason: "Reviewed supplied admission number" });
    await f.viewer.mutation(a.studentEnrollment.updateStudent, { studentId, guardianName: "Reviewed Guardian" });
    await f.viewer.mutation(a.studentEnrollment.archiveStudent, { studentId });
    await f.viewer.mutation(a.studentEnrollment.restoreStudent, { studentId });
    await f.viewer.mutation(a.studentEnrollment.deleteStudent, { studentId });
    expect(await f.t.run(ctx => ctx.db.get(studentId))).toMatchObject({ isArchived: true, guardianName: "Reviewed Guardian" });
    await expect(f.viewer.mutation(a.studentEnrollment.generateStudentPhotoUploadUrl, {})).rejects.toThrow("Uploads unavailable");
    const access = await f.viewer.query(api.functions.auth.getViewerAccess, {});
    expect(getWorkspaceCapabilityDenial("admin", "/academic/students/onboarding", access)).toBeNull();
  });
  it("restricts a managed legacy admin in navigation, direct URLs, student reads/writes, credentials and storage", async () => {
    const f = await fixture();
    await expect(f.viewer.mutation(a.studentEnrollment.updateStudent, { studentId: f.studentId, guardianName: "Allowed" })).resolves.toBeNull();
    await f.restrict("enrollment.intakes.manage");
    const access = await f.viewer.query(api.functions.auth.getViewerAccess, {});
    expect(access.state).toBe("ready");
    expect(getAccessibleWorkspaceSections("admin", { access }).map(s => s.href)).not.toContain("/academic/students");
    for (const path of ["/academic/students", "/academic/students/onboarding", "/academic/students/transfers"])
      expect(getWorkspaceCapabilityDenial("admin", path, access)?.state).toBe("forbidden");
    const calls = [
      () => f.viewer.mutation(a.studentEnrollment.createStudent, { classId: f.classId, name: "No Create", admissionNumber: "A-2", gender: "female" }),
      () => f.viewer.mutation(a.studentEnrollment.updateStudent, { studentId: f.studentId, guardianName: "Denied" }),
      () => f.viewer.mutation(a.studentEnrollment.archiveStudent, { studentId: f.studentId }),
      () => f.viewer.mutation(a.studentEnrollment.deleteStudent, { studentId: f.studentId }),
      () => f.viewer.mutation(a.studentEnrollment.restoreStudent, { studentId: f.studentId }),
      () => f.viewer.query(a.studentEnrollment.getStudentProfile, { studentId: f.studentId }),
      () => f.viewer.mutation(a.studentEnrollment.generateStudentPhotoUploadUrl, {}),
      () => f.viewer.action(a.studentEnrollment.upsertStudentPortalCredentialsByStudentId, { studentId: f.studentId, temporaryPassword: "Not-dispatched-123!" }),
      () => f.viewer.mutation(a.drafts.beginFormDraft, { schoolId: f.schoolId, formKey: "student_onboarding", schemaVersion: 1 }),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow("Forbidden");
    expect(await f.t.run(ctx => ctx.db.get(f.studentId))).toMatchObject({ guardianName: "Allowed" });
  });

  it("enforces bank aliases, export formats, permission editor and destructive assets on direct calls", async () => {
    const f = await fixture();
    expect(await f.viewer.query(a.bankAccounts.getBankAccount, { schoolId: f.schoolId, bankAccountId: f.bankAccountId })).toMatchObject({ accountNumber: "SECRET-123456789" });
    for (const cap of ["bank.manage", "audit.export.csv", "audit.export.pdf", "permissions.manage", "assets.permanent_delete", "assets.trash.manage", "assets.upload", "academic.report_cards.publish_final"]) await f.restrict(cap);
    const calls = [
      () => f.viewer.query(a.bankAccounts.getBankAccount, { schoolId: f.schoolId, bankAccountId: f.bankAccountId }),
      () => f.viewer.mutation(a.bankAccounts.setPrimaryBankAccount, { schoolId: f.schoolId, bankAccountId: f.bankAccountId, confirmation: "CONFIRM" }),
      () => f.viewer.query(a.rbac.getPermissionWorkspace, { schoolId: f.schoolId }),
      () => f.viewer.query(a.rbac.previewEffectiveCapabilities, { schoolId: f.schoolId, membershipId: f.membershipId, candidateDirectGrants: ["permissions.manage"] }).then(result => { expect(result).not.toContain("staff.permissions.manage"); }),
      () => f.viewer.mutation(a.assets.permanentPurgeAsset, { schoolId: f.schoolId, assetId: f.assetId, confirmation: "PURGE Private.pdf" }),
      () => f.viewer.mutation(a.assets.trashAsset, { schoolId: f.schoolId, assetId: f.assetId }),
      () => f.viewer.mutation(a.assets.createAssetUploadIntent, { schoolId: f.schoolId }),
      () => f.viewer.mutation(a.reportCards.certifyStudentReportCard, { studentId: f.studentId, sessionId: f.sessionId, termId: f.termId, classId: f.classId, confirmation: "A-1", reviewedKey: "stale" }),
    ];
    // Self preview is intentionally readable and restrictions still win over candidate grants.
    await calls.splice(3, 1)[0]();
    for (const call of calls) await expect(call()).rejects.toThrow("Forbidden");
    for (const exportFormat of ["csv", "pdf"] as const)
      await expect(f.viewer.query(a.audit.queryAuditPage, { scope: { kind: "branch", schoolId: f.schoolId }, paginationOpts: { numItems: 10, cursor: null }, exportFormat })).rejects.toThrow("export");
    const access = await f.viewer.query(api.functions.auth.getViewerAccess, {});
    for (const path of ["/billing/bank-accounts", "/admin/permissions", "/admin/assets/trash"])
      expect(getWorkspaceCapabilityDenial("admin", path, access)?.state).toBe("forbidden");
    expect(await f.t.run(async ctx => Boolean(await ctx.storage.get(f.storageId)))).toBe(true);
  });

  it("denies ordinary Platform tenant operations while retaining explicit Platform governance", async () => {
    const f = await fixture();
    expect(await f.platform.run(ctx => getContextCapabilities(ctx, { schoolId: f.schoolId, role: "super_admin", isPlatformAdmin: true }))).toEqual([]);
    const calls = [
      () => f.platform.query(a.bankAccounts.getBankAccount, { schoolId: f.schoolId, bankAccountId: f.bankAccountId }),
      () => f.platform.query(a.bankAccounts.listBankAccounts, { schoolId: f.schoolId }),
      () => f.platform.query(a.assets.getWorkspace, { schoolId: f.schoolId }),
      () => f.platform.mutation(a.assets.createAssetUploadIntent, { schoolId: f.schoolId }),
      () => f.platform.query(a.rbac.getPermissionWorkspace, { schoolId: f.schoolId }),
      () => f.platform.query(a.rbac.previewEffectiveCapabilities, { schoolId: f.schoolId, membershipId: f.membershipId }),
      () => f.platform.query(a.drafts.getFormDraft, { schoolId: f.schoolId, formKey: "student_onboarding" }),
      () => f.platform.query(a.migrationWorkspace.listWorkspaces, { schoolId: f.schoolId }),
      () => f.platform.run(ctx => getAuthenticatedSchoolMembership(ctx, { schoolId: f.schoolId, capability: "enrollment.intakes.manage" })),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow();
    expect(await f.platform.query(a.transfers.getTransferWorkspace, { schoolId: f.schoolId })).toEqual({ allowed: false });
    expect((await f.platform.query(a.groups.listGroups, { paginationOpts: { numItems: 10, cursor: null } })).page).toEqual([]);
    expect(await f.platform.query(a.audit.getAuditAccess, { scope: { kind: "platform" } })).toMatchObject({ platformOnly: true });
    await expect(f.viewer.query(a.audit.getAuditAccess, { scope: { kind: "platform" } })).rejects.toThrow();
    await expect(f.viewer.query(a.bankAccounts.getBankAccount, { schoolId: f.otherId, bankAccountId: f.bankAccountId })).rejects.toThrow();
  });

  it("does not let a trusted-subject legacy Platform account fall through to a shadow school admin", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("platformAdmins", { authId: "legacy-platform", name: "Legacy Platform", email: "legacy@test.invalid", isActive: true, createdAt: 1, updatedAt: 1 });
      await ctx.db.insert("users", { schoolId: f.schoolId, authId: "legacy-platform", name: "Shadow", email: "shadow@test.invalid", role: "admin", createdAt: 1, updatedAt: 1 });
    });
    const legacy = f.t.withIdentity({ subject: "legacy-platform", issuer: "https://legacy-auth.test" });
    await expect(legacy.mutation(a.studentEnrollment.generateStudentPhotoUploadUrl, {})).rejects.toThrow("Platform governance");
    await expect(legacy.query(a.bankAccounts.getBankAccount, { schoolId: f.schoolId, bankAccountId: f.bankAccountId })).rejects.toThrow("Forbidden");
  });

  it("does not let legacy photo/logo endpoints or old asset DTOs bypass asset transport restrictions", async () => {
    const f = await fixture();
    await f.restrict("assets.download.standard");
    await f.restrict("assets.permanent_delete");
    await f.restrict("assets.archive.manage");
    await expect(f.viewer.mutation(a.schoolBranding.saveSchoolLogo, { logoStorageId: f.storageId, logoFileName: "pretend.png", logoContentType: "image/png" })).rejects.toThrow("Uploads unavailable");
    await expect(f.viewer.mutation(a.studentEnrollment.updateStudent, { studentId: f.studentId, photoStorageId: f.storageId, photoFileName: "pretend.png", photoContentType: "image/png" })).rejects.toThrow("Uploads unavailable");
    const rows = await f.viewer.query(a.assets.listSchoolAssets, { schoolId: f.schoolId });
    expect(rows[0]).not.toHaveProperty("storageId");
    await expect(f.viewer.query(a.assets.listAssets, { schoolId: f.schoolId, workspace: "archive", paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow("assets.archive.manage");
    // Historical bad links must not expose or delete the separately governed object either.
    await f.t.run(ctx => ctx.db.patch(f.schoolId, { logoStorageId: f.storageId }));
    await expect(f.viewer.mutation(a.schoolBranding.removeSchoolLogo, {})).rejects.toThrow("conflicting ownership");
    expect(await f.t.run(async ctx => Boolean(await ctx.storage.get(f.storageId)))).toBe(true);
  });

  it("cleared managed configuration never resurrects the legacy admin baseline; unmapped APIs deny", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const assignments = await ctx.db.query("membershipRoleAssignments").withIndex("by_membership", q => q.eq("membershipId", f.membershipId)).take(10);
      for (const assignment of assignments) await ctx.db.delete(assignment._id);
    });
    expect(await f.t.run(ctx => evaluateEffectiveCapabilities(ctx, f.membershipId))).toEqual([]);
    await expect(f.viewer.mutation(a.studentEnrollment.generateStudentPhotoUploadUrl, {})).rejects.toThrow("Forbidden");
    await expect(f.viewer.query(a.adminLeadership.listSchoolAdmins, {})).rejects.toThrow("capability");
    await expect(f.viewer.action(a.adminLeadership.createSchoolAdmin, { name: "No escalation", email: "denied@test.invalid", temporaryPassword: "Not-dispatched-123!", origin: "https://test.invalid" })).rejects.toThrow("capability");
    const access = await f.viewer.query(api.functions.auth.getViewerAccess, {});
    expect(getWorkspaceCapabilityDenial("admin", "/admin", access)?.state).toBe("forbidden");
  });
});
