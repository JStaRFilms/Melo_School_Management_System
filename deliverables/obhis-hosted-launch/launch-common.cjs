const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { ConvexHttpClient } = require("convex/browser");
const { makeFunctionReference } = require("convex/server");
const schoolId = "kd73q7dt28ph1bmqjm20tsw2ed83k6j3";
const leadId = "k9704pcwe9gxac7bnxsaqq91nn83v9pj";
const cloud = "https://outgoing-warbler-782.eu-west-1.convex.cloud";
const site = "https://outgoing-warbler-782.eu-west-1.convex.site";
const projectId = "prj_h2l9FPxNt8KAG8BugXc8DKytLJPl";
const teamId = "team_RfGxXkj0batqCPONSBMSE2wP";
const hosts = ["www.oliveblessed.com", "oliveblessed.com"];
const ledgerPath = path.join(__dirname, "launch-ledger.json");
const cli = path.join(path.dirname(require.resolve("convex/package.json")), "bin/main.js");
function productionCli(args) {
  if (!["env", "data", "function-spec"].includes(args[0])) throw new Error("Unsupported operational CLI command");
  const env = { ...process.env };
  for (const key of ["CONVEX_DEPLOY_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY", "CONVEX_DEPLOYMENT", "MELO_USERNAME", "MELO_PASSWORD", "VERCEL_TOKEN"]) delete env[key];
  const result = cp.spawnSync(process.execPath, [cli, ...args, "--prod"], { env, encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Production CLI command failed; output withheld");
  return result;
}
function verifyProduction() {
  if (JSON.parse(productionCli(["function-spec"]).stdout).url !== cloud) throw new Error("Wrong Production target");
}
function flags() {
  return Object.fromEntries(productionCli(["env", "list"]).stdout.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}
async function withFlag(key, operation) {
  if (!["SITES_ALLOW_ACCESS_PROVISIONING", "SITES_ALLOW_PROVIDER_WRITES"].includes(key)) throw new Error("Unexpected enablement flag");
  const previous = flags()[key];
  if (previous === "enabled") throw new Error("Another operational window is already enabled");
  productionCli(["env", "set", key, "enabled"]);
  try { return await operation(); }
  finally {
    if (previous === undefined) productionCli(["env", "remove", key]);
    else productionCli(["env", "set", key, previous]);
    if (flags()[key] === "enabled") throw new Error(`URGENT: ${key} closure not verified`);
    console.log(JSON.stringify({ flag: key, windowClosed: true }));
  }
}
function loadLedger() {
  const value = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : {
    kind: "olive-production-launch", schoolId, cloud, projectId, teamId, canonical: hosts[0], alias: hosts[1], domains: [],
  };
  if (value.kind !== "olive-production-launch" || value.schoolId !== schoolId || value.cloud !== cloud || value.projectId !== projectId ||
      value.teamId !== teamId || value.canonical !== hosts[0] || value.alias !== hosts[1]) throw new Error("Launch ledger target mismatch");
  return value;
}
function saveLedger(value) { fs.writeFileSync(ledgerPath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); }
async function withAccount(kind, operation) {
  if (!["school", "platform", "reviewer"].includes(kind)) throw new Error("Unsupported account kind");
  if (kind === "school" && process.env.MELO_USERNAME?.trim().toLowerCase() !== "obhischool@gmail.com") throw new Error("Wrong school lead account");
  if (kind === "reviewer" && process.env.MELO_USERNAME?.trim().toLowerCase() !== "admin.fedrah@oliveblessed.com") throw new Error("Wrong independent reviewer account");
  const origin = kind === "platform" ? "https://superadmin.meloschool.com" : "https://admin.meloschool.com";
  const cookies = new Map();
  let signedIn = false;
  async function auth(endpoint, method = "GET", body) {
    const response = await fetch(`${origin}/api/auth/${endpoint}`, { method, redirect: "manual", signal: AbortSignal.timeout(20_000),
      headers: { Origin: origin, Referer: `${origin}/sign-in`, "Content-Type": "application/json", Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(";")[0], separator = first.indexOf("=");
      if (separator > 0) cookies.set(first.slice(0, separator), first.slice(separator + 1));
    }
    return response;
  }
  try {
    const login = await auth("sign-in/email", "POST", { email: process.env.MELO_USERNAME, password: process.env.MELO_PASSWORD });
    if (!login.ok) throw new Error(`Sign-in failed: HTTP ${login.status}`);
    await login.arrayBuffer(); signedIn = true;
    const response = await auth("convex/token");
    if (!response.ok) throw new Error("Session-token request failed");
    const { token } = await response.json();
    if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).iss !== site) throw new Error("Wrong token issuer");
    const client = new ConvexHttpClient(cloud); client.setAuth(token);
    return await operation(client);
  } finally {
    if (signedIn) {
      try { const response = await auth("sign-out", "POST", {}); console.log(JSON.stringify({ account: kind, temporarySessionSignedOut: response.ok })); await response.arrayBuffer(); }
      catch { console.log(JSON.stringify({ account: kind, signOutUnverified: true })); }
    }
    cookies.clear();
  }
}
module.exports = { fs, path, schoolId, leadId, cloud, site, projectId, teamId, hosts, productionCli, verifyProduction, flags, withFlag, loadLedger, saveLedger, withAccount, ref: makeFunctionReference };
