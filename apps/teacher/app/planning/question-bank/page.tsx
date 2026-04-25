"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getUserFacingErrorMessage } from "@school/shared";

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

  const sourceIdsParam = searchParams.get("sourceIds");
  const selectedSourceIds = useMemo(
    () => normalizeAssessmentSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );

  const workspace = useQuery(
    "functions/academic/lessonKnowledgeAssessmentDrafts:getTeacherAssessmentBankWorkspace" as never,
    {
      draftMode,
      sourceIds: selectedSourceIds,
    } as never
  ) as AssessmentWorkspaceData | undefined;

  const saveDraft = useMutation(
    "functions/academic/lessonKnowledgeAssessmentDrafts:saveTeacherAssessmentBankDraft" as never
  );

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
    updateSelectedSourceIds(selectedSourceIds.filter((id) => id !== sourceId));
  };

  const handleOpenLibrary = () => {
    const href = selectedSourceIds.length > 0
      ? `/planning/library?sourceIds=${selectedSourceIds.join(",")}`
      : "/planning/library";
    router.push(href);
  };

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
    if (!workspace?.sourceContext.subjectId || !workspace.sourceContext.level) {
      throw new Error("Select at least one accessible source with a subject and level before saving.");
    }

    try {
      const result = (await saveDraft({
        bankId: workspace.draft.bankId ?? null,
        draftMode,
        title: draft.title,
        description: draft.description,
        sourceIds: selectedSourceIds,
        sourceSelectionSnapshot: workspace.draft.sourceSelectionSnapshot ?? "",
        effectiveGenerationSettings: draft.effectiveGenerationSettings,
        subjectId: workspace.sourceContext.subjectId,
        level: workspace.sourceContext.level,
        topicLabel: workspace.sourceContext.topicLabel ?? null,
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
          sourceIds: selectedSourceIds,
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

      <QuestionBankWorkspaceScreen
        key={`${draftMode}:${selectedSourceIds.join(",")}`}
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
