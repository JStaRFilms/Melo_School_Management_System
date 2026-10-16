"use client";

export const lifecycleInput = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-school-primary";
export const lifecycleButton = "min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function LifecycleContextFields({ sessionName, termName, reason, onReasonChange, correction, onCorrectionChange, effectiveDay, onDayChange, disabled = false }: {
  sessionName?: string; termName?: string; reason: string; onReasonChange: (value: string) => void;
  correction: boolean; onCorrectionChange: (value: boolean) => void;
  effectiveDay: string; onDayChange: (value: string) => void; disabled?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return <fieldset disabled={disabled} className="space-y-3 text-sm">
    <legend className="font-semibold">Action context</legend>
    <dl className="space-y-1">
      <div><dt className="inline font-medium">Effective day: </dt><dd className="inline">{correction ? effectiveDay || "Choose a day" : `${today} • server UTC today at save`}</dd></div>
      <div><dt className="inline font-medium">Current session: </dt><dd className="inline">{sessionName ?? "Not configured"}</dd></div>
      <div><dt className="inline font-medium">Current term: </dt><dd className="inline">{termName ?? "Not configured"}</dd></div>
    </dl>
    <p className="text-xs text-slate-600">The server records the timestamp at save. Changes take effect immediately, even for a corrected past date. No scheduling.</p>
    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={correction} onChange={e => onCorrectionChange(e.target.checked)} />Correct effective date</label>
    {correction && <label className="block">Corrected effective day<input type="date" className={lifecycleInput} max={today} value={effectiveDay} onChange={e => onDayChange(e.target.value)} /></label>}
    <label className="block">Reason<textarea className={lifecycleInput} maxLength={500} value={reason} onChange={e => onReasonChange(e.target.value)} /></label>
  </fieldset>;
}

export function validLifecycleDay(correction: boolean, day: string) {
  if (!correction) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day && day <= new Date().toISOString().slice(0, 10);
}
