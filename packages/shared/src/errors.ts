const LEADING_ERROR_METADATA = /^(?:\[[^\]]+\]\s*)+/i;
const CONVEX_ERROR_LABEL = /^(?:Server Error\s*)?(?:Uncaught\s+)?(?:ConvexError:\s*)?/i;
const CONVEX_ERROR_DETAILS = /ConvexError:\s*([\s\S]*?)(?:\s+Called by client|\n\s*at\s+|$)/i;
const CLIENT_SUFFIX = /\s*Called by client$/i;

function cleanRawErrorMessage(value: string): string {
  return value
    .replace(LEADING_ERROR_METADATA, "")
    .replace(CONVEX_ERROR_LABEL, "")
    .replace(CLIENT_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (typeof error === "string" && error.trim()) {
    const cleaned = cleanRawErrorMessage(error);
    return cleaned && cleaned !== "Server Error" ? cleaned : fallbackMessage;
  }

  if (error && typeof error === "object") {
    const errorData = (error as { data?: unknown }).data;
    if (typeof errorData === "string" && errorData.trim()) {
      const cleanedData = cleanRawErrorMessage(errorData);
      if (cleanedData && cleanedData !== "Server Error") {
        return cleanedData;
      }
    } else if (
      errorData &&
      typeof errorData === "object" &&
      "message" in errorData &&
      typeof (errorData as { message?: unknown }).message === "string"
    ) {
      const msg = (errorData as { message: string }).message;
      const cleanedDataMsg = cleanRawErrorMessage(msg);
      if (cleanedDataMsg && cleanedDataMsg !== "Server Error") {
        return cleanedDataMsg;
      }
    }
  }

  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const convexErrorDetails = error.message.match(CONVEX_ERROR_DETAILS);
  const messageSource = convexErrorDetails?.[1] ?? error.message;
  const cleanedMessage = cleanRawErrorMessage(messageSource);

  return cleanedMessage && cleanedMessage !== "Server Error"
    ? cleanedMessage
    : fallbackMessage;
}

