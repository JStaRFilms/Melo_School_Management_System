import { RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../../_generated/server";
import { createAuth } from "../../betterAuth";
import { isEmailAddress, normalizeEmailCase } from "../foundation/normalize";
import { recordAuditEventHelper } from "./audit";
import {
  assertAdminForSchool,
  getAuthenticatedSchoolMembership,
  resolveActiveMembership,
} from "./auth";
import { isTrustedLegacySubjectIssuer } from "./identityResolver";
import { getReadableUserName, resolveStoredUserNameFields } from "./studentNameCompat";

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;
const FIFTEEN_MINUTES = 15 * 60_000;

const inviteLimiter = new RateLimiter(components.rateLimiter, {
  schoolInvitationEmail: {
    kind: "token bucket",
    rate: 3,
    period: FIFTEEN_MINUTES,
    capacity: 3,
  },
});

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeDeliverableEmail(raw: string): string {
  const normalized = normalizeEmailCase(raw);
  if (
    !isEmailAddress(normalized) ||
    normalized.length > 240 ||
    normalized.endsWith(".local") ||
    /[\r\n]/.test(normalized)
  ) {
    throw new ConvexError("Enter a valid deliverable email address");
  }
  return normalized;
}

function maskEmailAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0] ?? "*"}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function resolveInviteBaseUrl(
  role: "teacher" | "staff" | "parent",
): string {
  const configured =
    role === "parent"
      ? process.env.PORTAL_APP_URL?.trim()
      : process.env.TEACHER_APP_URL?.trim();
  const fallback =
    process.env.NODE_ENV !== "production"
      ? role === "parent"
        ? "http://localhost:3103"
        : "http://localhost:3101"
      : "";
  const candidate = (configured || fallback).replace(/\/$/, "");
  if (!candidate) {
    throw new ConvexError(
      role === "parent"
        ? "Family Portal invite URL is not configured (PORTAL_APP_URL)"
        : "Teacher workspace invite URL is not configured (TEACHER_APP_URL)",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ConvexError("Configured invitation app URL is invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConvexError("Configured invitation app URL must use http or https");
  }
  return parsed.origin;
}

function buildInviteLink(
  role: "teacher" | "staff" | "parent",
  rawToken: string,
) {
  const invitePath = `/invite/${rawToken}`;
  const baseUrl = resolveInviteBaseUrl(role);
  return {
    invitePath,
    inviteUrl: `${baseUrl}${invitePath}`,
  };
}

function getBetterAuthTokenIdentifier(authId: string): string {
  const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
  if (!issuer) throw new ConvexError("Authentication issuer is not configured");
  return `${issuer}|${authId}`;
}

export function isUnboundPlaceholderAuthId(authId: string): boolean {
  return authId.startsWith("invite:") || authId.startsWith("parent:");
}

async function resolvePersonDefaultDecision(
  ctx: QueryCtx | MutationCtx,
  personId: Id<"persons">,
): Promise<boolean> {
  const activeMemberships = await ctx.db
    .query("branchMemberships")
    .withIndex("by_person_and_status", (q) =>
      q.eq("personId", personId).eq("status", "active"),
    )
    .take(101);
  return !activeMemberships.some((m) => m.isDefaultBranch);
}

export async function revokePendingInvitationsForTargetUser(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    targetUserId: Id<"users">;
    revokedByUserId?: Id<"users">;
    reason: string;
  },
): Promise<number> {
  const now = Date.now();
  const pendingInvites = await ctx.db
    .query("schoolInvitations")
    .withIndex("by_school_target_status", (q) =>
      q
        .eq("schoolId", args.schoolId)
        .eq("targetUserId", args.targetUserId)
        .eq("status", "pending"),
    )
    .take(101);
  if (pendingInvites.length > 100) {
    throw new ConvexError("Pending invitation history requires operator review");
  }
  for (const prior of pendingInvites) {
    await ctx.db.patch(prior._id, {
      status: "revoked",
      ...(args.revokedByUserId ? { revokedByUserId: args.revokedByUserId } : {}),
      revokedAt: now,
      revokeReason: args.reason,
      updatedAt: now,
    });
  }
  return pendingInvites.length;
}

export async function createInvitationRecord(
  ctx: MutationCtx,
  args: {
    schoolId: Id<"schools">;
    targetUserId: Id<"users">;
    intendedRole: "teacher" | "staff" | "parent";
    normalizedEmail: string;
    createdByUserId: Id<"users">;
  },
) {
  const rawToken = generateInviteToken();
  // Validate server-side trusted invite URL before mutating invitation state.
  const { invitePath, inviteUrl } = buildInviteLink(
    args.intendedRole,
    rawToken,
  );
  const now = Date.now();
  await revokePendingInvitationsForTargetUser(ctx, {
    schoolId: args.schoolId,
    targetUserId: args.targetUserId,
    revokedByUserId: args.createdByUserId,
    reason: "Superseded by a newer invitation",
  });

  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = now + INVITE_TTL_MS;
  const quota = await inviteLimiter.limit(ctx, "schoolInvitationEmail", {
    key: `${args.schoolId}:${args.normalizedEmail}`,
  });
  const deliveryState = quota.ok ? ("pending" as const) : ("suppressed" as const);

  const invitationId = await ctx.db.insert("schoolInvitations", {
    schoolId: args.schoolId,
    targetUserId: args.targetUserId,
    intendedRole: args.intendedRole,
    normalizedEmail: args.normalizedEmail,
    tokenHash,
    status: "pending",
    expiresAt,
    createdByUserId: args.createdByUserId,
    deliveryState,
    deliveryAttemptCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  if (deliveryState === "pending") {
    await ctx.scheduler.runAfter(
      0,
      internal.functions.academic.invitations.processInvitationEmail,
      {
        invitationId,
        inviteUrl,
      },
    );
  }

  return {
    invitationId,
    invitePath,
    inviteUrl,
    expiresAt,
    deliveryState,
  };
}

export const createTeacherInvitation = mutation({
  args: {
    schoolId: v.optional(v.id("schools")),
    name: v.string(),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: "staff.onboard",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const normalizedEmail = normalizeDeliverableEmail(args.email);
    const teacherName = resolveStoredUserNameFields({
      name: args.name,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      requiredMessage: "Teacher name is required",
    });

    const sameSchoolUsers = await ctx.db
      .query("users")
      .withIndex("by_school_and_email", (q) =>
        q.eq("schoolId", actor.schoolId).eq("email", normalizedEmail),
      )
      .take(10);

    const activeParent = sameSchoolUsers.find(
      (u) => !u.isArchived && u.role === "parent",
    );
    if (activeParent) {
      throw new ConvexError({
        code: "SAME_SCHOOL_PARENT_EXISTS",
        parentUserId: activeParent._id,
        message:
          "This email already belongs to a parent in this school. Grant teacher access to their existing school record instead.",
      });
    }

    const activeOther = sameSchoolUsers.find((u) => !u.isArchived);
    if (activeOther) {
      throw new ConvexError(
        "A staff member with this email already exists in this school",
      );
    }

    const archivedTeacher = sameSchoolUsers.find(
      (u) => u.isArchived && u.role === "teacher",
    );
    if (archivedTeacher) {
      throw new ConvexError(
        "This failed because the teacher was previously archived. Check the archives.",
      );
    }

    const now = Date.now();
    const targetUserId = await ctx.db.insert("users", {
      schoolId: actor.schoolId,
      authId: `invite:teacher:${crypto.randomUUID()}`,
      ...teacherName,
      email: normalizedEmail,
      role: "teacher",
      createdAt: now,
      updatedAt: now,
    });

    const created = await createInvitationRecord(ctx, {
      schoolId: actor.schoolId,
      targetUserId,
      intendedRole: "teacher",
      normalizedEmail,
      createdByUserId: actor.userId,
    });

    const [actorContext, actorUser] = await Promise.all([
      resolveActiveMembership(ctx, actor.schoolId),
      ctx.db.get(actor.userId),
    ]);
    await recordAuditEventHelper(ctx, {
      schoolId: actor.schoolId,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: "staff",
      action: "invitation.created",
      targetType: "schoolInvitations",
      targetId: created.invitationId,
      outcome: "success",
      safeSummary: `Created teacher invitation for local user ${targetUserId}`,
      retentionClass: "operational_7yr",
      alertTier: "tier3_info",
    });

    return {
      invitationId: created.invitationId,
      targetUserId,
      email: normalizedEmail,
      invitePath: created.invitePath,
      inviteUrl: created.inviteUrl,
      expiresAt: created.expiresAt,
      deliveryState: created.deliveryState,
    };
  },
});

export const createParentInvitation = mutation({
  args: {
    userId: v.id("users"),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const targetParent = await ctx.db.get(args.userId);
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId ?? targetParent?.schoolId,
      capability: "enrollment.intakes.manage",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const parent = targetParent;
    if (
      !parent ||
      parent.schoolId !== actor.schoolId ||
      parent.isArchived ||
      parent.role !== "parent"
    ) {
      throw new ConvexError("Parent account not found");
    }

    if (parent.personId && parent.authTokenIdentifier) {
      const memberships = await ctx.db
        .query("branchMemberships")
        .withIndex("by_person_and_school", (q) =>
          q.eq("personId", parent.personId!).eq("schoolId", actor.schoolId),
        )
        .take(2);
      if (
        memberships.length === 1 &&
        memberships[0].status === "active" &&
        memberships[0].legacyUserId === parent._id
      ) {
        throw new ConvexError(
          "This parent already has an active Family Portal login linked to this school.",
        );
      }
    }

    const normalizedEmail = normalizeDeliverableEmail(parent.email);
    const created = await createInvitationRecord(ctx, {
      schoolId: actor.schoolId,
      targetUserId: parent._id,
      intendedRole: "parent",
      normalizedEmail,
      createdByUserId: actor.userId,
    });

    const [actorContext, actorUser] = await Promise.all([
      resolveActiveMembership(ctx, actor.schoolId),
      ctx.db.get(actor.userId),
    ]);
    await recordAuditEventHelper(ctx, {
      schoolId: actor.schoolId,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: "enrollment",
      action: "invitation.parent_created",
      targetType: "schoolInvitations",
      targetId: created.invitationId,
      outcome: "success",
      safeSummary: `Created parent portal invitation for local user ${parent._id}`,
      retentionClass: "operational_7yr",
      alertTier: "tier3_info",
    });

    return {
      invitationId: created.invitationId,
      targetUserId: parent._id,
      email: normalizedEmail,
      invitePath: created.invitePath,
      inviteUrl: created.inviteUrl,
      expiresAt: created.expiresAt,
      deliveryState: created.deliveryState,
    };
  },
});

export const listSchoolInvitations = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    intendedRole: v.optional(
      v.union(v.literal("teacher"), v.literal("staff"), v.literal("parent")),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: ["staff.list.view", "staff.onboard", "enrollment.intakes.manage"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const rows = await ctx.db
      .query("schoolInvitations")
      .withIndex("by_school", (q) => q.eq("schoolId", actor.schoolId))
      .order("desc")
      .take(50);

    const filtered = args.intendedRole
      ? rows.filter((row) => row.intendedRole === args.intendedRole)
      : rows;

    return await Promise.all(
      filtered.map(async (row) => {
        const target = await ctx.db.get(row.targetUserId);
        return {
          invitationId: row._id,
          targetUserId: row.targetUserId,
          targetName: target ? getReadableUserName(target).displayName : "Pending user",
          intendedRole: row.intendedRole,
          email: row.normalizedEmail,
          status: row.status,
          expiresAt: row.expiresAt,
          deliveryState: row.deliveryState,
          deliveryAttemptCount: row.deliveryAttemptCount,
          createdAt: row.createdAt,
          acceptedAt: row.acceptedAt ?? null,
        };
      }),
    );
  },
});

export const getTargetUserInvitation = query({
  args: {
    userId: v.id("users"),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId,
      capability: ["staff.list.view", "staff.onboard", "enrollment.intakes.manage"],
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    const rows = await ctx.db
      .query("schoolInvitations")
      .withIndex("by_school_and_target_user", (q) =>
        q.eq("schoolId", actor.schoolId).eq("targetUserId", args.userId),
      )
      .order("desc")
      .take(1);
    const latest = rows[0];
    if (!latest) return null;
    return {
      invitationId: latest._id,
      status: latest.status,
      email: latest.normalizedEmail,
      expiresAt: latest.expiresAt,
      deliveryState: latest.deliveryState,
      deliveryAttemptCount: latest.deliveryAttemptCount,
      createdAt: latest.createdAt,
      acceptedAt: latest.acceptedAt ?? null,
    };
  },
});

export const resendSchoolInvitation = mutation({
  args: {
    invitationId: v.id("schoolInvitations"),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.invitationId);
    if (!existing) throw new ConvexError("Invitation not found");
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId ?? existing.schoolId,
      capability:
        existing.intendedRole === "parent"
          ? "enrollment.intakes.manage"
          : "staff.onboard",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    if (existing.schoolId !== actor.schoolId) {
      throw new ConvexError("Invitation not found");
    }
    if (existing.status === "accepted") {
      throw new ConvexError("This invitation has already been accepted");
    }
    const target = await ctx.db.get(existing.targetUserId);
    if (
      !target ||
      target.schoolId !== actor.schoolId ||
      target.isArchived ||
      target.role !== existing.intendedRole ||
      normalizeEmailCase(target.email) !== existing.normalizedEmail
    ) {
      throw new ConvexError("Target account details changed; create a fresh invitation instead");
    }

    const created = await createInvitationRecord(ctx, {
      schoolId: actor.schoolId,
      targetUserId: existing.targetUserId,
      intendedRole: existing.intendedRole,
      normalizedEmail: existing.normalizedEmail,
      createdByUserId: actor.userId,
    });

    return {
      invitationId: created.invitationId,
      email: existing.normalizedEmail,
      invitePath: created.invitePath,
      inviteUrl: created.inviteUrl,
      expiresAt: created.expiresAt,
      deliveryState: created.deliveryState,
    };
  },
});

export const reissueTeacherInvitation = mutation({
  args: {
    teacherId: v.id("users"),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const teacher = await ctx.db.get(args.teacherId);
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId ?? teacher?.schoolId,
      capability: "staff.onboard",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);

    if (
      !teacher ||
      teacher.schoolId !== actor.schoolId ||
      teacher.isArchived ||
      teacher.role !== "teacher"
    ) {
      throw new ConvexError("Teacher not found");
    }
    if (
      teacher.personId ||
      teacher.authTokenIdentifier ||
      !isUnboundPlaceholderAuthId(teacher.authId)
    ) {
      throw new ConvexError("This teacher already has an active login linked");
    }

    const normalizedEmail = normalizeDeliverableEmail(teacher.email);
    const created = await createInvitationRecord(ctx, {
      schoolId: actor.schoolId,
      targetUserId: teacher._id,
      intendedRole: "teacher",
      normalizedEmail,
      createdByUserId: actor.userId,
    });

    const [actorContext, actorUser] = await Promise.all([
      resolveActiveMembership(ctx, actor.schoolId),
      ctx.db.get(actor.userId),
    ]);
    await recordAuditEventHelper(ctx, {
      schoolId: actor.schoolId,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: "staff",
      action: "invitation.reissued",
      targetType: "schoolInvitations",
      targetId: created.invitationId,
      outcome: "success",
      safeSummary: `Reissued teacher invitation for unbound local user ${teacher._id}`,
      retentionClass: "operational_7yr",
      alertTier: "tier3_info",
    });

    return {
      invitationId: created.invitationId,
      targetUserId: teacher._id,
      email: normalizedEmail,
      invitePath: created.invitePath,
      inviteUrl: created.inviteUrl,
      expiresAt: created.expiresAt,
      deliveryState: created.deliveryState,
    };
  },
});

