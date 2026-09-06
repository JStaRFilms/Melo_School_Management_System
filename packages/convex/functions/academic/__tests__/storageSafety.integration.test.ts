import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import { assertStorageUnclaimed, SECURE_UPLOAD_UNAVAILABLE_MESSAGE } from "../assetStorageBoundary";
import { seedReviewedTenantOperator } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const a = api.functions.academic;

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const schoolId = await ctx.db.insert("schools", { name: "Safe School", slug: "safe-school", status: "active", createdAt: now, updatedAt: now });
    const otherSchoolId = await ctx.db.insert("schools", { name: "Other School", slug: "other-school", status: "active", createdAt: now, updatedAt: now });
    const operator = await seedReviewedTenantOperator(ctx, [schoolId], "test|storage-operator");
    const [{ membershipId, userId: operatorUserId }] = operator.memberships;
    const classId = await ctx.db.insert("classes", { schoolId, name: "JSS 1", gradeName: "JSS 1", level: "secondary", createdAt: now, updatedAt: now });
    const subjectId = await ctx.db.insert("subjects", { schoolId, name: "Safety", code: "SAFE", createdAt: now, updatedAt: now });
    const sessionId = await ctx.db.insert("academicSessions", { schoolId, name: "2026", startDate: now, endDate: now + 1_000_000, isActive: true, createdAt: now, updatedAt: now });
    const termId = await ctx.db.insert("academicTerms", { schoolId, sessionId, name: "First", startDate: now, endDate: now + 1_000_000, isActive: true, createdAt: now, updatedAt: now });
    const topicId = await ctx.db.insert("knowledgeTopics", { schoolId, subjectId, termId, level: "JSS 1", title: "Safety", slug: "safety", searchText: "safety", status: "active", createdAt: now, updatedAt: now, createdBy: operatorUserId, updatedBy: operatorUserId });
    const studentUserId = await ctx.db.insert("users", { schoolId, authId: "storage-student", authTokenIdentifier: "test|storage-student", name: "Stored Student", email: "student@test.invalid", role: "student", createdAt: now, updatedAt: now });
    const historicalLogoStorageId = await ctx.storage.store(new Blob(["logo"], { type: "image/png" }));
    const historicalPhotoStorageId = await ctx.storage.store(new Blob(["photo"], { type: "image/png" }));
    await ctx.db.patch(schoolId, { logoStorageId: historicalLogoStorageId, logoFileName: "logo.png", logoContentType: "image/png" });
    const studentId = await ctx.db.insert("students", { schoolId, classId, userId: studentUserId, admissionNumber: "SAFE-1", photoStorageId: historicalPhotoStorageId, photoFileName: "photo.png", photoContentType: "image/png", createdAt: now, updatedAt: now });
    await ctx.db.insert("classSubjects", { schoolId, classId, subjectId, createdAt: now, updatedAt: now });
    await ctx.db.insert("studentSubjectSelections", { schoolId, studentId, classId, subjectId, sessionId, createdAt: now, updatedAt: now });
    const genericStorageId = await ctx.storage.store(new Blob(["generic"], { type: "image/png" }));
    const historicalKnowledgeStorageId = await ctx.storage.store(new Blob(["historical material"], { type: "application/pdf" }));
    const historicalMaterialId = await ctx.db.insert("knowledgeMaterials", {
      schoolId,
      ownerUserId: operatorUserId,
      ownerRole: "admin",
      sourceType: "file_upload",
      visibility: "private_owner",
      reviewStatus: "draft",
      title: "Historical material",
      level: "JSS 1",
      topicLabel: "Safety",
      storageId: historicalKnowledgeStorageId,
      searchStatus: "not_indexed",
      searchText: "Historical material",
      processingStatus: "ready",
      ingestionErrorMessage: null,
      ingestionAttemptCount: 1,
      labelSuggestions: [],
      chunkCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: operatorUserId,
      updatedBy: operatorUserId,
    });
    const materialId = await ctx.db.insert("knowledgeMaterials", {
      schoolId,
      ownerUserId: operatorUserId,
      ownerRole: "admin",
      sourceType: "file_upload",
      visibility: "private_owner",
      reviewStatus: "draft",
      title: "Existing shell",
      level: "JSS 1",
      topicLabel: "Safety",
      searchStatus: "not_indexed",
      searchText: "Existing shell",
      processingStatus: "awaiting_upload",
      ingestionErrorMessage: null,
      ingestionAttemptCount: 0,
      labelSuggestions: [],
      chunkCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: operatorUserId,
      updatedBy: operatorUserId,
    });
    const portalMaterialId = await ctx.db.insert("knowledgeMaterials", {
      schoolId,
      ownerUserId: studentUserId,
      ownerRole: "student",
      sourceType: "student_upload",
      visibility: "class_scoped",
      reviewStatus: "pending_review",
      title: "Portal shell",
      level: "JSS 1",
      topicLabel: "Safety",
      topicId,
      searchStatus: "not_indexed",
      searchText: "Portal shell",
      processingStatus: "awaiting_upload",
      ingestionErrorMessage: null,
      ingestionAttemptCount: 0,
      labelSuggestions: [],
      chunkCount: 0,
      indexedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: studentUserId,
      updatedBy: studentUserId,
    });
    for (const bindingPurpose of ["supplemental_upload", "topic_attachment"] as const) {
      await ctx.db.insert("knowledgeMaterialClassBindings", {
        schoolId,
        materialId: portalMaterialId,
        classId,
        bindingPurpose,
        bindingStatus: "active",
        createdAt: now,
        updatedAt: now,
        createdBy: studentUserId,
        updatedBy: studentUserId,
      });
    }
    const uploadIntentId = await ctx.db.insert("assetUploadIntents", { schoolId, requestedByTokenIdentifier: "test|storage-operator", requestedByUserId: operatorUserId, status: "pending", createdAt: now, updatedAt: now });
    return { schoolId, otherSchoolId, membershipId, operatorUserId, classId, subjectId, sessionId, termId, topicId, studentId, historicalLogoStorageId, historicalPhotoStorageId, historicalKnowledgeStorageId, historicalMaterialId, genericStorageId, materialId, portalMaterialId, uploadIntentId };
  });
  return {
    t,
    operator: t.withIdentity({ tokenIdentifier: "test|storage-operator", subject: "storage-operator" }),
    student: t.withIdentity({ tokenIdentifier: "test|storage-student", subject: "storage-student" }),
    ...ids,
  };
}

