import type { QueryCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";

type SessionScopeReadCtx = { db: QueryCtx["db"] };

/**
 * Canonical active-session resolution (consolidation P7).
 * Reject-multiples decision: zero, two-or-more, or an archived single
 * active row all resolve to null. Callers that tolerated multiples via
 * `.first()` now see null in the ambiguous case instead of an arbitrary
 * row; null-safe fallbacks (`args.sessionId ?? activeSession?._id`) keep
 * working, explicit-session paths are unaffected.
 */
export async function getActiveSession(
  ctx: SessionScopeReadCtx,
  schoolId: Doc<"academicSessions">["schoolId"],
): Promise<Doc<"academicSessions"> | null> {
  const sessions = await ctx.db
    .query("academicSessions")
    .withIndex("by_school_active", (q) =>
      q.eq("schoolId", schoolId).eq("isActive", true),
    )
    .take(2);
  return sessions.length === 1 && !sessions[0].isArchived ? sessions[0] : null;
}
