import React, { useState } from "react";
import { Search, AlertTriangle, AlertCircle, CheckCircle2, Loader2, SlidersHorizontal } from "lucide-react";

export interface StagedStudentRow {
  _id: string;
  rowNumber: number;
  entityType: "student" | "grade_record";
  rowRevision?: number;
  reviewStatus?: "pending" | "approved";
  selectedClassId?: string;
  selectedSubjectId?: string;
  selectedStudentId?: string;
  selectedUserId?: string;
  selectedFamilyId?: string;
  selectedSessionId?: string;
  selectedTermId?: string;
  existingStudentId?: string;
  clashCandidateId?: string;
  admissionNumberMode?: "supplied" | "official_generated";
  manualNumberConfirmed?: boolean;
  manualNumberReason?: string;
  advanceCounterTo?: number;
  proposedAdmissionNumber?: string;
  commitOutcome?: "created" | "merged" | "ignored" | "grade_created";
  commitReceiptId?: string;
  parsedData: {
    firstName: string;
    lastName: string;
    middleName?: string;
    admissionNumber?: string;
    gender: string;
    className: string;
    matchedClassId?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    address?: string;
    subjectName?: string;
    ca1?: number;
    ca2?: number;
    exam?: number;
  };
  validationStatus: "valid" | "warning" | "error";
  validationErrors: string[];
  clashConfidence?: number;
  clashReason?: string;
  isResolved: boolean;
  resolutionAction?: "create_new" | "merge_existing" | "link_as_sibling" | "ignore";
}

export interface RosterReviewTabProps {
  records: StagedStudentRow[];
  onPatchField: (recordId: string, patch: Record<string, unknown>) => Promise<void>;
  onOpenClashModal: (record: StagedStudentRow) => void;
  onReview: (record: StagedStudentRow) => void;
  readyRecordIds?: string[];
  createRecordIds?: string[];
  classes?: Array<{ id: string; name: string }>;
  isApplyingBulkAction?: boolean;
  onAssignClass?: (recordIds: string[], classId: string) => Promise<void>;
  onCreateRecords?: (recordIds: string[]) => Promise<void>;
  onSkipRecords?: (recordIds: string[]) => Promise<void>;
}

type RosterState = "ready" | "needs_class" | "duplicate" | "invalid" | "reviewed";

