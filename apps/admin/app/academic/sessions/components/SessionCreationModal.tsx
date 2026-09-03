"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import {
  CalendarCheck,
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
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevOverflowRef = useRef("");

  const createSession = useMutation("functions/academic/academicSetup:createSession" as never);

  const currentYear = new Date().getFullYear();
  const defaultSessionName = `${currentYear}/${currentYear + 1}`;

  const [sessionName, setSessionName] = useState(defaultSessionName);
  const [startDate, setStartDate] = useState(`${currentYear}-09-08`);
  const [endDate, setEndDate] = useState(`${currentYear + 1}-07-24`);
  const [activateSession, setActivateSession] = useState(true);
  const [autoGenerateTerms, setAutoGenerateTerms] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      prevOverflowRef.current = document.body.style.overflow;
      setShouldRender(true);
      const timer = setTimeout(() => setIsAnimating(true), 20);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = prevOverflowRef.current;
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = prevOverflowRef.current;
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, shouldRender]);

  if (!shouldRender || !mounted) return null;

  const parseLocalDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return Number.NaN;
    return new Date(year, month - 1, day, 12, 0, 0).getTime();
  };

  const handleApplyPreset = (yearOffset: number) => {
    const yr = currentYear + yearOffset;
    setSessionName(`${yr}/${yr + 1}`);
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
        autoGenerateTerms,
      } as never);

      appToast.success("Session Created", {
        description: `${normalizedName} ${autoGenerateTerms ? "with 3 balanced terms" : ""} is ready.`,
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

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4 transition-all duration-400 ease-out ${
        isAnimating ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Overlay Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-400 ease-out ${
          isAnimating ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sheet / Modal Container */}
      <div
        className={`relative flex w-full flex-col bg-white shadow-2xl ring-1 ring-slate-950/10 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
          rounded-t-[2.5rem] sm:rounded-2xl sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-hidden
          ${isAnimating ? "translate-y-0" : "translate-y-full sm:translate-y-8 sm:scale-95"}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe Grab Handle */}
        <div className="flex justify-center py-3.5 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pb-3 pt-1 sm:pt-6 border-b border-slate-100">
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

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4 sm:space-y-5 custom-scrollbar pb-8 sm:pb-6">
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
                placeholder="e.g., 2025/2026"
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

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pt-3 border-t border-slate-100">
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
    </div>,
    document.body
  );
}
