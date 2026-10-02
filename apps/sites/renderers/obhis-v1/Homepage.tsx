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
        <div className="welcome-canvas">
          <div className="olive-top"><h1 aria-label="Meet Olive."><span className="headline-line" aria-hidden="true">Meet</span></h1></div>
          <div className="olive-art"><img draggable={false} src={context.assets["hero-cutout"]} width="1448" height="706" fetchPriority="high" alt="Imagined layered paper lettering and patterned cotton on a cyan surface." /></div>
          <HeroPhoto assets={context.assets} />
        </div>
      </div>
      <div className="scene scene-you" data-panel="you" aria-hidden="true" hidden>
        <div className="welcome-canvas">
          <div className="you-copy">
            <h1 aria-label="A place for you."><span className="headline-line" aria-hidden="true"><span className="line-text">A place</span></span><span className="headline-line" aria-hidden="true"><span className="line-text">for</span></span></h1>
          </div>
          <figure className="you-art"><img draggable={false} src={context.assets["you-hero"]} width="1402" height="700" alt="Imagined layered paper lettering and patterned cotton with soft contact shadows." /></figure>
        </div>
      </div>
      <a className="hero-link secondary-link" href="#school-life">Explore school life <span aria-hidden="true">↓</span></a>
    </section>
    <noscript><p className="no-script">The Olive introduction is shown. All school photographs and the links below work without animation.</p></noscript>
    <div className="fabric-rule" aria-hidden="true"></div>

    <section className="school-intro page-section" id="our-school" aria-label="About Olive">
      <p>Olive Blessed Crest Academy is a school with roots in Nyanya, Abuja, and a belief that learning and character grow together. We want children to ask questions, take pride in their progress, and learn to care for the people around them.</p>
    </section>

    <section className="school-album page-section" id="school-life" aria-labelledby="album-heading">
      <div className="section-top album-intro"><div><p className="section-kicker">School life</p><h2 className="section-title" id="album-heading">The people make <br />the place.</h2></div><p>A shared table. A familiar face. The excitement of cultural day. Get to know Olive through the everyday moments and celebrations that bring our school together.</p></div>
      <div className="album-choices" role="group" aria-label="Choose school life photographs" hidden><button type="button" data-collection-choice="day" aria-pressed="true" aria-controls="album-photos">School day</button><button type="button" data-collection-choice="culture" aria-pressed="false" aria-controls="album-photos">Cultural day</button></div>
      <div className="album-grid" id="album-photos">
        <figure className="album-sheet" data-collection="day"><img src={context.assets["school-friends"]} width="1600" height="1069" loading="lazy" alt="Pupils in white shirts and patterned school ties, with one smiling towards the camera." /><figcaption><span className="print-number" aria-hidden="true">01</span><div><strong>A smile between moments.</strong><span>School day</span></div><a className="album-photo" href={context.assets["school-friends"]} data-photo="0" aria-label="View photo: A smile between moments">View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="day"><img src={context.assets["classroom-table"]} width="1600" height="1069" loading="lazy" alt="Children seated around colourful classroom tables in their white shirts and patterned ties." /><figcaption><span className="print-number" aria-hidden="true">02</span><div><strong>Around the classroom table.</strong><span>School day</span></div><a className="album-photo" href={context.assets["classroom-table"]} data-photo="1" aria-label="View photo: Around the classroom table">View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><img src={context.assets["cultural-day-abuja"]} width="1600" height="1067" loading="lazy" alt="Children wearing patterned cultural dress and coral-coloured beads, with their arms raised." /><figcaption><span className="print-number" aria-hidden="true">03</span><div><strong>Colour, with a little volume.</strong><span>Cultural day</span></div><a className="album-photo" href={context.assets["cultural-day-abuja"]} data-photo="2" aria-label="View photo: Colour, with a little volume">View photo ↗</a></figcaption></figure>
        <figure className="album-sheet" data-collection="culture"><img src={context.assets["cultural-day-rugam"]} width="1600" height="1067" loading="lazy" alt="An adult in patterned dress holding a child wearing black and coral-coloured beads." /><figcaption><span className="print-number" aria-hidden="true">04</span><div><strong>Some moments need a hand.</strong><span>Cultural day</span></div><a className="album-photo" href={context.assets["cultural-day-rugam"]} data-photo="3" aria-label="View photo: Some moments need a hand">View photo ↗</a></figcaption></figure>
      </div>
      <p className="sr-only" id="album-status" role="status" aria-live="polite"></p>
      <div className="album-foot"><p>School photographs for private review. Publication rights and child permissions await confirmation.</p><a className="secondary-link" href="https://www.facebook.com/profile.php?id=100010370084416" target="_blank" rel="noopener noreferrer">Olive on Facebook <span aria-hidden="true">↗</span></a></div>
    </section>

    <section className="crest-story" aria-labelledby="crest-heading">
      <div className="crest-copy"><p className="section-kicker">What we stand for</p><h2 id="crest-heading">Integrity. <br /><span>Service.</span></h2><p className="crest-intro">Learning shapes what a child knows. It should also help shape how they treat others.</p><div className="values-grid"><div><h3>Integrity</h3><p>Being honest about our work, keeping our word, and taking responsibility when we get something wrong. Integrity grows through the choices we make every day.</p></div><div><h3>Service</h3><p>Noticing when someone needs help and choosing to act. Making room for a classmate, sharing what we know, and caring for the spaces we use together.</p></div></div></div>
      <figure className="uniform-print"><img src={context.assets["uniform-detail"]} width="1000" height="1050" loading="lazy" alt="A close detail of the cyan, coral and gold circles printed on the school's uniform fabric." /></figure>
    </section>

    <section className="campus-section" id="campuses" aria-labelledby="campus-heading">
      <p className="section-kicker">Our campuses</p><h2 className="section-title" id="campus-heading">Different places. <br />The same Olive.</h2>
      <div className="campus-grid">
        <article className="campus-album"><img src={context.assets["cultural-day-abuja"]} width="1600" height="1067" loading="lazy" alt="Children in patterned dress at the event labelled cultural day in the Abuja photo collection." /><div className="campus-label"><h3>Abuja</h3></div></article>
        <article className="campus-album"><img src={context.assets["cultural-day-rugam"]} width="1600" height="1067" loading="lazy" alt="An adult and child in cultural dress in the photo collection labelled Rugam." /><div className="campus-label"><h3>Rugam</h3></div></article>
      </div>
    </section>

    <section className="admissions-section page-section" id="admissions" aria-labelledby="admissions-heading">
      <div className="admissions-copy"><h2 className="section-title" id="admissions-heading">Come with <br />your questions.</h2><p>Choosing a school is personal. Start with the things that matter to your family.</p></div>
      <div className="admissions-guides">
        <details id="visit-guide"><summary><span>Visiting Olive</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>Find us at Plot 18C3, Habiscus Street, Federal Housing Estate, Karu Roundabout, Nyanya, Abuja, FCT. Have a question before you come? <a href="#contact">Contact the school</a>.</p></div></details>
        <details id="application-guide"><summary><span>How to apply</span><span className="disclosure-mark" aria-hidden="true"></span></summary><div className="guide-body"><p>Application links will be added shortly. Until then, use the <a href="#contact">contact information below</a> to ask about applying.</p></div></details>
      </div>
    </section>

    <section className="contact-section page-section" id="contact" aria-labelledby="contact-heading">
      <div><p className="section-kicker">Contact</p><h2 className="section-title" id="contact-heading">Get in touch.</h2><p>Questions about visiting or applying? You can reach the school by phone or email.</p></div>
      <div className="contact-methods"><div><span>Phone</span><a href="tel:+2348057755997">+234 805 775 5997</a></div><div><span>Email</span><a href="mailto:obhischool@gmail.com">obhischool@gmail.com</a></div></div>
    </section>

    <section className="donations-section page-section" id="donations" aria-labelledby="donations-heading">
      <div><p className="section-kicker">Donations</p><h2 className="section-title" id="donations-heading">Support Olive.</h2><p>Donation links and QR codes will be added here shortly.</p></div>
      <div className="donation-qr-space" aria-label="Space reserved for donation QR codes"><div>QR code coming soon</div><div>QR code coming soon</div></div>
    </section>
  </main>

  <footer className="school-footer">
    <div className="footer-top"><div className="footer-brand"><img src={context.assets["school-logo"]} width="52" height="52" alt="" /><div><strong>Olive Blessed Crest Academy</strong><p>Integrity &amp; Service</p></div></div><div className="footer-links"><a href="#our-school">Our school</a><a href="#school-life">School life</a><a href="#campuses">Our campuses</a><a href="#admissions">Admissions</a><a href="#contact">Contact</a><a href="#donations">Donations</a><a href="https://www.facebook.com/profile.php?id=100010370084416" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="#main">Back to top ↑</a></div></div>
    <p className="footer-disclaimer">Private homepage review. Imagined artwork. Contact details supplied for review; photo publication permissions remain pending.</p>
  </footer>

  <dialog className="photo-viewer" id="photo-viewer" aria-labelledby="viewer-heading" aria-describedby="viewer-permission">
    <div className="viewer-top"><h2 id="viewer-heading">The Olive photo album</h2><button type="button" id="viewer-close" autoFocus>Close <span aria-hidden="true">×</span></button></div>
    <div className="viewer-image"><img id="viewer-image" src={context.assets["school-friends"]} width="1600" height="1069" loading="lazy" alt="Pupils in patterned school ties, with one smiling towards the camera." /></div>
    <div className="viewer-bottom"><div><p id="viewer-caption"></p><p id="viewer-permission">Private review. Publication rights and child permissions pending.</p></div><div className="viewer-controls"><button type="button" id="viewer-previous" aria-label="Previous photograph">←</button><span id="viewer-position" aria-live="polite"></span><button type="button" id="viewer-next" aria-label="Next photograph">→</button></div></div>
  </dialog>
  </div>;
}
