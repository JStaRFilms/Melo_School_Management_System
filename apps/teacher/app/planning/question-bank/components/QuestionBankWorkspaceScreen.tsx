"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import type {
  AssessmentDraftItem,
  AssessmentDraftMode,
  AssessmentOutputType,
  AssessmentWorkspaceData,
  AssessmentBankGenerationResult,
  AssessmentBankSaveResult,
  AssessmentQuestionDifficulty,
  AssessmentQuestionType,
} from "../types";
import {
  assessmentDraftModeOptions,
  getAssessmentDraftModeOption,
  getDefaultAssessmentQuestionType,
} from "../types";

interface QuestionBankWorkspaceScreenProps {
  workspace: AssessmentWorkspaceData;
  onDraftModeChange: (next: AssessmentDraftMode) => void;
  onRemoveSource: (sourceId: string) => void;
  onOpenLibrary: () => void;
  onSaveDraft: (draft: {
    title: string;
    description: string | null;
    items: Array<{
      questionType: AssessmentQuestionType;
      difficulty: AssessmentQuestionDifficulty;
      promptText: string;
      answerText: string;
      explanationText: string;
      marks: number | null;
      tags: string[];
    }>;
  }) => Promise<AssessmentBankSaveResult>;
  onGenerateDraft: () => Promise<AssessmentBankGenerationResult>;
}

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

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function tagsToText(tags: string[]) {
  return tags.join(", ");
}