export function RosterReviewTab({ records, onPatchField, onOpenClashModal, onReview, readyRecordIds = [], createRecordIds = [], classes = [], isApplyingBulkAction = false, onAssignClass, onCreateRecords, onSkipRecords }: RosterReviewTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | RosterState>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkClassId, setBulkClassId] = useState("");
  const readyIds = new Set(readyRecordIds);
  const creatableIds = new Set(createRecordIds);
  const getRosterState = (rec: StagedStudentRow): RosterState => {
    if (rec.reviewStatus === "approved") return "reviewed";
    if (
      rec.validationStatus === "warning" &&
      rec.clashConfidence !== undefined &&
      (rec.clashCandidateId || rec.existingStudentId)
    ) return "duplicate";
    if (rec.validationStatus === "error") return "invalid";
    if (!rec.parsedData.matchedClassId) return "needs_class";
    if (readyIds.has(rec._id)) return "ready";
    return "invalid";
  };

  const filteredRecords = records.filter((rec) => {
    if (rec.entityType !== "student") return false;
    if (statusFilter !== "all" && getRosterState(rec) !== statusFilter) {
      return false;
    }
    if (!searchTerm) return true;

    const term = searchTerm.toLowerCase();
    const fullName = `${rec.parsedData.firstName} ${rec.parsedData.middleName || ""} ${rec.parsedData.lastName}`.toLowerCase();
    const adm = rec.parsedData.admissionNumber?.toLowerCase() || "";
    const cls = rec.parsedData.className.toLowerCase();
    const phone = rec.parsedData.guardianPhone || "";

    return (
      fullName.includes(term) ||
      adm.includes(term) ||
      cls.includes(term) ||
      phone.includes(term) ||
      String(rec.rowNumber).includes(term)
    );
  });

  const selectableFilteredRecords = filteredRecords.filter(
    (record) => record.reviewStatus !== "approved",
  );

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-slate-600">
        <strong>Review row</strong> records what should happen when you commit the import. A <strong>possible duplicate</strong> is suggested only from identity evidence; nothing is merged automatically.
      </p>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student name, class, ID or phone..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9.5 pr-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
          {(["all", "ready", "needs_class", "duplicate", "invalid", "reviewed"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition-all ${
                statusFilter === filter
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {filter === "all" ? "All rows" : filter.replace("_", " ")}
            </button>
          ))}
          </div>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <span className="text-xs font-bold text-indigo-900">{selectedIds.length} selected</span>
          <select
            value={bulkClassId}
            onChange={(event) => setBulkClassId(event.target.value)}
            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            <option value="">Choose class…</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="button" disabled={!bulkClassId || isApplyingBulkAction} onClick={async () => { if (!bulkClassId || !onAssignClass) return; await onAssignClass(selectedIds, bulkClassId); setSelectedIds([]); }} className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 disabled:opacity-50">Assign class</button>
          <button type="button" disabled={isApplyingBulkAction || selectedIds.some((id) => !creatableIds.has(id))} onClick={async () => { if (!onCreateRecords) return; await onCreateRecords(selectedIds); setSelectedIds([]); }} title={selectedIds.some((id) => !creatableIds.has(id)) ? "Resolve invalid data and class placement first" : undefined} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            {isApplyingBulkAction && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create new records
          </button>
          <button type="button" disabled={isApplyingBulkAction} onClick={async () => { if (!onSkipRecords) return; await onSkipRecords(selectedIds); setSelectedIds([]); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">Skip selected</button>
        </div>
      )}

      {/* Roster Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3.5 w-10">
                <input type="checkbox" aria-label="Select all filtered rows" disabled={selectableFilteredRecords.length === 0} checked={selectableFilteredRecords.length > 0 && selectableFilteredRecords.every((record) => selectedIds.includes(record._id))} onChange={(event) => setSelectedIds(event.target.checked ? [...new Set([...selectedIds, ...selectableFilteredRecords.map((record) => record._id)])] : selectedIds.filter((id) => !selectableFilteredRecords.some((record) => record._id === id)))} />
              </th>
              <th className="px-4 py-3.5 w-16">Row</th>
              <th className="px-4 py-3.5 min-w-[200px]">Student Name</th>
              <th className="px-4 py-3.5 min-w-[130px]">Class</th>
              <th className="px-4 py-3.5 min-w-[150px]">Admission ID</th>
              <th className="px-4 py-3.5 min-w-[110px]">Gender</th>
              <th className="px-4 py-3.5 min-w-[160px]">Guardian Phone</th>
              <th className="px-4 py-3.5 min-w-[190px] text-right">Review & validation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-xs text-slate-400">
                  No staged records match the current filter.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec._id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select row ${rec.rowNumber}`} disabled={rec.reviewStatus === "approved"} checked={selectedIds.includes(rec._id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, rec._id] : selectedIds.filter((id) => id !== rec._id))} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">
                    #{rec.rowNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        defaultValue={rec.parsedData.firstName}
                        onBlur={(e) => {
                          if (e.target.value !== rec.parsedData.firstName) {
                            onPatchField(rec._id, { firstName: e.target.value });
                          }
                        }}
                        className="w-24 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold text-slate-900 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        placeholder="First"
                      />
                      <input
                        type="text"
                        defaultValue={rec.parsedData.lastName}
                        onBlur={(e) => {
                          if (e.target.value !== rec.parsedData.lastName) {
                            onPatchField(rec._id, { lastName: e.target.value });
                          }
                        }}
                        className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-bold text-slate-900 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        placeholder="Last"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={rec.parsedData.className}
                      onBlur={(e) => {
                        if (e.target.value !== rec.parsedData.className) {
                          onPatchField(rec._id, { className: e.target.value });
                        }
                      }}
                      className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={rec.parsedData.admissionNumber || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (rec.parsedData.admissionNumber || "")) {
                          onPatchField(rec._id, { admissionNumber: e.target.value });
                        }
                      }}
                      placeholder="Auto"
                      className="w-32 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-mono font-medium text-slate-700 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                    {rec.proposedAdmissionNumber && (
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">Approved proposal: <span className="font-mono">{rec.proposedAdmissionNumber}</span></div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={rec.parsedData.gender}
                      onChange={(e) => onPatchField(rec._id, { gender: e.target.value })}
                      className="rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden cursor-pointer"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unspecified">Unspecified</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      defaultValue={rec.parsedData.guardianPhone || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (rec.parsedData.guardianPhone || "")) {
                          onPatchField(rec._id, { guardianPhone: e.target.value });
                        }
                      }}
                      placeholder="+234..."
                      className="w-36 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-mono text-slate-700 hover:border-slate-300 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => onReview(rec)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                      {rec.reviewStatus === "approved" ? "Edit review" : "Review row"}
                    </button>
                    {rec.reviewStatus === "approved" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700" title={rec.proposedAdmissionNumber ? `Proposed ID: ${rec.proposedAdmissionNumber}` : undefined}>
                        <CheckCircle2 className="h-3 w-3" />{rec.commitOutcome ?? "Reviewed"}
                      </span>
                    ) : rec.validationStatus === "warning" &&
                      rec.clashConfidence !== undefined &&
                      (rec.clashCandidateId || rec.existingStudentId) ? (
                      <button
                        type="button"
                        onClick={() => onOpenClashModal(rec)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        <span>Possible duplicate ({rec.clashConfidence}%)</span>
                      </button>
                    ) : rec.validationStatus === "error" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700" title={rec.validationErrors.join(", ")}>
                        <AlertCircle className="h-3 w-3" /> Invalid
                      </span>
                    ) : !rec.parsedData.matchedClassId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Needs class
                      </span>
                    ) : rec.validationStatus === "warning" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                        <AlertCircle className="h-3 w-3" /> Invalid
                      </span>
                    ) : readyIds.has(rec._id) ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                        <AlertCircle className="h-3 w-3" /> Missing prerequisite
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
