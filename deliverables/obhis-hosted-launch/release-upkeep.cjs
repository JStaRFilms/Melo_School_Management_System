const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const c = require("./launch-common.cjs");
const root = path.resolve(__dirname, "../..");
const mode = process.argv[2], target = process.argv[3];
const ledgerPath = path.join(__dirname, "upkeep-release-ledger.json");
const targets = {
  sites: { id: c.projectId, name: "melo-sites", root: "apps/sites", host: "www.oliveblessed.com" },
  admin: { id: "prj_PYa01VCUV0v3nxBRWuepb0Ufctm6", name: "melo-admin", root: "apps/admin", host: "admin.meloschool.com" },
  platform: { id: "prj_UDcnAUIETSuygmjUDq6eqqxB342Z", name: "melo-platform", root: "apps/platform", host: "superadmin.meloschool.com" },
};
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : { kind: "olive-upkeep-release", cloud: c.cloud, teamId: c.teamId, releases: {} };
if (ledger.kind !== "olive-upkeep-release" || ledger.cloud !== c.cloud || ledger.teamId !== c.teamId) throw new Error("Wrong release ledger");
const persist = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
function sources() {
  const listed = cp.execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }).split("\0").filter(Boolean);
  const rootFiles = new Set(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "tsconfig.json", "tsconfig.base.json", "vercel.json", ".npmrc", ".eslintrc.json", "eslint.config.mjs"]);
  return [...new Set(listed)].filter(file => (rootFiles.has(file) || /^(apps|packages|scripts)\//.test(file)) &&
    !/(^|\/)\.env(?:\.|$)/.test(file) && !/(^|\/)(?:node_modules|\.next|\.vercel|\.turbo)(?:\/|$)/.test(file) && fs.existsSync(path.join(root, file))).sort();
}
function digest(files, base) {
  const hash = crypto.createHash("sha256");
  for (const file of files) { hash.update(file); hash.update("\0"); hash.update(fs.readFileSync(path.join(base, file))); hash.update("\0"); }
  return hash.digest("hex");
}
function findCli() {
  const cache = path.join(os.homedir(), "AppData/Local/npm-cache/_npx");
  for (const directory of fs.readdirSync(cache).slice(0, 250)) {
    const packagePath = path.join(cache, directory, "node_modules/vercel/package.json");
    if (!fs.existsSync(packagePath)) continue;
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    if (pkg.version !== "64.3.1") continue;
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin.vercel;
    return path.resolve(path.dirname(packagePath), bin);
  }
  throw new Error("Reviewed Vercel CLI version not found in tool cache");
}
async function api(route) {
  const response = await fetch(`https://api.vercel.com${route}${route.includes("?") ? "&" : "?"}teamId=${c.teamId}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }, signal: AbortSignal.timeout(20_000), redirect: "manual",
  });
  if (!response.ok) throw new Error(`Vercel read failed: ${response.status}`);
  return response.json();
}
async function verifyTarget(config) {
  const project = await api(`/v9/projects/${config.id}`);
  if (project.id !== config.id || project.name !== config.name || project.accountId !== c.teamId || project.rootDirectory !== config.root) throw new Error("Vercel release target mismatch");
  const assigned = await api(`/v9/projects/${config.id}/domains?limit=100`);
  if (!assigned.domains.some(domain => domain.name === config.host && !domain.gitBranch && !domain.customEnvironmentId)) throw new Error("Public host assignment mismatch");
  const variables = await api(`/v9/projects/${config.id}/env`);
  const key = config.name === "melo-sites" ? "CONVEX_URL" : "NEXT_PUBLIC_CONVEX_URL";
  const entries = variables.envs.filter(variable => variable.key === key && variable.target?.includes("production") && !variable.gitBranch && !variable.customEnvironmentIds?.length);
  if (entries.length !== 1) throw new Error("Hosting backend setting is ambiguous");
  const backend = entries[0].type === "encrypted" ? await api(`/v1/projects/${config.id}/env/${entries[0].id}?decrypt=true`) : entries[0];
  if (backend.key !== key || backend.value !== c.cloud) throw new Error("Hosting backend target mismatch");
  return project;
}
function cli(config, dry) {
  if (!ledger.sourceRoot || !ledger.sourceDigest || digest(ledger.sourceFiles, ledger.sourceRoot) !== ledger.sourceDigest || digest(ledger.sourceFiles, root) !== ledger.sourceDigest) throw new Error("Reviewed source snapshot changed; do not deploy");
  const args = [findCli(), "deploy", "--prod", "--yes", "--project", config.id, "--scope", c.teamId, "--cwd", ledger.sourceRoot,
    "--global-config", path.join(ledger.temporaryRoot, "cli-config"), "--token", process.env.VERCEL_TOKEN, "--json", "--no-color",
    ...(dry ? ["--dry"] : ["--archive=tgz", "--no-wait", "--meta", `upkeepSourceDigest=${ledger.sourceDigest}`, "--meta", `baseCommit=${ledger.baseCommit}`])];
  const env = { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" };
  for (const name of ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT", "MELO_USERNAME", "MELO_PASSWORD"]) delete env[name];
  return cp.spawnSync(process.execPath, args, { cwd: ledger.sourceRoot, env, encoding: "utf8", timeout: 180_000, maxBuffer: 12 * 1024 * 1024, input: "" });
}
(async () => {
  if (mode === "prepare") {
    if (Object.values(ledger.releases).some(release => release.attemptedAt)) throw new Error("A release was already attempted; preserve its source snapshot");
    const baseCommit = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    if (baseCommit !== "d2ba632a09776e43684a99b4739885974790e094") throw new Error("Source base changed");
    const files = sources(), temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "melo-upkeep-release-")), sourceRoot = path.join(temporaryRoot, "source");
    for (const file of files) { const destination = path.join(sourceRoot, file); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(root, file), destination); }
    Object.assign(ledger, { baseCommit, temporaryRoot, sourceRoot, sourceFiles: files, sourceDigest: digest(files, sourceRoot), preparedAt: new Date().toISOString() }); persist();
    console.log(JSON.stringify({ sourceSnapshotPrepared: true, fileCount: files.length, sourceDigest: ledger.sourceDigest, secretsAndLaunchArtifactsExcluded: true })); return;
  }
  const config = targets[target];
  if (!config || !process.env.VERCEL_TOKEN) throw new Error("Approved target/token missing");
  await verifyTarget(config);
  if (mode === "status") {
    const release = ledger.releases[target];
    if (!release?.deploymentId) throw new Error("No confirmed deployment ID; inspect inventory, do not retry");
    const deployment = await api(`/v13/deployments/${release.deploymentId}`);
    if (deployment.projectId !== config.id || deployment.target !== "production" || deployment.meta?.upkeepSourceDigest !== ledger.sourceDigest) throw new Error("Deployment provenance mismatch");
    release.state = deployment.readyState ?? deployment.status; persist();
    console.log(JSON.stringify({ project: config.name, deploymentId: deployment.id, state: release.state, errorCode: deployment.errorCode, errorMessage: deployment.errorMessage, aliases: deployment.alias })); return;
  }
  if (!["dry", "deploy"].includes(mode)) throw new Error("Unknown release mode");
  if (ledger.releases[target]?.attemptedAt) throw new Error("Release already attempted; use status or inspect, never auto-retry");
  if (mode === "deploy" && !ledger.releases[target]?.dryPassed) throw new Error("Dry source inspection required");
  if (mode === "deploy") { ledger.releases[target] = { ...ledger.releases[target], attemptedAt: new Date().toISOString() }; persist(); }
  const result = cli(config, mode === "dry");
  const stdout = result.stdout ?? "", stderr = result.stderr ?? "";
  fs.writeFileSync(path.join(__dirname, `upkeep-${target}-${mode}-output.json`), stdout, { mode: 0o600 });
  fs.writeFileSync(path.join(__dirname, `upkeep-${target}-${mode}-stderr.log`), stderr, { mode: 0o600 });
  if (result.status !== 0) throw new Error(`CLI ${mode} stopped with status ${result.status}; inspect private output, no retry`);
  const output = JSON.parse(stdout);
  if (mode === "dry") {
    ledger.releases[target] = { dryPassed: true }; persist();
    console.log(JSON.stringify({ project: config.name, dryPassed: true, outputKeys: Object.keys(output) })); return;
  }
  const deployment = output.deployment ?? output;
  if (!deployment.id || !deployment.url) throw new Error("CLI deployment response is uncertain; inspect, do not retry");
  Object.assign(ledger.releases[target], { deploymentId: deployment.id, url: deployment.url, state: deployment.readyState ?? deployment.status }); persist();
  console.log(JSON.stringify({ project: config.name, deploymentAccepted: true, deploymentId: deployment.id, state: ledger.releases[target].state }));
})().catch(error => { console.error(JSON.stringify({ mode, target, stopped: true, error: error.message })); process.exitCode = 1; });
