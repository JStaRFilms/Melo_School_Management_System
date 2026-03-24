import { ShieldCheck } from "lucide-react";

export function AuditPolicyCard() {
  return (
    <section className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <h3 className="font-bold text-xs uppercase tracking-widest text-white/70">
          Audit Enforcement Policy
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        <div className="space-y-2">
          <p className="text-[11px] text-white/60 leading-relaxed">
            Changes are logged per administrator. Mode updates apply to{" "}
            <span className="text-white font-bold">Incomplete</span> recordings
            only. Published results are never affected by mode changes.
          </p>
        </div>
        <div className="flex gap-4 sm:justify-end">
          <div className="text-center bg-white/5 border border-white/10 rounded-lg p-3 min-w-[100px]">
            <span className="text-[8px] text-white/40 block mb-1 uppercase tracking-widest">
              Pass Mark
            </span>
            <span className="text-lg font-bold">40.0</span>
          </div>
          <div className="text-center bg-white/5 border border-white/10 rounded-lg p-3 min-w-[100px]">
            <span className="text-[8px] text-white/40 block mb-1 uppercase tracking-widest">
              Precision
            </span>
            <span className="text-lg font-bold">2 DP</span>
          </div>
        </div>
      </div>
    </section>
  );
}
