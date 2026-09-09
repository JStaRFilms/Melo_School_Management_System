"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { SettingsNavigationTabs } from "../components/SettingsNavigationTabs";
import {
  Hash,
  Save,
  AlertCircle,
  CheckCircle2,
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
  X,
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
  key: string;
  name: string;
  level: string;
  currentSequence: number;
  resetFrequency: Frequency;
  status: Status;
  expectedConfigVersion: number;
};

const FREQUENCY_LABELS: Record<Frequency, { label: string; desc: string }> = {
  continuous: {
    label: "Continuous (Never reset)",
    desc: "Numbers keep increasing across years without ever starting over",
  },
  session: {
    label: "Academic Session",
    desc: "Starts back at 1 automatically when a new academic year begins",
  },
  calendar: {
    label: "Calendar Year (UTC)",
    desc: "Starts back at 1 automatically on January 1st",
  },
};

const TOKENS = [
  { token: "{SCHOOL}", label: "School Code", desc: "e.g. MCA" },
  { token: "{CAMPUS}", label: "Campus Code", desc: "e.g. MAIN" },
  { token: "{LEVEL}", label: "Level", desc: "e.g. PRI, SEC" },
  { token: "{YEAR}", label: "Session Year", desc: "e.g. 2026" },
  { token: "{SEQ:4}", label: "4-Digit Number", desc: "e.g. 0001" },
];

