const { test, expect } = require("@playwright/test");

function localOrigin(name, fallback) {
  const value = process.env[name] ?? fallback;
  const url = new URL(value);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (url.protocol !== "http:" || !localHosts.has(url.hostname) || url.pathname !== "/") {
    throw new Error(`${name} must be an HTTP loopback origin for this non-destructive smoke test.`);
  }
  return url.origin;
}

const ADMIN_ORIGIN = localOrigin("E2E_ADMIN_ORIGIN", "http://localhost:3002");
const APPLY_ORIGIN = localOrigin("E2E_APPLY_ORIGIN", "http://localhost:3004");
const SCHOOL_SLUG = process.env.E2E_ADMISSIONS_SCHOOL_SLUG;

if (ADMIN_ORIGIN === APPLY_ORIGIN) {
  throw new Error("Admin and Apply origins must differ for the cross-host smoke test.");
}

function requireSchoolSlug() {
  test.skip(
    !SCHOOL_SLUG,
    "Set E2E_ADMISSIONS_SCHOOL_SLUG to an existing school with a published intake."
  );
  return SCHOOL_SLUG;
}

async function expectSafeApplyLinks(page) {
  const visibleLinks = page.locator("a:visible");
  const hrefs = await visibleLinks.evaluateAll((links) =>
    links.map((link) => link.href)
  );

  expect(hrefs.length, "the Apply page should display navigation links").toBeGreaterThan(0);
  for (const href of hrefs) {
    const url = new URL(href);
    expect(url.origin, `unexpected link origin in ${href}`).toBe(APPLY_ORIGIN);
    expect(href).not.toMatch(/convex\.cloud|convex\.site|\/api\/storage|_storage|storageId=/i);
    expect(url.search).not.toMatch(/(?:school|intake|application|document|file)Id=/i);
  }

  await expect(page.locator("body")).not.toContainText(
    /https?:\/\/\S*(?:convex\.cloud|convex\.site|\/api\/storage|_storage)/i
  );
}

test("protects Admin and resolves the canonical intake on the separate Apply host", async ({ browser }) => {
  const schoolSlug = requireSchoolSlug();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${ADMIN_ORIGIN}/admin/admissions`);
  await page.waitForURL((url) => url.origin === ADMIN_ORIGIN && url.pathname === "/sign-in");
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/admin/admissions");
  await expect(page.getByRole("heading", { name: "Admin Sign In" })).toBeVisible();

  await page.goto(`${APPLY_ORIGIN}/s/${encodeURIComponent(schoolSlug)}`);
  await expect(page.getByRole("heading", { name: /applications$/i })).toBeVisible({
    timeout: 30_000,
  });
  await expectSafeApplyLinks(page);

  const intakeLink = page.getByRole("link", { name: "View intake" }).first();
  await expect(intakeLink).toBeVisible();
  const intakeHref = await intakeLink.getAttribute("href");
  const intakeUrl = new URL(intakeHref, APPLY_ORIGIN);
  const intakePrefix = `/s/${encodeURIComponent(schoolSlug)}/i/`;
  expect(intakeUrl.origin).toBe(APPLY_ORIGIN);
  expect(intakeUrl.pathname.startsWith(intakePrefix)).toBe(true);
  expect(intakeUrl.pathname.slice(intakePrefix.length)).toMatch(/^[^/?#]+$/);
  expect(intakeUrl.search).toBe("");

  await intakeLink.click();
  await page.waitForURL((url) =>
    url.origin === APPLY_ORIGIN &&
    url.pathname.startsWith(`/s/${encodeURIComponent(schoolSlug)}/i/`)
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectSafeApplyLinks(page);
  await context.close();
});
