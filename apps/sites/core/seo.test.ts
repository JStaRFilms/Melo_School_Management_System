import { expect, it } from "vitest";
import { admitSite } from "./public";
import { jsonLd, seo } from "./seo";
import type { PublicSiteV1 } from "@school/shared/site-manifests";
it("uses approved route metadata, published URLs, and escapes JSON-LD",() => {
  const site: PublicSiteV1 = {version:"1",schoolSlug:"demo",rendererKey:"school-core-synthetic-v1",rendererSchemaVersion:"1",revisionId:"revision",publishedAt:1700000000000,canonicalOrigin:"https://demo.example.edu",activeHostname:"demo.example.edu",redirectToCanonical:false,routeIds:["home","about","contact"],fields:[{fieldId:"school_name",value:{kind:"text",value:"School & Friends"}},{fieldId:"intro",value:{kind:"text",value:"Fictional."}}],routeSeo:[{routeId:"about",title:"Our story",description:"Synthetic school."}],applicationLink:{version:"1",schoolSlug:"demo",href:"",availability:"unavailable",intakeSlug:null,opensAt:null,closesAt:null},portal:{availability:"unavailable"}};
  const admitted = admitSite({status:"available",site},"about","demo.example.edu");
  expect(admitted.status).toBe("available");
  if (admitted.status !== "available") return;
  expect(seo(admitted.site,"about").alternates).toEqual({canonical:"https://demo.example.edu/about"});
  expect(seo(admitted.site,"about").title).toBe("Our story");
  expect(seo(admitted.site,"unknown").robots).toEqual({index:false,follow:false});
  expect(jsonLd(admitted.site,"about")).toContain("\\u0026");
});
