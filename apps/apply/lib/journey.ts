export function applicationPath(schoolSlug: string, publicReference: string) {
  return `/s/${encodeURIComponent(schoolSlug)}/applications/${encodeURIComponent(publicReference)}`;
}

export function paymentStatusCopy(state: string) {
  if (state === "paid") return "Payment confirmed. Your application slot is ready.";
  if (state === "manual_attention") return "Your payment needs a check. We cannot make an application slot available yet.";
  return "We are confirming your payment. A payment start does not reserve a school place.";
}

export function applicationStatusCopy(state: string, conversionState?: string | null) {
  if (conversionState === "succeeded") return "The school has completed its internal record setup.";
  if (conversionState) return "The school is preparing its internal records.";
  if (state === "accepted") return "The school recorded an acceptance decision.";
  if (state === "changes_requested") return "The school asked you to update the items below.";
  return "Your application status is available here.";
}
