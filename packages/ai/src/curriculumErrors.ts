function readGenerationErrorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (!error || typeof error !== "object" || !("data" in error)) return "";
  const data = (error as { data?: unknown }).data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

export function toCurriculumGenerationFailure(error: unknown) {
  const errorText = readGenerationErrorText(error);
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
