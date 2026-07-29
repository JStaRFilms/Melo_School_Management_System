/* eslint-disable @next/next/no-img-element -- B4 projects approved tenant asset URLs without a Next image-loader allowlist. */
import Link from "next/link";
import type { ReactNode } from "react";
import type { ApprovedPublicAsset, SiteRenderContext } from "@/core/contracts";
import { applicationCtaHref, type ApplicationAvailabilityV1 } from "@/core/links";
import type { SiteRenderer } from "@/core/renderers/contract";
import { ObhisNavigation } from "./navigation";
import { type ObhisRendererData, validateObhisRendererData } from "./schema";
import styles from "./obhis.module.css";

const routes = [
  { key: "home", path: "/" }, { key: "about", path: "/about" }, { key: "programmes", path: "/programmes" },
  { key: "admissions", path: "/admissions" }, { key: "school-life", path: "/school-life" }, { key: "visit", path: "/visit" },
  { key: "contact", path: "/contact" }, { key: "policy-index", path: "/policies" }, { key: "policy-detail", path: "/policies/[policySlug]" },
] as const;

const applicationStatusLabels: Readonly<Record<ApplicationAvailabilityV1, string>> = {
  open: "Applications are currently available.",
  upcoming: "Applications open soon.",
  paused: "Applications are currently paused.",
  closed: "Applications are currently closed.",
  unavailable: "Application availability is not currently available.",
};

function applicationStatusLabel(status: ApplicationAvailabilityV1): string {
  return Object.prototype.hasOwnProperty.call(applicationStatusLabels, status)
    ? applicationStatusLabels[status]
    : applicationStatusLabels.unavailable;
}

function isObhisRouteAvailable(data: ObhisRendererData, routeKey: string, params: Readonly<Record<string, string>>, applicationAvailability: ApplicationAvailabilityV1) {
  // Retain the B0 availability argument in the renderer boundary; informational
  // admissions no longer hides content when it is not open.
  void applicationAvailability;
  // Admissions is informational even when B0 says applications are not open.
  // The page renders the authoritative availability state instead of vanishing.
  const admissionsAvailable = Boolean(data.admissions.lead || data.admissions.steps.length || data.admissions.questionsCopy);
  // A visit can be offered by a published location or an approved contact method.
  const visitAvailable = Boolean(data.contact.address || data.contact.phone || data.contact.email);
  switch (routeKey) {
    // A landing page may not strand visitors: it needs an approved internal next step.
    case "home": return admissionsAvailable || visitAvailable;
    case "admissions": return admissionsAvailable;
    case "about": return Boolean(data.about.lead || data.about.values.length || data.about.story.length);
    case "programmes": return data.programmes.length > 0;
    case "school-life": return Boolean(data.schoolLife.lead || data.schoolLife.galleryAssetIds.length || data.schoolLife.features.length);
    // Visit is location-led; phone/email alone must not make it publicly available.
    case "visit": return visitAvailable;
    case "contact": return Boolean(data.contact.phone || data.contact.email || data.contact.address || data.contact.hours);
    case "policy-index": return data.policies.length > 0;
    case "policy-detail": return data.policies.some((policy) => policy.slug === params.policySlug);
    default: return false;
  }
}

export const obhisRenderer: SiteRenderer<ObhisRendererData> = {
  key: "obhis-v1",
  schemaVersion: "1",
  routes,
  validateRendererData(input) { return validateObhisRendererData(input.fields); },
  isRouteAvailable(data, routeKey, params, context) { return isObhisRouteAvailable(data, routeKey, params, context.links.application.availability); },
  isRouteIndexable(data, routeKey, params, context) { return isObhisRouteAvailable(data, routeKey, params, context.links.application.availability); },
  sitemapPaths(data) { return data.policies.map((policy) => `/policies/${policy.slug}`); },
  getPresentation(data, context) {
    const policy = context.request.routeKey === "policy-detail" ? data.policies.find((candidate) => candidate.slug === context.request.params.policySlug) : undefined;
    const root = new URL("/", context.request.canonicalUrl).toString();
    const organization: Record<string, unknown> = { "@type": "EducationalOrganization", name: data.identity.displayName, url: root };
    if (data.contact.phone) organization.telephone = data.contact.phone;
    if (data.contact.email) organization.email = data.contact.email;
    if (data.contact.address) organization.address = { "@type": "PostalAddress", ...(data.contact.address.streetAddress ? { streetAddress: data.contact.address.streetAddress } : {}), ...(data.contact.address.addressLocality ? { addressLocality: data.contact.address.addressLocality } : {}), ...(data.contact.address.addressRegion ? { addressRegion: data.contact.address.addressRegion } : {}), ...(data.contact.address.postalCode ? { postalCode: data.contact.address.postalCode } : {}), ...(data.contact.address.addressCountry ? { addressCountry: data.contact.address.addressCountry } : {}) };
    return { ...(policy ? { title: `${policy.title} — ${data.identity.displayName}`, ...(policy.summary ? { description: policy.summary } : {}) } : {}), applicationName: data.identity.displayName, manifest: { name: data.identity.displayName, shortName: data.identity.shortName ?? data.identity.displayName }, structuredData: { "@context": "https://schema.org", "@graph": [{ "@type": "WebSite", name: data.identity.displayName, url: root }, organization] } };
  },
  render(context) { return <ObhisSite context={context} />; },
};

