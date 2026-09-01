import type { Metadata } from "next";
import { buildPageMetadata, siteBrand, toJsonLd } from "@/site";
import { FeaturesCinemaExperience } from "../../components/features/features-cinema-experience";

export const metadata: Metadata = buildPageMetadata({
  title: "Platform Features — Unified Architecture",
  description:
    "Explore the four interconnected operating systems powering Melo: Broadsheets, multi-channel Bursary reconciliation, Parent WhatsApp delivery, and AI curriculum preparation.",
  path: "/features",
});

const featuresSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: `${siteBrand.name} Features Architecture`,
  description:
    "Four unified operating systems connecting academics, broadsheets, Paystack & Providus fee collection, parent WhatsApp visibility, and admissions for Nigerian schools.",
  url: `${siteBrand.siteUrl}/features`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
};

export default function FeaturesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(featuresSchema) }}
      />
      <FeaturesCinemaExperience />
    </>
  );
}
