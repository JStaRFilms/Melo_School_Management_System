export function WeightDistribution() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="section-heading">2. Total Distribution</h2>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 divide-y sm:divide-y-0">
        <div className="p-4 sm:p-6 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            CA 1
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            20%
          </span>
        </div>
        <div className="p-4 sm:p-6 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            CA 2
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            20%
          </span>
        </div>
        <div className="p-4 sm:p-6 text-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            CA 3
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            20%
          </span>
        </div>
        <div className="p-4 sm:p-6 text-center bg-blue-50/50">
          <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest block mb-1 font-extrabold">
            Exam
          </span>
          <span className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight">
            40%
          </span>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 uppercase tracking-widest font-extrabold text-center sm:text-left">
        Snapshot: Session 2025/2026 Policy
      </p>
    </section>
  );
}
