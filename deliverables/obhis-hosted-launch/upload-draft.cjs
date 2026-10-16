const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const ts = require("typescript");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");

require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { cleanImage } = require("../../packages/convex/functions/sites/image.ts");
const { siteManifest, validateSiteContent, canonicalSiteContent } = require("../../packages/shared/src/site-manifests.ts");
const directory = __dirname;
const ledgerPath = path.join(directory, "upload-ledger.json");
const candidate = JSON.parse(fs.readFileSync(path.join(directory, "content-candidate.json"), "utf8"));
const schoolId = "kd73q7dt28ph1bmqjm20tsw2ed83k6j3";
const cloud = "https://outgoing-warbler-782.eu-west-1.convex.cloud";
const site = "https://outgoing-warbler-782.eu-west-1.convex.site";
const origin = "https://admin.meloschool.com";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const cookies = new Map();
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {
  kind: "private-production-site-upload-ledger", schoolId, cloud, assets: [],
};
if (ledger.kind !== "private-production-site-upload-ledger" || ledger.schoolId !== schoolId || ledger.cloud !== cloud ||
    candidate.target.schoolId !== schoolId || candidate.target.deployment !== "prod:outgoing-warbler-782") {
  throw new Error("Unexpected upload target or ledger");
}
const persist = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });

