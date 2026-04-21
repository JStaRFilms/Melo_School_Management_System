"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

import type { SubjectRecord } from "@/types";

import { InstructionTemplateStudioScreen } from "./components/InstructionTemplateStudioScreen";
import type {
  InstructionTemplateDraft,
  InstructionTemplateListResponse,
  InstructionTemplateOutputType,
} from "./types";

function LoadingShell() {
  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/60">
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <aside className="w-full border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/70 p-4 md:p-6 lg:h-full lg:w-[390px] lg:overflow-y-auto shrink-0">
          <div className="animate-pulse space-y-4">
            <div className="h-16 rounded-2xl bg-slate-100/70" />
            <div className="h-14 rounded-2xl bg-slate-100/70" />
            <div className="h-12 rounded-2xl bg-slate-100/70" />
            <div className="h-10 rounded-2xl bg-slate-100/70" />
            <div className="h-72 rounded-2xl bg-slate-100/70" />
          </div>
        </aside>
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-[1500px] space-y-6 md:space-y-8 animate-pulse">
            <div className="h-20 rounded-2xl bg-slate-100/70" />
            <div className="h-14 rounded-2xl bg-slate-100/70" />
            <div className="h-48 rounded-2xl bg-slate-100/70" />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="h-52 rounded-2xl bg-slate-100/70" />
              <div className="h-52 rounded-2xl bg-slate-100/70" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function parseWholeNumber(value: string, label: string, minimum: number) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }

  const next = Number(normalized);
  if (!Number.isFinite(next) || !Number.isInteger(next) || next < minimum) {
    throw new Error(`${label} must be a whole number of ${minimum} or more`);
  }

  return next;
}

export default function InstructionTemplateStudioPage() {
  const subjects = useQuery("functions/academic/academicSetup:listSubjects" as never) as SubjectRecord[] | undefined;
  const [outputType, setOutputType] = useState<InstructionTemplateOutputType>("lesson_plan");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const data = useQuery(
    "functions/academic/lessonKnowledgeTemplates:listInstructionTemplates" as never,
    ({
      outputType,
      searchQuery: deferredSearchQuery.trim() || undefined,
    } as never)
  ) as InstructionTemplateListResponse | undefined;

  const saveTemplate = useMutation("functions/academic/lessonKnowledgeTemplates:saveInstructionTemplate" as never);

  const templates = useMemo(() => data?.templates ?? [], [data]);
  const summary = useMemo(
    () => data?.summary ?? { total: 0, active: 0, defaultCount: 0, inactive: 0 },
    [data]
  );

  const handleSaveTemplate = async (draft: InstructionTemplateDraft) => {
    try {
      return (await saveTemplate({
        templateId: draft.templateId ?? null,
        outputType: draft.outputType,
        title: draft.title,
        description: draft.description.trim() ? draft.description : null,
        templateScope: draft.templateScope,
        subjectId: draft.subjectId ?? null,
        level: draft.level.trim() ? draft.level : null,
        isSchoolDefault: draft.isSchoolDefault,
        isActive: draft.isActive,
        objectiveMinimums: {
          minimumObjectives: parseWholeNumber(draft.objectiveMinimums.minimumObjectives, "Minimum objectives", 1),
          minimumSourceMaterials: parseWholeNumber(
            draft.objectiveMinimums.minimumSourceMaterials,
            "Minimum source materials",
            0
          ),
          minimumSections: parseWholeNumber(draft.objectiveMinimums.minimumSections, "Minimum sections", 1),
        },
        sectionDefinitions: draft.sections.map((section) => ({
          id: section.id,
          label: section.label,
          required: section.required,
          minimumWordCount: section.minimumWordCount.trim()
            ? parseWholeNumber(section.minimumWordCount, `Minimum word count for ${section.label || "section"}`, 1)
            : null,
        })),
      } as never)) as string;
    } catch (error) {
      throw new Error(getUserFacingErrorMessage(error, "Failed to save template."));
    }
  };

  if (!subjects || !data) {
    return <LoadingShell />;
  }

  return (
    <InstructionTemplateStudioScreen
      subjects={subjects}
      templates={templates}
      summary={summary}
      outputType={outputType}
      searchQuery={searchQuery}
      onOutputTypeChange={setOutputType}
      onSearchQueryChange={setSearchQuery}
      onSaveTemplate={handleSaveTemplate}
    />
  );
}
