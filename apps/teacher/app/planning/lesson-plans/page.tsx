"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  buildTeacherPlanningLibraryAttachHref,
  parsePlanningContextFromSearchParams,
  parseTeacherLessonPlanSourceIds,
} from "@school/shared";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { X } from "lucide-react";

import { LessonPlanWorkspaceScreen } from "./components/LessonPlanWorkspaceScreen";
import type {
  LessonPlanSaveResult,
  LessonPlanWorkspaceData,
  LessonPlanWorkspaceOutputType,
} from "./types";

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
        <div className="h-[640px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[840px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
        <div className="h-[640px] rounded-[2rem] border border-slate-200 bg-white shadow-sm animate-pulse" />
      </div>
    </div>
  );
}

function getLessonPlanGenerationToast(error: unknown): {
  title: string;
  description: string;
} {
  const message = getErrorMessage(error, "Something went wrong while generating. Please try again.");

  if (/no indexed source text excerpts/i.test(message)) {
    return {
      title: "No usable source text found",
      description: "We couldn't find usable text for the selected materials. Re-upload or reprocess the materials, then try again.",
    };
  }

  return {
    title: "Unable to generate draft",
    description: message,
  };
}

export default function LessonPlansPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [outputType, setOutputType] = useState<LessonPlanWorkspaceOutputType>(
    (searchParams.get("outputType") as LessonPlanWorkspaceOutputType | null) ?? "lesson_plan"
  );
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
  const sourceSyncKey = useMemo(() => getPlanningSourceSyncKey(planningContext), [planningContext]);

  useEffect(() => {
    if (!sourceSyncKey || selectedSourceIds.length > 0) {
      return;
    }

    const syncedValue = window.localStorage.getItem(sourceSyncKey);
    const syncedSourceIds = parseTeacherLessonPlanSourceIds(syncedValue);
    if (syncedSourceIds.length === 0) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("sourceIds", syncedSourceIds.join(","));
    params.set("sourceOrigin", "workspace_sync");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams, selectedSourceIds.length, sourceSyncKey]);

  useEffect(() => {
    if (!sourceSyncKey || effectiveSourceIds.length === 0) {
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

      return result;
    } catch (error) {
      const message = getErrorMessage(error, "Failed to save draft.");
      appToast.error("Unable to save draft", {
        id: "teacher-lesson-plans-save-error",
        description: message,
      });
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

      return payload as LessonPlanSaveResult;
    } catch (error) {
      const toastMessage = getLessonPlanGenerationToast(error);
      appToast.error(toastMessage.title, {
        id: "teacher-lesson-plans-generate-error",
        description: toastMessage.description,
      });
      throw new Error(toastMessage.description);
    }
  };

  if (!workspace) {
    return <LoadingShell />;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/planning/library"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 shadow-sm"
              >
                <X className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                Planning Workspace
              </h1>
            </div>
            
            <div className="hidden items-center gap-4 xl:flex">
               <div className="h-1 w-1 rounded-full bg-slate-300" />
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planning Hub</p>
            </div>
          </div>

          {workspace.planningContext?.topicTitle || workspace.sourceContext.topicLabel ? null : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Target Topic for Generation</label>
              <input
                value={targetTopicLabel}
                onChange={(event) => setTargetTopicLabel(event.target.value)}
                placeholder="e.g. Fractions: adding unlike denominators"
                className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
              />
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
      </div>
    </div>
  );
}
