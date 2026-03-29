"use client";

export function PlatformAdminBootstrapSuccess({
  adminEmail,
  platformAdminId,
  onGoToSignIn,
  onReset,
}: {
  adminEmail: string;
  platformAdminId: string;
  onGoToSignIn: () => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-2xl shadow-black/20">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200">
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Platform admin bootstrapped
            </h2>
            <p className="mt-1 text-sm text-emerald-100/80">
              {adminEmail} is now registered in production.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-200">
            <p className="font-medium text-white">Platform admin id</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-300">
              {platformAdminId}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onGoToSignIn}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Go to sign-in
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              Bootstrap another admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
