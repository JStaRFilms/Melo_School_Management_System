"use client";

import { useState, type FormEvent } from "react";
import { useAction } from "convex/react";
import { Crown, Loader2, UserPlus } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";
import { AdminSurface } from "@/components/ui/AdminSurface";

interface AdminCreationFormProps {
  onSuccess: (message: string) => void;
  onError: (title: string, message: string) => void;
}

export function AdminCreationForm({ onSuccess, onError }: AdminCreationFormProps) {
  const createSchoolAdmin = useAction(
    "functions/academic/adminLeadership:createSchoolAdmin" as never
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const submitCreateAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = humanNameFinalStrict(name);
    const normalizedEmail = email.trim().toLowerCase();
    const password = temporaryPassword.trim();
    if (!normalizedName || !normalizedEmail || !password) {
      return;
    }

    setIsBusy(true);

    try {
      const created = (await createSchoolAdmin({
        name: normalizedName,
        email: normalizedEmail,
        temporaryPassword: password,
        origin: window.location.origin,
      } as never)) as { email: string; temporaryPassword: string };

      setName("");
      setEmail("");
      setTemporaryPassword("");
      onSuccess(`${created.email} can sign in with the temporary password now.`);
    } catch (error) {
      onError("Admin not created", getUserFacingErrorMessage(error, "Failed to create admin"));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AdminSurface intensity="low" rounded="lg" className="p-4 ring-1 ring-slate-950/5">
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-950/5 pb-2.5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-950">
            Create Admin
          </h2>
        </div>
        <div className="rounded-lg bg-white p-1.5 text-slate-400 shadow-sm ring-1 ring-slate-950/5">
          <UserPlus className="h-3.5 w-3.5" />
        </div>
      </div>

      <form onSubmit={submitCreateAdmin} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 pl-1">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(humanNameTypingStrict(e.target.value))}
              onBlur={(e) => setName(humanNameFinalStrict(e.target.value))}
              placeholder="e.g. Grace Okafor"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 pl-1">
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school.edu"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 pl-1">
            Temporary Password
          </label>
          <input
            type="password"
            value={temporaryPassword}
            onChange={(e) => setTemporaryPassword(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white/50 px-3 font-mono text-xs font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:bg-white"
          />
        </div>

        <button
          type="submit"
          disabled={!name.trim() || !email.trim() || !temporaryPassword.trim() || isBusy}
          className="group relative inline-flex h-9 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-slate-950 px-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-900 hover:shadow-xl hover:shadow-slate-950/20 disabled:opacity-50"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crown className="h-3.5 w-3.5 opacity-60 transition-opacity" />
          )}
          {isBusy ? "Processing..." : "Authorize Role"}
        </button>
      </form>
    </AdminSurface>
  );
}
