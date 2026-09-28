import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminRosterGrid } from "../app/assessments/results/entry/components/AdminRosterGrid";
import { computeDerivedValues, validateField } from "../lib/exam-helpers";
import { scoreRowPolicy } from "@school/shared/exam-recording";

const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 };
describe("admin session scoring", () => {
  it("validates raw /80, CA3 /10 and scales /80 to /50", () => {
    expect(validateField("examRawScore", 80, "raw40", policy)).toBeNull();
    expect(validateField("ca3", 11, "raw40", policy)).toMatch(/10/);
    expect(validateField("examRawScore", 81, "raw40", policy)).toMatch(/80/);
    expect(computeDerivedValues(20, 20, 10, 80, "raw40", [], policy)).toMatchObject({ examScaledScore: 50, total: 100 });
  });
  it("uses the recorded legacy maximum for a row even when the school mode is /40", () => {
    const roster = [{ studentId: "student1", studentName: "Ada Doe", assessmentRecord: { examRawMaxSnapshot: 60, ca1: 20, ca2: 20, ca3: 20, examRawScore: 60 } } as never];
    const { container } = render(<AdminRosterGrid roster={roster} examInputMode="raw40" gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} sheetLabel="Scores" sessionId="s" termId="t" classId="c" onScoreChange={() => {}} />);
    expect(container.querySelector<HTMLInputElement>('input[type="number"][max="60"]')).not.toBeNull();
    expect(screen.getAllByText("40.00").length).toBeGreaterThan(0);
  });
  it("keeps every desktop row aligned for mixed legacy modes and custom snapshots", () => {
    const roster = [
      { studentId: "a", studentName: "Ada Doe", assessmentRecord: { examRawMaxSnapshot: 40, ca1: 20, ca2: 20, ca3: 20, examRawScore: 40 } },
      { studentId: "b", studentName: "Bea Doe", assessmentRecord: { examRawMaxSnapshot: 60, ca1: 20, ca2: 20, ca3: 20, examRawScore: 60 } },
      { studentId: "c", studentName: "Cal Doe", assessmentRecord: { examRawMaxSnapshot: 50, assessmentPolicySnapshot: { ca3Max: 10, examContributionMax: 50 }, ca1: 20, ca2: 20, ca3: 10, examRawScore: 50 } },
    ] as never;
    const { container } = render(<AdminRosterGrid roster={roster} examInputMode="raw40" gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} sheetLabel="Scores" sessionId="s" termId="t" classId="c" onScoreChange={() => {}} />);
    const headers = container.querySelectorAll("thead th").length;
    expect(headers).toBe(8);
    for (const row of container.querySelectorAll("tbody tr")) expect(row.querySelectorAll("td")).toHaveLength(headers);
    expect(container.querySelector('tbody input[aria-label="Cal Doe exam score out of 50"]')).toHaveProperty("max", "50");
    expect(container.querySelector('tbody input[aria-label="Cal Doe CA3 score out of 10"]')).toHaveProperty("max", "10");
    expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    const weights = scoreRowPolicy("raw40", undefined, { examRawMaxSnapshot: 50, assessmentPolicySnapshot: { ca3Max: 10, examContributionMax: 50 } });
    expect(validateField("examRawScore", 51, "raw40", weights)).toMatch(/50/);
    expect(validateField("ca3", 11, "raw40", weights)).toMatch(/10/);
  });
  it("labels the desktop entry grid with session maxima", () => {
    render(<AdminRosterGrid roster={[]} examInputMode="raw40" policy={policy} gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} sheetLabel="Scores" sessionId="s" termId="t" classId="c" onScoreChange={() => {}} />);
    expect(screen.getByText("CONTRIB /10")).toBeTruthy();
    expect(screen.getByText("RECORDED /80")).toBeTruthy();
    expect(screen.getByText("SYSTEM /50")).toBeTruthy();
  });
});
