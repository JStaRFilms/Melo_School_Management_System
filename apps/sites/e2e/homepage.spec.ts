import { test, expect, type Page } from "@playwright/test";

async function openReview(page: Page, query = "", autoplay = false) {
  // The untouched legacy layout imports Google fonts. The review uses system
  // fonts, so keep this headless run offline without changing that layout.
  await page.route("https://fonts.googleapis.com/**", route => route.fulfill({ contentType: "text/css", body: "" }));
  await page.goto(`/review/obhis${query}`);
  await expect(page.locator(".scene-controls")).toBeVisible();
  await expect(page.locator('.hero-stage')).toHaveCSS('overflow-x', 'clip');
  const play = page.locator('[data-welcome-play]');
  if (!autoplay && !(await play.isDisabled())) await play.click();
  await page.locator(".hero-stage img").evaluateAll(images => Promise.all(images.map(image => image instanceof HTMLImageElement ? image.decode() : Promise.resolve())));
}

async function sectionPositions(page: Page) {
  return page.locator("#our-school,#school-life,.crest-story,#campuses,#admissions").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top + window.scrollY));
}

for (const width of [1920, 1440, 1024, 768, 760, 390, 320]) {
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
      expect(await page.locator('.hero-stage').evaluate(element => element.scrollLeft)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const inactive = page.locator(`[data-panel="${scene === "you" ? "olive" : "you"}"]`);
      await expect(inactive).toHaveAttribute("aria-hidden", "true");
      expect(await inactive.evaluate(element => element instanceof HTMLElement && element.inert)).toBe(true);
      const active = page.locator(`[data-panel="${scene}"]`);
      expect(await active.locator("h1").evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(50);
      expect(await page.locator('.hero-stage').evaluate(stage => {
        const controls = stage.querySelector('.scene-controls')?.getBoundingClientRect();
        const link = stage.querySelector('.hero-link')?.getBoundingClientRect();
        return !!controls && !!link && (controls.left >= link.right || controls.top >= link.bottom);
      })).toBe(true);
    }
    await expect(page.locator('.scene-olive [data-hero-photo="1"]')).toBeVisible();
    expect(await sectionPositions(page)).toEqual(positions);
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

test("supplied desktop composition overlaps the artwork and puts controls at the foot", async ({ page }) => {
  await page.setViewportSize({ width:1047, height:749 });
  await openReview(page);
  await expect(page.locator('.scene-olive .eyebrow')).toHaveCount(0);
  await expect(page.locator('.nav .school-link')).toBeVisible();
  expect(await page.locator('.scene-olive h1').evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(155);
  expect(await page.locator('.olive-art img').evaluate(image => image instanceof HTMLImageElement && image.naturalWidth === 1448 && image.naturalHeight === 706)).toBe(true);
  expect(await page.locator('.hero-stage').evaluate(stage => {
    const art = stage.querySelector('.olive-art')?.getBoundingClientRect();
    const photo = stage.querySelector('.photo-print')?.getBoundingClientRect();
    const controls = stage.querySelector('.scene-controls')?.getBoundingClientRect();
    const link = stage.querySelector('.hero-link')?.getBoundingClientRect();
    const bottom = stage.getBoundingClientRect().bottom;
    const canvas = stage.querySelector('.welcome-canvas')?.getBoundingClientRect();
    return !!art && !!photo && !!controls && !!link && !!canvas && photo.width >= canvas.width * .36 && photo.left < art.right - art.width * .1 && photo.top < art.top + art.height * .2 && controls.top > bottom - 100 && Math.abs((controls.top + controls.height / 2) - (link.top + link.height / 2)) < 10;
  })).toBe(true);
  await page.locator('[data-scene-choice="you"]').click();
  await page.waitForTimeout(1250);
  expect(await page.locator('.scene-you').evaluate(panel => {
    const heading = panel.querySelector('h1')?.getBoundingClientRect();
    const art = panel.querySelector('.you-art')?.getBoundingClientRect();
    return !!heading && !!art && heading.top < art.top && heading.bottom > art.top && heading.left < art.left;
  })).toBe(true);
  expect(await page.locator('.scene-you .headline-line').first().evaluate(line => {
    const text = line.querySelector('.line-text');
    if (!text) throw new Error('Missing headline text');
    const range = document.createRange();
    range.selectNodeContents(text);
    return line.getBoundingClientRect().right - range.getBoundingClientRect().right >= Number.parseFloat(getComputedStyle(line).fontSize) * .1;
  })).toBe(true);
});

test("keyboard, history, reload and rapid reversal preserve control focus", async ({ page }) => {
  await openReview(page);
  const olive = page.locator('[data-scene-choice="olive"]');
  const you = page.locator('[data-scene-choice="you"]');
  const controls = page.locator('.scene-controls');
  await controls.focus();
  await page.keyboard.press("ArrowRight");
  await expect(controls).toBeFocused();
  await expect(page).toHaveURL(/scene=you/);
  await page.locator('.hero-link').focus();
  await expect(page.locator('.hero-link')).toBeFocused();
  await olive.click();
  await you.click();
  await olive.click();
  await page.goBack();
  await expect(you).toBeDisabled();
  await page.reload();
  await expect(you).toBeDisabled();
  await controls.focus();
  await page.evaluate(() => history.back());
  await expect(controls).toBeFocused();
  await expect(olive).toBeDisabled();
  const day = page.locator('[data-collection-choice="day"]');
  await day.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-collection-choice="culture"]')).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(day).toBeFocused();
});

test("full-width chapters, composed headings, cycling photographs and scroll lift", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openReview(page);
  await expect(page.locator('.review-notice')).toHaveCount(0);
  expect(await page.locator('.site-header').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(80);
  expect(await page.locator('.hero-stage,.crest-story,#campuses,.school-footer').evaluateAll(elements => elements.every(element => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.left) < 1 && Math.abs(rect.right - document.body.clientWidth) < 1;
  }))).toBe(true);
  await expect(page.locator('.scene-olive h1')).toHaveAccessibleName('Meet Olive.');
  await expect(page.locator('.scene-olive h1')).toHaveText('Meet');
  await expect(page.locator('.photo-print figcaption,.you-art figcaption,.you-photo')).toHaveCount(0);
  await expect(page.locator('.hero-stage .hero-link')).toHaveCount(1);
  const positions = await sectionPositions(page);
  for (const index of [1, 2, 3, 4, 0]) {
    await page.locator('[data-scene-choice="you"]').click();
    await expect(page.locator('.scene-you h1')).toHaveAccessibleName('A place for you.');
    await expect(page.locator('.scene-you h1 .headline-line')).toHaveText(['A place', 'for']);
    await page.locator('[data-scene-choice="olive"]').click();
    await expect(page.locator(`.scene-olive [data-hero-photo="${index}"]`)).toBeVisible();
    expect(await sectionPositions(page)).toEqual(positions);
  }
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await expect.poll(() => page.locator('.hero-stage').evaluate(element => Number.parseFloat(element.style.getPropertyValue('--hero-drift')))).toBeGreaterThan(0);
  await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'olive');
});

