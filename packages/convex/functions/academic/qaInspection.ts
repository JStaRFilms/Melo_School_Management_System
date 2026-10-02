"use node";

import { createHash } from 'node:crypto';
import { action } from '../../_generated/server';
import { makeFunctionReference } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { createAuth, getTrustedOrigins } from '../../betterAuth';

const CLOUD = 'https://content-poodle-172.eu-west-1.convex.cloud';
const counts = v.object({ students: v.number(), classes: v.number(), studentInvoices: v.number(), assessmentRecords: v.number() });
const args = { operatorToken: v.string(), targetIdentity: v.string() };

// Separate from destructive reset inspection. This endpoint never seeds,
// repairs, resets, or returns an inventory suitable for deleting anything.
export const inspectQaEnvironment = action({
  args,
  returns: v.object({
    cloudUrl: v.string(), schoolName: v.string(), qaReady: v.boolean(), originsTrusted: v.boolean(),
    baselineStudents: v.number(), baselineClasses: v.number(), baselineDigest: v.string(),
    activeSession: v.union(v.null(), v.string()), activeTerm: v.union(v.null(), v.string()),
    counts, retainedQaClaims: v.number(),
  }),
  handler: async (ctx, supplied) => {
    if (process.env.CONVEX_CLOUD_URL !== CLOUD || process.env.DEMO_SEED_DEPLOYMENT_ENV !== 'development' ||
        !process.env.DEMO_SEED_OPERATOR_TOKEN?.trim() || !process.env.DEMO_SEED_DEPLOYMENT_IDENTITY?.trim() ||
        supplied.operatorToken !== process.env.DEMO_SEED_OPERATOR_TOKEN.trim() || supplied.targetIdentity !== process.env.DEMO_SEED_DEPLOYMENT_IDENTITY.trim()) {
      throw new ConvexError('Exact isolated QA operator gate failed');
    }
    const ref = makeFunctionReference<'query', Record<string, never>, {
      schoolName: string; actors: Array<{ email: string; authId: string }>;
      counts: { students: number; classes: number; studentInvoices: number; assessmentRecords: number };
      baselineStudents: number; baselineClasses: number; activeSession: string | null; activeTerm: string | null;
      baselineJson: string; retainedQaClaims: number;
    }>('functions/academic/qaInspectionData:inspectQaFixtureInternal');
    const fixture = await ctx.runQuery(ref, {});
    const auth = await createAuth(ctx).$context;
    for (const account of fixture.actors) {
      const existing = await auth.internalAdapter.findUserByEmail(account.email, { includeAccounts: true });
      if (!existing || existing.user.id !== account.authId || existing.accounts?.length !== 1 || existing.accounts[0].providerId !== 'credential' || existing.accounts[0].accountId !== account.authId) throw new ConvexError('QA credential ownership is not verified');
    }
    const origins = getTrustedOrigins();
    const originsTrusted = [3101, 3102, 3103].every(port => origins.includes(`http://localhost:${port}`));
    return {
      cloudUrl: CLOUD, schoolName: fixture.schoolName, qaReady: originsTrusted, originsTrusted,
      baselineStudents: fixture.baselineStudents, baselineClasses: fixture.baselineClasses,
      baselineDigest: createHash('sha256').update(fixture.baselineJson).digest('hex'),
      activeSession: fixture.activeSession, activeTerm: fixture.activeTerm, counts: fixture.counts, retainedQaClaims: fixture.retainedQaClaims,
    };
  },
});
