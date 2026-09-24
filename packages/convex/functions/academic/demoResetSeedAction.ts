"use node";

import { action, type ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { makeFunctionReference, type RegisteredAction } from "convex/server";
import { DEMO_ACCOUNTS, DEMO_SCHOOL_SLUG } from "./demoData";
import { assertReviewedCredential } from "./seedRunnerSecurity";

const inputsRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations"> }, null | {
  authIssuer: string; authIds: string[]; retainedStorageIds: Id<"_storage">[];
  newRunId?: Id<"demoSeedRuns">; newSchoolId?: Id<"schools">;
  status: "ready_to_seed" | "seeding" | "complete";
}>("functions/academic/demoResetInventory:readDemoResetSeedInputsInternal");
const progressRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations">; runId: Id<"demoSeedRuns"> }, {
  status: "running" | "failed" | "succeeded";
  phase: "foundation" | "students" | "assessments" | "billing" | "knowledge" | "complete";
}>("functions/academic/demoResetInventory:readDemoResetSeedPhaseInternal");
const completeRef = makeFunctionReference<"mutation", { operationId: Id<"demoResetOperations">; runId: Id<"demoSeedRuns">; schoolId: Id<"schools"> }, {
  operationId: Id<"demoResetOperations">; runId: Id<"demoSeedRuns">; schoolId: Id<"schools">;
  status: "complete"; studentCount: number; classCount: number; invoiceCount: number; assessmentRecordCount: number;
}>("functions/academic/demoResetInventory:completeDemoResetSeedInternal");
const reviewedRef = makeFunctionReference<"query", { operationId: Id<"demoResetOperations"> }, null | {
  schoolId: Id<"schools">; schoolSlug: string; cloudUrl: string; targetIdentity: string;
  inventoryHash: string; confirmationPhrase: string; status: string;
}>("functions/academic/demoResetInventory:readReviewedDemoResetInternal");

type FinishArgs = {
  operatorToken: string; targetIdentity: string; deploymentEnvironment: "development";
  schoolId: Id<"schools">; schoolSlug: string; operationId: Id<"demoResetOperations">;
  inventoryHash: string; confirmationPhrase: string;
};
type FinishResult = {
  operationId: Id<"demoResetOperations">; runId: Id<"demoSeedRuns">; schoolId: Id<"schools">;
  status: "complete"; studentCount: number; classCount: number; invoiceCount: number; assessmentRecordCount: number;
};

