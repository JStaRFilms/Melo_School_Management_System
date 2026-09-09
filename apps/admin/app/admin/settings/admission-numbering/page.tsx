"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { SettingsNavigationTabs } from "../components/SettingsNavigationTabs";
import {
  Hash,
  Sparkles,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
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
    desc: "Monotonically increases without resetting across years",
  },
  session: {
    label: "Academic Session",
    desc: "Resets to 1 automatically upon starting a new academic year",
  },
  calendar: {
    label: "Calendar Year (UTC)",
    desc: "Resets to 1 automatically on January 1st",
  },
};

const TOKENS = [
  { token: "{SCHOOL}", label: "School Code", desc: "e.g. MCA" },
  { token: "{CAMPUS}", label: "Campus Code", desc: "e.g. MAIN" },
  { token: "{LEVEL}", label: "Level", desc: "e.g. PRI, SEC" },
  { token: "{YEAR}", label: "Session Year", desc: "e.g. 2026" },
  { token: "{SEQ:4}", label: "Sequence (4-digit)", desc: "e.g. 0001" },
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

  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [sequenceDraft, setSequenceDraft] = useState<SequenceDraft | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [groupConfirmation, setGroupConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setPending(true);
    setMessage("");
    setIsSuccess(false);
    try {
      await operation();
      setDraft(null);
      setSequenceDraft(null);
      setConfirmation("");
      setGroupConfirmation("");
      setMessage(success);
      setIsSuccess(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Save failed; retry.",
      );
      setIsSuccess(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="space-y-5 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Admission Numbering Policy
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define student ID format patterns, sequential counter rules, and multi-campus numbering schemas.
          </p>
        </div>
        <SettingsNavigationTabs />
      </div>

      {/* System Architecture Context Banner */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">Branch Counter Governance</h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Every counter belongs to this branch. Level counters take precedence;
              otherwise the selected branch default applies. Group inheritance can
              change only the format, never merge branch counters. Existing IDs never
              change and gaps may occur.
            </p>
          </div>
        </div>
      </div>

      {/* Status Warning Banners */}
      {!data.policy && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-2xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-xs">
            <p className="font-bold">No Policy Configured</p>
            <p className="mt-0.5 text-amber-700">
              No policy configured. Enter explicit school and branch codes and review the next number.
            </p>
          </div>
        </div>
      )}

      {data.sessionYear === null && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-2xs"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="text-xs">
            <p className="font-bold">Academic Session Required</p>
            <p className="mt-0.5 text-rose-700">
              One active academic session is required before saving or allocating.
            </p>
          </div>
        </div>
      )}

      {/* Toast / Status Banner */}
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

      {/* Form 1: Branch Format and Default Counter */}
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
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6"
      >
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Branch format and default counter
              </h2>
              <p className="text-[11px] text-slate-500">
                Configure primary branch numbering format and sequential progression.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Format: {data.formatSource.toUpperCase()} {data.formatVersion ? `v${data.formatVersion}` : "(Local)"}
            </span>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-slate-50 p-4.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-indigo-700 uppercase">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                <span>Live Generated Preview</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold tracking-tight text-indigo-950">
                  {preview}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 break-all">
                Effective format ({data.formatSource},{" "}
                {data.formatVersion ?? "not configured"}):{" "}
                <code className="font-mono text-slate-800 font-semibold">{data.effectiveFormat ?? value.pattern}</code>
                . Illustrative preview:{" "}
                <code className="font-mono text-indigo-700 font-semibold">{preview}</code>
                . LEVEL comes from the selected class. Nothing is reserved here.
              </p>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-indigo-100/80 pt-2 sm:pt-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Next In Line
              </span>
              <span className="font-mono text-sm font-bold text-slate-900 bg-white border border-slate-200/80 px-2.5 py-1 rounded-lg shadow-2xs">
                #{String(value.currentSequence).padStart(4, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Inputs: School Code, Campus Code, Pattern */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. MCA"
              required
              value={value.schoolCode}
              onChange={(event) =>
                setDraft({ ...value, schoolCode: event.target.value })
              }
            />
            <p className="text-[11px] text-slate-400">
              Short institution abbreviation (e.g. MCA, OXF, SCH).
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              placeholder="e.g. MAIN"
              required
              value={value.campusCode}
              onChange={(event) =>
                setDraft({ ...value, campusCode: event.target.value })
              }
            />
            <p className="text-[11px] text-slate-400">
              Branch or campus location identifier (e.g. MAIN, NORTH, ANNEX).
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor="pattern"
              className="block text-xs font-bold uppercase tracking-wider text-slate-600"
            >
              pattern
            </label>
            <input
              id="pattern"
              aria-label="pattern"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              required
              value={value.pattern}
              onChange={(event) =>
                setDraft({ ...value, pattern: event.target.value })
              }
            />

            {/* Token Selector Pills */}
            <div className="pt-1.5 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Tag className="h-3 w-3 text-slate-400" />
                <span>Insert token:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TOKENS.map(({ token, desc }) => (
                  <button
                    type="button"
                    key={token}
                    onClick={() =>
                      setDraft({ ...value, pattern: value.pattern + token })
                    }
                    title={desc}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-700 transition-all cursor-pointer shadow-2xs"
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
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
              <option value="active">Active (Incrementing)</option>
              <option value="paused">Paused (Counter Frozen)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              When paused, automatic admission allocations for this counter are held.
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
              <option value="continuous">Continuous</option>
              <option value="session">Academic session</option>
              <option value="calendar">Calendar year (UTC)</option>
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
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
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
              Next sequential number to be issued for student enrollment.
            </p>
          </div>
        </div>

        {/* Guardrail: Confirmation input */}
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-4.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <ShieldCheck className="h-4 w-4 text-amber-600" />
            <span>Sequence Alteration Confirmation Guard</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800">
            To prevent accidental sequence resets or duplicate student IDs, you must confirm the desired sequence value before prospective policy changes can take effect.
          </p>
          <div className="space-y-1.5 max-w-sm">
            <label
              htmlFor="confirmationSequence"
              className="block text-xs font-bold uppercase tracking-wider text-amber-900"
            >
              Confirm next sequence
            </label>
            <input
              id="confirmationSequence"
              aria-label="Confirm next sequence"
              className="w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none"
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
        </div>

        {/* State Mismatch Alert */}
        {(value.expectedVersion !== data.version ||
          value.expectedCounterVersion !==
            (data.branchCounter?.configVersion ?? 0)) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>Policy or counter changed. Discard and review latest.</span>
          </div>
        )}

        {/* Save Footer */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending || data.sessionYear === null}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
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
      </form>

      {/* Section 2: Named Branch and Level Sequences */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Named branch and level sequences
              </h2>
              <p className="text-[11px] text-slate-500">
                A sequence without a level can become the branch default. One active
                or paused sequence may target each normalized level.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void run(
                  () =>
                    setDefaultSequence({
                      schoolId,
                      key: null,
                      expectedPolicyVersion: data.version,
                    }),
                  "Legacy branch counter selected as default.",
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
              <span>Use legacy branch counter as default</span>
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
              <span>Add named sequence</span>
            </button>
          </div>
        </div>

        {/* Sequence List / Cards */}
        {data.sequences.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <Layers className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-600">
              No named sequences configured
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 max-w-sm mx-auto">
              All student enrollments currently draw from the primary branch counter. Add a named sequence to segment numbering by academic level.
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
                        Branch Wide
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
                      {sequence.status}
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
                    <span>•</span>
                    <span>Config rev: {sequence.configVersion}</span>
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
                        resetFrequency: sequence.resetFrequency,
                        status: sequence.status === "paused" ? "paused" : "active",
                        expectedConfigVersion: sequence.configVersion,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Edit3 className="h-3 w-3 text-slate-400" />
                    <span>Edit</span>
                  </button>

                  {!sequence.level && (
                    <button
                      type="button"
                      disabled={pending}
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
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Check className="h-3 w-3 text-slate-400" />
                      <span>Set branch default</span>
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
                        `Sequence ${sequence.name} archived; old IDs unchanged.`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Archive className="h-3 w-3 text-rose-500" />
                    <span>Archive</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Sequence Drawer/Card */}
        {sequenceDraft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  configureSequence({
                    schoolId,
                    ...sequenceDraft,
                    level: sequenceDraft.level || undefined,
                    confirmedNextSequence: Number(confirmation),
                  }),
                `Sequence ${sequenceDraft.name} saved.`,
              );
            }}
            className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                <Edit3 className="h-4 w-4 text-indigo-600" />
                <span>
                  {sequenceDraft.expectedConfigVersion > 0
                    ? `Edit Sequence: ${sequenceDraft.name}`
                    : "Create Named Sequence"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSequenceDraft(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="seqKey"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  key
                </label>
                <input
                  id="seqKey"
                  aria-label="key"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono font-medium text-slate-900 read-only:bg-slate-100 read-only:text-slate-500 focus:border-indigo-600 focus:outline-none"
                  required
                  placeholder="e.g. primary_sequence"
                  value={sequenceDraft.key}
                  readOnly={sequenceDraft.expectedConfigVersion > 0}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      key: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="seqName"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  name
                </label>
                <input
                  id="seqName"
                  aria-label="name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  required
                  placeholder="e.g. Primary School Admissions"
                  value={sequenceDraft.name}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      name: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="seqLevel"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  level
                </label>
                <input
                  id="seqLevel"
                  aria-label="level"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  placeholder="Optional: e.g. Primary, Secondary"
                  value={sequenceDraft.level}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      level: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="seqStatus"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Status
                </label>
                <select
                  id="seqStatus"
                  aria-label="Status"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  value={sequenceDraft.status}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      status: event.target.value as Status,
                    })
                  }
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="seqReset"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Reset
                </label>
                <select
                  id="seqReset"
                  aria-label="Reset"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                  value={sequenceDraft.resetFrequency}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      resetFrequency: event.target.value as Frequency,
                    })
                  }
                >
                  <option value="continuous">Continuous</option>
                  <option value="session">Academic session</option>
                  <option value="calendar">Calendar year (UTC)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="seqCurrentSequence"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Next sequence
                </label>
                <input
                  id="seqCurrentSequence"
                  aria-label="Next sequence"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                  type="number"
                  min="1"
                  step="1"
                  value={sequenceDraft.currentSequence}
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      currentSequence: Number(event.target.value),
                    })
                  }
                />
              </div>

              <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                Enter the same value in “Confirm next sequence” above before saving.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Save named sequence</span>
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() => setSequenceDraft(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Section 3: Group Format Governance */}
      {data.governance?.groupId && (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Group format governance
              </h2>
              <p className="text-[11px] text-slate-500">
                Manage group-level numbering inheritance and centralized format templates.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed">
            Mode <strong className="text-slate-900">{data.governance.mode}</strong>; group version{" "}
            <strong className="text-slate-900">{data.governance.groupVersion}</strong>; branch revision{" "}
            <strong className="text-slate-900">{data.governance.branchRevision}</strong>. Only the pattern is inherited.
            Codes and every sequence remain branch-owned.
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
                  "Group format published from this branch; counters unchanged.",
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              Publish local format as group default
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
                    `Branch format set to ${mode}; counters unchanged.`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
              >
                Use {mode === "inherit" ? "group format" : "local format"}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">
            Publishing requires the group slug (
            {data.governance.groupSlug ?? "unavailable"}); branch choice
            requires the branch slug (
            {data.governance.branchSlug ?? "unavailable"}).
          </p>
        </section>
      )}
    </main>
  );
}
