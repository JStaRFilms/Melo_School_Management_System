"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAction } from "convex/react";
import { X, Eye, EyeOff, KeyRound, Loader2, Check } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const resetPassword = useAction(
    "functions/platform/index:resetSchoolAdminPassword" as never
  );

  const schoolId = school?._id;

  const resetForm = useCallback(() => {
    setNewPassword("");
    setShowPassword(false);
  }, []);

  const closeAndReset = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleDismiss = () => {
    if (!isSubmitting) closeAndReset();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    resetForm();
  }, [isOpen, resetForm, schoolId]);

  useEffect(() => {
    if (!isOpen || !mounted || !schoolId) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [isOpen, mounted, schoolId]);

  useEffect(() => {
    if (!isOpen || !mounted || !schoolId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        closeAndReset();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const isFocusOutsideDialog =
        activeElement === dialogRef.current ||
        !dialogRef.current?.contains(activeElement);

      if (event.shiftKey && (activeElement === firstElement || isFocusOutsideDialog)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || isFocusOutsideDialog)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeAndReset, isOpen, isSubmitting, mounted, schoolId]);

  useEffect(() => {
    if (!isOpen || !mounted || !schoolId) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, mounted, schoolId]);

  if (!isOpen || !school || !mounted) return null;

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
      closeAndReset();
    } catch (err) {
      appToast.error("Password reset failed", {
        description: getErrorMessage(err, "Could not reset admin password."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity"
        onClick={handleDismiss}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-school-admin-password-title"
        aria-describedby="reset-school-admin-password-description"
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 id="reset-school-admin-password-title" className="text-base font-bold text-slate-900">
                Reset School Admin Password
              </h2>
              <p id="reset-school-admin-password-description" className="text-xs text-slate-500">{school.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isSubmitting}
            aria-label="Close reset password dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-4 w-4" />
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
                  aria-describedby="reset-school-admin-password-requirements"
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  disabled={isSubmitting}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              </div>
              <p id="reset-school-admin-password-requirements" className="text-[11px] text-slate-400">
                Use at least 8 characters. Setting a new password will revoke any active sessions for this admin user.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={handleDismiss}
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || newPassword.length < 8}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
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
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
