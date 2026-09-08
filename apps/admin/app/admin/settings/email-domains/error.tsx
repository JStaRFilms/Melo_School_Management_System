"use client";

export default function EmailWorkbenchError({ reset }: { reset: () => void }) {
  return <main className="space-y-3 p-4">
    <h1 className="text-xl font-semibold">Email workspace unavailable</h1>
    <p role="alert">Access, membership or inherited domain policy may have changed, or the service is unavailable. No provider activation was requested. Check your branch and permissions before reloading; unsaved edits may need re-entry.</p>
    <button className="rounded border px-3 py-2" onClick={reset}>Reload email workspace</button>
  </main>;
}
