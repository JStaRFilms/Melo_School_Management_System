"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Save, RotateCcw, ShieldCheck, FilePenLine } from "lucide-react";
import { StatGroup } from "@/components/ui/StatGroup";

export type HistoricalBackfillStudent = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
};

export type HistoricalBackfillSubject = {
  id: string;
  name: string;
};

export type HistoricalBackfillSnapshot = {
  _id: string;
  _creationTime: number;
  schoolId: string;
  sessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  total: number;
  source: "manual_backfill" | "migration_snapshot";
  notes?: string;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
};

export interface HistoricalBackfillWorkspaceProps {
  sessionId: string;
  termId: string;
  classId: string;
  sessionName: string;
  termName: string;
  className: string;
  students: HistoricalBackfillStudent[];
  subjects: HistoricalBackfillSubject[];
  existingTotals: HistoricalBackfillSnapshot[];
  isLoading?: boolean;
  onSave: (args: {
    sessionId: string;
    termId: string;
    classId: string;
    entries: Array<{
      studentId: string;
      subjectId: string;
      total: number;
      notes?: string | null;
    }>;
  }) => Promise<{ created: number; updated: number }>;
}

type DraftCell = {
  total: string;
  notes: string;
};

type ValidationIssue = {
  key: string;
  label: string;
  message: string;
};

function cellKey(studentId: string, subjectId: string) {
  return `${studentId}:${subjectId}`;
}

function formatNumber(value: string) {
  return value.trim();
}

function buildSeedDrafts(
  students: HistoricalBackfillStudent[],
  subjects: HistoricalBackfillSubject[],
  existingTotals: HistoricalBackfillSnapshot[]
) {
  const snapshotMap = new Map<string, HistoricalBackfillSnapshot>();
  for (const snapshot of existingTotals) {
    snapshotMap.set(cellKey(snapshot.studentId, snapshot.subjectId), snapshot);
  }

  const nextDrafts: Record<string, DraftCell> = {};
  for (const student of students) {
    for (const subject of subjects) {
      const key = cellKey(student.studentId, subject.id);
      const snapshot = snapshotMap.get(key);
      nextDrafts[key] = {
        total: snapshot ? String(snapshot.total) : "",
        notes: snapshot?.notes ?? "",
      };
    }
  }

  return nextDrafts;
}

function makeSnapshotMap(existingTotals: HistoricalBackfillSnapshot[]) {
  return new Map(
    existingTotals.map((snapshot) => [cellKey(snapshot.studentId, snapshot.subjectId), snapshot] as const)
  );
}