async function auth(endpoint, method = "GET", body) {
  const response = await fetch(`${origin}/api/auth/${endpoint}`, {
    method, redirect: "manual", signal: AbortSignal.timeout(20_000),
    headers: { Origin: origin, Referer: `${origin}/sign-in`, "Content-Type": "application/json",
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(";")[0];
    const separator = first.indexOf("=");
    cookies.set(first.slice(0, separator), first.slice(separator + 1));
  }
  return response;
}

(async () => {
  let signedIn = false;
  let stage = "verify approved editor";
  try {
    if (process.env.MELO_USERNAME?.trim().toLowerCase() !== "obhischool@gmail.com") throw new Error("Unexpected editor account");
    const prepared = candidate.assetUploads.map(asset => {
      const bytes = fs.readFileSync(path.join(directory, asset.file));
      if (hash(bytes) !== asset.preparedSha256) throw new Error(`Prepared image changed: ${asset.fieldId}`);
      return { ...asset, bytes, expectedChecksum: hash(cleanImage(bytes, "image/png").bytes) };
    });
    stage = "authenticate editor";
    const login = await auth("sign-in/email", "POST", { email: process.env.MELO_USERNAME, password: process.env.MELO_PASSWORD });
    if (!login.ok) throw new Error(`Sign-in returned HTTP ${login.status}`);
    await login.arrayBuffer();
    signedIn = true;
    const tokenResponse = await auth("convex/token");
    if (!tokenResponse.ok) throw new Error("Token request failed");
    const { token } = await tokenResponse.json();
    if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).iss !== site) throw new Error("Unexpected token issuer");
    const client = new ConvexHttpClient(cloud);
    client.setAuth(token);
    const viewRef = makeFunctionReference("functions/sites/management:schoolView");
    stage = "verify editor access and private profile";
    let view = await client.action(viewRef, { schoolId });
    if (!view.canEdit || view.profile?.rendererKey !== "obhis-v1" || view.profile.rendererSchemaVersion !== "1" || view.profile.publishedRevisionId) {
      throw new Error("Unexpected website profile or missing editor access");
    }
    if (view.assets.length >= 30) throw new Error("Asset inventory is incomplete; manual comparison required");
    if (view.draft && !ledger.draft) throw new Error("An existing draft needs review before replacement");
    for (const asset of prepared) {
      stage = `upload ${asset.fieldId}`;
      const fileName = `${asset.fieldId}.png`;
      const matches = view.assets.filter(item => item.checksum === asset.expectedChecksum && item.fileName === fileName &&
        item.kind === asset.kind && item.altText === asset.altText && !item.decorative && item.status !== "retired");
      if (matches.length > 1) throw new Error("Duplicate matching assets need review");
      let assetId = matches[0]?.id;
      if (!assetId) {
        if (ledger.assets.some(item => item.fieldId === asset.fieldId)) throw new Error("Previously recorded asset is missing or changed");
        const response = await fetch(`${site}/sites/asset-upload`, {
          method: "POST", redirect: "manual", signal: AbortSignal.timeout(60_000),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png", "Content-Length": String(asset.bytes.length),
            "X-Site-School": schoolId, "X-Site-Kind": asset.kind,
            "X-Site-Filename-Uri-V1": encodeURIComponent(fileName), "X-Site-Alt-Uri-V1": encodeURIComponent(asset.altText) },
          body: asset.bytes,
        });
        if (response.status !== 201) throw new Error(`Upload returned HTTP ${response.status}; not retried`);
        const uploaded = await response.json();
        if (typeof uploaded.assetId !== "string") throw new Error("Upload result is uncertain; inspect before retrying");
        assetId = uploaded.assetId;
      }
      const entry = { fieldId: asset.fieldId, assetId, checksum: asset.expectedChecksum, fileName };
      const existing = ledger.assets.find(item => item.fieldId === asset.fieldId);
      if (existing && (existing.assetId !== assetId || existing.checksum !== entry.checksum)) throw new Error("Ledger conflicts with uploaded asset");
      if (!existing) ledger.assets.push(entry);
      persist();
      console.log(JSON.stringify({ field: asset.fieldId, privateAssetRecorded: true }));
    }
    stage = "verify uploaded bytes and build real content references";
    view = await client.action(viewRef, { schoolId });
    if (!ledger.assets.every(entry => view.assets.some(asset => asset.id === entry.assetId && asset.checksum === entry.checksum && asset.status === "draft"))) {
      throw new Error("Uploaded asset verification failed");
    }
    const content = { fields: [...candidate.textFields, ...ledger.assets.map(asset => ({ fieldId: asset.fieldId, value: { kind: "asset_ref", assetId: asset.assetId } }))], routeSeo: candidate.routeSeo };
    validateSiteContent(content, siteManifest("obhis-v1", "1"));
    stage = "save unpublished content draft";
    if (view.draft) {
      if (canonicalSiteContent(view.draft.content) !== canonicalSiteContent(content)) throw new Error("Existing draft differs; refusing overwrite");
    } else {
      ledger.draft = await client.mutation(makeFunctionReference("functions/sites/content:saveDraft"), { schoolId, content, expectedDraftVersion: 0 });
      persist();
    }
    const saved = await client.action(viewRef, { schoolId });
    if (!saved.draft || canonicalSiteContent(saved.draft.content) !== canonicalSiteContent(content) || saved.profile.publishedRevisionId) throw new Error("Saved draft verification failed");
    ledger.verifiedDraftVersion = saved.draft.version;
    ledger.verifiedAt = new Date().toISOString();
    persist();
    console.log(JSON.stringify({ production: "outgoing-warbler-782", privateImages: ledger.assets.length,
      draftFields: saved.draft.content.fields.length, draftVersion: saved.draft.version,
      assetsPendingReview: saved.assets.filter(asset => asset.rightsStatus !== "approved" || asset.childApplicability === "unknown").length,
      published: false, dnsChanged: false }));
  } catch (error) {
    console.error(JSON.stringify({ stage, stopped: true, error: error.message, ledger: "deliverables/obhis-hosted-launch/upload-ledger.json" }));
    process.exitCode = 1;
  } finally {
    if (signedIn) {
      try { const response = await auth("sign-out", "POST", {}); console.log(JSON.stringify({ editorSessionSignedOut: response.ok })); await response.arrayBuffer(); }
      catch { console.log(JSON.stringify({ editorSignOutUnverified: true })); }
    }
    cookies.clear();
  }
})();