export const revokeSchoolInvitation = mutation({
  args: {
    invitationId: v.id("schoolInvitations"),
    schoolId: v.optional(v.id("schools")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.invitationId);
    if (!existing) throw new ConvexError("Invitation not found");
    const actor = await getAuthenticatedSchoolMembership(ctx, {
      schoolId: args.schoolId ?? existing.schoolId,
      capability:
        existing.intendedRole === "parent"
          ? "enrollment.intakes.manage"
          : "staff.onboard",
    });
    await assertAdminForSchool(ctx, actor.userId, actor.schoolId, actor.role);
    if (existing.schoolId !== actor.schoolId) {
      throw new ConvexError("Invitation not found");
    }
    if (existing.status !== "pending") {
      throw new ConvexError("Only pending invitations can be revoked");
    }

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "revoked",
      revokedByUserId: actor.userId,
      revokedAt: now,
      revokeReason: args.reason?.trim() || "Revoked by school administrator",
      updatedAt: now,
    });

    // If this was an unclaimed placeholder teacher row created solely for this invite, archive it so the email can be re-invited cleanly.
    const target = await ctx.db.get(existing.targetUserId);
    if (
      target &&
      target.schoolId === actor.schoolId &&
      !target.personId &&
      !target.authTokenIdentifier &&
      target.authId.startsWith("invite:")
    ) {
      await ctx.db.patch(target._id, {
        isArchived: true,
        archivedAt: now,
        archivedBy: actor.userId,
        updatedAt: now,
      });
    }

    const [actorContext, actorUser] = await Promise.all([
      resolveActiveMembership(ctx, actor.schoolId),
      ctx.db.get(actor.userId),
    ]);
    await recordAuditEventHelper(ctx, {
      schoolId: actor.schoolId,
      actorKind: "user",
      actorPersonId: actorContext.personId,
      actorMembershipId: actorContext.membershipId,
      actorEmailSnapshot: actorUser?.email ?? "school-admin",
      module: existing.intendedRole === "parent" ? "enrollment" : "staff",
      action: "invitation.revoked",
      targetType: "schoolInvitations",
      targetId: existing._id,
      outcome: "success",
      safeSummary: `Revoked pending ${existing.intendedRole} invitation ${existing._id}`,
      retentionClass: "operational_7yr",
      alertTier: "tier3_info",
    });

    return null;
  },
});

