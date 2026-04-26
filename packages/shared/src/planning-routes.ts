export type TeacherLessonPlanSourceLinkInput = {
  sourceIds: string[];
  sourceOrigin?: "library" | "manual" | string;
};

function normalizeSourceIds(sourceIds: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const sourceId of sourceIds) {
    const trimmed = sourceId.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function buildTeacherLessonPlanHref(args: TeacherLessonPlanSourceLinkInput) {
  const sourceIds = normalizeSourceIds(args.sourceIds);

  if (sourceIds.length === 0) {
    return undefined;
  }

  const params = new URLSearchParams();
  params.set("sourceIds", sourceIds.join(","));
  params.set("sourceOrigin", args.sourceOrigin ?? "library");

  return `/planning/lesson-plans?${params.toString()}`;
}

export function parseTeacherLessonPlanSourceIds(rawValue: string | null) {
  if (!rawValue) {
    return [];
  }

  return normalizeSourceIds(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}
