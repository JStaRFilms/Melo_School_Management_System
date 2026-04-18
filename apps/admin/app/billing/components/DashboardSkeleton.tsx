import React from "react";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 md:space-y-8">
      <div className="h-20 rounded-2xl bg-slate-100/80 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-slate-100/70 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[420px] rounded-2xl bg-slate-100/70 animate-pulse" />
        <div className="h-[420px] rounded-2xl bg-slate-100/70 animate-pulse" />
      </div>
      <div className="h-[520px] rounded-2xl bg-slate-100/70 animate-pulse" />
    </div>
  );
}
