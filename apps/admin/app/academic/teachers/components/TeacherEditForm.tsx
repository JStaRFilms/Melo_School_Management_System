"use client";

import { useEffect, useState } from "react";
import { Send, KeyRound, Archive, X, Eye, EyeOff, Copy, Check, RefreshCw, Ban } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { PersonNameFields, emptyPersonName, getUserFacingErrorMessage } from "@school/shared";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import { appToast } from "@school/shared/toast";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { AccountNoticePanel } from "../../students/components/AccountNoticePanel";
import { TeacherBranchTransferPanel } from "./TeacherBranchTransferPanel";
import type { TeacherRecord } from "@/types";

interface TeacherEditFormProps {
  teacher: TeacherRecord;
  schoolId?: Id<"schools">;
  onUpdate: (id: string, name: string, email: string, parts?: { firstName: string; middleName: string | null; lastName: string }) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onArchive: (id: string) => void | Promise<void>;
  onClose: () => void;
  isSaving: boolean;
  isResetting: boolean;
  isArchiveStatusLoading?: boolean;
  variant?: "default" | "sheet";
  canEditProfile: boolean;
  canResetPassword: boolean;
  canArchive: boolean;
  canManageTransfers?: boolean;
}

export function TeacherEditForm({
  teacher,
  schoolId,
  onUpdate,
  onResetPassword,
  onArchive,
  onClose,
  isSaving,
  isResetting,
  isArchiveStatusLoading = false,
  variant = "default",
  canEditProfile,
  canResetPassword,
  canArchive,
  canManageTransfers = false,
}: TeacherEditFormProps) {
  const [person, setPerson] = useState(emptyPersonName);
  const parts = normalizeStructuredPersonName(person);
  const name = person.structured ? [parts.firstName, parts.middleName, parts.lastName].filter(Boolean).join(" ") : person.fullName.trim();
  const [email, setEmail] = useState("");
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const lifecycle = useQuery(
    api.functions.academic.academicSetup.getTeacherLifecycleDetails,
    { teacherId: teacher._id as Id<"users">, schoolId },
  );
  const resendInvitation = useMutation(
    api.functions.academic.invitations.resendSchoolInvitation,
  );
  const reissueInvitation = useMutation(
    api.functions.academic.invitations.reissueTeacherInvitation,
  );
  const revokeInvitation = useMutation(
    api.functions.academic.invitations.revokeSchoolInvitation,
  );

  useEffect(() => {
    setPerson({
      firstName: teacher.firstName ?? "",
      middleName: teacher.middleName ?? "",
      lastName: teacher.lastName ?? "",
      fullName: teacher.name,
      structured: Boolean(teacher.firstName && teacher.lastName),
    });
    setEmail(teacher.email);
    setResetPass("");
    setShowResetPass(false);
    setFreshInviteUrl(null);
    setCopiedLink(false);
  }, [teacher._id, teacher.email, teacher.name, teacher.firstName, teacher.middleName, teacher.lastName]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || (person.structured && (!parts.firstName || !parts.lastName))) return;
    await onUpdate(
      teacher._id,
      trimmedName,
      trimmedEmail,
      person.structured && parts.firstName && parts.lastName
        ? { firstName: parts.firstName, middleName: parts.middleName ?? null, lastName: parts.lastName }
        : undefined,
    );
  };

  const handleTriggerResetPassword = async () => {
    const trimmed = resetPass.trim();
    if (!trimmed || isResetting) return;
    await onResetPassword(teacher._id, trimmed);
    setResetPass("");
  };

  const handleResendInvite = async () => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      const res =
        lifecycle?.isPendingInvitation && lifecycle.latestInvitation
          ? await resendInvitation({
              invitationId: lifecycle.latestInvitation.invitationId,
              schoolId,
            })
          : await reissueInvitation({
              teacherId: teacher._id as Id<"users">,
              schoolId,
            });
      setFreshInviteUrl(res.inviteUrl);
      appToast.success("New invite link created", {
        description: "Share this link with the teacher to claim their login.",
      });
    } catch (error) {
      appToast.error("Could not create invitation", {
        description: getUserFacingErrorMessage(error, "Try again."),
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvite = async () => {
    if (!lifecycle?.latestInvitation || inviteBusy) return;
    setInviteBusy(true);
    try {
      await revokeInvitation({
        invitationId: lifecycle.latestInvitation.invitationId,
        schoolId,
      });
      appToast.success("Invitation revoked");
      onClose();
    } catch (error) {
      appToast.error("Could not revoke invitation", {
        description: getUserFacingErrorMessage(error, "Try again."),
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const isSheet = variant === "sheet";
  const archiveBlockers = [...new Set(teacher.archiveBlockers ?? [])].filter(Boolean);
  const hasArchiveBlockers = archiveBlockers.length > 0;
  const isPendingInvite = lifecycle?.isPendingInvitation === true;
  const isUnboundLogin = lifecycle?.isUnboundLogin === true;
  const isSharedIdentity = lifecycle?.sharedIdentity === true;
  const isAlsoParent = lifecycle?.hasActiveFamilyLinks === true;

  const FormContent = (
    <>
      {!isSheet && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-[9px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">
              Manage Teacher
            </h4>
            <p className="text-[10px] font-medium text-slate-400">
              Update profile, access, or branch assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="h-3 w-3 opacity-30" />
          </button>
        </div>
      )}

      {isAlsoParent && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
          Also linked as a parent in this school. Removing teacher access keeps their Family Portal access active.
        </div>
      )}

      {(isPendingInvite || isUnboundLogin) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-900">
            {isPendingInvite ? "Invitation pending acceptance" : "Invitation needed"}
          </p>
          <p className="text-[11px] text-amber-900">
            {isPendingInvite
              ? "This teacher has not accepted their invite link yet."
              : "No active invite link exists for this email. Issue a new link so the teacher can claim their login."}
          </p>
          {freshInviteUrl && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-mono break-all rounded-md bg-white p-2 border border-amber-200 text-slate-800">
                {freshInviteUrl}
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(freshInviteUrl).then(() => {
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  });
                }}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-amber-700 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-amber-800"
              >
                {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedLink ? "Copied" : "Copy link"}
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void handleResendInvite()}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3" />
              {isPendingInvite ? "New invite link" : "Send new invite link"}
            </button>
            {isPendingInvite && lifecycle?.latestInvitation && (
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void handleRevokeInvite()}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <Ban className="h-3 w-3" />
                Revoke
              </button>
            )}
          </div>
        </div>
      )}

      {canEditProfile && (
        <form onSubmit={handleUpdate} className="space-y-3">
          <PersonNameFields
            value={person}
            onChange={setPerson}
            allowFullName={!teacher.firstName || !teacher.lastName}
          />

          <FormField label="Email Address">
            <input
              type="email"
              required
              disabled={isSharedIdentity}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </FormField>

          <button
            type="submit"
            disabled={isSaving || !name || !email}
            className="mt-2 w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98]"
          >
            <Send className="h-3 w-3" />
            {isSaving ? "Saving..." : "Update Teacher"}
          </button>
        </form>
      )}

      {canManageTransfers && (
        <TeacherBranchTransferPanel
          teacherId={teacher._id as Id<"users">}
          schoolId={schoolId}
          onCompleted={onClose}
        />
      )}

      {(canResetPassword || canArchive) && (
        <div className="pt-4 border-t border-slate-100 space-y-3">
          {canResetPassword && !isPendingInvite && !isUnboundLogin && (
            isSharedIdentity ? (
              <p className="text-[11px] leading-relaxed text-slate-500">
                This login is self-managed or shared across schools. The teacher must reset their password directly.
              </p>
            ) : (
              <FormField label="Reset Password">
                <div className="flex gap-2">
                  <input
                    type={showResetPass ? "text" : "password"}
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isResetting && resetPass.trim()) {
                        e.preventDefault();
                        void handleTriggerResetPassword();
                      }
                    }}
                    placeholder="Enter new temporary password"
                    className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass((current) => !current)}
                    aria-label={showResetPass ? "Hide reset password" : "Show reset password"}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50"
                  >
                    {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleTriggerResetPassword()}
                    disabled={isResetting || !resetPass.trim()}
                    title="Update temporary password"
                    aria-label="Update temporary password"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white transition-all hover:bg-amber-600 disabled:opacity-50 active:scale-90"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                </div>
              </FormField>
            )
          )}

          {canResetPassword && !isPendingInvite && !isUnboundLogin && !isSharedIdentity && (
            <AccountNoticePanel userId={teacher._id as Id<"users">} />
          )}

          {canArchive && hasArchiveBlockers && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]">Reassignment required</p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed">
                This teacher still has active links. Reassign these first:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] font-semibold leading-relaxed">
                {archiveBlockers.slice(0, 3).map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
              {archiveBlockers.length > 3 && (
                <p className="mt-1 text-[10px] font-medium text-amber-800">
                  +{archiveBlockers.length - 3} more link{archiveBlockers.length - 3 === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}

          {canArchive && (
            <div className="flex justify-between items-center pt-2">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.1em]">
                  {isAlsoParent ? "Remove Teacher Role" : "Danger Zone"}
                </span>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isAlsoParent
                    ? "Revokes staff access; keeps Family Portal."
                    : "Deactivates access; keeps past records."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onArchive(teacher._id)}
                disabled={isArchiveStatusLoading || hasArchiveBlockers}
                title={
                  isArchiveStatusLoading
                    ? "Checking active class and subject assignments..."
                    : hasArchiveBlockers
                      ? "Reassign active class or subject links first."
                      : undefined
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 text-[10px] font-bold uppercase tracking-widest text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <Archive className="h-3 w-3" />
                {isArchiveStatusLoading
                  ? "Checking..."
                  : isAlsoParent
                    ? "Remove Role"
                    : "Archive"}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isSheet) {
    return <div className="space-y-4">{FormContent}</div>;
  }

  return (
    <div className="space-y-4">
      <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4 border-slate-950/10 ring-1 ring-slate-950/5 shadow-2xl">
        {FormContent}
      </AdminSurface>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
