"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BookOpenCheck,
  Check,
  CheckCheck,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { appToast } from "@school/shared/toast";
import { CurriculumImportSidebar } from "./components/CurriculumImportSidebar";
import { CurriculumApprovalDialog } from "./components/CurriculumApprovalDialog";
import { BulkApprovalDialog } from "./components/BulkApprovalDialog";
import { CurriculumUnitCard } from "./components/CurriculumUnitCard";
import { CurriculumUnitEditor, type UnitEditValues } from "./components/CurriculumUnitEditor";
import { getCurriculumErrorMessage } from "./components/curriculumErrorMessage";
import type { CurriculumImportForm, CurriculumImportSummary, CurriculumUnit } from "./components/types";

type Context = { sources: Array<{ _id: string; title: string; level: string; subjectId?: string }>; imports: CurriculumImportSummary[] };
type Subject = { _id: string; name: string };
type Session = { _id: string; isActive: boolean };
type Term = { _id: string; name: string; isActive: boolean };
type Review = { status: string; errorMessage?: string; units: CurriculumUnit[] };
type FilterTab = "all" | "proposed" | "approved" | "rejected";

const EMPTY_FORM: CurriculumImportForm = { materialId: "", subjectId: "", level: "", termId: "" };
const BULK_REVIEW_BATCH_SIZE = 20;

function chunkUnits(units: CurriculumUnit[]) {
  const batches: CurriculumUnit[][] = [];
  for (let index = 0; index < units.length; index += BULK_REVIEW_BATCH_SIZE) {
    batches.push(units.slice(index, index + BULK_REVIEW_BATCH_SIZE));
  }
  return batches;
}

