"use client";

import { ShieldCheck, Target, Calculator, Fingerprint } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

export function AuditPolicy() {
  return (
    <div className="space-y-4 pt-4 border-t border-slate-200/60">
      <div className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <ShieldCheck size={10} />
            Integrity Kernel
          </div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Enforcement Logic</h3>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Active Guard</span>
        </div>
      </div>

      <AdminSurface intensity="low" className="p-6 md:p-8 bg-[#0F172A] !border-none shadow-2xl shadow-slate-200/50 rounded-2xl relative overflow-hidden">
        {/* Decorative Grid Mesh */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Fingerprint size={16} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Integrity Ledger</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                Auth-Linked
              </div>
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                <span className="h-1 w-1 rounded-full bg-slate-600" />
                Immutable Log
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:justify-items-end">
            <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-1 w-full lg:w-40">
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                <Target size={10} />
                Pass Gate
              </div>
              <p className="text-2xl font-black text-white tracking-tighter font-mono">40.0</p>
            </div>

            <div className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1 w-full lg:w-40 font-mono">
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <Calculator size={10} />
                Precision
              </div>
              <p className="text-2xl font-black text-white tracking-tighter">2 DP</p>
            </div>
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
