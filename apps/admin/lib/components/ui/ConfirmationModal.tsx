"use client";

import { AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger" | "emerald" | "warning";
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
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, mounted]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const isFocusOutsideDialog =
        activeElement === dialogRef.current ||
        !dialogRef.current?.contains(activeElement);

      if (event.shiftKey && (activeElement === firstElement || isFocusOutsideDialog)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || isFocusOutsideDialog)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, isOpen, mounted, onClose]);

  if (!isOpen || !mounted) return null;

  const getButtonStyles = () => {
    switch (confirmVariant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-xs";
      case "emerald":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-xs";
      default:
        return "bg-brand-primary hover:opacity-90 text-white shadow-xs";
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
      case "warning":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
            <AlertTriangle className="h-5 w-5" />
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
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
        className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div aria-hidden="true">{getIcon()}</div>
          <div className="space-y-1 min-w-0 flex-1">
            <h3 id={titleId} className="font-display text-sm sm:text-base font-bold text-slate-950 leading-snug">
              {title}
            </h3>
            <p id={descriptionId} className="text-xs text-slate-500 leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-2 border-t border-slate-100">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 sm:py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 text-center ${getButtonStyles()}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
