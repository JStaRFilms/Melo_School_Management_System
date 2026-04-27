"use client";

import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isConvexConfigured } from "@/convex-runtime";
import { PlatformAdminBootstrapFieldShell } from "./PlatformAdminBootstrapFieldShell";
import { PlatformAdminBootstrapSuccess } from "./PlatformAdminBootstrapSuccess";

export function PlatformAdminBootstrapForm() {
  if (!isConvexConfigured()) {
    return (
      <div className="rounded-[1.5rem] border border-amber-300/30 bg-amber-400/5 p-6 text-amber-50">
        <h2 className="text-xl font-semibold">Convex Not Configured</h2>
        <p className="mt-2 text-sm text-amber-100/90">
          Set <code>NEXT_PUBLIC_CONVEX_URL</code> before bootstrapping a platform
          admin.
        </p>
      </div>
    );
  }

  return <PlatformAdminBootstrapFormWithConvex />;
}

function PlatformAdminBootstrapFormWithConvex() {
  const router = useRouter();
  const bootstrapPlatformAdmin = useAction(
    "functions/platform/bootstrap:bootstrapPlatformAdmin" as never
  );

  const [bootstrapToken, setBootstrapToken] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    platformAdminId: string;
    adminEmail: string;
  } | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedToken = bootstrapToken.trim();
    const trimmedName = adminName.trim();
    const trimmedEmail = adminEmail.trim().toLowerCase();
    const password = adminPassword;

    if (!trimmedToken) {
      setError("Bootstrap token is required.");
      return;
    }

    if (!trimmedName) {
      setError("Admin name is required.");
      return;
    }

    if (!trimmedEmail) {
      setError("Admin email is required.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = (await bootstrapPlatformAdmin({
        bootstrapToken: trimmedToken,
        adminName: trimmedName,
        adminEmail: trimmedEmail,
        adminPassword: password,
        origin: window.location.origin,
      } as never)) as {
        platformAdminId: string;
        adminEmail: string;
      };

      setSuccess({
        platformAdminId: result.platformAdminId,
        adminEmail: result.adminEmail,
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to bootstrap the platform admin.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <PlatformAdminBootstrapSuccess
        adminEmail={success.adminEmail}
        platformAdminId={success.platformAdminId}
        onGoToSignIn={() => router.push("/sign-in")}
        onReset={() => {
          setSuccess(null);
          setError(null);
          setBootstrapToken("");
          setAdminName("");
          setAdminEmail("");
          setAdminPassword("");
        }}
      />
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/75 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/20">
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-200/70">
            Emergency recovery
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Bootstrap platform admin
          </h1>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-300/15 bg-amber-400/5 p-4 text-sm text-amber-50/90">
        This screen is for production recovery only. It should stay unlinked and
        be used to restore the first platform admin or recover access after a
        bad bootstrap.
      </div>

      {error ? (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <PlatformAdminBootstrapFieldShell
          label="Bootstrap token"
          hint="This must match PLATFORM_BOOTSTRAP_TOKEN in the production Convex deployment."
        >
          <input
            type="password"
            value={bootstrapToken}
            onChange={(event) => setBootstrapToken(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-4 focus:ring-white/5"
            placeholder="Enter the recovery token"
            autoComplete="off"
          />
        </PlatformAdminBootstrapFieldShell>

        <PlatformAdminBootstrapFieldShell label="Admin name" hint="The display name for the platform operator.">
          <input
            type="text"
            value={adminName}
            onChange={(event) => setAdminName(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-4 focus:ring-white/5"
            placeholder="e.g. School Owner"
            autoComplete="name"
          />
        </PlatformAdminBootstrapFieldShell>

        <PlatformAdminBootstrapFieldShell
          label="Admin email"
          hint="This becomes the sign-in email for the platform super admin."
        >
          <input
            type="email"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-4 focus:ring-white/5"
            placeholder="admin@school.com"
            autoComplete="email"
          />
        </PlatformAdminBootstrapFieldShell>

        <PlatformAdminBootstrapFieldShell
          label="Temporary password"
          hint="Use a strong temporary password. The new admin can change it after sign-in."
        >
          <input
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-slate-400 focus:ring-4 focus:ring-white/5"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </PlatformAdminBootstrapFieldShell>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Bootstrapping..." : "Bootstrap platform admin"}
        </button>
      </form>
    </div>
  );
}
