// @vitest-environment node
declare global {
  interface ImportMeta {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { createServer } from "vite";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { chromium, expect as browserExpect } from "@playwright/test";
import type { FunctionReference } from "convex/server";
import { api } from "../../_generated/api";
import schema from "../../schema";

const network = vi.hoisted(() => ({txt: new Map<string,string>()}));
vi.mock("./providerNode", () => ({
  ownershipTxt: async (name: string, value: string) => network.txt.get(name) === value,
  providerInstructions: async (hostname:string) => ({hostname,projectId:"prj_1234567890123456",verified:false,verification:[{type:"TXT",name:"_vercel.canonical.synthetic.edu",value:"vc-domain-verify=fixture",reason:"Verify ownership"}],recommendedCNAME:[{rank:2,value:"second.vercel-dns.test"},{rank:1,value:"first.vercel-dns.test"}],recommendedIPv4:[{rank:1,value:["198.51.100.7"]}]}),
  providerRead: async () => ({projectId:"prj_1234567890123456",configuredBy:"CNAME",recommendedCNAME:[{rank:2,value:"second.vercel-dns.test"},{rank:1,value:"first.vercel-dns.test"}],recommendedIPv4:[{rank:2,value:["198.51.100.8"]},{rank:1,value:["198.51.100.7","198.51.100.9"]}]}),
  probeTls: async () => ({leafFingerprintSha256:"a".repeat(64),leafNotAfter:Date.now()+172_800_000,deploymentProbeMatched:true}),
}));
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path,load]) => [path.replace(/^\.\.\/\.\.\//,"./"),load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path,load]) => [path.replace("./","./functions/sites/"),load])),
};
const identity = (name: string) => ({subject:name,tokenIdentifier:`test|${name}`,issuer:"test"});
const secret = "synthetic-private-server-gateway-123456789";

test("fresh Chromium drives actual Admin and Platform pages through authenticated convex-test functions", async () => {
  vi.stubEnv("SITES_VERCEL_PROJECT_ID","prj_1234567890123456");
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  vi.stubEnv("SITES_GATEWAY_SECRET",secret);
  const t = convexTest(schema,modules);
  const now = Date.now();
  const schoolId = await t.run(async ctx => {
    const id = await ctx.db.insert("schools",{name:"Fictional Academy",slug:"fictional-academy",status:"active",createdAt:now,updatedAt:now});
    await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
    const publisher = await ctx.db.insert("users",{schoolId:id,authId:"publisher",authTokenIdentifier:"test|publisher",name:"Publisher",email:"publisher@example.test",role:"staff",createdAt:now,updatedAt:now});
    const reviewer = await ctx.db.insert("users",{schoolId:id,authId:"reviewer",authTokenIdentifier:"test|reviewer",name:"Reviewer",email:"reviewer@example.test",role:"staff",createdAt:now,updatedAt:now});
    for (const capability of ["settings.manage","site.preview","site.publish.standard","site.domain.request"] as const) await ctx.db.insert("schoolCapabilityGrants",{schoolId:id,userId:publisher,capability,scope:"school",grantedByUserId:reviewer,reason:"synthetic",isBreakGlass:false,createdAt:now});
    await ctx.db.insert("schoolCapabilityGrants",{schoolId:id,userId:reviewer,capability:"privacy.approve",scope:"school",grantedByUserId:publisher,reason:"synthetic",isBreakGlass:false,createdAt:now});
    return id;
  });
  // The client supplies only a fixture session label. The server chooses the identity;
  // the browser never submits an auth token or an arbitrary user ID to a function.
  const sessions = {admin:t.withIdentity(identity("publisher")),reviewer:t.withIdentity(identity("reviewer")),platform:t.withIdentity(identity("operator"))};
  const calls: string[] = [];
  const vite = await createServer({configFile:false,root:process.cwd().replace(/\/packages\/convex$/, ""),server:{middlewareMode:true,host:"127.0.0.1",hmr:false,fs:{allow:[process.cwd().replace(/\/packages\/convex$/, "")]}},esbuild:{jsx:"automatic"},resolve:{alias:[
    {find:"@school/convex",replacement:`${process.cwd()}`},
    {find:"@school/shared",replacement:`${process.cwd()}/../shared/src`},
    {find:"@/AuthProvider",replacement:"fixture-auth"},
    {find:"@/convex-runtime",replacement:"fixture-config"},
    {find:"react-dom",replacement:`${process.cwd()}/../../apps/admin/node_modules/react-dom`},
    {find:/^@\//,replacement:`${process.cwd()}/../../apps/admin/lib/`},
    {find:"react/jsx-runtime",replacement:`${process.cwd()}/../../apps/admin/node_modules/react/jsx-runtime.js`},
    {find:"react",replacement:`${process.cwd()}/../../apps/admin/node_modules/react`},
  ]},plugins:[{name:"browser-fixture-shims",enforce:"pre",resolveId(id){if (id === "convex/react") return "\0fixture-convex"; if (id === "next/link") return "\0fixture-link"; if (id === "next/navigation") return "\0fixture-navigation"; if (id === "fixture-auth" || id === "@/AuthProvider") return "\0fixture-auth"; if (id === "fixture-config" || id === "@/convex-runtime") return "\0fixture-config";},load(id){
    if (id === "\0fixture-convex") return `import {getFunctionName} from 'convex/server'; const callbacks = new Map(); function hook(ref,method){const name=getFunctionName(ref);const key=method+name;if(!callbacks.has(key))callbacks.set(key,async args=>{const role=location.pathname==='/platform'?'platform':location.pathname==='/reviewer'?'reviewer':'admin';const response=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,method,name,args})});const result=await response.json();if(!response.ok)throw Error(result.error);return result.value});return callbacks.get(key)} export const useAction=ref=>hook(ref,'action'); export const useMutation=ref=>hook(ref,'mutation');`;
    if (id === "\0fixture-link") return `import React from 'react'; export default function Link({href,children,...props}){return React.createElement('a',{href,...props},children)}`;
    if (id === "\0fixture-navigation") return `export const useParams=()=>({schoolId:${JSON.stringify(schoolId)}});export const usePathname=()=>location.pathname;`;
    if (id === "\0fixture-auth") return `export const useAuth=()=>({workspaceAccess:{state:'ready',branch:{schoolId:${JSON.stringify(schoolId)}}}});`;
    if (id === "\0fixture-config") return `export const isConvexConfigured=()=>true;`;
  }}]});
  const route = async (req: IncomingMessage,res: ServerResponse,next: () => void) => {
    if (req.url === "/rpc" && req.method === "POST") {
      try {
        let body = ""; for await (const chunk of req) body += chunk;
        const message = JSON.parse(body) as {role:keyof typeof sessions;method:"mutation"|"action";name:string;args:Record<string,unknown>};
        if (!Object.hasOwn(sessions,message.role) || !/^(functions\/sites\/)(management|profiles|content|evidence|domains|domainActions):[a-zA-Z]+$/.test(message.name)) throw Error("Unknown fixture call");
        if (!message.name.includes(":")) throw Error("Invalid function reference");
        calls.push(`${message.role} ${message.method} ${message.name}`);
        const session = sessions[message.role];
        const value = message.method === "mutation" ? await session.mutation(message.name as unknown as FunctionReference<"mutation">,message.args) : await session.action(message.name as unknown as FunctionReference<"action">,message.args);
        res.setHeader("Content-Type","application/json"); res.end(JSON.stringify({value}));
      } catch (error) {res.statusCode = 400;res.setHeader("Content-Type","application/json");res.end(JSON.stringify({error:String(error)}));}
      return;
    }
    if (req.url === "/site-data") {
      const value = await t.action(api.functions.sites.public.resolvePublicSite,{hostname:"canonical.synthetic.edu",routeId:"home",gatewaySecret:secret});
      res.setHeader("Content-Type","application/json");res.end(JSON.stringify(value));return;
    }
    if (["/admin","/reviewer","/platform","/public"].includes(req.url ?? "")) {
      res.setHeader("Content-Type","text/html");res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/e2e/fixtures/sites/browser-entry.tsx"></script></body></html>');return;
    }
    next();
  };
  const server = createHttpServer((req,res) => {void route(req,res,() => vite.middlewares(req,res));});
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    server.listen(0,"127.0.0.1"); await once(server,"listening");
    const address = server.address(); if (!address || typeof address === "string") throw Error("No local port");
    const base = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage(); page.on("dialog",dialog => dialog.accept());page.on("pageerror",error => console.error("Browser error",error));
    await page.goto(`${base}/platform`);
    await page.getByRole("button",{name:"Provision synthetic renderer"}).click();
    await browserExpect(page.getByText(/Managed renderer school-core-synthetic-v1/)).toBeVisible();
    await page.goto(`${base}/admin`);
    await page.getByLabel("school_name (required)").fill("Fictional Academy");
    await page.getByLabel("intro (required)").fill("Welcome to Fictional Academy");
    await page.getByRole("button",{name:"Save draft"}).click();
    await browserExpect(page.getByText(/Draft version: 1/)).toBeVisible();
    await page.getByRole("button",{name:"Preview authorized draft"}).click();
    const privatePreview = page.getByRole("region",{name:"Private draft preview"});
    await browserExpect(privatePreview).toContainText("Welcome to Fictional Academy");
    await browserExpect(privatePreview).toContainText("noindex,nofollow. No canonical or public asset URL.");
    expect(await privatePreview.locator("a, img").count()).toBe(0);
    await page.getByRole("button",{name:"Publish saved draft"}).click();
    await browserExpect(page.getByRole("alert")).toBeVisible();
    await page.goto(`${base}/public`);
    await browserExpect(page.getByText("Site unavailable")).toBeVisible();
    await page.goto(`${base}/reviewer`);
    await page.getByRole("button",{name:"Publish saved draft"}).click();
    await browserExpect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button",{name:"Review school_name"}).click();
    await browserExpect(page.getByText(/SHA-256 digest/)).toBeVisible();
    await page.getByLabel("Independent source reference").fill("Fictional signed source document");
    const expiry = new Date(Date.now()+10*86_400_000).toISOString().slice(0,10);
    await page.getByLabel("Approval expires on").fill(expiry);
    await page.getByRole("checkbox",{name:/I inspected the independent source/}).check();
    await page.getByRole("button",{name:"Record independent approval"}).click();
    await page.goto(`${base}/admin`);
    await page.getByRole("button",{name:"Publish saved draft"}).click();
    await browserExpect(page.getByText(/Revision 1/)).toBeVisible();
    await page.getByLabel("Hostname, without scheme or port").fill("canonical.synthetic.edu");
    await page.getByRole("button",{name:"Request hostname"}).click();
    const instructions = await page.getByText(/Publish TXT _school-site-verify/).innerText();
    const match = instructions.match(/Publish TXT (\S+) = (\S+)\./);
    expect(match).not.toBeNull(); network.txt.set(match![1],match![2]);
    await page.goto(`${base}/platform`);
    await page.getByRole("button",{name:"Fetch DNS and verification instructions"}).click();
    await browserExpect(page.getByLabel("DNS instructions for canonical.synthetic.edu")).toContainText("Verification record owner _vercel.canonical.synthetic.edu, type TXT, value vc-domain-verify=fixture");
    await browserExpect(page.getByLabel("DNS instructions for canonical.synthetic.edu")).toContainText("type CNAME: rank 1: first.vercel-dns.test; rank 2: second.vercel-dns.test");
    await browserExpect(page.getByText(/Readiness observations missing or stale/)).toBeVisible();
    expect(calls.some(call => call.includes("domainActions:checkReadiness"))).toBe(false);
    await page.getByRole("button",{name:"Run read-only readiness check"}).click();
    await browserExpect(page.getByRole("status")).toContainText("CNAME rank 1: first.vercel-dns.test; rank 2: second.vercel-dns.test, IPv4 rank 1: 198.51.100.7, 198.51.100.9; rank 2: 198.51.100.8");
    expect(await page.getByRole("status").innerText()).not.toContain("[object Object]");
    await page.getByRole("button",{name:"Activate host"}).click();
    await browserExpect(page.getByText(/Status active\. Intent canonical/)).toBeVisible();
    await page.goto(`${base}/public`);
    await browserExpect(page.getByRole("heading",{name:"Fictional Academy"})).toBeVisible();
    await browserExpect(page.getByText("Welcome to Fictional Academy")).toBeVisible();
    const publicDto = await (await page.request.get(`${base}/site-data`)).text();
    const publicHtml = await page.locator("body").innerText();
    for (const privateValue of [secret,"Fictional signed source document","_school-site-verify","test|publisher","test|reviewer","storageId","rightsStatus","gatewaySecret","authTokenIdentifier","evidenceReference"]) {
      expect(publicDto).not.toContain(privateValue);expect(publicHtml).not.toContain(privateValue);
    }
    await page.goto(`${base}/admin`);
    await page.getByLabel("intro (required)").fill("A private revision only");
    await page.getByRole("button",{name:"Save draft"}).click();
    await page.goto(`${base}/public`);
    await browserExpect(page.getByText("Welcome to Fictional Academy")).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain("A private revision only");
    await page.goto(`${base}/platform`);
    await page.getByRole("button",{name:"Suspend"}).click();
    await page.goto(`${base}/public`);
    await browserExpect(page.getByText("Site unavailable")).toBeVisible();
    expect(calls).toEqual(expect.arrayContaining([expect.stringContaining("platform action functions/sites/domainActions:checkReadiness"),expect.stringContaining("reviewer mutation functions/sites/evidence:approveCandidate"),expect.stringContaining("admin mutation functions/sites/content:publishDraft")]));
  } finally {
    await browser?.close();await new Promise<void>(resolve => server.close(() => resolve()));await vite.close();vi.unstubAllEnvs();network.txt.clear();
  }
},120_000);
