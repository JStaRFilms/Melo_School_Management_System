const c = require("./launch-common.cjs");
const mode = process.argv[2];
const ledger = c.loadLedger();
(async () => {
  await c.withAccount("school", async client => {
    const viewer = await client.query(c.ref("functions/foundation/auth:getViewerCapabilities"), { schoolId: c.schoolId });
    if (viewer.membership?.userId !== c.leadId) throw new Error("Wrong Fedrah lead membership");
    const has = capability => viewer.capabilities.some(grant => grant.capability === capability && grant.scope === "school");
    const viewRef = c.ref("functions/sites/management:schoolView");
    let view = await client.action(viewRef, { schoolId: c.schoolId });
    if (view.profile?.rendererKey !== "obhis-v1") throw new Error("Wrong renderer");
    if (mode === "domains") {
      if (!has("site.domain.request")) throw new Error("Missing domain-request-only grant");
      for (const hostname of c.hosts) {
        const existing = view.domains.filter(domain => domain.hostname === hostname);
        if (existing.length > 1) throw new Error("Duplicate hostname records");
        let record;
        if (existing.length) {
          const instructions = await client.mutation(c.ref("functions/sites/domains:getInstructions"), { schoolId: c.schoolId, domainId: existing[0].id });
          if (!instructions.recordName || !instructions.recordValue || instructions.renewalRequired) throw new Error("Existing domain proof requires reviewed renewal");
          record = { domainId: existing[0].id, hostname, recordName: instructions.recordName, recordValue: instructions.recordValue, expiresAt: instructions.expiresAt };
        } else {
          record = await client.mutation(c.ref("functions/sites/domains:requestDomain"), { schoolId: c.schoolId, hostname,
            canonicalIntent: hostname === c.hosts[0] ? "canonical" : "redirect" });
        }
        const saved = ledger.domains.find(domain => domain.hostname === hostname);
        if (saved && saved.domainId !== record.domainId) throw new Error("Domain request differs from ledger");
        if (saved) Object.assign(saved, record); else ledger.domains.push(record);
        c.saveLedger(ledger);
        console.log(JSON.stringify({ hostname, schoolDomainRequested: true, proofExpiresAt: new Date(record.expiresAt).toISOString() }));
      }
      return;
    }
    if (mode !== "publish") throw new Error("Unknown school launch stage");
    if (!has("site.publish.standard") || !has("site.publish.sensitive")) throw new Error("Missing explicit publication grants");
    if (view.profile.publishedRevisionId) {
      if (ledger.publishedRevisionId === view.profile.publishedRevisionId) {
        console.log(JSON.stringify({ publicationAlreadyVerified: true, publishedRevisionId: ledger.publishedRevisionId })); return;
      }
      throw new Error("Unexpected publication requires inspection before retry");
    }
    if (ledger.publicationInFlight) throw new Error("Previous publication result is uncertain; inspect before retry");
    const ts = require("typescript");
    require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(c.fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, file);
    const { canonicalSiteContent } = require("../../packages/shared/src/site-manifests.ts");
    const candidate = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "content-candidate.json"), "utf8"));
    const uploads = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "upload-ledger.json"), "utf8"));
    const review = JSON.parse(c.fs.readFileSync(c.path.join(__dirname, "review-ledger.json"), "utf8"));
    const expected = { fields: [...candidate.textFields, ...uploads.assets.map(asset => ({ fieldId: asset.fieldId,
      value: { kind: "asset_ref", assetId: asset.assetId } }))], routeSeo: candidate.routeSeo };
    if (!view.draft || view.draft.version !== review.draftVersion || review.inFlight || review.expiresAt <= Date.now() ||
        review.records.length !== 64 || canonicalSiteContent(view.draft.content) !== canonicalSiteContent(expected)) throw new Error("Approved draft/evidence changed");
    const checked = await client.action(c.ref("functions/sites/content:validateDraft"), { schoolId: c.schoolId });
    if (!checked.valid || checked.draftVersion !== view.draft.version) throw new Error("Publication checks failed");
    ledger.publicationInFlight = true; c.saveLedger(ledger);
    const result = await client.mutation(c.ref("functions/sites/content:publishDraft"), { schoolId: c.schoolId, expectedDraftVersion: view.draft.version });
    ledger.publishedRevisionId = result.publishedId;
    ledger.publishedAt = new Date().toISOString();
    delete ledger.publicationInFlight; c.saveLedger(ledger);
    view = await client.action(viewRef, { schoolId: c.schoolId });
    if (view.profile?.publishedRevisionId !== result.publishedId || !view.publications.some(item => item.id === result.publishedId && item.current)) throw new Error("Immutable publication readback failed");
    console.log(JSON.stringify({ production: "outgoing-warbler-782", publicationVerified: true,
      publishedRevisionId: result.publishedId, contentFields: expected.fields.length, domainActivationStillRequired: true }));
  });
})().catch(error => { console.error(JSON.stringify({ stage: mode, stopped: true, error: error.message })); process.exitCode = 1; });
