"use client";

/* Private fixture images deliberately bypass next/image and its optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, type CSSProperties } from "react";
import type { PrivateReviewContext } from "../../core/private-review";
import { mountInteractions } from "./interactions";

const heroPhotos = [
  { key: "classroom-moment", width: 1400, height: 935, alt: "Two pupils at a classroom desk in white and cyan tops with patterned uniform details." },
  { key: "school-friends", width: 1600, height: 1069, alt: "Pupils in white shirts and patterned school ties, with one smiling towards the camera." },
  { key: "classroom-table", width: 1600, height: 1069, alt: "Children seated around colourful classroom tables in their white shirts and patterned ties." },
  { key: "cultural-day-abuja", width: 1600, height: 1067, alt: "Children wearing patterned cultural dress and coral-coloured beads, with their arms raised." },
  { key: "cultural-day-rugam", width: 1600, height: 1067, alt: "An adult in patterned dress holding a child wearing black and coral-coloured beads." },
] as const;

function HeroPhoto({ assets }: { assets: PrivateReviewContext["assets"] }) {
  return <figure className="photo-print" aria-label="Photographs from the private school albums">
    <div className="hero-photo-stack">{heroPhotos.map((photo, index) => <img key={photo.key} draggable={false} data-hero-photo={index} hidden={index !== 0} src={assets[photo.key]} width={photo.width} height={photo.height} alt={photo.alt} />)}</div>
  </figure>;
}

export function Homepage({ context }: { context: PrivateReviewContext }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current) return;
    return mountInteractions(root.current);
  }, []);
  const style: CSSProperties & PrivateReviewContext["theme"] = { ...context.theme };
  return <div className="obhis-review" ref={root} style={style}>

  <a className="skip" href="#main">Skip to the school introduction</a>
  <header className="site-header">
    <a className="brand" href="#main" aria-label="Olive Blessed Crest Academy home"><img src={context.assets["school-logo"]} width="44" height="44" alt="School logo: Integrity and Service" /><div className="brand-name"><span>Olive Blessed Crest</span><span>Academy</span></div></a>
    <nav className="nav" aria-label="School navigation"><a className="school-link" href="#our-school">Our school</a><a href="#school-life">School life</a><a href="#campuses">Our campuses</a><a className="admissions" href="#admissions">Admissions <span className="arrow" aria-hidden="true">↗</span></a></nav>
  </header>
  <main id="main" tabIndex={-1}>
    <section className="hero-stage" id="hero-stage" data-scene="olive" aria-label="Olive and you">
      <div className="scene-controls" role="group" aria-label="Choose a welcome" tabIndex={0} hidden>
        <button type="button" data-welcome-play aria-label="Pause welcome slideshow" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path className="pause-icon" d="M8 6v12M16 6v12" /><path className="play-icon" d="m9 6 9 6-9 6Z" /></svg></button><span className="scene-position" data-scene-position>01 / 02</span>
        <button type="button" data-scene-choice="olive" aria-label="Previous welcome, Olive" aria-controls="hero-stage" disabled>←</button><button type="button" data-scene-choice="you" aria-label="Next welcome, You" aria-controls="hero-stage">→</button>
      </div>
      <p className="sr-only" id="scene-status" role="status" aria-live="polite"></p>
      <div className="scene scene-olive" data-panel="olive">
        <div className="olive-top">
          <p className="eyebrow">{context.displayName}</p><h1 aria-label="Meet Olive."><span className="headline-line" aria-hidden="true">Meet</span></h1>
        </div>
        <div className="olive-bottom">
          <div className="olive-art"><img draggable={false} src={context.assets["hero-cutout"]} width="1448" height="781" fetchPriority="high" alt="Imagined layered paper lettering, patterned cotton and a fan of paper on a cyan surface." /></div>
          <HeroPhoto assets={context.assets} />
        </div>
      </div>
      <div className="scene scene-you" data-panel="you" aria-hidden="true" hidden>
        <div className="you-copy">
          <h1 aria-label="A place for you."><span className="headline-line" aria-hidden="true"><span className="line-text">A place</span></span><span className="headline-line" aria-hidden="true"><span className="line-text">for</span></span></h1>
        </div>
        <figure className="you-art"><img draggable={false} src={context.assets["you-hero"]} width="1402" height="700" alt="Imagined layered paper lettering and patterned cotton with soft contact shadows." /></figure>
      </div>
      <a className="hero-link secondary-link" href="#school-life">Explore school life <span aria-hidden="true">↓</span></a>
    </section>
    <noscript><p className="no-script">The Olive introduction is shown. All school photographs and the links below work without animation.</p></noscript>
    <div className="fabric-rule" aria-hidden="true"></div>

    <section className="school-intro page-section" id="our-school" aria-labelledby="school-heading">
      <div><p className="section-kicker">This is Olive</p><h2 className="section-title" id="school-heading">The people<br />make the place.</h2></div>
      <div className="school-intro-copy"><p>The colours begin with a uniform. The story belongs to the people wearing it.</p><p>Take a closer look through photographs from Olive&apos;s own school albums. Familiar faces, classroom tables and a cultural day in full colour.</p><a className="secondary-link" href="#school-life">Open the school album <span aria-hidden="true">↓</span></a></div>
    </section>

    <section className="school-album page-section" id="school-life" aria-labelledby="album-heading">
      <div className="section-top"><div><p className="section-kicker">School life, through our lens</p><h2 className="section-title" id="album-heading">A little more<br />of our world.</h2></div><div className="album-choices" role="group" aria-label="Choose a school photo album" hidden><button type="button" data-collection-choice="day" aria-pressed="true" aria-controls="album-photos">School day</button><button type="button" data-collection-choice="culture" aria-pressed="false" aria-controls="album-photos">Cultural day</button></div></div>
      <div className="album-grid" id="album-photos">
        <figure className="album-sheet" data-collection="day"><a className="album-photo" href={context.assets["school-friends"]} data-photo="0" aria-label="View the school friends photograph"><img src={context.assets["school-friends"]} width="1600" height="1069" loading="lazy" alt="Pupils in white shirts and patterned school ties, with one smiling towards the camera." /><span className="photo-open" aria-hidden="true">Take a closer look ↗</span></a><figcaption><span className="print-number" aria-hidden="true">01</span><div><strong>A smile between moments.</strong><span>From the school-visit album</span></div></figcaption></figure>
        <figure className="album-sheet" data-collection="day"><a className="album-photo" href={context.assets["classroom-table"]} data-photo="1" aria-label="View the classroom table photograph"><img src={context.assets["classroom-table"]} width="1600" height="1069" loading="lazy" alt="Children seated around colourful classroom tables in their white shirts and patterned ties." /><span className="photo-open" aria-hidden="true">Take a closer look ↗</span></a><figcaption><span className="print-number" aria-hidden="true">02</span><div><strong>Around the classroom table.</strong><span>From the school-visit album</span></div></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><a className="album-photo" href={context.assets["cultural-day-abuja"]} data-photo="2" aria-label="View the Abuja cultural-day photograph"><img src={context.assets["cultural-day-abuja"]} width="1600" height="1067" loading="lazy" alt="Children wearing patterned cultural dress and coral-coloured beads, with their arms raised." /><span className="photo-open" aria-hidden="true">Take a closer look ↗</span></a><figcaption><span className="print-number" aria-hidden="true">03</span><div><strong>Colour, with a little volume.</strong><span>Cultural day · Abuja album</span></div></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><a className="album-photo" href={context.assets["cultural-day-rugam"]} data-photo="3" aria-label="View the Rugam cultural-day photograph"><img src={context.assets["cultural-day-rugam"]} width="1600" height="1067" loading="lazy" alt="An adult in patterned dress holding a child wearing black and coral-coloured beads." /><span className="photo-open" aria-hidden="true">Take a closer look ↗</span></a><figcaption><span className="print-number" aria-hidden="true">04</span><div><strong>Some moments need a hand.</strong><span>Cultural day · Rugam album</span></div></figcaption></figure>
      </div>
      <p className="sr-only" id="album-status" role="status" aria-live="polite"></p>
      <div className="album-foot"><p>School photographs for private review. Publication rights and child permissions await confirmation.</p><a className="secondary-link" href="https://www.facebook.com/profile.php?id=100010370084416" target="_blank" rel="noopener noreferrer">Olive on Facebook <span aria-hidden="true">↗</span></a></div>
    </section>

    <section className="crest-story" aria-labelledby="crest-heading">
      <div className="crest-copy"><p className="section-kicker">Two words on our crest</p><h2 id="crest-heading">Integrity.<br /><span>Service.</span></h2><p>Our crest gives us the words.<br />Our uniform gives us the colours.</p><a className="secondary-link" href="#campuses">Find your place at Olive <span aria-hidden="true">↓</span></a></div>
      <figure className="uniform-print"><img src={context.assets["uniform-detail"]} width="1000" height="1050" loading="lazy" alt="A close detail of the cyan, coral and gold circles printed on the school's uniform fabric." /><figcaption>The detail that started this direction.</figcaption></figure>
    </section>

    <section className="campus-section" id="campuses" aria-labelledby="campus-heading">
      <div className="section-top"><div><p className="section-kicker">Our campuses</p><h2 className="section-title" id="campus-heading">Different places.<br />The same Olive.</h2></div><div className="campus-intro"><p>Shared colours. Local faces.</p><p className="content-note">Abuja and Rugam are labels from the supplied photo albums. Current campus names, addresses and contacts still need confirmation.</p></div></div>
      <div className="campus-grid">
        <article className="campus-album"><a href={context.assets["cultural-day-abuja"]} data-photo="2" aria-label="Open the cultural-day photograph from the Abuja album"><img src={context.assets["cultural-day-abuja"]} width="1600" height="1067" loading="lazy" alt="Children in patterned dress at the event labelled cultural day in the Abuja album." /></a><div className="campus-label"><div><p className="section-kicker">From the cultural-day album</p><h3>Abuja <span>album</span></h3></div><a className="campus-photo-link" href={context.assets["cultural-day-abuja"]} data-photo="2" aria-label="View the Abuja album photograph"><span aria-hidden="true">↗</span></a></div><p className="campus-status">Campus address and visit contact pending confirmation.</p></article>
        <article className="campus-album"><a href={context.assets["cultural-day-rugam"]} data-photo="3" aria-label="Open the cultural-day photograph from the Rugam album"><img src={context.assets["cultural-day-rugam"]} width="1600" height="1067" loading="lazy" alt="An adult and child in cultural dress in the photo album labelled Rugam." /></a><div className="campus-label"><div><p className="section-kicker">From the cultural-day album</p><h3>Rugam <span>album</span></h3></div><a className="campus-photo-link" href={context.assets["cultural-day-rugam"]} data-photo="3" aria-label="View the Rugam album photograph"><span aria-hidden="true">↗</span></a></div><p className="campus-status">Campus address and visit contact pending confirmation.</p></article>
      </div>
      <a className="campus-visit secondary-link" href="#visit-guide">Thinking about a visit? Start here <span aria-hidden="true">↓</span></a>
    </section>

    <section className="admissions-section page-section" id="admissions" aria-labelledby="admissions-heading">
      <div className="admissions-copy"><p className="section-kicker">Your next step</p><h2 className="section-title" id="admissions-heading">Come with<br />your questions.</h2><p>Choosing a school is personal. Start with the things that matter to your family.</p><a className="primary-link" href="#visit-guide">Think through a visit <span className="arrow" aria-hidden="true">↓</span></a><p className="admissions-note">Private review. No application or booking is collected on this page.</p></div>
      <div className="admissions-guides">
        <details id="visit-guide" open><summary><span>Before a school visit</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>A few questions worth bringing:</p><ul><li>Which campus would work for your family?</li><li>What age or year group are you considering?</li><li>What would you like to see or ask about?</li></ul><p className="availability-note">Visit contacts, addresses and booking arrangements are not yet confirmed in this draft.</p></div></details>
        <details id="application-guide"><summary><span>Applying to Olive</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>The finished website will link to the school&apos;s separate online application. It will not ask you to submit a child&apos;s information on this homepage.</p><p className="availability-note">The application link, current programmes, intakes and fees are not configured here. This review takes no payments.</p></div></details>
      </div>
    </section>
  </main>

  <footer className="school-footer">
    <div className="footer-top"><div><p className="section-kicker">Olive Blessed Crest Academy</p><p className="footer-welcome">Welcome<br />to Olive.</p></div><div className="footer-links"><a href="#our-school">Our school</a><a href="#school-life">School life</a><a href="#campuses">Our campuses</a><a href="#admissions">Admissions</a><a href="https://www.facebook.com/profile.php?id=100010370084416" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="#main">Back to the top ↑</a></div></div>
    <div className="footer-bottom"><p>Private homepage review. Imagined artwork. School facts and photo publication permissions remain pending.</p><p>Integrity &amp; Service</p></div>
  </footer>

  <dialog className="photo-viewer" id="photo-viewer" aria-labelledby="viewer-heading" aria-describedby="viewer-permission">
    <div className="viewer-top"><h2 id="viewer-heading">The Olive photo album</h2><button type="button" id="viewer-close" autoFocus>Close <span aria-hidden="true">×</span></button></div>
    <div className="viewer-image"><img id="viewer-image" src={context.assets["school-friends"]} width="1600" height="1069" loading="lazy" alt="Pupils in patterned school ties, with one smiling towards the camera." /></div>
    <div className="viewer-bottom"><div><p id="viewer-caption"></p><p id="viewer-permission">Private review. Publication rights and child permissions pending.</p></div><div className="viewer-controls"><button type="button" id="viewer-previous" aria-label="Previous photograph">←</button><span id="viewer-position" aria-live="polite"></span><button type="button" id="viewer-next" aria-label="Next photograph">→</button></div></div>
  </dialog>
  </div>;
}