export const inspectInvitation = query({
  args: {
    token: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const trimmed = args.token.trim();
    if (trimmed.length < 16 || trimmed.length > 200) {
      return { state: "invalid" as const };
    }
    const tokenHash = await sha256Hex(trimmed);
    const invitation = await ctx.db
      .query("schoolInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation) return { state: "invalid" as const };

    const school = await ctx.db.get(invitation.schoolId);
    if (!school || school.status !== "active") {
      return { state: "invalid" as const };
    }
    if (invitation.status === "accepted") {
      return { state: "accepted" as const, schoolName: school.name };
    }
    if (invitation.status === "revoked") {
      return { state: "revoked" as const, schoolName: school.name };
    }
    const currentTime = args.now ?? 0;
    if (
      invitation.status === "expired" ||
      (currentTime > 0 && invitation.expiresAt <= currentTime)
    ) {
      return { state: "expired" as const, schoolName: school.name };
    }

    const identity = await ctx.auth.getUserIdentity();
    let viewerEmailMatches = false;
    let viewerMaskedEmail: string | null = null;
    if (identity) {
      const candidateEmail =
        typeof identity.email === "string"
          ? normalizeEmailCase(identity.email)
          : null;
      if (candidateEmail) {
        viewerEmailMatches = candidateEmail === invitation.normalizedEmail;
        viewerMaskedEmail = maskEmailAddress(candidateEmail);
      } else {
        const people = await ctx.db
          .query("persons")
          .withIndex("by_token_identifier", (q) =>
            q.eq("authTokenIdentifier", identity.tokenIdentifier),
          )
          .take(2);
        if (people.length === 1) {
          const personEmail = normalizeEmailCase(people[0].email);
          viewerEmailMatches = personEmail === invitation.normalizedEmail;
          viewerMaskedEmail = maskEmailAddress(personEmail);
        }
      }
    }

    return {
      state: "pending" as const,
      schoolName: school.name,
      intendedRole: invitation.intendedRole,
      maskedEmail: maskEmailAddress(invitation.normalizedEmail),
      expiresAt: invitation.expiresAt,
      viewerSignedIn: Boolean(identity),
      viewerEmailMatches,
      viewerMaskedEmail,
    };
  },
});

export const acceptInvitationAsAuthenticatedUser = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Sign in to your Melo account to accept this invitation");
    }

    const tokenHash = await sha256Hex(args.token.trim());
    const invitation = await ctx.db
      .query("schoolInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invitation || invitation.status !== "pending") {
      throw new ConvexError("This invitation is no longer valid");
    }
    const now = Date.now();
    if (invitation.expiresAt <= now) {
      await ctx.db.patch(invitation._id, { status: "expired", updatedAt: now });
      throw new ConvexError("This invitation has expired. Ask the school for a new invite link.");
    }

    const [school, targetUser, people] = await Promise.all([
      ctx.db.get(invitation.schoolId),
      ctx.db.get(invitation.targetUserId),
      ctx.db
        .query("persons")
        .withIndex("by_token_identifier", (q) =>
          q.eq("authTokenIdentifier", identity.tokenIdentifier),
        )
        .take(2),
    ]);

    if (!school || school.status !== "active") {
      throw new ConvexError("This school workspace is not active");
    }
    if (
      !targetUser ||
      targetUser.schoolId !== invitation.schoolId ||
      targetUser.isArchived
    ) {
      throw new ConvexError("Invited school account is no longer active");
    }
    if (
      normalizeEmailCase(targetUser.email) !== invitation.normalizedEmail ||
      targetUser.role !== invitation.intendedRole
    ) {
      await ctx.db.patch(invitation._id, {
        status: "revoked",
        revokedAt: now,
        revokeReason: "Target record email or role changed before acceptance",
        updatedAt: now,
      });
      throw new ConvexError(
        "This invitation is no longer valid because the school updated the account details. Ask the school for a new invite link.",
      );
    }
    if (people.length > 1) {
      throw new ConvexError(
        "Your Melo identity requires operator reconciliation before accepting this invitation",
      );
    }

    const existingPerson = people[0] ?? null;
    if (existingPerson?.identityReconciliationState === "reconciliation_required") {
      throw new ConvexError(
        "Your Melo identity requires operator reconciliation before accepting this invitation",
      );
    }
    if (existingPerson?.status === "suspended") {
      throw new ConvexError("Your Melo account is currently suspended");
    }
    if (
      existingPerson?.credentialResetLock &&
      existingPerson.credentialResetLock.expiresAt > now
    ) {
      throw new ConvexError(
        "An account credential update is currently in progress. Please try accepting again in a moment.",
      );
    }

    const targetAuthMatchesExisting =
      isUnboundPlaceholderAuthId(targetUser.authId) ||
      (Boolean(identity.subject) &&
        isTrustedLegacySubjectIssuer(identity.issuer) &&
        targetUser.authId === identity.subject);
    if (
      !targetAuthMatchesExisting ||
      (targetUser.personId &&
        (!existingPerson || targetUser.personId !== existingPerson._id)) ||
      (targetUser.authTokenIdentifier &&
        targetUser.authTokenIdentifier !== identity.tokenIdentifier) ||
      (targetUser.credentialOperationLock &&
        targetUser.credentialOperationLock.expiresAt > now) ||
      (targetUser.portalAccount?.state === "provisioned" &&
        targetUser.portalAccount.authId !== identity.subject) ||
      targetUser.portalAccount?.state === "provisioning" ||
      targetUser.portalAccount?.state === "resetting"
    ) {
      throw new ConvexError(
        "This invited school record is already linked to another login or has an update in progress",
      );
    }

    const identityEmail =
      typeof identity.email === "string"
        ? normalizeEmailCase(identity.email)
        : existingPerson
          ? normalizeEmailCase(existingPerson.email)
          : null;
    if (!identityEmail || identityEmail !== invitation.normalizedEmail) {
      throw new ConvexError(
        "This invitation was sent to a different email address. Sign out and sign in with the invited email.",
      );
    }

    // Check for any in-flight credential or portal provisioning operation on this identity's existing rows.
    if (existingPerson) {
      const existingPersonUsers = await ctx.db
        .query("users")
        .withIndex("by_person", (q) => q.eq("personId", existingPerson._id))
        .take(101);
      if (
        existingPersonUsers.some(
          (row) =>
            row.portalAccount?.state === "provisioning" ||
            row.portalAccount?.state === "resetting" ||
            (row.credentialOperationLock &&
              row.credentialOperationLock.expiresAt > now),
        )
      ) {
        throw new ConvexError(
          "An account credential update is currently in progress. Please try accepting again in a moment.",
        );
      }
    }

    // S8: If an existing legacy user (no persons row yet) claims a second school,
    // preserve their proven legacy school membership before creating the canonical person.
    let legacyOriginUser: Awaited<ReturnType<typeof ctx.db.get<"users">>> = null;
    if (!existingPerson) {
      const tokenLegacyRows = (
        await ctx.db
          .query("users")
          .withIndex("by_auth_token_identifier", (q) =>
            q.eq("authTokenIdentifier", identity.tokenIdentifier),
          )
          .take(10)
      ).filter((row) => !row.isArchived && row._id !== targetUser._id);

      let legacyRows = tokenLegacyRows;
      if (
        legacyRows.length === 0 &&
        identity.subject &&
        isTrustedLegacySubjectIssuer(identity.issuer)
      ) {
        legacyRows = (
          await ctx.db
            .query("users")
            .withIndex("by_auth", (q) => q.eq("authId", identity.subject!))
            .take(10)
        ).filter(
          (row) =>
            !row.isArchived &&
            row._id !== targetUser._id &&
            (!row.authTokenIdentifier ||
              row.authTokenIdentifier === identity.tokenIdentifier),
        );
      }

      if (legacyRows.length > 1) {
        throw new ConvexError(
          "Your existing school accounts require operator reconciliation before accepting a new school invitation",
        );
      }
      if (legacyRows.length === 1) {
        const candidate = legacyRows[0];
        if (
          candidate.portalAccount?.state === "provisioning" ||
          candidate.portalAccount?.state === "resetting" ||
          (candidate.credentialOperationLock &&
            candidate.credentialOperationLock.expiresAt > now)
        ) {
          throw new ConvexError(
            "An account credential update is currently in progress. Please try accepting again in a moment.",
          );
        }
        if (candidate.personId || candidate.schoolId === invitation.schoolId) {
          throw new ConvexError(
            "Your existing school account requires operator reconciliation before accepting this invitation",
          );
        }
        const legacySchool = await ctx.db.get(candidate.schoolId);
        if (legacySchool && legacySchool.status === "active") {
          legacyOriginUser = candidate;
        }
      }
    }

    const personId =
      existingPerson?._id ??
      (await ctx.db.insert("persons", {
        authTokenIdentifier: identity.tokenIdentifier,
        identityReconciliationState: "resolved",
        email: invitation.normalizedEmail,
        ...resolveStoredUserNameFields({
          fallbackName: legacyOriginUser?.name ?? targetUser.name,
          fallbackFirstName: legacyOriginUser?.firstName ?? targetUser.firstName,
          fallbackMiddleName: legacyOriginUser?.middleName ?? targetUser.middleName,
          fallbackLastName: legacyOriginUser?.lastName ?? targetUser.lastName,
        }),
        status: "active",
        primarySchoolId: legacyOriginUser?.schoolId ?? invitation.schoolId,
        selfManagedCredentials: true,
        createdAt: now,
        updatedAt: now,
      }));

    if (legacyOriginUser) {
      await ctx.db.insert("branchMemberships", {
        personId,
        schoolId: legacyOriginUser.schoolId,
        status: "active",
        displayTitle:
          legacyOriginUser.role === "teacher"
            ? "Teacher"
            : legacyOriginUser.role === "admin"
              ? "School Admin"
              : undefined,
        isDefaultBranch: true,
        legacyUserId: legacyOriginUser._id,
        joinedAt: legacyOriginUser.createdAt ?? now,
        updatedAt: now,
      });
      await ctx.db.patch(legacyOriginUser._id, {
        personId,
        authTokenIdentifier: identity.tokenIdentifier,
        updatedAt: now,
      });
    }

    if (existingPerson) {
      if (existingPerson.status === "archived") {
        // Returning user who left a prior school: reactivate canonical identity without restoring old school memberships.
        await ctx.db.patch(personId, {
          status: "active",
          primarySchoolId: invitation.schoolId,
          selfManagedCredentials: true,
          updatedAt: now,
        });
      } else if (!existingPerson.selfManagedCredentials) {
        await ctx.db.patch(personId, {
          selfManagedCredentials: true,
          updatedAt: now,
        });
      }
    }

    const existingMemberships = await ctx.db
      .query("branchMemberships")
      .withIndex("by_person_and_school", (q) =>
        q.eq("personId", personId).eq("schoolId", invitation.schoolId),
      )
      .take(2);
    if (existingMemberships.length > 1) {
      throw new ConvexError("Ambiguous school membership requires operator review");
    }
    const existingMembership = existingMemberships[0] ?? null;
    if (
      existingMembership &&
      existingMembership.legacyUserId &&
      existingMembership.legacyUserId !== targetUser._id
    ) {
      throw new ConvexError(
        "Your account is already linked to a different record in this school",
      );
    }

    const shouldBeDefault = await resolvePersonDefaultDecision(ctx, personId);
    const displayTitle =
      invitation.intendedRole === "teacher" ? "Teacher" : undefined;

    let membershipId: Id<"branchMemberships">;
    if (existingMembership) {
      await ctx.db.patch(existingMembership._id, {
        status: "active",
        displayTitle: existingMembership.displayTitle ?? displayTitle,
        isDefaultBranch: existingMembership.isDefaultBranch || shouldBeDefault,
        legacyUserId: targetUser._id,
        updatedAt: now,
      });
      membershipId = existingMembership._id;
    } else {
      membershipId = await ctx.db.insert("branchMemberships", {
        personId,
        schoolId: invitation.schoolId,
        status: "active",
        displayTitle,
        isDefaultBranch: shouldBeDefault,
        legacyUserId: targetUser._id,
        joinedAt: now,
        updatedAt: now,
      });
    }

    const targetPatch: Record<string, unknown> = {
      authId: identity.subject,
      authTokenIdentifier: identity.tokenIdentifier,
      personId,
      updatedAt: now,
    };
    if (targetUser.role === "parent") {
      targetPatch.portalAccount = {
        state: "provisioned",
        operationId: `invite:${invitation._id}`,
        expectedEmail: targetUser.email,
        expectedAuthId: identity.subject,
        authId: identity.subject,
        updatedAt: now,
      };
    }
    await ctx.db.patch(targetUser._id, targetPatch);

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByPersonId: personId,
      acceptedAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: invitation.schoolId,
      actorKind: "user",
      actorPersonId: personId,
      actorMembershipId: membershipId,
      actorEmailSnapshot: invitation.normalizedEmail,
      module: invitation.intendedRole === "parent" ? "enrollment" : "staff",
      action: "invitation.accepted_existing_identity",
      targetType: "branchMemberships",
      targetId: membershipId,
      outcome: "success",
      safeSummary: `Accepted ${invitation.intendedRole} invitation for school ${invitation.schoolId} using existing Melo identity`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });

    return {
      schoolId: invitation.schoolId,
      schoolName: school.name,
      role: targetUser.role,
    };
  },
});