function ObhisSite({ context }: { context: SiteRenderContext<ObhisRendererData> }) {
  const data = context.rendererData;
  const applicationHref = applicationCtaHref(context.links.application);
  const path = (value: string) => internalPath(context, value);
  const nav = [
    { href: "/", label: "Home", key: "home" }, { href: "/about", label: "About", key: "about" },
    { href: "/programmes", label: "Programmes", key: "programmes" }, { href: "/admissions", label: "Admissions", key: "admissions" },
    { href: "/school-life", label: "School life", key: "school-life" }, { href: "/visit", label: "Visit", key: "visit" },
  ].filter((item) => isObhisRouteAvailable(data, item.key, {}, context.links.application.availability)).map((item) => ({ ...item, href: path(item.href), current: context.request.canonicalUrl.endsWith(item.href === "/" ? "/" : item.href) }));
  return <div className={styles.site}>
    {context.request.preview ? <p className={styles.previewWatermark} role="status">Draft preview — not public</p> : null}
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <ObhisNavigation name={data.identity.shortName ?? data.identity.displayName} homeHref={path("/")} items={nav} applicationHref={applicationHref} portalHref={context.links.portal?.href} logo={asset(context, data.identity.logoAssetId, ["logo"])} />
    <main id="main-content">{renderRoute(context)}</main>
    <Footer context={context} />
  </div>;
}

function internalPath(context: SiteRenderContext<ObhisRendererData>, path: string): string {
  return context.request.pathPrefix ? `${context.request.pathPrefix}${path}` : path;
}
function renderRoute(context: SiteRenderContext<ObhisRendererData>) {
  switch (context.request.routeKey) {
    case "home": return <Home context={context} />;
    case "about": return <About context={context} />;
    case "programmes": return <Programmes context={context} />;
    case "admissions": return <Admissions context={context} />;
    case "school-life": return <SchoolLife context={context} />;
    case "visit": return <Visit context={context} />;
    case "contact": return <Contact context={context} />;
    case "policy-index": return <Policies context={context} />;
    case "policy-detail": return <PolicyDetail context={context} />;
    default: return <Unavailable title="This page is unavailable" />;
  }
}

