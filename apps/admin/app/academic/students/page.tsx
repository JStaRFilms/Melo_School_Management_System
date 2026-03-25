"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

import {
  humanNameFinalStrict,
  humanNameTypingStrict,
} from "@/human-name";

import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { FloatingNotice } from "./components/FloatingNotice";
import { StudentCreationForm } from "./components/StudentCreationForm";
import { StudentProfileEditor } from "./components/StudentProfileEditor";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import type {
  ClassSummary,
  EnrollmentMatrix,
  EnrollmentNotice,
  SessionSummary,
} from "./components/types";

export default function StudentsPage() {
  const classes = useQuery(
    "functions/academic/academicSetup:listClasses" as never
  ) as ClassSummary[] | undefined;
  const sessions = useQuery(
    "functions/academic/academicSetup:listSessions" as never
  ) as SessionSummary[] | undefined;

  const createStudent = useMutation(
    "functions/academic/studentEnrollment:createStudent" as never
  );
  const setStudentSubjectSelections = useMutation(
    "functions/academic/studentEnrollment:setStudentSubjectSelections" as never
  );

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<EnrollmentNotice | null>(null);

  const studentFormRef = useRef<HTMLElement>(null);
  const studentNameInputRef = useRef<HTMLInputElement>(null);

  const matrix = useQuery(
    "functions/academic/studentEnrollment:getClassStudentSubjectMatrix" as never,
    selectedClassId && selectedSessionId
      ? ({ classId: selectedClassId, sessionId: selectedSessionId } as never)
      : ("skip" as never)
  ) as EnrollmentMatrix | undefined;

  useEffect(() => {
    if (!sessions || selectedSessionId) {
      return;
    }

    const activeSession = sessions.find((session) => session.isActive);
    if (activeSession) {
      setSelectedSessionId(activeSession._id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (!matrix?.students.length) {
      setSelectedStudentId(null);
      return;
    }

    setSelectedStudentId((current) =>
      current && matrix.students.some((student) => student._id === current)
        ? current
        : matrix.students[0]?._id ?? null
    );
  }, [matrix]);

  const selectedClassName =
    classes?.find((classDoc) => classDoc._id === selectedClassId)?.name ??
    "Select Class";
  const activeSessionName =
    sessions?.find((session) => session._id === selectedSessionId)?.name ??
    sessions?.find((session) => session.isActive)?.name ??
    "No active session";

  const matrixSummary = useMemo(() => {
    if (!matrix) {
      return {
        studentsWithNoSubjects: 0,
        totalStudents: 0,
        totalSubjects: 0,
      };
    }

    return {
      studentsWithNoSubjects: matrix.students.filter(
        (student) => student.selectedSubjectIds.length === 0
      ).length,
      totalStudents: matrix.students.length,
      totalSubjects: matrix.subjects.length,
    };
  }, [matrix]);

  const focusStudentForm = useCallback(() => {
    if (!selectedClassId) {
      setNotice({
        tone: "error",
        message: "Select a class first, then add the student.",
      });
      return;
    }

    studentFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      studentNameInputRef.current?.focus();
    }, 120);
  }, [selectedClassId]);

  const handleCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedStudentName = humanNameFinalStrict(studentName);

    if (!selectedClassId || !normalizedStudentName || !admissionNumber.trim()) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      await createStudent({
        name: normalizedStudentName,
        admissionNumber: admissionNumber.trim(),
        classId: selectedClassId,
      } as never);
      setStudentName("");
      setAdmissionNumber("");
      setNotice({
        tone: "success",
        message: `${normalizedStudentName} was added to ${selectedClassName}.`,
      });
      studentNameInputRef.current?.focus();
    } catch (err) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          err,
          "We couldn't add the student right now."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleSetStudentSubjects = useCallback(
    async (studentId: string, subjectIds: string[]) => {
      if (!selectedClassId || !selectedSessionId || !matrix) {
        return;
      }

      const student = matrix.students.find((entry) => entry._id === studentId);
      if (!student) {
        return;
      }

      setNotice(null);

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds,
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

  if (classes === undefined || sessions === undefined) {
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
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Student Enrollment
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Manage the class subject matrix without the extra noise.
            </h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Use the live matrix for <span className="font-semibold text-slate-700">{activeSessionName}</span>.
              Subject ticks save instantly, so there is nothing separate to
              commit at the bottom of the page.
            </p>
          </div>
          <button
            type="button"
            onClick={focusStudentForm}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 transition hover:bg-indigo-700"
          >
            Add Student
          </button>
        </div>
      </header>

      <EnrollmentFilters
        classes={classes}
        sessions={sessions}
        selectedClassId={selectedClassId}
        selectedSessionId={selectedSessionId}
        onClassChange={setSelectedClassId}
        onSessionChange={setSelectedSessionId}
      />

      {selectedClassId ? (
        <StudentCreationForm
          selectedClassName={selectedClassName}
          studentName={studentName}
          admissionNumber={admissionNumber}
          isSubmitting={isSubmitting}
          sectionRef={studentFormRef}
          inputRef={studentNameInputRef}
          onStudentNameChange={(value) =>
            setStudentName(humanNameTypingStrict(value))
          }
          onStudentNameBlur={(value) =>
            setStudentName(humanNameFinalStrict(value))
          }
          onAdmissionNumberChange={setAdmissionNumber}
          onSubmit={handleCreateStudent}
        />
      ) : null}

      {selectedClassId && selectedSessionId ? (
        <SubjectSelectionMatrix
          matrix={matrix}
          totalStudents={matrixSummary.totalStudents}
          totalSubjects={matrixSummary.totalSubjects}
          isIssueVisible={matrixSummary.studentsWithNoSubjects > 0}
          studentsWithNoSubjects={matrixSummary.studentsWithNoSubjects}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          onToggle={(studentId, subjectId) => {
            void handleToggleSubject(studentId, subjectId);
          }}
          onSetStudentSubjects={(studentId, subjectIds) => {
            void handleSetStudentSubjects(studentId, subjectIds);
          }}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
          Select a class and session to load the enrollment grid.
        </section>
      )}

      <StudentProfileEditor
        studentId={selectedStudentId}
        classes={classes}
        onNotice={setNotice}
      />
    </div>
  );
}
