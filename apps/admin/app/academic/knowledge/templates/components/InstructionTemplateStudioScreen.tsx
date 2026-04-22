"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getUserFacingErrorMessage } from "@school/shared";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  Layers3,
  Loader2,
  Monitor,
  PencilLine,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { StatGroup } from "@/components/ui/StatGroup";
import { cn } from "@/utils";

import type { InstructionTemplateStudioScreenProps } from "../types";
import {
  createEmptyInstructionTemplateDraft,
  createInstructionTemplateDraft,
  createInstructionTemplateSectionDraftFromLabel,
  getInstructionTemplateApplicabilitySummary,
  getInstructionTemplateDraftApplicabilityMessage,
  getInstructionTemplateDraftResolutionRank,
  getInstructionTemplateResolutionPathLabel,
  getInstructionTemplateScopeLabel,
  instructionTemplateOutputTypeOptions,
  instructionTemplateScopeOptions,
  moveTemplateItem,
  serializeInstructionTemplateDraft,
  validateInstructionTemplateDraft,
} from "../utils";
import type {
  InstructionTemplateDraft,
  InstructionTemplateListItem,
  InstructionTemplateOutputType,
  InstructionTemplateScope,
  InstructionTemplateSectionDraft,
} from "../types";

const editorModes = [
  { id: "designer", label: "Designer", icon: PencilLine },
  { id: "monitor", label: "Monitor", icon: Monitor },
] as const;

function buildLevelOptionsWithCurrentValue(
  levelOptions: Array<{ value: string; label: string }>,
  currentLevel: string
) {
  const trimmed = currentLevel.trim();
  if (!trimmed) {
    return levelOptions;
  }

  if (levelOptions.some((option) => option.value === trimmed)) {
    return levelOptions;
  }

  return [{ value: trimmed, label: `Legacy: ${trimmed}` }, ...levelOptions];
}

