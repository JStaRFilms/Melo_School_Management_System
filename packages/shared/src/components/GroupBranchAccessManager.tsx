"use client";

import { useMemo, useState } from "react";
import { UserMinus, UserPlus } from "lucide-react";

export interface GroupBranchOption {
  schoolId: string;
  name: string;
  slug: string;
  status: string;
}

export interface GroupStaffCandidate {
  personId: string;
  name: string;
  email: string;
  currentRole: "admin" | "teacher" | "staff";
  targetMembershipStatus: "suspended" | "archived" | null;
}

export interface GroupRoleTemplateOption {
  roleTemplateId: string;
  name: string;
  scope: "global" | "group" | "branch";
}

export interface GroupBranchStaffMember {
  personId: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "staff";
  displayTitle: string | null;
  isDefaultBranch: boolean;
  isProprietor: boolean;
  hasOtherBranch: boolean;
}

interface AssignmentInput {
  sourceSchoolId: string;
  targetSchoolId: string;
  personId: string;
  role: "admin" | "teacher" | "staff";
  roleTemplateId?: string;
  displayTitle?: string;
  confirmation: string;
}

interface RevocationInput {
  schoolId: string;
  personId: string;
  reason: string;
  confirmation: string;
}

interface Props {
  groupSlug: string;
  branches: GroupBranchOption[];
  candidates: GroupStaffCandidate[];
  roleTemplates: GroupRoleTemplateOption[];
  branchStaff: GroupBranchStaffMember[];
  candidatesLoading: boolean;
  branchStaffLoading: boolean;
  canLoadMoreCandidates: boolean;
  canLoadMoreStaff: boolean;
  pending: boolean;
  message?: { kind: "success" | "error"; text: string };
  onSelectionChange: (selection: {
    sourceSchoolId?: string;
    targetSchoolId?: string;
  }) => void;
  onAssign: (input: AssignmentInput) => Promise<boolean>;
  onRevoke: (input: RevocationInput) => Promise<boolean>;
  onLoadMoreCandidates: () => void;
  onLoadMoreStaff: () => void;
}

