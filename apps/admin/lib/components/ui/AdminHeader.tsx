import { ReactNode } from "react";
import { cn } from "@/utils";

interface AdminHeaderProps {
  title: string;
  description?: string;
  label?: string;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function AdminHeader({
  title,
  description,
  label,
  actions,
  className = "",
  compact = false,
}: AdminHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-0.5">
        {label && (
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400/80">
            {label}
          </p>
        )}
        <h1 className={cn(
          "font-display font-extrabold tracking-tight text-slate-950",
          compact ? "text-lg" : "text-xl lg:text-3xl"
        )}>
          {title}
        </h1>
        {description && (
          <p className={cn(
            "max-w-2xl font-medium leading-tight text-slate-500/80",
            compact ? "text-[10px]" : "text-[12px]"
          )}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-3 lg:shrink-0 lg:pb-1">
          {actions}
        </div>
      )}
    </header>
  );
}
