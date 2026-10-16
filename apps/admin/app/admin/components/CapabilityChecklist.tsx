"use client";

export function CapabilityChecklist({ catalog, selected, onChange, disabled = false, legend }: {
  catalog: string[]; selected: string[]; onChange: (caps: string[]) => void; disabled?: boolean; legend: string;
}) {
  const domains = [...new Set(catalog.map(c => c.split(".")[0]))];
  return <fieldset disabled={disabled} className="min-w-0">
    <legend className="mb-3 font-semibold">{legend} <span className="text-xs font-normal text-slate-500">{selected.length} selected</span></legend>
    <div className="grid gap-3 sm:grid-cols-2">{domains.map(domain => <details key={domain} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <summary className="min-h-11 cursor-pointer text-sm font-semibold capitalize">{domain} <span className="font-normal text-slate-500">{selected.filter(c => c.startsWith(`${domain}.`)).length} selected</span></summary>
      <div className="mt-3 space-y-3">{catalog.filter(c => c.startsWith(`${domain}.`)).map(cap => <label key={cap} className="flex min-h-11 items-start gap-2 text-xs">
        <input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={selected.includes(cap)} onChange={e => onChange(e.target.checked ? [...selected, cap] : selected.filter(c => c !== cap))} />
        <span className="min-w-0 break-words">{cap}</span>
      </label>)}</div>
    </details>)}</div>
  </fieldset>;
}
