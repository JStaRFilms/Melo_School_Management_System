const { chromium } = require("@playwright/test");
const c = require("./launch-common.cjs");
const crypto = require("node:crypto");
const origin = "https://www.oliveblessed.com";
const uploads = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upload-ledger.json"), "utf8"));
const expectedIcon = `/api/site-assets/${uploads.assets.find(asset => asset.fieldId === "school_logo").assetId}`;
const result = { checkedAt: new Date().toISOString(), canonical: origin, checks: [] };
const assert = (ok, text) => { if (!ok) throw new Error(text); result.checks.push(text); };
(async () => {
  const home = await fetch(origin, { signal: AbortSignal.timeout(20000) });
  const html = await home.text();
  assert(home.status === 200 && html.includes("Olive Blessed Crest Academy"), "Canonical HTTPS homepage serves approved school content");
  const iconLinks = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).filter(link => /rel="(?:icon|apple-touch-icon)"/.test(link));
  assert(iconLinks.length === 2 && iconLinks.every(link => link.includes(`href="${expectedIcon}"`)), "Favicon and Apple icon use the published school logo only");
  const manifestResponse = await fetch(`${origin}/manifest.webmanifest`, { signal: AbortSignal.timeout(20000) });
  const manifest = await manifestResponse.json();
  assert(manifestResponse.status === 200 && manifest.name === "Olive Blessed Crest Academy" && manifest.icons?.length === 1 && manifest.icons[0].src === expectedIcon, "Manifest icon matches published school logo");
  const alias = await fetch("https://oliveblessed.com/", { redirect: "manual", signal: AbortSignal.timeout(20000) });
  assert(alias.status === 308 && alias.headers.get("location") === `${origin}/`, "Apex redirects to canonical HTTPS www host");
  for (const hostname of c.hosts) {
    const marker = await fetch(`https://${hostname}/.well-known/school-sites-deployment`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    assert(marker.status === 200 && await marker.text() === "school-sites-production-core:v1\n", `Exact deployment marker remains valid on ${hostname}`);
  }
  const assets = await Promise.all(uploads.assets.map(async asset => {
    const response = await fetch(`${origin}/api/site-assets/${asset.assetId}`, { signal: AbortSignal.timeout(20000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { fieldId: asset.fieldId, status: response.status, matches: crypto.createHash("sha256").update(bytes).digest("hex") === asset.checksum };
  }));
  assert(assets.every(asset => asset.status === 200 && asset.matches), "All nine original approved image byte checksums remain unchanged");
  result.assets = assets;
  for (const pathname of ["/review/obhis", "/review/obhis/assets/school_logo"]) {
    const response = await fetch(origin + pathname, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    assert(response.status === 404, `Private route remains unavailable: ${pathname}`);
  }
  const editorEvidence = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upkeep-browser-evidence/editor.json"), "utf8"));
  const privateAsset = await fetch(`${origin}/api/site-assets/${editorEvidence.copiedAssetId}`, { signal: AbortSignal.timeout(20000) });
  assert(privateAsset.status === 404, "New Admin-logo copy remains private and was not silently published");
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin, { waitUntil: "networkidle" });
    const observed = await page.evaluate(() => ({ icon: document.querySelector('link[rel="icon"]')?.getAttribute("href"),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") }));
    assert(observed.icon === expectedIcon && observed.canonical === `${origin}/`, "Fresh browser receives correct icon and canonical metadata");
    await page.screenshot({ path: c.path.join(__dirname, "upkeep-browser-evidence/public-desktop.png") });
    await page.getByRole("button", { name: "Cultural day", exact: true }).click();
    assert(await page.getByRole("button", { name: "Cultural day", exact: true }).getAttribute("aria-pressed") === "true", "Public gallery category control works");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin, { waitUntil: "networkidle" });
    const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      brokenVisibleImages: [...document.images].filter(image => image.getBoundingClientRect().width > 0 && image.complete && !image.naturalWidth).length }));
    assert(mobile.scrollWidth <= mobile.width && mobile.brokenVisibleImages === 0 && errors.length === 0, "Mobile public page has no document overflow, visible broken images or page errors");
    result.mobile = mobile;
    await page.screenshot({ path: c.path.join(__dirname, "upkeep-browser-evidence/public-mobile.png") });
  } finally { await browser.close(); }
  c.fs.writeFileSync(c.path.join(__dirname, "upkeep-public-verification.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
})().catch(error => { console.error(JSON.stringify({ stopped: true, error: error.message })); process.exitCode = 1; });
