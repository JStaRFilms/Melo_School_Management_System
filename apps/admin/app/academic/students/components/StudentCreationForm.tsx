"use client";

import type { FormEvent, RefObject } from "react";
import { UserPlus, Sparkles } from "lucide-react";
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
  sectionRef: RefObject<HTMLDivElement>;
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
  return (
    <div ref={sectionRef} className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <UserPlus className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
            New Admission
          </h2>
        </div>
        <p className="text-xs font-medium text-slate-500">
          Enrolling to <span className="font-bold text-slate-900">{selectedClassName}</span>. Profile details can be updated later.
        </p>
      </div>

      <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Student Full Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={studentName}
              onChange={(event) => onStudentNameChange(event.target.value)}
              onBlur={(event) => onStudentNameBlur(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/50 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 placeholder:text-slate-300"
              placeholder="e.g. Maryam Hassan"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Admission ID
              </label>
              <input
                type="text"
                value={admissionNumber}
                onChange={(event) => onAdmissionNumberChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white/50 px-3 font-mono text-xs font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 placeholder:text-slate-300"
                placeholder="4A-0951"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Gender
              </label>
              <select
                value={gender}
                onChange={(event) => onGenderChange(event.target.value)}
                className="h-10 w-auto min-w-full rounded-lg border border-slate-200 bg-white/50 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5"
                required
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
        </div>

        <StudentPhotoPanel
          name={studentName || "Student photo"}
          previewUrl={photoPreviewUrl}
          onPhotoChange={onPhotoChange}
          onRemovePhoto={onRemovePhoto}
          helperText="Passport photo (Optional)"
          onValidationError={onPhotoValidationError}
        />

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

        <div className="pt-2">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !studentName.trim() ||
              !admissionNumber.trim() ||
              !gender.trim()
            }
            className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>{isSubmitting ? "Processing..." : "Complete Admission"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
