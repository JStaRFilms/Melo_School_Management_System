"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { ExamInputMode } from "@school/shared";
import { ExamModeSelector } from "./components/ExamModeSelector";
import { WeightDistribution } from "./components/WeightDistribution";
import { AuditPolicyCard } from "./components/AuditPolicyCard";
import { SettingsActionBar } from "./components/SettingsActionBar";
import { getMockSettings } from "@/mock-data";
import { isConvexConfigured } from "@/convex-runtime";

export default function ExamRecordingSettingsPage() {
  if (!isConvexConfigured()) {
    return <MockExamSettingsPage />;
  }

  return <LiveExamSettingsPage />;
}

function LiveExamSettingsPage() {
  const settings = useQuery(
    "functions/academic/settings:getSchoolAssessmentSettings" as never
  ) as { examInputMode: ExamInputMode } | null | undefined;
  const saveSettings = useMutation(
    "functions/academic/settings:saveSchoolAssessmentSettings" as never
  );

  const [draftMode, setDraftMode] = useState<ExamInputMode>("raw40");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setDraftMode(settings?.examInputMode ?? "raw40");
  }, [settings]);

  const handleModeChange = useCallback((mode: ExamInputMode) => {
    setDraftMode(mode);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    await saveSettings({ examInputMode: draftMode } as never);
    setHasUnsavedChanges(false);
  }, [draftMode, saveSettings]);

  const handleDiscard = useCallback(() => {
    setDraftMode(settings?.examInputMode ?? "raw40");
    setHasUnsavedChanges(false);
  }, [settings]);

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
    <ExamSettingsContent
      currentMode={draftMode}
      hasUnsavedChanges={hasUnsavedChanges}
      onModeChange={handleModeChange}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );
}

function MockExamSettingsPage() {
  const mockSettings = getMockSettings();
  const [draftMode, setDraftMode] = useState<ExamInputMode>(
    mockSettings.examInputMode
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleModeChange = useCallback((mode: ExamInputMode) => {
    setDraftMode(mode);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    setHasUnsavedChanges(false);
  }, []);

  const handleDiscard = useCallback(() => {
    setDraftMode(mockSettings.examInputMode);
    setHasUnsavedChanges(false);
  }, [mockSettings]);

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
    <ExamSettingsContent
      currentMode={draftMode}
      hasUnsavedChanges={hasUnsavedChanges}
      onModeChange={handleModeChange}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );
}

interface ExamSettingsContentProps {
  currentMode: ExamInputMode;
  hasUnsavedChanges: boolean;
  onModeChange: (mode: ExamInputMode) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

function ExamSettingsContent({
  currentMode,
  hasUnsavedChanges,
  onModeChange,
  onSave,
  onDiscard,
}: ExamSettingsContentProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-8 pb-24">
      {/* Breadcrumb and Header - exact match from mockup */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 breadcrumb-text">
          <a href="#" className="hover:text-slate-900 transition-colors">
            Assessments
          </a>
          <span className="text-slate-300">&rsaquo;</span>
          <span className="text-slate-900">Recording Settings</span>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            Exam Protocol
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
            Configure scoring modes and school-wide input policy.
          </p>
        </div>
      </div>

      {/* Form Content */}
      <div className="space-y-8">
        <ExamModeSelector
          currentMode={currentMode}
          onModeChange={onModeChange}
        />
        <WeightDistribution />
        <AuditPolicyCard />
      </div>

      <SettingsActionBar
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}
