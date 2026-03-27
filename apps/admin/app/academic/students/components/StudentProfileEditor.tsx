"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";

import type { ClassSummary, EnrollmentNotice } from "./types";

interface StudentProfileEditorProps {
  studentId: string | null;
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
}

type StudentProfile = {
  _id: string;
  name: string;
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

  const [name, setName] = useState("");
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

    setName(studentProfile.name);
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

  useEffect(() => {
    return () => {
      if (photoFile) {
        URL.revokeObjectURL(previewUrl ?? "");
      }
    };
  }, [photoFile, previewUrl]);

  if (!studentId) {
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
      let uploadedPhotoMetadata: {
        storageId: string;
        fileName: string;
        contentType: string;
      } | null = null;

      if (photoFile) {
        if (!photoFile.type.startsWith("image/")) {
          throw new Error("Student photo must be an image file");
        }

        const uploadUrl = (await generateStudentPhotoUploadUrl({} as never)) as string;
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": photoFile.type },
          body: photoFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Photo upload failed");
        }

        const uploadPayload = (await uploadResponse.json()) as { storageId: string };
        if (!uploadPayload.storageId) {
          throw new Error("Photo upload failed");
        }

        uploadedPhotoMetadata = {
          storageId: uploadPayload.storageId,
          fileName: photoFile.name,
          contentType: photoFile.type,
        };
        uploadedPhoto = true;
      }

      await updateStudent({
        studentId,
        name,
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
        message: `${name} was updated successfully.`,
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-950">
          Edit Student Profile
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Update full student details, including the report-card photo.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Student Name"><input value={name} onChange={(event) => setName(event.target.value)} className={fieldInputClassName} /></Field>
          <Field label="Admission No."><input value={admissionNumber} onChange={(event) => setAdmissionNumber(event.target.value)} className={fieldInputClassName} /></Field>
          <Field label="Class">
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className={fieldInputClassName}>
              {classes.map((classDoc) => (
                <option key={classDoc._id} value={classDoc._id}>{classDoc.name}</option>
              ))}
            </select>
          </Field>
          <Field label="House"><input value={houseName} onChange={(event) => setHouseName(event.target.value)} className={fieldInputClassName} placeholder="Blue House" /></Field>
          <Field label="Gender"><input value={gender} onChange={(event) => setGender(event.target.value)} className={fieldInputClassName} placeholder="Female" /></Field>
          <Field label="Date of Birth"><input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={fieldInputClassName} /></Field>
          <Field label="Guardian Name"><input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} className={fieldInputClassName} /></Field>
          <Field label="Guardian Phone"><input value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} className={fieldInputClassName} /></Field>
          <Field label="Address"><input value={address} onChange={(event) => setAddress(event.target.value)} className={fieldInputClassName} /></Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Student Photo
          </p>
          {previewUrl ? (
            <img src={previewUrl} alt={name} className="h-44 w-full rounded-2xl object-cover" />
          ) : (
            <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              No Photo
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPhotoFile(file);
              setClearPhoto(false);
            }}
            className="block w-full text-xs text-slate-500"
          />
          <button
            type="button"
            onClick={() => {
              setPhotoFile(null);
              setClearPhoto(true);
            }}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
          >
            Remove Photo
          </button>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || !name.trim() || !admissionNumber.trim() || !classId}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Student"}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldInputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]";
