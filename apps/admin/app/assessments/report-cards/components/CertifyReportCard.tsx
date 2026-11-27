"use client";
import { reportCardReviewKey } from "@school/shared/exam-recording";
import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import type { ReportCardSheetData } from "@school/shared";

type ResultRow = ReportCardSheetData["results"][number];

const PRIOR_TERM_LABELS: Record<"first" | "second", string> = {
  first: "First Term",
  second: "Second Term",
};

function missingScoreComponents(
  result: ResultRow,
  config?: ReportCardSheetData["assessmentConfig"],
): string[] {
  const enabled: Array<{ label: string; value: number | null }> = [];
  if (!config || config.ca1Max > 0) enabled.push({ label: "CA1", value: result.ca1 });
  if (!config || config.ca2Max > 0) enabled.push({ label: "CA2", value: result.ca2 });
  if (!config || config.ca3Max > 0) enabled.push({ label: "CA3", value: result.ca3 });
  if (!config || config.examMax > 0) enabled.push({ label: "Exam", value: result.examScore });

  const nullFields = enabled
    .filter((entry) => entry.value === null)
    .map((entry) => entry.label);
  if (nullFields.length > 0) return nullFields;
  // Unsaved standalone rows carry zero placeholders until the score sheet is saved.
  return enabled.map((entry) => entry.label);
}

