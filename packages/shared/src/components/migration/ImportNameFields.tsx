import React, { useEffect, useState } from "react";
import { PersonNameFields, type PersonNameValue } from "../PersonNameFields";
import { normalizeStructuredPersonName } from "../../name-format";
import type { StagedStudentRow } from "./Tabs/RosterReviewTab";

export function ImportNameFields({ record, onPatchField }: { record: StagedStudentRow; onPatchField: (id: string, patch: Record<string, unknown>) => Promise<void> }) {
  const [value, setValue] = useState<PersonNameValue>({ firstName: "", middleName: "", lastName: "", fullName: "", structured: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue({ firstName: record.parsedData.firstName, middleName: record.parsedData.middleName ?? "", lastName: record.parsedData.lastName, fullName: record.parsedData.name ?? [record.parsedData.firstName, record.parsedData.middleName, record.parsedData.lastName].filter(Boolean).join(" "), structured: Boolean(record.parsedData.firstName && record.parsedData.lastName) }); }, [record._id, record.parsedData.firstName, record.parsedData.middleName, record.parsedData.lastName, record.parsedData.name]);
  const save = async () => {
    if (saving) return;
    const parts = normalizeStructuredPersonName(value);
    if (value.structured ? !parts.firstName || !parts.lastName : !value.fullName.trim()) return;
    setSaving(true);
    try { await onPatchField(record._id, value.structured ? { firstName: parts.firstName, middleName: parts.middleName ?? null, lastName: parts.lastName } : { name: value.fullName.trim(), firstName: "", middleName: null, lastName: "" }); }
    finally { setSaving(false); }
  };
  return <div className="min-w-[240px] space-y-2">
    <PersonNameFields value={value} onChange={setValue} allowFullName disabled={saving || record.reviewStatus === "approved"} inputClassName="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs" />
    <button type="button" disabled={saving || record.reviewStatus === "approved" || (value.structured ? !value.firstName.trim() || !value.lastName.trim() : !value.fullName.trim())} onClick={() => void save()} className="text-xs font-semibold">{saving ? "Saving name..." : "Save row name"}</button>
  </div>;
}
