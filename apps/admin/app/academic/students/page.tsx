"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { isValidEmailAddress } from "@school/auth";
import {
  cleanEmailInput,
  cleanPhoneInput,
  getUserFacingErrorMessage,
  isValidPhoneNumber,
  MeloLoader,
} from "@school/shared";
import { appToast } from "@school/shared/toast";
import {
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";

import {
  humanNameFinalStrict,
  humanNameTypingStrict,
} from "@/human-name";

import { useAuth } from "@/AuthProvider";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { StatGroup } from "@/components/ui/StatGroup";
import { AttestationLetterModal } from "./components/AttestationLetterModal";
import type { AdmissionCounterDecision } from "./components/AdmissionNumberGovernanceFields";
import { EnrollmentFilters } from "./components/EnrollmentFilters";
import { FamilyOnboardingForm } from "./components/FamilyOnboardingForm";
import { GraduationConfirmationModal } from "./components/GraduationConfirmationModal";
import { PromotionConfirmationModal } from "./components/PromotionConfirmationModal";
import { StudentCreationForm } from "./components/StudentCreationForm";
import { StudentProfileEditor } from "./components/StudentProfileEditor";
import { StudentPromotionPanel, type PromotionSubjectMode } from "./components/StudentPromotionPanel";
import { StudentUnifiedEditorSheet } from "./components/StudentUnifiedEditorSheet";
import { SubjectSelectionMatrix } from "./components/SubjectSelectionMatrix";
import { uploadStudentPhoto } from "./components/studentPhotoUpload";
import type {
  AttestationData,
  ClassSummary,
  EnrollmentMatrix,
  EnrollmentNotice,
  SessionSummary,
  TermSummary,
} from "./components/types";

const MAX_PROMOTION_BATCH = 100;

export default function StudentsPage() {
  return (
    <Suspense fallback={<StudentsPageFallback />}>
      <StudentsPageContent />
    </Suspense>
  );
}

function StudentsPageFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface-100">
      <MeloLoader message="Loading student records..." />
    </div>
  );
}

