"use client";

interface ArchivedRecordsErrorProps {
  error: Error;
  reset: () => void;
}

export default function ArchivedRecordsError({
  error,
  reset,
}: ArchivedRecordsErrorProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <section className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-6 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-red-600">
          Archived Records Unavailable
        </p>
        <h1 className="mt-2 text-2xl font-bold text-red-950">
          The archive audit view could not load.
        </h1>
        <p className="mt-3 text-sm text-red-800">
          {error.message || "Something went wrong while loading archived records."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex h-11 items-center rounded-2xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700"
        >
          Retry
        </button>
      </section>
    </div>
  );
}
