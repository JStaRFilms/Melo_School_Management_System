import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path,load]) => [path.replace(/^\.\.\/\.\.\//,"./"),load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path,load]) => [path.replace("./","./functions/sites/"),load])),
};
const ident = (name: string) => ({subject:name,tokenIdentifier:`test|${name}`,issuer:"test"});
test("request is globally unique; rotation invalidates late checks; suspension and retirement reserve the host",async () => {
  const t = convexTest(schema,modules); const now = Date.now();
  vi.stubEnv("SITES_VERCEL_PROJECT_ID","prj_1234567890123456");
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  const {schoolA,schoolB} = await t.run(async ctx => {
    const schoolA = await ctx.db.insert("schools",{name:"Synthetic School A",slug:"synthetic-a",status:"active",createdAt:now,updatedAt:now});
    const schoolB = await ctx.db.insert("schools",{name:"Synthetic School B",slug:"synthetic-b",status:"active",createdAt:now,updatedAt:now});
    await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
    for (const [schoolId,name] of [[schoolA,"editor"],[schoolB,"other"]] as const) {
      const userId = await ctx.db.insert("users",{schoolId,authId:name,authTokenIdentifier:`test|${name}`,name,email:`${name}@example.test`,role:"staff",createdAt:now,updatedAt:now});
      await ctx.db.insert("schoolCapabilityGrants",{schoolId,userId,capability:"site.domain.request",scope:"school",grantedByUserId:userId,reason:"synthetic",isBreakGlass:false,createdAt:now});
    }
    return {schoolA,schoolB};
  });
  const operator = t.withIdentity(ident("operator")); const editor = t.withIdentity(ident("editor")); const other = t.withIdentity(ident("other"));
  for (const schoolId of [schoolA,schoolB]) await operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
  const requested = await editor.mutation(api.functions.sites.domains.requestDomain,{schoolId:schoolA,hostname:"School.Synthetic.EDU.",canonicalIntent:"canonical"});
  expect(requested.hostname).toBe("school.synthetic.edu");
  await expect(other.mutation(api.functions.sites.domains.requestDomain,{schoolId:schoolB,hostname:"school.synthetic.edu",canonicalIntent:"canonical"})).rejects.toThrow();
  await expect(other.mutation(api.functions.sites.domains.rotateChallenge,{schoolId:schoolB,domainId:requested.domainId})).rejects.toThrow();
  const prior = await operator.query(internal.functions.sites.domains.snapshot,{domainId:requested.domainId,operator:true,now:Date.now()});
  const key = {domainId:requested.domainId,hostname:prior.hostname,generation:prior.generation,hash:prior.hash,operation:"attach" as const};
  await operator.mutation(internal.functions.sites.domains.reserveProviderOperation,key);
  await expect(operator.mutation(internal.functions.sites.domains.reserveProviderOperation,key)).rejects.toThrow();
  await expect(editor.mutation(api.functions.sites.domains.rotateChallenge,{schoolId:schoolA,domainId:requested.domainId})).rejects.toThrow();
  await expect(operator.mutation(api.functions.sites.domains.suspendDomain,{domainId:requested.domainId})).rejects.toThrow();
  await expect(operator.mutation(api.functions.sites.domains.retireDomain,{domainId:requested.domainId})).rejects.toThrow();
  await operator.mutation(internal.functions.sites.domains.finishProviderOperation,{...key,confirmed:false});
  await expect(operator.mutation(internal.functions.sites.domains.reserveProviderOperation,key)).rejects.toThrow();
  await t.run(async ctx => { const d = await ctx.db.get(requested.domainId); if (!d?.providerOperation) throw Error("Missing reservation"); await ctx.db.patch(d._id,{providerOperation:{...d.providerOperation,reconcileAfter:Date.now()-1}}); });
  await operator.mutation(internal.functions.sites.domains.reconcileProviderOperation,key);
  const rotated = await editor.mutation(api.functions.sites.domains.rotateChallenge,{schoolId:schoolA,domainId:requested.domainId});
  expect(rotated.recordValue).not.toBe(requested.recordValue);
  await expect(operator.mutation(internal.functions.sites.domains.commitCheck,{domainId:requested.domainId,hostname:prior.hostname,generation:prior.generation,hash:prior.hash,operator:true,ownership:true,projectId:"prj_1234567890123456",configuredBy:"CNAME",fingerprint:"a".repeat(64),notAfter:now+172_800_000})).rejects.toThrow();
  await operator.mutation(api.functions.sites.domains.suspendDomain,{domainId:requested.domainId});
  await expect(operator.mutation(api.functions.sites.domains.activateDomain,{domainId:requested.domainId})).rejects.toThrow();
  await operator.mutation(api.functions.sites.domains.retireDomain,{domainId:requested.domainId});
  await expect(editor.mutation(api.functions.sites.domains.requestDomain,{schoolId:schoolA,hostname:"school.synthetic.edu",canonicalIntent:"canonical"})).rejects.toThrow();
  vi.unstubAllEnvs();
});
