import type { Doc, Id } from "../../_generated/dataModel";
import type { KnowledgeClassScopedStaffAccess } from "./lessonKnowledgeAccess";

type LessonSourceContextScope = Pick<
  Doc<"knowledgeMaterials">,
  "subjectId" | "level" | "topicId" | "sourceType" | "visibility"
>;

type LessonPlanningContextScope = {
  classId: Id<"classes">;
  subjectId: Id<"subjects">;
  level: string;
  topicId: Id<"knowledgeTopics">;
};

export function levelMatchesLessonKnowledgeScope(levelA: string, levelB: string) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return normalize(levelA) === normalize(levelB);
}

export function getLessonSourceContextIssue(args: {
  source: LessonSourceContextScope;
  planningContext?: LessonPlanningContextScope | null;
  classAccess?: Pick<KnowledgeClassScopedStaffAccess, "matchedClassIds"> | null;
}): string | null {
  const { source, planningContext, classAccess } = args;
  if (!planningContext) return null;

  if (
    String(source.subjectId) !== String(planningContext.subjectId) ||
    !levelMatchesLessonKnowledgeScope(source.level, planningContext.level)
  ) {
    return "The selected source does not match the current subject or level.";
  }

  if (
    source.topicId &&
    String(source.topicId) !== String(planningContext.topicId) &&
    source.sourceType !== "imported_curriculum"
  ) {
    return "The selected source is attached to a different topic.";
  }

  if (
    source.visibility === "class_scoped" &&
    !classAccess?.matchedClassIds.some(
      (classId) => String(classId) === String(planningContext.classId)
    )
  ) {
    return "The selected source is not available for the current class.";
  }

  return null;
}
