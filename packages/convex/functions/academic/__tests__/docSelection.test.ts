import { describe, expect, it } from "vitest";
import { pickMostRecentDoc } from "../docSelection";

describe("pickMostRecentDoc", () => {
  it("returns null for an empty list", () => {
    expect(pickMostRecentDoc([])).toBeNull();
  });

  it("prefers updatedAt over createdAt", () => {
    const older = { updatedAt: 100, createdAt: 500 };
    const newer = { updatedAt: 200, createdAt: 1 };
    expect(pickMostRecentDoc([older, newer])).toBe(newer);
    expect(pickMostRecentDoc([newer, older])).toBe(newer);
  });

  it("falls back to createdAt when updatedAt is missing", () => {
    const a = { createdAt: 10 };
    const b = { createdAt: 20 };
    expect(pickMostRecentDoc([a, b])).toBe(b);
  });

  it("treats missing timestamps as 0", () => {
    const missing = {};
    const dated = { createdAt: 1 };
    expect(pickMostRecentDoc([missing, dated])).toBe(dated);
    expect(pickMostRecentDoc([dated, missing])).toBe(dated);
    expect(pickMostRecentDoc([missing])).toBe(missing);
  });

  it("keeps the first doc on ties (strict >)", () => {
    const first = { updatedAt: 100 };
    const second = { updatedAt: 100 };
    const third = { createdAt: 100 };
    expect(pickMostRecentDoc([first, second])).toBe(first);
    expect(pickMostRecentDoc([first, third])).toBe(first);
  });

  it("picks the latest across an unordered list", () => {
    const docs = [
      { updatedAt: 30 },
      { updatedAt: 10 },
      { updatedAt: 50 },
      { updatedAt: 40 },
    ];
    expect(pickMostRecentDoc(docs)).toBe(docs[2]);
  });
});
