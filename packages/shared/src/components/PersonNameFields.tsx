"use client";

import { normalizeStructuredPersonName } from "../name-format";

export type PersonNameValue = { firstName: string; middleName: string; lastName: string; fullName: string; structured: boolean };
export const emptyPersonName: PersonNameValue = { firstName: "", middleName: "", lastName: "", fullName: "", structured: true };

export function PersonNameFields({ value, onChange, allowFullName = false, disabled = false, inputClassName = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900" }: {
  value: PersonNameValue; onChange: (value: PersonNameValue) => void; allowFullName?: boolean; disabled?: boolean; inputClassName?: string;
}) {
  const normalize = () => {
    const name = normalizeStructuredPersonName(value);
    onChange({ ...value, firstName: name.firstName ?? "", middleName: name.middleName ?? "", lastName: name.lastName ?? "" });
  };
  return <div className="space-y-2">
    {value.structured ? <>
      {allowFullName && value.fullName && <p className="text-xs">Recorded name: {value.fullName}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([['firstName', 'First name'], ['middleName', 'Middle name (optional)'], ['lastName', 'Last name']] as const).map(([key, label]) => <label className="block text-xs font-semibold" key={key}>{label}
          <input disabled={disabled} required={key !== "middleName"} value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })} onBlur={normalize} className={inputClassName} />
        </label>)}
      </div>
      {allowFullName && <button disabled={disabled} type="button" onClick={() => onChange({ ...value, structured: false, fullName: [value.firstName, value.middleName, value.lastName].filter(Boolean).join(" ") || value.fullName })}>Use full name</button>}
    </> : <>
      <label className="block text-xs font-semibold">Full name<input disabled={disabled} required className={inputClassName} value={value.fullName} onChange={event => onChange({ ...value, fullName: event.target.value })} /></label>
      <button disabled={disabled} type="button" onClick={() => onChange({ ...value, structured: true })}>Enter name parts</button>
    </>}
  </div>;
}
