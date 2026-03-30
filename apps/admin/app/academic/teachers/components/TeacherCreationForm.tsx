"use client";

import { useState } from "react";
import { UserPlus, Send, Copy, Check } from "lucide-react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { humanNameTypingStrict, humanNameFinalStrict } from "@/human-name";

interface ProvisionResult {
  teacherId: string;
  email: string;
  temporaryPassword: string;
}

interface TeacherCreationFormProps {
  onProvision: (name: string, email: string, password: string) => Promise<ProvisionResult>;
  isSubmitting: boolean;
}

export function TeacherCreationForm({ onProvision, isSubmitting }: TeacherCreationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("Teacher123!Pass");
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setTemporaryPassword("Teacher123!Pass");
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !temporaryPassword) return;
    
    const res = await onProvision(name, email, temporaryPassword);
    if (res) {
      setResult(res);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `Email: ${result.email}\nTemp Password: ${result.temporaryPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <AdminSurface intensity="high" rounded="lg" className="p-4 space-y-4 shadow-xl border-emerald-500/20 bg-emerald-50/10">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em]">
            Identity Provisioned
          </p>
          <h4 className="text-sm font-bold text-slate-950 font-display">
            Created: {result.email}
          </h4>
        </div>
        
        <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Temporary Password</span>
            <span className="text-xs font-black text-slate-950">{result.temporaryPassword}</span>
          </div>
          <button 
            onClick={copyToClipboard}
            className="w-full flex h-8 items-center justify-center gap-2 rounded-md bg-emerald-600 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 active:scale-95"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy Credentials"}
          </button>
        </div>

        <button 
          onClick={resetForm}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Provision Another
        </button>
      </AdminSurface>
    );
  }

  return (
    <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
      <div className="space-y-0.5">
        <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">Add Teacher</h4>
        <p className="text-[11px] font-medium text-slate-400">Instantly create a new teacher account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Name">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(humanNameTypingStrict(e.target.value))}
            onBlur={(e) => setName(humanNameFinalStrict(e.target.value))}
            placeholder="Adebayo Ogunlesi"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <FormField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.edu"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <FormField label="Temporary Password">
          <input
            type="text"
            required
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        <button
          type="submit"
          disabled={isSubmitting || !name || !email}
          className="mt-2 w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
        >
          <Send className="h-3.5 w-3.5" />
          {isSubmitting ? "Creating..." : "Create Teacher Account"}
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
