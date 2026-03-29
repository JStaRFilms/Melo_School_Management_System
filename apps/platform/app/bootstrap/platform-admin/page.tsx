import type { Metadata } from "next";
import { isConvexConfigured } from "@/convex-runtime";
import { PlatformAdminBootstrapForm } from "./PlatformAdminBootstrapForm";

export const metadata: Metadata = {
  title: "Platform Admin Bootstrap",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlatformAdminBootstrapPage() {
  if (!isConvexConfigured()) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
              Bootstrap unavailable
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-white">
              Convex is not configured for this platform app.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The recovery screen only works when the platform app is connected
              to a live Convex deployment. Set NEXT_PUBLIC_CONVEX_URL before
              trying again.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_55%,_#111827_100%)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-2xl items-center">
        <div className="w-full space-y-6">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
              Platform recovery
            </p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Restore access to the production platform admin.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Use this only when the production platform admin needs to be
              recreated or recovered from an emergency bootstrap. After
              success, sign in normally from the platform login page.
            </p>
          </div>

          <PlatformAdminBootstrapForm />
        </div>
      </div>
    </main>
  );
}
