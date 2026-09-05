"use client";

import Link from "next/link";
export default function GroupError({ reset }: { reset: () => void }) {
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">Group access unavailable</h1>
      <p role="alert">
        This directory requires active canonical ownership. Your access may have
        changed, or the request could not complete.
      </p>
      <button onClick={reset} className="rounded-lg border px-4 py-2">
        Retry
      </button>
      <Link href="/admin" className="ml-4 underline">
        Administration
      </Link>
    </main>
  );
}
