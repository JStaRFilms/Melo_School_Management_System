"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { SettingsNavigationTabs } from "../components/SettingsNavigationTabs";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import {
  Hash,
  Save,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Plus,
  Sliders,
  Loader2,
  Archive,
  Layers,
  Building2,
  Check,
  RotateCcw,
  Network,
  Tag,
  Edit3,
  Calendar,
  ArrowRight,
  BookmarkCheck,
} from "lucide-react";

type Frequency = "continuous" | "session" | "calendar";
type Status = "active" | "paused";

type PolicyDraft = {
  pattern: string;
  schoolCode: string;
  campusCode: string;
  currentSequence: number;
  expectedVersion: number;
  expectedCounterVersion: number;
  resetFrequency: Frequency;
  counterStatus: Status;
};

type SequenceDraft = {
  sequenceId: Id<"admissionNumberSequences">;
  code: string;
  label: string;
  scopeType: "branch" | "level" | "pattern_override";
  scopeValue: string;
  currentSequence: number;
  resetFrequency: Frequency;
  status: Status;
  isDefault: boolean;
  expectedConfigVersion: number;
};

type FeedbackState = {
  type: "success" | "error";
  title: string;
  message: string;
} | null;

const FREQUENCY_LABELS: Record<Frequency, { label: string; desc: string }> = {
  continuous: {
    label: "Continuous (Never reset)",
    desc: "Increments continuously year-over-year without resetting.",
  },
  session: {
    label: "Per Academic Session",
    desc: "Resets to starting number at the start of each new academic session.",
  },
  calendar: {
    label: "Per Calendar Year",
    desc: "Resets to starting number on January 1st each year.",
  },
};

const AVAILABLE_TOKENS = [
  { token: "{SCHOOL}", label: "School Code", example: "MCA" },
  { token: "{CAMPUS}", label: "Campus Code", example: "MAIN" },
  { token: "{LEVEL}", label: "Level/Grade", example: "PRI1" },
  { token: "{YEAR}", label: "Academic Year", example: "2026" },
  { token: "{SEQ:4}", label: "4-Digit Sequence", example: "0001" },
];

