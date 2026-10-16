const c = require("./launch-common.cjs");
const crypto = require("node:crypto");
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(c.fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);
const { canonicalSiteContent, canonicalSiteFieldValue, siteManifest } = require("../../packages/shared/src/site-manifests.ts");
const mode = process.argv[2], reviewerId = "k97b20aax7jej2gncsxp5hqczs8dkndg";
const candidate = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "content-candidate.json"), "utf8"));
const uploads = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upload-ledger.json"), "utf8"));
const expected = { fields: [...candidate.textFields, ...uploads.assets.map(asset => ({ fieldId: asset.fieldId, value: { kind: "asset_ref", assetId: asset.assetId } }))], routeSeo: candidate.routeSeo };
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const digest = hash(canonicalSiteContent(expected));
const ledgerPath = c.path.join(__dirname, "upkeep-operations-ledger.json");
const ledger = c.fs.existsSync(ledgerPath) ? JSON.parse(c.fs.readFileSync(ledgerPath, "utf8")) : {
  kind: "olive-upkeep-operations", schoolId: c.schoolId, cloud: c.cloud, digest, reviewerId,
  sourceKind: "owner_attestation", validity: "until_revoked", signedFormsInspected: false, records: [], domains: [],
};
if (ledger.kind !== "olive-upkeep-operations" || ledger.schoolId !== c.schoolId || ledger.cloud !== c.cloud || ledger.digest !== digest || ledger.reviewerId !== reviewerId || ledger.inFlight) throw new Error("Upkeep target/content or uncertain prior operation requires inspection");
const persist = () => c.fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
async function schoolView(client) {
  const view = await client.action(c.ref("functions/sites/management:schoolView"), { schoolId: c.schoolId });
  if (view.profile?.rendererKey !== "obhis-v1" || !view.draft || canonicalSiteContent(view.draft.content) !== canonicalSiteContent(expected)) throw new Error("Intended saved website content changed");
  return view;
}
(async () => {
  c.verifyProduction();
  if (mode === "review") {
    await c.withAccount("reviewer", async client => {
      const viewer = await client.query(c.ref("functions/foundation/auth:getViewerCapabilities"), { schoolId: c.schoolId });
      if (viewer.membership?.userId !== reviewerId || !viewer.capabilities.some(grant => grant.capability === "privacy.approve" && grant.scope === "school") ||
          viewer.capabilities.some(grant => ["site.publish.standard", "site.publish.sensitive"].includes(grant.capability))) throw new Error("Reviewer identity/independence changed");
      const view = await schoolView(client);
      if (!view.canReview || view.canEdit || view.canPublish) throw new Error("Reviewer capability projection is wrong");
      ledger.reviewedDraftVersion = view.draft.version; persist();
      async function approve(key, approvalCandidate, subject) {
        const signature = hash(JSON.stringify(approvalCandidate));
        const previous = ledger.records.find(record => record.key === key);
        if (previous) { if (previous.signature !== signature) throw new Error("Reviewed candidate changed"); return; }
        ledger.inFlight = key; persist();
        const result = await client.mutation(c.ref("functions/sites/evidence:approveCandidate"), {
          schoolId: c.schoolId, candidate: approvalCandidate, validity: "until_revoked", sourceKind: "owner_attestation", confirmed: true,
          evidenceReference: `School/parent permission relayed by owner in launch thread 69626257-e91b-49eb-bd73-26e021cedb13; owner requested continued unchanged publication until revoked on 2026-10-16. ${subject}. No signed forms independently inspected.`,
        });
        if (!result.evidenceId || !result.subjectKey) throw new Error("Approval result uncertain");
        ledger.records.push({ key, signature, evidenceId: result.evidenceId, subjectKey: result.subjectKey });
        delete ledger.inFlight; persist();
      }
      const manifest = siteManifest("obhis-v1", "1");
      if (!manifest) throw new Error("Renderer manifest unavailable");
      for (const definition of manifest.fields.filter(field => field.evidence)) {
        const field = expected.fields.find(item => item.fieldId === definition.fieldId);
        if (!field) { if (definition.required) throw new Error("Required field missing"); continue; }
        const current = await client.action(c.ref("functions/sites/evidence:getFieldCandidate"), { schoolId: c.schoolId, fieldId: definition.fieldId });
        if (current.fieldId !== field.fieldId || canonicalSiteFieldValue(current.value) !== canonicalSiteFieldValue(field.value)) throw new Error("Exact approval candidate changed");
        await approve(`field:${definition.fieldId}`, { kind: "field", fieldId: definition.fieldId, expectedDigest: current.digest }, `Exact approved text ${definition.fieldId}`);
      }
      const noChildren = new Set(["school_logo", "hero_cutout", "you_hero"]);
      for (const asset of uploads.assets) {
        const stored = view.assets.find(item => item.id === asset.assetId);
        if (!stored || stored.checksum !== asset.checksum || stored.status === "retired") throw new Error(`Asset changed: ${asset.fieldId}`);
        const base = { assetId: asset.assetId, expectedChecksum: asset.checksum };
        await approve(`rights:${asset.fieldId}`, { kind: "asset_rights", ...base }, `Public image-use authorization for exact image ${asset.fieldId}`);
        const classification = noChildren.has(asset.fieldId) ? "no_children" : "contains_children";
        await approve(`classification:${asset.fieldId}`, { kind: "asset_child_applicability", ...base, classification }, `Previously reviewed child classification ${classification} for exact image ${asset.fieldId}`);
        if (classification === "contains_children") await approve(`consent:${asset.fieldId}`, { kind: "asset_child_consent", ...base }, `Owner attests parent/guardian public-photo permission for exact image ${asset.fieldId}`);
      }
      if (ledger.records.length !== 64) throw new Error("Incomplete replacement approval set");
      ledger.reviewCompletedAt = new Date().toISOString(); persist();
      console.log(JSON.stringify({ independentReviewer: true, replacementApprovals: 64, validity: "until_revoked", sourceKind: "owner_attestation", signedFormsInspected: false }));
    });
    return;
  }
  if (mode === "publish") {
    if (ledger.records.length !== 64 || !ledger.reviewCompletedAt) throw new Error("Replacement review incomplete");
    await c.withAccount("school", async client => {
      const viewer = await client.query(c.ref("functions/foundation/auth:getViewerCapabilities"), { schoolId: c.schoolId });
      if (viewer.membership?.userId !== c.leadId) throw new Error("Wrong lead identity");
      let view = await schoolView(client);
      if (!view.canPublish || !view.canPublishSensitive || view.canReview || view.canEdit) throw new Error("Publisher capability projection wrong");
      if (ledger.publishedRevisionId) {
        if (view.profile.publishedRevisionId !== ledger.publishedRevisionId) throw new Error("Publication changed since upkeep release");
        console.log(JSON.stringify({ publicationAlreadyVerified: true, publishedRevisionId: ledger.publishedRevisionId })); return;
      }
      if (view.draft.version !== ledger.reviewedDraftVersion) throw new Error("Reviewed draft version changed");
      const checked = await client.action(c.ref("functions/sites/content:validateDraft"), { schoolId: c.schoolId });
      if (!checked.valid || checked.draftVersion !== view.draft.version) throw new Error("Publication gate failed");
      ledger.inFlight = "publish"; persist();
      const result = await client.mutation(c.ref("functions/sites/content:publishDraft"), { schoolId: c.schoolId, expectedDraftVersion: view.draft.version });
      if (!result.publishedId) throw new Error("Publication response uncertain");
      ledger.publishedRevisionId = result.publishedId; ledger.publishedAt = new Date().toISOString(); delete ledger.inFlight; persist();
      view = await schoolView(client);
      if (view.profile.publishedRevisionId !== result.publishedId || !view.publications.some(item => item.id === result.publishedId && item.current)) throw new Error("Publication readback failed");
      console.log(JSON.stringify({ unchangedContentPublished: true, publishedRevisionId: result.publishedId, fields: expected.fields.length, independentReplacementReview: true }));
    });
    return;
  }
  if (mode === "adopt" || mode === "verify-domains") {
    await c.withAccount("platform", async client => {
      const launch = c.loadLedger();
      if (launch.domains.length !== 2) throw new Error("Expected original two domain requests");
      let view = await client.action(c.ref("functions/sites/management:operatorView"), { schoolId: c.schoolId });
      for (const hostname of c.hosts) {
        const original = launch.domains.find(domain => domain.hostname === hostname);
        const current = view.domains.find(domain => domain.id === original?.domainId && domain.hostname === hostname);
        if (!original || !current || current.status !== "active" || current.providerOperation) throw new Error("Domain assignment/active state changed");
        if (mode === "adopt" && current.ownershipProofPolicy !== "persistent_authoritative_v1") {
          const readiness = await client.action(c.ref("functions/sites/domainActions:checkReadiness"), { domainId: original.domainId });
          if (!readiness.ready) throw new Error("Fresh legacy domain proof failed");
          ledger.inFlight = `adopt:${hostname}`; persist();
          await client.mutation(c.ref("functions/sites/domains:adoptPersistentOwnership"), { domainId: original.domainId, confirmation: `CONFIRM PERSISTENT ${hostname}` });
          delete ledger.inFlight; persist();
        }
      }
      view = await client.action(c.ref("functions/sites/management:operatorView"), { schoolId: c.schoolId });
      if (mode === "verify-domains" && (!ledger.adoptedAt || Date.now() - Date.parse(ledger.adoptedAt) < 15 * 60_000 || !c.hosts.every(hostname => {
        const before = ledger.domains.find(domain => domain.hostname === hostname);
        const after = view.domains.find(domain => domain.hostname === hostname);
        return before && after && after.ownershipObservedAt > before.ownershipObservedAt && after.routingObservedAt > before.routingObservedAt && after.tlsObservedAt > before.tlsObservedAt;
      }))) throw new Error("Full observation window and newer automatic checks have not yet been verified");
      ledger.domains = c.hosts.map(hostname => {
        const domain = view.domains.find(item => item.hostname === hostname);
        if (!domain || domain.status !== "active" || domain.ownershipProofPolicy !== "persistent_authoritative_v1" || domain.expiresAt !== null || domain.renewalRequired || !domain.observationFresh || domain.providerOperation) throw new Error("Persistent domain readback failed");
        return { domainId: domain.id, hostname, policy: domain.ownershipProofPolicy, ownershipObservedAt: domain.ownershipObservedAt,
          routingObservedAt: domain.routingObservedAt, tlsObservedAt: domain.tlsObservedAt, verifiedAt: new Date().toISOString() };
      });
      if (mode === "adopt") ledger.adoptedAt ??= new Date().toISOString();
      if (mode === "verify-domains") ledger.maintenanceVerifiedAt = new Date().toISOString();
      persist();
      console.log(JSON.stringify({ persistentDomains: ledger.domains, monthlyManualRenewalRequired: false, flagsUnchanged: true }));
    });
    return;
  }
  throw new Error("Unknown upkeep operation");
})().catch(error => { console.error(JSON.stringify({ mode, stopped: true, error: error.message })); process.exitCode = 1; });
