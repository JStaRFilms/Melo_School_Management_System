"use client";
export default function CommercialError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="space-y-3 p-4">
      <h1>Commercial access unavailable</h1>
      <p>
        Check authorization and connection. A failed read does not initiate a
        payment.
      </p>
      <button onClick={reset}>Retry</button>
    </section>
  );
}
