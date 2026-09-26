"use client";

import { BookOpenText, Layers3, ShieldCheck, Sparkles, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDirtyForm } from "@school/shared/drafts";
import type { InstructionTemplateDraft, InstructionTemplateListItem, InstructionTemplateOutputType, InstructionTemplateScope, InstructionTemplateSectionDraft, InstructionTemplateStudioScreenProps } from "../types";
import { INSTRUCTION_TEMPLATE_PRESETS, createDraftFromPreset, type InstructionTemplatePreset } from "../presets";
import { createEmptyInstructionTemplateDraft, createInstructionTemplateDraft, createInstructionTemplateSectionDraftFromLabel, getInstructionTemplateApplicabilitySummary, getInstructionTemplateResolutionPathLabel, getInstructionTemplateScopeLabel, moveTemplateItem, serializeInstructionTemplateDraft, validateInstructionTemplateDraft } from "../utils";
import { TemplateListPanel } from "./TemplateListPanel";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateMonitor } from "./TemplateMonitor";
import { TemplateActionBar } from "./TemplateActionBar";
import { TemplateGallery } from "./TemplateGallery";

type View = "welcome" | "gallery" | "editor";

export function InstructionTemplateStudioScreen({ subjects, levelOptions, templates, summary, outputType, searchQuery, onOutputTypeChange, onSearchQueryChange, onSaveTemplate }: InstructionTemplateStudioScreenProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<InstructionTemplateListItem | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<InstructionTemplateDraft | null>(null);
  const [draft, setDraft] = useState<InstructionTemplateDraft>(() => createEmptyInstructionTemplateDraft(outputType));
  const [view, setView] = useState<View>("welcome");
  const [galleryReturnView, setGalleryReturnView] = useState<"welcome" | "editor">("welcome");
  const [mobileWelcomeDismissed, setMobileWelcomeDismissed] = useState(false);
  const [editorMode, setEditorMode] = useState<"designer" | "monitor">("designer");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [recommendedQueue, setRecommendedQueue] = useState<InstructionTemplatePreset[]>([]);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const baseline = savedSnapshot ?? (selectedTemplate ? createInstructionTemplateDraft(selectedTemplate) : createEmptyInstructionTemplateDraft(outputType));
  const dirty = (draft.templateId === null && (view === "editor" || (view === "gallery" && galleryReturnView === "editor"))) || serializeInstructionTemplateDraft(draft) !== serializeInstructionTemplateDraft(baseline);
  const validationIssue = validateInstructionTemplateDraft(draft, templates);
  const hiddenSelection = Boolean((selectedTemplate?._id ?? savedSnapshot?.templateId) &&
    !templates.some((item) => item._id === (selectedTemplate?._id ?? savedSnapshot?.templateId)));

  // Query updates may refresh a saved row, but filtering must never detach the editor.
  useEffect(() => {
    const id = selectedTemplate?._id ?? draft.templateId;
    if (!id) return;
    const latest = templates.find((item) => item._id === id);
    if (!latest) return;
    if (!selectedTemplate) {
      setSavedSnapshot(null);
      setSelectedTemplate(latest);
      if (!dirty) setDraft(createInstructionTemplateDraft(latest));
    } else if (latest.updatedAt !== selectedTemplate.updatedAt) {
      setSelectedTemplate(latest);
      if (!dirty) setDraft(createInstructionTemplateDraft(latest));
      setSavedSnapshot(null);
    }
  }, [templates, selectedTemplate, draft.templateId, dirty]);

  useEffect(() => {
    if (view === "welcome" && summary.total === 0 && !searchQuery && !mobileWelcomeDismissed) setMobileOpen(true);
  }, [view, summary.total, searchQuery, mobileWelcomeDismissed]);

  useEffect(() => {
    if (view === "welcome" && window.innerWidth >= 1024 && summary.total > 0 && !searchQuery && !selectedTemplate && !draft.templateId && !dirty) {
      const first = templates[0];
      if (first) { setSelectedTemplate(first); setDraft(createInstructionTemplateDraft(first)); setView("editor"); }
    }
  }, [view, summary.total, searchQuery, selectedTemplate, draft.templateId, dirty, templates]);

  useDirtyForm({
    name: "Instruction template",
    isDirty: dirty,
    discard: () => { setSelectedTemplate(null); setSavedSnapshot(null); setRecommendedQueue([]); setDraft(createEmptyInstructionTemplateDraft(outputType)); setView("welcome"); setMobileOpen(false); setMobileWelcomeDismissed(true); },
  });

  const transition = useCallback((action: () => void) => {
    if (saving) return;
    if (dirty) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending(() => action);
    } else action();
  }, [dirty, saving]);
  const confirm = () => { const action = pending; setPending(null); action?.(); triggerRef.current?.focus(); };
  const cancel = () => { setPending(null); triggerRef.current?.focus(); };

  const browseGallery = () => {
    setGalleryReturnView(view === "editor" ? "editor" : "welcome");
    setView("gallery");
    setMobileOpen(true);
  };
  const closeMobile = () => transition(() => {
    setSelectedTemplate(null); setSavedSnapshot(null); setRecommendedQueue([]);
    setDraft(createEmptyInstructionTemplateDraft(outputType));
    setView("welcome"); setMobileOpen(false); setMobileWelcomeDismissed(true);
  });
  const select = (item: InstructionTemplateListItem) => transition(() => {
    setRecommendedQueue([]); setSavedSnapshot(null); setSelectedTemplate(item); setDraft(createInstructionTemplateDraft(item)); setView("editor"); setMobileOpen(true);
  });
  const scratch = () => transition(() => {
    setRecommendedQueue([]); setSelectedTemplate(null); setSavedSnapshot(null); setDraft(createEmptyInstructionTemplateDraft(outputType)); setView("editor"); setEditorMode("designer"); setMobileOpen(true);
  });
  const usePreset = (preset: InstructionTemplatePreset) => transition(() => {
    setRecommendedQueue([]); setSelectedTemplate(null); setSavedSnapshot(null); setDraft(createDraftFromPreset(preset)); onOutputTypeChange(preset.outputType);
    setView("editor"); setEditorMode("designer"); setMobileOpen(true);
  });
  const duplicate = (item: InstructionTemplateListItem) => transition(() => {
    const copy = createInstructionTemplateDraft(item);
    setSelectedTemplate(null); setSavedSnapshot(null);
    setRecommendedQueue([]);
    setDraft({ ...copy, templateId: null, title: `Copy of ${item.title}`, isActive: false, sourcePresetId: null, sourcePresetVersion: null,
      sections: copy.sections.map((section) => ({ ...section, id: null })) });
    setView("editor"); setEditorMode("designer"); setMobileOpen(true);
  });
  const switchType = (next: InstructionTemplateOutputType) => {
    if (next === outputType) return;
    transition(() => { setRecommendedQueue([]); onOutputTypeChange(next); setSelectedTemplate(null); setSavedSnapshot(null); setDraft(createEmptyInstructionTemplateDraft(next)); setView("welcome"); setMobileOpen(false); setMobileWelcomeDismissed(false); });
  };
  const startRecommended = () => transition(() => {
    const [first, ...rest] = INSTRUCTION_TEMPLATE_PRESETS;
    setRecommendedQueue(rest); setSelectedTemplate(null); setSavedSnapshot(null); setDraft(createDraftFromPreset(first));
    onOutputTypeChange(first.outputType); setView("editor"); setEditorMode("designer"); setMobileOpen(true);
  });
  const handleSave = async () => {
    if (validationIssue) throw new Error(validationIssue);
    setSaving(true);
    try {
      const id = await onSaveTemplate(draft);
      if (recommendedQueue.length > 0) {
        const [next, ...rest] = recommendedQueue;
        setRecommendedQueue(rest); setSelectedTemplate(null); setDraft(createDraftFromPreset(next));
        onOutputTypeChange(next.outputType); setView("editor");
      } else {
        setSavedSnapshot({ ...draft, templateId: id });
        setDraft((current) => ({ ...current, templateId: id }));
        setView("editor");
        // The saved row arrives reactively, independent of the current search filter.
      }
    } finally { setSaving(false); }
  };
  const update = (patch: Partial<InstructionTemplateDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateSection = (index: number, patch: Partial<InstructionTemplateSectionDraft>) => setDraft((current) => ({ ...current, sections: current.sections.map((section, i) => i === index ? { ...section, ...patch } : section) }));
  const scopeChange = (scope: InstructionTemplateScope) => setDraft((current) => {
    const base = { ...current, templateScope: scope, isSchoolDefault: false };
    if (scope === "school_default") return { ...base, subjectId: null, level: "", isSchoolDefault: true };
    if (scope === "subject_only") return { ...base, subjectId: current.subjectId ?? subjects[0]?._id ?? null, level: "" };
    if (scope === "level_only") return { ...base, subjectId: null };
    return { ...base, subjectId: current.subjectId ?? subjects[0]?._id ?? null };
  });
  const editorProps = {
    draft, subjects, levelOptions, subjectLabel: subjects.find((item) => item._id === draft.subjectId)?.name ?? "No Subject",
    scopeSummary: getInstructionTemplateApplicabilitySummary(draft, subjects),
    onChange: update, onScopeChange: scopeChange, onSectionChange: updateSection,
    onAddSection: () => setDraft((current) => ({ ...current, sections: [...current.sections, createInstructionTemplateSectionDraftFromLabel(`New section ${current.sections.length + 1}`)] })),
    onRemoveSection: (index: number) => setDraft((current) => ({ ...current, sections: current.sections.filter((_, i) => i !== index) })),
    onMoveSection: (index: number, direction: -1 | 1) => setDraft((current) => ({ ...current, sections: moveTemplateItem(current.sections, index, direction) })),
    onToggleSectionRequired: (index: number, required: boolean) => updateSection(index, { required, minimumWordCount: required && !draft.sections[index].minimumWordCount ? "80" : draft.sections[index].minimumWordCount }),
  };
  const workspace = <div className="mx-auto max-w-[1150px] space-y-6 pb-32">
    <AdminHeader label="Knowledge Hub" title="Lesson/Notes Templates" description="Configure the structures used for school-owned teaching drafts." actions={<StatGroup variant="wrap" stats={[
      { label: "Total", value: summary.total, icon: <BookOpenText className="h-3 w-3" /> },
      { label: "Active", value: summary.active, icon: <ShieldCheck className="h-3 w-3" /> },
      { label: "Default", value: summary.defaultCount, icon: <Layers3 className="h-3 w-3" /> },
      { label: "Inactive", value: summary.inactive, icon: <Sparkles className="h-3 w-3" /> },
    ]} />} />
    {view === "welcome" ? <section className="rounded-2xl border border-slate-200 bg-white p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recommended setup</p>
      <h2 className="mt-2 text-2xl font-bold">{summary.total === 0 && !searchQuery ? `Set up your first ${outputType.replaceAll("_", " ")}` : "Start with a template"}</h2>
      <p className="mt-2 text-sm text-slate-600">Choose a starter structure or build your own. Nothing is saved until you commit it.</p>
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={browseGallery} className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white">Browse templates</button>
      <button type="button" onClick={startRecommended} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold">Set up Melo defaults</button>
      <button type="button" onClick={scratch} className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold">Start From Scratch</button></div>
      {recommendedQueue.length > 0 && <p className="mt-3 text-xs text-slate-500">Review and save each default separately before activating it.</p>}
      {summary.total === 0 && !searchQuery && <div className="mt-8 border-t border-slate-200 pt-6"><TemplateGallery outputType={outputType} onUse={usePreset} onScratch={scratch} onBack={() => setView("welcome")} /></div>}
    </section> : view === "gallery" ? <TemplateGallery outputType={outputType} onUse={usePreset} onScratch={scratch} onBack={() => setView(galleryReturnView)} backLabel={galleryReturnView === "editor" ? "Return to editor" : "Back to saved"} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p><p className="text-sm font-bold">{selectedTemplate ? getInstructionTemplateScopeLabel(selectedTemplate) : draft.templateId ? draft.title : "New Template Config"}</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => setEditorMode("designer")} aria-pressed={editorMode === "designer"} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Designer</button><button type="button" onClick={() => setEditorMode("monitor")} aria-pressed={editorMode === "monitor"} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Monitor</button></div>
      </div>
      {hiddenSelection && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Editing {selectedTemplate?.title ?? draft.title}, hidden by the current search. <button type="button" onClick={() => onSearchQueryChange("")} className="font-bold underline">Clear search</button></p>}
      {!selectedTemplate && draft.sourcePresetId && <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">Based on a Melo starter. Review the scope, sections, rules and inactive status before saving. {recommendedQueue.length > 0 ? `${recommendedQueue.length} more defaults to review.` : ""}</p>}
      {!selectedTemplate && !draft.sourcePresetId && draft.title.startsWith("Copy of ") && <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs">Copy of a school template. The original will remain unchanged.</p>}
      {editorMode === "designer" ? <TemplateEditor {...editorProps} /> : <TemplateMonitor draft={draft} templates={templates} subjectLabel={editorProps.subjectLabel} scopeSummary={editorProps.scopeSummary} currentTemplateLabel={selectedTemplate?.title ?? "New template"} previewPathLabel={selectedTemplate ? getInstructionTemplateResolutionPathLabel(selectedTemplate) : editorProps.scopeSummary} validationIssue={validationIssue} />}
    </>}
  </div>;
  const actionBar = view === "editor" && <TemplateActionBar dirty={dirty} validationIssue={validationIssue} saveLabel="Commit Changes" successLabel="Template saved" onSave={handleSave} onDiscard={() => transition(() => {
    setRecommendedQueue([]);
    if (savedSnapshot) {
      setDraft(savedSnapshot);
      return;
    }
    if (selectedTemplate) {
      setDraft(createInstructionTemplateDraft(selectedTemplate));
      return;
    }
    setDraft(createEmptyInstructionTemplateDraft(outputType));
    setView("welcome");
    setMobileOpen(false);
    setMobileWelcomeDismissed(true);
  })} />;
  return <div className="flex min-h-0 flex-col bg-slate-50/50 lg:h-full lg:overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row"><aside className="w-full shrink-0 border-r border-slate-200 bg-white/40 lg:w-[400px] lg:overflow-y-auto"><TemplateListPanel templates={templates} summary={summary} outputType={outputType} searchQuery={searchQuery} selectedTemplateId={selectedTemplate?._id ?? null} onCreateTemplate={scratch} onOutputTypeChange={switchType} onSearchQueryChange={onSearchQueryChange} onSelectTemplate={(id) => { const item = templates.find((entry) => entry._id === id); if (item) select(item); }} onDuplicateTemplate={duplicate} onBrowseTemplates={browseGallery} /></aside>
      <main className="hidden min-w-0 flex-1 overflow-y-auto p-8 lg:block">{workspace}</main></div>
    {mobileOpen && <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 lg:hidden"><header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4"><button type="button" onClick={() => view === "gallery" && galleryReturnView === "editor" ? setView("editor") : closeMobile()} className="flex items-center gap-2 text-xs font-bold"><RotateCcw className="h-4 w-4" />Back</button></header><main className="min-h-0 flex-1 overflow-y-auto p-4">{workspace}</main>{actionBar}</div>}
    <div className="hidden lg:block">{actionBar}</div>
    <ConfirmDialog open={pending !== null} title="Discard unsaved changes?" description={`Your changes to ${draft.title || "this template"} have not been saved. Discard them and continue?`} cancelLabel="Keep editing" confirmLabel="Discard and continue" onConfirm={confirm} onCancel={cancel} />
  </div>;
}