export function InstructionTemplateStudioScreen({
  subjects,
  levelOptions,
  templates,
  summary,
  outputType,
  searchQuery,
  onOutputTypeChange,
  onSearchQueryChange,
  onSaveTemplate,
}: InstructionTemplateStudioScreenProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<InstructionTemplateDraft>(() => createEmptyInstructionTemplateDraft(outputType));
  const [editorMode, setEditorMode] = useState<(typeof editorModes)[number]["id"]>("designer");
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const actionBarRef = useRef<HTMLDivElement | null>(null);

  const selectedTemplate = useMemo<InstructionTemplateListItem | null>(() => {
    if (!selectedTemplateId || selectedTemplateId === "new") {
      return null;
    }

    return templates.find((template) => template._id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  const activeDraftSource = useMemo<InstructionTemplateDraft>(() => {
    if (!selectedTemplate) {
      return createEmptyInstructionTemplateDraft(outputType);
    }

    return createInstructionTemplateDraft(selectedTemplate);
  }, [outputType, selectedTemplate]);

  const dirty = useMemo(
    () => serializeInstructionTemplateDraft(draft) !== serializeInstructionTemplateDraft(activeDraftSource),
    [activeDraftSource, draft]
  );

  const validationIssue = useMemo(() => validateInstructionTemplateDraft(draft, templates), [draft, templates]);

  useEffect(() => {
    if (selectedTemplateId === null) {
      setSelectedTemplateId(templates[0]?._id ?? "new");
      return;
    }

    if (selectedTemplateId !== "new" && !templates.some((template) => template._id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?._id ?? "new");
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (selectedTemplateId === "new") {
      setDraft(createEmptyInstructionTemplateDraft(outputType));
      return;
    }

    if (!selectedTemplate) {
      return;
    }

    setDraft(createInstructionTemplateDraft(selectedTemplate));
  }, [outputType, selectedTemplate, selectedTemplateId]);

  useEffect(() => {
    const updateHeight = () => {
      setActionBarHeight(actionBarRef.current?.clientHeight ?? 0);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (result) {
      const timer = window.setTimeout(() => setResult(null), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [result]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const handleSelectTemplate = useCallback((templateId: string | "new") => {
    setSelectedTemplateId(templateId);
    setEditorMode("designer");
  }, []);

  const handleCreateTemplate = useCallback(() => {
    setSelectedTemplateId("new");
    setDraft(createEmptyInstructionTemplateDraft(outputType));
    setEditorMode("designer");
  }, [outputType]);

  const handleSwitchOutputType = useCallback(
    (nextOutputType: InstructionTemplateOutputType) => {
      if (nextOutputType === outputType) {
        return;
      }

      onOutputTypeChange(nextOutputType);
      setSelectedTemplateId(null);
      setEditorMode("designer");
    },
    [onOutputTypeChange, outputType]
  );

  const updateDraft = useCallback((patch: Partial<InstructionTemplateDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateSection = useCallback(
    (sectionIndex: number, patch: Partial<InstructionTemplateSectionDraft>) => {
      setDraft((current) => {
        const sections = current.sections.slice();
        sections[sectionIndex] = { ...sections[sectionIndex], ...patch };
        return { ...current, sections };
      });
    },
    []
  );

  const handleScopeChange = useCallback(
    (nextScope: InstructionTemplateScope) => {
      setDraft((current) => {
        const nextSubjectId = current.subjectId ?? subjects[0]?._id ?? null;

        switch (nextScope) {
          case "subject_and_level":
            return {
              ...current,
              templateScope: nextScope,
              subjectId: nextSubjectId,
              level: current.level,
              isSchoolDefault: false,
            };
          case "subject_only":
            return {
              ...current,
              templateScope: nextScope,
              subjectId: nextSubjectId,
              level: "",
              isSchoolDefault: false,
            };
          case "level_only":
            return {
              ...current,
              templateScope: nextScope,
              subjectId: null,
              isSchoolDefault: false,
            };
          case "school_default":
            return {
              ...current,
              templateScope: nextScope,
              subjectId: null,
              level: "",
              isSchoolDefault: true,
            };
        }
      });
    },
    [subjects]
  );

  const handleSave = useCallback(async () => {
    if (validationIssue) {
      throw new Error(validationIssue);
    }

    setResult(null);
    const nextId = await onSaveTemplate(draft);
    setSelectedTemplateId(nextId);
    setDraft((current) => ({ ...current, templateId: nextId }));
  }, [draft, onSaveTemplate, validationIssue]);

  const handleDiscard = useCallback(() => {
    setDraft(selectedTemplate ? createInstructionTemplateDraft(selectedTemplate) : createEmptyInstructionTemplateDraft(outputType));
  }, [outputType, selectedTemplate]);

  const subjectLabel = useMemo(() => {
    if (draft.subjectId) {
      const subject = subjects.find((entry) => entry._id === draft.subjectId);
      if (subject) {
        return `${subject.name} (${subject.code})`;
      }
    }

    return "No subject selected";
  }, [draft.subjectId, subjects]);

  const scopeSummary = useMemo(() => getInstructionTemplateApplicabilitySummary(draft, subjects), [draft, subjects]);
  const currentTemplateLabel = selectedTemplate ? getInstructionTemplateScopeLabel(selectedTemplate) : "New template";
  const previewPathLabel = selectedTemplate ? getInstructionTemplateResolutionPathLabel(selectedTemplate) : scopeSummary;
  const canSave = dirty && !validationIssue;

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/60">
      <style jsx global>{`
        .knowledge-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .knowledge-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .knowledge-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 9999px;
        }
        .knowledge-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
        }
      `}</style>

      {result && (
        <div
          className="fixed right-6 z-[100] animate-in slide-in-from-right-4 duration-500"
          style={{ bottom: `${actionBarHeight + 16}px` }}
        >
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border",
              result.success
                ? "bg-emerald-500/90 border-emerald-400 text-white"
                : "bg-rose-500/90 border-rose-400 text-white"
            )}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest opacity-60">Status Message</span>
              <span className="text-sm font-bold">{result.message}</span>
            </div>
            <button className="ml-2 p-1 hover:bg-white/10 rounded-lg" onClick={() => setResult(null)} type="button">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        <aside className="w-full border-b lg:border-b-0 lg:border-r border-slate-200/60 bg-white/70 backdrop-blur-xl lg:h-full lg:w-[390px] lg:overflow-y-auto knowledge-scrollbar shrink-0 order-2 lg:order-1">
          <TemplateListPanel
            outputType={outputType}
            templates={templates}
            searchQuery={searchQuery}
            summary={summary}
            selectedTemplateId={selectedTemplateId}
            onCreateTemplate={handleCreateTemplate}
            onOutputTypeChange={handleSwitchOutputType}
            onSearchQueryChange={onSearchQueryChange}
            onSelectTemplate={handleSelectTemplate}
          />
        </aside>

        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto knowledge-scrollbar p-4 md:p-8 order-1 lg:order-2">
          <div className="mx-auto max-w-[1500px] space-y-6 md:space-y-8 pb-24">
            <AdminHeader
              label="Academic Knowledge"
              title="Template Studio"
              description="Create structured lesson-plan, student-note, and assignment templates with deterministic applicability and audit-friendly rule sets."
              actions={
                <StatGroup
                  stats={[
                    { label: "Templates", value: summary.total, icon: <BookOpenText className="h-4 w-4" /> },
                    { label: "Active", value: summary.active, icon: <ShieldCheck className="h-4 w-4" /> },
                    { label: "Default", value: summary.defaultCount, icon: <Layers3 className="h-4 w-4" /> },
                    { label: "Inactive", value: summary.inactive, icon: <Sparkles className="h-4 w-4" /> },
                  ]}
                  variant="wrap"
                />
              }
            />

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm ring-1 ring-slate-950/5">
              {instructionTemplateOutputTypeOptions.map((option) => {
                const selected = option.value === outputType;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSwitchOutputType(option.value)}
                    className={cn(
                      "flex min-w-[160px] flex-1 flex-col gap-0.5 rounded-xl px-4 py-3 text-left transition-all",
                      selected
                        ? "bg-slate-950 text-white shadow-xl shadow-slate-950/15"
                        : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.22em]">{option.label}</span>
                    <span className={cn("text-[12px] font-medium", selected ? "text-white/60" : "text-slate-400")}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-4 xl:flex-row">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div className="space-y-1">
                    <h2 className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Editor workspace</h2>
                    <p className="text-xs font-medium text-slate-500">
                      {selectedTemplate ? currentTemplateLabel : "Create a new template or select one from the catalog."}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 rounded-xl bg-slate-200/50 p-1">
                    {editorModes.map((mode) => {
                      const Icon = mode.icon;
                      const active = editorMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setEditorMode(mode.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                            active
                              ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-900/5"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {validationIssue && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-rose-500">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Validation issue
                    </div>
                    <p className="mt-1.5 text-sm font-semibold leading-relaxed">{validationIssue}</p>
                  </div>
                )}

                {editorMode === "designer" ? (
                  <TemplateEditor
                    draft={draft}
                    subjectLabel={subjectLabel}
                    scopeSummary={scopeSummary}
                    subjects={subjects}
                    levelOptions={levelOptions}
                    onChange={updateDraft}
                    onScopeChange={handleScopeChange}
                    onSectionChange={updateSection}
                    onAddSection={() =>
                      setDraft((current) => ({
                        ...current,
                        sections: [
                          ...current.sections,
                          createInstructionTemplateSectionDraftFromLabel(`New section ${current.sections.length + 1}`),
                        ],
                      }))
                    }
                    onRemoveSection={(index) =>
                      setDraft((current) => ({
                        ...current,
                        sections: current.sections.filter((_, row) => row !== index),
                      }))
                    }
                    onMoveSection={(index, direction) =>
                      setDraft((current) => ({
                        ...current,
                        sections: moveTemplateItem(current.sections, index, direction),
                      }))
                    }
                    onToggleSectionRequired={(index, required) =>
                      setDraft((current) => ({
                        ...current,
                        sections: current.sections.map((section, row) =>
                          row === index
                            ? {
                                ...section,
                                required,
                                minimumWordCount: required && !section.minimumWordCount ? "80" : section.minimumWordCount,
                              }
                            : section
                        ),
                      }))
                    }
                  />
                ) : (
                  <TemplateMonitor
                    draft={draft}
                    templates={templates}
                    subjectLabel={subjectLabel}
                    scopeSummary={scopeSummary}
                    currentTemplateLabel={currentTemplateLabel}
                    previewPathLabel={previewPathLabel}
                    validationIssue={validationIssue}
                  />
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <TemplateActionBar
        dirty={dirty}
        validationIssue={validationIssue}
        saveLabel="Save template"
        successLabel="Template saved"
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}

function TemplateListPanel({
  templates,
  summary,
  selectedTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  outputType,
  searchQuery,
  onSearchQueryChange,
  onOutputTypeChange,
}: {
  templates: InstructionTemplateListItem[];
  summary: InstructionTemplateStudioScreenProps["summary"];
  selectedTemplateId: string | "new" | null;
  onSelectTemplate: (templateId: string | "new") => void;
  onCreateTemplate: () => void;
  outputType: InstructionTemplateOutputType;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOutputTypeChange: (outputType: InstructionTemplateOutputType) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/5 px-4 py-4 backdrop-blur-md lg:px-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            <Layers3 className="h-3.5 w-3.5" />
            Template catalog
          </h2>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
            {summary.total} {outputType.replace(/_/g, " ")}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            aria-label="Create new template"
            className="flex-1 rounded-xl bg-slate-950 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-xl shadow-slate-950/10 transition-all active:scale-[0.98] hover:bg-slate-800"
            onClick={onCreateTemplate}
            type="button"
          >
            <Plus className="mr-2 inline-block h-3.5 w-3.5" />
            New template
          </button>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-950/5">
          {instructionTemplateOutputTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onOutputTypeChange(option.value)}
              className={cn(
                "flex-1 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                option.value === outputType ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-950"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search templates, rules, or scopes"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            />
          </div>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 knowledge-scrollbar lg:p-6">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
            <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
              <BookOpenText className="h-7 w-7" />
            </div>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">No templates found</p>
            <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">
              Create a new template for this output type or relax search to view the full catalog.
            </p>
          </div>
        ) : (
          templates.map((template) => (
            <TemplateListItemCard
              key={template._id}
              template={template}
              isSelected={selectedTemplateId === template._id}
              onSelect={() => onSelectTemplate(template._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TemplateListItemCard({
  template,
  isSelected,
  onSelect,
}: {
  template: InstructionTemplateListItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const rowClasses = cn(
    "group relative flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-300",
    isSelected
      ? "border-slate-950 bg-slate-950 shadow-2xl shadow-slate-950/15 translate-x-1"
      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/40"
  );

  const titleClasses = cn(
    "text-xs font-black uppercase tracking-widest truncate transition-colors",
    isSelected ? "text-white" : "text-slate-700"
  );

  const subtitleClasses = cn(
    "text-[11px] font-bold uppercase tracking-widest transition-colors",
    isSelected ? "text-white/45" : "text-slate-400"
  );

  return (
    <button key={template._id} className={rowClasses} onClick={onSelect} type="button">
      <div className={cn("p-2 rounded-xl transition-colors", isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-400") }>
        <BookOpenText className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 text-left space-y-1">
        <div className={titleClasses}>{template.title}</div>
        <div className={subtitleClasses}>{template.applicabilityLabel}</div>
        <div className={cn("text-[10px] font-black uppercase tracking-[0.18em]", isSelected ? "text-white/35" : "text-slate-300") }>
          {template.sectionCount} sections • {template.requiredSectionCount} required
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]",
            template.isActive
              ? isSelected
                ? "bg-white/10 text-white"
                : "bg-emerald-50 text-emerald-700"
              : isSelected
                ? "bg-white/10 text-white/70"
                : "bg-slate-100 text-slate-500"
          )}
        >
          {template.isActive ? "Active" : "Inactive"}
        </span>
        <ChevronRight className={cn("h-4 w-4 transition-all", isSelected ? "text-white" : "text-slate-200 group-hover:text-slate-500")} />
      </div>
    </button>
  );
}

function TemplateEditor({
  draft,
  subjectLabel,
  scopeSummary,
  subjects,
  levelOptions,
  onChange,
  onScopeChange,
  onSectionChange,
  onAddSection,
  onRemoveSection,
  onMoveSection,
  onToggleSectionRequired,
}: {
  draft: InstructionTemplateDraft;
  subjectLabel: string;
  scopeSummary: string;
  subjects: Array<{ _id: string; name: string; code: string }>;
  levelOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<InstructionTemplateDraft>) => void;
  onScopeChange: (scope: InstructionTemplateScope) => void;
  onSectionChange: (index: number, patch: Partial<InstructionTemplateSectionDraft>) => void;
  onAddSection: () => void;
  onRemoveSection: (index: number) => void;
  onMoveSection: (index: number, direction: -1 | 1) => void;
  onToggleSectionRequired: (index: number, required: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-slate-100 rounded-lg">
            <BookOpenText className="w-4 h-4 text-slate-600" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Template identity</h2>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">
              Output type is controlled by the tab strip above.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <label className="group space-y-1.5 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Template title</span>
            <input
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/30 px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="e.g. Term 2 Mathematics Lesson Plan"
              value={draft.title}
            />
          </label>
          <label className="group space-y-1.5 md:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-focus-within:text-slate-600 transition-colors">Description</span>
            <textarea
              className="min-h-[92px] w-full rounded-xl border border-slate-200 bg-slate-50/30 px-4 py-3 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onChange({ description: event.target.value })}
              placeholder="Internal note for admins and future resolution audits"
              value={draft.description}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetaField label="Current output type" value={draft.outputType.replace(/_/g, " ")} />
          <MetaField label="Applicability" value={scopeSummary} />
          <MetaField label="Subject context" value={subjectLabel} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Applicability mode</span>
            <select
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white"
              onChange={(event) => onScopeChange(event.target.value as InstructionTemplateScope)}
              value={draft.templateScope}
            >
              {instructionTemplateScopeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">School default</span>
            <button
              type="button"
              onClick={() => onChange({ isSchoolDefault: !draft.isSchoolDefault })}
              className={cn(
                "flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm font-bold transition-all",
                draft.isSchoolDefault
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <span>{draft.isSchoolDefault ? "Enabled" : "Disabled"}</span>
              <span className={cn("h-2.5 w-2.5 rounded-full", draft.isSchoolDefault ? "bg-emerald-400" : "bg-slate-300")} />
            </button>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Subject</span>
            <select
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white disabled:opacity-50"
              disabled={draft.templateScope === "level_only" || draft.templateScope === "school_default"}
              onChange={(event) => onChange({ subjectId: event.target.value || null })}
              value={draft.subjectId ?? ""}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject._id} value={subject._id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Level</span>
            <select
              className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium outline-none transition focus:border-slate-400 focus:bg-white disabled:opacity-50"
              disabled={draft.templateScope === "subject_only" || draft.templateScope === "school_default"}
              onChange={(event) => onChange({ level: event.target.value })}
              value={draft.level}
            >
              <option value="">Select level</option>
              {buildLevelOptionsWithCurrentValue(levelOptions, draft.level).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AdminSurface>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Layers3 className="w-4 h-4 text-amber-600" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Objective minimums</h2>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">These rules drive later resolution and previews.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <NumberField
              label="Minimum objectives"
              value={draft.objectiveMinimums.minimumObjectives}
              onChange={(value) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumObjectives: value } })}
            />
            <NumberField
              label="Minimum sources"
              value={draft.objectiveMinimums.minimumSourceMaterials}
              onChange={(value) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumSourceMaterials: value } })}
            />
            <NumberField
              label="Minimum sections"
              value={draft.objectiveMinimums.minimumSections}
              onChange={(value) => onChange({ objectiveMinimums: { ...draft.objectiveMinimums, minimumSections: value } })}
            />
          </div>
        </AdminSurface>

        <AdminSurface intensity="low" className="p-4 sm:p-6 space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Draft state</h2>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Single-user editing with explicit saves</p>
            </div>
            <button
              type="button"
              onClick={() => onChange({ isActive: !draft.isActive })}
              className={cn(
                "rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                draft.isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              )}
            >
              {draft.isActive ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetaField label="Resolution rank" value={`#${getInstructionTemplateDraftResolutionRank(draft)}`} />
            <MetaField label="School default" value={draft.isSchoolDefault ? "Yes" : "No"} />
          </div>
        </AdminSurface>
      </div>

      <AdminSurface intensity="none" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Section rules</h2>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">
              Structured sections with required flags and minimum word counts.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
            onClick={onAddSection}
            type="button"
          >
            <Plus className="h-3 w-3" />
            Add Section
          </button>
        </div>

        <div className="space-y-3">
          {draft.sections.map((section, sectionIndex) => (
            <div key={section.key} className="group animate-in fade-in slide-in-from-top-2 duration-300">
              <AdminSurface intensity="none" className="overflow-hidden border-slate-200/60 shadow-sm border bg-white rounded-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-slate-50 bg-slate-50/50 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <GripVertical className="w-4 h-4 text-slate-300 pointer-events-none" />
                    <span className="text-xs font-black text-slate-400 tabular-nums">#{sectionIndex + 1}</span>
                    <input
                      className="flex-1 min-w-0 max-w-sm bg-transparent text-xs font-bold text-slate-700 outline-none placeholder:text-slate-300 focus:text-slate-900"
                      onChange={(event) => onSectionChange(sectionIndex, { label: event.target.value })}
                      placeholder="Enter section name"
                      value={section.label}
                    />
                  </div>

                  <div className="flex items-center gap-1 opacity-100 lg:opacity-20 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-20"
                      disabled={sectionIndex === 0}
                      onClick={() => onMoveSection(sectionIndex, -1)}
                      type="button"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-20"
                      disabled={sectionIndex === draft.sections.length - 1}
                      onClick={() => onMoveSection(sectionIndex, 1)}
                      type="button"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      className="ml-1 p-1.5 text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-20"
                      disabled={draft.sections.length === 1}
                      onClick={() => onRemoveSection(sectionIndex)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 p-4 sm:p-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Label</span>
                    <input
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5"
                      onChange={(event) => onSectionChange(sectionIndex, { label: event.target.value })}
                      placeholder="e.g. Lesson objectives"
                      value={section.label}
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Required</span>
                    <button
                      type="button"
                      onClick={() => onToggleSectionRequired(sectionIndex, !section.required)}
                      className={cn(
                        "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm font-bold transition-all min-w-[120px]",
                        section.required
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                      )}
                    >
                      <span>{section.required ? "Required" : "Optional"}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", section.required ? "bg-emerald-400" : "bg-slate-300")} />
                    </button>
                  </label>

                  <NumberField
                    label="Minimum words"
                    value={section.minimumWordCount}
                    onChange={(value) => onSectionChange(sectionIndex, { minimumWordCount: value })}
                  />
                </div>
              </AdminSurface>
            </div>
          ))}
        </div>
      </AdminSurface>
    </div>
  );
}

function TemplateMonitor({
  draft,
  templates,
  subjectLabel,
  scopeSummary,
  currentTemplateLabel,
  previewPathLabel,
  validationIssue,
}: {
  draft: InstructionTemplateDraft;
  templates: InstructionTemplateListItem[];
  subjectLabel: string;
  scopeSummary: string;
  currentTemplateLabel: string;
  previewPathLabel: string;
  validationIssue: string | null;
}) {
  const matchingTemplate = templates.find(
    (template) =>
      template.outputType === draft.outputType &&
      template.templateScope === draft.templateScope &&
      (!draft.templateId || template._id !== draft.templateId)
  );

  return (
    <div className="space-y-5">
      <AdminSurface intensity="medium" className="p-4 sm:p-6 space-y-6 rounded-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <Monitor className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">Resolution monitor</h2>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-tight">Live fallback preview and audit summary</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-emerald-500/10 rounded text-[10px] font-black uppercase tracking-widest text-emerald-600 animate-pulse">
            Live Feed
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-950 p-4 sm:p-6 text-white shadow-2xl shadow-slate-900/20 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Current template</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-white/60">
                  {draft.outputType.replace(/_/g, " ")}
                </span>
              </div>
              <h3 className="text-xl font-black tracking-tight">{draft.title.trim() || "Untitled template"}</h3>
              {draft.description.trim() && <p className="text-xs font-medium text-white/50 leading-relaxed max-w-sm italic">{draft.description.trim()}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MonitorStat label="Applicability" value={scopeSummary} />
              <MonitorStat label="Rank" value={`#${getInstructionTemplateDraftResolutionRank(draft)}`} />
              <MonitorStat label="Subject" value={subjectLabel} />
              <MonitorStat label="Active" value={draft.isActive ? "Yes" : "No"} />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-950/5">
            <div className="flex items-center gap-2 px-1">
              <Layers3 className="w-3 h-3 text-slate-300" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Resolution ladder</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {instructionTemplateScopeOptions.map((option, index) => {
              const active = option.value === draft.templateScope;
              return (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-xl border px-4 py-3 transition-all",
                    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-100 bg-slate-50/40 hover:bg-white"
                  )}
                >
                  <div className="space-y-0.5">
                    <div className={cn("text-xs font-bold", active ? "text-white" : "text-slate-700")}>
                      {index + 1}. {option.label}
                    </div>
                    <div className={cn("text-[10px] font-black uppercase tracking-[0.18em]", active ? "text-white/40" : "text-slate-400")}>
                      {option.description}
                    </div>
                  </div>
                  <div className={cn("rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest", active ? "bg-white/10 text-white" : "bg-white text-slate-400 ring-1 ring-slate-200") }>
                    {active ? "Current" : matchingTemplate && matchingTemplate.templateScope === option.value ? "Saved" : "Fallback"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-950/5">
            <div className="flex items-center gap-2 px-1">
              <PencilLine className="w-3 h-3 text-slate-300" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Section overview</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            {draft.sections.map((section, index) => (
              <div
                key={section.key}
                className="group relative flex items-center justify-between gap-4 border border-slate-50 bg-slate-50/10 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-800">{section.label.trim() || "Unnamed section"}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    #{index + 1} • {section.required ? "required" : "optional"}
                  </div>
                </div>
                <div className="text-xs font-black uppercase tracking-widest text-slate-600">
                  {section.minimumWordCount.trim() || "0"} words
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-950/5">
            <div className="flex items-center gap-2 px-1">
              <ShieldCheck className="w-3 h-3 text-slate-300" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Audit metadata</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <MonitorStat label="Current selection" value={currentTemplateLabel} />
              <MonitorStat label="Resolution path" value={previewPathLabel} />
              <MonitorStat label="Sections" value={`${draft.sections.length} total`} />
              <MonitorStat label="Required sections" value={`${draft.sections.filter((section) => section.required).length} total`} />
            </div>

            {validationIssue ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-[11px] font-bold text-rose-700">
                {validationIssue}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-700">
                Ready for save. Resolution metadata will be written together with the audit trail.
              </div>
            )}

            {matchingTemplate && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-600">
                Matching saved template: <span className="font-bold text-slate-900">{matchingTemplate.title}</span> • {getInstructionTemplateScopeLabel(matchingTemplate)}
              </div>
            )}
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <p className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <input
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-950/5"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        value={value}
      />
    </label>
  );
}

function MonitorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <p className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function TemplateActionBar({
  dirty,
  validationIssue,
  saveLabel,
  successLabel,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  validationIssue: string | null;
  saveLabel: string;
  successLabel: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const actionBarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateHeight = () => {
      setActionBarHeight(actionBarRef.current?.clientHeight ?? 0);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => setResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleSave = useCallback(async () => {
    if (!dirty || validationIssue) {
      if (validationIssue) {
        setResult({ success: false, message: validationIssue });
      }
      return;
    }

    setIsSaving(true);
    setResult(null);

    try {
      await onSave();
      setResult({ success: true, message: successLabel });
    } catch (error) {
      setResult({
        success: false,
        message: getUserFacingErrorMessage(error, "Operation Failed"),
      });
    } finally {
      setIsSaving(false);
    }
  }, [dirty, onSave, successLabel, validationIssue]);

  return (
    <>
      {result && (
        <div className="fixed right-6 z-[100] animate-in slide-in-from-right-4 duration-500" style={{ bottom: `${actionBarHeight + 16}px` }}>
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl border",
              result.success ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-rose-500/90 border-rose-400 text-white"
            )}
          >
            {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest opacity-60">Status Message</span>
              <span className="text-sm font-bold">{result.message}</span>
            </div>
            <button className="ml-2 p-1 hover:bg-white/10 rounded-lg" onClick={() => setResult(null)} type="button">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={actionBarRef}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 lg:p-6 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent pointer-events-none"
      >
        <div className="mx-auto max-w-[1500px] w-full flex items-center justify-between lg:justify-end gap-4 pointer-events-auto">
          {dirty && !validationIssue && (
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Uncommitted Changes</span>
            </div>
          )}

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <button
              className="flex-1 lg:flex-none h-12 px-6 text-xs font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-900 transition-colors disabled:opacity-0 pointer-events-auto"
              disabled={isSaving || !dirty}
              onClick={onDiscard}
              type="button"
            >
              Discard
            </button>
            <button
              className={cn(
                "flex-1 lg:flex-none h-12 min-w-[180px] flex items-center justify-center gap-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95",
                !dirty || isSaving || validationIssue
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-slate-950 text-white shadow-slate-900/20 hover:bg-slate-800"
              )}
              disabled={!dirty || isSaving || Boolean(validationIssue)}
              onClick={handleSave}
              type="button"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin opacity-40" /> : <Save className={`w-4 h-4 ${dirty ? "text-emerald-400" : "opacity-20"}`} />}
              {isSaving ? "Processing..." : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
