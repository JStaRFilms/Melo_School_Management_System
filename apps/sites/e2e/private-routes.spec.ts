import { test, expect } from "@playwright/test";

const denied = ["denied", "production"].includes(process.env.OBHIS_TEST_MODE ?? "");

test("private page and exact-key assets respect the server gate", async ({ request }) => {
  const page = await request.get("/review/obhis");
  expect(page.status()).toBe(denied ? 404 : 200);
  const markup = await page.text();
  expect(markup.includes("Imagined artwork.")).toBe(!denied);
  if (denied) expect(markup).not.toContain("Olive Blessed Crest Academy");
  if (!denied) {
    expect(markup).toContain("noindex");
    // Next dev owns page cache headers; assets must explicitly be no-store.
    expect(page.headers()["cache-control"]).toContain("no-cache");
  }
  for (const key of ["school-logo", "hero-cutout", "you-hero", "classroom-moment", "school-friends", "classroom-table", "cultural-day-abuja", "cultural-day-rugam", "uniform-detail"]) {
    const asset = await request.get(`/review/obhis/assets/${key}`);
    expect(asset.status()).toBe(denied ? 404 : 200);
    expect(asset.headers()["cache-control"]).toContain("no-store");
    expect(asset.headers()["x-robots-tag"]).toContain("noindex");
    if (denied) expect((await asset.body()).length).toBe(0);
    else expect(asset.headers()["content-type"]).toMatch(/^image\/(png|webp)$/);
  }
});

test("unknown keys and traversal never return private bytes", async ({ request }) => {
  for (const key of ["unknown", "__proto__", "constructor", "school-friends.webp", "..%2Fschool-friends.webp", "%2e%2e%2f%2e%2e%2fpackage.json", "%252e%252e%252fpackage.json"]) {
    const response = await request.get(`/review/obhis/assets/${key}`);
    expect([400, 404]).toContain(response.status());
    expect(response.headers()["content-type"] ?? "").not.toContain("image/");
  }
});

test("legacy demo, aliases, unknown and inactive hosts stay separate", async ({ request }) => {
  const active = await request.get("/", { headers: { host: "greenfield.schoolos.localhost" } });
  expect(active.status()).toBe(200);
  expect(await active.text()).toContain("Greenfield");
  expect(await active.text()).not.toContain("Private homepage review");
  const alias = await request.get("/admissions?source=test", { headers: { host: "greenfield.localhost" }, maxRedirects: 0 });
  expect(alias.status()).toBe(308);
  expect(alias.headers().location).toContain("greenfield.schoolos.localhost/admissions?source=test");
  const unknown = await request.get("/", { headers: { host: "unconfigured.invalid" } });
  expect(unknown.status()).toBe(404);
  expect(await unknown.text()).toContain("noindex");
  const inactive = await request.get("/", { headers: { host: "legacy-heights.schoolos.localhost" } });
  expect(inactive.status()).toBe(404);
  const sitemap = await request.get("/sitemap.xml", { headers: { host: "greenfield.schoolos.localhost" } });
  expect(await sitemap.text()).not.toContain("/review/obhis");
});
