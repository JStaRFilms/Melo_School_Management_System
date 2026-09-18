import { describe, expect, it } from "vitest";
import {
  extractPaystackReference,
  isPaystackVerificationRecorded,
  mapAdminPaystackVerification,
  type AdminPaystackVerificationResponse,
} from "../paystackReturn";

describe("extractPaystackReference", () => {
  it("prefers reference, then trxref, then payment_ref", () => {
    expect(extractPaystackReference({ reference: "a", trxref: "b", payment_ref: "c" })).toBe("a");
    expect(extractPaystackReference({ trxref: "b", payment_ref: "c" })).toBe("b");
    expect(extractPaystackReference({ payment_ref: "c" })).toBe("c");
  });

  it("returns empty string for missing params", () => {
    expect(extractPaystackReference({})).toBe("");
    expect(extractPaystackReference(null)).toBe("");
    expect(extractPaystackReference(undefined)).toBe("");
  });
});

describe("isPaystackVerificationRecorded", () => {
  it("requires verified status and a recorded payment", () => {
    expect(isPaystackVerificationRecorded({ verificationStatus: "verified", paymentRecorded: true })).toBe(true);
    expect(isPaystackVerificationRecorded({ verificationStatus: "verified", paymentRecorded: false })).toBe(false);
    expect(isPaystackVerificationRecorded({ verificationStatus: "rejected", paymentRecorded: true })).toBe(false);
    expect(isPaystackVerificationRecorded({ verificationStatus: "ignored", paymentRecorded: false })).toBe(false);
  });
});

describe("mapAdminPaystackVerification", () => {
  const base: AdminPaystackVerificationResponse = {
    event: { reference: "ref-1", verificationStatus: "verified", invoiceNumber: "INV-1" },
    invoice: { invoiceNumber: "INV-1", currency: "NGN", balanceDue: 0 },
    payment: { amountReceived: 50000, paymentMethod: "card", payerName: "Ada", payerEmail: "a@x.test", receivedAt: 123 },
  };

  it("flattens the nested admin response", () => {
    expect(mapAdminPaystackVerification(base)).toEqual({
      reference: "ref-1",
      verificationStatus: "verified",
      invoiceNumber: "INV-1",
      amountPaid: 50000,
      currency: "NGN",
      paymentMethod: "card",
      payerName: "Ada",
      payerEmail: "a@x.test",
      paidAt: 123,
      balanceRemaining: 0,
      paymentRecorded: true,
      message: "Payment verified successfully",
    });
  });

  it("falls back to event fields when invoice/payment are absent", () => {
    const mapped = mapAdminPaystackVerification({
      event: { reference: "ref-2", verificationStatus: "rejected", invoiceNumber: "INV-2", verificationMessage: "Mismatch" },
      invoice: null,
      payment: null,
    });
    expect(mapped).toMatchObject({
      invoiceNumber: "INV-2",
      amountPaid: null,
      currency: null,
      paymentRecorded: false,
      message: "Mismatch",
    });
  });

  it("uses the completion message when no payment and no event message", () => {
    const mapped = mapAdminPaystackVerification({
      event: { reference: "ref-3", verificationStatus: "ignored" },
      invoice: null,
      payment: null,
    });
    expect(mapped.message).toBe("Payment verification completed");
    expect(mapped.invoiceNumber).toBeNull();
  });
});
