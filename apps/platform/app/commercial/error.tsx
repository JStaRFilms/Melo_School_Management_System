"use client";
export default function CommercialError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="bg-white rounded-xl border border-rose-200 p-6 text-center shadow-xs space-y-3">
      <h1 className="text-base font-bold text-slate-900">Commercial access unavailable</h1>
      <p className="text-sm text-slate-600">
        Check authorization and connection. A failed read does not initiate a
        payment.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
      >
        Retry
      </button>
    </section>
  );
}