export default function AdmissionNumberingPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : null;

  const allowed = useQuery(
    api.functions.academic.admissionNumbers.hasViewerCapability,
    schoolId
      ? {
          schoolId,
          capability: "academic.manage_numbering_policy",
        }
      : "skip",
  );

  const data = useQuery(
    api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
    allowed && schoolId ? { schoolId } : "skip",
  );

  const savePolicy = useMutation(
    api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
  );
  const setDefaultSequence = useMutation(
    api.functions.academic.admissionNumbers.setDefaultAdmissionNumberSequence,
  );
  const saveSequence = useMutation(
    api.functions.academic.admissionNumbers.saveAdmissionNumberSequence,
  );

  const patternInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [sequenceDraft, setSequenceDraft] = useState<SequenceDraft | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [groupConfirmation, setGroupConfirmation] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pending, setPending] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  if (allowed === false) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-xs text-rose-800 shadow-xs"
        >
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertCircle className="h-4 w-4" />
            <span>Access denied</span>
          </div>
          <p className="mt-1">
            You do not have permission to manage student admission numbering.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 pb-24">
        <div className="space-y-4 border-b border-slate-200/80 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Admission Numbering Policy
          </h1>
          <SettingsNavigationTabs />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-2 text-xs font-medium text-slate-500">
            Loading numbering settings...
          </p>
        </div>
      </main>
    );
  }

  const minSequenceAllowed = data.branchCounter?.nextSequence ?? 1;

  const value: PolicyDraft = draft ?? {
    pattern: data.policy?.pattern ?? "{SCHOOL}-{YEAR}-{SEQ:4}",
    schoolCode: data.policy?.schoolCode ?? "",
    campusCode: data.policy?.campusCode ?? "",
    currentSequence: minSequenceAllowed,
    expectedVersion: data.version,
    expectedCounterVersion: data.branchCounter?.configVersion ?? 0,
    resetFrequency: data.branchCounter?.resetFrequency ?? "continuous",
    counterStatus: data.branchCounter?.status ?? "active",
  };

  const isSequenceMovedBackwards = value.currentSequence < minSequenceAllowed;

  const preview = value.pattern
    .replaceAll("{SCHOOL}", value.schoolCode || "MCA")
    .replaceAll("{CAMPUS}", value.campusCode || "MAIN")
    .replaceAll("{LEVEL}", "PRI1")
    .replaceAll("{YEAR}", String(data.sessionYear ?? "2026"))
    .replaceAll(
      "{SEQ:4}",
      String(value.currentSequence).padStart(4, "0"),
    );

  const insertToken = (token: string) => {
    const input = patternInputRef.current;
    if (!input) {
      setDraft({
        ...value,
        pattern: `${value.pattern}${token}`,
      });
      return;
    }

    const start = input.selectionStart ?? value.pattern.length;
    const end = input.selectionEnd ?? value.pattern.length;
    const currentText = value.pattern;
    const nextPattern =
      currentText.substring(0, start) + token + currentText.substring(end);

    setDraft({
      ...value,
      pattern: nextPattern,
    });

    requestAnimationFrame(() => {
      input.focus();
      const nextPos = start + token.length;
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleResetSequenceToMin = () => {
    setDraft((prev) => ({
      ...(prev ?? value),
      currentSequence: minSequenceAllowed,
    }));
    setConfirmation(String(minSequenceAllowed));
  };

  const handleReloadPolicy = () => {
    setDraft(null);
    setConfirmation("");
    setFeedback(null);
  };

  const formatAndToastError = (error: unknown) => {
    const rawMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Action failed";

    if (rawMsg.includes("Policy changed")) {
      const title = "Policy updated elsewhere";
      const message = "Policy changed; please reload to review latest settings before saving.";
      appToast.error(title, {
        description: message,
        action: {
          label: "Reload",
          onClick: handleReloadPolicy,
        },
      });
      return { title, message };
    }

    if (rawMsg.includes("The next sequence cannot be moved backwards")) {
      const title = "Sequence cannot be moved backwards";
      const message = `The next admission sequence number cannot be set lower than #${minSequenceAllowed}. Moving the sequence backwards could cause duplicate student admission IDs.`;
      appToast.error(title, {
        description: message,
        action: {
          label: `Reset to #${minSequenceAllowed}`,
          onClick: handleResetSequenceToMin,
        },
      });
      return { title, message };
    }

    if (rawMsg.includes("Confirm the exact next sequence")) {
      const title = "Confirmation mismatch";
      const message = "The starting number and confirmation number must match before saving.";
      appToast.error(title, { description: message });
      return { title, message };
    }

    if (rawMsg.includes("Counter configuration changed")) {
      const title = "Counter updated";
      const message = "Counter configuration changed; please reload to review latest counter settings.";
      appToast.error(title, {
        description: message,
        action: {
          label: "Reload",
          onClick: handleReloadPolicy,
        },
      });
      return { title, message };
    }

    const cleaned = getUserFacingErrorMessage(
      error,
      "An unexpected error occurred while saving the numbering policy.",
    );
    const title = "Action failed";
    appToast.error(title, { description: cleaned });
    return { title, message: cleaned };
  };

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setPending(true);
    setFeedback(null);
    try {
      await operation();
      appToast.success("Settings saved", {
        description: success,
      });
      setFeedback({
        type: "success",
        title: "Success",
        message: success,
      });
      setDraft(null);
      setConfirmation("");
      setGroupConfirmation("");
      setSequenceDraft(null);
    } catch (error) {
      const formatted = formatAndToastError(error);
      setFeedback({
        type: "error",
        ...formatted,
      });
    } finally {
      setPending(false);
    }
  };

  const isConfirmationMatching =
    confirmation.trim() === String(value.currentSequence);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="space-y-4 border-b border-slate-200/80 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Admission Numbering Policy
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Customize student ID formats and starting numbers for new enrollments.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer shadow-2xs"
          >
            <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
            <span>How numbering works</span>
            {showHowItWorks ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </button>
        </div>

        <SettingsNavigationTabs />
      </div>

      {/* Optional Collapsible Guidance */}
      {showHowItWorks && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
            <BookmarkCheck className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>How Student Numbering Works</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-600">
            Every new student enrolled receives an auto-generated admission ID based on your pattern template below.
            Existing student IDs will never be overwritten. If your school has different sections (like Nursery or High School)
            that need their own separate ID counter, you can configure those in the section below.
          </p>
        </div>
      )}

      {/* Actionable Alert: No Active Academic Session */}
      {data.sessionYear === null && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50/90 p-5 text-rose-950 shadow-2xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-rose-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Active Academic Session Required</p>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                  Student admission numbers require an active academic session to determine the enrollment year.
                  Please create or activate an academic session first before saving this policy.
                </p>
              </div>
            </div>
            <Link
              href="/academic/sessions"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 transition-all shrink-0 shadow-xs"
            >
              <span>Manage Sessions</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Friendly Notice: First-Time Setup */}
      {!data.policy && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs font-semibold">
              First-time setup: Enter your school code, campus code, and preferred ID format below to activate numbering.
            </p>
          </div>
        </div>
      )}

      {/* Screen Reader & Test Status Announcement */}
      {feedback && (
        <div role="status" className="sr-only">
          {feedback.title}: {feedback.message}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isSequenceMovedBackwards) {
            formatAndToastError(new Error("The next sequence cannot be moved backwards"));
            return;
          }
          void run(
            () =>
              savePolicy({
                schoolId: schoolId as Id<"schools">,
                pattern: value.pattern,
                schoolCode: value.schoolCode,
                campusCode: value.campusCode,
                nextSequence: Number(value.currentSequence),
                resetFrequency: value.resetFrequency,
                counterStatus: value.counterStatus,
                expectedVersion: value.expectedVersion,
                expectedCounterVersion: value.expectedCounterVersion,
                confirmedNextSequence: Number(confirmation),
              }),
            "Numbering policy updated successfully for new enrollments.",
          );
        }}
        className="space-y-6"
      >
        {/* Live ID Preview Card */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Live Preview: Next Student Enrolled
                </span>
              </div>
              <div className="pt-2">
                <code className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-indigo-950 inline-block shadow-2xs">
                  {preview}
                </code>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-xs space-y-1 sm:text-right">
              <span className="text-slate-400 font-medium block">Branch Next Counter</span>
              <span className="font-mono text-sm font-bold text-slate-700">
                #{value.currentSequence}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Policy Version {data.version}
              </span>
            </div>
          </div>
        </div>

        {/* Institution Identifiers */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-950">
              Institution Identifiers
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Short codes representing your institution and campus in the admission number.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="schoolCode"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                School Code
              </label>
              <input
                id="schoolCode"
                aria-label="schoolCode"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm font-bold uppercase text-slate-900 focus:border-indigo-600 focus:outline-none"
                placeholder="e.g. MCA"
                value={value.schoolCode}
                onChange={(event) =>
                  setDraft({
                    ...value,
                    schoolCode: event.target.value.toUpperCase(),
                  })
                }
              />
              <p className="text-[11px] text-slate-400">
                Replaces the <code className="font-semibold text-slate-600">&#123;SCHOOL&#125;</code> tag.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="campusCode"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Campus Code
              </label>
              <input
                id="campusCode"
                aria-label="campusCode"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm font-bold uppercase text-slate-900 focus:border-indigo-600 focus:outline-none"
                placeholder="e.g. MAIN"
                value={value.campusCode}
                onChange={(event) =>
                  setDraft({
                    ...value,
                    campusCode: event.target.value.toUpperCase(),
                  })
                }
              />
              <p className="text-[11px] text-slate-400">
                Replaces the <code className="font-semibold text-slate-600">&#123;CAMPUS&#125;</code> tag.
              </p>
            </div>
          </div>
        </div>

        {/* Pattern Template Builder */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-950">
              Format Template
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Build your admission number pattern using tags. Click any tag to insert it into your pattern.
            </p>
          </div>

          <div className="space-y-4">
            {/* Tag Insertion Toolbar */}
            <div className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Click tag to insert:
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOKENS.map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => insertToken(item.token)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-900 transition-all cursor-pointer shadow-2xs active:scale-98"
                  >
                    <Plus className="h-3 w-3 text-indigo-600" />
                    <code className="font-bold">{item.token}</code>
                    <span className="text-[10px] text-slate-400 font-normal">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern Input Field */}
            <div className="space-y-2">
              <label
                htmlFor="pattern"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Pattern String
              </label>
              <input
                ref={patternInputRef}
                id="pattern"
                aria-label="Pattern format"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                placeholder="{SCHOOL}-{YEAR}-{SEQ:4}"
                value={value.pattern}
                onChange={(event) =>
                  setDraft({ ...value, pattern: event.target.value })
                }
              />
              <p className="text-[11px] text-slate-400">
                Example: <code className="font-semibold text-slate-600">&#123;SCHOOL&#125;_&#123;CAMPUS&#125;-&#123;YEAR&#125;-&#123;SEQ:4&#125;</code> produces <span className="font-semibold text-slate-600">MCA_MAIN-2026-0001</span>
              </p>
            </div>
          </div>
        </div>

        {/* Counter Configuration & Reset Schedule */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-950">
              Sequence Counter & Reset Schedule
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Set starting numbers and choose when the counter resets to its beginning value.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Frequency Selection */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Reset Frequency
              </label>
              <div className="space-y-2">
                {(["continuous", "session", "calendar"] as Frequency[]).map((freq) => (
                  <label
                    key={freq}
                    className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                      value.resetFrequency === freq
                        ? "border-indigo-600 bg-indigo-50/30 text-indigo-950 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="resetFrequency"
                      value={freq}
                      checked={value.resetFrequency === freq}
                      onChange={() =>
                        setDraft({ ...value, resetFrequency: freq })
                      }
                      className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    />
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold block">
                        {FREQUENCY_LABELS[freq].label}
                      </span>
                      <span className="text-slate-500 text-[11px] block leading-relaxed">
                        {FREQUENCY_LABELS[freq].desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Counter Status */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Counter Status
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-2 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                    value.counterStatus === "active"
                      ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 shadow-2xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="counterStatus"
                    value="active"
                    checked={value.counterStatus === "active"}
                    onChange={() =>
                      setDraft({ ...value, counterStatus: "active" })
                    }
                    className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
                  />
                  <div className="text-xs font-bold">Active</div>
                </label>

                <label
                  className={`flex items-center gap-2 rounded-2xl border p-3.5 cursor-pointer transition-all ${
                    value.counterStatus === "paused"
                      ? "border-amber-500 bg-amber-50/40 text-amber-950 shadow-2xs"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="counterStatus"
                    value="paused"
                    checked={value.counterStatus === "paused"}
                    onChange={() =>
                      setDraft({ ...value, counterStatus: "paused" })
                    }
                    className="h-4 w-4 border-slate-300 text-amber-600 focus:ring-amber-600 cursor-pointer"
                  />
                  <div className="text-xs font-bold">Paused</div>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-500 space-y-1">
                <span className="font-semibold text-slate-700 block">Status Guidance</span>
                <p className="text-[11px] leading-relaxed">
                  Pausing temporarily stops new student enrollments from issuing automatic numbers, useful during institutional audits or system migrations.
                </p>
              </div>
            </div>
          </div>

          {/* Starting / Next Number */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label
              htmlFor="nextSequence"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Next Sequence Number
            </label>
            <input
              id="nextSequence"
              aria-label="Next sequence"
              className={`w-full rounded-xl border px-4 py-2.5 font-mono text-sm font-bold focus:outline-none transition-colors ${
                isSequenceMovedBackwards
                  ? "border-rose-300 bg-rose-50/30 text-rose-950 focus:border-rose-500"
                  : "border-slate-200 bg-white text-slate-900 focus:border-indigo-600"
              }`}
              type="number"
              min={minSequenceAllowed}
              max="999999999"
              step="1"
              value={value.currentSequence}
              onChange={(event) =>
                setDraft({
                  ...value,
                  currentSequence: Number(event.target.value),
                })
              }
            />
            {isSequenceMovedBackwards ? (
              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-semibold text-rose-600">
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>Cannot be lower than #{minSequenceAllowed}</span>
                </span>
                <button
                  type="button"
                  onClick={handleResetSequenceToMin}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset to #{minSequenceAllowed}</span>
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                The number assigned to the next new student (minimum #{minSequenceAllowed}).
              </p>
            )}
          </div>
        </div>

        {/* Starting Number Confirmation Card */}
        <div className="rounded-3xl border border-amber-200/90 bg-amber-50/40 p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
            <h3 className="text-sm font-bold text-amber-950">
              Confirm Starting Number
            </h3>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            To prevent accidental skips or duplicate student IDs, please re-type your starting number below to confirm.
          </p>
          <div className="space-y-2 max-w-md">
            <label
              htmlFor="confirmationSequence"
              className="block text-xs font-bold uppercase tracking-wider text-amber-900"
            >
              Retype Next Number ({value.currentSequence})
            </label>
            <div className="flex items-center gap-2">
              <input
                id="confirmationSequence"
                aria-label="Confirm next sequence"
                className={`w-full rounded-xl border px-4 py-2.5 font-mono text-sm font-bold text-slate-900 focus:outline-none transition-colors ${
                  confirmation && !isConfirmationMatching
                    ? "border-rose-400 bg-rose-50/50 focus:border-rose-500"
                    : isConfirmationMatching
                      ? "border-emerald-500 bg-emerald-50/40 focus:border-emerald-600"
                      : "border-amber-200 bg-white focus:border-amber-600"
                }`}
                placeholder={`Type ${value.currentSequence} to confirm`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              {!isConfirmationMatching && (
                <button
                  type="button"
                  onClick={() => setConfirmation(String(value.currentSequence))}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-100/70 px-3 py-2.5 text-xs font-bold text-amber-900 hover:bg-amber-200/80 transition cursor-pointer shrink-0"
                >
                  <span>Match #{value.currentSequence}</span>
                </button>
              )}
            </div>
            {isConfirmationMatching && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 pt-0.5">
                <Check className="h-3.5 w-3.5" />
                <span>Confirmed match for #{value.currentSequence}</span>
              </p>
            )}
            {confirmation && !isConfirmationMatching && (
              <p className="text-xs font-semibold text-rose-600 pt-0.5">
                Numbers do not match. Expected {value.currentSequence}.
              </p>
            )}
          </div>
        </div>

        {/* Form Action Controls */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              {draft ? (
                <span className="text-amber-700 font-semibold">
                  You have unsaved changes to your numbering policy.
                </span>
              ) : (
                <span>Numbering settings are saved and active.</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={pending || data.sessionYear === null || isSequenceMovedBackwards}
                title={
                  isSequenceMovedBackwards
                    ? `Next sequence cannot be less than #${minSequenceAllowed}`
                    : undefined
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Policy...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save prospective policy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={pending || !draft}
                onClick={() => {
                  setDraft(null);
                  setConfirmation("");
                  setFeedback(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                <span>Discard Changes</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Grade-Level & Custom Counters (Optional) */}
      <section className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-xs">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-950">
              Grade-Level & Custom Counters (Optional)
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            By default, all students use the school-wide numbering policy above. If your school requires separate counters for specific school sections (such as Kindergarten or Senior Secondary), you can create and manage dedicated sequence rules here.
          </p>
        </div>

        {data.sequences.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <p className="text-xs font-medium text-slate-500">
              No custom counters configured. All pupils use the standard branch sequence (#{value.currentSequence}).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.sequences.map((sequence) => {
              const isDefault = sequence.isDefault;
              const isSelected = sequenceDraft?.sequenceId === sequence._id;

              return (
                <div
                  key={sequence._id}
                  className={`rounded-2xl border p-4 space-y-3 transition-all ${
                    isDefault
                      ? "border-emerald-200 bg-emerald-50/30"
                      : isSelected
                        ? "border-indigo-400 bg-indigo-50/30"
                        : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {sequence.code}
                      </span>
                    </div>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Default
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          run(
                            () =>
                              setDefaultSequence({
                                sequenceId: sequence._id,
                                schoolId: schoolId as Id<"schools">,
                              }),
                            `Set ${sequence.label} as active default.`,
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                      >
                        Make Default
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-800">
                      {sequence.label}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Scope: <span className="font-mono">{sequence.scopeType}:{sequence.scopeValue || "global"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-400">Next in line:</span>
                    <span className="font-mono font-bold text-slate-900">
                      #{sequence.currentSequence}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
