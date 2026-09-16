"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type SheetWidth = "md" | "lg" | "xl";

const widthClasses: Record<SheetWidth, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-3xl",
};

export function PlatformSheet({
  labelledBy,
  describedBy,
  title,
  subtitle,
  icon,
  onClose,
  dismissDisabled = false,
  children,
  footer,
  maxWidth = "md",
  closeLabel = "Close dialog",
}: {
  labelledBy: string;
  describedBy?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  dismissDisabled?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: SheetWidth;
  closeLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Slide-up enter animation.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true)),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  // Escape to close, Tab trap, and body scroll lock.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dismissDisabled) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside =
        active === panelRef.current || !panelRef.current?.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dismissDisabled, onClose]);

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={dismissDisabled ? undefined : onClose}
        className={`absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-300 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          tabIndex={-1}
          className={`pointer-events-auto flex max-h-[96dvh] w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-out rounded-t-3xl sm:rounded-2xl ${widthClasses[maxWidth]} ${
            visible
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-full sm:translate-y-4 sm:scale-95 sm:opacity-0"
          }`}
        >
          <div className="flex shrink-0 justify-center pt-3 sm:hidden" aria-hidden="true">
            <div className="h-1.5 w-12 rounded-full bg-slate-200" />
          </div>

          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon}
              <div className="min-w-0">
                <h2 id={labelledBy} className="truncate text-base font-bold text-slate-900">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={dismissDisabled}
              aria-label={closeLabel}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer ? (
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SheetFooterButtons({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      {children}
    </div>
  );
}

export const sheetPrimaryButton =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2.5";

export const sheetSecondaryButton =
  "inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:py-2.5";
