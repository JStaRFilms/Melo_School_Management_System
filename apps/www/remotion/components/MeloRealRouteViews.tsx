import React from "react";
import { Calendar, MessageSquare, Save } from "lucide-react";
import { AdminHeader } from "../../../admin/lib/components/ui/AdminHeader";
import { AdminSelectionBar } from "../../../admin/app/assessments/results/entry/components/AdminSelectionBar";
import { AdminRosterGrid } from "../../../admin/app/assessments/results/entry/components/AdminRosterGrid";
import { AdminSaveActionBar } from "../../../admin/app/assessments/results/entry/components/AdminSaveActionBar";
import {
  ReportCardBatchNavigator,
  ReportCardPreview,
  ReportCardToolbar,
  type ReportCardBatchStudent,
} from "../../../../packages/shared/src";
import type { ReportCardSheetData } from "../../../../packages/shared/src/components/ReportCardSheet";
import {
  emptyValidationErrors,
  getMeloDraftScores,
  getMeloRoster,
  meloGradingBands,
  meloIds,
  meloSelection,
  meloSelectorOptions,
} from "../data/meloScoreEntryDemo";

export function MeloScoreEntryRouteView({
  scoreValue,
  ready,
  previewLinkVisible,
}: {
  scoreValue: number | null;
  ready: boolean;
  previewLinkVisible: boolean;
}) {
  const roster = getMeloRoster(scoreValue);

  return (
    <div className="flex h-screen flex-col bg-slate-50 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-row-reverse">
        <aside className="h-full w-[320px] shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50/50 z-20">
          <div className="space-y-6 p-6">
            <div className="pb-4">
              <h4 className="mb-1 text-[10px] font-black uppercase leading-none tracking-[0.25em] text-slate-400">
                Assessment Engine
              </h4>
              <h2 className="text-lg font-black tracking-tight text-slate-950">Entry Selector</h2>
            </div>
            <AdminSelectionBar
              sessions={meloSelectorOptions.sessions}
              terms={meloSelectorOptions.terms}
              classes={meloSelectorOptions.classes}
              subjects={meloSelectorOptions.subjects}
              selection={meloSelection}
            />
          </div>
        </aside>

        <main className="relative h-full flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="mx-auto max-w-[1280px] space-y-6 px-6 py-8 pb-32 md:px-12 md:py-10">
            <AdminHeader
              title="Mathematics"
              label="Bulk Protocol Recording"
              description="Primary 5 Gold • First Term • 2025/2026 Session"
              className="!gap-2"
              actions={
                ready ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    Ready to Preview
                  </div>
                ) : null
              }
            />

            <AdminRosterGrid
              roster={roster}
              examInputMode="raw40"
              examLabelOverride="/60"
              gradingBands={meloGradingBands}
              draftScores={getMeloDraftScores(scoreValue)}
              validationErrors={emptyValidationErrors}
              sheetLabel="Mathematics • Primary 5 Gold"
              sessionId={meloIds.session}
              termId={meloIds.term}
              classId={meloIds.class}
              isEditable
              onScoreChange={() => undefined}
              forceQuickLinksStudentId={previewLinkVisible ? meloIds.amina : undefined}
            />
          </div>

          <div className="sticky bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/90 p-6 shadow-[0_-8px_32px_rgba(0,0,0,0.05)] backdrop-blur-md">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between">
              <AdminSaveActionBar
                hasUnsavedChanges={false}
                hasValidationErrors={false}
                errorCount={0}
                onSave={async () => undefined}
                onCancel={() => undefined}
                dirtyCount={0}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function MeloReportCardRouteView({ reportCard }: { reportCard: ReportCardSheetData }) {
  const students: ReportCardBatchStudent[] = [
    { studentId: reportCard.student._id, studentName: reportCard.student.name, admissionNumber: reportCard.student.admissionNumber },
    { studentId: "student-chinedu-okafor", studentName: "Chinedu Okafor", admissionNumber: "CHS/PRI/0143" },
    { studentId: "student-zara-musa", studentName: "Zara Musa", admissionNumber: "CHS/PRI/0144" },
    { studentId: "student-david-eze", studentName: "David Eze", admissionNumber: "CHS/PRI/0145" },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-100 overflow-hidden">
      <div className="flex flex-1 flex-row overflow-hidden">
        <aside className="order-1 flex h-full w-[460px] flex-col overflow-y-auto border-r border-slate-200/60 bg-white pb-10 pt-6 custom-scrollbar">
          <div className="space-y-8">
            <div className="space-y-4 px-5">
              <ReportCardBatchNavigator
                students={students}
                activeStudentId={reportCard.student._id}
                className={reportCard.className}
                sessionName={reportCard.sessionName}
                termName={reportCard.termName}
                onSelectStudent={() => undefined}
                onPrintFullClass={() => undefined}
              />
            </div>

            <div className="border-t border-slate-100 px-5 pt-6">
              <MeloReportCardAdminPanelPreview reportCard={reportCard} />
            </div>
          </div>
        </aside>

        <main className="order-2 h-full flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <ReportCardToolbar studentName={reportCard.student.name} backHref="/assessments/results/entry" />
            <ReportCardPreview reportCard={reportCard} backHref="/assessments/results/entry" hideToolbar />
          </div>
        </main>
      </div>
    </div>
  );
}

function MeloReportCardAdminPanelPreview({ reportCard }: { reportCard: ReportCardSheetData }) {
  return (
    <div className="rc-no-print space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <MessageSquare className="h-4 w-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student Performance</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="ml-1 text-[11px] font-bold text-slate-900">Class Teacher Comment</span>
            <textarea
              readOnly
              rows={3}
              value={reportCard.classTeacherComment ?? ""}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none"
              placeholder="Observation on progress..."
            />
          </div>
          <div className="space-y-1.5">
            <span className="ml-1 text-[11px] font-bold text-slate-900">Head Teacher Comment</span>
            <textarea
              readOnly
              rows={3}
              value={reportCard.headTeacherComment ?? ""}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 outline-none"
              placeholder="Final administrative remarks..."
            />
          </div>
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-black uppercase tracking-widest text-white shadow-md"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Comments</span>
          </button>
        </div>
      </section>

      <section className="space-y-4 border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 px-1">
          <Calendar className="h-4 w-4 text-slate-400" />
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Term Logistics</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="ml-1 text-[11px] font-bold text-slate-900">Resumption</span>
            <input
              readOnly
              type="date"
              value="2026-01-14"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-[13px] font-medium text-slate-900 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <span className="ml-1 text-[11px] font-bold text-slate-900">Times Opened</span>
            <input
              readOnly
              type="number"
              value="87"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-[13px] font-medium text-slate-900 outline-none"
              placeholder="Total days"
            />
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm"
        >
          <Save className="h-3.5 w-3.5 opacity-40" />
          <span>Save Defaults</span>
        </button>
      </section>
    </div>
  );
}
