"use client";

export default function ReleaseError({ reset }: { error: Error; reset: () => void }) {
  return <main className="mx-auto max-w-xl p-6" role="alert"><h1 className="text-xl font-bold">Release readiness unavailable</h1><p className="mt-3">The roster could not be checked. Check your school access and selection, then try again. Confirm the release status before submitting another request.</p><button type="button" onClick={reset} className="mt-4 min-h-11 rounded border border-slate-300 px-4 focus-visible:outline-2">Try again</button></main>;
}