export function HistoricalBackfillWorkspace({
  sessionId,
  termId,
  classId,
  sessionName,
  termName,
  className,
  students,
  subjects,
  existingTotals,
  isLoading = false,
  onSave,
}: HistoricalBackfillWorkspaceProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftCell>>({});
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const snapshotMap = useMemo(() => makeSnapshotMap(existingTotals), [existingTotals]);
  const seedKey = useMemo(
    () =>
      [
        sessionId,
        termId,
        classId,
        students.length,
        subjects.length,
        existingTotals
          .map((snapshot) =>
            [
              snapshot.studentId,
              snapshot.subjectId,
              snapshot.total,
              snapshot.notes ?? "",
              snapshot.updatedAt,
            ].join(":")
          )
          .sort()
          .join("|")
      ].join("::"),
    [classId, existingTotals, sessionId, students.length, subjects.length, termId]
  );

  useEffect(() => {
    setDrafts(buildSeedDrafts(students, subjects, existingTotals));
    setSaveSuccess(null);
    setSaveError(null);
  }, [existingTotals, seedKey, students, subjects]);

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = [];

    for (const student of students) {
      for (const subject of subjects) {
        const key = cellKey(student.studentId, subject.id);
        const draft = drafts[key];
        const snapshot = snapshotMap.get(key);
        const label = `${student.studentName} · ${subject.name}`;
        const totalText = formatNumber(draft?.total ?? "");
        const notesText = draft?.notes ?? "";

        if (snapshot && totalText.length === 0) {
          issues.push({
            key,
            label,
            message: "Historical totals cannot be cleared here. Enter a replacement value instead.",
          });
          continue;
        }

        if (totalText.length > 0) {
          const parsed = Number(totalText);
          if (Number.isNaN(parsed)) {
            issues.push({
              key,
              label,
              message: "Enter a valid number between 0 and 100.",
            });
            continue;
          }

          if (parsed < 0 || parsed > 100) {
            issues.push({
              key,
              label,
              message: "Totals must stay within 0-100.",
            });
            continue;
          }
        }

        if (notesText.length > 500) {
          issues.push({
            key,
            label,
            message: "Notes cannot exceed 500 characters.",
          });
        }
      }
    }

    return issues;
  }, [drafts, snapshotMap, students, subjects]);

  const issueMap = useMemo(() => {
    return new Map(validationIssues.map((issue) => [issue.key, issue] as const));
  }, [validationIssues]);

  const totalCells = students.length * subjects.length;
  const filledCells = useMemo(() => {
    let count = 0;
    for (const student of students) {
      for (const subject of subjects) {
        const draft = drafts[cellKey(student.studentId, subject.id)];
        if (formatNumber(draft?.total ?? "").length > 0) {
          count += 1;
        }
      }
    }
    return count;
  }, [drafts, students, subjects]);

  const overwriteCount = useMemo(() => {
    let count = 0;
    for (const student of students) {
      for (const subject of subjects) {
        const key = cellKey(student.studentId, subject.id);
        const draft = drafts[key];
        const snapshot = snapshotMap.get(key);
        if (!snapshot || !draft) continue;
        if (draft.total.trim() === "") continue;
        if (draft.total.trim() !== String(snapshot.total) || (draft.notes ?? "") !== (snapshot.notes ?? "")) {
          count += 1;
        }
      }
    }
    return count;
  }, [drafts, snapshotMap, students, subjects]);

  const hasUnsavedChanges = useMemo(() => {
    for (const student of students) {
      for (const subject of subjects) {
        const key = cellKey(student.studentId, subject.id);
        const draft = drafts[key];
        const snapshot = snapshotMap.get(key);
        const total = draft?.total.trim() ?? "";
        const notes = draft?.notes ?? "";
        const snapshotTotal = snapshot ? String(snapshot.total) : "";
        const snapshotNotes = snapshot?.notes ?? "";

        if (total !== snapshotTotal || notes !== snapshotNotes) {
          return true;
        }
      }
    }

    return false;
  }, [drafts, snapshotMap, students, subjects]);

  const handleCellChange = (studentId: string, subjectId: string, field: keyof DraftCell, value: string) => {
    setDrafts((current) => ({
      ...current,
      [cellKey(studentId, subjectId)]: {
        total: current[cellKey(studentId, subjectId)]?.total ?? "",
        notes: current[cellKey(studentId, subjectId)]?.notes ?? "",
        [field]: value,
      },
    }));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleDiscard = () => {
    setDrafts(buildSeedDrafts(students, subjects, existingTotals));
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSave = async () => {
    if (validationIssues.length > 0 || isSaving) return;

    const entries = [] as Array<{
      studentId: string;
      subjectId: string;
      total: number;
      notes?: string | null;
    }>;

    for (const student of students) {
      for (const subject of subjects) {
        const key = cellKey(student.studentId, subject.id);
        const draft = drafts[key];
        const totalText = draft?.total.trim() ?? "";
        if (!totalText) continue;

        entries.push({
          studentId: student.studentId,
          subjectId: subject.id,
          total: Number(totalText),
          notes: draft?.notes.trim() ? draft.notes.trim() : null,
        });
      }
    }

    if (entries.length === 0) {
      setSaveError("Enter at least one historical total before saving.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const result = await onSave({ sessionId, termId, classId, entries });
      setSaveSuccess(`Saved ${result.created} new and ${result.updated} updated historical total${result.created + result.updated === 1 ? "" : "s"}.`);
      setDrafts((current) => {
        const next = { ...current };
        for (const entry of entries) {
          const key = cellKey(entry.studentId, entry.subjectId);
          next[key] = {
            total: String(entry.total),
            notes: entry.notes ?? "",
          };
        }
        return next;
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save historical totals.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = totalCells - filledCells;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Audit-safe backfill
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
              Live assessment rows stay untouched
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            Enter prior-term totals for {className} in {sessionName} / {termName}. Each saved cell overwrites only the historical snapshot for that student and subject; it never changes the regular CA/exam sheet.
          </p>
        </div>

        <StatGroup
          variant="wrap"
          stats={[
            { label: "Students", value: students.length },
            { label: "Subjects", value: subjects.length },
            { label: "Filled", value: filledCells, description: "/ cells" },
            { label: "Pending", value: pendingCount, description: "/ cells" },
          ]}
        />
      </div>

      {(saveError || saveSuccess || validationIssues.length > 0) && (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {validationIssues.length > 0 ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <p className="font-bold">Fix the highlighted cells before saving.</p>
                  <p className="mt-1 text-xs text-rose-700">
                    Totals must stay between 0 and 100. Existing historical totals cannot be blanked out from this workspace.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {validationIssues.slice(0, 6).map((issue) => (
                      <div key={issue.key} className="rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-medium text-rose-800">
                        <span className="font-bold uppercase tracking-[0.14em] text-rose-500">{issue.label}</span>
                        <span className="ml-2">{issue.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {saveError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              {saveError}
            </div>
          ) : null}

          {saveSuccess ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
              {saveSuccess}
            </div>
          ) : null}
        </div>
      )}

      <div className="space-y-4">
        {students.map((student) => (
          <section key={student.studentId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Student roster</p>
                <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-950">
                  {student.studentName}
                </h3>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Admission {student.admissionNumber}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600">
                {subjects.length} subject{subjects.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {subjects.map((subject) => {
                const key = cellKey(student.studentId, subject.id);
                const draft = drafts[key] ?? { total: "", notes: "" };
                const snapshot = snapshotMap.get(key);
                const issue = issueMap.get(key);
                const isOverwritten = Boolean(snapshot) && (
                  draft.total.trim() !== String(snapshot?.total) ||
                  (draft.notes ?? "") !== (snapshot?.notes ?? "")
                );

                return (
                  <div key={subject.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.7fr_1.4fr_auto] lg:items-start">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Subject</p>
                      <p className="mt-1 font-bold text-slate-900">{subject.name}</p>
                    </div>

                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total /100</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.total}
                        onChange={(event) => handleCellChange(student.studentId, subject.id, "total", event.target.value)}
                        className={`h-11 w-full rounded-2xl border px-3 text-sm font-bold text-slate-950 outline-none transition focus:ring-4 focus:ring-slate-950/5 ${issue ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"}`}
                        placeholder="Enter total"
                      />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Notes</span>
                      <input
                        type="text"
                        value={draft.notes}
                        onChange={(event) => handleCellChange(student.studentId, subject.id, "notes", event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:ring-4 focus:ring-slate-950/5"
                        placeholder="Optional audit note"
                        maxLength={500}
                      />
                    </label>

                    <div className="flex h-full items-start gap-2 pt-1 lg:justify-end">
                      <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${snapshot ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {snapshot ? (isOverwritten ? "Updated" : "Saved") : "New"}
                      </div>
                      {snapshot ? (
                        <div className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          <p>Original {snapshot.total}</p>
                          <p>{snapshot.source.replace("_", " ")}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="sticky bottom-4 z-10 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Commit protocol</p>
            <p className="text-sm font-medium text-slate-600">
              Saving only writes historical totals. It never edits the live term assessment sheet.
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {overwriteCount} cell{overwriteCount === 1 ? "" : "s"} will be overwritten on save.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isSaving || !hasUnsavedChanges}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges || validationIssues.length > 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save backfill"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">{isLoading ? "Loading roster..." : `${students.length} students loaded`}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{subjects.length} subjects</span>
          <Link href="/assessments/report-cards" className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 transition hover:bg-emerald-100">
            Review report cards
          </Link>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            <FilePenLine className="mr-1 inline-block h-3.5 w-3.5" />
            Audit trail stays in the historical snapshot table
          </span>
        </div>
      </div>
    </div>
  );
}
