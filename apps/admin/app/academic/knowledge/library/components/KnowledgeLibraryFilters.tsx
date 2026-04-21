"use client";

import { Filter, Search, X } from "lucide-react";

import type { SubjectRecord } from "@/types";

import type {
  KnowledgeLibraryFilterState,
  KnowledgeMaterialOwnerRole,
  KnowledgeMaterialProcessingStatus,
  KnowledgeMaterialReviewStatus,
  KnowledgeMaterialSourceType,
  KnowledgeMaterialVisibility,
} from "./types";

interface KnowledgeLibraryFiltersProps {
  filters: KnowledgeLibraryFilterState;
  subjects: SubjectRecord[];
  onChange: (patch: Partial<KnowledgeLibraryFilterState>) => void;
  onClear: () => void;
}

const VISIBILITY_OPTIONS: Array<{ value: KnowledgeMaterialVisibility | "all"; label: string }> = [
  { value: "all", label: "All visibility" },
  { value: "private_owner", label: "Private owner" },
  { value: "staff_shared", label: "Staff shared" },
  { value: "class_scoped", label: "Class scoped" },
  { value: "student_approved", label: "Student approved" },
];

const REVIEW_OPTIONS: Array<{ value: KnowledgeMaterialReviewStatus | "all"; label: string }> = [
  { value: "all", label: "All review states" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
];

const SOURCE_OPTIONS: Array<{ value: KnowledgeMaterialSourceType | "all"; label: string }> = [
  { value: "all", label: "All source types" },
  { value: "file_upload", label: "File upload" },
  { value: "text_entry", label: "Text entry" },
  { value: "youtube_link", label: "YouTube link" },
  { value: "generated_draft", label: "Generated draft" },
  { value: "student_upload", label: "Student upload" },
  { value: "imported_curriculum", label: "Imported curriculum" },
];

const PROCESSING_OPTIONS: Array<{ value: KnowledgeMaterialProcessingStatus | "all"; label: string }> = [
  { value: "all", label: "All processing states" },
  { value: "awaiting_upload", label: "Awaiting upload" },
  { value: "queued", label: "Queued" },
  { value: "extracting", label: "Extracting" },
  { value: "ocr_needed", label: "OCR needed" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

const OWNER_OPTIONS: Array<{ value: KnowledgeMaterialOwnerRole | "all"; label: string }> = [
  { value: "all", label: "All owners" },
  { value: "teacher", label: "Teacher-owned" },
  { value: "admin", label: "Admin-owned" },
  { value: "student", label: "Student-owned" },
  { value: "system", label: "System-generated" },
];

function inputClassName() {
  return "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";
}

export function KnowledgeLibraryFilters({
  filters,
  subjects,
  onChange,
  onClear,
}: KnowledgeLibraryFiltersProps) {
  const hasActiveFilters =
    filters.searchQuery.trim().length > 0 ||
    filters.visibility !== "all" ||
    filters.reviewStatus !== "all" ||
    filters.sourceType !== "all" ||
    filters.processingStatus !== "all" ||
    filters.ownerRole !== "all" ||
    filters.subjectId !== "all" ||
    filters.level !== "all";

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            Search and filters
          </div>
          <p className="text-[13px] font-medium leading-relaxed text-slate-500">
            Search school materials by title, labels, visibility, review state, owner, or content source.
          </p>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr] xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Search</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              value={filters.searchQuery}
              onChange={(e) => onChange({ searchQuery: e.target.value })}
              placeholder="Search title, owner, label, or topic"
              className={`${inputClassName()} pl-9`}
            />
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Visibility</span>
          <select value={filters.visibility} onChange={(e) => onChange({ visibility: e.target.value as KnowledgeMaterialVisibility | "all" })} className={inputClassName()}>
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Review</span>
          <select value={filters.reviewStatus} onChange={(e) => onChange({ reviewStatus: e.target.value as KnowledgeMaterialReviewStatus | "all" })} className={inputClassName()}>
            {REVIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Source</span>
          <select value={filters.sourceType} onChange={(e) => onChange({ sourceType: e.target.value as KnowledgeMaterialSourceType | "all" })} className={inputClassName()}>
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Processing</span>
          <select value={filters.processingStatus} onChange={(e) => onChange({ processingStatus: e.target.value as KnowledgeMaterialProcessingStatus | "all" })} className={inputClassName()}>
            {PROCESSING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Owner</span>
          <select value={filters.ownerRole} onChange={(e) => onChange({ ownerRole: e.target.value as KnowledgeMaterialOwnerRole | "all" })} className={inputClassName()}>
            {OWNER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Subject</span>
          <select value={filters.subjectId} onChange={(e) => onChange({ subjectId: e.target.value })} className={inputClassName()}>
            <option value="all">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject._id} value={subject._id}>
                {subject.name} ({subject.code})
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Level</span>
          <input
            value={filters.level === "all" ? "" : filters.level}
            onChange={(e) => onChange({ level: e.target.value || "all" })}
            placeholder="e.g. JSS 1"
            className={inputClassName()}
          />
        </label>
      </div>
    </div>
  );
}
