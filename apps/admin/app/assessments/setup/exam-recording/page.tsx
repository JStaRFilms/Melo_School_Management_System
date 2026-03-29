"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { ExamInputMode } from "@school/shared";
import { ExamModeSelector } from "./components/ExamModeSelector";
import { WeightDistribution } from "./components/WeightDistribution";
import { AuditPolicyCard } from "./components/AuditPolicyCard";
import { SettingsActionBar } from "./components/SettingsActionBar";
import { AssessmentEditingPolicyCard } from "./components/AssessmentEditingPolicyCard";
import {
  buildAssessmentEditingPolicyMutationInput,
  createAssessmentEditingPolicyDraft,
  isAssessmentEditingPolicyDraftEqual,
  type AssessmentEditingPolicyDraft,
} from "./components/assessmentEditingPolicyDraft";
import {
  getMockSettings,
  mockSessions,
  mockTermsBySession,
} from "@/mock-data";
import { isConvexConfigured } from "@/convex-runtime";
import type {
  AssessmentEditingPolicyResponse,
  Id,
  SelectorOption,
} from "@/types";

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
  const sessions = useQuery(
    "functions/academic/adminSelectors:getAdminSessions" as never
  ) as SelectorOption[] | undefined;
  const saveSettings = useMutation(
    "functions/academic/settings:saveSchoolAssessmentSettings" as never
  );
  const saveAssessmentEditingPolicy = useMutation(
    "functions/academic/assessmentEditingPolicies:saveAssessmentEditingPolicy" as never
  );

  const [savedMode, setSavedMode] = useState<ExamInputMode>("raw40");
  const [draftMode, setDraftMode] = useState<ExamInputMode>("raw40");
  const [policyDraft, setPolicyDraft] = useState<AssessmentEditingPolicyDraft>(
    createAssessmentEditingPolicyDraft(null, null)
  );
  const [savedPolicyDraft, setSavedPolicyDraft] =
    useState<AssessmentEditingPolicyDraft>(
      createAssessmentEditingPolicyDraft(null, null)
    );

  useEffect(() => {
    const nextMode = settings?.examInputMode ?? "raw40";
    setSavedMode(nextMode);
    setDraftMode(nextMode);
  }, [settings?.examInputMode]);

  useEffect(() => {
    if (!sessions?.length || policyDraft.sessionId) {
      return;
    }

    const nextSessionId = sessions[0].id as Id<"academicSessions">;
    const nextDraft = createAssessmentEditingPolicyDraft(nextSessionId, null);
    setPolicyDraft(nextDraft);
    setSavedPolicyDraft(nextDraft);
  }, [policyDraft.sessionId, sessions]);

  const terms = useQuery(
    "functions/academic/adminSelectors:getTermsBySession" as never,
    policyDraft.sessionId
      ? ({ sessionId: policyDraft.sessionId } as never)
      : ("skip" as never)
  ) as SelectorOption[] | undefined;

  useEffect(() => {
    if (!policyDraft.sessionId || !terms?.length) {
      return;
    }

    const termStillExists =
      policyDraft.termId &&
      terms.some((term) => term.id === policyDraft.termId);
    if (termStillExists) {
      return;
    }

    const nextTermId = terms[0].id as Id<"academicTerms">;
    const nextDraft = createAssessmentEditingPolicyDraft(
      policyDraft.sessionId,
      nextTermId
    );
    setPolicyDraft(nextDraft);
    setSavedPolicyDraft(nextDraft);
  }, [policyDraft.sessionId, policyDraft.termId, terms]);

  const policy = useQuery(
    "functions/academic/assessmentEditingPolicies:getAssessmentEditingPolicyForAdmin" as never,
    policyDraft.sessionId && policyDraft.termId
      ? ({
          sessionId: policyDraft.sessionId,
          termId: policyDraft.termId,
        } as never)
      : ("skip" as never)
  ) as AssessmentEditingPolicyResponse | null | undefined;

  useEffect(() => {
    if (
      !policyDraft.sessionId ||
      !policyDraft.termId ||
      policy === undefined
    ) {
      return;
    }

    const nextDraft = createAssessmentEditingPolicyDraft(
      policyDraft.sessionId,
      policyDraft.termId,
      policy
    );
    setPolicyDraft(nextDraft);
    setSavedPolicyDraft(nextDraft);
  }, [policy, policyDraft.sessionId, policyDraft.termId]);

  const handleModeChange = useCallback((mode: ExamInputMode) => {
    setDraftMode(mode);
  }, []);

  const handleSessionChange = useCallback((sessionId: string) => {
    const nextSessionId = (sessionId || null) as Id<"academicSessions"> | null;
    const nextDraft = createAssessmentEditingPolicyDraft(nextSessionId, null);
    setPolicyDraft(nextDraft);
    setSavedPolicyDraft(nextDraft);
  }, []);

  const handleTermChange = useCallback(
    (termId: string) => {
      const nextTermId = (termId || null) as Id<"academicTerms"> | null;
      const nextDraft = createAssessmentEditingPolicyDraft(
        policyDraft.sessionId,
        nextTermId
      );
      setPolicyDraft(nextDraft);
      setSavedPolicyDraft(nextDraft);
    },
    [policyDraft.sessionId]
  );

  const handlePolicyToggleChange = useCallback(
    (value: boolean) => {
      setPolicyDraft((current) => ({
        ...current,
        restrictionsEnabled: value,
      }));
    },
    []
  );

  const handlePolicyDateChange = useCallback(
    (field: "editingStartsAt" | "editingEndsAt", value: string) => {
      setPolicyDraft((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const hasUnsavedChanges = useMemo(
    () =>
      draftMode !== savedMode ||
      !isAssessmentEditingPolicyDraftEqual(policyDraft, savedPolicyDraft),
    [draftMode, policyDraft, savedMode, savedPolicyDraft]
  );

  const handleSave = useCallback(async () => {
    if (draftMode !== savedMode) {
      await saveSettings({ examInputMode: draftMode } as never);
      setSavedMode(draftMode);
    }

    if (!isAssessmentEditingPolicyDraftEqual(policyDraft, savedPolicyDraft)) {
      await saveAssessmentEditingPolicy(
        buildAssessmentEditingPolicyMutationInput(policyDraft) as never
      );
      setSavedPolicyDraft(policyDraft);
    }
  }, [
    draftMode,
    policyDraft,
    savedMode,
    savedPolicyDraft,
    saveAssessmentEditingPolicy,
    saveSettings,
  ]);

  const handleDiscard = useCallback(() => {
    setDraftMode(savedMode);
    setPolicyDraft(savedPolicyDraft);
  }, [savedMode, savedPolicyDraft]);

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
      policyDraft={policyDraft}
      sessions={sessions ?? []}
      terms={terms ?? []}
      isLoadingSessions={sessions === undefined}
      isLoadingTerms={Boolean(policyDraft.sessionId) && terms === undefined}
      onModeChange={handleModeChange}
      onSessionChange={handleSessionChange}
      onTermChange={handleTermChange}
      onPolicyToggleChange={handlePolicyToggleChange}
      onPolicyDateChange={handlePolicyDateChange}
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );
}

function MockExamSettingsPage() {
  const mockSettings = getMockSettings();
  const [savedMode, setSavedMode] = useState<ExamInputMode>(
    mockSettings.examInputMode
  );
  const [draftMode, setDraftMode] = useState<ExamInputMode>(
    mockSettings.examInputMode
  );
  const [savedPolicyDraft, setSavedPolicyDraft] =
    useState<AssessmentEditingPolicyDraft>(() =>
      createAssessmentEditingPolicyDraft(
        mockSessions[0]?.id as Id<"academicSessions">,
        mockTermsBySession[mockSessions[0]?.id ?? ""]?.[0]
          ?.id as Id<"academicTerms">
      )
    );
  const [policyDraft, setPolicyDraft] =
    useState<AssessmentEditingPolicyDraft>(savedPolicyDraft);

  const terms = useMemo(
    () =>
      policyDraft.sessionId != null
        ? mockTermsBySession[policyDraft.sessionId] ?? []
        : [],
    [policyDraft.sessionId]
  );

  useEffect(() => {
    if (!policyDraft.sessionId || policyDraft.termId || terms.length === 0) {
      return;
    }

    const nextDraft = createAssessmentEditingPolicyDraft(
      policyDraft.sessionId,
      terms[0].id as Id<"academicTerms">
    );
    setPolicyDraft(nextDraft);
    setSavedPolicyDraft(nextDraft);
  }, [policyDraft.sessionId, policyDraft.termId, terms]);

  const hasUnsavedChanges = useMemo(
    () =>
      draftMode !== savedMode ||
      !isAssessmentEditingPolicyDraftEqual(policyDraft, savedPolicyDraft),
    [draftMode, policyDraft, savedMode, savedPolicyDraft]
  );

  const handleSave = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    setSavedMode(draftMode);
    setSavedPolicyDraft(policyDraft);
  }, [draftMode, policyDraft]);

  const handleDiscard = useCallback(() => {
    setDraftMode(savedMode);
    setPolicyDraft(savedPolicyDraft);
  }, [savedMode, savedPolicyDraft]);

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
      policyDraft={policyDraft}
      sessions={mockSessions}
      terms={terms}
      isLoadingSessions={false}
      isLoadingTerms={false}
      onModeChange={setDraftMode}
      onSessionChange={(sessionId) => {
        const nextDraft = createAssessmentEditingPolicyDraft(
          (sessionId || null) as Id<"academicSessions"> | null,
          null
        );
        setPolicyDraft(nextDraft);
        setSavedPolicyDraft(nextDraft);
      }}
      onTermChange={(termId) => {
        const nextDraft = createAssessmentEditingPolicyDraft(
          policyDraft.sessionId,
          (termId || null) as Id<"academicTerms"> | null
        );
        setPolicyDraft(nextDraft);
        setSavedPolicyDraft(nextDraft);
      }}
      onPolicyToggleChange={(value) =>
        setPolicyDraft((current) => ({
          ...current,
          restrictionsEnabled: value,
        }))
      }
      onPolicyDateChange={(field, value) =>
        setPolicyDraft((current) => ({
          ...current,
          [field]: value,
        }))
      }
      onSave={handleSave}
      onDiscard={handleDiscard}
    />
  );
}