test("automatic welcomes wait six seconds without moving focus, history or announcements", async ({ page }) => {
  await page.clock.install();
  await openReview(page, "", true);
  const stage = page.locator('.hero-stage');
  const positions = await sectionPositions(page);
  const before = await page.evaluate(() => ({ history: history.length, url: location.href }));
  await expect(stage).toHaveAttribute('data-playing', 'true');
  await page.clock.fastForward(3000);
  await expect(stage).toHaveAttribute('data-scene', 'olive');
  await page.clock.fastForward(3001);
  await expect(stage).toHaveAttribute('data-scene', 'you');
  await page.clock.fastForward(6001);
  await expect(stage).toHaveAttribute('data-scene', 'olive');
  await expect(page.locator('[data-hero-photo="1"]')).toBeVisible();
  await page.clock.fastForward(6001);
  await expect(stage).toHaveAttribute('data-scene', 'you');
  expect(await sectionPositions(page)).toEqual(positions);
  expect(await page.evaluate(() => ({ history: history.length, url: location.href }))).toEqual(before);
  await expect(page.locator('#scene-status')).toBeEmpty();
  const play = page.locator('[data-welcome-play]');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await page.clock.fastForward(9000);
  await expect(stage).toHaveAttribute('data-scene', 'you');
  await play.click();
  await expect(play).toBeFocused();
  await page.clock.fastForward(6001);
  await expect(stage).toHaveAttribute('data-scene', 'olive');
  await expect(page.locator('[data-hero-photo="2"]')).toBeVisible();
  await expect(play).toBeFocused();
  await expect(stage).toHaveAttribute('data-playing', 'true');
  await page.locator('.scene-controls').focus();
  await page.clock.fastForward(9000);
  await expect(stage).toHaveAttribute('data-scene', 'olive');
  await expect(stage).toHaveAttribute('data-playing', 'false');
});

