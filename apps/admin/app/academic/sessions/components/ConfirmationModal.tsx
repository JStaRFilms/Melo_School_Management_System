"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "emerald";
  isLoading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const getButtonStyles = () => {
    switch (confirmVariant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white";
      case "emerald":
        return "bg-emerald-600 hover:bg-emerald-700 text-white";
      default:
        return "bg-slate-900 hover:bg-slate-800 text-white";
    }
  };

  const getIcon = () => {
    switch (confirmVariant) {
      case "danger":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="h-5 w-5" />
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          {getIcon()}
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-slate-950 leading-snug">
              {title}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={`rounded-xl px-5 py-2 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 ${getButtonStyles()}`}
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
