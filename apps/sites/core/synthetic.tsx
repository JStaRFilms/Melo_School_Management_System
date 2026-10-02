import type { CSSProperties } from "react";
import { deriveSchoolTheme } from "@school/shared/theme";
import type { ProductionSiteContext } from "./public";

export function SyntheticPage({site,routeId}:{site:ProductionSiteContext;routeId:string}) {
  const name = site.fields.find(f => f.fieldId === "school_name")?.value;
  const intro = site.fields.find(f => f.fieldId === "intro")?.value;
  const hero = site.fields.find(f => f.fieldId === "hero_image")?.value;
  if (name?.kind !== "text" || intro?.kind !== "text") return null;
  const theme = deriveSchoolTheme();
  return <main style={theme as CSSProperties} className="mx-auto min-h-screen max-w-4xl px-6 py-12 text-slate-900">
    <header className="border-b border-slate-200 pb-5"><a href="/" className="font-semibold text-[color:var(--school-primary)]">{name.value}</a><nav aria-label="School pages" className="mt-4 flex gap-6">{[["home","/","Home"],["about","/about","About"],["contact","/contact","Contact"]].map(([id,path,label]) => site.routeIds.includes(id) && <a key={id} href={path}>{label}</a>)}</nav></header>
    <article className="py-12"><h1 className="text-4xl font-semibold">{routeId === "home" ? name.value : routeId === "about" ? `About ${name.value}` : `Contact ${name.value}`}</h1><p className="mt-6 max-w-prose leading-8">{intro.value}</p>{hero?.kind === "asset_ref" && routeId === "home" && /* Approved bytes stay on the first-party gateway, without an image optimizer cache. */ <img className="mt-8 max-h-96 w-full rounded-xl object-cover" src={hero.asset.src} alt={hero.asset.decorative ? "" : hero.asset.altText ?? ""} />}</article>
    {site.applicationLink.availability === "open" && <a href="/apply" className="inline-block rounded bg-[color:var(--school-primary)] px-5 py-3 text-[color:var(--school-primary-contrast)]">Apply</a>}
    {site.portal.availability === "available" && <a href={site.portal.href}>Portal</a>}
  </main>;
}
