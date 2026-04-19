"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldAlert, Printer, ArrowLeft } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

type PublicPaymentVerificationResult = {
  reference: string;
  verificationStatus: "verified" | "rejected" | "ignored";
  invoiceNumber: string | null;
  amountPaid: number | null;
  currency: string | null;
  paymentMethod: string | null;
  payerName: string | null;
  payerEmail: string | null;
  paidAt: number | null;
  balanceRemaining: number | null;
  paymentRecorded: boolean;
  message: string;
};

type AdminPaymentVerificationResponse = {
  event: {
    reference: string;
    verificationStatus: "verified" | "rejected" | "ignored";
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

type VerificationState = "idle" | "verifying" | "verified" | "failed";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function PaystackReturnClient({ reference }: { reference: string }) {
  const verifyPayment = useAction(
    "functions/billing:verifyOnlinePaymentByReference" as never
  );
  const [state, setState] = useState<VerificationState>("idle");
  const [result, setResult] = useState<PublicPaymentVerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receiptGeneratedAt, setReceiptGeneratedAt] = useState<string>("");
  const autoVerifiedReferenceRef = useRef<string | null>(null);

  const runVerification = useCallback(async () => {
    if (!reference) {
      setState("failed");
      setErrorMessage("No payment reference was provided in the return URL.");
      return;
    }

    setState("verifying");
    setErrorMessage(null);

    try {
      const verification = (await verifyPayment({
        reference,
      } as never)) as AdminPaymentVerificationResponse;
      const mappedResult: PublicPaymentVerificationResult = {
        reference: verification.event.reference,
        verificationStatus: verification.event.verificationStatus,
        invoiceNumber:
          verification.invoice?.invoiceNumber ?? verification.event.invoiceNumber ?? null,
        amountPaid: verification.payment?.amountReceived ?? null,
        currency: verification.invoice?.currency ?? null,
        paymentMethod: verification.payment?.paymentMethod ?? null,
        payerName: verification.payment?.payerName ?? null,
        payerEmail: verification.payment?.payerEmail ?? null,
        paidAt: verification.payment?.receivedAt ?? null,
        balanceRemaining: verification.invoice?.balanceDue ?? null,
        paymentRecorded: verification.payment !== null,
        message:
          verification.event.verificationMessage ??
          (verification.payment !== null
            ? "Payment verified successfully"
            : "Payment verification completed"),
      };
      setResult(mappedResult);
      setState(
        mappedResult.verificationStatus === "verified" && mappedResult.paymentRecorded
          ? "verified"
          : "failed"
      );
    } catch (error) {
      setState("failed");
      setErrorMessage(
        getUserFacingErrorMessage(error, "We could not confirm this payment yet.")
      );
    }
  }, [reference, verifyPayment]);

  useEffect(() => {
    setReceiptGeneratedAt(new Date().toLocaleString());
  }, []);

  useEffect(() => {
    if (!reference || autoVerifiedReferenceRef.current === reference) {
      return;
    }

    autoVerifiedReferenceRef.current = reference;
    void runVerification();
  }, [reference, runVerification]);

  const retryVerification = async () => {
    if (!reference) {
      setErrorMessage("No payment reference was provided in the return URL.");
      return;
    }

    autoVerifiedReferenceRef.current = null;
    setResult(null);
    setState("idle");
    setErrorMessage(null);
    void runVerification();
  };

  const statusConfig = {
    verifying: {
      icon: <LoaderCircle className="h-10 w-10 animate-spin text-blue-500" />,
      bg: "bg-blue-50",
      border: "border-blue-100",
      title: "Confirming Payment",
      message: "Please wait while we securely verify your transaction with Paystack.",
    },
    verified: {
      icon: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      title: "Payment Successful",
      message: result?.message || "Your payment was verified. The invoice has been updated.",
    },
    failed: {
      icon: <ShieldAlert className="h-10 w-10 text-rose-500" />,
      bg: "bg-rose-50",
      border: "border-rose-100",
      title: "Verification Failed",
      message: errorMessage || result?.message || "We could not verify this payment automatically.",
    },
    idle: {
      icon: <LoaderCircle className="h-10 w-10 animate-spin text-slate-300" />,
      bg: "bg-slate-50",
      border: "border-slate-100",
      title: "Initializing...",
      message: "Starting verification process...",
    }
  };

  const currentConfig = statusConfig[state];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans print:bg-white print:p-0">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl shadow-slate-200/50 print:max-w-none print:border-none print:shadow-none print:p-0">
        
        {/* Document Header (Print Only) */}
        <div className="hidden print:block mb-8 pb-8 border-b border-slate-200">
          <h2 className="text-3xl font-black text-slate-950 uppercase tracking-tight">Payment Receipt</h2>
          <p className="text-slate-500 mt-1 font-medium" suppressHydrationWarning>
            {receiptGeneratedAt ? `Generated ${receiptGeneratedAt}` : "Generated"}
          </p>
          {result?.amountPaid && result.currency ? (
            <p className="mt-3 text-2xl font-black text-emerald-700">
              {formatMoney(result.amountPaid, result.currency)}
            </p>
          ) : null}
        </div>

        {/* Visual Header Section */}
        <div className="flex flex-col items-center text-center print:hidden">
          <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${currentConfig.bg} ${currentConfig.border} border-[6px]`}>
            {currentConfig.icon}
          </div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">{currentConfig.title}</h1>
          <p className="mt-2 text-sm font-medium text-slate-500 max-w-xs">{currentConfig.message}</p>
        </div>

        {/* Details Section */}
        {state !== "idle" && (
          <div className="mt-8 space-y-4 rounded-2xl bg-slate-50 border border-slate-100 p-5 print:mt-0 print:bg-white print:border-slate-200 print:rounded-none">
            {result?.amountPaid && result.currency ? (
              <>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount Paid</span>
                  <span className="mt-1 text-xl font-black text-emerald-700">{formatMoney(result.amountPaid, result.currency)}</span>
                </div>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
              </>
            ) : null}

            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Reference</span>
              <span className="mt-1 text-sm font-bold text-slate-900 break-all">{reference || "N/A"}</span>
            </div>
            
            <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
            
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Verification Status</span>
              <span className={`mt-1 text-sm font-bold capitalize ${state === 'verified' ? 'text-emerald-600' : state === 'failed' ? 'text-rose-600' : 'text-blue-600'}`}>
                {state}
              </span>
            </div>

            {result?.invoiceNumber ? (
              <>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Invoice Number</span>
                  <span className="mt-1 text-sm font-bold text-slate-900">{result.invoiceNumber}</span>
                </div>
              </>
            ) : null}

            {result?.paidAt ? (
              <>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Paid On</span>
                  <span className="mt-1 text-sm font-bold text-slate-900">{formatDateTime(result.paidAt)}</span>
                </div>
              </>
            ) : null}

            {result?.paymentMethod ? (
              <>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment Method</span>
                  <span className="mt-1 text-sm font-bold text-slate-900 capitalize">{result.paymentMethod.replaceAll("_", " ")}</span>
                </div>
              </>
            ) : null}

            {result?.payerName || result?.payerEmail ? (
              <>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payer</span>
                  <span className="mt-1 text-sm font-bold text-slate-900">{result.payerName || result.payerEmail}</span>
                  {result.payerName && result.payerEmail ? <span className="mt-1 text-xs font-medium text-slate-500">{result.payerEmail}</span> : null}
                </div>
              </>
            ) : null}

            {result?.balanceRemaining !== null && result?.balanceRemaining !== undefined && result.currency ? (
              <>
                <div className="h-px w-full bg-slate-200/60 print:bg-slate-200" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Remaining Balance</span>
                  <span className="mt-1 text-sm font-bold text-slate-900">{formatMoney(result.balanceRemaining, result.currency)}</span>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Action Buttons - Hide on print */}
        <div className="mt-8 flex flex-col gap-3 print:hidden">
          {state === "verified" ? (
            <>
              <button
                onClick={() => window.print()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 active:scale-[0.98]"
              >
                <Printer className="h-4 w-4" />
                Save Receipt
              </button>
              <button
                onClick={() => {
                   if (window.history.length > 1) {
                       window.history.back();
                   } else {
                       window.close();
                   }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </button>
            </>
          ) : (
            <button
              onClick={() => void retryVerification()}
              disabled={!reference || state === "verifying"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-xl shadow-slate-900/10"
            >
              <RefreshCw className={`h-4 w-4 ${state === 'verifying' ? 'animate-spin' : ''}`} />
              {state === "verifying" ? "Verifying Transaction" : "Retry Verification"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
