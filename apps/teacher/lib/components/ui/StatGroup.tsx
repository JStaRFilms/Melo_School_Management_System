import React from "react";

type LucideIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

interface StatProps {
  id?: string;
  label: string;
  value: string | number;
  icon?: React.ReactElement<LucideIconProps>;
  description?: string;
  className?: string;
}

export function Stat({ label, value, icon, description, className = "" }: StatProps) {
  return (
    <div className={`
      flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-950/5 
      transition-all active:scale-[0.98] sm:gap-1 sm:p-2.5 ${className}
    `}>
      <div className="flex items-center gap-1.5">
        {icon && (
          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 border border-slate-100 sm:h-5 sm:w-5">
            {React.cloneElement(icon, {
              size: 12,
              strokeWidth: 2.5,
              className: "sm:w-3.5 sm:h-3.5",
            })}
          </div>
        )}
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap sm:text-xs sm:tracking-[0.18em] opacity-80">
          {label}
        </p>
      </div>
      <div className="flex items-baseline gap-1.5 px-0.5">
        <span className="font-display text-lg font-black tracking-tight text-slate-950 sm:text-xl">
          {value}
        </span>
        {description && (
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
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
  variant?: "scroll" | "wrap" | "double-row";
}

export function StatGroup({ stats, className = "", variant = "scroll" }: StatGroupProps) {
  const isScroll = variant === "scroll";
  const isDoubleRow = variant === "double-row";
  
  return (
    <div className={`
      flex px-0.5 py-2
      ${isScroll ? "items-center overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-2.5" : ""}
      ${isDoubleRow ? "grid grid-rows-2 grid-flow-col overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-2.5 h-[160px] sm:h-auto" : ""}
      ${variant === "wrap" ? "items-center flex-wrap gap-2.5" : ""}
      sm:px-0 sm:py-0 
      sm:gap-3.5 ${className}
    `}>
      {stats.map((stat) => (
        <div 
          key={stat.id ?? stat.label} 
          className="min-w-[110px] shrink-0 snap-start sm:min-w-[130px] lg:min-w-[140px]"
        >
          <Stat {...stat} />
        </div>
      ))}
    </div>
  );
}
