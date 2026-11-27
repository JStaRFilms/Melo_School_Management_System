import fs from 'node:fs';
import path from 'node:path';
import { phases as lifecycle, makeActive, fillTaggedAdmission } from './school-workflow.mjs';

export const scope = 'Fresh isolated QA pupils exercise profile archive-only, combined archive/exclusion with and without subjects, cancellation, reason validation, mobile dialog, later-term policy, restore before/after policy freeze, and the existing cross-role issued-report lifecycle. No live-school or provider writes.';
export const effects = 'synthetic-writes';
const phase = id => lifecycle.find(item => item.id === id);
const save = shared => fs.writeFileSync(path.join(shared.directory, 'fixture.json'), JSON.stringify(shared.fixture, null, 2), { mode: 0o600 });
const profileUrl = (f, pupil) => '/academic/students?' + new URLSearchParams({ studentId: pupil.id, classId: f.classId, sessionId: f.sessionId, tab: 'profile' });
const releaseUrl = f => '/assessments/report-cards/release?' + new URLSearchParams({ classId: f.classId, sessionId: f.sessionId, termId: f.termId });
const rosterRow = (page, pupil) => page.getByRole('region', { name: 'Class release readiness' }).getByRole('listitem').filter({ has: page.getByText(pupil.admission, { exact: true }) });
function observeCreated(page, udf, receive) {
  const listener = socket => {
    const requests = new Set();
    socket.on('framesent', event => { try { const packet = JSON.parse(String(event.payload)); if (packet.type === 'Mutation' && packet.udfPath === udf) requests.add(packet.requestId); } catch { /* Not a Convex JSON frame. */ } });
    socket.on('framereceived', event => { try { const packet = JSON.parse(String(event.payload)); if (packet.type === 'MutationResponse' && requests.has(packet.requestId) && packet.success && typeof packet.result === 'string') receive(packet.result); } catch { /* Not a Convex JSON frame. */ } });
  };
  page.on('websocket', listener);
  return () => page.off('websocket', listener);
}
async function enroll(actor, mode) {
  const { page, expect, shared } = actor;
  const f = shared.fixture;
  const pupil = { mode, admission: `${f.tag}-${mode.toUpperCase()}`, name: `Qa Archive ${mode} ${f.tag.slice(-8).toLowerCase()}`.replace(/\b\w/g, c => c.toUpperCase()) };
  f.archivePupils ??= [];
  f.archivePupils.push(pupil);
  save(shared);
  const stop = observeCreated(page, 'functions/academic/studentEnrollment:createStudent', id => { pupil.id = id; save(shared); });
  try {
    await page.goto('/academic/students/onboarding');
    await fillTaggedAdmission(page, { ...f, studentName: pupil.name, admission: pupil.admission });
    await expect.poll(() => pupil.id).toBeTruthy();
  } finally { stop(); }
  return pupil;
}
async function openArchive(actor, pupil) {
  const { page, expect, shared } = actor;
  await page.goto(profileUrl(shared.fixture, pupil));
  await page.getByRole('button', { name: 'Archive Record', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(pupil.admission);
  return dialog;
}
async function restore(actor, pupil) {
  const { page, expect } = actor;
  await page.goto('/academic/archived-records');
  await page.getByPlaceholder('Name, code, or context...').filter({ visible: true }).fill(pupil.admission);
  await page.getByRole('button').filter({ has: page.getByText(pupil.name, { exact: true }) }).click();
  await page.getByRole('button', { name: 'Restore Record', exact: true }).click();
  await expect(page.getByText(/restored successfully/).first()).toBeVisible();
}
async function publish(actor, count) {
  const { page, expect, shared, capture } = actor;
  const f = shared.fixture;
  await page.goto(releaseUrl(f));
  const panel = page.getByRole('region', { name: 'Class release readiness' });
  await expect(panel.getByRole('heading', { name: 'Ready to release', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Review release', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`1 eligible, 1 certified, ${count} excluded`);
  await expect(dialog.getByRole('button', { name: 'Release class results', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Release class results', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Released to families', exact: true })).toBeVisible();
  f.releaseStamp = await panel.getByText(/^Original release:/).textContent();
  f.released = true;
  save(shared);
  await page.reload();
  await expect(panel).toContainText(f.releaseStamp);
  await capture('released-roster');
}
const archive = { id: 'archive', role: 'admin', dependsOn: ['certified-withheld'], steps: [
  { name: 'create three marked pupils and an inactive later term through UI', run: async actor => {
    const { page, expect, shared, capture } = actor;
    const f = shared.fixture;
    for (const mode of ['only', 'without', 'with']) await enroll(actor, mode);
    const withSubjects = f.archivePupils[2];
    await page.goto('/academic/students?' + new URLSearchParams({ classId: f.classId, sessionId: f.sessionId }));
    await page.getByRole('button', { name: `Add Mathematics for ${withSubjects.name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Remove Mathematics for ${withSubjects.name}`, exact: true })).toBeVisible();
    f.futureTermName = `${f.termName} Future`;
    const stop = observeCreated(page, 'functions/academic/academicSetup:createTerm', id => { f.futureTermId = id; save(shared); });
    try {
      await page.goto('/academic/sessions');
      const card = page.getByRole('region', { name: `Academic session ${f.sessionName}`, exact: true });
      await expect(card).not.toContainText('Loading terms...');
      if (await card.getByRole('button', { name: 'Expand session', exact: true }).count()) await card.getByRole('button', { name: 'Expand session', exact: true }).click();
      await card.getByRole('button', { name: 'Add Term', exact: true }).click();
      await page.getByPlaceholder('e.g., First Term').fill(f.futureTermName);
      for (const [name, days] of [['Term Start Date', 1], ['Term End Date', 60]]) await page.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).locator('..').locator('input[type=date]').fill(new Date(Date.now() + days * 86400000).toISOString().slice(0, 10));
      await page.getByRole('checkbox', { name: 'Set as the active term immediately', exact: true }).uncheck();
      await page.getByPlaceholder('e.g., First Term').fill(f.futureTermName);
      await expect(page.getByPlaceholder('e.g., First Term')).toHaveValue(f.futureTermName);
      await page.locator('form').filter({ has: page.getByPlaceholder('e.g., First Term') }).getByRole('button', { name: 'Add Term', exact: true }).click();
      await expect.poll(() => f.futureTermId).toBeTruthy();
    } finally { stop(); }
    save(shared);
    await capture('archive-fixtures');
  } },
  { name: 'cancel and Escape preserve pupil; mobile dialog defaults to archive only', run: async actor => {
    const { page, expect, capture, shared } = actor;
    const pupil = shared.fixture.archivePupils[0];
    await page.setViewportSize({ width: 390, height: 844 });
    let dialog = await openArchive(actor, pupil);
    await expect(dialog.getByRole('radio', { name: 'Archive only', exact: true })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: /Archive and exclude/ })).toBeEnabled();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await capture('archive-mobile-dialog');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive Record', exact: true })).toBeFocused();
    dialog = await openArchive(actor, pupil);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Archive Record', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
  } },
  { name: 'archive-only leaves the current-term release blocked until a separate reasoned exclusion', run: async actor => {
    const { page, expect, capture, shared } = actor;
    const f = shared.fixture, pupil = f.archivePupils[0];
    const dialog = await openArchive(actor, pupil);
    await dialog.getByRole('button', { name: 'Archive student', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto(releaseUrl(f));
    await expect(rosterRow(page, pupil)).toContainText('Needs attention');
    await expect(page.getByRole('button', { name: 'Review release', exact: true })).toBeDisabled();
    await capture('archive-only-blocks-current-release');
    await rosterRow(page, pupil).getByRole('button', { name: 'Exclude student', exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox', { name: 'Reason', exact: true }).fill('QA separate review after archive-only action');
    await page.getByRole('button', { name: 'Confirm exclusion', exact: true }).click();
    await expect(rosterRow(page, pupil)).toContainText('Approved by');
  } },
  { name: 'combined action validates reason and persists one manual exclusion with and without subjects', run: async actor => {
    const { page, expect, shared, capture } = actor;
    const f = shared.fixture;
    for (const pupil of f.archivePupils.slice(1)) {
      const dialog = await openArchive(actor, pupil);
      await dialog.getByRole('radio', { name: /Archive and exclude/ }).click();
      const reason = dialog.getByRole('textbox', { name: 'Reason for exclusion', exact: true });
      for (const length of [9, 501]) { await reason.fill('x'.repeat(length)); await expect(dialog.getByRole('button', { name: 'Archive and exclude', exact: true })).toBeDisabled(); }
      await reason.fill(`QA reviewed current-term departure ${pupil.mode}`);
      await dialog.getByRole('button', { name: 'Archive and exclude', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await page.goto(releaseUrl(f));
      await expect(rosterRow(page, pupil)).toContainText(`QA reviewed current-term departure ${pupil.mode}`);
      await expect(rosterRow(page, pupil)).toContainText('Approved by');
      await page.reload();
      await expect(rosterRow(page, pupil)).toContainText('Excluded');
    }
    await capture('combined-exclusions-persisted');
  } },
] };
const future = { id: 'future-policy', role: 'admin', dependsOn: ['admin-frozen'], steps: [
  { name: 'later term computes archive policy without claiming manual approval', run: async actor => {
    const { page, expect, shared, capture } = actor;
    const f = shared.fixture;
    f.earlierTermId = f.termId;
    f.earlierTermName = f.termName;
    await makeActive(page, f.sessionName, f.futureTermName, expect);
    f.termId = f.futureTermId;
    f.termName = f.futureTermName;
    f.released = false;
    save(shared);
    await page.goto(releaseUrl(f));
    for (const pupil of f.archivePupils) {
      await expect(rosterRow(page, pupil)).toContainText('Archived before term');
      await expect(rosterRow(page, pupil)).not.toContainText('Approved by');
      await expect(rosterRow(page, pupil)).toContainText('This term began');
    }
    f.policyText = await rosterRow(page, f.archivePupils[0]).innerText();
    save(shared);
    await capture('later-term-policy');
  } },
  { name: 'restore removes computed policy before release and re-archive uses fresh context', run: async actor => {
    const { page, expect, shared, capture } = actor;
    const f = shared.fixture, pupil = f.archivePupils[1];
    await restore(actor, pupil);
    await page.goto(releaseUrl(f));
    await expect(rosterRow(page, pupil)).not.toContainText('Archived before term');
    await expect(rosterRow(page, pupil)).toContainText('Needs attention');
    await capture('restore-before-release-needs-review');
    const dialog = await openArchive(actor, pupil);
    await dialog.getByRole('button', { name: 'Archive student', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.goto(releaseUrl(f));
    await expect(rosterRow(page, pupil)).toContainText('Archived before term');
  } },
] };
const futureEntry = { ...phase('entry'), id: 'future-entry', dependsOn: ['future-policy'] };
const futureCertify = { ...phase('certify'), id: 'future-certify', dependsOn: ['future-entry'] };
const futureRelease = { id: 'future-release', role: 'admin', dependsOn: ['future-certify'], steps: [
  { name: 'release freezes all three policy exclusions and restore cannot rewrite their dates', run: async actor => {
    const { page, expect, shared, capture } = actor;
    const f = shared.fixture;
    await publish(actor, 3);
    const pupil = f.archivePupils[0];
    const frozen = await rosterRow(page, pupil).innerText();
    await restore(actor, pupil);
    await page.goto(releaseUrl(f));
    await expect.poll(() => rosterRow(page, pupil).innerText()).toBe(frozen);
    await page.reload();
    await expect.poll(() => rosterRow(page, pupil).innerText()).toBe(frozen);
    await capture('policy-frozen-after-restore');
    f.termId = f.earlierTermId;
    f.termName = f.earlierTermName;
    await page.goto(releaseUrl(f));
    await expect(rosterRow(page, pupil)).toContainText('Excluded');
    await expect(rosterRow(page, pupil)).toContainText('QA separate review');
    save(shared);
  } },
] };
export const phases = [
  ...lifecycle.slice(0, lifecycle.findIndex(item => item.id === 'release')),
  archive,
  { ...phase('release'), dependsOn: ['archive'], steps: [{ name: 'review and release one included peer with three manual exclusions', run: actor => publish(actor, 3) }] },
  ...lifecycle.slice(lifecycle.findIndex(item => item.id === 'published'), lifecycle.findIndex(item => item.id === 'cleanup')),
  future, futureEntry, futureCertify, futureRelease,
  { ...phase('cleanup'), steps: [...phase('cleanup').steps, { name: 'return history assertions to the earlier issued term', run: async ({ shared }) => {
    const f = shared.fixture;
    if (f.earlierTermId) { f.termId = f.earlierTermId; f.termName = f.earlierTermName; save(shared); }
  } }] }, phase('history'),
];
