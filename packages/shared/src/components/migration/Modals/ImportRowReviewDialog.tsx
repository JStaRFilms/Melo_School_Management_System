import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { StagedStudentRow } from "../Tabs/RosterReviewTab";

export interface ImportReviewOptions {
  classes: Array<{ id: string; name: string; level: string }>;
  subjects: Array<{ id: string; name: string }>;
  families: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string; admissionNumber: string; classId: string; familyId?: string }>;
  availableStudentUsers: Array<{ id: string; name: string }>;
  sessions: Array<{ id: string; name: string; terms: Array<{ id: string; name: string }> }>;
  numbering:
    | { available: true; nextNumber: string; nextSequence: number; policyVersion: number }
    | { available: false; reason: string };
}

export interface ImportRowReviewInput {
  resolutionAction: "create_new" | "merge_existing" | "ignore";
  selectedClassId?: string;
  selectedSubjectId?: string;
  selectedStudentId?: string;
  selectedUserId?: string;
  selectedFamilyId?: string;
  selectedSessionId?: string;
  selectedTermId?: string;
  admissionNumberMode?: "supplied" | "official_generated";
  manualNumberConfirmed?: boolean;
  manualNumberReason?: string;
  advanceCounterTo?: number;
  expectedNumberPolicyVersion?: number;
}

interface Props {
  record: StagedStudentRow;
  options: ImportReviewOptions;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ImportRowReviewInput) => Promise<void>;
}

