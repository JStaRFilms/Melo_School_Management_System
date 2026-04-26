export default function Loading() {
  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row-reverse">
        <aside className="w-full border-l bg-white/40 backdrop-blur-xl p-4 md:p-8 lg:h-full lg:w-[420px] lg:overflow-y-auto shrink-0">
          <div className="animate-pulse space-y-4">
            <div className="h-12 rounded-2xl bg-slate-100/60" />
            <div className="h-40 rounded-2xl bg-slate-100/60" />
            <div className="h-72 rounded-2xl bg-slate-100/60" />
          </div>
        </aside>
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-[1400px] space-y-6 md:space-y-8 animate-pulse">
            <div className="h-16 rounded-2xl bg-slate-100/60" />
            <div className="h-48 rounded-2xl bg-slate-100/60" />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
              <div className="h-52 rounded-2xl bg-slate-100/60" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
