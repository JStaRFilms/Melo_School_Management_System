"use client";

import { useEffect, useState } from "react";
import { Send, KeyRound, Archive, X } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTypingStrict, humanNameFinalStrict } from "@/human-name";

type TeacherRecord = {
  _id: string;
  name: string;
  email: string;
};

interface TeacherEditFormProps {
  teacher: TeacherRecord;
  onUpdate: (id: string, name: string, email: string) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  isResetting: boolean;
}

export function TeacherEditForm({
  teacher,
  onUpdate,
  onResetPassword,
  onArchive,
  onClose,
  isSaving,
  isResetting,
}: TeacherEditFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [resetPass, setResetPass] = useState("Teacher123!Pass");

  useEffect(() => {
    setName(teacher.name);
    setEmail(teacher.email);
  }, [teacher]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    await onUpdate(teacher._id, name, email);
  };

  return (
    <div className="space-y-4">
      <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4 border-slate-950/10 ring-1 ring-slate-950/5 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-[9px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">Manage Identity</h4>
            <p className="text-[10px] font-medium text-slate-400">Update faculty credentials.</p>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3 w-3 opacity-30" />
          </button>
        </div>

        <form onSubmit={handleUpdate} className="space-y-3">
          <FormField label="Full Name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(humanNameTypingStrict(e.target.value))}
              onBlur={(e) => setName(humanNameFinalStrict(e.target.value))}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            />
          </FormField>

          <FormField label="Email Address">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            />
          </FormField>

          <button
            type="submit"
            disabled={isSaving || !name || !email}
            className="mt-2 w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
          >
            <Send className="h-3 w-3" />
            {isSaving ? "Saving..." : "Update Teacher"}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 space-y-3">
          <FormField label="Reset Password">
            <div className="flex gap-2">
              <input
                type="text"
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
              />
              <button
                type="button"
                onClick={() => onResetPassword(teacher._id, resetPass)}
                disabled={isResetting || !resetPass}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:opacity-50 active:scale-90"
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </div>
          </FormField>

          <div className="flex justify-between items-center pt-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.1em]">Danger Zone</span>
              <p className="text-[11px] text-slate-400 font-medium">Deactivate active access.</p>
            </div>
            <button
              type="button"
              onClick={() => onArchive(teacher._id)}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <Archive className="h-3 w-3" />
              Archive
            </button>
          </div>
        </div>
      </AdminSurface>
    </div>
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
