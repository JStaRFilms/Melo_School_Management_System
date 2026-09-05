"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";

const assets = api.functions.academic.assets;
type Area = "library" | "archive" | "trash";
const control = "rounded border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:opacity-50";
const bytes = (n: number | null) => n === null ? "not recorded" : `${n.toLocaleString()} bytes`;
const date = (n: number | null) => n === null ? "not recorded" : new Date(n).toLocaleString();

export default function AssetsWorkspace({ area }: { area: Area }) {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const allowed = useQuery(api.functions.academic.rbac.hasViewerCapability, schoolId ? { schoolId, capability: "assets.library.view" } : "skip");
  const workspace = useQuery(assets.getWorkspace, schoolId && allowed ? { schoolId } : "skip");
  if (allowed === false) return <p role="alert">Asset library access denied.</p>;
  if (!schoolId || !workspace) return <p role="status">Loading asset workspace…</p>;
  if (area === "trash" && !workspace.capabilities.includes("assets.trash.manage")) return <p role="alert">Trash access denied. <Link href="/admin/assets">Return to library</Link></p>;
  return <Library key={`${schoolId}:${area}`} schoolId={schoolId} workspace={workspace} area={area} />;
}

function Library({ schoolId, workspace, area }: { schoolId: Id<"schools">; workspace: FunctionReturnType<typeof assets.getWorkspace>; area: Area }) {
  const { results, status, loadMore } = usePaginatedQuery(assets.listAssets, { schoolId, workspace: area }, { initialNumItems: 30 });
  const shared = useQuery(assets.listSharedAssets, area === "library" ? { schoolId } : "skip");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [scan, setScan] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Id<"schoolAssets"> | null>(null);
  const inspectionTrigger = useRef<HTMLButtonElement | null>(null);
  const filtered = results.filter(a => `${a.fileName} ${a.description} ${a.category}`.toLowerCase().includes(search.toLowerCase()) && (!kind || a.mimeType.includes(kind)) && (!scan || a.scanStatus === scan) && (!category || a.category === category));
  const m = workspace.storage;
  return <main className="mx-auto max-w-5xl space-y-4 p-4 text-slate-900">
    <h1 className="text-xl font-semibold">School Assets {area === "library" ? "library" : area === "archive" ? "Archive" : "Trash"}</h1>
    <nav aria-label="Asset workspaces" className="flex flex-wrap gap-4">
      <Link aria-current={area === "library" ? "page" : undefined} href="/admin/assets">Library</Link>
      <Link aria-current={area === "archive" ? "page" : undefined} href="/admin/assets/archive">Asset Archive</Link>
      {workspace.capabilities.includes("assets.trash.manage") && <Link aria-current={area === "trash" ? "page" : undefined} href="/admin/assets/trash">Trash</Link>}
      <Link href="/academic/archived-records">Academic Archive (separate)</Link>
    </nav>
    <p>Private branch-owned files, separate from lesson knowledge. Antivirus is unconfigured: no file is cleared for download, even with a recorded clean flag. No public links.</p>
    <section aria-label="Storage accounting" className="space-y-1 border-y py-3">
      {m ? <><p>Active (including Archive): {bytes(m.active)} · Trash: {bytes(m.trash)} · Temporary / rollback: {bytes(m.temp)}</p><p>Consumed: {bytes(m.consumed)} · Reserved: {bytes(m.reserved)} · Available: {bytes(m.available)} / {bytes(m.allocated)}</p></> : <p>No storage allocation recorded; uploads cannot finalize.</p>}
      <p>Trash remains charged until deletion succeeds. Missing buckets are unknown, not zero. Knowledge-library and abandoned-upload coverage are not reconciled.</p>
      <p>File cap: {bytes(workspace.maxFileSizeBytes)} ({workspace.policyReference ? `policy: ${workspace.policyReference}` : "25 MB technical default; plan entitlement not established"}). New Trash recovery policy: {workspace.trashRetentionDays} days; existing item deadlines and holds take precedence.</p>
    </section>
    {area === "archive" && <p>Archive keeps files indefinitely without a Trash countdown and still charges active storage. Moving to Trash starts the configured recovery policy.</p>}
    {area === "trash" && <p>Restore retains original owner, archive status and explicit shares. Expired items still shown have not been purged: held or pending/failed cleanup. Bytes remain charged; authorized confirmed purge can retry deletion.</p>}
    {area === "library" && workspace.capabilities.includes("assets.upload") && (
      workspace.uploadAvailable
        ? <Upload schoolId={schoolId} cap={workspace.maxFileSizeBytes} onUploaded={setSelected} />
        : <p role="status">Uploads unavailable: secure tenant ownership, purchased-quota reservation, and abandoned-upload cleanup are not supported by the current storage transport.</p>
    )}
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Search loaded assets<input className={`${control} w-full`} value={search} onChange={e => setSearch(e.target.value)} type="search" /></label>
      <label>Kind<select className={`${control} w-full`} value={kind} onChange={e => setKind(e.target.value)}><option value="">All kinds</option><option value="pdf">PDF</option><option value="image/">Image</option><option value="wordprocessingml">Document</option><option value="spreadsheetml">Spreadsheet</option></select></label>
      <label>Recorded scan state<select className={`${control} w-full`} value={scan} onChange={e => setScan(e.target.value)}><option value="">All states</option>{["quarantined", "scanning", "failed", "clean", "infected"].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Category<select className={`${control} w-full`} value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{[...new Set(results.map(a => a.category))].filter(Boolean).map(c => <option key={c}>{c}</option>)}</select></label>
    </div>
    <p>Search and filters cover loaded records only. Load more to continue the inventory.</p>
    {status === "LoadingFirstPage" ? <p role="status">Loading assets…</p> : !filtered.length ? <p role="status">No matching loaded assets.</p> : <ul className="divide-y">{filtered.map(a => <li key={a._id} className="space-y-1 py-3 [overflow-wrap:anywhere]">
      <button className={`${control} text-left`} onClick={e => { inspectionTrigger.current = e.currentTarget; setSelected(a._id); }} aria-label={`Inspect ${a.fileName}`}>{a.fileName}</button>
      <p>{a.mimeType} · {bytes(a.byteSize)} · {a.category || "Uncategorized"}</p>
      <p>Recorded: {a.scanStatus}; signature: {a.validationStatus}. Download unavailable.</p>
      {a.isTrashed && <p>Recovery deadline: {date(a.purgeScheduledAt)} · {a.purgeScheduledAt === null ? "Deadline unknown" : a.purgeScheduledAt <= Date.now() ? "Expired — retained/pending cleanup" : `${Math.ceil((a.purgeScheduledAt - Date.now()) / 86400000)} days remaining (unless held)`}</p>}
    </li>)}</ul>}
    {status !== "Exhausted" && <button className={control} disabled={status !== "CanLoadMore"} onClick={() => loadMore(30)}>{status === "LoadingMore" ? "Loading more…" : "Load more assets"}</button>}
    {area === "library" && <section aria-label="Shared with this branch"><h2 className="font-semibold">Explicitly shared with this branch</h2><p>Read-only metadata; owner controls lifecycle. Shared bytes are charged to the owning branch, not duplicated here.</p>{shared?.rows.length ? <ul>{shared.rows.map(a => <li key={a._id} className="border-b py-2 [overflow-wrap:anywhere]"><details><summary>{a.fileName} — {a.ownerSchoolName}</summary><p>{a.description} · {a.category} · {a.mimeType} · {bytes(a.byteSize)}</p><p>Recorded scan: {a.scanStatus}; downloads and source-branch operational details remain unavailable.</p></details></li>)}</ul> : <p>{shared ? "No active explicit shares." : "Loading shared metadata…"}</p>}{shared?.truncated && <p>First 50 grants only; contact the owning branch for further inventory.</p>}</section>}
    {selected && <Inspector key={selected} schoolId={schoolId} assetId={selected} capabilities={workspace.capabilities} close={() => { setSelected(null); inspectionTrigger.current?.focus(); }} />}
  </main>;
}

function Upload({ schoolId, cap, onUploaded }: { schoolId: Id<"schools">; cap: number; onUploaded: (id: Id<"schoolAssets">) => void }) {
  const intent = useMutation(assets.createAssetUploadIntent);
  const finalize = useMutation(assets.finalizeAssetUpload);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<{ storageId: Id<"_storage">; intentId: Id<"assetUploadIntents">; name: string } | null>(null);
  const upload = async () => {
    if (!file && !pending) return;
    setProgress(0); setMessage("Preparing private upload…");
    try {
      let binding = pending;
      if (!binding && file) {
        if (!file.size || file.size > cap) throw new Error("Choose a nonempty file within the configured cap.");
        const request = await intent({ schoolId });
        const storageId = await new Promise<Id<"_storage">>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", request.uploadUrl);
          xhr.timeout = 120000;
          xhr.ontimeout = () => reject(new Error("Upload timed out; storage outcome unknown. Contact an administrator before retrying to avoid duplicate bytes."));
          xhr.setRequestHeader("Content-Type", `${file.type || "application/octet-stream"}; school-asset-intent=${request.intentId}`);
          xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
          xhr.onerror = () => reject(new Error("Storage upload failed. No asset clearance or freed-storage claim."));
          xhr.onload = () => {
            try {
              const data: unknown = JSON.parse(xhr.responseText);
              if (xhr.status < 200 || xhr.status >= 300 || !data || typeof data !== "object" || !("storageId" in data) || typeof data.storageId !== "string") throw new Error("Storage upload response invalid");
              // The upload endpoint returns a Convex storage ID; finalization validates the binding server-side.
              resolve(data.storageId as Id<"_storage">);
            } catch { reject(new Error("Storage upload failed; contact an administrator if bytes were already sent.")); }
          };
          xhr.send(file);
        });
        binding = { storageId, intentId: request.intentId, name: file.name }; setPending(binding);
      }
      if (!binding) return;
      setMessage("Finalizing authoritative storage metadata; not scanning…");
      const result = await finalize({ schoolId, uploadIntentId: binding.intentId, storageId: binding.storageId, fileName: binding.name, category: "General" });
      setPending(null); setFile(null); setMessage("Uploaded into quarantine. Antivirus unavailable; download remains blocked."); onUploaded(result.assetId);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed. Retry finalization without uploading another copy."); }
    finally { setProgress(null); }
  };
  return <section aria-label="Upload private asset" className="space-y-2 border-b pb-3">
    <label>Private file<input type="file" className="block w-full" disabled={progress !== null || !!pending} accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <p>Upload success is not a clean scan. Server checks storage size/type/quota; signature inspection is internal. Do not navigate away during upload or finalization retry.</p>
    <button className={control} disabled={progress !== null || (!file && !pending)} onClick={() => void upload()}>{pending ? "Retry finalization" : "Upload to quarantine"}</button>
    {pending && progress === null && <button className={control} onClick={() => { setPending(null); setFile(null); setMessage("Finalization retry stopped. Uploaded storage was not deleted or credited; contact your administrator."); }}>Stop retrying (does not delete storage)</button>}
    {progress !== null && <progress aria-label="Upload bytes progress (not scan progress)" max={100} value={progress} />}
    {message && <p role="status">{message}</p>}
  </section>;
}

