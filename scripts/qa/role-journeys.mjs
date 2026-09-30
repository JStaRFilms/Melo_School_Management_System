const teacherSelections = [
  ['Session', '2025/2026'], ['Term', 'First Term'], ['Class', 'JSS 1 - A'], ['Subject', 'Mathematics'],
];

export const roleJourneys = {
  admin: [
    { name: 'protected workspace shows the synthetic school', run: async ({ page, expect, capture }) => {
      await page.goto('/admin/dashboard');
      await expect(page.getByRole('heading', { name: 'Admin Dashboard', level: 1 })).toBeVisible();
      await expect(page.getByText('Demo Academy', { exact: true }).first()).toBeVisible();
      await capture('dashboard');
    } },
    { name: 'grading remark edit/discard leaves persisted policy unchanged', run: async ({ page, expect, capture }) => {
      await page.goto('/assessments/setup/grading-bands');
      const remark = page.getByRole('textbox', { name: 'Remark for tier 1' });
      await expect(remark).toBeVisible();
      const original = await remark.inputValue();
      await remark.fill(`${original} QA draft`);
      await expect(page.getByRole('button', { name: 'Save Changes', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Discard', exact: true }).click();
      await expect(remark).toHaveValue(original);
      await page.reload();
      await expect(remark).toHaveValue(original);
      await capture('grading-discard');
    } },
  ],
  teacher: [
    { name: 'dependent selectors load the assigned live roster', run: async ({ page, expect, capture }) => {
      await page.goto('/assessments/exams/entry');
      await expect(page.getByText('No Students Selected')).toBeVisible();
      for (const [name, label] of teacherSelections) {
        const select = page.getByRole('combobox', { name, exact: true });
        await expect(select).toBeEnabled();
        await select.selectOption({ label });
      }
      await expect(page.getByRole('row', { name: /Alice Johnson/ }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Finalize Sheet' }).first()).toBeVisible();
      await capture('roster');
    } },
    { name: 'reload preserves selected context and roster without saving scores', run: async ({ page, expect, capture }) => {
      await page.reload();
      for (const [name, label] of teacherSelections) await expect(page.getByRole('combobox', { name, exact: true }).locator('option:checked')).toHaveText(label);
      await expect(page.getByRole('row', { name: /Alice Johnson/ }).first()).toBeVisible();
      await capture('roster-reloaded');
    } },
    { name: 'mobile roster stays within the page viewport', run: async ({ page, expect, capture }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('combobox', { name: 'Session', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await capture('roster-mobile');
    } },
    { name: 'teacher cannot open Admin template editing', run: async ({ page, expect, capture }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto('http://localhost:3102/academic/knowledge/templates');
      await expect(page.getByRole('heading', { name: /403 Forbidden.*Access Denied/i })).toBeVisible();
      await expect(page.getByRole('button', { name: 'New Template', exact: true })).toHaveCount(0);
      await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveCount(0);
      await capture('admin-denied');
    } },
  ],
  parent: [
    { name: 'parent workspace shows the linked synthetic pupil', run: async ({ page, expect, capture }) => {
      await page.goto('/');
      await expect(page.getByText('Term snapshot')).toBeVisible();
      await expect(page.getByText('Alice Johnson').first()).toBeVisible();
      await capture('workspace');
    } },
    { name: 'learning search handles matching, empty, and clear states', run: async ({ page, expect, capture }) => {
      await page.goto('/learning/topics');
      await expect(page.getByRole('heading', { name: 'Learning topics', exact: true })).toBeVisible();
      const search = page.getByRole('textbox', { name: 'Search topics', exact: true });
      await search.fill('Fractions');
      await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true })).toBeVisible();
      await capture('topic-match');
      await search.fill('qa-topic-that-does-not-exist');
      await expect(page.getByText(/No topics match/)).toBeVisible();
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true })).toBeVisible();
    } },
    { name: 'topic detail is reachable through its user-facing card', run: async ({ page, expect, capture, origin }) => {
      const link = page.getByRole('link').filter({ has: page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true }) });
      const target = new URL(await link.getAttribute('href'), origin);
      expect(target.origin).toBe(origin);
      expect(target.pathname).toMatch(/^\/learning\/topics\/[^/]+$/);
      await link.click();
      await page.waitForURL(url => url.pathname === target.pathname);
      // The list card contains the same title: require navigation and the detail H1.
      await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true, level: 1 })).toBeVisible();
      await capture('topic-detail');
      await page.reload();
      await expect(page).toHaveURL(url => url.pathname === target.pathname);
      await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true, level: 1 })).toBeVisible();
    } },
    { name: 'parent learning list remains readable on mobile', run: async ({ page, expect, capture }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/learning/topics');
      await expect(page.getByRole('heading', { name: 'Learning topics', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
      await capture('topics-mobile');
    } },
  ],
};
