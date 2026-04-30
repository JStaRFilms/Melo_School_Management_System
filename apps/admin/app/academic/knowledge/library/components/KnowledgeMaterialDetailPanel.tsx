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
  FileText,
  Link2,
  Save,
  ScanText,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
  onArchiveMaterial?: (materialId: string) => Promise<void>;
  isSavingDetails?: boolean;
  isSavingState?: boolean;
  isActionLoading?: boolean;
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

function badgeTone(value: string) {
  return statusTone(value);
}

function visibilityIcon(visibility: KnowledgeMaterialVisibility) {
  switch (visibility) {
    case "private_owner":
      return <EyeOff className="h-3.5 w-3.5" />;
    default:
      return <Eye className="h-3.5 w-3.5" />;
  }
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

function InfoRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-950/5 last:border-0">
      <div className="flex items-center gap-2">
        <div className="text-slate-400 opacity-60">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-900">{value}</span>
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
  onArchiveMaterial,
  isSavingDetails = false,
  isSavingState = false,
  isActionLoading = false,
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
  const [showFullText, setShowFullText] = useState(false);

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

  const sourceProof = detail?.material.sourceProof ?? null;
  const auditEvents = detail?.auditEvents ?? [];
  const auditCount = auditEvents.length;

  const handleReview = async (status: KnowledgeMaterialReviewStatus) => {
    if (!material) return;
    setLocalNotice(null);
    try {
      await onSaveState({
        materialId: material._id,
        reviewStatus: status,
      });
      setReviewStatus(status);
      setLocalNotice(`Status set to ${status}.`);
    } catch {
      setLocalNotice("Review action failed.");
    }
  };

  const handleVisibility = async (v: KnowledgeMaterialVisibility) => {
    if (!material) return;
    setLocalNotice(null);
    try {
      await onSaveState({
        materialId: material._id,
        visibility: v,
      });
      setVisibility(v);
      setLocalNotice(`Visibility set to ${v.replace(/_/g, " ")}.`);
    } catch {
      setLocalNotice("Visibility update failed.");
    }
  };

  const handleArchive = async () => {
    if (!material || !onArchiveMaterial) return;
    if (!window.confirm("Archive this material? This will remove it from all libraries.")) return;
    
    setLocalNotice(null);
    try {
      await onArchiveMaterial(material._id);
      onClose?.();
    } catch {
      setLocalNotice("Archive failed.");
    }
  };

  if (!material) {
    return <DetailPlaceholder onClose={onClose} />;
  }

  return (
    <div className="space-y-6 pb-12">
      {variant === "sidebar" && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
              Academic Engine
            </p>
            <h2 className="font-display text-lg font-black tracking-tight text-slate-950">
              Material Inspector
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {localNotice && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">
          {localNotice}
        </div>
      )}

      {/* Content & Source Access */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Content Access</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {sourceProof?.originalFileUrl && (
            <a
              href={sourceProof.originalFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-950 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
            >
              <FileText className="h-4 w-4 text-indigo-500" />
              Open Source
            </a>
          )}
          {material.externalUrl && (
            <a
              href={material.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-950 shadow-sm transition-all hover:bg-slate-50 hover:shadow-md"
            >
              <Link2 className="h-4 w-4 text-blue-500" />
              External Link
            </a>
          )}
          {!sourceProof?.originalFileUrl && !material.externalUrl && (
             <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                No external source linked
             </div>
          )}
        </div>

        {sourceProof?.extractedTextPreview && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Extracted Preview</span>
              <span className="text-[8px] font-bold text-slate-300 uppercase">{sourceProof.extractedTextChunkCount} Chunks</span>
            </div>
            <div className="relative group">
              <div className="max-h-[160px] overflow-y-auto text-[11px] font-medium leading-relaxed text-slate-600 custom-scrollbar pr-1">
                {sourceProof.extractedTextPreview}
                <div className="h-8 w-full bg-gradient-to-t from-white to-transparent sticky bottom-0 pointer-events-none" />
              </div>
              <p 
                onClick={() => setShowFullText(true)}
                className="mt-2 text-[10px] font-bold text-indigo-600 cursor-pointer hover:underline"
              >
                View full extracted record →
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Full Text Overlay - Portaled to Body to avoid clipping */}
      {showFullText && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowFullText(false)} 
          />
          <div className="relative w-full max-w-2xl flex flex-col max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Database Record</p>
                <h3 className="font-display text-base font-black tracking-tight text-slate-950 truncate max-w-[400px]">
                  {material.title}
                </h3>
              </div>
              <button 
                onClick={() => setShowFullText(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-950 transition-colors"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 knowledge-scrollbar">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Extracted Text</p>
                  <div className="whitespace-pre-wrap text-[14px] font-medium leading-relaxed text-slate-700 selection:bg-indigo-50 font-sans">
                    {detail?.material.searchText || "No extracted text found."}
                  </div>
                </div>
                
                {sourceProof?.originalFileNotice && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1.5">Processing Note</p>
                    <p className="text-[12px] font-bold text-amber-900 leading-relaxed">
                      {sourceProof.originalFileNotice}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-slate-100 p-5 flex justify-end">
              <button
                onClick={() => setShowFullText(false)}
                className="h-10 px-6 rounded-xl bg-slate-950 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-900 transition-shadow hover:shadow-lg hover:shadow-slate-950/20 active:scale-95 transition-all"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Primary Identity Info */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Material attributes</h2>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="space-y-3">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Title</span>
              <p className="text-sm font-black leading-tight text-slate-950">{material.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Subject</span>
                <p className="text-[11px] font-bold text-slate-700">{material.subjectName}</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Level</span>
                <p className="text-[11px] font-bold text-slate-700">{material.level}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Review Action */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Verification</h2>
        </div>
        
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
          <div className="flex gap-2">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${badgeTone(material.reviewStatus)}`}>
              {material.reviewStatus.replace(/_/g, " ")}
            </span>
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${badgeTone(material.processingStatus)}`}>
              {material.processingStatus.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleReview("approved")}
              disabled={isActionLoading || material.reviewStatus === "approved"}
              className="h-7 items-center rounded-lg bg-slate-900 px-3 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-slate-950 disabled:opacity-30"
            >
              Approve
            </button>
            <button
              onClick={() => handleReview("rejected")}
              disabled={isActionLoading || material.reviewStatus === "rejected"}
              className="h-7 items-center rounded-lg border border-rose-200 bg-white px-3 text-[9px] font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-50 disabled:opacity-30"
            >
              Reject
            </button>
          </div>
        </div>
      </section>

      {/* Deployment */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Deployment scope</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
          {(["private_owner", "staff_shared", "class_scoped", "student_approved"] as const).map((v) => (
            <button
              key={v}
              onClick={() => handleVisibility(v)}
              disabled={isActionLoading || material.visibility === v}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                material.visibility === v
                  ? "bg-slate-950 text-white shadow-sm"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {visibilityIcon(v)}
              <span className="text-[9px] font-black uppercase tracking-tight">
                {v.split("_")[0]}
              </span>
              {material.visibility === v && <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-400" />}
            </button>
          ))}
        </div>
      </section>

      {/* Metadata */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">System attributes</h2>
        </div>
        <div className="space-y-0 rounded-xl border border-slate-200 bg-white px-3 py-1 shadow-sm">
          <InfoRow label="Owner" value={`${material.ownerName} (${material.ownerRole})`} icon={<BadgeCheck className="h-3.5 w-3.5" />} />
          <InfoRow label="Search index" value={`${material.chunkCount} chunks • ${material.searchStatus}`} icon={<Database className="h-3.5 w-3.5" />} />
          <InfoRow label="Modified" value={formatDate(material.updatedAt)} icon={<CalendarClock className="h-3.5 w-3.5" />} />
          <InfoRow label="Storage" value={material.storageId ? "Linked" : "Local"} icon={<Link2 className="h-3.5 w-3.5" />} />
        </div>
      </section>

      {/* Timeline */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Audit log</h2>
        </div>

        <div className="relative space-y-4 pl-3 before:absolute before:left-0 before:top-2 before:h-[calc(100%-8px)] before:w-px before:bg-slate-100">
          {auditEvents.length > 0 ? (
            auditEvents.slice(0, 5).map((event) => (
              <div key={event._id} className="relative group">
                <div className="absolute -left-[13px] top-1.5 h-1.5 w-1.5 rounded-full border-2 border-white bg-slate-400 group-first:bg-indigo-500" />
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                      {event.actorName} • {formatDate(event.createdAt)}
                    </p>
                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${statusTone(event.eventType)}`}>
                      {event.eventType}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold leading-tight text-slate-800">
                    {event.changeSummary}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[10px] font-medium text-slate-400 italic">No events recorded.</p>
          )}
        </div>
      </section>

      {/* Destructive */}
      <div className="pt-4 border-t border-slate-100">
        <button
          onClick={handleArchive}
          disabled={isActionLoading}
          className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 text-[9px] font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-100 disabled:opacity-30"
        >
          <Trash2 className="h-3 w-3" />
          Archive Record
        </button>
      </div>
    </div>
  );
}
