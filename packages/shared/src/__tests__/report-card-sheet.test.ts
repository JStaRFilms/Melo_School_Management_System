import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ReportCardSheet,
  type ReportCardSheetData,
} from "../components/ReportCardSheet";

function buildCumulativeReportCard(): ReportCardSheetData {
  return {
    schoolName: "Test Academy",
    sessionName: "2025/2026 Academic Session",
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
    resultCalculationMode: "cumulative_annual",
    student: {
      _id: "student-1",
      name: "Test Student",
      displayName: "Test Student",
      firstName: "Test",
      lastName: "Student",
      admissionNumber: "TEST/001",
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
      averageScore: 80,
      totalScore: 80,
    },
    results: [
      {
        subjectId: "subject-1",
        subjectName: "Basic Science & Technology",
        subjectCode: "BST",
        ca1: 18,
        ca2: 17,
        ca3: 20,
        examScore: 35,
        total: 90,
        gradeLetter: "A",
        remark: "Excellent",
        isRecorded: true,
        calculationMode: "standalone",
        currentTermTotal: 90,
        firstTermTotal: null,
        secondTermTotal: null,
        annualAverage: null,
        isCumulativeComplete: true,
        missingHistoricalTerms: [],
      },
    ],
  };
}

describe("ReportCardSheet cumulative layout", () => {
  it("omits internal mode labels and stacks narrow assessment headings", () => {
    const markup = renderToStaticMarkup(
      createElement(ReportCardSheet, {
        reportCard: buildCumulativeReportCard(),
        backHref: "/report-cards",
      })
    );

    expect(markup).not.toContain("Standalone");
    expect(markup).not.toContain("In cumulative annual mode");
    expect(markup).toContain("flex-direction:column");
    expect(markup).toContain("CA1</span><span");
    expect(markup).toContain("(20%)");
    expect(markup).toContain("Exam</span><span");
    expect(markup).toContain("Total</span><span");
  });

  it("keeps the print-blocking warning for incomplete cumulative rows", () => {
    const reportCard = buildCumulativeReportCard();
    reportCard.results[0] = {
      ...reportCard.results[0],
      calculationMode: "cumulative_annual",
      isCumulativeComplete: false,
      missingHistoricalTerms: ["first"],
    };

    const markup = renderToStaticMarkup(
      createElement(ReportCardSheet, {
        reportCard,
        backHref: "/report-cards",
      })
    );

    const warningMatch = markup.match(
      /<div data-testid="incomplete-cumulative-warning"[^>]*>[\s\S]*?<\/div>/
    );
    expect(warningMatch).not.toBeNull();
    expect(warningMatch![0]).not.toContain("rc-no-print");
    expect(warningMatch![0]).toContain(
      "Rows marked * are missing prior-term scores. The annual grade is incomplete until those scores are entered."
    );
  });

  it("uses the school bundle name or Additional Assessment instead of Report Card Extras", () => {
    const singleBundle = buildCumulativeReportCard();
    singleBundle.extras = [
      {
        bundleId: "bundle-1",
        bundleName: "Conduct & Skills",
        sections: [
          {
            sectionId: "sec-1",
            sectionLabel: "Affective Domain",
            items: [{ fieldId: "f-1", label: "Punctuality", type: "scale", printValue: "Excellent" }],
          },
        ],
      },
    ];
    const singleMarkup = renderToStaticMarkup(
      createElement(ReportCardSheet, { reportCard: singleBundle, backHref: "/" })
    );
    expect(singleMarkup).toContain("Conduct &amp; Skills");
    expect(singleMarkup).not.toContain("Report Card Extras");

    const genericNamed: ReportCardSheetData = {
      ...singleBundle,
      extras: [{ ...singleBundle.extras[0], bundleName: "Report Card Extras" }],
    };
    const genericMarkup = renderToStaticMarkup(
      createElement(ReportCardSheet, { reportCard: genericNamed, backHref: "/" })
    );
    expect(genericMarkup).toContain("Additional Assessment");
    expect(genericMarkup).not.toContain("Report Card Extras");
  });
});

it("renders custom snapshot colors and omits internal grading-policy version footers", () => {
  const report = buildCumulativeReportCard();
  report.results[0].gradeLetter = "OUT";
  report.gradingPolicy = {
    source: "snapshot",
    version: 7,
    bands: [
      {
        gradeLetter: "OUT",
        minScore: 0,
        maxScore: 100,
        remark: "Recorded",
        colorHex: "#7c2d12",
      },
    ],
  };
  const markup = renderToStaticMarkup(
    createElement(ReportCardSheet, { reportCard: report, backHref: "/" })
  );
  expect(markup).toContain("#7c2d12");
  expect(markup).not.toContain("Certified grading policy v7");
  expect(markup).not.toContain("Current grading policy");
  expect(markup).not.toContain("Uncertified preview");
  expect(markup).toContain("rc-grade");
  expect(markup).toContain("OUT");

  const currentPreview: ReportCardSheetData = {
    ...report,
    gradingPolicy: { source: "current", version: 0, bands: report.gradingPolicy.bands },
  };
  const currentMarkup = renderToStaticMarkup(
    createElement(ReportCardSheet, { reportCard: currentPreview, backHref: "/" })
  );
  expect(currentMarkup).toContain("Uncertified preview");
  expect(currentMarkup).not.toContain("Current grading policy");
  expect(currentMarkup).not.toContain("v0");
  expect(currentMarkup).toContain("#7c2d12");

  const historicalMissing: ReportCardSheetData = {
    ...report,
    gradingPolicy: { source: "historical_missing", version: 0, bands: [] },
  };
  const historicalMarkup = renderToStaticMarkup(
    createElement(ReportCardSheet, {
      reportCard: historicalMissing,
      backHref: "/",
    })
  );
  expect(historicalMarkup).not.toContain("#7c2d12");
  expect(historicalMarkup).not.toContain("Historical grading policy unavailable");
  expect(historicalMarkup).not.toContain("without policy colors");
  expect(historicalMarkup).toContain("90");
  expect(historicalMarkup).toContain("OUT");
  expect(historicalMarkup).toContain("Excellent");

  const withoutPolicy: ReportCardSheetData = { ...report };
  delete withoutPolicy.gradingPolicy;
  const oldMarkup = renderToStaticMarkup(
    createElement(ReportCardSheet, { reportCard: withoutPolicy, backHref: "/" })
  );
  expect(oldMarkup).not.toContain("#7c2d12");
  expect(oldMarkup).not.toContain("Historical grading policy unavailable");
  expect(oldMarkup).not.toContain("without policy colors");
  expect(oldMarkup).toContain("90");
  expect(oldMarkup).toContain("OUT");
  expect(oldMarkup).toContain("Excellent");

  const printMarkup = renderToStaticMarkup(
    createElement(ReportCardSheet, {
      reportCard: historicalMissing,
      backHref: "/",
      hideToolbar: true,
    })
  );
  expect(printMarkup).not.toContain("Historical grading policy unavailable");
  expect(printMarkup).not.toContain("without policy colors");
  expect(printMarkup).toContain("OUT");
});
