import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api, internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { PDFDocument } from "pdf-lib";
import { verifyPdfCompressionCandidate } from "../assets";
import {
  CORE_BASIC_PER_STUDENT_KOBO,
  CORE_BASIC_SETUP_FEE_KOBO,
} from "../commercial";

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
  ])
);

const commercialApi = api.functions.academic.commercial;
const meteringApi = api.functions.academic.metering;
const assetsApi = api.functions.academic.assets;
const commercialInternal = internal.functions.academic.commercial;
const meteringInternal = internal.functions.academic.metering;
const assetsInternal = internal.functions.academic.assets;
const assetsMigrationInternal = internal.functions.academic.assetsMigration;

function platformSession(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({
    tokenIdentifier: "https://auth.school.test|platform-admin",
    subject: "platform-admin",
  });
}

function assertExists<T>(value: T): asserts value is NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Expected a result");
}

type AuthenticatedTest = ReturnType<ReturnType<typeof convexTest>["withIdentity"]>;
type TestClient = ReturnType<typeof convexTest> | AuthenticatedTest;

async function storeTypedBlob(t: ReturnType<typeof convexTest>, blob: Blob) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(blob);
    // convex-test does not copy Blob.type into _storage metadata.
    await ctx.db.patch(storageId, { contentType: blob.type });
    return storageId;
  });
}

async function finalizeAsset(
  t: ReturnType<typeof convexTest>,
  schoolId: Id<"schools">,
  fileName: string,
  category: string,
  blob: Blob
) {
  await t.mutation(meteringInternal.allocateQuota, {
    schoolId,
    meterType: "storage_bytes",
    allocatedUnits: 100 * 1024 * 1024,
  });
  const intent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId });
  const storageId = await storeTypedBlob(t, blob);
  const finalized = await platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
    schoolId,
    uploadIntentId: intent.intentId,
    storageId,
    fileName,
    category,
  });
  return await t.run((ctx) => ctx.db.get(finalized.assetId));
}

async function setupTestHarness(t: ReturnType<typeof convexTest>) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    // 1. Create School
    const schoolId = await ctx.db.insert("schools", {
      name: "Olive Blessed Crest Academy",
      slug: "olive-crest",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("platformAdmins", {
      authId: "platform-admin",
      authTokenIdentifier: "https://auth.school.test|platform-admin",
      email: "platform-admin@school.test",
      name: "Test Platform Administrator",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 2. Create Admin User
    const adminUserId = await ctx.db.insert("users", {
      schoolId,
      authId: "auth-admin-comm",
      authTokenIdentifier: "https://auth.school.test|admin-comm",
      name: "Bursar Adeleke",
      email: "bursar@olivecrest.edu.ng",
      role: "admin",
      isSchoolAdmin: true,
      createdAt: now,
      updatedAt: now,
    });

    // 3. Create Person
    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier: "https://auth.school.test|person-comm",
      email: "bursar.personal@gmail.com",
      name: "Babatunde Adeleke",
      status: "active",
      primarySchoolId: schoolId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      schoolId,
      adminUserId,
      personId,
    };
  });
}

