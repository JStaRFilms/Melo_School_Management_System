"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CalendarDays,
  Check,
  Plus,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage, type ReportCardCalculationMode } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { humanNameFinal, humanNameTyping } from "@/human-name";

interface TermCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  sessionStartDate?: number;
  sessionEndDate?: number;
  existingTermCount?: number;
}

const TERM_PRESETS = [
  { name: "First Term", defaultMode: "standalone" as ReportCardCalculationMode },
  { name: "Second Term", defaultMode: "standalone" as ReportCardCalculationMode },
  { name: "Third Term", defaultMode: "cumulative_annual" as ReportCardCalculationMode },
];

export function TermCreationModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  sessionStartDate,
  sessionEndDate,
  existingTermCount = 0,
}: TermCreationModalProps) {
  const createTerm = useMutation("functions/academic/academicSetup:createTerm" as never);

  const initialPreset = TERM_PRESETS[Math.min(existingTermCount, 2)] ?? TERM_PRESETS[0];
  const [termName, setTermName] = useState(initialPreset.name);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activateTerm, setActivateTerm] = useState(existingTermCount === 0);
  const [resultCalculationMode, setResultCalculationMode] = useState<ReportCardCalculationMode>(
    initialPreset.defaultMode
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return Number.NaN;
    return new Date(year, month - 1, day).getTime();
  };

  const handleSelectPreset = (presetName: string, defaultMode: ReportCardCalculationMode) => {
    setTermName(presetName);
    setResultCalculationMode(defaultMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = humanNameFinal(termName);
    if (!sessionId || !normalizedName || !startDate || !endDate) return;

    const startTimestamp = parseLocalDate(startDate);
    const endTimestamp = parseLocalDate(endDate);
    if (Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)) {
      appToast.error("Invalid dates", { description: "Please enter valid start and end dates." });
      return;
    }

    if (endTimestamp < startTimestamp) {
      appToast.error("Invalid date range", { description: "End date must not be before start date." });
      return;
    }

    setIsSaving(true);
    try {
      await createTerm({
        sessionId,
        name: normalizedName,
        startDate: startTimestamp,
        endDate: endTimestamp,
        isActive: activateTerm,
        resultCalculationMode,
      } as never);
      appToast.success("Term created successfully", {
        description: `${normalizedName} added to ${sessionName}.`,
      });
      onClose();
    } catch (err) {
      appToast.error("Term creation failed", {
        description: getUserFacingErrorMessage(err, "Failed to create academic term"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-950">
                Add Academic Term
              </h3>
              <p className="text-xs text-slate-500">
                Creating term for <span className="font-semibold text-slate-700">{sessionName}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Term Presets */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block pl-0.5">
            Quick Term Presets
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TERM_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleSelectPreset(p.name, p.defaultMode)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  termName === p.name
                    ? "border-slate-900 bg-slate-900 text-white shadow-xs"
                    : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
              Term Title
            </label>
            <input
              type="text"
              required
              value={termName}
              onChange={(e) => setTermName(humanNameTyping(e.target.value))}
              onBlur={(e) => setTermName(humanNameFinal(e.target.value))}
              placeholder="e.g., First Term"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
                Term Start Date
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
                Term End Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
              Report Card Calculation Mode
            </label>
            <select
              value={resultCalculationMode}
              onChange={(e) =>
                setResultCalculationMode(e.target.value as ReportCardCalculationMode)
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-slate-900 focus:bg-white cursor-pointer"
            >
              <option value="standalone">Standalone Term (Default for Term 1 & Term 2)</option>
              <option value="cumulative_annual">
                Cumulative Annual Report (Combines all terms for final promotion)
              </option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={activateTerm}
              onChange={(e) => setActivateTerm(e.target.checked)}
              className="h-4 w-4 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="font-semibold text-slate-800">
              Set as the active term immediately
            </span>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Adding..." : "Add Term"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