export const getPendingInvitationForClaimInternal = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("schoolInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!invitation || invitation.status !== "pending") return null;
    const [school, targetUser] = await Promise.all([
      ctx.db.get(invitation.schoolId),
      ctx.db.get(invitation.targetUserId),
    ]);
    if (
      !school ||
      school.status !== "active" ||
      !targetUser ||
      targetUser.schoolId !== invitation.schoolId ||
      targetUser.isArchived ||
      normalizeEmailCase(targetUser.email) !== invitation.normalizedEmail ||
      targetUser.role !== invitation.intendedRole ||
      !isUnboundPlaceholderAuthId(targetUser.authId) ||
      targetUser.personId ||
      targetUser.authTokenIdentifier ||
      (targetUser.credentialOperationLock &&
        targetUser.credentialOperationLock.expiresAt > Date.now()) ||
      targetUser.portalAccount?.state === "provisioned" ||
      targetUser.portalAccount?.state === "provisioning" ||
      targetUser.portalAccount?.state === "resetting"
    ) {
      return null;
    }
    return {
      invitationId: invitation._id,
      schoolId: invitation.schoolId,
      schoolName: school.name,
      targetUserId: targetUser._id,
      targetName: getReadableUserName(targetUser).displayName,
      normalizedEmail: invitation.normalizedEmail,
      intendedRole: invitation.intendedRole,
      expiresAt: invitation.expiresAt,
    };
  },
});

