import type { RendererFieldValue } from "@/core/contracts";

export type ObhisProgramme = { slug: string; name: string; descriptor?: string; summary?: string; assetId?: string };
export type ObhisValue = { id: string; title: string; body?: string };
export type ObhisPolicy = { slug: string; title: string; summary?: string; issued?: string; reviewed?: string; assetId?: string };
export type ObhisAddress = { display: string; streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string; addressCountry?: string };

export type ObhisRendererData = {
  identity: { displayName: string; shortName?: string; motto?: string; logoAssetId?: string };
  home: { eyebrow?: string; heading?: string; summary?: string; heroAssetId?: string; valuesLead?: string; schoolLifeLead?: string };
  about: { lead?: string; values: readonly ObhisValue[]; story: readonly ObhisValue[] };
  programmes: readonly ObhisProgramme[];
  admissions: { lead?: string; steps: readonly string[]; questionsCopy?: string };
  schoolLife: { lead?: string; galleryAssetIds: readonly string[]; features: readonly ObhisValue[] };
  visit: { lead?: string; directions?: string; hours?: string };
  contact: { phone?: string; email?: string; address?: ObhisAddress; hours?: string };
  policies: readonly ObhisPolicy[];
};

type Fields = Readonly<Record<string, unknown>>;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fieldValue(fields: Fields, id: string): RendererFieldValue | undefined {
  const value = fields[id];
  return value && typeof value === "object" && "kind" in value ? value as RendererFieldValue : undefined;
}
function text(fields: Fields, id: string, maximum = 1_000): string | undefined {
  const value = fieldValue(fields, id);
  return value && (value.kind === "text" || value.kind === "rich_text") && value.value.trim().length > 0 && value.value.length <= maximum ? value.value.trim() : undefined;
}
function asset(fields: Fields, id: string): string | undefined {
  const value = fieldValue(fields, id);
  return value?.kind === "asset_ref" && /^[a-zA-Z0-9:_-]{1,200}$/.test(value.assetId) ? value.assetId : undefined;
}
function list(fields: Fields, id: string, maximum: number): readonly string[] {
  const value = fieldValue(fields, id);
  return value?.kind === "string_list" && value.value.length <= maximum && value.value.every((item) => typeof item === "string")
    ? value.value.map((item) => item.trim()).filter(Boolean)
    : [];
}
function ids(fields: Fields, id: string, maximum: number): readonly string[] {
  const values = list(fields, id, maximum);
  return values.every((value) => slugPattern.test(value)) ? values : [];
}
function assetIds(fields: Fields, id: string, maximum: number): readonly string[] {
  const value = fieldValue(fields, id);
  return value?.kind === "asset_list" && value.assetIds.length > 0 && value.assetIds.length <= maximum && value.assetIds.every((assetId) => /^[a-zA-Z0-9:_-]{1,200}$/.test(assetId))
    ? value.assetIds : [];
}
function phone(fields: Fields): string | undefined {
  const value = text(fields, "contact.phone", 32);
  return value && /^\+?[0-9][0-9\s()-]{6,30}$/.test(value) ? value : undefined;
}
function email(fields: Fields): string | undefined {
  const value = text(fields, "contact.email", 254);
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : undefined;
}
function recordList(fields: Fields, prefix: string, maximum: number): readonly ObhisValue[] {
  return ids(fields, `${prefix}.ids`, maximum).flatMap((id) => {
    const title = text(fields, `${prefix}.${id}.title`, 120);
    return title ? [{ id, title, body: text(fields, `${prefix}.${id}.body`, 900) }] : [];
  });
}

export function validateObhisRendererData(fields: Fields): ObhisRendererData | null {
  const displayName = text(fields, "identity.displayName", 120);
  if (!displayName) return null;
  const programmes = ids(fields, "programmes.ids", 8).flatMap((slug) => {
    const name = text(fields, `programmes.${slug}.name`, 120);
    return name ? [{ slug, name, descriptor: text(fields, `programmes.${slug}.descriptor`, 120), summary: text(fields, `programmes.${slug}.summary`, 360), assetId: asset(fields, `programmes.${slug}.asset`) }] : [];
  });
  const policies = ids(fields, "policies.ids", 20).flatMap((slug) => {
    const title = text(fields, `policies.${slug}.title`, 160);
    return title ? [{ slug, title, summary: text(fields, `policies.${slug}.summary`, 1_200), issued: text(fields, `policies.${slug}.issued`, 80), reviewed: text(fields, `policies.${slug}.reviewed`, 80), assetId: asset(fields, `policies.${slug}.asset`) }] : [];
  });
  return {
    identity: { displayName, shortName: text(fields, "identity.shortName", 80), motto: text(fields, "identity.motto", 160), logoAssetId: asset(fields, "brand.logo") },
    home: { eyebrow: text(fields, "home.hero.eyebrow", 100), heading: text(fields, "home.hero.heading", 180), summary: text(fields, "home.hero.summary", 280), heroAssetId: asset(fields, "home.hero.asset"), valuesLead: text(fields, "home.values.lead", 700), schoolLifeLead: text(fields, "schoolLife.lead", 700) },
    about: { lead: text(fields, "about.lead", 1_200), values: recordList(fields, "about.values", 4), story: recordList(fields, "about.story", 3) },
    programmes,
    admissions: { lead: text(fields, "admissions.lead", 1_200), steps: list(fields, "admissions.steps", 4).filter((step) => step.length <= 360), questionsCopy: text(fields, "admissions.questionsCopy", 500) },
    schoolLife: { lead: text(fields, "schoolLife.lead", 700), galleryAssetIds: assetIds(fields, "schoolLife.gallery", 12), features: recordList(fields, "schoolLife.features", 6) },
    visit: { lead: text(fields, "visit.lead", 700), directions: text(fields, "contact.directions", 700), hours: text(fields, "contact.hours", 200) },
    contact: (() => { const display = text(fields, "contact.address", 500); return { phone: phone(fields), email: email(fields), ...(display ? { address: { display, streetAddress: text(fields, "contact.address.streetAddress", 200), addressLocality: text(fields, "contact.address.locality", 120), addressRegion: text(fields, "contact.address.region", 120), postalCode: text(fields, "contact.address.postalCode", 40), addressCountry: text(fields, "contact.address.country", 120) } } : {}), hours: text(fields, "contact.hours", 200) }; })(),
    policies,
  };
}
