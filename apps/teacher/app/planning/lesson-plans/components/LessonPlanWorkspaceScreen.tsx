"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpenText,
  ChevronRight,
  ExternalLink,
  Heading1,
  Heading2,
  Link2,
  Loader2,
  ListChecks,
  ListOrdered,
  Save,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import type {
  LessonPlanSaveResult,
  LessonPlanWorkspaceData,
  LessonPlanWorkspaceOutputType,
  LessonPlanWorkspaceSource,
  LessonPlanWorkspaceTemplate,
} from "../types";

interface LessonPlanWorkspaceScreenProps {
  workspace: LessonPlanWorkspaceData;
  onOutputTypeChange: (next: LessonPlanWorkspaceOutputType) => void;
  onRemoveSource: (sourceId: string) => void;
  onOpenLibrary: () => void;
  onSaveDraft: (draft: { title: string; documentState: string; plainText: string }) => Promise<LessonPlanSaveResult>;
  onGenerateDraft: () => Promise<LessonPlanSaveResult>;
}

const outputTypeOptions: Array<{
  value: LessonPlanWorkspaceOutputType;
  label: string;
  description: string;
}> = [
  {
    value: "lesson_plan",
    label: "Lesson plan",
    description: "Teacher-facing plan with objectives, flow, and assessment.",
  },
  {
    value: "student_note",
    label: "Student note",
    description: "Learner-facing notes with key points and examples.",
  },
  {
    value: "assignment",
    label: "Assignment",
    description: "Practice work with tasks, checklist, and marking guidance.",
  },
];

