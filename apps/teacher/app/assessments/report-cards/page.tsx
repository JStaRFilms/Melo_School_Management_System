"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";

type ReportCardResponse = {
  schoolName: string;
  sessionName: string;
  termName: string;
  className: string;
  generatedAt: number;
  student: {
    _id: string;
    name: string;
    admissionNumber: string;
    gender: string | null;
    dateOfBirth: number | null;
    guardianName: string | null;
    guardianPhone: string | null;
    address: string | null;
    photoUrl: string | null;
  };
  summary: {
    totalSubjects: number;
    averageScore: number | null;
  };
  results: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string;
    ca1: number;
    ca2: number;
    ca3: number;
    examRawScore: number;
    examScaledScore: number;
    total: number;
    gradeLetter: string;
    remark: string;
  }>;
};

function formatDate(value: number | null) {
  if (!value) {
    return "Not provided";
  }

  return new Date(value).toLocaleDateString();
}

export default function TeacherReportCardPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const sessionId = searchParams.get("sessionId");
  const termId = searchParams.get("termId");

  const reportCard = useQuery(
    "functions/academic/reportCards:getStudentReportCard" as never,
    studentId && sessionId && termId
      ? ({ studentId, sessionId, termId } as never)
      : ("skip" as never)
  ) as ReportCardResponse | undefined;

  if (!studentId || !sessionId || !termId) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Select a student, session, and term before opening a report card.
        </div>
      </div>
    );
  }

  if (reportCard === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
        <div className="text-slate-500">Loading report card...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            Report Card
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {reportCard.student.name}
          </h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/assessments/exams/entry"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
          >
            Export / Print
          </button>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">{reportCard.schoolName}</p>
            <h2 className="text-3xl font-black tracking-tight text-slate-950">
              Student Report Card
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {reportCard.sessionName} • {reportCard.termName} • {reportCard.className}
            </p>
          </div>
          <div className="flex items-start gap-4">
            {reportCard.student.photoUrl ? (
              <img
                src={reportCard.student.photoUrl}
                alt={reportCard.student.name}
                className="h-24 w-24 rounded-2xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                No Photo
              </div>
            )}
            <div className="grid gap-2 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Admission No:</span> {reportCard.student.admissionNumber}</p>
              <p><span className="font-semibold text-slate-900">Gender:</span> {reportCard.student.gender ?? "Not provided"}</p>
              <p><span className="font-semibold text-slate-900">Date of Birth:</span> {formatDate(reportCard.student.dateOfBirth)}</p>
              <p><span className="font-semibold text-slate-900">Guardian:</span> {reportCard.student.guardianName ?? "Not provided"}</p>
              <p><span className="font-semibold text-slate-900">Phone:</span> {reportCard.student.guardianPhone ?? "Not provided"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 py-6 text-sm text-slate-600 md:grid-cols-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Address</p>
            <p className="mt-1">{reportCard.student.address ?? "Not provided"}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Subjects</p>
            <p className="mt-1">{reportCard.summary.totalSubjects}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Average Score</p>
            <p className="mt-1">
              {reportCard.summary.averageScore === null
                ? "Not available"
                : reportCard.summary.averageScore.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto py-6">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                <th className="border-b border-slate-200 px-3 py-3">Subject</th>
                <th className="border-b border-slate-200 px-3 py-3">CA1</th>
                <th className="border-b border-slate-200 px-3 py-3">CA2</th>
                <th className="border-b border-slate-200 px-3 py-3">CA3</th>
                <th className="border-b border-slate-200 px-3 py-3">Exam</th>
                <th className="border-b border-slate-200 px-3 py-3">Scaled</th>
                <th className="border-b border-slate-200 px-3 py-3">Total</th>
                <th className="border-b border-slate-200 px-3 py-3">Grade</th>
                <th className="border-b border-slate-200 px-3 py-3">Remark</th>
              </tr>
            </thead>
            <tbody>
              {reportCard.results.map((result) => (
                <tr key={result.subjectId} className="text-sm text-slate-700">
                  <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                    {result.subjectName} <span className="text-xs text-slate-400">({result.subjectCode})</span>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.ca1}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.ca2}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.ca3}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.examRawScore}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.examScaledScore.toFixed(2)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">{result.total.toFixed(2)}</td>
                  <td className="border-b border-slate-100 px-3 py-3 font-bold">{result.gradeLetter}</td>
                  <td className="border-b border-slate-100 px-3 py-3">{result.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-400">
          Generated on {new Date(reportCard.generatedAt).toLocaleString()}.
        </p>
      </section>
    </div>
  );
}
