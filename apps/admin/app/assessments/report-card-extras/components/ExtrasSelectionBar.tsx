"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { ExtrasSelection, SelectorOption } from "./types";
import {
  CalendarDays,
  Target,
  Users,
  User,
} from "lucide-react";

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
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

  return (
    <AdminSurface intensity="low" className="p-4 space-y-4">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        Selection Context
      </h4>
      
      <div className="grid gap-4">
        <SelectField 
          label="Session" 
          icon={<CalendarDays size={14} />}
          value={selection.sessionId ?? ""} 
          onChange={(value) => updateSelection("sessionId", value || null)} 
          disabled={isLoadingSessions} 
          className={baseSelectClassName} 
          placeholder={isLoadingSessions ? "Loading..." : "Select Session"} 
          options={sessions} 
        />
        <SelectField 
          label="Term" 
          icon={<Target size={14} />}
          value={selection.termId ?? ""} 
          onChange={(value) => updateSelection("termId", value || null)} 
          disabled={!selection.sessionId || isLoadingTerms} 
          className={baseSelectClassName} 
          placeholder={!selection.sessionId ? "Select Session First" : isLoadingTerms ? "Loading..." : "Select Term"} 
          options={terms} 
        />
        <SelectField 
          label="Class" 
          icon={<Users size={14} />}
          value={selection.classId ?? ""} 
          onChange={(value) => updateSelection("classId", value || null)} 
          disabled={!selection.termId || isLoadingClasses} 
          className={baseSelectClassName} 
          placeholder={!selection.termId ? "Select Term First" : isLoadingClasses ? "Loading..." : "Select Class"} 
          options={classes} 
        />
        <SelectField 
          label="Student" 
          icon={<User size={14} />}
          value={selection.studentId ?? ""} 
          onChange={(value) => updateSelection("studentId", value || null)} 
          disabled={!selection.classId || isLoadingStudents} 
          className={baseSelectClassName} 
          placeholder={!selection.classId ? "Select Class First" : isLoadingStudents ? "Loading..." : "Select Student"} 
          options={students} 
        />
      </div>
    </AdminSurface>
  );
}

function SelectField({ 
  label, 
  icon,
  value, 
  onChange, 
  disabled, 
  className, 
  placeholder, 
  options 
}: { 
  label: string; 
  icon?: React.ReactNode;
  value: string; 
  onChange: (value: string) => void; 
  disabled?: boolean; 
  className: string; 
  placeholder: string; 
  options: SelectorOption[] 
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        {icon && <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors">{icon}</span>}
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
      </div>
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
