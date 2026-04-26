import { describe, expect, it } from "vitest";
import {
  buildTeacherLessonPlanHref,
  parseTeacherLessonPlanSourceIds,
} from "../planning-routes";

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
});
