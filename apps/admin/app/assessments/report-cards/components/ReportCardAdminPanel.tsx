"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { ReportCardSheetData } from "@school/shared";
import { SchoolLogoManagerCard } from "./SchoolLogoManagerCard";

function formatDateInputValue(value: number | null) {
  if (!value) return "";

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).getTime();
}

export function ReportCardAdminPanel({
  studentId,
  sessionId,
  termId,
  reportCard,
}: {
  studentId: string;
  sessionId: string;
  termId: string;
  reportCard: ReportCardSheetData;
}) {
  const saveComments = useMutation(
    "functions/academic/reportCards:saveStudentReportCardComments" as never
  );
  const saveNextTermBegins = useMutation(
    "functions/academic/reportCards:saveTermNextTermBegins" as never
  );

  const [classTeacherComment, setClassTeacherComment] = useState(
    reportCard.classTeacherComment ?? ""
  );
  const [headTeacherComment, setHeadTeacherComment] = useState(
    reportCard.headTeacherComment ?? ""
  );
  const [nextTermBegins, setNextTermBegins] = useState(
    formatDateInputValue(reportCard.student.nextTermBegins)
  );
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [termError, setTermError] = useState<string | null>(null);
  const [termSuccess, setTermSuccess] = useState<string | null>(null);
  const [isSavingComments, setIsSavingComments] = useState(false);
  const [isSavingNextTerm, setIsSavingNextTerm] = useState(false);

  useEffect(() => {
    setClassTeacherComment(reportCard.classTeacherComment ?? "");
  }, [reportCard.classTeacherComment, studentId, sessionId, termId]);

  useEffect(() => {
    setHeadTeacherComment(reportCard.headTeacherComment ?? "");
  }, [reportCard.headTeacherComment, studentId, sessionId, termId]);

  useEffect(() => {
    setNextTermBegins(formatDateInputValue(reportCard.student.nextTermBegins));
  }, [reportCard.student.nextTermBegins, termId]);

  const handleSaveComments = async () => {
    setIsSavingComments(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await saveComments({
        studentId,
        sessionId,
        termId,
        classTeacherComment,
        headTeacherComment,
      } as never);
      setCommentSuccess("Comments saved for this student.");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Unable to save comments right now."
      );
    } finally {
      setIsSavingComments(false);
    }
  };

  const handleSaveNextTermBegins = async () => {
    setIsSavingNextTerm(true);
    setTermError(null);
    setTermSuccess(null);

    try {
      await saveNextTermBegins({
        termId,
        nextTermBegins: parseDateInputValue(nextTermBegins),
      } as never);
      setTermSuccess("Next-term start date saved for this term.");
    } catch (error) {
      setTermError(
        error instanceof Error
          ? error.message
          : "Unable to save the next-term start date."
      );
    } finally {
      setIsSavingNextTerm(false);
    }
  };

  return (
    <div
      className="rc-no-print mx-auto mb-5 max-w-5xl px-4 pt-6 md:px-6"
      style={{ fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}
    >
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
              Report Card Controls
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              Update Comments And Term Date
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              These controls stay in the admin panel only. Teacher and head
              teacher comments are saved per student, while the next-term start
              date applies to every student in the selected term.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="font-bold text-slate-900">{reportCard.student.name}</div>
            <div>{reportCard.className}</div>
            <div>
              {reportCard.sessionName} • {reportCard.termName}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
                Student Comments
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Save the comments exactly as you want them to appear on this
                student&apos;s report card.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Class Teacher&apos;s Comment
              </span>
              <textarea
                value={classTeacherComment}
                onChange={(event) => {
                  setClassTeacherComment(event.target.value);
                  setCommentError(null);
                  setCommentSuccess(null);
                }}
                rows={4}
                maxLength={1000}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter the class teacher's comment for this student"
              />
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">
                Head Teacher&apos;s Comment
              </span>
              <textarea
                value={headTeacherComment}
                onChange={(event) => {
                  setHeadTeacherComment(event.target.value);
                  setCommentError(null);
                  setCommentSuccess(null);
                }}
                rows={4}
                maxLength={1000}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter the head teacher's comment for this student"
              />
            </label>

            {commentError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {commentError}
              </div>
            ) : null}
            {commentSuccess ? (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {commentSuccess}
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveComments}
                disabled={isSavingComments}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingComments ? "Saving comments..." : "Save comments"}
              </button>
            </div>
          </section>

          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-700">
                  Next Term Begins
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  This date is shared across every report card in the selected
                  term.
                </p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Next-term start date
                </span>
                <input
                  type="date"
                  value={nextTermBegins}
                  onChange={(event) => {
                    setNextTermBegins(event.target.value);
                    setTermError(null);
                    setTermSuccess(null);
                  }}
                  className="h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <p className="mt-3 text-xs text-slate-500">
                Leave the field empty if you want the exported report card to show
                a dash for now.
              </p>

              {termError ? (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {termError}
                </div>
              ) : null}
              {termSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {termSuccess}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNextTermBegins}
                  disabled={isSavingNextTerm}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingNextTerm ? "Saving date..." : "Save date"}
                </button>
              </div>
            </section>

            <SchoolLogoManagerCard
              schoolName={reportCard.schoolName}
              schoolLogoUrl={reportCard.schoolLogoUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
