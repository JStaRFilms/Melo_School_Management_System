"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  buildTeacherPlanningLibraryAttachHref,
  parsePlanningContextFromSearchParams,
  parseTeacherLessonPlanSourceIds,
} from "@school/shared";
import { appToast, getErrorMessage } from "@school/shared/toast";
import { X } from "lucide-react";
import { api } from "@school/convex/_generated/api";

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
    api.functions.academic.lessonKnowledgeLessonPlans.getTeacherInstructionWorkspace,
    {
      outputType,
      sourceIds: selectedSourceIds,
      planningContext: planningContext?.kind === "topic" ? planningContext : undefined,
    }
  ) as LessonPlanWorkspaceData | undefined;

  const saveDraft = useMutation(
    api.functions.academic.lessonKnowledgeLessonPlans.saveTeacherInstructionArtifactDraft
  );
  const generateDraftAction = useAction(
    api.functions.academic.documentGeneration.generateTeacherLessonPlanDraft
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
      })) as LessonPlanSaveResult;

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
      const planningContextArg =
        planningContext?.kind === "topic"
          ? {
              kind: "topic" as const,
              classId: planningContext.classId as Id<"classes">,
              termId: planningContext.termId as Id<"academicTerms">,
              subjectId: planningContext.subjectId as Id<"subjects">,
              level: planningContext.level,
              topicId: planningContext.topicId as Id<"knowledgeTopics">,
            }
          : undefined;

      const result = (await generateDraftAction({
        outputType,
        sourceIds: effectiveSourceIds as Array<Id<"knowledgeMaterials">>,
        targetTopicLabel: effectiveTopicLabel ?? undefined,
        planningContext: planningContextArg,
      })) as LessonPlanSaveResult;
      return result;
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
    <div className="h-full flex flex-col min-h-0 bg-slate-50/50 overflow-hidden">
      {/* Top Fixed Header Bar */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 md:px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/planning/library"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-all hover:bg-slate-50 shadow-2xs cursor-pointer"
          >
            <X className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
            Planning Workspace
          </h1>
        </div>
        
        <div className="hidden items-center gap-4 xl:flex">
          <div className="h-1 w-1 rounded-full bg-slate-300" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planning Hub</p>
        </div>
      </div>

      {workspace.planningContext?.topicTitle || workspace.sourceContext.topicLabel ? null : (
        <div className="shrink-0 mx-4 md:mx-8 my-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs">
          <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Target Topic for Generation</label>
          <input
            value={targetTopicLabel}
            onChange={(event) => setTargetTopicLabel(event.target.value)}
            placeholder="e.g. Fractions: adding unlike denominators"
            className="mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-950 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
        </div>
      )}

      {/* 3-Column Workspace flex container filling remaining height */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
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
  );
}
