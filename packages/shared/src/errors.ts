const LEADING_ERROR_METADATA = /^(?:\[[^\]]+\]\s*)+/i;
const CONVEX_ERROR_LABEL = /^(?:Server Error\s*)?(?:Uncaught\s+)?(?:ConvexError:\s*)?/i;
const CONVEX_ERROR_DETAILS = /ConvexError:\s*([\s\S]*?)(?:\s+Called by client|\n\s*at\s+|$)/i;
const CLIENT_SUFFIX = /\s*Called by client$/i;

export function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const convexErrorDetails = error.message.match(CONVEX_ERROR_DETAILS);
  const messageSource = convexErrorDetails?.[1] ?? error.message;

  const cleanedMessage = messageSource
    .replace(LEADING_ERROR_METADATA, "")
    .replace(CONVEX_ERROR_LABEL, "")
    .replace(CLIENT_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedMessage || fallbackMessage;
}
