import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { siteManifest, type PublicSiteV1 } from "@school/shared/site-manifests";
import { admitSite } from "./public";
import { hasRenderer, renderSite } from "./registry";

const descriptor = siteManifest("obhis-v1", "1")!;
const base: PublicSiteV1 = {
  version:"1",schoolSlug:"fictional-school",rendererKey:"obhis-v1",rendererSchemaVersion:"1",revisionId:"revision-1",publishedAt:1700000000000,
  canonicalOrigin:"https://fictional.example.edu",activeHostname:"fictional.example.edu",redirectToCanonical:false,routeIds:["home"],routeSeo:[],
  fields: descriptor.fields.map((def,i) => ({fieldId:def.fieldId,value:def.kind === "asset_ref" ? {kind:"asset_ref" as const,asset:{id:`asset_${String(i).padStart(8,"0")}`,src:`/api/site-assets/asset_${String(i).padStart(8,"0")}`,kind:def.assetKind as "logo" | "hero" | "gallery",decorative:false,altText:`Published ${def.fieldId} alt`}} : {kind:"text" as const,value:def.fieldId === "phone" ? "+2348057755997" : def.fieldId === "email" ? "fictional@example.edu" : def.fieldId === "primary_color" ? "#176c49" : def.fieldId === "accent_color" ? "#39bcd3" : def.fieldId.endsWith("_alt") ? `Published ${def.fieldId.slice(0, -4)} alt` : `Published ${def.fieldId}`}})),
  applicationLink:{version:"1",schoolSlug:"fictional-school",href:"",availability:"unavailable",intakeSlug:null,opensAt:null,closesAt:null},portal:{availability:"unavailable"},
};
function output(site: PublicSiteV1) {
  const result = admitSite({status:"available",site},"home",site.activeHostname);
  if (result.status !== "available") return null;
  expect(hasRenderer(result.site)).toBe(true);
  const page = renderSite(result.site,"home");
  return page ? renderToStaticMarkup(page) : null;
}
describe("Olive public renderer", () => {
  it("renders published copy, contact, captions and first-party assets, never private routes", () => {
    const html = output(base)!;
    expect(html).toContain("Published intro");
    expect(html).toContain("Published campus_abuja");
    expect(html).toContain("Published caption_friends");
    expect(html).toContain("fictional@example.edu");
    expect(html).toContain("/api/site-assets/asset_");
    expect(html).not.toContain("/review/obhis/assets");
    expect(html).not.toContain("docs/mockups");
    expect(html).not.toContain("facebook.com");
    expect(html).not.toContain("Apply online");
    expect(html).not.toContain("donation-qr-space");
    expect(html).toContain("Published donations_intro");
    const changed = {...base,fields:base.fields.map(f => f.fieldId === "intro" ? {fieldId:f.fieldId,value:{kind:"text" as const,value:"Changed approved introduction"}} : f)};
    expect(output(changed)).toContain("Changed approved introduction");
    expect(output(changed)).not.toContain("Published intro");
    const open = {...base,applicationLink:{...base.applicationLink,href:"https://apply.example.edu/s/fictional-school",availability:"open" as const}};
    expect(output(open)).toContain('href="https://apply.example.edu/s/fictional-school"');
    expect(output({...open,applicationLink:{...open.applicationLink,availability:"paused"}})).not.toContain("Apply online");
  });
  it("keeps the values accent readable on the fixed ink chapter", () => {
    expect(output(base)).toContain("--values-accent:#39bcd3");
    const dark = {...base,fields:base.fields.map(f => f.fieldId === "accent_color" ? {fieldId:f.fieldId,value:{kind:"text" as const,value:"#142c38"}} : f)};
    expect(output(dark)).toContain("--values-accent:#ffffff");
  });
  it("allows metadata only from approved visible copy", () => {
    const approved = {...base,routeSeo:[{routeId:"home",title:"Published school_name",description:"Published intro"}]};
    expect(output(approved)).not.toBeNull();
    expect(output({...base,routeSeo:[{routeId:"home",title:"Unreviewed award claim"}]})).toBeNull();
    expect(output({...base,routeSeo:[{routeId:"home",description:"Unreviewed medical claim"}]})).toBeNull();
    expect(output({...base,routeSeo:[{routeId:"home",shareAsset:{id:"asset_00000001",src:"/api/site-assets/asset_00000001",kind:"social_share",decorative:false,altText:"Unreviewed child name"}}]})).toBeNull();
  });
  it("denies unknown versions, missing fields, malformed contacts, theme and image metadata", () => {
    expect(output({...base,rendererSchemaVersion:"2"})).toBeNull();
    expect(output({...base,fields:base.fields.filter(f => f.fieldId !== "intro")})).toBeNull();
    for (const [fieldId,value] of [["phone","tel:evil"],["email","bad address"],["email","test?subject=leak@example.edu"],["email","a..b@example.edu"],["email",".a@example.edu"],["email","a.@example.edu"],["email","a%0D%0ABcc%3Aother@example.edu"],["email","a%25other@example.edu"],["primary_color","url(evil)"],["accent_color","#00000000"]]) {
      expect(output({...base,fields:base.fields.map(f => f.fieldId === fieldId ? {fieldId,value:{kind:"text" as const,value}} : f)})).toBeNull();
    }
    const firstImage = base.fields.find(f => f.value.kind === "asset_ref")!;
    expect(output({...base,fields:base.fields.map(f => f === firstImage ? {...f,value:{...f.value,asset:{...('asset' in f.value ? f.value.asset : {}),id:"asset_00000001",src:"/review/obhis/assets/school-logo",kind:"logo" as const,decorative:false,altText:"Alt"}}} : f)})).toBeNull();
    expect(output({...base,fields:base.fields.map(f => f === firstImage ? {...f,value:{kind:"asset_ref" as const,asset:{id:"asset_00000001",src:"/api/site-assets/asset_00000001",kind:"logo" as const,decorative:true}}} : f)})).toBeNull();
    expect(output({...base,fields:base.fields.map(f => f === firstImage ? {...f,value:{kind:"asset_ref" as const,asset:{id:"asset_00000001",src:"/api/site-assets/asset_00000001",kind:"logo" as const,decorative:false}}} : f)})).toBeNull();
    expect(output({...base,rendererKey:"private-local-review"})).toBeNull();
    expect(output({...base, fields:base.fields.map(f => f.fieldId === "school_logo_alt" ? {fieldId:f.fieldId,value:{kind:"text" as const,value:"Unreviewed identifying text"}} : f)})).toBeNull();
  });
});
