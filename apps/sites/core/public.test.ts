import { describe, expect, it } from "vitest";
import { admitSite, hostname, canonicalRedirect, applyDestination, routeForPath, validPublicFieldValue } from "./public";
import type { PublicSiteV1 } from "@school/shared/site-manifests";
import { legacyDemo, legacyDemoFromHeaders } from "./legacy";
import { approvedIngressHost } from "./ingress";
const site: PublicSiteV1 = {version:"1",schoolSlug:"synthetic-school",rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1",revisionId:"revision",publishedAt:1700000000000,canonicalOrigin:"https://school.example.edu",activeHostname:"school.example.edu",redirectToCanonical:false,routeIds:["home","about","contact"],fields:[{fieldId:"school_name",value:{kind:"text",value:"Synthetic School"}},{fieldId:"intro",value:{kind:"text",value:"A fictional school."}}],routeSeo:[],applicationLink:{version:"1",schoolSlug:"synthetic-school",href:"https://apply.example.edu/s/synthetic-school",availability:"open",intakeSlug:null,opensAt:null,closesAt:null},portal:{availability:"unavailable"}};
const admitted = (s: PublicSiteV1, host = s.activeHostname) => admitSite({status:"available",site:s},"home",host);
describe("public gate",() => {
  it("uses Host alone and rejects ambiguous host values",() => {
    expect(hostname(new Headers({host:"school.example.edu","x-forwarded-host":"other.example.edu","x-forwarded-proto":"http"}))).toBe("school.example.edu");
    expect(hostname(new Headers({"x-forwarded-host":"school.example.edu"}))).toBeNull();
    expect(hostname(new Headers({host:"school.example.edu,other.example.edu"}))).toBeNull();
  });
  it("rejects absent profiles, unknown versions, assets and SEO outside the manifest",() => {
    expect(admitSite({status:"unavailable"},"home",site.activeHostname).status).toBe("unavailable");
    expect(admitted({...site,rendererSchemaVersion:"2"}).status).toBe("unavailable");
    expect(admitted({...site,routeIds:["home","unknown"]}).status).toBe("unavailable");
    expect(admitted({...site,routeSeo:[{routeId:"unknown",title:"Oops"}]}).status).toBe("unavailable");
    expect(admitted({...site,fields:[...site.fields,{fieldId:"hero_image",value:{kind:"asset_ref",asset:{id:"asset12345",src:"https://upstream.example",kind:"hero",decorative:false}}}]}).status).toBe("unavailable");
    expect(routeForPath("/unknown",site.rendererKey,"1")).toBeNull();
  });
  it("freezes nested DTOs and retains only safe known alias paths and queries",() => {
    const alias = {...site,activeHostname:"alias.example.edu",redirectToCanonical:true};
    const result = admitted(alias);
    expect(result.status).toBe("available");
    if (result.status !== "available") return;
    expect(Object.isFrozen(result.site.fields[0].value)).toBe(true);
    expect(canonicalRedirect(result.site,"/about","?ref=family")).toBe("https://school.example.edu/about?ref=family");
    for (const path of ["//evil.example","/%2e%2e/contact","/about\\evil","/unknown"]) expect(canonicalRedirect(result.site,path)).toBeNull();
    expect(canonicalRedirect(result.site,"/about","?x=%5cfoo")).toBeNull();
  });
  it("requires deployment-configured custom-host ingress, never preview hosts or forwarded overrides",() => {
    const old = process.env.SITES_PRODUCTION_CUSTOM_HOSTS;
    process.env.SITES_PRODUCTION_CUSTOM_HOSTS = "school.example.edu,alias.example.edu";
    try {
      expect(approvedIngressHost("school.example.edu")).toBe(true);
      for (const host of ["other.example.edu","preview.vercel.app","alias.vercel.app","localhost"]) expect(approvedIngressHost(host)).toBe(false);
      expect(hostname(new Headers({host:"preview.vercel.app","x-forwarded-host":"school.example.edu"}))).toBe("preview.vercel.app");
      process.env.SITES_PRODUCTION_CUSTOM_HOSTS = "school.example.edu,preview.vercel.app";
      expect(approvedIngressHost("school.example.edu")).toBe(false);
    } finally {if (old === undefined) delete process.env.SITES_PRODUCTION_CUSTOM_HOSTS; else process.env.SITES_PRODUCTION_CUSTOM_HOSTS = old;}
  });
  it("limits legacy demos to a development allowlist",() => {
    const old = process.env.SITES_ENABLE_LEGACY_DEMOS;
    process.env.SITES_ENABLE_LEGACY_DEMOS = "enabled";
    try {
      expect(legacyDemo("obhisheritage.example")).toBeNull();
      expect(legacyDemo("missing.example.edu")).toBeNull();
      if (process.env.NODE_ENV !== "production") {
        expect(legacyDemo("aster.schoolos.localhost")?.name).toBe("Aster demo");
        expect(legacyDemo("greenfield.localhost")?.name).toBe("Greenfield demo");
        expect(legacyDemo("localhost")?.name).toBe("Greenfield demo");
        expect(legacyDemoFromHeaders(new Headers({host:"localhost:3105","x-forwarded-host":"evil.example"}))?.name).toBe("Greenfield demo");
        expect(legacyDemoFromHeaders(new Headers({host:"aster.localhost:3105"}))?.name).toBe("Aster demo");
        expect(legacyDemoFromHeaders(new Headers({host:"localhost:99999"}))).toBeNull();
      }
    } finally { if (old === undefined) delete process.env.SITES_ENABLE_LEGACY_DEMOS; else process.env.SITES_ENABLE_LEGACY_DEMOS = old; }
  });
  it("validates bounded typed published fields against a pure descriptor fixture",() => {
    const field = (kind: "boolean" | "string_list" | "link_intent" | "rich_text") => ({fieldId:"fixture",kind,required:false,maxLength:10});
    expect(validPublicFieldValue(field("boolean"),{kind:"boolean",value:false})).toBe(true);
    expect(validPublicFieldValue(field("string_list"),{kind:"string_list",value:["one","two"]})).toBe(true);
    expect(validPublicFieldValue(field("string_list"),{kind:"string_list",value:Array(13).fill("one")})).toBe(false);
    expect(validPublicFieldValue(field("link_intent"),{kind:"link_intent",intent:"visit",href:null})).toBe(true);
    expect(validPublicFieldValue(field("link_intent"),{kind:"link_intent",intent:"reviewed_external",href:null})).toBe(false);
    expect(validPublicFieldValue(field("link_intent"),{kind:"link_intent",intent:"visit",href:"https://evil.example"})).toBe(false);
    expect(validPublicFieldValue(field("rich_text"),{kind:"rich_text",value:"hello"})).toBe(false);
  });
  it("uses only available foundation links, never invented destinations",() => {
    expect(applyDestination(site)).toBe(site.applicationLink.href);
    expect(applyDestination({...site,applicationLink:{...site.applicationLink,availability:"paused"}})).toBeNull();
    expect(admitted({...site,portal:{availability:"available",href:"https://portal.example.edu"}}).status).toBe("unavailable");
    expect(admitted({...site,applicationLink:{...site.applicationLink,href:"https://evil.example/"}}).status).toBe("unavailable");
  });
});
