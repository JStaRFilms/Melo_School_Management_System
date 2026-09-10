"use client";

import Link from "next/link";
export default function GroupError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Group workspace unavailable</h1>
      <p role="alert">
        Access may have changed, or the request could not complete. No
        unconfirmed changes were saved. Check your authority and retry.
      </p>
      <button onClick={reset} className="rounded-lg border px-4 py-2">
        Retry
      </button>
      <Link href="/schools" className="ml-4 underline">
        Return to schools
      </Link>
    </main>
  );
}
