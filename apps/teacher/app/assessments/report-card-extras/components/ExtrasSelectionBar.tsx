"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ExtrasSelection, SelectorOption } from "./types";

export function ExtrasSelectionBar({
  selection,
  sessions,
  terms,
  classes,
  students,
  isLoadingSessions,
  isLoadingTerms,
  isLoadingClasses,
  isLoadingStudents,
}: {
  selection: ExtrasSelection;
  sessions: SelectorOption[];
  terms: SelectorOption[];
  classes: SelectorOption[];
  students: SelectorOption[];
  isLoadingSessions?: boolean;
  isLoadingTerms?: boolean;
  isLoadingClasses?: boolean;
  isLoadingStudents?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSelection = useCallback(
    (key: keyof ExtrasSelection, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);

      if (key === "sessionId") {
        params.delete("termId");
        params.delete("classId");
        params.delete("studentId");
      } else if (key === "termId") {
        params.delete("classId");
        params.delete("studentId");
      } else if (key === "classId") {
        params.delete("studentId");
      }

      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  const baseSelectClassName =
    "h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SelectField label="Session" value={selection.sessionId ?? ""} onChange={(value) => updateSelection("sessionId", value || null)} disabled={isLoadingSessions} className={baseSelectClassName} placeholder={isLoadingSessions ? "Loading sessions..." : "Select session"} options={sessions} />
        <SelectField label="Term" value={selection.termId ?? ""} onChange={(value) => updateSelection("termId", value || null)} disabled={!selection.sessionId || isLoadingTerms} className={baseSelectClassName} placeholder={!selection.sessionId ? "Select session first" : isLoadingTerms ? "Loading terms..." : "Select term"} options={terms} />
        <SelectField label="Class" value={selection.classId ?? ""} onChange={(value) => updateSelection("classId", value || null)} disabled={!selection.termId || isLoadingClasses} className={baseSelectClassName} placeholder={!selection.termId ? "Select term first" : isLoadingClasses ? "Loading classes..." : "Select class"} options={classes} />
        <SelectField label="Student" value={selection.studentId ?? ""} onChange={(value) => updateSelection("studentId", value || null)} disabled={!selection.classId || isLoadingStudents} className={baseSelectClassName} placeholder={!selection.classId ? "Select class first" : isLoadingStudents ? "Loading students..." : "Select student"} options={students} />
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, disabled, className, placeholder, options }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; className: string; placeholder: string; options: SelectorOption[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={className}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
