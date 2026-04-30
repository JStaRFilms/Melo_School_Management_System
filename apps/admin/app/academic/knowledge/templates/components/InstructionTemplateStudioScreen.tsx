"use client";

import { BookOpenText, Layers3, Monitor, PencilLine, ShieldCheck, Sparkles, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { cn } from "@/utils";

import type {
  InstructionTemplateDraft,
  InstructionTemplateListItem,
  InstructionTemplateOutputType,
  InstructionTemplateScope,
  InstructionTemplateSectionDraft,
  InstructionTemplateStudioScreenProps
} from "../types";
import {
  createEmptyInstructionTemplateDraft,
  createInstructionTemplateDraft,
  createInstructionTemplateSectionDraftFromLabel,
  getInstructionTemplateApplicabilitySummary,
  getInstructionTemplateResolutionPathLabel,
  getInstructionTemplateScopeLabel,
  instructionTemplateOutputTypeOptions,
  moveTemplateItem,
  serializeInstructionTemplateDraft,
  validateInstructionTemplateDraft
} from "../utils";

import { TemplateListPanel } from "./TemplateListPanel";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateMonitor } from "./TemplateMonitor";
import { TemplateActionBar } from "./TemplateActionBar";

const editorModes = [
  { id: "designer", label: "Designer", icon: PencilLine },
  { id: "monitor", label: "Monitor", icon: Monitor },
] as const;

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

  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  const selectedTemplate = useMemo<InstructionTemplateListItem | null>(() => {
    if (!selectedTemplateId || selectedTemplateId === "new") return null;
    return templates.find((t) => t._id === selectedTemplateId) ?? null;
  }, [selectedTemplateId, templates]);

  const activeDraftSource = useMemo<InstructionTemplateDraft>(() => {
    if (!selectedTemplate) return createEmptyInstructionTemplateDraft(outputType);
    return createInstructionTemplateDraft(selectedTemplate);
  }, [outputType, selectedTemplate]);

  const dirty = useMemo(
    () => serializeInstructionTemplateDraft(draft) !== serializeInstructionTemplateDraft(activeDraftSource),
    [activeDraftSource, draft]
  );

  const validationIssue = useMemo(() => validateInstructionTemplateDraft(draft, templates), [draft, templates]);

  useEffect(() => {
    if (selectedTemplateId === null) {
      // Don't auto-select on mobile if we want catalog first
      if (window.innerWidth >= 1024) {
        setSelectedTemplateId(templates[0]?._id ?? "new");
      }
      return;
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (selectedTemplateId === "new") {
      setDraft(createEmptyInstructionTemplateDraft(outputType));
    } else if (selectedTemplate) {
      setDraft(createInstructionTemplateDraft(selectedTemplate));
    }
  }, [outputType, selectedTemplate, selectedTemplateId]);

  const handleSelectTemplate = useCallback((id: string | "new") => {
    setSelectedTemplateId(id);
    setEditorMode("designer");
    setIsMobileEditorOpen(true);
  }, []);

  const handleCreateTemplate = useCallback(() => {
    setSelectedTemplateId("new");
    setDraft(createEmptyInstructionTemplateDraft(outputType));
    setEditorMode("designer");
    setIsMobileEditorOpen(true);
  }, [outputType]);

  const handleSwitchOutputType = useCallback((next: InstructionTemplateOutputType) => {
    if (next === outputType) return;
    onOutputTypeChange(next);
    setSelectedTemplateId(null);
    setEditorMode("designer");
  }, [onOutputTypeChange, outputType]);

  const updateDraft = useCallback((patch: Partial<InstructionTemplateDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const updateSection = useCallback((idx: number, patch: Partial<InstructionTemplateSectionDraft>) => {
    setDraft((current) => {
      const sections = [...current.sections];
      sections[idx] = { ...sections[idx], ...patch };
      return { ...current, sections };
    });
  }, []);

  const handleScopeChange = useCallback((nextScope: InstructionTemplateScope) => {
    setDraft((current) => {
      const nextSubjectId = current.subjectId ?? subjects[0]?._id ?? null;
      const base = { ...current, templateScope: nextScope, isSchoolDefault: false };
      switch (nextScope) {
        case "subject_and_level": return { ...base, subjectId: nextSubjectId };
        case "subject_only": return { ...base, subjectId: nextSubjectId, level: "" };
        case "level_only": return { ...base, subjectId: null };
        case "school_default": return { ...base, subjectId: null, level: "", isSchoolDefault: true };
        default: return base;
      }
    });
  }, [subjects]);

  const handleSave = useCallback(async () => {
    if (validationIssue) throw new Error(validationIssue);
    const nextId = await onSaveTemplate(draft);
    setSelectedTemplateId(nextId);
    setDraft((curr) => ({ ...curr, templateId: nextId }));
    // On mobile, keep the editor open to show success
  }, [draft, onSaveTemplate, validationIssue]);

  const handleDiscard = useCallback(() => {
    setDraft(selectedTemplate ? createInstructionTemplateDraft(selectedTemplate) : createEmptyInstructionTemplateDraft(outputType));
  }, [outputType, selectedTemplate]);

  const subjectLabel = useMemo(() => {
    if (draft.subjectId) {
      const s = subjects.find((e) => e._id === draft.subjectId);
      if (s) return `${s.name} (${s.code})`;
    }
    return "No Subject";
  }, [draft.subjectId, subjects]);

  const scopeSummary = useMemo(() => getInstructionTemplateApplicabilitySummary(draft, subjects), [draft, subjects]);
  const currentTemplateLabel = selectedTemplate ? getInstructionTemplateScopeLabel(selectedTemplate) : "New Template";
  const previewPathLabel = selectedTemplate ? getInstructionTemplateResolutionPathLabel(selectedTemplate) : scopeSummary;

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50/50">
      <style jsx global>{`
        .knowledge-scrollbar::-webkit-scrollbar { width: 4px; }
        .knowledge-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .knowledge-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 10px; }
        .knowledge-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(15, 23, 42, 0.1); }
      `}</style>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Catalog Sidebar - Primary on mobile */}
        <aside className="w-full lg:border-r border-slate-200/60 bg-white/40 backdrop-blur-xl lg:h-full lg:w-[400px] lg:overflow-y-auto knowledge-scrollbar shrink-0">
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

        {/* Main Workspace - Desktop Only view by default */}
        <main className="hidden lg:block flex-1 min-w-0 h-full overflow-y-auto knowledge-scrollbar p-8 bg-slate-50/30">
          <div className="mx-auto max-w-[1150px] space-y-8 pb-32">
            <AdminHeader
              label="Knowledge Hub"
              title="Template Studio"
              description="Professional configuration of academic output structures."
              className="lg:mb-0"
              actions={
                <StatGroup
                  stats={[
                    { label: "Total", value: summary.total, icon: <BookOpenText className="h-3 w-3" /> },
                    { label: "Active", value: summary.active, icon: <ShieldCheck className="h-3 w-3 text-emerald-500" /> },
                    { label: "Default", value: summary.defaultCount, icon: <Layers3 className="h-3 w-3 text-blue-500" /> },
                    { label: "Legacy", value: summary.inactive, icon: <Sparkles className="h-3 w-3 text-amber-500" /> },
                  ]}
                  variant="wrap"
                />
              }
            />

            <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
              <div className="space-y-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Workspace</h2>
                <p className="text-sm font-bold text-slate-900">{selectedTemplate ? currentTemplateLabel : "New Template Config"}</p>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-slate-200/40 p-1">
                {editorModes.map((mode) => {
                  const Icon = mode.icon;
                  const active = editorMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setEditorMode(mode.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                        active ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                onAddSection={() => setDraft((curr) => ({
                  ...curr,
                  sections: [...curr.sections, createInstructionTemplateSectionDraftFromLabel(`New section ${curr.sections.length + 1}`)]
                }))}
                onRemoveSection={(idx) => setDraft((curr) => ({
                  ...curr,
                  sections: curr.sections.filter((_, i) => i !== idx)
                }))}
                onMoveSection={(idx, dir) => setDraft((curr) => ({
                  ...curr,
                  sections: moveTemplateItem(curr.sections, idx, dir)
                }))}
                onToggleSectionRequired={(idx, req) => setDraft((curr) => ({
                  ...curr,
                  sections: curr.sections.map((s, i) => i === idx ? {
                    ...s,
                    required: req,
                    minimumWordCount: req && !s.minimumWordCount ? "80" : s.minimumWordCount
                  } : s)
                }))}
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
        </main>
      </div>

      {/* Mobile Pop-up Editor Overlay */}
      {isMobileEditorOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 lg:hidden animate-in fade-in slide-in-from-bottom-10 duration-500">
          {/* Pop-up Header */}
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shrink-0">
            <button 
              onClick={() => setIsMobileEditorOpen(false)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
            </button>

            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {editorModes.map((mode) => {
                const Icon = mode.icon;
                const active = editorMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setEditorMode(mode.id)}
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-lg px-3 text-[9px] font-black uppercase tracking-widest transition-all",
                      active ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5" : "text-slate-400"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </header>

          {/* Pop-up Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-32 knowledge-scrollbar">
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Workspace</h2>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {selectedTemplate ? currentTemplateLabel : "New Template Config"}
                </p>
              </div>

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
                  onAddSection={() => setDraft((curr) => ({
                    ...curr,
                    sections: [...curr.sections, createInstructionTemplateSectionDraftFromLabel(`New section ${curr.sections.length + 1}`)]
                  }))}
                  onRemoveSection={(idx) => setDraft((curr) => ({
                    ...curr,
                    sections: curr.sections.filter((_, i) => i !== idx)
                  }))}
                  onMoveSection={(idx, dir) => setDraft((curr) => ({
                    ...curr,
                    sections: moveTemplateItem(curr.sections, idx, dir)
                  }))}
                  onToggleSectionRequired={(idx, req) => setDraft((curr) => ({
                    ...curr,
                    sections: curr.sections.map((s, i) => i === idx ? {
                      ...s,
                      required: req,
                      minimumWordCount: req && !s.minimumWordCount ? "80" : s.minimumWordCount
                    } : s)
                  }))}
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

          <TemplateActionBar
            dirty={dirty}
            validationIssue={validationIssue}
            saveLabel="Commit Changes"
            successLabel="Template synchronized"
            onDiscard={handleDiscard}
            onSave={handleSave}
          />
        </div>
      )}

      {/* Desktop Global Action Bar */}
      <div className="hidden lg:block">
        <TemplateActionBar
          dirty={dirty}
          validationIssue={validationIssue}
          saveLabel="Commit Changes"
          successLabel="Template synchronized"
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
