"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { settingsPublicationGate } from "@/admissions/models";
import { 
  ChevronDown, 
  FileText, 
  PlusCircle, 
  DollarSign, 
  NotebookPen, 
  CheckSquare, 
  Info, 
  LockKeyhole, 
  GraduationCap, 
  AlertTriangle, 
  CheckCircle2, 
  Eye,
  Plus
} from "lucide-react";

type Catalogue = {
  programmes: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string }>;
  forms: Array<{ id: string; version: number; status: string }>;
};
type Evidence = { id: string; approvalClass: string; subjectKey: string; evidenceReference: string; active: boolean };
type FormConfiguration = { fields: Array<{ id: string; key: string; label: string; kind: string; requiredMode: string; dataClass: string; approvalEvidenceId: string | null }>; requirements: Array<{ id: string; key: string; label: string; requiredMode: string; sensitivity: string; approvalEvidenceId: string | null }> };
type Declaration = { id: string; programmeId: string; version: number; title: string; body: string; purpose: string; status: string };

interface Props { schoolId?: string; catalogue?: Catalogue; publishAllowed: boolean; sensitiveAllowed: boolean }
const input = "mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-xs bg-white focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 transition-all";

export function AdmissionsSettingsWorkbench({ schoolId, catalogue, publishAllowed, sensitiveAllowed }: Props) {
  const [formId, setFormId] = useState(""); const [productId, setProductId] = useState("");
  const evidence = useQuery("functions/admissions/settings:listApprovalEvidence" as never, schoolId ? { schoolId } as never : "skip" as never) as Evidence[] | undefined;
  const declarations = useQuery("functions/admissions/settings:listDeclarations" as never, schoolId ? { schoolId } as never : "skip" as never) as Declaration[] | undefined;
  const configuration = useQuery("functions/admissions/settings:getFormConfiguration" as never, formId ? { formVersionId: formId } as never : "skip" as never) as FormConfiguration | undefined;
  const prices = useQuery("functions/admissions/settings:listProductPrices" as never, productId ? { productId } as never : "skip" as never) as Array<{ id: string; version: number; amountMinor: number; currency: string; feeDisclosure: string; refundPolicyKey: string; status: string }> | undefined;
  const addField = useMutation("functions/admissions/settings:addDraftField" as never); const addRequirement = useMutation("functions/admissions/settings:addDraftDocumentRequirement" as never);
  const publishPrice = useMutation("functions/admissions/settings:publishPrice" as never); const createDeclaration = useMutation("functions/admissions/settings:createDeclaration" as never); const publishDeclaration = useMutation("functions/admissions/settings:publishDeclaration" as never); const retireDeclaration = useMutation("functions/admissions/settings:retireDeclaration" as never);
  const [field, setField] = useState({ key: "", label: "", kind: "text", requiredMode: "optional", dataClass: "personal", validationJson: "{}", conditionalRuleJson: "", purpose: "", retention: "", audience: "admissions-reviewers", approval: "" });
  const [requirement, setRequirement] = useState({ key: "", label: "", category: "", requiredMode: "optional", sensitivity: "child_confidential", mime: "application/pdf,image/jpeg", maxBytes: "5000000", maxFiles: "1", conditionJson: "", purpose: "", retention: "", audience: "admissions-reviewers", approval: "" });
  const [price, setPrice] = useState({ version: "1", amountMinor: "", currency: "NGN", disclosure: "", refund: "", effectiveFrom: "", approval: "" });
  const [declaration, setDeclaration] = useState({ programmeId: "", version: "1", title: "", body: "", purpose: "service" }); const [notice, setNotice] = useState("");
  const activePrivacy = evidence?.some(item => item.active && item.approvalClass === "privacy") ?? false; const activeFinance = evidence?.some(item => item.active && item.approvalClass === "finance") ?? false;
  const containsSensitive = field.dataClass === "highly_sensitive" || field.dataClass === "financial_security" || requirement.sensitivity === "highly_sensitive" || requirement.sensitivity === "financial_security";
  const gate = useMemo(() => settingsPublicationGate({ validationErrors: [], hasPublishCapability: publishAllowed, containsSensitiveConfiguration: containsSensitive, hasSensitiveCapability: sensitiveAllowed, privacyEvidenceCurrent: !containsSensitive || activePrivacy, financeEvidenceCurrent: activeFinance, declarationPublished: declarations?.some(item => item.status === "published") ?? false }), [activeFinance, activePrivacy, containsSensitive, declarations, publishAllowed, sensitiveAllowed]);
  const run = async (operation: () => Promise<unknown>, success: string) => { try { await operation(); setNotice(success); } catch (error) { setNotice(getUserFacingErrorMessage(error, "The server rejected this configuration change.")); } };
  const selectedEvidence = (id: string) => id || undefined;

  return <div className="space-y-6 border-t border-slate-200 pt-6">
    <div className="flex items-start gap-2.5">
      <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
        <NotebookPen size={18} />
      </div>
      <div>
        <h3 className="text-sm font-black text-slate-800">Offering configuration, approvals and preview</h3>
        <p className="text-xs text-slate-500 mt-0.5">All editors call tenant-scoped server APIs. Published versions remain immutable; retire/close actions above are rollback controls.</p>
      </div>
    </div>
    
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">Form version
        <select className={input} value={formId} onChange={event => setFormId(event.target.value)}>
          <option value="">Choose draft form</option>
          {catalogue?.forms.map(form => <option key={form.id} value={form.id}>Form v{form.version} · {form.status}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-700">Product for price/disclosure
        <select className={input} value={productId} onChange={event => setProductId(event.target.value)}>
          <option value="">Choose product</option>
          {catalogue?.products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
      </label>
    </div>

    {/* Collapse components styled as gorgeous accordion panels */}
    <div className="space-y-3">
      {/* 1. Collapsible details: Typed and conditional field */}
      <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 select-none">
          <span className="text-xs font-black text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600" />
            Typed and conditional field
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["key", "label", "purpose", "retention", "audience", "validationJson", "conditionalRuleJson"] as const).map(key => (
              <label key={key} className="text-xs font-bold text-slate-700">{key}
                <input className={input} value={field[key]} onChange={event => setField({ ...field, [key]: event.target.value })} />
              </label>
            ))}
            <label className="text-xs font-bold text-slate-700">Kind
              <select className={input} value={field.kind} onChange={event => setField({ ...field, kind: event.target.value })}>
                {["text", "textarea", "number", "date", "select", "multiselect", "checkbox", "boolean", "email", "phone"].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Required mode
              <select className={input} value={field.requiredMode} onChange={event => setField({ ...field, requiredMode: event.target.value })}>
                {["optional", "required", "conditional"].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Data class
              <select className={input} value={field.dataClass} onChange={event => setField({ ...field, dataClass: event.target.value })}>
                {["personal", "child_confidential", "highly_sensitive", "financial_security"].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <EvidenceSelect evidence={evidence} value={field.approval} onChange={approval => setField({ ...field, approval })} />
          </div>
          <button type="button" disabled={!formId} className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all" onClick={() => void run(() => addField({ formVersionId: formId, fieldKey: field.key, sectionKey: "applicant", kind: field.kind, label: field.label, requiredMode: field.requiredMode, dataClass: field.dataClass, purpose: field.purpose || undefined, retentionPolicyKey: field.retention || undefined, audience: field.audience || undefined, approvalEvidenceId: selectedEvidence(field.approval), validationJson: field.validationJson, conditionalRuleJson: field.conditionalRuleJson || undefined, order: configuration?.fields.length ?? 0 } as never), "Typed field saved.")}>
            <Plus size={14} /> Add typed field
          </button>
        </div>
      </details>

      {/* 2. Collapsible details: Document requirement */}
      <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 select-none">
          <span className="text-xs font-black text-slate-800 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-indigo-600" />
            Document requirement
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["key", "label", "category", "mime", "maxBytes", "maxFiles", "conditionJson", "purpose", "retention", "audience"] as const).map(key => (
              <label key={key} className="text-xs font-bold text-slate-700">{key}
                <input className={input} value={requirement[key]} onChange={event => setRequirement({ ...requirement, [key]: event.target.value })} />
              </label>
            ))}
            <label className="text-xs font-bold text-slate-700">Required mode
              <select className={input} value={requirement.requiredMode} onChange={event => setRequirement({ ...requirement, requiredMode: event.target.value })}>
                {["optional", "required", "conditional"].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Sensitivity
              <select className={input} value={requirement.sensitivity} onChange={event => setRequirement({ ...requirement, sensitivity: event.target.value })}>
                {["personal", "child_confidential", "highly_sensitive", "financial_security"].map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <EvidenceSelect evidence={evidence} value={requirement.approval} onChange={approval => setRequirement({ ...requirement, approval })} />
          </div>
          <button type="button" disabled={!formId} className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all" onClick={() => void run(() => addRequirement({ formVersionId: formId, requirementKey: requirement.key, category: requirement.category, label: requirement.label, requiredMode: requirement.requiredMode, acceptedMimeTypes: requirement.mime.split(",").map(value => value.trim()).filter(Boolean), maxBytes: Number(requirement.maxBytes), maxFiles: Number(requirement.maxFiles), sensitivity: requirement.sensitivity, purpose: requirement.purpose, retentionPolicyKey: requirement.retention || undefined, audience: requirement.audience || undefined, approvalEvidenceId: selectedEvidence(requirement.approval), conditionJson: requirement.conditionJson || undefined, order: configuration?.requirements.length ?? 0 } as never), "Document requirement saved.")}>
            <Plus size={14} /> Add document requirement
          </button>
        </div>
      </details>

      {/* 3. Collapsible details: Price and disclosure publication */}
      <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 select-none">
          <span className="text-xs font-black text-slate-800 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-indigo-600" />
            Price and disclosure publication
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["version", "amountMinor", "currency", "disclosure", "refund", "effectiveFrom"] as const).map(key => (
              <label key={key} className="text-xs font-bold text-slate-700">{key}
                <input className={input} type={key === "effectiveFrom" ? "datetime-local" : "text"} value={price[key]} onChange={event => setPrice({ ...price, [key]: event.target.value })} />
              </label>
            ))}
            <EvidenceSelect evidence={evidence?.filter(item => item.approvalClass === "finance")} value={price.approval} onChange={approval => setPrice({ ...price, approval })} />
          </div>
          <button type="button" disabled={!productId || !publishAllowed || !price.approval} className="inline-flex items-center gap-1.5 h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all" onClick={() => void run(() => publishPrice({ productId, version: Number(price.version), amountMinor: Number(price.amountMinor), currency: price.currency, refundPolicyKey: price.refund, feeDisclosure: price.disclosure, effectiveFrom: new Date(price.effectiveFrom).getTime(), approvalEvidenceId: price.approval } as never), "Approved price and disclosure published.")}>
            Publish approved price
          </button>
        </div>
      </details>

      {/* 4. Collapsible details: Declaration lifecycle */}
      <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 select-none">
          <span className="text-xs font-black text-slate-800 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
            Declaration lifecycle
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="p-4 border-t border-slate-100 bg-white space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">Programme
              <select className={input} value={declaration.programmeId} onChange={event => setDeclaration({ ...declaration, programmeId: event.target.value })}>
                <option value="">Choose programme</option>
                {catalogue?.programmes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            {(["version", "title", "body", "purpose"] as const).map(key => (
              <label key={key} className="text-xs font-bold text-slate-700">{key}
                <input className={input} value={declaration[key]} onChange={event => setDeclaration({ ...declaration, [key]: event.target.value })} />
              </label>
            ))}
          </div>
          <button type="button" className="h-9 rounded-lg border border-slate-200 hover:bg-slate-50 px-4 text-xs font-bold text-slate-800 transition-all shadow-sm" onClick={() => void run(() => createDeclaration({ schoolId, programmeId: declaration.programmeId, version: Number(declaration.version), title: declaration.title, body: declaration.body, purpose: declaration.purpose } as never), "Declaration draft created.")}>
            Create declaration draft
          </button>
          <div className="space-y-2 mt-4">
            {declarations?.map(item => (
              <div key={item.id} className="flex justify-between items-center rounded-lg border border-slate-200 p-3 text-xs bg-slate-50/30">
                <span className="font-semibold text-slate-700">{item.title} · v{item.version} · <span className="italic text-slate-500">{item.status}</span></span>
                {publishAllowed ? (
                  <button className="text-indigo-600 font-bold hover:text-indigo-800 underline transition-colors" type="button" onClick={() => void run(() => item.status === "draft" ? publishDeclaration({ declarationVersionId: item.id } as never) : retireDeclaration({ declarationVersionId: item.id } as never), item.status === "draft" ? "Declaration published." : "Declaration retired for rollback.")}>
                    {item.status === "draft" ? "Publish" : "Retire"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>

    {/* Publication blocker gate section styled beautifully */}
    <div className={`rounded-xl border p-4 text-xs ${gate.allowed ? "border-emerald-200 bg-emerald-50/50 text-emerald-950" : "border-amber-200 bg-amber-50/50 text-amber-950"}`}>
      <div className="flex items-center gap-1.5 font-bold mb-2">
        {gate.allowed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
        <span className="text-sm font-black">{gate.allowed ? "Publication gate ready" : "Publication blockers"}</span>
      </div>
      <div className="space-y-1 pl-5 list-disc">
        {gate.blockers.map(blocker => <p key={blocker}>• {blocker}</p>)}
      </div>
    </div>

    {/* Previews panel */}
    <details className="group border border-slate-200 rounded-xl bg-white overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 select-none">
        <span className="text-xs font-black text-slate-800 flex items-center gap-2">
          <Eye className="h-4 w-4 text-indigo-600" />
          Safe configuration preview
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="p-4 border-t border-slate-100 bg-slate-900">
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-[10px] text-indigo-200 font-mono">{JSON.stringify({ fields: configuration?.fields ?? [], documentRequirements: configuration?.requirements ?? [], prices: prices ?? [], declarations: declarations ?? [], approvals: evidence?.map(({ evidenceReference, ...item }) => ({ ...item, evidenceRecorded: Boolean(evidenceReference) })) ?? [] }, null, 2)}</pre>
      </div>
    </details>

    {notice ? (
      <div className="flex items-center gap-1.5 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
        <Info size={14} className="text-slate-500" />
        <p role="status">{notice}</p>
      </div>
    ) : null}
  </div>;
}

function EvidenceSelect({ evidence, value, onChange }: { evidence?: Evidence[]; value: string; onChange: (value: string) => void }) { 
  return <label className="text-xs font-bold text-slate-700">Approval evidence
    <select className={input} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">No evidence</option>
      {evidence?.map(item => <option key={item.id} value={item.id} disabled={!item.active}>{item.approvalClass} · {item.subjectKey} · {item.active ? "current" : "expired/revoked"}</option>)}
    </select>
  </label>; 
}