function textToTags(value: string) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of value.split(",")) {
    const trimmed = normalizeText(tag);
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function createBlankItem(index: number, outputType: AssessmentOutputType, mode: AssessmentDraftMode): AssessmentDraftItem {
  return {
    id: `new-${crypto.randomUUID()}`,
    itemOrder: index,
    questionType:
      outputType === "cbt_draft"
        ? "multiple_choice"
        : getDefaultAssessmentQuestionType(mode),
    difficulty: "medium",
    promptText: "",
    answerText: "",
    explanationText: "",
    marks: 1,
    tags: [],
  };
}

function mapWorkspaceItem(item: AssessmentWorkspaceData["items"][number]): AssessmentDraftItem {
  return {
    id: item.id,
    itemOrder: item.itemOrder,
    questionType: item.questionType,
    difficulty: item.difficulty,
    promptText: item.promptText,
    answerText: item.answerText,
    explanationText: item.explanationText,
    marks: item.marks,
    tags: item.tags,
  };
}

function serializeDraftForSignature(args: {
  title: string;
  description: string;
  draftMode: AssessmentDraftMode;
  items: AssessmentDraftItem[];
}) {
  return JSON.stringify({
    title: args.title,
    description: args.description,
    draftMode: args.draftMode,
    items: args.items.map((item) => ({
      itemOrder: item.itemOrder,
      questionType: item.questionType,
      difficulty: item.difficulty,
      promptText: item.promptText,
      answerText: item.answerText,
      explanationText: item.explanationText,
      marks: item.marks,
      tags: item.tags,
    })),
  });
}

function itemLabel(item: AssessmentDraftItem) {
  return item.questionType.replace(/_/g, " ");
}

export function QuestionBankWorkspaceScreen({
  workspace,
  onDraftModeChange,
  onRemoveSource,
  onOpenLibrary,
  onSaveDraft,
  onGenerateDraft,
}: QuestionBankWorkspaceScreenProps) {
  const [title, setTitle] = useState(workspace.draft.title);
  const [description, setDescription] = useState(workspace.draft.description ?? "");
  const [items, setItems] = useState<AssessmentDraftItem[]>(workspace.items.map(mapWorkspaceItem));
  const [lastSavedSignature, setLastSavedSignature] = useState(
    serializeDraftForSignature({
      title: workspace.draft.title,
      description: workspace.draft.description ?? "",
      draftMode: workspace.draftMode,
      items: workspace.items.map(mapWorkspaceItem),
    })
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const retrySaveRef = useRef(false);

  const signature = useMemo(
    () => serializeDraftForSignature({ title, description, draftMode: workspace.draftMode, items }),
    [description, items, title, workspace.draftMode]
  );
  const dirty = signature !== lastSavedSignature;
  const canGenerate = workspace.canGenerate && !isGenerating;
  const canAutosave = workspace.canAutosave;
  const modeOption = getAssessmentDraftModeOption(workspace.draftMode);

  const pushNotice = useCallback((tone: "success" | "error", message: string) => {
    setNotice({ tone, message });
    window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const updateItem = useCallback(
    (itemId: string, updater: (item: AssessmentDraftItem) => AssessmentDraftItem) => {
      setItems((current) =>
        current.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          return updater(item);
        })
      );
    },
    []
  );

  const removeItem = useCallback((itemId: string) => {
    setItems((current) =>
      current
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, itemOrder: index }))
    );
  }, []);

  const moveItem = useCallback((itemId: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next.map((item, itemOrder) => ({ ...item, itemOrder }));
    });
  }, []);

  const addItem = () => {
    setItems((current) => [...current, createBlankItem(current.length, workspace.draft.outputType, workspace.draftMode)]);
  };

  const persistDraft = useCallback(
    async (mode: "manual" | "autosave") => {
      if (!canAutosave) {
        return;
      }

      if (!workspace.sourceContext.subjectId || !workspace.sourceContext.level) {
        return;
      }

      setSaveState("saving");
      try {
        const result = await onSaveDraft({
          title,
          description: description.trim() ? description.trim() : null,
          items: items.map((item) => ({
            questionType: item.questionType,
            difficulty: item.difficulty,
            promptText: item.promptText,
            answerText: item.answerText,
            explanationText: item.explanationText,
            marks: item.marks,
            tags: item.tags,
          })),
        });

        setTitle(result.title);
        setDescription(result.description ?? "");
        setLastSavedSignature(
          serializeDraftForSignature({
            title: result.title,
            description: result.description ?? "",
            draftMode: result.draftMode,
            items,
          })
        );
        setSaveState("saved");
        if (mode === "manual") {
          pushNotice(
            "success",
            `Saved ${result.outputType === "cbt_draft" ? "CBT draft" : "question bank draft"} with ${result.itemCount} item${result.itemCount === 1 ? "" : "s"}.`
          );
        }
      } catch (error) {
        setSaveState("error");
        pushNotice("error", getUserFacingErrorMessage(error, "Failed to save draft."));
      }
    },
    [canAutosave, description, items, onSaveDraft, pushNotice, title, workspace.sourceContext.level, workspace.sourceContext.subjectId]
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
          // handled in persistDraft
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
  }, [canAutosave, dirty, isGenerating, persistDraft]);

  const handleManualSave = useCallback(async () => {
    if (!dirty) {
      pushNotice("success", "No unsaved changes. This draft is already saved.");
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
      setTitle(result.title);
      setDescription(result.description ?? "");
      setItems(result.items);
      setLastSavedSignature(
        serializeDraftForSignature({
          title: result.title,
          description: result.description ?? "",
          draftMode: result.draftMode,
          items: result.items,
        })
      );
      setSaveState("saved");
      pushNotice("success", `Generated ${workspace.outputTypeLabel.toLowerCase()} with ${result.itemCount} item${result.itemCount === 1 ? "" : "s"}.`);
    } catch (error) {
      setSaveState("error");
      pushNotice("error", getUserFacingErrorMessage(error, "Generation failed."));
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerate, onGenerateDraft, pushNotice, workspace.outputTypeLabel]);

  const handleModeChange = useCallback(
    (next: AssessmentDraftMode) => {
      if (next === workspace.draftMode) {
        return;
      }

      if (dirty && !window.confirm("You have unsaved changes. Switch draft mode anyway?")) {
        return;
      }

      onDraftModeChange(next);
    },
    [dirty, onDraftModeChange, workspace.draftMode]
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
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Source sidebar</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Selected sources</h2>
              </div>
              <BookOpenText className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-2">
              {workspace.selectedSources.length > 0 ? (
                workspace.selectedSources.map((source) => (
                  <div
                    key={source._id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{source.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{source.subjectName} • {source.level}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(source._id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950"
                        aria-label={`Remove ${source.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{source.topicLabel}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                  Select lesson sources from the library to generate a draft bank.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Open library
            </button>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Draft mode</p>
            <div className="mt-2 space-y-2">
              {assessmentDraftModeOptions.map((option) => {
                const active = option.value === workspace.draftMode;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleModeChange(option.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{option.label}</span>
                      <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${active ? "text-white/70" : "text-slate-400"}`}>
                        {option.outputType === "cbt_draft" ? "CBT" : "Bank"}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{option.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {workspace.draftModeLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
                    {workspace.outputTypeLabel}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Assessment draft editor</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                    {workspace.draft.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-500">
                    Keep the generated items editable, tuned to the selected sources, and ready for teacher review.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={!dirty || !canAutosave || saveState === "saving"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate draft
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>
              <label className="space-y-2 sm:col-span-2 xl:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Description</span>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional note, blueprint, or exam instructions"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />
              </label>
            </div>
          </section>

          {workspace.warnings.length > 0 ? (
            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                <div className="space-y-2 text-sm text-amber-900">
                  {workspace.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Question items</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Editable bank rows</h3>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add item
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <article key={item.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Item {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-950">{itemLabel(item)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950 disabled:opacity-40"
                          disabled={index === 0}
                          aria-label="Move item up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, 1)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950 disabled:opacity-40"
                          disabled={index === items.length - 1}
                          aria-label="Move item down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-rose-700 transition hover:border-rose-200 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="space-y-2 lg:col-span-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Question type</span>
                        <select
                          value={item.questionType}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              questionType: event.target.value as AssessmentQuestionType,
                            }))
                          }
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400"
                        >
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="short_answer">Short answer</option>
                          <option value="essay">Essay</option>
                          <option value="true_false">True / false</option>
                          <option value="fill_in_the_blank">Fill in the blank</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Difficulty</span>
                        <select
                          value={item.difficulty}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              difficulty: event.target.value as AssessmentQuestionDifficulty,
                            }))
                          }
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Marks</span>
                        <input
                          type="number"
                          min={0}
                          value={item.marks ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              marks: event.target.value === "" ? null : Number(event.target.value),
                            }))
                          }
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-slate-400"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Question text</span>
                        <textarea
                          value={item.promptText}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              promptText: event.target.value,
                            }))
                          }
                          rows={4}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Answer</span>
                        <textarea
                          value={item.answerText}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              answerText: event.target.value,
                            }))
                          }
                          rows={4}
                          className="min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Explanation</span>
                        <textarea
                          value={item.explanationText}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              explanationText: event.target.value,
                            }))
                          }
                          rows={3}
                          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </label>
                      <label className="space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Tags</span>
                        <textarea
                          value={tagsToText(item.tags)}
                          onChange={(event) =>
                            updateItem(item.id, (current) => ({
                              ...current,
                              tags: textToTags(event.target.value),
                            }))
                          }
                          rows={3}
                          placeholder="comma-separated tags"
                          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                        />
                      </label>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                  No items yet. Add a question row to begin building the draft.
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Draft context</p>
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subject</p>
                <p className="mt-1 font-semibold text-slate-950">{workspace.sourceContext.subjectName ?? "Not resolved"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Level</p>
                <p className="mt-1 font-semibold text-slate-950">{workspace.sourceContext.level ?? "Not resolved"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Topic</p>
                <p className="mt-1 font-semibold text-slate-950">{workspace.sourceContext.topicLabel ?? "Not resolved"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Saved</p>
                <p className="mt-1 font-semibold text-slate-950">{formatRelativeTime(workspace.draft.lastSavedAt)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Revision hygiene</p>
                <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">Status</h3>
              </div>
              <BookOpenText className="h-5 w-5 text-slate-400" />
            </div>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="font-semibold text-slate-950">Autosave</p>
                <p className="mt-1 text-xs text-slate-500">{canAutosave ? "Enabled" : "Blocked until context resolves"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="font-semibold text-slate-950">Generation</p>
                <p className="mt-1 text-xs text-slate-500">{canGenerate ? "Ready to generate" : "Blocked until sources are ready"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="font-semibold text-slate-950">Output shape</p>
                <p className="mt-1 text-xs text-slate-500">{workspace.outputTypeLabel} • {modeOption.label}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
