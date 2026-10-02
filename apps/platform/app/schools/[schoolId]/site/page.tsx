"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";

const sites = api.functions.sites;
const button = "rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-50";
function dnsRecommendations(records: {rank: number; value: string | string[]}[]): string {
  return records.length ? [...records].sort((a, b) => a.rank - b.rank).map(record => `rank ${record.rank}: ${Array.isArray(record.value) ? record.value.join(", ") : record.value}`).join("; ") : "not supplied";
}
export default function SchoolSiteOperationsPage() {
  const schoolId = useParams().schoolId as Id<"schools">;
  const read = useAction(sites.management.operatorView);
  const provision = useMutation(sites.profiles.provisionProfile);
  const check = useAction(sites.domainActions.checkReadiness);
  const fetchInstructions = useAction(sites.domainActions.getRoutingInstructions);
  const provider = useAction(sites.domainActions.mutateProvider);
  const reconcile = useAction(sites.domainActions.reconcileProvider);
  const activate = useMutation(sites.domains.activateDomain);
  const suspend = useMutation(sites.domains.suspendDomain);
  const retire = useMutation(sites.domains.retireDomain);
  type View = Awaited<ReturnType<typeof read>>;
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [canonical, setCanonical] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [guidance, setGuidance] = useState<Awaited<ReturnType<typeof fetchInstructions>> | null>(null);
  useEffect(() => { let alive = true; read({schoolId}).then(data => {if (alive) setView(data);}).catch(e => {if (alive) setError(String(e));}); return () => {alive = false;}; },[read,schoolId]);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(""); setResult(""); try { await fn(); setView(await read({schoolId})); } catch(e) { setError(e instanceof Error ? e.message : "Operation denied"); } finally {setBusy(false);} }
  return <main className="mx-auto max-w-4xl space-y-5 p-6"><Link href="/schools">Schools</Link><h1 className="text-2xl font-bold">School site operations</h1>
    {error && <p role="alert">{error}</p>}{result && <p role="status">{result}</p>}
    {!view ? <p>Checking platform operator access…</p> : <><p>{view.school.name}. School {view.school.status}. No school fact approval is available to platform operators.</p>
      {view.profile ? <p>Managed renderer {view.profile.rendererKey}/{view.profile.version}. Site {view.profile.status}. {view.profile.published ? "Publication exists." : "No publication. Activation blocked."}</p> : <div><p>No managed profile. Provision only the code-owned synthetic renderer for synthetic testing; OBHIS is not registered.</p><button className={button} disabled={busy} onClick={() => run(async () => {if (window.confirm("Provision the synthetic managed renderer for this school?")) await provision({schoolId,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});})}>Provision synthetic renderer</button></div>}
      <p>Readiness needs unexpired 30-day school TXT ownership, exact production Vercel assignment, serving DNS route, trusted HTTPS certificate and deployment marker. Observations expire after 15 minutes. The five-minute maintenance checks at most 20 due hosts; excess capacity can become unavailable. Viewing this page makes no provider call.</p>
      <label className="block">Canonical hostname for alias activation<select className="block w-full border p-2" value={canonical} onChange={e => setCanonical(e.target.value)}><option value="">Choose for redirect alias only</option>{view.domains.filter(d => d.canonicalIntent === "canonical" && d.status === "active").map(d => <option value={d.id} key={d.id}>{d.hostname}</option>)}</select></label>
      {view.domains.map(d => <section key={d.id} className="space-y-2 rounded border p-4"><h2 className="font-semibold">{d.hostname}</h2><p>Status {d.status}. Intent {d.canonicalIntent}. {d.renewalRequired ? "Renewal required: TXT challenge expires or enters its final seven days." : `TXT expires ${new Date(d.expiresAt!).toLocaleString()}`} {d.observationFresh ? "Current observations at view time, rechecked on activation." : "Readiness observations missing or stale."}</p>{d.providerOperation && <p role="alert">Provider {d.providerOperation.operation} {d.providerOperation.state}. Public serving and further writes, rotation and retirement are blocked until a read-only positive provider reconciliation. A missing provider record cannot automatically prove a POST did not land. Reconciliation available after {new Date(d.providerOperation.reconcileAfter).toLocaleString()}.</p>}{d.providerOperation && <button className={button} disabled={busy || Date.now() < d.providerOperation.reconcileAfter} onClick={() => run(async () => {await reconcile({domainId:d.id}); setResult("Read-only provider confirmation cleared the write reservation.");})}>Reconcile provider write</button>}<p>Ownership {d.ownershipObservedAt ? new Date(d.ownershipObservedAt).toLocaleString() : "not checked"}. Routing {d.routingObservedAt ? new Date(d.routingObservedAt).toLocaleString() : "not checked"}. TLS {d.tlsObservedAt ? new Date(d.tlsObservedAt).toLocaleString() : "not checked"}.</p>
        <button className={button} disabled={busy} onClick={() => run(async () => {setGuidance(null); const r = await fetchInstructions({domainId:d.id}); setGuidance(r); setResult(`Fetched provider DNS and verification instructions for ${r.hostname}. These are not readiness evidence.`);})}>Fetch DNS and verification instructions</button>
        {guidance?.hostname === d.hostname && <div aria-label={`DNS instructions for ${d.hostname}`} className="space-y-1 rounded border p-3"><p>Provider ownership verified: {guidance.verified ? "yes" : "no"}. DNS owner must publish applicable records before a separate readiness check.</p>
          {guidance.verification.map((record,i) => <p key={i}>Verification record owner {record.name}, type {record.type}, value {record.value}. Reason: {record.reason}</p>)}
          <p>Routing record owner {d.hostname}, type CNAME: {dnsRecommendations(guidance.recommendedCNAME)}</p>
          <p>Routing record owner {d.hostname}, type A: {dnsRecommendations(guidance.recommendedIPv4)}</p></div>}
        <button className={button} disabled={busy} onClick={() => run(async () => {const r = await check({domainId:d.id}); setResult(`Read-only check ${r.ready ? "ready" : "blocked"}. Provider recommendations: CNAME ${dnsRecommendations(r.recommendedCNAME)}, IPv4 ${dnsRecommendations(r.recommendedIPv4)}. Share only actual recommended records with DNS owner.`);})}>Run read-only readiness check</button>
        <label className="block">Provider operation confirmation for {d.hostname}<input className="block w-full border p-2" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={`CONFIRM ATTACH ${d.hostname}`} /></label>
        {(["attach","verify"] as const).map(operation => <button className={button} key={operation} disabled={busy || !!d.providerOperation || confirmation !== `CONFIRM ${operation.toUpperCase()} ${d.hostname}`} onClick={() => run(async () => {if (!window.confirm(`${operation} ${d.hostname} on the configured live Vercel project? This is a separate provider write and requires SITES_ALLOW_PROVIDER_WRITES=enabled.`)) return; const response = await provider({domainId:d.id,operation,confirmation}); setConfirmation(""); setGuidance(null); setResult(operation === "attach" ? `Provider attach response received (${response.verified ? "verified" : "not yet verified"}). Fetch DNS and verification instructions before checking readiness.` : "Provider verification response received. Fetch instructions or run a separate readiness check.");})}>{operation === "attach" ? "Attach to provider" : "Request provider verification"}</button>)}
        <button className={button} disabled={busy || !!d.providerOperation || !view.profile?.published || !d.observationFresh || (d.canonicalIntent === "redirect" && !canonical)} onClick={() => run(async () => {if (!window.confirm(`Activate ${d.hostname} for public traffic? Confirm school owner, current evidence and DNS cutover independently.`)) return; await activate({domainId:d.id,...(d.canonicalIntent === "redirect" ? {canonicalDomainId:canonical as Id<"schoolDomains">} : {})}); setResult("Activation committed; public ingress still depends on live configuration and fresh checks.");})}>Activate host</button>
        <button className={button} disabled={busy || !!d.providerOperation || d.status !== "active"} onClick={() => run(async () => {if (window.confirm(`Suspend ${d.hostname} immediately?`)) await suspend({domainId:d.id});})}>Suspend</button>
        <button className={button} disabled={busy || !!d.providerOperation || d.status === "retired"} onClick={() => run(async () => {if (window.confirm(`Retire ${d.hostname} and keep its name reserved? This cannot be undone here.`)) await retire({domainId:d.id});})}>Retire</button>
      </section>)}
    </>}
  </main>;
}