// The optional verifier is for offline tests only. Production checks the
// reviewed Better Auth credential link without changing passwords or sessions.
export async function finishReviewedDemoReset(
  ctx: ActionCtx, args: FinishArgs, verifyAuth: typeof assertReviewedCredential = assertReviewedCredential,
): Promise<FinishResult> {
  const cloud = process.env.CONVEX_CLOUD_URL;
  if (!process.env.DEMO_SEED_OPERATOR_TOKEN?.trim() || args.operatorToken !== process.env.DEMO_SEED_OPERATOR_TOKEN.trim() ||
      !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim() || args.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY.trim() ||
      process.env.DEMO_SEED_DEPLOYMENT_ENV !== "development" || args.deploymentEnvironment !== "development" ||
      !cloud || !process.env.DEMO_SEED_EXPECTED_CLOUD_URL || cloud !== process.env.DEMO_SEED_EXPECTED_CLOUD_URL ||
      args.schoolSlug !== DEMO_SCHOOL_SLUG) throw new ConvexError("Demo reset operator or development target gate failed");

  const op = await ctx.runQuery(reviewedRef, { operationId: args.operationId });
  if (!op || !["ready_to_seed", "seeding", "complete"].includes(op.status) ||
      op.schoolId !== args.schoolId || op.schoolSlug !== args.schoolSlug || op.cloudUrl !== cloud ||
      op.targetIdentity !== args.targetIdentity || !/^[a-f0-9]{64}$/.test(op.inventoryHash) ||
      op.inventoryHash !== args.inventoryHash || op.confirmationPhrase !== args.confirmationPhrase ||
      !op.confirmationPhrase.startsWith(`RESET demo-school ${args.schoolId} ${args.inventoryHash} `) ||
      !/^RESET demo-school .+ [a-f0-9]{64} [a-f0-9]{32}$/.test(op.confirmationPhrase)) {
    throw new ConvexError("Reviewed reset target or confirmation changed");
  }
  const inputs = await ctx.runQuery(inputsRef, { operationId: args.operationId });
  if (!inputs || inputs.status !== op.status || inputs.authIds.length !== 3 || new Set(inputs.authIds).size !== 3 ||
      inputs.retainedStorageIds.length !== 37 || new Set(inputs.retainedStorageIds).size !== 37 ||
      (inputs.status === "ready_to_seed" ? !!inputs.newRunId || !!inputs.newSchoolId : !inputs.newRunId || !inputs.newSchoolId)) {
    throw new ConvexError("Reviewed reset seed inputs changed");
  }
  // Check every link before START, including seeding and complete replays.
  for (const [index, account] of Object.values(DEMO_ACCOUNTS).entries()) {
    await verifyAuth(ctx, account, inputs.authIds[index]);
  }
  const runId: Id<"demoSeedRuns"> = await ctx.runMutation(internal.functions.academic.seed.startDemoSeedRunInternal, {
    resetOperationId: args.operationId, authIssuer: inputs.authIssuer,
    adminAuthId: inputs.authIds[0], teacherAuthId: inputs.authIds[1], portalAuthId: inputs.authIds[2],
    logoStorageId: inputs.retainedStorageIds[0], portraitStorageIds: inputs.retainedStorageIds.slice(1),
  });
  if (inputs.newRunId && inputs.newRunId !== runId) throw new ConvexError("Reset replay run changed");
  const bound = await ctx.runQuery(inputsRef, { operationId: args.operationId });
  if (!bound || !bound.newSchoolId || bound.newRunId !== runId || !["seeding", "complete"].includes(bound.status))
    throw new ConvexError("Reset seed binding changed");
  // Each population mutation atomically commits its rows and next cursor/phase.
  // A thrown mutation rolls back its batch; the next call reads the persisted phase.
  for (let step = 0; step < 20; step++) {
    const progress = await ctx.runQuery(progressRef, { operationId: args.operationId, runId });
    if (progress.status === "succeeded" && progress.phase === "complete") break;
    if (progress.status !== "running" || progress.phase === "complete") throw new ConvexError("Reset seed run cannot resume");
    switch (progress.phase) {
      case "foundation":
        await ctx.runMutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId }); break;
      case "students":
        await ctx.runMutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId }); break;
      case "assessments":
        await ctx.runMutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId }); break;
      case "billing":
        await ctx.runMutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId }); break;
      case "knowledge":
        await ctx.runMutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId }); break;
    }
    if (step === 19) throw new ConvexError("Reset seed exceeded population batch limit");
  }
  // Completion is transactional, including the status change and exact cohort counts.
  // It also supports the gap after finalization but before this action returns.
  return ctx.runMutation(completeRef, {
    operationId: args.operationId, runId, schoolId: bound.newSchoolId,
  });
}

export const finishDemoReset: RegisteredAction<"public", FinishArgs, Promise<FinishResult>> = action({
  args: { operatorToken: v.string(), targetIdentity: v.string(), deploymentEnvironment: v.literal("development"),
    schoolId: v.id("schools"), schoolSlug: v.string(), operationId: v.id("demoResetOperations"),
    inventoryHash: v.string(), confirmationPhrase: v.string() },
  returns: v.object({ operationId: v.id("demoResetOperations"), runId: v.id("demoSeedRuns"), schoolId: v.id("schools"),
    status: v.literal("complete"), studentCount: v.number(), classCount: v.number(), invoiceCount: v.number(), assessmentRecordCount: v.number() }),
  handler: finishReviewedDemoReset,
});
