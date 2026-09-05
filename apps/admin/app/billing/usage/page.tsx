"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";

export default function UsagePage() {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready"
    ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const allowed = useQuery(api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "finance.reports.view" } : "skip");
  const args = schoolId && allowed ? { schoolId } : "skip";
  const meters = useQuery(api.functions.academic.metering.getUsageStatus, args);
  const events = useQuery(api.functions.academic.metering.listUsageEvents, args);
  if (allowed === false) return <p role="alert">Usage access denied.</p>;
  if (!meters || !events) return <p role="status">Loading usage…</p>;
  return <main className="mx-auto max-w-4xl space-y-5 p-4">
    <h1 className="text-xl font-semibold">Usage and allowances</h1>
    <p>Recorded branch meters only, not all AI activity. Subscription invoices and collection fees are separate.</p>
    <Link href="/billing/subscription">Melo subscription</Link>
    {!meters.length && <p role="status">No allowance recorded. A subscription or unpaid invoice does not activate an allowance.</p>}
    {meters.map(m => <section className="space-y-2 border-b pb-4" key={m.meterType}>
      <h2 className="font-semibold">{m.meterType.replaceAll("_", " ")}</h2>
      <p>{m.consumedUnits.toLocaleString()} consumed · {m.reservedUnits.toLocaleString()} held · {m.availableUnits.toLocaleString()} available / {m.allocatedUnits.toLocaleString()} allocated</p>
      <progress aria-label={`${m.meterType} consumed and reserved`} max={100} value={m.utilizationPercent} />
      <p role={m.isCritical90 || m.isHardStopped ? "alert" : "status"}>
        {m.isHardStopped ? "Base allowance exhausted: new reservations are blocked." : m.isCritical90 ? "90% warning: plan remaining work with your administrator." : m.isWarning75 ? "75% notice: review remaining allowance." : "Within recorded allowance."}
      </p>
      <p>Cadence recorded: {m.resetCadence}; last reset {new Date(m.lastResetAt).toISOString()}. Next reset and expiry are not configured by this meter.</p>
      {m.meterType === "storage_bytes" && <p>Storage bytes — active: {m.activeStorageBytes?.toLocaleString() ?? "not recorded"}; trash: {m.trashStorageBytes?.toLocaleString() ?? "not recorded"}; temporary: {m.tempStorageBytes?.toLocaleString() ?? "not recorded"}. Trash is not free space. Knowledge-library coverage is not yet reconciled.</p>}
    </section>)}
    <section className="space-y-2">
      <h2 className="font-semibold">Limits and remedies</h2>
      <p>75% is a notice, 90% an urgent warning, and 100% blocks new reservations. Held estimates count toward availability; successful settlement releases unused units. Failure release consumes no customer units. Accepted work must not be cut off mid-generation.</p>
      <p>Grace, top-up catalog, cycle expiry, branch pools and exceptions are not configured here. Contact your school administrator to review a smaller operation or request allowance review. No purchase or exception has been granted by this page.</p>
      <button disabled>Buy top-up — unavailable</button>{" "}<button disabled>Request exception — unavailable</button>
      <p>Customer monetary usage charges: unavailable (no approved usage price or currency). Provider economics are restricted to Platform and are not a customer bill. No zero-cost claim.</p>
      <p>Paid lesson generation and provider OCR remain unavailable pending authoritative entitlement, estimate, reservation and provider reconciliation adapters.</p>
    </section>
    <section>
      <h2 className="font-semibold">Recent recorded usage (up to 50 events)</h2>
      {!events.length && <p>No usage events recorded; this does not prove no provider spend.</p>}
      <ul className="space-y-2">{events.map(e => <li key={e._id}>{new Date(e.timestamp).toISOString()} · {e.operationName} · {e.unitsDelta.toLocaleString()} {e.meterType.replaceAll("_", " ")}</li>)}</ul>
    </section>
  </main>;
}
