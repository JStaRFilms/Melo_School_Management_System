"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { GradingBandDraft, BandValidationError, GradingBandResponse } from "@/types";
import { validateBandsClient } from "@/exam-helpers";
import { BandTable } from "./components/BandTable";
import { BandValidationBanner } from "./components/BandValidationBanner";
import { BandsActionBar } from "./components/BandsActionBar";
import { getMockGradingBands } from "@/mock-data";
import { isConvexConfigured } from "@/convex-runtime";

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
      throw new Error("Validation failed. Fix errors before saving.");
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
  const mockBands = getMockGradingBands();
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
      throw new Error("Validation failed. Fix errors before saving.");
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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6 sm:space-y-8 pb-24">
      {/* Breadcrumb - exact match from mockup */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 breadcrumb-text">
          <a href="#" className="hover:text-slate-900 transition-colors">
            Admin
          </a>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-900 uppercase">Threshold Management</span>
        </div>
      </div>

      {/* Validation Banner */}
      {showErrors && validationErrors.length > 0 && (
        <BandValidationBanner
          errors={validationErrors}
          onDismiss={onDismissErrors}
        />
      )}

      {/* Band Table */}
      <BandTable
        bands={bands}
        onBandsChange={onBandsChange}
        validationErrors={validationErrors}
        onValidationChange={onValidationChange}
      />

      {/* Action Bar */}
      <BandsActionBar
        hasUnsavedChanges={hasUnsavedChanges}
        hasValidationErrors={validationErrors.length > 0}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}
