import { ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import { createAuth } from "../../betterAuth";

type ExistingAuthLookup = {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  accounts?: Array<{
    id: string;
  }>;
};

function formatUnknownErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unknown auth error";
}

async function cleanupOrphanedBetterAuthUser(
  ctx: ActionCtx,
  existingAuth: ExistingAuthLookup | null
) {
  if (!existingAuth?.user?.id) {
    return false;
  }

  const auth = createAuth(ctx);
  const authContext = await auth.$context;

  await authContext.internalAdapter.deleteSessions(existingAuth.user.id);

  for (const account of existingAuth.accounts ?? []) {
    if (!account?.id) {
      continue;
    }
    await authContext.internalAdapter.deleteAccount(account.id);
  }

  await authContext.internalAdapter.deleteUser(existingAuth.user.id);
  return true;
}

export async function provisionSchoolAdminAuthUser(
  ctx: ActionCtx,
  args: {
    adminEmail: string;
    adminName: string;
    adminPassword: string;
  }
) {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const normalizedEmail = args.adminEmail.trim().toLowerCase();

  const existingAuth = (await authContext.internalAdapter.findUserByEmail(
    normalizedEmail,
    { includeAccounts: true }
  )) as ExistingAuthLookup | null;

  if (existingAuth?.user?.id) {
    const existingEmailUsage = await ctx.runQuery(
      internal.functions.platform.index.inspectProvisioningEmailInternal,
      { email: normalizedEmail }
    );

    if (
      existingEmailUsage.schoolUserExists ||
      existingEmailUsage.platformAdminExists
    ) {
      throw new ConvexError(
        "An account with this email already exists in the system. Please use a different email."
      );
    }

    const deleted = await cleanupOrphanedBetterAuthUser(ctx, existingAuth);
    if (!deleted) {
      throw new ConvexError(
        "This email already exists in authentication but is not linked to a school admin or platform admin record. It was likely created by an earlier partial provisioning attempt."
      );
    }
  }

  const minPasswordLength = authContext.password.config.minPasswordLength;
  if (args.adminPassword.length < minPasswordLength) {
    throw new ConvexError(
      `Password must be at least ${minPasswordLength} characters`
    );
  }

  const maxPasswordLength = authContext.password.config.maxPasswordLength;
  if (args.adminPassword.length > maxPasswordLength) {
    throw new ConvexError(
      `Password must be at most ${maxPasswordLength} characters`
    );
  }

  let createdUser: { id: string } | null = null;
  try {
    createdUser = await authContext.internalAdapter.createUser({
      email: normalizedEmail,
      name: args.adminName,
      emailVerified: false,
    });
  } catch (error) {
    throw new ConvexError(
      `Failed to create auth user: ${formatUnknownErrorMessage(error)}`
    );
  }

  if (!createdUser?.id) {
    throw new ConvexError(
      "Failed to create auth user."
    );
  }

  try {
    const passwordHash = await authContext.password.hash(args.adminPassword);
    await authContext.internalAdapter.linkAccount({
      userId: createdUser.id,
      providerId: "credential",
      accountId: createdUser.id,
      password: passwordHash,
    });
  } catch (error) {
    await authContext.internalAdapter.deleteUser(createdUser.id);
    throw new ConvexError(
      `Failed to link auth credentials: ${formatUnknownErrorMessage(error)}`
    );
  }

  return createdUser.id;
}

export async function provisionSchoolPortalAuthUser(
  ctx: ActionCtx,
  args: {
    appUserId: string;
    currentAuthId: string;
    email: string;
    name: string;
    temporaryPassword: string;
  }
) {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const normalizedEmail = args.email.trim().toLowerCase();

  const minPasswordLength = authContext.password.config.minPasswordLength;
  if (args.temporaryPassword.length < minPasswordLength) {
    throw new ConvexError(
      `Password must be at least ${minPasswordLength} characters`
    );
  }

  const maxPasswordLength = authContext.password.config.maxPasswordLength;
  if (args.temporaryPassword.length > maxPasswordLength) {
    throw new ConvexError(
      `Password must be at most ${maxPasswordLength} characters`
    );
  }

  const passwordHash = await authContext.password.hash(args.temporaryPassword);

  const existingAuth = (await authContext.internalAdapter.findUserByEmail(
    normalizedEmail,
    { includeAccounts: true }
  )) as ExistingAuthLookup | null;

  let authUserId = existingAuth?.user?.id ?? null;
  if (authUserId && authUserId !== args.currentAuthId) {
    const authIdUsage = await ctx.runQuery(
      internal.functions.platform.index.inspectProvisioningAuthIdInternal,
      {
        authId: authUserId,
      }
    );

    if (
      (authIdUsage.schoolUserId && String(authIdUsage.schoolUserId) !== args.appUserId) ||
      authIdUsage.platformAdminId
    ) {
      throw new ConvexError(
        "This email is already attached to another login account in the system."
      );
    }
  }

  if (!authUserId) {
    const createdUser = await authContext.internalAdapter.createUser({
      email: normalizedEmail,
      name: args.name,
      emailVerified: false,
    });

    if (!createdUser?.id) {
      throw new ConvexError("Failed to create portal auth user.");
    }

    authUserId = createdUser.id;

    try {
      await authContext.internalAdapter.linkAccount({
        userId: createdUser.id,
        providerId: "credential",
        accountId: createdUser.id,
        password: passwordHash,
      });
    } catch (error) {
      await authContext.internalAdapter.deleteUser(createdUser.id);
      throw new ConvexError(
        `Failed to link portal credentials: ${formatUnknownErrorMessage(error)}`
      );
    }
  } else {
    await authContext.internalAdapter.updateUser(authUserId, {
      email: normalizedEmail,
      name: args.name,
    });

    if (existingAuth?.accounts?.length) {
      await authContext.internalAdapter.updatePassword(authUserId, passwordHash);
    } else {
      await authContext.internalAdapter.linkAccount({
        userId: authUserId,
        providerId: "credential",
        accountId: authUserId,
        password: passwordHash,
      });
    }
  }

  await authContext.internalAdapter.deleteSessions(authUserId);
  return authUserId;
}
