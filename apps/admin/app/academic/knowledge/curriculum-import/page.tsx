"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import { BookOpenCheck, RefreshCw } from "lucide-react";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { CurriculumImportSidebar } from "./components/CurriculumImportSidebar";
import { CurriculumApprovalDialog } from "./components/CurriculumApprovalDialog";
import { CurriculumUnitCard } from "./components/CurriculumUnitCard";
import { CurriculumUnitEditor, type UnitEditValues } from "./components/CurriculumUnitEditor";
import { getCurriculumErrorMessage } from "./components/curriculumErrorMessage";
import type { CurriculumImportForm, CurriculumImportSummary, CurriculumUnit } from "./components/types";

type Context = { sources: Array<{ _id: string; title: string; level: string; subjectId?: string }>; imports: CurriculumImportSummary[] };
type Subject = { _id: string; name: string };
type Session = { _id: string; isActive: boolean };
type Term = { _id: string; name: string; isActive: boolean };
type Review = { status: string; errorMessage?: string; units: CurriculumUnit[] };

const EMPTY_FORM: CurriculumImportForm = { materialId: "", subjectId: "", level: "", termId: "" };

export default function CurriculumImportPage() {
  const context = useQuery(api.functions.academic.curriculumAdminRead.listCurriculumImportContext) as Context | undefined;
  const subjects = useQuery(api.functions.academic.academicSetup.listSubjects) as Subject[] | undefined;
  const sessions = useQuery(api.functions.academic.academicSetup.listSessions) as Session[] | undefined;
  const activeSession = sessions?.find((session) => session.isActive);
  const terms = useQuery(api.functions.academic.academicSetup.listTermsBySession, activeSession ? { sessionId: activeSession._id } : "skip") as Term[] | undefined;
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [approvalUnit, setApprovalUnit] = useState<CurriculumUnit | null>(null);
  const [form, setForm] = useState<CurriculumImportForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const review = useQuery(api.functions.academic.curriculumAdminRead.getCurriculumImportReview, selectedImportId ? { importId: selectedImportId } : "skip") as Review | undefined;
  const createImport = useMutation(api.functions.academic.curriculumImportLifecycle.createCurriculumImport);
  const reviewUnit = useMutation(api.functions.academic.curriculumReviewLifecycle.reviewCurriculumUnit);
  const approveUnit = useMutation(api.functions.academic.curriculumReviewLifecycle.approveCurriculumUnit);
  const selectedImport = useMemo(() => context?.imports.find((item) => item._id === selectedImportId) ?? null, [context, selectedImportId]);
  const editingUnit = review?.units.find((unit) => unit._id === editingUnitId) ?? null;

  useEffect(() => {
    if (!selectedImportId && context?.imports[0]) setSelectedImportId(context.imports[0]._id);
  }, [context, selectedImportId]);
  useEffect(() => setEditingUnitId(null), [selectedImportId]);

  const startImport = async () => {
    if (!form.materialId || !form.subjectId || !form.level.trim() || !form.termId || busy) return;
    setBusy(true);
    try {
      const importId = await createImport({ ...form, level: form.level.trim() }) as string;
      setSelectedImportId(importId);
      const response = await fetch("/api/ai/curriculum/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId }),
      });
      const payload = await response.json().catch(() => null) as unknown;
      if (!response.ok) throw new Error(getCurriculumErrorMessage(payload, "Generation could not start."));
      appToast.success("Proposal ready", { description: "Review each unit before approving it as an academic topic." });
    } catch (error) {
      appToast.error("Import could not start", { description: getCurriculumErrorMessage(error, "Check the source and academic context, then try again.") });
    } finally {
      setBusy(false);
    }
  };

  const saveUnit = async (unit: CurriculumUnit, values: UnitEditValues) => {
    if (busy) return;
    setBusy(true);
    try {
      await reviewUnit({ unitId: unit._id, reviewStatus: "proposed", ...values });
      appToast.success("Unit updated");
      setEditingUnitId(null);
    } catch (error) {
      appToast.error("Review update failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const rejectUnit = async (unit: CurriculumUnit) => {
    if (busy) return;
    setBusy(true);
    try {
      await reviewUnit({ unitId: unit._id, reviewStatus: "rejected" });
      appToast.success("Unit rejected");
      if (editingUnitId === unit._id) setEditingUnitId(null);
    } catch (error) {
      appToast.error("Review update failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (unit: CurriculumUnit) => {
    setBusy(true);
    try {
      await approveUnit({ unitId: unit._id });
      appToast.success("Topic approved", { description: "The topic is now available in the academic knowledge workflow." });
      setApprovalUnit(null);
      if (editingUnitId === unit._id) setEditingUnitId(null);
    } catch (error) {
      appToast.error("Approval failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  if (!context || !subjects || !sessions || (activeSession && !terms)) return <div className="p-6 text-sm font-bold text-slate-500">Loading curriculum workspace…</div>;
  if (!activeSession) return <NoActiveSession />;

  return (
    <main className="min-h-screen bg-surface-200 lg:h-[calc(100vh-52px)] lg:overflow-hidden">
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-5 py-4 lg:px-8">
          <AdminHeader label="Academic knowledge" title="Curriculum intelligence" description="Turn an extracted scheme of work into evidence-backed topics, one human approval at a time." />
        </div>
        <div className="grid min-h-0 flex-1 border-t border-slate-200/70 lg:grid-cols-[320px_minmax(420px,1fr)_360px]">
          <CurriculumImportSidebar sources={context.sources} subjects={subjects} terms={terms ?? []} imports={context.imports} form={form} busy={busy} selectedImportId={selectedImportId} onFormChange={setForm} onSelectImport={setSelectedImportId} onSubmit={() => void startImport()} />
          <section className="min-w-0 bg-slate-50/40 lg:h-full lg:overflow-y-auto custom-scrollbar">
            <ReviewHeader selectedImport={selectedImport} generating={review?.status === "generating"} />
            {review?.status === "failed" && <p className="m-4 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{getCurriculumErrorMessage(review.errorMessage, "Generation failed. Check the extracted source, then create a fresh proposal.")}</p>}
            <div>{review?.units.map((unit) => <CurriculumUnitCard key={unit._id} unit={unit} busy={busy} selected={unit._id === editingUnitId} onEdit={(item) => setEditingUnitId(item._id)} onReject={(item) => void rejectUnit(item)} onApprove={setApprovalUnit} />)}</div>
            {review && review.units.length === 0 && review.status !== "generating" && <EmptyReview />}
            {!selectedImport && <EmptyReview label="Choose an import to review" />}
          </section>
          <aside className="border-l border-slate-200/70 bg-white lg:h-full lg:overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Inspector</p></div>
            <CurriculumUnitEditor unit={editingUnit} busy={busy} onClose={() => setEditingUnitId(null)} onSave={saveUnit} />
          </aside>
        </div>
        <CurriculumApprovalDialog unit={approvalUnit} busy={busy} onCancel={() => setApprovalUnit(null)} onConfirm={(unit) => void approve(unit)} />
      </div>
    </main>
  );
}

function ReviewHeader({ selectedImport, generating }: { selectedImport: CurriculumImportSummary | null; generating: boolean }) {
  return <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200/70 bg-white/95 px-5 py-4 backdrop-blur"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Review queue</p><h2 className="mt-1 text-base font-black text-slate-950">{selectedImport?.sourceLabel ?? "No import selected"}</h2>{selectedImport && <p className="mt-1 text-[10px] text-slate-500">{selectedImport.subjectLabel} · {selectedImport.termLabel} · {selectedImport.level}</p>}</div>{generating && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating</span>}</div>;
}

function EmptyReview({ label = "No review units are available yet." }: { label?: string }) {
  return <p className="py-16 text-center text-sm text-slate-500"><BookOpenCheck className="mx-auto mb-2 h-5 w-5" />{label}</p>;
}

function NoActiveSession() {
  return <main className="min-h-screen bg-surface-200 p-6"><div className="mx-auto max-w-3xl space-y-4"><AdminHeader label="Academic knowledge" title="Curriculum intelligence" description="Turn an extracted scheme of work into evidence-backed topics, one human approval at a time." /><section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><b>No active session is set up.</b><p className="mt-1">Create and activate a school session before starting a curriculum proposal.</p></section></div></main>;
}
