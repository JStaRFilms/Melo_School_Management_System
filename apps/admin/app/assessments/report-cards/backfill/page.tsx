"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Layers3, School2 } from "lucide-react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { HistoricalBackfillWorkspace, type HistoricalBackfillSnapshot, type HistoricalBackfillStudent, type HistoricalBackfillSubject } from "./components/HistoricalBackfillWorkspace";

interface SelectorOption {
  id: string;
  name: string;
}

export default function HistoricalBackfillPage() {
  return (
    <Suspense fallback={<PageFallback />}> 
      <HistoricalBackfillPageContent />
    </Suspense>
  );
}

function HistoricalBackfillPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selection = useMemo(
    () => ({
      sessionId: searchParams.get("sessionId"),
      termId: searchParams.get("termId"),
      classId: searchParams.get("classId"),
    }),
    [searchParams]
  );

  const sessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;
  const terms = useQuery(
    "functions/academic/adminSelectors:getTermsBySession" as never,
    selection.sessionId
      ? ({ sessionId: selection.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;
  const classes = useQuery(
    "functions/academic/adminSelectors:getAllClasses" as never
  ) as SelectorOption[] | undefined;

  const classIsValid = !selection.classId || classes?.some((option) => option.id === selection.classId);
  const termIsValid = !selection.termId || terms?.some((option) => option.id === selection.termId);
  const sessionIsValid = !selection.sessionId || sessions?.some((option) => option.id === selection.sessionId);

  const students = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    selection.sessionId && selection.termId && selection.classId && classIsValid && termIsValid && sessionIsValid
      ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId } as never)
      : ("skip" as never)
  ) as HistoricalBackfillStudent[] | undefined;
  const subjects = useQuery(
    "functions/academic/adminSelectors:getSubjectsByClass" as never,
    selection.classId && classIsValid
      ? ({ classId: selection.classId } as never)
      : ("skip" as never)
  ) as HistoricalBackfillSubject[] | undefined;
  const existingTotals = useQuery(
    "functions/academic/historicalTermTotals:listHistoricalTermTotalsForClassTerm" as never,
    selection.sessionId && selection.termId && selection.classId && classIsValid && termIsValid && sessionIsValid
      ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId } as never)
      : ("skip" as never)
  ) as HistoricalBackfillSnapshot[] | undefined;

  const saveHistoricalTotals = useMutation(
    "functions/academic/historicalTermTotals:saveHistoricalTermTotalsBulk" as never
  );

  const replaceSelection = useCallback(
    (next: { sessionId?: string | null; termId?: string | null; classId?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());

      const apply = (key: "sessionId" | "termId" | "classId") => {
        const value = next[key];
        if (value === undefined) return;
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      };

      apply("sessionId");
      apply("termId");
      apply("classId");

      if (next.sessionId !== undefined) {
        params.delete("termId");
        params.delete("classId");
      } else if (next.termId !== undefined) {
        params.delete("classId");
      }

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const selectedSessionName = sessions?.find((option) => option.id === selection.sessionId)?.name ?? "--";
  const selectedTermName = terms?.find((option) => option.id === selection.termId)?.name ?? "--";
  const selectedClassName = classes?.find((option) => option.id === selection.classId)?.name ?? "--";

  const isWorkspaceReady = Boolean(
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      sessionIsValid &&
      termIsValid &&
      classIsValid
  );

  const handleSave = useCallback(
    async (args: {
      sessionId: string;
      termId: string;
      classId: string;
      entries: Array<{
        studentId: string;
        subjectId: string;
        total: number;
        notes?: string | null;
      }>;
    }) =>
      (await saveHistoricalTotals(args as never)) as {
        created: number;
        updated: number;
      },
    [saveHistoricalTotals]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.05),_transparent_34%),linear-gradient(180deg,_#f8fafc,_#eef2ff_52%,_#f8fafc)]">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10 space-y-6">
        <AdminHeader
          label="Assessment Backfill"
          title="Historical Term Totals"
          description="Admin-only workspace for restoring prior-term subject totals used by cumulative annual report cards."
          actions={
            <Link
              href="/assessments/report-cards"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to report cards
            </Link>
          }
        />

        <section className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Session</span>
              <div className="relative">
                <select
                  value={selection.sessionId ?? ""}
                  onChange={(event) => replaceSelection({ sessionId: event.target.value || null, termId: null, classId: null })}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5"
                >
                  <option value="">Select a session</option>
                  {(sessions ?? []).map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
                <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Term</span>
              <div className="relative">
                <select
                  value={selection.termId ?? ""}
                  onChange={(event) => replaceSelection({ termId: event.target.value || null, classId: null })}
                  disabled={!selection.sessionId}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{selection.sessionId ? "Select a term" : "Choose session first"}</option>
                  {(terms ?? []).map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
                <Layers3 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class</span>
              <div className="relative">
                <select
                  value={selection.classId ?? ""}
                  onChange={(event) => replaceSelection({ classId: event.target.value || null })}
                  disabled={!selection.termId}
                  className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50/70 px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">{selection.termId ? "Select a class" : "Choose term first"}</option>
                  {(classes ?? []).map((classOption) => (
                    <option key={classOption.id} value={classOption.id}>
                      {classOption.name}
                    </option>
                  ))}
                </select>
                <School2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatGroup
              variant="wrap"
              stats={[
                { label: "Session", value: selectedSessionName ?? "--" },
                { label: "Term", value: selectedTermName ?? "--" },
                { label: "Class", value: selectedClassName ?? "--" },
              ]}
            />
          </div>
        </section>

        {!isWorkspaceReady ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">Pick a session, historical term, and class to load the roster.</p>
            <p className="mt-2 max-w-2xl leading-relaxed text-slate-500">
              This workspace is intentionally separate from live CA/exam entry. Use it only for prior-term snapshots that need to flow into cumulative annual results.
            </p>
          </section>
        ) : students === undefined || subjects === undefined || existingTotals === undefined ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Loading backfill workspace...</p>
          </section>
        ) : (
          <HistoricalBackfillWorkspace
            sessionId={selection.sessionId!}
            termId={selection.termId!}
            classId={selection.classId!}
            sessionName={selectedSessionName ?? "--"}
            termName={selectedTermName ?? "--"}
            className={selectedClassName ?? "--"}
            students={students}
            subjects={subjects}
            existingTotals={existingTotals}
            isLoading={students === undefined || subjects === undefined || existingTotals === undefined}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-sm font-medium text-slate-500 md:px-6">
      Loading historical backfill workspace...
    </div>
  );
}
