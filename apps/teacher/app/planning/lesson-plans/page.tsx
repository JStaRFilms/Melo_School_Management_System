"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  buildTeacherPlanningLibraryAttachHref,
  getUserFacingErrorMessage,
  parsePlanningContextFromSearchParams,
  parseTeacherLessonPlanSourceIds,
} from "@school/shared";

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
  const [outputType, setOutputType] = useState<LessonPlanWorkspaceOutputType>(
    (searchParams.get("outputType") as LessonPlanWorkspaceOutputType | null) ?? "lesson_plan"
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [targetTopicLabel, setTargetTopicLabel] = useState("");

  const sourceIdsParam = searchParams.get("sourceIds");
  const selectedSourceIds = useMemo(
    () => parseTeacherLessonPlanSourceIds(sourceIdsParam),
    [sourceIdsParam]
  );
  const planningContext = useMemo(
    () => parsePlanningContextFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const workspace = useQuery(
    "functions/academic/lessonKnowledgeLessonPlans:getTeacherInstructionWorkspace" as never,
    {
      outputType,
      sourceIds: selectedSourceIds,
      planningContext: planningContext?.kind === "topic" ? planningContext : undefined,
    } as never
  ) as LessonPlanWorkspaceData | undefined;

  const saveDraft = useMutation(
    "functions/academic/lessonKnowledgeLessonPlans:saveTeacherInstructionArtifactDraft" as never
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
    workspace?.planningContext?.topicTitle ?? workspace?.sourceContext.topicLabel ?? (targetTopicLabel.trim() || null);

  useEffect(() => {
    setTargetTopicLabel(workspace?.sourceContext.topicLabel ?? "");
  }, [workspace?.sourceContext.topicLabel, effectiveSourceIds, outputType]);

  const handleSaveDraft = async (draft: {
    title: string;
    documentState: string;
    plainText: string;
  }) => {
    if (!workspace) {
      throw new Error("Workspace is still loading.");
    }

    const effectiveSubjectId = workspace.planningContext?.subjectId ?? workspace.sourceContext.subjectId ?? null;
    const effectiveLevel = workspace.planningContext?.level ?? workspace.sourceContext.level ?? null;

    if (!effectiveSubjectId || !effectiveLevel) {
      throw new Error("Resolve a valid subject and level before saving this draft.");
    }

    if (!effectiveTopicLabel) {
      throw new Error("Add a target topic before saving this draft.");
    }

    try {
      const result = (await saveDraft({
        artifactId: workspace.draft.artifactId ?? null,
        outputType,
        title: draft.title,
        documentState: draft.documentState,
        plainText: draft.plainText,
        sourceIds: effectiveSourceIds,
        subjectId: effectiveSubjectId,
        level: effectiveLevel,
        topicLabel: effectiveTopicLabel,
        planningContext: planningContext?.kind === "topic" ? planningContext : undefined,
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
          sourceIds: effectiveSourceIds,
          targetTopicLabel: effectiveTopicLabel ?? undefined,
          planningContext: planningContext?.kind === "topic" ? planningContext : undefined,
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

      {workspace.planningContext?.topicTitle || workspace.sourceContext.topicLabel ? null : (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <label className="block text-xs font-black uppercase tracking-[0.22em] text-amber-700">Target topic for generation</label>
          <input
            value={targetTopicLabel}
            onChange={(event) => setTargetTopicLabel(event.target.value)}
            placeholder="e.g. Fractions: adding unlike denominators"
            className="mt-2 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <p className="mt-2 text-xs leading-5 text-amber-900/80">
            Your selected sources are broad planning references, so the workspace will not derive a topic from them. Add a target topic to steer this generation.
          </p>
        </div>
      )}

      <LessonPlanWorkspaceScreen
        key={`${outputType}:${effectiveSourceIds.join(",")}:${workspace.planningContext?.planningContextKey ?? "compat"}`}
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