export function CertifyReportCard({
  reportCard,
  sessionId,
  termId,
  schoolId,
}: {
  reportCard: ReportCardSheetData;
  sessionId: string;
  termId: string;
  schoolId: Id<"schools">;
}) {
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    { schoolId, capability: "academic.report_cards.publish_final" },
  );
  const certify = useMutation(
    api.functions.academic.reportCards.certifyStudentReportCard,
  );
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [certifiedAtLocal, setCertifiedAtLocal] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const releaseHref = `/assessments/report-cards/release?${new URLSearchParams({
    sessionId,
    termId,
    classId: reportCard.classId,
  })}`;

  if (reportCard.certifiedAt || certifiedAtLocal) {
    return (
      <div className="rounded border border-slate-200 p-3 text-sm space-y-2">
        <p>
          Certified copy saved. Certification locks this student&apos;s report for
          staff review and printing, but does not publish it to parents.
          Printing and downloads preserve the issued scores, comments and
          grading policy.
        </p>
        <p>
          Next step:{" "}
          <Link href={releaseHref} className="font-semibold underline">
            Open Class result release
          </Link>{" "}
          to publish reviewed reports for this class and term.
        </p>
      </div>
    );
  }
  if (!allowed) return null;

  const isCurrentPolicy = reportCard.gradingPolicy?.source === "current";
  const hasUnversionedPolicy =
    isCurrentPolicy &&
    ((typeof reportCard.gradingPolicy?.version === "number" &&
      reportCard.gradingPolicy.version < 1) ||
      (Array.isArray(reportCard.gradingPolicy?.bands) &&
        reportCard.gradingPolicy.bands.length === 0));

  const incompleteScoreSubjects = reportCard.results.filter(
    (result) => !result.isRecorded,
  );
  const hasPendingScores =
    reportCard.summary.pendingSubjects > 0 || incompleteScoreSubjects.length > 0;

  const incompleteCumulativeSubjects = reportCard.results.filter(
    (result) =>
      result.calculationMode === "cumulative_annual" &&
      result.isCumulativeComplete === false,
  );
  const missingPriorTermSubjects = incompleteCumulativeSubjects.filter(
    (result) =>
      (result.missingHistoricalTerms ?? []).some(
        (term) => term === "first" || term === "second",
      ),
  );
  const otherIncompleteCumulativeSubjects = incompleteCumulativeSubjects.filter(
    (result) =>
      result.isRecorded &&
      !(result.missingHistoricalTerms ?? []).some(
        (term) => term === "first" || term === "second",
      ),
  );
  const hasCumulativeBlocker = incompleteCumulativeSubjects.length > 0;

  const admissionMatches = confirmation === reportCard.student.admissionNumber;
  const isDisabled =
    pending ||
    hasUnversionedPolicy ||
    hasPendingScores ||
    hasCumulativeBlocker ||
    !admissionMatches;

  const scoreEntryHref = (subjectId?: string) => {
    const params = new URLSearchParams({
      sessionId,
      termId,
      classId: reportCard.classId,
      studentId: reportCard.student._id,
    });
    if (subjectId) params.set("subjectId", subjectId);
    return `/assessments/results/entry?${params}`;
  };
  const backfillHref = `/assessments/report-cards/backfill?${new URLSearchParams({
    sessionId,
    classId: reportCard.classId,
  })}`;
  const manualAdjustmentsHref = `/assessments/report-cards/manual-adjustments?${new URLSearchParams({
    sessionId,
    termId,
    classId: reportCard.classId,
    studentId: reportCard.student._id,
  })}`;

  return (
    <details className="rounded border border-slate-200 p-3 text-sm space-y-3">
      <summary className="cursor-pointer font-semibold">
        Certify this report card
      </summary>
      <p>
        Save and review all scores, extras and comments first. Certification
        saves a fixed copy for staff review and printing, but does not publish
        it to parents. Families can see it only after Class result release.
        Later policy edits cannot replace a certified copy.
      </p>
      {!isCurrentPolicy ? (
        <div role="status" className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-950 space-y-1">
          <p className="font-semibold">
            Certification blocked: historical grading policy unavailable
          </p>
          {/* Historical grading recovery workflow is tracked in #142. */}
          <p>
            Historical records without an issued grading policy cannot be
            certified using today&apos;s policy. Complete historical grading
            recovery before certifying this report.
          </p>
        </div>
      ) : (
        <>
          <label htmlFor="certify-admission-number" className="block">
            Confirm admission number: {reportCard.student.admissionNumber}
            <input
              id="certify-admission-number"
              ref={inputRef}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              aria-describedby={
                isDisabled && !pending ? "certify-blockers" : undefined
              }
              className="mt-1 block max-w-full rounded border p-2"
            />
          </label>
          <button
            type="button"
            disabled={isDisabled}
            aria-describedby={
              isDisabled && !pending ? "certify-blockers" : undefined
            }
            className="rounded border p-2 disabled:opacity-40"
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const issuedAt = await certify({
                  schoolId,
                  studentId: reportCard.student._id as Id<"students">,
                  classId: reportCard.classId as Id<"classes">,
                  sessionId: sessionId as Id<"academicSessions">,
                  termId: termId as Id<"academicTerms">,
                  confirmation,
                  reviewedKey: reportCardReviewKey(reportCard),
                });
                setConfirmation("");
                setCertifiedAtLocal(
                  typeof issuedAt === "number" ? issuedAt : Date.now(),
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Certification failed",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Certifying…" : "Confirm certification"}
          </button>
          {pending ? (
            <p role="status" className="text-slate-700">
              Saving certified report card...
            </p>
          ) : isDisabled ? (
            <div
              id="certify-blockers"
              role="status"
              className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-950 space-y-2"
            >
              <p className="font-semibold">
                Why certification is currently disabled
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                {hasUnversionedPolicy && (
                  <li>
                    No saved grading policy version is active for this school.{" "}
                    <Link
                      href="/assessments/setup/grading-bands"
                      className="font-semibold underline"
                    >
                      Open grading bands setup
                    </Link>
                  </li>
                )}
                {incompleteScoreSubjects.length > 0 ? (
                  <li>
                    Incomplete current-term scores (
                    {incompleteScoreSubjects.length} subject
                    {incompleteScoreSubjects.length === 1 ? "" : "s"}):
                    <ul className="mt-1 list-disc pl-5 space-y-1">
                      {incompleteScoreSubjects.map((result) => {
                        const pendingComponents =
                          result.pendingComponentSubjects ?? [];
                        if (pendingComponents.length > 0) {
                          return (
                            <li key={result.subjectId}>
                              <span className="font-medium">
                                {result.subjectName}
                              </span>{" "}
                              (calculated subject; complete component scores:{" "}
                              {pendingComponents.map((component, index) => (
                                <span key={component.subjectId}>
                                  {index > 0 ? ", " : ""}
                                  <Link
                                    href={scoreEntryHref(component.subjectId)}
                                    className="font-semibold underline"
                                  >
                                    {component.subjectName}
                                  </Link>
                                </span>
                              ))}
                              )
                            </li>
                          );
                        }
                        const missing = missingScoreComponents(
                          result,
                          reportCard.assessmentConfig,
                        );
                        return (
                          <li key={result.subjectId}>
                            <span className="font-medium">
                              {result.subjectName}
                            </span>
                            {missing.length > 0
                              ? ` (missing ${missing.join(", ")})`
                              : " (scores not saved)"}{" "}
                            <Link
                              href={scoreEntryHref(result.subjectId)}
                              className="font-semibold underline"
                            >
                              Complete scores
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ) : hasPendingScores ? (
                  <li>
                    {reportCard.summary.pendingSubjects} subject
                    {reportCard.summary.pendingSubjects === 1 ? "" : "s"} still
                    need scores saved.{" "}
                    <Link
                      href={scoreEntryHref()}
                      className="font-semibold underline"
                    >
                      Open score entry
                    </Link>
                  </li>
                ) : null}
                {missingPriorTermSubjects.length > 0 && (
                  <li>
                    Missing prior-term totals for cumulative annual calculation (
                    {missingPriorTermSubjects.length} subject
                    {missingPriorTermSubjects.length === 1 ? "" : "s"}):
                    <ul className="mt-1 list-disc pl-5 space-y-1">
                      {missingPriorTermSubjects.map((result) => {
                        const missingTerms = (
                          result.missingHistoricalTerms ?? []
                        )
                          .filter(
                            (term): term is "first" | "second" =>
                              term === "first" || term === "second",
                          )
                          .map((term) => PRIOR_TERM_LABELS[term]);
                        return (
                          <li key={result.subjectId}>
                            <span className="font-medium">
                              {result.subjectName}
                            </span>
                            {missingTerms.length > 0
                              ? ` (missing ${missingTerms.join(", ")})`
                              : ""}
                          </li>
                        );
                      })}
                    </ul>
                    <span className="mt-1 flex flex-wrap gap-3">
                      <Link
                        href={backfillHref}
                        className="font-semibold underline"
                      >
                        Historical backfill
                      </Link>
                      <Link
                        href={manualAdjustmentsHref}
                        className="font-semibold underline"
                      >
                        Manual adjustments
                      </Link>
                    </span>
                  </li>
                )}
                {otherIncompleteCumulativeSubjects.length > 0 && (
                  <li>
                    Cumulative annual results are still incomplete for{" "}
                    {otherIncompleteCumulativeSubjects
                      .map((result) => result.subjectName)
                      .join(", ")}
                    .{" "}
                    <Link
                      href={manualAdjustmentsHref}
                      className="font-semibold underline"
                    >
                      Manual adjustments
                    </Link>
                  </li>
                )}
                {!admissionMatches && (
                  <li>
                    {confirmation.length === 0
                      ? `Enter ${reportCard.student.admissionNumber} to confirm this student.`
                      : `Admission number does not match ${reportCard.student.admissionNumber} exactly.`}{" "}
                    <button
                      type="button"
                      onClick={() => inputRef.current?.focus()}
                      className="font-semibold underline"
                    >
                      Focus admission number
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ) : null}
        </>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </details>
  );
}
