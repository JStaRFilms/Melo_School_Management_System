/**
 * Draft mechanics shared predicates (consolidation P13). Pure expiry math
 * only: TTL values, ownership, and recovery windows stay with each draft
 * owner (academic form drafts vs admissions flows). Unifying TTLs would
 * change recovery windows, so only the identical expression is shared.
 */
export function resolveDraftExpiryDate(
  draft: { expiresAt?: number | null; createdAt: number },
  retentionDays: number,
): number {
  return draft.expiresAt ?? draft.createdAt + retentionDays * 86400000;
}

export function isDraftExpired(
  draft: { expiresAt?: number | null; createdAt: number },
  retentionDays: number,
  now = Date.now(),
): boolean {
  return resolveDraftExpiryDate(draft, retentionDays) <= now;
}
