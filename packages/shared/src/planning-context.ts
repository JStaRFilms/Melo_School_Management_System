export type PlanningWorkspaceRoute = "lesson-plans" | "question-bank";
export type PlanningContextKind = "topic" | "exam_scope";
export type PlanningExamScopeKind = "full_subject_term" | "topic_subset";
export type PlanningAssessmentMode = "practice_quiz" | "class_test" | "exam_draft";
export type PlanningLessonOutputType = "lesson_plan" | "student_note" | "assignment";

export interface TopicPlanningContextInput {
  kind: "topic";
  classId: string;
  termId: string;
  subjectId: string;
  level: string;
  topicId: string;
}

export interface ExamPlanningContextInput {
  kind: "exam_scope";
  classId: string;
  termId: string;
  subjectId: string;
  level: string;
  scopeKind: PlanningExamScopeKind;
  topicIds?: string[];
}

export type PlanningContextInput = TopicPlanningContextInput | ExamPlanningContextInput;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeIdList(values: string[] | undefined) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function normalizePlanningTopicIds(values: string[] | undefined) {
  return normalizeIdList(values).sort();
}

export function buildTopicPlanningContextKey(args: {
  classId: string;
  termId: string;
  subjectId: string;
  level: string;
  topicId: string;
  outputType?: string;
  draftMode?: string;
}) {
  const level = normalizeText(args.level);
  const suffix = args.draftMode
    ? `mode:${args.draftMode}`
    : args.outputType
      ? `output:${args.outputType}`
      : "context";

  return [
    "topic",
    `subject:${args.subjectId.trim()}`,
    `class:${args.classId.trim()}`,
    `level:${level}`,
    `term:${args.termId.trim()}`,
    `topic:${args.topicId.trim()}`,
    suffix,
  ].join("|");
}

export function buildExamPlanningContextKey(args: {
  classId: string;
  termId: string;
  subjectId: string;
  level: string;
  draftMode?: string;
  outputType?: string;
  scopeKind: PlanningExamScopeKind;
  topicIds?: string[];
}) {
  const level = normalizeText(args.level);
  const topicIds = args.scopeKind === "topic_subset" ? normalizePlanningTopicIds(args.topicIds) : [];
  const topicsSegment = args.scopeKind === "topic_subset" ? topicIds.join(",") || "*" : "*";

  return [
    "exam",
    `subject:${args.subjectId.trim()}`,
    `class:${args.classId.trim()}`,
    `level:${level}`,
    `term:${args.termId.trim()}`,
    `scope:${args.scopeKind}`,
    `topics:${topicsSegment}`,
    `mode:${args.draftMode?.trim() || "exam_draft"}`,
    `output:${args.outputType?.trim() || "cbt_draft"}`,
  ].join("|");
}

export function buildTeacherPlanningWorkspaceHref(args: {
  route: PlanningWorkspaceRoute;
  sourceIds?: string[];
  sourceOrigin?: string;
  mode?: PlanningAssessmentMode;
  outputType?: PlanningLessonOutputType;
  context?: PlanningContextInput;
}) {
  const params = new URLSearchParams();
  const sourceIds = normalizeIdList(args.sourceIds);

  if (sourceIds.length > 0) {
    params.set("sourceIds", sourceIds.join(","));
    params.set("sourceOrigin", args.sourceOrigin ?? "library");
  }

  if (args.route === "question-bank" && args.mode) {
    params.set("mode", args.mode);
  }

  if (args.route === "lesson-plans" && args.outputType) {
    params.set("outputType", args.outputType);
  }

  if (args.context?.kind === "topic") {
    params.set("context", "topic");
    params.set("classId", args.context.classId);
    params.set("termId", args.context.termId);
    params.set("subjectId", args.context.subjectId);
    params.set("level", normalizeText(args.context.level));
    params.set("topicId", args.context.topicId);
  }

  if (args.context?.kind === "exam_scope") {
    params.set("context", "exam_scope");
    params.set("classId", args.context.classId);
    params.set("termId", args.context.termId);
    params.set("subjectId", args.context.subjectId);
    params.set("level", normalizeText(args.context.level));
    params.set("scopeKind", args.context.scopeKind);

    const topicIds = normalizePlanningTopicIds(args.context.topicIds);
    if (topicIds.length > 0) {
      params.set("topicIds", topicIds.join(","));
    }
  }

  const query = params.toString();
  return query ? `/planning/${args.route}?${query}` : `/planning/${args.route}`;
}

export function buildTeacherPlanningLibraryAttachHref(args: {
  returnTo: string;
  sourceIds?: string[];
}) {
  const safeReturnTo = args.returnTo.trim();
  if (!safeReturnTo.startsWith("/planning/")) {
    return "/planning/library";
  }

  const params = new URLSearchParams();
  const sourceIds = normalizeIdList(args.sourceIds);
  if (sourceIds.length > 0) {
    params.set("sourceIds", sourceIds.join(","));
  }
  params.set("returnTo", safeReturnTo);

  return `/planning/library?${params.toString()}`;
}

export function applyPlanningSourceIdsToReturnTo(returnTo: string, sourceIds: string[]) {
  const safeReturnTo = returnTo.trim();
  if (!safeReturnTo.startsWith("/planning/")) {
    return null;
  }

  const url = new URL(safeReturnTo, "https://planning.local");
  const normalizedSourceIds = normalizeIdList(sourceIds);

  if (normalizedSourceIds.length > 0) {
    url.searchParams.set("sourceIds", normalizedSourceIds.join(","));
    url.searchParams.set("sourceOrigin", "library");
  } else {
    url.searchParams.delete("sourceIds");
    url.searchParams.delete("sourceOrigin");
  }

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}

export function parsePlanningContextFromSearchParams(searchParams: URLSearchParams) {
  const context = searchParams.get("context");
  const classId = searchParams.get("classId")?.trim() ?? "";
  const termId = searchParams.get("termId")?.trim() ?? "";
  const subjectId = searchParams.get("subjectId")?.trim() ?? "";
  const level = normalizeText(searchParams.get("level") ?? "");

  if (context === "topic") {
    const topicId = searchParams.get("topicId")?.trim() ?? "";
    if (classId && termId && subjectId && level && topicId) {
      return {
        kind: "topic" as const,
        classId,
        termId,
        subjectId,
        level,
        topicId,
      };
    }
  }

  if (context === "exam_scope") {
    const scopeKind = searchParams.get("scopeKind") === "topic_subset"
      ? "topic_subset"
      : "full_subject_term";
    if (classId && termId && subjectId && level) {
      return {
        kind: "exam_scope" as const,
        classId,
        termId,
        subjectId,
        level,
        scopeKind,
        topicIds: normalizePlanningTopicIds((searchParams.get("topicIds") ?? "").split(",")),
      };
    }
  }

  return null;
}
