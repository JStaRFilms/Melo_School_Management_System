import { ConvexError } from "convex/values";
import type { ActionCtx } from "../../_generated/server";
import { createAuth } from "../../betterAuth";
import { DEMO_RESET_CONFIRMATION, JUDGE_RESET_CONFIRMATION } from "./demoData";

export type SeedAuthUser = { name: string; email: string; password: string };
export type SeedActionArgs = {
  confirmation: string;
  operatorToken: string;
  targetIdentity: string;
  deploymentEnvironment: "development" | "preview" | "production";
  productionConfirmation?: string;
};

type ExistingAuthLookup = {
  user: { id: string; email: string; name?: string | null };
  accounts?: Array<{ id: string }>;
};

export function assertDemoOperatorGate(args: SeedActionArgs) {
  if (args.confirmation !== DEMO_RESET_CONFIRMATION) throw new ConvexError(`Set confirmation exactly to "${DEMO_RESET_CONFIRMATION}" to reset the demo tenant.`);
  const expectedToken = process.env.DEMO_SEED_OPERATOR_TOKEN?.trim();
  if (!expectedToken || args.operatorToken !== expectedToken) throw new ConvexError("Demo seed operator token is missing or invalid.");
  const expectedIdentity = process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim();
  const expectedEnvironment = process.env.DEMO_SEED_DEPLOYMENT_ENV?.trim();
  if (!expectedIdentity || !expectedEnvironment) throw new ConvexError("Set DEMO_SEED_DEPLOYMENT_IDENTITY and DEMO_SEED_DEPLOYMENT_ENV before a demo reset.");
  if (args.targetIdentity !== expectedIdentity || args.deploymentEnvironment !== expectedEnvironment) throw new ConvexError("Caller target identity/environment does not match the explicitly configured deployment gate.");
  if (args.deploymentEnvironment === "production" && (process.env.DEMO_SEED_ALLOW_PRODUCTION !== "true" || args.productionConfirmation !== "RESET demo-school IN PRODUCTION")) {
    throw new ConvexError("Production reset requires DEMO_SEED_ALLOW_PRODUCTION=true and the dedicated production confirmation phrase.");
  }
}

export function assertJudgeOperatorGate(args: SeedActionArgs) {
  if (args.confirmation !== JUDGE_RESET_CONFIRMATION) throw new ConvexError(`Set confirmation exactly to "${JUDGE_RESET_CONFIRMATION}" to reset the judge tenant.`);
  const expectedToken = process.env.JUDGE_SEED_OPERATOR_TOKEN?.trim();
  if (!expectedToken || args.operatorToken !== expectedToken) throw new ConvexError("Judge seed operator token is missing or invalid.");
  const expectedIdentity = process.env.JUDGE_SEED_DEPLOYMENT_IDENTITY?.trim();
  const expectedEnvironment = process.env.JUDGE_SEED_DEPLOYMENT_ENV?.trim();
  if (!expectedIdentity || !expectedEnvironment) throw new ConvexError("Set JUDGE_SEED_DEPLOYMENT_IDENTITY and JUDGE_SEED_DEPLOYMENT_ENV before a judge reset.");
  if (args.targetIdentity !== expectedIdentity || args.deploymentEnvironment !== expectedEnvironment) throw new ConvexError("Caller target identity/environment does not match the judge deployment gate.");
  if (args.deploymentEnvironment === "production" && (process.env.JUDGE_SEED_ALLOW_PRODUCTION !== "true" || args.productionConfirmation !== "RESET codex-academy IN PRODUCTION")) {
    throw new ConvexError("Production judge reset requires JUDGE_SEED_ALLOW_PRODUCTION=true and the dedicated confirmation phrase.");
  }
}

export async function findExistingAuthId(ctx: ActionCtx, account: SeedAuthUser) {
  const authContext = await createAuth(ctx).$context;
  const existing = (await authContext.internalAdapter.findUserByEmail(account.email.trim().toLowerCase(), { includeAccounts: true })) as ExistingAuthLookup | null;
  return existing?.user?.id ?? null;
}

export async function reconcileAuthUser(ctx: ActionCtx, account: SeedAuthUser) {
  const authContext = await createAuth(ctx).$context;
  const email = account.email.trim().toLowerCase();
  const passwordHash = await authContext.password.hash(account.password);
  const existing = (await authContext.internalAdapter.findUserByEmail(email, { includeAccounts: true })) as ExistingAuthLookup | null;
  if (!existing?.user?.id) {
    const created = await authContext.internalAdapter.createUser({ email, name: account.name, emailVerified: false });
    if (!created?.id) throw new ConvexError(`Failed to create the Better Auth account for ${email}.`);
    try {
      await authContext.internalAdapter.linkAccount({ userId: created.id, providerId: "credential", accountId: created.id, password: passwordHash });
    } catch (error) {
      await authContext.internalAdapter.deleteUser(created.id);
      throw error;
    }
    await authContext.internalAdapter.deleteSessions(created.id);
    return created.id;
  }
  await authContext.internalAdapter.updateUser(existing.user.id, { email, name: account.name });
  if (existing.accounts?.length) await authContext.internalAdapter.updatePassword(existing.user.id, passwordHash);
  else await authContext.internalAdapter.linkAccount({ userId: existing.user.id, providerId: "credential", accountId: existing.user.id, password: passwordHash });
  await authContext.internalAdapter.deleteSessions(existing.user.id);
  return existing.user.id;
}
