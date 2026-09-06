"use client";

import { useId } from "react";

export type AdmissionCounterDecision = "keep" | "advance" | "";

interface AdmissionNumberGovernanceFieldsProps {
  canOverride: boolean;
  confirmed: boolean;
  reason: string;
  counterDecision: AdmissionCounterDecision;
  advanceCounterTo: string;
  policyConfigured: boolean;
  onConfirmedChange: (value: boolean) => void;
  onReasonChange: (value: string) => void;
  onCounterDecisionChange: (value: AdmissionCounterDecision) => void;
  onAdvanceCounterToChange: (value: string) => void;
}

export function AdmissionNumberGovernanceFields({
  canOverride,
  confirmed,
  reason,
  counterDecision,
  advanceCounterTo,
  policyConfigured,
  onConfirmedChange,
  onReasonChange,
  onCounterDecisionChange,
  onAdvanceCounterToChange,
}: AdmissionNumberGovernanceFieldsProps) {
  const counterDecisionName = useId();

  if (!canOverride) {
    return (
      <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
        Changing or supplying a manual admission number requires the Override Admission Number permission.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-xs font-bold text-amber-950">Manual admission-number override</p>
      <label className="block space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
          Audit reason
        </span>
        <textarea
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          minLength={8}
          maxLength={240}
          required
          className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm text-slate-900 outline-none focus:border-amber-600"
          placeholder="Explain why this manual or historical number is required"
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
          Advance automatic counter to follow this override value?
        </legend>
        <label className="flex items-start gap-2 text-xs font-medium text-amber-950">
          <input
            type="radio"
            name={counterDecisionName}
            checked={counterDecision === "keep"}
            onChange={() => onCounterDecisionChange("keep")}
          />
          No, keep the automatic counter unchanged
        </label>
        <label className="flex items-start gap-2 text-xs font-medium text-amber-950">
          <input
            type="radio"
            name={counterDecisionName}
            checked={counterDecision === "advance"}
            disabled={!policyConfigured}
            onChange={() => onCounterDecisionChange("advance")}
          />
          Yes, set an explicit next sequence
        </label>
        {!policyConfigured && (
          <p className="text-[11px] text-amber-800">
            No automatic policy exists, so the explicit decision must leave the counter unchanged.
          </p>
        )}
      </fieldset>
      {counterDecision === "advance" && (
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
            Exact next sequence
          </span>
          <input
            type="number"
            min={1}
            max={999999999}
            step={1}
            value={advanceCounterTo}
            onChange={(event) => onAdvanceCounterToChange(event.target.value)}
            required
            className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-amber-600"
          />
        </label>
      )}
      <label className="flex items-start gap-2 text-xs font-medium text-amber-950">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmedChange(event.target.checked)}
          required
        />
        I confirm this override, its reason, and the counter decision.
      </label>
    </div>
  );
}

export function hasCompleteAdmissionNumberOverride(args: {
  canOverride: boolean;
  confirmed: boolean;
  reason: string;
  counterDecision: AdmissionCounterDecision;
  advanceCounterTo: string;
}) {
  return Boolean(
    args.canOverride &&
      args.confirmed &&
      args.reason.trim().length >= 8 &&
      args.reason.trim().length <= 240 &&
      args.counterDecision &&
      (args.counterDecision === "keep" || Number(args.advanceCounterTo) > 0),
  );
}
