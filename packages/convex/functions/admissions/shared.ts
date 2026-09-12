import { ConvexError } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import {
  getContextCapabilities,
  normalizeCapability,
} from "../academic/rbac";
import { resolveActiveMembership } from "../academic/auth";

export type AdmissionsContext = QueryCtx | MutationCtx;

export const DAY_MS = 86_400_000;
export const UPLOAD_INTENT_TTL_MS = 15 * 60 * 1000;
export const MAX_ADMISSIONS_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const ADMISSIONS_UPLOAD_OPERATION = "admissions_document_secure_http_upload";

export function admissionsError(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

export function normalizeRequiredText(
  value: string,
  label: string,
  maxLength = 240,
): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ConvexError(`${label} requires 1–${maxLength} characters`);
  }
  return normalized;
}

export function normalizeSlug(value: string, label = "Slug"): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new ConvexError(`${label} must be a lowercase URL slug`);
  }
  return slug;
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 240) {
    throw new ConvexError("A valid email address is required");
  }
  return email;
}

export async function sha256Hex(value: string | ArrayBuffer | Uint8Array) {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copied.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function storageSha256ToHex(value: string): string {
  return /^[a-f0-9]{64}$/i.test(value)
    ? value.toLowerCase()
    : Array.from(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
}

export async function requireGuardian(
  ctx: AdmissionsContext,
): Promise<Doc<"admissionsGuardians">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) admissionsError("UNAUTHENTICATED", "Sign in required");
  const guardians = await ctx.db
    .query("admissionsGuardians")
    .withIndex("by_auth_token_identifier", (query) =>
      query.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  if (guardians.length !== 1) {
    admissionsError(
      guardians.length ? "RECONCILIATION_REQUIRED" : "VERIFICATION_REQUIRED",
      guardians.length
        ? "Guardian identity requires review"
        : "Create a verified guardian identity first",
    );
  }
  const guardian = guardians[0];
  if (guardian.status !== "active" || guardian.emailVerifiedAt === undefined) {
    admissionsError("VERIFICATION_REQUIRED", "A verified guardian identity is required");
  }
  return guardian;
}

export async function getOrCreateVerifiedGuardian(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) admissionsError("UNAUTHENTICATED", "Sign in required");
  const email = identity.email ? normalizeEmail(identity.email) : null;
  if (!email || identity.emailVerified !== true) {
    admissionsError("VERIFICATION_REQUIRED", "Verify your email before applying");
  }
  const matches = await ctx.db
    .query("admissionsGuardians")
    .withIndex("by_auth_token_identifier", (query) =>
      query.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .take(2);
  if (matches.length > 1) {
    admissionsError("RECONCILIATION_REQUIRED", "Guardian identity requires review");
  }
  const now = Date.now();
  if (matches[0]) {
    if (matches[0].status !== "active") {
      admissionsError("FORBIDDEN", "Guardian account is suspended");
    }
    if (matches[0].normalizedEmail !== email) {
      await ctx.db.patch(matches[0]._id, {
        normalizedEmail: email,
        emailVerifiedAt: now,
        betterAuthUserId: identity.subject,
        updatedAt: now,
      });
    }
    const guardian = await ctx.db.get(matches[0]._id);
    if (!guardian) throw new ConvexError("Guardian identity was not persisted");
    return guardian;
  }
  const guardianId = await ctx.db.insert("admissionsGuardians", {
    authTokenIdentifier: identity.tokenIdentifier,
    betterAuthUserId: identity.subject,
    normalizedEmail: email,
    emailVerifiedAt: now,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const guardian = await ctx.db.get(guardianId);
  if (!guardian) throw new ConvexError("Guardian identity was not persisted");
  return guardian;
}

export async function requireOwnedApplication(
  ctx: AdmissionsContext,
  applicationId: Id<"admissionsApplications">,
) {
  const guardian = await requireGuardian(ctx);
  const application = await ctx.db.get(applicationId);
  if (!application || application.guardianId !== guardian._id) {
    admissionsError("NOT_FOUND_OR_DENIED", "Application not found");
  }
  return { guardian, application };
}

export async function requireAdmissionsStaff(
  ctx: AdmissionsContext,
  schoolId: Id<"schools">,
  requiredCapabilities: readonly string[],
) {
  const membership = await resolveActiveMembership(ctx, schoolId);
  if (membership.isPlatformAdmin || !membership.membershipId || !membership.userId) {
    admissionsError("FORBIDDEN", "Current school membership is required");
  }
  const capabilities = await getContextCapabilities(ctx, membership);
  const normalized = new Set(capabilities.map(normalizeCapability));
  if (!requiredCapabilities.every((capability) => normalized.has(normalizeCapability(capability)))) {
    admissionsError("FORBIDDEN", "Required enrollment capability is missing");
  }
  return {
    ...membership,
    userId: membership.userId,
    membershipId: membership.membershipId,
    capabilities,
  };
}

export async function recordAdmissionsAudit(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    actorKind: "guardian" | "staff" | "system";
    actorGuardianId?: Id<"admissionsGuardians">;
    actorUserId?: Id<"users">;
    action: string;
    entityType: string;
    entityId: string;
    applicationId?: Id<"admissionsApplications">;
    outcome?: "success" | "denied" | "blocked" | "failed";
    reasonCode?: string;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  await ctx.db.insert("admissionsAuditEvents", {
    schoolId: args.schoolId,
    actorKind: args.actorKind,
    ...(args.actorGuardianId ? { actorGuardianId: args.actorGuardianId } : {}),
    ...(args.actorUserId ? { actorUserId: args.actorUserId } : {}),
    action: normalizeRequiredText(args.action, "Audit action", 120),
    entityType: normalizeRequiredText(args.entityType, "Audit entity type", 80),
    entityId: normalizeRequiredText(args.entityId, "Audit entity ID", 200),
    ...(args.applicationId ? { applicationId: args.applicationId } : {}),
    outcome: args.outcome ?? "success",
    ...(args.reasonCode
      ? { reasonCode: normalizeRequiredText(args.reasonCode, "Reason code", 120) }
      : {}),
    ...(args.metadata ? { metadataJson: JSON.stringify(args.metadata) } : {}),
    createdAt: Date.now(),
  });
}

export function isApplicationEditable(state: Doc<"admissionsApplications">["state"]) {
  return state === "draft" || state === "changes_requested";
}

function numericClaim(identity: unknown, key: string): number | null {
  if (!identity || typeof identity !== "object") return null;
  const value = Reflect.get(identity, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function hasFreshAuthentication(ctx: AdmissionsContext, now = Date.now()) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const seconds = numericClaim(identity, "auth_time");
  const milliseconds = numericClaim(identity, "authenticatedAt");
  const authenticatedAt = milliseconds ?? (seconds === null ? null : seconds * 1_000);
  return authenticatedAt !== null && authenticatedAt <= now && now - authenticatedAt <= 5 * 60 * 1_000;
}
