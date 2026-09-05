"use client";
export default function TransferError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="space-y-3 p-4">
      <h1>Transfers unavailable</h1>
      <p>
        Access may have changed, the requested record may be invalid, or the
        connection failed. No transfer is performed by opening this page.
      </p>
      <button className="rounded border p-2" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
