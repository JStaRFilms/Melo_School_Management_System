import { describe, expect, it } from "vitest";
import {
  buildSelectionQueryParams,
  parseSelectionParams,
  SELECTION_CASCADE,
} from "../examSelection";

describe("exam selection params (consolidation P21)", () => {
  it("clears downstream keys on upstream change", () => {
    expect(SELECTION_CASCADE.sessionId).toEqual(["termId", "classId", "subjectId"]);
    expect(SELECTION_CASCADE.termId).toEqual(["classId", "subjectId"]);
    expect(SELECTION_CASCADE.classId).toEqual(["subjectId"]);
    expect(SELECTION_CASCADE.subjectId).toEqual([]);
  });

  it("round-trips parse and build", () => {
    expect(parseSelectionParams("sessionId=s&termId=t&classId=c&subjectId=j")).toEqual({
      sessionId: "s",
      termId: "t",
      classId: "c",
      subjectId: "j",
    });
    expect(parseSelectionParams("")).toEqual({
      sessionId: null,
      termId: null,
      classId: null,
      subjectId: null,
    });
  });

  it("sets, unsets, and cascades", () => {
    const full = "sessionId=s&termId=t&classId=c&subjectId=j";
    expect(buildSelectionQueryParams(full, "sessionId", null)).toEqual({
      query: "",
      next: { sessionId: null, termId: null, classId: null, subjectId: null },
    });
    expect(buildSelectionQueryParams(full, "termId", null)).toEqual({
      query: "sessionId=s",
      next: { sessionId: "s", termId: null, classId: null, subjectId: null },
    });
    expect(buildSelectionQueryParams("sessionId=s", "termId", "t")).toEqual({
      query: "sessionId=s&termId=t",
      next: { sessionId: "s", termId: "t", classId: null, subjectId: null },
    });
    expect(buildSelectionQueryParams("", "classId", "c")).toEqual({
      query: "classId=c",
      next: { sessionId: null, termId: null, classId: "c", subjectId: null },
    });
  });
});
