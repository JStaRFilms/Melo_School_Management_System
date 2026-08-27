"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Pencil,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";

export type TermRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  reportCardCalculationMode: "standalone" | "cumulative_annual";
  createdAt?: number;
  updatedAt: number;
};

interface TermCardProps {
  term: TermRecord;
  sessionName: string;
}

function formatDateInput(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatDateRange(start: number, end: number) {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  const endStr = e.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function TermCard({ term, sessionName }: TermCardProps) {
  const updateTermCalculationMode = useMutation(
    "functions/academic/academicSetup:updateTermCalculationMode" as never
  );
  const updateTermDates = useMutation(
    "functions/academic/academicSetup:updateTermDates" as never
  );
  const activateTerm = useMutation(
    "functions/academic/academicSetup:activateTerm" as never
  );

  const [isSavingMode, setIsSavingMode] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const [startDate, setStartDate] = useState(() => formatDateInput(term.startDate));
  const [endDate, setEndDate] = useState(() => formatDateInput(term.endDate));

  const handleModeChange = async (nextMode: "standalone" | "cumulative_annual") => {
    if (nextMode === term.reportCardCalculationMode) return;

    setIsSavingMode(true);
    try {
      await updateTermCalculationMode({
        termId: term._id,
        resultCalculationMode: nextMode,
      } as never);
      appToast.success("Calculation mode updated", {
        description: `${term.name} is now in ${nextMode === "standalone" ? "Standalone Term" : "Cumulative Annual"} mode.`,
      });
    } catch (error) {
      appToast.error("Mode update failed", {
        description: getUserFacingErrorMessage(error, "Unable to update report-card mode"),
      });
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleActivate = async () => {
    if (
      !window.confirm(
        `Make ${term.name} the active term for ${sessionName}?\n\nThe currently active term will be deactivated, but all student scores and attendance records will remain intact.`
      )
    ) {
      return;
    }

    setIsActivating(true);
    try {
      await activateTerm({ termId: term._id } as never);
      appToast.success("Term activated", {
        description: `${term.name} is now the active academic term.`,
      });
    } catch (error) {
      appToast.error("Activation failed", {
        description: getUserFacingErrorMessage(error, "Unable to activate term"),
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handleSaveDates = async () => {
    const nextStartDate = parseLocalDate(startDate);
    const nextEndDate = parseLocalDate(endDate);
    if (!Number.isFinite(nextStartDate) || !Number.isFinite(nextEndDate)) {
      appToast.error("Invalid dates", { description: "Enter valid start and end dates." });
      return;
    }

    if (nextEndDate < nextStartDate) {
      appToast.error("Invalid date range", { description: "End date must be after the start date." });
      return;
    }

    const confirmed = window.confirm(
      `Change ${term.name} dates?\n\nOld: ${formatDateRange(term.startDate, term.endDate)}\nNew: ${formatDateRange(nextStartDate, nextEndDate)}\n\nThis change will be recorded in the academic timeline audit log.`
    );
    if (!confirmed) return;

    setIsSavingDates(true);
    try {
      await updateTermDates({
        termId: term._id,
        startDate: nextStartDate,
        endDate: nextEndDate,
        expectedUpdatedAt: term.updatedAt,
      } as never);
      setIsEditingDates(false);
      appToast.success("Term dates updated", {
        description: "The date modification was recorded in the audit trail.",
      });
    } catch (error) {
      appToast.error("Date update failed", {
        description: getUserFacingErrorMessage(error, "Unable to update term dates"),
      });
    } finally {
      setIsSavingDates(false);
    }
  };

  const cancelDateEditing = () => {
    setStartDate(formatDateInput(term.startDate));
    setEndDate(formatDateInput(term.endDate));
    setIsEditingDates(false);
  };

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
        term.isActive
          ? "border-indigo-300/80 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20"
          : "border-slate-200/80 bg-white hover:border-slate-300"
      }`}
    >
      <div className="space-y-3">
        {/* Header: Term Name & Status Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="font-display text-sm font-bold text-slate-950 truncate">
              {term.name}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {term.isActive ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Active
              </span>
            ) : (
              <button
                type="button"
                onClick={handleActivate}
                disabled={isActivating}
                className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-800 hover:bg-emerald-100 transition cursor-pointer disabled:opacity-50"
              >
                {isActivating ? "Activating..." : "Make Active"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEditingDates(!isEditingDates)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition cursor-pointer"
              title="Edit term dates"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Date Range Display or Inline Editor */}
        {!isEditingDates ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold truncate">
              {formatDateRange(term.startDate, term.endDate)}
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2 animate-in fade-in duration-150">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-800">
              Audit-Logged Date Modification
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                  Start
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">
                  End
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={cancelDateEditing}
                disabled={isSavingDates}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDates}
                disabled={isSavingDates}
                className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3 w-3" /> {isSavingDates ? "Saving..." : "Save Dates"}
              </button>
            </div>
          </div>
        )}

        {/* Report Card Calculation Mode */}
        <div className="space-y-1 pt-1">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block pl-0.5">
            Report Card Mode
          </label>
          <select
            value={term.reportCardCalculationMode}
            onChange={(e) =>
              void handleModeChange(
                e.target.value as "standalone" | "cumulative_annual"
              )
            }
            disabled={isSavingMode}
            className="w-full rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-indigo-500 disabled:opacity-60 cursor-pointer"
          >
            <option value="standalone">Standalone term report</option>
            <option value="cumulative_annual">Cumulative annual report</option>
          </select>
          <p className="text-[10px] text-slate-400 pl-0.5 leading-snug">
            {term.reportCardCalculationMode === "cumulative_annual"
              ? "Combines scores from all prior terms for the final yearly grade."
              : "Calculates scores solely from this term's assessments."}
          </p>
        </div>
      </div>
    </div>
  );
}
