"use client";

import { PieChart, ListChecks } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";

export function WeightDistribution() {
  const items = [
    { label: "CA 1", value: "20", color: "bg-blue-100" },
    { label: "CA 2", value: "20", color: "bg-blue-200" },
    { label: "CA 3", value: "20", color: "bg-blue-300" },
    { label: "Exam", value: "40", color: "bg-blue-600", highlight: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            <PieChart size={10} />
            Aggregation Structure
          </div>
          <h3 className="text-xs lg:text-sm font-bold text-slate-900 tracking-tight">Gradebook Weights</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-900 uppercase tracking-[0.15em] bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
          <ListChecks size={12} className="text-blue-600" />
          Sum: 100%
        </div>
      </div>

      <AdminSurface intensity="low" className="p-0 overflow-hidden divide-x divide-slate-100 grid grid-cols-4">
        {items.map((item) => (
          <div 
            key={item.label} 
            className={`p-4 md:p-6 transition-all duration-300 ${
              item.highlight ? "bg-blue-600" : "bg-white hover:bg-slate-50/50"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                item.highlight ? "text-blue-100" : "text-slate-400"
              }`}>
                {item.label}
              </span>
              <div className={`h-1 w-8 rounded-full ${item.highlight ? "bg-blue-400" : item.color}`} />
            </div>
            <div className={`text-2xl font-black tracking-tight ${
              item.highlight ? "text-white" : "text-slate-900"
            }`}>
              {item.value}<span className="text-[0.6em] font-medium opacity-60">%</span>
            </div>
          </div>
        ))}
      </AdminSurface>
    </div>
  );
}
