import { action, internalMutation, internalQuery } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { createAuth } from "../../betterAuth";
import { resolveStoredUserNameFields } from "../academic/studentNameCompat";

type BootstrapPlatformAdminIds = {
  platformAdminId: Id<"platformAdmins">;
};

/** Canonical Better Auth identity: the deployment issuer plus the provider subject. */
function canonicalTokenIdentifier(authId: string) {
  const issuer = process.env.CONVEX_SITE_URL?.trim().replace(/\/$/, "");
  if (!issuer) throw new ConvexError("Authentication issuer is not configured");
  return `${issuer}|${authId}`;
}

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

type AuthActionCtx = Parameters<typeof createAuth>[0];

/**
 * A reused auth subject must still resolve to the provider's current user for
 * this email. Binding a stale subject would report a successful bootstrap while
 * sign-in keeps failing, and the canonical token identity would then block the
 * reviewed reconciliation path.
 */
async function verifyExistingAuthSubject(
  ctx: AuthActionCtx,
  email: string,
  expectedAuthId: string
) {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const existingAuth = (await authContext.internalAdapter.findUserByEmail(email, {
    includeAccounts: false,
  })) as { user: { id: string } } | null;
  if (!existingAuth?.user || existingAuth.user.id !== expectedAuthId) {
    throw new ConvexError(
      "Existing platform admin authentication account requires manual review"
    );
  }
  return existingAuth.user.id;
}

export const bootstrapPlatformAdminInternal = internalMutation({
  args: {
    adminName: v.string(),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    adminEmail: v.string(),
    adminAuthId: v.string(),
  },
  returns: v.object({
    platformAdminId: v.id("platformAdmins"),
  }),
  handler: async (ctx, args): Promise<BootstrapPlatformAdminIds> => {
    const now = Date.now();
    // The token identity is derived server-side from the deployment issuer and
    // the auth subject the provider returned. Bootstrap never accepts a
    // caller-supplied token identifier, and it never rewrites a conflicting one.
    const authTokenIdentifier = canonicalTokenIdentifier(args.adminAuthId);
    const sameEmail = await ctx.db
      .query("platformAdmins")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .take(2);
    if (sameEmail.length > 1) {
      throw new ConvexError(
        "Multiple platform admins share this email; reviewed reconciliation is required"
      );
    }
    const existing = sameEmail[0];
    const sameSubject = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth", (q) => q.eq("authId", args.adminAuthId))
      .take(2);
    const linkedByToken = await ctx.db
      .query("platformAdmins")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", authTokenIdentifier)
      )
      .take(2);
    if (linkedByToken.length > 1 || sameSubject.length > 1) {
      throw new ConvexError(
        "This authentication identity is ambiguous across platform admins; reviewed reconciliation is required"
      );
    }
    if (linkedByToken.length === 1 && linkedByToken[0]._id !== existing?._id) {
      throw new ConvexError(
        "This authentication identity is already linked to another platform admin"
      );
    }
    if (
      sameSubject.length === 1 &&
      sameSubject[0]._id !== existing?._id
    ) {
      throw new ConvexError(
        "This authentication subject is already recorded for another platform admin"
      );
    }

    if (existing) {
      if (existing.authId !== args.adminAuthId) {
        throw new ConvexError(
          "Existing platform admin is bound to a different authentication subject; reviewed reconciliation is required"
        );
      }
      if (
        existing.authTokenIdentifier &&
        existing.authTokenIdentifier !== authTokenIdentifier
      ) {
        throw new ConvexError(
          "Existing platform admin is bound to a different token identity; reviewed reconciliation is required"
        );
      }
      await ctx.db.patch(existing._id, {
        authId: args.adminAuthId,
        authTokenIdentifier,
        ...resolveStoredUserNameFields({ name: args.adminName, firstName: args.firstName, middleName: args.middleName, lastName: args.lastName, fallbackName: existing.name, fallbackFirstName: existing.firstName, fallbackMiddleName: existing.middleName, fallbackLastName: existing.lastName }),
        isActive: true,
        updatedAt: now,
      });

      return { platformAdminId: existing._id };
    }

    const platformAdminId = await ctx.db.insert("platformAdmins", {
      authId: args.adminAuthId,
      authTokenIdentifier,
      email: args.adminEmail,
      ...resolveStoredUserNameFields({ name: args.adminName, firstName: args.firstName, middleName: args.middleName, lastName: args.lastName }),
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
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
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

    const nameFields = resolveStoredUserNameFields({ name: args.adminName, firstName: args.firstName, middleName: args.middleName, lastName: args.lastName });
    const normalizedName = nameFields.name;
    const normalizedEmail = args.adminEmail.trim().toLowerCase();
    const existingAuthId = await ctx.runQuery(
      internal.functions.platform.bootstrap.resolveExistingAuthIdByEmailInternal,
      { adminEmail: normalizedEmail }
    );

    const adminAuthId = existingAuthId
      ? await verifyExistingAuthSubject(ctx, normalizedEmail, existingAuthId)
      : await ensurePlatformAuthUser({
          authBaseUrl,
          origin: args.origin,
          name: normalizedName,
          email: normalizedEmail,
          password: args.adminPassword,
        });

    const bootstrapped = await ctx.runMutation(
      internal.functions.platform.bootstrap.bootstrapPlatformAdminInternal,
      {
        adminName: normalizedName,
        firstName: nameFields.firstName, middleName: nameFields.middleName, lastName: nameFields.lastName,
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