export function GroupBranchAccessManager({
  groupSlug,
  branches,
  candidates,
  roleTemplates,
  branchStaff,
  candidatesLoading,
  branchStaffLoading,
  canLoadMoreCandidates,
  canLoadMoreStaff,
  pending,
  message,
  onSelectionChange,
  onAssign,
  onRevoke,
  onLoadMoreCandidates,
  onLoadMoreStaff,
}: Props) {
  const [sourceSchoolId, setSourceSchoolId] = useState("");
  const [targetSchoolId, setTargetSchoolId] = useState("");
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<"admin" | "teacher" | "staff">("admin");
  const [roleTemplateId, setRoleTemplateId] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revokePersonId, setRevokePersonId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeConfirmation, setRevokeConfirmation] = useState("");

  const targetBranch = branches.find(
    (branch) => branch.schoolId === targetSchoolId,
  );
  const selectedCandidate = candidates.find(
    (candidate) => candidate.personId === personId,
  );
  const selectedRevocation = branchStaff.find(
    (member) => member.personId === revokePersonId,
  );
  const sourceBranches = useMemo(
    () => branches.filter((branch) => branch.schoolId !== targetSchoolId),
    [branches, targetSchoolId],
  );

  const updateSelection = (nextSourceSchoolId: string, nextTargetSchoolId: string) => {
    setSourceSchoolId(nextSourceSchoolId);
    setTargetSchoolId(nextTargetSchoolId);
    onSelectionChange({
      sourceSchoolId: nextSourceSchoolId || undefined,
      targetSchoolId: nextTargetSchoolId || undefined,
    });
    setPersonId("");
    setRoleTemplateId("");
    setConfirmation("");
    setRevokePersonId("");
    setRevokeReason("");
    setRevokeConfirmation("");
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-700">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">People &amp; branch access</h2>
          <p className="mt-1 text-sm text-slate-600">
            Give an existing group staff member access to another campus without
            creating a second login. Group links alone never grant tenant access.
          </p>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-lg border p-3 text-sm ${
            message.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Existing campus
          <select
            value={sourceSchoolId}
            onChange={(event) =>
              updateSelection(event.target.value, targetSchoolId)
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
          >
            <option value="">Select staff source</option>
            {sourceBranches.map((branch) => (
              <option key={branch.schoolId} value={branch.schoolId}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Destination campus
          <select
            value={targetSchoolId}
            onChange={(event) =>
              updateSelection(sourceSchoolId, event.target.value)
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
          >
            <option value="">Select destination</option>
            {branches.map((branch) => (
              <option key={branch.schoolId} value={branch.schoolId}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sourceSchoolId && targetBranch && (
        <form
          className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!selectedCandidate) return;
            const saved = await onAssign({
              sourceSchoolId,
              targetSchoolId,
              personId: selectedCandidate.personId,
              role,
              roleTemplateId: roleTemplateId || undefined,
              displayTitle: displayTitle.trim() || undefined,
              confirmation,
            });
            if (saved) {
              setPersonId("");
              setRoleTemplateId("");
              setDisplayTitle("");
              setConfirmation("");
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Existing group member
              <select
                required
                value={personId}
                onChange={(event) => setPersonId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
              >
                <option value="">
                  {candidatesLoading ? "Loading staff…" : "Select a person"}
                </option>
                {candidates.map((candidate) => (
                  <option key={candidate.personId} value={candidate.personId}>
                    {candidate.name} · {candidate.currentRole}
                    {candidate.targetMembershipStatus ? " · reactivate" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Branch account type
              <select
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "admin" | "teacher" | "staff")
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
              >
                <option value="admin">Administrator</option>
                <option value="staff">Staff</option>
                <option value="teacher">Teacher</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Permission role
              <select
                value={roleTemplateId}
                onChange={(event) => setRoleTemplateId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
              >
                <option value="">
                  {role === "admin"
                    ? "Default Principal permissions"
                    : role === "staff"
                      ? "Default Staff Administrator permissions"
                      : "Teacher access only"}
                </option>
                {roleTemplates.map((template) => (
                  <option
                    key={template.roleTemplateId}
                    value={template.roleTemplateId}
                  >
                    {template.name} · {template.scope}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Display title (optional)
              <input
                maxLength={100}
                value={displayTitle}
                onChange={(event) => setDisplayTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5"
                placeholder="e.g. Ruga Branch Administrator"
              />
            </label>
          </div>
          {selectedCandidate && (
            <p className="text-xs text-slate-600">
              Assigning {selectedCandidate.name} ({selectedCandidate.email}) to
              {" "}{targetBranch.name}. Their existing login remains unchanged.
            </p>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Type <span className="font-mono">{targetBranch.slug}</span> to confirm
            <input
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 font-mono"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                pending ||
                !selectedCandidate ||
                confirmation !== targetBranch.slug
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Grant branch access"}
            </button>
            {canLoadMoreCandidates && (
              <button type="button" onClick={onLoadMoreCandidates} className="text-sm underline">
                Load more candidates
              </button>
            )}
          </div>
        </form>
      )}

      {targetBranch && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Active staff in {targetBranch.name}
          </h3>
          {branchStaffLoading ? (
            <p className="mt-3 text-sm text-slate-500">Loading branch staff…</p>
          ) : branchStaff.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No active staff found.</p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border border-slate-200">
              {branchStaff.map((member) => (
                <li key={member.personId} className="p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                      <p className="text-xs text-slate-500">
                        {member.email} · {member.displayTitle ?? member.role}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={
                        member.isProprietor ||
                        member.isDefaultBranch ||
                        !member.hasOtherBranch
                      }
                      onClick={() => setRevokePersonId(member.personId)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 disabled:text-slate-400"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canLoadMoreStaff && (
            <button type="button" onClick={onLoadMoreStaff} className="mt-3 text-sm underline">
              Load more staff
            </button>
          )}
        </div>
      )}

      {selectedRevocation && targetBranch && (
        <form
          className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const revoked = await onRevoke({
              schoolId: targetBranch.schoolId,
              personId: selectedRevocation.personId,
              reason: revokeReason,
              confirmation: revokeConfirmation,
            });
            if (revoked) {
              setRevokePersonId("");
              setRevokeReason("");
              setRevokeConfirmation("");
            }
          }}
        >
          <p className="text-sm font-semibold text-rose-900">
            Revoke {selectedRevocation.name} from {targetBranch.name}
          </p>
          <label className="block text-sm font-medium text-rose-900">
            Reason
            <textarea
              required
              minLength={8}
              maxLength={500}
              value={revokeReason}
              onChange={(event) => setRevokeReason(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border border-rose-300 bg-white p-2.5"
            />
          </label>
          <label className="block text-sm font-medium text-rose-900">
            Type <span className="font-mono">{targetBranch.slug}</span> to confirm
            <input
              required
              value={revokeConfirmation}
              onChange={(event) => setRevokeConfirmation(event.target.value)}
              className="mt-1 w-full rounded-lg border border-rose-300 bg-white p-2.5 font-mono"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending || revokeConfirmation !== targetBranch.slug}
              className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm revocation"}
            </button>
            <button
              type="button"
              onClick={() => setRevokePersonId("")}
              className="text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Group: <span className="font-mono">{groupSlug}</span>. Revocation takes
        effect on the next authorized branch request; it does not delete the person.
      </p>
    </section>
  );
}
