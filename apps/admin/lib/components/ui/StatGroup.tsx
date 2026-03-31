import React, { ReactNode } from "react";

interface StatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
}

export function Stat({ label, value, icon, description }: StatProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 shadow-sm ring-1 ring-slate-950/[0.02] transition-all hover:border-slate-300 hover:shadow-md sm:gap-2.5 sm:px-3 sm:py-1.5">
      {icon && (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 sm:h-6 sm:w-6">
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<any>, {
                size: 14,
                strokeWidth: 2.5,
                className: "sm:w-[16px] sm:h-[16px]"
              })
            : icon}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-0 sm:flex-row sm:items-baseline sm:gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 truncate sm:text-[11px] sm:tracking-[0.2em]">
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-[14px] font-extrabold tracking-tight text-slate-900 sm:text-base">
            {value}
          </span>
          {description && (
            <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest truncate sm:text-[8px]">
              {description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatGroupProps {
  stats: StatProps[];
  className?: string;
}

export function StatGroup({ stats, className = "" }: StatGroupProps) {
  return (
    <div className={`
      flex items-center gap-2 overflow-x-auto px-1 pb-1
      snap-x snap-mandatory 
      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
      sm:overflow-visible sm:px-0 sm:pb-0 
      sm:gap-3 ${className}
    `}>
      {stats.map((stat, idx) => (
        <div key={idx} className="min-w-[120px] shrink snap-start sm:min-w-0 sm:shrink">
          <Stat {...stat} />
        </div>
      ))}
    </div>
  );
}
