function readStructuredMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["errorMessage", "message", "error"]) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
    const nested = readStructuredMessage(candidate);
    if (nested) return nested;
  }
  return null;
}

function unwrapJsonMessage(value: string) {
  let current = value.trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!current.startsWith("{") && !current.startsWith('"')) break;
    try {
      const parsed = JSON.parse(current) as unknown;
      const nested = typeof parsed === "string" ? parsed : readStructuredMessage(parsed);
      if (!nested || nested === current) break;
      current = nested.trim();
    } catch {
      break;
    }
  }
  return current;
}

export function getCurriculumErrorMessage(value: unknown, fallback: string) {
  const raw = value instanceof Error
    ? value.message
    : typeof value === "string"
      ? value
      : readStructuredMessage(value);
  if (!raw) return fallback;
  const message = unwrapJsonMessage(raw)
    .replace(/^(?:Server Error\s*)?(?:Uncaught\s+)?ConvexError:\s*/i, "")
    .replace(/\s+Called by client[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return message || fallback;
}
