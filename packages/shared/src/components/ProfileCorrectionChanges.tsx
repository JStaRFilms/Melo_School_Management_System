import React from "react";
import { CORRECTION_FIELD_LABELS } from "../profile-corrections";

type Change = {
  target: "parent" | "parentAddress" | "child";
  field: keyof typeof CORRECTION_FIELD_LABELS | "name";
  before: string | number | null; after: string | number | null;
};
function displayValue(field: Change["field"], value: Change["before"]) {
  if (value === null) return "Not recorded";
  if (field === "dateOfBirth" && typeof value === "number") return new Date(value).toISOString().slice(0, 10);
  if (field === "address" && typeof value === "string") {
    try {
      const address: unknown = JSON.parse(value);
      if (address && typeof address === "object" && "mode" in address && "effective" in address) {
        const mode = address.mode === "residential" ? "Household inheritance" : address.mode === "different" ? "Personal override" : "Recorded address";
        return `${mode}: ${typeof address.effective === "string" ? address.effective : "Not recorded"}`;
      }
    } catch { /* Older evidence may contain a plain address. */ }
  }
  return String(value);
}
export function ProfileCorrectionChanges({ changes }: { changes: readonly Change[] }) {
  return <dl className="space-y-3">
    {changes.map((change, index) => <div key={index} className="border-b border-slate-200 pb-3 text-sm">
      <dt className="font-semibold">{change.target === "child" ? "Child" : "Your details"} · {change.field === "name" ? "Display name" : CORRECTION_FIELD_LABELS[change.field]}</dt>
      <dd className="mt-1 break-words"><span className="text-slate-500">Before: </span>{displayValue(change.field, change.before)}</dd>
      <dd className="break-words"><span className="text-slate-500">After: </span>{displayValue(change.field, change.after)}</dd>
    </div>)}
  </dl>;
}
