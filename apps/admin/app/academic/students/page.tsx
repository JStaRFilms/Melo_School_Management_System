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
import { 
  Users, 
  Sparkles, 
  X, 
  ArrowRight,
  BookOpen,
  Search,
} from "lucide-react";
import Link from "next/link";
import { getUserFacingErrorMessage } from "@school/shared";

import {
  humanNameFinalStrict,
  humanNameTypingStrict,
} from "@/human-name";

import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { StudentCreationForm } from "./components/StudentCreationForm";
import { StudentProfileEditor } from "./components/StudentProfileEditor";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import { StudentUnifiedEditorSheet } from "./components/StudentUnifiedEditorSheet";
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
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<EnrollmentNotice | null>(null);

  // New states for Unified Editor
  const [isUnifiedSheetOpen, setIsUnifiedSheetOpen] = useState(false);
  const [unifiedInitialTab, setUnifiedInitialTab] = useState<"subjects" | "profile">("subjects");

  const studentFormRef = useRef<HTMLDivElement>(null);
  const studentNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

    const timeoutId = window.setTimeout(() => setNotice(null), 3500);
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

  const activeStudentForSheet = useMemo(() => {
    if (!matrix || !selectedStudentId) return null;
    return matrix.students.find(s => s._id === selectedStudentId) ?? null;
  }, [matrix, selectedStudentId]);

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
      totalStudentsWithNoSubjectsLabel: matrix.students.filter(
        (student) => student.selectedSubjectIds.length === 0
      ).length === 1 ? "student" : "students",
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
      setNotice({
        tone: missingOptionalFields.length > 0 ? "warning" : "success",
        message:
          missingOptionalFields.length > 0
            ? `${normalizedStudentName} added. Missing: ${joinFieldLabels(missingOptionalFields)}.`
            : `${normalizedStudentName} added successfully to ${selectedClassName}.`,
      });
      if (!isMobile) {
        studentNameInputRef.current?.focus();
      }
    } catch (err) {
      setNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          err,
          "Account creation failed."
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
          message: `Saved subjects for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (err) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(
            err,
            "Failed to update subject."
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
          message: `Batch update saved for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (err) {
        setNotice({
          tone: "error",
          message: getUserFacingErrorMessage(
            err,
            "Failed to update subjects."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections]
  );

  const openUnifiedEditor = useCallback((studentId: string, tab: "subjects" | "profile" = "subjects") => {
    setSelectedStudentId(studentId);
    setUnifiedInitialTab(tab);
    setIsUnifiedSheetOpen(true);
  }, []);

  if (classes === undefined || sessions === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-2.5 py-6 md:px-6 animate-pulse">
        <div className="h-10 w-48 rounded-lg bg-slate-100" />
        <div className="mt-8 grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2 h-96 rounded-xl bg-slate-50" />
          <div className="h-96 rounded-xl bg-slate-50" />
        </div>
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(15, 23, 42, 0.15);
        }
      `}} />

      {/* Unified Mobile Sheet - Rendered at Top level for avoid clipping issues */}
      <StudentUnifiedEditorSheet
        activeStudent={activeStudentForSheet}
        subjects={matrix?.subjects ?? []}
        totalSubjects={matrixSummary.totalSubjects}
        isOpen={isUnifiedSheetOpen && isMobile}
        onClose={() => setIsUnifiedSheetOpen(false)}
        onToggle={handleToggleSubject}
        onSetStudentSubjects={handleSetStudentSubjects}
        classes={classes}
        onNotice={setNotice}
        initialTab={unifiedInitialTab}
        onStudentArchived={() => setIsUnifiedSheetOpen(false)}
      />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Main Bucket - Content Primary */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-2.5 sm:p-4 lg:p-6 lg:order-1">
          <div className="max-w-[1400px] mx-auto space-y-6">
            
            <div className="space-y-6">
              <AdminHeader
                title="Student Enrollment"
              />

              <StatGroup
                stats={[
                  {
                    label: "Total Registered",
                    value: matrixSummary.totalStudents,
                    icon: <Users className="h-4 w-4" />,
                  },
                  {
                    label: "Subjects Offered",
                    value: matrixSummary.totalSubjects,
                    icon: <BookOpen className="h-4 w-4" />,
                  },
                  {
                    label: "Active Session",
                    value: activeSessionName,
                    icon: <Sparkles className="h-4 w-4" />,
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

            {notice && (
              <div className={`group relative overflow-hidden rounded-xl border-l-[6px] p-4 shadow-xl transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : notice.tone === "warning" ? "border-l-amber-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">System Message</p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button onClick={() => setNotice(null)} className="rounded-full p-1.5 hover:bg-slate-50">
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-8">
              {/* MOBILE ONLY: New Admission trigger follows the context block */}
              {isMobile && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
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
                    sectionRef={studentFormRef}
                    inputRef={studentNameInputRef}
                    onStudentNameChange={(v) => setStudentName(humanNameTypingStrict(v))}
                    onStudentNameBlur={(v) => setStudentName(humanNameFinalStrict(v))}
                    onAdmissionNumberChange={setAdmissionNumber}
                    onGenderChange={setGender}
                    onHouseNameChange={setHouseName}
                    onDateOfBirthChange={setDateOfBirth}
                    onGuardianNameChange={setGuardianName}
                    onGuardianPhoneChange={setGuardianPhone}
                    onAddressChange={setAddress}
                    onPhotoChange={setStudentPhotoFile}
                    onRemovePhoto={() => setStudentPhotoFile(null)}
                    onPhotoValidationError={(m) => setNotice({ tone: "error", message: m })}
                    onSubmit={handleCreateStudent}
                  />
                </div>
              )}

              {selectedClassId && selectedSessionId ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-950/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 px-1">Roster Matrix</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block px-1">Live Update</p>
                  </div>
                  <SubjectSelectionMatrix
                    matrix={matrix}
                    totalStudents={matrixSummary.totalStudents}
                    totalSubjects={matrixSummary.totalSubjects}
                    isIssueVisible={matrixSummary.studentsWithNoSubjects > 0}
                    studentsWithNoSubjects={matrixSummary.studentsWithNoSubjects}
                    selectedStudentId={selectedStudentId}
                    onSelectStudent={setSelectedStudentId}
                    onOpenUnifiedEditor={openUnifiedEditor}
                    onToggle={handleToggleSubject}
                    onSetStudentSubjects={handleSetStudentSubjects}
                  />
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                  <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-xl ring-1 ring-slate-950/5 animate-in fade-in zoom-in duration-700">
                    <Search className="h-8 w-8" />
                  </div>
                  <p className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Select Context Above</p>
                  <p className="mt-2 text-xs font-medium text-slate-400 max-w-[200px]">Management matrix will appear once a class and session are chosen.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar Bucket - Desktop Management */}
        <aside className="hidden lg:block w-[450px] h-full overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl custom-scrollbar p-5 lg:order-2">
          <div className="space-y-6">
            {selectedStudentId ? (
              <StudentProfileEditor
                studentId={selectedStudentId}
                classes={classes}
                onNotice={setNotice}
                onStudentArchived={() => setSelectedStudentId(null)}
              />
            ) : (
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
                sectionRef={studentFormRef}
                inputRef={studentNameInputRef}
                onStudentNameChange={(v) => setStudentName(humanNameTypingStrict(v))}
                onStudentNameBlur={(v) => setStudentName(humanNameFinalStrict(v))}
                onAdmissionNumberChange={setAdmissionNumber}
                onGenderChange={setGender}
                onHouseNameChange={setHouseName}
                onDateOfBirthChange={setDateOfBirth}
                onGuardianNameChange={setGuardianName}
                onGuardianPhoneChange={setGuardianPhone}
                onAddressChange={setAddress}
                onPhotoChange={setStudentPhotoFile}
                onRemovePhoto={() => setStudentPhotoFile(null)}
                onPhotoValidationError={(m) => setNotice({ tone: "error", message: m })}
                onSubmit={handleCreateStudent}
              />
            )}

            <div className="pt-6 border-t border-slate-200/60 group">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300 group-hover:text-slate-500 transition-colors">Quick Reference</h4>
              <p className="mt-2 text-xs leading-relaxed font-medium text-slate-400">
                Enrollment changes are pushed live. Updates to student profile details will reflect across all academic reports for the active session.
              </p>
              <Link 
                href="/academic/students/onboarding"
                className="mt-4 flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Access Bulk Onboarding <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function joinFieldLabels(fields: string[]) {
  if (fields.length === 0) return "";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}
