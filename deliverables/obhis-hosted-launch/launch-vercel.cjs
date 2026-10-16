const c = require("./launch-common.cjs");
const mode = process.argv[2];
const ledger = c.loadLedger();
const suffix = ".oliveblessed.com";
async function api(route, method = "GET", body) {
  const response = await fetch(`https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${c.teamId}`, {
    method, redirect: "manual", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseText = await response.text();
  const value = responseText ? JSON.parse(responseText) : {};
  if (!response.ok) {
    const error = new Error(`Vercel HTTP ${response.status}: ${value.error?.code ?? "request_failed"}`);
    error.status = response.status; error.providerCode = value.error?.code;
    throw error;
  }
  return value;
}
function relativeName(name) {
  const normalized = name.replace(/\.$/, "").toLowerCase();
  if (normalized === "oliveblessed.com") return "";
  if (!normalized.endsWith(suffix)) throw new Error("DNS instruction is outside the approved domain");
  return normalized.slice(0, -suffix.length);
}
async function records() {
  const value = await api("/v4/domains/oliveblessed.com/records?limit=100");
  if (value.pagination?.next) throw new Error("DNS record inventory is incomplete");
  return value.records;
}
async function addRecord(name, type, value) {
  const existing = await records();
  const atName = existing.filter(record => record.name === name || record.name === `${name}${suffix}` || (!name && record.name === "oliveblessed.com"));
  if (atName.some(record => record.type === type && record.value === value)) return false;
  if (type === "TXT" && atName.some(record => record.type === "TXT")) throw new Error("Existing verification TXT differs; refusing overwrite");
  await api("/v2/domains/oliveblessed.com/records", "POST", { name, type, value, ttl: 60 });
  return true;
}
async function setRouting(name, type, values) {
  const before = await records();
  const atName = before.filter(record => record.name === name || record.name === `${name}${suffix}` || (!name && record.name === "oliveblessed.com"));
  if (type === "CNAME" && atName.some(record => ["MX", "TXT"].includes(record.type))) throw new Error("Routing would conflict with email/TXT records; stopped");
  const routing = atName.filter(record => ["A", "AAAA", "CNAME", "ALIAS"].includes(record.type));
  for (const record of routing) {
    if (record.type === type && values.includes(record.value.replace(/\.$/, ""))) continue;
    if (record.managed === true) throw new Error("Existing managed routing record needs explicit provider handling");
    ledger.dnsRoutingRemovals ??= [];
    ledger.dnsRoutingRemovals.push(record); c.saveLedger(ledger);
    await api(`/v2/domains/oliveblessed.com/records/${record.id}`, "DELETE");
  }
  for (const value of values) await addRecord(name, type, value);
}
function requestedDomains() {
  if (ledger.domains.length !== 2 || !c.hosts.every(host => ledger.domains.some(domain => domain.hostname === host))) throw new Error("Exact school domain requests are missing");
  return c.hosts.map(host => ledger.domains.find(domain => domain.hostname === host));
}
(async () => {
  if (!process.env.VERCEL_TOKEN) throw new Error("Missing authorized Vercel token");
  const project = await api(`/v9/projects/${c.projectId}`);
  if (project.id !== c.projectId || project.name !== "melo-sites" || project.accountId !== c.teamId || project.rootDirectory !== "apps/sites") throw new Error("Wrong Vercel project");
  if (mode === "proof") {
    const domain = await api("/v5/domains/oliveblessed.com");
    const info = domain.domain ?? domain;
    if (info.name !== "oliveblessed.com" || !info.verified) throw new Error("Vercel domain ownership is not verified");
    ledger.dnsBefore ??= await records();
    const assigned = await api(`/v9/projects/${c.projectId}/domains?limit=100`);
    if (assigned.pagination?.next) throw new Error("Project domain inventory is incomplete");
    for (const requested of requestedDomains()) {
      if (requested.recordName !== `_school-site-verify.${requested.hostname}` || !requested.recordValue.startsWith("school-site-v1=") || requested.expiresAt <= Date.now()) throw new Error("School TXT proof mismatch");
      const added = await addRecord(relativeName(requested.recordName), "TXT", requested.recordValue);
      requested.schoolProofAdded = true;
      requested.attachedAlreadyObserved = assigned.domains.some(item => item.name === requested.hostname && !item.gitBranch && !item.customEnvironmentId);
      c.saveLedger(ledger);
      console.log(JSON.stringify({ hostname: requested.hostname, ownershipTxtPresent: true, newRecordAdded: added, alreadyAssignedToProject: requested.attachedAlreadyObserved }));
    }
    return;
  }
  if (mode === "dns") {
    for (const domain of requestedDomains()) {
      const instructions = domain.routing;
      if (!instructions || instructions.hostname !== domain.hostname || instructions.projectId !== c.projectId) throw new Error("Fresh provider instructions are missing");
      for (const proof of instructions.verification ?? []) {
        if (proof.type !== "TXT") throw new Error("Unsupported provider-verification instruction");
        await addRecord(relativeName(proof.name), "TXT", proof.value);
      }
      if (domain.hostname === c.hosts[0]) {
        const selected = [...instructions.recommendedCNAME].sort((a, b) => a.rank - b.rank)[0];
        if (!selected?.value || !/^[a-z0-9.-]+\.?$/i.test(selected.value)) throw new Error("No valid provider CNAME recommendation");
        await setRouting("www", "CNAME", [selected.value.replace(/\.$/, "")]);
      } else {
        const selected = [...instructions.recommendedIPv4].sort((a, b) => a.rank - b.rank)[0];
        if (!selected?.value?.length || !selected.value.every(value => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value))) throw new Error("No provider IPv4 recommendation");
        await setRouting("", "A", selected.value);
      }
      domain.routingApplied = true; c.saveLedger(ledger);
      console.log(JSON.stringify({ hostname: domain.hostname, exactProviderRoutingApplied: true }));
    }
    const after = await records();
    const retained = (ledger.dnsBefore ?? []).filter(record => !["A", "AAAA", "CNAME", "ALIAS"].includes(record.type) || !["", "www", "oliveblessed.com", "www.oliveblessed.com"].includes(record.name));
    if (!retained.every(record => after.some(current => current.id === record.id && current.type === record.type && current.name === record.name && current.value === record.value))) throw new Error("Unrelated DNS preservation check failed");
    console.log(JSON.stringify({ unrelatedDnsAndEmailRecordsPreserved: true }));
    return;
  }
  if (mode === "frontend") {
    if (ledger.frontendAttempted) throw new Error("Frontend deployment already attempted; use status, not another deployment");
    const assigned = await api(`/v9/projects/${c.projectId}/domains?limit=100`);
    if (!c.hosts.every(host => assigned.domains.some(domain => domain.name === host && !domain.gitBranch && !domain.customEnvironmentId))) throw new Error("Approved hosts are not assigned to Production project");
    const environment = await api(`/v9/projects/${c.projectId}/env`);
    const entry = key => {
      const matches = environment.envs.filter(variable => variable.key === key && variable.target?.includes("production") && !variable.gitBranch && !variable.customEnvironmentIds?.length);
      if (matches.length !== 1) throw new Error(`Production setting missing or ambiguous: ${key}`);
      return matches[0];
    };
    if (entry("CONVEX_URL").value !== c.cloud || entry("CONVEX_SITE_URL").value !== c.site || entry("SITES_GATEWAY_SECRET").type !== "sensitive") throw new Error("Unexpected Production gateway configuration");
    const allowed = entry("SITES_PRODUCTION_CUSTOM_HOSTS");
    ledger.frontendHostsBefore = allowed.value;
    const merged = [...new Set([...allowed.value.split(",").map(value => value.trim()).filter(Boolean), ...c.hosts])];
    if (merged.some(host => host.endsWith(".vercel.app"))) throw new Error("Deployment URL cannot be a tenant host");
    const deployments = await api(`/v6/deployments?projectId=${c.projectId}&target=production&limit=5`);
    const base = deployments.deployments.find(deployment => deployment.state === "READY");
    if (!base || base.meta?.githubCommitSha !== "d2ba632a09776e43684a99b4739885974790e094" || (project.targets?.production?.id && project.targets.production.id !== base.uid)) throw new Error("Production frontend source changed; review before redeploy");
    await api(`/v9/projects/${c.projectId}/env/${allowed.id}`, "PATCH", { value: merged.join(",") });
    ledger.frontendHosts = merged;
    ledger.frontendAttempted = true;
    ledger.frontendBaseDeploymentId = base.uid; c.saveLedger(ledger);
    try {
      const deployment = await api("/v13/deployments", "POST", { name: "melo-sites", project: c.projectId,
        target: "production", deploymentId: base.uid, withLatestCommit: false });
      if (!deployment.id) throw new Error("Deployment response is uncertain; inspect before retry");
      ledger.frontendDeploymentId = deployment.id;
      ledger.frontendDeploymentUrl = deployment.url;
      ledger.frontendState = deployment.readyState ?? deployment.status;
      c.saveLedger(ledger);
      console.log(JSON.stringify({ frontendDeploymentAccepted: true, deploymentId: deployment.id, state: ledger.frontendState, sameReviewedSource: true }));
    } catch (error) {
      ledger.frontendFailure = { status: error.status, code: error.providerCode, message: error.message }; c.saveLedger(ledger);
      throw error;
    }
    return;
  }
  if (mode === "deployment-status") {
    if (!ledger.frontendDeploymentId) throw new Error("No accepted deployment ID; do not create a retry");
    const deployment = await api(`/v13/deployments/${ledger.frontendDeploymentId}`);
    if (deployment.projectId !== c.projectId || deployment.target !== "production") throw new Error("Deployment target mismatch");
    ledger.frontendState = deployment.readyState ?? deployment.status; c.saveLedger(ledger);
    console.log(JSON.stringify({ deploymentId: deployment.id, state: ledger.frontendState, errorCode: deployment.errorCode, errorMessage: deployment.errorMessage, aliases: deployment.alias }));
    return;
  }
  throw new Error("Unknown Vercel launch stage");
})().catch(error => { console.error(JSON.stringify({ stage: mode, stopped: true, error: error.message })); process.exitCode = 1; });
