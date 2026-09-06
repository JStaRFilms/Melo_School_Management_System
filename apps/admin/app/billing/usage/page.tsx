"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
type LocalMutation = (args: Record<string, unknown>) => Promise<unknown>;

export default function UsagePage() {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready"
    ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const allowed = useQuery(api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "finance.reports.view" } : "skip");
  const args = schoolId && allowed ? { schoolId } : "skip";
  const meters = useQuery(api.functions.academic.metering.getUsageStatus, args);
  const entitlement = useQuery("functions/academic/usageEntitlements:getUsageWorkspace" as never, args as never) as { cycle: null | { _id: Id<"usageCycles">; code: string; version: number; startAt: number; endAt: number; warningPercent: number; criticalPercent: number; hardStopPercent: number; maxFileSizeBytes: number; maxPagesPerOperation: number }; meters: Array<{ meterType: "ai_tokens" | "ocr_pages" | "storage_bytes"; baseUnits: number; graceUnits: number; topUpUnits: number; exceptionUnits: number; poolUnits: number; availableUnits: number }>; requests: Array<{ _id: Id<"usageExceptionRequests"> }>; groupPools: Array<{ _id: Id<"usageGroupPools">; meterType: string; totalUnits: number }>; canAllocatePool: boolean } | undefined;
  const requestException = useMutation("functions/academic/usageEntitlements:requestUsageException" as never) as unknown as LocalMutation;
  const allocatePool = useMutation("functions/academic/usageEntitlements:allocateGroupPoolToBranch" as never) as unknown as LocalMutation;
  const [allocationId, setAllocationId] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const events = useQuery(api.functions.academic.metering.listUsageEvents, args);
  if (allowed === false) return <p role="alert">Usage access denied.</p>;
  if (!meters || !events || !entitlement) return <p role="status">Loading usage…</p>;
  return <main className="mx-auto max-w-4xl space-y-5 p-4">
    <h1 className="text-xl font-semibold">Usage and allowances</h1>
    <p>Recorded branch meters only, not all AI activity. Subscription invoices and collection fees are separate.</p>
    <Link href="/billing/subscription">Melo subscription</Link>
    {!entitlement.cycle && <p role="status">No current contract-bound entitlement cycle. A subscription or unpaid invoice does not activate an allowance.</p>}
    {entitlement.cycle && <section className="space-y-2 border-b pb-4"><h2 className="font-semibold">Current entitlement cycle</h2><p>{entitlement.cycle.code} v{entitlement.cycle.version} · {new Date(entitlement.cycle.startAt).toISOString()} to {new Date(entitlement.cycle.endAt).toISOString()} (end exclusive)</p><p>Thresholds {entitlement.cycle.warningPercent}% notice / {entitlement.cycle.criticalPercent}% urgent / {entitlement.cycle.hardStopPercent}% hard stop. File cap {entitlement.cycle.maxFileSizeBytes.toLocaleString()} bytes; operation page cap {entitlement.cycle.maxPagesPerOperation}.</p>{entitlement.meters.map(m => <p key={m.meterType}>{m.meterType}: base {m.baseUnits}, grace {m.graceUnits}, top-ups {m.topUpUnits}, exceptions {m.exceptionUnits}, group pool {m.poolUnits}; {m.availableUnits} available. Each source is recorded separately.</p>)}<form className="grid gap-2 sm:grid-cols-2" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await requestException({ schoolId: schoolId!, cycleId: entitlement.cycle!._id, meterType: String(form.get("meterType")) as "ai_tokens" | "ocr_pages" | "storage_bytes", units: Number(form.get("units")), reason: String(form.get("reason")), confirmation: String(form.get("confirmation")) }); setMessage("Exception requested. No allowance was granted."); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed; values retained."); } }}><label>Meter<select className="block w-full border p-2" name="meterType">{entitlement.meters.map(m => <option key={m.meterType}>{m.meterType}</option>)}</select></label><label>Requested units<input className="block w-full border p-2" name="units" type="number" min={1} required /></label><label>Reason<input className="block w-full border p-2" name="reason" minLength={8} maxLength={240} required /></label><label>Type REQUEST<input className="block w-full border p-2" name="confirmation" pattern="REQUEST" required /></label><button className="border p-2">Request exception</button></form><p role="status">{message}</p><p>{entitlement.requests.length} recent exception requests. A request is not approval.</p>{entitlement.canAllocatePool && <form className="grid gap-2 sm:grid-cols-2" onSubmit={async event => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); try { await allocatePool({ poolId: String(form.get("poolId")) as Id<"usageGroupPools">, schoolId: schoolId!, cycleId: entitlement.cycle!._id, idempotencyKey: allocationId, units: Number(form.get("units")), reason: String(form.get("reason")), confirmation: String(form.get("confirmation")) }); formElement.reset(); setAllocationId(crypto.randomUUID()); setMessage("Pool units allocated to this branch."); } catch (error) { setMessage(error instanceof Error ? error.message : "Allocation failed; values retained."); } }}><h3 className="sm:col-span-2 font-semibold">Allocate recorded group pool to this branch</h3><label>Pool<select className="block w-full border p-2" name="poolId">{entitlement.groupPools.map(pool => <option key={pool._id} value={pool._id}>{pool.meterType} · {pool.totalUnits} total</option>)}</select></label><label>Units<input className="block w-full border p-2" name="units" type="number" min={1} required /></label><label>Reason<input className="block w-full border p-2" name="reason" minLength={8} required /></label><label>Type ALLOCATE<input className="block w-full border p-2" name="confirmation" pattern="ALLOCATE" required /></label><button className="border p-2" disabled={!entitlement.groupPools.length}>Allocate units</button></form>}</section>}
    {!meters.length && <p role="status">No operational meter recorded.</p>}
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
      <p>Configured grace, top-up grants, group-pool allocations and approved exceptions are displayed separately above. Expired grants are excluded. Contact Platform for a reviewed recorded top-up grant; it is not a purchase receipt.</p>
      <button disabled>Buy top-up — payment unavailable</button>
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
