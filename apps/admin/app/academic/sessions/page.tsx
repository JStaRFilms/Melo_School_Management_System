"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpDown,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { SessionTimelineCard } from "./components/SessionTimelineCard";
import { SessionCreationModal } from "./components/SessionCreationModal";
import type { SessionRecord } from "@/types";

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

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function timelineEventLabel(eventType: TimelineAuditEvent["eventType"]) {
  switch (eventType) {
    case "session_dates_updated":
      return "Session dates updated";
    case "term_dates_updated":
      return "Term dates updated";
    case "term_activated":
      return "Active term changed";
    case "unused_timeline_deleted":
      return "Unused timeline deleted";
    case "production_timeline_repair":
      return "Timeline repaired";
  }
}

export default function SessionsPage() {
  const sessions = useQuery(
    "functions/academic/academicSetup:listSessions" as never
  ) as SessionRecord[] | undefined;

  const auditEvents = useQuery(
    "functions/academic/academicSetup:listAcademicTimelineAuditEvents" as never
  ) as TimelineAuditEvent[] | undefined;

  const updateSession = useMutation(
    "functions/academic/academicSetup:updateSession" as never
  );
  const archiveSession = useMutation(
    "functions/academic/academicSetup:archiveSession" as never
  );

  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [swappingSessionId, setSwappingSessionId] = useState<string | null>(null);
  const [justPromotedSessionId, setJustPromotedSessionId] = useState<string | null>(null);

  const activeSession = useMemo(
    () => sessions?.find((s) => s.isActive) ?? null,
    [sessions]
  );

  const otherSessions = useMemo(
    () => sessions?.filter((s) => !s.isActive) ?? [],
    [sessions]
  );

  // Track changes in active session to trigger the swap animation
  const prevActiveSessionId = useRef<string | null>(null);
  useEffect(() => {
    if (activeSession && prevActiveSessionId.current && prevActiveSessionId.current !== activeSession._id) {
      setJustPromotedSessionId(activeSession._id);
      const timer = setTimeout(() => {
        setJustPromotedSessionId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    if (activeSession) {
      prevActiveSessionId.current = activeSession._id;
    }
  }, [activeSession]);

  const handleMakeActive = async (sessionId: string) => {
    setSwappingSessionId(sessionId);
    try {
      await updateSession({ sessionId, isActive: true } as never);
      appToast.success("Active Session Swapped", {
        description: "The selected academic session is now live as the primary school calendar.",
      });
    } catch (err) {
      appToast.error("Activation Failed", {
        description: getUserFacingErrorMessage(err, "Failed to activate session"),
      });
    } finally {
      setSwappingSessionId(null);
    }
  };

  const handleArchive = async (sessionId: string) => {
    try {
      await archiveSession({ sessionId } as never);
      appToast.success("Session Archived", {
        description: "The session has been moved to history.",
      });
    } catch (err) {
      appToast.error("Archive Failed", {
        description: getUserFacingErrorMessage(err, "Failed to archive session"),
      });
    }
  };

  if (sessions === undefined) {
    return (
      <main className="min-h-screen bg-slate-50/50 px-3 py-4 sm:px-6 sm:py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-5 animate-pulse">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-2">
            <div className="space-y-2">
              <div className="h-3 w-28 rounded bg-slate-200" />
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-3 w-72 rounded bg-slate-200" />
            </div>
            <div className="h-9 w-32 rounded-xl bg-slate-200" />
          </div>

          <div className="h-20 rounded-2xl bg-white border border-slate-200/60 p-4" />
          <div className="h-56 rounded-2xl bg-white border border-slate-200/60 p-4" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 px-3 py-4 sm:px-6 sm:py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        
        {/* ═══ ADMIN HEADER & ACTIONS ════════════════════════════ */}
        <div className="space-y-4">
          <AdminHeader
            label="Institutional timeline & calendar"
            title="Sessions & Terms"
            description="Manage school academic years, term sequence dates, and report card calculation policies."
            actions={
              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(true)}
                className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-90 active:scale-95 transition cursor-pointer"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>New Session</span>
              </button>
            }
          />

          {/* Dedicated Responsive Stat Strip */}
          <div className="w-full overflow-hidden">
            <StatGroup
              variant="scroll"
              stats={[
                {
                  label: "Sessions",
                  value: String(sessions.length),
                  icon: <CalendarDays />,
                },
                {
                  label: "Current",
                  value: activeSession ? activeSession.name.split(" ")[0] : "None",
                  icon: <CalendarCheck />,
                },
                {
                  label: "Audit Logs",
                  value: String(auditEvents?.length ?? 0),
                  icon: <ShieldCheck />,
                },
              ]}
            />
          </div>
        </div>

        {/* ═══ EMPTY STATE (0 SESSIONS) ════════════════════════ */}
        {sessions.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border border-dashed border-slate-300 bg-white p-6 sm:p-12 text-center space-y-4 shadow-2xs">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 mx-auto shadow-xs">
              <Calendar className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-950">
                No Academic Sessions Created
              </h3>
              <p className="text-xs text-slate-500">
                Setup your first school year to establish term calendar dates, student enrollment, and grading schedules.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(true)}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Create First Academic Session
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            
            {/* ═══ ACTIVE SESSION (HERO TIMELINE) ══════════════ */}
            {activeSession && (
              <div
                key={`hero-slot-${activeSession._id}`}
                className={`space-y-2.5 sm:space-y-3 transition-all duration-700 ease-out ${
                  justPromotedSessionId === activeSession._id
                    ? "animate-in slide-in-from-bottom-8 fade-in-0 duration-700"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                      Active School Calendar
                    </h4>

                    {justPromotedSessionId === activeSession._id && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-in zoom-in-75 duration-300">
                        <ArrowUpDown className="h-3 w-3 animate-spin" /> Swapped to Active
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className={`rounded-2xl transition-all duration-700 ${
                    justPromotedSessionId === activeSession._id
                      ? "ring-4 ring-emerald-400/50 shadow-2xl shadow-emerald-500/10"
                      : ""
                  }`}
                >
                  <SessionTimelineCard
                    key={activeSession._id}
                    session={activeSession}
                    onMakeActive={handleMakeActive}
                    onArchive={handleArchive}
                    defaultExpanded={true}
                  />
                </div>
              </div>
            )}

            {/* ═══ PREVIOUS / HISTORICAL SESSIONS ══════════════ */}
            {otherSessions.length > 0 && (
              <div className="space-y-2.5 sm:space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                    Academic Year History ({otherSessions.length})
                  </h4>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  {otherSessions.map((session) => (
                    <div
                      key={session._id}
                      className={`transition-all duration-500 ${
                        swappingSessionId === session._id
                          ? "opacity-60 scale-[0.99] ring-2 ring-indigo-400 animate-pulse"
                          : "animate-in slide-in-from-top-4 fade-in-0 duration-500"
                      }`}
                    >
                      <SessionTimelineCard
                        session={session}
                        onMakeActive={handleMakeActive}
                        onArchive={handleArchive}
                        defaultExpanded={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ RECENT TIMELINE AUDIT ACTIVITY ══════════════ */}
            {auditEvents && auditEvents.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-2xs space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-display text-xs font-bold text-slate-950">
                        Academic Timeline Audit Trail
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">
                        Immutable record of session/term date changes and activation events.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {auditEvents.slice(0, 6).map((log) => (
                    <div
                      key={log._id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 hover:bg-slate-50/50 rounded-lg px-1 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 leading-snug">
                            {timelineEventLabel(log.eventType)} ·{" "}
                            <span className="font-bold text-slate-950">{log.entityName}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            By {log.actorName || "Administrator"}
                          </p>
                        </div>
                      </div>

                      <time className="shrink-0 text-[10px] font-bold text-slate-400 pl-6 sm:pl-0">
                        {formatRelativeTime(log.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══ CREATE SESSION MODAL ════════════════════════════ */}
        <SessionCreationModal
          isOpen={isNewSessionModalOpen}
          onClose={() => setIsNewSessionModalOpen(false)}
        />

      </div>
    </main>
  );
}
