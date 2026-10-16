import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path,load]) => [path.replace(/^\.\.\/\.\.\//,"./"),load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path,load]) => [path.replace("./","./functions/sites/"),load])),
};
import type { Doc } from "../../_generated/dataModel";
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
  expect(requested.expiresAt).toBeNull();
  expect(await t.run(ctx => ctx.db.get(requested.domainId))).toMatchObject({ownershipProofPolicy:"persistent_authoritative_v1"});
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
  expect(rotated.expiresAt).toBeNull();
  expect(await t.run(ctx => ctx.db.get(requested.domainId))).toMatchObject({status:"verification_pending",ownershipProofPolicy:"persistent_authoritative_v1"});
  await expect(operator.mutation(internal.functions.sites.domains.commitCheck,{domainId:requested.domainId,hostname:prior.hostname,generation:prior.generation,hash:prior.hash,operator:true,ownership:true,projectId:"prj_1234567890123456",configuredBy:"CNAME",fingerprint:"a".repeat(64),notAfter:now+172_800_000})).rejects.toThrow();
  await operator.mutation(api.functions.sites.domains.suspendDomain,{domainId:requested.domainId});
  await expect(operator.mutation(api.functions.sites.domains.activateDomain,{domainId:requested.domainId})).rejects.toThrow();
  await operator.mutation(api.functions.sites.domains.retireDomain,{domainId:requested.domainId});
  await expect(editor.mutation(api.functions.sites.domains.requestDomain,{schoolId:schoolA,hostname:"school.synthetic.edu",canonicalIntent:"canonical"})).rejects.toThrow();
  vi.unstubAllEnvs();
});

test("operator adoption preserves routing and rejects expired, stale, locked and raced legacy proofs", async () => {
  const t = convexTest(schema,modules), now = Date.now();
  const projectId = "prj_1234567890123456";
  vi.stubEnv("SITES_VERCEL_PROJECT_ID",projectId);
  vi.stubEnv("SITES_VERCEL_API_TOKEN","synthetic-secret-for-offline-mocked-tests-123");
  try {
    const domainId = await t.run(async ctx => {
      const schoolId = await ctx.db.insert("schools",{name:"Synthetic School",slug:"synthetic",status:"active",createdAt:now,updatedAt:now});
      await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
      return ctx.db.insert("schoolDomains",{schoolId,hostname:"legacy.synthetic.edu",surface:"public",kind:"custom_domain",status:"active",canonicalIntent:"canonical",ownership:"school_managed_dns",verificationGeneration:3,verificationTokenHash:"legacy-hash",verificationRecordName:"_school-site-verify.legacy.synthetic.edu",verificationRecordValue:"school-site-v1=legacy-token",verificationIssuedAt:now-86400_000,verificationExpiresAt:now+86400_000,ownershipObservation:{generation:3,tokenHash:"legacy-hash",observedAt:now},providerRoutingObservation:{generation:3,observedAt:now,projectId,projectDomainVerified:true,configuredBy:"CNAME",misconfigured:false},tlsObservation:{generation:3,observedAt:now,leafFingerprintSha256:"a".repeat(64),leafNotAfter:now+3*86400_000,deploymentProbeMatched:true},createdAt:now,updatedAt:now});
    });
    const operator = t.withIdentity(ident("operator"));
    const args = {domainId,confirmation:"CONFIRM PERSISTENT legacy.synthetic.edu"};
    const legacy = (await t.run(ctx => ctx.db.get(domainId)))!;
    await expect(t.mutation(api.functions.sites.domains.adoptPersistentOwnership,args)).rejects.toThrow();
    await expect(operator.mutation(api.functions.sites.domains.adoptPersistentOwnership,{...args,confirmation:"CONFIRM PERSISTENT other.synthetic.edu"})).rejects.toThrow();
    const restore = () => t.run(async ctx => {
      const {_id,_creationTime,...value} = legacy;
      void _creationTime;
      await ctx.db.replace(_id,value);
    });
    const patches: Partial<Doc<"schoolDomains">>[] = [
      {verificationExpiresAt:now-1}, {verificationExpiresAt:undefined}, {verificationExpiresAt:Infinity},
      {status:"suspended"}, {status:"retired"}, {verificationGeneration:4},
      {ownershipObservation:{...legacy.ownershipObservation!,observedAt:now-15*60_000}},
      {providerRoutingObservation:{...legacy.providerRoutingObservation!,projectId:"prj_other"}},
      {tlsObservation:{...legacy.tlsObservation!,deploymentProbeMatched:false}},
      {providerOperation:{operation:"attach",state:"uncertain",generation:3,tokenHash:"legacy-hash",startedAt:now,reconcileAfter:now+30_000}},
    ];
    for (const patch of patches) {
      await t.run(ctx => ctx.db.patch(domainId,patch));
      await expect(operator.mutation(api.functions.sites.domains.adoptPersistentOwnership,args)).rejects.toThrow();
      await restore();
    }
    await t.run(ctx => ctx.db.patch(domainId,{verificationExpiresAt:now-1}));
    await expect(operator.query(internal.functions.sites.domains.snapshot,{domainId,operator:true,now})).rejects.toThrow();
    await expect(operator.mutation(internal.functions.sites.domains.commitCheck,{domainId,hostname:legacy.hostname,generation:3,hash:"legacy-hash",operator:true,ownership:true,projectId,configuredBy:"CNAME",fingerprint:"a".repeat(64),notAfter:now+3*86400_000})).rejects.toThrow();
    await expect(operator.mutation(internal.functions.sites.domains.reserveProviderOperation,{domainId,hostname:legacy.hostname,generation:3,hash:"legacy-hash",operation:"attach"})).rejects.toThrow();
    await restore();
    await operator.mutation(api.functions.sites.domains.adoptPersistentOwnership,args);
    const adopted = (await t.run(ctx => ctx.db.get(domainId)))!;
    expect(adopted).toMatchObject({ownershipProofPolicy:"persistent_authoritative_v1",status:"active",verificationGeneration:legacy.verificationGeneration,verificationRecordValue:legacy.verificationRecordValue,ownershipObservation:legacy.ownershipObservation,providerRoutingObservation:legacy.providerRoutingObservation,tlsObservation:legacy.tlsObservation});
    expect(adopted.verificationExpiresAt).toBeUndefined();
    await expect(operator.query(internal.functions.sites.domains.snapshot,{domainId,operator:true,now:now+40*86400_000})).resolves.toMatchObject({generation:3,value:legacy.verificationRecordValue});
    const audit = await t.run(ctx => ctx.db.query("schoolSiteAuditEvents").withIndex("by_school",q => q.eq("schoolId",legacy.schoolId)).take(10));
    expect(audit).toEqual(expect.arrayContaining([expect.objectContaining({actorPlatformAdminId:expect.any(String),summary:expect.stringContaining(legacy.hostname)})]));
  } finally { vi.unstubAllEnvs(); }
});
