"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface SheetBaseProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  icon?: ReactNode;
  footer?: ReactNode;
  dismissDisabled?: boolean;
  /** Exit-animation hold before unmount (admin 500, teacher 300). */
  exitMs?: number;
  /** Width cap, e.g. "sm:max-w-lg". */
  maxWidthClass?: string;
  /** State-dependent panel animation suffixes. */
  openPanelClass?: string;
  closedPanelClass?: string;
  /** Full chrome overrides; defaults reproduce the admin sheet. */
  frameClass?: string;
  overlayClass?: string;
  panelClass?: string;
  handleClass?: string;
  handleDotClass?: string;
  headerClass?: string;
  bodyClass?: string;
  footerClass?: string;
  titleClass?: string;
  descriptionClass?: string;
  titleBlockClass?: string;
  closeButtonClass?: string;
  closeIconClass?: string;
  closeLabel?: string;
  children: ReactNode;
}

const DEFAULT_FRAME_CLASS =
  "fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4 transition-all duration-500 ease-out";
const DEFAULT_OVERLAY_CLASS =
  "absolute inset-0 bg-slate-950/60 backdrop-blur-[4px] transition-opacity duration-500 ease-out";
const DEFAULT_PANEL_CLASS =
  "flex w-full flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-slate-950/10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] rounded-t-[2.5rem] sm:rounded-2xl";
const DEFAULT_HANDLE_CLASS = "flex justify-center py-4 sm:hidden";
const DEFAULT_HEADER_CLASS =
  "flex items-start justify-between px-6 pb-4 pt-2 sm:pt-6 border-b border-slate-50";
const DEFAULT_BODY_CLASS = "max-h-[80vh] overflow-y-auto px-6 pb-10 pt-4 sm:pb-8";
const DEFAULT_FOOTER_CLASS =
  "shrink-0 border-t border-slate-100 bg-slate-50/60 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4";
const DEFAULT_TITLE_CLASS =
  "font-display text-lg font-bold tracking-tight text-slate-950 uppercase";
const DEFAULT_DESCRIPTION_CLASS =
  "text-[11px] font-medium text-slate-400 uppercase tracking-wider";

/**
 * Shared sheet base (consolidation P18). Owns behavior only: portal mount,
 * SSR-safe mount guard, enter/exit animation, Escape-to-close, body scroll
 * lock, and focus trap. Chrome (rounding, widths, header/body classes) stays
 * with each app wrapper through className passthroughs.
 */
export function SheetBase({
  open,
  onClose,
  title,
  description,
  labelledBy,
  describedBy,
  icon,
  footer,
  dismissDisabled = false,
  exitMs = 300,
  maxWidthClass = "sm:max-w-lg",
  openPanelClass = "translate-y-0 opacity-100",
  closedPanelClass = "translate-y-full opacity-0 sm:translate-y-12 sm:scale-95",
  frameClass = DEFAULT_FRAME_CLASS,
  overlayClass = DEFAULT_OVERLAY_CLASS,
  panelClass = DEFAULT_PANEL_CLASS,
  handleClass = DEFAULT_HANDLE_CLASS,
  handleDotClass = "h-1.5 w-12 rounded-full bg-slate-200/60",
  headerClass = DEFAULT_HEADER_CLASS,
  bodyClass = DEFAULT_BODY_CLASS,
  footerClass = DEFAULT_FOOTER_CLASS,
  titleClass = DEFAULT_TITLE_CLASS,
  descriptionClass = DEFAULT_DESCRIPTION_CLASS,
  titleBlockClass = "min-w-0 space-y-1",
  closeButtonClass = "rounded-full p-2 hover:bg-slate-50 transition-colors disabled:opacity-50",
  closeIconClass = "h-5 w-5 text-slate-300",
  closeLabel = "Close sheet",
  children,
}: SheetBaseProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(open);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevOverflowRef = useRef("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const autoTitleId = useId();
  const autoDescriptionId = useId();
  const titleId = labelledBy ?? autoTitleId;
  const descriptionId = describedBy ?? (description ? autoDescriptionId : undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      prevOverflowRef.current = document.body.style.overflow;
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 20);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = prevOverflowRef.current;
      };
    }
    setIsAnimating(false);
    const timer = setTimeout(() => {
      setShouldRender(false);
      document.body.style.overflow = prevOverflowRef.current;
    }, exitMs);
    return () => clearTimeout(timer);
  }, [open, exitMs]);

  useEffect(() => {
    if (!shouldRender) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !dismissDisabled) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const outside = active === panelRef.current || !panelRef.current.contains(active);
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, shouldRender, dismissDisabled]);

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div
      className={`${frameClass} ${isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"}`}
    >
      <div
        className={`${overlayClass} ${isAnimating ? "opacity-100" : "opacity-0"}`}
        onClick={dismissDisabled ? undefined : onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={`relative ${panelClass} ${maxWidthClass} ${isAnimating ? openPanelClass : closedPanelClass}`}
      >
        <div className={handleClass} aria-hidden="true">
          <div className={handleDotClass} />
        </div>
        <div className={headerClass}>
          <div className="flex min-w-0 items-start gap-2.5">
            {icon}
            <div className={titleBlockClass}>
              <h2 id={titleId} className={titleClass}>
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className={descriptionClass}>
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={dismissDisabled}
            aria-label={closeLabel}
            className={closeButtonClass}
          >
            <X className={closeIconClass} />
          </button>
        </div>
        <div className={bodyClass}>
          {children}
        </div>
        {footer ? <div className={footerClass}>{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
