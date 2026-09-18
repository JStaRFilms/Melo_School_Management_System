"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getUserFacingErrorMessage } from "../errors";
import {
  isPaystackVerificationRecorded,
  MISSING_PAYSTACK_REFERENCE_MESSAGE,
  type PaystackVerificationOutcome,
  type PaystackVerificationState,
} from "./index";

/**
 * Owns the verify state machine plus the single-fire guard: the auto effect
 * runs verification at most once per reference; retry resets the guard.
 */
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
