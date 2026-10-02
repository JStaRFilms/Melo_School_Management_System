"use node";

import { Resolver, resolve4, resolve6, resolveNs } from "node:dns/promises";
import { isIP } from "node:net";
import { connect, type TLSSocket } from "node:tls";
import { request } from "node:https";
import { Agent } from "node:https";
import { PROBE_BODY, PROBE_PATH, normalizeHostname, providerSettings } from "./domainRules";

export function providerConfig() {
  const config = providerSettings();
  if (!config) throw Error("Sites provider is not configured");
  return config;
}
// WHATWG URL canonicalizes expanded and mixed-case IPv6 before CIDR comparison.
// Callers check isIP first; no hostnames or zone identifiers enter this parser.
function ipNumber(ip: string): bigint {
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1,-1);
  const halves = canonical.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 2 ? [...left,...Array(8-left.length-right.length).fill("0"),...right] : left;
  if (groups.length !== 8) throw Error("Invalid IPv6 address");
  return groups.reduce<bigint>((n,group) => (n << BigInt(16)) | BigInt(parseInt(group,16)),BigInt(0));
}
function inV6Range(n: bigint, prefix: string, bits: number): boolean {
  const shift = BigInt(128 - bits);
  return (n >> shift) === (ipNumber(prefix) >> shift);
}
function sameAddress(a: string | undefined, b: string): boolean {
  if (!a || isIP(a) !== isIP(b)) return false;
  return isIP(b) === 6 ? ipNumber(a) === ipNumber(b) : a === b;
}
export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    if (p.some(n => n > 255)) return false;
    const [a,b,c] = p;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 88 && c === 99 || b === 175 && c === 48) || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113 || a === 192 && b === 0 && c === 2 || a === 192 && b === 88 && c === 99 || a === 198 && b === 51 && c === 100);
  }
  if (isIP(ip) === 6) {
    const n = ipNumber(ip);
    // 2000::/3 global unicast, minus IANA special-purpose allocations:
    // 2001::/23 (protocol assignments, Teredo, ORCHID, benchmarks),
    // 2001:db8::/32 and 3fff::/20 (documentation), 2002::/16 (6to4).
    // Mapped IPv4 and other transition forms outside /3 cannot pass.
    return inV6Range(n,"2000::",3) && !([
      ["2001::",23], ["2001:db8::",32], ["2002::",16], ["3fff::",20],
    ] as const).some(([base,bits]) => inV6Range(n,base,bits));
  }
  return false;
}
async function bound<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {return await Promise.race([promise,new Promise<T>((_,reject) => {timeout = setTimeout(() => reject(Error("DNS timeout")),ms);})]);}
  finally {if (timeout) clearTimeout(timeout);}
}
async function addresses(host: string) {
  const rows = await bound(Promise.allSettled([resolve4(host), resolve6(host)]));
  const ips = rows.flatMap(r => r.status === "fulfilled" ? r.value : []);
  if (!ips.length || ips.length > 32 || ips.some(ip => !publicAddress(ip))) throw Error("Unsafe DNS destination");
  return ips;
}
// Consult the zone's authoritative servers directly, never a caller-supplied TXT answer.
export async function ownershipTxt(name: string, expected: string): Promise<boolean> {
  if (!name.startsWith("_school-site-verify.")) throw Error("Invalid proof name");
  const host = normalizeHostname(name.slice("_school-site-verify.".length));
  if (name !== `_school-site-verify.${host}`) throw Error("Invalid proof name");
  const parts = name.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const zone = parts.slice(i).join(".");
    let ns: string[];
    try { ns = await bound(resolveNs(zone)); } catch { continue; }
    if (!ns.length || ns.length > 12) throw Error("Unsafe nameservers");
    const servers = (await Promise.all(ns.map(addresses))).flat();
    if (!servers.length || servers.some(ip => !publicAddress(ip))) throw Error("Unsafe nameservers");
    const resolver = new Resolver(); resolver.setServers(servers);
    const records = await bound(resolver.resolveTxt(name));
    return records.some(parts => parts.join("") === expected);
  }
  return false;
}
async function vercel(path: string, init?: RequestInit): Promise<unknown> {
  const {token, teamId} = providerConfig();
  const url = new URL(path, "https://api.vercel.com");
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8000), headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"} });
  if (!response.ok || Number(response.headers.get("content-length")) > 128_000) throw Error("Provider request failed");
  const text = await response.text();
  if (text.length > 128_000) throw Error("Provider response too large");
  return JSON.parse(text) as unknown;
}
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue { if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid provider response"); return value as ObjectValue; }
function exactAssignment(domain: ObjectValue, host: string, projectId: string) {
  if (domain.name !== host || domain.projectId !== projectId || typeof domain.verified !== "boolean" || domain.gitBranch != null || domain.customEnvironmentId != null || domain.redirect != null) throw Error("Domain is not a production alias");
}
function recommendations(config: ObjectValue) {
  const cname = config.recommendedCNAME, ipv4 = config.recommendedIPv4;
  if (!Array.isArray(cname) || cname.length > 8 || !Array.isArray(ipv4) || ipv4.length > 8) throw Error("Invalid provider recommendations");
  const rank = (r: ObjectValue) => Number.isInteger(r.rank) && (r.rank as number) >= 1 && (r.rank as number) <= 100;
  const recommendedCNAME = cname.map(object).map(r => {
    if (!rank(r) || typeof r.value !== "string" || r.value.length > 253 || !/^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\.?$/i.test(r.value)) throw Error("Invalid CNAME recommendation");
    return {rank:r.rank as number,value:r.value as string};
  });
  const recommendedIPv4 = ipv4.map(object).map(r => {
    if (!rank(r) || !Array.isArray(r.value) || !r.value.length || r.value.length > 8 || !r.value.every(ip => typeof ip === "string" && isIP(ip) === 4 && publicAddress(ip))) throw Error("Invalid IPv4 recommendation");
    return {rank:r.rank as number,value:r.value as string[]};
  });
  return {recommendedCNAME:recommendedCNAME.sort((a,b) => a.rank-b.rank),recommendedIPv4:recommendedIPv4.sort((a,b) => a.rank-b.rank)};
}
function challenges(domain: ObjectValue) {
  if (domain.verification == null) return [];
  if (!Array.isArray(domain.verification) || domain.verification.length > 8) throw Error("Invalid provider challenges");
  return domain.verification.map(object).filter(r => r.type === "TXT").map(r => {
    if (typeof r.domain !== "string" || r.domain.length > 253 || !/^(?:_?[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,}\.?$/i.test(r.domain) || typeof r.value !== "string" || !r.value.length || r.value.length > 512 || !/^[\x20-\x7e]+$/.test(r.value) || typeof r.reason !== "string" || r.reason.length > 256 || !/^[\x20-\x7e]*$/.test(r.reason)) throw Error("Invalid TXT challenge");
    return {type:"TXT" as const,name:r.domain as string,value:r.value as string,reason:r.reason as string};
  });
}
async function attachedDomain(host: string, projectId: string) {
  const domain = object(await vercel(`/v9/projects/${projectId}/domains/${encodeURIComponent(host)}`));
  exactAssignment(domain,host,projectId);
  const list = object(await vercel(`/v9/projects/${projectId}/domains?production=true&limit=100`));
  const matches = Array.isArray(list.domains) ? list.domains.map(object).filter(d => d.name === host) : [];
  if (object(list.pagination).next != null || matches.length !== 1) throw Error("Production target is not proven");
  exactAssignment(matches[0],host,projectId);
  return domain;
}
// Informational only: no DNS, TLS, or readiness observation is made here.
export async function providerInstructions(host: string) {
  const {projectId} = providerConfig();
  const domain = await attachedDomain(host,projectId);
  const config = object(await vercel(`/v6/domains/${encodeURIComponent(host)}/config?projectIdOrName=${projectId}`));
  return {hostname:host,projectId,verified:domain.verified as boolean,verification:challenges(domain),...recommendations(config)};
}
export async function providerRead(host: string) {
  const {projectId} = providerConfig();
  const domain = object(await vercel(`/v9/projects/${projectId}/domains/${encodeURIComponent(host)}`));
  if (domain.name !== host || domain.projectId !== projectId || domain.verified !== true || domain.gitBranch != null || domain.customEnvironmentId != null || domain.redirect != null) throw Error("Domain is not a production alias");
  // Production list has no cursor token; incomplete/ambiguous pagination cannot establish target.
  const list = object(await vercel(`/v9/projects/${projectId}/domains?production=true&limit=100`));
  const matches = Array.isArray(list.domains) ? list.domains.map(object).filter(d => d.name === host) : [];
  const pagination = object(list.pagination);
  if (pagination.next != null || matches.length !== 1 || matches[0].projectId !== projectId || matches[0].verified !== true || matches[0].gitBranch != null || matches[0].customEnvironmentId != null || matches[0].redirect != null) throw Error("Production target is not proven");
  const config = object(await vercel(`/v6/domains/${encodeURIComponent(host)}/config?projectIdOrName=${projectId}`));
  if (config.misconfigured !== false || !["A", "CNAME"].includes(String(config.configuredBy))) throw Error("Domain routing is not ready");
  return {projectId, configuredBy: config.configuredBy as "A" | "CNAME", ...recommendations(config)};
}
export async function providerReconcile(host: string, operation: "attach" | "verify") {
  const {projectId} = providerConfig();
  const domain = object(await vercel(`/v9/projects/${projectId}/domains/${encodeURIComponent(host)}`));
  if (domain.name !== host || domain.projectId !== projectId || domain.gitBranch != null || domain.customEnvironmentId != null || domain.redirect != null || (operation === "verify" && domain.verified !== true)) throw Error("Provider operation has not been confirmed by read-only project status");
  const list = object(await vercel(`/v9/projects/${projectId}/domains?production=true&limit=100`));
  const rows = Array.isArray(list.domains) ? list.domains.map(object).filter(row => row.name === host) : [];
  if (object(list.pagination).next != null || rows.length !== 1 || rows[0].projectId !== projectId || rows[0].gitBranch != null || rows[0].customEnvironmentId != null || rows[0].redirect != null || (operation === "verify" && rows[0].verified !== true)) throw Error("Production provider attachment not confirmed");
}
export async function providerWrite(host: string, operation: "attach" | "verify") {
  const {projectId} = providerConfig();
  const result = object(await vercel(operation === "attach" ? `/v10/projects/${projectId}/domains` : `/v9/projects/${projectId}/domains/${encodeURIComponent(host)}/verify`, {method: "POST", ...(operation === "attach" ? {body: JSON.stringify({name: host})} : {})}));
  if (result.name !== host || result.projectId !== projectId) throw Error("Provider response mismatch");
  return {name: host, verified: result.verified === true, verification: challenges(result)};
}
export async function probeTls(host: string) {
  const ips = await addresses(host);
  // Only publicly routable DNS candidates reach the production connector.
  return probeTlsEndpoint(host, ips[0], 443);
}
// Transport seam for controlled local TLS tests. No Convex action exposes this
// helper or accepts a pin, port or CA from a caller.
export async function probeTlsEndpoint(host: string, ip: string, port: number, ca?: string) {
  const lookup = (_host: string, options: {all?: boolean}, cb: (err: Error | null, address: string | {address:string;family:number}[], family?: number) => void) => {
    if (options.all) cb(null,[{address:ip,family:isIP(ip)}]); else cb(null,ip,isIP(ip));
  };
  const tls = await new Promise<{fingerprint: string; expires: number}>((resolve,reject) => {
    const socket = connect({host: ip, port, servername: host, rejectUnauthorized: true, timeout: 5000, ...(ca ? {ca} : {})}, () => {
      const cert = socket.getPeerCertificate();
      const expires = Date.parse(cert.valid_to);
      if (!socket.authorized || !cert.fingerprint256 || !Number.isFinite(expires) || expires <= Date.now() + 24 * 60 * 60_000 || !sameAddress(socket.remoteAddress,ip)) reject(Error("Invalid TLS certificate"));
      else resolve({fingerprint: cert.fingerprint256.replace(/:/g, "").toLowerCase(), expires});
      socket.destroy();
    });
    const deadline = setTimeout(() => socket.destroy(Error("TLS total deadline")), 5000);
    socket.on("close", () => clearTimeout(deadline));
    socket.on("timeout", () => socket.destroy(Error("TLS timeout"))); socket.on("error", reject);
  });
  const body = await new Promise<string>((resolve,reject) => {
    const agent = new Agent({keepAlive: false, maxSockets: 1, lookup});
    let response: import("node:http").IncomingMessage | undefined;
    let settled = false;
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      response?.destroy(); req.destroy(); agent.destroy();
      if (error) reject(error); else resolve(value!);
    };
    const req = request({hostname: host, port, method: "GET", path: PROBE_PATH, agent, servername: host, timeout: 5000, ...(ca ? {ca} : {}), headers: {Host: host, Accept: "text/plain"}}, received => {
      response = received;
      const servedCert = (response.socket as TLSSocket).getPeerCertificate();
      if (!sameAddress(response.socket.remoteAddress,ip) || !servedCert?.fingerprint256 || servedCert.fingerprint256.replace(/:/g, "").toLowerCase() !== tls.fingerprint) return finish(Error("Probe connection mismatch"));
      if (response.statusCode !== 200 || response.headers.location || response.headers["content-type"] !== "text/plain; charset=utf-8") return finish(Error("Probe mismatch"));
      const chunks: Buffer[] = []; let size = 0;
      response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 128) return finish(Error("Probe too large")); chunks.push(chunk); });
      response.on("error", error => finish(error)); response.on("end", () => finish(undefined,Buffer.concat(chunks).toString("utf8")));
    });
    const deadline = setTimeout(() => finish(Error("Probe total deadline")), 5000);
    req.on("timeout", () => finish(Error("Probe timeout"))); req.on("error", error => finish(error)); req.end();
  });
  if (body !== PROBE_BODY) throw Error("Wrong deployment marker");
  return {leafFingerprintSha256: tls.fingerprint, leafNotAfter: tls.expires, deploymentProbeMatched: true};
}
