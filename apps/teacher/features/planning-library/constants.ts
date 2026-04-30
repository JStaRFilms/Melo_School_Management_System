import { UploadIntent } from "./types";

export const DEFAULT_FILTERS = {
  searchQuery: "",
  visibility: "all" as const,
  reviewStatus: "all" as const,
  sourceType: "all" as const,
  processingStatus: "all" as const,
};

export const PROCESSING_STATUS_HELP = [
  {
    status: "extracting",
    label: "Extracting",
    description: "The file is being read and native text extraction is in progress.",
  },
  {
    status: "ocr_needed",
    label: "OCR needed",
    description: "The file looks scanned or image-heavy, and this workflow cannot read enough text yet.",
  },
  {
    status: "failed",
    label: "Failed",
    description: "Ingestion stopped because the file was unsupported, too weak, or hit a hard limit.",
  },
  {
    status: "ready",
    label: "Ready",
    description: "Text extraction succeeded and the source can be reviewed or selected for planning.",
  },
] as const;

export function badgeTone(kind: "visible" | "visibility" | "review" | "processing", value: string) {
  if (kind === "visibility") {
    switch (value) {
      case "private_owner":
        return "border-slate-200 bg-slate-950 text-white";
      case "staff_shared":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "student_approved":
        return "border-blue-100 bg-blue-50 text-blue-700";
      case "class_scoped":
        return "border-amber-100 bg-amber-50 text-amber-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  if (kind === "review") {
    switch (value) {
      case "approved":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "pending_review":
      case "draft":
        return "border-amber-100 bg-amber-50 text-amber-700";
      case "rejected":
        return "border-rose-100 bg-rose-50 text-rose-700";
      case "archived":
        return "border-slate-200 bg-slate-100 text-slate-500";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  if (kind === "processing") {
    switch (value) {
      case "ready":
        return "border-emerald-100 bg-emerald-50 text-emerald-700";
      case "extracting":
        return "border-blue-100 bg-blue-50 text-blue-700";
      case "queued":
      case "awaiting_upload":
        return "border-amber-100 bg-amber-50 text-amber-700";
      case "ocr_needed":
      case "failed":
        return "border-rose-100 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
  }

  return value === "yes"
    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-500";
}

export function normalizeFileTitle(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function uploadIntentLabel(intent: UploadIntent) {
  switch (intent) {
    case "private_draft":
      return "Private draft";
    case "request_review":
      return "Request staff review";
    case "staff_shared":
      return "Start as staff shared";
    default:
      return intent;
  }
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function inferUploadContentType(file: File) {
  const explicitType = file.type.trim().toLowerCase();
  if (explicitType) {
    return explicitType;
  }

  const fileName = file.name.trim().toLowerCase();
  if (fileName.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (fileName.endsWith(".md")) {
    return "text/markdown";
  }
  if (fileName.endsWith(".txt")) {
    return "text/plain";
  }

  return "application/octet-stream";
}

export function isSupportedUploadContentType(contentType: string) {
  const c = contentType.toLowerCase();
  return c.startsWith("text/") || c === "application/pdf" || c === "application/x-pdf" || c.endsWith("+pdf");
}
export function uploadIntentSuccessMessage(intent: UploadIntent) {
  switch (intent) {
    case "private_draft":
      return "Saved privately. It will stay hidden until you publish it to staff.";
    case "request_review":
      return "Saved privately and flagged for staff review.";
    case "staff_shared":
      return "Uploaded as staff shared.";
    default:
      return "Upload complete.";
  }
}
