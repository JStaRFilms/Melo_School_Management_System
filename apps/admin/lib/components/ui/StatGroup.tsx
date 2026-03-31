import React, { ReactNode } from "react";

interface StatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  className?: string;
}

export function Stat({ label, value, icon, description, className = "" }: StatProps) {
  return (
    <div className={`
      flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-950/5 
      transition-all active:scale-[0.98] sm:gap-2 sm:p-3.5 sm:rounded-2xl ${className}
    `}>
      <div className="flex items-center gap-2">
        {icon && (
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100 sm:h-6 sm:w-6 sm:rounded-xl">
            {React.isValidElement(icon)
              ? React.cloneElement(icon as React.ReactElement<any>, {
                  size: 11,
                  strokeWidth: 2.5,
                  className: "sm:w-3.5 sm:h-3.5"
                })
              : icon}
          </div>
        )}
        <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap sm:text-[10px] sm:tracking-[0.2em] opacity-80 mt-0.5">
          {label}
        </p>
      </div>
      <div className="flex items-baseline gap-1.5 px-0.5">
        <span className="font-display text-[15px] font-black tracking-tight text-slate-950 sm:text-xl">
          {value}
        </span>
        {description && (
          <span className="text-[7px] font-bold text-slate-300 uppercase tracking-widest sm:text-[9px]">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

interface StatGroupProps {
  stats: StatProps[];
  className?: string;
  variant?: "scroll" | "wrap";
}

export function StatGroup({ stats, className = "", variant = "scroll" }: StatGroupProps) {
  return (
    <div className={`
      flex items-center gap-2.5 overflow-x-auto px-0.5 py-2
      snap-x snap-mandatory 
      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden
      sm:overflow-visible sm:px-0 sm:py-0 
      sm:gap-3.5 ${className}
    `}>
      {stats.map((stat, idx) => (
        <div 
          key={idx} 
          className="min-w-[125px] shrink-0 snap-start sm:min-w-[160px]"
        >
          <Stat {...stat} />
        </div>
      ))}
    </div>
  );
}
