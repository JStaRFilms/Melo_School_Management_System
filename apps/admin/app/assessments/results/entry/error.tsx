"use client";

export default function ScoreEntryError({ error, reset }: { error: Error; reset: () => void }) {
  const locked = /session scoring regrade|scores, reports and certification are unavailable/i.test(error.message);
  return <div role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
    <h1 className="text-lg font-bold">{locked ? "Session scores temporarily locked" : "Could not load score entry"}</h1>
    <p className="mt-2">{locked ? "A session policy scan or regrade is running or waiting for administrator action. Scores and reports stay unavailable until the scan is cancelled or the regrade completes. Check session scoring in Exam Recording setup." : error.message}</p>
    <button type="button" onClick={reset} className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 font-semibold">Try again</button>
  </div>;
}
