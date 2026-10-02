/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { makeFunctionReference } from 'convex/server';
import { internal } from './_generated/api';
import schema from './schema';
import './functions/auth';
import { DEMO_STUDENTS } from './functions/academic/demoData';

vi.mock('./betterAuth', async original => ({
  ...await original<typeof import('./betterAuth')>(),
  createAuth: () => ({ $context: Promise.resolve({ internalAdapter: {
    findUserByEmail: async (email: string) => {
      const index = ['admin@demo-academy.school', 'teacher@demo-academy.school', 'parent@demo-academy.school'].indexOf(email);
      const id = ['qa-admin', 'qa-teacher', 'qa-parent'][index];
      return index < 0 ? null : { user: { id }, accounts: [{ providerId: 'credential', accountId: id }] };
    },
  } }) }),
}));
afterEach(() => vi.unstubAllEnvs());
const modules = import.meta.glob('./**/*.ts');
const inspect = makeFunctionReference<'action'>('functions/academic/qaInspection:inspectQaEnvironment');
const args = { operatorToken: 'qa-test-token', targetIdentity: 'qa-test-target' };

async function fixture() {
  vi.stubEnv('CONVEX_CLOUD_URL', 'https://content-poodle-172.eu-west-1.convex.cloud');
  vi.stubEnv('DEMO_SEED_DEPLOYMENT_ENV', 'development');
  vi.stubEnv('DEMO_SEED_OPERATOR_TOKEN', args.operatorToken);
  vi.stubEnv('DEMO_SEED_DEPLOYMENT_IDENTITY', args.targetIdentity);
  vi.stubEnv('TRUSTED_ORIGINS', 'http://localhost:3101,http://localhost:3102,http://localhost:3103');
  const t = convexTest(schema, modules);
  const assets = await t.run(async ctx => ({ logoStorageId: await ctx.storage.store(new Blob(['logo'])), portraitStorageIds: await Promise.all(DEMO_STUDENTS.map(() => ctx.storage.store(new Blob(['portrait'])))) }));
  const runId = await t.mutation(internal.functions.academic.seed.startDemoSeedRunInternal, { seedProfile: 'demo', authIssuer: 'https://qa-auth.test', adminAuthId: 'qa-admin', teacherAuthId: 'qa-teacher', portalAuthId: 'qa-parent', ...assets });
  await t.mutation(internal.functions.academic.seed.populateDemoFoundationInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoStudentsBatchInternal, { runId });
  for (let i = 0; i < 6; i++) await t.mutation(internal.functions.academic.seed.populateDemoAssessmentsBatchInternal, { runId });
  for (let i = 0; i < 3; i++) await t.mutation(internal.functions.academic.seed.populateDemoBillingBatchInternal, { runId });
  const result = await t.mutation(internal.functions.academic.seed.populateDemoKnowledgeAndFinalizeInternal, { runId });
  return { t, schoolId: result.schoolId };
}

test('QA inspection attests original cohort without returning reset authority or private actor data', async () => {
  const { t } = await fixture();
  const before = await t.action(inspect, args);
  const after = await t.action(inspect, args);
  expect(before.qaReady).toBe(true);
  expect(before.counts).toMatchObject({ students: 36, classes: 3, assessmentRecords: 756 });
  expect(before.baselineDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(before.baselineDigest).toBe(after.baselineDigest);
  for (const field of ['ready', 'tables', 'actors', 'authIds', 'baselineJson']) expect(before).not.toHaveProperty(field);
});
test('legitimate marked student/admission claim is accepted for QA but still blocked for reset', async () => {
  const { t, schoolId } = await fixture();
  const before = await t.action(inspect, args);
  await t.run(async ctx => {
    const classId = await ctx.db.insert('classes', { schoolId, name: 'QA-RC-UNIT', level: 'Junior Secondary', createdAt: 1, updatedAt: 1 });
    const number = 'QA-RC-UNIT';
    const userId = await ctx.db.insert('users', { schoolId, authId: `student:${schoolId}:${number.toLowerCase()}`, name: 'QA Report Unit', email: 'qa@students.local', role: 'student', createdAt: 1, updatedAt: 1 });
    await ctx.db.insert('students', { schoolId, classId, userId, admissionNumber: number, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert('admissionNumberClaims', { schoolId, number, createdAt: 1 });
  });
  const after = await t.action(inspect, args);
  expect(after.qaReady).toBe(true);
  expect(after.baselineDigest).toBe(before.baselineDigest);
  expect(after.counts.students).toBe(37);
  expect(after.retainedQaClaims).toBe(1);
  const reset = await t.query(makeFunctionReference<'query'>('functions/academic/demoPreflight:inspectDemoLinksInternal'), {});
  expect(reset.blockers.some((message: string) => message.includes('admissionNumberClaims'))).toBe(true);
});
test('legacy label normalization preserves semantic class identity and baseline digest', async () => {
  const { t, schoolId } = await fixture();
  const before = await t.action(inspect, args);
  await t.run(async ctx => {
    const classes = await ctx.db.query('classes').withIndex('by_school', q => q.eq('schoolId', schoolId)).collect();
    for (const klass of classes) await ctx.db.patch(klass._id, { name: `${klass.gradeName} - ${klass.classLabel}`, level: 'Secondary', updatedAt: 9 });
  });
  expect((await t.action(inspect, args)).baselineDigest).toBe(before.baselineDigest);
  await t.run(async ctx => {
    const klass = await ctx.db.query('classes').withIndex('by_school', q => q.eq('schoolId', schoolId)).first();
    await ctx.db.patch(klass!._id, { classLabel: 'Changed section' });
  });
  await expect(t.action(inspect, args)).rejects.toThrow(/Original QA class/);
});
test('unrelated display-name edits cannot hide behind semantic digest canonicalization', async () => {
  const { t, schoolId } = await fixture();
  await t.run(async ctx => {
    const klass = await ctx.db.query('classes').withIndex('by_school', q => q.eq('schoolId', schoolId)).first();
    await ctx.db.patch(klass!._id, { name: 'Unrelated class display name' });
  });
  await expect(t.action(inspect, args)).rejects.toThrow(/Original QA class/);
});
test('multiple active periods are rejected instead of picking the first', async () => {
  const { t, schoolId } = await fixture();
  await t.run(ctx => ctx.db.insert('academicSessions', { schoolId, name: 'QA-RC-ACTIVE', startDate: 1, endDate: 2, isActive: true, createdAt: 1, updatedAt: 1 }));
  await expect(t.action(inspect, args)).rejects.toThrow(/active period is ambiguous/);
});
test('normal development and production are rejected even with the operator values', async () => {
  const { t } = await fixture();
  for (const url of ['https://scrupulous-chinchilla-25.eu-west-1.convex.cloud', 'https://production.convex.cloud']) {
    vi.stubEnv('CONVEX_CLOUD_URL', url);
    await expect(t.action(inspect, args)).rejects.toThrow(/Exact isolated QA operator gate/);
  }
});
test('unmarked additional classes cannot become QA-ready', async () => {
  const { t, schoolId } = await fixture();
  await t.run(ctx => ctx.db.insert('classes', { schoolId, name: 'Unreviewed imported class', level: 'Junior Secondary', createdAt: 1, updatedAt: 1 }));
  await expect(t.action(inspect, args)).rejects.toThrow(/run-tagged QA fixture/);
});
