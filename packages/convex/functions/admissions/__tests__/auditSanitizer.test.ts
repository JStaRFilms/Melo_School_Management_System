import { describe, expect, it } from "vitest";
import { sanitizeAdmissionsAuditFields } from "../shared";

describe("sanitizeAdmissionsAuditFields (consolidation P1)", () => {
  it("leaves clean values untouched", () => {
    expect(
      sanitizeAdmissionsAuditFields({
        entityId: "admissionsApplication|abc123",
        reasonCode: "INCOMPLETE_DOCUMENTS",
        metadata: { revision: 3, answerCount: 12, archived: false },
      }),
    ).toEqual({
      entityId: "admissionsApplication|abc123",
      reasonCode: "INCOMPLETE_DOCUMENTS",
      metadataJson: JSON.stringify({ revision: 3, answerCount: 12, archived: false }),
    });
  });

  it("redacts bearer tokens and JWTs carried in reasonCode", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJVadQssw5c";
    const { reasonCode } = sanitizeAdmissionsAuditFields({
      entityId: "doc-key-1",
      reasonCode: `retry with Bearer ${jwt} failed`,
    });
    expect(reasonCode).not.toContain(jwt);
    expect(reasonCode).toContain("[REDACTED_SECRET]");
  });

  it("redacts guardian email/phone and NUBAN/NIN inside metadata", () => {
    const { metadataJson } = sanitizeAdmissionsAuditFields({
      entityId: "doc-key-1",
      metadata: {
        guardianEmail: "parent@example.com token=super-secret-value",
        phone: "08031234567",
        account: "0123456789",
        nin: "12345678901",
        ninNumeric: 12345678901,
      },
    });
    expect(metadataJson).toBeDefined();
    expect(metadataJson).not.toContain("super-secret-value");
    expect(metadataJson).not.toContain("parent@example.com");
    expect(metadataJson).not.toContain("08031234567");
    expect(metadataJson).not.toContain("0123456789");
    expect(metadataJson).not.toContain("12345678901");
    const parsed = JSON.parse(metadataJson as string);
    expect(parsed.guardianEmail).toBe("[REDACTED_SECRET]");
    expect(parsed.ninNumeric).toBe("[REDACTED_SECRET]");
    // valid JSON survives redaction
    expect(() => JSON.parse(metadataJson as string)).not.toThrow();
  });

  it("keeps opaque provider event ids exact for payment correlation", () => {
    const { metadataJson } = sanitizeAdmissionsAuditFields({
      entityId: "attempt-1",
      metadata: { providerEventId: "4099269727", revision: 3 },
    });
    const parsed = JSON.parse(metadataJson as string);
    expect(parsed.providerEventId).toBe("4099269727");
    expect(parsed.revision).toBe(3);
  });

  it("fails closed on *Key/*Reference keys holding bare secrets", () => {
    const { metadataJson } = sanitizeAdmissionsAuditFields({
      entityId: "attempt-1",
      metadata: { accessKey: "AKIAIOSFODNN7EXAMPLE", documentCount: 2 },
    });
    const parsed = JSON.parse(metadataJson as string);
    expect(parsed.accessKey).toBe("[REDACTED_SECRET]");
    expect(parsed.documentCount).toBe(2);
  });

  it("redacts secret-bearing document keys in entityId", () => {
    const { entityId } = sanitizeAdmissionsAuditFields({
      entityId: "upload password=hunter2 doc-key-9",
    });
    expect(entityId).not.toContain("hunter2");
    expect(entityId).toContain("[REDACTED_SECRET]");
  });

  it("keeps metadataJson parseable for quoted secrets and sensitive keys", () => {
    const { metadataJson } = sanitizeAdmissionsAuditFields({
      entityId: "doc-key-1",
      metadata: {
        password: "hunter2",
        note: "passport=ABC123",
        big: "x".repeat(3000),
      },
    });
    expect(metadataJson).not.toContain("hunter2");
    const parsed = JSON.parse(metadataJson as string);
    expect(parsed.password).toBe("[REDACTED_SECRET]");
    expect(typeof parsed.note).toBe("string");
    expect(typeof parsed.big).toBe("string");
  });

  it("drops multiword secret values entirely, keeps masked tails", () => {
    const { metadataJson } = sanitizeAdmissionsAuditFields({
      entityId: "doc-key-1",
      metadata: {
        password: "correct horse battery staple",
        contact: "call 08031234567 now",
      },
    });
    const parsed = JSON.parse(metadataJson as string);
    expect(parsed.password).toBe("[REDACTED_SECRET]");
    expect(parsed.contact).toBe("call ***-****-4567 now");
  });

  it("omits optional fields when absent", () => {
    expect(sanitizeAdmissionsAuditFields({ entityId: "x" })).toEqual({ entityId: "x" });
  });
});
