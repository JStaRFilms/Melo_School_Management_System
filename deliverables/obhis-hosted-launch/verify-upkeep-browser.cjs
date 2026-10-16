const { chromium, expect } = require("@playwright/test");
const c = require("./launch-common.cjs");
const role = process.argv[2];
const expected = role === "reviewer" ? "admin.fedrah@oliveblessed.com" : "obhischool@gmail.com";
if (!["reviewer", "publisher", "editor", "platform"].includes(role)) throw new Error("Unknown browser verification role");
if (role !== "platform" && process.env.MELO_USERNAME?.trim().toLowerCase() !== expected) throw new Error("Wrong real account for verification role");
const origin = role === "platform" ? "https://superadmin.meloschool.com" : "https://admin.meloschool.com";
const directory = c.path.join(__dirname, "upkeep-browser-evidence");
c.fs.mkdirSync(directory, { recursive: true });
let stage = "launch", signedIn = false, context, browser, page;
(async () => {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  stage = "sign-in";
  await page.goto(`${origin}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(process.env.MELO_USERNAME);
  await page.locator('input[type="password"]').fill(process.env.MELO_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes("sign-in"), { timeout: 30000 });
  signedIn = true;
  stage = "site-controls";
  await page.goto(`${origin}${role === "platform" ? `/schools/${c.schoolId}/site` : "/admin/settings/site"}`, { waitUntil: "domcontentloaded" });
  const result = { role, realAccount: true, checks: [], screenshots: [] };
  if (role === "platform") {
    await expect(page.getByRole("heading", { name: "www.oliveblessed.com", exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Persistent authoritative TXT proof/).first()).toBeVisible();
    result.checks.push("Exact Olive domains show persistent ownership without manual monthly renewal");
  } else {
    await expect(page.getByText(/Renderer: obhis-v1 \/ 1\. Status: published/)).toBeVisible({ timeout: 30000 });
    if (role === "reviewer") {
      await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Publish saved draft", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Upload privately", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Review school_name", exact: true }).click();
      await page.getByRole("combobox", { name: /Authorization source/ }).selectOption("owner_attestation");
      await page.getByRole("combobox", { name: /Approval lifetime/ }).selectOption("until_revoked");
      await page.getByLabel("Independent source reference", { exact: true }).fill("Owner attestation already recorded by the independent reviewer in this launch thread; UI verification only.");
      await page.getByRole("checkbox").check();
      await expect(page.getByRole("button", { name: "Record independent approval", exact: true })).toBeEnabled();
      result.checks.push("Reviewer has source/lifetime approval controls without edit/upload/publish controls", "Until-revoked owner-attestation form becomes valid; no duplicate approval submitted");
    }
    if (role === "publisher") {
      await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Review school_name", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Publish saved draft", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "Check publication gates", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Evidence check passed for this draft" })).toBeVisible({ timeout: 30000 });
      result.checks.push("Publisher can validate and publish saved content without editing/review controls", "Actual deployed publication gate passed; no extra publication created by UI test");
    }
    if (role === "editor") {
      await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Publish saved draft", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Review school_name", exact: true })).toHaveCount(0);
      await page.getByLabel("Alternative text", { exact: true }).fill("School logo: Integrity and Service");
      page.once("dialog", dialog => dialog.message().startsWith("Copy this school's current Admin logo") ? dialog.accept() : dialog.dismiss());
      const responsePromise = page.waitForResponse(response => response.url() === `${origin}/api/site-assets/upload`, { timeout: 30000 });
      await page.getByRole("button", { name: "Copy Admin logo privately", exact: true }).click();
      const upload = await responsePromise;
      if (!upload.ok()) throw new Error("Actual Admin-logo private upload failed");
      const copied = await upload.json();
      result.copiedAssetResponseKeys = Object.keys(copied);
      result.copiedAssetId = copied.assetId;
      if (!copied.assetId) throw new Error("Copied asset result needs inspection before any retry");
      await expect(page.getByRole("status").filter({ hasText: /copied privately/i })).toBeVisible({ timeout: 30000 });
      await page.getByRole("combobox", { name: /^school_logo/ }).selectOption(copied.assetId);
      result.checks.push("Selected school's actual Admin logo downloaded and copied through authenticated private upload", "Editor cannot approve or publish; copied logo was not saved or published");
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Renderer: obhis-v1 \/ 1\. Status: published/)).toBeVisible({ timeout: 30000 });
      const original = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upload-ledger.json"), "utf8")).assets.find(asset => asset.fieldId === "school_logo");
      await expect(page.getByRole("combobox", { name: /^school_logo/ })).toHaveValue(original.assetId);
      result.checks.push("Reload discarded the unsaved logo selection; original website draft preserved");
    }
  }
  const desktop = c.path.join(directory, `${role}-desktop.png`);
  await page.screenshot({ path: desktop }); result.screenshots.push(desktop);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Tab");
  result.mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, keyboardFocusTag: document.activeElement?.tagName }));
  const mobile = c.path.join(directory, `${role}-mobile.png`);
  await page.screenshot({ path: mobile }); result.screenshots.push(mobile);
  result.pageErrorCount = pageErrors.length;
  c.fs.writeFileSync(c.path.join(directory, `${role}.json`), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
})().catch(async error => {
  if (page) {
    await page.screenshot({ path: c.path.join(directory, `${role}-failed.png`) }).catch(() => {});
    console.log(JSON.stringify({ role, currentUrl: page.url(), alerts: await page.getByRole("alert").allTextContents(), labels: (await page.locator("label").allTextContents()).map(text => text.slice(0, 160)) }));
  }
  let message = error.message;
  for (const secret of [process.env.MELO_PASSWORD]) if (secret) message = message.replaceAll(secret, "[redacted]");
  console.error(JSON.stringify({ role, stage, stopped: true, error: message.slice(0, 1200) })); process.exitCode = 1;
}).finally(async () => {
  if (context) {
    if (signedIn) {
      try { const response = await context.request.post(`${origin}/api/auth/sign-out`, { data: {}, headers: { Origin: origin } }); console.log(JSON.stringify({ role, temporaryBrowserSessionSignedOut: response.ok() })); }
      catch { console.log(JSON.stringify({ role, signOutUnverified: true })); }
    }
    await context.clearCookies(); await context.close();
  }
  if (browser) await browser.close();
});
