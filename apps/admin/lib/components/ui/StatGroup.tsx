import React from "react";
import { cn } from "@/utils";

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
      flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_4px_20px_rgb(0,0,0,0.03)] ring-1 ring-slate-950/5 
      transition-all active:scale-[0.98] sm:p-2 ${className}
    `}>
      <div className="flex items-center gap-1">
        {icon && (
          <div className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-400 border border-slate-100 sm:h-4 sm:w-4">
            {React.cloneElement(icon, {
              size: 10,
              strokeWidth: 2.5,
              className: "sm:w-3 sm:h-3",
            })}
          </div>
        )}
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 whitespace-nowrap opacity-80">
          {label}
        </p>
      </div>
      <div className="flex items-baseline gap-1 px-0.5">
        <span className="font-display text-base font-black tracking-tight text-slate-950 sm:text-lg">
          {value}
        </span>
        {description && (
          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
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
  variant?: "scroll" | "wrap" | "double-row" | "grid";
}

export function StatGroup({ stats, className = "", variant = "scroll" }: StatGroupProps) {
  const isScroll = variant === "scroll";
  const isDoubleRow = variant === "double-row";
  const isGrid = variant === "grid";
  
  return (
    <div className={cn(
      "flex w-full px-0.5 py-1 sm:px-0 sm:py-0 sm:gap-2.5",
      isScroll && "items-center overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-2",
      isDoubleRow && "grid grid-rows-2 grid-flow-col overflow-x-auto snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden gap-2 h-[120px] sm:h-auto",
      variant === "wrap" && "items-center flex-wrap gap-2",
      isGrid && "grid grid-cols-2 sm:grid-cols-3 gap-2",
      className
    )}>
      {stats.map((stat) => (
        <div 
          key={stat.id ?? stat.label} 
          className="min-w-[100px] shrink-0 snap-start sm:min-w-[110px] lg:min-w-[120px]"
        >
          <Stat {...stat} />
        </div>
      ))}
    </div>
  );
}
