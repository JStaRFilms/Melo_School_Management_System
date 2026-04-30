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
  Settings2,
} from "lucide-react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { TeacherSheet } from "@/lib/components/ui/TeacherSheet";
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
    id: `new-${typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11)}`,
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
  return item.questionType?.replace(/_/g, " ") ?? "Question Item";
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
    [canAutosave, description, effectiveGenerationSettings, items, onSaveDraft, pushNotice, title, workspace.planningContext?.subjectId, workspace.sourceContext.level, workspace.sourceContext.subjectId]
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
            void persistDraft("autosave");
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

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const SidebarContent = (
    <div className="space-y-6">
      {/* REVISION HYGIENE & STATUS */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Revision Status
            </h3>
            <BookOpenText className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Autosave</p>
              <p className="text-[10px] font-medium text-slate-500">
                {canAutosave ? "Active" : "Paused"}
              </p>
            </div>
            <div className={`h-2 w-2 rounded-full ${canAutosave ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Last Synced</p>
              <p className="text-[10px] font-medium text-slate-500">
                {formatRelativeTime(workspace.draft.lastSavedAt)}
              </p>
            </div>
            <Save className="h-3.5 w-3.5 text-slate-300" />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10 uppercase tracking-wider">
                {workspace.outputTypeLabel}
              </span>
              <span className="inline-flex rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-900/10 uppercase tracking-wider">
                {modeOption.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={handleManualSave}
              disabled={!dirty || !canAutosave || saveState === "saving"}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-950 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {saveState === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-[11px] font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate
            </button>
          </div>
        </div>
      </section>

      {/* GENERATION PROFILE */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <h3 className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            Generation Profile
          </h3>
        </div>
        <div className="p-4 space-y-4">
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
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none transition focus:border-slate-950"
          >
            <option value="custom">Custom settings</option>
            {workspace.profiles.map((profile) => (
              <option key={profile._id} value={profile._id}>{profile.name}{profile.isDefault ? " • Default" : ""}</option>
            ))}
          </select>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Style</span>
              <select
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
                className="h-8 rounded-md border-none bg-slate-100 px-2 text-[11px] font-bold text-slate-700 disabled:opacity-50"
              >
                {questionStyleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 pt-2">
              {questionMixKeys.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium text-slate-500">{item.label}</span>
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
                    className="h-7 w-12 rounded bg-slate-50 text-right text-[11px] font-bold text-slate-950 ring-1 ring-slate-950/5 disabled:opacity-50"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* REPOSITORY ATTACHMENTS */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
              Sources ({workspace.selectedSources.length})
            </h3>
            <button 
              onClick={onOpenLibrary}
              className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider"
            >
              Manage
            </button>
          </div>
        </div>

        <div className="p-3 space-y-2">
          {workspace.selectedSources.map((source) => (
            <div key={source._id} className="group relative rounded-lg border border-slate-100 bg-white p-3 transition-colors hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">{source.title}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                    {source.subjectName} • {source.level}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveSource(source._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-300 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          
          {workspace.selectedSources.length === 0 && (
            <p className="py-4 text-center text-xs font-medium text-slate-400 italic">No sources attached.</p>
          )}
          
          <button
            type="button"
            onClick={onOpenLibrary}
            className="mt-2 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 text-[11px] font-bold text-slate-500 transition hover:bg-slate-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Source
          </button>
        </div>
      </section>

      {/* DRAFT CONTEXT */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <h3 className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
            Academic Context
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Subject & Level</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900 truncate">
                {workspace.planningContext?.subjectName ?? workspace.sourceContext.subjectName ?? "N/A"} • {workspace.planningContext?.level ?? workspace.sourceContext.level ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Class & Term</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900 truncate">
                {workspace.planningContext ? `${workspace.planningContext.className} • ${workspace.planningContext.termName}` : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Scope</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900 truncate">
                {getPlanningScopeLabel(workspace)}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
        {/* RIGHT SIDEBAR: WORKBENCH & CONTEXT */}
        {!isMobile && (
          <aside className="w-full space-y-6 lg:sticky lg:top-8 lg:w-[380px] lg:shrink-0">
            {SidebarContent}
          </aside>
        )}

        {isMobile && (
          <TeacherSheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            title="Workbench Settings"
          >
            <div className="p-6 space-y-8">
              {SidebarContent}
            </div>
          </TeacherSheet>
        )}

        {/* MAIN WORKSPACE: EDITOR & ITEMS */}
        <main className="flex-1 space-y-8 min-w-0">
          {/* EDITOR HEADER */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5 p-5 lg:p-8">
            <div className="space-y-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-xl font-black tracking-tight text-slate-950 uppercase">
                      Bank Identity
                    </h2>
                    {isMobile && (
                      <button
                        onClick={() => setIsSheetOpen(true)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-500 max-w-md leading-relaxed">
                    Set the core identity for this collection. Changes here affect how it's categorized in your library.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
                  {modeOptions.map((option) => {
                    const active = option.value === workspace.draftMode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleModeChange(option.value)}
                        className={`whitespace-nowrap rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                          active
                            ? "bg-slate-950 text-white shadow-lg shadow-slate-950/20 ring-1 ring-slate-950"
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Draft Title</label>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Mid-term Physics Quiz"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-slate-950 focus:ring-8 focus:ring-slate-950/5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contextual description</label>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Covering chapters 1-4"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-slate-950 focus:ring-8 focus:ring-slate-950/5"
                  />
                </div>
              </div>

              {workspace.warnings.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                  <div className="space-y-1.5 text-[11px] font-medium text-amber-900 leading-relaxed">
                    {workspace.warnings.map((warning, i) => <p key={i}>{warning}</p>)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* QUESTION ITEMS */}
          <section className="space-y-6">
            <div className="flex items-end justify-between px-2">
              <div className="space-y-1">
                <h3 className="font-display text-xl sm:text-2xl font-black tracking-tight text-slate-950 uppercase">Drafted Items</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {items.length} {items.length === 1 ? "question" : "questions"} generated
                </p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="hidden sm:inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-[11px] font-bold text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Question
              </button>
            </div>

            <div className="space-y-6 pb-24 lg:pb-0">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <article key={item.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5 transition-all hover:shadow-xl hover:ring-slate-950/10">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-3">
                      <div className="flex items-center gap-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[12px] font-black text-white shadow-lg shadow-slate-950/20 ring-4 ring-slate-950/5">
                          {index + 1}
                        </span>
                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-950">
                            {itemLabel(item)}
                          </p>
                          <div className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            ID: {item.id?.slice(0, 6) ?? "NEW"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, -1)}
                          disabled={index === 0}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, 1)}
                          disabled={index === items.length - 1}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <div className="mx-1 h-5 w-px bg-slate-200" />
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2 lg:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Question Type</label>
                          <select
                            value={item.questionType}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                questionType: event.target.value as AssessmentQuestionType,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-xs font-bold text-slate-950 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                          >
                            <option value="multiple_choice">Multiple choice</option>
                            <option value="short_answer">Short answer</option>
                            <option value="essay">Essay</option>
                            <option value="true_false">True / false</option>
                            <option value="fill_in_the_blank">Fill in the blank</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Difficulty</label>
                          <select
                            value={item.difficulty}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                difficulty: event.target.value as AssessmentQuestionDifficulty,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-xs font-bold text-slate-950 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Marks</label>
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
                            className="h-10 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-xs font-bold text-slate-950 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                          />
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Question Prompt</label>
                          <textarea
                            value={item.promptText}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                promptText: event.target.value,
                              }))
                            }
                            rows={4}
                            className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5 leading-relaxed"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Answer Key</label>
                          <textarea
                            value={item.answerText}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                answerText: event.target.value,
                              }))
                            }
                            rows={4}
                            className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5 leading-relaxed"
                          />
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Teacher Explanation</label>
                          <textarea
                            value={item.explanationText}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                explanationText: event.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-[11px] font-medium text-slate-500 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5 leading-relaxed"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Tags</label>
                          <input
                            value={tagsToText(item.tags)}
                            onChange={(event) =>
                              updateItem(item.id, (current) => ({
                                ...current,
                                tags: textToTags(event.target.value),
                              }))
                            }
                            placeholder="logic, algebra, exam-2024"
                            className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 text-[11px] font-medium text-slate-500 outline-none transition focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-20 text-center px-6">
                   <div className="rounded-2xl bg-white p-5 text-slate-200 shadow-xl ring-1 ring-slate-950/5">
                    <Plus className="h-10 w-10" />
                  </div>
                  <p className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-slate-400">Empty Draft State</p>
                  <p className="mt-3 text-sm font-medium text-slate-400 max-w-[280px] leading-relaxed">
                    Use the workbench tools on the right to generate your first draft based on the attached repository sources.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* MOBILE STICKY ACTIONS */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/80 p-4 pb-8 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={addItem}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
            <button
              onClick={handleManualSave}
              disabled={!dirty || !canAutosave || saveState === "saving"}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-[11px] font-bold text-white shadow-lg shadow-slate-950/20 active:scale-95 disabled:opacity-50"
            >
              {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Progress
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
