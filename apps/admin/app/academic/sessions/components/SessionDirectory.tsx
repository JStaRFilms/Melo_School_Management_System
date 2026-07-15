"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Calendar,
  CheckCircle2,
  History,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminSurface } from "@/components/ui/AdminSurface";
import type { SessionRecord } from "@/types";

type TermRecord = {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  isActive: boolean;
  reportCardCalculationMode: "standalone" | "cumulative_annual";
  updatedAt: number;
};

type TimelineAuditEvent = {
  _id: string;
  eventType:
    | "session_dates_updated"
    | "term_dates_updated"
    | "term_activated"
    | "unused_timeline_deleted"
    | "production_timeline_repair";
  entityType: "session" | "term";
  entityName: string;
  actorUserId: string | null;
  actorName: string;
  actorLabel: string;
  createdAt: number;
};

interface SessionDirectoryProps {
  sessions: SessionRecord[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onMakeActive: (id: string) => void;
  onArchive: (id: string) => void;
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

function TermBadge({ term }: { term: TermRecord }) {
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
  const dateStr = `${new Date(term.startDate).toLocaleDateString()} - ${new Date(term.endDate).toLocaleDateString()}`;

  const handleModeChange = async (nextMode: "standalone" | "cumulative_annual") => {
    if (nextMode === term.reportCardCalculationMode) return;

    setIsSavingMode(true);
    try {
      await updateTermCalculationMode({
        termId: term._id,
        resultCalculationMode: nextMode,
      } as never);
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
        `Make ${term.name} the active term? The currently active term will be deactivated, but its records will remain intact.`
      )
    ) {
      return;
    }

    setIsActivating(true);
    try {
      await activateTerm({ termId: term._id } as never);
      appToast.success("Term activated", {
        description: `${term.name} is now the active term.`,
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

    const confirmed = window.confirm(
      `Change ${term.name} dates?\n\nOld: ${new Date(term.startDate).toLocaleDateString()} - ${new Date(term.endDate).toLocaleDateString()}\nNew: ${new Date(nextStartDate).toLocaleDateString()} - ${new Date(nextEndDate).toLocaleDateString()}\n\nThis change will be recorded in the academic timeline audit log.`
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
        description: "The old and new dates were recorded in the audit log.",
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
      className={`group rounded-lg border px-3 py-3 transition-all ${
        term.isActive
          ? "border-indigo-100 bg-indigo-50/50"
          : "border-slate-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${
            term.isActive ? "text-indigo-600" : "text-slate-400"
          }`}>
            {term.name}
          </span>
          <span className="text-[10px] font-medium text-slate-600 tracking-tight">
            {dateStr}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!term.isActive && (
            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={isActivating}
              className="rounded-lg bg-emerald-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
            >
              {isActivating ? "Activating..." : "Make Active"}
            </button>
          )}
          {term.isActive && (
            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              Active
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsEditingDates(true)}
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
            aria-label={`Edit ${term.name} dates`}
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>

      {isEditingDates && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-amber-700">
            Date changes require confirmation and are audit logged
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[9px] font-semibold text-slate-500">
              Start
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700"
              />
            </label>
            <label className="space-y-1 text-[9px] font-semibold text-slate-500">
              End
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700"
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelDateEditing}
              disabled={isSavingDates}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-500"
            >
              <X size={11} /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSaveDates()}
              disabled={isSavingDates}
              className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[9px] font-bold text-white disabled:opacity-50"
            >
              <Save size={11} /> {isSavingDates ? "Saving..." : "Review & Save"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Report Card Mode
        </span>
        <select
          value={term.reportCardCalculationMode}
          onChange={(event) =>
            void handleModeChange(
              event.target.value as "standalone" | "cumulative_annual"
            )
          }
          disabled={isSavingMode}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 outline-none transition focus:border-indigo-500 disabled:opacity-60"
        >
          <option value="standalone">Standalone term report</option>
          <option value="cumulative_annual">Cumulative annual report</option>
        </select>
        <p className="text-[10px] font-medium leading-relaxed text-slate-500">
          Usually first and second term stay standalone. Set third term to cumulative annual if it should combine prior-term totals.
        </p>
      </div>
    </div>
  );
}

function timelineEventLabel(eventType: TimelineAuditEvent["eventType"]) {
  switch (eventType) {
    case "session_dates_updated":
      return "Session dates changed";
    case "term_dates_updated":
      return "Term dates changed";
    case "term_activated":
      return "Active term changed";
    case "unused_timeline_deleted":
      return "Unused timeline deleted";
    case "production_timeline_repair":
      return "Timeline repaired";
  }
}

export function SessionDirectory({
  sessions,
  selectedSessionId,
  onSelectSession,
  onMakeActive,
  onArchive,
}: SessionDirectoryProps) {
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    selectedSessionId ? ({ sessionId: selectedSessionId } as never) : ("skip" as never)
  ) as TermRecord[] | undefined;
  const auditEvents = useQuery(
    "functions/academic/academicSetup:listAcademicTimelineAuditEvents" as never
  ) as TimelineAuditEvent[] | undefined;

  return (
    <div className="space-y-4">
      <div className="space-y-1 px-1">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Academic Timeline
        </h4>
      </div>

      <div className="grid gap-3">
        {sessions.map((session) => {
          const isSelected = session._id === selectedSessionId;
          const startDate = new Date(session.startDate).toLocaleDateString();
          const endDate = new Date(session.endDate).toLocaleDateString();

          return (
            <div key={session._id} className="group relative">
              <AdminSurface
                id={`session-${session._id}`}
                intensity={isSelected ? "high" : "medium"}
                className={`overflow-hidden transition-all duration-500 ${
                  isSelected ? "ring-2 ring-indigo-500/20" : "hover:border-slate-300"
                }`}
              >
                <div
                  onClick={() => onSelectSession(session._id)}
                  className="flex cursor-pointer items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      session.isActive ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                    }`}>
                      {session.isActive ? <CheckCircle2 size={20} /> : <History size={20} />}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {session.name}
                        </h3>
                        {session.isActive && (
                          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">
                        {startDate} — {endDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-all">
                    {!session.isActive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMakeActive(session._id);
                        }}
                        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(session._id);
                      }}
                      className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="border-t border-slate-100 bg-slate-50/30 p-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid gap-2 mb-4">
                      {terms ? (
                        terms.length > 0 ? (
                          terms.map((term) => <TermBadge key={term._id} term={term} />)
                        ) : (
                          <div className="py-6 text-center">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                              No terms defined yet.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="h-20 w-full animate-pulse rounded-lg bg-slate-100" />
                      )}
                    </div>
                  </div>
                )}
              </AdminSurface>
            </div>
          );
        })}

        {(auditEvents?.length ?? 0) > 0 && (
          <AdminSurface intensity="low" className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={14} className="text-indigo-600" />
              <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">
                Recent Timeline Activity
              </h4>
            </div>
            <div className="space-y-2">
              {auditEvents?.slice(0, 8).map((event) => (
                <div
                  key={event._id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-[10px] font-bold text-slate-700">
                      {timelineEventLabel(event.eventType)} · {event.entityName}
                    </p>
                    <p className="mt-0.5 text-[9px] text-slate-400">
                      {event.actorName}
                    </p>
                  </div>
                  <time className="shrink-0 text-[9px] font-medium text-slate-400">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          </AdminSurface>
        )}

        {sessions.length === 0 && (
          <AdminSurface intensity="low" className="p-12 text-center">
            <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-3" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Zero sessions found.
            </p>
          </AdminSurface>
        )}
      </div>
    </div>
  );
}