const toolbarActions = [
  { id: "heading1", label: "Heading 1", icon: Heading1 },
  { id: "heading2", label: "Heading 2", icon: Heading2 },
  { id: "bullets", label: "Bullets", icon: ListOrdered },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "link", label: "Link", icon: Link2 },
  { id: "table", label: "Table", icon: Table2 },
] as const;

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) {
    return "Not saved yet";
  }

  const diff = Date.now() - timestamp;
  if (diff < 60_000) {
    return "Just now";
  }

  if (diff < 3_600_000) {
    const minutes = Math.max(1, Math.round(diff / 60_000));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(diff / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function markdownToPlainText(markdown: string) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*\|\s*/gm, "")
    .replace(/\s*\|\s*$/gm, "")
    .replace(/^\s*[-=]{3,}\s*$/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/!\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[\*_`]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function insertTextAtSelection(
  element: HTMLTextAreaElement,
  value: string,
  insertText: string,
  selectInserted = false
) {
  const start = element.selectionStart ?? value.length;
  const end = element.selectionEnd ?? value.length;
  const next = `${value.slice(0, start)}${insertText}${value.slice(end)}`;
  const cursor = start + insertText.length;

  return {
    next,
    cursorStart: selectInserted ? start : cursor,
    cursorEnd: selectInserted ? start + insertText.length : cursor,
  };
}

function prefixSelectionLines(value: string, selectionStart: number, selectionEnd: number, prefix: string) {
  const before = value.slice(0, selectionStart);
  const selection = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const prefixed = selection
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

  return {
    next: `${before}${prefixed}${after}`,
    cursorStart: selectionStart,
    cursorEnd: selectionStart + prefixed.length,
  };
}

function buildTableScaffold() {
  return [
    "| Column 1 | Column 2 |",
    "| --- | --- |",
    "| Row item | Detail |",
  ].join("\n");
}

function getSourceLabel(source: LessonPlanWorkspaceSource) {
  return source.subjectCode ? `${source.title} • ${source.subjectCode}` : source.title;
}

function getTemplateSectionLabels(template: LessonPlanWorkspaceTemplate | null) {
  return template?.sectionDefinitions.map((section) => section.label) ?? [];
}

function getSourceScopeLabel(source: LessonPlanWorkspaceSource) {
  return source.sourceType === "imported_curriculum" ? "Broad reference" : source.topicLabel ? "Topic-bound" : "Unattached source";
}

export function LessonPlanWorkspaceScreen({
  workspace,
  onOutputTypeChange,
  onRemoveSource,
  onOpenLibrary,
  onSaveDraft,
  onGenerateDraft,
}: LessonPlanWorkspaceScreenProps) {
  const [title, setTitle] = useState(workspace.draft.title);
  const [documentState, setDocumentState] = useState(workspace.draft.documentState);
  const [plainText, setPlainText] = useState(workspace.draft.plainText);
  const [revisionNumber, setRevisionNumber] = useState(workspace.draft.revisionNumber);
  const [lastSavedSignature, setLastSavedSignature] = useState(
    JSON.stringify({ title: workspace.draft.title, documentState: workspace.draft.documentState })
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const retrySaveRef = useRef(false);

  const signature = useMemo(
    () => JSON.stringify({ title, documentState }),
    [title, documentState]
  );
  const dirty = signature !== lastSavedSignature;
  const canGenerate = workspace.canGenerate && !isGenerating;
  const canAutosave = workspace.canAutosave;

  const pushNotice = useCallback((tone: "success" | "error", message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const applyToolbarAction = useCallback(
    (actionId: (typeof toolbarActions)[number]["id"]) => {
      const element = textareaRef.current;
      if (!element) {
        return;
      }

      const value = documentState;
      const start = element.selectionStart ?? value.length;
      const end = element.selectionEnd ?? value.length;
      let result: { next: string; cursorStart: number; cursorEnd: number };

      switch (actionId) {
        case "heading1":
          result = prefixSelectionLines(value, start, end, "# ");
          break;
        case "heading2":
          result = prefixSelectionLines(value, start, end, "## ");
          break;
        case "bullets":
          result = prefixSelectionLines(value, start, end, "- ");
          break;
        case "checklist":
          result = prefixSelectionLines(value, start, end, "- [ ] ");
          break;
        case "link": {
          const selection = value.slice(start, end).trim() || "link text";
          result = insertTextAtSelection(element, value, `[${selection}](https://)`, true);
          break;
        }
        case "table": {
          const scaffold = `${buildTableScaffold()}\n`;
          result = insertTextAtSelection(element, value, scaffold, false);
          break;
        }
      }

      setDocumentState(result.next);
      setPlainText(markdownToPlainText(result.next));
      window.requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(result.cursorStart, result.cursorEnd);
      });
    },
    [documentState]
  );

  const persistDraft = useCallback(
    async (mode: "manual" | "autosave") => {
      if (!canAutosave) {
        return;
      }

      if (!workspace.planningContext?.subjectId && (!workspace.sourceContext.subjectId || !workspace.sourceContext.level)) {
        return;
      }

      setSaveState("saving");
      try {
        const result = await onSaveDraft({ title, documentState, plainText });
        setRevisionNumber(result.revisionNumber);
        setTitle(result.title);
        setDocumentState(result.documentState);
        setPlainText(result.plainText);
        setLastSavedSignature(JSON.stringify({ title: result.title, documentState: result.documentState }));
        setSaveState("saved");
        if (mode === "manual") {
          pushNotice("success", `Saved revision ${result.revisionNumber}.`);
        }
      } catch (error) {
        setSaveState("error");
        pushNotice("error", getUserFacingErrorMessage(error, "Failed to save draft."));
      }
    },
    [canAutosave, documentState, onSaveDraft, plainText, pushNotice, title, workspace.sourceContext.level, workspace.sourceContext.subjectId]
  );

  useEffect(() => {
    if (!dirty || !canAutosave || isGenerating) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      if (saveInFlightRef.current) {
        retrySaveRef.current = true;
        return;
      }

      saveInFlightRef.current = true;
      persistDraft("autosave")
        .catch(() => {
          // handled by persistDraft
        })
        .finally(() => {
          saveInFlightRef.current = false;
          if (retrySaveRef.current) {
            retrySaveRef.current = false;
            setSaveState((current) => (current === "error" ? current : "idle"));
          }
        });
    }, 1200);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [canAutosave, dirty, isGenerating, persistDraft, signature]);

  const handleManualSave = useCallback(async () => {
    if (!dirty) {
      pushNotice("success", "No changes to save.");
      return;
    }

    await persistDraft("manual");
  }, [dirty, persistDraft, pushNotice]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    try {
      const result = await onGenerateDraft();
      setRevisionNumber(result.revisionNumber);
      setTitle(result.title);
      setDocumentState(result.documentState);
      setPlainText(result.plainText);
      setLastSavedSignature(JSON.stringify({ title: result.title, documentState: result.documentState }));
      setSaveState("saved");
      pushNotice("success", `Generated ${workspace.outputTypeLabel.toLowerCase()} revision ${result.revisionNumber}.`);
    } catch (error) {
      setSaveState("error");
      pushNotice("error", getUserFacingErrorMessage(error, "Generation failed."));
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, onGenerateDraft, pushNotice, workspace.outputTypeLabel]);

  const handleOutputTypeChange = useCallback(
    (next: LessonPlanWorkspaceOutputType) => {
      if (next === workspace.outputType) {
        return;
      }

      if (dirty && !window.confirm("You have unsaved changes. Switch output type anyway?")) {
        return;
      }

      onOutputTypeChange(next);
    },
    [dirty, onOutputTypeChange, workspace.outputType]
  );

  const handleRemoveSource = useCallback(
    (sourceId: string) => {
      if (workspace.selectedSourceCount <= 1) {
        return;
      }

      if (dirty && !window.confirm("You have unsaved changes. Remove this source anyway?")) {
        return;
      }

      onRemoveSource(sourceId);
    },
    [dirty, onRemoveSource, workspace.selectedSourceCount]
  );

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Source pane</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Repository attachments</h2>
              </div>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <ExternalLink className="h-4 w-4" />
                Add from library
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-bold text-slate-700">Context</p>
              <p className="mt-1">
                {workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName ?? workspace.sourceContext.subjectCode ?? "Unknown subject"}
                {(workspace.planningContext?.level ?? workspace.sourceContext.level) ? ` • ${workspace.planningContext?.level ?? workspace.sourceContext.level}` : ""}
              </p>
              {workspace.planningContext ? (
                <p className="mt-1 text-slate-500">{workspace.planningContext.className} • {workspace.planningContext.termName} • {workspace.planningContext.topicTitle}</p>
              ) : workspace.sourceContext.topicLabel ? (
                <p className="mt-1 text-slate-500">Topic: {workspace.sourceContext.topicLabel}</p>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {workspace.selectedSources.length > 0 ? (
                workspace.selectedSources.map((source) => (
                  <article
                    key={source._id}
                    className="rounded-2xl border border-slate-200 p-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{getSourceLabel(source)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {source.topicLabel} • {source.sourceType.replace(/_/g, " ")}
                        </p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {getSourceScopeLabel(source)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(source._id)}
                        disabled={workspace.selectedSourceCount <= 1}
                        className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 px-2 text-xs font-bold text-slate-600 transition hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{source.visibility}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{source.reviewStatus}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{source.processingStatus}</span>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No accessible source materials were loaded yet. Add topic-bound materials or broad references from the repository.
                </div>
              )}
            </div>

            {workspace.missingSourceIds.length > 0 || workspace.inaccessibleSourceIds.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-bold">Selection needs attention</p>
                <p className="mt-1 text-xs leading-5">
                  {workspace.warnings[0] ?? "Some selected sources need to be repaired before generation."}
                </p>
              </div>
            ) : null}
          </section>
        </aside>

        <main className="space-y-6">
          {workspace.warnings.length > 0 ? (
            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em]">Workspace warning</p>
                  <ul className="mt-2 space-y-1 text-sm leading-6">
                    {workspace.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Teacher workspace</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {workspace.outputTypeLabel}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {workspace.planningContext
                    ? "This workspace stays anchored to one topic context while repository attachments change around it."
                    : "Source-grounded, editable, single-user drafting with autosave and revision snapshots."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
                  {outputTypeOptions.map((option) => {
                    const selected = option.value === workspace.outputType;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOutputTypeChange(option.value)}
                        className={`rounded-xl px-4 py-2 text-left transition ${
                          selected ? "bg-slate-950 text-white shadow-lg" : "text-slate-500 hover:text-slate-950"
                        }`}
                      >
                        <span className="block text-[10px] font-black uppercase tracking-[0.2em]">{option.label}</span>
                        <span className={`block text-[11px] font-medium ${selected ? "text-white/60" : "text-slate-400"}`}>
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Sources</p>
                <p className="mt-2 text-sm font-bold text-slate-950">{workspace.selectedSourceCount} selected</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Template</p>
                <p className="mt-2 text-sm font-bold text-slate-950">
                  {workspace.template ? workspace.template.resolutionPath : "Not resolved"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Revision</p>
                <p className="mt-2 text-sm font-bold text-slate-950">v{revisionNumber || workspace.draft.revisionNumber || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Saved</p>
                <p className="mt-2 text-sm font-bold text-slate-950">{formatRelativeTime(workspace.draft.lastSavedAt)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-inner shadow-slate-900/5">
              <label className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Draft title</label>
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaveState("idle");
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Title the lesson plan"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                {toolbarActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyToolbarAction(action.id)}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                ref={textareaRef}
                value={documentState}
                onChange={(event) => {
                  setDocumentState(event.target.value);
                  setPlainText(markdownToPlainText(event.target.value));
                  setSaveState("idle");
                }}
                rows={28}
                className="mt-4 min-h-[60vh] w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Write the lesson draft here."
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BookOpenText className="h-4 w-4" />
                  <span>
                    {workspace.template ? `Template: ${workspace.template.title}` : "No active template resolved."}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={!dirty || saveState === "saving" || !canAutosave}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save snapshot
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="inline-flex h-11 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-bold text-amber-900 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate {workspace.outputTypeLabel.toLowerCase()}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {dirty ? "Unsaved changes" : saveState === "saved" ? "Draft synced" : "Draft ready"}
              </span>
              <span>{plainText.length.toLocaleString()} characters of plain text</span>
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Template resolution</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Resolved template</h2>
            {workspace.template ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-950">{workspace.template.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{workspace.template.resolutionPath}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-bold text-slate-700">Applicability</p>
                  <p className="mt-1">{workspace.template.applicabilityLabel}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-bold text-slate-700">Required sections</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getTemplateSectionLabels(workspace.template).map((label) => (
                      <span key={label} className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-600">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-bold text-slate-700">Minimum source materials</p>
                  <p className="mt-1">{workspace.template.objectiveMinimums.minimumSourceMaterials}</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No template resolved. Ask an admin to add a matching template or a school default.
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Revision history</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Snapshots</h2>
            <div className="mt-4 space-y-3">
              {workspace.revisions.length > 0 ? (
                workspace.revisions.map((revision) => (
                  <article key={revision._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">Revision {revision.revisionNumber}</p>
                        <p className="mt-1 text-xs text-slate-500">{revision.revisionKind}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {new Date(revision.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{revision.snippet}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                  No revision snapshots yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Generation rules</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">What this workspace supports</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>• Topic context stays primary when the workspace was launched from the planning hub.</li>
              <li>• Repository attachments can change without changing the draft identity.</li>
              <li>• Drafts stay editable even after generation and autosave snapshots are kept in Convex.</li>
              <li>• Student notes and assignments use the same selected sources and template fallback rules.</li>
            </ul>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Navigation</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Repository round-trip</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Adjust repository attachments in the planning library and return without losing this topic context.
            </p>
            <Link
              href="/planning/library"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Open repository
              <ChevronRight className="h-4 w-4" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
