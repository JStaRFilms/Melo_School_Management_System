"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  History, 
  Settings2,
  ChevronRight,
  Calendar,
  ShieldCheck
} from "lucide-react";
import type { ExamInputMode } from "@school/shared";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { ExamModeSelector } from "./components/ExamModeSelector";
import { WeightDistribution } from "./components/WeightDistribution";
import { ProtocolBlueprint } from "./components/ProtocolBlueprint";
import { SettingsActionBar } from "./components/SettingsActionBar";
import { AssessmentEditingPolicy } from "./components/AssessmentEditingPolicyCard";
import { ProtocolTimeline } from "./components/ProtocolTimeline";
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
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/50">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.1); }
      `}} />

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 overflow-hidden">
        {/* Sidebar Bucket: Configuration & Protocol Switches */}
        <aside className="w-full lg:w-[380px] lg:h-full lg:overflow-y-auto border-l border-slate-200 bg-white/40 backdrop-blur-xl custom-scrollbar shrink-0 flex flex-col">
          <div className="flex-1 p-4 md:p-8 space-y-10 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="space-y-1.5 px-1">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">
                <Settings2 size={10} />
                Global Config
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">Exam Recording</h3>
            </div>

            <div className="space-y-12">
              <ExamModeSelector
                currentMode={currentMode}
                onModeChange={onModeChange}
              />
              
              <AssessmentEditingPolicy
                draft={policyDraft}
                onToggleChange={onPolicyToggleChange}
                onDateChange={onPolicyDateChange}
              />
            </div>

            <div className="pt-8 border-t border-slate-200/60 px-1">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <History size={10} />
                Persistence
              </div>
              <p className="mt-2 text-[10px] leading-relaxed font-bold text-slate-400 uppercase tracking-widest">
                Kernel Sync Enabled
              </p>
            </div>
          </div>

          <SettingsActionBar
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={onSave}
            onDiscard={onDiscard}
          />
        </aside>

        {/* Main Workspace: Protocol Command Center */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8 md:py-10 space-y-10">
            {/* Context Navigation Bar */}
            <div className="space-y-8">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <span>Assessments</span>
                <ChevronRight size={10} />
                <span className="text-slate-900">Command Center</span>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4">
                  <AdminHeader title="Protocol Dashboard" />
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100/50 rounded-full w-fit">
                    <ShieldCheck size={10} className="text-blue-500" />
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Protocol Verified</span>
                  </div>
                </div>
                
                {/* Academic Context Selectors (Pills) */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-200 shadow-sm self-start">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-400">
                    <Calendar size={14} />
                    <span className="text-[10px] font-bold uppercase tracking-widest leading-none tracking-tight">Scope</span>
                  </div>
                  
                  <select
                    value={policyDraft.sessionId ?? ""}
                    onChange={(e) => onSessionChange(e.target.value)}
                    disabled={isLoadingSessions}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-900 outline-none hover:border-blue-500 transition focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select Session</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>

                  <select
                    value={policyDraft.termId ?? ""}
                    onChange={(e) => onTermChange(e.target.value)}
                    disabled={!policyDraft.sessionId || isLoadingTerms}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-900 outline-none hover:border-blue-500 transition focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select Term</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Protocol Intelligence row header */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <ProtocolTimeline 
                startsAt={policyDraft.editingStartsAt} 
                endsAt={policyDraft.editingEndsAt} 
                isEnabled={policyDraft.restrictionsEnabled}
              />
              <WeightDistribution />
            </div>

            {/* The Blueprint Projection Piece */}
            <ProtocolBlueprint />
          </div>
        </main>
      </div>
    </div>
  );
}
