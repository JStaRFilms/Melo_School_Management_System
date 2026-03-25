"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCheck, ShieldAlert } from "lucide-react";
import { humanNameFinal } from "@/lib/human-name";

type SessionSummary = {
  _id: string;
  name: string;
};

type ClassSummary = {
  _id: string;
  name: string;
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const summary = useMemo(() => {
    if (!matrix) {
      return { studentCount: 0 };
    }

    return { studentCount: matrix.students.length };
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

      setError(null);
      setSuccessMessage(null);

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds: nextSubjectIds,
        } as never);
        setSuccessMessage("Subject selections updated.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update selection"
        );
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  if (sessions === undefined || classes === undefined) {
    return (
      <div className="max-w-6xl mx-auto py-6 px-4 md:px-6">
        <div className="text-[#64748b]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 py-6 pb-32 md:px-6">
      <div className="flex items-center justify-between rounded-xl bg-[#4f46e5] p-4 text-white shadow-lg shadow-[#4f46e5]/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
            <ShieldAlert className="h-5 w-5 text-white/60" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-sm font-extrabold uppercase tracking-tight">
              Teacher Control Mode
            </h1>
            <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-white/70">
              Permission: Assigned Subject Overwrite only
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#0f172a]">
            Roster Lock
          </h2>
          <p className="text-[10px] font-medium uppercase tracking-tight text-[#94a3b8]">
            Students are created by admin. Teacher edits subject ticks only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#e2e8f0] bg-[#f1f5f9] px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-[#64748b]">
            Add Student Disabled
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">
            Assigned Class
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
            Session
          </label>
          <select
            value={selectedSessionId ?? ""}
            onChange={(event) => setSelectedSessionId(event.target.value || null)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
          >
            <option value="">Select a session</option>
            {sessions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
            Class
          </label>
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => setSelectedClassId(event.target.value || null)}
            className="h-11 w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm font-bold text-[#0f172a] outline-none transition-all focus:border-[#4f46e5]"
          >
            <option value="">Select a class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name}
              </option>
            ))}
          </select>
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

      {selectedClassId && selectedSessionId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94a3b8]">
              Subject Selection Grid
            </h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            {!matrix ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                Loading subject grid...
              </div>
            ) : matrix.subjects.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                No subjects offered for this class yet.
              </div>
            ) : matrix.students.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#94a3b8]">
                No students in this class yet.
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
                <div className="border-t border-[#f1f5f9] bg-[#f8fafc]/50 p-4">
                  <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-[#cbd5e1] italic">
                    Note: Changes apply instantly across the semester profile.
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
                Row selections synced after class-teacher review.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {selectedClassId && selectedSessionId ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 border-t border-[#f1f5f9] bg-white p-4 sm:justify-end sm:p-6">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-tighter text-[#0f172a] italic">
              Teacher Entry
            </span>
            <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.15em] text-[#94a3b8]">
              {selectedClassName} Overlay • {summary.studentCount} students
            </span>
          </div>
          <button className="h-12 rounded-xl bg-[#4f46e5] px-10 text-[11px] font-bold uppercase tracking-[0.15em] text-white shadow-xl transition-all hover:bg-[#4338ca]">
            Update Row Selections
          </button>
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
