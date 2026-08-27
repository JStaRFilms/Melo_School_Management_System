"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  History,
  Plus,
  ShieldCheck,
  Sparkles,
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

  const activeSession = useMemo(
    () => sessions?.find((s) => s.isActive) ?? null,
    [sessions]
  );

  const otherSessions = useMemo(
    () => sessions?.filter((s) => !s.isActive) ?? [],
    [sessions]
  );

  const handleMakeActive = async (sessionId: string) => {
    try {
      await updateSession({ sessionId, isActive: true } as never);
      appToast.success("Session Activated", {
        description: "The selected academic session is now active.",
      });
    } catch (err) {
      appToast.error("Activation Failed", {
        description: getUserFacingErrorMessage(err, "Failed to activate session"),
      });
    }
  };

  const handleArchive = async (sessionId: string) => {
    if (
      !window.confirm(
        "Archive this session? Historical report cards and student records will be preserved, but it will be hidden from daily setup."
      )
    ) {
      return;
    }
    try {
      await archiveSession({ sessionId } as never);
      appToast.success("Session Archived", {
        description: "The session has been archived to history.",
      });
    } catch (err) {
      appToast.error("Archive Failed", {
        description: getUserFacingErrorMessage(err, "Failed to archive session"),
      });
    }
  };

  if (sessions === undefined) {
    return (
      <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between pb-2">
            <div className="space-y-2">
              <div className="h-3 w-32 rounded bg-slate-200" />
              <div className="h-6.5 w-64 rounded bg-slate-200" />
              <div className="h-3 w-96 rounded bg-slate-200" />
            </div>
            <div className="h-9 w-40 rounded-xl bg-slate-200" />
          </div>

          <div className="h-44 rounded-2xl bg-white border border-slate-200/60 p-6" />
          <div className="h-64 rounded-2xl bg-white border border-slate-200/60 p-6" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        
        {/* ═══ ADMIN HEADER ════════════════════════════════════ */}
        <AdminHeader
          label="Institutional timeline & calendar"
          title="Sessions & Terms"
          description="Manage school academic years, term sequence dates, and report card calculation policies."
          actions={
            <div className="flex items-center gap-3">
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
                    icon: <Sparkles />,
                  },
                  {
                    label: "Audit Logs",
                    value: String(auditEvents?.length ?? 0),
                    icon: <ShieldCheck />,
                  },
                ]}
              />

              <button
                type="button"
                onClick={() => setIsNewSessionModalOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>New Session</span>
              </button>
            </div>
          }
        />

        {/* ═══ EMPTY STATE (0 SESSIONS) ════════════════════════ */}
        {sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-4 shadow-2xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mx-auto shadow-xs">
              <Calendar className="h-7 w-7" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="font-display text-base font-bold text-slate-950">
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
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Create First Academic Session
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* ═══ ACTIVE SESSION (HERO TIMELINE) ══════════════ */}
            {activeSession && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Active School Calendar
                    </h4>
                  </div>
                </div>

                <SessionTimelineCard
                  key={activeSession._id}
                  session={activeSession}
                  onMakeActive={handleMakeActive}
                  onArchive={handleArchive}
                  defaultExpanded={true}
                />
              </div>
            )}

            {/* ═══ PREVIOUS / HISTORICAL SESSIONS ══════════════ */}
            {otherSessions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Academic Year History ({otherSessions.length})
                  </h4>
                </div>

                <div className="space-y-4">
                  {otherSessions.map((session) => (
                    <SessionTimelineCard
                      key={session._id}
                      session={session}
                      onMakeActive={handleMakeActive}
                      onArchive={handleArchive}
                      defaultExpanded={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ═══ RECENT TIMELINE AUDIT ACTIVITY ══════════════ */}
            {auditEvents && auditEvents.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-display text-xs font-bold text-slate-950">
                        Academic Timeline Audit Trail
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Immutable record of session/term date changes and activation events.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {auditEvents.slice(0, 6).map((log) => (
                    <div
                      key={log._id}
                      className="py-2.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 rounded-lg px-1 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {timelineEventLabel(log.eventType)} ·{" "}
                            <span className="font-bold text-slate-950">{log.entityName}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">
                            By {log.actorName || "Administrator"}
                          </p>
                        </div>
                      </div>

                      <time className="shrink-0 text-[10px] font-bold text-slate-400">
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
