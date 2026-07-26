import { describe, expect, test } from "vitest";
import {
  boundedQueueLimit,
  canRecordDecision,
  canRequestChanges,
  conversionAction,
  copyCanonicalApplicationLink,
  hasScopedCapability,
  pageRows,
  redactQueueRows,
  validateAdmissionsSettings,
  type AdmissionsSettingsDraft,
} from "../lib/admissions/models";

const validDraft: AdmissionsSettingsDraft = {
  programme: { name: "Primary", slug: "primary", status: "draft" },
  intake: { name: "2027 Entry", slug: "2027-entry", cycleLabel: "2027", opensAt: "2027-01-01T09:00", closesAt: "2027-03-01T17:00", status: "draft" },
  product: { name: "Application slot", slug: "application", slotCount: 1, amountMinor: "5000", currency: "NGN", feeDisclosure: "fee-v1", refundPolicyKey: "refund-v1" },
  fields: [{ key: "support-needs", label: "Support needs", kind: "textarea", requiredMode: "optional", dataClass: "sensitive", purpose: "Plan reasonable adjustments", retentionPolicy: "admissions-v1", privacyApproval: "privacy-1" }],
  requirements: [{ key: "photo", label: "Photo", category: "photo", requiredMode: "required", sensitivity: "child_confidential", purpose: "Identify the applicant", acceptedMimeTypes: "image/jpeg", maxBytes: "1000000", privacyApproval: "" }],
  declaration: { title: "Declaration", body: "I confirm the information is accurate.", purpose: "service", version: "1", mandatory: true },
};

describe("admissions admin operations", () => {
  test("does not promote a programme-scoped staff grant to another tenant or intake", () => {
    const grants = [{ capability: "applications.list" as const, scope: "intake" as const, programmeId: "programme-a", intakeId: "intake-a" }];
    expect(hasScopedCapability(grants, "applications.list", { programmeId: "programme-a", intakeId: "intake-a" })).toBe(true);
    expect(hasScopedCapability(grants, "applications.list", { programmeId: "programme-b", intakeId: "intake-b" })).toBe(false);
    expect(hasScopedCapability(grants, "documents.review", { programmeId: "programme-a", intakeId: "intake-a" })).toBe(false);
  });

  test("keeps queue rows redacted and paginated within a bounded page size", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      applicationId: `app-${index}`,
      publicId: `ref-${index}`,
      state: "submitted",
      updatedAt: index,
      intakeId: "intake-a",
      childName: "Private child",
      medicalAnswer: "Private medical detail",
      storageId: "private-storage-id",
    }));
    const redacted = redactQueueRows(rows);
    expect(redacted[0]).toEqual({ applicationId: "app-0", publicId: "ref-0", state: "submitted", updatedAt: 0, intakeId: "intake-a" });
    expect(Object.keys(redacted[0])).not.toContain("childName");
    expect(boundedQueueLimit(999)).toBe(100);
    const firstPage = pageRows(redacted, 0, 999);
    expect(firstPage.items).toHaveLength(100);
    expect(firstPage.hasNextPage).toBe(true);
    expect(pageRows(redacted, 1, 100).items).toHaveLength(1);
  });

  test("permits only legal staff review transitions in the client guard", () => {
    expect(canRequestChanges("submitted", "Please replace the photo.")).toBe(true);
    expect(canRequestChanges("under_review", "Please complete the address.")).toBe(true);
    expect(canRequestChanges("accepted", "Please edit this.")).toBe(false);
    expect(canRecordDecision({ applicationState: "submitted", hasSnapshot: true, reasonCode: "approved", guardianMessage: "A decision was recorded." })).toBe(true);
    expect(canRecordDecision({ applicationState: "draft", hasSnapshot: true, reasonCode: "approved", guardianMessage: "A decision was recorded." })).toBe(false);
  });

  test("never treats accepted as converted and only retries the same ledger", () => {
    expect(conversionAction(null, false)).toBe("none");
    expect(conversionAction(null, true)).toBe("start");
    expect(conversionAction("running", true)).toBe("wait");
    expect(conversionAction("failed_retryable", true)).toBe("retry_same_ledger");
    expect(conversionAction("succeeded", true)).toBe("none");
  });

  test("requires typed sensitive configuration governance before a preview can be valid", () => {
    expect(validateAdmissionsSettings(validDraft)).toEqual([]);
    const invalid = structuredClone(validDraft);
    invalid.fields[0].privacyApproval = "";
    invalid.product.slotCount = 2 as 1;
    expect(validateAdmissionsSettings(invalid)).toEqual(expect.arrayContaining([
      "Each admissions product must create exactly one application slot.",
      "Sensitive field “support-needs” needs purpose, retention, and privacy approval.",
    ]));
  });

  test("copies only the B0-supplied canonical application URL", async () => {
    const writes: string[] = [];
    const copied = await copyCanonicalApplicationLink(
      { href: "https://apply.example.test/s/example-school/i/2027-entry" },
      { writeText: async (value: string) => { writes.push(value); } },
    );
    expect(copied).toBe(true);
    expect(writes).toEqual(["https://apply.example.test/s/example-school/i/2027-entry"]);
  });
});
