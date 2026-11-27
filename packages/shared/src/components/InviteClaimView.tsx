"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Lock, LogIn, ShieldAlert, UserPlus } from "lucide-react";

export type InspectedInvitationState =
  | { state: "invalid" }
  | { state: "accepted" | "revoked" | "expired"; schoolName: string }
  | {
      state: "pending";
      schoolName: string;
      intendedRole: "teacher" | "staff" | "parent";
      maskedEmail: string;
      expiresAt: number;
      viewerSignedIn: boolean;
      viewerEmailMatches: boolean;
      viewerMaskedEmail: string | null;
    };

export interface InviteClaimViewProps {
  workspaceLabel: "Teacher" | "Family Portal";
  invitation: InspectedInvitationState | undefined;
  isAuthLoading: boolean;
  onSignIn: (email: string, password: string) => Promise<{ success: boolean; error: string | null }>;
  onSignOut: () => Promise<void>;
  onAcceptAsNewUser: (password: string) => Promise<{ email: string }>;
  onAcceptAsSignedInUser: () => Promise<void>;
  onComplete: () => void;
}

function roleLabel(role: "teacher" | "staff" | "parent") {
  if (role === "parent") return "Family Portal member";
  if (role === "staff") return "staff member";
  return "teacher";
}

export function InviteClaimView({
  workspaceLabel,
  invitation,
  isAuthLoading,
  onSignIn,
  onSignOut,
  onAcceptAsNewUser,
  onAcceptAsSignedInUser,
  onComplete,
}: InviteClaimViewProps) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (invitation === undefined || isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">Checking invitation…</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-950">Invitation accepted</h1>
            <p className="text-sm text-slate-600">
              Your account is now linked. You can open {workspaceLabel}.
            </p>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Continue to {workspaceLabel}
          </button>
        </div>
      </div>
    );
  }

  if (invitation.state !== "pending") {
    const title =
      invitation.state === "accepted"
        ? "Invitation already used"
        : invitation.state === "expired"
          ? "Invitation expired"
          : invitation.state === "revoked"
            ? "Invitation revoked"
            : "Invitation not found";
    const description =
      invitation.state === "accepted"
        ? `This invitation for ${invitation.schoolName} has already been accepted. Sign in normally to continue.`
        : invitation.state === "expired"
          ? `This invitation for ${invitation.schoolName} has expired. Ask the school administrator for a new invite link.`
          : invitation.state === "revoked"
            ? `This invitation for ${invitation.schoolName} was cancelled by the school administrator.`
            : "This invite link is invalid or incomplete. Check the full link or ask the school for a new one.";

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-950">{title}</h1>
            <p className="text-sm text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  const expiryLabel = new Date(invitation.expiresAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleNewUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await onAcceptAsNewUser(password);
      const signedIn = await onSignIn(created.email, password);
      if (signedIn.success) {
        setDone(true);
        onComplete();
      } else {
        setDone(true);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Could not accept invitation.";
      if (raw.toLowerCase().includes("already exists on melo")) {
        setMode("existing");
        setPassword("");
        setConfirmPassword("");
        setError("An account with this email already exists on Melo. Sign in with your existing password to link this school.");
      } else {
        setError(raw);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExistingSignInAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your Melo email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const signedIn = await onSignIn(email.trim(), password);
      if (!signedIn.success) {
        setError(signedIn.error ?? "Sign in failed. Check your email and password.");
        return;
      }
      // Wait briefly if the Convex auth session is still attaching after Better Auth sign-in.
      let lastAuthErr: unknown = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          await onAcceptAsSignedInUser();
          lastAuthErr = null;
          break;
        } catch (acceptErr) {
          const msg = acceptErr instanceof Error ? acceptErr.message : "";
          if (msg.toLowerCase().includes("sign in to your melo account") && attempt < 5) {
            lastAuthErr = acceptErr;
            await new Promise((resolve) => setTimeout(resolve, 350));
            continue;
          }
          throw acceptErr;
        }
      }
      if (lastAuthErr) throw lastAuthErr;
      setDone(true);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignedInAccept = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onAcceptAsSignedInUser();
      setDone(true);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="space-y-1.5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Melo Invitation
          </p>
          <h1 className="text-xl font-bold text-slate-950">
            Join {invitation.schoolName}
          </h1>
          <p className="text-sm text-slate-600">
            Invited as a <span className="font-semibold text-slate-900">{roleLabel(invitation.intendedRole)}</span> for{" "}
            <span className="font-semibold text-slate-900">{invitation.maskedEmail}</span>.
          </p>
          <p className="text-xs text-slate-400">Expires {expiryLabel}</p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}

        {invitation.viewerSignedIn ? (
          invitation.viewerEmailMatches ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-700">
                Signed in as <span className="font-semibold text-slate-950">{invitation.viewerMaskedEmail}</span>. Accepting links {invitation.schoolName} to your existing Melo account.
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSignedInAccept()}
                className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {submitting ? "Linking account…" : `Accept & join ${invitation.schoolName}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
                You are signed in as <span className="font-semibold">{invitation.viewerMaskedEmail ?? "another account"}</span>, but this invitation is for <span className="font-semibold">{invitation.maskedEmail}</span>.
              </div>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition"
              >
                Sign out and switch account
              </button>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => { setMode("new"); setError(null); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "new" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                New to Melo
              </button>
              <button
                type="button"
                onClick={() => { setMode("existing"); setError(null); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                  mode === "existing" ? "bg-white text-slate-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Existing account
              </button>
            </div>

            {mode === "new" ? (
              <form onSubmit={handleNewUserSubmit} className="space-y-3">
                <div>
                  <label htmlFor="invite-new-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Choose a password
                  </label>
                  <input
                    id="invite-new-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                  />
                </div>
                <div>
                  <label htmlFor="invite-confirm-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm password
                  </label>
                  <input
                    id="invite-confirm-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? "Creating account…" : "Create account & accept"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleExistingSignInAndAccept} className="space-y-3">
                <div>
                  <label htmlFor="invite-existing-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Melo email
                  </label>
                  <input
                    id="invite-existing-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={invitation.maskedEmail}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                  />
                </div>
                <div>
                  <label htmlFor="invite-existing-password" className="block text-xs font-semibold text-slate-700 mb-1">
                    Existing Melo password
                  </label>
                  <input
                    id="invite-existing-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  <LogIn className="h-4 w-4" />
                  {submitting ? "Signing in…" : `Sign in & join ${invitation.schoolName}`}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
