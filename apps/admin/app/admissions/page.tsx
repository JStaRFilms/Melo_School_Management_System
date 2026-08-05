"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { 
  ClipboardCopy, 
  FileKey2, 
  LockKeyhole, 
  RefreshCw, 
  Sliders, 
  ListTodo, 
  UserCheck, 
  FileText, 
  Clock, 
  ShieldAlert, 
  Users, 
  Search,
  Check,
  Building,
  KeyRound,
  FileCheck,
  AlertCircle
} from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { AdminSurface } from "@/components/ui/AdminSurface";
import { 
  canRecordDecision, 
  canReopenDecision, 
  canRequestCorrections, 
  canStartReview, 
  copyCanonicalApplicationLink, 
  decisionReadinessBlockers, 
  documentAccessDeniedMessage, 
  hasScopedCapability, 
  settingsSurfaceAccess, 
  type CapabilityGrant, 
  type ConversionState, 
  type DecisionReadiness, 
  type DocumentAccessDenialReason 
} from "@/admissions/models";
import { AdmissionsSettingsWorkbench } from "./AdmissionsSettingsWorkbench";

type Branding = { schoolId: string; slug: string; name: string };
type CapabilityProjection = { membership: { schoolId: string } | null; capabilities: CapabilityGrant[] };
type Catalogue = { programmes: Array<{ id: string; slug: string; name: string; status: string }>; intakes: Array<{ id: string; programmeId: string; slug: string; name: string; status: string; opensAt: number; closesAt: number }>; products: Array<{ id: string; intakeId: string; slug: string; name: string; status: string }>; forms: Array<{ id: string; intakeId: string | null; version: number; schemaVersion: string; status: string }> };
type Queue = { page: Array<{ applicationId: string; publicId: string; state: string; updatedAt: number; intakeId: string }>; isDone: boolean; continueCursor: string };
type Detail = { applicationId: string; publicId: string; state: string; revision: number; snapshotId: string | null; decisionState: string | null; conversionState: ConversionState | null; documentCount: number; profile: { firstName: string; lastName: string; middleName: string | null; preferredName: string | null; dateOfBirth: number; gender: string | null; nationality: string | null; countryOfBirth: string | null; address: string | null } | null; answers: Array<{ key: string; label: string; valueType: string; value: string | null; dataClass: string; redacted: boolean }>; sensitiveAnswerCount: number; decisionReadiness: DecisionReadiness } | null;
type DocumentRow = { documentId: string; documentKey: string; category: string; state: string; sensitivity: string; version: number; updatedAt: number };
type DocumentAccessResult = { status: "available"; url: string } | { status: "unavailable"; denialReason?: DocumentAccessDenialReason };
type ReviewAssignment = { assignmentId: string; assigneeUserId: string; name: string; role: string };

