"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isValidEmailAddress } from "@school/auth";
import { getUserFacingErrorMessage } from "@school/shared";

import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";

import { FloatingNotice } from "../components/FloatingNotice";
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
  const [gender, setGender] = useState("");
  const [houseName, setHouseName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
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
  const [notice, setNotice] = useState<EnrollmentNotice | null>(null);

  const firstNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

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
    setGender("");
    setHouseName("");
    setDateOfBirth("");
    setGuardianName("");
    setGuardianPhone("");
    setAddress("");
    setSelectedClassId("");
    setStudentPhotoFile(null);
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
      !admissionNumber.trim() ||
      !gender.trim() ||
      !selectedClassId
    ) {
      return;
    }

    if (shouldLinkParent) {
      if (!normalizedParentFirstName || !normalizedParentLastName || !normalizedParentEmail) {
        setNotice({
          tone: "error",
          message: "Parent first name, last name, and email are required when linking a parent during onboarding.",
        });
        return;
      }

      if (!isValidEmailAddress(normalizedParentEmail)) {
        setNotice({
          tone: "error",
          message: "Enter a valid parent email address before linking portal access.",
        });
        return;
      }
    }

    if (provisionParentPortalAccess && !shouldLinkParent) {
      setNotice({
        tone: "error",
        message: "Link a parent first before provisioning parent portal access.",
      });
      return;
    }

    if (provisionStudentPortalAccess && !studentTemporaryPassword.trim()) {
      setNotice({
        tone: "error",
        message: "Student portal access needs a temporary password.",
      });
      return;
    }

    if (provisionParentPortalAccess && !parentTemporaryPassword.trim()) {
      setNotice({
        tone: "error",
        message: "Parent portal access needs a temporary password.",
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
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
        admissionNumber: admissionNumber.trim(),
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
      setNotice({
        tone: "success",
        message: `${normalizedFirstName} ${normalizedLastName} enrolled to ${selectedClassName}${shouldLinkParent ? " · parent linked" : ""}${provisionStudentPortalAccess || provisionParentPortalAccess ? " · portal ready" : ""}.`,
      });
      firstNameInputRef.current?.focus();
    } catch (error) {
      setNotice({
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
    <div className="h-screen flex flex-col">
      <FloatingNotice notice={notice} onDismiss={() => setNotice(null)} />
      <StudentFirstOnboardingForm
        classes={classes}
        selectedClassId={selectedClassId}
        firstName={firstName}
        lastName={lastName}
        admissionNumber={admissionNumber}
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
        isSubmitting={isSubmitting}
        firstNameInputRef={firstNameInputRef}
        onFirstNameChange={(value) => setFirstName(humanNameTypingStrict(value))}
        onFirstNameBlur={(value) => setFirstName(humanNameFinalStrict(value))}
        onLastNameChange={(value) => setLastName(humanNameTypingStrict(value))}
        onLastNameBlur={(value) => setLastName(humanNameFinalStrict(value))}
        onAdmissionNumberChange={setAdmissionNumber}
        onGenderChange={setGender}
        onHouseNameChange={setHouseName}
        onDateOfBirthChange={setDateOfBirth}
        onGuardianNameChange={setGuardianName}
        onGuardianPhoneChange={setGuardianPhone}
        onAddressChange={setAddress}
        onParentFirstNameChange={(value) => setParentFirstName(humanNameTypingStrict(value))}
        onParentLastNameChange={(value) => setParentLastName(humanNameTypingStrict(value))}
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
          setNotice({
            tone: "error",
            message,
          })
        }
        onSubmit={handleSubmit}
      />
    </div>
  );
}