export default function CurriculumImportPage() {
  const context = useQuery("functions/academic/curriculumAdminRead:listCurriculumImportContext" as never) as Context | undefined;
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as Subject[] | undefined;
  const sessions = useQuery("functions/academic/academicSetup:listSessions" as never) as Session[] | undefined;
  const activeSession = sessions?.find((session) => session.isActive);
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    activeSession ? ({ sessionId: activeSession._id } as never) : ("skip" as never)
  ) as Term[] | undefined;

  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [approvalUnit, setApprovalUnit] = useState<CurriculumUnit | null>(null);
  const [bulkApprovalUnits, setBulkApprovalUnits] = useState<CurriculumUnit[] | null>(null);
  const [checkedUnitIds, setCheckedUnitIds] = useState<Set<string>>(new Set());
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<CurriculumImportForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const review = useQuery(
    "functions/academic/curriculumAdminRead:getCurriculumImportReview" as never,
    selectedImportId ? ({ importId: selectedImportId } as never) : ("skip" as never)
  ) as Review | undefined;

  const createImport = useMutation("functions/academic/curriculumImportLifecycle:createCurriculumImport" as never);
  const reviewUnit = useMutation("functions/academic/curriculumReviewLifecycle:reviewCurriculumUnit" as never);
  const approveUnit = useMutation("functions/academic/curriculumReviewLifecycle:approveCurriculumUnit" as never);
  const bulkApproveUnits = useMutation("functions/academic/curriculumReviewLifecycle:bulkApproveCurriculumUnits" as never);
  const bulkRejectUnits = useMutation("functions/academic/curriculumReviewLifecycle:bulkRejectCurriculumUnits" as never);

  const selectedImport = useMemo(
    () => context?.imports.find((item) => item._id === selectedImportId) ?? null,
    [context, selectedImportId]
  );
  const editingUnit = review?.units.find((unit) => unit._id === editingUnitId) ?? null;

  useEffect(() => {
    if (!selectedImportId && context?.imports[0]) setSelectedImportId(context.imports[0]._id);
  }, [context, selectedImportId]);

  useEffect(() => {
    setEditingUnitId(null);
    setCheckedUnitIds(new Set());
    setSearchQuery("");
  }, [selectedImportId]);

  const units = review?.units ?? [];
  const proposedUnits = useMemo(() => units.filter((u) => u.reviewStatus === "proposed"), [units]);
  const approvedUnits = useMemo(() => units.filter((u) => u.reviewStatus === "approved"), [units]);
  const rejectedUnits = useMemo(() => units.filter((u) => u.reviewStatus === "rejected"), [units]);

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      if (filterTab === "proposed" && unit.reviewStatus !== "proposed") return false;
      if (filterTab === "approved" && unit.reviewStatus !== "approved") return false;
      if (filterTab === "rejected" && unit.reviewStatus !== "rejected") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = unit.title.toLowerCase().includes(query);
        const matchSubtopics = unit.subtopics.some((s) => s.toLowerCase().includes(query));
        const matchObjectives = unit.learningObjectives.some((o) => o.toLowerCase().includes(query));
        const matchExcerpt = unit.supportingExcerpt.toLowerCase().includes(query);
        if (!matchTitle && !matchSubtopics && !matchObjectives && !matchExcerpt) return false;
      }

      return true;
    });
  }, [units, filterTab, searchQuery]);

  const selectedUnitsList = useMemo(
    () => units.filter((u) => checkedUnitIds.has(u._id)),
    [units, checkedUnitIds]
  );

  const toggleCheckUnit = (unitId: string, checked: boolean) => {
    setCheckedUnitIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(unitId);
      else next.delete(unitId);
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    setCheckedUnitIds((prev) => {
      const next = new Set(prev);
      const selectableUnits = filteredUnits.filter((u) => u.reviewStatus !== "approved");
      if (checked) {
        selectableUnits.forEach((u) => next.add(u._id));
      } else {
        selectableUnits.forEach((u) => next.delete(u._id));
      }
      return next;
    });
  };

  const startImport = async () => {
    if (!form.materialId || !form.subjectId || !form.level.trim() || !form.termId || busy) return;
    setBusy(true);
    try {
      const importId = (await createImport({ ...form, level: form.level.trim() } as never)) as string;
      setSelectedImportId(importId);
      const response = await fetch("/api/ai/curriculum/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importId }),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) throw new Error(getCurriculumErrorMessage(payload, "Generation could not start."));
      appToast.success("Proposal ready", { description: "Review each unit before approving it as an academic topic." });
    } catch (error) {
      appToast.error("Import could not start", {
        description: getCurriculumErrorMessage(error, "Check the source and academic context, then try again."),
      });
    } finally {
      setBusy(false);
    }
  };

  const saveUnit = async (unit: CurriculumUnit, values: UnitEditValues) => {
    if (busy) return;
    setBusy(true);
    try {
      await reviewUnit({ unitId: unit._id, reviewStatus: "proposed", ...values } as never);
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
      await reviewUnit({ unitId: unit._id, reviewStatus: "rejected" } as never);
      appToast.success("Unit rejected");
      if (editingUnitId === unit._id) setEditingUnitId(null);
      setCheckedUnitIds((prev) => {
        const next = new Set(prev);
        next.delete(unit._id);
        return next;
      });
    } catch (error) {
      appToast.error("Review update failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const approve = async (unit: CurriculumUnit) => {
    setBusy(true);
    try {
      await approveUnit({ unitId: unit._id } as never);
      appToast.success("Topic approved", {
        description: `"${unit.title}" is now available in your academic knowledge library.`,
      });
      setApprovalUnit(null);
      if (editingUnitId === unit._id) setEditingUnitId(null);
      setCheckedUnitIds((prev) => {
        const next = new Set(prev);
        next.delete(unit._id);
        return next;
      });
    } catch (error) {
      appToast.error("Approval failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkApproveConfirm = async (unitsToApprove: CurriculumUnit[]) => {
    if (unitsToApprove.length === 0 || busy) return;
    setBusy(true);
    try {
      let approvedCount = 0;
      for (const batch of chunkUnits(unitsToApprove)) {
        const result = (await bulkApproveUnits({
          unitIds: batch.map((unit) => unit._id),
        } as never)) as { approvedCount: number };
        approvedCount += result.approvedCount;
      }
      appToast.success(`Approved ${approvedCount} topics`, {
        description: "All approved topics are now active in the academic knowledge library.",
      });
      setBulkApprovalUnits(null);
      setCheckedUnitIds(new Set());
    } catch (error) {
      appToast.error("Bulk approval failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  const handleBulkReject = async (unitsToReject: CurriculumUnit[]) => {
    if (unitsToReject.length === 0 || busy) return;
    setBusy(true);
    try {
      let rejectedCount = 0;
      for (const batch of chunkUnits(unitsToReject)) {
        const result = (await bulkRejectUnits({
          unitIds: batch.map((unit) => unit._id),
        } as never)) as { rejectedCount: number };
        rejectedCount += result.rejectedCount;
      }
      appToast.success(`Rejected ${rejectedCount} units`);
      setCheckedUnitIds(new Set());
    } catch (error) {
      appToast.error("Bulk reject failed", { description: getCurriculumErrorMessage(error, "Try again.") });
    } finally {
      setBusy(false);
    }
  };

  if (!context || !subjects || !sessions || (activeSession && !terms)) {
    return <div className="p-6 text-sm font-bold text-slate-500">Loading curriculum workspace…</div>;
  }
  if (!activeSession) return <NoActiveSession />;

  const isAllSelectableChecked =
    filteredUnits.filter((u) => u.reviewStatus !== "approved").length > 0 &&
    filteredUnits
      .filter((u) => u.reviewStatus !== "approved")
      .every((u) => checkedUnitIds.has(u._id));

  return (
    <main className="min-h-screen bg-surface-200 lg:h-[calc(100vh-52px)] lg:overflow-hidden flex flex-col">
      {/* Sleek Top Header with integrated Action Bar */}
      <div className="shrink-0 px-5 py-3 lg:px-8 bg-white border-b border-slate-200/80">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-0.5">
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400/80">
              Academic Knowledge
            </p>
            <div className="flex items-center gap-3">
              <h1 className="font-display font-extrabold tracking-tight text-slate-950 text-xl lg:text-2xl">
                Curriculum Intelligence
              </h1>
              {selectedImport && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                  <b className="text-slate-900">{selectedImport.sourceLabel}</b>
                  <span className="text-slate-400">•</span>
                  <span>{selectedImport.level}</span>
                  <span className="text-slate-400">•</span>
                  <span>{selectedImport.termLabel}</span>
                </span>
              )}
            </div>
          </div>

          {/* Header Controls: Search, Tabs, Bulk Approve */}
          {selectedImport && units.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative w-40 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter topics..."
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-6 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
                <TabButton active={filterTab === "all"} onClick={() => setFilterTab("all")} label={`All (${units.length})`} />
                <TabButton active={filterTab === "proposed"} onClick={() => setFilterTab("proposed")} label={`Proposed (${proposedUnits.length})`} />
                <TabButton active={filterTab === "approved"} onClick={() => setFilterTab("approved")} label={`Approved (${approvedUnits.length})`} />
                <TabButton active={filterTab === "rejected"} onClick={() => setFilterTab("rejected")} label={`Rejected (${rejectedUnits.length})`} />
              </div>

              {/* 1-Click Approve All Proposed */}
              {proposedUnits.length > 0 && (
                <button
                  type="button"
                  disabled={busy || review?.status === "generating"}
                  onClick={() => setBulkApprovalUnits(proposedUnits)}
                  className="inline-flex h-8 items-center gap-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Approve All ({proposedUnits.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main 3-Pane Workbench */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(420px,1fr)_340px]">
        {/* Left Panel: Proposal Creator & Recents */}
        <CurriculumImportSidebar
          sources={context.sources}
          subjects={subjects}
          terms={terms ?? []}
          imports={context.imports}
          form={form}
          busy={busy}
          selectedImportId={selectedImportId}
          onFormChange={setForm}
          onSelectImport={setSelectedImportId}
          onSubmit={() => void startImport()}
        />

        {/* Center Panel: Review Queue List */}
        <section className="min-w-0 bg-slate-50/50 lg:h-full lg:overflow-y-auto custom-scrollbar flex flex-col">
          {/* Sub-strip: Select all + Extraction status */}
          {selectedImport && (
            <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-2.5 backdrop-blur flex items-center justify-between text-xs text-slate-500 font-bold shadow-2xs">
              <div className="flex items-center gap-3">
                {filteredUnits.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAllSelectableChecked}
                      onChange={(e) => toggleSelectAllFiltered(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                    />
                    <span>Select All ({filteredUnits.filter((u) => u.reviewStatus !== "approved").length})</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                {review?.status === "generating" && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    <LoaderCircle className="h-3 w-3 animate-spin text-indigo-600" /> Extracting…
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  Showing {filteredUnits.length} of {units.length}
                </span>
              </div>
            </div>
          )}

          {/* Sticky Floating Action Bar when units are selected */}
          {checkedUnitIds.size > 0 && (
            <div className="sticky top-12 z-20 mx-4 my-2 rounded-xl bg-slate-950 text-white p-2.5 px-3.5 shadow-xl border border-slate-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-white text-[10px] font-black">
                  {checkedUnitIds.size}
                </span>
                <span className="font-bold text-xs text-slate-200">
                  {checkedUnitIds.size} selected
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setBulkApprovalUnits(selectedUnitsList)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-[11px] font-black uppercase tracking-wider transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  <span>Approve ({checkedUnitIds.size})</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleBulkReject(selectedUnitsList)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckedUnitIds(new Set())}
                  className="text-xs font-semibold text-slate-400 hover:text-white px-1.5 py-0.5 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {review?.status === "failed" && (
            <p className="m-4 rounded-xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 border border-rose-200">
              {getCurriculumErrorMessage(
                review.errorMessage,
                "Generation failed. Check the extracted source, then create a fresh proposal."
              )}
            </p>
          )}

          {/* Unit Cards List */}
          <div className="p-4 space-y-3 flex-1">
            {filteredUnits.map((unit) => (
              <CurriculumUnitCard
                key={unit._id}
                unit={unit}
                busy={busy}
                isEditing={unit._id === editingUnitId}
                isChecked={checkedUnitIds.has(unit._id)}
                onToggleCheck={toggleCheckUnit}
                onEdit={(item) => setEditingUnitId(item._id)}
                onReject={(item) => void rejectUnit(item)}
                onApprove={setApprovalUnit}
              />
            ))}

            {review && filteredUnits.length === 0 && review.status !== "generating" && (
              <EmptyReview
                label={
                  searchQuery
                    ? `No units matching "${searchQuery}"`
                    : filterTab !== "all"
                    ? `No ${filterTab} units in this proposal.`
                    : "No review units are available yet."
                }
              />
            )}

            {!selectedImport && <EmptyReview label="Choose an import proposal from the left sidebar to review" />}
          </div>
        </section>

        {/* Right Panel: Unit Inspector */}
        <aside className="border-l border-slate-200/80 bg-white lg:h-full lg:overflow-y-auto custom-scrollbar flex flex-col">
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Inspector</p>
            {editingUnit && (
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <CurriculumUnitEditor unit={editingUnit} busy={busy} onClose={() => setEditingUnitId(null)} onSave={saveUnit} />
        </aside>
      </div>

      {/* Single Unit Approval Dialog */}
      <CurriculumApprovalDialog
        unit={approvalUnit}
        busy={busy}
        onCancel={() => setApprovalUnit(null)}
        onConfirm={(unit) => void approve(unit)}
      />

      {/* Multi-Unit Bulk Approval Dialog */}
      <BulkApprovalDialog
        units={bulkApprovalUnits ?? []}
        busy={busy}
        onCancel={() => setBulkApprovalUnits(null)}
        onConfirm={(unitsToApprove) => void handleBulkApproveConfirm(unitsToApprove)}
      />
    </main>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
        active
          ? "bg-white text-slate-900 shadow-2xs font-extrabold"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function EmptyReview({ label = "No review units are available yet." }: { label?: string }) {
  return (
    <div className="py-20 text-center text-slate-400 space-y-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mx-auto">
        <BookOpenCheck className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold text-slate-600">{label}</p>
    </div>
  );
}

function NoActiveSession() {
  return (
    <main className="min-h-screen bg-surface-200 p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="space-y-1">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400/80">
            Academic Knowledge
          </p>
          <h1 className="font-display font-extrabold tracking-tight text-slate-950 text-2xl">
            Curriculum Intelligence
          </h1>
          <p className="text-xs text-slate-500">
            Turn an extracted scheme of work into evidence-backed topics, one human approval at a time.
          </p>
        </div>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 space-y-1.5">
          <b className="font-extrabold text-base">No active session is set up.</b>
          <p className="text-xs leading-relaxed text-amber-800">
            Create and activate an academic school session before starting a curriculum proposal.
          </p>
        </section>
      </div>
    </main>
  );
}
