import {
  APICallError,
  InvalidPromptError,
  LoadAPIKeyError,
  LoadSettingError,
  NoContentGeneratedError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";

export type DocumentGenerationFailureKind =
  | "abort"
  | "configuration"
  | "invalid_output"
  | "invalid_prompt"
  | "rate_limit"
  | "timeout"
  | "transient_provider"
  | "unknown";

export interface NormalizedDocumentGenerationFailure {
  readonly kind: DocumentGenerationFailureKind;
  readonly message: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly reason?: string;
  readonly errorName?: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

export function normalizeDocumentGenerationFailure(
  error: unknown
): NormalizedDocumentGenerationFailure {
  if (isAbortError(error)) {
    return {
      kind: "abort",
      message: getErrorMessage(error),
      retryable: false,
      errorName: error.name,
    };
  }

  if (RetryError.isInstance(error)) {
    const retryError = error;
    const retryable = retryError.reason !== "abort";

    return {
      kind:
        retryError.reason === "abort"
          ? "abort"
          : retryError.reason === "maxRetriesExceeded"
            ? "transient_provider"
            : "unknown",
      message: getErrorMessage(retryError),
      retryable,
      reason: retryError.reason,
      errorName: retryError.name,
    };
  }

  if (APICallError.isInstance(error)) {
    const statusCode = error.statusCode;
    const kind =
      statusCode === 429
        ? "rate_limit"
        : statusCode === 408 || statusCode === 409
          ? "timeout"
          : statusCode != null && statusCode >= 500
            ? "transient_provider"
            : "configuration";

    return {
      kind,
      message: getErrorMessage(error),
      retryable: error.isRetryable,
      statusCode,
      errorName: error.name,
    };
  }

  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    NoContentGeneratedError.isInstance(error) ||
    TypeValidationError.isInstance(error)
  ) {
    return {
      kind: "invalid_output",
      message: getErrorMessage(error),
      retryable: true,
      errorName: error instanceof Error ? error.name : undefined,
    };
  }

  if (InvalidPromptError.isInstance(error)) {
    return {
      kind: "invalid_prompt",
      message: getErrorMessage(error),
      retryable: false,
      errorName: error.name,
    };
  }

  if (LoadAPIKeyError.isInstance(error) || LoadSettingError.isInstance(error)) {
    return {
      kind: "configuration",
      message: getErrorMessage(error),
      retryable: false,
      errorName: error.name,
    };
  }

  return {
    kind: "unknown",
    message: getErrorMessage(error),
    retryable: false,
    errorName: error instanceof Error ? error.name : undefined,
  };
}

export function shouldRetryDocumentGeneration(
  failure: NormalizedDocumentGenerationFailure
) {
  return failure.retryable;
}

export function getDocumentGenerationRetryDelayMs(
  failure: NormalizedDocumentGenerationFailure,
  attempt: number
) {
  if (!failure.retryable) {
    return 0;
  }

  const normalizedAttempt = Math.max(1, attempt);
  const baseDelayMs =
    failure.kind === "rate_limit"
      ? 2_000
      : failure.kind === "timeout"
        ? 1_500
        : 1_000;

  return Math.min(30_000, baseDelayMs * 2 ** (normalizedAttempt - 1));
}