function Container({ children, className = "" }: { children: ReactNode; className?: string }) { return <div className={`${styles.container} ${className}`}>{children}</div>; }
function routeForInternalPath(path: string): { key: string; params: Record<string, string> } | null {
  const staticRoute = routes.find((route) => route.path === path);
  if (staticRoute) return { key: staticRoute.key, params: {} };
  const policySlug = /^\/policies\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)?.[1];
  return policySlug ? { key: "policy-detail", params: { policySlug } } : null;
}
function SiteLink({ context, href, className, children }: { context: SiteRenderContext<ObhisRendererData>; href: string; className?: string; children: ReactNode }) {
  const route = routeForInternalPath(href);
  return route && isObhisRouteAvailable(context.rendererData, route.key, route.params, context.links.application.availability) ? <Link className={className} href={internalPath(context, href)}>{children}</Link> : null;
}
function PageLead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) { return <section className={styles.pageLead}><Container><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1>{body ? <p className={styles.lead}>{body}</p> : null}</Container></section>; }
function asset(context: SiteRenderContext<ObhisRendererData>, id?: string, kinds?: readonly ApprovedPublicAsset["kind"][]): ApprovedPublicAsset | null {
  const value = id ? context.assets[id] : undefined;
  const permittedKinds = kinds ?? ["gallery", "facility"] as const;
  return value && value.channels.includes("site") && permittedKinds.includes(value.kind) && (value.decorative || Boolean(value.altText)) ? value : null;
}
function Media({ item, className = "", priority = false }: { item: ApprovedPublicAsset | null; className?: string; priority?: boolean }) {
  return item ? <figure className={className}><img src={item.url} alt={item.decorative ? "" : item.altText} loading={priority ? "eager" : "lazy"} decoding="async" {...(item.width && item.height ? { width: item.width, height: item.height } : {})} {...(item.responsiveSources ? { srcSet: item.responsiveSources.map((source) => `${source.url} ${source.width}w`).join(", "), sizes: priority ? "(max-width: 1023px) 100vw, 50vw" : "(max-width: 767px) 100vw, 33vw" } : {})} style={item.focalPoint ? { objectPosition: `${item.focalPoint.x * 100}% ${item.focalPoint.y * 100}%` } : undefined} />{item.caption || item.credit ? <figcaption>{item.caption}{item.caption && item.credit ? " — " : null}{item.credit}</figcaption> : null}</figure> : null;
}
function ApplicationCta({ context, className = "" }: { context: SiteRenderContext<ObhisRendererData>; className?: string }) {
  const href = applicationCtaHref(context.links.application);
  if (href) return <a className={`${styles.applyButton} ${className}`} href={href}>Start an application<span className={styles.srOnly}> — opens the secure application</span></a>;
  const message = applicationStatusLabel(context.links.application.availability);
  return <p className={styles.status} role="status">{message}</p>;
}
function Unavailable({ title, body = "This information is not available on the published site." }: { title: string; body?: string }) { return <section className={styles.unavailable}><Container><p className={styles.eyebrow}>Published information</p><h1>{title}</h1><p>{body}</p></Container></section>; }

