"use client";

import { AdminSurface } from "@/components/ui/AdminSurface";
import { isConvexConfigured } from "@/convex-runtime";
import { validateBandsClient } from "@/exam-helpers";
import { getMockGradingBands } from "@/mock-data";
import type { BandValidationError,GradingBandDraft,GradingBandResponse } from "@/types";
import { useMutation,useQuery } from "convex/react";
import {
ChevronRight,
Plus,
ShieldCheck,
Trophy
} from "lucide-react";
import { useCallback,useEffect,useMemo,useState } from "react";
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

  useEffect(() => {
    if (bands) {
      setDraftBands(
        bands.map((b) => ({
          minScore: b.minScore,
          maxScore: b.maxScore,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
        }))
      );
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
    const errors = validateBandsClient(draftBands);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrors(true);
      throw new Error("Validation failed.");
    }

    await saveBands({
      bands: draftBands.map((b) => ({
        minScore: b.minScore!,
        maxScore: b.maxScore!,
        gradeLetter: b.gradeLetter,
        remark: b.remark,
      })),
    } as never);
    setHasUnsavedChanges(false);
  }, [draftBands, saveBands]);

  const handleDiscard = useCallback(() => {
    if (bands) {
      setDraftBands(
        bands.map((b) => ({
          minScore: b.minScore,
          maxScore: b.maxScore,
          gradeLetter: b.gradeLetter,
          remark: b.remark,
        }))
      );
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
    mockBands.map((b) => ({
      minScore: b.minScore,
      maxScore: b.maxScore,
      gradeLetter: b.gradeLetter,
      remark: b.remark,
    }))
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
    const errors = validateBandsClient(draftBands);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowErrors(true);
      throw new Error("Validation failed.");
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
    setHasUnsavedChanges(false);
  }, [draftBands]);

  const handleDiscard = useCallback(() => {
    setDraftBands(
      mockBands.map((b) => ({
        minScore: b.minScore,
        maxScore: b.maxScore,
        gradeLetter: b.gradeLetter,
        remark: b.remark,
      }))
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
  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        {/* Simple Minimal Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 px-1">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              <a href="/admin" className="hover:text-slate-900 transition-colors">Admin</a>
              <ChevronRight size={10} className="opacity-50" />
              <span className="text-slate-900">Grading System</span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                Grading Bands
              </h1>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1.5"><Trophy size={12} className="text-slate-300" /> {bands.length} Tiers</span>
                <span className="w-1 h-1 rounded-full bg-slate-200" />
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-slate-300" /> Global Policy</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onBandsChange([...bands, { minScore: null, maxScore: null, gradeLetter: "", remark: "" }])}
            className="group h-11 px-6 bg-slate-900 text-white rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
          >
            <Plus size={14} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            Add New Tier
          </button>
        </div>

        {showErrors && validationErrors.length > 0 && (
          <BandValidationBanner
            errors={validationErrors}
            onDismiss={onDismissErrors}
          />
        )}

        <AdminSurface intensity="low" className="p-0 bg-white overflow-hidden border border-slate-200/60 shadow-sm rounded-2xl">
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
