"use client";
export default function NumberingError({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-3 p-4" role="alert">
      <h1>Numbering settings unavailable</h1>
      <p>
        Access may have changed or the connection failed. No number was
        allocated by opening this page.
      </p>
      <button className="border p-2" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
