const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

const SENSITIVE_MESSAGE_PATTERNS = [
  /\b(token|secret|password|credential|authorization|bearer)\b/i,
  /\b(stack trace|traceback|sql|database|convex internal)\b/i,
  /\b(api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token)\b/i,
];

function isSafeUserMessage(message: string): boolean {
  const trimmed = message.trim();

  if (trimmed.length === 0 || trimmed.length > 240) {
    return false;
  }

  if (trimmed.includes("\n") || trimmed.includes("{")) {
    return false;
  }

  return !SENSITIVE_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getErrorMessage(
  error: unknown,
  fallback = DEFAULT_ERROR_MESSAGE,
): string {
  if (typeof error === "string") {
    return isSafeUserMessage(error) ? error.trim() : fallback;
  }

  if (error instanceof Error) {
    return isSafeUserMessage(error.message) ? error.message.trim() : fallback;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return isSafeUserMessage(error.message) ? error.message.trim() : fallback;
  }

  return fallback;
}
