"use client";

import { useEffect, useId, useRef } from "react";
import { AdminSurface } from "./AdminSurface";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])"
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current || !focusable?.length) {
        return;
      }

      const focusables = Array.from(focusable).filter((element) => !element.hasAttribute("disabled"));
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[4px]"
      onMouseDown={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md"
      >
        <AdminSurface
          as="section"
          intensity="high"
          rounded="xl"
          className="relative z-[121] border-slate-950/10 p-5 shadow-2xl"
        >
          <div className="space-y-2">
            <h2 id={titleId} className="font-display text-base font-bold tracking-tight text-slate-950">
              {title}
            </h2>
            <p id={descriptionId} className="text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-rose-700"
            >
              {confirmLabel}
            </button>
          </div>
        </AdminSurface>
      </div>
    </div>
  );
}