export default function AdmissionNumberingPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;

  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "enrollment.intakes.manage" } : "skip",
  );

  const data = useQuery(
    api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
    schoolId && allowed ? { schoolId } : "skip",
  );

  const savePolicy = useMutation(
    api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
  );
  const configureSequence = useMutation(
    api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
  );
  const archiveSequence = useMutation(
    api.functions.academic.admissionNumbers.archiveAdmissionNumberSequence,
  );
  const setDefaultSequence = useMutation(
    api.functions.academic.admissionNumbers.setDefaultAdmissionNumberSequence,
  );
  const publishGroupFormat = useMutation(
    api.functions.academic.admissionNumbers.publishGroupAdmissionNumberFormat,
  );
  const setFormatInheritance = useMutation(
    api.functions.academic.admissionNumbers.setAdmissionNumberFormatInheritance,
  );

  const patternInputRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [sequenceDraft, setSequenceDraft] = useState<SequenceDraft | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [groupConfirmation, setGroupConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  if (allowed === false) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-rose-900 shadow-2xs"
        >
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <div>
            <h2 className="text-sm font-bold">Access Denied</h2>
            <p className="mt-1 text-xs text-rose-700">
              Numbering settings access denied. You do not have enrollment administration capabilities.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !schoolId) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-16 text-center shadow-2xs">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
          <p className="mt-4 text-xs font-semibold text-slate-600">
            Loading numbering policy…
          </p>
        </div>
      </div>
    );
  }

  const value: PolicyDraft = draft ?? {
    pattern: data.policy?.pattern ?? "{SCHOOL}-{YEAR}-{SEQ:4}",
    schoolCode: data.policy?.schoolCode ?? "",
    campusCode: data.policy?.campusCode ?? "",
    currentSequence: data.branchCounter?.nextSequence ?? 1,
    expectedVersion: data.version,
    expectedCounterVersion: data.branchCounter?.configVersion ?? 0,
    resetFrequency: data.branchCounter?.resetFrequency ?? "continuous",
    counterStatus: data.branchCounter?.status ?? "active",
  };

  const preview = value.pattern
    .replaceAll("{SCHOOL}", value.schoolCode || "MCA")
    .replaceAll("{CAMPUS}", value.campusCode || "MAIN")
    .replaceAll("{LEVEL}", "PRI")
    .replaceAll("{YEAR}", String(data.sessionYear ?? "2026"))
    .replace(/\{SEQ:([1-9])\}/g, (_, width: string) =>
      String(value.currentSequence).padStart(Number(width), "0"),
    );

  const handleInsertToken = (token: string) => {
    const input = patternInputRef.current;
    if (!input) {
      setDraft({
        ...value,
        pattern: value.pattern + token,
      });
      return;
    }

    const currentPattern = value.pattern;
    const start = input.selectionStart ?? currentPattern.length;
    const end = input.selectionEnd ?? currentPattern.length;
    const nextPattern =
      currentPattern.slice(0, start) + token + currentPattern.slice(end);

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

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setPending(true);
    setMessage("");
    setIsSuccess(false);
    try {
      await operation();
      setMessage(success);
      setIsSuccess(true);
      setDraft(null);
      setConfirmation("");
      setGroupConfirmation("");
      setSequenceDraft(null);
    } catch (error) {
      const rawMsg = error instanceof Error ? error.message : "Action failed";
      // Ensure "Policy changed" is preserved for test contracts while remaining helpful
      if (rawMsg.includes("Policy changed")) {
        setMessage("Policy changed; please reload to review latest settings before saving.");
      } else {
        setMessage(rawMsg);
      }
      setIsSuccess(false);
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

      {/* Status Banner */}
      {message && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-semibold shadow-2xs transition-all ${
            isSuccess
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isSuccess ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{message}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Form 1: Main Admission Number Format */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              savePolicy({
                schoolId,
                ...value,
                confirmedNextSequence: Number(confirmation),
              }),
            "Policy saved for new enrollments only.",
          );
        }}
        className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-6"
      >
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Student ID Format & Sequence
              </h2>
              <p className="text-[11px] text-slate-500">
                Choose the template for new student IDs and set your starting number.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Source: {data.formatSource.toUpperCase()} {data.formatVersion ? `v${data.formatVersion}` : "(Local)"}
            </span>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="rounded-xl border border-indigo-100/90 bg-gradient-to-r from-indigo-50/70 via-purple-50/20 to-slate-50 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-indigo-700 uppercase">
                <Hash className="h-3.5 w-3.5 text-indigo-600" />
                <span>Live ID Preview</span>
              </div>
              <div>
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-950">
                  {preview}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sample preview of how the next enrolled student ID will appear.
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-indigo-100/80 pt-3 sm:pt-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Next In Line
              </span>
              <span className="font-mono text-base font-bold text-slate-900 bg-white border border-slate-200/80 px-3 py-1 rounded-lg shadow-2xs">
                #{String(value.currentSequence).padStart(4, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Form Inputs: School Code, Campus Code, Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label
              htmlFor="schoolCode"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              schoolCode
            </label>
            <input
              id="schoolCode"
              aria-label="schoolCode"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. MCA"
              required
              value={value.schoolCode}
              onChange={(event) =>
                setDraft({ ...value, schoolCode: event.target.value })
              }
            />
            <p className="text-[11px] text-slate-400">
              Short school initials (e.g. MCA, OXF, SCH).
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="campusCode"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              campusCode
            </label>
            <input
              id="campusCode"
              aria-label="campusCode"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. MAIN"
              required
              value={value.campusCode}
              onChange={(event) =>
                setDraft({ ...value, campusCode: event.target.value })
              }
            />
            <p className="text-[11px] text-slate-400">
              Campus or branch location code (e.g. MAIN, NORTH).
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label
              htmlFor="pattern"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              pattern
            </label>
            <input
              ref={patternInputRef}
              id="pattern"
              aria-label="pattern"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              required
              value={value.pattern}
              onChange={(event) =>
                setDraft({ ...value, pattern: event.target.value })
              }
            />

            {/* Token Selector Pills */}
            <div className="pt-1 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Tag className="h-3 w-3 text-slate-400" />
                <span>Click a token to insert at your cursor position:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {TOKENS.map(({ token, desc, label }) => (
                  <button
                    type="button"
                    key={token}
                    onClick={() => handleInsertToken(token)}
                    title={`${label} (${desc})`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 transition-all cursor-pointer shadow-2xs"
                  >
                    <Plus className="h-3 w-3 text-slate-400" />
                    <span>{token}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Counter Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-slate-100 pt-5">
          <div className="space-y-1.5">
            <label
              htmlFor="counterStatus"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Default counter status
            </label>
            <select
              id="counterStatus"
              aria-label="Default counter status"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
              value={value.counterStatus}
              onChange={(event) =>
                setDraft({
                  ...value,
                  counterStatus: event.target.value as Status,
                })
              }
            >
              <option value="active">Active (Counting up)</option>
              <option value="paused">Paused (Temporarily held)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              When paused, automatic ID generation is held.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="resetFrequency"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Reset
            </label>
            <select
              id="resetFrequency"
              aria-label="Reset"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
              value={value.resetFrequency}
              onChange={(event) =>
                setDraft({
                  ...value,
                  resetFrequency: event.target.value as Frequency,
                })
              }
            >
              <option value="continuous">Continuous (Never reset)</option>
              <option value="session">Each academic year</option>
              <option value="calendar">Each calendar year (Jan 1)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              {FREQUENCY_LABELS[value.resetFrequency]?.desc}
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="nextSequence"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Next sequence
            </label>
            <input
              id="nextSequence"
              aria-label="Next sequence"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
              type="number"
              min="1"
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
            <p className="text-[11px] text-slate-400">
              The number assigned to the next new student.
            </p>
          </div>
        </div>

        {/* Safety Confirmation Card */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Confirm Starting Number</span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            To prevent accidental skips or duplicate student IDs, please re-type your starting number below to confirm.
          </p>
          <div className="space-y-2 max-w-sm">
            <label
              htmlFor="confirmationSequence"
              className="block text-xs font-bold uppercase tracking-wider text-amber-900"
            >
              Confirm next sequence
            </label>
            <div className="flex items-center gap-2">
              <input
                id="confirmationSequence"
                aria-label="Confirm next sequence"
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-mono font-bold placeholder:text-slate-400 focus:outline-none transition-all ${
                  isConfirmationMatching
                    ? "border-emerald-300 bg-white text-emerald-950 focus:border-emerald-500"
                    : "border-amber-300 bg-white text-slate-900 focus:border-amber-600"
                }`}
                type="number"
                min="1"
                max="999999999"
                step="1"
                required
                placeholder={`Enter ${value.currentSequence} to confirm`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            {isConfirmationMatching && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 pt-0.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>Confirmed: Starting number verified as #{value.currentSequence}</span>
              </p>
            )}
          </div>
        </div>

        {/* State Mismatch Alert */}
        {(value.expectedVersion !== data.version ||
          value.expectedCounterVersion !==
            (data.branchCounter?.configVersion ?? 0)) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Policy or counter was updated in another tab. Click Discard below to load the latest.</span>
          </div>
        )}

        {/* Save Footer */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || data.sessionYear === null}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save prospective policy</span>
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setDraft(null);
                setConfirmation("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span>Discard / load latest</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            This saves your numbering format for upcoming student admissions. Existing students keep their current ID numbers.
          </p>
        </div>
      </form>

      {/* Section 2: Custom Counters for Specific Sections */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Grade-Level & Custom Counters (Optional)
              </h2>
              <p className="text-[11px] text-slate-500">
                Create dedicated number sequences if specific levels (like Nursery or High School) need separate counters.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || !data.policy}
              onClick={() =>
                void run(
                  () =>
                    setDefaultSequence({
                      schoolId,
                      key: null,
                      expectedPolicyVersion: data.version,
                    }),
                  "Main campus counter selected as default.",
                )
              }
              title={
                !data.policy
                  ? "Save the main numbering policy first before setting a default"
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>Use main counter as default</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSequenceDraft({
                  key: "",
                  name: "",
                  level: "",
                  currentSequence: 1,
                  resetFrequency: "continuous",
                  status: "active",
                  expectedConfigVersion: 0,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-all cursor-pointer shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add custom counter</span>
            </button>
          </div>
        </div>

        {/* Sequence List / Cards */}
        {data.sequences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <Layers className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-600">
              No section-specific counters configured
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 max-w-sm mx-auto">
              All students currently draw from the main counter above. Add a counter if you want separate numbering for specific grades or sections.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {data.sequences.map((sequence) => (
              <div
                key={sequence.key}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {sequence.name}
                    </span>
                    <code className="rounded-md bg-slate-200/80 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                      {sequence.key}
                    </code>
                    {sequence.level ? (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200/60">
                        Level: {sequence.level}
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                        Campus Wide
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        sequence.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          sequence.status === "active"
                            ? "bg-emerald-500"
                            : "bg-amber-500"
                        }`}
                      />
                      {sequence.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      Next:{" "}
                      <strong className="font-mono text-slate-900">
                        #{sequence.currentSequence}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>Reset: {sequence.resetFrequency}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      setSequenceDraft({
                        key: sequence.key,
                        name: sequence.name,
                        level: sequence.level ?? "",
                        currentSequence: sequence.currentSequence,
                        resetFrequency: sequence.resetFrequency as Frequency,
                        status: sequence.status as Status,
                        expectedConfigVersion: sequence.configVersion,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="h-3 w-3 text-slate-500" />
                    <span>Edit</span>
                  </button>

                  {!sequence.level && (
                    <button
                      type="button"
                      disabled={pending || !data.policy}
                      onClick={() =>
                        void run(
                          () =>
                            setDefaultSequence({
                              schoolId,
                              key: sequence.key,
                              expectedPolicyVersion: data.version,
                            }),
                          `Default sequence set to ${sequence.name}.`,
                        )
                      }
                      title={
                        !data.policy
                          ? "Save the main numbering policy first before setting a default"
                          : undefined
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                    >
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Set as default</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () =>
                          archiveSequence({
                            schoolId,
                            key: sequence.key,
                            expectedConfigVersion: sequence.configVersion,
                          }),
                        `Archived sequence ${sequence.name}.`,
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer shadow-2xs"
                  >
                    <Archive className="h-3 w-3" />
                    <span>Archive</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drawer: Add / Edit Named Sequence */}
        {sequenceDraft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  configureSequence({
                    schoolId,
                    key: sequenceDraft.key,
                    name: sequenceDraft.name,
                    level: sequenceDraft.level || undefined,
                    currentSequence: sequenceDraft.currentSequence,
                    confirmedNextSequence: sequenceDraft.currentSequence,
                    resetFrequency: sequenceDraft.resetFrequency,
                    status: sequenceDraft.status,
                    expectedConfigVersion: sequenceDraft.expectedConfigVersion,
                  }),
                `Saved counter ${sequenceDraft.name}.`,
              );
            }}
            className="rounded-xl border border-indigo-100 bg-slate-50/70 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                {sequenceDraft.expectedConfigVersion === 0
                  ? "Add Custom Counter"
                  : `Edit Counter (${sequenceDraft.name})`}
              </h3>
              <button
                type="button"
                onClick={() => setSequenceDraft(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Unique Key
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  placeholder="e.g. primary_main"
                  required
                  value={sequenceDraft.key}
                  onChange={(e) =>
                    setSequenceDraft({ ...sequenceDraft, key: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Display Name
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  placeholder="e.g. Primary Section"
                  required
                  value={sequenceDraft.name}
                  onChange={(e) =>
                    setSequenceDraft({ ...sequenceDraft, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Level Code (Optional)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  placeholder="e.g. Primary (leave empty for all)"
                  value={sequenceDraft.level}
                  onChange={(e) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      level: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Next Number
                </label>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={sequenceDraft.currentSequence}
                  onChange={(e) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      currentSequence: Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Reset Rule
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  value={sequenceDraft.resetFrequency}
                  onChange={(e) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      resetFrequency: e.target.value as Frequency,
                    })
                  }
                >
                  <option value="continuous">Continuous</option>
                  <option value="session">Academic session</option>
                  <option value="calendar">Calendar year</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Status
                </label>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  value={sequenceDraft.status}
                  onChange={(e) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      status: e.target.value as Status,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Save Counter
              </button>
              <button
                type="button"
                onClick={() => setSequenceDraft(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Section 3: Group Format Governance (Only if campus belongs to a school group) */}
      {data.governance?.groupId && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Multi-Campus Group Settings
              </h2>
              <p className="text-[11px] text-slate-500">
                Manage shared group formatting across campuses.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
            Mode: <strong className="text-slate-900">{data.governance.mode}</strong> (Group v
            {data.governance.groupVersion}, Campus rev {data.governance.branchRevision}).
            Only the pattern template is shared; numbers and counters remain unique to each campus.
          </div>

          <div className="space-y-1.5 max-w-sm">
            <label
              htmlFor="groupConfirmation"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              Confirmation slug
            </label>
            <input
              id="groupConfirmation"
              aria-label="Confirmation slug"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. branch or group slug"
              value={groupConfirmation}
              onChange={(event) => setGroupConfirmation(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={pending || !data.governance.groupSlug}
              onClick={() =>
                void run(
                  () =>
                    publishGroupFormat({
                      schoolId,
                      groupId: data.governance!.groupId!,
                      expectedGroupVersion: data.governance!.groupVersion,
                      allowBranchOverride: true,
                      confirmation: groupConfirmation,
                    }),
                  "Group format published from this campus; counters unchanged.",
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              Publish campus format as group default
            </button>

            {(["inherit", "override"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                disabled={pending || !data.governance?.branchSlug}
                onClick={() =>
                  void run(
                    () =>
                      setFormatInheritance({
                        schoolId,
                        groupId: data.governance!.groupId!,
                        mode,
                        expectedGroupVersion: data.governance!.groupVersion,
                        expectedRevision: data.governance!.branchRevision,
                        confirmation: groupConfirmation,
                      }),
                    `Campus format set to ${mode}; counters unchanged.`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Use {mode === "inherit" ? "group format" : "local campus format"}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
