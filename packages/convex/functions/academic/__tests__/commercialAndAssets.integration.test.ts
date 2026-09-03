import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../schema";
import { api } from "../../../_generated/api";
import { PDFDocument } from "pdf-lib";
import {
  verifyPdfCompressionCandidate,
  MAX_FILE_SIZE_BYTES,
} from "../assets";
import {
  calculateSettlementBreakdown,
  NIBSS_CLEARING_NOTICE,
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

const commercialApi = (api as any).functions.academic.commercial;
const meteringApi = (api as any).functions.academic.metering;
const assetsApi = (api as any).functions.academic.assets;

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
      const plan1 = await t.mutation(commercialApi.seedCommercialCatalog, {});
      expect(plan1).toBeDefined();
      expect(plan1.code).toBe("core_basic");
      expect(plan1.perStudentFeeKobo).toBe(CORE_BASIC_PER_STUDENT_KOBO); // 100,000 kobo (₦1,000)
      expect(plan1.termSetupFeeKobo).toBe(CORE_BASIC_SETUP_FEE_KOBO); // 3,000,000 kobo (₦30,000)
      expect(plan1.currency).toBe("NGN");
      expect(plan1.billingCadence).toBe("termly");

      // Idempotent check
      const plan2 = await t.mutation(commercialApi.seedCommercialCatalog, {});
      expect(plan2._id).toBe(plan1._id);
    });

    it("calculates school subscription term fees with setup fee inclusion/exclusion", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);

      await t.mutation(commercialApi.seedCommercialCatalog, {});

      // 1. Initial subscription with 250 students (Setup fee unpaid)
      const sub1 = await t.mutation(commercialApi.createOrUpdateSchoolSubscription, {
        schoolId,
        activeStudentCount: 250,
        setupFeePaid: false,
        paymentRoutingMode: "mode_a_direct",
      });

      // 250 * ₦1,000 (25,000,000 kobo) + ₦30,000 setup (3,000,000 kobo) = 28,000,000 kobo
      expect(sub1.currentTermFeeKobo).toBe(28_000_000);
      expect(sub1.setupFeePaid).toBe(false);

      // 2. Subsequent term with setup fee already paid
      const sub2 = await t.mutation(commercialApi.createOrUpdateSchoolSubscription, {
        schoolId,
        activeStudentCount: 250,
        setupFeePaid: true,
        paymentRoutingMode: "mode_a_direct",
      });

      // 250 * ₦1,000 = 25,000,000 kobo (setup fee omitted)
      expect(sub2.currentTermFeeKobo).toBe(25_000_000);
      expect(sub2.setupFeePaid).toBe(true);
    });

    it("enforces Mode A 100% direct settlement vs Mode B split itemization with balanced ledgers", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId, personId } = await setupTestHarness(t);

      // 1. Mode A: Direct School Merchant Mode (Tuition: ₦150,000 = 15,000,000 kobo)
      const modeATransaction = await t.mutation(
        commercialApi.recordSettlementTransaction,
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
      expect(modeATransaction.breakdown).toMatchObject({
        grossAmountKobo: 15_000_000,
        paystackFeeKobo: 200_000,
        platformFeeKobo: 0,
        netPayoutKobo: 14_800_000, // ₦148,000.00
        clearingCycle: "NIBSS_T_PLUS_1",
      });
      expect(
        modeATransaction.breakdown.paystackFeeKobo +
          modeATransaction.breakdown.platformFeeKobo +
          modeATransaction.breakdown.netPayoutKobo
      ).toBe(15_000_000);

      // 2. Mode B: Melo-Routed Paystack Subaccount Split Mode (Tuition: ₦150,000)
      const modeBTransaction = await t.mutation(
        commercialApi.recordSettlementTransaction,
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
      expect(modeBTransaction.breakdown).toMatchObject({
        grossAmountKobo: 15_000_000,
        paystackFeeKobo: 200_000,
        platformFeeKobo: 250_000,
        netPayoutKobo: 14_550_000, // ₦145,500.00
        clearingCycle: "NIBSS_T_PLUS_1",
      });
      expect(
        modeBTransaction.breakdown.paystackFeeKobo +
          modeBTransaction.breakdown.platformFeeKobo +
          modeBTransaction.breakdown.netPayoutKobo
      ).toBe(15_000_000);
    });
  });

  describe("2. Truthful NIBSS T+1 Interbank Clearing Disclosures", () => {
    it("strictly records NIBSS T+1 clearing cycle and prohibits false next-day claims", async () => {
      const t = convexTest(schema, modules);
      const { schoolId } = await setupTestHarness(t);

      const result = await t.mutation(
        commercialApi.recordSettlementTransaction,
        {
          schoolId,
          transactionRef: "MELO-SETTLE-T1-DISCLOSURE",
          routingMode: "mode_a_direct",
          grossAmountKobo: 10_000_000,
        }
      );

      expect(result.record.clearingCycle).toBe("NIBSS_T_PLUS_1");
      expect(result.record.settlementNotice).toBe(NIBSS_CLEARING_NOTICE);
      expect(result.record.settlementNotice).toContain("NIBSS banking schedules");
      expect(result.record.settlementNotice).toContain(
        "Universal next-day clearing claims are strictly prohibited"
      );

      // Ledger query check
      const ledger = await t.query(commercialApi.getSettlementLedger, {
        schoolId,
      });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].clearingCycle).toBe("NIBSS_T_PLUS_1");
    });
  });

  describe("3. Deterministic Usage Metering & Threshold Protections", () => {
    it("handles quota reservation, warns at 75% and 90%, and strictly blocks with hard_stop at 100% shortfall", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId, personId } = await setupTestHarness(t);

      // 1. Allocate initial quota: 10,000 AI tokens
      await t.mutation(meteringApi.allocateQuota, {
        schoolId,
        meterType: "ai_tokens",
        allocatedUnits: 10_000,
      });

      // 2. Initial state: 0% utilized -> Normal tier
      let status = await t.query(meteringApi.getUsageStatus, {
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
      const res1 = await t.mutation(meteringApi.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 5_000,
        operationName: "batch_lesson_generation",
      });
      expect(res1.allowed).toBe(true);
      expect(res1.thresholdAlert).toBe("normal");
      expect(res1.currentUtilizationPercent).toBe(50);
      expect(res1.availableUnits).toBe(5_000);

      // 4. Commit 5,000 units
      const commit1 = await t.mutation(meteringApi.commitUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsCommitted: 5_000,
        reservationId: res1.reservationId,
        operationName: "batch_lesson_generation",
        description: "Generated 5 curriculum lesson drafts",
        actorUserId: adminUserId,
        actorPersonId: personId,
      });
      expect(commit1.totalConsumed).toBe(5_000);
      expect(commit1.remainingUnits).toBe(5_000);

      // Verify zero raw prompt text stored in billing usage events
      const events = await t.query(meteringApi.listUsageEvents, {
        schoolId,
        meterType: "ai_tokens",
      });
      expect(events).toHaveLength(1);
      expect(events[0].unitsDelta).toBe(5_000);
      expect(events[0].operationName).toBe("batch_lesson_generation");
      expect((events[0] as any).rawPrompt).toBeUndefined();
      expect((events[0] as any).documentPayload).toBeUndefined();

      // 5. Reserve 3,000 units: pushes projected utilization to (5000 + 3000) / 10000 = 80% (>=75%)
      const res2 = await t.mutation(meteringApi.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 3_000,
        operationName: "curriculum_extraction_preview",
      });
      expect(res2.allowed).toBe(true);
      expect(res2.thresholdAlert).toBe("notice_75");
      expect(res2.currentUtilizationPercent).toBe(80);

      // Release reservation (operation cancelled)
      const release2 = await t.mutation(meteringApi.releaseUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsToRelease: 3_000,
        reservationId: res2.reservationId,
      });
      expect(release2.reservedUnits).toBe(0);
      expect(release2.remainingUnits).toBe(5_000);

      // 6. Reserve 4,200 units: pushes projected utilization to (5000 + 4200) / 10000 = 92% (>=90%)
      const res3 = await t.mutation(meteringApi.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 4_200,
        operationName: "large_assessment_bank_builder",
      });
      expect(res3.allowed).toBe(true);
      expect(res3.thresholdAlert).toBe("warning_90");
      expect(res3.currentUtilizationPercent).toBe(92);

      // Commit 4,200 units -> Consumed is now 9,200 units. Available is 800 units.
      await t.mutation(meteringApi.commitUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsCommitted: 4_200,
        reservationId: res3.reservationId,
        operationName: "large_assessment_bank_builder",
        description: "Built 50 questions",
      });

      // 7. Hard-Stop Check: Request 1,000 units when only 800 remain (100% shortfall)
      const res4 = await t.mutation(meteringApi.reserveUsageQuota, {
        schoolId,
        meterType: "ai_tokens",
        unitsRequested: 1_000,
        operationName: "overdraft_attempt",
      });
      expect(res4.allowed).toBe(false);
      expect(res4.thresholdAlert).toBe("hard_stop");
      expect(res4.shortfall).toBe(200); // 1,000 requested - 800 available = 200 shortfall

      // Verify quota was NOT reserved on denial
      status = await t.query(meteringApi.getUsageStatus, {
        schoolId,
        meterType: "ai_tokens",
      });
      expect(status[0].reservedUnits).toBe(0);
      expect(status[0].availableUnits).toBe(800);
    });
  });

  describe("4. Asset Quarantine Gate & Security State Machine", () => {
    it("rejects downloading unscanned or infected assets and allows clean assets", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId } = await setupTestHarness(t);

      // Real storage ID generated via Convex storage
      const storageId1 = await t.run(async (ctx) => {
        return await ctx.storage.store(
          new Blob(["mock-pdf-content"], { type: "application/pdf" })
        );
      });

      // 1. Upload asset into quarantine
      const asset = await t.mutation(assetsApi.uploadAssetQuarantine, {
        schoolId,
        storageId: storageId1,
        fileName: "Term1_Exams_Syllabus.pdf",
        mimeType: "application/pdf",
        byteSize: 1_500_000,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        category: "curriculum_doc",
        uploadedByUserId: adminUserId,
      });

      expect(asset.scanStatus).toBe("quarantined");

      // 2. Unscanned asset download MUST be rejected
      await expect(
        t.query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Access Denied");

      // 3. Mark asset as infected
      await t.mutation(assetsApi.processAssetScanResult, {
        assetId: asset._id,
        scanResult: "infected",
        threatName: "Win32.VBA.MacroDropper",
      });

      // Infected asset download MUST also be rejected
      await expect(
        t.query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Access Denied");

      // 4. Mark clean asset and verify download succeeds
      const storageId2 = await t.run(async (ctx) => {
        return await ctx.storage.store(
          new Blob(["mock-png-content"], { type: "image/png" })
        );
      });

      const cleanAsset = await t.mutation(assetsApi.uploadAssetQuarantine, {
        schoolId,
        storageId: storageId2,
        fileName: "School_Calendar_2026.png",
        mimeType: "image/png",
        byteSize: 850_000,
        sha256: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        category: "branding",
        uploadedByUserId: adminUserId,
      });

      await t.mutation(assetsApi.processAssetScanResult, {
        assetId: cleanAsset._id,
        scanResult: "clean",
      });

      const downloadable = await t.query(assetsApi.getDownloadableAssetUrl, {
        schoolId,
        assetId: cleanAsset._id,
      });
      expect(downloadable.scanStatus).toBe("clean");
      expect(downloadable.fileName).toBe("School_Calendar_2026.png");
    });
  });

  describe("5. Navigable Trash Workspace & Retention Hold Locks", () => {
    it("sets 30-day purge schedule, restores assets, and blocks permanent purge when retention hold is active", async () => {
      const t = convexTest(schema, modules);
      const { schoolId, adminUserId } = await setupTestHarness(t);

      const storageId3 = await t.run(async (ctx) => {
        return await ctx.storage.store(
          new Blob(["mock-xlsx-content"], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          })
        );
      });

      const asset = await t.mutation(assetsApi.uploadAssetQuarantine, {
        schoolId,
        storageId: storageId3,
        fileName: "Audited_School_Accounts_2025.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        byteSize: 2_400_000,
        sha256: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        category: "finance_document",
        uploadedByUserId: adminUserId,
      });

      await t.mutation(assetsApi.processAssetScanResult, {
        assetId: asset._id,
        scanResult: "clean",
      });

      // 1. Move to Trash
      const trashed = await t.mutation(assetsApi.trashAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });
      expect(trashed.isTrashed).toBe(true);
      expect(trashed.purgeScheduledAt).toBeDefined();

      // Verify download is blocked while in trash
      await expect(
        t.query(assetsApi.getDownloadableAssetUrl, {
          schoolId,
          assetId: asset._id,
        })
      ).rejects.toThrow("Trash workspace");

      // Verify listed in Trash workspace with 30-day countdown
      const trashList = await t.query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(trashList).toHaveLength(1);
      expect(trashList[0].daysRemainingUntilPurge).toBe(30);
      expect(trashList[0].hasRetentionHold).toBe(false);

      // 2. Apply Retention Hold
      const hold = await t.mutation(assetsApi.applyRetentionHold, {
        schoolId,
        assetId: asset._id,
        holdReason: "Statutory Tax & Financial Audit",
        notes: "Held by Bursar per FIRS audit request",
        userId: adminUserId,
      });
      expect(hold).toBeDefined();

      // Verify trash list updates to reflect active retention hold
      const trashListWithHold = await t.query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(trashListWithHold[0].hasRetentionHold).toBe(true);
      expect(trashListWithHold[0].activeHolds).toHaveLength(1);

      // 3. Attempt Permanent Purge: MUST BE STRICTLY BLOCKED BY RETENTION HOLD
      await expect(
        t.mutation(assetsApi.permanentPurgeAsset, {
          schoolId,
          assetId: asset._id,
          userId: adminUserId,
        })
      ).rejects.toThrow("active retention hold");

      // 4. Restore asset from trash
      const restored = await t.mutation(assetsApi.restoreAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });
      expect(restored.isTrashed).toBe(false);
      expect(restored.purgeScheduledAt).toBeUndefined();

      // Download is now accessible again
      const downloadable = await t.query(assetsApi.getDownloadableAssetUrl, {
        schoolId,
        assetId: asset._id,
      });
      expect(downloadable.fileName).toBe("Audited_School_Accounts_2025.xlsx");

      // 5. Remove hold, trash again, and purge permanently
      await t.mutation(assetsApi.removeRetentionHold, {
        schoolId,
        holdId: hold._id,
        userId: adminUserId,
      });

      await t.mutation(assetsApi.trashAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });

      // Storage mock delete in test environment
      const purgeResult = await t.mutation(assetsApi.permanentPurgeAsset, {
        schoolId,
        assetId: asset._id,
        userId: adminUserId,
      });
      expect(purgeResult.success).toBe(true);

      // Confirm record was deleted from database
      const finalTrashList = await t.query(assetsApi.listTrashedAssets, {
        schoolId,
      });
      expect(finalTrashList).toHaveLength(0);
    });
  });

  describe("6. Pure-JS PDF Compression Verification Gate", () => {
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
    });
  });
});
