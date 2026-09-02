"use client";

import { AdminSurface } from "@/components/ui/AdminSurface";
import { isConvexConfigured } from "@/convex-runtime";
import { validateBandsClient, STANDARD_DEFAULT_GRADING_BANDS } from "@/exam-helpers";
import { getMockGradingBands } from "@/mock-data";
import type { BandValidationError, GradingBandDraft, GradingBandResponse } from "@/types";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BandTable } from "./components/BandTable";
import { BandValidationBanner } from "./components/BandValidationBanner";
import { BandsActionBar } from "./components/BandsActionBar";

export default function GradingBandsPage() {
  if (!isConvexConfigured()) {
    return <MockGradingBandsPage />;
  }

  return <LiveGradingBandsPage />;
}

function LiveGradingBandsPage() {
  const bands = useQuery(
    "functions/academic/gradingBands:getActiveGradingBands" as never
  ) as GradingBandResponse[] | undefined;
  const saveBands = useMutation(
    "functions/academic/gradingBands:saveGradingBands" as never
  );

  const [draftBands, setDraftBands] = useState<GradingBandDraft[]>([]);
  const [validationErrors, setValidationErrors] = useState<BandValidationError[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showErrors, setShowErrors] = useState(true);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (bands && !isLoadedRef.current) {
      isLoadedRef.current = true;
      if (bands.length > 0) {
        setDraftBands(
          bands.map((b) => ({
            minScore: b.minScore,
            maxScore: b.maxScore,
            gradeLetter: b.gradeLetter,
            remark: b.remark,
          }))
        );
      } else {
        // Pre-populate with standard defaults for schools with no configured bands
        setDraftBands(STANDARD_DEFAULT_GRADING_BANDS);
        setHasUnsavedChanges(true);
      }
    }
  }, [bands]);

  const handleBandsChange = useCallback((next: GradingBandDraft[]) => {
    setDraftBands(next);
    setHasUnsavedChanges(true);
  }, []);

  const handleValidationChange = useCallback((errors: BandValidationError[]) => {
    setValidationErrors(errors);
    setShowErrors(true);
  }, []);

  const handleSave = useCallback(async () => {
    // Automatically sort tiers by score before saving
    const sorted = [...draftBands].sort(
      (a, b) => (a.minScore ?? 0) - (b.minScore ?? 0)
    );
    const errors = validateBandsClient(sorted);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrors(true);
      throw new Error("Validation failed. Please resolve policy errors.");
    }

    await saveBands({
      bands: sorted.map((b) => ({
        minScore: b.minScore!,
        maxScore: b.maxScore!,
        gradeLetter: b.gradeLetter,
        remark: b.remark,
      })),
    } as never);
    setDraftBands(sorted);
    setHasUnsavedChanges(false);
  }, [draftBands, saveBands]);

  const handleDiscard = useCallback(() => {
    if (bands && bands.length > 0) {
      setDraftBands(
        bands.map((b) => ({
          minScore: b.minScore,
          maxScore: b.maxScore,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
        }))
      );
    } else {
      setDraftBands(STANDARD_DEFAULT_GRADING_BANDS);
    }
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [bands]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (bands === undefined) {
    return <PageLoadingState />;
  }

  return (
    <GradingBandsContent
      bands={draftBands}
      validationErrors={validationErrors}
      hasUnsavedChanges={hasUnsavedChanges}
      showErrors={showErrors}
      onBandsChange={handleBandsChange}
      onValidationChange={handleValidationChange}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onDismissErrors={() => setShowErrors(false)}
    />
  );
}

function MockGradingBandsPage() {
  const mockBands = useMemo(() => getMockGradingBands(), []);
  const [draftBands, setDraftBands] = useState<GradingBandDraft[]>(
    mockBands.length > 0
      ? mockBands.map((b) => ({
          minScore: b.minScore,
          maxScore: b.maxScore,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
        }))
      : STANDARD_DEFAULT_GRADING_BANDS
  );
  const [validationErrors, setValidationErrors] = useState<BandValidationError[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showErrors, setShowErrors] = useState(true);

  const handleBandsChange = useCallback((next: GradingBandDraft[]) => {
    setDraftBands(next);
    setHasUnsavedChanges(true);
  }, []);

  const handleValidationChange = useCallback((errors: BandValidationError[]) => {
    setValidationErrors(errors);
    setShowErrors(true);
  }, []);

  const handleSave = useCallback(async () => {
    const sorted = [...draftBands].sort(
      (a, b) => (a.minScore ?? 0) - (b.minScore ?? 0)
    );
    const errors = validateBandsClient(sorted);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrors(true);
      throw new Error("Validation failed. Please resolve policy errors.");
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    setDraftBands(sorted);
    setHasUnsavedChanges(false);
  }, [draftBands]);

  const handleDiscard = useCallback(() => {
    setDraftBands(
      mockBands.length > 0
        ? mockBands.map((b) => ({
            minScore: b.minScore,
            maxScore: b.maxScore,
            gradeLetter: b.gradeLetter,
            remark: b.remark,
          }))
        : STANDARD_DEFAULT_GRADING_BANDS
    );
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [mockBands]);

  return (
    <GradingBandsContent
      bands={draftBands}
      validationErrors={validationErrors}
      hasUnsavedChanges={hasUnsavedChanges}
      showErrors={showErrors}
      onBandsChange={handleBandsChange}
      onValidationChange={handleValidationChange}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onDismissErrors={() => setShowErrors(false)}
    />
  );
}

function GradingBandsContent({
  bands,
  validationErrors,
  hasUnsavedChanges,
  showErrors,
  onBandsChange,
  onValidationChange,
  onSave,
  onDiscard,
  onDismissErrors,
}: GradingBandsContentProps) {
  const handleLoadDefaults = () => {
    onBandsChange(STANDARD_DEFAULT_GRADING_BANDS);
    const errors = validateBandsClient(STANDARD_DEFAULT_GRADING_BANDS);
    onValidationChange(errors);
  };

  const handleSortBands = () => {
    const sorted = [...bands].sort((a, b) => (a.minScore ?? 0) - (b.minScore ?? 0));
    onBandsChange(sorted);
    const errors = validateBandsClient(sorted);
    onValidationChange(errors);
  };

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-36 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 px-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              <a href="/admin" className="hover:text-slate-900 transition-colors">
                Admin
              </a>
              <ChevronRight size={10} className="opacity-50" />
              <span>Assessment Policy</span>
              <ChevronRight size={10} className="opacity-50" />
              <span className="text-slate-900">Grading Bands</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                Grading Bands
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-xl">
                Define the official score cutoffs (0–100%), letter grades, and transcript remarks applied to student results across the school.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-bold uppercase tracking-widest">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                <Trophy size={11} className="text-slate-500" />
                {bands.length} {bands.length === 1 ? "Tier" : "Tiers"} Configured
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                <ShieldCheck size={11} className="text-slate-500" />
                Score Coverage: 0 – 100%
              </span>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                  <Clock size={11} className="text-amber-600" />
                  Unsaved Changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  Active Policy
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSortBands}
              disabled={bands.length <= 1}
              className="h-9 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
              title="Sort tiers numerically by minimum score (0 to 100)"
            >
              <ArrowUpDown size={13} className="text-slate-500" />
              Auto-Arrange
            </button>
            <button
              type="button"
              onClick={handleLoadDefaults}
              className="h-9 px-3.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              title="Reset to standard A (75-100) through F (0-39) grading bands"
            >
              <Sparkles size={13} className="text-amber-500" />
              Load Standard Scale
            </button>
            <button
              type="button"
              onClick={() =>
                onBandsChange([
                  ...bands,
                  { minScore: null, maxScore: null, gradeLetter: "", remark: "" },
                ])
              }
              className="h-9 px-4 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Plus size={14} className="opacity-80" />
              Add Tier
            </button>
          </div>
        </div>

        {showErrors && validationErrors.length > 0 && (
          <BandValidationBanner
            errors={validationErrors}
            onDismiss={onDismissErrors}
          />
        )}

        <AdminSurface
          intensity="low"
          className="p-0 bg-white overflow-hidden border border-slate-200/80 shadow-sm rounded-2xl"
        >
          <BandTable
            bands={bands}
            onBandsChange={onBandsChange}
            validationErrors={validationErrors}
            onValidationChange={onValidationChange}
          />
        </AdminSurface>

        <BandsActionBar
          hasUnsavedChanges={hasUnsavedChanges}
          hasValidationErrors={validationErrors.length > 0}
          onSave={onSave}
          onDiscard={onDiscard}
        />
      </div>
    </div>
  );
}

function PageLoadingState() {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col p-12">
      <div className="max-w-5xl mx-auto w-full space-y-12 animate-pulse">
        <div className="h-20 w-64 bg-slate-200/50 rounded-2xl" />
        <div className="h-[500px] w-full bg-slate-100/50 rounded-[2rem]" />
      </div>
    </div>
  );
}

interface GradingBandsContentProps {
  bands: GradingBandDraft[];
  validationErrors: BandValidationError[];
  hasUnsavedChanges: boolean;
  showErrors: boolean;
  onBandsChange: (bands: GradingBandDraft[]) => void;
  onValidationChange: (errors: BandValidationError[]) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onDismissErrors: () => void;
}
