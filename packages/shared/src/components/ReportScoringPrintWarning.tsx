"use client";

import { useEffect, useRef } from "react";

/** Warning stays outside the printed report; the issued payload is not modified. */
export function ReportScoringPrintWarning({ message, onContinue, onCancel }: {
  message: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => previous?.focus();
  }, []);
  return <div role="dialog" aria-modal="true" aria-labelledby="scoring-print-title" onKeyDown={event => {
    if (event.key === "Escape") onCancel();
    if (event.key === "Tab") {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
    }
  }} className="rc-no-print fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
      <h2 id="scoring-print-title" className="text-lg font-bold text-slate-900">Issued report may be out of date</h2>
      <p className="text-sm text-slate-700">{message}</p>
      <p className="text-sm text-slate-700">Printing uses the unchanged issued copy. Ask an administrator to review it. Replacement certification is currently unavailable. Printing does not recertify it.</p>
      <div className="flex flex-wrap gap-3">
        <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">Cancel print</button>
        <button type="button" onClick={onContinue} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Print issued copy anyway</button>
      </div>
    </div>
  </div>;
}
