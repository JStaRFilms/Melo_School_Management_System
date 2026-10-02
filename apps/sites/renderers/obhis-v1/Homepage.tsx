"use client";

/* First-party images bypass next/image and its optimizer so asset rights are checked on each request. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, type CSSProperties } from "react";
import { calculateContrastRatio, getContrastSafeText } from "@school/shared/theme";
import type { OliveModel } from "./model";
import { mountInteractions } from "./interactions";

const heroPhotos = [
  { key: "classroom_moment", width: 1400, height: 935 },
  { key: "school_friends", width: 1600, height: 1069 },
  { key: "classroom_table", width: 1600, height: 1069 },
  { key: "cultural_day_abuja", width: 1600, height: 1067 },
  { key: "cultural_day_rugam", width: 1600, height: 1067 },
] as const;

function HeroPhoto({ assets }: { assets: OliveModel["assets"] }) {
  return <figure className="photo-print" aria-label="School photographs">
    <div className="hero-photo-stack">{heroPhotos.map((photo, index) => <img key={photo.key} draggable={false} data-hero-photo={index} hidden={index !== 0} src={assets[photo.key].src} width={photo.width} height={photo.height} alt={assets[photo.key].alt} />)}</div>
  </figure>;
}

export function Homepage({ model }: { model: OliveModel }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    return mountInteractions(root.current);
  }, []);
  const {assets, text} = model;
  // Keep the approved two-line values treatment while rendering only published text.
  const valuesBreak = text.values_heading.indexOf(". ");
  const valuesHeading = valuesBreak < 0 ? text.values_heading : <>{text.values_heading.slice(0, valuesBreak + 2)}<br /><span>{text.values_heading.slice(valuesBreak + 2)}</span></>;
  // The values chapter uses code-owned neutral ink, not a third tenant colour.
  const valuesInk = "#142c38";
  const accent = model.theme["--school-accent"];
  const style: CSSProperties & OliveModel["theme"] & { "--values-accent": string } = {
    ...model.theme,
    "--values-accent": calculateContrastRatio(accent, valuesInk) >= 4.5 ? accent : getContrastSafeText(valuesInk),
  };
  return <div className="obhis-review" ref={root} style={style}>

  <a className="skip" href="#main">Skip to the school introduction</a>
  <header className="site-header">
    <a className="brand" href="#main" aria-label={`${text.school_name} home`}><img src={assets.school_logo.src} width="44" height="44" alt={assets.school_logo.alt} /><div className="brand-name"><span>{text.school_name}</span></div></a>
    <nav className="nav" aria-label="School navigation"><a className="school-link" href="#our-school">Our school</a><a href="#school-life">School life</a><a href="#campuses">Our campuses</a><a className="admissions" href="#admissions">Admissions <span className="arrow" aria-hidden="true">↗</span></a></nav>
  </header>
  <main id="main" tabIndex={-1}>
    <section className="hero-stage" id="hero-stage" data-scene="olive" aria-label={`${text.short_name} and you`}>
      <div className="scene-controls" role="group" aria-label="Choose a welcome" tabIndex={0} hidden>
        <button type="button" data-welcome-play aria-label="Pause welcome slideshow" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path className="pause-icon" d="M8 6v12M16 6v12" /><path className="play-icon" d="m9 6 9 6-9 6Z" /></svg></button><span className="scene-position" data-scene-position>01 / 02</span>
        <button type="button" data-scene-choice="olive" aria-label={`Previous welcome, ${text.short_name}`} aria-controls="hero-stage" disabled>←</button><button type="button" data-scene-choice="you" aria-label="Next welcome, You" aria-controls="hero-stage">→</button>
      </div>
      <p className="sr-only" id="scene-status" role="status" aria-live="polite"></p>
      <div className="scene scene-olive" data-panel="olive">
        <div className="welcome-canvas">
          <div className="olive-top"><h1 aria-label={`Meet ${text.short_name}.`}><span className="headline-line" aria-hidden="true">Meet</span></h1></div>
          <div className="olive-art"><img draggable={false} src={assets.hero_cutout.src} width="1448" height="706" fetchPriority="high" alt={assets.hero_cutout.alt} /></div>
          <HeroPhoto assets={assets} />
        </div>
      </div>
      <div className="scene scene-you" data-panel="you" aria-hidden="true" hidden>
        <div className="welcome-canvas">
          <div className="you-copy">
            <h1 aria-label="A place for you."><span className="headline-line" aria-hidden="true"><span className="line-text">A place</span></span><span className="headline-line" aria-hidden="true"><span className="line-text">for</span></span></h1>
          </div>
          <figure className="you-art"><img draggable={false} src={assets.you_hero.src} width="1402" height="700" alt={assets.you_hero.alt} /></figure>
        </div>
      </div>
      <a className="hero-link secondary-link" href="#school-life">Explore school life <span aria-hidden="true">↓</span></a>
    </section>
    <noscript><p className="no-script">The school introduction is shown. All school photographs and the links below work without animation.</p></noscript>
    <div className="fabric-rule" aria-hidden="true"></div>

    <section className="school-intro page-section" id="our-school" aria-label={`About ${text.short_name}`}>
      <p>{text.intro}</p>
    </section>

    <section className="school-album page-section" id="school-life" aria-labelledby="album-heading">
      <div className="section-top album-intro"><div><p className="section-kicker">School life</p><h2 className="section-title" id="album-heading">{text.album_heading}</h2></div><p>{text.album_intro}</p></div>
      <div className="album-choices" role="group" aria-label="Choose school life photographs" hidden><button type="button" data-collection-choice="day" aria-pressed="true" aria-controls="album-photos">{text.album_day_label}</button><button type="button" data-collection-choice="culture" aria-pressed="false" aria-controls="album-photos">{text.album_culture_label}</button></div>
      <div className="album-grid" id="album-photos">
        <figure className="album-sheet" data-collection="day"><img src={assets.school_friends.src} width="1600" height="1069" loading="lazy" alt={assets.school_friends.alt} /><figcaption><span className="print-number" aria-hidden="true">01</span><div><strong>{text.caption_friends}</strong><span>{text.album_day_label}</span></div><a className="album-photo" href={assets.school_friends.src} data-photo="0" aria-label={`View photo: ${text.caption_friends}`} >View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="day"><img src={assets.classroom_table.src} width="1600" height="1069" loading="lazy" alt={assets.classroom_table.alt} /><figcaption><span className="print-number" aria-hidden="true">02</span><div><strong>{text.caption_table}</strong><span>{text.album_day_label}</span></div><a className="album-photo" href={assets.classroom_table.src} data-photo="1" aria-label={`View photo: ${text.caption_table}`} >View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><img src={assets.cultural_day_abuja.src} width="1600" height="1067" loading="lazy" alt={assets.cultural_day_abuja.alt} /><figcaption><span className="print-number" aria-hidden="true">03</span><div><strong>{text.caption_abuja}</strong><span>{text.album_culture_label}</span></div><a className="album-photo" href={assets.cultural_day_abuja.src} data-photo="2" aria-label={`View photo: ${text.caption_abuja}`} >View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><img src={assets.cultural_day_rugam.src} width="1600" height="1067" loading="lazy" alt={assets.cultural_day_rugam.alt} /><figcaption><span className="print-number" aria-hidden="true">04</span><div><strong>{text.caption_rugam}</strong><span>{text.album_culture_label}</span></div><a className="album-photo" href={assets.cultural_day_rugam.src} data-photo="3" aria-label={`View photo: ${text.caption_rugam}`} >View photo ↗</a></figcaption></figure>
      </div>
      <p className="sr-only" id="album-status" role="status" aria-live="polite"></p>
      <div className="album-foot">{model.privateReview && <p>The owner approved these photographs. Publication requires current per-photo rights and child evidence in the backend.</p>}{model.facebookHref && <a className="secondary-link" href={model.facebookHref} target="_blank" rel="noopener noreferrer">{text.short_name} on Facebook <span aria-hidden="true">↗</span></a>}</div>
    </section>

    <section className="crest-story" aria-labelledby="crest-heading">
      <div className="crest-copy"><p className="section-kicker">What we stand for</p><h2 id="crest-heading">{valuesHeading}</h2><p className="crest-intro">{text.values_intro}</p><div className="values-grid"><div><h3>{text.integrity_label}</h3><p>{text.integrity_copy}</p></div><div><h3>{text.service_label}</h3><p>{text.service_copy}</p></div></div></div>
      <figure className="uniform-print"><img src={assets.uniform_detail.src} width="1000" height="1050" loading="lazy" alt={assets.uniform_detail.alt} /></figure>
    </section>

    <section className="campus-section" id="campuses" aria-labelledby="campus-heading">
      <p className="section-kicker">Our campuses</p><h2 className="section-title" id="campus-heading">{text.campus_heading}</h2>
      <div className="campus-grid">
        <article className="campus-album"><img src={assets.cultural_day_abuja.src} width="1600" height="1067" loading="lazy" alt={assets.cultural_day_abuja.alt} /><div className="campus-label"><h3>{text.campus_abuja}</h3><p>Campus details are not available here yet.</p></div></article>
        <article className="campus-album"><img src={assets.cultural_day_rugam.src} width="1600" height="1067" loading="lazy" alt={assets.cultural_day_rugam.alt} /><div className="campus-label"><h3>{text.campus_rugam}</h3><p>Campus details are not available here yet.</p></div></article>
      </div>
    </section>

    <section className="admissions-section page-section" id="admissions" aria-labelledby="admissions-heading">
      <div className="admissions-copy"><h2 className="section-title" id="admissions-heading">{text.admissions_heading}</h2><p>{text.admissions_intro}</p></div>
      <div className="admissions-guides">
        <details id="visit-guide"><summary><span>Visiting {text.short_name}</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>Find us at {text.visit_address}. Have a question before you come? <a href="#contact">Contact the school</a>.</p></div></details>
        <details id="application-guide"><summary><span>How to apply</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>{model.applyHref ? <a href={model.applyHref}>Apply online</a> : <>{text.application_notice} Until then, use the <a href="#contact">contact information below</a> to ask about applying.</>}</p></div></details>
      </div>
    </section>

    <section className="contact-section page-section" id="contact" aria-labelledby="contact-heading">
      <div><p className="section-kicker">Contact</p><h2 className="section-title" id="contact-heading">Get in touch.</h2><p>{text.contact_intro}</p></div>
      <div className="contact-methods"><div><span>Phone</span><a href={`tel:${text.phone}`}>{text.phone.replace(/^(\+\d{3})(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3 $4")}</a></div><div><span>Email</span><a href={`mailto:${text.email}`}>{text.email}</a></div></div>
    </section>

    <section className="donations-section page-section" id="donations" aria-labelledby="donations-heading">
      <div><p className="section-kicker">Donations</p><h2 className="section-title" id="donations-heading">Support {text.short_name}.</h2><p>{text.donations_intro}</p></div>
      {model.privateReview && <div className="donation-qr-space" aria-label="Space reserved for donation QR codes"><div>QR code coming soon</div><div>QR code coming soon</div></div>}
    </section>
  </main>

  <footer className="school-footer">
    <div className="footer-top"><div className="footer-brand"><img src={assets.school_logo.src} width="52" height="52" alt={assets.school_logo.alt} /><div><strong>{text.school_name}</strong><p>{text.motto}</p></div></div><div className="footer-links"><a href="#our-school">Our school</a><a href="#school-life">School life</a><a href="#campuses">Our campuses</a><a href="#admissions">Admissions</a><a href="#contact">Contact</a><a href="#donations">Donations</a>{model.facebookHref && <a href={model.facebookHref} target="_blank" rel="noopener noreferrer">Facebook ↗</a>}<a href="#main">Back to top ↑</a></div></div>
    {model.privateReview && <p className="footer-disclaimer">Private homepage review. Imagined artwork. Owner-approved photos and campus details; current contacts approved for source inclusion. Backend records are unverified here; launch is not authorized.</p>}
  </footer>

  <dialog className="photo-viewer" id="photo-viewer" aria-labelledby="viewer-heading" aria-describedby="viewer-permission">
    <div className="viewer-top"><h2 id="viewer-heading">The {text.short_name} photo album</h2><button type="button" id="viewer-close" autoFocus>Close <span aria-hidden="true">×</span></button></div>
    <div className="viewer-image"><img id="viewer-image" src={assets.school_friends.src} width="1600" height="1069" loading="lazy" alt={assets.school_friends.alt} /></div>
    <div className="viewer-bottom"><div><p id="viewer-caption"></p><p id="viewer-permission">{model.privateReview ? "Private review. Owner approval does not replace per-photo rights and child consent evidence." : "School photo album."}</p></div><div className="viewer-controls"><button type="button" id="viewer-previous" aria-label="Previous photograph">←</button><span id="viewer-position" aria-live="polite"></span><button type="button" id="viewer-next" aria-label="Next photograph">→</button></div></div>
  </dialog>
  </div>;
}