it("keeps authorized historical logo and student-photo reads while rejecting conflicting legacy ownership", async () => {
  const f = await fixture();
  expect(await f.operator.query(a.schoolBranding.getCurrentSchoolBranding, {})).toMatchObject({ schoolId: f.schoolId, logoUrl: expect.stringMatching(/^https?:/) });
  expect(await f.operator.query(a.studentEnrollment.getStudentProfile, { studentId: f.studentId })).toMatchObject({ photoUrl: expect.stringMatching(/^https?:/) });
  expect(await f.operator.query(a.lessonKnowledgeTeacher.getTeacherKnowledgeMaterialOriginalFileAccess, { materialId: f.historicalMaterialId })).toMatchObject({ downloadUrl: expect.stringMatching(/^https?:/) });
  await expect(f.t.run((ctx) => assertStorageUnclaimed(ctx, f.historicalPhotoStorageId))).rejects.toThrow("another owning purpose");
  await expect(f.t.run((ctx) => assertStorageUnclaimed(ctx, f.historicalKnowledgeStorageId))).rejects.toThrow("another owning purpose");

  await f.t.run((ctx) => ctx.db.patch(f.studentId, { photoStorageId: f.historicalLogoStorageId }));
  await expect(f.operator.query(a.studentEnrollment.getStudentProfile, { studentId: f.studentId })).rejects.toThrow("conflicting ownership");
  await expect(f.operator.mutation(a.schoolBranding.removeSchoolLogo, {})).rejects.toThrow("conflicting ownership");
  expect(await f.t.run(async (ctx) => Boolean(await ctx.storage.get(f.historicalLogoStorageId)))).toBe(true);
  expect(await f.t.run((ctx) => ctx.db.get(f.schoolId))).toMatchObject({ logoStorageId: f.historicalLogoStorageId });
});

it("preserves logo storage referenced by an immutable issued report", async () => {
  const f = await fixture();
  const report = await f.operator.query(a.reportCards.getStudentReportCard, {
    studentId: f.studentId,
    classId: f.classId,
    sessionId: f.sessionId,
    termId: f.termId,
  });
  await f.t.run((ctx) => ctx.db.insert("issuedReportCards", {
    schoolId: f.schoolId,
    studentId: f.studentId,
    sessionId: f.sessionId,
    termId: f.termId,
    classId: f.classId,
    issuedAt: Date.now(),
    issuedBy: f.operatorUserId,
    schoolLogoStorageId: f.historicalLogoStorageId,
    studentPhotoStorageId: f.historicalPhotoStorageId,
    report,
  }));

  await expect(f.operator.mutation(a.schoolBranding.removeSchoolLogo, {})).rejects.toThrow("conflicting ownership");
  expect(await f.t.run(async (ctx) => Boolean(await ctx.storage.get(f.historicalLogoStorageId)))).toBe(true);
  expect(await f.operator.query(a.reportCards.getStudentReportCard, {
    studentId: f.studentId,
    classId: f.classId,
    sessionId: f.sessionId,
    termId: f.termId,
  })).toMatchObject({ schoolLogoUrl: expect.stringMatching(/^https?:/) });
});

