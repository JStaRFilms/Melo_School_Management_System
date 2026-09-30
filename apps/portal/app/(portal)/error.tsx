"use client";

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-3xl px-4 py-10 text-slate-700">
      <p>Results are unavailable right now. Try again.</p>
      <button type="button" onClick={reset} className="mt-4 min-h-11 rounded-xl border border-slate-300 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        Try again
      </button>
    </div>
  );
}
