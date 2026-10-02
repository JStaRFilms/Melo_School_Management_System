import { describe, expect, test, vi } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import { CHALLENGE_MS, FRESH_MS, normalizeHostname, ready, gatewayAuthorized } from "./domainRules";
import { publicAddress, providerRead } from "./providerNode";
const PROJECT = "prj_1234567890123456";
function domain(now: number): Doc<"schoolDomains"> {
  return {status:"active",verificationGeneration:1,verificationTokenHash:"sha",verificationExpiresAt:now+CHALLENGE_MS,
    ownershipObservation:{generation:1,tokenHash:"sha",observedAt:now},providerRoutingObservation:{generation:1,observedAt:now,projectId:PROJECT,projectDomainVerified:true,configuredBy:"CNAME",misconfigured:false},
    tlsObservation:{generation:1,observedAt:now,leafFingerprintSha256:"a".repeat(64),leafNotAfter:now+172_800_000,deploymentProbeMatched:true}} as Doc<"schoolDomains">;
}
describe("site hostname gates", () => {
  test("normalizes case and trailing dot, rejects unsafe names and reserved domains", () => {
    expect(normalizeHostname("School.Synthetic.EDU.")).toBe("school.synthetic.edu");
    for (const name of ["school.example.org","localhost","school.local","http://school.edu","school.edu:443","user@school.edu","*.school.edu","127.0.0.1","school.vercel.app"]) expect(() => normalizeHostname(name)).toThrow();
  });
  test("denies stale, rotated, expired and unsupported readiness", () => {
    const now = Date.now(), d = domain(now);
    expect(ready(d,now,PROJECT)).toBe(true);
    expect(ready(d,now+FRESH_MS,PROJECT)).toBe(false);
    expect(ready({...d,verificationGeneration:2},now,PROJECT)).toBe(false);
    expect(ready({...d,verificationExpiresAt:now},now,PROJECT)).toBe(false);
    expect(ready({...d,providerRoutingObservation:{...d.providerRoutingObservation!,projectId:"prj_other"}},now,PROJECT)).toBe(false);
    expect(ready({...d,status:"suspended"},now,PROJECT)).toBe(false);
    expect(ready({...d,providerOperation:{operation:"attach",state:"in_flight",generation:1,tokenHash:"sha",startedAt:now,reconcileAfter:now+30_000}},now,PROJECT)).toBe(false);
    expect(ready({...d,providerRoutingObservation:{...d.providerRoutingObservation!,configuredBy:"http"}},now,PROJECT)).toBe(false);
    expect(gatewayAuthorized("bad")).toBe(false);
  });
  test("rejects local, metadata, documentation and special-purpose DNS addresses", () => {
    for (const ip of ["127.0.0.1","10.1.1.1","169.254.169.254","192.168.0.1","100.100.100.100","192.0.0.9","192.0.2.5","198.51.100.4","203.0.113.5","::1","fc00::1","2001:db8::1","::ffff:127.0.0.1"]) expect(publicAddress(ip)).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
    for (const ip of ["2001:4860:4860::8888","2001:4860:4860:0:0:0:0:8888","2001:4860:4860::8888".toUpperCase(),"2606:4700::1111","3000::1","3ffe:ffff::1"]) expect(publicAddress(ip)).toBe(true);
    for (const ip of ["::","fe80::1","ff02::1","2001::1","2001:0:1234::1","2001:2::1","2001:20::1","2001:db8:ffff::1","2002:0808:0808::1","3fff::1","3fff:f::1","::ffff:8.8.8.8","64:ff9b::808:808","2001:db8::ffff:127.0.0.1"]) expect(publicAddress(ip)).toBe(false);
  });
});
describe("Vercel read-only response", () => {
  test("checks exact project and production list and takes recommendations from config", async () => {
    vi.stubEnv("SITES_VERCEL_PROJECT_ID",PROJECT); vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
    const entry = {name:"school.synthetic.edu",projectId:PROJECT,verified:true};
    const fetchMock = vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname.includes("/config") ? {misconfigured:false,configuredBy:"CNAME",recommendedCNAME:[{rank:1,value:"example.vercel-dns.com"}],recommendedIPv4:[]} : url.pathname.endsWith("/domains") ? {domains:[entry],pagination:{count:1,next:null,prev:null}} : entry),{status:200}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(providerRead(entry.name)).resolves.toMatchObject({recommendedCNAME:[{rank:1,value:"example.vercel-dns.com"}]});
    expect(fetchMock).toHaveBeenCalledTimes(3);
    fetchMock.mockImplementation(async (url: URL) => new Response(JSON.stringify(url.pathname.includes("/config") ? {misconfigured:false,configuredBy:"http"} : url.pathname.endsWith("/domains") ? {domains:[entry],pagination:{count:1,next:null,prev:null}} : entry),{status:200}));
    await expect(providerRead(entry.name)).rejects.toThrow("Domain routing is not ready");
    fetchMock.mockImplementation(async (url: URL) => new Response(JSON.stringify(url.pathname.includes("/config") ? {misconfigured:false,configuredBy:"CNAME"} : url.pathname.endsWith("/domains") ? {domains:[entry],pagination:{count:1,next:null,prev:null}} : entry),{status:200}));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({...entry,gitBranch:"preview"}),{status:200}));
    await expect(providerRead(entry.name)).rejects.toThrow();
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });
});
