"use client";

import { LayoutGrid, Target, Calculator, CheckCircle2 } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

const SAMPLE_DATA = [
  { label: "CA 1", score: 18, weight: 20 },
  { label: "CA 2", score: 15, weight: 20 },
  { label: "CA 3", score: 12, weight: 20 },
  { label: "Exam", score: 32, weight: 40, highlight: true },
];

function getGradeFromScore(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function ProtocolBlueprint() {
  const aggregate = SAMPLE_DATA.reduce((sum, item) => sum + item.score, 0);
  const grade = getGradeFromScore(aggregate);

  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <LayoutGrid size={10} />
            Output Projection
          </div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Record Blueprint</h3>
        </div>
        <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Target size={10} />
                Pass: <span className="text-slate-900">40.0</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <Calculator size={10} />
                Precision: <span className="text-slate-900">2DP</span>
            </div>
        </div>
      </div>

      <AdminSurface intensity="low" className="p-0 overflow-hidden border-slate-200 shadow-xl shadow-slate-200/40">
        <div className="bg-slate-100/50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projection: Sample Entry</span>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-black uppercase tracking-tighter">
                <CheckCircle2 size={10} />
                Valid Protocol
            </div>
        </div>
        
        <div className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* The Row Mockup */}
            <div className="flex-1 w-full grid grid-cols-4 gap-4">
                {SAMPLE_DATA.map((col) => (
                    <div key={col.label} className="space-y-2">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{col.label}</div>
                        <div className={`h-12 rounded-xl border flex items-center justify-center text-sm font-black transition-all ${
                            col.highlight ? "bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-100" : "bg-white border-slate-100 text-slate-900"
                        }`}>
                            {col.score}
                        </div>
                        <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center">wt: {col.weight}%</div>
                    </div>
                ))}
            </div>

            <div className="h-12 w-px bg-slate-100 hidden md:block" />

            {/* The Result */}
            <div className="shrink-0 flex items-center gap-6 bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aggregate</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{aggregate.toFixed(2)}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-inner">
                    <span className="text-xl font-black text-slate-900">{grade}</span>
                </div>
            </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-8 py-3">
             <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] italic">
                * Real-time calculation bypass initialized: precision mapping 2dp active.
              </p>
        </div>
      </AdminSurface>
    </div>
  );
}
