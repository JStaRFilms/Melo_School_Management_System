import type { Metadata } from "next";
import { siteBrand, toJsonLd } from "@/site";

import { WovenLightHero } from "../components/ui/woven-light-hero";
import { FramedReveal } from "../components/public/landing/framed-reveal";
import { ProofBand } from "../components/public/landing/proof-band";
import { ExpansionStory } from "../components/public/landing/expansion-story";
import { CapabilityComposition } from "../components/public/landing/capability-composition";
import { FinalCta } from "../components/public/landing/final-cta";

export const metadata: Metadata = {
  title: `${siteBrand.name} — ${siteBrand.tagline}`,
  description: siteBrand.description,
};

const platformSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteBrand.name,
  description: siteBrand.description,
  url: siteBrand.siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(platformSchema) }}
      />
      <WovenLightHero />
      <FramedReveal />
      <ProofBand />
      <ExpansionStory />
      <CapabilityComposition />
      <FinalCta />
    </>
  );
}
