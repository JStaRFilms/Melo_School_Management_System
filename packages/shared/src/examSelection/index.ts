/**
 * Shared exam selection params (consolidation P21). The teacher SelectionBar
 * and admin AdminSelectionBar ran byte-identical update logic with stable
 * param keys; only this pure core is shared, never the JSX chrome.
 */

export const SELECTION_PARAM_KEYS = [
  "sessionId",
  "termId",
  "classId",
  "subjectId",
] as const;

export type SelectionParamKey = (typeof SELECTION_PARAM_KEYS)[number];

export interface ExamSelection {
  sessionId: string | null;
  termId: string | null;
  classId: string | null;
  subjectId: string | null;
}

/** Clearing an upstream selector clears everything downstream. */
export const SELECTION_CASCADE: Record<SelectionParamKey, SelectionParamKey[]> = {
  sessionId: ["termId", "classId", "subjectId"],
  termId: ["classId", "subjectId"],
  classId: ["subjectId"],
  subjectId: [],
};

export function parseSelectionParams(search: string): ExamSelection {
  const params = new URLSearchParams(search);
  return {
    sessionId: params.get("sessionId"),
    termId: params.get("termId"),
    classId: params.get("classId"),
    subjectId: params.get("subjectId"),
  };
}

export function buildSelectionQueryParams(
  search: string,
  key: SelectionParamKey,
  value: string | null,
): { query: string; next: ExamSelection } {
  const params = new URLSearchParams(search);
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  for (const downstream of SELECTION_CASCADE[key]) {
    params.delete(downstream);
  }
  return {
    query: params.toString(),
    next: {
      sessionId: params.get("sessionId"),
      termId: params.get("termId"),
      classId: params.get("classId"),
      subjectId: params.get("subjectId"),
    },
  };
}

/**
 * Stable save-bar contract shared by the teacher SaveActionBar and the admin
 * AdminSaveActionBar. Both prop interfaces already matched this shape; it is
 * pinned here so future drift fails review.
 */
export interface SaveBarProps {
  hasUnsavedChanges: boolean;
  hasValidationErrors: boolean;
  errorCount: number;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
  dirtyCount: number;
  isEditingLocked?: boolean;
  lockMessage?: string;
}
