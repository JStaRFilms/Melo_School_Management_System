import { ConvexError, v, type Infer } from "convex/values";

// All money is integer minor units. Bands are whole-roster volume rates, not marginal tiers.
export const commercialRate = v.object({
  currency: v.string(),
  perStudentMinor: v.number(),
  setupMinor: v.number(),
  minimumMinor: v.number(),
  discountBps: v.number(),
  bands: v.array(
    v.object({ fromStudents: v.number(), perStudentMinor: v.number() }),
  ),
  cadence: v.union(v.literal("termly"), v.literal("annually")),
  proration: v.union(v.literal("none"), v.literal("daily")),
});
export type CommercialRate = Infer<typeof commercialRate>;
// Approved seed only; persisted versions, never this seed, price real contracts.
export const APPROVED_CORE_BASIC_RATE: CommercialRate = {
  currency: "NGN",
  perStudentMinor: 100000,
  setupMinor: 3000000,
  minimumMinor: 0,
  discountBps: 0,
  bands: [],
  cadence: "termly",
  proration: "none",
};
export function minor(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ConvexError("Amounts/counts must be nonnegative safe integers");
  return value;
}
export function validateRate(rate: CommercialRate) {
  if (!/^[A-Z]{3}$/.test(rate.currency))
    throw new ConvexError(
      "Use an uppercase three-letter currency; no currency conversion is performed",
    );
  [
    rate.perStudentMinor,
    rate.setupMinor,
    rate.minimumMinor,
    rate.discountBps,
  ].forEach(minor);
  if (rate.discountBps > 10000 || rate.bands.length > 20)
    throw new ConvexError("Invalid discount or too many bands");
  let previous = 0;
  for (const band of rate.bands) {
    minor(band.fromStudents);
    minor(band.perStudentMinor);
    if (band.fromStudents <= previous)
      throw new ConvexError(
        "Bands must have strictly increasing positive thresholds",
      );
    previous = band.fromStudents;
  }
}
export function priceSnapshot(
  rate: CommercialRate,
  count: number,
  numerator: number,
  denominator: number,
  includeSetup: boolean,
) {
  validateRate(rate);
  minor(count);
  minor(numerator);
  minor(denominator);
  if (!denominator || numerator > denominator)
    throw new ConvexError("Invalid proration period");
  const unit = rate.bands.reduce(
    (price, band) =>
      count >= band.fromStudents ? band.perStudentMinor : price,
    rate.perStudentMinor,
  );
  const subtotal = minor(Math.max(minor(count * unit), rate.minimumMinor));
  // Round half-up in integer arithmetic; intermediate products may exceed safe Number precision.
  const prorated = Number(
    (BigInt(subtotal) * BigInt(numerator) + BigInt(denominator) / BigInt(2)) /
      BigInt(denominator),
  );
  const discountMinor = Number(
    (BigInt(prorated) * BigInt(rate.discountBps) + BigInt(5000)) /
      BigInt(10000),
  );
  const setupMinor = includeSetup ? rate.setupMinor : 0;
  return {
    unitMinor: unit,
    subtotalMinor: subtotal,
    proratedMinor: prorated,
    discountMinor,
    setupMinor,
    totalMinor: minor(prorated - discountMinor + setupMinor),
  };
}
export function isBillableStudent(
  student: { isArchived?: boolean; enrollmentStatus?: string },
  user: { isArchived?: boolean; role: string } | null,
) {
  // Unclassified legacy students are excluded pending explicit enrollment review.
  return (
    !student.isArchived &&
    student.enrollmentStatus === "active" &&
    !!user &&
    !user.isArchived &&
    user.role === "student"
  );
}
export const COMMERCIAL_GATES = {
  purchase: "unavailable",
  recurringMandate: "unavailable",
  split: "unavailable",
  merchantConnection: "unverified",
  reason:
    "Provider, finance and legal approval required. No payment is initiated; no settlement schedule is promised.",
} as const;
