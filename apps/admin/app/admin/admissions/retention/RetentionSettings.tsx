"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAuth } from "@/AuthProvider";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { archiveDocumentManuallyRef, deleteDocumentManuallyRef, getManualDocumentEligibilityRef, getRetentionPolicyRef, setRetentionPolicyRef } from "@school/convex/functions/admissions/refs";
import { validateRetention } from "../admissions-model";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm transition placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100 disabled:text-slate-500";
const buttonClass = "inline-flex items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass = "inline-flex items-center justify-center rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 hover:border-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function RetentionSettings() {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const canRetain = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage") && hasEffectiveCapability(workspaceAccess, "enrollment.decisions.record");
  const policy = useQuery(getRetentionPolicyRef, schoolId && canRetain ? { schoolId } : "skip");
  const savePolicy = useMutation(setRetentionPolicyRef), archiveDocument = useMutation(archiveDocumentManuallyRef), deleteDocument = useMutation(deleteDocumentManuallyRef);
  const [documentKey, setDocumentKey] = useState(""), [checkedDocumentKey, setCheckedDocumentKey] = useState("");
  const eligibility = useQuery(getManualDocumentEligibilityRef, schoolId && canRetain && checkedDocumentKey ? { schoolId, documentKey: checkedDocumentKey } : "skip");
  const [mode, setMode] = useState<"never" | "archive">("never"), [days, setDays] = useState("30"), [feedback, setFeedback] = useState("Loading the current retention policy…"), [confirm, setConfirm] = useState(false), [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => { if (!policy) return; setMode(policy.mode); if (policy.archiveAfterDays) setDays(String(policy.archiveAfterDays)); setFeedback(`Current policy version ${policy.version}: ${policy.mode === "never" ? "never automatically archive" : `archive after ${policy.archiveAfterDays} days`}.`); }, [policy]);
  const error = validateRetention(mode, days);
  if (workspaceAccess?.state === "ready" && !canRetain) return <main className="p-6"><AdminHeader title="Retention access unavailable" description="Managing admissions retention requires both intake-management and decision-recording capabilities." /><Link className={secondaryButtonClass} href="/admin/admissions">Return to admissions</Link></main>;
  async function save() { if (!schoolId || !policy || error) return; try { const result = await savePolicy({ schoolId, mode, ...(mode === "archive" ? { archiveAfterDays: Number(days) } : {}), expectedVersion: policy.version }); setFeedback(`Retention policy version ${result.version} saved.`); appToast.success("Retention policy saved"); } catch (cause) { const text = cause instanceof Error ? cause.message : "Retention policy could not be saved."; setFeedback(text); appToast.error("Retention policy failed", { description: text }); } finally { setConfirm(false); } }
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
      <AdminHeader
        label="Admissions"
        title="Document retention"
        description="Configure prospective cleanup. Existing applications remain bound to the policy captured at their terminal outcome."
        actions={<Link className={secondaryButtonClass} href="/admin/admissions">Admissions</Link>}
      />
      <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">
        {feedback}
      </div>
      <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">Retention schedule</h2>
          <p className="text-xs sm:text-sm text-slate-500">Determine how submitted applicant documents are managed after terminal review decisions.</p>
        </div>
        <div className="space-y-3">
          <div
            onClick={() => setMode("never")}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${mode === "never" ? "border-sky-300 bg-sky-50/40" : "border-slate-200 bg-white hover:bg-slate-50/60"}`}
          >
            <input
              id="retention-never"
              type="radio"
              name="mode"
              className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={mode === "never"}
              onChange={() => setMode("never")}
            />
            <span>
              <label htmlFor="retention-never" className="cursor-pointer text-sm font-bold text-slate-900">Never automatically archive</label>
              <span className="block text-xs sm:text-sm text-slate-600 mt-0.5">Documents remain available unless a later prospective policy makes a terminal application eligible.</span>
            </span>
          </div>
          <div
            onClick={() => setMode("archive")}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${mode === "archive" ? "border-sky-300 bg-sky-50/40" : "border-slate-200 bg-white hover:bg-slate-50/60"}`}
          >
            <input
              id="retention-archive"
              type="radio"
              name="mode"
              className="mt-1 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={mode === "archive"}
              onChange={() => setMode("archive")}
            />
            <span className="min-w-0 flex-1">
              <label htmlFor="retention-archive" className="cursor-pointer text-sm font-bold text-slate-900">Archive after a delay</label>
              <span className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
                <label htmlFor="retention-days" className="font-medium text-slate-700">Archive delay in days</label>
                <input
                  id="retention-days"
                  aria-describedby="retention-delay-help"
                  className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  type="number"
                  min="30"
                  step="1"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                />
                <span id="retention-delay-help" className="text-slate-500">days after an eligible terminal outcome. Permanently delete only 30 days after archive.</span>
              </span>
            </span>
          </div>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs sm:text-sm font-semibold text-rose-700">{error}</p> : null}
        <div className="pt-2">
          <button className={buttonClass} disabled={!policy || Boolean(error)} onClick={() => setConfirm(true)}>
            Save policy
          </button>
        </div>
      </AdminSurface>
      <AdminSurface as="section" className="space-y-4 p-4 sm:p-5">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="font-display text-lg font-bold text-slate-900">Storage and manual safety</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">Admissions uploads use the school’s general provisioned storage quota. This page does not provision storage or purchase additional quota.</p>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">Manual archive and permanent-delete controls appear only when the backend confirms that document is eligible. Holds, pending workflows, incomplete conversion, retained photo provenance, policy timing, and storage-accounting checks can block the action.</p>
        </div>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setCheckedDocumentKey(documentKey.trim()); }}>
          <label className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-slate-700">
            Document key
            <input className={`${inputClass} mt-1`} required value={documentKey} onChange={(event) => setDocumentKey(event.target.value)} placeholder="Enter document key to check eligibility" />
          </label>
          <button className={secondaryButtonClass}>Check eligibility</button>
        </form>
        {eligibility ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-sm space-y-2.5">
            <p className="text-slate-700">Current state: <strong className="font-semibold text-slate-950">{eligibility.state}</strong></p>
            <div className="flex flex-wrap items-center gap-2">
              {eligibility.canArchive ? (
                <button className={buttonClass} onClick={() => { if (!schoolId) return; void archiveDocument({ schoolId, documentKey: checkedDocumentKey }).then((result) => setFeedback(result.changed ? "Eligible document archived." : `Archive blocked: ${result.blocker}`)); }}>
                  Archive document
                </button>
              ) : null}
              {eligibility.canDelete ? (
                <button className={dangerButtonClass} onClick={() => setDeleteConfirm(true)}>
                  Permanently delete document
                </button>
              ) : null}
            </div>
            {!eligibility.canArchive && !eligibility.canDelete ? (
              <p className="text-xs text-slate-500">No manual control is available: {eligibility.archiveBlocker}; {eligibility.deleteBlocker}.</p>
            ) : null}
          </div>
        ) : checkedDocumentKey && eligibility === null ? (
          <p className="text-xs sm:text-sm text-slate-500">No document in this school matches that key.</p>
        ) : null}
      </AdminSurface>
      <ConfirmDialog open={confirm} title="Save retention policy?" description={mode === "never" ? "Automatic admissions document archival will remain disabled for future terminal outcomes." : `Eligible documents will archive ${days} days after the terminal outcome and may be permanently deleted 30 days after archive.`} confirmLabel="Save policy" onConfirm={() => void save()} onCancel={() => setConfirm(false)} />
      <ConfirmDialog open={deleteConfirm} title="Permanently delete this document?" description="The backend will recheck policy timing, holds, workflow state, canonical references, storage ownership, and quota provenance before deletion." confirmLabel="Permanently delete" onCancel={() => setDeleteConfirm(false)} onConfirm={() => { setDeleteConfirm(false); if (!schoolId) return; void deleteDocument({ schoolId, documentKey: checkedDocumentKey }).then((result) => setFeedback(result.changed ? "Eligible document permanently deleted." : `Delete blocked: ${result.blocker}`)).catch((error) => setFeedback(error instanceof Error ? error.message : "Delete failed.")); }} />
    </main>
  );
}
