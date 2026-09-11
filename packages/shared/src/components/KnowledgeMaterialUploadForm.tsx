"use client";

import {
  FileUp,
  Shield,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

export const MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_KNOWLEDGE_MATERIAL_PDF_PAGES = 80;

export type KnowledgeMaterialUploadIntent =
  | "private_draft"
  | "request_review"
  | "staff_shared";

export interface KnowledgeMaterialUploadOption {
  value: string;
  label: string;
}

export interface KnowledgeMaterialUploadSubject {
  id: string;
  name: string;
}

export interface KnowledgeMaterialUploadInput {
  file: File;
  contentType: string;
  title: string;
  description: string;
  subjectId: string | null;
  level: string;
  topicLabel: string;
  isCurriculumReference: boolean;
  uploadIntent: KnowledgeMaterialUploadIntent;
  selectedPageRanges: string;
  sha256: string;
}

export interface KnowledgeMaterialUploadReadiness {
  isLoading: boolean;
  hasPlanningPermission: boolean;
  hasUploadPermission: boolean;
  hasAssignedContext: boolean;
  supportsDuplicateProtection: boolean;
  storageStatus: "missing_entitlement" | "exhausted" | "ready";
  availableBytes: number;
  allocatedBytes: number;
  maxFileSizeBytes: number | null;
  maxPagesPerOperation: number | null;
}

interface KnowledgeMaterialUploadFormProps {
  subjects: KnowledgeMaterialUploadSubject[];
  levelOptions: KnowledgeMaterialUploadOption[];
  isAdmin: boolean;
  isUploading: boolean;
  readiness: KnowledgeMaterialUploadReadiness;
  checkDuplicate: (sha256: string) => Promise<boolean>;
  onUpload: (input: KnowledgeMaterialUploadInput) => Promise<void>;
}

const ACCEPTED_FILE_TYPES = ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp";

export function resolveKnowledgeMaterialUploadEndpoint(
  configuredSiteUrl: string | undefined,
  configuredCloudUrl: string | undefined,
): string {
  const siteUrl = configuredSiteUrl?.trim() ||
    configuredCloudUrl?.trim().replace(/\.convex\.cloud\/?$/, ".convex.site");
  if (!siteUrl) {
    throw new Error("The secure Convex upload endpoint is not configured");
  }
  return new URL("/academic/knowledge-material-upload", siteUrl).toString();
}

export function inferKnowledgeMaterialContentType(file: File): string {
  const explicitType = file.type.trim().toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return (extension ? byExtension[extension] : undefined) ?? explicitType;
}

function isSupportedContentType(contentType: string): boolean {
  return (
    contentType === "application/pdf" ||
    contentType === "application/x-pdf" ||
    contentType === "application/acrobat" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    contentType === "text/plain" ||
    contentType === "text/markdown" ||
    contentType === "text/x-markdown" ||
    contentType === "image/png" ||
    contentType === "image/jpeg" ||
    contentType === "image/jpg" ||
    contentType === "image/webp"
  );
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return await file.arrayBuffer();
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("The selected file could not be read."));
    };
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.readAsArrayBuffer(file);
  });
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser cannot securely fingerprint files before upload.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function selectedPdfPages(
  value: string,
  pageCount: number,
  maxPagesPerOperation: number,
): number[] {
  const pages = new Set<number>();
  for (const token of value.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    const single = token.match(/^(\d+)$/);
    const start = Number(range?.[1] ?? single?.[1]);
    const end = Number(range?.[2] ?? single?.[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || start > end) {
      throw new Error("Page ranges must use positive ascending numbers such as 1-5,7-8.");
    }
    if (end > pageCount) {
      throw new Error(`Selected page ${end} is outside this PDF's ${pageCount} pages.`);
    }
    for (let page = start; page <= end; page += 1) {
      pages.add(page);
      if (pages.size > maxPagesPerOperation) {
        throw new Error(`Index at most ${maxPagesPerOperation} PDF pages per material.`);
      }
    }
  }
  return Array.from(pages);
}

export function validateKnowledgeMaterialPdfSelection(args: {
  pageCount: number;
  selectedPageRanges: string;
  maxPagesPerOperation?: number | null;
}): string | null {
  if (!Number.isSafeInteger(args.pageCount) || args.pageCount < 1) {
    return "This PDF does not contain any readable pages.";
  }
  const maxPagesPerOperation = Math.min(
    MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
    args.maxPagesPerOperation ?? MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  );
  try {
    const selectedPages = selectedPdfPages(
      args.selectedPageRanges,
      args.pageCount,
      maxPagesPerOperation,
    );
    if (!args.selectedPageRanges.trim() && args.pageCount > maxPagesPerOperation) {
      return `This PDF has ${args.pageCount} pages. Choose a range containing at most ${maxPagesPerOperation} pages before uploading.`;
    }
    if (args.selectedPageRanges.trim() && selectedPages.length === 0) {
      return "Choose at least one PDF page to index.";
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Review the selected PDF pages.";
  }
}

export function KnowledgeMaterialUploadForm({
  subjects,
  levelOptions,
  isAdmin,
  isUploading,
  readiness,
  checkDuplicate,
  onUpload,
}: KnowledgeMaterialUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [level, setLevel] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [isCurriculumReference, setIsCurriculumReference] = useState(false);
  const [uploadIntent, setUploadIntent] = useState<KnowledgeMaterialUploadIntent>(
    isAdmin ? "staff_shared" : "private_draft",
  );
  const [selectedPageRanges, setSelectedPageRanges] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxPdfPages = Math.min(
    MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
    readiness.maxPagesPerOperation ?? MAX_KNOWLEDGE_MATERIAL_PDF_PAGES,
  );

  const clearFile = () => {
    setFile(null);
    setSelectedPageRanges("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateFile = (selectedFile: File): string | null => {
    const contentType = inferKnowledgeMaterialContentType(selectedFile);
    if (!isSupportedContentType(contentType)) {
      return "Choose a supported PDF, Office document, text file, or image.";
    }
    const contractFileLimit = readiness.maxFileSizeBytes ?? MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES;
    const availableQuotaLimit = readiness.storageStatus === "ready"
      ? readiness.availableBytes
      : MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES;
    const maxAllowedBytes = Math.min(
      MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
      contractFileLimit,
      availableQuotaLimit,
    );
    if (selectedFile.size > maxAllowedBytes) {
      return `File is ${formatBytes(selectedFile.size)}; the current upload limit is ${formatBytes(maxAllowedBytes)}.`;
    }
    return null;
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    if (!selectedFile) {
      clearFile();
      return;
    }
    const error = validateFile(selectedFile);
    if (error) {
      clearFile();
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setFile(selectedFile);
    if (!title.trim()) setTitle(titleFromFileName(selectedFile.name));
  };

  const subjectRequired = !isAdmin || !isCurriculumReference;
  const isPdf = file
    ? inferKnowledgeMaterialContentType(file).includes("pdf")
    : false;
  const missingFields = [
    !file ? "file" : null,
    !title.trim() ? "title" : null,
    !level ? "level" : null,
    !topicLabel.trim()
      ? isCurriculumReference ? "planning reference label" : "topic label"
      : null,
    subjectRequired && !subjectId ? "subject" : null,
  ].filter((field): field is string => field !== null);
  const permissionsReady = readiness.hasPlanningPermission && readiness.hasUploadPermission;
  const contextReady = isAdmin || readiness.hasAssignedContext;
  const storageReady = readiness.storageStatus === "ready";
  const canSubmit = Boolean(
    !readiness.isLoading &&
      permissionsReady &&
      contextReady &&
      storageReady &&
      readiness.supportsDuplicateProtection &&
      !isInspecting &&
      missingFields.length === 0,
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !canSubmit) return;
    const error = validateFile(file);
    if (error) {
      clearFile();
      setValidationError(error);
      return;
    }
    setValidationError(null);
    setIsInspecting(true);
    try {
      const bytes = await readFileBytes(file);
      if (inferKnowledgeMaterialContentType(file).includes("pdf")) {
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
        const pdfError = validateKnowledgeMaterialPdfSelection({
          pageCount: pdf.getPageCount(),
          selectedPageRanges,
          maxPagesPerOperation: maxPdfPages,
        });
        if (pdfError) {
          setValidationError(pdfError);
          return;
        }
      }
      const sha256 = await sha256Hex(bytes);
      if (await checkDuplicate(sha256)) {
        setValidationError("This exact file already exists in the school knowledge library. Open the existing material instead of uploading another copy.");
        return;
      }
      await onUpload({
        file,
        contentType: inferKnowledgeMaterialContentType(file),
        title: title.trim(),
        description: description.trim(),
        subjectId: subjectId || null,
        level,
        topicLabel: topicLabel.trim(),
        isCurriculumReference,
        uploadIntent,
        selectedPageRanges: selectedPageRanges.trim(),
        sha256,
      });
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Unable to inspect this file before upload.");
      return;
    } finally {
      setIsInspecting(false);
    }
    clearFile();
    setTitle("");
    setDescription("");
    setTopicLabel("");
    setSelectedPageRanges("");
  };

  const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const intentButtonClass = (intent: KnowledgeMaterialUploadIntent) =>
    `flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all ${
      uploadIntent === intent
        ? "border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-950/10"
        : "border-slate-100 bg-white text-slate-400 hover:border-slate-200"
    }`;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
    return `${bytes} bytes`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <section aria-label="Upload readiness" className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
        <p>{readiness.isLoading ? "…" : readiness.hasPlanningPermission ? "✓" : "!"} Planning or curriculum permission</p>
        <p>{readiness.isLoading ? "…" : readiness.hasUploadPermission ? "✓" : "!"} Upload permission</p>
        <p>{readiness.isLoading ? "…" : contextReady ? "✓" : "!"} {contextReady ? "Assigned teaching context available" : "No assigned class and subject are available"}</p>
        <p>{readiness.isLoading ? "…" : readiness.supportsDuplicateProtection ? "✓" : "!"} {readiness.supportsDuplicateProtection ? "Duplicate-file protection ready" : "Duplicate-file protection is being prepared"}</p>
        <p>
          {readiness.isLoading
            ? "… Checking storage entitlement"
            : readiness.storageStatus === "missing_entitlement"
              ? "! No active contract-bound storage entitlement"
              : readiness.storageStatus === "exhausted"
                ? "! Storage quota exhausted"
                : `✓ ${formatBytes(readiness.availableBytes)} storage available of ${formatBytes(readiness.allocatedBytes)}`}
        </p>
      </section>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose material file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handlePickerKeyDown}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
          file
            ? "border-emerald-200 bg-emerald-50/30"
            : "border-slate-100 hover:border-slate-200 hover:bg-slate-50"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept={ACCEPTED_FILE_TYPES}
        />
        {file ? (
          <>
            <div className="mb-2 rounded-full bg-emerald-500 p-2 text-white shadow-sm ring-4 ring-emerald-50">
              <FileUp className="h-4 w-4" />
            </div>
            <p className="max-w-full truncate px-4 text-[11px] font-bold text-emerald-600">
              {file.name}
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearFile();
              }}
              className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-500"
            >
              Change file
            </button>
          </>
        ) : (
          <>
            <div className="mb-2 rounded-full bg-white p-2 text-slate-300 shadow-sm ring-1 ring-slate-950/5 group-hover:text-slate-400">
              <Upload className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-bold text-slate-400">
              Choose PDF, DOCX, PPTX, TXT, MD, or image
            </p>
            <p className="mt-1 text-[9px] font-medium text-slate-300">
              Max {formatBytes(Math.min(
                MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
                readiness.maxFileSizeBytes ?? MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
                readiness.storageStatus === "ready"
                  ? readiness.availableBytes
                  : MAX_KNOWLEDGE_MATERIAL_UPLOAD_BYTES,
              ))}
            </p>
          </>
        )}
      </div>

      {validationError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {validationError}
        </p>
      ) : null}

      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Newton's Laws"
            required
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Description optional</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/30 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              {isAdmin && isCurriculumReference ? "Subject optional" : "Subject"}
            </span>
            <select
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              required={subjectRequired}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            >
              <option value="">
                {isAdmin && isCurriculumReference ? "General / no subject" : "Select..."}
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Level</span>
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-2 text-[11px] font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            >
              <option value="">Select...</option>
              {levelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
            {isCurriculumReference ? "Planning reference label" : "Topic label"}
          </span>
          <input
            value={topicLabel}
            onChange={(event) => setTopicLabel(event.target.value)}
            required
            placeholder={isCurriculumReference ? "e.g. National curriculum" : "e.g. Motion and forces"}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </label>

        {isPdf ? (
          <label className="block space-y-1.5 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-sky-700">Pages to index optional</span>
            <input
              value={selectedPageRanges}
              onChange={(event) => setSelectedPageRanges(event.target.value)}
              placeholder="1-5,7-8,70-72"
              className="h-10 w-full rounded-xl border border-sky-100 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
            />
            <span className="block text-[10px] font-semibold leading-relaxed text-sky-700">
              Leave blank to index the whole PDF when it has at most {maxPdfPages} pages. Larger PDFs require a range containing no more than {maxPdfPages} pages.
            </span>
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => setIsCurriculumReference((value) => !value)}
          aria-pressed={isCurriculumReference}
          className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition-all ${
            isCurriculumReference
              ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm shadow-emerald-500/10"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          }`}
        >
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-black ${
            isCurriculumReference
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 bg-white text-white"
          }`}>
            {isCurriculumReference ? "✓" : ""}
          </span>
          <span className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.16em]">Curriculum / planning reference</span>
            <span className="block text-[10px] font-semibold leading-relaxed opacity-80">
              Use for curriculum documents or broad source material that may support multiple topics.
            </span>
          </span>
        </button>

        <div className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Upload as</span>
          <div className={`grid gap-2 ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}>
            {isAdmin ? (
              <button type="button" onClick={() => setUploadIntent("staff_shared")} className={intentButtonClass("staff_shared")}>
                <Users className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Staff</span>
              </button>
            ) : null}
            <button type="button" onClick={() => setUploadIntent("private_draft")} className={intentButtonClass("private_draft")}>
              <Shield className="h-3.5 w-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Private</span>
            </button>
            <button type="button" onClick={() => setUploadIntent("request_review")} className={intentButtonClass("request_review")}>
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Review</span>
            </button>
          </div>
        </div>
      </div>

      {missingFields.length > 0 ? (
        <p role="status" className="text-xs font-semibold text-amber-700">
          Complete required fields: {missingFields.join(", ")}.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isUploading || isInspecting || !canSubmit}
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
          isUploading || isInspecting || !canSubmit
            ? "cursor-not-allowed bg-slate-100 text-slate-400"
            : "bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800"
        }`}
      >
        {isInspecting ? "Checking file..." : isUploading ? "Uploading securely..." : "Upload material"}
      </button>
    </form>
  );
}
