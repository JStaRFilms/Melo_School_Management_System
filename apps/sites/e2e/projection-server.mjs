import { createServer } from "node:http";

const port = Number(process.env.SITE_E2E_PROJECTION_PORT ?? 4010);
const previewCapability = "test-preview-capability-bound-to-alias-and-draft";
const previewHost = "alias.obhis.localhost";

function routeSeo() {
  return {
    home: { title: "Approved test identity", description: "Approved test summary." },
    admissions: { title: "Admissions — Approved test identity", description: "Approved test admissions guidance." },
    visit: { title: "Visit — Approved test identity", description: "Approved test visit guidance." },
    "policy-detail": { title: "Approved test policy — Approved test identity", description: "Approved test policy summary." },
  };
}

function envelope(hostname, preview = false) {
  const unavailable = hostname.startsWith("unavailable.");
  const canonical = unavailable ? hostname : "obhis.localhost";
  const domains = unavailable
    ? [{ id: "canonical", hostname: canonical, status: "active", canonicalIntent: "canonical" }]
    : [
      { id: "canonical", hostname: canonical, status: "active", canonicalIntent: "canonical" },
      { id: "alias", hostname: previewHost, status: "active", canonicalIntent: "redirect", canonicalDomainId: "canonical" },
    ];
  const fields = unavailable ? {
    "identity.displayName": { kind: "text", value: "Approved test identity" },
  } : {
    "identity.displayName": { kind: "text", value: "Approved test identity" },
    "home.hero.summary": { kind: "text", value: "Approved test summary." },
    "admissions.lead": { kind: "text", value: "Approved test admissions guidance." },
    "admissions.steps": { kind: "string_list", value: ["Approved step one", "Approved step two"] },
    "visit.lead": { kind: "text", value: "Approved test visit guidance." },
    "contact.address": { kind: "text", value: "Approved test address" },
    "contact.address.country": { kind: "text", value: "NG" },
    "policies.ids": { kind: "string_list", value: ["test-policy"] },
    "policies.test-policy.title": { kind: "text", value: "Approved test policy" },
    "policies.test-policy.summary": { kind: "text", value: "Approved test policy summary." },
  };
  return {
    profile: { schoolId: "e2e", schoolSlug: "approved-test-school", mode: "managed", status: preview ? "draft" : "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", canonicalDomainId: "canonical" },
    domains,
    revision: { id: preview ? "draft-revision" : "published-revision", state: preview ? "draft" : "published", rendererKey: "obhis-v1", rendererSchemaVersion: "1", publishedAt: preview ? undefined : 1_700_000_000_000, fields, routeSeo: routeSeo() },
    assets: [],
    links: { application: { version: "1", schoolSlug: "approved-test-school", href: "https://apply.example/s/approved-test-school", availability: "open", intakeSlug: null, opensAt: null, closesAt: null } },
    ...(preview ? { preview: { authorized: true, expiresAt: Date.now() + 60_000 } } : {}),
  };
}

createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const isPreview = request.method === "POST" && requestUrl.pathname === "/preview";
  if (isPreview) {
    let body;
    try { body = JSON.parse(await new Promise((resolve, reject) => { let text = ""; request.on("data", (chunk) => { text += chunk; }); request.on("end", () => resolve(text)); request.on("error", reject); })); } catch { response.writeHead(404).end(); return; }
    // The test-only capability deliberately verifies the same host and revision
    // binding exercised by the production B0 preview projection.
    if (body?.hostname !== previewHost || body?.previewToken !== previewCapability) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify(envelope(previewHost, true)));
    return;
  }
  const hostname = requestUrl.searchParams.get("hostname") ?? "";
  response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(envelope(hostname)));
}).listen(port, "127.0.0.1");
