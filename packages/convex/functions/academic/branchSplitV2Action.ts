"use node";

import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { createAuth } from "../../betterAuth";

async function ensureBetterAuthAccount(
  ctx: ActionCtx,
  email: string,
  name: string,
  password: string
): Promise<string> {
  const auth = createAuth(ctx);
  const authContext = await auth.$context;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await authContext.internalAdapter.findUserByEmail(normalizedEmail, {
    includeAccounts: true,
  });

  const passwordHash = await authContext.password.hash(password);

  if (existing?.user?.id) {
    const userId = existing.user.id;
    await authContext.internalAdapter.updateUser(userId, {
      email: normalizedEmail,
      name,
    });

    if (existing.accounts && existing.accounts.length > 0) {
      await authContext.internalAdapter.updatePassword(userId, passwordHash);
    } else {
      await authContext.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: passwordHash,
      });
    }

    await authContext.internalAdapter.deleteSessions(userId);
    return userId;
  }

  const created = await authContext.internalAdapter.createUser({
    email: normalizedEmail,
    name,
    emailVerified: true,
  });

  if (!created?.id) {
    throw new ConvexError(`Failed to create auth user for ${email}`);
  }

  await authContext.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: passwordHash,
  });

  return created.id;
}

export const reconcileAdminsAndCleanupAction = internalAction({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const authContext = await auth.$context;

    // 1. Preserve/Reconcile johnoke2005@gmail.com as Platform Super Admin in Better Auth
    try {
      const johnAuthId = await ensureBetterAuthAccount(
        ctx,
        "johnoke2005@gmail.com",
        "Supreme Leader Oluleke-Oke John",
        "StrongTempPass123!"
      );
      await ctx.runMutation(internal.functions.academic.branchSplitV2.syncPlatformAdminAuthIdInternal, {
        email: "johnoke2005@gmail.com",
        authId: johnAuthId,
      });
    } catch (e: any) {
      console.warn("Failed to reconcile super admin johnoke in better auth:", e?.message);
    }

    // 2. Provision/reconcile Better Auth accounts
    const fedrahLeadAuthId = await ensureBetterAuthAccount(
      ctx,
      "obhischool@gmail.com",
      "Lead Admin Fedrah",
      args.password
    );

    const fedrahSecondAuthId = await ensureBetterAuthAccount(
      ctx,
      "admin.fedrah@oliveblessed.com",
      "Fedrah Admin",
      args.password
    );

    const rugaLeadAuthId = await ensureBetterAuthAccount(
      ctx,
      "admin.ruga@oliveblessed.com",
      "Ruga Admin",
      args.password
    );

    // 3. Call internal mutation to link Convex users and update admin leadership
    await ctx.runMutation(internal.functions.academic.branchSplitV2.reconcileConvexUsersInternal, {
      fedrahLeadAuthId,
      fedrahSecondAuthId,
      rugaLeadAuthId,
    });

    return {
      success: true,
      fedrahLeadAuthId,
      fedrahSecondAuthId,
      rugaLeadAuthId,
    };
  },
});

export const verifyCompleteSplitAction = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    const authContext = await auth.$context;

    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // 1. Check johnoke2005@gmail.com in Better Auth
    const johnAuth = await authContext.internalAdapter.findUserByEmail("johnoke2005@gmail.com");
    report.checks.johnokeDeletedFromAuth = johnAuth === null || !johnAuth.user;

    // 2. Check each admin in Better Auth
    const adminEmails = [
      { email: "obhischool@gmail.com", role: "fedrah_lead", branch: "obhis-fedrah" },
      { email: "admin.fedrah@oliveblessed.com", role: "fedrah_secondary", branch: "obhis-fedrah" },
      { email: "admin.ruga@oliveblessed.com", role: "ruga_lead", branch: "obhis-ruga" },
    ];

    const authResults: Record<string, any> = {};
    for (const a of adminEmails) {
      const userRes = await authContext.internalAdapter.findUserByEmail(a.email, {
        includeAccounts: true,
      });
      authResults[a.email] = {
        existsInAuth: Boolean(userRes?.user?.id),
        authId: userRes?.user?.id,
        hasCredentialAccount: Boolean(
          userRes?.accounts && userRes.accounts.some((acc: any) => acc.providerId === "credential")
        ),
      };
    }
    report.checks.adminAuthAccounts = authResults;

    // 3. Run database integrity check via internal query
    const dbIntegrity = await ctx.runQuery(
      internal.functions.academic.branchSplitV2.runSplitIntegrityCheck,
      {}
    );
    report.checks.dbIntegrity = dbIntegrity;

    return report;
  },
});

export const restoreSuperAdminAction = action({
  args: {
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const authContext = await auth.$context;
    const email = "johnoke2005@gmail.com";
    const name = "Supreme Leader Oluleke-Oke John";

    const authId = await ensureBetterAuthAccount(ctx, email, name, args.password);

    // Ensure platformAdmins points to this authId
    await ctx.runMutation(internal.functions.academic.branchSplitV2.syncPlatformAdminAuthIdInternal, {
      email,
      authId,
    });

    return {
      success: true,
      email,
      authId,
    };
  },
});

