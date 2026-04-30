"use client";

import { Sparkles,UserPlus } from "lucide-react";
import type { FormEvent,RefObject } from "react";
import { StudentCreationOptionalFields } from "./StudentCreationOptionalFields";
import { StudentPhotoPanel } from "./StudentPhotoPanel";
import type { ClassSummary } from "./types";

interface StudentCreationFormProps {
  selectedClassName: string;
  studentFirstName: string;
  studentLastName: string;
  admissionNumber: string;
  gender: string;
  houseName: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  photoPreviewUrl: string | null;
  isSubmitting: boolean;
  classes?: ClassSummary[];
  selectedClassId?: string | null;
  onClassIdChange?: (value: string) => void;
  variant?: "inline" | "sheet";
  sectionRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement>;
  onStudentFirstNameChange: (value: string) => void;
  onStudentFirstNameBlur: (value: string) => void;
  onStudentLastNameChange: (value: string) => void;
  onStudentLastNameBlur: (value: string) => void;
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
  studentFirstName,
  studentLastName,
  admissionNumber,
  gender,
  houseName,
  dateOfBirth,
  guardianName,
  guardianPhone,
  address,
  photoPreviewUrl,
  isSubmitting,
  classes,
  selectedClassId,
  onClassIdChange,
  sectionRef,
  inputRef,
  onStudentFirstNameChange,
  onStudentFirstNameBlur,
  onStudentLastNameChange,
  onStudentLastNameBlur,
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
        {!selectedClassId && classes && onClassIdChange && (
          <div className="animate-in fade-in slide-in-from-top-1">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Target Class
            </label>
            <select
              value={selectedClassId ?? ""}
              onChange={(e) => onClassIdChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-indigo-100 bg-indigo-50/30 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5"
              required
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                First Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={studentFirstName}
                onChange={(event) => onStudentFirstNameChange(event.target.value)}
                onBlur={(event) => onStudentFirstNameBlur(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white/50 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 placeholder:text-slate-300"
                placeholder="Maryam"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Last Name
              </label>
              <input
                type="text"
                value={studentLastName}
                onChange={(event) => onStudentLastNameChange(event.target.value)}
                onBlur={(event) => onStudentLastNameBlur(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white/50 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 placeholder:text-slate-300"
                placeholder="Hassan"
                required
              />
            </div>
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
          name={[studentFirstName, studentLastName].filter(Boolean).join(" ") || "Student photo"}
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
              !studentFirstName.trim() ||
              !studentLastName.trim() ||
              !admissionNumber.trim() ||
              !gender.trim() ||
              (!selectedClassId && !classes)
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
