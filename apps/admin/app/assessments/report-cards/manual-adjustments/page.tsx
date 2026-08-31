"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  CalendarDays,
  ClipboardPaste,
  RotateCcw,
  Save,
  School2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReportCardSheetData } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { getUserFacingErrorMessage } from "@school/shared";

type SelectorOption = { id: string; name: string };
type StudentOption = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
};
type TermKey = "first" | "second" | "current";
type BaseResultRow = ReportCardSheetData["results"][number];
type ManualAdjustment = NonNullable<BaseResultRow["manualAdjustment"]> & {
  reason: string;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
};
type ResultRow = Omit<BaseResultRow, "manualAdjustment"> & {
  manualAdjustment: ManualAdjustment | null;
};
type ManualAdjustmentRecord = Omit<ManualAdjustment, "divisor" | "computedAverage"> & {
  _id: string;
  subjectId: string;
};

type Draft = {
  enabled: boolean;
  includedTerms: TermKey[];
  finalTotalOverride: string;
};

const TERM_KEYS: TermKey[] = ["first", "second", "current"];
const TERM_LABELS: Record<TermKey, string> = {
  first: "1st",
  second: "2nd",
  current: "3rd",
};

function valueForTerm(row: ResultRow, key: TermKey) {
  if (key === "first") return row.firstTermTotal ?? null;
  if (key === "second") return row.secondTermTotal ?? null;
  return row.currentTermTotal ?? null;
}

function availableTerms(row: ResultRow) {
  return TERM_KEYS.filter((key) => valueForTerm(row, key) !== null);
}

function normalizeTerms(values: TermKey[]) {
  const selected = new Set(values);
  return TERM_KEYS.filter((key) => selected.has(key));
}

function calculateDraftAverage(row: ResultRow, draft: Draft) {
  const values = draft.includedTerms.map((key) => valueForTerm(row, key));
  if (values.length === 0 || values.some((value) => value === null)) return null;
  const total = (values as number[]).reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function formatScore(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function seedDraft(row: ResultRow): Draft {
  const saved = row.manualAdjustment;
  return {
    enabled: Boolean(saved),
    includedTerms: saved?.includedTerms ?? availableTerms(row),
    finalTotalOverride:
      saved?.finalTotalOverride !== null && saved?.finalTotalOverride !== undefined
        ? String(saved.finalTotalOverride)
        : "",
  };
}

function sameDraftAsSaved(row: ResultRow, draft: Draft) {
  const saved = row.manualAdjustment;
  if (!saved) return !draft.enabled;
  if (!draft.enabled) return false;

  const savedTerms = normalizeTerms(saved.includedTerms);
  const draftTerms = normalizeTerms(draft.includedTerms);
  const savedFinal = saved.finalTotalOverride === null ? "" : String(saved.finalTotalOverride);
  return savedTerms.join("|") === draftTerms.join("|") && savedFinal === draft.finalTotalOverride.trim();
}

function extractPastedScores(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t")[0]?.trim() ?? "")
    .filter((value) => value.length > 0);
}

export default function ManualAdjustmentsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ManualAdjustmentsPageContent />
    </Suspense>
  );
}

function ManualAdjustmentsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selection = useMemo(
    () => ({
      sessionId: searchParams.get("sessionId"),
      termId: searchParams.get("termId"),
      classId: searchParams.get("classId"),
      studentId: searchParams.get("studentId"),
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
  const students = useQuery(
    "functions/academic/reportCards:getStudentsForReportCardBatch" as never,
    selection.sessionId && selection.termId && selection.classId
      ? ({
          sessionId: selection.sessionId,
          termId: selection.termId,
          classId: selection.classId,
        } as never)
      : ("skip" as never)
  ) as StudentOption[] | undefined;
  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.studentId
      ? ({
          sessionId: selection.sessionId,
          termId: selection.termId,
          classId: selection.classId,
          studentId: selection.studentId,
        } as never)
      : ("skip" as never)
  ) as ReportCardSheetData | undefined;
  const manualAdjustments = useQuery(
    "functions/academic/reportCardManualAdjustments:listManualAdjustmentsForStudent" as never,
    selection.sessionId &&
      selection.termId &&
      selection.classId &&
      selection.studentId
      ? ({
          sessionId: selection.sessionId,
          termId: selection.termId,
          classId: selection.classId,
          studentId: selection.studentId,
        } as never)
      : ("skip" as never)
  ) as ManualAdjustmentRecord[] | undefined;
  const saveAdjustments = useMutation(
    "functions/academic/reportCardManualAdjustments:saveManualAdjustmentsBulk" as never
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const cumulativeRows = useMemo(() => {
    if (!reportCard || !manualAdjustments) return [];
    const adjustmentBySubjectId = new Map(
      manualAdjustments.map((adjustment) => [adjustment.subjectId, adjustment] as const)
    );

    return reportCard.results
      .filter((row) => row.calculationMode === "cumulative_annual")
      .map((row): ResultRow => {
        const auditAdjustment = adjustmentBySubjectId.get(row.subjectId);
        return {
          ...row,
          manualAdjustment:
            row.manualAdjustment && auditAdjustment
              ? { ...row.manualAdjustment, ...auditAdjustment }
              : null,
        };
      });
  }, [manualAdjustments, reportCard]);
  const seedSignature = useMemo(
    () =>
      cumulativeRows
        .map((row) =>
          JSON.stringify({
            subjectId: row.subjectId,
            first: row.firstTermTotal,
            second: row.secondTermTotal,
            current: row.currentTermTotal,
            adjustment: row.manualAdjustment,
          })
        )
        .join("|"),
    [cumulativeRows]
  );

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        cumulativeRows.map((row) => [row.subjectId, seedDraft(row)] as const)
      )
    );
    setReason("");
  }, [cumulativeRows, seedSignature]);

  const replaceSelection = useCallback(
    (next: Partial<typeof selection>) => {
      setNotice(null);
      const params = new URLSearchParams(searchParams.toString());
      for (const key of ["sessionId", "termId", "classId", "studentId"] as const) {
        if (next[key] === undefined) continue;
        if (next[key]) params.set(key, next[key]!);
        else params.delete(key);
      }
      if (next.sessionId !== undefined) {
        params.delete("termId");
        params.delete("classId");
        params.delete("studentId");
      } else if (next.termId !== undefined) {
        params.delete("classId");
        params.delete("studentId");
      } else if (next.classId !== undefined) {
        params.delete("studentId");
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const changedRows = useMemo(
    () =>
      cumulativeRows.filter((row) => {
        const draft = drafts[row.subjectId];
        return draft ? !sameDraftAsSaved(row, draft) : false;
      }),
    [cumulativeRows, drafts]
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const row of changedRows) {
      const draft = drafts[row.subjectId];
      if (!draft?.enabled) continue;
      if (draft.includedTerms.length === 0) {
        errors.push(`${row.subjectName}: choose at least one term.`);
        continue;
      }
      const finalText = draft.finalTotalOverride.trim();
      const finalValue = finalText === "" ? null : Number(finalText);
      if (finalValue !== null && (!Number.isFinite(finalValue) || finalValue < 0 || finalValue > 100)) {
        errors.push(`${row.subjectName}: final override must be between 0 and 100.`);
        continue;
      }
      if (finalValue === null && calculateDraftAverage(row, draft) === null) {
        errors.push(`${row.subjectName}: exclude blank terms or enter a final override.`);
      }
    }
    return errors;
  }, [changedRows, drafts]);

  const updateDraft = (subjectId: string, update: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [subjectId]: { ...current[subjectId], ...update },
    }));
    setNotice(null);
  };

  const toggleTerm = (row: ResultRow, key: TermKey) => {
    const draft = drafts[row.subjectId] ?? seedDraft(row);
    const selected = new Set(draft.includedTerms);
    if (selected.has(key)) selected.delete(key);
    else selected.add(key);
    updateDraft(row.subjectId, {
      enabled: true,
      includedTerms: normalizeTerms([...selected]),
    });
  };

  const applyAvailableTermsToAll = () => {
    setDrafts((current) =>
      Object.fromEntries(
        cumulativeRows.map((row) => [
          row.subjectId,
          {
            ...(current[row.subjectId] ?? seedDraft(row)),
            enabled: true,
            includedTerms: availableTerms(row),
          },
        ])
      )
    );
    setNotice(null);
  };

  const resetAll = () => {
    setDrafts(
      Object.fromEntries(
        cumulativeRows.map((row) => [
          row.subjectId,
          { ...seedDraft(row), enabled: false },
        ])
      )
    );
    setNotice(null);
  };

  const handleScorePaste = (startIndex: number, text: string) => {
    const scores = extractPastedScores(text);
    if (scores.length <= 1) return false;
    setDrafts((current) => {
      const next = { ...current };
      scores.forEach((score, offset) => {
        const row = cumulativeRows[startIndex + offset];
        if (!row) return;
        next[row.subjectId] = {
          ...(next[row.subjectId] ?? seedDraft(row)),
          enabled: true,
          finalTotalOverride: score,
        };
      });
      return next;
    });
    setNotice(null);
    return true;
  };

  const handleSave = async () => {
    if (
      !selection.sessionId ||
      !selection.termId ||
      !selection.classId ||
      !selection.studentId ||
      isSaving
    ) return;
    if (changedRows.length === 0) {
      setNotice({ tone: "error", message: "There are no unsaved adjustments." });
      return;
    }
    if (!reason.trim()) {
      setNotice({ tone: "error", message: "Enter a reason for this adjustment save." });
      return;
    }
    if (validationErrors.length > 0) {
      setNotice({ tone: "error", message: validationErrors[0] });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const result = (await saveAdjustments({
        sessionId: selection.sessionId,
        termId: selection.termId,
        classId: selection.classId,
        studentId: selection.studentId,
        entries: changedRows.map((row) => {
          const draft = drafts[row.subjectId];
          const finalText = draft.finalTotalOverride.trim();
          return {
            subjectId: row.subjectId,
            reset: !draft.enabled,
            includedTerms: draft.enabled ? draft.includedTerms : [],
            finalTotalOverride:
              draft.enabled && finalText !== "" ? Number(finalText) : null,
            reason: reason.trim(),
          };
        }),
      } as never)) as { created: number; updated: number; reset: number };
      setReason("");
      setNotice({
        tone: "success",
        message: `Saved ${result.created + result.updated} adjustment${result.created + result.updated === 1 ? "" : "s"} and reset ${result.reset}.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Unable to save manual adjustments"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const ready = Boolean(
    selection.sessionId && selection.termId && selection.classId && selection.studentId
  );
  const selectedStudent = students?.find((student) => student.studentId === selection.studentId);
  const activeAdjustmentCount = cumulativeRows.filter((row) => row.manualAdjustment).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_32%),linear-gradient(180deg,_#f8fafc,_#eef2ff_55%,_#f8fafc)]">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-6 md:py-10">
        <AdminHeader
          label="Administrative Result Control"
          title="Manual Annual Adjustments"
          description="Use recorded term totals, choose the terms that count, and optionally set a final annual score without changing the original assessment sheets."
          actions={
            <Link
              href="/assessments/report-cards"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.16em] text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Report cards
            </Link>
          }
        />

        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Selector
              label="Session"
              icon={<CalendarDays className="h-4 w-4" />}
              value={selection.sessionId ?? ""}
              options={sessions ?? []}
              placeholder="Select session"
              onChange={(value) => replaceSelection({ sessionId: value || null })}
            />
            <Selector
              label="Annual term"
              icon={<Calculator className="h-4 w-4" />}
              value={selection.termId ?? ""}
              options={terms ?? []}
              placeholder={selection.sessionId ? "Select third term" : "Choose session first"}
              disabled={!selection.sessionId}
              onChange={(value) => replaceSelection({ termId: value || null })}
            />
            <Selector
              label="Class"
              icon={<School2 className="h-4 w-4" />}
              value={selection.classId ?? ""}
              options={classes ?? []}
              placeholder={selection.termId ? "Select class" : "Choose term first"}
              disabled={!selection.termId}
              onChange={(value) => replaceSelection({ classId: value || null })}
            />
            <Selector
              label="Student"
              icon={<UserRound className="h-4 w-4" />}
              value={selection.studentId ?? ""}
              options={(students ?? []).map((student) => ({
                id: student.studentId,
                name: `${student.studentName} · ${student.admissionNumber}`,
              }))}
              placeholder={selection.classId ? "Select student" : "Choose class first"}
              disabled={!selection.classId}
              onChange={(value) => replaceSelection({ studentId: value || null })}
            />
          </div>
        </section>

        {!ready ? (
          <EmptyState
            title="Choose a student to open the adjustment grid"
            message="Select the cumulative annual term, class, and student. Existing scores will load directly from the normal term records."
          />
        ) : reportCard === undefined ? (
          <EmptyState title="Loading annual result data..." message="Preparing recorded term totals and saved administrative adjustments." />
        ) : reportCard.resultCalculationMode !== "cumulative_annual" ? (
          <EmptyState
            title="This is not a cumulative annual term"
            message="Manual annual divisors are only available when the selected third term uses the cumulative annual report-card mode."
          />
        ) : cumulativeRows.length === 0 ? (
          <EmptyState title="No cumulative subjects found" message="This student has no eligible report-card subjects in the selected context." />
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    {selectedStudent?.studentName ?? reportCard.student.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                    {reportCard.className}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    {activeAdjustmentCount} active override{activeAdjustmentCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-relaxed text-slate-600">
                  Blank means no score was recorded; a real zero remains <strong>0</strong>. Select only the terms that should count. The divisor always equals the number of selected terms.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <button
                  type="button"
                  onClick={applyAvailableTermsToAll}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-indigo-50 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Calculator className="h-3.5 w-3.5" /> Use available terms
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset all
                </button>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[1120px] w-full border-collapse text-sm">
                  <thead className="bg-slate-950 text-white">
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.16em]">
                      <th className="sticky left-0 z-10 bg-slate-950 px-4 py-4">Subject</th>
                      <th className="px-3 py-4 text-center">1st</th>
                      <th className="px-3 py-4 text-center">2nd</th>
                      <th className="px-3 py-4 text-center">3rd</th>
                      <th className="px-3 py-4">Included terms</th>
                      <th className="px-3 py-4 text-center">Divisor</th>
                      <th className="px-3 py-4 text-center">Calculated</th>
                      <th className="px-3 py-4">Final override</th>
                      <th className="px-3 py-4 text-center">Control</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cumulativeRows.map((row, rowIndex) => {
                      const draft = drafts[row.subjectId] ?? seedDraft(row);
                      const calculated = calculateDraftAverage(row, draft);
                      const saved = row.manualAdjustment;
                      return (
                        <tr key={row.subjectId} className={draft.enabled ? "bg-indigo-50/30" : "bg-white"}>
                          <td className="sticky left-0 z-10 min-w-[220px] border-r border-slate-100 bg-inherit px-4 py-4">
                            <p className="font-extrabold text-slate-950">{row.subjectName}</p>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              {saved ? `Adjusted · ${saved.reason}` : "Standard calculation"}
                            </p>
                          </td>
                          {TERM_KEYS.map((key) => (
                            <td key={key} className="px-3 py-4 text-center font-black text-slate-800">
                              {formatScore(valueForTerm(row, key))}
                            </td>
                          ))}
                          <td className="min-w-[250px] px-3 py-4">
                            <div className="flex gap-2">
                              {TERM_KEYS.map((key) => {
                                const checked = draft.includedTerms.includes(key);
                                const missing = valueForTerm(row, key) === null;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggleTerm(row, key)}
                                    className={`h-9 min-w-14 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] transition ${checked ? "border-indigo-600 bg-indigo-600 text-white" : missing ? "border-rose-200 bg-rose-50 text-rose-500" : "border-slate-200 bg-white text-slate-500"}`}
                                    title={missing ? "No recorded score" : `${TERM_LABELS[key]} term score available`}
                                  >
                                    {TERM_LABELS[key]}{missing ? " —" : ""}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-100 px-3 font-black text-slate-700">
                              ÷ {draft.includedTerms.length}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center font-black text-indigo-700">
                            {formatScore(calculated)}
                          </td>
                          <td className="min-w-[150px] px-3 py-4">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={draft.finalTotalOverride}
                              onChange={(event) => updateDraft(row.subjectId, {
                                enabled: true,
                                finalTotalOverride: event.target.value,
                              })}
                              onPaste={(event) => {
                                if (handleScorePaste(rowIndex, event.clipboardData.getData("text"))) {
                                  event.preventDefault();
                                }
                              }}
                              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-950 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              placeholder="Optional"
                              aria-label={`${row.subjectName} final score override`}
                            />
                          </td>
                          <td className="px-3 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => updateDraft(row.subjectId, {
                                ...seedDraft(row),
                                enabled: !draft.enabled,
                              })}
                              className={`h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.14em] transition ${draft.enabled ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-slate-950 text-white hover:bg-slate-800"}`}
                            >
                              {draft.enabled ? (saved ? "Reset" : "Cancel") : "Adjust"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                <ClipboardPaste className="h-4 w-4 text-indigo-500" />
                Paste a vertical column copied from Excel directly into any Final override cell to fill downward.
              </div>
            </section>

            <section className="sticky bottom-4 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.18)] backdrop-blur">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> Required audit reason
                  </span>
                  <input
                    type="text"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    placeholder="Example: Student was absent in first term; average only recorded terms."
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || changedRows.length === 0 || validationErrors.length > 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Saving..." : `Save ${changedRows.length} change${changedRows.length === 1 ? "" : "s"}`}
                </button>
              </div>
              {(notice || validationErrors.length > 0) && (
                <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${notice?.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                  {notice?.message ?? validationErrors[0]}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Selector({
  label,
  icon,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: SelectorOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {icon} {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-8 shadow-sm">
      <p className="font-extrabold text-slate-950">{title}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{message}</p>
    </section>
  );
}

function PageFallback() {
  return <div className="mx-auto max-w-7xl px-4 py-8 text-sm font-semibold text-slate-500">Loading manual adjustment workspace...</div>;
}