interface ExamSettingsContentProps {
  currentMode: ExamInputMode;
  hasUnsavedChanges: boolean;
  policyDraft: AssessmentEditingPolicyDraft;
  sessions: SelectorOption[];
  terms: SelectorOption[];
  isLoadingSessions: boolean;
  isLoadingTerms: boolean;
  onModeChange: (mode: ExamInputMode) => void;
  onSessionChange: (sessionId: string) => void;
  onTermChange: (termId: string) => void;
  onPolicyToggleChange: (
    value: boolean
  ) => void;
  onPolicyDateChange: (
    field: "editingStartsAt" | "editingEndsAt",
    value: string
  ) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}

function ExamSettingsContent({
  currentMode,
  hasUnsavedChanges,
  policyDraft,
  sessions,
  terms,
  isLoadingSessions,
  isLoadingTerms,
  onModeChange,
  onSessionChange,
  onTermChange,
  onPolicyToggleChange,
  onPolicyDateChange,
  onSave,
  onDiscard,
}: ExamSettingsContentProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-8 pb-24">
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
            Configure scoring modes and secure exam editing windows for each
            term.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <ExamModeSelector
          currentMode={currentMode}
          onModeChange={onModeChange}
        />
        <AssessmentEditingPolicyCard
          draft={policyDraft}
          sessions={sessions}
          terms={terms}
          isLoadingSessions={isLoadingSessions}
          isLoadingTerms={isLoadingTerms}
          onSessionChange={onSessionChange}
          onTermChange={onTermChange}
          onToggleChange={onPolicyToggleChange}
          onDateChange={onPolicyDateChange}
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
