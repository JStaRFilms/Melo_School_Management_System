const c = require("./launch-common.cjs");
const mode = process.argv[2];
const ledger = c.loadLedger();
const packages = {
  editor: ["settings.view", "settings.manage", "site.preview"],
  domain_requester: ["site.domain.request"],
  publisher: ["settings.view", "site.preview", "site.publish.standard", "site.publish.sensitive"],
};
function leadGrants() {
  const result = c.productionCli(["data", "schoolCapabilityGrants", "--limit", "100", "--format", "json"]);
  const all = !result.stdout.trim() && /There are no documents in this table\./.test(result.stderr) ? [] : JSON.parse(result.stdout);
  if (all.length >= 100) throw new Error("Grant inventory is incomplete");
  return all.filter(grant => grant.schoolId === c.schoolId && grant.userId === c.leadId && !grant.revokedAt && grant.expiresAt > Date.now());
}
function matches(grants, role) {
  return grants.length === packages[role].length && packages[role].every(capability => grants.some(grant =>
    grant.capability === capability && grant.scope === "school" && grant.provisioningSource === "site_operator" && grant.siteAccessRole === role));
}
async function switchRole(client, desired, previousRole) {
  const current = leadGrants();
  if (matches(current, desired)) {
    console.log(JSON.stringify({ leadRole: desired, alreadyPresent: true, extended: false })); return;
  }
  if (!matches(current, previousRole) && !(current.length === 0 && ledger.roleTransition?.desired === desired && !ledger.roleTransition.inFlight)) {
    throw new Error("Unexpected lead permissions; refusing broad revocation");
  }
  if (!ledger.accessExpiresAt) ledger.accessExpiresAt = Math.min(...current.map(grant => grant.expiresAt));
  if (!Number.isFinite(ledger.accessExpiresAt) || ledger.accessExpiresAt <= Date.now()) throw new Error("Approved access expired");
  await c.withFlag("SITES_ALLOW_ACCESS_PROVISIONING", async () => {
    for (const grant of current) {
      ledger.roleTransition = { desired, revoking: grant._id }; c.saveLedger(ledger);
      await client.action(c.ref("functions/sites/access:configureAccess"), { request: { operation: "revoke", schoolId: c.schoolId,
        grantId: grant._id, confirmation: "obhis-fedrah", reason: "Owner-approved website launch role switch; no access extension" } });
    }
    ledger.roleTransition = { desired, inFlight: true }; c.saveLedger(ledger);
    const result = await client.action(c.ref("functions/sites/access:configureAccess"), { request: {
      operation: "provision", schoolId: c.schoolId, userId: c.leadId, role: desired, sensitivePublishing: desired === "publisher",
      confirmation: "obhis-fedrah", reason: "Owner-approved publication and exact Olive domain setup; preserve existing expiry",
      expiresAt: ledger.accessExpiresAt,
    } });
    if (result.grantIds?.length !== packages[desired].length || !matches(leadGrants(), desired)) throw new Error("Role-switch verification failed");
    ledger.roleTransition = { desired, verified: true }; c.saveLedger(ledger);
    console.log(JSON.stringify({ leadRole: desired, verified: true, expiryExtended: false }));
  });
}
function domains() {
  if (ledger.domains.length !== 2 || !c.hosts.every(host => ledger.domains.some(domain => domain.hostname === host))) throw new Error("Expected exact two domain requests");
  return c.hosts.map(host => ledger.domains.find(domain => domain.hostname === host));
}
(async () => {
  c.verifyProduction();
  await c.withAccount("platform", async client => {
    const viewRef = c.ref("functions/sites/management:operatorView");
    let view = await client.action(viewRef, { schoolId: c.schoolId });
    if (view.school.name !== "Olive Blessed Crest Academy" || view.profile?.rendererKey !== "obhis-v1") throw new Error("Wrong school/profile");
    if (mode === "role-domain") return switchRole(client, "domain_requester", "editor");
    if (mode === "role-editor") return switchRole(client, "editor", "publisher");
    if (mode === "role-publisher-from-editor") return switchRole(client, "publisher", "editor");
    if (mode === "role-publisher") return switchRole(client, "publisher", "domain_requester");
    const requested = domains();
    if (mode === "attach" || mode === "verify") {
      if (view.domains.some(domain => requested.some(item => item.domainId === domain.id) && domain.providerOperation)) throw new Error("Uncertain provider operation requires reconciliation, not a retry");
      await c.withFlag("SITES_ALLOW_PROVIDER_WRITES", async () => {
        for (const domain of requested) {
          if (mode === "attach" && (domain.attachConfirmed || domain.attachedAlreadyObserved)) continue;
          if (mode === "verify" && (domain.routing?.verified || domain.verifyConfirmed)) continue;
          if (domain.inFlight) throw new Error("Provider result is uncertain; inspect before retrying");
          domain.inFlight = mode; c.saveLedger(ledger);
          await client.action(c.ref("functions/sites/domainActions:mutateProvider"), {
            domainId: domain.domainId, operation: mode, confirmation: `CONFIRM ${mode.toUpperCase()} ${domain.hostname}`,
          });
          domain[mode === "attach" ? "attachConfirmed" : "verifyConfirmed"] = true;
          delete domain.inFlight; c.saveLedger(ledger);
          console.log(JSON.stringify({ hostname: domain.hostname, providerOperation: mode, confirmed: true }));
        }
      });
      return;
    }
    if (mode === "routes") {
      for (const domain of requested) {
        const routing = await client.action(c.ref("functions/sites/domainActions:getRoutingInstructions"), { domainId: domain.domainId });
        if (routing.hostname !== domain.hostname || routing.projectId !== c.projectId) throw new Error("Provider instructions target mismatch");
        domain.routing = routing; c.saveLedger(ledger);
        console.log(JSON.stringify({ hostname: domain.hostname, providerVerified: routing.verified, routingInstructionsSaved: true }));
      }
      return;
    }
    if (mode === "readiness" || mode === "activate") {
      for (const domain of requested) {
        const result = await client.action(c.ref("functions/sites/domainActions:checkReadiness"), { domainId: domain.domainId });
        if (!result.ready) throw new Error(`Domain not ready: ${domain.hostname}`);
        domain.readyAt = result.observedAt; c.saveLedger(ledger);
        console.log(JSON.stringify({ hostname: domain.hostname, readinessVerified: true }));
      }
      if (mode === "readiness") return;
      view = await client.action(viewRef, { schoolId: c.schoolId });
      if (!ledger.publishedRevisionId || !view.profile?.published) throw new Error("Immutable publication is missing");
      const [canonical, alias] = requested;
      if (!view.domains.some(domain => domain.id === canonical.domainId && domain.status === "active")) {
        await client.mutation(c.ref("functions/sites/domains:activateDomain"), { domainId: canonical.domainId });
      }
      canonical.activated = true; c.saveLedger(ledger);
      if (!view.domains.some(domain => domain.id === alias.domainId && domain.status === "active")) {
        await client.mutation(c.ref("functions/sites/domains:activateDomain"), { domainId: alias.domainId, canonicalDomainId: canonical.domainId });
      }
      alias.activated = true; c.saveLedger(ledger);
      view = await client.action(viewRef, { schoolId: c.schoolId });
      if (!requested.every(item => view.domains.some(domain => domain.id === item.domainId && domain.status === "active" && domain.observationFresh))) throw new Error("Active-domain readback failed");
      console.log(JSON.stringify({ canonical: canonical.hostname, alias: alias.hostname, bothActive: true }));
      return;
    }
    throw new Error("Unknown operator launch stage");
  });
})().catch(error => { console.error(JSON.stringify({ stage: mode, stopped: true, error: error.message })); process.exitCode = 1; });
