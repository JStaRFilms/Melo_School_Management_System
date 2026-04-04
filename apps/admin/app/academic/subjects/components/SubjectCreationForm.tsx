"use client";

import { useState } from "react";
import { Plus, BookOpenText } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTyping, humanNameFinal } from "@/human-name";

interface SubjectCreationFormProps {
  onCreate: (name: string, code: string) => Promise<void>;
  isSubmitting: boolean;
}

export function SubjectCreationForm({ onCreate, isSubmitting }: SubjectCreationFormProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    
    try {
      await onCreate(name, code);
      setName("");
      setCode("");
    } catch (err) {
      console.error("SubjectCreationForm:onCreate error", err);
    }
  };

  return (
    <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
      <div className="space-y-0.5">
        <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">Add Subject</h4>
        <p className="text-[11px] font-medium text-slate-400">Expand the academic catalog with a new subject.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Subject Name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(humanNameTyping(e.target.value))}
            onBlur={(e) => setName(humanNameFinal(e.target.value))}
            placeholder="Mathematics"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <FormField label="Subject Code">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="MAT"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold uppercase text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <button
          type="submit"
          disabled={isSubmitting || !name.trim() || !code.trim()}
          className="mt-2 w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5" />
          {isSubmitting ? "Adding..." : "Add Subject"}
        </button>
      </form>
    </AdminSurface>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
