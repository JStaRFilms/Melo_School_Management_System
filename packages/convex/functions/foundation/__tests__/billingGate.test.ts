import { describe, expect, it } from "vitest";
import {
  isOnlineCheckoutOffered,
  isProviderReadyForPayments,
} from "../billingGate";

describe("billing gates (consolidation P12)", () => {
  it("offers checkout on flag plus payable invoice only", () => {
    expect(isOnlineCheckoutOffered({ allowOnlinePayments: true, invoice: { balanceDue: 100, status: "issued" } })).toBe(true);
    expect(isOnlineCheckoutOffered({ allowOnlinePayments: false, invoice: { balanceDue: 100, status: "issued" } })).toBe(false);
    for (const status of ["paid", "waived", "cancelled"]) {
      expect(isOnlineCheckoutOffered({ allowOnlinePayments: true, invoice: { balanceDue: 100, status } })).toBe(false);
    }
    expect(isOnlineCheckoutOffered({ allowOnlinePayments: true, invoice: { balanceDue: 0, status: "issued" } })).toBe(false);
    expect(isOnlineCheckoutOffered({ allowOnlinePayments: true, invoice: { balanceDue: -5, status: "issued" } })).toBe(false);
  });

  it("requires flag, secret, and ready status for payments", () => {
    const ready = { allowOnlinePayments: true, hasActiveSecret: true, providerStatus: "ready" };
    expect(isProviderReadyForPayments(ready)).toBe(true);
    expect(isProviderReadyForPayments({ ...ready, providerStatus: "rotation_pending" })).toBe(true);
    expect(isProviderReadyForPayments({ ...ready, allowOnlinePayments: false })).toBe(false);
    expect(isProviderReadyForPayments({ ...ready, hasActiveSecret: false })).toBe(false);
    for (const providerStatus of ["not_configured", "invalid", "disabled", "unknown"]) {
      expect(isProviderReadyForPayments({ ...ready, providerStatus })).toBe(false);
    }
    expect(isProviderReadyForPayments({ ...ready, providerStatus: null })).toBe(false);
    expect(isProviderReadyForPayments({ ...ready, providerStatus: undefined })).toBe(false);
  });

  it("keeps display and readiness distinct", () => {
    // Flag on, no secret: checkout offered, payments not ready.
    expect(isOnlineCheckoutOffered({ allowOnlinePayments: true, invoice: { balanceDue: 50, status: "issued" } })).toBe(true);
    expect(isProviderReadyForPayments({ allowOnlinePayments: true, hasActiveSecret: false, providerStatus: "ready" })).toBe(false);
  });
});
