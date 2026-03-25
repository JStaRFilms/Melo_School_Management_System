"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import { humanNameFinalStrict } from "@/lib/human-name";

import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { FloatingNotice } from "./components/FloatingNotice";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import type {
  ClassSummary,
  EnrollmentMatrix,
  EnrollmentNotice,
  SessionSummary,
} from "./components/types";

export default function TeacherSubjectSelectionPage() {
  const sessions = useQuery(
    "functions/academic/teacherSelectors:getTeacherSessions" as never
  ) as SessionSummary[] | undefined;
  const classes = useQuery(
    "functions/academic/teacherSelectors:getTeacherAssignableClasses" as never
  ) as ClassSummary[] | undefined;

  const setStudentSubjectSelections = useMutation(
    "functions/academic/studentEnrollment:setStudentSubjectSelections" as never
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [notice, setNotice] = useState<EnrollmentNotice | null>(null);

  const matrix = useQuery(
    "functions/academic/studentEnrollment:getClassStudentSubjectMatrix" as never,
    selectedClassId && selectedSessionId
      ? ({ classId: selectedClassId, sessionId: selectedSessionId } as never)
      : ("skip" as never)
  ) as EnrollmentMatrix | undefined;

  useEffect(() => {
    if (!selectedSessionId && sessions && sessions.length > 0) {
      setSelectedSessionId(sessions[0]._id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!selectedClassId && classes && classes.length > 0) {
      setSelectedClassId(classes[0]._id);
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const selectedClassName =
    classes?.find((classDoc) => classDoc._id === selectedClassId)?.name ??
    "Select Class";
  const selectedSessionName =
    sessions?.find((session) => session._id === selectedSessionId)?.name ??
    "Select Session";

  const studentsWithNoSubjects = useMemo(() => {
    if (!matrix) {
      return 0;
    }

    return matrix.students.filter(
      (student) => student.selectedSubjectIds.length === 0
    ).length;
  }, [matrix]);

  const handleToggleSubject = useCallback(
    async (studentId: string, subjectId: string) => {
      if (!selectedClassId || !selectedSessionId || !matrix) {
        return;
      }

      const student = matrix.students.find((entry) => entry._id === studentId);
      if (!student) {
        return;
      }

      const nextSubjectIds = student.selectedSubjectIds.includes(subjectId)
        ? student.selectedSubjectIds.filter((id) => id !== subjectId)
        : [...student.selectedSubjectIds, subjectId];

      setNotice(null);

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds: nextSubjectIds,
        } as never);
        setNotice({
          tone: "success",
          message: `Saved subject updates for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (err) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(
            err,
            "We couldn't update the subject selection right now."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  if (sessions === undefined || classes === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
      <FloatingNotice notice={notice} onDismiss={() => setNotice(null)} />

      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Teacher Subject Selection
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Edit the live class matrix, not a staged draft.
              </h1>
              <p className="max-w-3xl text-sm text-slate-500">
                You can update subject ticks for <span className="font-semibold text-slate-700">{selectedClassName}</span> in{" "}
                <span className="font-semibold text-slate-700">{selectedSessionName}</span>.
                Students are added by the admin; your edits save instantly.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="text-sm text-slate-500">
          Roster changes are admin-only. Your job here is just to keep each
          student&apos;s subject selection accurate.
        </p>
      </section>

      <EnrollmentFilters
        classes={classes}
        sessions={sessions}
        selectedClassId={selectedClassId}
        selectedSessionId={selectedSessionId}
        onClassChange={setSelectedClassId}
        onSessionChange={setSelectedSessionId}
      />

      {selectedClassId && selectedSessionId ? (
        <SubjectSelectionMatrix
          matrix={matrix}
          studentsWithNoSubjects={studentsWithNoSubjects}
          onToggle={(studentId, subjectId) => {
            void handleToggleSubject(studentId, subjectId);
          }}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Select a class and session to load the subject grid.
        </section>
      )}
    </div>
  );
}
