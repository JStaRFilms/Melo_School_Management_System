"use client";
import { reportCardReviewKey } from "@school/shared/exam-recording";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import type { ReportCardSheetData } from "@school/shared";
import { useAuth } from "@/AuthProvider";

export function CertifyReportCard({
  reportCard,
  sessionId,
  termId,
}: {
  reportCard: ReportCardSheetData;
  sessionId: string;
  termId: string;
}) {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId
      ? { schoolId, capability: "academic.report_cards.publish_final" }
      : "skip",
  );
  const certify = useMutation(
    api.functions.academic.reportCards.certifyStudentReportCard,
  );
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (reportCard.certifiedAt)
    return (
      <p className="rounded border p-3 text-sm">
        Certified copy. Printing and downloads preserve the issued scores,
        comments and grading policy.
      </p>
    );
  if (!allowed) return null;
  return (
    <details className="rounded border border-slate-200 p-3 text-sm space-y-3">
      <summary className="cursor-pointer font-semibold">
        Certify this report card
      </summary>
      <p>
        Save and review all scores, extras and comments first. Certification
        creates an immutable issued copy used by Admin, Teacher and Portal
        previews, print and downloads. It cannot be replaced by later policy
        edits.
      </p>
      {reportCard.gradingPolicy?.source !== "current" ? (
        <p>
          Historical records without an issued policy cannot be certified using
          today’s policy.
        </p>
      ) : (
        <>
          <label className="block">
            Confirm admission number: {reportCard.student.admissionNumber}
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1 block max-w-full rounded border p-2"
            />
          </label>
          <button
            disabled={
              pending ||
              confirmation !== reportCard.student.admissionNumber ||
              reportCard.summary.pendingSubjects > 0
            }
            className="rounded border p-2 disabled:opacity-40"
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await certify({
                  studentId: reportCard.student._id as Id<"students">,
                  classId: reportCard.classId as Id<"classes">,
                  sessionId: sessionId as Id<"academicSessions">,
                  termId: termId as Id<"academicTerms">,
                  confirmation,
                  reviewedKey: reportCardReviewKey(reportCard),
                });
                setConfirmation("");
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
