import { convexTest } from "convex-test";
const network = vi.hoisted(() => ({txt:new Map<string,string>(), posts:0, fail:false}));
vi.mock("./providerNode",() => ({
  ownershipTxt: async (name:string,value:string) => network.txt.get(name) === value,
  providerRead: async (_host:string) => ({projectId:"prj_1234567890123456",configuredBy:"CNAME",recommendedCNAME:[],recommendedIPv4:[]}),
  probeTls: async (_host:string) => ({leafFingerprintSha256:"a".repeat(64),leafNotAfter:Date.now()+172_800_000,deploymentProbeMatched:true}),
  providerConfig: () => ({projectId:"prj_1234567890123456",token:"synthetic-provider-token-long-enough"}),
  providerWrite: async (host:string) => {network.posts++; if (network.fail) throw Error("Synthetic POST uncertain"); return {name:host,verified:false};},
  providerReconcile: async () => null,
}));
import { expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path,load]) => [path.replace(/^\.\.\/\.\.\//,"./"),load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path,load]) => [path.replace("./","./functions/sites/"),load])),
};
const ident = (name:string) => ({subject:name,tokenIdentifier:`test|${name}`,issuer:"test"});
test("fresh independent proof, publication, canonical, alias and public gates",async () => {
  vi.stubEnv("SITES_VERCEL_PROJECT_ID","prj_1234567890123456");
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  vi.stubEnv("SITES_GATEWAY_SECRET","synthetic-private-server-gateway-123456789");
  vi.stubEnv("SITES_ALLOW_PROVIDER_WRITES","enabled");
  network.posts = 0; network.fail = false; network.txt.clear();
  const t = convexTest(schema,modules); const now = Date.now();
  const schoolId = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools",{name:"Synthetic School",slug:"synthetic-school",status:"active",createdAt:now,updatedAt:now});
    await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
    const publisher = await ctx.db.insert("users",{schoolId,authId:"publisher",authTokenIdentifier:"test|publisher",name:"Publisher",email:"publisher@example.test",role:"staff",createdAt:now,updatedAt:now});
    const reviewer = await ctx.db.insert("users",{schoolId,authId:"reviewer",authTokenIdentifier:"test|reviewer",name:"Reviewer",email:"reviewer@example.test",role:"staff",createdAt:now,updatedAt:now});
    for (const capability of ["settings.manage","site.publish.standard","site.domain.request"] as const) await ctx.db.insert("schoolCapabilityGrants",{schoolId,userId:publisher,capability,scope:"school",grantedByUserId:reviewer,reason:"synthetic",isBreakGlass:false,createdAt:now});
    await ctx.db.insert("schoolCapabilityGrants",{schoolId,userId:reviewer,capability:"privacy.approve",scope:"school",grantedByUserId:publisher,reason:"synthetic",isBreakGlass:false,createdAt:now});
    return schoolId;
  });
  const operator = t.withIdentity(ident("operator")); const publisher = t.withIdentity(ident("publisher")); const reviewer = t.withIdentity(ident("reviewer"));
  await operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
  const content = {fields:[{fieldId:"school_name",value:{kind:"text" as const,value:"Synthetic School"}},{fieldId:"intro",value:{kind:"text" as const,value:"Hello"}}],routeSeo:[{routeId:"home",title:"Synthetic School"}]};
  const saved = await publisher.mutation(api.functions.sites.content.saveDraft,{schoolId,content,expectedDraftVersion:0});
  const first = await publisher.mutation(api.functions.sites.domains.requestDomain,{schoolId,hostname:"canonical.synthetic.edu",canonicalIntent:"canonical"});
  const alias = await publisher.mutation(api.functions.sites.domains.requestDomain,{schoolId,hostname:"alias.synthetic.edu",canonicalIntent:"redirect"});
  const second = await publisher.mutation(api.functions.sites.domains.requestDomain,{schoolId,hostname:"other.synthetic.edu",canonicalIntent:"canonical"});
  for (const requested of [first,alias,second]) network.txt.set(requested.recordName,requested.recordValue);
  for (const requested of [first,alias,second]) await operator.action(api.functions.sites.domainActions.checkReadiness,{domainId:requested.domainId});
  await expect(operator.mutation(api.functions.sites.domains.activateDomain,{domainId:first.domainId})).rejects.toThrow();
  // The approver has no publish grant; evidence is bound to the draft's typed value.
  const candidate = await reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId,fieldId:"school_name"});
  await reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Fictional signed source",expiresAt:Date.now()+86_400_000,confirmed:true});
  await publisher.mutation(api.functions.sites.content.publishDraft,{schoolId,expectedDraftVersion:saved.draftVersion});
  await operator.mutation(api.functions.sites.domains.activateDomain,{domainId:first.domainId});
  await expect(operator.mutation(api.functions.sites.domains.activateDomain,{domainId:second.domainId})).rejects.toThrow();
  await operator.mutation(api.functions.sites.domains.activateDomain,{domainId:alias.domainId,canonicalDomainId:first.domainId});
  const result = await t.action(api.functions.sites.public.resolvePublicSite,{hostname:"alias.synthetic.edu",routeId:"home",gatewaySecret:"synthetic-private-server-gateway-123456789"});
  expect(result.status).toBe("available");
  const pathArgs = {hostname:"alias.synthetic.edu",gatewaySecret:"synthetic-private-server-gateway-123456789"};
  expect((await t.action(api.functions.sites.public.resolvePublicPath,{...pathArgs,path:"/about"})).status).toBe("available");
  for (const path of ["/unknown","/admissions/visit","/%2e%2e/about","//about"]) {
    expect(await t.action(api.functions.sites.public.resolvePublicPath,{...pathArgs,path})).toEqual({status:"unavailable"});
  }
  expect(await t.action(api.functions.sites.public.resolvePublicPath,{...pathArgs,path:"/about",gatewaySecret:"bad"})).toEqual({status:"unavailable"});
  if (result.status === "available") {
    expect(result.site.canonicalOrigin).toBe("https://canonical.synthetic.edu");
    expect(result.site.redirectToCanonical).toBe(true);
    expect(result.site.applicationLink.version).toBe("1");
    expect(JSON.stringify(result.site)).not.toContain("evidenceReference");
  }
  expect(await t.action(api.functions.sites.public.resolvePublicSite,{hostname:"alias.synthetic.edu",routeId:"home",gatewaySecret:"bad"})).toEqual({status:"unavailable"});
  expect(await t.action(api.functions.sites.public.resolvePublicSite,{hostname:"alias.synthetic.edu",routeId:"wrong",gatewaySecret:"synthetic-private-server-gateway-123456789"})).toEqual({status:"unavailable"});
  // An active lifecycle status cannot reuse proofs recorded before a provider POST.
  const publicArgs = {hostname:"canonical.synthetic.edu",routeId:"home",gatewaySecret:"synthetic-private-server-gateway-123456789"};
  expect((await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).status).toBe("available");
  const beforeWrite = await operator.query(internal.functions.sites.domains.snapshot,{domainId:first.domainId,operator:true,now:Date.now()});
  await operator.action(api.functions.sites.domainActions.mutateProvider,{domainId:first.domainId,operation:"attach",confirmation:"CONFIRM ATTACH canonical.synthetic.edu"});
  await expect(operator.mutation(internal.functions.sites.domains.commitCheck,{domainId:first.domainId,hostname:beforeWrite.hostname,generation:beforeWrite.generation,hash:beforeWrite.hash,operator:true,ownership:true,projectId:"prj_1234567890123456",configuredBy:"CNAME",fingerprint:"a".repeat(64),notAfter:Date.now()+172_800_000})).rejects.toThrow();
  expect(network.posts).toBe(1);
  expect((await t.run(ctx => ctx.db.get(first.domainId)))?.status).toBe("active");
  expect(await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).toEqual({status:"unavailable"});
  await expect(operator.mutation(api.functions.sites.domains.activateDomain,{domainId:first.domainId})).rejects.toThrow();
  await operator.action(api.functions.sites.domainActions.checkReadiness,{domainId:first.domainId});
  await operator.mutation(internal.functions.sites.domains.failedCheck,{domainId:first.domainId,hostname:beforeWrite.hostname,generation:beforeWrite.generation,hash:beforeWrite.hash,startedAt:beforeWrite.startedAt});
  expect((await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).status).toBe("available");
  network.fail = true;
  await expect(operator.action(api.functions.sites.domainActions.mutateProvider,{domainId:first.domainId,operation:"verify",confirmation:"CONFIRM VERIFY canonical.synthetic.edu"})).rejects.toThrow("Synthetic POST uncertain");
  expect(await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).toEqual({status:"unavailable"});
  await t.run(async ctx => {const d = await ctx.db.get(first.domainId); if (!d?.providerOperation) throw Error("Expected uncertain operation"); await ctx.db.patch(d._id,{providerOperation:{...d.providerOperation,reconcileAfter:Date.now()-1}});});
  await operator.action(api.functions.sites.domainActions.reconcileProvider,{domainId:first.domainId});
  expect(await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).toEqual({status:"unavailable"});
  await operator.action(api.functions.sites.domainActions.checkReadiness,{domainId:first.domainId});
  expect((await t.action(api.functions.sites.public.resolvePublicSite,publicArgs)).status).toBe("available");
  await operator.mutation(api.functions.sites.domains.suspendDomain,{domainId:first.domainId});
  expect(await t.action(api.functions.sites.public.resolvePublicSite,{hostname:"alias.synthetic.edu",routeId:"home",gatewaySecret:"synthetic-private-server-gateway-123456789"})).toEqual({status:"unavailable"});
  vi.unstubAllEnvs();
});
