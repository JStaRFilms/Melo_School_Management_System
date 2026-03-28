"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";

import { FloatingNotice } from "../components/FloatingNotice";
import { uploadStudentPhoto } from "../components/studentPhotoUpload";
import type { ClassSummary, EnrollmentNotice } from "../components/types";
import { StudentFirstOnboardingForm } from "./StudentFirstOnboardingForm";

export default function StudentOnboardingPage() {
  const classes = useQuery(
    "functions/academic/academicSetup:listClasses" as never
  ) as ClassSummary[] | undefined;
  const createStudent = useMutation(
    "functions/academic/studentEnrollment:createStudent" as never
  );
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never
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
      <div className="mx-auto max-w-5xl px-4 py-6 text-slate-500 md:px-6">
        Loading onboarding...
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
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedFirstName = humanNameFinalStrict(firstName);
    const normalizedLastName = humanNameFinalStrict(lastName);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !admissionNumber.trim() ||
      !gender.trim() ||
      !selectedClassId
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

      await createStudent({
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
      } as never);

      const selectedClassName =
        classes.find((classDoc) => classDoc._id === selectedClassId)?.name ?? "the class";
      resetForm();
      setNotice({
        tone: "success",
        message: `${normalizedFirstName} ${normalizedLastName} was added to ${selectedClassName}.`,
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
    <>
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
    </>
  );
}
