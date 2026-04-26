"use client";

import { useMemo, useState, type FormEvent } from "react";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function isSupportedPortalUpload(file: File) {
  const normalizedType = file.type.trim().toLowerCase();
  return (
    normalizedType === "application/pdf" ||
    normalizedType === "application/x-pdf" ||
    normalizedType.endsWith("+pdf") ||
    normalizedType.startsWith("text/")
  );
}
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

interface PortalTopicMaterialSourceProof {
  originalFileState: "available" | "missing" | "orphaned";
  originalFileUrl: string | null;
  originalFileContentType: string | null;
  originalFileSize: number | null;
  originalFileNotice: string | null;
  extractedTextPreview: string | null;
  extractedTextChunkCount: number;
}

interface PortalTopicMaterial {
  _id: string;
  title: string;
  description: string | null;
  sourceType: "file_upload" | "text_entry" | "youtube_link" | "generated_resource" | "student_upload";
  visibility: "private_owner" | "staff_shared" | "class_scoped" | "student_approved";
  reviewStatus: "draft" | "pending_review" | "approved" | "rejected" | "archived";
  externalUrl: string | null;
  topicId: string | null;
  classId: string | null;
  sourceProof: PortalTopicMaterialSourceProof;
}

interface PortalTopicPageData {
  topic: {
    _id: string;
    title: string;
    summary: string | null;
    subjectId: string;
    level: string;
    status: "draft" | "active" | "retired";
  };
  classId: string;
  className: string;
  canUploadSupplemental: boolean;
  approvedMaterials: PortalTopicMaterial[];
}

function TopicMaterialCard({ material }: { material: PortalTopicMaterial }) {
  const hasOriginalFile = material.sourceProof.originalFileUrl && material.sourceProof.originalFileState === "available";
  const hasProofPreview = Boolean(material.sourceProof.extractedTextPreview);
  const openLabel =
    material.sourceType === "youtube_link"
      ? "Open YouTube resource"
      : material.sourceType === "file_upload"
        ? "Open original file"
        : "Open source proof";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{material.title}</h3>
          {material.description ? <p className="mt-1 text-sm text-slate-600">{material.description}</p> : null}
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Approved
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {material.sourceType === "youtube_link" && material.externalUrl ? (
          <a
            href={material.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            {openLabel}
          </a>
        ) : null}

        {hasOriginalFile ? (
          <a
            href={material.sourceProof.originalFileUrl!}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {openLabel}
          </a>
        ) : null}

        {hasProofPreview || material.sourceProof.originalFileNotice ? (
          <details className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
              Read extracted proof
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {material.sourceProof.extractedTextChunkCount} extracted chunk(s)
              </p>
              {material.sourceProof.extractedTextPreview ? (
                <p className="text-sm leading-6 text-slate-600">
                  {material.sourceProof.extractedTextPreview}
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-500">
                  {material.sourceProof.originalFileNotice ?? "No extracted text proof is available yet."}
                </p>
              )}
              <p className="text-xs leading-5 text-slate-400">
                {material.sourceProof.originalFileContentType ? `${material.sourceProof.originalFileContentType} • ` : ""}
                {material.sourceProof.originalFileSize ? `${Math.max(1, Math.round(material.sourceProof.originalFileSize / 1024))} KB` : "No file size recorded"}
              </p>
            </div>
          </details>
        ) : null}
      </div>

      {!hasOriginalFile && material.sourceType === "file_upload" ? (
        <p className="mt-3 text-sm leading-6 text-amber-700">
          This file-backed resource is approved, but the original file is not available right now.
        </p>
      ) : null}
    </article>
  );
}

export function TopicPage({ topicId }: { topicId: string }) {
  const topicData = useQuery("functions/academic/lessonKnowledgePortal:getPortalTopicPageData" as never, { topicId } as never) as PortalTopicPageData | undefined;
  const requestUpload = useMutation("functions/academic/lessonKnowledgePortal:requestPortalSupplementalUploadUrl" as never) as unknown as (args: {
    topicId: string;
    title: string;
    description: string | null;
    fileContentType: string;
    fileSize: number;
  }) => Promise<{ materialId: string; uploadUrl: string }>;
  const finalizeUpload = useMutation("functions/academic/lessonKnowledgePortal:finalizePortalSupplementalUpload" as never) as unknown as (args: {
    materialId: string;
    storageId: string;
  }) => Promise<{ materialId: string; processingStatus: string }>;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canUpload = topicData?.canUploadSupplemental ?? false;
  const count = useMemo(() => topicData?.approvedMaterials.length ?? 0, [topicData]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setStatus("Choose a file first.");
      return;
    }
    try {
      setBusy(true);
      setStatus(null);
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error("Add a title before submitting.");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error("Uploaded file is too large. Keep uploads at or below 12 MB.");
      }
      if (!isSupportedPortalUpload(file)) {
        throw new Error("Only PDF and text-based uploads are supported right now.");
      }

      const result = await requestUpload({
        topicId,
        title: trimmedTitle,
        description: description || null,
        fileContentType: file.type,
        fileSize: file.size,
      });
      const uploadResponse = await fetch(result.uploadUrl, { method: "POST", body: file });
      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }
      const { storageId } = await uploadResponse.json();
      await finalizeUpload({ materialId: result.materialId, storageId });
      setTitle("");
      setDescription("");
      setFile(null);
      setStatus("Supplemental upload submitted for review.");
    } catch (error) {
      setStatus(getUserFacingErrorMessage(error, "Unable to submit supplemental upload."));
    } finally {
      setBusy(false);
    }
  };

  if (topicData === undefined) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">Loading topic…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-500">{topicData.className}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{topicData.topic.title}</h1>
        {topicData.topic.summary ? <p className="max-w-2xl text-sm leading-6 text-slate-600">{topicData.topic.summary}</p> : null}
      </div>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Approved resources</h2>
          <span className="text-sm text-slate-500">{count} items</span>
        </div>
        <div className="space-y-3">
          {topicData.approvedMaterials.length ? (
            topicData.approvedMaterials.map((material) => <TopicMaterialCard key={material._id} material={material} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No approved topic resources are available yet.
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload a supplemental resource</h2>
        <p className="mt-1 text-sm text-slate-600">Uploads stay scoped to your class and return to review before anyone can approve them for the topic.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" />
          <textarea className="w-full rounded-xl border border-slate-300 px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" rows={3} />
          <input
            type="file"
            accept="application/pdf,application/x-pdf,.pdf,text/plain,text/markdown,text/csv,text/tab-separated-values,.txt,.md,.csv,.tsv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button disabled={!canUpload || busy} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          {!canUpload ? <p className="text-sm text-amber-700">This topic is not yet eligible for class-scoped uploads.</p> : null}
          <p className="text-sm text-slate-500">Only PDF and text-based files are accepted, up to 12 MB.</p>
          {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        </form>
      </section>
    </div>
  );
}
