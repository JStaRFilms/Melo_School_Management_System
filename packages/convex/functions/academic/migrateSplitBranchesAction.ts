"use node";

import { action } from "../../_generated/server";
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

export const runSplitMigrationAction = action({
  args: {
    password: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    fedrahSchoolId: Id<"schools">;
    rugaSchoolId: Id<"schools">;
    movedClasses: string[];
    movedStudentCount: number;
    fedrahAdminEmail: string;
    rugaAdminEmail: string;
  }> => {
    const adminPassword = args.password ?? "Admin123!Pass";

    // 1. Ensure Better Auth accounts for both branch admins
    const fedrahAuthId: string = await ensureBetterAuthAccount(
      ctx,
      "admin.fedrah@oliveblessed.com",
      "Anposola Oluleke-Oke",
      adminPassword
    );

    const rugaAuthId: string = await ensureBetterAuthAccount(
      ctx,
      "admin.ruga@oliveblessed.com",
      "Anposola Oluleke-Oke",
      adminPassword
    );

    // 2. Execute migration inside mutation
    const result: {
      success: boolean;
      fedrahSchoolId: Id<"schools">;
      rugaSchoolId: Id<"schools">;
      movedClasses: string[];
      movedStudentCount: number;
      fedrahAdminEmail: string;
      rugaAdminEmail: string;
    } = await ctx.runMutation(
      internal.functions.academic.migrateSplitBranches.executeSplitMigrationInternal,
      {
        fedrahAuthId,
        rugaAuthId,
      }
    );

    return result;
  },
});