export const completeNewUserInvitationClaimInternal = internalMutation({
  args: {
    invitationId: v.id("schoolInvitations"),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.status !== "pending") {
      throw new ConvexError("This invitation is no longer valid");
    }
    const now = Date.now();
    if (invitation.expiresAt <= now) {
      await ctx.db.patch(invitation._id, { status: "expired", updatedAt: now });
      throw new ConvexError("This invitation has expired");
    }
    const [school, targetUser] = await Promise.all([
      ctx.db.get(invitation.schoolId),
      ctx.db.get(invitation.targetUserId),
    ]);
    if (
      !school ||
      school.status !== "active" ||
      !targetUser ||
      targetUser.schoolId !== invitation.schoolId ||
      targetUser.isArchived
    ) {
      throw new ConvexError("Invited school record is no longer active");
    }
    if (
      normalizeEmailCase(targetUser.email) !== invitation.normalizedEmail ||
      targetUser.role !== invitation.intendedRole
    ) {
      throw new ConvexError(
        "This invitation is no longer valid because the school updated the account details",
      );
    }
    if (
      !isUnboundPlaceholderAuthId(targetUser.authId) ||
      targetUser.personId ||
      targetUser.authTokenIdentifier ||
      (targetUser.credentialOperationLock &&
        targetUser.credentialOperationLock.expiresAt > now) ||
      targetUser.portalAccount?.state === "provisioned" ||
      targetUser.portalAccount?.state === "provisioning" ||
      targetUser.portalAccount?.state === "resetting"
    ) {
      throw new ConvexError("Invited school record is already linked to a login");
    }

    const tokenIdentifier = getBetterAuthTokenIdentifier(args.authId);
    const [existingPeople, existingTokenUsers] = await Promise.all([
      ctx.db
        .query("persons")
        .withIndex("by_token_identifier", (q) =>
          q.eq("authTokenIdentifier", tokenIdentifier),
        )
        .take(2),
      ctx.db
        .query("users")
        .withIndex("by_auth_token_identifier", (q) =>
          q.eq("authTokenIdentifier", tokenIdentifier),
        )
        .take(2),
    ]);
    if (existingPeople.length > 0 || existingTokenUsers.length > 0) {
      throw new ConvexError("Authentication account is already linked");
    }

    const personId = await ctx.db.insert("persons", {
      authTokenIdentifier: tokenIdentifier,
      identityReconciliationState: "resolved",
      email: invitation.normalizedEmail,
      ...resolveStoredUserNameFields({
        fallbackName: targetUser.name,
        fallbackFirstName: targetUser.firstName,
        fallbackMiddleName: targetUser.middleName,
        fallbackLastName: targetUser.lastName,
      }),
      status: "active",
      primarySchoolId: invitation.schoolId,
      selfManagedCredentials: true,
      createdAt: now,
      updatedAt: now,
    });

    const membershipId = await ctx.db.insert("branchMemberships", {
      personId,
      schoolId: invitation.schoolId,
      status: "active",
      displayTitle:
        invitation.intendedRole === "teacher" ? "Teacher" : undefined,
      isDefaultBranch: true,
      legacyUserId: targetUser._id,
      joinedAt: now,
      updatedAt: now,
    });

    const targetPatch: Record<string, unknown> = {
      authId: args.authId,
      authTokenIdentifier: tokenIdentifier,
      personId,
      updatedAt: now,
    };
    if (targetUser.role === "parent") {
      targetPatch.portalAccount = {
        state: "provisioned",
        operationId: `invite:${invitation._id}`,
        expectedEmail: targetUser.email,
        expectedAuthId: args.authId,
        authId: args.authId,
        updatedAt: now,
      };
    }
    await ctx.db.patch(targetUser._id, targetPatch);

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedByPersonId: personId,
      acceptedAt: now,
      updatedAt: now,
    });

    await recordAuditEventHelper(ctx, {
      schoolId: invitation.schoolId,
      actorKind: "user",
      actorPersonId: personId,
      actorMembershipId: membershipId,
      actorEmailSnapshot: invitation.normalizedEmail,
      module: invitation.intendedRole === "parent" ? "enrollment" : "staff",
      action: "invitation.accepted_new_identity",
      targetType: "branchMemberships",
      targetId: membershipId,
      outcome: "success",
      safeSummary: `Created Melo account and accepted ${invitation.intendedRole} invitation for school ${invitation.schoolId}`,
      retentionClass: "permanent_statutory",
      alertTier: "tier2_warn",
    });

    return {
      schoolId: invitation.schoolId,
      schoolName: school.name,
      email: invitation.normalizedEmail,
      role: targetUser.role,
    };
  },
});

