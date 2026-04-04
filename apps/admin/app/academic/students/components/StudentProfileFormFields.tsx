"use client";

import type { ReactNode } from "react";
import type { ClassSummary } from "./types";

interface StudentProfileFormFieldsProps {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
  houseName: string;
  gender: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  classes: ClassSummary[];
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onAdmissionNumberChange: (value: string) => void;
  onClassIdChange: (value: string) => void;
  onHouseNameChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onGuardianNameChange: (value: string) => void;
  onGuardianPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

export function StudentProfileFormFields({
  firstName,
  lastName,
  admissionNumber,
  classId,
  houseName,
  gender,
  dateOfBirth,
  guardianName,
  guardianPhone,
  address,
  classes,
  onFirstNameChange,
  onLastNameChange,
  onAdmissionNumberChange,
  onClassIdChange,
  onHouseNameChange,
  onGenderChange,
  onDateOfBirthChange,
  onGuardianNameChange,
  onGuardianPhoneChange,
  onAddressChange,
}: StudentProfileFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="First Name">
        <input
          value={firstName}
          onChange={(event) => onFirstNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="First name"
        />
      </Field>
      <Field label="Last Name">
        <input
          value={lastName}
          onChange={(event) => onLastNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Last name"
        />
      </Field>
      <Field label="Admission ID">
        <input
          value={admissionNumber}
          onChange={(event) => onAdmissionNumberChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="4A-..."
        />
      </Field>
      <Field label="Active Class">
        <select
          value={classId}
          onChange={(event) => onClassIdChange(event.target.value)}
          className={fieldInputClassName}
        >
          {classes.map((classDoc) => (
            <option key={classDoc._id} value={classDoc._id}>
              {classDoc.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="House Group">
        <input
          value={houseName}
          onChange={(event) => onHouseNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="e.g. Blue House"
        />
      </Field>
      <Field label="Gender">
        <select
          value={gender}
          onChange={(event) => onGenderChange(event.target.value)}
          className={fieldInputClassName}
        >
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </Field>
      <Field label="Birth Date">
        <input
          type="date"
          value={dateOfBirth}
          onChange={(event) => onDateOfBirthChange(event.target.value)}
          className={fieldInputClassName}
        />
      </Field>
      <Field label="Guardian Name">
        <input
          value={guardianName}
          onChange={(event) => onGuardianNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Parent/Guardian"
        />
      </Field>
      <Field label="Contact Phone">
        <input
          value={guardianPhone}
          onChange={(event) => onGuardianPhoneChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="+234..."
        />
      </Field>
      <Field label="Living Address">
        <input
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Residential address"
        />
      </Field>
    </div>
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
      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldInputClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-white/60 px-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-200";
