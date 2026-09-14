import { getUserFacingErrorMessage } from "@school/shared";
import { Check, ChevronLeft, Minus, Plus } from "lucide-react";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { isValidSelectableQuantity } from "../../selectable-items-validation";
import type {
  BillingDashboardData,
  SelectableBillingCollection,
  SelectableIssuanceResult,
  SessionOption,
  StudentOption,
  TermOption,
} from "../../types";
import { formatMoney, toQueryArgs } from "../../utils";
import { BankAccountSelection } from "../BankAccountSelection";

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-100";

type Step = 1 | 2 | 3;

function contractCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const data = (error as { data?: unknown }).data;
  return data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : null;
}

interface SelectableIssuanceFormProps {
  collections: SelectableBillingCollection[];
  sessions: SessionOption[];
  initialCollectionId?: string;
  issueItems: (args: {
    requestKey: string;
    collectionId: string;
    studentIds: string[];
    sessionId: string;
    termId: string;
    selections: Array<{ itemId: string; quantity: number }>;
    bankAccountId?: string;
    dueDate?: number;
    notes?: string;
  }) => Promise<SelectableIssuanceResult>;
  onDone: () => void;
  onForbidden: () => void;
  onOpenInvoice: (invoiceId: string) => void;
}

export function SelectableIssuanceForm({ collections, sessions, initialCollectionId, issueItems, onDone, onForbidden, onOpenInvoice }: SelectableIssuanceFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [collectionId, setCollectionId] = useState(initialCollectionId ?? "");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState("");
  const [bankAccountId, setBankAccountId] = useState(() => collections.find((entry) => entry._id === initialCollectionId)?.bankAccountId ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uncertainOutcome, setUncertainOutcome] = useState(false);
  const [result, setResult] = useState<SelectableIssuanceResult | null>(null);

  const collection = collections.find((entry) => entry._id === collectionId);
  const terms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    toQueryArgs("sessionId", sessionId),
  ) as TermOption[] | undefined;
  const students = useQuery(
    "functions/academic/studentEnrollment:listStudentsByClass" as never,
    toQueryArgs("classId", classId),
  ) as StudentOption[] | undefined;
  const refreshedDashboard = useQuery(
    "functions/billing:getBillingDashboard" as never,
    result?.skippedExistingStudentIds.length
      ? { classId: null, sessionId: null, termId: null, status: null } as never
      : "skip",
  ) as BillingDashboardData | undefined;
  const shownStudents = useMemo(() => (students ?? []).filter((student) =>
    `${student.studentName} ${student.admissionNumber}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [search, students]);
  const selectedItems = (collection?.items ?? []).filter((item) => quantities[item._id] !== undefined);
  const estimatedTotal = selectedItems.reduce((total, item) => total + item.unitAmount * Number(quantities[item._id] || 0), 0);

  const markFingerprintEdited = () => {
    if (requestKey) setRequestKey(null);
    setUncertainOutcome(false);
    setError("");
  };

  const validateRecipients = () => {
    if (!collectionId) return "Select a collection.";
    if (!sessionId || !termId) return "Select a session and term.";
    if (!classId) return "Select an eligible class.";
    if (studentIds.length === 0) return "Select at least one student.";
    return null;
  };

  const validateItems = () => {
    if (selectedItems.length === 0) return "Select at least one item.";
    if (selectedItems.some((item) => !isValidSelectableQuantity(quantities[item._id] ?? ""))) {
      return "Enter a whole-number quantity from 1 to 9999.";
    }
    if (!Number.isFinite(estimatedTotal) || estimatedTotal <= 0) return "Selected items must have a total greater than 0.";
    return null;
  };

  const submit = async () => {
    const validationError = validateRecipients() ?? validateItems();
    if (validationError || !collection) {
      setError(validationError ?? "Select a collection.");
      return;
    }
    const stableRequestKey = requestKey ?? crypto.randomUUID();
    setRequestKey(stableRequestKey);
    setSubmitting(true);
    setUncertainOutcome(false);
    setError("");
    try {
      const response = await issueItems({
        requestKey: stableRequestKey,
        collectionId: collection._id,
        studentIds,
        sessionId,
        termId,
        selections: selectedItems.map((item) => ({ itemId: item._id, quantity: Number(quantities[item._id]) })),
        ...(bankAccountId ? { bankAccountId } : {}),
        ...(dueDate ? { dueDate: new Date(`${dueDate}T12:00:00`).getTime() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult(response);
    } catch (submissionError) {
      const code = contractCode(submissionError);
      if (code === "FORBIDDEN") {
        onForbidden();
        return;
      }
      if (code === "IDEMPOTENCY_CONFLICT") {
        setError("This retry no longer matches the original request. Review current invoices before trying again.");
      } else if (code === "NOT_FOUND") {
        setError("The collection, an item, or a student is no longer available.");
      } else if (code === "VALIDATION_FAILED" || code === "ZERO_VALUE_INVOICE") {
        setError(getUserFacingErrorMessage(submissionError, "Review the recipients and items, then try again."));
      } else {
        setUncertainOutcome(true);
        setError("We could not confirm the result. Retry without changing this request.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const namesById = new Map((students ?? []).map((student) => [student._id, student.studentName]));
    return (
      <div className="space-y-5" aria-live="polite">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-5 w-5" /></div>
        <div><h3 className="font-display text-lg font-bold text-slate-950">Issuance complete</h3><p className="mt-1 text-sm text-slate-500">The totals below come from the saved invoices.</p></div>
        {[
          { label: "Created", invoices: result.createdInvoices },
          { label: "Confirmed from an earlier attempt", invoices: result.replayedInvoices },
        ].map((group) => <section key={group.label} className="rounded-xl border border-slate-200 p-4"><h4 className="text-xs font-bold text-slate-900">{group.label} ({group.invoices.length})</h4>{group.invoices.length ? <ul className="mt-2 space-y-2">{group.invoices.map((invoice) => <li key={invoice._id} className="flex items-center justify-between gap-3 text-xs"><span><span className="block font-mono text-slate-600">{invoice.invoiceNumber}</span><span className="font-mono font-bold text-slate-900">{formatMoney(invoice.totalAmount, invoice.currency)}</span></span><button type="button" onClick={() => onOpenInvoice(invoice._id)} className="min-h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-800 hover:border-slate-500">Open invoice</button></li>)}</ul> : <p className="mt-1 text-xs text-slate-400">None</p>}</section>)}
        <section className="rounded-xl border border-slate-200 p-4"><h4 className="text-xs font-bold text-slate-900">Skipped because an invoice already exists ({result.skippedExistingStudentIds.length})</h4>{result.skippedExistingStudentIds.length ? <ul className="mt-2 space-y-2 text-xs text-slate-600">{result.skippedExistingStudentIds.map((id) => {
          const existingInvoice = refreshedDashboard?.invoices.find((row) =>
            row.invoice.studentId === id &&
            row.invoice.selectableCollectionId === collectionId &&
            row.invoice.sessionId === sessionId &&
            row.invoice.termId === termId &&
            row.invoice.status !== "cancelled"
          )?.invoice;
          return <li key={id} className="flex items-center justify-between gap-3"><span><span className="block font-semibold text-slate-800">{namesById.get(id) ?? "Selected student"}</span>{existingInvoice ? <span className="font-mono text-slate-500">{existingInvoice.invoiceNumber}</span> : null}</span><button type="button" disabled={!existingInvoice} onClick={() => existingInvoice && onOpenInvoice(existingInvoice._id)} className="min-h-10 rounded-xl border border-slate-300 px-3 font-bold text-slate-800 hover:border-slate-500 disabled:cursor-wait disabled:opacity-50">{refreshedDashboard === undefined ? "Finding invoice..." : existingInvoice ? "Open invoice" : "Invoice unavailable"}</button></li>;
        })}</ul> : <p className="mt-1 text-xs text-slate-400">None</p>}</section>
        <button type="button" onClick={onDone} className="h-11 w-full rounded-xl bg-slate-950 text-xs font-bold text-white">Done</button>
      </div>
    );
  }

  return (
    <div className="space-y-5" aria-busy={submitting}>
      <ol className="grid grid-cols-3 gap-2" aria-label="Issuance steps">
        {[{ id: 1, label: "Recipients" }, { id: 2, label: "Items" }, { id: 3, label: "Review" }].map((entry) => <li key={entry.id} className={`rounded-lg px-2 py-2 text-center text-[10px] font-bold ${step === entry.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`}>{entry.id} {entry.label}</li>)}
      </ol>
      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      {step === 1 ? <div className="space-y-4">
        <div className="space-y-1"><label htmlFor="issuance-collection" className="text-xs font-bold text-slate-700">Collection *</label><select id="issuance-collection" value={collectionId} disabled={submitting} onChange={(event) => { markFingerprintEdited(); setCollectionId(event.target.value); setClassId(""); setStudentIds([]); setQuantities({}); setBankAccountId(collections.find((row) => row._id === event.target.value)?.bankAccountId ?? ""); }} className={inputClass}><option value="">Select a collection</option>{collections.filter((entry) => entry.isActive).map((entry) => <option key={entry._id} value={entry._id}>{entry.name}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><label htmlFor="issuance-session" className="text-xs font-bold text-slate-700">Session *</label><select id="issuance-session" value={sessionId} onChange={(event) => { markFingerprintEdited(); setSessionId(event.target.value); setTermId(""); }} className={inputClass}><option value="">Select session</option>{sessions.map((session) => <option key={session._id} value={session._id}>{session.name}</option>)}</select></div><div className="space-y-1"><label htmlFor="issuance-term" className="text-xs font-bold text-slate-700">Term *</label><select id="issuance-term" disabled={!sessionId || !terms} value={termId} onChange={(event) => { markFingerprintEdited(); setTermId(event.target.value); }} className={inputClass}><option value="">Select term</option>{(terms ?? []).map((term) => <option key={term._id} value={term._id}>{term.name}</option>)}</select></div></div>
        <div className="space-y-1"><label htmlFor="issuance-class" className="text-xs font-bold text-slate-700">Eligible class *</label><select id="issuance-class" value={classId} disabled={!collection} onChange={(event) => { markFingerprintEdited(); setClassId(event.target.value); setStudentIds([]); }} className={inputClass}><option value="">Select class</option>{collection?.targetClasses.map((targetClass) => <option key={targetClass._id} value={targetClass._id}>{targetClass.name}</option>)}</select></div>
        {classId ? <fieldset className="space-y-2"><legend className="text-xs font-bold text-slate-700">Students *</legend><input aria-label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} placeholder="Search name or admission number" /><div className="flex gap-3 text-xs"><button type="button" onClick={() => { markFingerprintEdited(); setStudentIds(Array.from(new Set([...studentIds, ...shownStudents.map((student) => student._id)]))); }} className="font-bold underline">Select all shown</button><button type="button" onClick={() => { markFingerprintEdited(); setStudentIds([]); }} className="font-bold underline">Clear</button></div><div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">{students === undefined ? <p className="p-3 text-xs text-slate-500">Loading students...</p> : shownStudents.length === 0 ? <p className="p-3 text-xs text-slate-500">No active students are enrolled in this class.</p> : shownStudents.map((student) => <label key={student._id} className="flex min-h-11 items-center gap-3 border-b border-slate-100 px-3 text-sm last:border-0"><input type="checkbox" checked={studentIds.includes(student._id)} onChange={(event) => { markFingerprintEdited(); setStudentIds(event.target.checked ? [...studentIds, student._id] : studentIds.filter((id) => id !== student._id)); }} /><span className="flex-1"><span className="font-semibold text-slate-900">{student.studentName}</span><span className="ml-2 font-mono text-xs text-slate-400">{student.admissionNumber}</span></span></label>)}</div><p className="text-xs text-slate-500">{studentIds.length} students selected</p></fieldset> : null}
        <button type="button" onClick={() => { const issue = validateRecipients(); if (issue) setError(issue); else { setError(""); setStep(2); } }} className="h-11 w-full rounded-xl bg-slate-950 text-xs font-bold text-white">Continue to items</button>
      </div> : null}

      {step === 2 && collection ? <div className="space-y-4">
        <fieldset className="space-y-3"><legend className="text-xs font-bold text-slate-700">Items *</legend>{collection.items.filter((item) => item.isActive).map((item) => { const selected = quantities[item._id] !== undefined; const quantity = quantities[item._id] ?? "1"; return <div key={item._id} className="rounded-xl border border-slate-200 p-3"><label className="flex min-h-11 items-start gap-3"><input type="checkbox" checked={selected} onChange={(event) => { markFingerprintEdited(); setQuantities((current) => { const next = { ...current }; if (event.target.checked) next[item._id] = "1"; else delete next[item._id]; return next; }); }} className="mt-1 h-4 w-4" /><span className="flex-1"><span className="block text-sm font-bold text-slate-900">{item.label}</span><span className="text-xs text-slate-500">{formatMoney(item.unitAmount, collection.currency)} each</span></span></label><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center"><button type="button" disabled={!selected || Number(quantity) <= 1} onClick={() => { markFingerprintEdited(); setQuantities({ ...quantities, [item._id]: String(Math.max(1, Number(quantity) - 1)) }); }} aria-label={`Decrease ${item.label} quantity`} className="flex h-11 w-11 items-center justify-center rounded-l-xl border border-slate-200"><Minus className="h-4 w-4" /></button><input aria-label={`${item.label} quantity`} disabled={!selected} inputMode="numeric" max={9999} value={quantity} onChange={(event) => { markFingerprintEdited(); setQuantities({ ...quantities, [item._id]: event.target.value.replace(/\D/g, "") }); }} className="h-11 w-16 border-y border-slate-200 text-center font-mono text-sm" /><button type="button" disabled={!selected || Number(quantity) >= 9999} onClick={() => { markFingerprintEdited(); setQuantities({ ...quantities, [item._id]: String(Math.min(9999, Number(quantity) + 1)) }); }} aria-label={`Increase ${item.label} quantity`} className="flex h-11 w-11 items-center justify-center rounded-r-xl border border-slate-200"><Plus className="h-4 w-4" /></button></div><span className="font-mono text-sm font-bold text-slate-900">{selected && isValidSelectableQuantity(quantity) ? formatMoney(item.unitAmount * Number(quantity), collection.currency) : "Not selected"}</span></div></div>; })}</fieldset>
        <div className="space-y-1"><label htmlFor="issuance-due-date" className="text-xs font-bold text-slate-700">Due date</label><input id="issuance-due-date" type="date" value={dueDate} onChange={(event) => { markFingerprintEdited(); setDueDate(event.target.value); }} className={inputClass} /><p className="text-xs text-slate-500">Leave blank to use the school billing default.</p></div>
        <BankAccountSelection value={bankAccountId} onChange={(value) => { markFingerprintEdited(); setBankAccountId(value); }} label="Settlement account" helperText="The collection account is used by default. Choose another compatible account if needed." />
        <div className="space-y-1"><label htmlFor="issuance-notes" className="text-xs font-bold text-slate-700">Notes</label><textarea id="issuance-notes" value={notes} onChange={(event) => { markFingerprintEdited(); setNotes(event.target.value); }} className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Optional note shown on the invoice" /></div>
        <div className="rounded-xl bg-slate-950 p-4 text-xs text-white"><div className="flex justify-between"><span>Selected items</span><strong>{selectedItems.length}</strong></div><div className="mt-2 flex justify-between"><span>Estimated per-student total</span><strong className="font-mono">{formatMoney(estimatedTotal, collection.currency)}</strong></div><div className="mt-2 flex justify-between"><span>Invoices to create</span><strong>{studentIds.length}</strong></div></div>
        <div className="flex gap-2"><button type="button" onClick={() => setStep(1)} className="h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold"><ChevronLeft className="mr-1 inline h-4 w-4" /> Back</button><button type="button" onClick={() => { const issue = validateItems(); if (issue) setError(issue); else { setError(""); setStep(3); } }} className="h-11 flex-1 rounded-xl bg-slate-950 text-xs font-bold text-white">Review issuance</button></div>
      </div> : null}

      {step === 3 && collection ? <div className="space-y-4"><h3 className="font-display text-base font-bold text-slate-950">Review issuance</h3><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-slate-500">Collection</dt><dd className="font-semibold text-slate-900">{collection.name}</dd><dt className="text-slate-500">Period</dt><dd className="font-semibold text-slate-900">{sessions.find((entry) => entry._id === sessionId)?.name} · {terms?.find((entry) => entry._id === termId)?.name}</dd><dt className="text-slate-500">Class</dt><dd className="font-semibold text-slate-900">{collection.targetClasses.find((entry) => entry._id === classId)?.name}</dd><dt className="text-slate-500">Recipients</dt><dd className="font-semibold text-slate-900">{studentIds.length} students</dd><dt className="text-slate-500">Due date</dt><dd className="font-semibold text-slate-900">{dueDate || "School default"}</dd></dl><section className="rounded-xl border border-slate-200"><h4 className="border-b border-slate-100 p-3 text-xs font-bold text-slate-700">Items per student</h4><ul className="divide-y divide-slate-100">{selectedItems.map((item) => <li key={item._id} className="flex items-center justify-between gap-3 p-3 text-xs"><span>{item.label}<span className="ml-2 text-slate-400">{quantities[item._id]} × {formatMoney(item.unitAmount, collection.currency)}</span></span><strong className="font-mono">{formatMoney(item.unitAmount * Number(quantities[item._id]), collection.currency)}</strong></li>)}</ul></section><div className="flex justify-between text-sm"><span>Estimated per-student total</span><strong className="font-mono">{formatMoney(estimatedTotal, collection.currency)}</strong></div><p className="rounded-xl bg-slate-100 p-3 text-xs leading-5 text-slate-600">This creates a positive invoice for each eligible student. It does not reserve stock.</p><div className="flex gap-2"><button type="button" disabled={submitting} onClick={() => setStep(2)} className="h-11 flex-1 rounded-xl border border-slate-300 text-xs font-bold">Back</button><button type="button" disabled={submitting} onClick={() => void submit()} className="h-11 flex-1 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-50">{submitting ? "Creating invoices..." : uncertainOutcome ? "Retry same request" : `Create ${studentIds.length} ${studentIds.length === 1 ? "invoice" : "invoices"}`}</button></div></div> : null}
    </div>
  );
}
