/**
 * Draft Recovery and Connectivity Status Types
 * In accordance with D-04 §7 & H6 / MX-10
 */

export type DraftStatus =
  | "idle"
  | "saving"
  | "saved"
  | "connection_lost"
  | "recovery_pending"
  | "context_mismatch"
  | "save_failed"
  | "conflict"
  | "reauth_required"
  | "expired";

export interface FormDraftSummary {
  draftId?: string;
  formKey: string;
  entityId?: string;
  lastSavedAt: number | Date;
  authorName?: string;
  subjectName?: string;
  completionSummary?: string;
  payload?: Record<string, unknown>;
  revision?: number;
  expiresAt?: number;
  schemaVersion?: number;
}

export interface DraftStatusConfig {
  label: string;
  description?: string;
  badgeClass: string;
  truthfulOfflineClaim: boolean;
}

export const DRAFT_STATUS_CONFIGS: Record<DraftStatus, DraftStatusConfig> = {
  context_mismatch: { label: "Draft context changed", description: "Return to the original account and form context before saving. This draft cannot overwrite another context.", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", truthfulOfflineClaim: false },
  recovery_pending: { label: "Unsaved draft • Review or retry", description: "The server is connected. Keep this tab open and preview the latest draft or retry saving your unsaved edits.", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", truthfulOfflineClaim: false },
  reauth_required: { label: "Sign in again", description: "Sign in to the same account, then preview the latest draft or retry. Do not close this tab.", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", truthfulOfflineClaim: false },
  expired: { label: "Draft expired or closed", description: "This instance cannot be saved again. Keep your in-memory edits while starting a new draft explicitly.", badgeClass: "bg-amber-50 text-amber-800 border-amber-300", truthfulOfflineClaim: false },
  idle: {
    label: "Ready",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    truthfulOfflineClaim: false,
  },
  saving: {
    label: "Saving draft...",
    description: "Debounced autosave payload in flight to server",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    truthfulOfflineClaim: false,
  },
  saved: {
    label: "Draft saved",
    description: "Confirmed server persistence",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    truthfulOfflineClaim: false,
  },
  connection_lost: {
    label: "Server reconnecting",
    description:
      "Draft saving is paused. Internet access does not prove the server connection is ready. If you have unsaved edits, keep this tab open, then review or retry after reconnecting.",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    truthfulOfflineClaim: true, // Specifically flags zero false offline claims!
  },
  save_failed: {
    label: "Save failed • Retry",
    description: "Backend rejected payload or network timed out",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    truthfulOfflineClaim: false,
  },
  conflict: {
    label: "Conflict detected",
    description: "Newer revision exists on server from another tab or session",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    truthfulOfflineClaim: false,
  },
};
