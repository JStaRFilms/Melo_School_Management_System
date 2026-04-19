"use client";

import { useState } from "react";
import type { ReportCardCalculationMode } from "@school/shared";
import { Hash } from "lucide-react";
import { useMutation } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { humanNameFinal, humanNameTyping } from "@/human-name";
import { AdminSurface } from "@/components/ui/AdminSurface";

interface TermCreationFormProps {
  selectedSessionId: string | null;
  selectedSessionName: string | null;
  onSuccess: (message: string) => void;
  onError: (title: string, message: string) => void;
}

export function TermCreationForm({
  selectedSessionId,
  selectedSessionName,
  onSuccess,
  onError,
}: TermCreationFormProps) {
  const createTerm = useMutation("functions/academic/academicSetup:createTerm" as never);
  const [termName, setTermName] = useState("First Term");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activateTerm, setActivateTerm] = useState(true);
  const [resultCalculationMode, setResultCalculationMode] =
    useState<ReportCardCalculationMode>("standalone");
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
    const normalizedName = humanNameFinal(termName);
    if (!selectedSessionId || !normalizedName || !startDate || !endDate) return;

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
      await createTerm({
        sessionId: selectedSessionId,
        name: normalizedName,
        startDate: startTimestamp,
        endDate: endTimestamp,
        isActive: activateTerm,
        resultCalculationMode,
      } as never);
      setTermName("First Term");
      setStartDate("");
      setEndDate("");
      setActivateTerm(true);
      setResultCalculationMode("standalone");
      onSuccess("Academic term added successfully.");
    } catch (err) {
      onError("Term Creation Failed", getUserFacingErrorMessage(err, "Failed to create term"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminSurface intensity="low" className="p-4 md:p-6 space-y-4">
      <div className="space-y-1">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
          New Term
        </h4>
        <p className="mt-1 text-[10px] leading-relaxed font-medium text-slate-400">
          Define a term for {selectedSessionName ?? "the active session"}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
            Term Name
          </label>
          <input
            type="text"
            required
            value={termName}
            onChange={(e) => setTermName(humanNameTyping(e.target.value))}
            onBlur={(e) => setTermName(humanNameFinal(e.target.value))}
            placeholder="e.g., First Term"
            className="w-full rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">
            Report Card Mode
          </label>
          <select
            value={resultCalculationMode}
            onChange={(e) => setResultCalculationMode(e.target.value as ReportCardCalculationMode)}
            className="w-full rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-medium transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none"
          >
            <option value="standalone">Standalone term report</option>
            <option value="cumulative_annual">Cumulative annual report</option>
          </select>
          <p className="px-1 text-[10px] leading-relaxed font-medium text-slate-400">
            Choose how this term should render on report cards. In most schools, first and second term stay standalone, while third term is set to cumulative annual.
          </p>
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
              className="w-full rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-xs font-medium transition-all focus:border-indigo-500 outline-none"
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
              className="w-full rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-xs font-medium transition-all focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-rose-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSaving || !selectedSessionId}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              Saving...
            </span>
          ) : (
            <>
              <Hash className="h-3.5 w-3.5 opacity-60" />
              Add Term
            </>
          )}
        </button>
      </form>
    </AdminSurface>
  );
}
