import React, { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import type { StagedStudentRow } from "../Tabs/RosterReviewTab";

export interface ImportReviewOptions {
  classes: Array<{ id: string; name: string; level: string }>;
  subjects: Array<{ id: string; name: string }>;
  families: Array<{ id: string; name: string }>;
  students: Array<{
    id: string;
    name: string;
    admissionNumber: string;
    classId: string;
    familyId?: string;
  }>;
  availableStudentUsers: Array<{ id: string; name: string }>;
  sessions: Array<{
    id: string;
    name: string;
    terms: Array<{ id: string; name: string }>;
  }>;
  numbering:
    | {
        available: true;
        nextNumber: string;
        nextSequence: number;
        policyVersion: number;
        formatVersion: string;
        counterKey: string;
        counterVersion: number;
        sessionId: string;
        resetPeriod: string;
      }
    | { available: false; reason: string };
  numberingByLevel?: Array<{
    level: string;
    numbering:
      | {
          available: true;
          nextNumber: string;
          nextSequence: number;
          policyVersion: number;
          formatVersion: string;
          counterKey: string;
          counterVersion: number;
          sessionId: string;
          resetPeriod: string;
        }
      | { available: false; reason: string };
  }>;
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
  expectedNumberFormatVersion?: string;
  expectedNumberCounterKey?: string;
  expectedNumberCounterVersion?: number;
  expectedNumberSessionId?: string;
  expectedNumberResetPeriod?: string;
}

interface Props {
  record: StagedStudentRow;
  options: ImportReviewOptions;
  saving: boolean;
  onClose: () => void;
  onSave: (input: ImportRowReviewInput) => Promise<void>;
}

export function ImportRowReviewDialog({
  record,
  options,
  saving,
  onClose,
  onSave,
}: Props) {
  const grade = record.entityType === "grade_record";
  const supplied = Boolean(record.parsedData.admissionNumber?.trim());
  const [action, setAction] = useState<
    "create_new" | "merge_existing" | "ignore"
  >(
    record.resolutionAction === "merge_existing" ||
      record.resolutionAction === "ignore"
      ? record.resolutionAction
      : "create_new",
  );
  const [classId, setClassId] = useState(
    record.selectedClassId ?? record.parsedData.matchedClassId ?? "",
  );
  const [subjectId, setSubjectId] = useState(record.selectedSubjectId ?? "");
  const [studentId, setStudentId] = useState(
    record.selectedStudentId ?? record.existingStudentId ?? "",
  );
  const [familyId, setFamilyId] = useState(record.selectedFamilyId ?? "");
  const [sessionId, setSessionId] = useState(record.selectedSessionId ?? "");
  const [termId, setTermId] = useState(record.selectedTermId ?? "");
  const [confirmed, setConfirmed] = useState(
    record.manualNumberConfirmed ?? false,
  );
  const [reason, setReason] = useState(
    record.manualNumberReason ??
      "Historical identifier preserved during reviewed import",
  );
  const [advance, setAdvance] = useState(record.advanceCounterTo !== undefined);
  const [advanceTo, setAdvanceTo] = useState(
    String(record.advanceCounterTo ?? ""),
  );
  const terms =
    options.sessions.find((session) => session.id === sessionId)?.terms ?? [];
  const selectedLevel = options.classes.find(
    (item) => item.id === classId,
  )?.level;
  const selectedNumbering =
    options.numberingByLevel?.find((item) => item.level === selectedLevel)
      ?.numbering ?? options.numbering;

  useEffect(() => {
    if (termId && !terms.some((term) => term.id === termId)) setTermId("");
  }, [termId, terms]);

  const generatedUnavailable =
    !supplied && action === "create_new" && !selectedNumbering.available;
  const parsedAdvance = Number(advanceTo);
  const validAdvance =
    !advance ||
    (selectedNumbering.available &&
      Number.isSafeInteger(parsedAdvance) &&
      parsedAdvance > selectedNumbering.nextSequence);
  const canSave =
    action === "ignore" ||
    (grade
      ? action === "create_new" &&
        Boolean(studentId && classId && subjectId && sessionId && termId)
      : action === "merge_existing"
        ? Boolean(studentId)
        : Boolean(classId) &&
          (supplied
            ? confirmed && reason.trim().length >= 8 && validAdvance
            : !generatedUnavailable));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-review-title"
    >
      <form
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSave({
            resolutionAction: action,
            selectedClassId: classId || undefined,
            selectedSubjectId: subjectId || undefined,
            selectedStudentId: studentId || undefined,
            selectedUserId: undefined,
            selectedFamilyId: familyId || undefined,
            selectedSessionId: sessionId || undefined,
            selectedTermId: termId || undefined,
            admissionNumberMode:
              action === "create_new" && !grade
                ? supplied
                  ? "supplied"
                  : "official_generated"
                : undefined,
            manualNumberConfirmed:
              supplied && action === "create_new" ? confirmed : undefined,
            manualNumberReason:
              supplied && action === "create_new" ? reason : undefined,
            advanceCounterTo:
              supplied && action === "create_new" && advance
                ? parsedAdvance
                : undefined,
            expectedNumberPolicyVersion:
              action === "create_new" &&
              !grade &&
              selectedNumbering.available &&
              (!supplied || advance)
                ? selectedNumbering.policyVersion
                : undefined,
            expectedNumberFormatVersion:
              action === "create_new" &&
              !grade &&
              selectedNumbering.available &&
              (!supplied || advance)
                ? selectedNumbering.formatVersion
                : undefined,
            expectedNumberCounterKey:
              action === "create_new" &&
              !grade &&
              selectedNumbering.available &&
              (!supplied || advance)
                ? selectedNumbering.counterKey
                : undefined,
            expectedNumberCounterVersion:
              action === "create_new" &&
              !grade &&
              selectedNumbering.available &&
              (!supplied || advance)
                ? selectedNumbering.counterVersion
                : undefined,
            expectedNumberSessionId:
              action === "create_new" && !grade && selectedNumbering.available && (!supplied || advance)
                ? selectedNumbering.sessionId
                : undefined,
            expectedNumberResetPeriod:
              action === "create_new" && !grade && selectedNumbering.available && (!supplied || advance)
                ? selectedNumbering.resetPeriod
                : undefined,
          });
        }}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="import-review-title" className="font-bold text-slate-900">
              Decide what happens to row #{record.rowNumber}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {record.parsedData.firstName} {record.parsedData.lastName}. This decision is saved for the final import; it does not change school records yet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close row review"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-6 text-sm">
          <label className="block font-semibold text-slate-700">
            What should happen to this spreadsheet row?
            <select
              aria-label="Reviewed action"
              value={action}
              onChange={(event) =>
                setAction(event.target.value as typeof action)
              }
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
            >
              <option value="create_new">
                {grade
                  ? "Add this assessment result"
                  : "Create a new student record"}
              </option>
              {!grade && (
                <option value="merge_existing">
                  Match this row to an existing student
                </option>
              )}
              <option value="ignore">Skip this row — import nothing</option>
            </select>
          </label>

          {action === "merge_existing" && (
            <Select
              label="Existing student merge target"
              value={studentId}
              onChange={setStudentId}
              options={options.students.map((item) => ({
                value: item.id,
                label: `${item.name} — ${item.admissionNumber}`,
              }))}
            />
          )}

          {action === "create_new" && !grade && (
            <>
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                A new internal student profile will be created when the approved import is committed. No login, password, invitation, or portal access will be created.
              </p>
              <Select
                label="Class placement (required)"
                value={classId}
                onChange={setClassId}
                options={options.classes.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.level})`,
                }))}
              />
              <Select
                label="Existing family (optional — no automatic household linking)"
                value={familyId}
                onChange={setFamilyId}
                optional
                options={options.families.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              {supplied ? (
                <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">
                    Keep spreadsheet admission ID:{" "}
                    <span className="font-mono">
                      {record.parsedData.admissionNumber}
                    </span>
                  </p>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    Confirm this admission ID belongs to this student. The system will still block duplicate IDs.
                  </label>
                  <label className="block">
                    Audit reason
                    <input
                      aria-label="Historical number reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2"
                    />
                  </label>
                  <details className="rounded-lg border border-amber-200 bg-white/60 p-3 text-sm text-amber-900">
                    <summary className="cursor-pointer font-semibold">Advanced: update the school’s next generated number</summary>
                    <p className="mt-2 text-xs leading-relaxed text-amber-800">
                      This does not apply the numbering format to this row. It only moves the official counter forward so later automatically generated IDs do not reuse an earlier sequence.
                    </p>
                    <label className="mt-3 flex gap-2">
                      <input type="checkbox" checked={advance} onChange={(event) => setAdvance(event.target.checked)} />
                      Move the official counter forward
                    </label>
                    {advance && selectedNumbering.available && (
                      <input aria-label="Official next sequence" type="number" min={selectedNumbering.nextSequence + 1} value={advanceTo} onChange={(event) => setAdvanceTo(event.target.value)} className="mt-2 block w-full rounded-lg border border-amber-300 bg-white p-2" />
                    )}
                    {advance && !selectedNumbering.available && (
                      <p role="alert" className="mt-2 text-rose-800">Counter update unavailable: {selectedNumbering.reason}</p>
                    )}
                  </details>
                </div>
              ) : selectedNumbering.available ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-800">
                    Next admission ID preview:{" "}
                    <span className="font-mono">
                      {selectedNumbering.nextNumber}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    The final ID is reserved only when this import is committed. If another student is enrolled first, you will be asked to review again so IDs cannot collide.
                  </p>
                </div>
              ) : (
                <p
                  role="alert"
                  className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Official numbering unavailable: {selectedNumbering.reason}
                </p>
              )}
            </>
          )}

          {action === "create_new" && grade && (
            <>
              <Select
                label="Existing student"
                value={studentId}
                onChange={setStudentId}
                options={options.students.map((item) => ({
                  value: item.id,
                  label: `${item.name} — ${item.admissionNumber}`,
                }))}
              />
              <Select
                label="Existing class"
                value={classId}
                onChange={setClassId}
                options={options.classes.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <Select
                label="Existing subject"
                value={subjectId}
                onChange={setSubjectId}
                options={options.subjects.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <Select
                label="Academic session"
                value={sessionId}
                onChange={setSessionId}
                options={options.sessions.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <Select
                label="Term in selected session"
                value={termId}
                onChange={setTermId}
                options={terms.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Validating…" : "Save decision for final import"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
}) {
  return (
    <label className="block font-semibold text-slate-700">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2"
      >
        <option value="">{optional ? "None" : "Select…"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
