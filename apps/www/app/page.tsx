import type { Metadata } from "next";
import { buildPageMetadata, siteBrand, toJsonLd } from "@/site";
import { MeloCinemaExperience } from "../components/story/melo-cinema-experience";

export const metadata: Metadata = buildPageMetadata({
  title: "Melo — One School. One System.",
  description:
    "A school is one institution. Its information should behave like one system. Stop spending 3 days compiling results and chasing unverified fee payments.",
  path: "/",
});

const platformSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteBrand.name,
  description:
    "Unified operating system connecting academics, broadsheets, Paystack fee collection, parent visibility, and admissions for Nigerian schools.",
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
      <MeloCinemaExperience />
    </>
  );
}

