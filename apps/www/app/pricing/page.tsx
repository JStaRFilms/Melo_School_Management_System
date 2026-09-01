import type { Metadata } from "next";
import { buildPageMetadata, siteBrand, toJsonLd } from "@/site";
import { CleanPricingExperience } from "../../components/pricing/clean-pricing-experience";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing & Plans — Transparent Per-Student Model",
  description:
    "Simple, transparent per-student pricing for Nigerian schools starting at ₦1,000 per term. No hidden fees, no per-SMS markups, and 100% data ownership.",
  path: "/pricing",
});

const pricingSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: `${siteBrand.name} Pricing`,
  description:
    "Predictable per-student school management software pricing for Nigerian schools starting at ₦1,000 per student per term.",
  url: `${siteBrand.siteUrl}/pricing`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "NGN",
    lowPrice: "1000",
    highPrice: "1500",
    offerCount: "3",
  },
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(pricingSchema) }}
      />
      <CleanPricingExperience />
    </>
  );
}
