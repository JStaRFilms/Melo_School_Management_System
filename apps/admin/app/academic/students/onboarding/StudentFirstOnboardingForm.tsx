"use client";

import type { FormEvent, ReactNode, RefObject } from "react";

import { ArrowLeft, CheckCircle2, UserPlus } from "lucide-react";
import Link from "next/link";

import { StudentCreationOptionalFields } from "../components/StudentCreationOptionalFields";
import { StudentPhotoPanel } from "../components/StudentPhotoPanel";
import type { ClassSummary } from "../components/types";

type OnboardingCredentialSummary = {
  student: {
    email: string;
    temporaryPassword: string;
  } | null;
  parent: {
    email: string;
    temporaryPassword: string;
  } | null;
};

type StudentFirstOnboardingFormProps = {
  classes: ClassSummary[];
  selectedClassId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  gender: string;
  houseName: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;
  provisionStudentPortalAccess: boolean;
  provisionParentPortalAccess: boolean;
  studentTemporaryPassword: string;
  parentTemporaryPassword: string;
  credentialSummary: OnboardingCredentialSummary | null;
  photoPreviewUrl: string | null;
  isSubmitting: boolean;
  firstNameInputRef: RefObject<HTMLInputElement>;
  onFirstNameChange: (value: string) => void;
  onFirstNameBlur: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onLastNameBlur: (value: string) => void;
  onAdmissionNumberChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onHouseNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onGuardianNameChange: (value: string) => void;
  onGuardianPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onParentFirstNameChange: (value: string) => void;
  onParentLastNameChange: (value: string) => void;
  onParentEmailChange: (value: string) => void;
  onParentPhoneChange: (value: string) => void;
  onParentRelationshipChange: (value: string) => void;
  onProvisionStudentPortalAccessChange: (value: boolean) => void;
  onProvisionParentPortalAccessChange: (value: boolean) => void;
  onStudentTemporaryPasswordChange: (value: string) => void;
  onParentTemporaryPasswordChange: (value: string) => void;
  onClassIdChange: (value: string) => void;
  onPhotoChange: (file: File | null) => void;
  onRemovePhoto: () => void;
  onPhotoValidationError: (message: string) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
};

const orderedLevels = ["Nursery", "Primary", "Secondary"];

