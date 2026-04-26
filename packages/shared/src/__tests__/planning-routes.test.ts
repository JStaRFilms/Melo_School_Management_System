import { describe, expect, it } from "vitest";
import {
  buildTeacherLessonPlanHref,
  parseTeacherLessonPlanSourceIds,
} from "../planning-routes";
import {
  applyPlanningSourceIdsToReturnTo,
  buildExamPlanningContextKey,
  buildTeacherPlanningLibraryAttachHref,
  buildTeacherPlanningWorkspaceHref,
  buildTopicPlanningContextKey,
  parsePlanningContextFromSearchParams,
} from "../planning-context";

describe("planning routes", () => {
  it("builds a deterministic lesson-plan handoff url", () => {
    expect(
      buildTeacherLessonPlanHref({
        sourceIds: [" material-b ", "material-a", "material-b"],
      })
    ).toBe("/planning/lesson-plans?sourceIds=material-b%2Cmaterial-a&sourceOrigin=library");
  });

  it("parses comma-separated source ids safely", () => {
    expect(
      parseTeacherLessonPlanSourceIds("material-b, material-a, , material-b")
    ).toEqual(["material-b", "material-a"]);
  });

  it("builds stable topic and exam context keys", () => {
    expect(
      buildTopicPlanningContextKey({
        classId: "class-1",
        termId: "term-1",
        subjectId: "subject-1",
        level: " JSS 1 ",
        topicId: "topic-1",
        outputType: "lesson_plan",
      })
    ).toBe("topic|subject:subject-1|class:class-1|level:JSS 1|term:term-1|topic:topic-1|output:lesson_plan");

    expect(
      buildExamPlanningContextKey({
        classId: "class-1",
        termId: "term-1",
        subjectId: "subject-1",
        level: "JSS 1",
        scopeKind: "topic_subset",
        topicIds: ["topic-b", "topic-a", "topic-b"],
      })
    ).toBe(
      "exam|subject:subject-1|class:class-1|level:JSS 1|term:term-1|scope:topic_subset|topics:topic-a,topic-b|mode:exam_draft|output:cbt_draft"
    );
  });

  it("builds attach-mode library urls and safely returns with source ids", () => {
    const href = buildTeacherPlanningLibraryAttachHref({
      returnTo: "/planning/question-bank?mode=exam_draft&context=exam_scope&classId=class-1",
      sourceIds: ["source-2", "source-1", "source-2"],
    });

    expect(href).toBe(
      "/planning/library?sourceIds=source-2%2Csource-1&returnTo=%2Fplanning%2Fquestion-bank%3Fmode%3Dexam_draft%26context%3Dexam_scope%26classId%3Dclass-1"
    );

    expect(
      applyPlanningSourceIdsToReturnTo(
        "/planning/question-bank?mode=exam_draft&context=exam_scope&classId=class-1",
        ["source-2", "source-1", "source-2"]
      )
    ).toBe(
      "/planning/question-bank?mode=exam_draft&context=exam_scope&classId=class-1&sourceIds=source-2%2Csource-1&sourceOrigin=library"
    );

    expect(applyPlanningSourceIdsToReturnTo("/admin", ["source-1"])).toBeNull();
  });

  it("builds and parses context-first planning urls", () => {
    const href = buildTeacherPlanningWorkspaceHref({
      route: "question-bank",
      mode: "exam_draft",
      context: {
        kind: "exam_scope",
        classId: "class-1",
        termId: "term-1",
        subjectId: "subject-1",
        level: "JSS 1",
        scopeKind: "topic_subset",
        topicIds: ["topic-b", "topic-a"],
      },
      sourceIds: ["source-1", "source-1", "source-2"],
    });

    expect(href).toBe(
      "/planning/question-bank?sourceIds=source-1%2Csource-2&sourceOrigin=library&mode=exam_draft&context=exam_scope&classId=class-1&termId=term-1&subjectId=subject-1&level=JSS+1&scopeKind=topic_subset&topicIds=topic-a%2Ctopic-b"
    );

    const parsed = parsePlanningContextFromSearchParams(
      new URL(href, "https://example.test").searchParams
    );

    expect(parsed).toEqual({
      kind: "exam_scope",
      classId: "class-1",
      termId: "term-1",
      subjectId: "subject-1",
      level: "JSS 1",
      scopeKind: "topic_subset",
      topicIds: ["topic-a", "topic-b"],
    });
  });
});
