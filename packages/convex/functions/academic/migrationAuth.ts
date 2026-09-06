import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { getAuthenticatedSchoolMembership } from "./auth";

export type MigrationCtx = QueryCtx | MutationCtx;
export interface MigrationAuthContext {
  callerId: Id<"users">;
  userId: Id<"users">;
  isSuperAdmin: false;
  role: string;
  email: string;
}

/** Staging is a private tenant operation, not Platform governance or support. */
export async function assertMigrationAccess(ctx: MigrationCtx, schoolId: Id<"schools">): Promise<MigrationAuthContext> {
  const actor = await getAuthenticatedSchoolMembership(ctx, { schoolId, capability: "system.migration.execute" });
  if (!actor.isSchoolAdmin) throw new ConvexError("Admin access required");
  const user = await ctx.db.get(actor.userId);
  if (!user) throw new ConvexError("Forbidden: Reviewed tenant actor required");
  return { callerId: user._id, userId: user._id, isSuperAdmin: false, role: "school_admin", email: user.email };
}

/** Never impersonate a school admin or manufacture an identity for Platform. */
export async function resolveSchoolAdminActorId(_ctx: MutationCtx, _schoolId: Id<"schools">, auth: MigrationAuthContext): Promise<Id<"users">> {
  return auth.userId;
}
