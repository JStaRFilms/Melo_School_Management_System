import { test, expect, type Page } from "@playwright/test";

async function openReview(page: Page, query = "") {
  // The untouched legacy layout imports Google fonts. The review uses system
  // fonts, so keep this headless run offline without changing that layout.
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto(`/review/obhis${query}`);
  await expect(page.locator(".scene-controls")).toBeVisible();
  await page.locator(".hero-stage img").evaluateAll(images => Promise.all(images.map(image => image instanceof HTMLImageElement ? image.decode() : Promise.resolve())));
}

async function sectionPositions(page: Page) {
  return page.locator("#our-school,#school-life,.crest-story,#campuses,#admissions").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top + window.scrollY));
}

for (const width of [1440, 1024, 768, 760, 390, 320]) {
  test(`both welcomes and albums stay stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await openReview(page);
    const positions = await sectionPositions(page);
    for (const scene of ["you", "olive"] as const) {
      await page.locator(`[data-scene-choice="${scene}"]`).click();
      await expect(page.locator(".hero-stage")).toHaveAttribute("data-scene", scene);
      await page.waitForTimeout(1250);
      expect(await sectionPositions(page)).toEqual(positions);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const inactive = page.locator(`[data-panel="${scene === "you" ? "olive" : "you"}"]`);
      await expect(inactive).toHaveAttribute("aria-hidden", "true");
      expect(await inactive.evaluate(element => element instanceof HTMLElement && element.inert)).toBe(true);
      const active = page.locator(`[data-panel="${scene}"]`);
      expect(await active.locator("h1").evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(50);
    }
    await page.locator('[data-collection-choice="culture"]').click();
    await expect(page.locator('.album-sheet:not([hidden])')).toHaveCount(2);
    expect(await sectionPositions(page)).toEqual(positions);
    await page.locator('[data-collection-choice="day"]').click();
    expect(await sectionPositions(page)).toEqual(positions);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(await page.locator(".obhis-review img").evaluateAll(images => images.every(image => image instanceof HTMLImageElement && !image.src.includes("/_next/image")))).toBe(true);
  });
}

test("keyboard, history, reload and rapid reversal settle focus", async ({ page }) => {
  await openReview(page);
  const olive = page.locator('[data-scene-choice="olive"]');
  const you = page.locator('[data-scene-choice="you"]');
  await olive.focus();
  await page.keyboard.press("ArrowRight");
  await expect(you).toBeFocused();
  await expect(page).toHaveURL(/scene=you/);
  await page.locator('.scene-you .primary-link').focus();
  expect(await page.locator(".scene-you").evaluate(element => {
    const parent = element.parentElement;
    return parent !== null && Math.abs(element.getBoundingClientRect().left - parent.getBoundingClientRect().left) < 1;
  })).toBe(true);
  await olive.click();
  await you.click();
  await olive.click();
  await page.goBack();
  await expect(you).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(you).toHaveAttribute("aria-pressed", "true");
  await page.locator('.scene-you .primary-link').focus();
  await page.evaluate(() => history.back());
  await expect(olive).toBeFocused();
  await expect(olive).toHaveAttribute("aria-pressed", "true");
  const day = page.locator('[data-collection-choice="day"]');
  await day.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-collection-choice="culture"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(day).toBeFocused();
});

test("native viewer, manual controls, modified clicks and visit reopening", async ({ page }) => {
  await openReview(page);
  const opener = page.locator('.album-photo[data-photo="0"]');
  expect(await opener.evaluate(link => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator(".photo-viewer");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#viewer-close")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#viewer-next")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#viewer-close")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#viewer-position")).toHaveText("4 of 4");
  await page.locator("#viewer-next").click();
  await expect(page.locator("#viewer-position")).toHaveText("1 of 4");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe("hidden");
  await page.locator('.campus-album [data-photo="2"]').first().click();
  await expect(page.locator("#viewer-position")).toHaveText("3 of 4");
  await page.locator("#viewer-close").click();
  await page.locator("#visit-guide summary").click();
  await expect(page.locator("#visit-guide")).not.toHaveAttribute("open", "");
  await page.locator('.admissions-copy a[href="#visit-guide"]').click();
  await expect(page.locator("#visit-guide")).toHaveAttribute("open", "");
  await page.locator("#application-guide summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#application-guide")).toHaveAttribute("open", "");
});

test("reduced motion retains choices without travel or album animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReview(page, "?scene=you");
  await page.locator('[data-scene-choice="olive"]').click();
  await page.locator('[data-collection-choice="culture"]').click();
  expect(await page.locator('.scene').evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration === "0s"))).toBe(true);
  expect(await page.locator('.album-photo img').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === "none"))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
});

test("no JavaScript exposes all photographs and native guidance", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto("/review/obhis?scene=you");
  await expect(page.locator(".scene-olive")).toBeVisible();
  await expect(page.locator(".scene-you")).not.toBeVisible();
  await expect(page.locator(".scene-controls")).not.toBeVisible();
  await expect(page.locator(".album-sheet:not([hidden])")).toHaveCount(4);
  for (const photo of await page.locator(".album-photo").all()) await expect(photo).toBeVisible();
  await page.locator("#application-guide summary").click();
  await expect(page.locator("#application-guide")).toHaveAttribute("open", "");
  await page.locator('.album-photo[data-photo="0"]').click();
  expect(page.url()).toContain("/review/obhis/assets/school-friends");
  await context.close();
});
