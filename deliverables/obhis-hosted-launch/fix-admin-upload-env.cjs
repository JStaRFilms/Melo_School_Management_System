const c = require("./launch-common.cjs");
const ledgerPath = c.path.join(__dirname, "upkeep-release-ledger.json");
const ledger = JSON.parse(c.fs.readFileSync(ledgerPath, "utf8"));
const projectId = "prj_PYa01VCUV0v3nxBRWuepb0Ufctm6";
const persist = () => c.fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
async function api(route, method = "GET", body) {
  const response = await fetch(`https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${c.teamId}`, {
    method, redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok) throw new Error(`Vercel ${method} failed: ${response.status} ${value.error?.code ?? "unknown"}`);
  return value;
}
(async () => {
  if (ledger.kind !== "olive-upkeep-release" || ledger.cloud !== c.cloud || ledger.adminUploadFix) throw new Error("Wrong target or prior configuration fix requires inspection, not retry");
  const project = await api(`/v9/projects/${projectId}`);
  if (project.name !== "melo-admin" || project.rootDirectory !== "apps/admin" || project.accountId !== c.teamId) throw new Error("Wrong Admin project");
  const previousId = ledger.releases.admin?.deploymentId;
  if (!previousId || project.targets?.production?.id !== previousId) throw new Error("Active Admin source changed");
  const previous = await api(`/v13/deployments/${previousId}`);
  if (previous.readyState !== "READY" || previous.meta?.upkeepSourceDigest !== ledger.sourceDigest) throw new Error("Admin source is not the reviewed release");
  const variables = await api(`/v9/projects/${projectId}/env`);
  if (variables.envs.some(variable => variable.key === "CONVEX_SITE_URL" && variable.target?.includes("production"))) throw new Error("Server endpoint setting already exists; inspect rather than overwrite");
  ledger.adminUploadFix = { reason: "Actual browser copy failed because Admin server upload endpoint is absent", previousDeploymentId: previousId, settingAttemptedAt: new Date().toISOString() }; persist();
  await api(`/v10/projects/${projectId}/env`, "POST", { key: "CONVEX_SITE_URL", value: c.site, type: "encrypted", target: ["production"] });
  const after = await api(`/v9/projects/${projectId}/env`);
  const entries = after.envs.filter(variable => variable.key === "CONVEX_SITE_URL" && variable.target?.includes("production") && !variable.gitBranch);
  if (entries.length !== 1) throw new Error("Admin setting readback ambiguous");
  const verified = await api(`/v1/projects/${projectId}/env/${entries[0].id}?decrypt=true`);
  if (verified.key !== "CONVEX_SITE_URL" || verified.value !== c.site) throw new Error("Admin setting target mismatch");
  ledger.adminUploadFix.settingVerified = true;
  ledger.adminUploadFix.deploymentAttemptedAt = new Date().toISOString(); persist();
  const deployment = await api("/v13/deployments", "POST", { name: "melo-admin", project: projectId, target: "production",
    deploymentId: previousId, withLatestCommit: false, meta: { upkeepSourceDigest: ledger.sourceDigest, upkeepReason: "configure-admin-upload-endpoint" } });
  if (!deployment.id) throw new Error("Config-release result uncertain; inspect instead of retry");
  ledger.adminUploadFix.deploymentId = deployment.id;
  ledger.releases.admin = { ...ledger.releases.admin, previousDeploymentId: previousId, deploymentId: deployment.id, url: deployment.url, state: deployment.readyState ?? deployment.status };
  persist();
  console.log(JSON.stringify({ project: "melo-admin", productionServerUploadEndpointVerified: true, sameReviewedSource: true, configReleaseDeploymentId: deployment.id, state: ledger.releases.admin.state, previewUnchanged: true }));
})().catch(error => { console.error(JSON.stringify({ stopped: true, error: error.message })); process.exitCode = 1; });
