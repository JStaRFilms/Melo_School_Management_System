import { action, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { normalizeHumanName, normalizePersonName } from "@school/shared/name-format";

type BootstrapPlatformAdminIds = {
  platformAdminId: Id<"platformAdmins">;
};

async function readJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function ensurePlatformAuthUser(args: {
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
    `Failed to provision platform auth user for ${args.email}: ${
      signUpPayload?.message ?? signUpResponse.statusText
    }`
  );
}

export const bootstrapPlatformAdminInternal = internalMutation({
  args: {
    adminName: v.string(),
    adminEmail: v.string(),
    adminAuthId: v.string(),
  },
  returns: v.object({
    platformAdminId: v.id("platformAdmins"),
  }),
  handler: async (ctx, args): Promise<BootstrapPlatformAdminIds> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        authId: args.adminAuthId,
        name: normalizePersonName(args.adminName),
        isActive: true,
        updatedAt: now,
      });

      return { platformAdminId: existing._id };
    }

    const platformAdminId = await ctx.db.insert("platformAdmins", {
      authId: args.adminAuthId,
      email: args.adminEmail,
      name: normalizePersonName(args.adminName),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return { platformAdminId };
  },
});

export const resolveExistingAuthIdByEmailInternal = internalQuery({
  args: {
    adminEmail: v.string(),
  },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const existingPlatformAdmin = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .unique();

    if (existingPlatformAdmin?.authId) {
      return existingPlatformAdmin.authId;
    }

    const existingSchoolUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.adminEmail))
      .first();

    return existingSchoolUser?.authId ?? null;
  },
});

export const bootstrapPlatformAdmin = action({
  args: {
    bootstrapToken: v.string(),
    adminName: v.string(),
    adminEmail: v.string(),
    adminPassword: v.string(),
    origin: v.string(),
  },
  returns: v.object({
    platformAdminId: v.id("platformAdmins"),
    adminAuthId: v.string(),
    adminEmail: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    platformAdminId: Id<"platformAdmins">;
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

    const normalizedName = normalizeHumanName(args.adminName);
    const normalizedEmail = args.adminEmail.trim().toLowerCase();
    const existingAuthId = await ctx.runQuery(
      internal.functions.platform.bootstrap.resolveExistingAuthIdByEmailInternal,
      { adminEmail: normalizedEmail }
    );

    const adminAuthId =
      existingAuthId ??
      (await ensurePlatformAuthUser({
        authBaseUrl,
        origin: args.origin,
        name: normalizedName,
        email: normalizedEmail,
        password: args.adminPassword,
      }));

    const bootstrapped = await ctx.runMutation(
      internal.functions.platform.bootstrap.bootstrapPlatformAdminInternal,
      {
        adminName: normalizedName,
        adminEmail: normalizedEmail,
        adminAuthId,
      }
    );

    return {
      ...bootstrapped,
      adminAuthId,
      adminEmail: normalizedEmail,
    };
  },
});
