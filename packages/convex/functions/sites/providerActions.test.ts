import {convexTest} from "convex-test";
import {expect,test,vi} from "vitest";
import {api} from "../../_generated/api";
import schema from "../../schema";
const provider = vi.hoisted(() => ({txt:new Map<string,string>(),posts:0,reconciles:0,fail:false,wait:null as null | (() => void)}));
vi.mock("./providerNode",() => ({
  providerConfig: () => ({projectId:"prj_1234567890123456",token:"synthetic-provider-token-long-enough"}),
  ownershipTxt: async (name:string,value:string) => provider.txt.get(name) === value,
  providerWrite: async (host:string) => {provider.posts++;await new Promise<void>(resolve => {provider.wait = resolve;});if (provider.fail) throw Error("Provider timeout after POST");return {name:host,verified:false};},
  providerReconcile: async () => {provider.reconciles++;},
}));
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path,load]) => [path.replace(/^\.\.\/\.\.\//,"./"),load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path,load]) => [path.replace("./","./functions/sites/"),load])),
};
const ident = (name:string) => ({subject:name,tokenIdentifier:`test|${name}`,issuer:"test"});
test("real action reserves before POST, denies mutation in flight, and reconciles uncertain outcome without retry",async () => {
  vi.stubEnv("SITES_VERCEL_PROJECT_ID","prj_1234567890123456");
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  vi.stubEnv("SITES_ALLOW_PROVIDER_WRITES","enabled");
  provider.posts = 0; provider.reconciles = 0; provider.fail = false; provider.txt.clear(); provider.wait = null;
  const t = convexTest(schema,modules); const now = Date.now();
  const schoolId = await t.run(async ctx => {
    const schoolId = await ctx.db.insert("schools",{name:"Synthetic",slug:"synthetic",status:"active",createdAt:now,updatedAt:now});
    await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
    const editor = await ctx.db.insert("users",{schoolId,authId:"editor",authTokenIdentifier:"test|editor",email:"editor@example.test",name:"Editor",role:"staff",createdAt:now,updatedAt:now});
    await ctx.db.insert("schoolCapabilityGrants",{schoolId,userId:editor,capability:"site.domain.request",scope:"school",grantedByUserId:editor,reason:"synthetic",isBreakGlass:false,createdAt:now});
    return schoolId;
  });
  const operator = t.withIdentity(ident("operator")); const editor = t.withIdentity(ident("editor"));
  await operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
  const requested = await editor.mutation(api.functions.sites.domains.requestDomain,{schoolId,hostname:"school.synthetic.edu",canonicalIntent:"canonical"});
  const args = {domainId:requested.domainId,operation:"attach" as const,confirmation:"CONFIRM ATTACH school.synthetic.edu"};
  await expect(operator.action(api.functions.sites.domainActions.mutateProvider,args)).rejects.toThrow("Fresh school TXT proof");
  expect(provider.posts).toBe(0);
  provider.txt.set(requested.recordName,requested.recordValue);
  const writing = operator.action(api.functions.sites.domainActions.mutateProvider,args);
  for (let attempt=0;attempt<100 && !provider.wait;attempt++) await new Promise(resolve => setTimeout(resolve,5));
  expect(provider.posts).toBe(1);
  await expect(editor.mutation(api.functions.sites.domains.rotateChallenge,{schoolId,domainId:requested.domainId})).rejects.toThrow();
  await expect(operator.mutation(api.functions.sites.domains.retireDomain,{domainId:requested.domainId})).rejects.toThrow();
  await expect(operator.action(api.functions.sites.domainActions.mutateProvider,args)).rejects.toThrow();
  (provider.wait as (() => void) | null)?.(); await writing;
  expect(provider.posts).toBe(1);
  provider.fail = true; provider.wait = null;
  const failed = operator.action(api.functions.sites.domainActions.mutateProvider,{...args,operation:"verify",confirmation:"CONFIRM VERIFY school.synthetic.edu"});
  for (let attempt=0;attempt<100 && !provider.wait;attempt++) await new Promise(resolve => setTimeout(resolve,5));
  expect(provider.posts).toBe(2);
  (provider.wait as (() => void) | null)?.(); await expect(failed).rejects.toThrow("Provider timeout after POST");
  await expect(operator.action(api.functions.sites.domainActions.mutateProvider,args)).rejects.toThrow();
  await t.run(async ctx => {const d = await ctx.db.get(requested.domainId); if (!d?.providerOperation) throw Error("Missing uncertain reservation"); await ctx.db.patch(d._id,{providerOperation:{...d.providerOperation,reconcileAfter:Date.now()-1}});});
  await operator.action(api.functions.sites.domainActions.reconcileProvider,{domainId:requested.domainId});
  expect(provider.reconciles).toBe(1);
  expect(provider.posts).toBe(2);
  vi.unstubAllEnvs();
});