function Denied({ capability }: { capability: string }) { 
  return <div role="status" className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-950 shadow-sm flex items-start gap-2.5">
    <LockKeyhole className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div>
      <span className="font-bold flex items-center gap-1">Access Required: {capability}</span>
      <p className="mt-1 text-xs text-amber-900 leading-relaxed">This is an explicit school, programme, and intake-scoped capability. The server checks it again.</p>
    </div>
  </div>; 
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { 
  return <label className="block text-xs font-bold text-slate-700">{label}
    <input type={type} value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-all" />
  </label>; 
}

export default function AdmissionsPage() {
  const branding = useQuery("functions/academic/schoolBranding:getCurrentSchoolBranding" as never, {} as never) as Branding | undefined;
  const capabilities = useQuery("functions/foundation/auth:getViewerCapabilities" as never, branding ? { schoolId: branding.schoolId } as never : "skip" as never) as CapabilityProjection | undefined;
  const catalogueAllowed = hasScopedCapability(capabilities?.capabilities, "admissions.catalogue.manage", {});
  const publishAllowed = hasScopedCapability(capabilities?.capabilities, "admissions.publish", {});
  const catalogue = useQuery("functions/admissions/settings:getCatalogue" as never, branding && catalogueAllowed ? { schoolId: branding.schoolId } as never : "skip" as never) as Catalogue | undefined;
  const publicationReview = useQuery("functions/admissions/settings:getPublicationReview" as never, branding && publishAllowed ? { schoolId: branding.schoolId } as never : "skip" as never) as Catalogue | undefined;
  const queueIntakes = useQuery("functions/admissions/staff:listAccessibleIntakes" as never, branding && capabilities ? { schoolId: branding.schoolId } as never : "skip" as never) as Array<{ intakeId: string; name: string; status: string }> | undefined;
  const canonicalLink = useQuery("functions/foundation/applicationLinks:getApplicationLink" as never, branding ? { schoolSlug: branding.slug } as never : "skip" as never) as { href: string; availability: string } | undefined;
  const [intakeId, setIntakeId] = useState(""); const [state, setState] = useState(""); const [cursor, setCursor] = useState<string | null>(null); const [previousCursors, setPreviousCursors] = useState<Array<string | null>>([]); const [selectedId, setSelectedId] = useState<string | null>(null);
  const queue = useQuery("functions/admissions/staff:listQueuePage" as never, branding && intakeId ? { schoolId: branding.schoolId, intakeId, ...(state ? { state } : {}), paginationOpts: { numItems: 25, cursor } } as never : "skip" as never) as Queue | undefined;
  const detail = useQuery("functions/admissions/staff:getApplicationDetail" as never, selectedId ? { applicationId: selectedId } as never : "skip" as never) as Detail | undefined;
  const can = (capability: CapabilityGrant["capability"], scope: { intakeId?: string } = {}) => hasScopedCapability(capabilities?.capabilities, capability, scope);
  const chooseIntake = (value: string) => { setIntakeId(value); setCursor(null); setPreviousCursors([]); setSelectedId(null); };
  
  return <main className="min-h-screen bg-slate-50/50 px-4 py-6 md:px-8"><div className="mx-auto max-w-7xl space-y-6"><AdminHeader label="Admissions" title="Admissions operations and settings" description={branding ? `Tenant-scoped workspace for ${branding.name}.` : "Loading your school context…"} />
    <section>
      <CanonicalLink link={canonicalLink} />
      <AdminSurface intensity="medium" rounded="2xl" className="mt-4 p-5">
        <details className="group [&_summary::-webkit-details-marker]:hidden"><summary className="cursor-pointer text-xs font-black text-slate-800 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-slate-500" /> Access details</span>
          <ChevronDown className="h-4 w-4 text-slate-400 group-open:rotate-180 transition-transform" />
        </summary>
        <p className="mt-3 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">Use this diagnostic only to confirm the capabilities currently effective for this school. The server authorizes every action again.</p>
        {capabilities?.membership ? <ul className="mt-3 flex flex-wrap gap-2">{capabilities.capabilities.map((grant, index) => <li key={`${grant.capability}-${index}`} className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700">{grant.capability} · {grant.scope}</li>)}</ul> : <div className="mt-3"><Denied capability="a school membership" /></div>}
        </details>
      </AdminSurface>
    </section>
    <section className="grid gap-6 xl:grid-cols-2"><SettingsPanel branding={branding} catalogue={catalogue} publicationReview={publicationReview} allowed={catalogueAllowed} publishAllowed={publishAllowed} sensitiveAllowed={can("admissions.sensitive.configure")} /><QueuePanel intakes={queueIntakes} allowed={can("applications.list", { intakeId })} intakeId={intakeId} onIntake={chooseIntake} state={state} onState={value => { setState(value); setCursor(null); setPreviousCursors([]); }} queue={queue} onPrevious={() => { const next = previousCursors.at(-1) ?? null; setPreviousCursors(items => items.slice(0, -1)); setCursor(next); }} onNext={() => { if (queue && !queue.isDone) { setPreviousCursors(items => [...items, cursor]); setCursor(queue.continueCursor); } }} onSelect={setSelectedId} /></section>
    <DetailPanel detail={detail} canView={can("applications.view_basic", { intakeId })} canReview={can("documents.review", { intakeId })} canRecord={can("reviews.record", { intakeId })} canAssign={can("reviews.assign", { intakeId })} canDecide={can("decisions.record", { intakeId })} canConvert={can("conversions.execute", { intakeId })} />
  </div></main>;
}

function ChevronDown({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
}

function CanonicalLink({ link }: { link: { href: string; availability: string } | undefined }) { 
  const [copied, setCopied] = useState(false); 
  const copy = async () => { 
    try { 
      if (!link || !await copyCanonicalApplicationLink(link)) throw new Error("Clipboard unavailable"); 
      setCopied(true); 
      appToast.success("Application link copied"); 
      setTimeout(() => setCopied(false), 2000);
    } catch (error) { 
      appToast.error("Could not copy link", { description: getUserFacingErrorMessage(error, "Select and copy the URL manually.") }); 
    } 
  }; 
  return <AdminSurface intensity="medium" rounded="2xl" className="space-y-4 p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><Building size={16} /></div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Canonical public link</p>
        <h2 className="text-sm font-black text-slate-800">External-site application URL</h2>
      </div>
    </div>
    {link ? <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <p className="break-all text-xs font-semibold font-mono text-indigo-950 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">{link.href}</p>
        <p className="text-xs text-slate-500 mt-2">Availability: <strong className="text-slate-800 uppercase tracking-wide text-[10px] bg-slate-200/60 px-1.5 py-0.5 rounded font-black">{link.availability}</strong></p>
      </div>
      <button type="button" onClick={() => void copy()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition-colors flex-shrink-0">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div> : <p className="text-sm text-slate-400 italic">Loading the configured canonical link…</p>}
  </AdminSurface>; 
}

function SettingsPanel({ branding, catalogue, publicationReview, allowed, publishAllowed, sensitiveAllowed }: { branding: Branding | undefined; catalogue: Catalogue | undefined; publicationReview: Catalogue | undefined; allowed: boolean; publishAllowed: boolean; sensitiveAllowed: boolean }) {
  const createProgramme = useMutation("functions/admissions/settings:createProgramme" as never); const createIntake = useMutation("functions/admissions/settings:createIntake" as never); const createProduct = useMutation("functions/admissions/settings:createProduct" as never); const createForm = useMutation("functions/admissions/settings:createDraftForm" as never); const addField = useMutation("functions/admissions/settings:addDraftField" as never); const publishForm = useMutation("functions/admissions/settings:publishForm" as never); const retireForm = useMutation("functions/admissions/settings:retireForm" as never); const setProgrammeStatus = useMutation("functions/admissions/settings:setProgrammeStatus" as never); const setIntakeStatus = useMutation("functions/admissions/settings:setIntakeStatus" as never); const setProductStatus = useMutation("functions/admissions/settings:setProductStatus" as never);
  const [draft, setDraft] = useState({ programmeName: "", programmeSlug: "", intakeName: "", intakeSlug: "", cycle: "", opens: "", closes: "", productName: "Application slot", productSlug: "application", fieldKey: "", fieldLabel: "" }); const [notice, setNotice] = useState("");
  const access = settingsSurfaceAccess({ hasCatalogueCapability: allowed, hasPublishCapability: publishAllowed });
  const reviewCatalogue = access.canEditDrafts ? catalogue : publicationReview;
  const saveCatalogue = async () => { if (!branding) return; try { const programmeId = await createProgramme({ schoolId: branding.schoolId, name: draft.programmeName, slug: draft.programmeSlug } as never); const intakeId = await createIntake({ schoolId: branding.schoolId, programmeId, name: draft.intakeName, slug: draft.intakeSlug, cycleLabel: draft.cycle, opensAt: new Date(draft.opens).getTime(), closesAt: new Date(draft.closes).getTime() } as never); await createProduct({ schoolId: branding.schoolId, intakeId, name: draft.productName, slug: draft.productSlug } as never); const formId = await createForm({ schoolId: branding.schoolId, programmeId, intakeId, schemaVersion: "1" } as never); if (draft.fieldKey && draft.fieldLabel) await addField({ formVersionId: formId, fieldKey: draft.fieldKey, sectionKey: "child", kind: "text", label: draft.fieldLabel, requiredMode: "optional", dataClass: "personal", validationJson: "{}", order: 0 } as never); setNotice("Draft catalogue saved on the server. Publish each item only after checking its disclosures and configuration."); } catch (error) { setNotice(getUserFacingErrorMessage(error, "Could not save this catalogue draft.")); } };
  
  if (!access.allowed) return <AdminSurface intensity="medium" rounded="2xl" className="p-5"><h2 className="mb-4 text-base font-black">Admissions settings</h2><Denied capability="admissions.catalogue.manage or admissions.publish" /></AdminSurface>;
  return <AdminSurface intensity="medium" rounded="2xl" className="space-y-5 p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><Sliders size={16} /></div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Persisted typed catalogue</p>
        <h2 className="text-base font-black text-slate-800">Programme, intake, product and form</h2>
      </div>
    </div>
    {access.canEditDrafts ? <><div className="grid gap-3 sm:grid-cols-2 bg-slate-50/50 p-4 border border-slate-100 rounded-xl"><Field label="Programme name" value={draft.programmeName} onChange={value => setDraft({ ...draft, programmeName: value })} /><Field label="Programme slug" value={draft.programmeSlug} onChange={value => setDraft({ ...draft, programmeSlug: value })} /><Field label="Intake name" value={draft.intakeName} onChange={value => setDraft({ ...draft, intakeName: value })} /><Field label="Intake slug" value={draft.intakeSlug} onChange={value => setDraft({ ...draft, intakeSlug: value })} /><Field label="Cycle label" value={draft.cycle} onChange={value => setDraft({ ...draft, cycle: value })} /><Field label="Opens" type="datetime-local" value={draft.opens} onChange={value => setDraft({ ...draft, opens: value })} /><Field label="Closes" type="datetime-local" value={draft.closes} onChange={value => setDraft({ ...draft, closes: value })} /><Field label="Product name" value={draft.productName} onChange={value => setDraft({ ...draft, productName: value })} /><Field label="Product slug" value={draft.productSlug} onChange={value => setDraft({ ...draft, productSlug: value })} /><Field label="Optional first field key" value={draft.fieldKey} onChange={value => setDraft({ ...draft, fieldKey: value })} /><Field label="Optional first field label" value={draft.fieldLabel} onChange={value => setDraft({ ...draft, fieldLabel: value })} /></div><button type="button" onClick={() => void saveCatalogue()} className="h-10 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors">Save server draft</button>{notice ? <p className="status bg-slate-100 border border-slate-200 text-slate-700 text-xs p-3 rounded-lg flex items-center gap-1.5" role="status"><AlertCircle size={14} />{notice}</p> : null}</> : <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500 font-semibold italic">Publication review is read-only. Draft editing requires admissions.catalogue.manage.</p>}<CatalogueTable catalogue={reviewCatalogue} publishAllowed={access.canPublish} onProgramme={async (id, status) => { await setProgrammeStatus({ programmeId: id, status } as never); }} onIntake={async (id, status) => { await setIntakeStatus({ intakeId: id, status } as never); }} onProduct={async (id, status) => { await setProductStatus({ productId: id, status } as never); }} onForm={async (id, status) => { await (status === "published" ? publishForm : retireForm)({ formVersionId: id } as never); }} />{access.canEditDrafts ? <AdmissionsSettingsWorkbench schoolId={branding?.schoolId} catalogue={catalogue} publishAllowed={access.canPublish} sensitiveAllowed={sensitiveAllowed} /> : null}</AdminSurface>;
}

function CatalogueTable({ catalogue, publishAllowed, onProgramme, onIntake, onProduct, onForm }: { catalogue: Catalogue | undefined; publishAllowed: boolean; onProgramme: (id: string, state: string) => Promise<void>; onIntake: (id: string, state: string) => Promise<void>; onProduct: (id: string, state: string) => Promise<void>; onForm: (id: string, state: string) => Promise<void> }) { if (!catalogue) return <p className="text-sm text-slate-500">Loading saved catalogue…</p>; return <div className="space-y-2 text-xs border-t border-slate-100 pt-4"><h3 className="font-bold text-slate-800 text-sm mb-3">Saved server catalogue</h3>{[...catalogue.programmes.map(item => ({ ...item, type: "Programme", action: item.status === "draft" ? "published" : "closed", invoke: onProgramme })), ...catalogue.intakes.map(item => ({ ...item, type: "Intake", action: item.status === "draft" || item.status === "paused" ? "open" : "closed", invoke: onIntake })), ...catalogue.products.map(item => ({ ...item, type: "Product", action: item.status === "draft" || item.status === "paused" ? "active" : "retired", invoke: onProduct })), ...catalogue.forms.map(item => ({ ...item, name: `Form v${item.version}`, type: "Form", action: item.status === "draft" ? "published" : "retired", invoke: onForm }))].map((item: any) => <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 bg-white hover:bg-slate-50/50 transition-colors"><span>{item.type} · <strong className="font-bold text-slate-800">{item.name}</strong> · <span className="italic text-slate-500">{item.status}</span></span>{publishAllowed ? <button type="button" className="text-indigo-600 font-bold hover:text-indigo-800 underline transition-colors" onClick={() => void item.invoke(item.id, item.action)}>{item.action}</button> : null}</div>)}</div>; }

function QueuePanel({ intakes, allowed, intakeId, onIntake, state, onState, queue, onPrevious, onNext, onSelect }: { intakes: Array<{ intakeId: string; name: string; status: string }> | undefined; allowed: boolean; intakeId: string; onIntake: (value: string) => void; state: string; onState: (value: string) => void; queue: Queue | undefined; onPrevious: () => void; onNext: () => void; onSelect: (id: string) => void }) { 
  return <AdminSurface intensity="medium" rounded="2xl" className="space-y-4 p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg"><ListTodo size={16} /></div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Staff queue</p>
        <h2 className="text-base font-black text-slate-800">Redacted cursor-backed triage</h2>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
      <label className="block text-xs font-bold text-slate-700">Intake
        <select value={intakeId} onChange={event => onIntake(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none transition-all">
          <option value="">Choose a saved intake</option>
          {intakes?.map(intake => <option key={intake.intakeId} value={intake.intakeId}>{intake.name} · {intake.status}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-700">State
        <select value={state} onChange={event => onState(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none transition-all">
          <option value="">All states</option>
          {["draft", "submitted", "under_review", "changes_requested", "accepted", "rejected", "waitlisted", "withdrawn"].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>
    </div>
    {!intakeId ? <p className="text-xs text-slate-500 italic">Choose an intake to load a bounded queue.</p> : !allowed ? <Denied capability="applications.list" /> : !queue ? <p className="text-xs text-slate-500">Loading safe queue rows…</p> : <><div className="overflow-hidden border border-slate-200 rounded-xl"><table className="w-full text-left text-sm border-collapse bg-white"><thead><tr className="border-b bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
      <th className="px-4 py-3">Reference</th>
      <th className="px-4 py-3">State</th>
      <th className="px-4 py-3">Updated</th>
      <th className="px-4 py-3" />
    </tr></thead><tbody>{queue.page.map(row => <tr className="border-b hover:bg-slate-50/50 transition-colors" key={row.applicationId}><td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{row.publicId}</td><td className="px-4 py-3"><span className="inline-flex rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-700 px-2 py-0.5">{row.state}</span></td><td className="px-4 py-3 text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString()}</td><td className="px-4 py-3 text-right"><button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors" onClick={() => onSelect(row.applicationId)}><Search size={12} /> Open</button></td></tr>)}</tbody></table></div>{!queue.page.length ? <p className="text-sm text-slate-500 italic p-3 text-center">No applications match these filters.</p> : null}<div className="flex justify-end gap-2 mt-4"><button type="button" disabled={!queue || queue.page.length === 0} onClick={onPrevious} className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 text-xs font-bold text-slate-700 disabled:opacity-50 transition-all shadow-sm">Previous</button><button type="button" disabled={queue.isDone} onClick={onNext} className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 text-xs font-bold text-slate-700 disabled:opacity-50 transition-all shadow-sm">Next</button></div></>}</AdminSurface>; }

function DetailPanel({ detail, canView, canReview, canRecord, canAssign, canDecide, canConvert }: { detail: Detail | undefined; canView: boolean; canReview: boolean; canRecord: boolean; canAssign: boolean; canDecide: boolean; canConvert: boolean }) { const documents = useQuery("functions/admissions/staff:listApplicationDocuments" as never, detail && canReview ? { applicationId: detail.applicationId } as never : "skip" as never) as DocumentRow[] | undefined; const audit = useQuery("functions/admissions/staff:getAuditPage" as never, detail ? { applicationId: detail.applicationId, paginationOpts: { numItems: 20, cursor: null } } as never : "skip" as never) as any; const reveal = useMutation("functions/admissions/staff:revealSensitiveApplicationDetail" as never); const [revealed, setRevealed] = useState<NonNullable<Detail> | null>(null); const [reason, setReason] = useState("Admissions application review"); if (detail === undefined) return null; if (!canView) return <AdminSurface intensity="medium" rounded="2xl" className="p-5"><Denied capability="applications.view_basic" /></AdminSurface>; if (!detail) return <AdminSurface intensity="medium" rounded="2xl" className="p-5">This application is unavailable.</AdminSurface>; const projection = revealed?.applicationId === detail.applicationId ? revealed : detail; const revealSensitive = async () => { try { const result = await reveal({ applicationId: detail.applicationId, reason } as never) as NonNullable<Detail>; setRevealed(result); appToast.success("Sensitive answers disclosed and audited"); } catch (error) { appToast.error("Sensitive answers remain redacted", { description: getUserFacingErrorMessage(error, "The exact capability and fresh authentication are required.") }); } }; return <section className="grid gap-6 xl:grid-cols-2"><AdminSurface intensity="medium" rounded="2xl" className="space-y-5 p-5 shadow-sm">
  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
    <div className="flex items-center gap-1.5"><FileText className="h-5 w-5 text-indigo-600" /><h2 className="text-base font-black text-slate-800">Application details</h2></div>
    <span className="font-mono text-[10px] bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-slate-600 font-bold">{detail.publicId}</span>
  </div>
  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-4">
    <span className="text-xs text-slate-500">Current status</span>
    <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-700 px-3 py-1 uppercase tracking-wide">Revision {detail.revision} · {detail.state}</span>
  </div>
  {projection.profile ? <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-2 shadow-sm">
    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Applicant Profile</div>
    <strong className="text-sm text-slate-800 font-black">{projection.profile.firstName} {projection.profile.middleName} {projection.profile.lastName}</strong>
    <p className="text-xs text-slate-500 mt-1">DOB: <span className="text-slate-800 font-bold">{new Date(projection.profile.dateOfBirth).toLocaleDateString()}</span></p>
  </div> : <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 flex items-start gap-2"><AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /> <div><strong>No submitted snapshot is available.</strong><p className="mt-1 text-amber-900">Review and decision controls remain blocked.</p></div></div>}
  
  <div className="space-y-3"><h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Submitted answers</h3><div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">{projection.answers.map(answer => <div className="rounded-xl border border-slate-200 p-3 text-xs bg-white" key={answer.key}><div className="font-bold text-slate-700">{answer.label}</div><div className="mt-1.5 text-slate-800 font-semibold">{answer.redacted ? <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded font-bold"><LockKeyhole size={11} /> Sensitive value redacted</span> : answer.value || <span className="text-slate-400 italic">No value</span>}</div></div>)}{detail.sensitiveAnswerCount > 0 && !revealed ? <div className="p-4 border border-indigo-100 bg-indigo-50/30 rounded-xl space-y-3"><Field label="Sensitive access reason" value={reason} onChange={setReason} /><button type="button" className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-bold text-white shadow-sm transition-all" onClick={() => void revealSensitive()}><LockKeyhole size={14} /> Reveal with fresh authentication</button></div> : null}</div></div><ReviewActions key={detail.applicationId} detail={detail} allowed={canRecord} assign={canAssign} decide={canDecide} /><AuditTimeline audit={audit} /></AdminSurface>
  <AdminSurface intensity="medium" rounded="2xl" className="space-y-5 p-5 shadow-sm">
    <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
      <FileCheck className="h-5 w-5 text-indigo-600" />
      <h2 className="text-base font-black text-slate-800">Documents and conversion</h2>
    </div>
    {canReview ? <DocumentList documents={documents} /> : <Denied capability="documents.review" />}
    <ConversionPanel key={detail.applicationId} detail={detail} allowed={canConvert} />
  </AdminSurface></section>; }

function ReviewActions({ detail, allowed, assign, decide }: { detail: NonNullable<Detail>; allowed: boolean; assign: boolean; decide: boolean }) {
  const assignees = useQuery("functions/admissions/staff:listAssignableStaff" as never, assign ? { applicationId: detail.applicationId } as never : "skip" as never) as Array<{ userId: string; name: string }> | undefined;
  const assignments = useQuery("functions/admissions/staff:listActiveReviewAssignments" as never, assign ? { applicationId: detail.applicationId } as never : "skip" as never) as ReviewAssignment[] | undefined;
  const changeItems = useQuery("functions/admissions/staff:listChangeRequestItems" as never, allowed ? { applicationId: detail.applicationId } as never : "skip" as never) as { core: Array<{ key: string; label: string }>; fields: Array<{ key: string; label: string }>; requirements: Array<{ key: string; label: string }> } | undefined;
  const assignReview = useMutation("functions/admissions/staff:assignReview" as never);
  const startReview = useMutation("functions/admissions/staff:startReview" as never);
  const requestChanges = useMutation("functions/admissions/staff:requestChanges" as never);
  const recordDecision = useMutation("functions/admissions/staff:recordDecision" as never);
  const reopenDecision = useMutation("functions/admissions/staff:reopenDecision" as never);
  const [assignee, setAssignee] = useState("");
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [requestedCoreKeys, setRequestedCoreKeys] = useState<string[]>([]);
  const [requestedFieldKeys, setRequestedFieldKeys] = useState<string[]>([]);
  const [requestedRequirementKeys, setRequestedRequirementKeys] = useState<string[]>([]);
  const [decisionReasonCode, setDecisionReasonCode] = useState("");
  const [decisionGuardianMessage, setDecisionGuardianMessage] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("accepted");
  const [decisionConfirmed, setDecisionConfirmed] = useState(false);
  const [reopenReasonCode, setReopenReasonCode] = useState("");
  const [reopenGuardianMessage, setReopenGuardianMessage] = useState("");
  const [reopenConfirmed, setReopenConfirmed] = useState(false);
  const selectedItemCount = requestedCoreKeys.length + requestedFieldKeys.length + requestedRequirementKeys.length;
  const readinessBlockers = decisionReadinessBlockers(detail.decisionReadiness);
  const canRequest = canRequestCorrections({ applicationState: detail.state, guardianMessage: correctionMessage, selectedItemCount });
  const canDecideNow = canRecordDecision({ applicationState: detail.state, readiness: detail.decisionReadiness, reasonCode: decisionReasonCode, guardianMessage: decisionGuardianMessage });
  const reopening = decide && ["accepted", "rejected"].includes(detail.state) && detail.conversionState !== "succeeded";
  const canReopen = canReopenDecision({ applicationState: detail.state, conversionState: detail.conversionState, reasonCode: reopenReasonCode, guardianMessage: reopenGuardianMessage });
  const toggle = (key: string, setter: (update: (keys: string[]) => string[]) => void) => setter(keys => keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key]);
  const showFailure = (title: string, error: unknown, fallback: string) => appToast.error(title, { description: getUserFacingErrorMessage(error, fallback) });

  if (!allowed && !assign && !decide) return <Denied capability="reviews.record, reviews.assign or decisions.record" />;

  return <div className="space-y-5 border-t border-slate-100 pt-5">
    <section className="space-y-3">
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Clock size={14} /> Review start and status</h3>
      {assign ? <div className="p-4 border border-slate-200 bg-slate-50/50 rounded-xl space-y-3"><label className="block text-xs font-bold text-slate-700">Assign reviewer<select value={assignee} onChange={event => setAssignee(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none transition-all"><option value="">Choose eligible reviewer</option>{assignees?.map(item => <option key={item.userId} value={item.userId}>{item.name}</option>)}</select></label><p className="text-[10px] text-slate-500 leading-relaxed">Assignment coordinates review only. It does not grant document access.</p><div className="rounded-lg border border-slate-200 bg-white p-3 text-xs"><strong className="text-slate-800 font-bold block mb-1">Current reviewer assignments</strong>{assignments === undefined ? <p className="text-slate-400 italic">Loading assignments…</p> : assignments.length ? <ul className="space-y-1">{assignments.map(item => <li className="font-semibold text-slate-700" key={item.assignmentId}>{item.name} · {item.role}</li>)}</ul> : <p className="text-slate-400 italic">No active reviewer assignments.</p>}</div><button type="button" disabled={!assignee} className="h-9 rounded-lg border border-slate-200 hover:bg-slate-50 bg-white shadow-sm px-4 text-xs font-bold text-slate-800 disabled:opacity-50 transition-all" onClick={() => void (async () => { try { await assignReview({ applicationId: detail.applicationId, assigneeUserId: assignee, role: "reviewer" } as never); appToast.success("Reviewer assignment confirmed"); } catch (error) { showFailure("Could not assign reviewer", error, "Refresh the application and try again."); } })()}>Assign reviewer</button></div> : null}
      {allowed && canStartReview(detail.state) ? <button type="button" className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 text-xs shadow-sm transition-all" onClick={() => void (async () => { try { await startReview({ applicationId: detail.applicationId } as never); appToast.success("Review started"); } catch (error) { showFailure("Could not start review", error, "Refresh the application status and try again."); } })()}>Start review</button> : null}
      {allowed && detail.state === "under_review" ? <p className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg p-3 leading-relaxed">Review is in progress. You can request named corrections or complete the decision workflow when ready.</p> : null}
      {allowed && !canStartReview(detail.state) && detail.state !== "under_review" ? <p className="text-xs text-slate-500 italic">Review actions are unavailable in this application state.</p> : null}
    </section>

    {allowed && (detail.state === "submitted" || detail.state === "under_review") ? <section className="space-y-3 border-t border-slate-100 pt-5">
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Sliders size={14} /> Request corrections</h3>
      <p className="text-xs text-slate-500 leading-relaxed">Choose the only core fields, form fields, or documents the guardian may reopen. This records a new one-way status timeline event; it is not a conversation.</p>
      <Field label="Message shown to guardian" value={correctionMessage} onChange={setCorrectionMessage} />
      <fieldset className="space-y-3 text-xs bg-slate-50/50 p-4 border border-slate-100 rounded-xl"><legend className="font-bold text-slate-700 mb-1">Items the guardian can edit</legend><p className="text-[10px] text-slate-400 italic mb-2">Nothing is selected by default. The guardian can edit only the items selected here.</p><div className="flex flex-wrap gap-x-4 gap-y-3">{changeItems?.core.map(item => <label className="flex items-center gap-1.5 cursor-pointer" key={item.key}><input type="checkbox" checked={requestedCoreKeys.includes(item.key)} onChange={() => toggle(item.key, setRequestedCoreKeys)} /> {item.label}</label>)}{changeItems?.fields.map(item => <label className="flex items-center gap-1.5 cursor-pointer" key={item.key}><input type="checkbox" checked={requestedFieldKeys.includes(item.key)} onChange={() => toggle(item.key, setRequestedFieldKeys)} /> {item.label}</label>)}{changeItems?.requirements.map(item => <label className="flex items-center gap-1.5 cursor-pointer" key={item.key}><input type="checkbox" checked={requestedRequirementKeys.includes(item.key)} onChange={() => toggle(item.key, setRequestedRequirementKeys)} /> {item.label} document</label>)}</div></fieldset>
      <button type="button" disabled={!canRequest} className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 text-xs font-bold text-slate-800 disabled:opacity-50 transition-all shadow-sm" onClick={() => void (async () => { try { await requestChanges({ applicationId: detail.applicationId, message: correctionMessage, coreKeys: requestedCoreKeys, fieldKeys: requestedFieldKeys, requirementKeys: requestedRequirementKeys } as never); appToast.success("Corrections requested"); } catch (error) { showFailure("Could not request corrections", error, "Refresh the application status and try again."); } })()}>Request corrections</button>
    </section> : null}

    {decide ? <section className="space-y-3 border-t border-slate-100 pt-5">
      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><UserCheck size={14} /> Decision</h3>
      {["submitted", "under_review", "waitlisted"].includes(detail.state) ? <><p className="text-xs text-slate-500">A decision records an immutable decision version. It does not create a student.</p>{readinessBlockers.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 flex items-start gap-2"><AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /><div><strong>Before a decision can be recorded:</strong><ul className="mt-1 list-disc pl-4 space-y-1">{readinessBlockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul></div></div> : <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg font-semibold flex items-center gap-1.5"><Check className="h-4 w-4" /> All decision readiness checks are complete.</p>}<Field label="Internal reason code" value={decisionReasonCode} onChange={setDecisionReasonCode} /><Field label="Message shown to guardian" value={decisionGuardianMessage} onChange={setDecisionGuardianMessage} /><label className="block text-xs font-bold text-slate-700">Decision<select value={decisionOutcome} onChange={event => { setDecisionOutcome(event.target.value); setDecisionConfirmed(false); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none transition-all"><option value="accepted">Accept application</option><option value="waitlisted">Place on waitlist</option><option value="rejected">Reject application</option></select></label>{decisionOutcome !== "waitlisted" ? <label className="flex gap-2 items-start text-xs text-slate-600 cursor-pointer select-none border border-slate-200 rounded-lg p-3 bg-slate-50/50"><input type="checkbox" className="mt-0.5" checked={decisionConfirmed} onChange={event => setDecisionConfirmed(event.target.checked)} /> <span>I confirm this {decisionOutcome === "accepted" ? "acceptance" : "rejection"}. Reopening is a separate audited action and is unavailable after successful conversion.</span></label> : null}<button type="button" disabled={!canDecideNow || (decisionOutcome !== "waitlisted" && !decisionConfirmed)} className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-xs font-bold text-white shadow-sm disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all" onClick={() => void (async () => { try { await recordDecision({ applicationId: detail.applicationId, state: decisionOutcome, reasonCode: decisionReasonCode, guardianMessage: decisionGuardianMessage } as never); appToast.success("Decision recorded"); } catch (error) { showFailure("Could not record decision", error, "Complete the required review work and refresh before trying again."); } })()}>Record decision</button></> : reopening ? <><div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-950 flex items-start gap-2"><AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" /> <div><strong>Reopening Decision:</strong><p className="mt-1 text-amber-900 leading-relaxed">Reopening is an audited action that returns this application to review. It cannot be used after successful conversion.</p></div></div><Field label="Internal reopen reason code" value={reopenReasonCode} onChange={setReopenReasonCode} /><Field label="Reopen message shown to guardian" value={reopenGuardianMessage} onChange={setReopenGuardianMessage} /><label className="flex gap-2 items-start text-xs text-slate-600 cursor-pointer select-none border border-slate-200 rounded-lg p-3 bg-slate-50/50"><input type="checkbox" className="mt-0.5" checked={reopenConfirmed} onChange={event => setReopenConfirmed(event.target.checked)} /> <span>I understand reopening records a new guardian-visible status event and does not replace the prior decision.</span></label><button type="button" disabled={!canReopen || !reopenConfirmed} className="h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-4 text-xs font-bold text-slate-800 disabled:opacity-50 transition-all shadow-sm" onClick={() => void (async () => { try { await reopenDecision({ applicationId: detail.applicationId, reasonCode: reopenReasonCode, guardianMessage: reopenGuardianMessage } as never); appToast.success("Decision reopened for review"); } catch (error) { showFailure("Could not reopen decision", error, "This decision may no longer be eligible for reopening."); } })()}>Reopen decision</button></> : <p className="text-xs text-slate-500 italic">No decision action is available in this application state.</p>}
    </section> : null}
  </div>;
}

function DocumentList({ documents }: { documents: DocumentRow[] | undefined }) { 
  const access = useMutation("functions/admissions/staff:getDocumentAccess" as never); 
  const review = useMutation("functions/admissions/staff:recordDocumentReview" as never); 
  const [reason, setReason] = useState("Admissions review"); 
  const [url, setUrl] = useState<string | null>(null); 
  const open = async (documentKey: string) => { 
    try { 
      const result = await access({ documentKey, action: "view", reason } as never) as DocumentAccessResult; 
      if (result.status !== "available") { 
        appToast.error("Sensitive file unavailable", { description: documentAccessDeniedMessage(result.denialReason) }); 
        return; 
      } 
      setUrl(result.url); 
    } catch (error) { 
      appToast.error("Sensitive file unavailable", { description: getUserFacingErrorMessage(error, "The file is unavailable. Confirm your access and retry.") }); 
    } 
  }; 
  const accept = async (documentId: string) => { 
    try { 
      await review({ documentId, result: "accepted" } as never); 
      appToast.success("Document accepted"); 
    } catch (error) { 
      appToast.error("Could not review document", { description: getUserFacingErrorMessage(error, "Refresh the document status and try again.") }); 
    } 
  }; 
  return <div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 leading-relaxed shadow-sm">
      <strong className="text-slate-800 font-bold block mb-1">Checked Access Policy</strong>
      “Sensitive file” is a classification, not an access or error status. A file requiring sensitive access also needs the applicable document capability, a recorded reason, and a sign-in from the last five minutes. Reviewer assignment is unrelated to document access.
    </div>
    <Field label="Checked access reason (8–250 characters)" value={reason} onChange={setReason} />
    <div className="space-y-2">
      {documents?.map(document => (
        <article className="rounded-xl border border-slate-200 p-3 text-xs bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm" key={document.documentId}>
          <div>
            <strong className="text-slate-800 font-bold">{document.category}</strong> 
            <span className="text-slate-500 block sm:inline sm:ml-2">Version {document.version} · <span className="italic">{document.state}</span></span>
            {document.sensitivity !== "personal" ? <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 text-[9px] font-black uppercase mt-1 sm:mt-0 sm:ml-2">Sensitive</span> : null}
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" className="text-indigo-600 font-bold hover:text-indigo-800 underline transition-colors" onClick={() => void open(document.documentKey)}>View file</button>
            {document.state === "uploaded" ? <button type="button" className="text-indigo-600 font-bold hover:text-indigo-800 underline transition-colors" onClick={() => void accept(document.documentId)}>Accept document</button> : null}
          </div>
        </article>
      ))}
    </div>
    {url ? <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 underline bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 shadow-sm transition-all"><FileKey2 className="h-3.5 w-3.5" />Open temporary checked URL</a> : null}
  </div>; 
}

function AuditTimeline({ audit }: { audit: any }) { 
  return <div className="border-t border-slate-100 pt-4 mt-4">
    <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2"><Clock size={14} /> Redacted audit timeline</h3>
    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100">
      {audit?.page?.map((event: any, idx: number) => (
        <p className="text-[11px] text-slate-600 border-b border-slate-100/85 pb-1.5 last:border-b-0 last:pb-0 leading-relaxed" key={`${event.action}-${idx}`}>
          <span className="font-semibold text-slate-500 mr-2">{new Date(event.createdAt).toLocaleString()}</span>
          <span className="font-bold text-slate-800 mr-2">{event.action}</span>
          <span className="rounded bg-slate-200/60 px-1 py-0.5 text-[9px] font-black text-slate-700 uppercase">{event.outcome}</span>
          {event.reasonCode ? <span className="text-slate-500 italic ml-2">({event.reasonCode})</span> : ""}
        </p>
      )) ?? <p className="text-xs text-slate-400 italic">Loading audit events…</p>}
    </div>
  </div>; 
}

function ConversionPanel({ detail, allowed }: { detail: NonNullable<Detail>; allowed: boolean }) {
  const classes = useQuery("functions/admissions/staff:listConversionClasses" as never, allowed && detail.decisionState === "accepted" && detail.conversionState === null ? { applicationId: detail.applicationId } as never : "skip" as never) as Array<{ classId: string; name: string }> | undefined;
  const resolve = useMutation("functions/admissions/conversions:resolveConversion" as never);
  const execute = useMutation("functions/admissions/conversions:executeAcceptedConversion" as never);
  const [confirmed, setConfirmed] = useState(false);
  const [classId, setClassId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ConversionState | null>(detail.conversionState);
  const needsRecovery = state === "failed_retryable" || state === "failed_terminal" || state === "resolution_required";
  const running = state === "requested" || state === "running";
  
  const run = async () => {
    try {
      await resolve({ applicationId: detail.applicationId, parentMode: "create", familyMode: "create", studentMode: "create", reason: "Staff confirmed creation of distinct canonical parent, family and student records." } as never);
      const result = await execute({ applicationId: detail.applicationId, classId, admissionNumber, idempotencyKey: key } as never) as { state: ConversionState; replayed: boolean };
      setState(result.state);
      appToast.success(result.replayed ? "Existing student-record setup recovered" : "Student and enrollment records created");
    } catch (error) {
      setState("resolution_required");
      appToast.error("Student record setup needs attention", { description: getUserFacingErrorMessage(error, "Check the class, admission number, and family match. Retry this same setup rather than creating another one.") });
    }
  };

  if (!allowed) return <Denied capability="conversions.execute" />;
  if (detail.decisionState !== "accepted") return <div className="border-t border-slate-100 pt-5 mt-5"><h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5"><Users size={14} /> Student enrollment setup</h3><p className="text-xs text-slate-500 italic mt-2">This becomes available after the application is accepted.</p></div>;
  if (state === "succeeded") return <div className="border-t border-slate-100 pt-5 mt-5 bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 text-emerald-950 flex items-start gap-2.5"><Check className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" /><div><h3 className="text-sm font-black">Student record created</h3><p className="text-xs text-emerald-900 mt-1 leading-relaxed">The accepted applicant has been linked to the school’s student, family, and enrollment records. Guardian onboarding messages are handled separately.</p></div></div>;
  if (detail.conversionState !== null) return <div className="border-t border-slate-100 pt-5 mt-5 bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-amber-950 flex items-start gap-2.5"><AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" /><div><h3 className="text-sm font-black">Student enrollment setup needs support</h3><p className="text-xs text-amber-900 mt-1 leading-relaxed">A previous setup attempt is still recorded. Do not start another one. An administrator must inspect and resolve that attempt before enrollment can continue.</p></div></div>;

  return <div className="border-t border-slate-100 pt-5 mt-5 space-y-4">
    <div>
      <h3 className="text-sm font-black text-slate-800">{needsRecovery ? "Finish student enrollment setup" : "Create student and enrollment records"}</h3>
      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Acceptance records the admissions decision only. This separate step creates or links the student and family records, assigns the approved class, and records the admission number. Existing people are never merged automatically.</p>
    </div>
    {needsRecovery ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 flex items-center gap-1.5 font-semibold"><AlertCircle size={14} /> The previous setup attempt needs attention. Correct the details below and retry this same setup.</div> : null}
    <div className="grid gap-3 sm:grid-cols-2 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
      <label className="block text-xs font-bold text-slate-700">Approved class
        <select value={classId} onChange={event => setClassId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:border-indigo-600 focus:outline-none transition-all">
          <option value="">Choose a class</option>
          {classes?.map(item => <option key={item.classId} value={item.classId}>{item.name}</option>)}
        </select>
      </label>
      <Field label="Admission number" value={admissionNumber} onChange={setAdmissionNumber} />
    </div>
    <label className="flex gap-2 items-start text-xs text-slate-600 cursor-pointer select-none border border-slate-200 rounded-xl p-3 bg-slate-50/50">
      <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
      <span>I checked the class, admission number, and family details. This creates or links the school records once.</span>
    </label>
    <button type="button" disabled={!confirmed || !classId || !admissionNumber || running} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all" onClick={() => void run()}>
      <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
      {needsRecovery ? "Retry student record setup" : running ? "Creating records…" : "Create student record"}
    </button>
  </div>;
}
