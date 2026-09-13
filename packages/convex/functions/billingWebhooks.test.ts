import { describe, expect, it } from "vitest";
import {
  buildPaystackEventId,
  extractPayloadMetadata,
  paystackAdmissionsFinancialOutcome,
} from "./billingWebhooks";

describe("Paystack admissions webhook normalization", () => {
  it("resolves refund events through the original nested transaction", () => {
    const payload = {
      event: "refund.processed",
      data: {
        id: 91,
        amount: 500_000,
        transaction: {
          reference: "adm_refund_reference",
          domain: "test",
          currency: "NGN",
          metadata: { schoolId: "school-1" },
          customer: { email: "guardian@example.test" },
        },
      },
    };

    expect(extractPayloadMetadata(payload)).toMatchObject({
      schoolId: "school-1",
      gatewayReference: "adm_refund_reference",
      providerMode: "test",
      amountMinor: 500_000,
      currency: "NGN",
      payerEmail: "guardian@example.test",
    });
    expect(paystackAdmissionsFinancialOutcome(payload, payload.event)).toBe("refunded");

    const firstRefund = { ...payload, data: { ...payload.data, id: undefined, refund_reference: "refund-one" } };
    const secondRefund = { ...payload, data: { ...payload.data, id: undefined, refund_reference: "refund-two" } };
    expect(buildPaystackEventId(firstRefund)).not.toBe(buildPaystackEventId(secondRefund));
  });

  it("reverses only merchant-accepted resolved disputes", () => {
    const accepted = {
      event: "charge.dispute.resolve",
      data: {
        id: 92,
        resolution: "merchant-accepted",
        amount: 500_000,
        refund_amount: 250_000,
        transaction: {
          reference: "adm_dispute_reference",
          domain: "live",
          amount: 500_000,
          currency: "NGN",
        },
      },
    };
    const pending = { ...accepted, event: "charge.dispute.create" };
    const declined = {
      ...accepted,
      data: { ...accepted.data, resolution: "declined" },
    };

    expect(extractPayloadMetadata(accepted)).toMatchObject({
      gatewayReference: "adm_dispute_reference",
      providerMode: "live",
      amountMinor: 250_000,
      currency: "NGN",
    });
    expect(paystackAdmissionsFinancialOutcome(accepted, accepted.event)).toBe("reversed");
    expect(paystackAdmissionsFinancialOutcome(pending, pending.event)).toBeUndefined();
    expect(paystackAdmissionsFinancialOutcome(declined, declined.event)).toBeUndefined();
    expect(buildPaystackEventId(pending)).not.toBe(buildPaystackEventId(accepted));
  });
});
