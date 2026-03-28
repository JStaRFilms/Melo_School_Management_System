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
import Link from "next/link";
import { getUserFacingErrorMessage } from "@school/shared";

import {
  humanNameFinalStrict,
  humanNameTypingStrict,
} from "@/human-name";

import { AdminMobileRosterActions } from "./components/AdminMobileRosterActions";
import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { FloatingNotice } from "./components/FloatingNotice";
import { MobileSheet } from "./components/MobileSheet";
import { StudentCreationForm } from "./components/StudentCreationForm";
import { StudentProfileEditor } from "./components/StudentProfileEditor";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import { uploadStudentPhoto } from "./components/studentPhotoUpload";
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
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never
  );
  const setStudentSubjectSelections = useMutation(
    "functions/academic/studentEnrollment:setStudentSubjectSelections" as never
  );

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [gender, setGender] = useState("");
  const [houseName, setHouseName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isAddStudentSheetOpen, setIsAddStudentSheetOpen] = useState(false);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = (event?: MediaQueryListEvent) => {
      setIsMobileViewport(event?.matches ?? mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

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
  const selectedStudentName =
    matrix?.students.find((student) => student._id === selectedStudentId)
      ?.studentName ?? null;

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

  const studentPhotoPreviewUrl = useMemo(() => {
    if (!studentPhotoFile) {
      return null;
    }

    return URL.createObjectURL(studentPhotoFile);
  }, [studentPhotoFile]);

  useEffect(() => {
    return () => {
      if (studentPhotoFile && studentPhotoPreviewUrl) {
        URL.revokeObjectURL(studentPhotoPreviewUrl);
      }
    };
  }, [studentPhotoFile, studentPhotoPreviewUrl]);

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

  const openAddStudent = useCallback(() => {
    if (!selectedClassId) {
      setNotice({
        tone: "error",
        message: "Select a class first, then add the student.",
      });
      return;
    }

    setIsAddStudentSheetOpen(true);
  }, [selectedClassId]);

  const openProfileEditor = useCallback(
    (studentId?: string | null) => {
      const nextStudentId = studentId ?? selectedStudentId;
      if (!nextStudentId) {
        setNotice({
          tone: "error",
          message: "Select a student first to edit the full profile.",
        });
        return;
      }

      setSelectedStudentId(nextStudentId);
      setIsProfileSheetOpen(true);
    },
    [selectedStudentId]
  );

  const resetStudentCreationForm = useCallback(() => {
    setStudentName("");
    setAdmissionNumber("");
    setGender("");
    setHouseName("");
    setDateOfBirth("");
    setGuardianName("");
    setGuardianPhone("");
    setAddress("");
    setStudentPhotoFile(null);
  }, []);

  const handleCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedStudentName = humanNameFinalStrict(studentName);
    const trimmedHouseName = houseName.trim();
    const trimmedGuardianName = guardianName.trim();
    const trimmedGuardianPhone = guardianPhone.trim();
    const trimmedAddress = address.trim();
    const missingOptionalFields = [
      !trimmedHouseName ? "house" : null,
      !dateOfBirth ? "date of birth" : null,
      !trimmedGuardianName ? "guardian name" : null,
      !trimmedGuardianPhone ? "guardian phone" : null,
      !trimmedAddress ? "address" : null,
      !studentPhotoFile ? "student photo" : null,
    ].filter(Boolean) as string[];

    if (
      !selectedClassId ||
      !normalizedStudentName ||
      !admissionNumber.trim() ||
      !gender.trim()
    ) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    let uploadedPhoto = false;
    try {
      const uploadedPhotoMetadata = studentPhotoFile
        ? await uploadStudentPhoto(studentPhotoFile, () =>
            generateStudentPhotoUploadUrl({} as never) as Promise<string>
          )
        : null;
      uploadedPhoto = Boolean(uploadedPhotoMetadata);

      const createdStudentId = (await createStudent({
        name: normalizedStudentName,
        admissionNumber: admissionNumber.trim(),
        classId: selectedClassId,
        gender,
        houseName: trimmedHouseName || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: trimmedGuardianName || null,
        guardianPhone: trimmedGuardianPhone || null,
        address: trimmedAddress || null,
        photoStorageId: uploadedPhotoMetadata?.storageId ?? undefined,
        photoFileName: uploadedPhotoMetadata?.fileName ?? undefined,
        photoContentType: uploadedPhotoMetadata?.contentType ?? undefined,
      } as never)) as string;
      resetStudentCreationForm();
      setSelectedStudentId(createdStudentId);
      setIsAddStudentSheetOpen(false);
      setNotice({
        tone: missingOptionalFields.length > 0 ? "warning" : "success",
        message:
          missingOptionalFields.length > 0
            ? `${normalizedStudentName} was added to ${selectedClassName}. You have not added ${joinFieldLabels(missingOptionalFields)} yet.`
            : `${normalizedStudentName} was added to ${selectedClassName}.`,
      });
      if (!isMobileViewport) {
        studentNameInputRef.current?.focus();
      }
    } catch (err) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          err,
          uploadedPhoto
            ? "The photo uploaded, but we couldn't finish creating the student."
            : "We couldn't add the student right now."
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
            <p className="text-sm text-slate-500">
              Need student-first intake instead? Use the dedicated onboarding route for first name, last name, guardian details, and class selection later in the flow.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/academic/students/onboarding"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Student-First Onboarding
            </Link>
            <button
              type="button"
              onClick={() => {
                if (isMobileViewport) {
                  openAddStudent();
                  return;
                }

                focusStudentForm();
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 transition hover:bg-indigo-700"
            >
              Add Student
            </button>
          </div>
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

      <AdminMobileRosterActions
        selectedStudentName={selectedStudentName}
        onAddStudent={openAddStudent}
        onEditProfile={() => openProfileEditor()}
      />

      {selectedClassId && !isMobileViewport ? (
        <div>
          <StudentCreationForm
            selectedClassName={selectedClassName}
            studentName={studentName}
            admissionNumber={admissionNumber}
            gender={gender}
            houseName={houseName}
            dateOfBirth={dateOfBirth}
            guardianName={guardianName}
            guardianPhone={guardianPhone}
            address={address}
            photoPreviewUrl={studentPhotoPreviewUrl}
            isSubmitting={isSubmitting}
            variant="inline"
            sectionRef={studentFormRef}
            inputRef={studentNameInputRef}
            onStudentNameChange={(value) =>
              setStudentName(humanNameTypingStrict(value))
            }
            onStudentNameBlur={(value) =>
              setStudentName(humanNameFinalStrict(value))
            }
            onAdmissionNumberChange={setAdmissionNumber}
            onGenderChange={setGender}
            onHouseNameChange={setHouseName}
            onDateOfBirthChange={setDateOfBirth}
            onGuardianNameChange={setGuardianName}
            onGuardianPhoneChange={setGuardianPhone}
            onAddressChange={setAddress}
            onPhotoChange={setStudentPhotoFile}
            onRemovePhoto={() => setStudentPhotoFile(null)}
            onPhotoValidationError={(message) =>
              setNotice({
                tone: "error",
                message,
              })
            }
            onSubmit={handleCreateStudent}
          />
        </div>
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
          onOpenProfile={(studentId) => openProfileEditor(studentId)}
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

      {!isMobileViewport ? (
        <div>
          <StudentProfileEditor
            studentId={selectedStudentId}
            classes={classes}
            onNotice={setNotice}
          />
        </div>
      ) : null}

      {isMobileViewport ? (
        <>
          <MobileSheet
            isOpen={isAddStudentSheetOpen}
            title="Add Student"
            description={`Add a new student to ${selectedClassName}.`}
            onClose={() => setIsAddStudentSheetOpen(false)}
          >
            <StudentCreationForm
              selectedClassName={selectedClassName}
              studentName={studentName}
              admissionNumber={admissionNumber}
              gender={gender}
              houseName={houseName}
              dateOfBirth={dateOfBirth}
              guardianName={guardianName}
              guardianPhone={guardianPhone}
              address={address}
              photoPreviewUrl={studentPhotoPreviewUrl}
              isSubmitting={isSubmitting}
              variant="sheet"
              sectionRef={studentFormRef}
              inputRef={studentNameInputRef}
              onStudentNameChange={(value) =>
                setStudentName(humanNameTypingStrict(value))
              }
              onStudentNameBlur={(value) =>
                setStudentName(humanNameFinalStrict(value))
              }
              onAdmissionNumberChange={setAdmissionNumber}
              onGenderChange={setGender}
              onHouseNameChange={setHouseName}
              onDateOfBirthChange={setDateOfBirth}
              onGuardianNameChange={setGuardianName}
              onGuardianPhoneChange={setGuardianPhone}
              onAddressChange={setAddress}
              onPhotoChange={setStudentPhotoFile}
              onRemovePhoto={() => setStudentPhotoFile(null)}
              onPhotoValidationError={(message) =>
                setNotice({
                  tone: "error",
                  message,
                })
              }
              onSubmit={handleCreateStudent}
            />
          </MobileSheet>

          <MobileSheet
            isOpen={isProfileSheetOpen}
            title="Edit Student Profile"
            description={
              selectedStudentName
                ? `Update ${selectedStudentName}'s details without leaving this screen.`
                : "Select a student to edit the full profile."
            }
            onClose={() => setIsProfileSheetOpen(false)}
          >
            <StudentProfileEditor
              studentId={selectedStudentId}
              classes={classes}
              onNotice={(nextNotice) => {
                setNotice(nextNotice);
                if (nextNotice.tone === "success") {
                  setIsProfileSheetOpen(false);
                }
              }}
              variant="sheet"
            />
          </MobileSheet>
        </>
      ) : null}
    </div>
  );
}

function joinFieldLabels(fields: string[]) {
  if (fields.length === 0) {
    return "";
  }

  if (fields.length === 1) {
    return fields[0];
  }

  if (fields.length === 2) {
    return `${fields[0]} and ${fields[1]}`;
  }

  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}
