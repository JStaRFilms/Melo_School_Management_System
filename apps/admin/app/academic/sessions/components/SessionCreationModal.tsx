"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  Plus,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { humanNameFinal, humanNameTyping } from "@/human-name";

interface SessionCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

export function SessionCreationModal({
  isOpen,
  onClose,
  onSessionCreated,
}: SessionCreationModalProps) {
  const createSession = useMutation("functions/academic/academicSetup:createSession" as never);
  const createTerm = useMutation("functions/academic/academicSetup:createTerm" as never);

  const currentYear = new Date().getFullYear();
  const defaultSessionName = `${currentYear}/${currentYear + 1} Academic Session`;

  const [sessionName, setSessionName] = useState(defaultSessionName);
  const [startDate, setStartDate] = useState(`${currentYear}-09-08`);
  const [endDate, setEndDate] = useState(`${currentYear + 1}-07-24`);
  const [activateSession, setActivateSession] = useState(true);
  const [autoGenerateTerms, setAutoGenerateTerms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return Number.NaN;
    return new Date(year, month - 1, day).getTime();
  };

  const handleApplyPreset = (yearOffset: number) => {
    const yr = currentYear + yearOffset;
    setSessionName(`${yr}/${yr + 1} Academic Session`);
    setStartDate(`${yr}-09-08`);
    setEndDate(`${yr + 1}-07-24`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedName = humanNameFinal(sessionName);
    if (!normalizedName || !startDate || !endDate) return;

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
      const sessionId: any = await createSession({
        name: normalizedName,
        startDate: startTimestamp,
        endDate: endTimestamp,
        isActive: activateSession,
      } as never);

      // Auto-generate 3 terms if selected
      if (autoGenerateTerms && sessionId) {
        const yr = new Date(startTimestamp).getFullYear();
        const nextYr = yr + 1;

        // First Term (Sep - Dec)
        await createTerm({
          sessionId,
          name: "First Term",
          startDate: new Date(yr, 8, 8).getTime(),
          endDate: new Date(yr, 11, 19).getTime(),
          isActive: true,
          resultCalculationMode: "standalone",
        } as never);

        // Second Term (Jan - Apr)
        await createTerm({
          sessionId,
          name: "Second Term",
          startDate: new Date(nextYr, 0, 12).getTime(),
          endDate: new Date(nextYr, 3, 17).getTime(),
          isActive: false,
          resultCalculationMode: "standalone",
        } as never);

        // Third Term (May - Jul)
        await createTerm({
          sessionId,
          name: "Third Term",
          startDate: new Date(nextYr, 4, 4).getTime(),
          endDate: new Date(nextYr, 6, 24).getTime(),
          isActive: false,
          resultCalculationMode: "cumulative_annual",
        } as never);
      }

      appToast.success("Session Created", {
        description: `${normalizedName} ${autoGenerateTerms ? "with 3 standard terms" : ""} is ready.`,
      });

      if (onSessionCreated && sessionId) {
        onSessionCreated(sessionId);
      }
      onClose();
    } catch (err) {
      appToast.error("Session creation failed", {
        description: getUserFacingErrorMessage(err, "Failed to create academic session"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-4.5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
              <CalendarCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-950">
                New Academic Session
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Create a school academic year with calendar dates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Session Year Presets */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block pl-0.5">
            Quick Academic Year Presets
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[-1, 0, 1].map((offset) => {
              const yr = currentYear + offset;
              const label = `${yr}/${yr + 1}`;
              const isSelected = sessionName.startsWith(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleApplyPreset(offset)}
                  className={`py-2 px-1.5 sm:px-3 rounded-xl border text-[11px] sm:text-xs font-bold transition cursor-pointer text-center truncate ${
                    isSelected
                      ? "border-slate-900 bg-brand-primary text-white shadow-xs"
                      : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
              Session Name
            </label>
            <input
              type="text"
              required
              value={sessionName}
              onChange={(e) => setSessionName(humanNameTyping(e.target.value))}
              onBlur={(e) => setSessionName(humanNameFinal(e.target.value))}
              placeholder="e.g., 2025/2026 Academic Session"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block pl-0.5">
                Session Start Date
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
                Session End Date
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

          {/* Options */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={activateSession}
                onChange={(e) => setActivateSession(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="font-semibold text-slate-800">
                Set as the active school session
              </span>
            </label>

            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-900 cursor-pointer">
              <input
                type="checkbox"
                checked={autoGenerateTerms}
                onChange={(e) => setAutoGenerateTerms(e.target.checked)}
                className="h-4 w-4 rounded-md border-slate-300 text-slate-900 focus:ring-slate-900 shrink-0"
              />
              <div>
                <span className="font-bold">Auto-create 3 Standard Terms</span>
                <p className="text-[11px] text-slate-500 font-normal">
                  Generates First Term (Active), Second Term, and Third Term automatically.
                </p>
              </div>
            </label>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto rounded-xl bg-brand-primary px-5 py-2.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50 text-center"
            >
              {isSaving ? "Creating..." : "Create Session"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
