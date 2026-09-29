"use client";

import Link from "next/link";
import { useAction } from "convex/react";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { type PaystackReturnSummary } from "@school/shared/paystackReturn";
import { usePaystackReturnVerification } from "@school/shared/paystackReturn/client";

export function PaystackReturnClient({
  reference,
  returnHref,
}: {
  reference: string;
  returnHref: string;
}) {
  const verifyPayment = useAction(
    "functions/billing:verifyPortalOnlinePaymentByReference" as never
  );
  const { state, result, errorMessage, retryVerification } =
    usePaystackReturnVerification({
      reference,
      verify: (ref) =>
        verifyPayment({ reference: ref } as never) as Promise<PaystackReturnSummary>,
      mapResult: (verification) => verification,
    });

  const statusTone =
    state === "verified"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : state === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-slate-200 bg-white text-slate-900";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className={`rounded-2xl border px-4 py-4 ${statusTone}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {state === "verifying" ? (
                <LoaderCircle className="h-6 w-6 animate-spin" />
              ) : state === "verified" ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">
                Portal payment return
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                {state === "verifying"
                  ? "Confirming your payment..."
                  : state === "verified"
                    ? "Payment confirmed"
                    : "Payment confirmation needed"}
              </h1>
              <p className="mt-2 text-sm leading-6 opacity-90">
                {state === "verifying"
                  ? "Please wait while we verify the transaction directly with Paystack."
                  : state === "verified"
                    ? result?.message || "Your payment was verified successfully."
                    : errorMessage || result?.message || "We could not verify this payment automatically yet."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Reference</p>
            <p className="mt-1 break-all text-sm font-medium text-slate-900">{reference || "No payment reference found"}</p>
          </div>
          {result?.invoiceNumber ? (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Invoice</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{result.invoiceNumber}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void retryVerification()}
            disabled={!reference || state === "verifying"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" /> Retry verification
          </button>
          <Link
            href={returnHref}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
          >
            Back to billing
          </Link>
        </div>
      </div>
    </main>
  );
}
