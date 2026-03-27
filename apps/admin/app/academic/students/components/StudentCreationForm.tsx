"use client";

import type { FormEvent, RefObject } from "react";

import { UserPlus } from "lucide-react";

import { StudentCreationOptionalFields } from "./StudentCreationOptionalFields";
import { StudentPhotoPanel } from "./StudentPhotoPanel";

interface StudentCreationFormProps {
  selectedClassName: string;
  studentName: string;
  admissionNumber: string;
  gender: string;
  houseName: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  photoPreviewUrl: string | null;
  isSubmitting: boolean;
  variant?: "inline" | "sheet";
  sectionRef: RefObject<HTMLElement>;
  inputRef: RefObject<HTMLInputElement>;
  onStudentNameChange: (value: string) => void;
  onStudentNameBlur: (value: string) => void;
  onAdmissionNumberChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onHouseNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onGuardianNameChange: (value: string) => void;
  onGuardianPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onPhotoChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  onPhotoValidationError: (message: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

export function StudentCreationForm({
  selectedClassName,
  studentName,
  admissionNumber,
  gender,
  houseName,
  dateOfBirth,
  guardianName,
  guardianPhone,
  address,
  photoPreviewUrl,
  isSubmitting,
  variant = "inline",
  sectionRef,
  inputRef,
  onStudentNameChange,
  onStudentNameBlur,
  onAdmissionNumberChange,
  onGenderChange,
  onHouseNameChange,
  onDateOfBirthChange,
  onGuardianNameChange,
  onGuardianPhoneChange,
  onAddressChange,
  onPhotoChange,
  onRemovePhoto,
  onPhotoValidationError,
  onSubmit,
}: StudentCreationFormProps) {
  const isSheet = variant === "sheet";

  return (
    <section
      ref={sectionRef}
      className={
        isSheet
          ? "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
          : "scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      }
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-[0.16em] text-slate-950">
            Add Student
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Add a student to <span className="font-semibold text-slate-700">{selectedClassName}</span>.
            Teachers will only edit subject ticks after this step.
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Student name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={studentName}
              onChange={(event) => onStudentNameChange(event.target.value)}
              onBlur={(event) => onStudentNameBlur(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]"
              placeholder="Maryam Hassan"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Admission no.
            </label>
            <input
              type="text"
              value={admissionNumber}
              onChange={(event) => onAdmissionNumberChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]"
              placeholder="4A-0951"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Gender
            </label>
            <select
              value={gender}
              onChange={(event) => onGenderChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]"
              required
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              Class
            </label>
            <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              {selectedClassName}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
          <StudentCreationOptionalFields
            houseName={houseName}
            dateOfBirth={dateOfBirth}
            guardianName={guardianName}
            guardianPhone={guardianPhone}
            address={address}
            onHouseNameChange={onHouseNameChange}
            onDateOfBirthChange={onDateOfBirthChange}
            onGuardianNameChange={onGuardianNameChange}
            onGuardianPhoneChange={onGuardianPhoneChange}
            onAddressChange={onAddressChange}
          />
          <StudentPhotoPanel
            name={studentName || "Student photo"}
            previewUrl={photoPreviewUrl}
            onPhotoChange={onPhotoChange}
            onRemovePhoto={onRemovePhoto}
            helperText="Optional. JPG/PNG up to 1 MB."
            onValidationError={onPhotoValidationError}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {isSheet
              ? "Save the student and they will show up in the subject list immediately."
              : "Students appear in the grid immediately after they are created."}
          </p>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !studentName.trim() ||
              !admissionNumber.trim() ||
              !gender.trim()
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 text-white/70" />
            {isSubmitting ? "Adding..." : "Add Student"}
          </button>
        </div>
      </form>
    </section>
  );
}
