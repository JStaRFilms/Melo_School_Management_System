"use client";

import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { api } from "../../../../../../packages/convex/_generated/api";
import { useAuth } from "@/AuthProvider";
import { GradeGovernance } from "./components/GradeGovernance";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { isConvexConfigured } from "@/convex-runtime";
import {
  validateBandsClient,
  STANDARD_DEFAULT_GRADING_BANDS,
} from "@/exam-helpers";
import { getMockGradingBands } from "@/mock-data";
import type { BandValidationError, GradingBandDraft } from "@/types";
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
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId
      ? { schoolId, capability: "academic.grading_bands.manage" }
      : "skip",
  );
  const bands = useQuery(
    api.functions.academic.gradingBands.getActiveGradingBands,
    schoolId && allowed ? { schoolId } : "skip",
  );
  const governance = useQuery(
    api.functions.academic.gradingBands.getPolicyGovernance,
    schoolId && allowed ? { schoolId } : "skip",
  );
  const saveBands = useMutation(
    api.functions.academic.gradingBands.saveGradingBands,
  );
  const [loadedVersion, setLoadedVersion] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [draftBands, setDraftBands] = useState<GradingBandDraft[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    BandValidationError[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showErrors, setShowErrors] = useState(true);

  useEffect(() => {
    if (bands && !hasUnsavedChanges) {
      setLoadedVersion(Math.max(0, ...bands.map((b) => b.version ?? 0)));
      if (bands.length > 0) {
        setDraftBands(
          bands.map((b) => ({
            minScore: b.minScore,
            maxScore: b.maxScore,
            gradeLetter: b.gradeLetter,
            remark: b.remark,
            colorHex: b.colorHex ?? b.color,
            gradePoints: b.gradePoints,
          })),
        );
      } else {
        setDraftBands([]);
      }
    }
  }, [bands, hasUnsavedChanges]);

  const handleBandsChange = useCallback((next: GradingBandDraft[]) => {
    setDraftBands(next);
    setHasUnsavedChanges(true);
  }, []);

  const handleValidationChange = useCallback(
    (errors: BandValidationError[]) => {
      setValidationErrors(errors);
      setShowErrors(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    // Automatically sort tiers by score before saving
    const sorted = [...draftBands].sort(
      (a, b) => (a.minScore ?? 0) - (b.minScore ?? 0),
    );
    const errors = validateBandsClient(sorted);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrors(true);
      throw new Error("Validation failed. Please resolve policy errors.");
    }

    setIsSaving(true);
    try {
      await saveBands({
        schoolId,
        expectedVersion: loadedVersion,
        bands: sorted.map((b) => ({
          minScore: b.minScore!,
          maxScore: b.maxScore!,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
          colorHex: b.colorHex ?? b.color,
          gradePoints: b.gradePoints,
        })),
      });
    } finally {
      setIsSaving(false);
    }
    setDraftBands(sorted);
    setHasUnsavedChanges(false);
  }, [draftBands, saveBands, schoolId, loadedVersion]);

  const handleDiscard = useCallback(() => {
    setLoadedVersion(Math.max(0, ...(bands ?? []).map((b) => b.version ?? 0)));
    if (bands && bands.length > 0) {
      setDraftBands(
        bands.map((b) => ({
          minScore: b.minScore,
          maxScore: b.maxScore,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
          colorHex: b.colorHex ?? b.color,
          gradePoints: b.gradePoints,
        })),
      );
    } else {
      setDraftBands([]);
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

  if (allowed === false)
    return (
      <div role="alert" className="p-6">
        Permission denied: managing grading bands is required.
      </div>
    );
  if (bands === undefined) {
    return <PageLoadingState />;
  }

  return (
    <>
      {schoolId && (
        <GradeGovernance
          schoolId={schoolId}
          dirty={hasUnsavedChanges || isSaving}
          onChanged={(nextBands) => {
            setDraftBands(nextBands);
            setLoadedVersion(
              Math.max(0, ...nextBands.map((b) => b.version ?? 0)),
            );
            setValidationErrors([]);
          }}
        />
      )}
      <GradingBandsContent
        disabled={isSaving || governance?.mode === "inherit"}
        bands={draftBands}
        validationErrors={validationErrors}
        hasUnsavedChanges={hasUnsavedChanges}
        hasActivePolicy={bands.length > 0}
        showErrors={showErrors}
        onBandsChange={handleBandsChange}
        onValidationChange={handleValidationChange}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onDismissErrors={() => setShowErrors(false)}
      />
    </>
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
            colorHex: b.colorHex ?? b.color,
            gradePoints: b.gradePoints,
        }))
      : []
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
            colorHex: b.colorHex ?? b.color,
            gradePoints: b.gradePoints,
          }))
        : []
    );
    setHasUnsavedChanges(false);
    setValidationErrors([]);
  }, [mockBands]);

  return (
    <GradingBandsContent
      bands={draftBands}
      validationErrors={validationErrors}
      hasUnsavedChanges={hasUnsavedChanges}
      hasActivePolicy={mockBands.length > 0}
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
  disabled = false,
  bands,
  validationErrors,
  hasUnsavedChanges,
  hasActivePolicy,
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
    <fieldset disabled={disabled} className="flex flex-col h-full min-h-0 min-w-0 w-full bg-slate-50/30">
      {/* 1. Guaranteed Pinned Top Bar on Mobile & Desktop */}
      <div className="shrink-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 space-y-3">
          {/* Top Line: Breadcrumb + Title + Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                <a href="/admin" className="hover:text-slate-900 transition-colors">
                  Admin
                </a>
                <ChevronRight size={10} className="opacity-50" />
                <span>Assessment Policy</span>
                <ChevronRight size={10} className="opacity-50" />
                <span className="text-slate-900">Grading Bands</span>
              </div>
              <div className="flex items-center gap-2.5 mt-0.5">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-950">
                  Grading Bands
                </h1>
                {hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase tracking-wider">
                    <Clock size={10} className="text-amber-600" />
                    <span>Unsaved</span>
                  </span>
                ) : hasActivePolicy ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 size={10} className="text-emerald-600" />
                    <span>Active</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black uppercase tracking-wider">
                    <span>No Policy</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-bold uppercase tracking-wider shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 text-slate-700">
                <Trophy size={11} className="text-slate-500" />
                <span>{bands.length} {bands.length === 1 ? "Tier" : "Tiers"}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 text-slate-700">
                <ShieldCheck size={11} className="text-slate-500" />
                <span>0 – 100% Coverage</span>
              </span>
            </div>
          </div>

          {/* Bottom Line: Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
            <p className="hidden md:block text-xs font-medium text-slate-500 truncate">
              Colors supplement scores and labels. Light hues use readable display ink; issued snapshots do not change.
            </p>

            <div className="grid grid-cols-1 min-[360px]:grid-cols-3 sm:flex sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
              <button
                type="button"
                onClick={handleSortBands}
                disabled={bands.length <= 1}
                className="h-10 sm:h-11 px-4 sm:px-5 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs hover:shadow-xs flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
                title="Sort tiers numerically by minimum score (0 to 100)"
              >
                <ArrowUpDown size={15} className="text-slate-500 shrink-0" />
                <span>Arrange</span>
              </button>
              <button
                type="button"
                onClick={handleLoadDefaults}
                className="h-10 sm:h-11 px-4 sm:px-5 bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs hover:shadow-xs flex items-center justify-center gap-2 active:scale-95"
                title="Reset to standard A (75-100) through F (0-39) grading bands"
              >
                <Sparkles size={15} className="text-amber-500 shrink-0" />
                <span>Standard</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onBandsChange([
                    ...bands,
                    { minScore: null, maxScore: null, gradeLetter: "", remark: "" },
                  ])
                }
                className="h-10 sm:h-11 px-5 sm:px-6 bg-slate-950 text-white hover:bg-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-slate-950/10 flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus size={16} className="opacity-90 shrink-0" />
                <span>Add Tier</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-40 space-y-6">
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
    </fieldset>
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
  disabled?: boolean;
  bands: GradingBandDraft[];
  validationErrors: BandValidationError[];
  hasUnsavedChanges: boolean;
  hasActivePolicy: boolean;
  showErrors: boolean;
  onBandsChange: (bands: GradingBandDraft[]) => void;
  onValidationChange: (errors: BandValidationError[]) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onDismissErrors: () => void;
}
