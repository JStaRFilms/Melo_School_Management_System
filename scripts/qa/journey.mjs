import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { APPS, ROOT, QA_DIR, TARGET, LOCK_DIR, readJson, writeJson, evidenceStatus, isBackendContractBlocker, ownsSupervisor, processCommand, assertAppTargets } from './core.mjs';

const directory = fs.realpathSync(process.argv[2]);
if (!directory.startsWith(`${path.join(QA_DIR, 'runs')}${path.sep}`)) throw new Error('Browser runs must use this worktree QA folder.');
const request = readJson(path.join(directory, 'request.json'));
const server = readJson(path.join(QA_DIR, 'state.json'));
const backendLease = readJson(path.join(LOCK_DIR, 'backend-content-poodle-172.json'));
if (!['smoke', 'layout', 'feature'].includes(request.mode) || request.deployment !== TARGET.deployment ||
    backendLease.id !== request.id || backendLease.root !== ROOT || server.root !== ROOT ||
    server.status !== 'ready' || !server.apps.includes('admin') || !ownsSupervisor(server, processCommand(server.pid))) {
  throw new Error('Browser run is not owned by the verified QA environment. Use the qa commands, not this script directly.');
}
assertAppTargets(server.apps);
const result = {
  ...request,
  status: 'blocked',
  scope: request.mode === 'feature'
    ? 'Admin inactive instruction-template editor lifecycle. This run does not test activation, teacher resolution, live generation, or provider calls.'
    : request.mode === 'layout' ? 'Admin template gallery, validation, and desktop/mobile draft layout. No template writes are performed.' : 'Unauthenticated Admin protection and authenticated template workspace availability.',
  checks: [], screenshots: [],
};
const planned = request.mode === 'feature' ? [
  'Protected route redirects an unsigned visitor',
  'Admin signs in to Demo Academy',
  'Template workspace loads from the test backend',
  'Starter gallery previews without saving',
  'Desktop editor controls fit the available viewport',
  'Invalid title prevents save',
  'Create a run-marked inactive non-default template',
  'Reload preserves title, guidance, format, and inactive status',
  'Edit then cancel discard keeps the draft; confirmed discard restores it',
  'Edit and save persists after reload',
  'Mobile editor has usable controls and no horizontal page overflow',
  'Browser has no uncaught errors during the checked workflow',
] : request.mode === 'layout' ? [
  'Protected route redirects an unsigned visitor',
  'Admin signs in to Demo Academy',
  'Template workspace loads from the test backend',
  'Starter gallery previews without saving',
  'Desktop editor controls fit the available viewport',
  'Invalid title prevents save',
  'Mobile draft editor has usable controls and no horizontal page overflow',
  'Browser has no uncaught errors during the checked workflow',
] : [
  'Protected route redirects an unsigned visitor',
  'Admin signs in to Demo Academy',
  'Template workspace loads from the test backend',
  'Browser has no uncaught errors during the checked workflow',
];
let browser;
let context;
let page;
let index = 0;
const errors = [];
const consoleErrors = [];
let failed = false;
const origin = `http://localhost:${APPS.admin.port}`;
const title = `QA ${request.id}`;

async function capture(name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: path.join(directory, filename), fullPage: true, mask: [page.locator('input[type="password"]')] });
  result.screenshots.push(filename);
}
async function check(action) {
  const name = planned[index++];
  try { await action(); result.checks.push({ name, status: 'passed' }); }
  catch (error) {
    failed = true;
    const contractBlocker = isBackendContractBlocker(consoleErrors);
    result.checks.push({ name, status: contractBlocker ? 'blocked' : 'failed', note: contractBlocker
      ? 'The deployed backend rejects fields required by the current UI. Backend update needs separate approval; no automatic deployment or reset.'
      : 'The browser assertion failed. Raw diagnostics remain private in this run folder.' });
    // The assertion text may include private URLs or DOM content. Never publish it automatically.
    fs.writeFileSync(path.join(directory, 'failure.txt'), String(error?.stack ?? error), { mode: 0o600 });
    if (page) { try { await capture('failure'); } catch { /* Browser may have exited. */ } }
    throw error;
  }
}
async function selectSaved() {
  await page.getByRole('textbox', { name: 'Search saved templates' }).fill(title);
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
}