describe("B-08 / M7 (PR-H): Commercial Catalog, Usage Metering, and Asset Security (F7/H8/H9)", () => {
  describe("1. Commercial Catalog Seeding & Mode A vs Mode B Settlement Mathematics", () => {
    it("seeds Core/Basic at ₦1,000/student/term + ₦30,000 setup fee and verifies idempotent seeding", async () => {
      const t = convexTest(schema, modules);
      await setupTestHarness(t);

      // Seed catalog
      const plan1 = await t.mutation(commercialInternal.seedCommercialCatalog, {});
      assertExists(plan1);
      expect(plan1.code).toBe("core_basic");
      expect(plan1.perStudentFeeKobo).toBe(CORE_BASIC_PER_STUDENT_KOBO); // 100,000 kobo (₦1,000)
      expect(plan1.termSetupFeeKobo).toBe(CORE_BASIC_SETUP_FEE_KOBO); // 3,000,000 kobo (₦30,000)
      expect(plan1.currency).toBe("NGN");
      expect(plan1.billingCadence).toBe("termly");

      // Idempotent check
      const plan2 = await t.mutation(commercialInternal.seedCommercialCatalog, {});
      assertExists(plan2);
      expect(plan2._id).toBe(plan1._id);
    });

    it("calculates school subscription term fees with setup fee inclusion/exclusion", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);

      await t.mutation(commercialInternal.seedCommercialCatalog, {});

      // 1. Initial subscription with 250 students (Setup fee unpaid)
      const sub1 = await t.mutation(commercialInternal.createOrUpdateSchoolSubscription, {
        schoolId,
        activeStudentCount: 250,
        setupFeePaid: false,
        paymentRoutingMode: "mode_a_direct",
      });

      // 250 * ₦1,000 (25,000,000 kobo) + ₦30,000 setup (3,000,000 kobo) = 28,000,000 kobo
      assertExists(sub1);
      expect(sub1.currentTermFeeKobo).toBe(28_000_000);
      expect(sub1.setupFeePaid).toBe(false);

      // 2. Subsequent term with setup fee already paid
      const sub2 = await t.mutation(commercialInternal.createOrUpdateSchoolSubscription, {
        schoolId,
        activeStudentCount: 250,
        setupFeePaid: true,
        paymentRoutingMode: "mode_a_direct",
      });

      // 250 * ₦1,000 = 25,000,000 kobo (setup fee omitted)
      assertExists(sub2);
      expect(sub2.currentTermFeeKobo).toBe(25_000_000);
      expect(sub2.setupFeePaid).toBe(true);
    });

    it("enforces Mode A 100% direct settlement vs Mode B split itemization with balanced ledgers", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId, personId } = await setupTestHarness(t);

      // 1. Mode A: Direct School Merchant Mode (Tuition: ₦150,000 = 15,000,000 kobo)
      const modeATransaction = await t.mutation(
        commercialInternal.recordSettlementTransaction,
        {
          schoolId,
          transactionRef: "MELO-INV-MODE-A-001",
          routingMode: "mode_a_direct",
          grossAmountKobo: 15_000_000,
          paystackFeeKobo: 200_000, // ₦2,000 capped
          destinationAccount: "First Bank •••• 4892",
          actorUserId: adminUserId,
          actorPersonId: personId,
        }
      );

      // In Mode A: Melo platform fee is 0; school receives 100% gross less Paystack fee
      assertExists(modeATransaction.record);
      expect(modeATransaction.breakdown).toMatchObject({
        grossAmountKobo: 15_000_000,
        paystackFeeKobo: 200_000,
        platformFeeKobo: 0,
        netPayoutKobo: 14_800_000, // ₦148,000.00
      });
      expect(modeATransaction.record.clearingCycle).toBe("unavailable");
      expect(
        modeATransaction.breakdown.paystackFeeKobo +
          modeATransaction.breakdown.platformFeeKobo +
          modeATransaction.breakdown.netPayoutKobo
      ).toBe(15_000_000);

      // 2. Mode B: Melo-Routed Paystack Subaccount Split Mode (Tuition: ₦150,000)
      const modeBTransaction = await t.mutation(
        commercialInternal.recordSettlementTransaction,
        {
          schoolId,
          transactionRef: "MELO-INV-MODE-B-001",
          routingMode: "mode_b_split",
          grossAmountKobo: 15_000_000,
          paystackFeeKobo: 200_000, // ₦2,000
          platformFeeKobo: 250_000, // ₦2,500 Melo platform surcharge
          destinationAccount: "First Bank •••• 4892",
          actorUserId: adminUserId,
          actorPersonId: personId,
        }
      );

      // In Mode B: Platform surcharge itemized; net payout is gross - Paystack - platform
      assertExists(modeBTransaction.record);
      expect(modeBTransaction.breakdown).toMatchObject({
        grossAmountKobo: 15_000_000,
        paystackFeeKobo: 200_000,
        platformFeeKobo: 250_000,
        netPayoutKobo: 14_550_000, // ₦145,500.00
      });
      expect(modeBTransaction.record.clearingCycle).toBe("unavailable");
      expect(
        modeBTransaction.breakdown.paystackFeeKobo +
          modeBTransaction.breakdown.platformFeeKobo +
          modeBTransaction.breakdown.netPayoutKobo
      ).toBe(15_000_000);
    });
  });

  describe("2. Provider-Derived Settlement Disclosures", () => {
    it("records unavailable timing unless a trusted provider supplies settlement evidence", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);

      const unavailable = await t.mutation(commercialInternal.recordSettlementTransaction, {
        schoolId,
        transactionRef: "MELO-SETTLE-UNAVAILABLE",
        routingMode: "mode_a_direct",
        grossAmountKobo: 10_000_000,
        paystackFeeKobo: 150_000,
      });
      assertExists(unavailable.record);
      expect(unavailable.record.clearingCycle).toBe("unavailable");
      expect(unavailable.record.estimatedSettlementDate).toBeUndefined();

      const providerReported = await t.mutation(commercialInternal.recordSettlementTransaction, {
        schoolId,
        transactionRef: "MELO-SETTLE-PROVIDER",
        routingMode: "mode_a_direct",
        grossAmountKobo: 10_000_000,
        paystackFeeKobo: 150_000,
        settlementEvidence: {
          providerSettlementReference: "paystack-settlement-1",
          providerClearingCycle: "next_business_day",
          estimatedSettlementDate: Date.now() + 86_400_000,
          settlementNotice: "Provider-reported settlement schedule",
        },
      });
      assertExists(providerReported.record);
      expect(providerReported.record.clearingCycle).toBe("provider_reported");
      expect(providerReported.record.providerSettlementReference).toBe("paystack-settlement-1");

      const ledger = await platformSession(t).query(commercialApi.getSettlementLedger, {
        schoolId,
      });
      expect(ledger).toHaveLength(2);
    });
  });

  describe("3. Public finance and metering entry-point authorization", () => {
    it("denies unauthenticated and cross-tenant subscription, settlement, and metering reads", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        const schoolB = await ctx.db.insert("schools", { name: "Finance Other", slug: "finance-other", status: "active", createdAt: now, updatedAt: now });
        const personA = await ctx.db.insert("persons", { authTokenIdentifier: "https://auth.school.test|finance-a", email: "finance-a@test", name: "Finance A", status: "active", primarySchoolId: schoolId, createdAt: now, updatedAt: now });
        await ctx.db.insert("branchMemberships", { personId: personA, schoolId, status: "active", isDefaultBranch: true, joinedAt: now, updatedAt: now });
        return schoolB;
      });
      const crossTenant = t.withIdentity({ tokenIdentifier: "https://auth.school.test|finance-a", subject: "finance-a" });
      const expectDenied = async (operation: () => Promise<unknown>) => {
        await expect(operation()).rejects.toThrow("Not authorized");
      };
      const operations = (client: TestClient) => [
        () => client.query(commercialApi.getSettlementLedger, { schoolId: schoolB }),
        () => client.query(commercialApi.getSettlementByRef, { schoolId: schoolB, transactionRef: "other" }),
        () => client.query(commercialApi.getSchoolSubscription, { schoolId: schoolB }),
        () => client.query(meteringApi.getUsageStatus, { schoolId: schoolB }),
        () => client.query(meteringApi.listUsageEvents, { schoolId: schoolB }),
      ];
      for (const operation of operations(t)) await expectDenied(operation);
      for (const operation of operations(crossTenant)) await expectDenied(operation);
    });
  });

  describe("4. Deterministic Usage Metering & Threshold Protections", () => {
    it("handles quota reservation, warns at 75% and 90%, and strictly blocks with hard_stop at 100% shortfall", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId, personId } = await setupTestHarness(t);

      // 1. Allocate initial quota: 10,000 AI tokens
      await t.mutation(meteringInternal.allocateQuota, {
        schoolId,
        meterType: "ai_tokens",
        allocatedUnits: 10_000,
      });

      // 2. Initial state: 0% utilized -> Normal tier
      let status = await platformSession(t).query(meteringApi.getUsageStatus, {
        schoolId,
        meterType: "ai_tokens",
      });
      expect(status[0]).toMatchObject({
        allocatedUnits: 10_000,
        consumedUnits: 0,
        reservedUnits: 0,
        availableUnits: 10_000,
        thresholdAlert: "normal",
        isHardStopped: false,
      });

      // 3. Pre-flight reservation: Request 5,000 units (50% utilization)
      const res1 = await t.mutation(meteringInternal.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 5_000,
        idempotencyKey: "quota-lesson-1",
        operationName: "batch_lesson_generation",
      });
      expect(res1.allowed).toBe(true);
      expect(res1.thresholdAlert).toBe("normal");
      expect(res1.currentUtilizationPercent).toBe(50);
      expect(res1.availableUnits).toBe(5_000);

      // 4. Commit 5,000 units
      const commit1 = await t.mutation(meteringInternal.commitUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        idempotencyKey: res1.reservationId,
        operationName: "batch_lesson_generation",
        description: "Generated 5 curriculum lesson drafts",
        actualUnits: 4_500,
        measurementMetadata: { source: "provider_usage", measuredAt: Date.now(), reference: "lesson-1" },
        actorUserId: adminUserId,
        actorPersonId: personId,
      });
      expect(commit1.totalConsumed).toBe(4_500);
      expect(commit1.remainingUnits).toBe(5_500);

      // Verify zero raw prompt text stored in billing usage events
      const events = await platformSession(t).query(meteringApi.listUsageEvents, {
        schoolId,
        meterType: "ai_tokens",
      });
      expect(events).toHaveLength(1);
      expect(events[0].unitsDelta).toBe(4_500);
      expect(events[0].measurementMetadata).toMatchObject({ source: "provider_usage", reference: "lesson-1" });
      expect(events[0].operationName).toBe("batch_lesson_generation");
      expect(Object.keys(events[0])).not.toContain("rawPrompt");
      expect(Object.keys(events[0])).not.toContain("documentPayload");

      // 5. Reserve 3,000 units: pushes projected utilization to (4500 + 3000) / 10000 = 75% (>=75%)
      const res2 = await t.mutation(meteringInternal.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 3_000,
        idempotencyKey: "quota-preview-1",
        operationName: "curriculum_extraction_preview",
      });
      expect(res2.allowed).toBe(true);
      expect(res2.thresholdAlert).toBe("notice_75");
      expect(res2.currentUtilizationPercent).toBe(75);

      // Release reservation (operation cancelled)
      const release2 = await t.mutation(meteringInternal.releaseUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        idempotencyKey: res2.reservationId,
      });
      expect(release2.reservedUnits).toBe(0);
      expect(release2.remainingUnits).toBe(5_500);

      // 6. Reserve 4,600 units: pushes projected utilization to (4500 + 4600) / 10000 = 91% (>=90%)
      const res3 = await t.mutation(meteringInternal.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 4_600,
        idempotencyKey: "quota-assessment-1",
        operationName: "large_assessment_bank_builder",
      });
      expect(res3.allowed).toBe(true);
      expect(res3.thresholdAlert).toBe("warning_90");
      expect(res3.currentUtilizationPercent).toBe(91);

      // Commit 4,600 units -> Consumed is now 9,100 units. Available is 900 units.
      await t.mutation(meteringInternal.commitUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        idempotencyKey: res3.reservationId,
        operationName: "large_assessment_bank_builder",
        description: "Built 50 questions",
        actualUnits: 4_600,
        measurementMetadata: { source: "provider_usage", measuredAt: Date.now(), reference: "assessment-1" },
      });

      // 7. Hard-Stop Check: Request 1,000 units when only 900 remain (100% shortfall)
      const res4 = await t.mutation(meteringInternal.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 1_000,
        idempotencyKey: "quota-overdraft-1",
        operationName: "overdraft_attempt",
      });
      expect(res4.allowed).toBe(false);
      expect(res4.thresholdAlert).toBe("hard_stop");
      expect(res4.shortfall).toBe(100); // 1,000 requested - 900 available = 100 shortfall

      // Verify quota was NOT reserved on denial
      status = await platformSession(t).query(meteringApi.getUsageStatus, {
        schoolId,
        meterType: "ai_tokens",
      });
      expect(status[0].reservedUnits).toBe(0);
      expect(status[0].availableUnits).toBe(900);
    });
  });

  describe("4. Durable quota reservation lifecycle", () => {
    it("serializes concurrent reservations and makes retry, terminal transitions, and provider failure safe", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      await t.mutation(meteringInternal.allocateQuota, { schoolId, meterType: "ocr_pages", allocatedUnits: 1_000 });
      const [first, second] = await Promise.all([
        t.mutation(meteringInternal.reserveUsageQuota, { schoolId, meterType: "ocr_pages", unitsRequested: 600, idempotencyKey: "concurrent-a", operationName: "ocr" }),
        t.mutation(meteringInternal.reserveUsageQuota, { schoolId, meterType: "ocr_pages", unitsRequested: 600, idempotencyKey: "concurrent-b", operationName: "ocr" }),
      ]);
      expect([first.allowed, second.allowed].filter(Boolean)).toHaveLength(1);
      const accepted = first.allowed ? first : second;
      const retry = await t.mutation(meteringInternal.reserveUsageQuota, { schoolId, meterType: "ocr_pages", unitsRequested: 600, idempotencyKey: accepted.reservationId, operationName: "ocr" });
      expect(retry).toEqual(accepted);
      await expect(t.mutation(meteringInternal.reserveUsageQuota, { schoolId, meterType: "ocr_pages", unitsRequested: 599, idempotencyKey: accepted.reservationId, operationName: "ocr" })).rejects.toThrow("already bound");

      // A provider failure releases exactly the original reservation and is retry-safe.
      const released = await t.mutation(meteringInternal.releaseUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: accepted.reservationId });
      expect(released.remainingUnits).toBe(1_000);
      await expect(t.mutation(meteringInternal.commitUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: accepted.reservationId, operationName: "ocr", description: "late provider success", actualUnits: 600, measurementMetadata: { source: "provider_usage", measuredAt: Date.now() } })).rejects.toThrow("Only reserved usage");
      expect(await t.mutation(meteringInternal.releaseUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: accepted.reservationId })).toEqual(released);

      const commitReservation = await t.mutation(meteringInternal.reserveUsageQuota, { schoolId, meterType: "ocr_pages", unitsRequested: 400, idempotencyKey: "commit-once", operationName: "ocr" });
      const committed = await t.mutation(meteringInternal.commitUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: commitReservation.reservationId, operationName: "ocr", description: "provider completed", actualUnits: 250, measurementMetadata: { source: "provider_usage", measuredAt: Date.now(), reference: "ocr-1" } });
      expect(committed).toMatchObject({ totalConsumed: 250, reservedUnits: 0, remainingUnits: 750 });
      expect(await t.mutation(meteringInternal.commitUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: commitReservation.reservationId, operationName: "ocr", description: "provider completed", actualUnits: 250, measurementMetadata: { source: "provider_usage", measuredAt: Date.now(), reference: "ocr-1" } })).toEqual(committed);
      await expect(t.mutation(meteringInternal.releaseUsageQuota, { schoolId, meterType: "ocr_pages", idempotencyKey: commitReservation.reservationId })).rejects.toThrow("Only reserved usage");
    });
  });

  describe("5. Asset Quarantine Gate & Security State Machine", () => {
    it("rejects downloading unscanned or infected assets and allows clean assets", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId } = await setupTestHarness(t);

      // Real storage ID generated via Convex storage
      // 1. Finalize asset from authoritative private storage metadata.
      const asset = await finalizeAsset(
        t,
        schoolId,
        "Term1_Exams_Syllabus.pdf",
        "curriculum_doc",
        new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: "application/pdf" })
      );

      assertExists(asset);
      expect(asset.scanStatus).toBe("quarantined");
      await t.action(assetsInternal.validateAssetMagicBytes, { assetId: asset._id });

      // 2. Unscanned asset download MUST be rejected
      await expect(
        platformSession(t).query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Access Denied");

      // 3. Mark asset as infected
      await t.mutation(assetsInternal.beginAssetScan, { assetId: asset._id });
      await t.mutation(assetsInternal.processAssetScanResult, {
        assetId: asset._id,
        scanResult: "infected",
        threatName: "Win32.VBA.MacroDropper",
        scannerEngine: "approved-test-scanner",
      });

      // Infected asset download MUST also be rejected
      await expect(
        platformSession(t).query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Access Denied");

      // 4. Mark clean asset and verify download succeeds
      const cleanAsset = await finalizeAsset(
        t,
        schoolId,
        "School_Calendar_2026.png",
        "branding",
        new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" })
      );

      assertExists(cleanAsset);
      await t.action(assetsInternal.validateAssetMagicBytes, { assetId: cleanAsset._id });
      await t.mutation(assetsInternal.beginAssetScan, { assetId: cleanAsset._id });
      await t.mutation(assetsInternal.processAssetScanResult, {
        assetId: cleanAsset._id,
        scanResult: "clean",
        scannerEngine: "approved-test-scanner",
      });

      const downloadable = await platformSession(t).query(assetsApi.getDownloadableAssetUrl, {
        schoolId,
        assetId: cleanAsset._id,
      });
      expect(downloadable.scanStatus).toBe("clean");
      expect(downloadable.fileName).toBe("School_Calendar_2026.png");
    });

    it("rejects uploads when authoritative storage metadata has no content type", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      await t.mutation(meteringInternal.allocateQuota, {
        schoolId,
        meterType: "storage_bytes",
        allocatedUnits: 10_000,
      });
      const intent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId });
      const storageId = await t.run((ctx) =>
        ctx.storage.store(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]))
      );
      const metadata = await t.run((ctx) => ctx.db.system.get("_storage", storageId));
      expect(metadata?.contentType).toBeFalsy();

      await expect(
        platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
          schoolId,
          uploadIntentId: intent.intentId,
          storageId,
          fileName: "untyped.png",
          category: "test",
        })
      ).rejects.toThrow("missing or unsupported authoritative content type");

      expect(await t.run((ctx) => ctx.db.get(intent.intentId))).toMatchObject({
        status: "pending",
      });
    });
  });

  describe("5. Navigable Trash Workspace & Retention Hold Locks", () => {
    it("sets 30-day purge schedule, restores assets, and blocks permanent purge when retention hold is active", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId } = await setupTestHarness(t);

      const asset = await finalizeAsset(
        t,
        schoolId,
        "Audited_School_Accounts_2025.xlsx",
        "finance_document",
        new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      assertExists(asset);
      await t.action(assetsInternal.validateAssetMagicBytes, { assetId: asset._id });
      await t.mutation(assetsInternal.beginAssetScan, { assetId: asset._id });
      await t.mutation(assetsInternal.processAssetScanResult, {
        assetId: asset._id,
        scanResult: "clean",
        scannerEngine: "approved-test-scanner",
      });

      // 1. Move to Trash
      const trashed = await platformSession(t).mutation(assetsApi.trashAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });
      assertExists(trashed);
      expect(trashed.isTrashed).toBe(true);
      expect(trashed.purgeScheduledAt).toBeDefined();
      let storageAllocation = await t.run((ctx) =>
        ctx.db
          .query("usageMeterAllocations")
          .withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes"))
          .unique()
      );
      expect(storageAllocation).toMatchObject({
        activeStorageBytes: 0,
        trashStorageBytes: asset.byteSize,
        tempStorageBytes: 0,
      });

      // Verify download is blocked while in trash
      await expect(
        platformSession(t).query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Trash workspace");

      // Verify listed in Trash workspace with 30-day countdown
      const trashList = await platformSession(t).query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(trashList).toHaveLength(1);
      expect(trashList[0].daysRemainingUntilPurge).toBe(30);
      expect(trashList[0].hasRetentionHold).toBe(false);
      await expect(platformSession(t).mutation(assetsApi.permanentPurgeAsset, {
        schoolId,
        assetId: asset._id,
        confirmation: "PURGE wrong-name.xlsx",
      })).rejects.toThrow("requires confirmation");

      // 2. Apply Retention Hold
      const hold = await platformSession(t).mutation(assetsApi.applyRetentionHold, {
        schoolId,
        assetId: asset._id,
        holdReason: "Statutory Tax & Financial Audit",
        notes: "Held by Bursar per FIRS audit request",
        userId: adminUserId,
      });
      assertExists(hold);

      // Verify trash list updates to reflect active retention hold
      const trashListWithHold = await platformSession(t).query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(trashListWithHold[0].hasRetentionHold).toBe(true);
      expect(trashListWithHold[0].activeHolds).toHaveLength(1);

      // 3. Attempt Permanent Purge: MUST BE STRICTLY BLOCKED BY RETENTION HOLD
      await expect(
        platformSession(t).mutation(assetsApi.permanentPurgeAsset, {
          schoolId,
          assetId: asset._id,
          confirmation: "PURGE Audited_School_Accounts_2025.xlsx",
        })
      ).rejects.toThrow("active retention hold");

      // 4. Restore asset from trash
      const restored = await platformSession(t).mutation(assetsApi.restoreAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });
      assertExists(restored);
      expect(restored.isTrashed).toBe(false);
      expect(restored.purgeScheduledAt).toBeUndefined();
      storageAllocation = await t.run((ctx) =>
        ctx.db
          .query("usageMeterAllocations")
          .withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes"))
          .unique()
      );
      expect(storageAllocation).toMatchObject({
        activeStorageBytes: asset.byteSize,
        trashStorageBytes: 0,
        tempStorageBytes: 0,
      });

      // Download is now accessible again
      const downloadable = await platformSession(t).query(assetsApi.getDownloadableAssetUrl, {
        schoolId,
        assetId: asset._id,
      });
      expect(downloadable.fileName).toBe("Audited_School_Accounts_2025.xlsx");

      // 5. Remove hold, trash again, and purge permanently
      await platformSession(t).mutation(assetsApi.removeRetentionHold, {
        schoolId,
        holdId: hold._id,
        userId: adminUserId,
      });

      await platformSession(t).mutation(assetsApi.trashAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });

      // Storage mock delete in test environment
      const purgeResult = await platformSession(t).mutation(assetsApi.permanentPurgeAsset, {
        schoolId,
        assetId: asset._id,
        confirmation: "PURGE Audited_School_Accounts_2025.xlsx",
      });
      expect(purgeResult.success).toBe(true);
      storageAllocation = await t.run((ctx) =>
        ctx.db
          .query("usageMeterAllocations")
          .withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes"))
          .unique()
      );
      expect(storageAllocation).toMatchObject({
        consumedUnits: 0,
        activeStorageBytes: 0,
        trashStorageBytes: 0,
        tempStorageBytes: 0,
      });

      // Confirm record was deleted from database
      const finalTrashList = await platformSession(t).query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(finalTrashList).toHaveLength(0);
    });
  });

  describe("5. Storage-object tenancy and scheduled cleanup", () => {
    it("binds storage to one intent and releases scheduled-trash quota only after cleanup", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schools", {
          name: "Storage Boundary Academy",
          slug: "storage-boundary",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
      });
      await t.mutation(meteringInternal.allocateQuota, { schoolId, meterType: "storage_bytes", allocatedUnits: 10_000 });
      await t.mutation(meteringInternal.allocateQuota, { schoolId: schoolB, meterType: "storage_bytes", allocatedUnits: 10_000 });
      const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });
      const storageId = await storeTypedBlob(t, blob);
      const firstIntent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId });
      const secondIntent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId });
      const foreignIntent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId: schoolB });
      const finalized = await platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
        schoolId,
        uploadIntentId: firstIntent.intentId,
        storageId,
        fileName: "bound.png",
        category: "test",
      });
      await expect(platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
        schoolId,
        uploadIntentId: secondIntent.intentId,
        storageId,
        fileName: "duplicate.png",
        category: "test",
      })).rejects.toThrow("already bound");
      await expect(platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
        schoolId: schoolB,
        uploadIntentId: foreignIntent.intentId,
        storageId,
        fileName: "foreign.png",
        category: "test",
      })).rejects.toThrow("already bound");

      const asset = await t.run((ctx) => ctx.db.get(finalized.assetId));
      assertExists(asset);
      await platformSession(t).mutation(assetsApi.trashAsset, { schoolId, assetId: asset._id });
      await t.run((ctx) => ctx.db.patch(asset._id, { purgeScheduledAt: Date.now() - 1 }));
      await t.mutation(assetsInternal.cleanupExpiredAssetStorage, { limit: 10 });
      expect(await t.run((ctx) => ctx.db.get(asset._id))).toBeNull();
      const allocation = await t.run((ctx) =>
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique()
      );
      expect(allocation).toMatchObject({
        consumedUnits: 0,
        activeStorageBytes: 0,
        trashStorageBytes: 0,
        tempStorageBytes: 0,
      });
      const foreignAllocation = await t.run((ctx) =>
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolB).eq("meterType", "storage_bytes")).unique()
      );
      const foreignIntentAfterRejection = await t.run((ctx) => ctx.db.get(foreignIntent.intentId));
      expect(foreignAllocation).toMatchObject({ consumedUnits: 0, activeStorageBytes: 0, trashStorageBytes: 0, tempStorageBytes: 0 });
      expect(foreignIntentAfterRejection).toMatchObject({ status: "pending" });
      expect(foreignIntentAfterRejection).not.toHaveProperty("storageId");
      expect(foreignIntentAfterRejection).not.toHaveProperty("assetId");
    });
  });

  describe("5. Legacy asset migration and storage claims", () => {
    it("gates legacy lifecycle transitions, backfills authoritative metadata and buckets exactly once", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      await t.mutation(meteringInternal.allocateQuota, { schoolId, meterType: "storage_bytes", allocatedUnits: 10_000 });
      const storageId = await t.run((ctx) => ctx.storage.store(new Blob([
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]),
      ], { type: "image/png" })));
      const legacyAssetId = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schoolAssets", {
          schoolId,
          storageId,
          fileName: "legacy.png",
          mimeType: "application/octet-stream",
          byteSize: 1,
          sha256: "stale",
          category: "legacy",
          scanStatus: "quarantined",
          isTrashed: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      await expect(platformSession(t).mutation(assetsApi.trashAsset, { schoolId, assetId: legacyAssetId })).rejects.toThrow("accounting migration");
      const first = await t.mutation(assetsMigrationInternal.backfillSchoolAssetMetadataBatch, { schoolId, batchSize: 10 });
      expect(first).toMatchObject({ isDone: true, migratedCount: 1, missingStorageCount: 0 });
      const metadata = await t.run((ctx) => ctx.db.system.get("_storage", storageId));
      const migrated = await t.run((ctx) => ctx.db.get(legacyAssetId));
      expect(migrated).toMatchObject({
        byteSize: metadata?.size,
        sha256: metadata?.sha256,
        mimeType: metadata?.contentType ?? "application/octet-stream",
        validationStatus: "pending",
      });
      expect(migrated?.storageAccountingInitializedAt).toBeDefined();
      const second = await t.mutation(assetsMigrationInternal.backfillSchoolAssetMetadataBatch, { schoolId, batchSize: 10 });
      expect(second.migratedCount).toBe(0);
      let allocation = await t.run((ctx) => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique());
      expect(allocation).toMatchObject({ consumedUnits: metadata?.size, activeStorageBytes: metadata?.size, trashStorageBytes: 0, tempStorageBytes: 0 });

      await platformSession(t).mutation(assetsApi.trashAsset, { schoolId, assetId: legacyAssetId });
      allocation = await t.run((ctx) => ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique());
      expect(allocation).toMatchObject({ consumedUnits: metadata?.size, activeStorageBytes: 0, trashStorageBytes: metadata?.size });
    });

    it("leaves missing legacy storage unresolved and blocks lifecycle accounting", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      await t.mutation(meteringInternal.allocateQuota, { schoolId, meterType: "storage_bytes", allocatedUnits: 10_000 });
      const missingStorageId = await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(new Blob(["missing"], { type: "image/png" }));
        await ctx.storage.delete(storageId);
        return storageId;
      });
      const legacyAssetId = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schoolAssets", {
          schoolId,
          storageId: missingStorageId,
          fileName: "missing.png",
          mimeType: "image/png",
          byteSize: 999,
          sha256: "stale",
          category: "legacy",
          scanStatus: "quarantined",
          isTrashed: false,
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.mutation(assetsMigrationInternal.backfillSchoolAssetMetadataBatch, { schoolId, batchSize: 10 });
      expect(result).toMatchObject({ migratedCount: 0, missingStorageCount: 1, unresolvedCount: 1 });
      const [asset, issue, allocation] = await t.run(async (ctx) => Promise.all([
        ctx.db.get(legacyAssetId),
        ctx.db.query("assetStorageReconciliationIssues")
          .withIndex("by_asset_and_storage_and_code", (q) => q.eq("assetId", legacyAssetId).eq("storageId", missingStorageId).eq("code", "missing_storage"))
          .unique(),
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique(),
      ]));
      expect(asset).toMatchObject({
        byteSize: 999,
        storageReconciliationState: "reconciliation_required",
        validationStatus: "invalid",
      });
      expect(asset?.storageAccountingInitializedAt).toBeUndefined();
      expect(issue).toMatchObject({ status: "open", code: "missing_storage" });
      expect(allocation).toMatchObject({ consumedUnits: 0, activeStorageBytes: 0, trashStorageBytes: 0, tempStorageBytes: 0 });
      await expect(platformSession(t).mutation(assetsApi.trashAsset, { schoolId, assetId: legacyAssetId })).rejects.toThrow("accounting migration");
    });

    it("marks every legacy duplicate storage owner unresolved before bucket accounting", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schools", { name: "Duplicate Ownership Academy", slug: "duplicate-ownership", status: "active", createdAt: now, updatedAt: now });
      });
      await t.mutation(meteringInternal.allocateQuota, { schoolId, meterType: "storage_bytes", allocatedUnits: 10_000 });
      const [sharedStorageId, alternateStorageId] = await t.run((ctx) => Promise.all([
        ctx.storage.store(new Blob(["shared legacy object"], { type: "image/png" })),
        ctx.storage.store(new Blob(["alternate legacy object"], { type: "image/png" })),
      ]));
      const legacyAssetIds = await t.run(async (ctx) => {
        const now = Date.now();
        return await Promise.all([
          ctx.db.insert("schoolAssets", { schoolId, storageId: sharedStorageId, fileName: "duplicate-a.png", mimeType: "image/png", byteSize: 1, sha256: "stale-a", category: "legacy", scanStatus: "quarantined", isTrashed: false, createdAt: now, updatedAt: now }),
          ctx.db.insert("schoolAssets", { schoolId, storageId: sharedStorageId, fileName: "duplicate-b.png", mimeType: "image/png", byteSize: 2, sha256: "stale-b", category: "legacy", scanStatus: "quarantined", isTrashed: false, createdAt: now, updatedAt: now }),
          ctx.db.insert("schoolAssets", { schoolId: schoolB, storageId: alternateStorageId, rollbackStorageId: sharedStorageId, fileName: "duplicate-c.png", mimeType: "image/png", byteSize: 3, sha256: "stale-c", category: "legacy", scanStatus: "quarantined", isTrashed: false, createdAt: now, updatedAt: now }),
        ]);
      });

      const result = await t.mutation(assetsMigrationInternal.backfillSchoolAssetMetadataBatch, { schoolId, batchSize: 10 });
      expect(result).toMatchObject({ migratedCount: 0, duplicateStorageOwnershipCount: 1, unresolvedCount: 3 });
      const [assets, issues, allocation] = await t.run(async (ctx) => Promise.all([
        Promise.all(legacyAssetIds.map((assetId) => ctx.db.get(assetId))),
        Promise.all(legacyAssetIds.map((assetId) => ctx.db.query("assetStorageReconciliationIssues")
          .withIndex("by_asset_and_storage_and_code", (q) => q.eq("assetId", assetId).eq("storageId", sharedStorageId).eq("code", "duplicate_storage_ownership"))
          .unique())),
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique(),
      ]));
      for (const asset of assets) {
        expect(asset?.storageAccountingInitializedAt).toBeUndefined();
        expect(asset?.storageReconciliationState).toBe("reconciliation_required");
      }
      expect(issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ status: "open", code: "duplicate_storage_ownership" }),
        expect.objectContaining({ status: "open", code: "duplicate_storage_ownership" }),
        expect.objectContaining({ status: "open", code: "duplicate_storage_ownership" }),
      ]));
      expect(allocation).toMatchObject({ consumedUnits: 0, activeStorageBytes: 0, trashStorageBytes: 0, tempStorageBytes: 0 });
    });

    it("claims candidate storage atomically and rejects concurrent, reverse, and cross-tenant reuse", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schools", { name: "Candidate Boundary Academy", slug: "candidate-boundary", status: "active", createdAt: now, updatedAt: now });
      });
      const sourceA = await finalizeAsset(t, schoolId, "source-a.png", "test", new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" }));
      await t.mutation(meteringInternal.allocateQuota, { schoolId: schoolB, meterType: "storage_bytes", allocatedUnits: 10_000 });
      const intentB = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId: schoolB });
      const sourceBStorageId = await storeTypedBlob(t, new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4])], { type: "image/png" }));
      const sourceBFinalized = await platformSession(t).mutation(assetsApi.finalizeAssetUpload, { schoolId: schoolB, uploadIntentId: intentB.intentId, storageId: sourceBStorageId, fileName: "source-b.png", category: "test" });
      const sourceB = await t.run((ctx) => ctx.db.get(sourceBFinalized.assetId));
      assertExists(sourceA);
      assertExists(sourceB);
      const candidateStorageId = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1])], { type: "application/pdf" })));
      const [sourceAMetadata, sourceBMetadata, candidateMetadata] = await t.run(async (ctx) => Promise.all([
        ctx.db.system.get("_storage", sourceA.storageId),
        ctx.db.system.get("_storage", sourceB.storageId),
        ctx.db.system.get("_storage", candidateStorageId),
      ]));
      assertExists(sourceAMetadata);
      assertExists(sourceBMetadata);
      assertExists(candidateMetadata);
      const claimA = t.mutation(assetsInternal.recordPdfCompressionCandidateEvidence, {
        schoolId, assetId: sourceA._id, sourceStorageId: sourceA.storageId, sourceSha256: sourceAMetadata.sha256,
        candidateStorageId, candidateSha256: candidateMetadata.sha256, candidateByteSize: candidateMetadata.size, optimizerVersion: "test",
        verified: true,
      });
      const claimB = t.mutation(assetsInternal.recordPdfCompressionCandidateEvidence, {
        schoolId: schoolB, assetId: sourceB._id, sourceStorageId: sourceB.storageId, sourceSha256: sourceBMetadata.sha256,
        candidateStorageId, candidateSha256: candidateMetadata.sha256, candidateByteSize: candidateMetadata.size, optimizerVersion: "test",
        verified: true,
      });
      const claims = await Promise.allSettled([claimA, claimB]);
      expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
      expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(1);

      const reverseIntent = await platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId });
      await expect(platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
        schoolId, uploadIntentId: reverseIntent.intentId, storageId: candidateStorageId, fileName: "reused.pdf", category: "test",
      })).rejects.toThrow("already bound");
      await expect(t.mutation(assetsInternal.recordPdfCompressionCandidateEvidence, {
        schoolId: schoolB, assetId: sourceB._id, sourceStorageId: sourceB.storageId, sourceSha256: sourceBMetadata.sha256,
        candidateStorageId, candidateSha256: candidateMetadata.sha256, candidateByteSize: candidateMetadata.size, optimizerVersion: "test",
        verified: true,
      })).rejects.toThrow("already bound");
    });

    it("rejects reverse, concurrent, and cross-tenant claims of retained rollback originals", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        return await ctx.db.insert("schools", { name: "Rollback Boundary Academy", slug: "rollback-boundary", status: "active", createdAt: now, updatedAt: now });
      });
      const sourceA = await finalizeAsset(t, schoolId, "source-a.png", "test", new Blob(["source-a"], { type: "image/png" }));
      const sourceB = await finalizeAsset(t, schoolB, "source-b.png", "test", new Blob(["source-b"], { type: "image/png" }));
      assertExists(sourceA);
      assertExists(sourceB);
      const retainedOriginalId = await t.run((ctx) => ctx.storage.store(new Blob(["retained original"], { type: "application/pdf" })));
      await t.run((ctx) => ctx.db.patch(sourceA._id, { rollbackStorageId: retainedOriginalId, rollbackExpiryAt: Date.now() + 60_000 }));
      const [sourceAMetadata, sourceBMetadata, retainedMetadata] = await t.run(async (ctx) => Promise.all([
        ctx.db.system.get("_storage", sourceA.storageId),
        ctx.db.system.get("_storage", sourceB.storageId),
        ctx.db.system.get("_storage", retainedOriginalId),
      ]));
      assertExists(sourceAMetadata);
      assertExists(sourceBMetadata);
      assertExists(retainedMetadata);

      await expect(t.mutation(assetsInternal.recordPdfCompressionCandidateEvidence, {
        schoolId: schoolB,
        assetId: sourceB._id,
        sourceStorageId: sourceB.storageId,
        sourceSha256: sourceBMetadata.sha256,
        candidateStorageId: retainedOriginalId,
        candidateSha256: retainedMetadata.sha256,
        candidateByteSize: retainedMetadata.size,
        optimizerVersion: "test",
        verified: true,
      })).rejects.toThrow("already bound");

      const [intentA, intentB] = await Promise.all([
        platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId }),
        platformSession(t).mutation(assetsApi.createAssetUploadIntent, { schoolId: schoolB }),
      ]);
      const claims = await Promise.allSettled([
        platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
          schoolId,
          uploadIntentId: intentA.intentId,
          storageId: retainedOriginalId,
          fileName: "claimed-a.pdf",
          category: "test",
        }),
        platformSession(t).mutation(assetsApi.finalizeAssetUpload, {
          schoolId: schoolB,
          uploadIntentId: intentB.intentId,
          storageId: retainedOriginalId,
          fileName: "claimed-b.pdf",
          category: "test",
        }),
      ]);
      expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(2);
      expect(await t.run((ctx) => ctx.db.query("schoolAssets")
        .withIndex("by_storage", (q) => q.eq("storageId", retainedOriginalId))
        .take(1))).toHaveLength(0);
    });
  });

  describe("5. Public entry-point authorization", () => {
    it("rejects unauthenticated asset uploads and denies cross-tenant reads", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      await expect(t.mutation(assetsApi.createAssetUploadIntent, { schoolId })).rejects.toThrow("Not authorized");

      const schoolB = await t.run(async (ctx) => {
        const now = Date.now();
        const schoolB = await ctx.db.insert("schools", {
          name: "Cross Tenant Academy",
          slug: "cross-tenant-academy",
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        const personId = await ctx.db.insert("persons", {
          authTokenIdentifier: "https://auth.school.test|school-a-user",
          email: "school-a-user@test",
          name: "School A User",
          status: "active",
          primarySchoolId: schoolId,
          createdAt: now,
          updatedAt: now,
        });
        const userId = await ctx.db.insert("users", {
          schoolId,
          authId: "school-a-user",
          authTokenIdentifier: "https://auth.school.test|school-a-user",
          personId,
          name: "School A User",
          email: "school-a-user@test",
          role: "teacher",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("branchMemberships", {
          personId,
          schoolId,
          status: "active",
          isDefaultBranch: true,
          legacyUserId: userId,
          joinedAt: now,
          updatedAt: now,
        });
        return schoolB;
      });

      const schoolAUser = t.withIdentity({
        tokenIdentifier: "https://auth.school.test|school-a-user",
        subject: "school-a-user",
      });
      await expect(
        schoolAUser.query(assetsApi.listSchoolAssets, { schoolId: schoolB })
      ).rejects.toThrow("Not authorized");
    });
  });

  describe("6. Server-verified PDF commit", () => {
    it("rejects unevidenced candidates and commits only matching verifier evidence", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);
      const sourceDocument = await PDFDocument.create();
      for (let index = 0; index < 3; index += 1) {
        const page = sourceDocument.addPage([600, 400]);
        page.drawText(`Page ${index + 1} ${"source content ".repeat(250)}`, { x: 20, y: 350, size: 8 });
      }
      const sourceBytes = new Uint8Array(await sourceDocument.save());
      const asset = await finalizeAsset(t, schoolId, "report.pdf", "reports", new Blob([sourceBytes.buffer], { type: "application/pdf" }));
      assertExists(asset);
      await t.action(assetsInternal.validateAssetMagicBytes, { assetId: asset._id });
      await t.mutation(assetsInternal.beginAssetScan, { assetId: asset._id });
      await t.mutation(assetsInternal.processAssetScanResult, { assetId: asset._id, scanResult: "clean", scannerEngine: "approved-test-scanner" });

      const malformedCandidate = await t.run((ctx) => ctx.storage.store(new Blob(["not a PDF"], { type: "application/pdf" })));
      const rejected = await t.action(assetsInternal.verifyPdfCompressionCandidateForAsset, { schoolId, assetId: asset._id, candidateStorageId: malformedCandidate, optimizerVersion: "test-v1" });
      assertExists(rejected);
      expect(rejected.status).toBe("rejected");
      expect(await t.run((ctx) => ctx.storage.get(malformedCandidate))).toBeNull();
      await expect(t.mutation(assetsInternal.commitOptimizedPdfAsset, { schoolId, assetId: asset._id, candidateId: rejected._id })).rejects.toThrow("evidence");
      await t.run((ctx) => ctx.db.patch(rejected._id, { cleanupScheduledAt: Date.now() - 1 }));
      await t.mutation(assetsInternal.cleanupExpiredAssetStorage, { limit: 10 });
      expect(await t.run((ctx) => ctx.db.get(rejected._id))).toBeNull();

      const optimizedDocument = await PDFDocument.create();
      for (let index = 0; index < 3; index += 1) optimizedDocument.addPage([600, 400]).drawText(`Page ${index + 1}`, { x: 20, y: 350, size: 8 });
      const optimizedBytes = new Uint8Array(await optimizedDocument.save({ useObjectStreams: true }));
      const optimized = await t.run((ctx) => ctx.storage.store(new Blob([optimizedBytes.buffer], { type: "application/pdf" })));
      const verified = await t.action(assetsInternal.verifyPdfCompressionCandidateForAsset, { schoolId, assetId: asset._id, candidateStorageId: optimized, optimizerVersion: "test-v1" });
      assertExists(verified);
      expect(verified.status).toBe("verified");
      let storageAllocation = await t.run((ctx) =>
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique()
      );
      expect(storageAllocation?.tempStorageBytes).toBe(optimizedBytes.byteLength);
      const committed = await t.mutation(assetsInternal.commitOptimizedPdfAsset, { schoolId, assetId: asset._id, candidateId: verified._id });
      assertExists(committed);
      expect(committed.storageId).toBe(optimized);
      expect(committed.rollbackStorageId).toBe(asset.storageId);
      expect(await t.run((ctx) => ctx.db.get(verified._id))).toBeNull();
      const optimizedMetadata = await t.run((ctx) => ctx.db.system.get("_storage", optimized));
      expect(committed).toMatchObject({ byteSize: optimizedMetadata?.size, sha256: optimizedMetadata?.sha256 });
      storageAllocation = await t.run((ctx) =>
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique()
      );
      expect(storageAllocation).toMatchObject({
        activeStorageBytes: optimizedMetadata?.size,
        tempStorageBytes: asset.byteSize,
      });

      const rolledBack = await t.mutation(assetsInternal.rollbackOptimizedPdfAsset, { schoolId, assetId: asset._id });
      const sourceMetadata = await t.run((ctx) => ctx.db.system.get("_storage", asset.storageId));
      expect(rolledBack).toMatchObject({ storageId: asset.storageId, byteSize: sourceMetadata?.size, sha256: sourceMetadata?.sha256, isOptimized: false });
      storageAllocation = await t.run((ctx) =>
        ctx.db.query("usageMeterAllocations").withIndex("by_school_and_meter", (q) => q.eq("schoolId", schoolId).eq("meterType", "storage_bytes")).unique()
      );
      expect(storageAllocation).toMatchObject({
        activeStorageBytes: sourceMetadata?.size,
        tempStorageBytes: 0,
      });
    });
  });

  describe("7. Pure-JS PDF Compression Verification Gate", () => {
    it("preserves exact page count and enforces >10% savings threshold using pdf-lib", async () => {
      // 1. Create a 3-page original PDF with substantial repetitive text
      const origDoc = await PDFDocument.create();
      for (let i = 0; i < 3; i++) {
        const page = origDoc.addPage([600, 400]);
        page.drawText(`Melo Institutional Exam Report - Page ${i + 1}\n` + "Sample content payload text data ".repeat(100), {
          x: 40,
          y: 350,
          size: 10,
        });
      }
      const origBytes = await origDoc.save();

      // 2. Case A: Page count mismatch test (2 pages vs 3 pages)
      const corruptedDoc = await PDFDocument.create();
      for (let i = 0; i < 2; i++) {
        const page = corruptedDoc.addPage([600, 400]);
        page.drawText(`Melo Truncated - Page ${i + 1}`, { x: 40, y: 350, size: 10 });
      }
      const corruptedBytes = await corruptedDoc.save();

      const mismatchResult = await verifyPdfCompressionCandidate(
        origBytes,
        corruptedBytes
      );
      expect(mismatchResult.verified).toBe(false);
      expect(mismatchResult.reason).toContain("Page count mismatch");
      expect(mismatchResult.originalPageCount).toBe(3);
      expect(mismatchResult.compressedPageCount).toBe(2);

      // 3. Case B: Insufficient savings (<10% savings test)
      // Save same document with minimal change
      const identicalBytes = await origDoc.save();
      const insufficientSavingsResult = await verifyPdfCompressionCandidate(
        origBytes,
        identicalBytes
      );
      expect(insufficientSavingsResult.verified).toBe(false);
      expect(insufficientSavingsResult.reason).toContain("Savings gate not met");

      // 4. Case C: Valid compression candidate (3 pages, >10% savings)
      const optimizedDoc = await PDFDocument.create();
      for (let i = 0; i < 3; i++) {
        const page = optimizedDoc.addPage([600, 400]);
        page.drawText(`Page ${i + 1}`, { x: 40, y: 350, size: 10 });
      }
      const optimizedBytes = await optimizedDoc.save({ useObjectStreams: true });

      // Ensure optimizedBytes is smaller than origBytes by > 10%
      expect(optimizedBytes.byteLength).toBeLessThan(origBytes.byteLength * 0.90);

      const validResult = await verifyPdfCompressionCandidate(
        origBytes,
        optimizedBytes
      );
      expect(validResult.verified).toBe(true);
      expect(validResult.originalPageCount).toBe(3);
      expect(validResult.compressedPageCount).toBe(3);
      expect(validResult.savingsPercentage).toBeGreaterThan(10.0);

      const formDoc = await PDFDocument.create();
      formDoc.addPage([600, 400]);
      formDoc.getForm().createTextField("approved-by");
      const formResult = await verifyPdfCompressionCandidate(await formDoc.save(), optimizedBytes);
      expect(formResult.verified).toBe(false);
      expect(formResult.reason).toContain("forms");

      const signedResult = await verifyPdfCompressionCandidate(
        new TextEncoder().encode("%PDF-1.7 /ByteRange"),
        optimizedBytes
      );
      expect(signedResult.verified).toBe(false);
      expect(signedResult.reason).toContain("signed");

      const malformedResult = await verifyPdfCompressionCandidate(new Uint8Array([0, 1, 2]), optimizedBytes);
      expect(malformedResult.verified).toBe(false);
      expect(malformedResult.reason).toContain("Failed to parse original");
    });
  });
});
