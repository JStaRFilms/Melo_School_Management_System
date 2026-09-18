"use client";

import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Shared empty state (consolidation P22). Dashed paper surface with title,
 * message, and an optional action slot. Promoted from the manual-adjustments
 * workspace; statuses and actions stay with each caller.
 */
export function EmptyState({ title, message, action, className = "" }: EmptyStateProps) {
  return (
    <section className={`rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 shadow-sm ${className}`}>
      <p className="font-extrabold text-slate-950">{title}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
