import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { privateReviewEnabled } from "../../../core/private-review";
import "../../../renderers/obhis-v1/styles.css";

export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata {
  return {
    title: privateReviewEnabled() ? "Olive Blessed Crest Academy | Private homepage review" : "Private review unavailable",
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function ObhisReviewPage() {
  // Keep the development-only imports behind the production compile-time gate.
  if (process.env.NODE_ENV !== "development" || !privateReviewEnabled()) notFound();
  const [{ obhisReviewFixture }, { findPrivateReviewRenderer }] = await Promise.all([
    import("../../../core/obhis-review-fixture"),
    import("../../../core/renderer-registry"),
  ]);
  const renderer = findPrivateReviewRenderer(obhisReviewFixture.rendererKey, obhisReviewFixture.schemaVersion);
  if (!renderer) notFound();
  return <renderer.Homepage context={obhisReviewFixture} />;
}
