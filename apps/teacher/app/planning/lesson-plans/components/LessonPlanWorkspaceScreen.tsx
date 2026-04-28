"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  History as HistoryIcon,
  Layers,
  CheckCircle2,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { useConvex } from "convex/react";

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
}> = [
  {
    value: "lesson_plan",
    label: "Lesson Plan",
  },
  {
    value: "student_note",
    label: "Student Note",
  },
  {
    value: "assignment",
    label: "Assignment",
  },
];

const generationStatusMessages = [
  "Resolving the school template...",
  "Generating the first draft...",
  "Checking template sections...",
  "Repairing section issues if needed...",
  "Saving the validated draft...",
] as const;

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
  const convex = useConvex();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"sources" | "history">("sources");
  const [isRestoring, setIsRestoring] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatusIndex, setGenerationStatusIndex] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const retrySaveRef = useRef(false);

  const handleRestoreRevision = async (revisionId: string) => {
    try {
      setIsRestoring(true);
      const content = await convex.query(
        "functions/academic/lessonKnowledgeLessonPlans:getTeacherInstructionArtifactRevisionContent" as never,
        { revisionId } as never
      ) as { title: string; documentState: string; plainText: string };

      if (content) {
        setTitle(content.title);
        setDocumentState(content.documentState);
        setPlainText(content.plainText);
        setSaveState("idle");
      }
    } catch (error) {
      console.error("Failed to restore revision:", error);
    } finally {
      setIsRestoring(false);
    }
  };

  const signature = useMemo(
    () => JSON.stringify({ title, documentState }),
    [title, documentState]
  );
  const dirty = signature !== lastSavedSignature;
  const canGenerate = workspace.canGenerate && !isGenerating;
  const canAutosave = workspace.canAutosave;
  const generationStatusMessage = generationStatusMessages[generationStatusIndex] ?? generationStatusMessages[0];

  const pushNotice = useCallback((type: "success" | "error", message: string) => {
    setNotice({ type, message });
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
    [canAutosave, documentState, onSaveDraft, plainText, pushNotice, title, workspace.planningContext?.subjectId, workspace.sourceContext.level, workspace.sourceContext.subjectId]
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
        .catch(() => {})
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

  useEffect(() => {
    if (!isGenerating) {
      setGenerationStatusIndex(0);
      setGenerationStartedAt(null);
      return;
    }

    const timer = window.setInterval(() => {
      setGenerationStatusIndex((current) => (current + 1) % generationStatusMessages.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    setGenerationStatusIndex(0);
    setGenerationStartedAt(Date.now());
    try {
      const result = await onGenerateDraft();
      setRevisionNumber(result.revisionNumber);
      setTitle(result.title);
      setDocumentState(result.documentState);
      setPlainText(result.plainText);
      setLastSavedSignature(JSON.stringify({ title: result.title, documentState: result.documentState }));
      setSaveState("saved");
      const repairSuffix = result.generationMeta?.repaired ? " Automatically repaired to match the school template." : "";
      pushNotice("success", `Generated ${workspace.outputTypeLabel.toLowerCase()} revision ${result.revisionNumber}.${repairSuffix}`);
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

  return (
    <div className="space-y-4">
      {notice ? (
        <div className={`rounded-xl border p-3.5 shadow-sm transition-all ${
          notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
          notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-900" :
          "border-slate-200 bg-white text-slate-900"
        }`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="text-[11px] font-bold">{notice.message}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white/50 backdrop-blur-sm p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Library</p>
                <h2 className="mt-0.5 text-xs font-bold tracking-tight text-slate-950">Attachments</h2>
              </div>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 transition-all hover:bg-slate-50"
              >
                <BookOpenText className="h-3 w-3" />
                Library
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {workspace.selectedSources.length > 0 ? (
                workspace.selectedSources.map((source) => (
                  <div key={source._id} className="group relative rounded-lg border border-slate-100 bg-white p-2.5 transition hover:border-slate-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-bold text-slate-950">{source.title}</p>
                        <p className="mt-0.5 text-[8px] font-medium text-slate-400 uppercase tracking-wider">{source.sourceType.replace("_", " ")}</p>
                      </div>
                      <button
                        onClick={() => onRemoveSource(source._id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-50 px-1 py-0.5 text-[7px] font-black uppercase tracking-tighter text-slate-400">
                        {source.visibility.replace("_", " ")}
                      </span>
                      <span className="rounded bg-slate-50 px-1 py-0.5 text-[7px] font-black uppercase tracking-tighter text-slate-400">
                        {source.reviewStatus}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-[10px] text-slate-400 text-center">
                  No attachments loaded.
                </div>
              )}
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          {/* FAB for Mobile Resources */}
          <div className="fixed bottom-6 right-6 z-40 xl:hidden">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-2xl shadow-slate-950/40 ring-4 ring-white transition-all hover:scale-110 active:scale-95"
            >
              <Layers className="h-6 w-6" />
              {workspace.selectedSourceCount + workspace.revisions.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white">
                  {workspace.selectedSourceCount + workspace.revisions.length}
                </span>
              )}
            </button>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6 lg:p-7">
            <div className="flex flex-col gap-6">
              {/* Output Tabs & Sync Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50/50 p-1">
                  {outputTypeOptions.map((option) => {
                    const selected = option.value === workspace.outputType;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOutputTypeChange(option.value)}
                        className={`rounded px-2.5 py-1 text-[9px] font-black uppercase tracking-tight transition-all ${
                          selected 
                            ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200" 
                            : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                   <div className={`h-1 w-1 rounded-full ${dirty ? "bg-amber-400" : "bg-emerald-400"}`} />
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{dirty ? "Saving..." : "Synced"}</span>
                </div>
              </div>

              {/* Primary Topic Title */}
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-950 uppercase sm:text-2xl">
                  {workspace.planningContext?.topicTitle ?? workspace.sourceContext.topicLabel ?? "General Objective"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Sources</span>
                    <span className="text-[10px] font-bold text-slate-900">{workspace.selectedSourceCount}</span>
                  </div>
                  <div className="h-3 w-[1px] bg-slate-200" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Revision</span>
                    <span className="text-[10px] font-bold text-slate-900">v{revisionNumber || workspace.draft.revisionNumber || 0}</span>
                  </div>
                  <div className="h-3 w-[1px] bg-slate-200" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">Modified</span>
                    <span className="text-[10px] font-bold text-slate-900">{formatRelativeTime(workspace.draft.lastSavedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Revision Switcher - Removed as per feedback */}
            </div>

            <div className="mt-6 space-y-4">
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSaveState("idle");
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
                placeholder="Document Title..."
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-1">
                <div className="flex flex-wrap gap-0.5 mb-1 p-1 border-b border-slate-100 overflow-x-auto no-scrollbar">
                  {toolbarActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyToolbarAction(action.id)}
                        className="shrink-0 inline-flex h-7 items-center gap-1 rounded border border-transparent bg-transparent px-2 text-[10px] font-bold text-slate-500 transition-all hover:bg-white hover:text-slate-950 hover:shadow-sm"
                      >
                        <Icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{action.label}</span>
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
                  className="min-h-[50vh] xl:min-h-[60vh] w-full rounded-lg border-none bg-white px-5 py-4 text-sm leading-relaxed text-slate-900 outline-none transition-all placeholder:text-slate-300 resize-none"
                  placeholder="Start drafting..."
                />
              </div>

              {isGenerating || isRestoring ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
                    <span className="text-[10px] font-bold text-amber-900 tracking-tight">
                      {isRestoring ? "Restoring revision content..." : generationStatusMessage}
                    </span>
                  </div>
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-amber-100">
                    <div className="h-full w-1/3 animate-[shimmer_1.5s_infinite] bg-amber-500" />
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center sm:gap-1.5">
                  <button
                    type="button"
                    onClick={handleManualSave}
                    disabled={!dirty || saveState === "saving" || !canAutosave}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-30"
                  >
                    {saveState === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Save Snapshot
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-950 px-4 text-[10px] font-bold text-white transition-all hover:bg-slate-800 shadow-lg shadow-slate-950/10 disabled:opacity-30"
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    Generate Draft
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Structure</p>
            <h2 className="mt-0.5 text-xs font-bold tracking-tight text-slate-950">Resolved Template</h2>
            {workspace.template ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
                  <p className="text-[10px] font-bold text-slate-950">{workspace.template.title}</p>
                  <p className="mt-0.5 text-[9px] text-slate-500 truncate">{workspace.template.resolutionPath}</p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-[9px] text-slate-600">
                  <p className="font-bold text-slate-900">Required Sections</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {getTemplateSectionLabels(workspace.template).map((label) => (
                      <span key={label} className="rounded border border-slate-200 bg-white px-1 py-0.5 font-bold text-[9px] text-slate-500">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[10px] font-medium text-amber-800 italic">
                No template resolved.
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">History</p>
            <h2 className="mt-0.5 text-xs font-bold tracking-tight text-slate-950">Snapshots</h2>
            <div className="mt-4 space-y-1.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
              {workspace.revisions.length > 0 ? (
                workspace.revisions.map((revision) => (
                  <button
                    key={revision._id}
                    onClick={() => handleRestoreRevision(revision._id)}
                    className="w-full text-left rounded-lg border border-slate-100 bg-slate-50/30 p-2 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-slate-950">v{revision.revisionNumber}</p>
                      <span className="text-[8px] font-bold text-slate-400">
                        {new Date(revision.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] leading-relaxed text-slate-500 line-clamp-2">{revision.snippet}</p>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3 text-[10px] text-slate-400 text-center">
                  No snapshots yet.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {isSidebarOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/40 backdrop-blur-md xl:hidden">
          <div className="mt-auto flex max-h-[85vh] w-full flex-col rounded-t-[2.5rem] bg-white shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom duration-300">
            {/* Handle Bar */}
            <div className="mx-auto mt-3 h-1 w-12 rounded-full bg-slate-200" />
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-8 pt-6 pb-4">
              <div className="flex gap-6">
                <button 
                  onClick={() => setDrawerTab("sources")}
                  className={`relative pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${drawerTab === "sources" ? "text-slate-950" : "text-slate-300"}`}
                >
                  Sources
                  {drawerTab === "sources" && <div className="absolute bottom-0 left-0 h-0.5 w-full bg-slate-950" />}
                </button>
                <button 
                  onClick={() => setDrawerTab("history")}
                  className={`relative pb-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${drawerTab === "history" ? "text-slate-950" : "text-slate-300"}`}
                >
                  History
                  {drawerTab === "history" && <div className="absolute bottom-0 left-0 h-0.5 w-full bg-slate-950" />}
                </button>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-950 transition-all active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="overflow-y-auto px-8 pb-12 pt-4 no-scrollbar">
              {drawerTab === "sources" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Attached ({workspace.selectedSourceCount})</p>
                    <button onClick={onOpenLibrary} className="text-[10px] font-bold text-slate-900 underline underline-offset-4 decoration-slate-200">Library</button>
                  </div>
                  <div className="grid gap-3">
                    {workspace.selectedSources.map(source => (
                      <div key={source._id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-slate-950">{source.title}</p>
                            <p className="mt-1 text-[8px] font-black uppercase tracking-widest text-slate-400">{source.sourceType}</p>
                          </div>
                          <button onClick={() => onRemoveSource(source._id)} className="text-[10px] font-black uppercase text-rose-500">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Snapshots ({workspace.revisions.length})</p>
                  <div className="grid gap-3">
                    {workspace.revisions.map(rev => (
                      <button
                         key={rev._id}
                         onClick={() => { handleRestoreRevision(rev._id); setIsSidebarOpen(false); }}
                         className="w-full text-left rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all active:bg-white active:ring-4 active:ring-slate-950/5"
                       >
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] font-black text-slate-950 uppercase tracking-widest">v{rev.revisionNumber}</p>
                          <span className="text-[8px] font-bold text-slate-400">{new Date(rev.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-600 line-clamp-2">{rev.snippet}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
