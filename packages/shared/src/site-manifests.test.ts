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
  test("only the registered key and version exist", () => { expect(manifest).toBeTruthy(); expect(siteManifest("obhis-v1","1")).toBeNull(); expect(siteManifest(manifest.rendererKey,"2")).toBeNull(); });
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
