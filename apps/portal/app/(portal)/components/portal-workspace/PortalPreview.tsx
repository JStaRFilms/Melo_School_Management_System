"use client";

import type { PortalWorkspaceMode } from "@/portal-types";
import { getGreeting } from "./format";

export function PortalPreview({ mode }: { mode: PortalWorkspaceMode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-400">{getGreeting()}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {mode === "dashboard" && "Your academic overview"}
            {mode === "results" && "Academic history"}
            {mode === "report-cards" && "Report cards"}
            {mode === "notifications" && "School updates"}
            {mode === "billing" && "Fees & payments"}
          </h1>
        </div>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Connect Convex to load live portal data. This fallback keeps the
          portal build stable until the environment is configured.
        </div>
      </div>
    </div>
  );
}
