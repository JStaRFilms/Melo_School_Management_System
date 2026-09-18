"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUserFacingErrorMessage } from "./errors";

/**
 * Shared Paystack return verification state machine (consolidation P15).
 * Portal and admin return clients shared this skeleton with different verify
 * actions and result shapes; only the hook is shared, never the UIs.
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

export type UsePaystackReturnVerificationOptions<TRaw, TMapped extends PaystackVerificationOutcome> = {
  reference: string;
  verify: (reference: string) => Promise<TRaw>;
  mapResult: (raw: TRaw) => TMapped;
  missingReferenceMessage?: string;
  verifyErrorMessage?: string;
};

export type UsePaystackReturnVerificationResult<TMapped> = {
  state: PaystackVerificationState;
  result: TMapped | null;
  errorMessage: string | null;
  retryVerification: () => void;
};

/**
 * Owns the verify state machine plus the single-fire guard: the auto effect
 * runs verification at most once per reference; retry resets the guard.
 */
export function usePaystackReturnVerification<TRaw, TMapped extends PaystackVerificationOutcome>({
  reference,
  verify,
  mapResult,
  missingReferenceMessage = MISSING_PAYSTACK_REFERENCE_MESSAGE,
  verifyErrorMessage = "We could not confirm this payment yet.",
}: UsePaystackReturnVerificationOptions<TRaw, TMapped>): UsePaystackReturnVerificationResult<TMapped> {
  const [state, setState] = useState<PaystackVerificationState>("idle");
  const [result, setResult] = useState<TMapped | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoVerifiedReferenceRef = useRef<string | null>(null);

  const runVerification = useCallback(async () => {
    if (!reference) {
      setState("failed");
      setErrorMessage(missingReferenceMessage);
      return;
    }

    setState("verifying");
    setErrorMessage(null);

    try {
      const mapped = mapResult(await verify(reference));
      setResult(mapped);
      setState(isPaystackVerificationRecorded(mapped) ? "verified" : "failed");
    } catch (error) {
      setState("failed");
      setErrorMessage(getUserFacingErrorMessage(error, verifyErrorMessage));
    }
  }, [reference, verify, mapResult, missingReferenceMessage, verifyErrorMessage]);

  useEffect(() => {
    if (!reference || autoVerifiedReferenceRef.current === reference) {
      return;
    }

    autoVerifiedReferenceRef.current = reference;
    void runVerification();
  }, [reference, runVerification]);

  const retryVerification = useCallback(() => {
    if (!reference) {
      setErrorMessage(missingReferenceMessage);
      return;
    }

    // Claim the single-fire slot before invoking directly: the reset would
    // otherwise let the auto effect fire a second verification. (The original
    // clients double-invoked on every retry for this reason.)
    autoVerifiedReferenceRef.current = reference;
    setResult(null);
    setState("idle");
    setErrorMessage(null);
    void runVerification();
  }, [reference, runVerification, missingReferenceMessage]);

  return { state, result, errorMessage, retryVerification };
}
