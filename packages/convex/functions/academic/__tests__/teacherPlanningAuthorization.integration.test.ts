import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { PermissionCapability } from "../rbac";
import { storageSha256ToHex } from "../knowledgeUploadReadiness";
import { seedReviewedTenantOperatorWithCapabilities } from "./securityFixtures";

const root = new URL("../../../", import.meta.url).pathname;
const modules = Object.fromEntries(
  Object.entries(import.meta.glob(["../../../**/*.ts", "!../../../**/*.test.ts"])).map(([path, module]) => [
    `./${new URL(path, import.meta.url).pathname.slice(root.length)}`,
    module,
  ]),
);
const academic = api.functions.academic;

type TeacherKey = "none" | "planning" | "planningUpload" | "curriculum" | "curriculumUpload" | "unassigned";

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const schoolId = await ctx.db.insert("schools", {
      name: "Planning School",
      slug: "planning-school",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    const now = Date.now();
    const rate = {
      currency: "NGN",
      perStudentMinor: 100_000,
      setupMinor: 0,
      minimumMinor: 0,
      discountBps: 0,
      bands: [],
      cadence: "termly" as const,
      proration: "daily" as const,
    };
    const rateVersionId = await ctx.db.insert("commercialRateVersions", {
      code: "test_rate",
      name: "Test rate",
      version: 1,
      effectiveFrom: now - 1_000,
      rate,
      createdAt: now,
    });
    const contractId = await ctx.db.insert("commercialContracts", {
      schoolId,
      rateVersionId,
      rate,
      code: "test_rate",
      version: 1,
      effectiveFrom: now - 1_000,
      effectiveTo: now + 86_400_000,
      setupHandling: "waived",
      setupReason: "Test storage entitlement",
      createdAt: now,
    });
    const entitlement = {
      allowances: [{ meterType: "storage_bytes" as const, baseUnits: 100_000, graceUnits: 0 }],
      warningPercent: 75,
      criticalPercent: 90,
      hardStopPercent: 100,
      maxFileSizeBytes: 12 * 1024 * 1024,
      maxPagesPerOperation: 500,
      profiles: [{ task: "knowledge_upload" as const, meterType: "storage_bytes" as const, unitsPerItem: 1, maxItems: 12 * 1024 * 1024, modelProfile: "secure-upload" }],
    };
    const entitlementVersionId = await ctx.db.insert("usageEntitlementVersions", {
      code: "test_storage",
      name: "Test storage",
      version: 1,
      effectiveFrom: now - 1_000,
      entitlement,
      createdAt: now,
    });
    const cycleId = await ctx.db.insert("usageCycles", {
      schoolId,
      contractId,
      entitlementVersionId,
      code: "test_storage",
      version: 1,
      entitlement,
      startAt: now - 1_000,
      endAt: now + 86_400_000,
      status: "active",
      createdAt: now,
    });
    await ctx.db.insert("usageMeterAllocations", {
      schoolId,
      cycleId,
      meterType: "storage_bytes",
      allocatedUnits: 100_000,
      baseUnits: 100_000,
      graceUnits: 0,
      topUpUnits: 0,
      exceptionUnits: 0,
      poolUnits: 0,
      consumedUnits: 0,
      activeStorageBytes: 0,
      trashStorageBytes: 0,
      tempStorageBytes: 0,
      reservedUnits: 0,
      warningThresholdPercent: 75,
      criticalThresholdPercent: 90,
      hardStopThresholdPercent: 100,
      resetCadence: "termly",
      lastResetAt: now,
      updatedAt: now,
    });
    const classId = await ctx.db.insert("classes", {
      schoolId,
      name: "JSS 1A",
      gradeName: "JSS 1",
      level: "secondary",
      createdAt: 1,
      updatedAt: 1,
    });
    const subjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "Mathematics",
      code: "MTH",
      createdAt: 1,
      updatedAt: 1,
    });
    const otherSubjectId = await ctx.db.insert("subjects", {
      schoolId,
      name: "History",
      code: "HIS",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("classSubjects", {
      schoolId,
      classId,
      subjectId: otherSubjectId,
      createdAt: 1,
      updatedAt: 1,
    });
    const sessionId = await ctx.db.insert("academicSessions", {
      schoolId,
      name: "2026/2027",
      startDate: 1,
      endDate: 100,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const termId = await ctx.db.insert("academicTerms", {
      schoolId,
      sessionId,
      name: "First Term",
      startDate: 1,
      endDate: 50,
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });

    const capabilitySets: Record<TeacherKey, readonly PermissionCapability[]> = {
      none: [],
      planning: ["academic.planning.use"],
      planningUpload: ["academic.planning.use", "assets.upload"],
      curriculum: ["academic.curriculum.manage"],
      curriculumUpload: ["academic.curriculum.manage", "assets.upload"],
      unassigned: ["academic.planning.use", "assets.upload"],
    };
    const userIds = {} as Record<TeacherKey, Id<"users">>;
    for (const [key, capabilities] of Object.entries(capabilitySets) as [TeacherKey, readonly PermissionCapability[]][]) {
      const token = `test|planning-${key}`;
      const operator = await seedReviewedTenantOperatorWithCapabilities(ctx, [schoolId], token, capabilities, { role: "teacher" });
      userIds[key] = operator.memberships[0].userId;
      if (key !== "unassigned") {
        await ctx.db.insert("teacherAssignments", {
          schoolId,
          teacherId: userIds[key],
          classId,
          subjectId,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    }
    const adminOperator = await seedReviewedTenantOperatorWithCapabilities(
      ctx,
      [schoolId],
      "test|planning-admin",
      ["academic.curriculum.manage", "assets.upload"],
      { role: "admin" },
    );
    return {
      schoolId,
      classId,
      subjectId,
      otherSubjectId,
      termId,
      cycleId,
      userIds,
      adminUserId: adminOperator.memberships[0].userId,
    };
  });

  const teacher = (key: TeacherKey) => t.withIdentity({
    tokenIdentifier: `test|planning-${key}`,
    subject: `planning-${key}`,
  });
  const admin = t.withIdentity({
    tokenIdentifier: "test|planning-admin",
    subject: "planning-admin",
  });
  return { t, teacher, admin, ...ids };
}

const uploadArgs = (subjectId: Id<"subjects">) => ({
  title: "Assigned source",
  description: null,
  subjectId,
  level: "JSS 1",
  topicLabel: "Algebra",
  sourceType: "file_upload" as const,
  uploadIntent: "private_draft" as const,
});

const UPLOAD_BYTES = new TextEncoder().encode("Assigned planning source");
const EXPIRING_UPLOAD_BYTES = new TextEncoder().encode("Expiring planning source");

const secureUploadArgs = (subjectId: Id<"subjects">, uploadToken: string) => ({
  ...uploadArgs(subjectId),
  uploadToken,
  fileName: "assigned-source.txt",
  contentType: "text/plain",
  size: UPLOAD_BYTES.byteLength,
  sha256: "afd92c1b0571e32cabc736a0fe6fcedd746d3f9b32fbca657402c3e34aecdbe4",
});

describe("managed teacher planning capability contract", () => {
  it("allows only assignment-scoped planning data and grants no curriculum administration", async () => {
    const f = await fixture();
    await expect(f.teacher("none").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {})).rejects.toThrow("capability");
    await expect(f.teacher("none").mutation(academic.drafts.beginFormDraft, {
      schoolId: f.schoolId,
      formKey: "curriculum_plan",
      schemaVersion: 1,
    })).rejects.toThrow("capability");

    const planningViewer = await f.teacher("planning").query(api.functions.auth.getViewerContext, {
      capabilities: ["academic.planning.use", "academic.curriculum.manage"],
    });
    expect(planningViewer).toMatchObject({ role: "teacher", schoolId: f.schoolId });
    await expect(f.teacher("planning").mutation(academic.drafts.beginFormDraft, {
      schoolId: f.schoolId,
      formKey: "curriculum_plan",
      schemaVersion: 1,
    })).resolves.toMatchObject({ revision: 0 });
    expect(await f.teacher("planning").query(academic.lessonKnowledgeAssessmentProfiles.listAssessmentGenerationProfiles, {})).toEqual([]);

    const subjects = await f.teacher("planning").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {});
    expect(subjects).toEqual([{ id: f.subjectId, name: "Mathematics", code: "MTH" }]);
    await expect(f.teacher("planning").query(academic.curriculumReadiness.getAdminCurriculumReadiness, {
      subjectId: f.subjectId,
      termId: f.termId,
      level: "JSS 1",
    })).rejects.toThrow("capability");

    expect(await f.teacher("curriculum").query(academic.lessonKnowledgeTeacher.listTeacherLibrarySubjects, {})).toHaveLength(1);
    await expect(f.teacher("curriculum").query(academic.curriculumReadiness.getAdminCurriculumReadiness, {
      subjectId: f.subjectId,
      termId: f.termId,
      level: "JSS 1",
    })).rejects.toThrow("Admin access required");
  });

  it("reports assignment and contract-bound storage readiness", async () => {
    const f = await fixture();
    const now = Date.now();

    await expect(f.teacher("planning").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now },
    )).resolves.toMatchObject({
      fingerprintVersion: 1,
      hasPlanningPermission: true,
      hasUploadPermission: false,
      hasAssignedContext: true,
      storage: {
        status: "ready",
        allocatedBytes: 100_000,
        availableBytes: 100_000,
        maxPagesPerOperation: 80,
      },
    });
    await expect(f.teacher("unassigned").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now },
    )).resolves.toMatchObject({
      hasPlanningPermission: true,
      hasUploadPermission: true,
      hasAssignedContext: false,
    });

    await f.t.run(async (ctx) => {
      const meter = await ctx.db
        .query("usageMeterAllocations")
        .withIndex("by_school_and_meter", (q) =>
          q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes"),
        )
        .unique();
      if (!meter) throw new Error("Storage meter missing");
      await ctx.db.patch(meter._id, { consumedUnits: meter.allocatedUnits });
    });
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now },
    )).resolves.toMatchObject({ storage: { status: "exhausted", availableBytes: 0 } });

    await f.t.run(async (ctx) => {
      const meter = await ctx.db
        .query("usageMeterAllocations")
        .withIndex("by_school_and_meter", (q) =>
          q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes"),
        )
        .unique();
      if (!meter) throw new Error("Storage meter missing");
      await ctx.db.patch(meter._id, { cycleId: undefined });
    });
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "missing-entitlement-upload-token-0001"),
    )).rejects.toThrow("Storage entitlement is not active");
  });

  it("enforces the active entitlement PDF page cap before reserving quota", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const cycle = await ctx.db.get(f.cycleId);
      if (!cycle) throw new Error("Usage cycle missing");
      await ctx.db.patch(f.cycleId, {
        entitlement: { ...cycle.entitlement, maxPagesPerOperation: 20 },
      });
    });

    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now: Date.now() },
    )).resolves.toMatchObject({ storage: { maxPagesPerOperation: 20 } });
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      {
        ...secureUploadArgs(f.subjectId, "pdf-page-cap-upload-token-00000001"),
        fileName: "bounded.pdf",
        contentType: "application/pdf",
        selectedPageRanges: "1-21",
      },
    )).rejects.toThrow("at most 20 PDF pages");

    const meter = await f.t.run((ctx) =>
      ctx.db
        .query("usageMeterAllocations")
        .withIndex("by_school_and_meter", (q) =>
          q.eq("schoolId", f.schoolId).eq("meterType", "storage_bytes"),
        )
        .unique(),
    );
    expect(meter?.reservedUnits).toBe(0);
  });

  it("keeps source upload capability independent and securely stores assigned material", async () => {
    const f = await fixture();
    await expect(f.teacher("planning").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "planning-denied-upload-token-00001"),
    )).rejects.toThrow("capability");
    await expect(f.teacher("curriculum").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "curriculum-denied-upload-token-001"),
    )).rejects.toThrow("capability");

    const uploadToken = "planning-allowed-upload-token-000001";
    const uploadAttemptId = "planning-allowed-upload-attempt-0001";
    const upload = await f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, uploadToken),
    );
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "concurrent-duplicate-upload-token-00001"),
    )).rejects.toThrow("already exists");
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.beginKnowledgeMaterialHttpUpload,
      { uploadIntentId: upload.uploadIntentId, uploadToken, uploadAttemptId },
    );
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([UPLOAD_BYTES], { type: "text/plain" })),
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordKnowledgeMaterialUploadStorage,
      { uploadIntentId: upload.uploadIntentId, uploadToken, uploadAttemptId, storageId },
    );
    const result = await f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.finalizeSecureKnowledgeMaterialUpload,
      { uploadIntentId: upload.uploadIntentId },
    );
    expect(result).toMatchObject({
      visibility: "private_owner",
      reviewStatus: "draft",
      processingStatus: "queued",
    });
    const material = await f.t.run((ctx) => ctx.db.get(result.materialId));
    expect(material).toMatchObject({
      schoolId: f.schoolId,
      ownerUserId: f.userIds.planningUpload,
      ownerRole: "teacher",
      sourceType: "file_upload",
      storageId: expect.any(String),
    });
    const materialStorageId = material?.storageId;
    if (!materialStorageId) throw new Error("Material storage was not assigned");
    expect(await f.t.run(async (ctx) => Boolean(await ctx.storage.get(materialStorageId)))).toBe(true);
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.checkKnowledgeMaterialFileDuplicate,
      { schoolId: f.schoolId, sha256: secureUploadArgs(f.subjectId, "ignored").sha256 },
    )).resolves.toEqual({ duplicate: true });
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "duplicate-upload-token-000000000001"),
    )).rejects.toThrow("already exists");

    await expect(f.teacher("unassigned").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.subjectId, "unassigned-upload-token-0000000001"),
    )).rejects.toThrow("assigned");
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      secureUploadArgs(f.otherSubjectId, "wrong-subject-upload-token-000001"),
    )).rejects.toThrow("assigned");
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestKnowledgeMaterialUploadUrl,
      uploadArgs(f.subjectId),
    )).rejects.toThrow("Uploads unavailable");

    const expiringToken = "expiring-upload-intent-token-000001";
    const expiringAttemptId = "expiring-upload-attempt-token-00001";
    const expiringArgs = {
      ...secureUploadArgs(f.subjectId, expiringToken),
      fileName: "expiring-source.txt",
      size: EXPIRING_UPLOAD_BYTES.byteLength,
      sha256: "bdf33c932728c2c40e64da182fd753e54513c7d038ec6233297d3c6f52cefde7",
    };
    const expiringUpload = await f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      expiringArgs,
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.beginKnowledgeMaterialHttpUpload,
      {
        uploadIntentId: expiringUpload.uploadIntentId,
        uploadToken: expiringToken,
        uploadAttemptId: expiringAttemptId,
      },
    );
    const expiringStorageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([EXPIRING_UPLOAD_BYTES], { type: "text/plain" })),
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordKnowledgeMaterialUploadStorage,
      {
        uploadIntentId: expiringUpload.uploadIntentId,
        uploadToken: expiringToken,
        uploadAttemptId: expiringAttemptId,
        storageId: expiringStorageId,
      },
    );
    await f.t.run((ctx) =>
      ctx.db.patch(expiringUpload.uploadIntentId, { expiresAt: 0 }),
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.cleanupKnowledgeMaterialUploadIntent,
      { uploadIntentId: expiringUpload.uploadIntentId },
    );
    expect(await f.t.run((ctx) => ctx.storage.get(expiringStorageId))).toBeNull();
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.checkKnowledgeMaterialFileDuplicate,
      { schoolId: f.schoolId, sha256: expiringArgs.sha256 },
    )).resolves.toEqual({ duplicate: false });
    const retryToken = "retry-after-cleanup-upload-token-000001";
    const retryUpload = await f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      { ...expiringArgs, uploadToken: retryToken },
    );
    await f.t.run((ctx) => ctx.db.patch(retryUpload.uploadIntentId, { expiresAt: 0 }));
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.cleanupKnowledgeMaterialUploadIntent,
      { uploadIntentId: retryUpload.uploadIntentId },
    );
    const quotaReservations = await f.t.run((ctx) =>
      ctx.db
        .query("usageQuotaReservations")
        .withIndex("by_school", (q) => q.eq("schoolId", f.schoolId))
        .take(10),
    );
    expect(
      quotaReservations.find(
        (reservation) => reservation.idempotencyKey === `knowledge-upload:${uploadToken}`,
      )?.status,
    ).toBe("committed");
    expect(
      quotaReservations.find(
        (reservation) => reservation.idempotencyKey === `knowledge-upload:${expiringToken}`,
      )?.status,
    ).toBe("released");

    const storageEntries = await f.t.run((ctx) =>
      ctx.db.system.query("_storage").collect(),
    );
    expect(storageEntries).toHaveLength(1);
  });

  it("re-keys the fingerprint when selected-page extraction replaces the source PDF", async () => {
    const f = await fixture();
    const replacement = await f.t.run(async (ctx) => {
      const previousStorageId = await ctx.storage.store(
        new Blob([new TextEncoder().encode("original-pdf")], { type: "application/pdf" }),
      );
      const nextStorageId = await ctx.storage.store(
        new Blob([new TextEncoder().encode("selected-pages-pdf")], { type: "application/pdf" }),
      );
      const previousMetadata = await ctx.db.system.get("_storage", previousStorageId);
      const nextMetadata = await ctx.db.system.get("_storage", nextStorageId);
      if (!previousMetadata || !nextMetadata) throw new Error("Storage metadata missing");
      const now = Date.now();
      const materialId = await ctx.db.insert("knowledgeMaterials", {
        schoolId: f.schoolId,
        ownerUserId: f.userIds.planningUpload,
        ownerRole: "teacher",
        sourceType: "file_upload",
        visibility: "private_owner",
        reviewStatus: "draft",
        title: "Selected PDF",
        subjectId: f.subjectId,
        level: "JSS 1",
        topicLabel: "Algebra",
        storageId: previousStorageId,
        searchStatus: "not_indexed",
        searchText: "selected pdf algebra",
        processingStatus: "extracting",
        ingestionErrorMessage: null,
        ingestionAttemptCount: 1,
        labelSuggestions: [],
        chunkCount: 0,
        indexedAt: null,
        selectedPageRanges: "1",
        selectedPageNumbers: [1],
        createdAt: now,
        updatedAt: now,
        createdBy: f.userIds.planningUpload,
        updatedBy: f.userIds.planningUpload,
      });
      await ctx.db.insert("knowledgeMaterialFileFingerprints", {
        schoolId: f.schoolId,
        sha256: storageSha256ToHex(previousMetadata.sha256),
        materialId,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      });
      return {
        materialId,
        previousStorageId,
        nextStorageId,
        nextSha256: storageSha256ToHex(nextMetadata.sha256),
      };
    });

    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.replaceKnowledgeMaterialStorageInternal,
      {
        materialId: replacement.materialId,
        schoolId: f.schoolId,
        previousStorageId: replacement.previousStorageId,
        nextStorageId: replacement.nextStorageId,
        actorUserId: f.userIds.planningUpload,
        sourcePdfPageCount: 1,
      },
    );

    const state = await f.t.run(async (ctx) => ({
      material: await ctx.db.get(replacement.materialId),
      fingerprints: await ctx.db
        .query("knowledgeMaterialFileFingerprints")
        .withIndex("by_material", (q) => q.eq("materialId", replacement.materialId))
        .collect(),
      previousExists: Boolean(await ctx.storage.get(replacement.previousStorageId)),
      nextExists: Boolean(await ctx.storage.get(replacement.nextStorageId)),
    }));
    expect(state.material).toMatchObject({
      storageId: replacement.nextStorageId,
      sourceFileMode: "selected_pages",
    });
    expect(state.fingerprints).toEqual([
      expect.objectContaining({ sha256: replacement.nextSha256, status: "completed" }),
    ]);
    expect(state.previousExists).toBe(false);
    expect(state.nextExists).toBe(true);
  });

  it("uses a bounded resumable marker for legacy fingerprint backfill", async () => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      for (let index = 0; index < 200; index += 1) {
        await ctx.db.insert("knowledgeMaterials", {
          schoolId: f.schoolId,
          ownerUserId: f.adminUserId,
          ownerRole: "admin",
          sourceType: "youtube_link",
          visibility: "staff_shared",
          reviewStatus: "approved",
          title: `Legacy material ${index + 1}`,
          level: "JSS 1",
          topicLabel: "Legacy",
          externalUrl: `https://www.youtube.com/watch?v=legacy${index + 1}`,
          searchStatus: "not_indexed",
          searchText: "legacy",
          processingStatus: "ready",
          ingestionErrorMessage: null,
          ingestionAttemptCount: 0,
          labelSuggestions: [],
          chunkCount: 0,
          indexedAt: null,
          createdAt: index + 1,
          updatedAt: index + 1,
          createdBy: f.adminUserId,
          updatedBy: f.adminUserId,
        });
      }
      await ctx.db.insert("knowledgeMaterials", {
        schoolId: f.schoolId,
        ownerUserId: f.adminUserId,
        ownerRole: "admin",
        sourceType: "youtube_link",
        visibility: "staff_shared",
        reviewStatus: "approved",
        title: "Protected material",
        level: "JSS 1",
        topicLabel: "Current",
        externalUrl: "https://www.youtube.com/watch?v=protected",
        searchStatus: "not_indexed",
        searchText: "protected",
        processingStatus: "ready",
        ingestionErrorMessage: null,
        ingestionAttemptCount: 0,
        labelSuggestions: [],
        chunkCount: 0,
        indexedAt: null,
        fingerprintVersion: 1,
        createdAt: 201,
        updatedAt: 201,
        createdBy: f.adminUserId,
        updatedBy: f.adminUserId,
      });
    });
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now: Date.now() },
    )).resolves.toMatchObject({ fingerprintVersion: 1 });
    await f.t.run((ctx) => ctx.db.insert("knowledgeMaterials", {
      schoolId: f.schoolId,
      ownerUserId: f.adminUserId,
      ownerRole: "admin",
      sourceType: "youtube_link",
      visibility: "staff_shared",
      reviewStatus: "approved",
      title: "Legacy material 201",
      level: "JSS 1",
      topicLabel: "Legacy",
      externalUrl: "https://www.youtube.com/watch?v=legacy201",
      searchStatus: "not_indexed",
      searchText: "legacy",
      processingStatus: "ready",
      ingestionErrorMessage: null,
      ingestionAttemptCount: 0,
      labelSuggestions: [],
      chunkCount: 0,
      indexedAt: null,
      createdAt: 202,
      updatedAt: 202,
      createdBy: f.adminUserId,
      updatedBy: f.adminUserId,
    }));
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now: Date.now() },
    )).resolves.toMatchObject({ fingerprintVersion: 0 });
    const { sha256: _omittedSha256, ...legacyClientArgs } = secureUploadArgs(
      f.subjectId,
      "legacy-client-before-backfill-token-01",
    );
    await expect(f.teacher("planningUpload").mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      legacyClientArgs,
    )).rejects.toThrow("still being set up");
    expect(await f.t.run((ctx) =>
      ctx.db.query("usageQuotaReservations").withIndex("by_school", (q) => q.eq("schoolId", f.schoolId)).collect()
    )).toHaveLength(0);

    let cursor: string | undefined;
    let isDone = false;
    for (let batch = 0; batch < 3 && !isDone; batch += 1) {
      const result = await f.t.mutation(
        internal.functions.academic.knowledgeUploadReadiness.backfillKnowledgeMaterialFileFingerprints,
        {
          schoolId: f.schoolId,
          ...(cursor ? { cursor } : {}),
          batchSize: 100,
          actorEmail: "operator@example.com",
          confirmation: "BACKFILL KNOWLEDGE FILE FINGERPRINTS",
        },
      );
      cursor = result.continueCursor || undefined;
      isDone = result.isDone;
    }
    expect(isDone).toBe(true);
    await expect(f.teacher("planningUpload").query(
      academic.knowledgeUploadReadiness.getKnowledgeMaterialUploadReadiness,
      { schoolId: f.schoolId, now: Date.now() },
    )).resolves.toMatchObject({ fingerprintVersion: 1 });
  });

  it("allows an admin to upload a staff-shared curriculum reference", async () => {
    const f = await fixture();
    const bytes = new TextEncoder().encode("School curriculum source");
    const uploadToken = "admin-curriculum-upload-token-000001";
    const uploadAttemptId = "admin-curriculum-upload-attempt-0001";
    const upload = await f.admin.mutation(
      academic.lessonKnowledgeIngestion.requestSecureKnowledgeMaterialUpload,
      {
        uploadToken,
        fileName: "curriculum.txt",
        contentType: "text/plain",
        size: bytes.byteLength,
        title: "School curriculum",
        description: null,
        subjectId: null,
        level: "JSS 1",
        topicLabel: "National curriculum",
        sourceType: "imported_curriculum",
        uploadIntent: "staff_shared",
      },
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.beginKnowledgeMaterialHttpUpload,
      { uploadIntentId: upload.uploadIntentId, uploadToken, uploadAttemptId },
    );
    const storageId = await f.t.run((ctx) =>
      ctx.storage.store(new Blob([bytes], { type: "text/plain" })),
    );
    await f.t.mutation(
      internal.functions.academic.lessonKnowledgeIngestion.recordKnowledgeMaterialUploadStorage,
      { uploadIntentId: upload.uploadIntentId, uploadToken, uploadAttemptId, storageId },
    );
    const result = await f.admin.mutation(
      academic.lessonKnowledgeIngestion.finalizeSecureKnowledgeMaterialUpload,
      { uploadIntentId: upload.uploadIntentId },
    );

    expect(result).toMatchObject({
      visibility: "staff_shared",
      reviewStatus: "approved",
      processingStatus: "queued",
    });
    expect(await f.t.run((ctx) => ctx.db.get(result.materialId))).toMatchObject({
      schoolId: f.schoolId,
      ownerUserId: f.adminUserId,
      ownerRole: "admin",
      sourceType: "imported_curriculum",
    });
    await expect(f.admin.query(
      academic.knowledgeUploadReadiness.getTrackedKnowledgeMaterialProcessingStatuses,
      { schoolId: f.schoolId, materialIds: [result.materialId] },
    )).resolves.toEqual([
      expect.objectContaining({
        materialId: result.materialId,
        title: "School curriculum",
      }),
    ]);
  });
});
