"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildTeacherPlanningLibraryAttachHref,
  getUserFacingErrorMessage,
  parsePlanningContextFromSearchParams,
} from "@school/shared";

import { TeacherHeader } from "@/lib/components/ui/TeacherHeader";
import { QuestionBankWorkspaceScreen } from "./components/QuestionBankWorkspaceScreen";
import type {
  AssessmentBankGenerationResult,
  AssessmentBankSaveResult,
  AssessmentDraftMode,
  AssessmentWorkspaceData,
} from "./types";
import { normalizeAssessmentSourceIds, assessmentDraftModeOptions } from "./types";

function getPlanningSourceSyncKey(planningContext: ReturnType<typeof parsePlanningContextFromSearchParams>) {
  if (!planningContext) {
    return null;
  }

  if (planningContext.kind === "topic") {
    return [
      "teacher-planning-sources",
      "topic",
      planningContext.classId,
      planningContext.termId,
      planningContext.subjectId,
      planningContext.level,
      planningContext.topicId,
    ].join(":");
  }

  return null;
}

function LoadingShell() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="h-[520px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[820px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[520px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      </div>
    </div>
  );
}

function parseDraftMode(rawValue: string | null): AssessmentDraftMode {
  return assessmentDraftModeOptions.some((option) => option.value === rawValue)
    ? (rawValue as AssessmentDraftMode)
    : "practice_quiz";
}

