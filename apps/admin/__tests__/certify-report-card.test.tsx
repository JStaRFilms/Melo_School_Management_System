import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CertifyReportCard } from "../app/assessments/report-cards/components/CertifyReportCard";
import type { Id } from "../../../packages/convex/_generated/dataModel";
import type { ReportCardSheetData } from "@school/shared";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  certify: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: () => mocks.certify,
}));
vi.mock("@school/shared/exam-recording", () => ({
  reportCardReviewKey: () => "review-key-1",
}));

const schoolId = "school-1" as Id<"schools">;

function buildReportCard(
  overrides: Partial<ReportCardSheetData> = {},
): ReportCardSheetData {
  return {
    schoolName: "Demo Academy",
    sessionName: "2025/2026",
    termName: "Third Term",
    classId: "class-1",
    className: "Primary 4",
    generatedAt: 0,
    assessmentConfig: {
      ca1Max: 20,
      ca2Max: 20,
      ca3Max: 20,
      examMax: 40,
    },
    gradingPolicy: {
      source: "current",
      version: 2,
      bands: [
        { gradeLetter: "A", minScore: 70, maxScore: 100, remark: "Excellent" },
      ],
    },
    student: {
      _id: "student-1",
      name: "Ada Obi",
      displayName: "Ada Obi",
      firstName: "Ada",
      lastName: "Obi",
      admissionNumber: "ADM/001",
      gender: null,
      dateOfBirth: null,
      guardianName: null,
      guardianPhone: null,
      address: null,
      houseName: null,
      nextTermBegins: null,
      photoUrl: null,
    },
    summary: {
      totalSubjects: 1,
      recordedSubjects: 1,
      pendingSubjects: 0,
      averageScore: 85,
      totalScore: 85,
    },
    results: [
      {
        subjectId: "subj-math",
        subjectName: "Mathematics",
        subjectCode: "MTH",
        ca1: 18,
        ca2: 17,
        ca3: 15,
        examScore: 35,
        total: 85,
        gradeLetter: "A",
        remark: "Excellent",
        isRecorded: true,
        calculationMode: "standalone",
        isCumulativeComplete: true,
        missingHistoricalTerms: [],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue(true);
});

describe("CertifyReportCard", () => {
  it("explains pending standalone scores (with zero placeholders) and links to score entry even when admission number matches", () => {
    const reportCard = buildReportCard({
      assessmentConfig: {
        ca1Max: 20,
        ca2Max: 20,
        ca3Max: 0,
        examMax: 60,
      },
      summary: {
        totalSubjects: 2,
        recordedSubjects: 1,
        pendingSubjects: 1,
        averageScore: 85,
        totalScore: 85,
      },
      results: [
        buildReportCard().results[0],
        {
          subjectId: "subj-eng",
          subjectName: "English Language",
          subjectCode: "ENG",
          ca1: 0,
          ca2: 0,
          ca3: 0,
          examScore: 0,
          total: 0,
          gradeLetter: "-",
          remark: "Pending",
          isRecorded: false,
          calculationMode: "standalone",
          isCumulativeComplete: false,
          missingHistoricalTerms: ["current"],
        },
      ],
    });

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={reportCard}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "ADM/001" },
    });

    expect(
      screen.getByRole("button", { name: "Confirm certification" }),
    ).toBeDisabled();
    expect(
      screen.getByText("Why certification is currently disabled"),
    ).toBeInTheDocument();
    expect(screen.getByText("English Language")).toBeInTheDocument();
    expect(screen.getByText(/missing CA1, CA2, Exam/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Complete scores" }),
    ).toHaveAttribute(
      "href",
      "/assessments/results/entry?sessionId=session-1&termId=term-1&classId=class-1&studentId=student-1&subjectId=subj-eng",
    );
    expect(
      screen.queryByText(/Admission number does not match/),
    ).not.toBeInTheDocument();
  });

  it("links calculated subjects to their editable component subjects instead of the umbrella subject", () => {
    const reportCard = buildReportCard({
      summary: {
        totalSubjects: 1,
        recordedSubjects: 0,
        pendingSubjects: 1,
        averageScore: 0,
        totalScore: 0,
      },
      results: [
        {
          subjectId: "subj-bst-umbrella",
          subjectName: "Basic Science & Technology",
          subjectCode: "BST",
          ca1: 0,
          ca2: 0,
          ca3: 0,
          examScore: 0,
          total: 0,
          gradeLetter: "-",
          remark: "Pending",
          isRecorded: false,
          pendingComponentSubjects: [
            { subjectId: "subj-bs", subjectName: "Basic Science" },
            { subjectId: "subj-ict", subjectName: "ICT" },
          ],
          calculationMode: "standalone",
          isCumulativeComplete: false,
          missingHistoricalTerms: [],
        },
      ],
    });

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={reportCard}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "ADM/001" },
    });

    expect(
      screen.getByRole("button", { name: "Confirm certification" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Basic Science" }),
    ).toHaveAttribute(
      "href",
      "/assessments/results/entry?sessionId=session-1&termId=term-1&classId=class-1&studentId=student-1&subjectId=subj-bs",
    );
    expect(screen.getByRole("link", { name: "ICT" })).toHaveAttribute(
      "href",
      "/assessments/results/entry?sessionId=session-1&termId=term-1&classId=class-1&studentId=student-1&subjectId=subj-ict",
    );
    expect(
      screen.queryByRole("link", { name: "Complete scores" }),
    ).not.toBeInTheDocument();
  });

  it("omits prior-term backfill messaging when cumulative subjects only miss the current term score", () => {
    const reportCard = buildReportCard({
      resultCalculationMode: "cumulative_annual",
      summary: {
        totalSubjects: 1,
        recordedSubjects: 0,
        pendingSubjects: 1,
        averageScore: 0,
        totalScore: 0,
      },
      results: [
        {
          ...buildReportCard().results[0],
          ca1: 0,
          ca2: 0,
          ca3: 0,
          examScore: 0,
          total: 0,
          isRecorded: false,
          calculationMode: "cumulative_annual",
          firstTermTotal: 78,
          secondTermTotal: 81,
          currentTermTotal: null,
          isCumulativeComplete: false,
          missingHistoricalTerms: ["current"],
        },
      ],
    });

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={reportCard}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "ADM/001" },
    });

    expect(
      screen.getByRole("button", { name: "Confirm certification" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Complete scores" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Missing prior-term totals/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Historical backfill" }),
    ).not.toBeInTheDocument();
  });

  it("distinguishes admission-number mismatch, missing prior-term totals, and unversioned grading policy", () => {
    const reportCard = buildReportCard({
      gradingPolicy: { source: "current", version: 0, bands: [] },
      resultCalculationMode: "cumulative_annual",
      results: [
        {
          ...buildReportCard().results[0],
          calculationMode: "cumulative_annual",
          isCumulativeComplete: false,
          missingHistoricalTerms: ["first", "second"],
        },
      ],
    });

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={reportCard}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "ADM/999" } });

    expect(
      screen.getByRole("button", { name: "Confirm certification" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Open grading bands setup" }),
    ).toHaveAttribute("href", "/assessments/setup/grading-bands");
    expect(
      screen.getByText(/missing First Term, Second Term/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Historical backfill" }),
    ).toHaveAttribute(
      "href",
      "/assessments/report-cards/backfill?sessionId=session-1&classId=class-1",
    );
    expect(
      screen.getByRole("link", { name: "Manual adjustments" }),
    ).toHaveAttribute(
      "href",
      "/assessments/report-cards/manual-adjustments?sessionId=session-1&termId=term-1&classId=class-1&studentId=student-1",
    );
    expect(
      screen.getByText(/Admission number does not match ADM\/001 exactly/),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Focus admission number" }),
    );
    expect(input).toHaveFocus();
  });

  it("explains unavailable historical grading evidence outside report output and hides certification submission", () => {
    const reportCard = buildReportCard({
      gradingPolicy: { source: "historical_missing", version: 0, bands: [] },
    });

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={reportCard}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    expect(
      screen.getByText(
        "Certification blocked: historical grading policy unavailable",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Complete historical grading recovery/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm certification" }),
    ).not.toBeInTheDocument();
  });

  it("shows saving progress during certification and links to Class result release after success", async () => {
    let resolveCertify!: (value: number) => void;
    mocks.certify.mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveCertify = resolve;
        }),
    );

    render(
      <CertifyReportCard
        schoolId={schoolId}
        reportCard={buildReportCard()}
        sessionId="session-1"
        termId="term-1"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "ADM/001" },
    });
    const button = screen.getByRole("button", {
      name: "Confirm certification",
    });
    expect(button).toBeEnabled();
    expect(
      screen.queryByText("Why certification is currently disabled"),
    ).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(
      screen.getByText("Saving certified report card..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Certifying…" })).toBeDisabled();

    resolveCertify(1700000000000);

    await waitFor(() =>
      expect(
        screen.getByText(/does not publish it to parents/i),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "Open Class result release" }),
    ).toHaveAttribute(
      "href",
      "/assessments/report-cards/release?sessionId=session-1&termId=term-1&classId=class-1",
    );
    expect(mocks.certify).toHaveBeenCalledWith({
      schoolId,
      studentId: "student-1",
      classId: "class-1",
      sessionId: "session-1",
      termId: "term-1",
      confirmation: "ADM/001",
      reviewedKey: "review-key-1",
    });
  });
});
