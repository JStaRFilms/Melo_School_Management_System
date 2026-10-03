import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../_generated/api";
import schema from "../../schema";
import type { Id } from "../../_generated/dataModel";
import { encode } from "fast-png";
import { storageDigest, validatePublication } from "./shared";
import { encodeSiteUploadMetadata } from "@school/shared/site-upload-metadata";
import { siteManifest, type SiteContentV1 } from "@school/shared/site-manifests";
const pixel = new Uint8Array(encode({width:1,height:1,channels:4,depth:8,data:new Uint8Array([24,55,88,255])}));
const modules = {
  ...Object.fromEntries(Object.entries(import.meta.glob("../../**/*.ts")).map(([path, load]) => [path.replace(/^\.\.\/\.\.\//, "./"), load])),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.ts")).map(([path, load]) => [path.replace("./", "./functions/sites/"), load])),
};
const content = {fields:[{fieldId:"school_name",value:{kind:"text" as const,value:"Synthetic School"}},{fieldId:"intro",value:{kind:"text" as const,value:"Hello"}}],routeSeo:[{routeId:"home",title:"Synthetic School"}]};
const ident = (name: string) => ({subject:name,tokenIdentifier:`test|${name}`,issuer:"test"});
async function fixture() {
  const t = convexTest(schema,modules);
  const ids = await t.run(async ctx => {
    const now = Date.now();
    const schoolA = await ctx.db.insert("schools", {name:"Synthetic School",slug:"synthetic-a",status:"active",createdAt:now,updatedAt:now});
    const schoolB = await ctx.db.insert("schools", {name:"Synthetic B",slug:"synthetic-b",status:"active",createdAt:now,updatedAt:now});
    const users = [];
    for (const [name,schoolId] of [["editor",schoolA],["reviewer",schoolA],["other",schoolB]] as const) {
      const userId = await ctx.db.insert("users",{schoolId,authId:name,authTokenIdentifier:`test|${name}`,name,email:`${name}@example.test`,role:"staff",createdAt:now,updatedAt:now});
      users.push(userId);
    }
    const capabilities = ["settings.manage","site.preview","site.publish.standard","site.publish.sensitive","site.revert"] as const;
    for (const capability of capabilities) await ctx.db.insert("schoolCapabilityGrants",{schoolId:schoolA,userId:users[0],capability,scope:"school",grantedByUserId:users[1],reason:"synthetic",isBreakGlass:false,createdAt:now});
    await ctx.db.insert("schoolCapabilityGrants",{schoolId:schoolA,userId:users[1],capability:"privacy.approve",scope:"school",grantedByUserId:users[0],reason:"synthetic",isBreakGlass:false,createdAt:now});
    await ctx.db.insert("schoolCapabilityGrants",{schoolId:schoolB,userId:users[2],capability:"settings.manage",scope:"school",grantedByUserId:users[2],reason:"synthetic",isBreakGlass:false,createdAt:now});
    await ctx.db.insert("platformAdmins",{authId:"operator",authTokenIdentifier:"test|operator",email:"operator@example.test",name:"Operator",isActive:true,createdAt:now,updatedAt:now});
    return {schoolA,schoolB};
  });
  return {t,...ids,editor:t.withIdentity(ident("editor")),reviewer:t.withIdentity(ident("reviewer")),other:t.withIdentity(ident("other")),operator:t.withIdentity(ident("operator"))};
}
describe("managed site boundary", () => {
  test("immutable Olive publication needs identity, sensitive facts and independent evidence for every image", async () => {
    const f = await fixture();
    const manifest = siteManifest("obhis-v1", "1")!;
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"obhis-v1",rendererSchemaVersion:"1"});
    const assets = new Map<string, {id:Id<"schoolSiteAssets">; checksum:string}>();
    for (const def of manifest.fields.filter(d => d.kind === "asset_ref")) {
      const response = await f.editor.fetch("/sites/asset-upload",{method:"POST",headers:{"content-length":String(pixel.length),"content-type":"image/png","x-site-school":f.schoolA,"x-site-kind":def.assetKind!,"x-site-filename":`${def.fieldId}.png`,"x-site-alt":`Fictional ${def.fieldId} image`},body:pixel});
      expect(response.status).toBe(201);
      const {assetId} = await response.json() as {assetId:string};
      const asset = await f.t.run(ctx => ctx.db.get(assetId as import("../../_generated/dataModel").Id<"schoolSiteAssets">));
      assets.set(def.fieldId,{id:assetId as Id<"schoolSiteAssets">,checksum:asset!.checksum});
    }
    const content = {fields: manifest.fields.map(def => ({fieldId:def.fieldId,value:def.kind === "asset_ref" ? {kind:"asset_ref" as const,assetId:assets.get(def.fieldId)!.id} : {kind:"text" as const,value:def.fieldId === "school_name" ? "Synthetic School" : def.fieldId === "primary_color" ? "#176c49" : def.fieldId === "accent_color" ? "#39bcd3" : def.fieldId === "phone" ? "+2348057755997" : def.fieldId === "email" ? "test@example.test" : def.fieldId.endsWith("_alt") ? `Fictional ${def.fieldId.slice(0,-4)} image` : `Fictional ${def.fieldId}`}})),routeSeo:[{routeId:"home",title:"Synthetic School",description:"Fictional intro"}]} satisfies SiteContentV1;
    await expect(f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:{...content,routeSeo:[{routeId:"home",title:"Unreviewed award claim"}]},expectedDraftVersion:0})).rejects.toThrow("Unapproved Olive SEO copy");
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0});
    const publish = () => f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1});
    await expect(publish()).rejects.toThrow();
    const approveField = async (fieldId: string) => {
      const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId});
      return f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId,expectedDigest:candidate.digest},evidenceReference:`Synthetic ${fieldId} source`,expiresAt:Date.now()+120_000,confirmed:true});
    };
    for (const fieldId of manifest.fields.filter(def => def.kind === "text" && def.fieldId !== "school_logo_alt").map(def => def.fieldId)) {
      const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId});
      await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId,expectedDigest:candidate.digest},evidenceReference:`Synthetic ${fieldId} source`,expiresAt:Date.now()+120_000,confirmed:true});
    }
    await expect(publish()).rejects.toThrow();
    for (const [key,asset] of assets) {
      const base = {schoolId:f.schoolA,evidenceReference:`Synthetic ${key} record`,expiresAt:Date.now()+120_000,confirmed:true};
      await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{...base,candidate:{kind:"asset_rights",assetId:asset.id,expectedChecksum:asset.checksum}});
      await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{...base,candidate:{kind:"asset_child_applicability",assetId:asset.id,expectedChecksum:asset.checksum,classification:"contains_children"}});
      await expect(publish()).rejects.toThrow();
      await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{...base,candidate:{kind:"asset_child_consent",assetId:asset.id,expectedChecksum:asset.checksum}});
    }
    // Rights and consent do not approve the uploaded description. Publication
    // still denies until the separate exact alt-text candidate is reviewed.
    await expect(publish()).rejects.toThrow();
    const altEvidence = await approveField("school_logo_alt");
    const published = await publish();
    const revision = await f.t.run(ctx => ctx.db.get(published.publishedId));
    expect(revision?.state).toBe("published");
    expect(revision?.content.fields).toHaveLength(manifest.fields.length);
    const validateCurrent = () => f.t.run(async ctx => {
      const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school", q => q.eq("schoolId",f.schoolA)).unique();
      return validatePublication(ctx, profile!, revision!.content, revision!.publishedByUserId!, Date.now());
    });
    // Check the current immutable publication, not a consumed draft version.
    await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
    for (const asset of assets.values()) {
      const current = await f.t.run(ctx => ctx.db.get(asset.id));
      const id = current!.childConsentEvidenceId!;
      await f.t.run(ctx => ctx.db.patch(id,{expiresAt:Date.now()-1}));
      await expect(validateCurrent()).rejects.toThrow();
      await f.t.run(ctx => ctx.db.patch(id,{expiresAt:Date.now()+120_000}));
      await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
      await f.t.run(ctx => ctx.db.patch(asset.id,{childConsentEvidenceId:undefined}));
      await expect(validateCurrent()).rejects.toThrow();
      await f.t.run(ctx => ctx.db.patch(asset.id,{childConsentEvidenceId:id}));
      await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
      const classification = await f.t.run(ctx => ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_subject_type_and_subject_key", q => q.eq("schoolId",f.schoolA).eq("subjectType","site_asset_child_applicability").eq("subjectKey",`v1:${asset.id}:${asset.checksum}`)).order("desc").first());
      for (const recordId of [current!.approvalEvidenceId!,classification!._id]) {
        await f.t.run(ctx => ctx.db.patch(recordId,{expiresAt:Date.now()-1}));
        await expect(validateCurrent()).rejects.toThrow();
        await f.t.run(ctx => ctx.db.patch(recordId,{expiresAt:Date.now()+120_000}));
        await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
      }
      for (const recordId of [current!.approvalEvidenceId!,classification!._id,id]) {
        await f.t.run(ctx => ctx.db.patch(recordId,{revokedAt:Date.now()}));
        await expect(validateCurrent()).rejects.toThrow();
        await f.t.run(ctx => ctx.db.patch(recordId,{revokedAt:undefined}));
        await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
      }
    }
    for (const def of manifest.fields.filter(field => field.altFieldId)) {
      const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:def.altFieldId!});
      const subject = `v1:${manifest.rendererKey}:${manifest.schemaVersion}:${def.altFieldId}:${candidate.digest}`;
      const record = await f.t.run(ctx => ctx.db.query("schoolApprovalEvidence").withIndex("by_school_and_subject_type_and_subject_key", q => q.eq("schoolId",f.schoolA).eq("subjectType","site_content").eq("subjectKey",subject)).first());
      await f.t.run(ctx => ctx.db.patch(record!._id,{revokedAt:Date.now()}));
      await expect(validateCurrent()).rejects.toThrow();
      await f.t.run(ctx => ctx.db.patch(record!._id,{revokedAt:undefined}));
      await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
    }
    const logo = assets.get("school_logo")!;
    await f.t.run(ctx => ctx.db.patch(logo.id,{altText:"Unreviewed child name"}));
    await expect(validateCurrent()).rejects.toThrow();
    await f.t.run(ctx => ctx.db.patch(logo.id,{altText:"Fictional school_logo image"}));
    await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
    await f.reviewer.mutation(api.functions.sites.evidence.revokeEvidence,{schoolId:f.schoolA,evidenceId:altEvidence.evidenceId});
    await expect(validateCurrent()).rejects.toThrow();
    await approveField("school_logo_alt");
    await expect(validateCurrent()).resolves.toHaveProperty("digest",revision!.contentDigest);
    const schoolName = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    expect(schoolName.evidenceClass).toBe("identity");
    const first = assets.values().next().value!;
    const record = await f.t.run(ctx => ctx.db.get(first.id as import("../../_generated/dataModel").Id<"schoolSiteAssets">));
    await f.reviewer.mutation(api.functions.sites.evidence.revokeEvidence,{schoolId:f.schoolA,evidenceId:record!.approvalEvidenceId!});
    await expect(validateCurrent()).rejects.toThrow();
  });
  test("domain-only and revert-only grants receive bounded distinct management views", async () => {
    const f = await fixture(); const now = Date.now();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0});
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Synthetic identity source",expiresAt:Date.now()+60_000,confirmed:true});
    const published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1});
    const privateContent = {...content,fields:[content.fields[0],{fieldId:"intro",value:{kind:"text" as const,value:"Private pending text"}}]};
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:privateContent,expectedDraftVersion:published.draftVersion});
    await f.t.run(async ctx => {
      for (const [name,capability] of [["dns","site.domain.request"],["reverter","site.revert"]] as const) {
        const userId = await ctx.db.insert("users",{schoolId:f.schoolA,authId:name,authTokenIdentifier:`test|${name}`,name,email:`${name}@example.test`,role:"staff",createdAt:now,updatedAt:now});
        await ctx.db.insert("schoolCapabilityGrants",{schoolId:f.schoolA,userId,capability,scope:"school",grantedByUserId:userId,reason:"synthetic scoped view",isBreakGlass:false,createdAt:now});
      }
    });
    const dns = f.t.withIdentity(ident("dns"));
    const domain = await dns.mutation(api.functions.sites.domains.requestDomain,{schoolId:f.schoolA,hostname:"school.synthetic.edu",canonicalIntent:"canonical"});
    const dnsView = await dns.action(api.functions.sites.management.schoolView,{schoolId:f.schoolA});
    expect(dnsView).toMatchObject({draft:null,publications:[],assets:[],domains:[{id:domain.domainId}]});
    expect((await f.editor.action(api.functions.sites.management.schoolView,{schoolId:f.schoolA})).domains).toEqual([]);
    const revertView = await f.t.withIdentity(ident("reverter")).action(api.functions.sites.management.schoolView,{schoolId:f.schoolA});
    expect(revertView).toMatchObject({canEdit:false,canRequestDomain:false,draft:null,assets:[],domains:[],publications:[{id:published.publishedId,current:true}]});
    expect(JSON.stringify(revertView)).not.toContain("Private pending text");
    const reverter = f.t.withIdentity(ident("reverter"));
    await expect(reverter.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:2})).rejects.toThrow();
    const clone = await reverter.mutation(api.functions.sites.content.revertToDraft,{schoolId:f.schoolA,sourceRevisionId:published.publishedId});
    expect(clone.draftId).toBeTruthy();
    expect((await reverter.action(api.functions.sites.management.schoolView,{schoolId:f.schoolA})).draft).toBeNull();
    await expect(dns.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:1})).rejects.toThrow();
  });
  test("only an operator provisions exact managed renderer; no public host before domain readiness", async () => {
    const f = await fixture();
    await expect(f.editor.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"})).rejects.toThrow();
    await expect(f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"obhis-v1",rendererSchemaVersion:"2"})).rejects.toThrow();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    await expect(f.other.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0})).rejects.toThrow();
    expect(await f.t.action(api.functions.sites.public.resolvePublicSite,{hostname:"synthetic-a.example.test",routeId:"home",gatewaySecret:"bad"})).toEqual({status:"unavailable"});
    expect(await f.t.fetch("/sites/asset-bytes", {method:"POST"})).toMatchObject({status:404});
  });
  test("HTTP stores only authorized site bytes and removes rejected new storage", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    const png = pixel;
    const upload = (schoolId: string) => f.editor.fetch("/sites/asset-upload",{method:"POST",headers:{"content-length":String(png.length),"content-type":"image/png","x-site-school":schoolId,"x-site-kind":"hero","x-site-filename":"hero.png","x-site-alt":"Synthetic pixel"},body:png});
    expect((await f.t.fetch("/sites/asset-upload",{method:"POST",headers:{"content-length":String(png.length)},body:png})).status).toBe(403);
    expect((await upload(f.schoolB)).status).toBe(403);
    const fake = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
    expect((await f.editor.fetch("/sites/asset-upload",{method:"POST",headers:{"content-length":String(fake.length),"content-type":"image/png","x-site-school":f.schoolA,"x-site-kind":"hero","x-site-filename":"fake.png","x-site-alt":"A fake"},body:fake})).status).toBe(415);
    const before = await f.t.run(ctx => ctx.db.system.query("_storage").take(10));
    expect(before).toHaveLength(0);
    const response = await upload(f.schoolA);
    expect(response.status).toBe(201);
    const result = await response.json() as {assetId:string};
    const after = await f.t.run(ctx => ctx.db.system.query("_storage").take(10));
    expect(after).toHaveLength(1);
    const asset = await f.t.run(ctx => ctx.db.query("schoolSiteAssets").withIndex("by_school",q => q.eq("schoolId",f.schoolA)).unique());
    expect(asset?._id).toBe(result.assetId);
    expect(asset?.uploadProvenance).toBe("website_direct_upload_v1");
    expect((await f.t.fetch("/sites/asset-bytes", {method:"POST"})).status).toBe(404);
  });
  test("versioned Unicode upload metadata and raw legacy headers survive the HTTP storage path", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    const base = {"content-length":String(pixel.length),"content-type":"image/png","x-site-school":f.schoolA,"x-site-kind":"hero"};
    const upload = (headers: Record<string,string>) => f.editor.fetch("/sites/asset-upload",{method:"POST",headers:{...base,...headers},body:pixel});
    const pairs = [["صورة.png","صورة مدرسة"],["学校.png","学校大门"],["Àwọn ọmọ.png","Àwọn ọmọ ní ilé"]];
    for (const [fileName,altText] of pairs) {
      expect((await upload(encodeSiteUploadMetadata(fileName,altText))).status).toBe(201);
    }
    expect((await upload({"x-site-filename":"100%.png","x-site-alt":"Literal 100%"})).status).toBe(201);
    const assets = await f.t.run(ctx => ctx.db.query("schoolSiteAssets").withIndex("by_school",q => q.eq("schoolId",f.schoolA)).take(10));
    expect(assets.map(a => [a.fileName,a.altText])).toEqual([...pairs,["100%.png","Literal 100%"]]);
    const bad: Record<string,string>[] = [
      {"x-site-filename-uri-v1":"%ZZ","x-site-alt-uri-v1":"test"},
      {"x-site-filename-uri-v1":"%252e.png","x-site-alt-uri-v1":"test","x-site-filename":"other.png"},
      {"x-site-filename-uri-v1":"a".repeat(1081),"x-site-alt-uri-v1":"test"},
      {"x-site-filename-uri-v1":"bad%0A.png","x-site-alt-uri-v1":"test"},
      {"x-site-filename":"bad.png","x-site-alt":"\u007f"},
    ];
    for (const headers of bad) expect((await upload(headers)).status).toBe(400);
    expect((await f.t.fetch("/sites/asset-upload",{method:"POST",headers:{...base,...encodeSiteUploadMetadata("school.png","Private")},body:pixel})).status).toBe(403);
    expect((await f.t.run(ctx => ctx.db.system.query("_storage").take(10)))).toHaveLength(4);
  });
  test("asset approval requires provenance, school, checksum, rights and child review", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    const png = pixel;
    const storageId = await f.t.run(ctx => ctx.storage.store(new Blob([png],{type:"image/png"})));
    const metadata = await f.t.run(ctx => ctx.db.system.get("_storage",storageId));
    expect(metadata).toBeTruthy();
    await expect(f.other.mutation(internal.functions.sites.assets.registerReceivedBytes,{schoolId:f.schoolA,storageId,kind:"hero",fileName:"hero.png",mediaType:"image/png",byteSize:png.length,checksum:storageDigest(metadata!.sha256)!,altText:"A graphic",decorative:false})).rejects.toThrow();
    await expect(f.editor.mutation(internal.functions.sites.assets.registerReceivedBytes,{schoolId:f.schoolA,storageId,kind:"hero",fileName:"hero.png",mediaType:"image/png",byteSize:png.length,checksum:"0".repeat(64),altText:"A graphic",decorative:false})).rejects.toThrow();
    const assetId = await f.editor.mutation(internal.functions.sites.assets.registerReceivedBytes,{schoolId:f.schoolA,storageId,kind:"hero",fileName:"hero.png",mediaType:"image/png",byteSize:png.length,checksum:storageDigest(metadata!.sha256)!,altText:"A graphic",decorative:false});
    const withHero = {...content,fields:[...content.fields,{fieldId:"hero_image",value:{kind:"asset_ref" as const,assetId}}]};
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:withHero,expectedDraftVersion:0});
    const preview = await f.editor.action(api.functions.sites.content.previewDraft,{schoolId:f.schoolA});
    expect(JSON.stringify(preview)).not.toContain(storageId);
    expect(JSON.stringify(preview)).not.toContain(assetId);
    expect(preview.fields[2].value).toEqual({kind:"asset_placeholder",message:"Asset approval required"});
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Verified synthetic identity",expiresAt:Date.now()+60_000,confirmed:true});
    const approval = (kind: "asset_rights" | "asset_child_applicability" | "asset_child_consent", expiresAt = Date.now()+60_000) => f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:kind === "asset_child_applicability" ? {kind,assetId,expectedChecksum:storageDigest(metadata!.sha256)!,classification:"no_children" as const} : {kind,assetId,expectedChecksum:storageDigest(metadata!.sha256)!},evidenceReference:"Synthetic signed source record",expiresAt,confirmed:true});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
    await expect(f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"asset_rights",assetId,expectedChecksum:"0".repeat(64)},evidenceReference:"Synthetic signed source record",expiresAt:Date.now()+60_000,confirmed:true})).rejects.toThrow();
    const oldRights = await approval("asset_rights");
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
    const renewedRights = await approval("asset_rights");
    // Both are live. Admission must follow the asset's renewed evidence pointer.
    await f.t.run(async ctx => {const editor = await ctx.db.query("users").withIndex("by_auth_token_identifier",q => q.eq("authTokenIdentifier","test|editor")).unique(); if (!editor) throw Error("Missing editor"); await ctx.db.insert("schoolCapabilityGrants",{schoolId:f.schoolA,userId:editor._id,capability:"privacy.approve",scope:"school",grantedByUserId:editor._id,reason:"synthetic self assertion",isBreakGlass:false,createdAt:Date.now()});});
    await f.editor.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"asset_child_applicability",assetId,expectedChecksum:storageDigest(metadata!.sha256)!,classification:"no_children"},evidenceReference:"Self-classified synthetic asset",expiresAt:Date.now()+60_000,confirmed:true});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
    const assertion = await approval("asset_child_applicability");
    let published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1});
    await f.t.run(ctx => ctx.db.patch(oldRights.evidenceId,{revokedAt:Date.now()}));
    published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion});
    await f.t.run(ctx => ctx.db.patch(renewedRights.evidenceId,{expiresAt:Date.now()-1}));
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion})).rejects.toThrow();
    await approval("asset_rights");
    await f.reviewer.mutation(api.functions.sites.evidence.revokeEvidence,{schoolId:f.schoolA,evidenceId:assertion.evidenceId});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion})).rejects.toThrow();
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"asset_child_applicability",assetId,expectedChecksum:storageDigest(metadata!.sha256)!,classification:"contains_children"},evidenceReference:"Synthetic classification source",expiresAt:Date.now()+60_000,confirmed:true});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion})).rejects.toThrow();
    const consent = await approval("asset_child_consent");
    published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion});
    await approval("asset_child_applicability"); // no_children clears the consent pointer
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"asset_child_applicability",assetId,expectedChecksum:storageDigest(metadata!.sha256)!,classification:"contains_children"},evidenceReference:"Reclassified synthetic image",expiresAt:Date.now()+60_000,confirmed:true});
    const afterReclassification = await f.t.run(ctx => ctx.db.get(assetId));
    expect(afterReclassification?.childConsentEvidenceId).toBeUndefined();
    // The old consent is still current, but it cannot authorize this new classification.
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion})).rejects.toThrow();
    const newConsent = await approval("asset_child_consent");
    expect(newConsent.evidenceId).not.toBe(consent.evidenceId);
    published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion});
    await f.t.run(async ctx => ctx.db.patch(newConsent.evidenceId,{expiresAt:Date.now()-1}));
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:published.draftVersion})).rejects.toThrow();
    expect((await f.t.fetch("/sites/asset-bytes", {method:"POST"})).status).toBe(404);
  });
  test("publish consumes the draft version across retries and two authorized clients", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    const saved = await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0});
    await f.t.run(async ctx => {
      const now = Date.now();
      const second = await ctx.db.insert("users",{schoolId:f.schoolA,authId:"second",authTokenIdentifier:"test|second",name:"Second publisher",email:"second@example.test",role:"staff",createdAt:now,updatedAt:now});
      await ctx.db.insert("schoolCapabilityGrants",{schoolId:f.schoolA,userId:second,capability:"site.publish.standard",scope:"school",grantedByUserId:second,reason:"synthetic second client",isBreakGlass:false,createdAt:now});
    });
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Fictional signed source",expiresAt:Date.now()+60_000,confirmed:true});
    const args = {schoolId:f.schoolA,expectedDraftVersion:saved.draftVersion};
    const attempts = await Promise.allSettled([
      f.editor.mutation(api.functions.sites.content.publishDraft,args),
      f.t.withIdentity(ident("second")).mutation(api.functions.sites.content.publishDraft,args),
    ]);
    const successes = attempts.filter(result => result.status === "fulfilled");
    const failures = attempts.filter(result => result.status === "rejected");
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(String((failures[0] as PromiseRejectedResult).reason)).toContain("DRAFT_VERSION_CONFLICT");
    const published = (successes[0] as PromiseFulfilledResult<{publishedId: typeof saved.draftId; draftVersion: number}>).value;
    expect(published.draftVersion).toBe(saved.draftVersion + 1);
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,args)).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    await f.t.run(async ctx => {
      const profile = await ctx.db.query("schoolSiteProfiles").withIndex("by_school",q => q.eq("schoolId",f.schoolA)).unique();
      const revisions = await ctx.db.query("schoolSiteRevisions").withIndex("by_school_and_revision_number",q => q.eq("schoolId",f.schoolA)).take(10);
      const audit = await ctx.db.query("schoolSiteAuditEvents").withIndex("by_school_and_created_at",q => q.eq("schoolId",f.schoolA)).take(10);
      expect(revisions.filter(row => row.state === "published")).toHaveLength(1);
      expect(audit.filter(row => row.eventType === "published")).toHaveLength(1);
      expect(profile?.publishedRevisionId).toBe(published.publishedId);
      expect(revisions.find(row => row._id === saved.draftId)?.expectedDraftVersion).toBe(published.draftVersion);
    });
    const next = await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:{...content,fields:[content.fields[0],{fieldId:"intro",value:{kind:"text",value:"Next intentional edit"}}]},expectedDraftVersion:published.draftVersion});
    expect(next.draftVersion).toBe(published.draftVersion + 1);
  });
  test("expired grants and changed identity values cannot borrow approval", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0});
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Synthetic identity source record",expiresAt:Date.now()+60_000,confirmed:true});
    const changed = {...content,fields:[{fieldId:"school_name",value:{kind:"text" as const,value:"Different Synthetic School"}},content.fields[1]]};
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:changed,expectedDraftVersion:1});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:2})).rejects.toThrow();
    await f.t.run(async ctx => {
      const grants = await ctx.db.query("schoolCapabilityGrants").withIndex("by_school_and_user",q => q.eq("schoolId",f.schoolA)).take(20);
      for (const grant of grants.filter(g => g.capability === "site.preview")) await ctx.db.patch(grant._id,{expiresAt:Date.now()-1});
    });
    await expect(f.editor.action(api.functions.sites.content.previewDraft,{schoolId:f.schoolA})).rejects.toThrow();
  });
  test("draft conflict, independent digest evidence, immutable publication and revert", async () => {
    const f = await fixture();
    await f.operator.mutation(api.functions.sites.profiles.provisionProfile,{schoolId:f.schoolA,rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1"});
    const first = await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0});
    await expect(f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content,expectedDraftVersion:0})).rejects.toThrow("DRAFT_VERSION_CONFLICT");
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
    await expect(f.editor.action(api.functions.sites.content.previewDraft,{schoolId:f.schoolB})).rejects.toThrow();
    const preview = await f.editor.action(api.functions.sites.content.previewDraft,{schoolId:f.schoolA});
    expect(preview).toMatchObject({robots:"noindex,nofollow",canonical:null,sitemap:null});
    expect(JSON.stringify(preview)).not.toContain("draftVersion");
    const previews = await f.t.run(ctx => ctx.db.query("schoolSiteAuditEvents").withIndex("by_school_and_created_at",q => q.eq("schoolId",f.schoolA)).take(20));
    expect(previews.filter(row => row.eventType === "previewed")).toHaveLength(1);
    const candidate = await f.reviewer.action(api.functions.sites.evidence.getFieldCandidate,{schoolId:f.schoolA,fieldId:"school_name"});
    await expect(f.other.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Verified synthetic identity",expiresAt:Date.now()+60000,confirmed:true})).rejects.toThrow();
    await expect(f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:"0".repeat(64)},evidenceReference:"Verified synthetic identity",expiresAt:Date.now()+60000,confirmed:true})).rejects.toThrow();
    await f.t.run(async ctx => { const user = await ctx.db.query("users").withIndex("by_auth_token_identifier",q => q.eq("authTokenIdentifier","test|editor")).unique(); if (!user) throw Error("Missing synthetic editor"); await ctx.db.insert("schoolCapabilityGrants",{schoolId:f.schoolA,userId:user._id,capability:"privacy.approve",scope:"school",grantedByUserId:user._id,reason:"synthetic self review",isBreakGlass:false,createdAt:Date.now()}); });
    await f.editor.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Self assertion for denial",expiresAt:Date.now()+60000,confirmed:true});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
    const approval = await f.reviewer.mutation(api.functions.sites.evidence.approveCandidate,{schoolId:f.schoolA,candidate:{kind:"field",fieldId:"school_name",expectedDigest:candidate.digest},evidenceReference:"Verified synthetic identity",expiresAt:Date.now()+60000,confirmed:true});
    const published = await f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1});
    await f.editor.mutation(api.functions.sites.content.saveDraft,{schoolId:f.schoolA,content:{...content,fields:[content.fields[0],{fieldId:"intro",value:{kind:"text",value:"Changed"}}]},expectedDraftVersion:published.draftVersion});
    await f.t.run(async ctx => { const revision = await ctx.db.get(published.publishedId); expect(revision?.content.fields[1].value).toEqual({kind:"text",value:"Hello"}); });
    const revert = await f.editor.mutation(api.functions.sites.content.revertToDraft,{schoolId:f.schoolA,sourceRevisionId:published.publishedId});
    expect(revert.draftId).not.toBe(first.draftId);
    await f.reviewer.mutation(api.functions.sites.evidence.revokeEvidence,{schoolId:f.schoolA,evidenceId:approval.evidenceId});
    await expect(f.editor.mutation(api.functions.sites.content.publishDraft,{schoolId:f.schoolA,expectedDraftVersion:1})).rejects.toThrow();
  });
});
