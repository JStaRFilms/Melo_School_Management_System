// A read/filter-only recipe for qa:explore. Keep assertions specific to the
// implemented feature instead of treating sign-in or a screenshot as proof.
export const scope = 'Parent learning-topic search matching and clear behavior. No uploads, grades, payments, or provider calls are exercised.';
export const effects = 'read-only';
export const steps = [
  { name: 'open the linked pupil learning list', run: async ({ page, expect, capture }) => {
    await page.goto('/learning/topics');
    await expect(page.getByRole('heading', { name: 'Learning topics', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search topics', exact: true })).toBeVisible();
    await capture('learning-before');
  } },
  { name: 'search for a known topic and clear the filter', run: async ({ page, expect, capture }) => {
    const search = page.getByRole('textbox', { name: 'Search topics', exact: true });
    await search.fill('Fractions');
    await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true })).toBeVisible();
    await capture('learning-match');
    await page.getByRole('button', { name: 'Clear topic search', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Fractions in Everyday Life', exact: true })).toBeVisible();
    await capture('learning-cleared');
  } },
];