try {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await check(async () => {
    await page.goto(`${origin}/academic/knowledge/templates`);
    await page.waitForURL('**/sign-in*');
    await expect(page.locator('#email')).toBeVisible();
  });
  await check(async () => {
    await page.locator('#email').fill('admin@demo-academy.school');
    await page.locator('#password').fill(process.env.QA_ADMIN_PASSWORD ?? 'Admin123!Pass');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await page.waitForURL(url => url.pathname !== '/sign-in', { timeout: 60_000 });
    await page.goto(`${origin}/admin/dashboard`);
    await expect(page.getByText('Demo Academy', { exact: true }).first()).toBeVisible();
  });
  // Authentication input and its network exchange are excluded from videos and traces.
  // Session state stays in memory; it is never written to an evidence file.
  const session = await context.storageState();
  await context.close();
  context = await browser.newContext({ storageState: session, viewport: { width: 1440, height: 1000 }, recordVideo: { dir: path.join(directory, 'private-video') } });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await context.tracing.start({ screenshots: true, snapshots: true });
  await check(async () => {
    await page.goto(`${origin}/academic/knowledge/templates`);
    await expect(page.getByRole('button', { name: 'New Template', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search saved templates' })).toBeVisible();
    await capture('workspace-desktop');
  });
  if (request.mode === 'feature' || request.mode === 'layout') {
    await check(async () => {
      await page.getByRole('button', { name: 'Choose Starter / Template Gallery', exact: true }).click();
      const gallery = page.getByRole('region', { name: 'Template Gallery' });
      await expect(gallery).toBeVisible();
      await gallery.getByRole('button', { name: 'Preview', exact: true }).first().click();
      await expect(gallery.getByRole('button', { name: 'Use Template', exact: true })).toBeVisible();
      await capture('starter-preview');
      await gallery.getByRole('button', { name: 'Use Template', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible();
      // No active or school-default fixture is ever saved by this workflow.
      await page.getByRole('combobox', { name: /^Scope Mode/i }).selectOption('subject_only');
      await expect(page.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: /^Subject/i })).not.toHaveValue('');
    });
    await check(async () => {
      const bounds = await page.getByRole('combobox', { name: /^Scope Mode/i }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1441);
      await capture('editor-desktop');
    });
    await check(async () => {
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill('');
      await expect(page.getByRole('button', { name: 'Commit Changes', exact: true }).first()).toBeDisabled();
      await capture('title-validation');
    });
  }
  if (request.mode === 'layout') {
    await check(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Commit Changes', exact: true })).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
      await capture('draft-mobile');
    });
  }
  if (request.mode === 'feature') {
    await check(async () => {
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title);
      await page.getByRole('textbox', { name: /^Guidance for AI, Previous Knowledge/i }).fill('Use a concrete everyday example appropriate to the class.');
      await page.getByRole('combobox', { name: /^Format, Previous Knowledge/i }).selectOption('bullets');
      await expect(page.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible();
      await expect(page.getByRole('combobox', { name: /^Scope Mode/i })).toHaveValue('subject_only');
      await page.getByRole('button', { name: 'Commit Changes', exact: true }).first().click();
      await expect(page.getByText('Template saved', { exact: true }).first()).toBeVisible();
      result.fixtureTitle = title;
      await capture('saved-desktop');
    });
    await check(async () => {
      await page.reload();
      await selectSaved();
      await expect(page.getByRole('textbox', { name: /^Guidance for AI, Previous Knowledge/i })).toHaveValue('Use a concrete everyday example appropriate to the class.');
      await expect(page.getByRole('combobox', { name: /^Format, Previous Knowledge/i })).toHaveValue('bullets');
      await expect(page.getByRole('button', { name: 'Inactive', exact: true })).toBeVisible();
    });
    await check(async () => {
      await page.getByRole('textbox', { name: 'Title', exact: true }).fill(`${title} unsaved`);
      await page.getByRole('button', { name: 'Discard', exact: true }).click();
      await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(`${title} unsaved`);
      await page.getByRole('button', { name: 'Discard', exact: true }).click();
      await page.getByRole('button', { name: 'Discard and continue', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(title);
      await capture('discard-restored');
    });
    await check(async () => {
      await page.getByRole('textbox', { name: /^Internal Description/i }).fill('Synthetic QA fixture. Inactive; not a school default.');
      await page.getByRole('button', { name: 'Commit Changes', exact: true }).first().click();
      await expect(page.getByText('Template saved', { exact: true }).first()).toBeVisible();
      await page.reload();
      await selectSaved();
      await expect(page.getByRole('textbox', { name: /^Internal Description/i })).toHaveValue('Synthetic QA fixture. Inactive; not a school default.');
    });
    await check(async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await selectSaved();
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeVisible();
      const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflowing).toBe(false);
      await capture('saved-mobile');
    });
  }
  await check(async () => {
    expect(errors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
} catch {
  failed = true;
  if (!result.checks.some(check => check.status === 'failed' || check.status === 'blocked')) {
    result.checks.push({ name: 'Browser startup', status: 'blocked', note: 'Browser or runtime prerequisites were unavailable.' });
  }
} finally {
  for (; index < planned.length; index++) result.checks.push({ name: planned[index], status: 'blocked', note: 'Not exercised because an earlier prerequisite or assertion failed.' });
  fs.writeFileSync(path.join(directory, 'private-browser-errors.json'), JSON.stringify({ errors, consoleErrors }, null, 2), { mode: 0o600 });
  if (context) {
    try { await context.tracing.stop({ path: path.join(directory, 'private-trace.zip') }); } catch { /* Authentication may have failed before tracing. */ }
    await context.close();
  }
  await browser?.close();
  result.status = evidenceStatus(result.checks);
  writeJson(path.join(directory, 'result.json'), result);
  console.log(`QA ${request.mode}: ${result.status}. ${result.checks.filter(check => check.status === 'passed').length}/${planned.length} planned checks passed.`);
  process.exitCode = failed ? 1 : 0;
}
