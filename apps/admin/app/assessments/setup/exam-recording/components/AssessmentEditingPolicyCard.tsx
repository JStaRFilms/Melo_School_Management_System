"use client";

import type { ChangeEvent } from "react";
import type { AssessmentEditingPolicyDraft } from "./assessmentEditingPolicyDraft";
import type { SelectorOption } from "@/types";

interface AssessmentEditingPolicyCardProps {
  draft: AssessmentEditingPolicyDraft;
  sessions: SelectorOption[];
  terms: SelectorOption[];
  isLoadingSessions: boolean;
  isLoadingTerms: boolean;
  onSessionChange: (sessionId: string) => void;
  onTermChange: (termId: string) => void;
  onToggleChange: (value: boolean) => void;
  onDateChange: (
    field: "editingStartsAt" | "editingEndsAt",
    value: string
  ) => void;
}

function handleCheckedChange(
  event: ChangeEvent<HTMLInputElement>,
  callback: (value: boolean) => void
) {
  callback(event.target.checked);
}

export function AssessmentEditingPolicyCard({
  draft,
  sessions,
  terms,
  isLoadingSessions,
  isLoadingTerms,
  onSessionChange,
  onTermChange,
  onToggleChange,
  onDateChange,
}: AssessmentEditingPolicyCardProps) {
  const isTargetReady = Boolean(draft.sessionId && draft.termId);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="section-heading">2. Editing Control</h2>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Session
            </span>
            <select
              value={draft.sessionId ?? ""}
              onChange={(event) => onSessionChange(event.target.value)}
              disabled={isLoadingSessions || sessions.length === 0}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Term
            </span>
            <select
              value={draft.termId ?? ""}
              onChange={(event) => onTermChange(event.target.value)}
              disabled={!draft.sessionId || isLoadingTerms || terms.length === 0}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">Select term</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs font-medium leading-6 text-slate-600">
          Pick the session and term that this rule should govern. The selected
          rule affects both teacher and admin score entry, and the server
          enforces it even if someone tries to bypass the UI.
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Restrict exam editing
              </h3>
              <p className="text-xs leading-5 text-slate-500">
                Turn this on to stop edits after a chosen cutoff. You can
                optionally add a start time if editing should open later.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              <input
                type="checkbox"
                checked={draft.restrictionsEnabled}
                disabled={!isTargetReady}
                onChange={(event) =>
                  handleCheckedChange(event, onToggleChange)
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              Enabled
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Editing Opens
              </span>
              <input
                type="datetime-local"
                value={draft.editingStartsAt}
                disabled={!draft.restrictionsEnabled || !isTargetReady}
                onChange={(event) =>
                  onDateChange("editingStartsAt", event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              <p className="text-[11px] text-slate-500">
                Optional. Leave blank to let editing start immediately.
              </p>
            </label>

            <label className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Editing Stops
              </span>
              <input
                type="datetime-local"
                value={draft.editingEndsAt}
                disabled={!draft.restrictionsEnabled || !isTargetReady}
                onChange={(event) =>
                  onDateChange("editingEndsAt", event.target.value)
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              <p className="text-[11px] text-slate-500">
                Required when editing restrictions are enabled.
              </p>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
