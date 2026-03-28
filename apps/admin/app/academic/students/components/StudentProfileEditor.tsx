"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

import { StudentPhotoPanel } from "./StudentPhotoPanel";
import { StudentProfileFormFields } from "./StudentProfileFormFields";
import { uploadStudentPhoto } from "./studentPhotoUpload";
import type { ClassSummary, EnrollmentNotice } from "./types";

interface StudentProfileEditorProps {
  studentId: string | null;
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
  variant?: "inline" | "sheet";
}

type StudentProfile = {
  _id: string;
  name: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  admissionNumber: string;
  classId: string;
  className: string;
  houseName: string | null;
  gender: string | null;
  dateOfBirth: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  address: string | null;
  photoUrl: string | null;
  photoFileName: string | null;
  photoContentType: string | null;
};

function toDateInput(value: number | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function StudentProfileEditor({
  studentId,
  classes,
  onNotice,
  variant = "inline",
}: StudentProfileEditorProps) {
  const studentProfile = useQuery(
    "functions/academic/studentEnrollment:getStudentProfile" as never,
    studentId ? ({ studentId } as never) : ("skip" as never)
  ) as StudentProfile | undefined;
  const updateStudent = useMutation(
    "functions/academic/studentEnrollment:updateStudent" as never
  );
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!studentProfile) {
      return;
    }

    setFirstName(studentProfile.firstName ?? "");
    setLastName(studentProfile.lastName ?? "");
    setAdmissionNumber(studentProfile.admissionNumber);
    setClassId(studentProfile.classId);
    setHouseName(studentProfile.houseName ?? "");
    setGender(studentProfile.gender ?? "");
    setDateOfBirth(toDateInput(studentProfile.dateOfBirth));
    setGuardianName(studentProfile.guardianName ?? "");
    setGuardianPhone(studentProfile.guardianPhone ?? "");
    setAddress(studentProfile.address ?? "");
    setPhotoFile(null);
    setClearPhoto(false);
  }, [studentProfile]);

  const previewUrl = useMemo(() => {
    if (photoFile) {
      return URL.createObjectURL(photoFile);
    }

    if (clearPhoto) {
      return null;
    }

    return studentProfile?.photoUrl ?? null;
  }, [clearPhoto, photoFile, studentProfile?.photoUrl]);

  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || studentProfile?.displayName || "Unnamed Student";

  useEffect(() => {
    return () => {
      if (photoFile) {
        URL.revokeObjectURL(previewUrl ?? "");
      }
    };
  }, [photoFile, previewUrl]);

  if (!studentId) {
    if (variant === "sheet") {
      return null;
    }

    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
        Select a student from the grid to edit full profile details.
      </section>
    );
  }

  if (studentProfile === undefined) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Loading student profile...
      </section>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    let uploadedPhoto = false;
    try {
      const uploadedPhotoMetadata = photoFile
        ? await uploadStudentPhoto(photoFile, () =>
            generateStudentPhotoUploadUrl({} as never) as Promise<string>
          )
        : null;
      uploadedPhoto = Boolean(uploadedPhotoMetadata);

      await updateStudent({
        studentId,
        name: displayName,
        firstName,
        lastName,
        admissionNumber,
        classId,
        houseName: houseName || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: guardianName || null,
        guardianPhone: guardianPhone || null,
        address: address || null,
        photoStorageId: clearPhoto
          ? null
          : uploadedPhotoMetadata?.storageId ?? undefined,
        photoFileName: clearPhoto
          ? null
          : uploadedPhotoMetadata?.fileName ?? undefined,
        photoContentType: clearPhoto
          ? null
          : uploadedPhotoMetadata?.contentType ?? undefined,
      } as never);

      onNotice({
        tone: "success",
        message: `${displayName} was updated successfully.`,
      });
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          error,
          uploadedPhoto
            ? "The photo uploaded, but we couldn't finish saving the student profile."
            : "We couldn't save the student profile right now."
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      className={
        variant === "sheet"
          ? "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
          : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      }
    >
      <div className="mb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-950">
          Edit Student Profile
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Update full student details, including the report-card photo.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <StudentProfileFormFields
          firstName={firstName}
          lastName={lastName}
          admissionNumber={admissionNumber}
          classId={classId}
          houseName={houseName}
          gender={gender}
          dateOfBirth={dateOfBirth}
          guardianName={guardianName}
          guardianPhone={guardianPhone}
          address={address}
          classes={classes}
          onFirstNameChange={setFirstName}
          onLastNameChange={setLastName}
          onAdmissionNumberChange={setAdmissionNumber}
          onClassIdChange={setClassId}
          onHouseNameChange={setHouseName}
          onGenderChange={setGender}
          onDateOfBirthChange={setDateOfBirth}
          onGuardianNameChange={setGuardianName}
          onGuardianPhoneChange={setGuardianPhone}
          onAddressChange={setAddress}
        />
        <StudentPhotoPanel
          name={displayName}
          previewUrl={previewUrl}
          onPhotoChange={(file) => {
            setPhotoFile(file);
            setClearPhoto(false);
          }}
          onRemovePhoto={() => {
            setPhotoFile(null);
            setClearPhoto(true);
          }}
          onValidationError={(message) =>
            onNotice({
              tone: "error",
              message,
            })
          }
        />
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !firstName.trim() || !lastName.trim() || !admissionNumber.trim() || !classId}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Student"}
        </button>
      </div>
    </section>
  );
}
