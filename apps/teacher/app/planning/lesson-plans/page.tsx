"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getUserFacingErrorMessage, parseTeacherLessonPlanSourceIds } from "@school/shared";

import { LessonPlanWorkspaceScreen } from "./components/LessonPlanWorkspaceScreen";
import type {
  LessonPlanSaveResult,
  LessonPlanWorkspaceData,
  LessonPlanWorkspaceOutputType,
} from "./types";

function LoadingShell() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <div className="h-[640px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[840px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[640px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      </div>
    </div>
  );
}

export default function LessonPlansPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [outputType, setOutputType] = useState<LessonPlanWorkspaceOutputType>("lesson_plan");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const sourceIdsParam = searchParams.get("sourceIds");
  const selectedSourceIds = useMemo(
    () => parseTeacherLessonPlanSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );

  const workspace = useQuery(
    "functions/academic/lessonKnowledgeLessonPlans:getTeacherInstructionWorkspace" as never,
    {
      outputType,
      sourceIds: selectedSourceIds,
    } as never
  ) as LessonPlanWorkspaceData | undefined;

  const saveDraft = useMutation(
    "functions/academic/lessonKnowledgeLessonPlans:saveTeacherInstructionArtifactDraft" as never
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

  const handleRemoveSource = (sourceId: string) => {
    updateSelectedSourceIds(selectedSourceIds.filter((id) => id !== sourceId));
  };

  const handleOpenLibrary = () => {
    const href = selectedSourceIds.length > 0 ? `/planning/library?sourceIds=${selectedSourceIds.join(",")}` : "/planning/library";
    router.push(href);
  };

  const handleSaveDraft = async (draft: {
    title: string;
    documentState: string;
    plainText: string;
  }) => {
    if (!workspace?.sourceContext.subjectId || !workspace.sourceContext.level) {
      throw new Error("Select at least one accessible source with a subject and level before saving.");
    }

    try {
      const result = (await saveDraft({
        artifactId: workspace.draft.artifactId ?? null,
        outputType,
        title: draft.title,
        documentState: draft.documentState,
        plainText: draft.plainText,
        sourceIds: selectedSourceIds,
        subjectId: workspace.sourceContext.subjectId,
        level: workspace.sourceContext.level,
        topicLabel: workspace.sourceContext.topicLabel ?? null,
        revisionKind: "manual_save",
      } as never)) as LessonPlanSaveResult;

      setWorkspaceError(null);
      return result;
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "Failed to save draft.");
      setWorkspaceError(message);
      throw new Error(message);
    }
  };

  const handleGenerateDraft = async () => {
    try {
      const response = await fetch("/api/ai/lesson-plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outputType,
          sourceIds: selectedSourceIds,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | LessonPlanSaveResult
        | { error?: string; warnings?: string[] }
        | null;

      if (!response.ok) {
        const message =
          (payload && "error" in payload && payload.error) ||
          "Generation failed.";
        throw new Error(message);
      }

      setWorkspaceError(null);
      return payload as LessonPlanSaveResult;
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

      <div className="flex items-center justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Teacher planning</p>
          <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
            Lesson plan workspace
          </h1>
        </div>
        <Link
          href="/planning/library"
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Back to library
        </Link>
      </div>

      <LessonPlanWorkspaceScreen
        key={`${outputType}:${selectedSourceIds.join(",")}`}
        workspace={workspace}
        onOutputTypeChange={setOutputType}
        onRemoveSource={handleRemoveSource}
        onOpenLibrary={handleOpenLibrary}
        onSaveDraft={handleSaveDraft}
        onGenerateDraft={handleGenerateDraft}
      />
    </div>
  );
}
