"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { Eye, EyeOff, KeyRound, Loader2, Check } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";
import {
  PlatformSheet,
  SheetFooterButtons,
  sheetPrimaryButton,
  sheetSecondaryButton,
} from "./PlatformSheet";

export interface ResetSchoolAdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: {
    _id: string;
    name: string;
    adminName: string | null;
    adminEmail: string | null;
  } | null;
}

export function ResetSchoolAdminPasswordModal({
  isOpen,
  onClose,
  school,
}: ResetSchoolAdminPasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetPassword = useAction(
    "functions/platform/index:resetSchoolAdminPassword" as never
  );

  const schoolId = school?._id;

  const resetForm = useCallback(() => {
    setNewPassword("");
    setShowPassword(false);
  }, []);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm, schoolId]);

  if (!isOpen || !school) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      appToast.warning("Invalid password", {
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({
        schoolId: school._id as never,
        newPassword,
      } as never);

      appToast.success("Password reset successfully", {
        description: `Admin password for ${school.adminEmail ?? school.name} has been updated.`,
      });
      resetForm();
      onClose();
    } catch (err) {
      appToast.error("Password reset failed", {
        description: getErrorMessage(err, "Could not reset admin password."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PlatformSheet
      labelledBy="reset-school-admin-password-title"
      describedBy="reset-school-admin-password-description"
      title="Reset School Admin Password"
      subtitle={school.name}
      closeLabel="Close reset password dialog"
      dismissDisabled={isSubmitting}
      onClose={() => {
        if (isSubmitting) return;
        resetForm();
        onClose();
      }}
      icon={
        <div aria-hidden="true" className="rounded-xl bg-amber-50 p-2.5 text-amber-600 border border-amber-100">
          <KeyRound className="h-5 w-5" />
        </div>
      }
      footer={
        <SheetFooterButtons>
          <button
            type="button"
            onClick={() => {
              if (isSubmitting) return;
              resetForm();
              onClose();
            }}
            disabled={isSubmitting}
            className={sheetSecondaryButton}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="reset-school-admin-password-form"
            disabled={isSubmitting || newPassword.length < 8}
            className={`${sheetPrimaryButton} bg-slate-900 hover:bg-slate-800`}
          >
            {isSubmitting ? (
              <>
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                Updating Password...
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                Confirm Password Reset
              </>
            )}
          </button>
        </SheetFooterButtons>
      }
    >
      <form id="reset-school-admin-password-form" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Admin Account</div>
            <div className="text-sm font-bold text-slate-900">{school.adminName || "Assigned Administrator"}</div>
            <div className="text-xs text-slate-500 font-mono">{school.adminEmail || "No email on file"}</div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reset-school-admin-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              New Temporary Password
            </label>
            <div className="relative">
              <input
                id="reset-school-admin-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                autoFocus
                aria-describedby="reset-school-admin-password-requirements"
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 pr-12 text-base font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 sm:py-2.5 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={isSubmitting}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
              </button>
            </div>
            <p id="reset-school-admin-password-requirements" className="text-[11px] text-slate-400">
              Use at least 8 characters. Setting a new password will revoke any active sessions for this admin user.
            </p>
          </div>
        </div>
      </form>
    </PlatformSheet>
  );
}
