"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isValidEmailAddress } from "@school/auth";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";

import { useAuth } from "@/AuthProvider";
import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";

import type { AdmissionCounterDecision } from "../components/AdmissionNumberGovernanceFields";
import { uploadStudentPhoto } from "../components/studentPhotoUpload";
import type { ClassSummary, EnrollmentNotice } from "../components/types";
import { StudentFirstOnboardingForm } from "./StudentFirstOnboardingForm";

type PortalCredentialResult = {
  userId: string;
  email: string;
  temporaryPassword: string;
};

type FamilyLinkResult = {
  familyId: string;
  parentUserId: string;
  familyMemberId: string;
};

export default function StudentOnboardingPage() {
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
  const createStudent = useMutation(
    "functions/academic/studentEnrollment:createStudent" as never
  );
  const upsertStudentFamilyLink = useMutation(
    "functions/academic/studentEnrollment:upsertStudentFamilyLink" as never
  );
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never
  );
  const upsertPortalCredentials = useAction(
    "functions/academic/studentEnrollment:upsertPortalCredentials" as never
  );
  const upsertStudentPortalCredentialsByStudentId = useAction(
    "functions/academic/studentEnrollment:upsertStudentPortalCredentialsByStudentId" as never
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [studentPhotoResetKey, setStudentPhotoResetKey] = useState(0);
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [isParentPrimaryContact, setIsParentPrimaryContact] = useState(true);
  const [provisionStudentPortalAccess, setProvisionStudentPortalAccess] = useState(false);
  const [provisionParentPortalAccess, setProvisionParentPortalAccess] = useState(false);
  const [studentTemporaryPassword, setStudentTemporaryPassword] = useState("Student123!Pass");
  const [parentTemporaryPassword, setParentTemporaryPassword] = useState("Parent123!Pass");
  const [credentialSummary, setCredentialSummary] = useState<{
    student: { email: string; temporaryPassword: string } | null;
    parent: { email: string; temporaryPassword: string } | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);


  const showNotice = (notice: { tone: "success" | "error" | "warning"; title?: string; message: string }) => {
    const title = notice.title ?? (notice.tone === "success" ? "Success" : notice.tone === "warning" ? "Review required" : "Something went wrong");

    if (notice.tone === "success") {
      appToast.success(title, { description: notice.message });
      return;
    }

    if (notice.tone === "warning") {
      appToast.warning(title, { description: notice.message });
      return;
    }

    appToast.error(title, { description: notice.message });
  };

  const photoPreviewUrl = useMemo(() => {
    if (!studentPhotoFile) {
      return null;
    }

    return URL.createObjectURL(studentPhotoFile);
  }, [studentPhotoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  if (classes === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto rounded-xl bg-slate-100 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Loading onboarding
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFirstName("");
    setLastName("");
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
    setSelectedClassId("");
    setStudentPhotoFile(null);
    setStudentPhotoResetKey((key) => key + 1);
    setParentFirstName("");
    setParentLastName("");
    setParentEmail("");
    setParentPhone("");
    setParentRelationship("");
    setIsParentPrimaryContact(true);
    setProvisionStudentPortalAccess(false);
    setProvisionParentPortalAccess(false);
    setStudentTemporaryPassword("Student123!Pass");
    setParentTemporaryPassword("Parent123!Pass");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedFirstName = humanNameFinalStrict(firstName);
    const normalizedLastName = humanNameFinalStrict(lastName);
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

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      admissionNumbering === undefined ||
      (!useAutomaticAdmissionNumber && !admissionNumber.trim()) ||
      !gender.trim() ||
      !selectedClassId
    ) {
      return;
    }

    if (shouldLinkParent) {
      if (!normalizedParentFirstName || !normalizedParentLastName || !normalizedParentEmail) {
        showNotice({
          tone: "error",
          message: "Parent first name, last name, and email are required when linking a parent during onboarding.",
        });
        return;
      }

      if (!isValidEmailAddress(normalizedParentEmail)) {
        showNotice({
          tone: "error",
          message: "Enter a valid parent email address before linking portal access.",
        });
        return;
      }
    }

    if (provisionParentPortalAccess && !shouldLinkParent) {
      showNotice({
        tone: "error",
        message: "Link a parent first before provisioning parent portal access.",
      });
      return;
    }

    if (provisionStudentPortalAccess && !studentTemporaryPassword.trim()) {
      showNotice({
        tone: "error",
        message: "Student portal access needs a temporary password.",
      });
      return;
    }

    if (provisionParentPortalAccess && !parentTemporaryPassword.trim()) {
      showNotice({
        tone: "error",
        message: "Parent portal access needs a temporary password.",
      });
      return;
    }

    setIsSubmitting(true);
    
    setCredentialSummary(null);

    let uploadedPhoto = false;
    try {
      const uploadedPhotoMetadata = studentPhotoFile
        ? await uploadStudentPhoto(studentPhotoFile, () =>
            generateStudentPhotoUploadUrl({} as never) as Promise<string>
          )
        : null;
      uploadedPhoto = Boolean(uploadedPhotoMetadata);

      const createdStudentId = (await createStudent({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
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
        houseName: houseName.trim() || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: guardianName.trim() || null,
        guardianPhone: guardianPhone.trim() || null,
        address: address.trim() || null,
        photoStorageId: uploadedPhotoMetadata?.storageId,
        photoFileName: uploadedPhotoMetadata?.fileName,
        photoContentType: uploadedPhotoMetadata?.contentType,
      } as never)) as string;

      let familyLinkResult: FamilyLinkResult | null = null;
      if (shouldLinkParent && normalizedParentFirstName && normalizedParentLastName) {
        familyLinkResult = (await upsertStudentFamilyLink({
          studentId: createdStudentId,
          firstName: normalizedParentFirstName,
          lastName: normalizedParentLastName,
          email: normalizedParentEmail,
          phone: parentPhone.trim() || null,
          relationship: parentRelationship.trim() || null,
          isPrimaryContact: isParentPrimaryContact,
        } as never)) as FamilyLinkResult;
      }

      let studentCredentialResult: PortalCredentialResult | null = null;
      if (provisionStudentPortalAccess) {
        studentCredentialResult = (await upsertStudentPortalCredentialsByStudentId({
          studentId: createdStudentId,
          temporaryPassword: studentTemporaryPassword.trim(),
        } as never)) as PortalCredentialResult;
      }

      let parentCredentialResult: PortalCredentialResult | null = null;
      if (provisionParentPortalAccess && familyLinkResult) {
        parentCredentialResult = (await upsertPortalCredentials({
          userId: familyLinkResult.parentUserId,
          temporaryPassword: parentTemporaryPassword.trim(),
        } as never)) as PortalCredentialResult;
      }

      const selectedClassName =
        classes.find((classDoc) => classDoc._id === selectedClassId)?.name ?? "the class";

      setCredentialSummary({
        student: studentCredentialResult
          ? {
              email: studentCredentialResult.email,
              temporaryPassword: studentCredentialResult.temporaryPassword,
            }
          : null,
        parent: parentCredentialResult
          ? {
              email: parentCredentialResult.email,
              temporaryPassword: parentCredentialResult.temporaryPassword,
            }
          : null,
      });

      resetForm();
      showNotice({
        tone: "success",
        message: `${normalizedFirstName} ${normalizedLastName} enrolled to ${selectedClassName}${shouldLinkParent ? " · parent linked" : ""}${provisionStudentPortalAccess || provisionParentPortalAccess ? " · portal ready" : ""}.`,
      });
      firstNameInputRef.current?.focus();
    } catch (error) {
      showNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          error,
          uploadedPhoto
            ? "The photo uploaded, but we couldn't finish creating the student."
            : "We couldn't create the student right now."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StudentFirstOnboardingForm
      classes={classes}
      selectedClassId={selectedClassId}
      firstName={firstName}
      lastName={lastName}
      admissionNumber={admissionNumber}
      admissionNumberMode={admissionNumberMode}
      numberingPolicyConfigured={numberingPolicyConfigured}
      numberingPolicyLoading={admissionNumbering === undefined}
      numberingPreview={admissionNumbering?.preview ?? null}
      canOverrideAdmissionNumber={canOverrideAdmissionNumber}
      overrideReason={overrideReason}
      overrideConfirmed={overrideConfirmed}
      overrideCounterDecision={overrideCounterDecision}
      advanceCounterTo={advanceCounterTo}
      gender={gender}
      houseName={houseName}
      dateOfBirth={dateOfBirth}
      guardianName={guardianName}
      guardianPhone={guardianPhone}
      address={address}
      parentFirstName={parentFirstName}
      parentLastName={parentLastName}
      parentEmail={parentEmail}
      parentPhone={parentPhone}
      parentRelationship={parentRelationship}
      isParentPrimaryContact={isParentPrimaryContact}
      provisionStudentPortalAccess={provisionStudentPortalAccess}
      provisionParentPortalAccess={provisionParentPortalAccess}
      studentTemporaryPassword={studentTemporaryPassword}
      parentTemporaryPassword={parentTemporaryPassword}
      credentialSummary={credentialSummary}
      photoPreviewUrl={photoPreviewUrl}
      photoResetKey={studentPhotoResetKey}
      isSubmitting={isSubmitting}
      firstNameInputRef={firstNameInputRef}
      onFirstNameChange={(value) => setFirstName(value)}
      onFirstNameBlur={(value) => setFirstName(humanNameFinalStrict(value))}
      onLastNameChange={(value) => setLastName(value)}
      onLastNameBlur={(value) => setLastName(humanNameFinalStrict(value))}
      onAdmissionNumberChange={setAdmissionNumber}
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
      onParentFirstNameChange={(value) => setParentFirstName(value)}
      onParentLastNameChange={(value) => setParentLastName(value)}
      onParentEmailChange={setParentEmail}
      onParentPhoneChange={setParentPhone}
      onParentRelationshipChange={setParentRelationship}
      onIsParentPrimaryContactChange={setIsParentPrimaryContact}
      onProvisionStudentPortalAccessChange={setProvisionStudentPortalAccess}
      onProvisionParentPortalAccessChange={setProvisionParentPortalAccess}
      onStudentTemporaryPasswordChange={setStudentTemporaryPassword}
      onParentTemporaryPasswordChange={setParentTemporaryPassword}
      onClassIdChange={setSelectedClassId}
      onPhotoChange={setStudentPhotoFile}
      onRemovePhoto={() => setStudentPhotoFile(null)}
      onPhotoValidationError={(message) =>
        showNotice({
          tone: "error",
          message,
        })
      }
      onReset={resetForm}
      onSubmit={handleSubmit}
    />
  );
}

