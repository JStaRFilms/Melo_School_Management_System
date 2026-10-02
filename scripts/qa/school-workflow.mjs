import fs from 'node:fs';
import path from 'node:path';
// Generated fixture tags use ASCII title casing only. Business values are
// entered through the real UI; this helper does not set application state.
const humanNameFinal = value => value.toLowerCase().replace(/(^|[-\s])([a-z])/g, (_, prefix, letter) => prefix + letter.toUpperCase());
const humanNameFinalStrict = humanNameFinal;
export const scope = 'Fresh run-tagged Admin/Teacher/Parent scoring, certification, class release, issued privacy/freeze after correction, history, mobile and A4 print. No provider or other-app flows are exercised.';
export const effects = 'synthetic-writes';
function init(shared) {
    if (!shared.fixture) {
        if (!shared.inspectionBefore.activePeriod.session || !shared.inspectionBefore.activePeriod.term) throw new Error('An unambiguous original active period is required before fixture writes.');
        {
            const alpha = shared.runId.slice(-8).replace(/[0-9]/g, n => 'abcdefghij'[Number(n)]);
            const tag = `QA-RC-${alpha.toUpperCase()}`;
            const date = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
            shared.fixture = { tag, sessionName: humanNameFinal(tag), termName: humanNameFinal(`${tag} Term`), gradeName: humanNameFinal(tag), className: `${humanNameFinal(tag)} - QA`, studentName: humanNameFinalStrict(`QA Report ${alpha}`), admission: tag, original: shared.inspectionBefore.activePeriod, baselineDigest: shared.inspectionBefore.baseline.digest, sessionStart: date(-30), sessionEnd: date(365), termStart: date(-10), termEnd: date(90) };
        }
    }
    return shared.fixture;
}
function save(shared) { fs.writeFileSync(path.join(shared.directory, 'fixture.json'), JSON.stringify(shared.fixture, null, 2), { mode: 0o600 }); }
function dateInput(page, name) { return page.locator('label').filter({ hasText: new RegExp(`^${name}$`) }).locator('..').locator('input[type=date]'); }
function sessionCard(page, name) { return page.getByRole('region', { name: `Academic session ${name}`, exact: true }); }
async function chooseSession(page, name) { const pattern = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: \\(Active\\))?\\s*$'); const combo = page.getByRole('combobox').filter({ has: page.locator('option').filter({ hasText: pattern }) }); const value = await combo.locator('option').filter({ hasText: pattern }).getAttribute('value'); await combo.selectOption(value); return combo.inputValue(); }
function observeId(page, udf, shared, key) {
    page.on('websocket', socket => { const pending = new Set(); socket.on('framesent', event => { try {
        const p = JSON.parse(String(event.payload));
        if (p.type === 'Mutation' && p.udfPath === udf) {
            pending.add(p.requestId);
            if (p.args?.[0]?.classId)
                shared.fixture.classId = p.args[0].classId;
        }
    }
    catch { } }); socket.on('framereceived', event => { try {
        const p = JSON.parse(String(event.payload));
        if (p.type === 'MutationResponse' && pending.has(p.requestId) && p.success && typeof p.result === 'string') {
            shared.fixture[key] = p.result;
            save(shared);
        }
    }
    catch { } }); });
}
export async function makeActive(page, name, term, expect) {
    await page.goto('/academic/sessions');
    const card = sessionCard(page, name);
    await expect(card).toBeVisible();
    await expect(card).not.toContainText('Loading terms...');
    const activate = card.getByRole('button', { name: 'Set As Active Session', exact: true });
    if (await activate.count()) {
        await activate.click();
        await page.getByRole('button', { name: 'Set As Active', exact: true }).click();
        await expect(activate).toHaveCount(0);
    }
    if (await card.getByRole('button', { name: 'Expand session', exact: true }).count())
        await card.getByRole('button', { name: 'Expand session', exact: true }).click();
    const t = card.getByRole('region', { name: `Academic term ${term}`, exact: true });
    await expect(t).toBeVisible();
    const active = t.getByRole('button', { name: 'Make Active', exact: true });
    if (await active.count()) {
        await active.click();
        await page.getByRole('button', { name: 'Activate Term', exact: true }).click();
        await expect(active).toHaveCount(0);
    }
}
export const phases = [{ id: 'setup', role: 'admin', steps: [
            { name: 'create an inactive tagged session and standalone term through UI', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    save(shared);
                    await page.goto('/academic/sessions');
                    await expect(sessionCard(page, f.original.session)).toBeVisible();
                    const existing = sessionCard(page, f.sessionName);
                    if (await existing.count() > 1) {
                        const unused = existing.filter({ hasText: '0 Academic Terms' });
                        await expect(unused).toHaveCount(1);
                        await unused.getByRole('button', { name: 'Archive session', exact: true }).click();
                        await page.getByRole('button', { name: 'Archive Session', exact: true }).click();
                        await expect(existing).toHaveCount(1);
                    }
                    if (await existing.count() === 0) {
                        await page.getByRole('button', { name: 'New Session', exact: true }).click();
                        await page.getByPlaceholder('e.g., 2025/2026').fill(f.sessionName);
                        await dateInput(page, 'Session Start Date').fill(f.sessionStart);
                        await dateInput(page, 'Session End Date').fill(f.sessionEnd);
                        await page.getByRole('checkbox', { name: /Auto-create 3 Standard Terms/ }).uncheck();
                        await page.getByRole('checkbox', { name: 'Set as the active school session', exact: true }).uncheck();
                        await page.getByRole('button', { name: 'Create Session', exact: true }).click();
                    }
                    const card = sessionCard(page, f.sessionName);
                    await expect(card).toBeVisible();
                    await expect(card).not.toContainText('Loading terms...');
                    if (await card.getByRole('button', { name: 'Expand session', exact: true }).count())
                        await card.getByRole('button', { name: 'Expand session', exact: true }).click();
                    await expect(card.getByRole('button', { name: 'Collapse session', exact: true })).toBeVisible();
                    if (await card.getByRole('heading', { name: f.termName, exact: true }).count() === 0) {
                        await card.getByRole('button', { name: 'Add Term', exact: true }).click();
                        await page.getByPlaceholder('e.g., First Term').fill(f.termName);
                        await dateInput(page, 'Term Start Date').fill(f.termStart);
                        await dateInput(page, 'Term End Date').fill(f.termEnd);
                        await page.getByRole('checkbox', { name: 'Set as the active term immediately', exact: true }).uncheck();
                        await page.locator('form').filter({ has: page.getByPlaceholder('e.g., First Term') }).getByRole('button', { name: 'Add Term', exact: true }).click();
                    }
                    await expect(card.getByRole('heading', { name: f.termName, exact: true })).toBeVisible();
                    await capture('calendar-fixture');
                } },
            { name: 'create one tagged class with Mathematics and assigned Teacher', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    observeId(page, 'functions/academic/academicSetup:createClass', shared, 'classId');
                    await page.goto('/academic/classes');
                    f.sessionId = await chooseSession(page, f.sessionName);
                    save(shared);
                    if (await page.getByRole('heading', { name: f.gradeName, exact: true, level: 4 }).count() === 0) {
                        await page.getByPlaceholder('e.g. Primary 4, JSS 2').filter({ visible: true }).fill(f.gradeName);
                        await page.getByPlaceholder('e.g. Olive Blossom, Gold').filter({ visible: true }).fill('QA');
                        await page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'Secondary' }) }).selectOption({ label: 'Secondary' });
                        await page.getByRole('button', { name: 'Mathematics MATH', exact: true }).click();
                        await page.getByRole('button', { name: 'Save Class Blueprint', exact: true }).click();
                    }
                    await expect(page.getByRole('heading', { name: f.gradeName, exact: true, level: 4 })).toBeVisible();
                    await page.getByRole('heading', { name: f.gradeName, exact: true, level: 4 }).click();
                    await page.getByRole('button', { name: 'Faculty', exact: true }).click();
                    const teacher = page.getByRole('combobox').filter({ has: page.locator('option', { hasText: 'Daniel Mensah' }) }).filter({ has: page.locator('option', { hasText: 'No Instructor Assigned' }) });
                    await teacher.selectOption({ label: 'Daniel Mensah' });
                    await expect(teacher.locator('option:checked')).toHaveText('Daniel Mensah');
                    await capture('class-teacher-fixture');
                    fs.writeFileSync(path.join(shared.directory, 'private-setup-aria.txt'), await page.locator('body').ariaSnapshot(), { mode: 0o600 });
                } }
        ] },
    { id: 'enroll', role: 'admin', dependsOn: ['setup'], steps: [
            { name: 'activate the tagged period and enroll one synthetic pupil', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await makeActive(page, f.sessionName, f.termName, expect);
                    f.activationAttempted = true;
                    save(shared);
                    if (!f.studentId) {
                        observeId(page, 'functions/academic/studentEnrollment:createStudent', shared, 'studentId');
                        await page.goto('/academic/students/onboarding');
                        await page.getByRole('button', { name: 'Select Target Class...', exact: true }).click();
                        await page.getByRole('button', { name: f.className, exact: true }).click();
                        await page.getByRole('textbox', { name: 'First Name *', exact: true }).fill('QA');
                        await page.getByRole('textbox', { name: 'Last Name *', exact: true }).fill(f.studentName.replace(/^Qa /, ''));
                        await page.getByRole('textbox', { name: /^Admission Number/ }).fill(f.admission);
                        await page.getByRole('combobox', { name: 'Gender *', exact: true }).selectOption('Male');
                        await page.getByRole('button', { name: 'Enroll Student', exact: true }).click();
                        await expect(page.getByText(new RegExp(f.studentName + ' enrolled to')).first()).toBeVisible();
                        await expect.poll(() => shared.fixture.studentId).toBeTruthy();
                    }
                    await capture('enrolled-pupil');
                    save(shared);
                } },
            { name: 'review and link the existing synthetic parent through Family UI', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/academic/students?' + new URLSearchParams({ studentId: f.studentId, classId: f.classId, sessionId: f.sessionId, tab: 'family' }));
                    await page.getByRole('button', { name: 'Family & Contacts', exact: true }).click();
                    await expect(page.getByText('Family Links', { exact: true })).toBeVisible();
                    const confirm = page.getByRole('button', { name: 'Confirm Link', exact: true });
                    if (!f.parentLinked) {
                        await page.getByPlaceholder('e.g. John').fill('Grace');
                        await page.getByPlaceholder('e.g. Doe').fill('Adeyemi');
                        await page.getByPlaceholder('parent@example.com').fill('parent@demo-academy.school');
                        await page.getByRole('button', { name: 'Link to Household', exact: true }).click();
                        const linked = page.getByText('parent@demo-academy.school', { exact: true }).first();
                        await expect(confirm.or(linked).first()).toBeVisible();
                        if (await confirm.count())
                            await confirm.click();
                    }
                    await expect(confirm).toHaveCount(0);
                    await expect(page.getByText('Linked Contacts', { exact: true })).toBeVisible();
                    await expect(page.getByText('parent@demo-academy.school', { exact: true }).filter({ visible: true }).first()).toBeVisible();
                    f.parentLinked = true;
                    save(shared);
                    await capture('parent-linked');
                } }
        ] },
    { id: 'prepare', role: 'admin', dependsOn: ['enroll'], steps: [
            { name: 'persist the fixture pupil Mathematics selection', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/academic/students?' + new URLSearchParams({ classId: f.classId, sessionId: f.sessionId }));
                    const add = page.getByRole('button', { name: `Add Mathematics for ${f.studentName}`, exact: true });
                    const remove = page.getByRole('button', { name: `Remove Mathematics for ${f.studentName}`, exact: true });
                    await expect(page.getByText(f.studentName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
                    if (await add.count())
                        await add.click();
                    await expect(remove).toBeVisible();
                    await page.reload();
                    await expect(remove).toBeVisible();
                    await capture('subject-selected');
                } },
            { name: 'version the existing grading policy without changing semantic bands', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/setup/grading-bands');
                    const remark = page.getByRole('textbox', { name: 'Remark for tier 1' });
                    await expect(remark).toBeVisible();
                    if (!f.bandsVersioned) {
                        const original = await remark.inputValue();
                        await remark.fill(original + ' QA');
                        await remark.fill(original);
                        await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
                        await expect(page.getByText('Grading policy saved successfully', { exact: true })).toBeVisible();
                        await page.reload();
                        await expect(remark).toHaveValue(original);
                        f.bandsVersioned = true;
                        save(shared);
                    }
                    await capture('grading-policy');
                } },
            { name: 'apply a session-scoped 20/20/10 and raw50 contribution50 policy', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/setup/exam-recording');
                    await chooseSession(page, f.sessionName);
                    const termCombo = page.getByRole('combobox').filter({ has: page.locator('option').filter({ hasText: f.termName }) });
                    await termCombo.selectOption({ label: f.termName });
                    f.termId = await termCombo.inputValue();
                    save(shared);
                    const policy = page.getByRole('region', { name: 'Session scoring policy' });
                    await expect(policy.getByRole('textbox', { name: 'Exam raw maximum' })).toBeVisible();
                    if (!f.policyApplied) {
                        await policy.getByRole('button', { name: '20/20/10 + exam /50 worth 50', exact: true }).click();
                        await policy.getByRole('button', { name: 'Scan all session scores', exact: true }).click();
                        await expect(policy.getByRole('checkbox', { name: 'I reviewed the complete scan and want to start the regrade.', exact: true })).toBeVisible();
                        await policy.getByRole('checkbox', { name: 'I reviewed the complete scan and want to start the regrade.', exact: true }).check();
                        await policy.getByRole('button', { name: 'Start regrade', exact: true }).click();
                        await expect(policy.getByText(/Regrade complete\./)).toBeVisible();
                        f.policyApplied = true;
                        save(shared);
                    }
                    await expect(policy.getByRole('textbox', { name: 'CA 3 contribution' })).toHaveValue('10');
                    await expect(policy.getByRole('textbox', { name: 'Exam raw maximum' })).toHaveValue('50');
                    await capture('session-policy-complete');
                } }
        ] },
    { id: 'entry', role: 'teacher', dependsOn: ['prepare'], steps: [
            { name: 'validate maxima then save and reload scores with total83', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/exams/entry');
                    for (const [name, label] of [['Session', f.sessionName], ['Term', f.termName], ['Class', f.className], ['Subject', 'Mathematics']]) {
                        const c = page.getByRole('combobox', { name, exact: true });
                        await c.selectOption({ label });
                        if (name === 'Subject')
                            f.subjectId = await c.inputValue();
                    }
                    const row = page.getByRole('row', { name: new RegExp(f.studentName) });
                    await expect(row).toBeVisible();
                    const ca3 = row.getByRole('textbox', { name: new RegExp('CA3 score out of 10$') });
                    await ca3.fill('11');
                    await expect(ca3).toHaveAttribute('aria-invalid', 'true');
                    await page.getByRole('button', { name: 'Fix Errors First', exact: true }).click();
                    await expect(page.getByText('Review required before saving', { exact: true })).toBeVisible();
                    await capture('invalid-score');
                    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
                    await page.reload();
                    await expect(row.getByRole('textbox', { name: /CA3 score/ })).not.toHaveValue('11');
                    for (const [field, val] of [['CA1', '18'], ['CA2', '17'], ['CA3', '8'], ['exam', '40']])
                        await row.getByRole('textbox', { name: new RegExp(field + ' score out of') }).fill(val);
                    await expect(row).toContainText('83.00');
                    const saveScore = page.getByRole('button', { name: 'Finalize Sheet', exact: true });
                    if (await saveScore.isDisabled()) {
                        await row.getByRole('textbox', { name: /exam score/ }).fill('39');
                        await saveScore.click();
                        await expect(saveScore).toBeDisabled();
                        await row.getByRole('textbox', { name: /exam score/ }).fill('40');
                    }
                    await saveScore.click();
                    await expect(page.getByRole('button', { name: 'Finalize Sheet', exact: true })).toBeDisabled();
                    await page.reload();
                    await expect(row.getByRole('textbox', { name: /CA1 score/ })).toHaveValue('18');
                    await expect(row.getByRole('textbox', { name: /exam score/ })).toHaveValue('40');
                    await expect(row).toContainText('83.00');
                    f.subjectId = new URL(page.url()).searchParams.get('subjectId');
                    await expect(row.getByRole('cell', { name: 'A', exact: true })).toBeVisible();
                    await capture('scores-persisted');
                    save(shared);
                } }
        ] },
    { id: 'withheld', role: 'parent', dependsOn: ['entry'], steps: [{ name: 'draft marks and report controls are withheld from the linked parent', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/report-cards?' + new URLSearchParams({ studentId: f.studentId, sessionId: f.sessionId, termId: f.termId }));
                    await expect(page.getByText(f.studentName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
                    await expect(page.getByText(/Results for this term have not been published/).first()).toBeVisible();
                    await expect(page.getByRole('button', { name: /Print/ })).toHaveCount(0);
                    await expect(page.locator('.rc-sheet:visible')).toHaveCount(0);
                    await expect(page.getByRole('table')).toHaveCount(0);
                    await expect(page.locator('body')).not.toContainText('83.00');
                    await capture('draft-withheld');
                } }] },
    { id: 'certify', role: 'admin', dependsOn: ['withheld'], steps: [{ name: 'review total83 and certify the immutable pupil report', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/report-cards?' + new URLSearchParams({ studentId: f.studentId, classId: f.classId, sessionId: f.sessionId, termId: f.termId }));
                    const sheet = page.locator('.rc-sheet:visible');
                    await expect(sheet).toContainText(f.studentName);
                    await expect(sheet).toContainText('83.00');
                    if (await page.getByText(/Certified copy\./).count() === 0) {
                        await page.getByText('Certify this report card', { exact: true }).click();
                        await page.getByRole('textbox', { name: new RegExp('Confirm admission number: ' + f.admission) }).fill(f.admission);
                        await page.getByRole('button', { name: 'Confirm certification', exact: true }).click();
                    }
                    await expect(page.getByText(/Certified copy\./).first()).toBeVisible();
                    f.certified = true;
                    save(shared);
                    await capture('certified83');
                } }] },
    { id: 'certified-withheld', role: 'parent', dependsOn: ['certify'], steps: [{ name: 'certification alone still withholds scores and printing', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/report-cards?' + new URLSearchParams({ studentId: f.studentId, sessionId: f.sessionId, termId: f.termId }));
                    await expect(page.getByText(f.studentName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
                    if (!f.released) {
                        await expect(page.getByText(/Results for this term have not been published/).first()).toBeVisible();
                        await expect(page.locator('.rc-sheet:visible')).toHaveCount(0);
                        await expect(page.locator('body')).not.toContainText('83.00');
                        await expect(page.getByRole('button', { name: /Print/ })).toHaveCount(0);
                    }
                    await capture('certified-not-published');
                } }] },
    { id: 'release', role: 'admin', dependsOn: ['certified-withheld'], steps: [{ name: 'review one certified eligible pupil and explicitly release the frozen roster', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/report-cards/release?' + new URLSearchParams({ classId: f.classId, sessionId: f.sessionId, termId: f.termId }));
                    const panel = page.getByRole('region', { name: 'Class release readiness' });
                    await expect(panel.getByText(f.studentName, { exact: true })).toBeVisible();
                    if (!f.released) {
                        await expect(panel.getByRole('heading', { name: 'Ready to release', exact: true })).toBeVisible();
                        await panel.getByRole('button', { name: 'Review release', exact: true }).click();
                        let dialog = page.getByRole('dialog');
                        await expect(dialog).toContainText('1 eligible, 1 certified, 0 excluded');
                        await expect(dialog.getByRole('button', { name: 'Release class results', exact: true })).toBeDisabled();
                        await page.keyboard.press('Escape');
                        await expect(dialog).toHaveCount(0);
                        await panel.getByRole('button', { name: 'Review release', exact: true }).click();
                        dialog = page.getByRole('dialog');
                        await dialog.getByRole('checkbox').check();
                        await dialog.getByRole('button', { name: 'Release class results', exact: true }).click();
                    }
                    await expect(panel.getByRole('heading', { name: 'Released to families', exact: true })).toBeVisible();
                    await expect(panel).toContainText('The released roster is frozen');
                    for (const [label, value] of [['Eligible', '1'], ['Certified', '1'], ['Missing certification', '0'], ['Excluded', '0']]) {
                        await expect(panel.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }).locator('..').locator('dd')).toHaveText(value);
                    }
                    const stamp = panel.getByText(/^Original release:/);
                    await expect(stamp).toContainText(/by .+\. The released roster is frozen\./);
                    f.releaseStamp = await stamp.textContent();
                    f.released = true;
                    save(shared);
                    await page.reload();
                    await expect(panel).toContainText(f.releaseStamp);
                    await panel.scrollIntoViewIfNeeded();
                    await capture('released-roster', panel);
                } }] },
    { id: 'published', role: 'parent', dependsOn: ['release'], steps: [
            { name: 'parent sees the issued83 report with print controls', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/report-cards?' + new URLSearchParams({ studentId: f.studentId, sessionId: f.sessionId, termId: f.termId }));
                    const sheet = page.locator('.rc-sheet:visible');
                    await expect(sheet).toContainText(f.studentName);
                    await expect(sheet).toContainText('83.00');
                    await expect(page.getByRole('button', { name: 'Export / Print', exact: true })).toBeEnabled();
                    await capture('parent-issued83');
                } },
            { name: 'issued mobile and A4 print preserve83 with one white page', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.setViewportSize({ width: 390, height: 844 });
                    await page.reload();
                    await expect(page.locator('.rc-sheet:visible')).toContainText('83.00');
                    const mobilePreview = page.locator('.rc-preview-container > .rc-print-root');
                    await mobilePreview.scrollIntoViewIfNeeded();
                    await expect.poll(async () => { const box = await mobilePreview.boundingBox(); return box.x + box.width; }).toBeLessThanOrEqual(391);
                    await capture('issued-mobile');
                    await page.setViewportSize({ width: 1440, height: 1000 });
                    await page.evaluate(() => { window.__qaPrint = 0; window.print = () => window.__qaPrint++; });
                    await page.getByRole('button', { name: 'Export / Print', exact: true }).click();
                    expect(await page.evaluate(() => window.__qaPrint)).toBe(1);
                    await page.emulateMedia({ media: 'print' });
                    await expect(page.locator('.rc-sheet')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
                    const pdf = await page.pdf({ path: path.join(shared.directory, 'private-issued-report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
                    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(1);
                    await capture('issued-print');
                    await page.emulateMedia({ media: 'screen' });
                } }
        ] },
    { id: 'correction', role: 'teacher', dependsOn: ['published'], steps: [{ name: 'a later draft correction changes live total to63 without rewriting issue', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/exams/entry?' + new URLSearchParams({ sessionId: f.sessionId, termId: f.termId, classId: f.classId, subjectId: f.subjectId }));
                    await page.getByRole('combobox', { name: 'Subject', exact: true }).selectOption({ label: 'Mathematics' });
                    const row = page.getByRole('row', { name: new RegExp(f.studentName) });
                    await expect(row).toBeVisible();
                    await row.getByRole('textbox', { name: /exam score/ }).fill('20');
                    await expect(row).toContainText('63.00');
                    await page.getByRole('button', { name: 'Finalize Sheet', exact: true }).click();
                    await expect(page.getByRole('button', { name: 'Finalize Sheet', exact: true })).toBeDisabled();
                    await page.reload();
                    await expect(row.getByRole('textbox', { name: /exam score/ })).toHaveValue('20');
                    await expect(row).toContainText('63.00');
                    await expect(row.getByRole('cell', { name: 'B', exact: true })).toBeVisible();
                    await capture('draft-corrected63');
                    f.corrected = true;
                    save(shared);
                } }] },
    { id: 'frozen', role: 'parent', dependsOn: ['correction'], steps: [{ name: 'the released issued snapshot remains83 after the live draft became63', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/report-cards?' + new URLSearchParams({ studentId: f.studentId, sessionId: f.sessionId, termId: f.termId }));
                    const sheet = page.locator('.rc-sheet:visible');
                    await expect(sheet).toContainText('83.00');
                    await expect(sheet).not.toContainText('63.00');
                    await capture('frozen83-after-correction');
                } }] },
    { id: 'admin-frozen', role: 'admin', dependsOn: ['correction'], steps: [{ name: 'Admin issued copy remains83 after Teacher draft correction', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/assessments/report-cards?' + new URLSearchParams({ studentId: f.studentId, classId: f.classId, sessionId: f.sessionId, termId: f.termId }));
                    await expect(page.getByText(/Certified copy\./).first()).toBeVisible();
                    await expect(page.locator('.rc-sheet:visible')).toContainText('83.00');
                    await expect(page.locator('.rc-sheet:visible')).not.toContainText('63.00');
                    await capture('admin-frozen83');
                } }] },
    { id: 'cleanup', role: 'admin', alwaysRun: true, steps: [{ name: 'restore the original active session and term', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    const target = shared.recovery?.activePeriod ?? f.original;
                    await makeActive(page, target.session, target.term, expect);
                    await capture('original-calendar-restored');
                    f.restored = true;
                    save(shared);
                } }] },
    { id: 'history', role: 'parent', dependsOn: ['frozen', 'cleanup'], steps: [{ name: 'released83 remains available through explicit historical period after restoration', run: async ({ page, expect, capture, shared }) => {
                    const f = init(shared);
                    await page.goto('/results?' + new URLSearchParams({ studentId: f.studentId }));
                    const history = page.getByRole('row').filter({ has: page.getByRole('button', { name: f.sessionName, exact: true }) });
                    await expect(history).toHaveCount(1);
                    await expect(history).toContainText(f.termName);
                    await expect(history.getByRole('cell', { name: /^83(?:\.0+)?$/ })).toHaveCount(1);
                    await history.getByRole('button', { name: f.sessionName, exact: true }).click();
                    await page.waitForURL(url => url.searchParams.get('termId') === f.termId && url.searchParams.get('sessionId') === f.sessionId);
                    await page.getByRole('link', { name: 'Open report card', exact: true }).click();
                    await page.waitForURL(url => url.pathname === '/report-cards');
                    await expect(page.locator('.rc-sheet:visible')).toContainText('83.00');
                    await expect(page.locator('.rc-sheet:visible')).not.toContainText('63.00');
                    await capture('historical-issued83');
                } }] }
];