export const acceptInvitationAsNewUser = action({
  args: {
    token: v.string(),
    password: v.string(),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    schoolName: v.string(),
    email: v.string(),
    role: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    schoolId: Id<"schools">;
    schoolName: string;
    email: string;
    role: string;
  }> => {
    const tokenHash = await sha256Hex(args.token.trim());
    const pending = await ctx.runQuery(
      internal.functions.academic.invitations.getPendingInvitationForClaimInternal,
      { tokenHash },
    );
    if (!pending) {
      throw new ConvexError("This invitation is no longer valid");
    }
    if (pending.expiresAt <= Date.now()) {
      throw new ConvexError("This invitation has expired. Ask the school for a new invite link.");
    }

    const auth = createAuth(ctx);
    const authContext = await auth.$context;
    const minLen = authContext.password.config.minPasswordLength;
    const maxLen = authContext.password.config.maxPasswordLength;
    if (args.password.length < minLen || args.password.length > maxLen) {
      throw new ConvexError(`Password must be ${minLen}–${maxLen} characters`);
    }

    const existingAuth = await authContext.internalAdapter.findUserByEmail(
      pending.normalizedEmail,
      { includeAccounts: true },
    );
    if (existingAuth?.user?.id) {
      throw new ConvexError({
        code: "EXISTING_ACCOUNT_SIGN_IN_REQUIRED",
        message:
          "An account with this email already exists on Melo. Sign in with your existing password to accept this invitation.",
      });
    }

    const passwordHash = await authContext.password.hash(args.password);
    const created = await authContext.internalAdapter.createUser({
      name: pending.targetName,
      email: pending.normalizedEmail,
      emailVerified: true,
    });
    if (!created?.id) {
      throw new ConvexError("Could not create Melo account");
    }

    try {
      await authContext.internalAdapter.linkAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: passwordHash,
      });
      return await ctx.runMutation(
        internal.functions.academic.invitations
          .completeNewUserInvitationClaimInternal,
        {
          invitationId: pending.invitationId,
          authId: created.id,
        },
      );
    } catch (error) {
      await authContext.internalAdapter.deleteSessions(created.id).catch(() => undefined);
      await authContext.internalAdapter.deleteUser(created.id).catch(() => undefined);
      throw error;
    }
  },
});

