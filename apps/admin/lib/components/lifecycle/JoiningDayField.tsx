"use client";

import { lifecycleInput } from "./LifecycleContextFields";

export function JoiningDayField({ value, onChange, label = "Joining day", disabled = false }: { value: string; onChange: (day: string) => void; label?: string; disabled?: boolean }) {
  return <label className="block text-sm">{label} correction, optional<input type="date" className={lifecycleInput} max={new Date().toISOString().slice(0, 10)} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} /><span className="mt-1 block text-xs text-slate-600">Leave blank for server UTC today. The current configured session, term and timestamp are recorded automatically at save. This is not imported history.</span></label>;
}