function Home({ context }: { context: SiteRenderContext<ObhisRendererData> }) {
  const { home, identity, programmes, admissions, schoolLife } = context.rendererData; const hero = asset(context, home.heroAssetId, ["hero"]);
  return <>
    <section className={styles.hero}><Container className={styles.heroGrid}><div>{home.eyebrow ? <p className={styles.eyebrow}>{home.eyebrow}</p> : null}<h1>{home.heading ?? identity.displayName}</h1>{home.summary ? <p className={styles.lead}>{home.summary}</p> : null}<div className={styles.actionRow}><ApplicationCta context={context} /><SiteLink context={context} className={styles.secondaryButton} href="/visit">Plan a visit</SiteLink></div></div>{hero ? <Media item={hero} priority className={styles.heroMedia} /> : <div className={styles.heroFallback} aria-label="Editorial illustration"><span aria-hidden="true">✦</span><p>Approved school identity</p></div>}</Container></section>
    <section className={styles.orientation}><Container><div className={styles.orientationGrid}><SiteLink context={context} href="/programmes"><span>01</span><strong>Programmes</strong><small>Explore current published options.</small></SiteLink><SiteLink context={context} href="/admissions"><span>02</span><strong>Admissions</strong><small>Understand the next step.</small></SiteLink><SiteLink context={context} href="/visit"><span>03</span><strong>Visit</strong><small>Find a way to connect.</small></SiteLink></div></Container></section>
    {programmes.length ? <ProgrammePreview programmes={programmes} context={context} /> : null}
    {home.valuesLead ? <section className={styles.editorial}><Container><p className={styles.eyebrow}>Approach</p><blockquote>{home.valuesLead}</blockquote></Container></section> : null}
    <section className={styles.lifeTeaser}><Container className={styles.twoColumn}><div><p className={styles.eyebrow}>School life</p><h2>See approved evidence of school life.</h2>{schoolLife.lead ? <p>{schoolLife.lead}</p> : <p>School-life details are shared only when current approved material is available.</p>}<SiteLink context={context} className={styles.textLink} href="/school-life">Explore school life <span aria-hidden="true">→</span></SiteLink></div><div className={styles.fallbackPanel} aria-hidden="true"><span>◌</span></div></Container></section>
    <section className={styles.admissionsBridge}><Container className={styles.twoColumn}><div><p className={styles.eyebrow}>Admissions</p><h2>Continue when you are ready.</h2>{admissions.steps.length ? <ol className={styles.steps}>{admissions.steps.slice(0, 3).map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol> : <p>The current application experience provides the authoritative requirements and availability.</p>}</div><ApplicationCta context={context} /></Container></section>
  </>;
}
function ProgrammePreview({ programmes, context }: { programmes: readonly ObhisRendererData["programmes"][number][]; context: SiteRenderContext<ObhisRendererData> }) { return <section className={styles.section}><Container><p className={styles.eyebrow}>Programmes</p><h2>Explore current learning pathways.</h2><div className={styles.programmeGrid}>{programmes.slice(0, 3).map((programme, index) => <article key={programme.slug} className={styles.programmeCard}><span>{String(index + 1).padStart(2, "0")}</span><Media item={asset(context, programme.assetId)} /><h3>{programme.name}</h3>{programme.descriptor ? <p className={styles.descriptor}>{programme.descriptor}</p> : null}{programme.summary ? <p>{programme.summary}</p> : null}<SiteLink context={context} className={styles.textLink} href="/programmes">Explore programmes <span aria-hidden="true">→</span></SiteLink></article>)}</div></Container></section>; }

function About({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { about } = context.rendererData; if (!about.lead && !about.values.length && !about.story.length) return <Unavailable title="About information is unavailable" />; return <><PageLead eyebrow="About" title="About" body={about.lead} />{about.values.length ? <section className={styles.section}><Container><div className={styles.valueList}>{about.values.map((value, index) => <article key={value.id}><span>{String(index + 1).padStart(2, "0")}</span><h2>{value.title}</h2>{value.body ? <p>{value.body}</p> : null}</article>)}</div></Container></section> : null}{about.story.length ? <section className={styles.story}><Container>{about.story.map((part) => <article key={part.id}><h2>{part.title}</h2>{part.body ? <p>{part.body}</p> : null}</article>)}</Container></section> : null}<VisitClose context={context} /></>; }
function Programmes({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const programmes = context.rendererData.programmes; if (!programmes.length) return <Unavailable title="Programme information is unavailable" body="Current programme information is not available on the published site." />; return <><PageLead eyebrow="Programmes" title="Programmes" body="Explore the current published programme information." /><section className={styles.section}><Container><div className={styles.programmeRows}>{programmes.map((programme, index) => <article key={programme.slug}><div><span>{String(index + 1).padStart(2, "0")}</span><h2>{programme.name}</h2>{programme.descriptor ? <p className={styles.descriptor}>{programme.descriptor}</p> : null}{programme.summary ? <p>{programme.summary}</p> : null}</div><Media item={asset(context, programme.assetId)} /></article>)}</div></Container></section><section className={styles.admissionsBridge}><Container><ApplicationCta context={context} /></Container></section></>; }
function Admissions({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { admissions } = context.rendererData; return <><PageLead eyebrow="Admissions" title="Admissions" body={admissions.lead ?? "The secure application continues on a separate admissions experience."} /><section className={styles.section}><Container className={styles.twoColumn}><div><h2>What happens next</h2>{admissions.steps.length ? <ol className={styles.steps}>{admissions.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol> : <p>The application experience shows the current information when it is available.</p>}</div><div className={styles.actionPanel}><h2>Start securely</h2><p>Applications continue on the dedicated admissions experience.</p><ApplicationCta context={context} /></div></Container></section>{admissions.questionsCopy ? <section className={styles.editorial}><Container><p>{admissions.questionsCopy}</p><SiteLink context={context} className={styles.textLink} href="/visit">Plan a visit <span aria-hidden="true">→</span></SiteLink></Container></section> : null}</>; }
function SchoolLife({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { schoolLife } = context.rendererData; const gallery = schoolLife.galleryAssetIds.map((id) => asset(context, id, ["gallery"])).filter((item): item is ApprovedPublicAsset => Boolean(item)); if (!schoolLife.lead && !schoolLife.features.length && !gallery.length) return <Unavailable title="School-life information is unavailable" />; return <><PageLead eyebrow="School life" title="School life" body={schoolLife.lead} />{gallery.length ? <section className={styles.section}><Container><div className={styles.gallery}>{gallery.map((item) => <Media key={item.id} item={item} className={styles.galleryItem} />)}</div></Container></section> : <section className={styles.lifeTeaser}><Container><div className={styles.fallbackPanel} aria-hidden="true"><span>◌</span></div></Container></section>}{schoolLife.features.length ? <section className={styles.section}><Container><div className={styles.valueList}>{schoolLife.features.map((feature) => <article key={feature.id}><h2>{feature.title}</h2>{feature.body ? <p>{feature.body}</p> : null}</article>)}</div></Container></section> : null}<VisitClose context={context} /></>; }
function Visit({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { visit, contact } = context.rendererData; if (!contact.address && !contact.phone && !contact.email) return <Unavailable title="Visit information is unavailable" />; return <><PageLead eyebrow="Visit" title="Visit" body={visit.lead} /><section className={styles.section}><Container className={styles.twoColumn}><div><h2>Plan a visit</h2>{visit.directions ? <p>{visit.directions}</p> : null}{contact.address ? <p><strong>Address</strong><br />{contact.address.display}</p> : <p>Contact the school using an approved method to arrange a visit.</p>}{visit.hours ? <p><strong>Hours</strong><br />{visit.hours}</p> : null}</div><ContactActions context={context} /></Container></section></>; }
function Contact({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { contact } = context.rendererData; if (!contact.phone && !contact.email && !contact.address && !contact.hours) return <Unavailable title="Contact information is unavailable" />; return <><PageLead eyebrow="Contact" title="Contact" body="Use the approved contact options below." /><section className={styles.section}><Container><div className={styles.contactGrid}>{contact.phone ? <a href={telephoneHref(contact.phone)}><strong>Phone</strong><span>{contact.phone}</span></a> : null}{contact.email ? <a href={`mailto:${contact.email}`}><strong>Email</strong><span>{contact.email}</span></a> : null}{contact.address ? <div><strong>Address</strong><span>{contact.address.display}</span></div> : null}{contact.hours ? <div><strong>Hours</strong><span>{contact.hours}</span></div> : null}</div></Container></section></>; }
function Policies({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const policies = context.rendererData.policies; if (!policies.length) return <Unavailable title="Policies are unavailable" />; return <><PageLead eyebrow="Policies" title="Policies" body="Read current published policy information." /><section className={styles.section}><Container><div className={styles.policyList}>{policies.map((policy) => <article key={policy.slug}><h2><SiteLink context={context} href={`/policies/${policy.slug}`}>{policy.title}</SiteLink></h2>{policy.summary ? <p>{policy.summary}</p> : null}{policy.reviewed ? <small>Review date: {policy.reviewed}</small> : null}</article>)}</div></Container></section></>; }
function PolicyDetail({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const policy = context.rendererData.policies.find((candidate) => candidate.slug === context.request.params.policySlug); if (!policy) return <Unavailable title="This policy is unavailable" />; const file = asset(context, policy.assetId, ["document"]); return <article className={styles.policyDetail}><Container><SiteLink context={context} className={styles.textLink} href="/policies">← Policies</SiteLink><p className={styles.eyebrow}>Policy</p><h1>{policy.title}</h1>{policy.summary ? <p className={styles.lead}>{policy.summary}</p> : null}{policy.issued ? <p>Issued: {policy.issued}</p> : null}{policy.reviewed ? <p>Review date: {policy.reviewed}</p> : null}{file?.kind === "document" ? <a className={styles.secondaryButton} href={file.url}>Read approved document</a> : null}<SiteLink context={context} className={styles.textLink} href="/contact">Contact the school <span aria-hidden="true">→</span></SiteLink></Container></article>; }
function ContactActions({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { phone, email } = context.rendererData.contact; return <div className={styles.actionPanel}><h2>Contact the school</h2>{phone ? <a className={styles.secondaryButton} href={telephoneHref(phone)}>Call the school</a> : null}{email ? <a className={styles.secondaryButton} href={`mailto:${email}`}>Email the school</a> : null}{!phone && !email ? <p>Approved contact details are not available.</p> : null}</div>; }
function VisitClose({ context }: { context: SiteRenderContext<ObhisRendererData> }) { return <section className={styles.visitClose}><Container><p className={styles.eyebrow}>Visit</p><h2>Plan a school visit.</h2><SiteLink context={context} className={styles.secondaryButton} href="/visit">Visit information</SiteLink></Container></section>; }
function Footer({ context }: { context: SiteRenderContext<ObhisRendererData> }) { const { identity, contact, policies } = context.rendererData; return <footer className={styles.footer}><Container><div><p className={styles.footerName}>{identity.shortName ?? identity.displayName}</p>{identity.motto ? <p>{identity.motto}</p> : null}</div><div className={styles.footerLinks}><SiteLink context={context} href="/contact">Contact</SiteLink>{policies.length ? <SiteLink context={context} href="/policies">Policies</SiteLink> : null}{context.links.portal ? <a href={context.links.portal.href}>Family portal</a> : null}{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : null}</div></Container></footer>; }
function telephoneHref(phone: string): string { const normalized = phone.replace(/[\s()-]/g, ""); return /^\+?[0-9]{7,20}$/.test(normalized) ? `tel:${normalized}` : "/contact"; }
