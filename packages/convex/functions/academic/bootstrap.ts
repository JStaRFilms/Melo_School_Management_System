import { action, internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { normalizeHumanName, normalizePersonName } from "@school/shared/name-format";

type BootstrapIds = {
    schoolId: Id<"schools">;
    adminUserId: Id<"users">;
    sessionId?: Id<"academicSessions">;
    termId?: Id<"academicTerms">;
  };

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensureAuthUser(args: {
  authBaseUrl: string;
  origin: string;
  name: string;
  email: string;
  password: string;
}) {
  const signUpResponse = await fetch(`${args.authBaseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: args.origin,
    },
    body: JSON.stringify({
      name: args.name,
      email: args.email,
      password: args.password,
    }),
  });

  const signUpPayload = await readJsonSafe(signUpResponse);
  if (signUpResponse.ok && signUpPayload?.user?.id) {
    return signUpPayload.user.id as string;
  }

  if (
    signUpResponse.status === 422 &&
    signUpPayload?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
  ) {
    const signInResponse = await fetch(`${args.authBaseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: args.origin,
      },
      body: JSON.stringify({
        email: args.email,
        password: args.password,
      }),
    });

    const signInPayload = await readJsonSafe(signInResponse);
    if (signInResponse.ok && signInPayload?.user?.id) {
      return signInPayload.user.id as string;
    }

    throw new ConvexError(
      `Existing auth user for ${args.email} could not sign in with the provided password.`
    );
  }

  throw new ConvexError(
    `Failed to provision auth user for ${args.email}: ${
      signUpPayload?.message ?? signUpResponse.statusText
    }`
  );
}

export const bootstrapSchoolAdminInternal = internalMutation({
  args: {
    schoolName: v.string(),
    schoolSlug: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminAuthId: v.string(),
    sessionName: v.optional(v.string()),
    termName: v.optional(v.string()),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    adminUserId: v.id("users"),
    sessionId: v.optional(v.id("academicSessions")),
    termId: v.optional(v.id("academicTerms")),
  }),
  handler: async (ctx, args): Promise<BootstrapIds> => {
    const now = Date.now();

    let school = await ctx.db
      .query("schools")
      .filter((q) => q.eq(q.field("slug"), args.schoolSlug))
      .unique();

    let schoolId: Id<"schools">;
    if (!school) {
      schoolId = await ctx.db.insert("schools", {
        name: normalizeHumanName(args.schoolName),
        slug: args.schoolSlug,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      schoolId = school._id;
      const nextSchoolName = normalizeHumanName(args.schoolName);
      if (school.name !== nextSchoolName) {
        await ctx.db.patch(schoolId, {
          name: nextSchoolName,
          updatedAt: now,
        });
      }
    }

    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .filter((q) => q.eq(q.field("email"), args.adminEmail))
      .unique();

    let adminUserId: Id<"users">;
    if (existingAdmin) {
      adminUserId = existingAdmin._id;
      await ctx.db.patch(adminUserId, {
        authId: args.adminAuthId,
        name: normalizePersonName(args.adminName),
        email: args.adminEmail,
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: null,
        updatedAt: now,
      });
    } else {
      adminUserId = await ctx.db.insert("users", {
        schoolId,
        authId: args.adminAuthId,
        name: normalizePersonName(args.adminName),
        email: args.adminEmail,
        role: "admin",
        isSchoolAdmin: true,
        managerUserId: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.runMutation(
      internal.functions.academic.adminLeadershipHelpers.ensureSchoolLeadAdminInternal,
      {
        schoolId,
        leadAdminUserId: adminUserId,
        updatedBy: adminUserId,
      }
    );

    let sessionId: Id<"academicSessions"> | undefined;
    if (args.sessionName?.trim()) {
      const nextSessionName = normalizeHumanName(args.sessionName);
      const existingSession = await ctx.db
        .query("academicSessions")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .filter((q) => q.eq(q.field("name"), nextSessionName))
        .unique();

      if (existingSession) {
        sessionId = existingSession._id;
      } else {
        sessionId = await ctx.db.insert("academicSessions", {
          schoolId,
          name: nextSessionName,
          startDate: now,
          endDate: now + 1000,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    let termId: Id<"academicTerms"> | undefined;
    if (sessionId && args.termName?.trim()) {
      const nextTermName = normalizeHumanName(args.termName);
      const existingTerm = await ctx.db
        .query("academicTerms")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId!))
        .filter((q) => q.eq(q.field("name"), nextTermName))
        .unique();

      if (existingTerm) {
        termId = existingTerm._id;
      } else {
        termId = await ctx.db.insert("academicTerms", {
          schoolId,
          sessionId,
          name: nextTermName,
          startDate: now,
          endDate: now + 1000,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      schoolId,
      adminUserId,
      ...(sessionId ? { sessionId } : {}),
      ...(termId ? { termId } : {}),
    };
  },
});

export const bootstrapSchoolAdmin = action({
  args: {
    bootstrapToken: v.string(),
    schoolName: v.string(),
    schoolSlug: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    origin: v.string(),
    sessionName: v.optional(v.string()),
    termName: v.optional(v.string()),
  },
  returns: v.object({
    schoolId: v.id("schools"),
    adminUserId: v.id("users"),
    sessionId: v.optional(v.id("academicSessions")),
    termId: v.optional(v.id("academicTerms")),
    adminAuthId: v.string(),
    adminEmail: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    schoolId: Id<"schools">;
    adminUserId: Id<"users">;
    sessionId?: Id<"academicSessions">;
    termId?: Id<"academicTerms">;
    adminAuthId: string;
    adminEmail: string;
  }> => {
    const expectedToken = process.env.PLATFORM_BOOTSTRAP_TOKEN?.trim();
    if (!expectedToken) {
      throw new ConvexError(
        "PLATFORM_BOOTSTRAP_TOKEN is not configured on the Convex deployment."
      );
    }

    if (args.bootstrapToken !== expectedToken) {
      throw new ConvexError("Invalid bootstrap token.");
    }

    const authBaseUrl = process.env.CONVEX_SITE_URL?.trim();
    if (!authBaseUrl) {
      throw new ConvexError(
        "CONVEX_SITE_URL is not configured on the Convex deployment."
      );
    }

    const normalizedSlug = args.schoolSlug.trim().toLowerCase();
    const adminAuthId = await ensureAuthUser({
      authBaseUrl,
      origin: args.origin,
      name: normalizePersonName(args.adminName),
      email: args.adminEmail.trim().toLowerCase(),
      password: args.adminPassword,
    });

    const bootstrapped: BootstrapIds = await ctx.runMutation(
      (internal as any).functions.academic.bootstrap.bootstrapSchoolAdminInternal,
      {
        schoolName: normalizeHumanName(args.schoolName),
        schoolSlug: normalizedSlug,
        adminName: normalizePersonName(args.adminName),
        adminEmail: args.adminEmail.trim().toLowerCase(),
        adminAuthId,
        ...(args.sessionName?.trim()
          ? { sessionName: normalizeHumanName(args.sessionName) }
          : {}),
        ...(args.termName?.trim() ? { termName: normalizeHumanName(args.termName) } : {}),
      }
    );

    return {
      ...bootstrapped,
      adminAuthId,
      adminEmail: args.adminEmail.trim().toLowerCase(),
    };
  },
});
