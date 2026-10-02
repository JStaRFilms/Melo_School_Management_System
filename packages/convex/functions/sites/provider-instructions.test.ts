import {afterEach, expect, test, vi} from "vitest";
import {providerInstructions, providerRead} from "./providerNode";
const projectId = "prj_1234567890123456";
const host = "school.synthetic.edu";
const domain = {name:host,projectId,verified:false,gitBranch:null,customEnvironmentId:null,redirect:null,verification:[{type:"TXT",domain:"_vercel.school.synthetic.edu",value:"vc-domain-verify=abc123",reason:"Verify domain ownership"}]};
const config = {misconfigured:true,configuredBy:null,recommendedCNAME:[{rank:2,value:"second.vercel-dns.com"},{rank:1,value:"first.vercel-dns.com"}],recommendedIPv4:[{rank:1,value:["76.76.21.21"]}]};
afterEach(() => {vi.unstubAllGlobals();vi.unstubAllEnvs();});
function mock(single: Record<string,unknown> = domain, listed: Record<string,unknown> = domain, routing: Record<string,unknown> = config) {
  const fetcher = vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
    expect(options?.method).toBeUndefined();
    const url = new URL(String(input));
    const data = url.pathname.includes("/v6/") ? routing : url.searchParams.has("production") ? {domains:[listed],pagination:{next:null}} : single;
    return {ok:true,headers:new Headers(),text:async () => JSON.stringify(data)};
  });
  vi.stubGlobal("fetch",fetcher);
  vi.stubEnv("SITES_VERCEL_PROJECT_ID",projectId);
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  return fetcher;
}
test("pending attached domain exposes ranked provider instructions, never readiness",async () => {
  const fetcher = mock();
  expect(await providerInstructions(host)).toEqual({hostname:host,projectId,verified:false,verification:[{type:"TXT",name:"_vercel.school.synthetic.edu",value:"vc-domain-verify=abc123",reason:"Verify domain ownership"}],recommendedCNAME:[{rank:1,value:"first.vercel-dns.com"},{rank:2,value:"second.vercel-dns.com"}],recommendedIPv4:[{rank:1,value:["76.76.21.21"]}]});
  await expect(providerRead(host)).rejects.toThrow("production alias");
  expect(fetcher).toHaveBeenCalledTimes(4);
});
test("wrong project or nonproduction environment in either response is denied",async () => {
  for (const [single,listed] of [[{...domain,projectId:"prj_other"},domain],[domain,{...domain,customEnvironmentId:"env_wrong"}],[{...domain,redirect:"elsewhere.edu"},domain]]) {
    mock(single,listed);
    await expect(providerInstructions(host)).rejects.toThrow();
  }
});
test("unsafe or unbounded records fail without disclosing provider fields",async () => {
  mock(domain,domain,{...config,recommendedCNAME:[{rank:1,value:"bad.example.com/path"}]});
  await expect(providerInstructions(host)).rejects.toThrow("Invalid CNAME recommendation");
  mock({...domain,verification:[{...domain.verification[0],value:"secret\nheader"}]});
  await expect(providerInstructions(host)).rejects.toThrow("Invalid TXT challenge");
});
