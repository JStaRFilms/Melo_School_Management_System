import { describe, expect, test } from "vitest";
import { canonicalSiteContent, siteManifest, routeIdAtPath, validateSiteContent } from "./site-manifests";
import type { SiteContentV1 } from "./site-manifests";
const manifest = siteManifest("school-core-synthetic-v1", "1")!;
const content: SiteContentV1 = {fields: [{fieldId:"school_name",value:{kind:"text",value:"Synthetic School"}},{fieldId:"intro",value:{kind:"text",value:"Hello"}}],routeSeo:[{routeId:"home",title:"Synthetic School"}]};
describe("site manifest", () => {
  test("exact nested descriptor route without production registration", () => {
    const descriptor = {routes:[{routeId:"visit",path:"/admissions/visit"}]};
    expect(routeIdAtPath(descriptor,"/admissions/visit")).toBe("visit");
    for (const path of ["/admissions", "/admissions/visit/", "/admissions/%2e%2e", "//admissions/visit"]) expect(routeIdAtPath(descriptor,path)).toBeNull();
    expect(siteManifest("nested-fixture","1")).toBeNull();
  });
  test("only exact compiled keys and versions exist", () => { expect(manifest).toBeTruthy(); expect(siteManifest("obhis-v1","1")?.routes).toEqual([{routeId:"home",path:"/"}]); expect(siteManifest("obhis-v1","2")).toBeNull(); expect(siteManifest(manifest.rendererKey,"2")).toBeNull(); });
  test("Olive requires every published field and validates typed contacts and the two theme inputs", () => {
    const olive = siteManifest("obhis-v1","1")!;
    const fields = olive.fields.map((def,i) => ({fieldId:def.fieldId,value:def.kind === "asset_ref" ? {kind:"asset_ref" as const,assetId:`asset_${String(i).padStart(8,"0")}`} : {kind:"text" as const,value:def.fieldId === "phone" ? "+2348057755997" : def.fieldId === "email" ? "test@example.test" : def.fieldId === "primary_color" ? "#176c49" : def.fieldId === "accent_color" ? "#39bcd3" : `Fictional ${def.fieldId}`}}));
    const valid = {fields,routeSeo:[]};
    expect(() => validateSiteContent(valid,olive)).not.toThrow();
    expect(() => validateSiteContent({...valid,routeSeo:[{routeId:"home",title:"Fictional school_name",description:"Fictional intro"}]},olive)).not.toThrow();
    expect(() => validateSiteContent({...valid,routeSeo:[{routeId:"home",title:"Unreviewed claim"}]},olive)).toThrow();
    expect(() => validateSiteContent({...valid,routeSeo:[{routeId:"home",description:"Unreviewed claim"}]},olive)).toThrow();
    expect(() => validateSiteContent({...valid,routeSeo:[{routeId:"home",shareAssetId:"asset_00000001"}]},olive)).toThrow("Olive social images unavailable");
    expect(() => validateSiteContent({...valid,fields:fields.slice(1)},olive)).toThrow();
    for (const [fieldId,value] of [["phone","javascript:evil"],["email","not an email"],["email","test?subject=leak@example.test"],["email","a..b@example.test"],["email",".a@example.test"],["email","a.@example.test"],["email","a%0D%0ABcc%3Aother@example.test"],["email","a%25other@example.test"],["primary_color","red"],["accent_color","#00000000"]]) {
      expect(() => validateSiteContent({...valid,fields:fields.map(f => f.fieldId === fieldId ? {fieldId,value:{kind:"text" as const,value}} : f)},olive)).toThrow();
    }
  });
  test("rejects unknown, duplicate and executable content", () => {
    expect(() => validateSiteContent(content,manifest)).not.toThrow();
    for (const changed of [
      {...content,fields:[...content.fields,content.fields[0]]},
      {...content,fields:[...content.fields,{fieldId:"layout",value:{kind:"text",value:"x"}}]},
      {...content,fields:[{fieldId:"school_name",value:{kind:"text",value:"<script>alert(1)</script>"}},content.fields[1]]},
      {...content,routeSeo:[{routeId:"/secret",title:"x"}]},
      {...content,routeSeo:[{routeId:"home",title:"x",html:"<div />"}]},
    ]) expect(() => validateSiteContent(changed as SiteContentV1,manifest)).toThrow();
  });
  test("canonical digest input ignores field entry order", () => {
    expect(canonicalSiteContent(content)).toBe(canonicalSiteContent({...content,fields:[...content.fields].reverse()}));
  });
});
