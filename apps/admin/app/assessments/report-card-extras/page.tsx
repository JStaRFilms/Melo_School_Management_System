"use client";

export const dynamic = "force-dynamic";

import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { buildReportCardHref } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { ExtrasSelectionBar } from "./components/ExtrasSelectionBar";
import { ExtrasWorkspace } from "./components/ExtrasWorkspace";
import type { ExtrasEntry, ExtrasSelection, SelectorOption } from "./components/types";
import {
  AppWindow,
  BookOpen,
  CalendarDays,
} from "lucide-react";

export default function AdminReportCardExtrasPage() {
  const searchParams = useSearchParams();
  const selection = useMemo<ExtrasSelection>(() => ({ sessionId: searchParams.get("sessionId"), termId: searchParams.get("termId"), classId: searchParams.get("classId"), studentId: searchParams.get("studentId") }), [searchParams]);

  const rawSessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;
  const rawTerms = useQuery("functions/academic/adminSelectors:getTermsBySession" as never, selection.sessionId ? ({ sessionId: selection.sessionId } as never) : ("skip" as never)) as SelectorOption[] | undefined;
  const rawClasses = useQuery("functions/academic/adminSelectors:getAllClasses" as never) as SelectorOption[] | undefined;
  const sessions = rawSessions ?? [];
  const terms = rawTerms ?? [];
  const classes = rawClasses ?? [];

  const classIsValid = !selection.classId || classes.some((option) => option.id === selection.classId);
  const rawStudents = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    selection.sessionId && selection.termId && selection.classId && classIsValid
      ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId } as never)
      : ("skip" as never)
  ) as Array<{ studentId: string; studentName: string; admissionNumber: string }> | undefined;
  const students = rawStudents?.map((student) => ({ id: student.studentId, name: `${student.studentName} (${student.admissionNumber})` })) ?? [];
  const studentIsValid = !selection.studentId || students.some((option) => option.id === selection.studentId);

  const entry = useQuery("functions/academic/reportCardExtras:getStudentReportCardExtrasEntry" as never, selection.sessionId && selection.termId && selection.classId && selection.studentId && classIsValid && studentIsValid ? ({ sessionId: selection.sessionId, termId: selection.termId, classId: selection.classId, studentId: selection.studentId } as never) : ("skip" as never)) as ExtrasEntry | undefined;
  const saveEntry = useMutation("functions/academic/reportCardExtras:saveStudentReportCardExtrasEntry" as never);

  const reportCardHref = buildReportCardHref({
    studentId: selection.studentId,
    sessionId: selection.sessionId,
    termId: selection.termId,
    classId: selection.classId,
  });
  const hasSelection = Boolean(selection.sessionId && selection.termId && selection.classId && selection.studentId);

  const selectedSessionName = sessions.find(s => s.id === selection.sessionId)?.name;
  const selectedTermName = terms.find(t => t.id === selection.termId)?.name;
  const selectedClassName = classes.find(c => c.id === selection.classId)?.name;

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/50">
      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 overflow-hidden">
        {/* Sidebar Bucket */}
        <aside className="w-full lg:w-[380px] lg:h-full lg:overflow-y-auto border-l bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0">
          <div className="p-4 py-6 md:p-8 space-y-6">
            <ExtrasSelectionBar
              selection={selection}
              sessions={sessions}
              terms={terms}
              classes={classes}
              students={students}
              isLoadingSessions={rawSessions === undefined}
              isLoadingTerms={Boolean(selection.sessionId) && rawTerms === undefined}
              isLoadingClasses={rawClasses === undefined}
              isLoadingStudents={Boolean(selection.classId && selection.sessionId && selection.termId) && rawStudents === undefined}
            />

            <div className="pt-4 border-t border-slate-200/60 p-1">
              <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Override Protocol
              </h4>
              <p className="mt-1 text-[10px] leading-relaxed font-medium text-slate-400">
                Admin overrides bypass standard lock periods and entry windows. Use with caution.
              </p>
            </div>
          </div>
        </aside>

        {/* Main Bucket */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10 space-y-6 md:space-y-8">
            <AdminHeader
              label="Academic Engine"
              title="Report Extras"
              description="Administrative cockpit for overriding report card extras like behavior, remarks, and custom metrics."
            />

            {/* High-Density Context Ribbon */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200/60 bg-white/50 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Session:</span>
                <span className="text-[11px] font-extrabold text-slate-900">{selectedSessionName ?? "---"}</span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Class:</span>
                <span className="text-[11px] font-extrabold text-slate-900">{selectedClassName ?? "---"}</span>
              </div>
              <div className="flex items-center gap-2">
                <AppWindow size={14} className="text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Term:</span>
                <span className="text-[11px] font-extrabold text-slate-900">{selectedTermName ?? "---"}</span>
              </div>
            </div>

            <ExtrasWorkspace
              entry={entry}
              isLoading={hasSelection && entry === undefined && students.length > 0}
              hasSelection={hasSelection}
              hasStudents={students.length > 0}
              reportCardHref={reportCardHref}
              onSave={(bundleValues) =>
                saveEntry({ ...(selection as Required<ExtrasSelection>), bundleValues } as never)
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
