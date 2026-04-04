"use client";

import { useEffect, useState } from "react";
import { Save, Archive, X, Info } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTyping, humanNameFinal } from "@/human-name";
import type { SubjectRecord } from "@/types";

interface SubjectEditFormProps {
  subject: SubjectRecord;
  onUpdate: (id: string, name: string, code: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  variant?: "default" | "sheet";
}

export function SubjectEditForm({
  subject,
  onUpdate,
  onArchive,
  onClose,
  isSaving,
  variant = "default",
}: SubjectEditFormProps) {
  const [editName, setEditName] = useState(subject.name);
  const [editCode, setEditCode] = useState(subject.code);

  useEffect(() => {
    setEditName(subject.name);
    setEditCode(subject.code);
  }, [subject]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editCode.trim()) return;
    await onUpdate(subject._id, editName, editCode);
  };

  const formContent = (
    <div className="space-y-4">
      {variant === "default" && (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">Edit Subject</h4>
            <p className="text-[11px] font-medium text-slate-400">Modify subject details or archive the record.</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Subject Name" id="subject-name">
          <input
            id="subject-name"
            type="text"
            required
            value={editName}
            onChange={(e) => setEditName(humanNameTyping(e.target.value))}
            onBlur={(e) => setEditName(humanNameFinal(e.target.value))}
            placeholder="Mathematics"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-bold text-slate-950 outline-none transition-all focus:bg-white focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <FormField label="Subject Code">
          <input
            type="text"
            required
            value={editCode}
            onChange={(e) => setEditCode(e.target.value.toUpperCase())}
            placeholder="MAT"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 text-sm font-bold uppercase text-slate-950 outline-none transition-all focus:bg-white focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <button
          type="submit"
          disabled={isSaving || !editName.trim() || !editCode.trim()}
          className="mt-2 w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </form>

      <div className="pt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onArchive(subject._id)}
          disabled={isSaving}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-100 bg-white text-[11px] font-bold uppercase tracking-widest text-rose-500 transition-all hover:bg-rose-50 disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" />
          Archive Subject
        </button>
        
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-slate-50 border border-slate-100">
           <Info className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
           <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
             Archived subjects are hidden from active enrollment.
           </p>
        </div>
      </div>
    </div>
  );

  if (variant === "sheet") {
    return formContent;
  }

  return (
    <AdminSurface intensity="high" rounded="lg" className="p-4 shadow-xl border-slate-950/10">
      {formContent}
    </AdminSurface>
  );
}

function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