test("offscreen and hidden documents suspend the automatic cycle", async ({ page }) => {
  await openReview(page, "", true);
  const stage = page.locator('.hero-stage');
  await page.locator('#school-life').scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute('data-playing', 'false');
  const scene = await stage.getAttribute('data-scene');
  if (scene !== 'olive' && scene !== 'you') throw new Error('Expected an initialized welcome');
  await page.clock.install();
  await page.clock.fastForward(9000);
  await expect(stage).toHaveAttribute('data-scene', scene);
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute('data-playing', 'true');
  // Simulate the visibility event in this isolated page; no personal tab control.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(stage).toHaveAttribute('data-playing', 'false');
  await page.clock.fastForward(9000);
  await expect(stage).toHaveAttribute('data-scene', scene);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(stage).toHaveAttribute('data-playing', 'true');
  await page.clock.fastForward(6001);
  await expect(stage).toHaveAttribute('data-scene', scene === 'olive' ? 'you' : 'olive');
});

test("mouse drag changes the welcome without capturing vertical wheel", async ({ page }) => {
  await openReview(page);
  const image = await page.locator('.olive-art img').boundingBox();
  if (!image) throw new Error('Olive artwork not measurable');
  const x = image.x + image.width * .42;
  const y = image.y + image.height * .6;
  await page.mouse.move(x + 100, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'you');
  await expect(page).toHaveURL(/scene=you/);
  await expect(page.locator('.hero-stage')).not.toHaveAttribute('data-dragging');
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 250);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'you');
});

test("native touch swipe changes welcomes and vertical touch still scrolls", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto('/review/obhis');
    await expect(page.locator('.scene-controls')).toBeVisible();
    const session = await context.newCDPSession(page);
    const image = await page.locator('.olive-art img').boundingBox();
    if (!image) throw new Error('Touch artwork not measurable');
    const x = 280;
    const y = Math.min(650, image.y + image.height * .5);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - step * 20, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'you');
    await page.waitForTimeout(1250);
    const before = await page.evaluate(() => window.scrollY);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 650 }] });
    for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 160, y: 650 - step * 30 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 20);
    await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'you');
    await expect(page.locator('.hero-stage')).not.toHaveAttribute('data-dragging');
  } finally { await context.close(); }
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
  await expect(page.locator('[data-welcome-play]')).toBeDisabled();
  await expect(page.locator('.hero-stage')).toHaveAttribute('data-playing', 'false');
  await page.waitForTimeout(3300);
  await expect(page.locator('.hero-stage')).toHaveAttribute('data-scene', 'you');
  await page.locator('[data-scene-choice="olive"]').click();
  await page.locator('[data-collection-choice="culture"]').click();
  expect(await page.locator('.scene').evaluateAll(elements => elements.every(element => getComputedStyle(element).transitionDuration === "0s"))).toBe(true);
  expect(await page.locator('.album-photo img').evaluateAll(elements => elements.every(element => getComputedStyle(element).animationName === "none"))).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.locator('.hero-stage').evaluate(element => getComputedStyle(element).getPropertyValue('--hero-drift').trim())).toBe('0px');
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
  await expect(page.locator('.scene-olive [data-hero-photo="0"]')).toBeVisible();
  for (const photo of await page.locator(".album-photo").all()) await expect(photo).toBeVisible();
  await page.locator("#application-guide summary").click();
  await expect(page.locator("#application-guide")).toHaveAttribute("open", "");
  await page.locator('.album-photo[data-photo="0"]').click();
  expect(page.url()).toContain("/review/obhis/assets/school-friends");
  await context.close();
});
