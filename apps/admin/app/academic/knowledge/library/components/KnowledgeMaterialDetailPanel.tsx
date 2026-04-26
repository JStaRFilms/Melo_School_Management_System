"use client";

import {
  Archive,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  EyeOff,
  Link2,
  Save,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { AdminSurface } from "@/components/ui/AdminSurface";
import type { SubjectRecord } from "@/types";

import type {
  KnowledgeLibraryDetailResponse,
  KnowledgeMaterialReviewStatus,
  KnowledgeMaterialVisibility,
} from "./types";

interface KnowledgeMaterialDetailPanelProps {
  detail: KnowledgeLibraryDetailResponse | null;
  subjects: SubjectRecord[];
  topics: Array<{
    _id: string;
    title: string;
    subjectId: string;
    subjectName: string;
    level: string;
    termId: string;
    status: string;
  }>;
  onClose?: () => void;
  levelOptions: Array<{ value: string; label: string }>;
  onSaveDetails: (args: {
    materialId: string;
    title: string;
    description?: string;
    subjectId: string;
    level: string;
    topicLabel: string;
    topicId?: string;
  }) => Promise<void>;
  onCreateTopic: (args: {
    title: string;
    summary?: string;
    subjectId: string;
    level: string;
  }) => Promise<{
    _id: string;
    title: string;
    subjectId: string;
    subjectName: string;
    level: string;
    termId: string;
    status: "draft" | "active" | "retired";
  }>;
  onSaveState: (args: {
    materialId: string;
    visibility?: KnowledgeMaterialVisibility;
    reviewStatus?: KnowledgeMaterialReviewStatus;
  }) => Promise<void>;
  isSavingDetails?: boolean;
  isSavingState?: boolean;
  variant?: "sidebar" | "sheet";
}

function statusTone(value: string) {
  switch (value) {
    case "approved":
    case "indexed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "pending_review":
    case "indexing":
    case "queued":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "rejected":
    case "failed":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "archived":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function visibilityIcon(visibility: KnowledgeMaterialVisibility) {
  return visibility === "private_owner" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />;
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatDate(value: number) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fieldClassName(
  base = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
) {
  return base;
}

function buildLevelOptionsWithCurrentValue(
  levelOptions: Array<{ value: string; label: string }>,
  currentLevel: string
) {
  const trimmed = currentLevel.trim();
  if (!trimmed) {
    return levelOptions;
  }

  if (levelOptions.some((option) => option.value === trimmed)) {
    return levelOptions;
  }

  return [{ value: trimmed, label: `Legacy: ${trimmed}` }, ...levelOptions];
}

function sectionLabel(text: string) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
      {text}
    </p>
  );
}

function DetailPlaceholder({ onClose }: { onClose?: () => void }) {
  return (
    <div className="space-y-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-200 shadow-sm ring-1 ring-slate-950/5">
        <BookOpenText className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-black tracking-tight text-slate-950">
          Select a material
        </h3>
        <p className="text-[13px] font-medium leading-relaxed text-slate-500">
          Choose a library item to inspect ownership, labels, state, and audit history.
        </p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950"
        >
          Close
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function MetaChip({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-sm font-bold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

export function KnowledgeMaterialDetailPanel({
  detail,
  subjects,
  topics,
  levelOptions,
  onClose,
  onSaveDetails,
  onCreateTopic,
  onSaveState,
  isSavingDetails = false,
  isSavingState = false,
  variant = "sidebar",
}: KnowledgeMaterialDetailPanelProps) {
  const material = detail?.material ?? null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [topicId, setTopicId] = useState("");
  const [visibility, setVisibility] = useState<KnowledgeMaterialVisibility>("staff_shared");
  const [reviewStatus, setReviewStatus] = useState<KnowledgeMaterialReviewStatus>("draft");
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!material) {
      return;
    }

    setTitle(material.title);
    setDescription(material.description ?? "");
    setSubjectId(material.subjectId);
    setLevel(material.level);
    setTopicLabel(material.topicLabel);
    setTopicId(material.topicId ?? "");
    setVisibility(material.visibility);
    setReviewStatus(material.reviewStatus);
    setLocalNotice(null);
  }, [material]);

  const subjectOptions = useMemo(() => subjects.filter((subject) => !subject.name.startsWith("Archived ")), [subjects]);

  const storageLabel = detail?.storage
    ? `${Math.max(1, Math.round(detail.storage.size / 1024))} KB`
    : "No file storage";
  const sourceProof = detail?.material.sourceProof ?? null;

  const auditEvents = detail?.auditEvents ?? [];
  const auditCount = auditEvents.length;

  const handleSaveDetails = async (event: FormEvent) => {
    event.preventDefault();
    if (!material) return;

    setLocalNotice(null);
    try {
      await onSaveDetails({
        materialId: material._id,
        title,
        description: description.trim() ? description : undefined,
        subjectId,
        level,
        topicLabel,
        topicId: topicId || undefined,
      });
      setLocalNotice("Details saved.");
    } catch {
      setLocalNotice("Could not save details just now.");
    }
  };

  const handleCreateTopicAndAttach = async () => {
    if (!material) return;

    setLocalNotice(null);
    try {
      const createdTopic = await onCreateTopic({
        title: topicLabel,
        summary: description.trim() ? description : undefined,
        subjectId,
        level,
      });

      await onSaveDetails({
        materialId: material._id,
        title,
        description: description.trim() ? description : undefined,
        subjectId,
        level,
        topicLabel,
        topicId: createdTopic._id,
      });

      setTopicId(createdTopic._id);
      setLocalNotice("Topic created and attached.");
    } catch {
      setLocalNotice("Could not create and attach the topic just now.");
    }
  };

  const handleApplyState = async (next: {
    visibility?: KnowledgeMaterialVisibility;
    reviewStatus?: KnowledgeMaterialReviewStatus;
  }) => {
    if (!material) return;

    setLocalNotice(null);
    try {
      await onSaveState({
        materialId: material._id,
        ...next,
      });
      setVisibility(next.visibility ?? visibility);
      setReviewStatus(next.reviewStatus ?? reviewStatus);
      setLocalNotice("State updated.");
    } catch {
      setLocalNotice("Could not update state just now.");
    }
  };

  if (!material) {
    return <DetailPlaceholder onClose={onClose} />;
  }

  return (
    <div className="space-y-5">
      {variant === "sheet" && onClose && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
              Knowledge Library
            </p>
            <h2 className="font-display text-xl font-black tracking-tight text-slate-950">
              Material Detail
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      )}

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <div className="space-y-4 p-4 md:p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(reviewStatus)}`}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                {formatStatusLabel(reviewStatus)}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(material.processingStatus)}`}>
                <Clock3 className="h-3.5 w-3.5" />
                {formatStatusLabel(material.processingStatus)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                {visibilityIcon(visibility)}
                {formatStatusLabel(visibility)}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {material.subjectName} • {material.level}
              </p>
              <h3 className="mt-1 font-display text-2xl font-black tracking-tight text-slate-950">
                {material.title}
              </h3>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-500">
                {material.description ?? material.topicLabel}
              </p>
            </div>
          </div>

          {localNotice && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold text-emerald-700">
              {localNotice}
            </div>
          )}
        </div>
      </AdminSurface>

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <form className="space-y-4 p-4 md:p-5" onSubmit={handleSaveDetails}>
          {sectionLabel("Relabel material")}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClassName()} />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${fieldClassName("min-h-[92px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5")}`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Subject</label>
                <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={fieldClassName()}>
                  {subjectOptions.map((subject) => (
                    <option key={subject._id} value={subject._id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Level</label>
                <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldClassName()}>
                  <option value="">Select level</option>
                  {buildLevelOptionsWithCurrentValue(levelOptions, level).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Topic label</label>
              <input value={topicLabel} onChange={(e) => setTopicLabel(e.target.value)} className={fieldClassName()} />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Topic attachment</label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={fieldClassName()}>
                <option value="">No topic attached</option>
                {topics.map((topic) => (
                  <option key={topic._id} value={topic._id}>
                    {topic.title} • {topic.subjectName} • {topic.level}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[11px] font-medium text-slate-500">
                  {topics.length > 0
                    ? "If the topic does not exist yet, create it from the current subject, level, and topic label."
                    : "No topics exist yet for this school. Create one from the current subject, level, and topic label."}
                </p>
                <button
                  type="button"
                  disabled={isSavingDetails || !topicLabel.trim() || !subjectId || !level.trim()}
                  onClick={handleCreateTopicAndAttach}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <BookOpenText className="h-3.5 w-3.5" />
                  {isSavingDetails ? "Working..." : "Create topic & attach"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={isSavingDetails}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {isSavingDetails ? "Saving..." : "Save relabel"}
              </button>
            </div>
          </div>
        </form>
      </AdminSurface>

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <div className="space-y-4 p-4 md:p-5">
          {sectionLabel("Visibility & review")}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Visibility</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as KnowledgeMaterialVisibility)} className={fieldClassName()}>
                <option value="private_owner">Private owner</option>
                <option value="staff_shared">Staff shared</option>
                <option value="class_scoped">Class scoped</option>
                <option value="student_approved">Student approved</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Review status</label>
              <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as KnowledgeMaterialReviewStatus)} className={fieldClassName()}>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={isSavingState}
              onClick={() => handleApplyState({ visibility, reviewStatus })}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Shield className="h-3.5 w-3.5" />
              {isSavingState ? "Saving..." : "Apply state"}
            </button>
            <button
              type="button"
              disabled={isSavingState}
              onClick={() => handleApplyState({ reviewStatus: "approved" })}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              type="button"
              disabled={isSavingState}
              onClick={() => handleApplyState({ reviewStatus: "rejected" })}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
            <button
              type="button"
              disabled={isSavingState}
              onClick={() => handleApplyState({ reviewStatus: "archived" })}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          </div>

          <p className="text-[11px] font-medium leading-relaxed text-slate-400">
            Portal exposure still requires the correct topic attachment and approval state. Admins can move a same-school record from private owner to staff shared here; teacher self-publish is just the normal teacher-side shortcut for their own materials.
          </p>
        </div>
      </AdminSurface>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetaChip label="Owner" value={`${material.ownerName} • ${material.ownerRole}`} icon={<BadgeCheck className="h-3.5 w-3.5 text-slate-400" />} />
        <MetaChip label="Source" value={formatStatusLabel(material.sourceType)} icon={<Sparkles className="h-3.5 w-3.5 text-slate-400" />} />
        <MetaChip label="Processing" value={formatStatusLabel(material.processingStatus)} icon={<Clock3 className="h-3.5 w-3.5 text-slate-400" />} />
        <MetaChip label="Search index" value={`${formatStatusLabel(material.searchStatus)} • ${material.chunkCount} chunk(s)`} icon={<Database className="h-3.5 w-3.5 text-slate-400" />} />
        <MetaChip label="Updated" value={formatDate(material.updatedAt)} icon={<CalendarClock className="h-3.5 w-3.5 text-slate-400" />} />
        <MetaChip label="Storage" value={storageLabel} icon={<Link2 className="h-3.5 w-3.5 text-slate-400" />} />
      </div>

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <div className="space-y-4 p-4 md:p-5">
          {sectionLabel("Original file and extracted proof")}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Original file
                  </p>
                  <p className="mt-1 text-sm font-bold tracking-tight text-slate-950">
                    {sourceProof?.originalFileState === "available"
                      ? "Available"
                      : sourceProof?.originalFileState === "orphaned"
                        ? "Missing from storage"
                        : "Not stored"}
                  </p>
                </div>
                {sourceProof?.originalFileUrl ? (
                  <a
                    href={sourceProof.originalFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Open file
                  </a>
                ) : null}
              </div>
              <div className="mt-3 space-y-2 text-[12px] font-medium leading-relaxed text-slate-500">
                <p>{sourceProof?.originalFileNotice ?? "No original file access is available for this material."}</p>
                <p>
                  {sourceProof?.originalFileContentType ? `${sourceProof.originalFileContentType} • ` : ""}
                  {sourceProof?.originalFileSize ? `${Math.max(1, Math.round(sourceProof.originalFileSize / 1024))} KB` : "No file size recorded"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Extracted proof
                  </p>
                  <p className="mt-1 text-sm font-bold tracking-tight text-slate-950">
                    {sourceProof?.extractedTextChunkCount ?? 0} chunk(s)
                  </p>
                </div>
              </div>
              {sourceProof?.extractedTextPreview ? (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-[12px] leading-6 text-slate-700">
                  {sourceProof.extractedTextPreview}
                </pre>
              ) : (
                <p className="mt-3 text-[12px] font-medium leading-relaxed text-slate-500">
                  No extracted text proof is available yet. Once ingestion finishes, the proof preview will appear here.
                </p>
              )}
            </div>
          </div>
          <p className="text-[11px] font-medium leading-relaxed text-slate-400">
            The proof preview comes from stored extracted chunks, so it is a lightweight check rather than a full document reader.
          </p>
        </div>
      </AdminSurface>

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <div className="space-y-4 p-4 md:p-5">
          {sectionLabel("Labels and links")}
          <div className="flex flex-wrap gap-2">
            {material.labelSuggestions.length > 0 ? (
              material.labelSuggestions.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
                >
                  {label}
                </span>
              ))
            ) : (
              <span className="rounded-full border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                No label suggestions
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Topic attachment</p>
              <p className="mt-1 text-sm font-bold tracking-tight text-slate-950">
                {material.topicId ?? "No topic attached"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">External URL</p>
              <p className="mt-1 break-all text-sm font-bold tracking-tight text-slate-950">
                {material.externalUrl ?? "No external link"}
              </p>
            </div>
          </div>
        </div>
      </AdminSurface>

      <AdminSurface as="section" rounded="2xl" className="overflow-hidden border-slate-200 bg-white">
        <div className="space-y-4 p-4 md:p-5">
          {sectionLabel(`Audit trail (${auditCount})`)}
          <div className="space-y-3">
            {auditEvents.length > 0 ? (
              auditEvents.map((event) => (
                <div key={event._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-950/5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {event.actorName} • {event.actorRole} • {formatDate(event.createdAt)}
                      </p>
                      <p className="text-sm font-bold tracking-tight text-slate-950">{event.changeSummary}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(event.eventType)}`}>
                      {formatStatusLabel(event.eventType)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-[13px] font-medium text-slate-500">
                No audit events recorded yet.
              </div>
            )}
          </div>
        </div>
      </AdminSurface>
    </div>
  );
}
