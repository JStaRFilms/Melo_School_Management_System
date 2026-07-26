import { expect, test } from "@playwright/test";

function contrastRatio(first: string, second: string): number {
  const luminance = (value: string) => {
    const channels = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [a, b] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (a + 0.05) / (b + 0.05);
}

test.describe("OBHIS public renderer", () => {
  test("keeps the mobile dialog modal, keyboard-safe, and reflow-safe at a 320px effective viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    await expect(page).toHaveTitle("Approved test identity");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const menu = page.getByRole("button", { name: "Open menu" });
    await menu.click();
    const dialog = page.getByRole("dialog", { name: "Site navigation" });
    const close = dialog.getByRole("button", { name: "Close" });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await expect.poll(() => page.locator("#main-content").evaluate((element) => element.getAttribute("aria-hidden"))).toBe("true");

    const focusable = dialog.locator("a[href], button:not([disabled])");
    await focusable.last().focus();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(menu).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  test("uses only available routes, preserves preview aliases, and emits concrete policy metadata", async ({ page }) => {
    await page.goto("/policies/test-policy");
    await expect(page).toHaveTitle("Approved test policy — Approved test identity");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://obhis.localhost/policies/test-policy");

    const unavailable = await page.goto("http://unavailable.obhis.localhost:3005/");
    expect(unavailable?.status()).toBe(404);
    const preview = await page.goto("http://alias.obhis.localhost:3005/__preview/opaque/visit");
    expect(preview?.status()).toBe(200);
    await expect(page).toHaveURL(/alias\.obhis\.localhost:3005\/__preview\/opaque\/visit$/);
    await expect(page.getByText("Draft preview — not public")).toBeVisible();
    await expect(page.getByRole("link", { name: "Approved test identity home" })).toHaveAttribute("href", "/__preview/opaque");
  });

  test("maintains AA text contrast for the approved code-owned palette", async ({ page }) => {
    await page.goto("/");
    const ratios = await page.evaluate(() => {
      const site = document.querySelector("[class*=site]");
      const styles = getComputedStyle(site!);
      return { inkOnPaper: [styles.color, styles.backgroundColor], action: [getComputedStyle(document.querySelector("[class*=applyButton]")!).color, getComputedStyle(document.querySelector("[class*=applyButton]")!).backgroundColor] };
    });
    expect(contrastRatio(ratios.inkOnPaper[0]!, ratios.inkOnPaper[1]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ratios.action[0]!, ratios.action[1]!)).toBeGreaterThanOrEqual(4.5);
  });
});
