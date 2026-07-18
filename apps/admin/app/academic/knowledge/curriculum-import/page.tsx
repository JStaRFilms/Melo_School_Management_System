"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpenCheck, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { CurriculumUnitCard } from "./components/CurriculumUnitCard";
import type { CurriculumImportSummary, CurriculumUnit } from "./components/types";

type Context = { sources: Array<{ _id: string; title: string; level: string; subjectId?: string }>; imports: CurriculumImportSummary[] };
type Subject = { _id: string; name: string };
type Session = { _id: string; isActive: boolean };
type Term = { _id: string; name: string; isActive: boolean };

export default function CurriculumImportPage() {
  const context = useQuery("functions/academic/curriculumAdminRead:listCurriculumImportContext" as never) as Context | undefined;
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as Subject[] | undefined;
  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as Session[] | undefined;
  const activeSession = sessions?.find((session) => session.isActive);
  const terms = useQuery("functions/academic/academicSetup:listTermsBySession" as never, activeSession ? { sessionId: activeSession._id } as never : "skip" as never) as Term[] | undefined;
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const review = useQuery("functions/academic/curriculumAdminRead:getCurriculumImportReview" as never, selectedImportId ? { importId: selectedImportId } as never : "skip" as never) as { status: string; provider?: string; modelId?: string; errorMessage?: string; units: CurriculumUnit[] } | undefined;
  const createImport = useMutation("functions/academic/curriculumImportLifecycle:createCurriculumImport" as never);
  const reviewUnit = useMutation("functions/academic/curriculumReviewLifecycle:reviewCurriculumUnit" as never);
  const approveUnit = useMutation("functions/academic/curriculumReviewLifecycle:approveCurriculumUnit" as never);
  const [form, setForm] = useState({ materialId: "", subjectId: "", level: "", termId: "" });
  const [busy, setBusy] = useState(false);
  const selectedImport = useMemo(() => context?.imports.find((item) => item._id === selectedImportId) ?? null, [context, selectedImportId]);
  const activeTerms = terms?.filter((term) => term.isActive) ?? [];

  const startImport = async () => {
    if (!form.materialId || !form.subjectId || !form.level.trim() || !form.termId || busy) return;
    setBusy(true);
    try {
      const importId = await createImport({ ...form, level: form.level.trim() } as never) as string;
      setSelectedImportId(importId);
      const response = await fetch("/api/ai/curriculum/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ importId }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Generation could not start.");
      appToast.success("Proposal ready", { description: "Review each unit before approving it as an academic topic." });
    } catch (error) { appToast.error("Import could not start", { description: getUserFacingErrorMessage(error, "Check the source and academic context, then try again.") }); }
    finally { setBusy(false); }
  };
  const editOrReject = async (unit: CurriculumUnit, action: "proposed" | "rejected") => {
    if (busy) return;
    const title = action === "proposed" ? window.prompt("Unit title", unit.title) : unit.title;
    if (action === "proposed" && !title?.trim()) return;
    const subtopics = action === "proposed" ? window.prompt("Subtopics (separate with commas)", unit.subtopics.join(", ")) : null;
    const objectives = action === "proposed" ? window.prompt("Learning objectives (separate with commas)", unit.learningObjectives.join(", ")) : null;
    const suggestedDuration = action === "proposed" ? window.prompt("Suggested duration", unit.suggestedDuration ?? "") : null;
    if (action === "proposed" && (!subtopics?.trim() || !objectives?.trim())) return;
    setBusy(true);
    try { await reviewUnit({ unitId: unit._id, reviewStatus: action, ...(title ? { title: title.trim() } : {}), ...(subtopics ? { subtopics: subtopics.split(",").map((item) => item.trim()).filter(Boolean) } : {}), ...(objectives ? { learningObjectives: objectives.split(",").map((item) => item.trim()).filter(Boolean) } : {}), ...(suggestedDuration?.trim() ? { suggestedDuration: suggestedDuration.trim() } : {}) } as never); appToast.success(action === "rejected" ? "Unit rejected" : "Unit updated"); }
    catch (error) { appToast.error("Review update failed", { description: getUserFacingErrorMessage(error, "Try again.") }); } finally { setBusy(false); }
  };
  const approve = async (unit: CurriculumUnit) => { if (!window.confirm(`Approve “${unit.title}” as a school topic? This is a human decision.`)) return; setBusy(true); try { await approveUnit({ unitId: unit._id } as never); appToast.success("Topic approved", { description: "The unit is now available in the existing academic knowledge workflow." }); } catch (error) { appToast.error("Approval failed", { description: getUserFacingErrorMessage(error, "Try again.") }); } finally { setBusy(false); } };

  if (!context || !subjects || !sessions || (activeSession && !terms)) return <div className="p-6 text-sm font-bold text-slate-500">Loading curriculum workspace…</div>;
  if (!activeSession) return <main className="min-h-screen bg-surface-200 p-6"><div className="mx-auto max-w-3xl space-y-4"><AdminHeader label="Academic knowledge" title="Curriculum intelligence" description="Turn an extracted scheme of work into evidence-backed topics, one human approval at a time." /><section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><b>No active session is set up.</b><p className="mt-1">Create and activate a school session, then activate a term before starting a curriculum proposal.</p></section></div></main>;
  return <main className="min-h-screen bg-surface-200 p-4 md:p-6"><div className="mx-auto max-w-6xl space-y-5"><AdminHeader label="Academic knowledge" title="Curriculum intelligence" description="Turn an extracted scheme of work into evidence-backed topics, one human approval at a time." />
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]"><form onSubmit={(event) => { event.preventDefault(); void startImport(); }} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">New proposal</p><label htmlFor="curriculum-source" className="text-[10px] font-bold text-slate-600">Ready curriculum source</label><select id="curriculum-source" required value={form.materialId} onChange={(event) => { const source = context.sources.find((item) => item._id === event.target.value); setForm((current) => ({ ...current, materialId: event.target.value, level: current.level || source?.level || "", subjectId: current.subjectId || source?.subjectId || "" })); }} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold"><option value="">Choose source</option>{context.sources.map((source) => <option key={source._id} value={source._id}>{source.title}</option>)}</select><label htmlFor="curriculum-subject" className="text-[10px] font-bold text-slate-600">Subject</label><select id="curriculum-subject" required value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold"><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject._id} value={subject._id}>{subject.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><label htmlFor="curriculum-level" className="text-[10px] font-bold text-slate-600">Level<input id="curriculum-level" required value={form.level} onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))} placeholder="Level" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold" /></label><label htmlFor="curriculum-term" className="text-[10px] font-bold text-slate-600">Active term<select id="curriculum-term" required value={form.termId} onChange={(event) => setForm((current) => ({ ...current, termId: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-2 text-xs font-bold"><option value="">Choose term</option>{activeTerms.map((term) => <option key={term._id} value={term._id}>{term.name}</option>)}</select></label></div><button disabled={busy} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Extract proposal</button><p className="text-[10px] leading-4 text-slate-500">The model proposes units only. Nothing becomes a school topic until an administrator approves it.</p></form>
      <section className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-3 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Recent imports</div>{context.imports.length === 0 ? <p className="p-5 text-sm text-slate-500">No curriculum imports yet.</p> : context.imports.map((item) => <button key={item._id} onClick={() => setSelectedImportId(item._id)} className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${selectedImportId === item._id ? "bg-blue-50/60" : "hover:bg-slate-50"}`}><span><b className="block text-xs text-slate-900">{item.sourceLabel}</b><span className="text-[10px] text-slate-500">{item.subjectLabel} · {item.termLabel} · {item.level}</span></span><span className="text-right text-[9px] font-black uppercase tracking-wider text-slate-500">{item.status.replaceAll("_", " ")}<br />{item.approvedUnitCount}/{item.proposedUnitCount} approved</span></button>)}</section></section>
    {selectedImport && <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Review queue</p><h2 className="mt-1 text-lg font-black text-slate-950">{selectedImport.sourceLabel}</h2><p className="mt-1 text-xs text-slate-500">{review?.provider && review?.modelId ? `${review.provider} · ${review.modelId}` : "Awaiting generation metadata"}</p></div>{review?.status === "generating" && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Generating</span>}</div>{review?.status === "failed" && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{review.errorMessage ?? "Generation failed. Check the extracted source, then create a fresh proposal."}</p>}<div className="divide-y divide-slate-100">{review?.units.map((unit) => <CurriculumUnitCard key={unit._id} unit={unit} busy={busy} onReview={editOrReject} onApprove={approve} />)}{review && review.units.length === 0 && review.status !== "generating" && <p className="py-8 text-center text-sm text-slate-500"><BookOpenCheck className="mx-auto mb-2 h-5 w-5" />No review units are available yet.</p>}</div></section>}</div></main>;
}
