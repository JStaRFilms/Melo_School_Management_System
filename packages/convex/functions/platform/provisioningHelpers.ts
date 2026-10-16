import { ConvexError } from "convex/values";
import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { createAuth } from "../../betterAuth";

type ExistingAuthLookup = {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  accounts?: Array<{
    id: string;
    providerId?: string;
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

export async function cleanupProvisionedSchoolAdminAuthUser(
  ctx: ActionCtx,
  args: { authId: string; adminEmail: string },
): Promise<"already_absent" | "cleaned" | "email_conflict"> {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const normalizedEmail = args.adminEmail.trim().toLowerCase();
  const existingAuth = (await authContext.internalAdapter.findUserByEmail(
    normalizedEmail,
    { includeAccounts: true },
  )) as ExistingAuthLookup | null;

  if (!existingAuth?.user?.id) return "already_absent";
  if (existingAuth.user.id !== args.authId) return "email_conflict";

  await cleanupOrphanedBetterAuthUser(ctx, existingAuth);
  const remaining = await authContext.internalAdapter.findUserByEmail(normalizedEmail);
  return remaining?.user?.id ? "email_conflict" : "cleaned";
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
      { email: normalizedEmail, authId: existingAuth.user.id }
    );

    if (
      existingEmailUsage.schoolUserExists ||
      existingEmailUsage.platformAdminExists ||
      existingEmailUsage.canonicalPersonExists
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

export async function prepareSchoolPortalPassword(ctx: ActionCtx, password: string) {
  const authContext = await createAuth(ctx).$context;
  const policy = authContext.password.config;
  if (password.length < policy.minPasswordLength) {
    throw new ConvexError(`Password must be at least ${policy.minPasswordLength} characters`);
  }
  if (password.length > policy.maxPasswordLength) {
    throw new ConvexError(`Password must be at most ${policy.maxPasswordLength} characters`);
  }
  return { authContext, passwordHash: await authContext.password.hash(password) };
}

export async function provisionSchoolPortalAuthUser(
  ctx: ActionCtx,
  args: {
    appUserId: string;
    currentAuthId: string;
    email: string;
    name: string;
    preparedPassword: Awaited<ReturnType<typeof prepareSchoolPortalPassword>>;
    portalOperation?: { userId: Id<"users">; schoolId: Id<"schools">; operationId: string };
  }
) {
  const { authContext, passwordHash } = args.preparedPassword;
  const normalizedEmail = args.email.trim().toLowerCase();

  const existingAuth = (await authContext.internalAdapter.findUserByEmail(
    normalizedEmail,
    { includeAccounts: true }
  )) as ExistingAuthLookup | null;

  let authUserId = existingAuth?.user?.id ?? null;
  if (authUserId) {
    if (authUserId !== args.currentAuthId) throw new ConvexError("This login exists but is not linked to this identity. Reconciliation is required.");
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

    if (args.portalOperation) {
      await ctx.runMutation(internal.functions.academic.studentEnrollment.recordPortalAuthInternal, {
        ...args.portalOperation, authId: authUserId,
      });
    }
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

    if (existingAuth?.accounts?.some(account => account.providerId === "credential")) {
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