export const claimInvitationDeliveryInternal = internalMutation({
  args: {
    invitationId: v.id("schoolInvitations"),
    hasApiKey: v.boolean(),
    from: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.invitationId);
    if (!row || row.status !== "pending") return null;
    const now = Date.now();
    if (row.expiresAt <= now) {
      await ctx.db.patch(row._id, { status: "expired", updatedAt: now });
      return null;
    }
    if (!args.hasApiKey || !args.from) {
      await ctx.db.patch(row._id, {
        deliveryState: "not_configured",
        deliveryErrorCode: "EMAIL_NOT_CONFIGURED",
        deliveryUpdatedAt: now,
        updatedAt: now,
      });
      return null;
    }
    const school = await ctx.db.get(row.schoolId);
    if (!school || school.status !== "active") return null;
    const attemptCount = row.deliveryAttemptCount + 1;
    await ctx.db.patch(row._id, {
      deliveryState: "sending",
      deliveryAttemptCount: attemptCount,
      deliveryUpdatedAt: now,
      updatedAt: now,
    });
    return {
      to: row.normalizedEmail,
      from: args.from,
      schoolName: school.name,
      intendedRole: row.intendedRole,
      attemptCount,
    };
  },
});

export const finishInvitationDeliveryInternal = internalMutation({
  args: {
    invitationId: v.id("schoolInvitations"),
    attemptCount: v.number(),
    providerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.invitationId);
    if (
      !row ||
      row.deliveryState !== "sending" ||
      row.deliveryAttemptCount !== args.attemptCount
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(row._id, {
      deliveryState: args.providerId ? "accepted" : "failed",
      ...(args.providerId ? { deliveryProviderId: args.providerId } : {}),
      deliveryErrorCode: args.providerId
        ? undefined
        : "EMAIL_PROVIDER_UNCONFIRMED",
      deliveryUpdatedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const processInvitationEmail = internalAction({
  args: {
    invitationId: v.id("schoolInvitations"),
    inviteUrl: v.string(),
  },
  handler: async (ctx, args): Promise<null> => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const configuredFrom = process.env.MELO_EMAIL_FROM?.trim();
    const from =
      apiKey &&
      configuredFrom &&
      /@jstarstudios\.com>?$/i.test(configuredFrom) &&
      !/[\r\n]/.test(configuredFrom)
        ? configuredFrom
        : undefined;

    const delivery = await ctx.runMutation(
      internal.functions.academic.invitations.claimInvitationDeliveryInternal,
      {
        invitationId: args.invitationId,
        hasApiKey: Boolean(apiKey),
        ...(from ? { from } : {}),
      },
    );
    if (!delivery) return null;

    const roleLabel =
      delivery.intendedRole === "parent"
        ? "Family Portal"
        : delivery.intendedRole === "teacher"
          ? "Teacher"
          : "Staff";
    const subject = `${delivery.schoolName}: accept your ${roleLabel} invitation on Melo`;
    const text = `${delivery.schoolName} invited you to join as a ${roleLabel.toLowerCase()} on Melo.\n\nOpen this single-use link to accept (expires in 7 days):\n${args.inviteUrl}\n\nIf you already use Melo with another school, sign in with your existing password to link this school to your account. If you are new to Melo, you will choose your own password.\n\nIf you did not expect this invitation, you can ignore this email.`;

    let providerId: string | undefined;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `school-invitation/${args.invitationId}`,
        },
        body: JSON.stringify({
          from: delivery.from,
          to: [delivery.to],
          subject,
          text,
        }),
      });
      if (response.ok) {
        const result: unknown = await response.json();
        if (
          result &&
          typeof result === "object" &&
          "id" in result &&
          typeof result.id === "string" &&
          result.id.length <= 200
        ) {
          providerId = result.id;
        }
      }
    } catch {
      // Never log or persist provider response bodies or secrets.
    }

    await ctx.runMutation(
      internal.functions.academic.invitations.finishInvitationDeliveryInternal,
      {
        invitationId: args.invitationId,
        attemptCount: delivery.attemptCount,
        ...(providerId ? { providerId } : {}),
      },
    );
    return null;
  },
});
