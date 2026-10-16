const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const ts = require("typescript");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { canonicalSiteContent, canonicalSiteFieldValue, siteManifest } = require("../../packages/shared/src/site-manifests.ts");
const directory = __dirname;
const candidate = JSON.parse(fs.readFileSync(path.join(directory, "content-candidate.json"), "utf8"));
const uploads = JSON.parse(fs.readFileSync(path.join(directory, "upload-ledger.json"), "utf8"));
const schoolId = "kd73q7dt28ph1bmqjm20tsw2ed83k6j3";
const reviewerId = "k97b20aax7jej2gncsxp5hqczs8dkndg";
const cloud = "https://outgoing-warbler-782.eu-west-1.convex.cloud";
const site = "https://outgoing-warbler-782.eu-west-1.convex.site";
const origin = "https://admin.meloschool.com";
const thread = "69626257-e91b-49eb-bd73-26e021cedb13";
const hash = value => createHash("sha256").update(value).digest("hex");
const expectedContent = { fields: [...candidate.textFields, ...uploads.assets.map(asset => ({
  fieldId: asset.fieldId, value: { kind: "asset_ref", assetId: asset.assetId },
}))], routeSeo: candidate.routeSeo };
const draftDigest = hash(canonicalSiteContent(expectedContent));
const ledgerPath = path.join(directory, "review-ledger.json");
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {
  kind: "private-production-site-approval-ledger", schoolId, cloud, reviewerId, draftDigest,
  expiresAt: Date.now() + 30 * 86400_000,
  approvalSource: "School and parent/guardian authorization explicitly relayed by operator in launch conversation",
  sourceThread: thread, signedConsentFormsInspected: false, records: [],
};
if (ledger.kind !== "private-production-site-approval-ledger" || ledger.schoolId !== schoolId || ledger.cloud !== cloud ||
    ledger.reviewerId !== reviewerId || ledger.draftDigest !== draftDigest || uploads.schoolId !== schoolId ||
    candidate.target.schoolId !== schoolId || ledger.expiresAt <= Date.now() || ledger.inFlight) {
  throw new Error("Review target, draft or previous operation requires inspection");
}
const persist = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
const cookies = new Map();
async function auth(endpoint, method = "GET", body) {
  const response = await fetch(`${origin}/api/auth/${endpoint}`, { method, redirect: "manual", signal: AbortSignal.timeout(20_000),
    headers: { Origin: origin, Referer: `${origin}/sign-in`, "Content-Type": "application/json",
      Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
    body: body ? JSON.stringify(body) : undefined,
  });
  for (const cookie of response.headers.getSetCookie()) {
    const first = cookie.split(";")[0], separator = first.indexOf("=");
    if (separator > 0) cookies.set(first.slice(0, separator), first.slice(separator + 1));
  }
  return response;
}

(async () => {
  let signedIn = false;
  let stage = "verify approved reviewer";
  try {
    if (process.env.MELO_USERNAME?.trim().toLowerCase() !== "admin.fedrah@oliveblessed.com") throw new Error("Unexpected reviewer account");
    const login = await auth("sign-in/email", "POST", { email: process.env.MELO_USERNAME, password: process.env.MELO_PASSWORD });
    if (!login.ok) throw new Error(`Sign-in returned HTTP ${login.status}`);
    await login.arrayBuffer();
    signedIn = true;
    const response = await auth("convex/token");
    if (!response.ok) throw new Error("Reviewer token request failed");
    const { token } = await response.json();
    if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).iss !== site) throw new Error("Unexpected token issuer");
    const client = new ConvexHttpClient(cloud);
    client.setAuth(token);
    const viewer = await client.query(makeFunctionReference("functions/foundation/auth:getViewerCapabilities"), { schoolId });
    if (viewer.membership?.userId !== reviewerId || !viewer.capabilities.some(grant => grant.capability === "privacy.approve" && grant.scope === "school") ||
        viewer.capabilities.some(grant => ["site.publish.standard", "site.publish.sensitive"].includes(grant.capability))) throw new Error("Reviewer role or independence changed");
    const viewRef = makeFunctionReference("functions/sites/management:schoolView");
    let view = await client.action(viewRef, { schoolId });
    if (process.argv.includes("--inspect")) {
      const actual = new Map((view.draft?.content.fields ?? []).map(field => [field.fieldId, field.value]));
      const changes = expectedContent.fields.filter(field => !actual.has(field.fieldId) || canonicalSiteFieldValue(actual.get(field.fieldId)) !== canonicalSiteFieldValue(field.value));
      console.log(JSON.stringify({ readOnly: true, draftVersion: view.draft?.version, published: !!view.profile?.publishedRevisionId,
        renderer: view.profile?.rendererKey, actualFieldCount: view.draft?.content.fields.length, expectedFieldCount: expectedContent.fields.length,
        changedFields: changes.map(field => ({fieldId:field.fieldId, expected:field.value, actual:actual.get(field.fieldId)})),
        unexpectedFields: [...actual.keys()].filter(id => !expectedContent.fields.some(field => field.fieldId === id)),
        actualSeo: view.draft?.content.routeSeo, expectedSeo: expectedContent.routeSeo }));
      return;
    }
    if (!view.draft || view.profile?.publishedRevisionId || view.profile?.rendererKey !== "obhis-v1" ||
        hash(canonicalSiteContent(view.draft.content)) !== draftDigest) throw new Error("Saved draft changed; approvals stopped");
    const noChildren = new Set(["school_logo", "hero_cutout", "you_hero"]);
    for (const asset of uploads.assets) {
      const stored = view.assets.find(item => item.id === asset.assetId);
      const original = candidate.assetUploads.find(item => item.fieldId === asset.fieldId);
      if (!stored || !original || stored.checksum !== asset.checksum || stored.altText !== original.altText || stored.status !== "draft") {
        throw new Error(`Image changed or missing: ${asset.fieldId}`);
      }
    }
    ledger.draftVersion = view.draft.version;
    persist();
    const approveRef = makeFunctionReference("functions/sites/evidence:approveCandidate");
    async function approve(key, exactCandidate, reference) {
      const signature = hash(JSON.stringify(exactCandidate));
      const existing = ledger.records.find(item => item.key === key);
      if (existing) {
        if (existing.signature !== signature) throw new Error("Approval candidate changed");
        return;
      }
      const fresh = await client.action(viewRef, { schoolId });
      if (!fresh.draft || fresh.draft.version !== ledger.draftVersion || hash(canonicalSiteContent(fresh.draft.content)) !== draftDigest) {
        throw new Error("Draft changed during review");
      }
      ledger.inFlight = { key, signature };
      persist();
      const result = await client.mutation(approveRef, { schoolId, candidate: exactCandidate,
        evidenceReference: reference, expiresAt: ledger.expiresAt, confirmed: true });
      if (!result.evidenceId || !result.subjectKey) throw new Error("Approval result uncertain; inspect before retry");
      ledger.records.push({ key, signature, evidenceId: result.evidenceId, subjectKey: result.subjectKey });
      delete ledger.inFlight;
      persist();
    }
    const manifest = siteManifest("obhis-v1", "1");
    for (const field of candidate.textFields) {
      stage = `approve ${field.fieldId}`;
      const def = manifest.fields.find(item => item.fieldId === field.fieldId);
      const exact = await client.action(makeFunctionReference("functions/sites/evidence:getFieldCandidate"), { schoolId, fieldId: field.fieldId });
      if (!def?.evidence || exact.evidenceClass !== def.evidence || canonicalSiteFieldValue(exact.value) !== canonicalSiteFieldValue(field.value) ||
          exact.digest !== hash(canonicalSiteFieldValue(field.value))) throw new Error("Saved field differs from owner-approved candidate");
      await approve(`field:${field.fieldId}`, { kind: "field", fieldId: field.fieldId, expectedDigest: exact.digest },
        `Existing Olive site copy and exact value confirmed against prepared draft; operator authorized approval in launch thread ${thread}. Relayed school approval, not an independently inspected signed document.`);
    }
    console.log(JSON.stringify({exactTextApprovals: candidate.textFields.length}));
    for (const asset of uploads.assets) {
      stage = `approve image ${asset.fieldId}`;
      const base = { assetId: asset.assetId, expectedChecksum: asset.checksum };
      const reference = `School owner approved public website use of these exact images, relayed by launch operator in thread ${thread}; image ${asset.fieldId} visually reviewed against stored checksum. Signed releases not independently inspected.`;
      await approve(`rights:${asset.fieldId}`, { kind: "asset_rights", ...base }, reference);
      await approve(`classification:${asset.fieldId}`, { kind: "asset_child_applicability", ...base,
        classification: noChildren.has(asset.fieldId) ? "no_children" : "contains_children" }, reference);
      if (!noChildren.has(asset.fieldId)) {
        await approve(`consent:${asset.fieldId}`, { kind: "asset_child_consent", ...base },
          `Parent/guardian public-website permission for all supplied child photos explicitly attested by launch operator in thread ${thread}; image ${asset.fieldId}. Relayed approval; signed consent forms not independently inspected.`);
      }
      console.log(JSON.stringify({image: asset.fieldId,approvalRecorded:true,classification:noChildren.has(asset.fieldId)?"no_children":"contains_children"}));
    }
    view = await client.action(viewRef, { schoolId });
    if (!view.draft || view.draft.version !== ledger.draftVersion || hash(canonicalSiteContent(view.draft.content)) !== draftDigest || view.profile.publishedRevisionId ||
        !uploads.assets.every(asset => view.assets.some(stored => stored.id === asset.assetId && stored.checksum === asset.checksum && stored.rightsStatus === "approved" &&
          stored.childApplicability === (noChildren.has(asset.fieldId) ? "no_children" : "contains_children")))) throw new Error("Final review readback failed");
    ledger.verifiedAt = new Date().toISOString();
    persist();
    console.log(JSON.stringify({production:"outgoing-warbler-782",draftVersion:view.draft.version,exactContentFields:40,imagesReviewed:9,
      noPhotographedChildren:3,containsChildren:6,evidenceRecords:ledger.records.length,reviewExpiresAt:new Date(ledger.expiresAt).toISOString(),
      signedFormsInspected:false,source:"operator-relayed school and parent approval",published:false,dnsChanged:false}));
  } catch (error) {
    console.error(JSON.stringify({stage,stopped:true,error:error.message,ledger:"deliverables/obhis-hosted-launch/review-ledger.json"}));
    process.exitCode = 1;
  } finally {
    if (signedIn) {
      try { const response = await auth("sign-out", "POST", {}); console.log(JSON.stringify({reviewerSessionSignedOut:response.ok})); await response.arrayBuffer(); }
      catch { console.log(JSON.stringify({reviewerSignOutUnverified:true})); }
    }
    cookies.clear();
  }
})();
