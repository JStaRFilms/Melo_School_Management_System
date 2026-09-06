"use client";
export default function BillingError({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-3 p-4" role="alert">
      <h1>Billing access unavailable</h1>
      <p>
        Check your authorization and connection before retrying. Failed reads do
        not change bank details or issue invoices.
      </p>
      <button className="border p-2" onClick={reset}>
        Retry
      </button>
    </section>
  );
}
