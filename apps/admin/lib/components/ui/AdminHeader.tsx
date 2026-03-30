import { ReactNode } from "react";

interface AdminHeaderProps {
  title: string;
  description?: string;
  label?: string;
  actions?: ReactNode;
  className?: string;
}

export function AdminHeader({
  title,
  description,
  label,
  actions,
  className = "",
}: AdminHeaderProps) {
  return (
    <header className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="space-y-1">
        {label && (
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400/80">
            {label}
          </p>
        )}
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-[13px] font-medium leading-relaxed text-slate-500/90">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:pb-1">
          {actions}
        </div>
      )}
    </header>
  );
}
