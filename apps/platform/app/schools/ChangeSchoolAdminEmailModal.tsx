"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { Mail, X, Loader2 } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";

export interface ChangeSchoolAdminEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: {
    _id: string;
    name: string;
    adminUserId: string | null;
    adminName: string | null;
    adminEmail: string | null;
  } | null;
}

export function ChangeSchoolAdminEmailModal({ isOpen, onClose, school }: ChangeSchoolAdminEmailModalProps) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const changeEmail = useAction("functions/platform/index:updateSchoolAdminEmail" as never);

  useEffect(() => {
    if (isOpen) {
      setNewEmail("");
      setConfirmation("");
      setIsSubmitting(false);
    }
  }, [isOpen, school?._id]);

  if (!isOpen || !school) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!school.adminUserId) {
      appToast.error("Email change unavailable", { description: "This school has no active administrator account." });
      return;
    }
    if (normalizedEmail !== confirmation.trim().toLowerCase()) {
      appToast.warning("Email addresses do not match", { description: "Enter the new email address twice to confirm it." });
      return;
    }
    if (!normalizedEmail) {
      appToast.warning("New email required", { description: "Enter the administrator's new email address." });
      return;
    }

    setIsSubmitting(true);
    try {
      await changeEmail({ schoolId: school._id as never, userId: school.adminUserId as never, newEmail: normalizedEmail } as never);
      appToast.success("Administrator email updated", {
        description: `${school.adminName || "The administrator"} must sign in with the new email. A verification message was sent to it.`,
      });
      onClose();
    } catch (error) {
      appToast.error("Could not change administrator email", {
        description: getErrorMessage(error, "The email change could not be completed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Close email change dialog" className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={isSubmitting ? undefined : onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="change-admin-email-title" className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-indigo-600"><Mail className="h-4 w-4" /></div>
            <div><h2 id="change-admin-email-title" className="text-base font-bold text-slate-900">Change administrator email</h2><p className="text-xs text-slate-500">{school.name}</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close email change dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target administrator</div>
              <div className="text-sm font-bold text-slate-900">{school.adminName || "Assigned Administrator"}</div>
              <div className="font-mono text-xs text-slate-500">{school.adminEmail || "No email on file"}</div>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">The administrator will be signed out of all devices and must use the new email to sign in. A verification message will be sent to the new address.</p>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">New email<input required type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} disabled={isSubmitting} autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /></label>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Confirm new email<input required type="email" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isSubmitting} autoComplete="off" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" /></label>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">{isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{isSubmitting ? "Updating…" : "Change email"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