function StudentsPageContent() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? workspaceAccess.branch.schoolId
      : null;
  const canOverrideAdmissionNumber = Boolean(
    workspaceAccess?.state === "ready" &&
      workspaceAccess.effectiveCapabilities.includes(
        "enrollment.admissions.override_number",
      ),
  );
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
  const promoteStudents = useMutation(
    "functions/academic/studentEnrollment:promoteStudents" as never
  );
  const graduateStudents = useMutation(
    "functions/academic/studentEnrollment:graduateStudents" as never
  );
  const cancelStudentGraduation = useMutation(
    "functions/academic/studentEnrollment:cancelStudentGraduation" as never
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlClassId = searchParams.get("classId");
  const urlSessionId = searchParams.get("sessionId");
  const urlStudentId = searchParams.get("studentId");
  const urlTab = searchParams.get("tab");

  const [selectedClassId, setSelectedClassId] = useState<string | null>(urlClassId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(urlSessionId);
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [admissionNumberMode, setAdmissionNumberMode] = useState<
    "automatic" | "manual"
  >("automatic");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideCounterDecision, setOverrideCounterDecision] =
    useState<AdmissionCounterDecision>("");
  const [advanceCounterTo, setAdvanceCounterTo] = useState("");
  const [gender, setGender] = useState("");
  const [houseName, setHouseName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [isParentPrimaryContact, setIsParentPrimaryContact] = useState(true);
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [studentPhotoResetKey, setStudentPhotoResetKey] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(urlStudentId);
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionStudentIds, setPromotionStudentIds] = useState<string[]>([]);
  const [promotionTargetClassId, setPromotionTargetClassId] = useState("");
  const [promotionTargetSessionId, setPromotionTargetSessionId] = useState("");
  const [promotionSubjectMode, setPromotionSubjectMode] =
    useState<PromotionSubjectMode>("all_target_class_subjects");

  // Graduation States
  const [isGraduationConfirmOpen, setIsGraduationConfirmOpen] = useState(false);
  // Stable timestamp captured when the graduation modal opens — prevents Date.now() drift on re-renders
  const stableGraduationDate = useMemo(() => Date.now(), [isGraduationConfirmOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [graduationDraft, setGraduationDraft] = useState<{
    graduationDate?: number;
    certificateNumber?: string;
    honorsOrRemarks?: string;
  }>({});
  const [isGraduating, setIsGraduating] = useState(false);
  const [cancellingGraduationStudent, setCancellingGraduationStudent] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [isCancellingGraduation, setIsCancellingGraduation] = useState(false);
  const [attestationStudentId, setAttestationStudentId] = useState<string | null>(null);
  const [isAttestationModalOpen, setIsAttestationModalOpen] = useState(false);

  // New states for Unified Editor
  const [isUnifiedSheetOpen, setIsUnifiedSheetOpen] = useState(false);
  const [unifiedInitialTab, setUnifiedInitialTab] = useState<"subjects" | "profile">(
    urlTab === "profile" ? "profile" : "subjects"
  );
  const [activeTab, setActiveTab] = useState<"profile" | "family">("profile");
  const [creationTab, setCreationTab] = useState<"quick" | "family">("quick");
  const [isCreationSheetOpen, setIsCreationSheetOpen] = useState(false);
  const [isDuplicateParentLinkConfirmOpen, setIsDuplicateParentLinkConfirmOpen] = useState(false);

  const selectedClassLevel = classes?.find(
    (classDoc) => classDoc._id === selectedClassId,
  )?.level;
  const admissionNumbering = useQuery(
    "functions/academic/admissionNumbers:getAdmissionNumberPolicy" as never,
    schoolId
      ? ({
          schoolId,
          ...(selectedClassLevel ? { level: selectedClassLevel } : {}),
        } as never)
      : ("skip" as never),
  ) as
    | {
        policy: { pattern: string } | null;
        version: number;
        preview: string | null;
      }
    | undefined;
  const numberingPolicyConfigured = Boolean(admissionNumbering?.policy);
  const useAutomaticAdmissionNumber =
    numberingPolicyConfigured && admissionNumberMode === "automatic";

  const studentFormRef = useRef<HTMLDivElement>(null);
  const studentNameInputRef = useRef<HTMLInputElement>(null);

  const updateUrlParams = useCallback(
    (updates: {
      classId?: string | null;
      sessionId?: string | null;
      studentId?: string | null;
      tab?: string | null;
    }) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);

      if (updates.classId !== undefined) {
        if (updates.classId) params.set("classId", updates.classId);
        else params.delete("classId");
      }
      if (updates.sessionId !== undefined) {
        if (updates.sessionId) params.set("sessionId", updates.sessionId);
        else params.delete("sessionId");
      }
      if (updates.studentId !== undefined) {
        if (updates.studentId) params.set("studentId", updates.studentId);
        else params.delete("studentId");
      }
      if (updates.tab !== undefined) {
        if (updates.tab) params.set("tab", updates.tab);
        else params.delete("tab");
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      window.history.replaceState(null, "", newUrl);
    },
    [pathname]
  );

  const showNotice = useCallback((nextNotice: EnrollmentNotice) => {
    if (nextNotice.tone === "success") {
      appToast.success(nextNotice.message);
      return;
    }

    if (nextNotice.tone === "warning") {
      appToast.warning(nextNotice.message);
      return;
    }

    appToast.error(nextNotice.message);
  }, []);

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
  const selectedSessionTerms = useQuery(
    "functions/academic/academicSetup:listTermsBySession" as never,
    selectedSessionId
      ? ({ sessionId: selectedSessionId } as never)
      : ("skip" as never)
  ) as TermSummary[] | undefined;
  const attestationData = useQuery(
    "functions/academic/studentEnrollment:getStudentAttestationData" as never,
    attestationStudentId
      ? ({ studentId: attestationStudentId } as never)
      : ("skip" as never)
  ) as AttestationData | undefined;

  const shouldShowPromotionPanel = useMemo(() => {
    const activeTerm = selectedSessionTerms?.find((term) => term.isActive);

    return activeTerm?.reportCardCalculationMode === "cumulative_annual";
  }, [selectedSessionTerms]);

  // Synchronize initial session selection
  useEffect(() => {
    if (!sessions || sessions.length === 0) {
      return;
    }

    if (!selectedSessionId || !sessions.some((s) => s._id === selectedSessionId)) {
      const urlSession = urlSessionId && sessions.find((s) => s._id === urlSessionId);
      const activeSession = sessions.find((session) => session.isActive) ?? sessions[0];
      const targetSessionId = urlSession ? urlSession._id : activeSession?._id;
      if (targetSessionId) {
        setSelectedSessionId(targetSessionId);
        updateUrlParams({ sessionId: targetSessionId });
      }
    }
  }, [selectedSessionId, sessions, urlSessionId, updateUrlParams]);

  // Synchronize initial class selection
  useEffect(() => {
    if (!classes || classes.length === 0) {
      return;
    }

    if (!selectedClassId || !classes.some((c) => c._id === selectedClassId)) {
      const urlClass = urlClassId && classes.find((c) => c._id === urlClassId);
      const defaultClass = urlClass ? urlClass : classes[0];
      if (defaultClass) {
        setSelectedClassId(defaultClass._id);
        updateUrlParams({ classId: defaultClass._id });
      }
    }
  }, [classes, selectedClassId, urlClassId, updateUrlParams]);

  useEffect(() => {
    if (!sessions || promotionTargetSessionId) {
      return;
    }

    const nextSession = sessions.find((session) => !session.isActive);
    if (nextSession) {
      setPromotionTargetSessionId(nextSession._id);
    }
  }, [promotionTargetSessionId, sessions]);

  // Synchronize selected student with matrix data
  useEffect(() => {
    // Keep a deep-link intact while its selected matrix is still loading.
    if (matrix === undefined) {
      return;
    }

    if (!matrix.students.length) {
      if (selectedStudentId) {
        setSelectedStudentId(null);
        updateUrlParams({ studentId: null, tab: null });
      }
      setPromotionStudentIds([]);
      return;
    }

    const visibleStudentIds = new Set(matrix.students.map((student) => student._id));
    if (urlStudentId && visibleStudentIds.has(urlStudentId)) {
      setSelectedStudentId(urlStudentId);
      if (urlTab === "profile" || urlTab === "subjects") {
        setUnifiedInitialTab(urlTab);
        setIsUnifiedSheetOpen(true);
      }
    } else {
      setSelectedStudentId((current) => {
        if (current && visibleStudentIds.has(current)) {
          return current;
        }
        return null;
      });
    }

    setPromotionStudentIds((current) =>
      current.filter((studentId) => visibleStudentIds.has(studentId))
    );
  }, [matrix, selectedStudentId, urlStudentId, urlTab, updateUrlParams]);

  const cancelStudentPromotion = useMutation(
    "functions/academic/studentEnrollment:cancelStudentPromotion" as never
  );

  const promotedStudentsCount = useMemo(() => {
    if (!matrix?.students) return 0;
    return matrix.students.filter((s) => s.promotionStatus?.isPromoted).length;
  }, [matrix]);

  const unpromotedStudentsCount = useMemo(() => {
    if (!matrix?.students) return 0;
    return matrix.students.filter(
      (s) => !s.promotionStatus?.isPromoted && !s.graduationStatus?.isGraduated
    ).length;
  }, [matrix]);

  const graduatedStudentsCount = useMemo(() => {
    if (!matrix?.students) return 0;
    return matrix.students.filter((s) => s.graduationStatus?.isGraduated).length;
  }, [matrix]);

  const handleSelectUnpromotedOnly = useCallback(() => {
    if (!matrix?.students) return;
    const unpromotedIds = matrix.students
      .filter((s) => !s.promotionStatus?.isPromoted && !s.graduationStatus?.isGraduated)
      .map((s) => s._id);
    setPromotionStudentIds(unpromotedIds);
  }, [matrix]);

  const handleGraduateRequest = useCallback(
    (data: {
      graduationDate?: number;
      certificateNumber?: string;
      honorsOrRemarks?: string;
    }) => {
      if (!selectedClassId || !selectedSessionId || promotionStudentIds.length === 0) {
        showNotice({
          tone: "warning",
          message: "Select at least one student from the roster to graduate.",
        });
        return;
      }
      setGraduationDraft(data);
      setIsGraduationConfirmOpen(true);
    },
    [promotionStudentIds.length, selectedClassId, selectedSessionId, showNotice]
  );

  const executeGraduation = useCallback(async () => {
    if (!selectedClassId || !selectedSessionId || promotionStudentIds.length === 0) return;
    setIsGraduating(true);
    try {
      await graduateStudents({
        studentIds: promotionStudentIds,
        classId: selectedClassId,
        sessionId: selectedSessionId,
        graduationDate: graduationDraft.graduationDate,
        certificateNumber: graduationDraft.certificateNumber,
        honorsOrRemarks: graduationDraft.honorsOrRemarks,
      } as never);
      showNotice({
        tone: "success",
        message: `Successfully graduated ${promotionStudentIds.length} student${promotionStudentIds.length === 1 ? "" : "s"}.`,
      });
      setIsGraduationConfirmOpen(false);
      setPromotionStudentIds([]);
    } catch (err) {
      showNotice({
        tone: "error",
        message: getUserFacingErrorMessage(err, "Failed to graduate cohort."),
      });
    } finally {
      setIsGraduating(false);
    }
  }, [graduateStudents, graduationDraft, promotionStudentIds, selectedClassId, selectedSessionId, showNotice]);

  const handleCancelGraduation = useCallback(
    (studentId: string) => {
      if (!selectedSessionId) return;
      const student = matrix?.students.find((s) => s._id === studentId);
      const studentName = student?.studentName ?? "this student";
      setCancellingGraduationStudent({ studentId, studentName });
    },
    [matrix, selectedSessionId]
  );

  const executeCancelGraduation = async () => {
    if (!cancellingGraduationStudent || !selectedSessionId) return;
    const { studentId, studentName } = cancellingGraduationStudent;
    setIsCancellingGraduation(true);
    try {
      await cancelStudentGraduation({
        studentId: studentId as never,
        sessionId: selectedSessionId as never,
      });
      showNotice({
        tone: "success",
        message: `Restored active enrollment for ${studentName}.`,
      });
      setCancellingGraduationStudent(null);
    } catch (err) {
      showNotice({
        tone: "error",
        message: getUserFacingErrorMessage(err, "Failed to restore student status."),
      });
    } finally {
      setIsCancellingGraduation(false);
    }
  };

  const handleOpenAttestation = useCallback((studentId: string) => {
    setAttestationStudentId(studentId);
    setIsAttestationModalOpen(true);
  }, []);

  const [cancellingPromotionStudent, setCancellingPromotionStudent] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  const [isCancellingPromotion, setIsCancellingPromotion] = useState(false);

  const handleCancelPromotion = useCallback(
    (studentId: string) => {
      if (!selectedSessionId) return;
      const student = matrix?.students.find((s) => s._id === studentId);
      const studentName = student?.studentName ?? "this student";
      setCancellingPromotionStudent({ studentId, studentName });
    },
    [matrix, selectedSessionId]
  );

  const executeCancelPromotion = async () => {
    if (!cancellingPromotionStudent || !selectedSessionId) return;
    const { studentId, studentName } = cancellingPromotionStudent;
    setIsCancellingPromotion(true);
    try {
      await cancelStudentPromotion({
        studentId: studentId as never,
        fromSessionId: selectedSessionId as never,
      });
      showNotice({
        tone: "success",
        message: `Cancelled promotion for ${studentName}.`,
      });
      setPromotionStudentIds((prev) => prev.filter((id) => id !== studentId));
      setCancellingPromotionStudent(null);
    } catch (err) {
      showNotice({
        tone: "error",
        message: getUserFacingErrorMessage(err, "Failed to cancel promotion."),
      });
    } finally {
      setIsCancellingPromotion(false);
    }
  };

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
    setStudentFirstName("");
    setStudentLastName("");
    setAdmissionNumber("");
    setAdmissionNumberMode("automatic");
    setOverrideReason("");
    setOverrideConfirmed(false);
    setOverrideCounterDecision("");
    setAdvanceCounterTo("");
    setGender("");
    setHouseName("");
    setDateOfBirth("");
    setGuardianName("");
    setGuardianPhone("");
    setAddress("");
    setParentFirstName("");
    setParentLastName("");
    setParentEmail("");
    setParentPhone("");
    setParentRelationship("");
    setIsParentPrimaryContact(true);
    setStudentPhotoFile(null);
    setStudentPhotoResetKey((key) => key + 1);
  }, []);

  const submitStudent = async (confirmDuplicateLink = false) => {
    const normalizedStudentFirstName = humanNameFinalStrict(studentFirstName);
    const normalizedStudentLastName = humanNameFinalStrict(studentLastName);
    const normalizedStudentName = [normalizedStudentFirstName, normalizedStudentLastName].filter(Boolean).join(" ");
    const trimmedHouseName = houseName.trim();
    const trimmedGuardianName = guardianName.trim();
    const trimmedGuardianPhone = guardianPhone.trim();
    const trimmedAddress = address.trim();
    const normalizedParentFirstName = humanNameFinalStrict(parentFirstName);
    const normalizedParentLastName = humanNameFinalStrict(parentLastName);
    const normalizedParentEmail = parentEmail.trim().toLowerCase();
    const shouldLinkParent = [
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      parentRelationship,
    ].some((value) => value.trim().length > 0);
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
      admissionNumbering === undefined ||
      (!useAutomaticAdmissionNumber && !admissionNumber.trim()) ||
      !gender.trim()
    ) {
      return;
    }

    if (trimmedGuardianPhone && !isValidPhoneNumber(trimmedGuardianPhone)) {
      showNotice({
        tone: "error",
        message: "Enter a valid guardian contact phone number (e.g. +234...).",
      });
      return;
    }

    if (shouldLinkParent) {
      if (!normalizedParentFirstName || !normalizedParentLastName || !normalizedParentEmail) {
        showNotice({
          tone: "error",
          message: "Parent first name, last name, and email are required to link family details during admission.",
        });
        return;
      }

      if (!isValidEmailAddress(normalizedParentEmail)) {
        showNotice({
          tone: "error",
          message: "Enter a valid parent email address before linking family details.",
        });
        return;
      }

      if (parentPhone.trim() && !isValidPhoneNumber(parentPhone)) {
        showNotice({
          tone: "error",
          message: "Enter a valid parent phone number (e.g. +234...).",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const uploadedPhotoMetadata = studentPhotoFile
        ? await uploadStudentPhoto(studentPhotoFile, () =>
            generateStudentPhotoUploadUrl({} as never) as Promise<string>
          )
        : null;
      const createdStudentId = (await createStudent({
        name: normalizedStudentName,
        admissionNumber: useAutomaticAdmissionNumber
          ? ""
          : admissionNumber.trim(),
        numberingVersion: useAutomaticAdmissionNumber
          ? admissionNumbering.version
          : undefined,
        overrideReason:
          numberingPolicyConfigured && admissionNumberMode === "manual"
            ? overrideReason.trim()
            : undefined,
        overrideConfirmed:
          numberingPolicyConfigured && admissionNumberMode === "manual"
            ? overrideConfirmed
            : undefined,
        overrideCounterDecision:
          numberingPolicyConfigured && admissionNumberMode === "manual"
            ? overrideCounterDecision || undefined
            : undefined,
        advanceCounterTo:
          numberingPolicyConfigured &&
          admissionNumberMode === "manual" &&
          overrideCounterDecision === "advance"
            ? Number(advanceCounterTo)
            : undefined,
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
        parentLink:
          shouldLinkParent && normalizedParentFirstName && normalizedParentLastName
            ? {
                firstName: normalizedParentFirstName,
                lastName: normalizedParentLastName,
                email: normalizedParentEmail,
                phone: parentPhone.trim() || null,
                relationship: parentRelationship.trim() || null,
                isPrimaryContact: isParentPrimaryContact,
              }
            : undefined,
        confirmDuplicateLink: confirmDuplicateLink || undefined,
      } as never)) as string;

      resetStudentCreationForm();
      setCreationTab("quick");
      setSelectedStudentId(createdStudentId);
      updateUrlParams({ studentId: createdStudentId });
      showNotice({
        tone: missingOptionalFields.length > 0 ? "warning" : "success",
        message:
          missingOptionalFields.length > 0
            ? `${normalizedStudentName} added. Missing: ${joinFieldLabels(missingOptionalFields)}.`
            : `${normalizedStudentName} added successfully to ${selectedClassName}${shouldLinkParent ? " · family linked" : ""}.`,
      });
      if (!isMobile) {
        studentNameInputRef.current?.focus();
      }
    } catch (err) {
      const message = getUserFacingErrorMessage(err, "Account creation failed.");
      if (message.includes("Review the duplicate-link details and confirm")) {
        setIsDuplicateParentLinkConfirmOpen(true);
        return;
      }
      showNotice({
        tone: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStudent = async (event: FormEvent) => {
    event.preventDefault();
    await submitStudent();
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

      try {
        await setStudentSubjectSelections({
          studentId,
          classId: selectedClassId,
          sessionId: selectedSessionId,
          subjectIds: nextSubjectIds,
        } as never);
        showNotice({
          tone: "success",
          message: `Saved subjects for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (err) {
        showNotice({
          tone: "error",
          message: getUserFacingErrorMessage(
            err,
            "Failed to update subject."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections, showNotice]
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
        showNotice({
          tone: "success",
          message: `Batch update saved for ${humanNameFinalStrict(student.studentName)}.`,
        });
      } catch (err) {
        showNotice({
          tone: "error",
          message: getUserFacingErrorMessage(
            err,
            "Failed to update subjects."
          ),
        });
      }
    },
    [matrix, selectedClassId, selectedSessionId, setStudentSubjectSelections, showNotice]
  );

  const handleTogglePromotionStudent = useCallback((studentId: string) => {
    setPromotionStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  }, []);

  const handleSelectAllVisibleForPromotion = useCallback(() => {
    if (!matrix?.students) {
      return;
    }

    setPromotionStudentIds(matrix.students.map((student) => student._id));
  }, [matrix]);

  const [isPromotionConfirmOpen, setIsPromotionConfirmOpen] = useState(false);

  const handlePromoteStudents = useCallback(() => {
    if (
      !selectedClassId ||
      !selectedSessionId ||
      !promotionTargetClassId ||
      !promotionTargetSessionId ||
      promotionStudentIds.length === 0
    ) {
      showNotice({
        tone: "warning",
        message: "Choose students, target class, and target session to promote.",
      });
      return;
    }

    if (
      selectedClassId === promotionTargetClassId &&
      selectedSessionId === promotionTargetSessionId
    ) {
      showNotice({
        tone: "warning",
        message: "Choose a different target class or session before promoting.",
      });
      return;
    }

    setIsPromotionConfirmOpen(true);
  }, [
    promotionStudentIds.length,
    promotionTargetClassId,
    promotionTargetSessionId,
    selectedClassId,
    selectedSessionId,
    showNotice,
  ]);

  const executePromotion = useCallback(async () => {
    if (
      !selectedClassId ||
      !selectedSessionId ||
      !promotionTargetClassId ||
      !promotionTargetSessionId ||
      promotionStudentIds.length === 0
    ) {
      return;
    }

    const targetClassName =
      classes?.find((classDoc) => classDoc._id === promotionTargetClassId)?.name ??
      "the target class";

    setIsPromoting(true);
    try {
      await promoteStudents({
        studentIds: promotionStudentIds,
        fromClassId: selectedClassId,
        fromSessionId: selectedSessionId,
        toClassId: promotionTargetClassId,
        toSessionId: promotionTargetSessionId,
        subjectEnrollmentMode: promotionSubjectMode,
      } as never);
      showNotice({
        tone: "success",
        message: `Promoted ${promotionStudentIds.length} student${promotionStudentIds.length === 1 ? "" : "s"} to ${targetClassName}.`,
      });
      setPromotionStudentIds([]);
      setIsPromotionConfirmOpen(false);
    } catch (err) {
      showNotice({
        tone: "error",
        message: getUserFacingErrorMessage(err, "Promotion failed."),
      });
    } finally {
      setIsPromoting(false);
    }
  }, [
    classes,
    promoteStudents,
    promotionStudentIds,
    promotionSubjectMode,
    promotionTargetClassId,
    promotionTargetSessionId,
    selectedClassId,
    selectedSessionId,
    showNotice,
  ]);

  const handleClassChange = useCallback(
    (nextClassId: string | null) => {
      setSelectedClassId(nextClassId);
      setSelectedStudentId(null);
      updateUrlParams({ classId: nextClassId, studentId: null, tab: null });
    },
    [updateUrlParams]
  );

  const handleSessionChange = useCallback(
    (nextSessionId: string | null) => {
      setSelectedSessionId(nextSessionId);
      updateUrlParams({ sessionId: nextSessionId });
    },
    [updateUrlParams]
  );

  const handleSelectStudent = useCallback(
    (studentId: string | null) => {
      setSelectedStudentId(studentId);
      updateUrlParams({ studentId: studentId || null, tab: null });
    },
    [updateUrlParams]
  );

  const openUnifiedEditor = useCallback(
    (studentId: string, tab: "subjects" | "profile" = "subjects") => {
      setSelectedStudentId(studentId);
      setUnifiedInitialTab(tab);
      setIsUnifiedSheetOpen(true);
      updateUrlParams({ studentId, tab });
    },
    [updateUrlParams]
  );

  const handleCloseUnifiedEditor = useCallback(() => {
    setIsUnifiedSheetOpen(false);
    updateUrlParams({ tab: null });
  }, [updateUrlParams]);

  const handleNewAdmission = useCallback(() => {
    setSelectedStudentId(null);
    setIsCreationSheetOpen(true);
    updateUrlParams({ studentId: null, tab: null });
    setTimeout(() => {
      studentNameInputRef.current?.focus();
    }, 300);
  }, [updateUrlParams]);

  const promotionSourceClassName =
    classes?.find((c) => c._id === selectedClassId)?.name ?? "Current Class";
  const promotionSourceSessionName =
    sessions?.find((s) => s._id === selectedSessionId)?.name ?? "Current Session";
  const promotionTargetClassName =
    classes?.find((c) => c._id === promotionTargetClassId)?.name ?? "Target Class";
  const promotionTargetSessionName =
    sessions?.find((s) => s._id === promotionTargetSessionId)?.name ?? "Target Session";

  const alreadyPromotedStudentsList = useMemo(() => {
    if (!matrix?.students) return [];
    return matrix.students.filter(
      (s) => promotionStudentIds.includes(s._id) && s.promotionStatus?.isPromoted
    );
  }, [matrix, promotionStudentIds]);

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
    <div className="lg:h-screen lg:overflow-hidden flex flex-col bg-surface-200 overflow-x-hidden">
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
        onClose={handleCloseUnifiedEditor}
        onToggle={handleToggleSubject}
        onSetStudentSubjects={handleSetStudentSubjects}
        classes={classes}
        onNotice={showNotice}
        onViewAttestation={handleOpenAttestation}
        initialTab={unifiedInitialTab}
        onStudentArchived={() => handleSelectStudent(null)}
      />

      <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
        {/* Main Bucket - Content Primary */}
        <main className="flex-1 lg:h-full lg:overflow-y-auto custom-scrollbar p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-[1400px] mx-auto space-y-8">
            <div className="space-y-4">
              <AdminHeader
                title="Student Enrollment"
                actions={
                  <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
                    <StatGroup
                      stats={[
                        {
                          label: "Registered",
                          value: matrixSummary.totalStudents,
                          icon: <Users className="h-4 w-4" />,
                        },
                        {
                          label: "Subjects",
                          value: matrixSummary.totalSubjects,
                          icon: <BookOpen className="h-4 w-4" />,
                        },
                        {
                          label: "Session",
                          value: activeSessionName,
                          icon: <Sparkles className="h-4 w-4" />,
                        },
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <Link 
                        href="/students/import"
                        className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition-colors shadow-2xs"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Data Migration
                      </Link>
                      {isMobile && (
                        <Link 
                          href="/academic/students/onboarding"
                          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-right-4 duration-700"
                        >
                          Bulk Onboarding <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                }
              />

              <EnrollmentFilters
                classes={classes}
                sessions={sessions}
                selectedClassId={selectedClassId}
                selectedSessionId={selectedSessionId}
                onClassChange={handleClassChange}
                onSessionChange={handleSessionChange}
              />
            </div>

            <div className="space-y-8">
              {selectedClassId && selectedSessionId ? (
                <>
                  {shouldShowPromotionPanel ? (
                    <StudentPromotionPanel
                      classes={classes}
                      sessions={sessions}
                      selectedCount={promotionStudentIds.length}
                      totalRosterCount={matrix?.students.length ?? 0}
                      promotedCount={promotedStudentsCount}
                      unpromotedCount={unpromotedStudentsCount}
                      graduatedCount={graduatedStudentsCount}
                      sourceClassId={selectedClassId}
                      sourceSessionId={selectedSessionId}
                      targetClassId={promotionTargetClassId}
                      targetSessionId={promotionTargetSessionId}
                      subjectMode={promotionSubjectMode}
                      isPromoting={isPromoting || isGraduating}
                      onTargetClassChange={setPromotionTargetClassId}
                      onTargetSessionChange={setPromotionTargetSessionId}
                      onSubjectModeChange={setPromotionSubjectMode}
                      onSelectAllVisible={handleSelectAllVisibleForPromotion}
                      onSelectUnpromotedOnly={handleSelectUnpromotedOnly}
                      onClearSelection={() => setPromotionStudentIds([])}
                      onPromote={handlePromoteStudents}
                      onGraduate={handleGraduateRequest}
                    />
                  ) : null}
                  <SubjectSelectionMatrix
                    matrix={matrix}
                    totalStudents={matrixSummary.totalStudents}
                    totalSubjects={matrixSummary.totalSubjects}
                    isIssueVisible={matrixSummary.studentsWithNoSubjects > 0}
                    studentsWithNoSubjects={matrixSummary.studentsWithNoSubjects}
                    selectedStudentId={selectedStudentId}
                    promotionStudentIds={promotionStudentIds}
                    isPromotionMode={shouldShowPromotionPanel}
                    onSelectStudent={handleSelectStudent}
                    onTogglePromotionStudent={handleTogglePromotionStudent}
                    onCancelPromotion={handleCancelPromotion}
                    onCancelGraduation={handleCancelGraduation}
                    onViewAttestation={handleOpenAttestation}
                    onOpenUnifiedEditor={openUnifiedEditor}
                    onToggle={handleToggleSubject}
                    onSetStudentSubjects={handleSetStudentSubjects}
                  />
                </>
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
        <aside className="hidden lg:block w-[450px] h-full overflow-y-auto border-l border-slate-200/60 bg-white/40 backdrop-blur-xl custom-scrollbar p-8">
          <div className="space-y-6">
            <div className="sticky top-0 z-10 -mx-2 flex items-center justify-between gap-2 border-b border-slate-200/70 bg-white/90 px-2 pb-3 pt-1 backdrop-blur-xl">
              <button
                type="button"
                onClick={handleNewAdmission}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs font-bold transition-all active:scale-[0.98] ${
                  selectedStudentId
                    ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-slate-900 text-white shadow-lg shadow-slate-950/10"
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                New Admission
              </button>
              <Link
                href="/academic/students/onboarding"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 text-[10px] font-black uppercase tracking-wider text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                Bulk Onboarding <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {selectedStudentId ? (
              <StudentProfileEditor
                studentId={selectedStudentId}
                classes={classes}
                onNotice={showNotice}
                onStudentArchived={() => handleSelectStudent(null)}
                onViewAttestation={handleOpenAttestation}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex rounded-xl bg-slate-100/60 p-1">
                  <button
                    type="button"
                    onClick={() => setCreationTab("quick")}
                    className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${
                      creationTab === "quick"
                        ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Quick Admission
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreationTab("family")}
                    className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${
                      creationTab === "family"
                        ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Family Onboarding
                  </button>
                </div>

                {creationTab === "quick" ? (
                  <StudentCreationForm
                    selectedClassName={selectedClassName}
                    studentFirstName={studentFirstName}
                    studentLastName={studentLastName}
                    admissionNumber={admissionNumber}
                    gender={gender}
                    houseName={houseName}
                    dateOfBirth={dateOfBirth}
                    guardianName={guardianName}
                    guardianPhone={guardianPhone}
                    address={address}
                    photoPreviewUrl={studentPhotoPreviewUrl}
                    photoResetKey={studentPhotoResetKey}
                    isSubmitting={isSubmitting}
                    sectionRef={studentFormRef}
                    inputRef={studentNameInputRef}
                    onStudentFirstNameChange={(v) => setStudentFirstName(humanNameTypingStrict(v))}
                    onStudentFirstNameBlur={(v) => setStudentFirstName(humanNameFinalStrict(v))}
                    onStudentLastNameChange={(v) => setStudentLastName(humanNameTypingStrict(v))}
                    onStudentLastNameBlur={(v) => setStudentLastName(humanNameFinalStrict(v))}
                    onAdmissionNumberChange={setAdmissionNumber}
                    admissionNumberMode={admissionNumberMode}
                    numberingPolicyConfigured={numberingPolicyConfigured}
                    numberingPolicyLoading={admissionNumbering === undefined}
                    numberingPreview={admissionNumbering?.preview ?? null}
                    canOverrideAdmissionNumber={canOverrideAdmissionNumber}
                    overrideReason={overrideReason}
                    overrideConfirmed={overrideConfirmed}
                    overrideCounterDecision={overrideCounterDecision}
                    advanceCounterTo={advanceCounterTo}
                    onAdmissionNumberModeChange={setAdmissionNumberMode}
                    onOverrideReasonChange={setOverrideReason}
                    onOverrideConfirmedChange={setOverrideConfirmed}
                    onOverrideCounterDecisionChange={setOverrideCounterDecision}
                    onAdvanceCounterToChange={setAdvanceCounterTo}
                    onGenderChange={setGender}
                    onHouseNameChange={setHouseName}
                    onDateOfBirthChange={setDateOfBirth}
                    onGuardianNameChange={setGuardianName}
                    onGuardianPhoneChange={setGuardianPhone}
                    onAddressChange={setAddress}
                    onPhotoChange={setStudentPhotoFile}
                    onRemovePhoto={() => setStudentPhotoFile(null)}
                    onPhotoValidationError={(m) => showNotice({ tone: "error", message: m })}
                    onSubmit={handleCreateStudent}
                    classes={classes}
                    selectedClassId={selectedClassId}
                    onClassIdChange={handleClassChange}
                  />
                ) : (
                  <FamilyOnboardingForm
                    selectedClassName={selectedClassName}
                    classes={classes}
                    selectedClassId={selectedClassId}
                    onClassIdChange={handleClassChange}
                    studentFirstName={studentFirstName}
                    onStudentFirstNameChange={(v) => setStudentFirstName(humanNameTypingStrict(v))}
                    onStudentFirstNameBlur={(v) => setStudentFirstName(humanNameFinalStrict(v))}
                    studentLastName={studentLastName}
                    onStudentLastNameChange={(v) => setStudentLastName(humanNameTypingStrict(v))}
                    onStudentLastNameBlur={(v) => setStudentLastName(humanNameFinalStrict(v))}
                    admissionNumber={admissionNumber}
                    onAdmissionNumberChange={setAdmissionNumber}
                    admissionNumberMode={admissionNumberMode}
                    numberingPolicyConfigured={numberingPolicyConfigured}
                    numberingPolicyLoading={admissionNumbering === undefined}
                    numberingPreview={admissionNumbering?.preview ?? null}
                    canOverrideAdmissionNumber={canOverrideAdmissionNumber}
                    overrideReason={overrideReason}
                    overrideConfirmed={overrideConfirmed}
                    overrideCounterDecision={overrideCounterDecision}
                    advanceCounterTo={advanceCounterTo}
                    onAdmissionNumberModeChange={setAdmissionNumberMode}
                    onOverrideReasonChange={setOverrideReason}
                    onOverrideConfirmedChange={setOverrideConfirmed}
                    onOverrideCounterDecisionChange={setOverrideCounterDecision}
                    onAdvanceCounterToChange={setAdvanceCounterTo}
                    gender={gender}
                    onGenderChange={setGender}
                    parentFirstName={parentFirstName}
                    onParentFirstNameChange={(v) => setParentFirstName(humanNameTypingStrict(v))}
                    onParentFirstNameBlur={(v) => setParentFirstName(humanNameFinalStrict(v))}
                    parentLastName={parentLastName}
                    onParentLastNameChange={(v) => setParentLastName(humanNameTypingStrict(v))}
                    onParentLastNameBlur={(v) => setParentLastName(humanNameFinalStrict(v))}
                    parentEmail={parentEmail}
                    onParentEmailChange={setParentEmail}
                    parentPhone={parentPhone}
                    onParentPhoneChange={setParentPhone}
                    parentRelationship={parentRelationship}
                    onParentRelationshipChange={setParentRelationship}
                    isParentPrimaryContact={isParentPrimaryContact}
                    onIsParentPrimaryContactChange={setIsParentPrimaryContact}
                    isSubmitting={isSubmitting}
                    onSubmit={handleCreateStudent}
                    inputRef={studentNameInputRef}
                  />
                )}
              </div>
            )}

            <div className="pt-6 border-t border-slate-200/60 group">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300 group-hover:text-slate-500 transition-colors">Quick Reference</h4>
              <p className="mt-2 text-xs leading-relaxed font-medium text-slate-400">
                Enrollment changes are pushed live. Updates to identity, family links, and subject selections reflect across academic records for the active session.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* MOBILE FAB: New Admission */}
      {isMobile && !isCreationSheetOpen && !isUnifiedSheetOpen && (
        <div className="fixed bottom-8 right-6 z-50">
          <button
            onClick={handleNewAdmission}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xl shadow-slate-950/40 ring-4 ring-white active:scale-95 transition-all"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* MOBILE Creation Sheet */}
      {isMobile && isCreationSheetOpen && (
        <div className="fixed inset-0 z-[70]">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-overlay-fade-in"
            onClick={() => setIsCreationSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-[32px] bg-white shadow-2xl animate-sheet-slide-up ease-out">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-6">
              <div className="space-y-1">
                <h3 className="text-xl font-black tracking-tight text-slate-950">New Admission</h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Enrolling to {selectedClassName}
                </p>
              </div>
              <button 
                onClick={() => setIsCreationSheetOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pb-12 custom-scrollbar">
              <div className="mb-6 flex rounded-xl bg-slate-100/60 p-1">
                <button
                  type="button"
                  onClick={() => setCreationTab("quick")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    creationTab === "quick"
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Quick Admission
                </button>
                <button
                  type="button"
                  onClick={() => setCreationTab("family")}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                    creationTab === "family"
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  Family Onboarding
                </button>
              </div>

              {creationTab === "quick" ? (
                <StudentCreationForm
                  selectedClassName={selectedClassName}
                  studentFirstName={studentFirstName}
                  studentLastName={studentLastName}
                  admissionNumber={admissionNumber}
                  gender={gender}
                  houseName={houseName}
                  dateOfBirth={dateOfBirth}
                  guardianName={guardianName}
                  guardianPhone={guardianPhone}
                  address={address}
                  photoPreviewUrl={studentPhotoPreviewUrl}
                  photoResetKey={studentPhotoResetKey}
                  isSubmitting={isSubmitting}
                  sectionRef={studentFormRef}
                  inputRef={studentNameInputRef}
                  onStudentFirstNameChange={(v) => setStudentFirstName(humanNameTypingStrict(v))}
                  onStudentFirstNameBlur={(v) => setStudentFirstName(humanNameFinalStrict(v))}
                  onStudentLastNameChange={(v) => setStudentLastName(humanNameTypingStrict(v))}
                  onStudentLastNameBlur={(v) => setStudentLastName(humanNameFinalStrict(v))}
                  onAdmissionNumberChange={setAdmissionNumber}
                  admissionNumberMode={admissionNumberMode}
                  numberingPolicyConfigured={numberingPolicyConfigured}
                  numberingPolicyLoading={admissionNumbering === undefined}
                  numberingPreview={admissionNumbering?.preview ?? null}
                  canOverrideAdmissionNumber={canOverrideAdmissionNumber}
                  overrideReason={overrideReason}
                  overrideConfirmed={overrideConfirmed}
                  overrideCounterDecision={overrideCounterDecision}
                  advanceCounterTo={advanceCounterTo}
                  onAdmissionNumberModeChange={setAdmissionNumberMode}
                  onOverrideReasonChange={setOverrideReason}
                  onOverrideConfirmedChange={setOverrideConfirmed}
                  onOverrideCounterDecisionChange={setOverrideCounterDecision}
                  onAdvanceCounterToChange={setAdvanceCounterTo}
                  onGenderChange={setGender}
                  onHouseNameChange={setHouseName}
                  onDateOfBirthChange={setDateOfBirth}
                  onGuardianNameChange={setGuardianName}
                  onGuardianPhoneChange={setGuardianPhone}
                  onAddressChange={setAddress}
                  onPhotoChange={setStudentPhotoFile}
                  onRemovePhoto={() => setStudentPhotoFile(null)}
                  onPhotoValidationError={(m) => showNotice({ tone: "error", message: m })}
                  onSubmit={async (e) => {
                    await handleCreateStudent(e);
                    setIsCreationSheetOpen(false);
                  }}
                  classes={classes}
                  selectedClassId={selectedClassId}
                  onClassIdChange={handleClassChange}
                />
              ) : (
                <FamilyOnboardingForm
                  selectedClassName={selectedClassName}
                  classes={classes}
                  selectedClassId={selectedClassId}
                  onClassIdChange={handleClassChange}
                  studentFirstName={studentFirstName}
                  onStudentFirstNameChange={(v) => setStudentFirstName(humanNameTypingStrict(v))}
                  onStudentFirstNameBlur={(v) => setStudentFirstName(humanNameFinalStrict(v))}
                  studentLastName={studentLastName}
                  onStudentLastNameChange={(v) => setStudentLastName(humanNameTypingStrict(v))}
                  onStudentLastNameBlur={(v) => setStudentLastName(humanNameFinalStrict(v))}
                  admissionNumber={admissionNumber}
                  onAdmissionNumberChange={setAdmissionNumber}
                  admissionNumberMode={admissionNumberMode}
                  numberingPolicyConfigured={numberingPolicyConfigured}
                  numberingPolicyLoading={admissionNumbering === undefined}
                  numberingPreview={admissionNumbering?.preview ?? null}
                  canOverrideAdmissionNumber={canOverrideAdmissionNumber}
                  overrideReason={overrideReason}
                  overrideConfirmed={overrideConfirmed}
                  overrideCounterDecision={overrideCounterDecision}
                  advanceCounterTo={advanceCounterTo}
                  onAdmissionNumberModeChange={setAdmissionNumberMode}
                  onOverrideReasonChange={setOverrideReason}
                  onOverrideConfirmedChange={setOverrideConfirmed}
                  onOverrideCounterDecisionChange={setOverrideCounterDecision}
                  onAdvanceCounterToChange={setAdvanceCounterTo}
                  gender={gender}
                  onGenderChange={setGender}
                  parentFirstName={parentFirstName}
                  onParentFirstNameChange={(v) => setParentFirstName(humanNameTypingStrict(v))}
                  onParentFirstNameBlur={(v) => setParentFirstName(humanNameFinalStrict(v))}
                  parentLastName={parentLastName}
                  onParentLastNameChange={(v) => setParentLastName(humanNameTypingStrict(v))}
                  onParentLastNameBlur={(v) => setParentLastName(humanNameFinalStrict(v))}
                  parentEmail={parentEmail}
                  onParentEmailChange={setParentEmail}
                  parentPhone={parentPhone}
                  onParentPhoneChange={setParentPhone}
                  parentRelationship={parentRelationship}
                  onParentRelationshipChange={setParentRelationship}
                  isParentPrimaryContact={isParentPrimaryContact}
                  onIsParentPrimaryContactChange={setIsParentPrimaryContact}
                  isSubmitting={isSubmitting}
                  onSubmit={async (e) => {
                    await handleCreateStudent(e);
                    setIsCreationSheetOpen(false);
                  }}
                  inputRef={studentNameInputRef}
                />
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDuplicateParentLinkConfirmOpen}
        onClose={() => setIsDuplicateParentLinkConfirmOpen(false)}
        onConfirm={async () => {
          setIsDuplicateParentLinkConfirmOpen(false);
          await submitStudent(true);
        }}
        title="Confirm Existing Parent Link"
        description="This email belongs to an existing parent or staff account. Confirm only if this is the intended household contact."
        confirmLabel="Confirm Link"
        isLoading={isSubmitting}
      />

      {/* Cohort Promotion Confirmation Modal */}
      <PromotionConfirmationModal
        isOpen={isPromotionConfirmOpen}
        onClose={() => setIsPromotionConfirmOpen(false)}
        onConfirm={executePromotion}
        isPromoting={isPromoting}
        studentCount={promotionStudentIds.length}
        sourceClassName={promotionSourceClassName}
        sourceSessionName={promotionSourceSessionName}
        targetClassName={promotionTargetClassName}
        targetSessionName={promotionTargetSessionName}
        subjectMode={promotionSubjectMode}
        alreadyPromotedStudents={alreadyPromotedStudentsList}
      />

      {/* Terminal Cohort Graduation Confirmation Modal */}
      <GraduationConfirmationModal
        isOpen={isGraduationConfirmOpen}
        onClose={() => setIsGraduationConfirmOpen(false)}
        onConfirm={executeGraduation}
        isGraduating={isGraduating}
        studentCount={promotionStudentIds.length}
        sourceClassName={promotionSourceClassName}
        sourceSessionName={promotionSourceSessionName}
        graduationDate={graduationDraft.graduationDate ?? stableGraduationDate}
        certificateNumber={graduationDraft.certificateNumber}
        honorsOrRemarks={graduationDraft.honorsOrRemarks}
      />

      {/* Official Letter of Attestation Modal */}
      <AttestationLetterModal
        isOpen={isAttestationModalOpen}
        onClose={() => {
          setIsAttestationModalOpen(false);
          setAttestationStudentId(null);
        }}
        data={attestationData ?? null}
      />

      {/* Cancel Staged Promotion Confirmation Dialog */}
      <ConfirmationModal
        isOpen={Boolean(cancellingPromotionStudent)}
        onClose={() => setCancellingPromotionStudent(null)}
        onConfirm={executeCancelPromotion}
        title="Cancel Staged Promotion"
        description={`Are you sure you want to cancel the staged promotion for ${cancellingPromotionStudent?.studentName}? The student will remain enrolled in their current class.`}
        confirmLabel="Cancel Promotion"
        confirmVariant="danger"
        isLoading={isCancellingPromotion}
      />

      {/* Cancel Graduation Confirmation Dialog */}
      <ConfirmationModal
        isOpen={Boolean(cancellingGraduationStudent)}
        onClose={() => setCancellingGraduationStudent(null)}
        onConfirm={executeCancelGraduation}
        title="Cancel Graduation"
        description={`Are you sure you want to cancel graduation and restore active enrollment status for ${cancellingGraduationStudent?.studentName}?`}
        confirmLabel="Restore Active Status"
        confirmVariant="danger"
        isLoading={isCancellingGraduation}
      />
    </div>
  );
}

function joinFieldLabels(fields: string[]) {
  if (fields.length === 0) return "";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}
