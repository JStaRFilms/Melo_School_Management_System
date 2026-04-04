"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useMutation } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { humanNameFinal, humanNameTyping } from "@/human-name";
import { AdminSurface } from "@/components/ui/AdminSurface";

interface SessionCreationFormProps {
  onSuccess: (message: string) => void;
  onError: (title: string, message: string) => void;
}

export function SessionCreationForm({ onSuccess, onError }: SessionCreationFormProps) {
  const createSession = useMutation("functions/academic/academicSetup:createSession" as never);
  const [sessionName, setSessionName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activateSession, setActivateSession] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) {
      return Number.NaN;
    }
    return new Date(year, month - 1, day).getTime();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = humanNameFinal(sessionName);
    if (!normalizedName || !startDate || !endDate) return;

    const startTimestamp = parseLocalDate(startDate);
    const endTimestamp = parseLocalDate(endDate);
    if (Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)) {
      setError("Enter valid start and end dates.");
      return;
    }

    if (endTimestamp < startTimestamp) {
      setError("End date must not be before the start date.");
      return;
    }

    setError("");
    setIsSaving(true);
    try {
      await createSession({
        name: normalizedName,
        startDate: startTimestamp,
        endDate: endTimestamp,
        isActive: activateSession,
      } as never);
      setSessionName("");
      setStartDate("");
      setEndDate("");
      setActivateSession(true);
      onSuccess("New academic session created.");
    } catch (err) {
      onError("Creation Failed", getUserFacingErrorMessage(err, "Failed to create session"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminSurface intensity="medium" className="p-4 md:p-6 space-y-4">
      <div className="space-y-1">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
          New Session
        </h4>
        <p className="text-[10px] leading-relaxed font-medium text-slate-400">
          Register a new academic year.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
            Session Label
          </label>
          <input
            type="text"
            required
            value={sessionName}
            onChange={(e) => setSessionName(humanNameTyping(e.target.value))}
            onBlur={(e) => setSessionName(humanNameFinal(e.target.value))}
            placeholder="e.g., 2026/2027 Session"
            className="w-full rounded-xl border border-slate-200/60 bg-slate-50/50 px-4 py-2.5 text-sm font-medium transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
              Start
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => {
                setError("");
                setStartDate(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50/50 px-4 py-2.5 text-xs font-medium transition-all focus:border-indigo-500 focus:bg-white outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
              End
            </label>
            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => {
                setError("");
                setEndDate(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50/50 px-4 py-2.5 text-xs font-medium transition-all focus:border-indigo-500 focus:bg-white outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-500">
            {error}
          </p>
        )}

        <label className="flex items-center gap-2 group cursor-pointer">
          <div className="relative flex items-center justify-center w-4 h-4">
            <input
              type="checkbox"
              checked={activateSession}
              onChange={(e) => setActivateSession(e.target.checked)}
              className="peer appearance-none w-4 h-4 border border-slate-300 rounded transition-all checked:bg-indigo-600 checked:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
            Set as Active
          </span>
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Saving...
            </span>
          ) : (
            <>
              <CalendarDays className="h-3.5 w-3.5 opacity-60" />
              Save Session
            </>
          )}
        </button>
      </form>
    </AdminSurface>
  );
}
