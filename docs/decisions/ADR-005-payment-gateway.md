# ADR-005: Payment Gateway Adapter with Paystack-First Strategy

**Date:** 2026-03-14  
**Status:** Accepted  
**Deciders:** Architect  

## Context

The system must support school fee payments. Given the target market (African schools), the primary payment gateway must support local payment methods (bank transfers, mobile money, cards). Future support for additional gateways may be needed.

## Decision

**Adapter Pattern with Paystack as Default Provider:**
- Abstract payment operations behind a `PaymentGateway` interface
- Implement Paystack adapter first (MVP)
- Design for extensibility (Stripe, Flutterwave, etc. can be added)
- Webhook-driven payment confirmation via Convex HTTP actions

### Adapter Interface

```typescript
interface PaymentGateway {
  createPaymentLink(input: PaymentLinkInput): Promise<PaymentLink>
  verifyPayment(reference: string): Promise<PaymentVerification>
  handleWebhook(payload: WebhookPayload): Promise<void>
}

interface PaymentLinkInput {
  amount: number
  email: string
  schoolId: string
  invoiceId: string
  description: string
}
```

### Implementation

- Paystack as primary gateway (Nigeria-focused, mobile money support)
- Convex HTTP action for webhook: `/api/webhooks/payment`
- Manual payment capture option for offline payments
- Reconciliation dashboard for bursars

## Rationale

1. **Market Fit:** Paystack is the dominant gateway in Nigeria; supports mobile money, bank transfers, cards
2. **Adapter Pattern:** Isolates payment logic; new gateways don't require core changes
3. **Webhook Reliability:** Convex HTTP actions handle async payment confirmations
4. **Local Support:** Paystack has excellent local support and documentation

## Rejected Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Stripe-only | Less popular in target African markets; limited mobile money |
| Direct integration | No abstraction; hard to switch providers later |
| Multiple gateways from day one | Scope creep; MVP should validate with one provider first |
| No online payments | Parent convenience is a core requirement |

## Consequences

- All payment operations flow through the adapter
- Webhook must be secured (verify Paystack signature)
- Failed webhook handling needs retry logic
- Refund flow must be implemented (Paystack API)
- Currency handling (NGN primary; architecture supports others)
- Transaction fees must be considered in fee planning
