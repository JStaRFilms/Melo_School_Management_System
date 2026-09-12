"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { AlertTriangle, CheckCircle2, HardDrive, Loader2, X } from "lucide-react";
import { getErrorMessage } from "@school/shared/toast";

const CONFIRMATION_PHRASE = "PROVISION FREE TRIAL STORAGE";
const DAY = 86_400_000;

type School = {
  _id: string;
  name: string;
};

type ProvisioningResult =
  | "created"
  | "already_configured"
  | "pool_exhausted"
  | "requires_review";

const resultMessages: Record<ProvisioningResult, string> = {
  created: "The 100 MiB free-trial storage entitlement was created.",
  already_configured: "This school already has the reviewed storage entitlement.",
  pool_exhausted: "The reviewed free-trial storage pool has no capacity left.",
  requires_review: "Existing commercial or storage history requires manual review.",
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMiB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function FreeTrialStorageModal({
  school,
  onClose,
}: {
  school: School;
  onClose: () => void;
}) {
  const schoolId = school._id as Id<"schools">;
  const storage = useQuery(
    api.functions.platform.index.getSchoolStorageProvisioningState,
    { schoolId },
  );
  const provision = useMutation(
    api.functions.platform.index.provisionSchoolFreeTrialStorage,
  );
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState<ProvisioningResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const proposedStart = Math.floor(Date.now() / DAY) * DAY;
  const proposedEnd = storage
    ? proposedStart + storage.proposal.durationDays * DAY
    : proposedStart;
  const canSubmit =
    storage?.school.status === "active" &&
    confirmation === CONFIRMATION_PHRASE &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await provision({ schoolId, confirmation });
      setResult(response.status);
    } catch (caught) {
      setError(getErrorMessage(caught, "Storage provisioning failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-trial-storage-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h2 id="free-trial-storage-title" className="text-base font-bold text-slate-950">
                Free-trial storage
              </h2>
              <p className="text-xs font-medium text-slate-500">{school.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close storage provisioning"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {storage === undefined ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading storage state...
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <section aria-label="Current storage state" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Current state</h3>
                <span className="text-xs font-bold text-slate-800">
                  {storage.recordState === "not_configured"
                    ? "Not configured"
                    : storage.recordState === "configured"
                      ? "Storage records found"
                      : "Requires review"}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <dt className="text-slate-500">School status</dt>
                <dd className="text-right font-semibold capitalize text-slate-800">{storage.school.status}</dd>
                <dt className="text-slate-500">Contract</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {storage.contract ? `${storage.contract.code} v${storage.contract.version}` : "None"}
                </dd>
                <dt className="text-slate-500">Cycle</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {storage.cycle ? `${storage.cycle.code} (${storage.cycle.status})` : "None"}
                </dd>
                <dt className="text-slate-500">Meter</dt>
                <dd className="text-right font-semibold text-slate-800">
                  {storage.meter
                    ? `${formatMiB(storage.meter.availableUnits)} available of ${formatMiB(storage.meter.allocatedUnits)}`
                    : "None"}
                </dd>
              </dl>
              {storage.cycle ? (
                <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                  Current period: {formatDate(storage.cycle.startAt)} to {formatDate(storage.cycle.endAt)} UTC
                </p>
              ) : null}
            </section>

            <section aria-label="Proposed storage allocation" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700">Proposed allocation</h3>
              <p className="mt-2 text-sm font-bold text-slate-950">
                {formatMiB(storage.proposal.allocatedUnits)} for {storage.proposal.durationDays} days
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatDate(proposedStart)} to {formatDate(proposedEnd)} UTC. Convex sets the final period when you submit.
              </p>
            </section>

            {storage.school.status !== "active" ? (
              <p role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Only an active school can receive this entitlement.
              </p>
            ) : null}

            <div>
              <label htmlFor="storage-confirmation" className="block text-xs font-bold text-slate-700">
                Type {CONFIRMATION_PHRASE} to confirm
              </label>
              <input
                id="storage-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            {result ? (
              <p role="status" className={`flex gap-2 rounded-xl border p-3 text-xs ${result === "created" || result === "already_configured" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {result === "created" || result === "already_configured" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                {resultMessages[result]}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
                {isSubmitting ? "Provisioning..." : "Provision storage"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
