"use client";
import Link from "next/link";
export default function PermissionsError({ reset }: { reset: () => void }) {
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-xl font-semibold">
        Permission workspace unavailable
      </h1>
      <p role="alert">
        Your management authority may have changed, or this configuration needs
        review. Retry to revalidate access. No automatic ownership recovery is
        performed.
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
