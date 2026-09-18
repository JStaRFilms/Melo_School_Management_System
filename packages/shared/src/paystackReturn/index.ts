/**
 * Shared Paystack return verification primitives (consolidation P15).
 * Pure module with NO "use client" directive: server pages import the
 * reference extractor from here. The state-machine hook lives in
 * paystackReturnClient.ts.
 */

export type PaystackVerificationStatus = "verified" | "rejected" | "ignored";

export type PaystackVerificationState = "idle" | "verifying" | "verified" | "failed";

export interface PaystackVerificationOutcome {
  verificationStatus: PaystackVerificationStatus;
  paymentRecorded: boolean;
}

export const MISSING_PAYSTACK_REFERENCE_MESSAGE =
  "No payment reference was provided in the return URL.";

export type PaystackReturnSearchParams = {
  reference?: string | null;
  trxref?: string | null;
  payment_ref?: string | null;
};

/** Reference extractor: Paystack may return reference, trxref, or payment_ref. */
export function extractPaystackReference(
  params?: PaystackReturnSearchParams | null,
): string {
  return params?.reference ?? params?.trxref ?? params?.payment_ref ?? "";
}

export function isPaystackVerificationRecorded(
  result: PaystackVerificationOutcome,
): boolean {
  return result.verificationStatus === "verified" && result.paymentRecorded;
}

export type PaystackReturnSummary = PaystackVerificationOutcome & {
  reference: string;
  invoiceNumber: string | null;
  message: string;
};

export type AdminPaystackVerificationResponse = {
  event: {
    reference: string;
    verificationStatus: PaystackVerificationStatus;
    invoiceNumber?: string | null;
    verificationMessage?: string | null;
  };
  invoice: {
    invoiceNumber: string;
    currency: string;
    balanceDue: number;
  } | null;
  payment: {
    amountReceived: number;
    paymentMethod: string;
    payerName: string | null;
    payerEmail: string | null;
    receivedAt: number;
  } | null;
};

export type AdminPaystackReturnSummary = PaystackReturnSummary & {
  amountPaid: number | null;
  currency: string | null;
  paymentMethod: string | null;
  payerName: string | null;
  payerEmail: string | null;
  paidAt: number | null;
  balanceRemaining: number | null;
};

/** Billing mapper: admin nested verify response -> flat return summary. */
export function mapAdminPaystackVerification(
  verification: AdminPaystackVerificationResponse,
): AdminPaystackReturnSummary {
  const paymentRecorded = verification.payment !== null;
  return {
    reference: verification.event.reference,
    verificationStatus: verification.event.verificationStatus,
    invoiceNumber:
      verification.invoice?.invoiceNumber ??
      verification.event.invoiceNumber ??
      null,
    amountPaid: verification.payment?.amountReceived ?? null,
    currency: verification.invoice?.currency ?? null,
    paymentMethod: verification.payment?.paymentMethod ?? null,
    payerName: verification.payment?.payerName ?? null,
    payerEmail: verification.payment?.payerEmail ?? null,
    paidAt: verification.payment?.receivedAt ?? null,
    balanceRemaining: verification.invoice?.balanceDue ?? null,
    paymentRecorded,
    message:
      verification.event.verificationMessage ??
      (paymentRecorded
        ? "Payment verified successfully"
        : "Payment verification completed"),
  };
}