export function StudentFirstOnboardingForm({
  classes,
  selectedClassId,
  firstName,
  lastName,
  admissionNumber,
  gender,
  houseName,
  dateOfBirth,
  guardianName,
  guardianPhone,
  address,
  parentFirstName,
  parentLastName,
  parentEmail,
  parentPhone,
  parentRelationship,
  provisionStudentPortalAccess,
  provisionParentPortalAccess,
  studentTemporaryPassword,
  parentTemporaryPassword,
  credentialSummary,
  photoPreviewUrl,
  isSubmitting,
  firstNameInputRef,
  onFirstNameChange,
  onFirstNameBlur,
  onLastNameChange,
  onLastNameBlur,
  onAdmissionNumberChange,
  onGenderChange,
  onHouseNameChange,
  onDateOfBirthChange,
  onGuardianNameChange,
  onGuardianPhoneChange,
  onAddressChange,
  onParentFirstNameChange,
  onParentLastNameChange,
  onParentEmailChange,
  onParentPhoneChange,
  onParentRelationshipChange,
  onProvisionStudentPortalAccessChange,
  onProvisionParentPortalAccessChange,
  onStudentTemporaryPasswordChange,
  onParentTemporaryPasswordChange,
  onClassIdChange,
  onPhotoChange,
  onRemovePhoto,
  onPhotoValidationError,
  onSubmit,
}: StudentFirstOnboardingFormProps) {
  const classesByLevel = orderedLevels
    .map((level) => ({
      level,
      classes: classes.filter((classDoc) => classDoc.level === level),
    }))
    .filter((group) => group.classes.length > 0);

  const selectedClassName =
    classes.find((classDoc) => classDoc._id === selectedClassId)?.name ?? "No class selected";
  const studentDisplayName = [firstName, lastName].filter(Boolean).join(" ") || "New student";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/academic/students"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to class matrix
            </Link>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                Student-First Onboarding
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Start with the student profile, then link the household before placement.
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Front-desk staff can create the student, link a parent, and issue temporary portal access in one pass. The existing class-first matrix stays unchanged for roster work.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span className="font-semibold">Selected class:</span> {selectedClassName}
          </div>
        </div>
      </header>

      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 1</p>
              <h2 className="text-lg font-bold text-slate-950">Student identity</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name">
                <input
                  ref={firstNameInputRef}
                  value={firstName}
                  onChange={(event) => onFirstNameChange(event.target.value)}
                  onBlur={(event) => onFirstNameBlur(event.target.value)}
                  className={fieldInputClassName}
                  placeholder="Maryam"
                  required
                />
              </Field>
              <Field label="Last name">
                <input
                  value={lastName}
                  onChange={(event) => onLastNameChange(event.target.value)}
                  onBlur={(event) => onLastNameBlur(event.target.value)}
                  className={fieldInputClassName}
                  placeholder="Hassan"
                  required
                />
              </Field>
              <Field label="Admission no.">
                <input
                  value={admissionNumber}
                  onChange={(event) => onAdmissionNumberChange(event.target.value)}
                  className={fieldInputClassName}
                  placeholder="NUR-0014"
                  required
                />
              </Field>
              <Field label="Gender">
                <select
                  value={gender}
                  onChange={(event) => onGenderChange(event.target.value)}
                  className={fieldInputClassName}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 2</p>
              <h2 className="text-lg font-bold text-slate-950">Guardian and supporting details</h2>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
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
                name={studentDisplayName}
                previewUrl={photoPreviewUrl}
                onPhotoChange={onPhotoChange}
                onRemovePhoto={onRemovePhoto}
                helperText="Optional. Reuses the same JPG/PNG 1 MB rule as the roster flow."
                onValidationError={onPhotoValidationError}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 3</p>
              <h2 className="text-lg font-bold text-slate-950">Household and portal access</h2>
              <p className="mt-1 text-sm text-slate-500">
                Optional. Link the parent immediately and issue temporary portal credentials during intake.
              </p>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Parent first name">
                  <input
                    value={parentFirstName}
                    onChange={(event) => onParentFirstNameChange(event.target.value)}
                    className={fieldInputClassName}
                    placeholder="Aisha"
                  />
                </Field>
                <Field label="Parent last name">
                  <input
                    value={parentLastName}
                    onChange={(event) => onParentLastNameChange(event.target.value)}
                    className={fieldInputClassName}
                    placeholder="Bello"
                  />
                </Field>
                <Field label="Parent email">
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(event) => onParentEmailChange(event.target.value)}
                    className={fieldInputClassName}
                    placeholder="parent@example.com"
                  />
                </Field>
                <Field label="Parent phone">
                  <input
                    value={parentPhone}
                    onChange={(event) => onParentPhoneChange(event.target.value)}
                    className={fieldInputClassName}
                    placeholder="+234..."
                  />
                </Field>
                <Field label="Relationship" className="md:col-span-2">
                  <input
                    value={parentRelationship}
                    onChange={(event) => onParentRelationshipChange(event.target.value)}
                    className={fieldInputClassName}
                    placeholder="Mother, Father, Guardian..."
                  />
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={provisionStudentPortalAccess}
                      onChange={(event) => onProvisionStudentPortalAccessChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                    />
                    <span>Provision student portal access now</span>
                  </label>
                  <Field label="Student temporary password">
                    <input
                      type="text"
                      value={studentTemporaryPassword}
                      onChange={(event) => onStudentTemporaryPasswordChange(event.target.value)}
                      className={fieldInputClassName}
                      placeholder="Student123!Pass"
                      disabled={!provisionStudentPortalAccess}
                    />
                  </Field>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={provisionParentPortalAccess}
                      onChange={(event) => onProvisionParentPortalAccessChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                    />
                    <span>Provision parent portal access now</span>
                  </label>
                  <Field label="Parent temporary password">
                    <input
                      type="text"
                      value={parentTemporaryPassword}
                      onChange={(event) => onParentTemporaryPasswordChange(event.target.value)}
                      className={fieldInputClassName}
                      placeholder="Parent123!Pass"
                      disabled={!provisionParentPortalAccess}
                    />
                  </Field>
                </div>
              </div>

              {credentialSummary ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    Portal credentials ready
                  </p>
                  {credentialSummary.student ? (
                    <div className="rounded-xl border border-emerald-100 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Student login</p>
                      <p className="mt-1 font-semibold">{credentialSummary.student.email}</p>
                      <p className="font-black">{credentialSummary.student.temporaryPassword}</p>
                    </div>
                  ) : null}
                  {credentialSummary.parent ? (
                    <div className="rounded-xl border border-emerald-100 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Parent login</p>
                      <p className="mt-1 font-semibold">{credentialSummary.parent.email}</p>
                      <p className="font-black">{credentialSummary.parent.temporaryPassword}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24 xl:self-start">
          <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Step 4</p>
            <h2 className="text-lg font-bold text-slate-950">Choose class placement</h2>
            <p className="mt-1 text-sm text-slate-500">
              Class assignment happens last so you can finish the student profile and household setup first.
            </p>
          </div>

          <div className="space-y-4">
            {classesByLevel.map((group) => (
              <div key={group.level} className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {group.level}
                </p>
                <div className="space-y-2">
                  {group.classes.map((classDoc) => {
                    const isSelected = selectedClassId === classDoc._id;
                    return (
                      <button
                        key={classDoc._id}
                        type="button"
                        onClick={() => onClassIdChange(classDoc._id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <span className="font-semibold">{classDoc.name}</span>
                        {isSelected ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            The student will appear on existing screens with the compatibility display name built from first and last name.
          </div>

          <button
            type="submit"
            disabled={
              isSubmitting ||
              !firstName.trim() ||
              !lastName.trim() ||
              !admissionNumber.trim() ||
              !gender.trim() ||
              !selectedClassId
            }
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-lg shadow-indigo-950/10 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4 text-white/70" />
            {isSubmitting ? "Creating..." : "Create Student"}
          </button>
        </section>
      </form>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldInputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]";