export default function QuestionBankPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftMode, setDraftMode] = useState<AssessmentDraftMode>(parseDraftMode(searchParams.get("mode")));
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [targetTopicLabel, setTargetTopicLabel] = useState("");

  const sourceIdsParam = searchParams.get("sourceIds");
  const selectedSourceIds = useMemo(
    () => normalizeAssessmentSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );
  const planningContext = useMemo(
    () => parsePlanningContextFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const workspace = useQuery(
    "functions/academic/lessonKnowledgeAssessmentDrafts:getTeacherAssessmentBankWorkspace" as never,
    {
      draftMode,
      sourceIds: selectedSourceIds,
      planningContext:
        planningContext?.kind === "topic" || planningContext?.kind === "exam_scope"
          ? planningContext
          : undefined,
    } as never
  ) as AssessmentWorkspaceData | undefined;

  const saveDraft = useMutation(
    "functions/academic/lessonKnowledgeAssessmentDrafts:saveTeacherAssessmentBankDraft" as never
  );
  const effectiveSourceIds =
    selectedSourceIds.length > 0
      ? selectedSourceIds
      : workspace?.sourceIds.length
        ? workspace.sourceIds
        : workspace?.selectedSources.map((source) => source._id) ?? [];
  const sourceSyncKey = useMemo(() => getPlanningSourceSyncKey(planningContext), [planningContext]);

  useEffect(() => {
    if (!sourceSyncKey || selectedSourceIds.length > 0) {
      return;
    }

    const syncedValue = window.localStorage.getItem(sourceSyncKey);
    const syncedSourceIds = normalizeAssessmentSourceIds(syncedValue);
    if (syncedSourceIds.length === 0) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("sourceIds", syncedSourceIds.join(","));
    params.set("sourceOrigin", "workspace_sync");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedSourceIds.length, sourceSyncKey]);

  useEffect(() => {
    if (!sourceSyncKey) {
      return;
    }

    window.localStorage.setItem(sourceSyncKey, effectiveSourceIds.join(","));
  }, [effectiveSourceIds, sourceSyncKey]);

  const updateSelectedSourceIds = (nextIds: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextIds.length > 0) {
      params.set("sourceIds", nextIds.join(","));
    } else {
      params.delete("sourceIds");
    }

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const updateDraftMode = useCallback(
    (nextMode: AssessmentDraftMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", nextMode);
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      setDraftMode(nextMode);
    },
    [pathname, router, searchParams]
  );

  const handleRemoveSource = (sourceId: string) => {
    updateSelectedSourceIds(effectiveSourceIds.filter((id) => id !== sourceId));
  };

  const handleOpenLibrary = () => {
    const currentQuery = searchParams.toString();
    const returnTo = currentQuery ? `${pathname}?${currentQuery}` : pathname;
    router.push(
      buildTeacherPlanningLibraryAttachHref({
        returnTo,
        sourceIds: effectiveSourceIds,
      })
    );
  };

  const effectiveTopicLabel =
    workspace?.planningContext?.kind === "topic"
      ? workspace.planningContext.topicTitle
      : workspace?.sourceContext.topicLabel ?? (targetTopicLabel.trim() || null);

  useEffect(() => {
    if (planningContext?.kind === "exam_scope" && draftMode !== "exam_draft") {
      updateDraftMode("exam_draft");
    }
  }, [draftMode, planningContext, updateDraftMode]);

  useEffect(() => {
    setTargetTopicLabel(workspace?.sourceContext.topicLabel ?? "");
  }, [workspace?.sourceContext.topicLabel, effectiveSourceIds, draftMode]);

  const handleSaveDraft = async (draft: {
    effectiveGenerationSettings: NonNullable<AssessmentWorkspaceData["draft"]["effectiveGenerationSettings"]>;
    title: string;
    description: string | null;
    items: Array<{
      questionType: "multiple_choice" | "short_answer" | "essay" | "true_false" | "fill_in_the_blank";
      difficulty: "easy" | "medium" | "hard";
      promptText: string;
      answerText: string;
      explanationText: string;
      marks: number | null;
      tags: string[];
    }>;
  }) => {
    if (!workspace) {
      throw new Error("Workspace is still loading.");
    }

    const effectiveSubjectId = workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId ?? null;
    const effectiveLevel = workspace.planningContext?.level ?? workspace.sourceContext.level ?? null;

    if (!effectiveSubjectId || !effectiveLevel) {
      throw new Error("Resolve a valid subject and level before saving this draft.");
    }

    if (draftMode !== "exam_draft" && !effectiveTopicLabel) {
      throw new Error("Add a target topic before saving this draft.");
    }

    try {
      const result = (await saveDraft({
        bankId: workspace.draft.bankId ?? null,
        draftMode,
        title: draft.title,
        description: draft.description,
        sourceIds: effectiveSourceIds,
        sourceSelectionSnapshot: workspace.draft.sourceSelectionSnapshot ?? "",
        effectiveGenerationSettings: draft.effectiveGenerationSettings,
        subjectId: effectiveSubjectId,
        level: effectiveLevel,
        topicLabel: effectiveTopicLabel,
        planningContext:
          planningContext?.kind === "topic" || planningContext?.kind === "exam_scope"
            ? planningContext
            : undefined,
        items: draft.items,
      } as never)) as AssessmentBankSaveResult;

      setWorkspaceError(null);
      return result;
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Failed to save assessment draft.");
      setWorkspaceError(message);
      throw new Error(message);
    }
  };

  const handleGenerateDraft = async (
    effectiveGenerationSettings: NonNullable<AssessmentWorkspaceData["draft"]["effectiveGenerationSettings"]>
  ) => {
    try {
      const response = await fetch("/api/ai/question-bank/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draftMode,
          sourceIds: effectiveSourceIds,
          targetTopicLabel: effectiveTopicLabel ?? undefined,
          planningContext:
            planningContext?.kind === "topic" || planningContext?.kind === "exam_scope"
              ? planningContext
              : undefined,
          effectiveGenerationSettings,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | AssessmentBankGenerationResult
        | { error?: string; warnings?: string[] }
        | null;

      if (!response.ok) {
        const message = (payload && "error" in payload && payload.error) || "Generation failed.";
        throw new Error(message);
      }

      setWorkspaceError(null);
      return payload as AssessmentBankGenerationResult;
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Generation failed.");
      setWorkspaceError(message);
      throw new Error(message);
    }
  };

  if (!workspace) {
    return <LoadingShell />;
  }

  return (
    <main className="min-h-screen space-y-8 px-4 py-6 md:px-6 md:py-8">
      {workspaceError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm">
          {workspaceError}
        </div>
      ) : null}

      <TeacherHeader
        title="Question Bank Workspace"
        label="Teacher Planning"
        description="Design and refine assessment collections using your course repository and AI-driven generation profiles."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/planning/library"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Back to library
            </Link>
          </div>
        }
      />

      {workspace.planningContext?.kind === "topic" || workspace.sourceContext.topicLabel || draftMode === "exam_draft" ? null : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm ring-1 ring-amber-950/5">
          <label className="block text-[10px] font-black uppercase tracking-widest text-amber-700">Target topic for generation</label>
          <input
            value={targetTopicLabel}
            onChange={(event) => setTargetTopicLabel(event.target.value)}
            placeholder="e.g. Photosynthesis and food chains"
            className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:ring-4 focus:ring-amber-500/10"
          />
          <p className="mt-2 text-[11px] font-medium leading-relaxed text-amber-900/60">
            Your selected sources are broad planning references, so the workspace will not derive a topic from them. Add a target topic to steer this question-bank generation.
          </p>
        </div>
      )}

      <QuestionBankWorkspaceScreen
        key={`${draftMode}:${effectiveSourceIds.join(",")}:${workspace.planningContext?.planningContextKey ?? "compat"}`}
        workspace={workspace}
        onDraftModeChange={updateDraftMode}
        onRemoveSource={handleRemoveSource}
        onOpenLibrary={handleOpenLibrary}
        onSaveDraft={handleSaveDraft}
        onGenerateDraft={handleGenerateDraft}
      />
    </main>
  );
}
