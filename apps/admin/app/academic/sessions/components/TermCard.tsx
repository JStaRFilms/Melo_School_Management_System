"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { ConfirmationModal } from "./ConfirmationModal";

export type TermRecord = {
  _id: string;
  sessionId: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  reportCardCalculationMode: "standalone" | "cumulative_annual";
  updatedAt?: number;
};

interface TermCardProps {
  term: TermRecord;
  sessionName: string;
}

function formatDateInput(timestamp: number) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(start: number, end: number) {
  const s = new Date(start);
  const e = new Date(end);
  const startStr = s.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  const endStr = e.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function parseDateInputToTimestamp(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).getTime();
}

export function TermCard({ term, sessionName }: TermCardProps) {
  const activateTerm = useMutation("functions/academic/academicSetup:activateTerm" as never);
  const updateTermDates = useMutation("functions/academic/academicSetup:updateTermDates" as never);
  const updateCalculationMode = useMutation("functions/academic/academicSetup:updateTermCalculationMode" as never);

  const [isActivating, setIsActivating] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(formatDateInput(term.startDate));
  const [endDate, setEndDate] = useState(formatDateInput(term.endDate));
  const [isSavingDates, setIsSavingDates] = useState(false);

  // Modern In-App Confirmation Modals
  const [isActivateConfirmOpen, setIsActivateConfirmOpen] = useState(false);
  const [isSaveDatesConfirmOpen, setIsSaveDatesConfirmOpen] = useState(false);

  // Visual Halo Animation on Activation
  const [justActivated, setJustActivated] = useState(false);

  const handleModeChange = async (mode: "standalone" | "cumulative_annual") => {
    try {
      await updateCalculationMode({
        termId: term._id,
        resultCalculationMode: mode,
      } as never);

      appToast.success("Calculation Mode Updated", {
        description: `${term.name} is now set to ${
          mode === "standalone" ? "Single-Term Results" : "Cumulative Annual Results"
        }.`,
      });
    } catch (error) {
      appToast.error("Failed to update calculation mode", {
        description: getUserFacingErrorMessage(error, "Could not update mode"),
      });
    }
  };

  const handleConfirmActivate = async () => {
    setIsActivating(true);
    try {
      await activateTerm({ termId: term._id } as never);
      setJustActivated(true);
      setTimeout(() => setJustActivated(false), 2400);

      appToast.success("Active Term Swapped", {
        description: `${term.name} is now the active term for ${sessionName}.`,
      });
    } catch (error) {
      appToast.error("Term activation failed", {
        description: getUserFacingErrorMessage(error, "Unable to activate term"),
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handleRequestSaveDates = () => {
    if (!startDate || !endDate) {
      appToast.error("Validation Error", {
        description: "Please specify both start and end dates.",
      });
      return;
    }

    const startTs = parseDateInputToTimestamp(startDate);
    const endTs = parseDateInputToTimestamp(endDate);

    if (startTs >= endTs) {
      appToast.error("Validation Error", {
        description: "Term end date must be after the start date.",
      });
      return;
    }

    setIsSaveDatesConfirmOpen(true);
  };

  const handleConfirmSaveDates = async () => {
    const startTs = parseDateInputToTimestamp(startDate);
    const endTs = parseDateInputToTimestamp(endDate);

    setIsSavingDates(true);
    try {
      await updateTermDates({
        termId: term._id,
        startDate: startTs,
        endDate: endTs,
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
    <>
      <div
        className={`relative flex flex-col justify-between p-4 sm:p-5 transition-all duration-300 ${
          justActivated
            ? "bg-emerald-100/50 border-l-4 lg:border-l-0 lg:border-t-4 border-emerald-500"
            : term.isActive
              ? "bg-emerald-50/30 border-l-4 lg:border-l-0 lg:border-t-4 border-emerald-500"
              : "hover:bg-slate-50/60"
        }`}
      >
        <div className="space-y-2.5">
          {/* Header Row: Term Name + Status / Action */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="font-display text-sm font-bold text-slate-950 truncate">
                {term.name}
              </h4>
              {term.isActive && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!term.isActive && (
                <button
                  type="button"
                  onClick={() => setIsActivateConfirmOpen(true)}
                  disabled={isActivating}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-900 hover:text-white transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  Make Active
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsEditingDates(!isEditingDates)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer shrink-0"
                title="Edit term dates"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Date Range Display or Inline Editor */}
          {!isEditingDates ? (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-medium">
                {formatDateRange(term.startDate, term.endDate)}
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2 animate-in fade-in duration-150">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-800">
                Modify Calendar Dates
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-slate-900"
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
                  onClick={handleRequestSaveDates}
                  disabled={isSavingDates}
                  className="flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1 text-[10px] font-bold text-white hover:opacity-90 transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Save className="h-3 w-3" /> Save
                </button>
              </div>
            </div>
          )}

          {/* Report Card Calculation Mode */}
          <div className="pt-1">
            <select
              value={term.reportCardCalculationMode}
              onChange={(e) =>
                void handleModeChange(
                  e.target.value as "standalone" | "cumulative_annual"
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 outline-none transition hover:bg-white focus:border-slate-900 cursor-pointer"
            >
              <option value="standalone">Single-Term Results (1st / 2nd Term)</option>
              <option value="cumulative_annual">Cumulative Annual Results (Final Term)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Term Activation */}
      <ConfirmationModal
        isOpen={isActivateConfirmOpen}
        onClose={() => setIsActivateConfirmOpen(false)}
        onConfirm={() => {
          setIsActivateConfirmOpen(false);
          void handleConfirmActivate();
        }}
        title={`Activate ${term.name}?`}
        description={`Set ${term.name} as the school's primary active term for ${sessionName}.\n\nAll continuous assessments, attendance recording, and report cards will sync to this term.`}
        confirmLabel="Activate Term"
        confirmVariant="emerald"
      />

      {/* Confirmation Modal for Date Modifications */}
      <ConfirmationModal
        isOpen={isSaveDatesConfirmOpen}
        onClose={() => setIsSaveDatesConfirmOpen(false)}
        onConfirm={() => {
          setIsSaveDatesConfirmOpen(false);
          void handleConfirmSaveDates();
        }}
        title="Confirm Date Modification"
        description={`Changing term dates modifies the institutional calendar for ${term.name}.\n\nThis change will be permanently logged in the Academic Timeline Audit Trail.`}
        confirmLabel="Save & Log Modification"
        confirmVariant="warning"
      />
    </>
  );
}