export function ImportRowReviewDialog({ record, options, saving, onClose, onSave }: Props) {
  const grade = record.entityType === "grade_record";
  const supplied = Boolean(record.parsedData.admissionNumber?.trim());
  const [action, setAction] = useState<"create_new" | "merge_existing" | "ignore">(
    record.resolutionAction === "merge_existing" || record.resolutionAction === "ignore"
      ? record.resolutionAction
      : "create_new",
  );
  const [classId, setClassId] = useState(record.selectedClassId ?? "");
  const [subjectId, setSubjectId] = useState(record.selectedSubjectId ?? "");
  const [studentId, setStudentId] = useState(record.selectedStudentId ?? record.existingStudentId ?? "");
  const [userId, setUserId] = useState(record.selectedUserId ?? "");
  const [familyId, setFamilyId] = useState(record.selectedFamilyId ?? "");
  const [sessionId, setSessionId] = useState(record.selectedSessionId ?? "");
  const [termId, setTermId] = useState(record.selectedTermId ?? "");
  const [confirmed, setConfirmed] = useState(record.manualNumberConfirmed ?? false);
  const [reason, setReason] = useState(record.manualNumberReason ?? "Historical identifier preserved during reviewed import");
  const [advance, setAdvance] = useState(record.advanceCounterTo !== undefined);
  const [advanceTo, setAdvanceTo] = useState(String(record.advanceCounterTo ?? ""));
  const terms = options.sessions.find((session) => session.id === sessionId)?.terms ?? [];

  useEffect(() => {
    if (termId && !terms.some((term) => term.id === termId)) setTermId("");
  }, [termId, terms]);

  const generatedUnavailable = !supplied && action === "create_new" && !options.numbering.available;
  const parsedAdvance = Number(advanceTo);
  const validAdvance = !advance || (
    options.numbering.available &&
    Number.isSafeInteger(parsedAdvance) &&
    parsedAdvance > options.numbering.nextSequence
  );
  const canSave = action === "ignore" || (
    grade
      ? action === "create_new" && Boolean(studentId && classId && subjectId && sessionId && termId)
      : action === "merge_existing"
        ? Boolean(studentId)
        : Boolean(classId && userId) && (supplied ? confirmed && reason.trim().length >= 8 && validAdvance : !generatedUnavailable)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="import-review-title">
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave({
            resolutionAction: action,
            selectedClassId: classId || undefined,
            selectedSubjectId: subjectId || undefined,
            selectedStudentId: studentId || undefined,
            selectedUserId: userId || undefined,
            selectedFamilyId: familyId || undefined,
            selectedSessionId: sessionId || undefined,
            selectedTermId: termId || undefined,
            admissionNumberMode: action === "create_new" && !grade ? (supplied ? "supplied" : "official_generated") : undefined,
            manualNumberConfirmed: supplied && action === "create_new" ? confirmed : undefined,
            manualNumberReason: supplied && action === "create_new" ? reason : undefined,
            advanceCounterTo: supplied && action === "create_new" && advance ? parsedAdvance : undefined,
            expectedNumberPolicyVersion: action === "create_new" && !grade && options.numbering.available && (!supplied || advance)
              ? options.numbering.policyVersion
              : undefined,
          });
        }}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="import-review-title" className="font-bold text-slate-900">Review row #{record.rowNumber}</h2>
            <p className="mt-1 text-xs text-slate-500">{record.parsedData.firstName} {record.parsedData.lastName}. Imported text is reference data, never a database instruction.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close row review" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 p-6 text-sm">
          <label className="block font-semibold text-slate-700">
            Reviewed action
            <select aria-label="Reviewed action" value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
              <option value="create_new">{grade ? "Create assessment record" : "Create student enrollment"}</option>
              {!grade && <option value="merge_existing">Merge into selected existing student</option>}
              <option value="ignore">Ignore row</option>
            </select>
          </label>

          {action === "merge_existing" && (
            <Select label="Existing student merge target" value={studentId} onChange={setStudentId} options={options.students.map((item) => ({ value: item.id, label: `${item.name} — ${item.admissionNumber}` }))} />
          )}

          {action === "create_new" && !grade && (
            <>
              <Select label="Existing un-enrolled student identity" value={userId} onChange={setUserId} options={options.availableStudentUsers.map((item) => ({ value: item.id, label: item.name }))} />
              <Select label="Existing class placement" value={classId} onChange={setClassId} options={options.classes.map((item) => ({ value: item.id, label: `${item.name} (${item.level})` }))} />
              <Select label="Existing family (optional — no automatic household linking)" value={familyId} onChange={setFamilyId} optional options={options.families.map((item) => ({ value: item.id, label: item.name }))} />
              {supplied ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Preserve historical admission ID: <span className="font-mono">{record.parsedData.admissionNumber}</span></p>
                  <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed this exact historical identifier and its uniqueness.</label>
                  <label className="block">Audit reason<input aria-label="Historical number reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2" /></label>
                  <label className="flex gap-2"><input type="checkbox" checked={advance} onChange={(event) => setAdvance(event.target.checked)} />Explicitly advance the official next sequence</label>
                  {advance && options.numbering.available && <input aria-label="Official next sequence" type="number" min={options.numbering.nextSequence + 1} value={advanceTo} onChange={(event) => setAdvanceTo(event.target.value)} className="block w-full rounded-lg border border-amber-300 bg-white p-2" />}
                  {advance && !options.numbering.available && <p role="alert" className="text-rose-800">Counter advancement unavailable: {options.numbering.reason}</p>}
                  {!advance && <p className="text-xs text-amber-800">Official counter remains unchanged.</p>}
                </div>
              ) : options.numbering.available ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">Official H4 proposal starts at <span className="font-mono">{options.numbering.nextNumber}</span>.</p>
                  <p className="mt-1 text-xs text-slate-600">Approval calculates an exact sequence-ordered proposal for every missing ID. It is allocated transactionally only during commit and fails stale if enrollment changes the counter.</p>
                </div>
              ) : (
                <p role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0" />Official numbering unavailable: {options.numbering.reason}</p>
              )}
            </>
          )}

          {action === "create_new" && grade && (
            <>
              <Select label="Existing student" value={studentId} onChange={setStudentId} options={options.students.map((item) => ({ value: item.id, label: `${item.name} — ${item.admissionNumber}` }))} />
              <Select label="Existing class" value={classId} onChange={setClassId} options={options.classes.map((item) => ({ value: item.id, label: item.name }))} />
              <Select label="Existing subject" value={subjectId} onChange={setSubjectId} options={options.subjects.map((item) => ({ value: item.id, label: item.name }))} />
              <Select label="Academic session" value={sessionId} onChange={setSessionId} options={options.sessions.map((item) => ({ value: item.id, label: item.name }))} />
              <Select label="Term in selected session" value={termId} onChange={setTermId} options={terms.map((item) => ({ value: item.id, label: item.name }))} />
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancel</button>
          <button type="submit" disabled={!canSave || saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Validating…" : "Save reviewed decision"}</button>
        </div>
      </form>
    </div>
  );
}

function Select({ label, value, onChange, options, optional = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
}) {
  return (
    <label className="block font-semibold text-slate-700">
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
        <option value="">{optional ? "None" : "Select…"}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
