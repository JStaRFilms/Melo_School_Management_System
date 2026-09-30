import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../../_generated/dataModel";
import { getLessonSourceContextIssue } from "../lessonKnowledgeSourceContext";

const ids = {
  subject: "subject-a" as Id<"subjects">,
  otherSubject: "subject-b" as Id<"subjects">,
  topic: "topic-a" as Id<"knowledgeTopics">,
  otherTopic: "topic-b" as Id<"knowledgeTopics">,
  class: "class-a" as Id<"classes">,
  otherClass: "class-b" as Id<"classes">,
};

const planningContext = {
  subjectId: ids.subject,
  level: "JSS 1",
  topicId: ids.topic,
  classId: ids.class,
};

function source(
  overrides: Partial<
    Pick<
      Doc<"knowledgeMaterials">,
      "subjectId" | "level" | "topicId" | "sourceType" | "visibility"
    >
  > = {}
) {
  return {
    subjectId: ids.subject,
    level: "jss 1",
    topicId: ids.topic,
    sourceType: "file_upload" as const,
    visibility: "private_owner" as const,
    ...overrides,
  };
}

describe("lesson source planning-context compatibility", () => {
  it.each([
    {
      label: "subject",
      source: source({ subjectId: ids.otherSubject }),
      issue: "The selected source does not match the current subject or level.",
    },
    {
      label: "explicit subject on an imported curriculum",
      source: source({ subjectId: ids.otherSubject, sourceType: "imported_curriculum" }),
      issue: "The selected source does not match the current subject or level.",
    },
    {
      label: "level",
      source: source({ level: "JSS 2" }),
      issue: "The selected source does not match the current subject or level.",
    },
    {
      label: "subjectless source at a different level",
      source: source({ subjectId: undefined, level: "JSS 2", sourceType: "imported_curriculum" }),
      issue: "The selected source does not match the current subject or level.",
    },
    {
      label: "topic",
      source: source({ topicId: ids.otherTopic }),
      issue: "The selected source is attached to a different topic.",
    },
    {
      label: "subjectless non-broad source at the same topic",
      source: source({ subjectId: undefined }),
      issue: "The selected source does not match the current subject or level.",
    },
    {
      label: "subjectless non-broad source at a different topic",
      source: source({ subjectId: undefined, topicId: ids.otherTopic }),
      issue: "The selected source does not match the current subject or level.",
    },
  ])("rejects a mismatched $label with an actionable issue", ({ source: candidate, issue }) => {
    expect(getLessonSourceContextIssue({ source: candidate, planningContext })).toBe(issue);
  });

  it("rejects a class-scoped source that does not include the planning class", () => {
    expect(
      getLessonSourceContextIssue({
        source: source({ subjectId: undefined, sourceType: "imported_curriculum", visibility: "class_scoped" }),
        planningContext,
        classAccess: { matchedClassIds: [ids.otherClass] },
      })
    ).toBe("The selected source is not available for the current class.");
  });

  it("accepts matching sources and subjectless broad curriculum sources at the planning level", () => {
    expect(getLessonSourceContextIssue({ source: source(), planningContext })).toBeNull();
    expect(getLessonSourceContextIssue({ source: source({ subjectId: undefined, sourceType: "imported_curriculum" }), planningContext })).toBeNull();
    expect(
      getLessonSourceContextIssue({
        source: source({ subjectId: undefined, sourceType: "imported_curriculum", topicId: ids.otherTopic }),
        planningContext,
      })
    ).toBeNull();
    expect(
      getLessonSourceContextIssue({
        source: source({ sourceType: "imported_curriculum", topicId: ids.otherTopic }),
        planningContext,
      })
    ).toBeNull();
  });
});
