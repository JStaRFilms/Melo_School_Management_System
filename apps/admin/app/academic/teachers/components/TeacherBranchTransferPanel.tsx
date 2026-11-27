"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRightLeft } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";

interface TeacherBranchTransferPanelProps {
  teacherId: Id<"users">;
  schoolId?: Id<"schools">;
  onCompleted?: () => void;
}

export function TeacherBranchTransferPanel({
  teacherId,
  schoolId,
  onCompleted,
}: TeacherBranchTransferPanelProps) {
  const eligible = useQuery(
    api.functions.academic.staffTransfers.listEligibleTransferBranches,
    { schoolId },
  );
  const preflight = useQuery(
    api.functions.academic.staffTransfers.getTeacherTransferPreflight,
    eligible?.inGroup ? { teacherId, schoolId } : "skip",
  );
  const initiateTransfer = useMutation(
    api.functions.academic.staffTransfers.initiateTeacherBranchTransfer,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [destinationSchoolId, setDestinationSchoolId] = useState<string>("");
  const [mode, setMode] = useState<"permanent_move" | "shared_assignment">("permanent_move");
  const [handoffMode, setHandoffMode] = useState<"reassign" | "unassign_confirmed">("reassign");
  const [replacementTeacherId, setReplacementTeacherId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!eligible?.inGroup || eligible.branches.length === 0) {
    return null;
  }

  const availableBranches = eligible.branches.filter((branch) => {
    if (mode === "shared_assignment" && preflight?.activeBranchIds.includes(branch.schoolId)) {
      return false;
    }
    return !preflight?.pendingDestinationIds.includes(branch.schoolId);
  });

  const selectedBranch = availableBranches.find((b) => b.schoolId === destinationSchoolId);
  const blockers = preflight?.activeAssignmentBlockers ?? [];
  const needsHandoff = mode === "permanent_move" && blockers.length > 0;

  const handleSubmit = async () => {
    if (!selectedBranch || isSubmitting) return;
    if (needsHandoff && handoffMode === "reassign" && !replacementTeacherId) {
      appToast.error("Replacement required", {
        description: "Choose a teacher to take over active classes, or confirm unassigning them.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await initiateTransfer({
        sourceSchoolId: schoolId,
        destinationSchoolId: selectedBranch.schoolId,
        teacherId,
        mode,
        reason: reason.trim() || undefined,
        assignmentHandoff: needsHandoff
          ? handoffMode === "reassign"
            ? {
                mode: "reassign",
                replacementTeacherId: replacementTeacherId as Id<"users">,
              }
            : { mode: "unassign_confirmed" }
          : { mode: "none" },
      });

      if (result.status === "completed") {
        appToast.success(
          mode === "permanent_move" ? "Teacher moved" : "Branch access added",
          {
            description:
              mode === "permanent_move"
                ? result.preservedParentAccess
                  ? `Moved to ${selectedBranch.name}. Parent portal access in this branch stays active.`
                  : `Moved to ${selectedBranch.name}.`
                : `Teacher can now switch between this branch and ${selectedBranch.name}.`,
          },
        );
        setIsOpen(false);
        setDestinationSchoolId("");
        setReason("");
        onCompleted?.();
      } else {
        appToast.success("Transfer requested", {
          description: `Waiting for an admin at ${selectedBranch.name} to accept.`,
        });
        setIsOpen(false);
        setDestinationSchoolId("");
        setReason("");
      }
    } catch (error) {
      appToast.error("Transfer failed", {
        description: getUserFacingErrorMessage(error, "Could not process branch transfer."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-4 border-t border-slate-100 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Group Branches
          </p>
          <p className="text-[11px] text-slate-400 font-medium">
            Move or share within {eligible.groupName}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowRightLeft className="h-3 w-3" />
          {isOpen ? "Close" : "Move / Share"}
        </button>
      </div>

      {isOpen && preflight && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-3">
          {!preflight.canonicalReady ? (
            <p className="text-xs text-amber-800">
              This teacher must accept an invitation or complete account linking before moving across branches.
            </p>
          ) : availableBranches.length === 0 ? (
            <p className="text-xs text-slate-600">
              No other eligible branches are available for this action.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-200/60 p-1">
                <button
                  type="button"
                  onClick={() => setMode("permanent_move")}
                  className={`rounded-md py-1.5 text-[11px] font-semibold transition ${
                    mode === "permanent_move"
                      ? "bg-white text-slate-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Permanent move
                </button>
                <button
                  type="button"
                  onClick={() => setMode("shared_assignment")}
                  className={`rounded-md py-1.5 text-[11px] font-semibold transition ${
                    mode === "shared_assignment"
                      ? "bg-white text-slate-950 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Teach at both
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Destination branch
                </label>
                <select
                  value={destinationSchoolId}
                  onChange={(e) => setDestinationSchoolId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-slate-950"
                >
                  <option value="">Select branch…</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.schoolId} value={branch.schoolId}>
                      {branch.name}
                      {branch.canCompleteDirectly ? "" : " (requires destination approval)"}
                    </option>
                  ))}
                </select>
              </div>

              {mode === "permanent_move" && preflight.hasActiveFamilyLinks && (
                <p className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[11px] text-sky-900">
                  This teacher is also linked as a parent here. Moving them permanently removes teacher access in this branch while keeping their Family Portal access.
                </p>
              )}

              {needsHandoff && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-2">
                  <p className="text-[11px] font-semibold text-amber-950">
                    Active assignments ({blockers.length}): {blockers.slice(0, 3).join(", ")}
                    {blockers.length > 3 ? ` +${blockers.length - 3} more` : ""}
                  </p>
                  <div className="space-y-1.5 text-[11px] text-amber-950">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="teacher-handoff"
                        checked={handoffMode === "reassign"}
                        onChange={() => setHandoffMode("reassign")}
                      />
                      <span>Reassign active classes and subjects to another teacher</span>
                    </label>
                    {handoffMode === "reassign" && (
                      <select
                        value={replacementTeacherId}
                        onChange={(e) => setReplacementTeacherId(e.target.value)}
                        className="h-8 w-full rounded-lg border border-amber-300 bg-white px-2 text-xs text-slate-900"
                      >
                        <option value="">Choose replacement…</option>
                        {preflight.replacementTeachers.map((candidate) => (
                          <option key={candidate.userId} value={candidate.userId}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="teacher-handoff"
                        checked={handoffMode === "unassign_confirmed"}
                        onChange={() => setHandoffMode("unassign_confirmed")}
                      />
                      <span>Leave unassigned for now (past records stay intact)</span>
                    </label>
                  </div>
                </div>
              )}

              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-slate-950"
              />

              <button
                type="button"
                disabled={!selectedBranch || isSubmitting}
                onClick={() => void handleSubmit()}
                className="w-full h-9 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {isSubmitting
                  ? "Saving…"
                  : selectedBranch?.canCompleteDirectly
                    ? mode === "permanent_move"
                      ? `Move to ${selectedBranch.name}`
                      : `Share with ${selectedBranch.name}`
                    : selectedBranch
                      ? `Request transfer to ${selectedBranch.name}`
                      : "Select a branch"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
