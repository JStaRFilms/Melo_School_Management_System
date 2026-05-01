"use client";

import type React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Shield,
  User,
  X,
  Layers,
  FileSearch,
} from "lucide-react";
import { TeacherKnowledgeMaterialSourceProofResponse, TeacherLibraryMaterial } from "../types";
import { badgeTone, formatTimestamp, isSupportedUploadContentType } from "../constants";
import { cn } from "@/lib/utils";

interface MaterialPreviewInspectorProps {
  material: TeacherLibraryMaterial | null;
  sourceProof: TeacherKnowledgeMaterialSourceProofResponse | undefined;
  isSourceProofLoading: boolean;
  isSelectedAsSource: boolean;
  onToggleSelection: () => void;
  onEdit: () => void;
  onClose: () => void;
  variant?: "default" | "sheet";
  className?: string;
}

function formatBytes(size: number | null) {
  if (!size) return "N/A";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function MaterialPreviewInspector({
  material,
  sourceProof,
  isSourceProofLoading,
  isSelectedAsSource,
  onToggleSelection,
  onEdit,
  onClose,
  variant = "default",
  className,
}: MaterialPreviewInspectorProps) {
  const isSheetVariant = variant === "sheet";
  if (!material) {
    return (
      <aside className={cn("flex h-full flex-col items-center justify-center bg-surface-200 p-8", className)}>
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-5 rounded-2xl bg-white p-5 text-slate-300 shadow-sm ring-1 ring-slate-950/5">
            <FileSearch className="h-8 w-8" />
          </div>
          <h3 className="font-display text-sm font-black uppercase tracking-[0.2em] text-slate-950">
            Source Inspector
          </h3>
          <p className="mt-2 max-w-[220px] text-[11px] font-medium leading-relaxed text-slate-400">
            Select a catalog entry to inspect its content.
          </p>
        </div>
      </aside>
    );
  }

  const proof = sourceProof?.materialId === material._id ? sourceProof.sourceProof : null;
  const originalUrl = proof?.originalFileUrl ?? null;
  const canMiniPreview = Boolean(
    originalUrl &&
      proof?.originalFileContentType &&
      (proof.originalFileContentType.startsWith("image/") || isSupportedUploadContentType(proof.originalFileContentType))
  );

  return (
    <aside className={cn("flex h-full flex-col bg-surface-200", className)}>
      {/* ── Sticky Header: Identity + Close ── */}
      {!isSheetVariant && (
        <div className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 backdrop-blur-md px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {material.subjectCode || material.subjectName} · {material.level}
                </p>
              </div>
              <h2 className="font-display text-lg font-black tracking-tight text-slate-950 leading-tight line-clamp-2">
                {material.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:text-slate-950 hover:border-slate-300"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Badges – inline with header */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("visibility", material.visibility))}>
              {statusLabel(material.visibility)}
            </span>
            <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("processing", material.processingStatus))}>
              {statusLabel(material.processingStatus)}
            </span>
            {material.reviewStatus !== "approved" && (
              <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("review", material.reviewStatus))}>
                {statusLabel(material.reviewStatus)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isSheetVariant && (
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {material.subjectCode || material.subjectName} · {material.level}
                </p>
                <h2 className="mt-1 font-display text-base font-black leading-tight tracking-tight text-slate-950 line-clamp-2">
                  {material.title}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("visibility", material.visibility))}>
                    {statusLabel(material.visibility)}
                  </span>
                  <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("processing", material.processingStatus))}>
                    {statusLabel(material.processingStatus)}
                  </span>
                  {material.reviewStatus !== "approved" && (
                    <span className={cn("inline-flex h-5 items-center rounded-md border px-1.5 text-[9px] font-black uppercase tracking-[0.12em]", badgeTone("review", material.reviewStatus))}>
                      {statusLabel(material.reviewStatus)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inline Metadata */}
        <div className={cn("border-b border-slate-100 space-y-2.5", isSheetVariant ? "px-4 py-3" : "px-6 py-4")}>
          <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Owner" value={material.ownerName} />
          <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Added" value={formatTimestamp(material.createdAt)} />
          <MetaRow icon={<Layers className="h-3.5 w-3.5" />} label="Topic" value={material.topicTitle ?? material.topicLabel} />
          <MetaRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Index" value={`${material.chunkCount} chunks indexed`} />
          {material.selectedPageRanges && (
            <MetaRow icon={<Layers className="h-3.5 w-3.5" />} label="Indexed pages" value={`${material.selectedPageRanges}${material.pdfPageCount ? ` of ${material.pdfPageCount}` : ""}`} />
          )}
          {material.description && (
            <p className="pt-2 text-[12px] font-medium leading-relaxed text-slate-500">{material.description}</p>
          )}
        </div>

        {/* Original File Viewer */}
        <div className="border-b border-slate-100">
          <div className="flex items-center justify-between px-6 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {isSourceProofLoading ? "Loading..." : proof?.originalFileState === "available" ? "Original File" : "No Source File"}
            </p>
            {isSourceProofLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />}
          </div>

          {canMiniPreview ? (
            <div className="bg-slate-50 border-t border-slate-100">
              {proof?.originalFileContentType?.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={originalUrl ?? undefined} alt={`Preview of ${material.title}`} className="max-h-72 w-full object-contain" />
              ) : (
                <iframe title={`Preview of ${material.title}`} src={originalUrl ?? undefined} className="h-72 w-full bg-white" />
              )}
            </div>
          ) : !isSourceProofLoading && proof && proof.originalFileState !== "available" ? (
            <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
              <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                {proof.originalFileNotice ?? "File unavailable."}
                {proof.originalFileContentType && (
                  <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {proof.originalFileContentType} · {formatBytes(proof.originalFileSize ?? null)}
                  </span>
                )}
              </p>
            </div>
          ) : null}
        </div>

        {/* Extracted Text */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Extracted Content</p>
            </div>
            <p className="text-[10px] font-black text-slate-950 tabular-nums">{proof?.indexedPageSummary ?? `${proof?.extractedTextChunkCount ?? 0} segments`}</p>
          </div>

          {proof?.extractedTextPreview ? (
            <div className="relative rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="max-h-72 overflow-y-auto p-4 custom-scrollbar">
                <p className="text-[13px] font-normal leading-[1.75] text-slate-700 break-words whitespace-pre-wrap">
                  {proof.extractedTextPreview}
                </p>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-xl bg-gradient-to-t from-slate-50 to-transparent" />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 py-8 text-center">
              <p className="text-[11px] font-bold text-slate-400">
                {isSourceProofLoading ? "Loading extracted text..." : "No extracted text available."}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 backdrop-blur-sm px-6 py-4 space-y-2">
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 shadow-md shadow-slate-950/10"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Original
            </a>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!material.canSelectAsSource}
              onClick={onToggleSelection}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.15em] transition disabled:cursor-not-allowed disabled:opacity-50",
                isSelectedAsSource
                  ? "border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  : "bg-emerald-500 text-white shadow-md shadow-emerald-500/15 hover:bg-emerald-400"
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              {isSelectedAsSource ? "Remove" : "Use Source"}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-[0.15em] text-slate-950 transition hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-400" />
              Manage
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-slate-400 shrink-0">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="truncate text-[12px] font-bold text-slate-950 text-right">{value}</p>
    </div>
  );
}
