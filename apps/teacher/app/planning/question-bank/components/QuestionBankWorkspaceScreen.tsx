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
  AssessmentGenerationSettings,
  AssessmentQuestionDifficulty,
  AssessmentQuestionMix,
  AssessmentQuestionStyle,
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
    effectiveGenerationSettings: AssessmentGenerationSettings;
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
  onGenerateDraft: (settings: AssessmentGenerationSettings) => Promise<AssessmentBankGenerationResult>;
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
  effectiveGenerationSettings: AssessmentGenerationSettings | null;
}) {
  return JSON.stringify({
    title: args.title,
    description: args.description,
    draftMode: args.draftMode,
    effectiveGenerationSettings: args.effectiveGenerationSettings,
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

const questionStyleOptions: Array<{ value: AssessmentQuestionStyle; label: string }> = [
  { value: "balanced", label: "Balanced" },
  { value: "mixed_open_ended", label: "Mixed open-ended" },
  { value: "open_ended_heavy", label: "Open-ended heavy" },
  { value: "objective_heavy", label: "Objective heavy" },
];

const questionMixKeys: Array<{ key: keyof AssessmentQuestionMix; label: string }> = [
  { key: "multiple_choice", label: "Multiple choice" },
  { key: "short_answer", label: "Short answer" },
  { key: "essay", label: "Essay" },
  { key: "true_false", label: "True/false" },
  { key: "fill_in_the_blank", label: "Fill blank" },
];

function mixTotal(questionMix: AssessmentQuestionMix) {
  return Object.values(questionMix).reduce((sum, value) => sum + value, 0);
}

function getFallbackGenerationSettings(): AssessmentGenerationSettings {
  return {
    questionStyle: "mixed_open_ended",
    totalQuestions: 10,
    questionMix: { multiple_choice: 3, short_answer: 4, essay: 1, true_false: 1, fill_in_the_blank: 1 },
    allowTeacherOverrides: true,
  };
}

function getSettingsFromWorkspace(workspace: AssessmentWorkspaceData): AssessmentGenerationSettings {
  const draftSettings = workspace.draft.effectiveGenerationSettings;
  if (draftSettings?.profileId) {
    const matchingProfile = workspace.profiles.find((profile) => profile._id === draftSettings.profileId);
    if (matchingProfile && !matchingProfile.allowTeacherOverrides) {
      return {
        profileId: matchingProfile._id,
        profileName: matchingProfile.name,
        questionStyle: matchingProfile.questionStyle,
        totalQuestions: matchingProfile.totalQuestions,
        questionMix: matchingProfile.questionMix,
        allowTeacherOverrides: matchingProfile.allowTeacherOverrides,
      };
    }
  }

  return draftSettings ?? workspace.profiles.find((profile) => profile.isDefault) ?? getFallbackGenerationSettings();
}

function getSourceScopeLabel(source: AssessmentWorkspaceData["selectedSources"][number]) {
  return source.sourceType === "imported_curriculum" ? "Broad reference" : source.topicLabel ? "Topic-bound" : "Unattached source";
}

function getPlanningScopeLabel(workspace: AssessmentWorkspaceData) {
  const planningContext = workspace.planningContext;
  if (!planningContext) {
    return workspace.sourceContext.topicLabel ?? "Compatibility context";
  }

  if (planningContext.kind === "topic") {
    return planningContext.topicTitle ?? "Topic context";
  }

  if (planningContext.scopeKind === "topic_subset") {
    return planningContext.topicTitles?.join(" • ") || "Topic subset";
  }

  return "Full subject term";
}

function buildQuestionMixForStyle(style: AssessmentQuestionStyle, totalQuestions: number): AssessmentQuestionMix {
  const total = Math.max(1, Math.min(60, Math.round(totalQuestions || 1)));
  const weightsByStyle: Record<AssessmentQuestionStyle, AssessmentQuestionMix> = {
    balanced: { multiple_choice: 3, short_answer: 3, essay: 1, true_false: 2, fill_in_the_blank: 1 },
    mixed_open_ended: { multiple_choice: 2, short_answer: 4, essay: 2, true_false: 1, fill_in_the_blank: 1 },
    open_ended_heavy: { multiple_choice: 1, short_answer: 4, essay: 3, true_false: 1, fill_in_the_blank: 1 },
    objective_heavy: { multiple_choice: 5, short_answer: 1, essay: 0, true_false: 3, fill_in_the_blank: 1 },
  };
  const weights = weightsByStyle[style];
  const weightTotal = mixTotal(weights);
  const entries = questionMixKeys.map(({ key }) => {
    const raw = (weights[key] / weightTotal) * total;
    return { key, value: Math.floor(raw), remainder: raw % 1 };
  });
  let remaining = total - entries.reduce((sum, entry) => sum + entry.value, 0);
  for (const entry of [...entries].sort((a, b) => b.remainder - a.remainder)) {
    if (remaining <= 0) break;
    entry.value += 1;
    remaining -= 1;
  }
  return entries.reduce(
    (mix, entry) => ({ ...mix, [entry.key]: entry.value }),
    { multiple_choice: 0, short_answer: 0, essay: 0, true_false: 0, fill_in_the_blank: 0 }
  );
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
  const [effectiveGenerationSettings, setEffectiveGenerationSettings] = useState<AssessmentGenerationSettings>(() =>
    getSettingsFromWorkspace(workspace)
  );
  const [lastSavedSignature, setLastSavedSignature] = useState(
    serializeDraftForSignature({
      title: workspace.draft.title,
      description: workspace.draft.description ?? "",
      draftMode: workspace.draftMode,
      items: workspace.items.map(mapWorkspaceItem),
      effectiveGenerationSettings: getSettingsFromWorkspace(workspace),
    })
  );
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const retrySaveRef = useRef(false);

  const signature = useMemo(
    () => serializeDraftForSignature({ title, description, draftMode: workspace.draftMode, items, effectiveGenerationSettings }),
    [description, effectiveGenerationSettings, items, title, workspace.draftMode]
  );
  const dirty = signature !== lastSavedSignature;
  const canGenerate = workspace.canGenerate && !isGenerating;
  const canAutosave = workspace.canAutosave;
  const modeOption = getAssessmentDraftModeOption(workspace.draftMode);
  const modeOptions = useMemo(() => {
    if (workspace.planningContext?.kind === "exam_scope") {
      return assessmentDraftModeOptions.filter((option) => option.value === "exam_draft");
    }

    if (workspace.planningContext?.kind === "topic") {
      return assessmentDraftModeOptions.filter((option) => option.value !== "exam_draft");
    }

    return assessmentDraftModeOptions;
  }, [workspace.planningContext]);
  const workspaceSignature = useMemo(
    () => serializeDraftForSignature({
      title: workspace.draft.title,
      description: workspace.draft.description ?? "",
      draftMode: workspace.draftMode,
      items: workspace.items.map(mapWorkspaceItem),
      effectiveGenerationSettings: getSettingsFromWorkspace(workspace),
    }),
    [workspace]
  );

  useEffect(() => {
    if (dirty) {
      setEffectiveGenerationSettings((current) => {
        if (!current.profileId) {
          return current;
        }

        const refreshedProfile = workspace.profiles.find((profile) => profile._id === current.profileId);
        if (!refreshedProfile) {
          return { ...current, profileId: undefined, profileName: "Custom", allowTeacherOverrides: true };
        }

        return {
          profileId: refreshedProfile._id,
          profileName: refreshedProfile.name,
          questionStyle: refreshedProfile.questionStyle,
          totalQuestions: refreshedProfile.totalQuestions,
          questionMix: refreshedProfile.questionMix,
          allowTeacherOverrides: refreshedProfile.allowTeacherOverrides,
        };
      });
      return;
    }

    setTitle(workspace.draft.title);
    setDescription(workspace.draft.description ?? "");
    setItems(workspace.items.map(mapWorkspaceItem));
    setEffectiveGenerationSettings(getSettingsFromWorkspace(workspace));
    setLastSavedSignature(workspaceSignature);
    setSaveState("idle");
  }, [dirty, workspace, workspaceSignature]);

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

      if (!workspace.planningContext?.subjectId && (!workspace.sourceContext.subjectId || !workspace.sourceContext.level)) {
        return;
      }

      setSaveState("saving");
      try {
        const result = await onSaveDraft({
          effectiveGenerationSettings,
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
        setEffectiveGenerationSettings(result.effectiveGenerationSettings);
        setLastSavedSignature(
          serializeDraftForSignature({
            title: result.title,
            description: result.description ?? "",
            draftMode: result.draftMode,
            items,
            effectiveGenerationSettings: result.effectiveGenerationSettings,
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
    [canAutosave, description, effectiveGenerationSettings, items, onSaveDraft, pushNotice, title, workspace.sourceContext.level, workspace.sourceContext.subjectId]
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
      const result = await onGenerateDraft(effectiveGenerationSettings);
      setTitle(result.title);
      setDescription(result.description ?? "");
      setItems(result.items);
      setEffectiveGenerationSettings(result.effectiveGenerationSettings);
      setLastSavedSignature(
        serializeDraftForSignature({
          title: result.title,
          description: result.description ?? "",
          draftMode: result.draftMode,
          items: result.items,
          effectiveGenerationSettings: result.effectiveGenerationSettings,
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
  }, [canGenerate, effectiveGenerationSettings, onGenerateDraft, pushNotice, workspace.outputTypeLabel]);

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
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Source pane</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-950">Repository attachments</h2>
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
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{getSourceScopeLabel(source)}</p>
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
                  Add repository materials to ground this draft. Topic-bound sources and broad references stay distinct here.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Add from library
            </button>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Draft mode</p>
            <div className="mt-2 space-y-2">
              {modeOptions.map((option) => {
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
            {workspace.planningContext?.kind === "topic" ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Topic work stays topic-first here. Use the exam workspace when you need subject-scope exam drafting.
              </p>
            ) : workspace.planningContext?.kind === "exam_scope" ? (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Exam mode is locked to the selected subject, class, and term scope.
              </p>
            ) : null}
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Generation profile</p>
            <select
              value={effectiveGenerationSettings.profileId ?? "custom"}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setEffectiveGenerationSettings((current) => ({
                    ...current,
                    profileId: undefined,
                    profileName: "Custom",
                    allowTeacherOverrides: true,
                  }));
                  return;
                }

                const profile = workspace.profiles.find((item) => item._id === event.target.value);
                if (profile) {
                  setEffectiveGenerationSettings({
                    profileId: profile._id,
                    profileName: profile.name,
                    questionStyle: profile.questionStyle,
                    totalQuestions: profile.totalQuestions,
                    questionMix: profile.questionMix,
                    allowTeacherOverrides: profile.allowTeacherOverrides,
                  });
                }
              }}
              className="mt-3 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-slate-950"
            >
              <option value="custom">Custom settings</option>
              {workspace.profiles.map((profile) => (
                <option key={profile._id} value={profile._id}>{profile.name}{profile.isDefault ? " • Default" : ""}</option>
              ))}
            </select>

            <label className="mt-3 block text-xs font-bold text-slate-600" htmlFor="question-style">Question style</label>
            <select
              id="question-style"
              value={effectiveGenerationSettings.questionStyle}
              disabled={!effectiveGenerationSettings.allowTeacherOverrides}
              onChange={(event) => {
                const questionStyle = event.target.value as AssessmentQuestionStyle;
                setEffectiveGenerationSettings((current) => ({
                  ...current,
                  profileId: undefined,
                  profileName: "Custom",
                  questionStyle,
                  questionMix: buildQuestionMixForStyle(questionStyle, current.totalQuestions),
                }));
              }}
              className="mt-1 h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
            >
              {questionStyleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <div className="mt-3 space-y-2">
              {questionMixKeys.map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                  <span>{item.label}</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={effectiveGenerationSettings.questionMix[item.key]}
                    disabled={!effectiveGenerationSettings.allowTeacherOverrides}
                    onChange={(event) => {
                      const nextValue = Math.max(0, Math.min(60, Number.parseInt(event.target.value || "0", 10)));
                      setEffectiveGenerationSettings((current) => {
                        const nextMix = { ...current.questionMix, [item.key]: nextValue };
                        return { ...current, profileId: undefined, profileName: "Custom", questionMix: nextMix, totalQuestions: mixTotal(nextMix) };
                      });
                    }}
                    className="h-9 w-20 rounded-xl border border-slate-200 px-2 text-right text-sm text-slate-800 disabled:bg-slate-100"
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Total: {effectiveGenerationSettings.totalQuestions} • {effectiveGenerationSettings.questionStyle.replace(/_/g, " ")}
            </p>
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
                    {workspace.planningContext?.kind === "exam_scope"
                      ? "Draft against an explicit subject-scope exam context, then attach repository materials without changing draft identity."
                      : workspace.planningContext?.kind === "topic"
                        ? "Draft from one teaching topic first, then keep the question set editable as you refine repository sources."
                        : "Keep the generated items editable, tuned to the selected sources, and ready for teacher review."}
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
                <p className="mt-1 font-semibold text-slate-950">{workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName ?? "Not resolved"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class & term</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {workspace.planningContext ? `${workspace.planningContext.className} • ${workspace.planningContext.termName}` : "Not resolved"}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scope</p>
                <p className="mt-1 font-semibold text-slate-950">{getPlanningScopeLabel(workspace)}</p>
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
