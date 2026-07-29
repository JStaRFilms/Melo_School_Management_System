import { v } from "convex/values";

export const applicationAvailabilityValidator = v.union(
  v.literal("open"),
  v.literal("upcoming"),
  v.literal("paused"),
  v.literal("closed"),
  v.literal("unavailable")
);

export const applicationLinkV1Validator = v.object({
  version: v.literal("1"),
  schoolSlug: v.string(),
  href: v.string(),
  availability: applicationAvailabilityValidator,
  intakeSlug: v.union(v.string(), v.null()),
  opensAt: v.union(v.number(), v.null()),
  closesAt: v.union(v.number(), v.null()),
});

export const admissionsPermissionValidator = v.union(
  v.literal("settings.view"),
  v.literal("settings.manage"),
  v.literal("site.preview"),
  v.literal("site.publish.standard"),
  v.literal("site.publish.sensitive"),
  v.literal("site.revert"),
  v.literal("site.domain.request"),
  v.literal("admissions.catalogue.manage"),
  v.literal("admissions.publish"),
  v.literal("admissions.sensitive.configure"),
  v.literal("privacy.approve"),
  v.literal("retention.manage"),
  v.literal("grants.manage"),
  v.literal("applications.list"),
  v.literal("applications.view_basic"),
  v.literal("applications.view_sensitive"),
  v.literal("documents.review"),
  v.literal("documents.download"),
  v.literal("reviews.assign"),
  v.literal("reviews.record"),
  v.literal("decisions.record"),
  v.literal("conversions.execute"),
  v.literal("audit.view")
);

export const capabilityScopeValidator = v.union(
  v.literal("school"),
  v.literal("programme"),
  v.literal("intake")
);

export const capabilityGrantProjectionValidator = v.object({
  capability: admissionsPermissionValidator,
  scope: capabilityScopeValidator,
  programmeId: v.union(v.id("admissionsProgrammes"), v.null()),
  intakeId: v.union(v.id("admissionsIntakes"), v.null()),
});

export const applicationStateValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("changes_requested"),
  v.literal("under_review"),
  v.literal("waitlisted"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("withdrawn"),
  v.literal("archived")
);

export const admissionsDecisionStateValidator = v.union(
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("waitlisted")
);

export const admissionsPurchaseStateValidator = v.union(
  v.literal("created"),
  v.literal("checkout_pending"),
  v.literal("verification_pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("manual_attention"),
  v.literal("refunded"),
  v.literal("reversed"),
  v.literal("voided"),
  v.literal("chargeback"),
  v.literal("disputed")
);

export const admissionsEntitlementStateValidator = v.union(
  v.literal("available"),
  v.literal("reserved"),
  v.literal("consumed"),
  v.literal("expired"),
  v.literal("refunded"),
  v.literal("revoked")
);

export const admissionsDocumentStateValidator = v.union(
  v.literal("pending_upload"),
  v.literal("uploaded"),
  v.literal("quarantined"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("superseded"),
  v.literal("deleted")
);

export const admissionsDataClassValidator = v.union(
  v.literal("public"),
  v.literal("internal"),
  v.literal("personal"),
  v.literal("child_confidential"),
  v.literal("highly_sensitive"),
  v.literal("financial_security")
);

export const admissionsProviderValidator = v.union(
  v.literal("paystack"),
  v.literal("flutterwave"),
  v.literal("stripe"),
  v.literal("manual")
);

export const paymentProviderModeValidator = v.union(v.literal("test"), v.literal("live"));

export const siteLinkIntentValidator = v.union(
  v.object({ kind: v.literal("admissions_info") }),
  v.object({ kind: v.literal("application"), intakeSlug: v.optional(v.string()) }),
  v.object({ kind: v.literal("portal") }),
  v.object({ kind: v.literal("contact") }),
  v.object({ kind: v.literal("visit") }),
  v.object({ kind: v.literal("reviewed_external"), linkId: v.string() })
);

export const siteFieldValueValidator = v.union(
  v.object({ kind: v.literal("text"), value: v.string() }),
  v.object({ kind: v.literal("rich_text"), value: v.string() }),
  v.object({ kind: v.literal("boolean"), value: v.boolean() }),
  v.object({ kind: v.literal("link_intent"), value: siteLinkIntentValidator }),
  v.object({ kind: v.literal("asset_ref"), assetId: v.id("schoolSiteAssets") }),
  // Semantic identifiers and public-media references are deliberately distinct.
  // A renderer cannot reinterpret an editable list of strings as asset IDs.
  v.object({ kind: v.literal("asset_list"), assetIds: v.array(v.id("schoolSiteAssets")) }),
  v.object({ kind: v.literal("string_list"), value: v.array(v.string()) })
);

export const siteRevisionContentValidator = v.object({
  fields: v.array(v.object({ fieldId: v.string(), value: siteFieldValueValidator })),
  routeSeo: v.array(
    v.object({
      routeId: v.string(),
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      shareAssetId: v.optional(v.id("schoolSiteAssets")),
    })
  ),
});

/** Metadata-only output. Storage IDs and signed URLs are intentionally absent. */
export const documentAccessResultValidator = v.union(
  v.object({
    status: v.literal("available"),
    documentKey: v.string(),
    url: v.string(),
    expiresAt: v.union(v.number(), v.null()),
  }),
  v.object({ status: v.literal("unavailable"), documentKey: v.string() })
);

export const freshAuthAssuranceValidator = v.object({
  authenticatedAt: v.number(),
  assuranceLevel: v.union(v.literal("standard"), v.literal("fresh")),
});
