import { query } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { buildApplicationLinkV1 } from "@school/shared";
import { applicationLinkV1Validator } from "./contracts";

function configuredApplicationOrigin(): string {
  const origin = process.env.APPLICATION_ORIGIN?.trim() ?? process.env.APPLY_APP_ORIGIN?.trim();
  if (origin) return origin;
  // Local-only compatibility. Production deployment configuration must set an
  // explicit origin; site content never supplies one.
  if (process.env.NODE_ENV !== "production") return "http://localhost:3004";
  throw new Error("APPLICATION_ORIGIN must be configured in production");
}

function resolveAvailability(args: {
  schoolActive: boolean;
  intake: { status: string; opensAt: number; closesAt: number } | null;
  hasActiveProduct: boolean;
  now: number;
}) {
  if (!args.schoolActive || !args.intake || !args.hasActiveProduct) return "unavailable" as const;
  if (args.intake.status === "paused") return "paused" as const;
  if (args.intake.status === "closed" || args.intake.status === "archived" || args.now > args.intake.closesAt) {
    return "closed" as const;
  }
  if (args.intake.status !== "open") return "unavailable" as const;
  if (args.now < args.intake.opensAt) return "upcoming" as const;
  return "open" as const;
}

/**
 * The only public admissions-link resolver. It resolves a declared school/intake
 * record, never request host headers or editable URLs, and returns a harmless
 * unavailable projection for missing/disabled offerings.
 */
export const getApplicationLink = query({
  args: { schoolSlug: v.string(), intakeSlug: v.optional(v.string()) },
  returns: applicationLinkV1Validator,
  handler: async (ctx, args) => {
    const school = await ctx.db
      .query("schools")
      .withIndex("by_slug", (q) => q.eq("slug", args.schoolSlug.trim()))
      .unique();
    // Do not reflect arbitrary input into a route. Unknown/malformed slugs get
    // the same non-enumerating unavailable projection.
    const requestedSlug = args.schoolSlug.trim();
    const schoolSlug = school?.slug ?? (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(requestedSlug) ? requestedSlug : "unavailable");

    let intake = null;
    if (school && args.intakeSlug) {
      intake = await ctx.db
        .query("admissionsIntakes")
        .withIndex("by_school_and_slug", (q) =>
          q.eq("schoolId", school._id).eq("slug", args.intakeSlug!.trim())
        )
        .unique();
    } else if (school) {
      // A status alone is insufficient: an older record may still say `open`
      // after its close time. Resolve all bounded open candidates and choose a
      // currently valid, product-backed intake deterministically.
      const candidates = await ctx.db
        .query("admissionsIntakes")
        .withIndex("by_school_and_status_and_opens_at", (q) =>
          q.eq("schoolId", school._id).eq("status", "open")
        )
        .order("desc")
        .take(100);
      const candidatesWithProducts = [];
      for (const candidate of candidates) {
        const products = await ctx.db
          .query("admissionsProducts")
          .withIndex("by_intake_and_status", (q) =>
            q.eq("intakeId", candidate._id).eq("status", "active")
          )
          .take(1);
        if (products.length > 0) candidatesWithProducts.push(candidate);
      }

      const now = Date.now();
      const compareByOpenThenId = (left: typeof candidates[number], right: typeof candidates[number]) =>
        right.opensAt - left.opensAt || String(right._id).localeCompare(String(left._id));
      const current = candidatesWithProducts
        .filter((candidate) => candidate.opensAt <= now && candidate.closesAt >= now)
        .sort(compareByOpenThenId)[0];
      const upcoming = candidatesWithProducts
        .filter((candidate) => candidate.opensAt > now)
        .sort((left, right) => left.opensAt - right.opensAt || String(left._id).localeCompare(String(right._id)))[0];
      const recentlyClosed = candidatesWithProducts
        .filter((candidate) => candidate.closesAt < now)
        .sort((left, right) => right.closesAt - left.closesAt || String(right._id).localeCompare(String(left._id)))[0];
      intake = current ?? upcoming ?? recentlyClosed ?? null;
    }

    const activeProducts = intake
      ? await ctx.db
        .query("admissionsProducts")
        .withIndex("by_intake_and_status", (q) => q.eq("intakeId", intake!._id).eq("status", "active"))
        .take(1)
      : [];
    const now = Date.now();
    const prices = activeProducts[0]
      ? await ctx.db
        .query("admissionsProductPrices")
        .withIndex("by_product_and_status_and_effective_from", (q) =>
          q.eq("productId", activeProducts[0]._id).eq("status", "published")
        )
        .order("desc")
        .take(50)
      : [];
    const hasCurrentPrice = prices.some((price) =>
      price.schoolId === school?._id && price.effectiveFrom <= now && (!price.effectiveTo || price.effectiveTo > now)
    );
    const providerConfig: { provider: "paystack"; providerMode: "test" | "live" } | null = school
      ? await ctx.runQuery(
        (internal as any).functions.admissions.payments.getConfiguredAdmissionsPaymentProviderInternal,
        { schoolId: school._id }
      )
      : null;
    const availability = resolveAvailability({
      schoolActive: school?.status === "active",
      intake,
      hasActiveProduct: activeProducts.length > 0 && hasCurrentPrice && providerConfig !== null,
      now,
    });

    return buildApplicationLinkV1({
      applicationOrigin: configuredApplicationOrigin(),
      schoolSlug,
      availability,
      intakeSlug: intake?.slug ?? null,
      opensAt: intake?.opensAt ?? null,
      closesAt: intake?.closesAt ?? null,
    });
  },
});
