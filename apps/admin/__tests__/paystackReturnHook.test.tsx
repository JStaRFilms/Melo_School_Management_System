import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MISSING_PAYSTACK_REFERENCE_MESSAGE,
  type PaystackReturnSummary,
} from "@school/shared/paystackReturn";
import { usePaystackReturnVerification } from "@school/shared/paystackReturn/client";

function summary(overrides: Partial<PaystackReturnSummary> = {}): PaystackReturnSummary {
  return {
    reference: "ref-1",
    verificationStatus: "verified",
    invoiceNumber: "INV-1",
    paymentRecorded: true,
    message: "ok",
    ...overrides,
  };
}

describe("usePaystackReturnVerification (consolidation P15)", () => {
  it("verifies once per reference (single-fire guard)", async () => {
    const verify = vi.fn(async () => summary());
    const { result, rerender } = renderHook(
      ({ reference }) =>
        usePaystackReturnVerification({ reference, verify, mapResult: (raw) => raw }),
      { initialProps: { reference: "ref-1" } },
    );
    await waitFor(() => expect(result.current.state).toBe("verified"));
    expect(result.current.result).toMatchObject({ reference: "ref-1" });
    rerender({ reference: "ref-1" });
    rerender({ reference: "ref-1" });
    await act(async () => {});
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith("ref-1");
  });

  it("marks rejected verifications as failed", async () => {
    const verify = vi.fn(async () => summary({ verificationStatus: "rejected", paymentRecorded: false, message: "Mismatch" }));
    const { result } = renderHook(() =>
      usePaystackReturnVerification({ reference: "ref-2", verify, mapResult: (raw) => raw }),
    );
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.result?.message).toBe("Mismatch");
  });

  it("stays idle without calling verify when the reference is missing", async () => {
    const verify = vi.fn(async () => summary());
    const { result } = renderHook(() =>
      usePaystackReturnVerification({ reference: "", verify, mapResult: (raw) => raw }),
    );
    await act(async () => {});
    expect(result.current.state).toBe("idle");
    expect(verify).not.toHaveBeenCalled();
    act(() => {
      result.current.retryVerification();
    });
    expect(result.current.errorMessage).toBe(MISSING_PAYSTACK_REFERENCE_MESSAGE);
    expect(verify).not.toHaveBeenCalled();
  });

  it("surfaces verify rejections, falling back for empty throws", async () => {
    const verify = vi.fn(async () => {
      throw new Error("Paystack timeout");
    });
    const { result } = renderHook(() =>
      usePaystackReturnVerification({ reference: "ref-3", verify, mapResult: (raw) => raw }),
    );
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(result.current.errorMessage).toBe("Paystack timeout");

    const blankVerify = vi.fn(async (): Promise<PaystackReturnSummary> => {
      // eslint-disable-next-line no-throw-literal
      throw "";
    });
    const fallback = renderHook(() =>
      usePaystackReturnVerification({ reference: "ref-3b", verify: blankVerify, mapResult: (raw) => raw }),
    );
    await waitFor(() => expect(fallback.result.current.state).toBe("failed"));
    expect(fallback.result.current.errorMessage).toBe("We could not confirm this payment yet.");
  });

  it("retry resets the guard and verifies again", async () => {
    const verify = vi
      .fn(async () => summary())
      .mockRejectedValueOnce(new Error("first attempt down"));
    const { result } = renderHook(() =>
      usePaystackReturnVerification({ reference: "ref-4", verify, mapResult: (raw) => raw }),
    );
    await waitFor(() => expect(result.current.state).toBe("failed"));
    expect(verify).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.retryVerification();
    });
    await waitFor(() => expect(result.current.state).toBe("verified"));
    expect(verify).toHaveBeenCalledTimes(2);
  });
});
