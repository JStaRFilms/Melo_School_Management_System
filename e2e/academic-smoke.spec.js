const { test, expect } = require("@playwright/test");

const ADMIN_BASE_URL = "http://localhost:3002";
const TEACHER_BASE_URL = "http://localhost:3001";
const PORTAL_BASE_URL = "http://localhost:3003";

async function signIn(page, { baseUrl, email, password, expectedPath }) {
  await page.goto(`${baseUrl}/sign-in`, { waitUntil: "networkidle" });

  await expect(page.locator("#email")).toBeVisible();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();

  await page.waitForURL(`**${expectedPath}*`, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

async function selectOptionByLabel(page, labelText, optionLabel) {
  const container = page.locator("label", { hasText: labelText }).first().locator("xpath=..");
  const select = container.locator("select");

  await expect(select).toBeVisible();
  await select.selectOption({ label: optionLabel });
}

test("admin can sign in and open live assessment setup surfaces", async ({ page }) => {
  await signIn(page, {
    baseUrl: ADMIN_BASE_URL,
    email: "admin@demo-academy.school",
    password: "Admin123!Pass",
    expectedPath: "/assessments/setup/exam-recording",
  });

  await expect(page.getByRole("heading", { name: "Protocol Dashboard" })).toBeVisible();
  await expect(page.getByText("Preview mode is active")).toHaveCount(0);

  await page.goto(`${ADMIN_BASE_URL}/assessments/setup/grading-bands`, {
    waitUntil: "networkidle",
  });

  await expect(
    page.getByRole("main").getByRole("heading", { name: "Grading Bands", level: 1 })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Commit Global Policy" }).first()).toBeVisible();
  await expect(page.getByText("Preview mode is active")).toHaveCount(0);
});

test("teacher can load a live exam-entry roster", async ({ page }) => {
  await signIn(page, {
    baseUrl: TEACHER_BASE_URL,
    email: "teacher@demo-academy.school",
    password: "Teacher123!Pass",
    expectedPath: "/assessments/exams/entry",
  });

  await expect(page.getByText("No Students Selected")).toBeVisible();

  await selectOptionByLabel(page, "Session", "2025/2026");
  await selectOptionByLabel(page, "Term", "First Term");
  await selectOptionByLabel(page, "Class", "JSS 1 - A");
  await selectOptionByLabel(page, "Subject", "Mathematics");

  await expect(page.getByRole("row", { name: /Alice Johnson/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Preview mode is active")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Finalize Sheet" }).first()).toBeVisible();
});

test("parent can open the live portal workspace and learning topics", async ({ page }) => {
  await signIn(page, {
    baseUrl: PORTAL_BASE_URL,
    email: "parent@demo-academy.school",
    password: "Portal123!Pass",
    expectedPath: "/",
  });

  await expect(page.getByText("Term snapshot")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Alice Johnson").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Billing" })).toBeVisible({ timeout: 30_000 });
  const secondTerm = page.getByRole("button", { name: /Second Term 2025\/2026/ });
  await expect(secondTerm).toBeVisible();
  await expect(secondTerm).not.toHaveText(/^0(?:\.0)?\b/);

  await page.goto(`${PORTAL_BASE_URL}/learning/topics`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Learning topics", level: 1 })).toBeVisible();
  await expect(page.getByText("Fractions in Everyday Life").first()).toBeVisible();
});
