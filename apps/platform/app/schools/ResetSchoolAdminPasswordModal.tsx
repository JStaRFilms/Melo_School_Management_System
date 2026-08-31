"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { X, Lock, Eye, EyeOff, KeyRound, Loader2, Check } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";

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
      setNewPassword("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Reset School Admin Password</h2>
              <p className="text-xs text-slate-500">{school.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Admin Account</div>
              <div className="text-sm font-bold text-slate-900">{school.adminName || "Assigned Administrator"}</div>
              <div className="text-xs text-slate-500 font-mono">{school.adminEmail || "No email on file"}</div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                New Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Setting a new password will revoke any active sessions for this admin user.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newPassword.length < 8}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Confirm Password Reset
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