function Inspector({ schoolId, assetId, capabilities, close }: { schoolId: Id<"schools">; assetId: Id<"schoolAssets">; capabilities: string[]; close: () => void }) {
  const asset = useQuery(assets.inspectAsset, { schoolId, assetId });
  const heading = useRef<HTMLHeadingElement | null>(null);
  const loaded = !!asset;
  useEffect(() => { if (loaded) heading.current?.focus(); }, [assetId, loaded]);
  const recipients = useQuery(assets.listShareRecipients, capabilities.includes("assets.group_share.manage") ? { schoolId } : "skip");
  const edit = useMutation(assets.editMetadata); const archive = useMutation(assets.setArchived);
  const trash = useMutation(assets.trashAsset); const restore = useMutation(assets.restoreAsset);
  const hold = useMutation(assets.applyRetentionHold); const release = useMutation(assets.removeRetentionHold);
  const purge = useMutation(assets.permanentPurgeAsset); const share = useMutation(assets.setBranchShare);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const run = async (operation: () => Promise<unknown>, dismiss = false) => { setBusy(true); setError(""); try { await operation(); setConfirmation(""); if (dismiss) close(); } catch (e) { setError(e instanceof Error ? e.message : "Operation failed; no successful deletion or storage release claimed."); } finally { setBusy(false); } };
  if (!asset) return <p role="status">Loading inspection…</p>;
  const can = (cap: string) => capabilities.includes(cap);
  const target = { schoolId, assetId };
  return <section aria-label={`Inspect ${asset.fileName}`} className="space-y-3 border-t py-4 [overflow-wrap:anywhere]">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 ref={heading} tabIndex={-1} className="font-semibold">Inspect {asset.fileName}</h2><button className={control} onClick={close}>Close inspection</button></div>
    {error && <p role="alert">{error}</p>}
    <p>Owner: {asset.ownerName} · Owning branch: {asset.schoolId} · Scope: private branch; explicit recipient shares only.</p>
    <p>Uploaded {date(asset.createdAt)} · Updated {date(asset.updatedAt)} · Trashed {date(asset.trashedAt)} by {asset.trashedByUserId ?? "not recorded"}</p>
    <p>SHA-256: {asset.sha256} · {asset.mimeType} · {bytes(asset.byteSize)}</p>
    <p>Recorded scanner state: {asset.scanStatus}; signature: {asset.validationStatus}. AV unconfigured; no clearance.</p>
    {asset.scanFailureCode && <p role="alert">Scan failure: {asset.scanFailureCode}. File remains locked; controlled security review/retry required. No provider retry is exposed here.</p>}
    <button className={control} disabled>Download unavailable — private AV delivery gate</button>
    {!asset.accountingReady && <p role="alert">Storage accounting requires controlled reconciliation. Restore, Trash and purge remain blocked.</p>}
    <form key={asset.updatedAt} className="grid gap-2" onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void run(() => edit({ ...target, expectedUpdatedAt: asset.updatedAt, fileName: String(data.get("name") ?? ""), category: String(data.get("category") ?? ""), description: String(data.get("description") ?? "") })); }}>
      <label>Name<input className={`${control} w-full`} name="name" maxLength={200} required defaultValue={asset.fileName} disabled={asset.isTrashed || !can("assets.metadata.edit")} /></label>
      <label>Category<input className={`${control} w-full`} name="category" maxLength={80} defaultValue={asset.category} disabled={asset.isTrashed || !can("assets.metadata.edit")} /></label>
      <label>Description<textarea className={`${control} w-full`} name="description" maxLength={1000} defaultValue={asset.description} disabled={asset.isTrashed || !can("assets.metadata.edit")} /></label>
      {!asset.isTrashed && can("assets.metadata.edit") && <button className={control} disabled={busy}>Save metadata</button>}
    </form>
    <div className="flex flex-wrap gap-2">
      {!asset.isTrashed && can("assets.archive.manage") && <button className={control} disabled={busy} onClick={() => void run(() => archive({ ...target, archived: !asset.archivedAt }), true)}>{asset.archivedAt ? "Return to library" : "Archive (keep active storage)"}</button>}
      {!asset.isTrashed && can("assets.trash.manage") && <button className={control} disabled={busy || !asset.accountingReady} onClick={() => void run(() => trash(target), true)}>Move to Trash</button>}
      {asset.isTrashed && can("assets.restore") && <button className={control} disabled={busy || !asset.accountingReady} onClick={() => void run(() => restore(target), true)}>Restore to {asset.archivedAt ? "Archive" : "library"}</button>}
    </div>
    <h3 className="font-semibold">Retention holds</h3>
    {!asset.holds.length && <p>No retention hold recorded.</p>}
    <ul>{asset.holds.map(h => <li key={h._id}>{h.reason} · {date(h.appliedAt)} {can("assets.holds.remove") ? <button className={control} disabled={busy} onClick={() => void run(() => release({ schoolId, holdId: h._id }))}>Release hold: {h.reason}</button> : <span>Proprietor hold-removal authority required.</span>}</li>)}</ul>
    {can("assets.holds.apply") && can("assets.trash.manage") && <div className="space-y-2"><label>Retention reason<input className={`${control} w-full`} value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></label><button className={control} disabled={busy || !reason.trim()} onClick={() => void run(() => hold({ ...target, holdReason: reason }))}>Apply retention hold</button></div>}
    {asset.isTrashed && can("assets.permanent_delete") && <div className="space-y-2 border-t pt-3"><p>Permanent deletion cannot be undone. Exact target: {asset.fileName} ({assetId}). Active holds block deletion. Existing deadline: {date(asset.purgeScheduledAt)}.</p><label>Type PURGE {asset.fileName}<input className={`${control} w-full`} autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><button className={control} disabled={busy || !!asset.holds.length || !asset.accountingReady || confirmation !== `PURGE ${asset.fileName}`} onClick={() => void run(() => purge({ ...target, confirmation }), true)}>Permanently purge this asset</button></div>}
    <h3 className="font-semibold">Explicit branch sharing</h3>
    <p>Group membership alone grants nothing. Metadata sharing never enables file downloads. Restore preserves these grants.</p>
    <ul>{asset.shares.map(s => <li key={s._id}>{s.schoolId} {can("assets.group_share.manage") && <button className={control} disabled={busy} onClick={() => void run(() => share({ ...target, recipientSchoolId: s.schoolId, shared: false }))}>Revoke share</button>}</li>)}</ul>
    {!asset.isTrashed && recipients && <div className="flex flex-wrap gap-2">{recipients.filter(r => !asset.shares.some(s => s.schoolId === r.schoolId)).map(r => <button className={control} key={r.schoolId} disabled={busy} onClick={() => void run(() => share({ ...target, recipientSchoolId: r.schoolId, shared: true }))}>Share metadata with {r.name}</button>)}{!recipients.length && <p>No permitted recipient branches.</p>}</div>}
    <h3 className="font-semibold">PDF optimization and rollback</h3>
    <p>{asset.pdfEligibility}. Signed, encrypted, form-sensitive, malformed and unsupported files must remain unchanged. No image recompression or savings claim.</p>
    <p>Recorded optimized state: {asset.isOptimized ? "yes (historical evidence only)" : "no"}. Rollback original: {asset.hasRollbackOriginal ? `retained; deadline ${date(asset.rollbackExpiryAt)}` : "not recorded"}. Expiry is not proof of cleanup. Rollback is internal only.</p>
    <button className={control} disabled>Optimize unavailable — runtime/fidelity gate</button>
    {!asset.candidates.length ? <p>No candidate verification evidence recorded.</p> : <ul>{asset.candidates.map(c => <li key={c._id}>{c.status}: {c.reason ?? "Structural evidence only; promotion unavailable"} · {date(c.verifiedAt)} · cleanup due {date(c.cleanupScheduledAt)}</li>)}</ul>}
  </section>;
}
