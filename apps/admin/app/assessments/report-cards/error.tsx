"use client";

export default function ReportCardError({ error, reset }: { error: Error; reset: () => void }) {
  const locked = /session scoring regrade|scores, reports and certification are unavailable/i.test(error.message);
  return <div role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
    <h1 className="text-lg font-bold">{locked ? "Session reports temporarily locked" : "Could not load report cards"}</h1>
    <p className="mt-2">{locked ? "A session scoring scan or regrade is in progress or awaiting administrator action. Cancel the scan or finish the regrade in Exam Recording setup before printing." : error.message}</p>
    <button type="button" onClick={reset} className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 font-semibold">Try again</button>
  </div>;
}
