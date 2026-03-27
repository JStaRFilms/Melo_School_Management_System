function SummarySkeleton() {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export default function ArchivedRecordsLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-6 shadow-sm">
        <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-10 w-72 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummarySkeleton />
        <SummarySkeleton />
        <SummarySkeleton />
        <SummarySkeleton />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </section>
    </div>
  );
}
