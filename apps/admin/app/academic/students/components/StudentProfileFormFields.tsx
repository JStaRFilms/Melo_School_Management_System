"use client";

import { cleanPhoneInput } from "@school/shared";
import type { ReactNode } from "react";
import type { ClassSummary } from "./types";

interface StudentProfileFormFieldsProps {
  firstName: string;
  middleName: string;
  fullName: string;
  structuredName: boolean;
  onMiddleNameChange: (value: string) => void;
  onFullNameChange: (value: string) => void;
  onStructuredNameChange: (value: boolean) => void;
  onNameBlur: () => void;
  addressMode: "residential" | "different" | "legacy";
  onAddressModeChange: (value: "residential" | "different" | "legacy") => void;
  emergencyContactMode: "primary" | "override" | "legacy";
  onEmergencyContactModeChange: (value: "primary" | "override" | "legacy") => void;
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
  firstName, middleName, fullName, structuredName, onMiddleNameChange, onFullNameChange, onStructuredNameChange, onNameBlur,
  addressMode, onAddressModeChange, emergencyContactMode, onEmergencyContactModeChange,
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
      {!structuredName ? <Field label="Full name"><input value={fullName} onChange={event => onFullNameChange(event.target.value)} className={fieldInputClassName} /><button type="button" onClick={() => onStructuredNameChange(true)}>Enter name parts</button></Field> : <>
      <p className="text-xs text-slate-500 sm:col-span-2">Recorded name: {fullName}<button type="button" className="ml-2 underline" onClick={() => onStructuredNameChange(false)}>Use full name</button></p>
      <Field label="First Name">
        <input
          onBlur={onNameBlur}
          value={firstName}
          onChange={(event) => onFirstNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="First name"
        />
      </Field>
      <Field label="Middle name (optional)"><input value={middleName} onChange={event => onMiddleNameChange(event.target.value)} onBlur={onNameBlur} className={fieldInputClassName} /></Field>
      <Field label="Last Name">
        <input
          value={lastName}
          onChange={(event) => onLastNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Last name"
        />
      </Field>
      </>}
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
          max={new Date().toISOString().split("T")[0]}
          value={dateOfBirth}
          onChange={(event) => onDateOfBirthChange(event.target.value)}
          className={fieldInputClassName}
        />
      </Field>
      <Field label="Emergency contact source"><select value={emergencyContactMode} onChange={event => onEmergencyContactModeChange(event.target.value === "primary" ? "primary" : event.target.value === "override" ? "override" : "legacy")} className={fieldInputClassName}><option value="primary">Household primary contact</option><option value="override">Different emergency contact</option><option value="legacy">Previously recorded guardian details</option></select></Field>
      {emergencyContactMode === "legacy" && <p className="text-xs text-slate-500">Previously recorded guardian details are separate from the linked contact. Unrelated edits retain them.</p>}
      {emergencyContactMode !== "primary" && <><Field label="Guardian Name">
        <input
          value={guardianName}
          onChange={(event) => onGuardianNameChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Parent/Guardian"
        />
      </Field>
      <Field label="Contact Phone">
        <input
          type="tel"
          inputMode="tel"
          value={guardianPhone}
          onChange={(event) => onGuardianPhoneChange(cleanPhoneInput(event.target.value))}
          className={fieldInputClassName}
          placeholder="+234..."
        />
      </Field>
      </>}
      <Field label="Address source"><select className={fieldInputClassName} value={addressMode} onChange={event => onAddressModeChange(event.target.value === "residential" ? "residential" : event.target.value === "different" ? "different" : "legacy")}><option value="residential">Household residential address</option><option value="different">Different address</option><option value="legacy">Retain recorded address</option></select></Field>
      {addressMode !== "residential" && <Field label="Living Address">
        <input
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          className={fieldInputClassName}
          placeholder="Residential address"
        />
      </Field>}
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
