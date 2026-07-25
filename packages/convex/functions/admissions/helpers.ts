import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import {
  hasSchoolCapabilityV1,
  requireAuthIdentityV1,
  resolveSchoolMembershipV1,
} from "../foundation/auth";

type ReadCtx = QueryCtx | MutationCtx;

export const NOT_FOUND_OR_DENIED = "Not found or access denied";

export function normalizeText(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError(`${label} is required`);
  return normalized;
}

export function opaqueKey(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Guardian authority is global, derived solely from Convex tokenIdentifier. */
export async function requireGuardian(ctx: ReadCtx) {
  const identity = await requireAuthIdentityV1(ctx);
  const guardian = await ctx.db
    .query("admissionsGuardians")
    .withIndex("by_auth_token_identifier", (q) => q.eq("authTokenIdentifier", identity.tokenIdentifier))
    .unique();
  if (!guardian || guardian.status !== "active") throw new ConvexError("Verification required");
  return { guardian, identity };
}

export async function requireStaffScope(
  ctx: ReadCtx,
  args: {
    schoolId: Id<"schools">;
    programmeId: Id<"admissionsProgrammes">;
    intakeId: Id<"admissionsIntakes">;
    capability: Parameters<typeof hasSchoolCapabilityV1>[2];
  },
) {
  const membership = await resolveSchoolMembershipV1(ctx, args.schoolId);
  if (!membership || !(await hasSchoolCapabilityV1(ctx, membership, args.capability, {
    programmeId: args.programmeId,
    intakeId: args.intakeId,
  }))) {
    throw new ConvexError(NOT_FOUND_OR_DENIED);
  }
  return membership;
}

export async function audit(args: {
  ctx: MutationCtx;
  schoolId: Id<"schools">;
  actor: { guardianId?: Id<"admissionsGuardians">; userId?: Id<"users">; kind: "guardian" | "staff" | "system" };
  action: string;
  entityType: string;
  entityId: string;
  applicationId?: Id<"admissionsApplications">;
  outcome: "success" | "denied" | "blocked" | "failed";
  reasonCode?: string;
}) {
  await args.ctx.db.insert("admissionsAuditEvents", {
    schoolId: args.schoolId,
    actorKind: args.actor.kind,
    ...(args.actor.guardianId ? { actorGuardianId: args.actor.guardianId } : {}),
    ...(args.actor.userId ? { actorUserId: args.actor.userId } : {}),
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    ...(args.applicationId ? { applicationId: args.applicationId } : {}),
    outcome: args.outcome,
    ...(args.reasonCode ? { reasonCode: args.reasonCode } : {}),
    createdAt: Date.now(),
  });
}

export async function requireOwnedApplication(
  ctx: ReadCtx,
  applicationId: Id<"admissionsApplications">,
) {
  const { guardian } = await requireGuardian(ctx);
  const application = await ctx.db.get(applicationId);
  if (!application || application.guardianId !== guardian._id) {
    throw new ConvexError(NOT_FOUND_OR_DENIED);
  }
  return { guardian, application };
}

export function assertEditable(state: string) {
  if (state !== "draft" && state !== "changes_requested") {
    throw new ConvexError("APPLICATION_LOCKED");
  }
}
