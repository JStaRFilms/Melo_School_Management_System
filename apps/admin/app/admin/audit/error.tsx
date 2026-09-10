"use client";
import Link from "next/link";
export default function AuditError({ reset }: { reset: () => void }) {
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Audit access unavailable</h1>
      <p role="alert">
        Your branch, ownership or delegated audit scope may have changed, or the
        request could not complete. Retry to revalidate.
      </p>
      <button className="rounded-lg border px-4 py-2" onClick={reset}>
        Retry
      </button>
      <Link className="ml-4 underline" href="/admin">
        Administration
      </Link>
    </main>
  );
}
