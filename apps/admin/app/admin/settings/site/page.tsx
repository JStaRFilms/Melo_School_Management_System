"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { siteManifest, validateSiteContent, type SiteContentV1, type PreviewSiteV1 } from "@school/shared/site-manifests";
import { useAuth } from "@/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";
import { SettingsNavigationTabs } from "../components/SettingsNavigationTabs";

const sites = api.functions.sites;
const input = "block w-full rounded border border-slate-300 bg-white p-2 text-slate-950";
const button = "rounded border border-slate-300 bg-white px-3 py-2 disabled:opacity-50";
const empty: SiteContentV1 = { fields: [], routeSeo: [] };
type View = Awaited<ReturnType<ReturnType<typeof useAction<typeof sites.management.schoolView>>>>;

export default function SiteSettingsPage() {
  const { workspaceAccess } = useAuth();
  if (!isConvexConfigured()) return <p role="alert">Site settings require a configured private backend.</p>;
  if (workspaceAccess?.state !== "ready") return <p role="alert">School settings access unavailable.</p>;
  return <SiteEditor key={workspaceAccess.branch.schoolId} schoolId={workspaceAccess.branch.schoolId as Id<"schools">} />;
}

function SiteEditor({ schoolId }: { schoolId: Id<"schools"> }) {
  const read = useAction(sites.management.schoolView);
  const save = useMutation(sites.content.saveDraft);
  const preview = useAction(sites.content.previewDraft);
  const validate = useAction(sites.content.validateDraft);
  const publish = useMutation(sites.content.publishDraft);
  const revert = useMutation(sites.content.revertToDraft);
  const candidate = useAction(sites.evidence.getFieldCandidate);
  const approve = useMutation(sites.evidence.approveCandidate);
  const requestDomain = useMutation(sites.domains.requestDomain);
  const instructions = useMutation(sites.domains.getInstructions);
  const rotate = useMutation(sites.domains.rotateChallenge);
  const [view, setView] = useState<View | null>(null);
  const [content, setContent] = useState<SiteContentV1>(empty);
  const [version, setVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftPreview, setDraftPreview] = useState<PreviewSiteV1 | null>(null);
  const [review, setReview] = useState<Awaited<ReturnType<typeof candidate>> | null>(null);
  const [assetCandidate, setAssetCandidate] = useState<{ kind: "asset_rights" | "asset_child_applicability" | "asset_child_consent"; assetId: Id<"schoolSiteAssets">; expectedChecksum: string; classification?: "no_children" | "contains_children" } | null>(null);
  const [reference, setReference] = useState("");
  const [expiry, setExpiry] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [hostname, setHostname] = useState("");
  const [intent, setIntent] = useState<"canonical" | "redirect">("canonical");
  const [txt, setTxt] = useState<{recordName: string; recordValue: string; expiresAt: number} | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [decorative, setDecorative] = useState(false);
  const [uploadKind, setUploadKind] = useState<"hero" | "logo" | "favicon" | "gallery" | "staff" | "facility" | "social_share">("hero");
  const [validation, setValidation] = useState<boolean | null>(null);
  async function load(replace = false) {
    const result = await read({ schoolId });
    setView(result);
    if (replace) { setContent(result.draft?.content ?? empty); setVersion(result.draft?.version ?? 0); setDirty(false); }
  }
  useEffect(() => { let alive = true; read({ schoolId }).then(result => { if (alive) { setView(result); setContent(result.draft?.content ?? empty); setVersion(result.draft?.version ?? 0); } }).catch(e => { if (alive) setError(String(e)); }); return () => { alive = false; }; }, [read, schoolId]);
  async function run(fn: () => Promise<unknown>, reload = true) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); if (reload) await load(); } catch (e) { setError(e instanceof Error ? e.message : "Operation denied"); } finally { setBusy(false); }
  }
  const manifest = view?.profile ? siteManifest(view.profile.rendererKey ?? "", view.profile.rendererSchemaVersion ?? "") : null;
  function textField(fieldId: string, value: string) {
    setContent(old => ({ ...old, fields: [...old.fields.filter(f => f.fieldId !== fieldId), ...(value ? [{ fieldId, value: { kind: "text" as const, value } }] : [])] })); setDirty(true); setValidation(null);
  }
  if (!view) return <p role="status">Loading private site settings… {error}</p>;
  return <main className="space-y-6 p-6 text-slate-900"><SettingsNavigationTabs /><h1 className="text-2xl font-bold">School site</h1>
    <p>Managed site settings are private. Drafts never update the published site. Reviewers must inspect an independent source before approval.</p>
    {error && <p role="alert" className="text-red-700">{error} {error.includes("DRAFT_VERSION_CONFLICT") && "Your edits are still here. Copy them before reloading; do not overwrite another editor's changes."}</p>}
    {notice && <p role="status">{notice}</p>}
    {!manifest ? <p role="alert">No managed renderer is provisioned. Ask a platform operator to select the synthetic test renderer. This school cannot choose or change it.</p> : <>
      <p>Renderer: {manifest.rendererKey} / {manifest.schemaVersion}. Status: {view.profile?.status}.{view.canEdit ? ` Draft version: ${version}. ${dirty ? "Unsaved changes" : "Saved view"}.` : ""}</p>
      {view.canEdit && <>
      <section className="space-y-3" aria-label="Draft fields"><h2 className="text-xl font-semibold">Draft content</h2>
        {manifest.fields.filter(f => f.kind === "text").map(f => <label key={f.fieldId} className="block">{f.fieldId}{f.required ? " (required)" : ""}
          <textarea className={input} maxLength={f.maxLength} value={content.fields.find(item => item.fieldId === f.fieldId)?.value.kind === "text" ? (content.fields.find(item => item.fieldId === f.fieldId)?.value as {kind:"text";value:string}).value : ""} onChange={e => textField(f.fieldId, e.target.value)} /></label>)}
        <label className="block">Hero image asset ID (from uploaded school assets)
          <select className={input} value={content.fields.find(f => f.fieldId === "hero_image")?.value.kind === "asset_ref" ? (content.fields.find(f => f.fieldId === "hero_image")?.value as {kind:"asset_ref";assetId:string}).assetId : ""} onChange={e => { const id = e.target.value; setContent(old => ({...old,fields:[...old.fields.filter(f => f.fieldId !== "hero_image"), ...(id ? [{fieldId:"hero_image",value:{kind:"asset_ref" as const,assetId:id}}] : [])]})); setDirty(true); }}><option value="">No image</option>{view.assets.filter(a => a.kind === "hero").map(a => <option key={a.id} value={a.id}>{a.fileName} ({a.rightsStatus})</option>)}</select></label>
        <h3 className="font-semibold">Search metadata</h3>{manifest.routes.map(route => { const seo = content.routeSeo.find(s => s.routeId === route.routeId); return <div key={route.routeId}><p>{route.path}</p>{(["title", "description"] as const).map(key => <label key={key} className="block">{route.routeId} {key}<input className={input} maxLength={key === "title" ? 120 : 300} value={seo?.[key] ?? ""} onChange={e => { const value = e.target.value; setContent(old => ({...old, routeSeo: [...old.routeSeo.filter(s => s.routeId !== route.routeId), {routeId:route.routeId,...seo,[key]:value || undefined}]})); setDirty(true); }} /></label>)}</div>; })}
        <button className={button} disabled={busy} onClick={() => run(async () => { validateSiteContent(content,manifest); const result = await save({schoolId,content:content as Parameters<typeof save>[0]["content"],expectedDraftVersion:version}); setVersion(result.draftVersion); setDirty(false); setNotice("Draft saved. Evidence tied to changed values must be approved again."); })}>Save draft</button>
        <button className={button} disabled={busy} onClick={() => run(async () => { const result = await preview({schoolId}); setDraftPreview(result); }, false)}>Preview authorized draft</button>
        <button className={button} disabled={busy} onClick={() => run(async () => { const result = await validate({schoolId}); setValidation(result.valid); }, false)}>Check publication gates</button>
        {validation !== null && <p role="status">{validation ? "Evidence check passed for this draft at check time. Publish rechecks it." : "Blocked. Check identity reviewer, image rights, child applicability/consent, expiry and publisher independence."}</p>}
        <button className={button} disabled={busy || dirty || !view.draft} onClick={() => run(async () => { if (!window.confirm("Publish this saved draft? Current evidence and reviewer independence will be checked again.")) return; await publish({schoolId,expectedDraftVersion:version}); setNotice("Publication created. Domain activation is separate."); })}>Publish saved draft</button>
      </section>
      {draftPreview && <section aria-label="Private draft preview" className="border-4 border-slate-500 p-4"><h2 className="text-xl font-bold">{draftPreview.watermark}</h2><p>Private preview. noindex,nofollow. No canonical or public asset URL.</p>{draftPreview.fields.map(f => <p key={f.fieldId}>{f.fieldId}: {f.value.kind === "text" ? f.value.value : f.value.kind === "asset_placeholder" ? f.value.message : "Private value"}</p>)}</section>}
      <section className="space-y-2"><h2 className="text-xl font-semibold">Image upload and rights</h2><p>Only image bytes enter the authenticated server upload proxy. An uploaded image is private until an independent reviewer records rights and child classification, and consent if children appear.</p>
        <label className="block">Image type<select className={input} value={uploadKind} onChange={e => setUploadKind(e.target.value as typeof uploadKind)}>{["hero","logo","favicon","gallery","staff","facility","social_share"].map(k => <option key={k}>{k}</option>)}</select></label>
        <label className="block">Image file<input type="file" accept="image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
        <label className="block">Alternative text<input className={input} value={alt} onChange={e => setAlt(e.target.value)} /></label><label><input type="checkbox" checked={decorative} onChange={e => setDecorative(e.target.checked)} /> Decorative image</label>
        <button className={button} disabled={!file || busy} onClick={() => run(async () => { if (!file) return; const response = await fetch("/api/site-assets/upload", {method:"POST",body:file,headers:{"Content-Type":file.type,"X-Site-School":schoolId,"X-Site-Kind":uploadKind,"X-Site-Filename":file.name,"X-Site-Alt":alt,"X-Site-Decorative":String(decorative)}}); if (!response.ok) throw Error("Image upload denied"); setNotice("Image received privately. Request rights and child review before publication."); })}>Upload privately</button>
        {view.assets.map(a => <div key={a.id} className="border p-2"><p>{a.fileName}, {a.kind}, {a.status}, rights {a.rightsStatus}, children {a.childApplicability}{a.rightsExpiresAt ? `, rights expire ${new Date(a.rightsExpiresAt).toLocaleDateString()}` : ""}</p><p>Checksum for reviewer: {a.checksum}</p>{(["asset_rights","asset_child_applicability","asset_child_consent"] as const).map(kind => <button className={button} key={kind} onClick={() => { setReview(null); setAssetCandidate({kind,assetId:a.id,expectedChecksum:a.checksum,classification:undefined}); setConfirmed(false); }}>{kind.replaceAll("_"," ")}</button>)}</div>)}
      </section>
      <section className="space-y-2"><h2 className="text-xl font-semibold">Independent fact review</h2><p>The reviewer must hold a separate school-wide privacy.approve grant. Do not self-approve a fact you will publish.</p>{manifest.fields.filter(f => f.evidence).map(f => <button className={button} key={f.fieldId} disabled={busy} onClick={() => run(async () => { const result = await candidate({schoolId,fieldId:f.fieldId}); setReview(result); setAssetCandidate(null); setConfirmed(false); }, false)}>Review {f.fieldId}</button>)}
        {(review || assetCandidate) && <div className="border p-3 space-y-2"><h3 className="font-semibold">Approval candidate</h3>{review ? <p>{review.fieldId}: {review.value.kind === "text" ? review.value.value : "Typed value"}. Class {review.evidenceClass}. SHA-256 digest {review.digest}</p> : <><p>{assetCandidate?.kind}, asset {assetCandidate?.assetId}, server storage checksum {assetCandidate?.expectedChecksum}</p>{assetCandidate?.kind === "asset_child_applicability" && <label>Child classification<select className={input} value={assetCandidate.classification ?? ""} onChange={e => { setConfirmed(false); setAssetCandidate({...assetCandidate,classification:e.target.value as "no_children" | "contains_children"}); }}><option value="" disabled>Select after reviewing the image</option><option value="no_children">No children</option><option value="contains_children">Contains children, consent required</option></select></label>}</>}
          <label className="block">Independent source reference<input className={input} value={reference} maxLength={500} onChange={e => setReference(e.target.value)} /></label><label className="block">Approval expires on<input className={input} type="date" value={expiry} onChange={e => setExpiry(e.target.value)} /></label>
          <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> I inspected the independent source for this exact value or immutable image checksum and confirm its rights and classification.</label>
          <button className={button} disabled={busy || !confirmed || reference.trim().length < 8 || !expiry || (assetCandidate?.kind === "asset_child_applicability" && !assetCandidate.classification)} onClick={() => run(async () => { const expiresAt = new Date(`${expiry}T23:59:59Z`).getTime(); if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 366 * 86400_000) throw Error("Choose a future expiry within 366 days"); const c = review ? {kind:"field" as const,fieldId:review.fieldId,expectedDigest:review.digest} : assetCandidate?.kind === "asset_child_applicability" ? {kind:"asset_child_applicability" as const,assetId:assetCandidate.assetId,expectedChecksum:assetCandidate.expectedChecksum,classification:assetCandidate.classification!} : assetCandidate?.kind === "asset_rights" ? {kind:"asset_rights" as const,assetId:assetCandidate.assetId,expectedChecksum:assetCandidate.expectedChecksum} : assetCandidate ? {kind:"asset_child_consent" as const,assetId:assetCandidate.assetId,expectedChecksum:assetCandidate.expectedChecksum} : null; if (!c || (c.kind === "asset_child_applicability" && !assetCandidate?.classification)) throw Error("Select child classification before approval"); await approve({schoolId,candidate:c,evidenceReference:reference,expiresAt,confirmed:true}); setReview(null); setAssetCandidate(null); setConfirmed(false); setNotice("Evidence recorded; publication rechecks expiry and publisher independence."); })}>Record independent approval</button></div>}
      </section>
      </>}
      {view.publications.length > 0 && <section><h2 className="text-xl font-semibold">Publication history</h2><p>Latest 20. Revert clones a publication into a private draft and never changes live content until it is reapproved and published.</p>{view.publications.map(r => <p key={r.id}>Revision {r.revisionNumber} {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : ""} {r.current ? "(current)" : ""} <button className={button} disabled={busy} onClick={() => run(async () => { if (!window.confirm("Replace your current private draft with a clone of this publication?")) return; await revert({schoolId,sourceRevisionId:r.id}); await load(true); })}>Clone as draft</button></p>)}</section>}
      {view.canRequestDomain && <section className="space-y-2"><h2 className="text-xl font-semibold">Domain request</h2><p>A domain request does not activate traffic. Give the TXT record to the DNS owner. A challenge lasts 30 days and needs rotation and rechecking before expiry.</p><label className="block">Hostname, without scheme or port<input className={input} value={hostname} onChange={e => setHostname(e.target.value)} /></label><label className="block">Intent<select className={input} value={intent} onChange={e => setIntent(e.target.value as typeof intent)}><option value="canonical">Canonical</option><option value="redirect">Redirect alias</option></select></label><button className={button} disabled={busy} onClick={() => run(async () => { const result = await requestDomain({schoolId,hostname,canonicalIntent:intent}); setTxt(result); })}>Request hostname</button>
        {view.domains.map(d => <div className="border p-2" key={d.id}><p>{d.hostname}: {d.status}. {d.renewalRequired ? "Renewal required: rotate 30-day TXT proof before expiry; rotation interrupts service until checked and reactivated." : `TXT expires ${new Date(d.expiresAt!).toLocaleString()}`}</p><button className={button} disabled={busy} onClick={() => run(async () => { const data = await instructions({schoolId,domainId:d.id}); setTxt(data.recordName && data.recordValue && data.expiresAt ? {recordName:data.recordName,recordValue:data.recordValue,expiresAt:data.expiresAt} : null); },false)}>Show TXT instructions</button><button className={button} disabled={busy} onClick={() => run(async () => { if (!window.confirm("Rotate proof? Active traffic will stop until fresh checks and operator activation.")) return; setTxt(await rotate({schoolId,domainId:d.id})); })}>Rotate TXT proof</button></div>)}
        {txt && <p role="status">Publish TXT {txt.recordName} = {txt.recordValue}. Expires {new Date(txt.expiresAt).toLocaleString()}. The platform operator must check DNS, routing, TLS and deployment marker before activation.</p>}
      </section>}
    </>}
  </main>;
}
