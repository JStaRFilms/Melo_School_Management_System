"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, CheckCheck, UserPlus } from "lucide-react";
import { humanNameFinal, humanNameTyping } from "@/human-name";

type ClassSummary = {
  _id: string;
  name: string;
  level: string;
};

type SessionSummary = {
  _id: string;
  name: string;
  isActive: boolean;
};

type EnrollmentMatrix = {
  subjects: Array<{ _id: string; name: string; code: string }>;
  students: Array<{
    _id: string;
    studentName: string;
    admissionNumber: string;
    selectedSubjectIds: string[];
  }>;
};

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const selectedClassName =
    classes?.find((classDoc) => classDoc._id === selectedClassId)?.name ??
    "Select Class";
  const activeSessionName =
    sessions?.find((session) => session._id === selectedSessionId)?.name ??
    sessions?.find((session) => session.isActive)?.name ??
    "None";

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

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedStudentName = humanNameFinal(studentName);
    if (!selectedClassId || !normalizedStudentName || !admissionNumber.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await createStudent({
        name: normalizedStudentName,
        admissionNumber: admissionNumber.trim(),
        classId: selectedClassId,
      } as never);
      setStudentName("");
      setAdmissionNumber("");
      setSuccessMessage("Student added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student");
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

      setError(null);
      setSuccessMessage(null);

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds: nextSubjectIds,
        } as never);
        setSuccessMessage("Enrollment grid updated.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update selection"
        );
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  if (classes === undefined || sessions === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 md:px-6">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6 pb-32 md:px-6">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f172a] text-xs font-bold uppercase text-white">
            {selectedClassId ? selectedClassName.slice(-2) : "?"}
          </div>
          <div className="space-y-0.5">
            <h1 className="text-sm font-extrabold uppercase text-[#0f172a]">
              Student Enrollment Matrix
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-tight text-[#94a3b8]">
              Active Session: {activeSessionName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 rounded-lg border border-[#e2e8f0] bg-[#f1f5f9] px-4 text-xs font-bold uppercase tracking-[0.025em] text-[#475569]">
            Roster View
          </button>
          <button className="h-10 rounded-lg bg-[#4f46e5] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-xl shadow-[#4f46e5]/10">
            Add Student
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.15em] text-amber-900">
              Validation Watch
            </h2>
            <p className="text-[11px] font-medium text-amber-800">
              {matrixSummary.studentsWithNoSubjects > 0
                ? `${matrixSummary.studentsWithNoSubjects} students are missing at least one subject.`
                : "All visible students have at least one subject selected."}{" "}
              Admin can add students; teacher can only edit subject ticks.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCheck className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-900">
              Saved Snapshot
            </h2>
            <p className="text-[11px] font-medium text-emerald-800">
              {selectedClassId
                ? `${selectedClassName} enrollment syncs live for ${activeSessionName}.`
                : "Select a class and session to manage the live enrollment grid."}
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
            Class
          </label>
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => setSelectedClassId(event.target.value || null)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none focus:border-[#4f46e5]"
          >
            <option value="">Select Class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
            Session
          </label>
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => setSelectedSessionId(event.target.value || null)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none focus:border-[#4f46e5]"
          >
            <option value="">Select Session</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedClassId ? (
        <section className="space-y-4 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
                Add Student To Class
              </h2>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
                Admin-only roster creation
              </p>
            </div>
            <span className="rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-[#64748b]">
              Step 3 of Setup
            </span>
          </div>

          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Student Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(event) =>
                    setStudentName(humanNameTyping(event.target.value))
                  }
                  onBlur={(event) =>
                    setStudentName(humanNameFinal(event.target.value))
                  }
                  className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  placeholder="Maryam Hassan"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Admission No.
                </label>
                <input
                  type="text"
                  value={admissionNumber}
                  onChange={(event) => setAdmissionNumber(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 font-mono text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  placeholder="4A-0951"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                  Class
                </label>
                <div className="flex h-11 items-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a]">
                  {selectedClassName}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#94a3b8]">
                Once added, teachers may update subject selections only.
              </p>
              <button
                type="submit"
                disabled={isSubmitting || !studentName.trim() || !admissionNumber.trim()}
                className="flex h-10 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-xs font-bold uppercase tracking-[0.025em] text-white shadow-lg shadow-[#4f46e5]/10 transition-all hover:bg-[#4338ca] disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4 text-white/50" />
                {isSubmitting ? "Adding..." : "Add Student"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {selectedClassId && selectedSessionId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94a3b8]">
              Subject Selection Grid
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#cbd5e1] italic md:hidden">
              Swipe right to view subjects →
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            {!matrix ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                Loading enrollment data...
              </div>
            ) : matrix.subjects.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                No subjects offered for this class. Go to Classes to add subject
                offerings first.
              </div>
            ) : matrix.students.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                No students in this class yet. Add students above.
              </div>
            ) : (
              <>
                <div className="relative overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
                  <table className="w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-30 min-w-[220px] border-b border-[#e2e8f0] border-r-2 border-r-[#f1f5f9] bg-[#f8fafc] p-4 text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#0f172a]">
                          Student Identity
                        </th>
                        {matrix.subjects.map((subject) => (
                          <th
                            key={subject._id}
                            className="min-w-[60px] border-b border-[#e2e8f0] bg-[#f8fafc] p-3 text-center text-[8px] font-extrabold uppercase tracking-[0.05em] text-[#64748b]"
                          >
                            {subject.code}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {matrix.students.map((student) => (
                        <tr
                          key={student._id}
                          className="transition-colors hover:bg-[#f8fafc]"
                        >
                          <td className="sticky left-0 z-20 border-r-2 border-r-[#f1f5f9] bg-white p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f1f5f9] text-[10px] font-bold text-[#94a3b8]">
                                {studentInitials(humanNameFinal(student.studentName))}
                              </div>
                              <div className="truncate">
                                <p className="truncate text-xs font-bold text-[#0f172a]">
                                  {humanNameFinal(student.studentName)}
                                </p>
                                <p className="truncate text-[8px] font-bold uppercase tracking-tight text-[#94a3b8]">
                                  {student.admissionNumber}
                                </p>
                              </div>
                            </div>
                          </td>
                          {matrix.subjects.map((subject) => {
                            const isSelected = student.selectedSubjectIds.includes(
                              subject._id
                            );

                            return (
                              <td
                                key={`${student._id}-${subject._id}`}
                                className="border-b border-[#f8fafc] p-3 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleToggleSubject(student._id, subject._id)
                                  }
                                  className={`relative inline-flex h-5 w-5 rounded border-[2.5px] transition-all ${
                                    isSelected
                                      ? "border-[#4f46e5] bg-[#4f46e5]"
                                      : "border-[#e2e8f0] hover:border-[#cbd5e1]"
                                  }`}
                                >
                                  {isSelected ? (
                                    <svg
                                      className="absolute inset-0 m-auto"
                                      width="10"
                                      height="5"
                                      viewBox="0 0 10 5"
                                      fill="none"
                                    >
                                      <path
                                        d="M1 1L4 4L9 1"
                                        stroke="white"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  ) : null}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[#f1f5f9] bg-[#f8fafc]/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
                    Showing {matrixSummary.totalStudents} students •{" "}
                    {matrixSummary.totalSubjects} subjects
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedClassId && selectedSessionId ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_0.9fr]">
          <p className="text-center text-[10px] font-medium italic text-[#94a3b8] md:text-left">
            Teachers cannot add or remove students from the roster. Please
            contact the Admin for registry changes.
          </p>
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-900">
                Save State
              </p>
              <p className="text-[10px] font-medium text-emerald-700">
                Row selections sync immediately after each change.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClassId && selectedSessionId ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-t border-[#f1f5f9] bg-white p-4 sm:justify-end sm:p-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-tighter text-[#0f172a] italic">
              Batch Update Active
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
              {matrix ? `${matrix.students.length} students` : "Select class & session"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSuccessMessage(null);
                setError(null);
              }}
              className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-xs font-bold uppercase tracking-[0.025em] text-[#475569] transition-all hover:bg-[#f8fafc]"
            >
              Reset Grid
            </button>
            <button className="h-12 rounded-xl bg-[#0f172a] px-10 text-[11px] font-bold uppercase tracking-[0.15em] text-white shadow-xl transition-all hover:bg-[#1e293b]">
              Commit Enrollment
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function studentInitials(name: string) {
  const parts = humanNameFinal(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "ST";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
