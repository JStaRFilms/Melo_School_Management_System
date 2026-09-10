import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Trash2,
  UserPlus,
  X,
  ShieldCheck,
} from "lucide-react";

export interface ImportConfirmationStat {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export interface ImportConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  badge?: string;
  description: string;
  stats?: ImportConfirmationStat[];
  infoNotice?: string;
  customDetails?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "warning" | "emerald";
  isLoading?: boolean;
}

export function ImportConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  badge,
  description,
  stats,
  infoNotice,
  customDetails,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  isLoading = false,
}: ImportConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, mounted]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (confirmVariant) {
      case "danger":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <Trash2 className="h-5 w-5" />
          </div>
        );
      case "warning":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
      case "emerald":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <UserPlus className="h-5 w-5" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmVariant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:ring-rose-500";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-xs focus-visible:ring-amber-500";
      case "emerald":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus-visible:ring-emerald-500";
      default:
        return "bg-slate-900 hover:bg-slate-800 text-white shadow-xs focus-visible:ring-slate-950";
    }
  };

  const getStatBadgeClass = (statVariant?: ImportConfirmationStat["variant"]) => {
    switch (statVariant) {
      case "success":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "warning":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "danger":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "info":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6 bg-slate-50/50">
          <div className="flex items-start gap-3.5">
            {getIcon()}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3
                  id={titleId}
                  className="text-base font-bold text-slate-900 leading-snug"
                >
                  {title}
                </h3>
              </div>
              {badge && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                  {badge}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40 cursor-pointer"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <p
            id={descriptionId}
            className="text-xs sm:text-sm text-slate-600 leading-relaxed"
          >
            {description}
          </p>

          {/* Stats / Parameters Grid */}
          {stats && stats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {stats.map((stat, idx) => (
                <div
                  key={stat.label || idx}
                  className={`p-2.5 rounded-xl border ${getStatBadgeClass(stat.variant)} space-y-0.5`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {stat.label}
                  </span>
                  <span className="block text-xs font-black truncate">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Custom Details (e.g. sequence change diffs) */}
          {customDetails && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
              {customDetails}
            </div>
          )}

          {/* Educational Reassurance / Info Notice */}
          {infoNotice && (
            <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3.5 flex items-start gap-2.5 text-xs text-indigo-900">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">{infoNotice}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-4 sm:px-6 bg-slate-50/40">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={isLoading}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer active:scale-95 text-center ${getConfirmButtonClasses()}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
