import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { computeDerivedValues, validateField } from "@/lib/exam-helpers";
import { RosterGrid } from "../components/RosterGrid";
import { scoreRowPolicy } from "@school/shared/exam-recording";

const policy = { ca1Max: 20, ca2Max: 20, ca3Max: 10, examRawMax: 80, examContributionMax: 50 };
describe("session score entry", () => {
  it("uses session maxima rather than the legacy /40 mode for validation and preview", () => {
    expect(validateField("ca3", 11, "raw40", policy)).toMatch(/10/);
    expect(validateField("examRawScore", 80, "raw40", policy)).toBeNull();
    expect(validateField("examRawScore", 81, "raw40", policy)).toMatch(/80/);
    expect(computeDerivedValues(20, 20, 10, 80, "raw40", [], policy)).toMatchObject({ examScaledScore: 50, total: 100 });
  });
  it("associates each mobile score input with its maximum label", () => {
    const { container } = render(<RosterGrid roster={[{ studentId: "student1", studentName: "Ada Doe", assessmentRecord: null } as never]} examInputMode="raw40" policy={policy} gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} onScoreChange={() => {}} />);
    for (const field of ["ca1", "ca2", "ca3", "exam"]) {
      const input = container.querySelector<HTMLInputElement>(`#mobile-student1-${field}`);
      expect(input).not.toBeNull();
      expect(container.querySelector(`label[for="mobile-student1-${field}"]`)).not.toBeNull();
      expect(input?.labels?.[0]?.textContent).toMatch(field === "exam" ? /80/ : field === "ca3" ? /10/ : /20/);
    }
  });
  it("uses each legacy row's recorded raw maximum instead of today's school mode", () => {
    const roster = [{ studentId: "student1", studentName: "Ada Doe", assessmentRecord: { examRawMaxSnapshot: 60, ca1: 20, ca2: 20, ca3: 20, examRawScore: 60 } } as never];
    const { container } = render(<RosterGrid roster={roster} examInputMode="raw40" gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} onScoreChange={() => {}} />);
    expect(container.querySelector<HTMLInputElement>("#mobile-student1-exam")?.max).toBe("60");
    expect(screen.getAllByText("40.00").length).toBeGreaterThan(0);
    expect(validateField("examRawScore", 59, "raw60_scaled_to_40")).toBeNull();
  });
  it("aligns mixed legacy desktop rows and uses imported custom weights", () => {
    const roster = [
      { studentId: "a", studentName: "Ada Doe", assessmentRecord: { examRawMaxSnapshot: 40, ca1: 20, ca2: 20, ca3: 20, examRawScore: 40 } },
      { studentId: "b", studentName: "Bea Doe", assessmentRecord: { examRawMaxSnapshot: 60, ca1: 20, ca2: 20, ca3: 20, examRawScore: 60 } },
      { studentId: "c", studentName: "Cal Doe", assessmentRecord: { examRawMaxSnapshot: 50, assessmentPolicySnapshot: { ca3Max: 10, examContributionMax: 50 }, ca1: 20, ca2: 20, ca3: 10, examRawScore: 50 } },
    ] as never;
    const { container } = render(<RosterGrid roster={roster} examInputMode="raw40" policy={{ ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 }} gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} onScoreChange={() => {}} />);
    expect(container.querySelector("thead th:nth-child(5)")?.textContent).toBe("Exam /row limit");
    const headers = container.querySelectorAll("thead th").length;
    expect(headers).toBe(9);
    for (const row of container.querySelectorAll("tbody tr")) expect(row.querySelectorAll("td")).toHaveLength(headers);
    expect(container.querySelector<HTMLInputElement>("#mobile-b-exam")?.max).toBe("60");
    expect(container.querySelector<HTMLInputElement>("#mobile-c-exam")?.max).toBe("50");
    expect(container.querySelector<HTMLInputElement>("#mobile-c-ca3")?.max).toBe("10");
    expect(screen.getAllByText("100.00").length).toBeGreaterThan(0);
    const weights = scoreRowPolicy("raw40", { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 }, { examRawMaxSnapshot: 50, assessmentPolicySnapshot: { ca3Max: 10, examContributionMax: 50 } });
    expect(validateField("examRawScore", 51, "raw40", weights)).toMatch(/50/);
    expect(validateField("ca3", 11, "raw40", weights)).toMatch(/10/);
    expect(validateField("examRawScore", 50, "raw40", weights)).toBeNull();
  });
  it("uses the current policy for a versioned saved row", () => {
    const record = { examRawMaxSnapshot: 40, sessionScoringPolicyVersion: 1, ca1: 20, ca2: 20, ca3: 10, examRawScore: 40 };
    const roster = [{ studentId: "student1", studentName: "Ada Doe", assessmentRecord: record }] as never;
    const { container } = render(<RosterGrid roster={roster} examInputMode="raw40" policy={policy} gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} onScoreChange={() => {}} />);
    expect(container.querySelector<HTMLInputElement>("#mobile-student1-exam")?.max).toBe("80");
    expect(container.querySelector("thead th:nth-child(5)")?.textContent).toBe("Exam /80");
    expect(validateField("examRawScore", 80, "raw40", scoreRowPolicy("raw40", policy, record))).toBeNull();
  });
  it("shows custom maximum labels on mobile and desktop", () => {
    render(<RosterGrid roster={[]} examInputMode="raw40" policy={policy} gradingBands={[]} draftScores={new Map()} validationErrors={new Map()} onScoreChange={() => {}} />);
    expect(screen.getByText(/Exam raw \/80 contributes \/50/)).toBeTruthy();
    expect(screen.getAllByText("/10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("/50").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Direct entry into final exam/)).toBeNull();
  });
});
