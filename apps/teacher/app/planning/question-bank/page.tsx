"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildTeacherPlanningLibraryAttachHref,
  getUserFacingErrorMessage,
  parsePlanningContextFromSearchParams,
} from "@school/shared";

import { QuestionBankWorkspaceScreen } from "./components/QuestionBankWorkspaceScreen";
import type {
  AssessmentBankGenerationResult,
  AssessmentBankSaveResult,
  AssessmentDraftMode,
  AssessmentWorkspaceData,
} from "./types";
import { normalizeAssessmentSourceIds, assessmentDraftModeOptions } from "./types";

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
  const effectiveSourceIds = workspace?.sourceIds ?? selectedSourceIds;

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

  const updateDraftMode = (nextMode: AssessmentDraftMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", nextMode);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    setDraftMode(nextMode);
  };

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
  }, [draftMode, planningContext]);

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
    <div className="space-y-4">
      {workspaceError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 shadow-sm">
          {workspaceError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Teacher planning</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            Question bank workspace
          </h1>
        </div>
        <Link
          href="/planning/library"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Back to library
        </Link>
      </div>

      {workspace.planningContext?.kind === "topic" || workspace.sourceContext.topicLabel || draftMode === "exam_draft" ? null : (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <label className="block text-xs font-black uppercase tracking-[0.22em] text-amber-700">Target topic for generation</label>
          <input
            value={targetTopicLabel}
            onChange={(event) => setTargetTopicLabel(event.target.value)}
            placeholder="e.g. Photosynthesis and food chains"
            className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <p className="mt-2 text-xs leading-5 text-amber-900/80">
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
    </div>
  );
}
