"use node";

import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { ConvexError, v } from "convex/values";
import type { ActionCtx } from "../../_generated/server";
import { createAuth } from "../../betterAuth";

type BetterAuthLookup = {
  user?: {
    id: string;
  } | null;
  accounts?: Array<{
    id: string;
    providerId?: string;
  }>;
} | null;

function isMissingStorageObjectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("not found") || message.includes("does not exist");
}

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
      emailVerified: true,
    });

    const credentialAccount = existing.accounts?.find(
      (account) => account.providerId === "credential"
    );
    if (credentialAccount) {
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
    const johnAuthId = await ensureBetterAuthAccount(
      ctx,
      "johnoke2005@gmail.com",
      "Supreme Leader Oluleke-Oke John",
      "StrongTempPass123!"
    );
    const johnAuth = (await authContext.internalAdapter.findUserByEmail(
      "johnoke2005@gmail.com",
      { includeAccounts: true }
    )) as BetterAuthLookup;
    if (
      johnAuth?.user?.id !== johnAuthId ||
      !johnAuth.accounts?.some((account) => account.providerId === "credential")
    ) {
      throw new ConvexError(
        "Super admin Better Auth reconciliation did not produce a credential account"
      );
    }
    await ctx.runMutation(internal.functions.academic.branchSplitV2.syncPlatformAdminAuthIdInternal, {
      email: "johnoke2005@gmail.com",
      authId: johnAuthId,
    });

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

export const purgeOtherSchoolsAndLegacyBillingAction = internalAction({
  args: {},
  returns: v.object({
    deletedSchools: v.number(),
    deletedRows: v.number(),
    deletedStorageFiles: v.number(),
    deletedAuthUsers: v.number(),
    deletedOrphanGuardians: v.number(),
    batches: v.number(),
  }),
  handler: async (ctx) => {
    const authCandidates = await ctx.runQuery(
      internal.functions.academic.branchSplitV2.getNonRetainedAuthUsersInternal,
      {}
    );
    const retainedStorageIds = new Set(
      (await ctx.runQuery(
        internal.functions.academic.branchSplitV2.getRetainedStorageIdsInternal,
        {}
      )).map((storageId) => String(storageId))
    );

    const deletedStorageIds = new Set<string>();
    let deletedSchools = 0;
    let deletedRows = 0;
    let deletedStorageFiles = 0;
    let batches = 0;

    while (true) {
      const result = await ctx.runMutation(
        internal.functions.academic.branchSplitV2.purgeOtherSchoolsAndLegacyBilling,
        {}
      );
      batches++;
      deletedRows += result.deletedCount;
      if (result.deletedSchool) deletedSchools++;

      for (const storageId of result.storageIds) {
        const storageKey = String(storageId);
        if (retainedStorageIds.has(storageKey) || deletedStorageIds.has(storageKey)) {
          continue;
        }

        try {
          await ctx.storage.delete(storageId);
          deletedStorageFiles++;
        } catch (error) {
          if (!isMissingStorageObjectError(error)) throw error;
        }
        deletedStorageIds.add(storageKey);
      }

      if (result.done) break;
      if (batches > 10000) {
        throw new ConvexError("School and billing purge exceeded the safety batch limit");
      }
    }

    const orphanGuardianIds = await ctx.runQuery(
      internal.functions.academic.branchSplitV2.getOrphanAdmissionsGuardianIdsInternal,
      {}
    );
    let deletedOrphanGuardians = 0;
    for (let index = 0; index < orphanGuardianIds.length; index += 50) {
      deletedOrphanGuardians += await ctx.runMutation(
        internal.functions.academic.branchSplitV2.deleteAdmissionsGuardiansBatch,
        { guardianIds: orphanGuardianIds.slice(index, index + 50) }
      );
    }

    const auth = createAuth(ctx);
    const authContext = await auth.$context;
    let deletedAuthUsers = 0;
    for (const candidate of authCandidates) {
      const retained = await ctx.runQuery(
        internal.functions.academic.branchSplitV2.isAuthIdRetainedInternal,
        { authId: candidate.authId }
      );
      if (retained) continue;

      const existing = (await authContext.internalAdapter.findUserByEmail(
        candidate.email.trim().toLowerCase(),
        { includeAccounts: true }
      )) as BetterAuthLookup;
      if (existing?.user?.id !== candidate.authId) continue;

      await authContext.internalAdapter.deleteSessions(candidate.authId);
      for (const account of existing.accounts ?? []) {
        await authContext.internalAdapter.deleteAccount(account.id);
      }
      await authContext.internalAdapter.deleteUser(candidate.authId);
      deletedAuthUsers++;
    }

    return {
      deletedSchools,
      deletedRows,
      deletedStorageFiles,
      deletedAuthUsers,
      deletedOrphanGuardians,
      batches,
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
    const johnAuth = (await authContext.internalAdapter.findUserByEmail(
      "johnoke2005@gmail.com",
      { includeAccounts: true }
    )) as BetterAuthLookup;
    report.checks.johnokePreservedInAuth = Boolean(johnAuth?.user?.id);
    report.checks.johnokeHasCredentialAccount = Boolean(
      johnAuth?.accounts?.some((account) => account.providerId === "credential")
    );

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
