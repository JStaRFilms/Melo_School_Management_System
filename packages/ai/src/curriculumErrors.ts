import {
  APICallError,
  LoadAPIKeyError,
  LoadSettingError,
  NoContentGeneratedError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  RetryError,
  TypeValidationError,
} from "ai";

function readGenerationErrorText(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const structured = data as { errorMessage?: unknown; message?: unknown };
      if (typeof structured.errorMessage === "string") return structured.errorMessage;
      if (typeof structured.message === "string") return structured.message;
    }
  }
  return error instanceof Error && error.message ? error.message : "";
}

function unwrapProviderError(error: unknown): unknown {
  return RetryError.isInstance(error) ? unwrapProviderError(error.lastError) : error;
}

function readGenerationErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  if ("statusCode" in error && typeof error.statusCode === "number") return String(error.statusCode);
  if (!("data" in error)) return "";
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("errorCode" in data)) return "";
  return typeof data.errorCode === "string" ? data.errorCode : "";
}

export function toCurriculumGenerationFailure(error: unknown) {
  const errorText = readGenerationErrorText(error);
  const errorCode = readGenerationErrorCode(error);
  const providerError = unwrapProviderError(error);
  const providerStatus = APICallError.isInstance(providerError) ? providerError.statusCode : undefined;
  if (
    errorCode === "evidence_citation_invalid" ||
    errorText.includes("Generated curriculum evidence could not be matched") ||
    errorText.includes("Each proposed unit must cite matching extracted page evidence")
  ) {
    return {
      errorCode: "evidence_citation_invalid",
      errorMessage: "The model returned curriculum citations that could not be verified against the source. Try again or choose another model.",
    };
  }
  if (
    errorCode === "source_context_mismatch" ||
    errorText.includes("The source appears to cover")
  ) {
    return {
      errorCode: "source_context_mismatch",
      errorMessage: errorText || "The selected curriculum term does not match the source content.",
    };
  }
  if (
    errorCode === "provider_authentication_failed" ||
    providerStatus === 401 ||
    providerStatus === 403 ||
    LoadAPIKeyError.isInstance(providerError) ||
    LoadSettingError.isInstance(providerError)
  ) {
    return {
      errorCode: "provider_authentication_failed",
      errorMessage: "OpenRouter rejected the configured API key. Update OPENROUTER_API_KEY in the active Convex deployment.",
    };
  }
  if (errorCode === "provider_model_unavailable" || providerStatus === 404) {
    return {
      errorCode: "provider_model_unavailable",
      errorMessage: "The configured OpenRouter curriculum model is unavailable. Choose another SCHOOL_AI_CURRICULUM_MODEL.",
    };
  }
  if (errorCode === "provider_rate_limited" || providerStatus === 429) {
    return {
      errorCode: "provider_rate_limited",
      errorMessage: "OpenRouter temporarily rate-limited curriculum generation. Wait briefly, then try again.",
    };
  }
  if (errorCode === "provider_unavailable" || (providerStatus !== undefined && providerStatus >= 500)) {
    return {
      errorCode: "provider_unavailable",
      errorMessage: "OpenRouter is temporarily unavailable. Wait briefly, then try curriculum generation again.",
    };
  }
  if (
    errorCode === "provider_output_invalid" ||
    NoObjectGeneratedError.isInstance(providerError) ||
    NoOutputGeneratedError.isInstance(providerError) ||
    NoContentGeneratedError.isInstance(providerError) ||
    TypeValidationError.isInstance(providerError)
  ) {
    return {
      errorCode: "provider_output_invalid",
      errorMessage: "The selected model did not return a valid curriculum proposal. Try again or choose a model with structured-output support.",
    };
  }
  if (
    errorText.includes("No page-aware extracted source text is available") ||
    errorText.includes("No curriculum-ready source text was found")
  ) {
    return {
      errorCode: "source_evidence_unavailable",
      errorMessage: "No curriculum-ready source text was found. Reprocess the material or choose another indexed source.",
    };
  }
  return {
    errorCode: error instanceof Error && error.name ? error.name.slice(0, 80) : "generation_failed",
    errorMessage: "Curriculum proposal generation failed.",
  };
}
