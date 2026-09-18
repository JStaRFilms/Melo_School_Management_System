import { ConvexError } from "convex/values";

export const CROSS_SCHOOL_ACCESS_DENIED = "Cross-school access denied";

export type TenantScopedDoc = {
  schoolId: unknown;
  isArchived?: unknown;
};

export type AssertBranchDocOptions = {
  /**
   * When true, archived docs are rejected with the same boundary error.
   * Only set where the original guard included `|| doc.isArchived`.
   * Sites that hide rows instead of throwing must NOT use this helper.
   */
  excludeArchived?: boolean;
  /**
   * Oracle-preserving override (e.g. "Aggregation not found."). Only set
   * where the original site threw a NOT_FOUND-style message instead of the
   * boundary message. Never invent a new message.
   */
  message?: string;
};

/**
 * Tenant-scope boundary for already-fetched branch docs (consolidation P2).
 * Mechanical replacement for `if (!doc || doc.schoolId !== schoolId)`
 * throw sites. Strict `!==` comparison is preserved exactly.
 *
 * Do NOT use for: skip-and-hide-rows sites (keep their choice), String()
 * compared ids (billing), multi-conjunct guards (e.g. session membership),
 * or split oracle pairs (NOT_FOUND + boundary as separate throws).
 */
export function assertBranchDoc<T extends TenantScopedDoc>(
  doc: T | null | undefined,
  schoolId: unknown,
  options?: AssertBranchDocOptions,
): asserts doc is T {
  const message = options?.message ?? CROSS_SCHOOL_ACCESS_DENIED;
  if (!doc || doc.schoolId !== schoolId) {
    throw new ConvexError(message);
  }
  if (options?.excludeArchived && doc.isArchived) {
    throw new ConvexError(message);
  }
}
