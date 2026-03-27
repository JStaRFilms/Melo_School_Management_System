"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

interface MobileSheetProps {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSheet({
  isOpen,
  title,
  description,
  onClose,
  children,
}: MobileSheetProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45"
        aria-label={`Close ${title}`}
      />
      <section className="absolute inset-x-0 bottom-0 top-[8vh] overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 bg-white px-4 pb-4 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Admin Tool
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">
                  {title}
                </h2>
                {description ? (
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500"
                aria-label={`Close ${title}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-slate-50/60 p-4">
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}