it("fails closed before URL issuance, intent or shell creation even when quota exists", async () => {
  const f = await fixture();
  await f.t.mutation(internal.functions.academic.metering.allocateQuota, { schoolId: f.schoolId, meterType: "storage_bytes", allocatedUnits: 100_000 });
  const before = await f.t.run(async (ctx) => ({
    intents: await ctx.db.query("assetUploadIntents").withIndex("by_school_and_status", q => q.eq("schoolId", f.schoolId).eq("status", "pending")).take(10),
    materials: await ctx.db.query("knowledgeMaterials").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(10),
  }));
  const unavailable = SECURE_UPLOAD_UNAVAILABLE_MESSAGE.slice(0, 35);
  await expect(f.operator.mutation(a.assets.createAssetUploadIntent, { schoolId: f.schoolId })).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.schoolBranding.generateSchoolLogoUploadUrl, {})).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.studentEnrollment.generateStudentPhotoUploadUrl, {})).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl, {
    title: "New material", subjectId: null, level: "JSS 1", topicLabel: "Safety", sourceType: "imported_curriculum",
  })).rejects.toThrow(unavailable);
  await expect(f.student.mutation(a.lessonKnowledgePortal.requestPortalSupplementalUploadUrl, {
    topicId: f.topicId, title: "Portal upload", description: null, fileContentType: "application/pdf", fileSize: 100, studentId: f.studentId,
  })).rejects.toThrow(unavailable);
  const after = await f.t.run(async (ctx) => ({
    intents: await ctx.db.query("assetUploadIntents").withIndex("by_school_and_status", q => q.eq("schoolId", f.schoolId).eq("status", "pending")).take(10),
    materials: await ctx.db.query("knowledgeMaterials").withIndex("by_school", q => q.eq("schoolId", f.schoolId)).take(10),
    allocation: await ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", q => q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes")).unique(),
  }));
  expect(after.intents).toEqual(before.intents);
  expect(after.materials).toEqual(before.materials);
  expect(after.allocation).toMatchObject({ consumedUnits: 0, reservedUnits: 0 });
});

it("rejects every unsafe finalizer before a generic storage ID can cross purposes", async () => {
  const f = await fixture();
  const unavailable = SECURE_UPLOAD_UNAVAILABLE_MESSAGE.slice(0, 35);
  await expect(f.operator.mutation(a.assets.finalizeAssetUpload, { schoolId: f.schoolId, uploadIntentId: f.uploadIntentId, storageId: f.genericStorageId, fileName: "generic.png", category: "General" })).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.schoolBranding.saveSchoolLogo, { logoStorageId: f.genericStorageId, logoFileName: "generic.png", logoContentType: "image/png" })).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.studentEnrollment.updateStudent, { studentId: f.studentId, photoStorageId: f.genericStorageId, photoFileName: "generic.png", photoContentType: "image/png" })).rejects.toThrow(unavailable);
  await expect(f.operator.mutation(a.lessonKnowledgeIngestion.finalizeKnowledgeMaterialUpload, { materialId: f.materialId, storageId: f.genericStorageId })).rejects.toThrow(unavailable);
  await expect(f.student.mutation(a.lessonKnowledgePortal.finalizePortalSupplementalUpload, { materialId: f.portalMaterialId, storageId: f.genericStorageId, studentId: f.studentId })).rejects.toThrow(unavailable);
  expect(await f.t.run((ctx) => ctx.db.get(f.schoolId))).toMatchObject({ logoStorageId: f.historicalLogoStorageId });
  expect(await f.t.run((ctx) => ctx.db.get(f.studentId))).toMatchObject({ photoStorageId: f.historicalPhotoStorageId });
  expect(await f.t.run((ctx) => ctx.db.get(f.materialId))).not.toHaveProperty("storageId");
  expect(await f.t.run((ctx) => ctx.db.get(f.portalMaterialId))).not.toHaveProperty("storageId");
  await expect(f.t.run((ctx) => assertStorageUnclaimed(ctx, f.genericStorageId))).resolves.toBeNull();
});

it("keeps authorization terminal before unavailable transport for cross-tenant and revoked callers", async () => {
  const crossTenant = await fixture();
  await expect(crossTenant.operator.mutation(a.assets.createAssetUploadIntent, { schoolId: crossTenant.otherSchoolId })).rejects.toThrow("authorized");
  await crossTenant.t.run(async (ctx) => {
    await ctx.db.patch(crossTenant.materialId, { schoolId: crossTenant.otherSchoolId });
    await ctx.db.patch(crossTenant.portalMaterialId, { schoolId: crossTenant.otherSchoolId });
  });
  await expect(crossTenant.operator.mutation(a.lessonKnowledgeIngestion.finalizeKnowledgeMaterialUpload, {
    materialId: crossTenant.materialId,
    storageId: crossTenant.genericStorageId,
  })).rejects.toThrow("not found");
  await expect(crossTenant.student.mutation(a.lessonKnowledgePortal.finalizePortalSupplementalUpload, {
    materialId: crossTenant.portalMaterialId,
    storageId: crossTenant.genericStorageId,
    studentId: crossTenant.studentId,
  })).rejects.toThrow("school");

  const revoked = await fixture();
  await revoked.t.run((ctx) => ctx.db.insert("membershipDirectRestrictions", { membershipId: revoked.membershipId, capability: "assets.upload", restrictedAt: Date.now() }));
  await expect(revoked.operator.mutation(a.assets.createAssetUploadIntent, { schoolId: revoked.schoolId })).rejects.toThrow("Forbidden");
  await expect(revoked.operator.mutation(a.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl, {
    title: "Revoked", subjectId: null, level: "JSS 1", topicLabel: "Safety", sourceType: "imported_curriculum",
  })).rejects.toThrow("Forbidden");
});
