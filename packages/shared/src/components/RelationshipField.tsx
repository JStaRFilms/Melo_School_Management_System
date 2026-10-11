"use client";

import { useId, useState } from "react";
import { PARENT_GUARDIAN_RELATIONSHIPS } from "../name-format";

export function RelationshipField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const known = PARENT_GUARDIAN_RELATIONSHIPS.some(option => option === value);
  const isCustom = custom || Boolean(value && !known);
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-semibold text-slate-600">Relationship</label>
    <select id={id} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={isCustom ? "custom" : value} onChange={event => {
      setCustom(event.target.value === "custom");
      onChange(event.target.value === "custom" ? "" : event.target.value);
    }}>
      <option value="">Unspecified</option>
      {PARENT_GUARDIAN_RELATIONSHIPS.map(option => <option key={option} value={option}>{option}</option>)}
      <option value="custom">Custom relationship</option>
    </select>
    {isCustom && <label className="block text-xs font-semibold text-slate-600">Custom relationship
      <input className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" value={value} onChange={event => onChange(event.target.value)} />
    </label>}
  </div>;
}
