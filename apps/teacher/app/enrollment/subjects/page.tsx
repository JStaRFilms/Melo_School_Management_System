"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BookOpen, ShieldAlert, Sparkles, Users } from "lucide-react";
import { appToast, getErrorMessage } from "@school/shared/toast";

import { humanNameFinalStrict } from "@/lib/human-name";
import { TeacherHeader } from "@/lib/components/ui/TeacherHeader";
import { StatGroup } from "@/lib/components/ui/StatGroup";

import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import type {
  ClassSummary,
  EnrollmentMatrix,
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

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds: nextSubjectIds,
        } as never);
        appToast.success("Subject selection saved", {
          id: `teacher-subject-selection-${studentId}`,
          description: `Saved subject updates for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (error) {
        appToast.error("Unable to update subject selection", {
          id: `teacher-subject-selection-${studentId}`,
          description: getErrorMessage(
            error,
            "We couldn't update the subject selection right now."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  const handleSetStudentSubjects = useCallback(
    async (studentId: string, subjectIds: string[]) => {
      if (!selectedClassId || !selectedSessionId || !matrix) {
        return;
      }

      const student = matrix.students.find((entry) => entry._id === studentId);
      if (!student) {
        return;
      }

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds,
        } as never);
        appToast.success("Subject selection saved", {
          id: `teacher-subject-selection-${studentId}`,
          description: `Saved subject updates for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (error) {
        appToast.error("Unable to update subject selection", {
          id: `teacher-subject-selection-${studentId}`,
          description: getErrorMessage(
            error,
            "We couldn't update the subject selection right now."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  if (sessions === undefined || classes === undefined) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-8 animate-pulse space-y-8">
        <div className="h-24 w-1/3 rounded-2xl bg-slate-100" />
        <div className="h-20 rounded-2xl bg-slate-50" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] space-y-8 p-3 sm:p-5 lg:p-6">
      <div className="space-y-8">
        <TeacherHeader
          label="Enrollment"
          title="Subject Selection"
          description={`Manage subject enrollments for ${selectedClassName}. Your updates are live and save instantly to the academic records.`}
        />

        <StatGroup
          stats={[
            {
              label: "Total Students",
              value: matrix?.students.length ?? 0,
              icon: <Users />,
            },
            {
              label: "Subjects Offered",
              value: matrix?.subjects.length ?? 0,
              icon: <BookOpen />,
            },
            {
              label: "Action Needed",
              value: studentsWithNoSubjects,
              icon: <ShieldAlert />,
              description: studentsWithNoSubjects === 1 ? "Student" : "Students",
              className: studentsWithNoSubjects > 0 ? "border-amber-200 bg-amber-50/50" : "",
            },
            {
              label: "Active Session",
              value: selectedSessionName,
              icon: <Sparkles />,
            },
          ]}
        />

        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <EnrollmentFilters
            classes={classes}
            sessions={sessions}
            selectedClassId={selectedClassId}
            selectedSessionId={selectedSessionId}
            onClassChange={setSelectedClassId}
            onSessionChange={setSelectedSessionId}
          />
        </div>
      </div>

      <div className="pt-2">
        {selectedClassId && selectedSessionId ? (
          <SubjectSelectionMatrix
            matrix={matrix}
            studentsWithNoSubjects={studentsWithNoSubjects}
            onToggle={(studentId, subjectId) => {
              void handleToggleSubject(studentId, subjectId);
            }}
            onSetStudentSubjects={(studentId, subjectIds) => {
              void handleSetStudentSubjects(studentId, subjectIds);
            }}
          />
        ) : (
          <section className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-300">
              No Context Selected
            </p>
            <p className="mt-2 text-sm font-medium text-slate-400">
              Select a class and session above to view the enrollment matrix.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
