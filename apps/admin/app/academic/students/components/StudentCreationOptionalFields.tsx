"use client";

import type { ReactNode } from "react";

interface StudentCreationOptionalFieldsProps {
  houseName: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  onHouseNameChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onGuardianNameChange: (value: string) => void;
  onGuardianPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
}

export function StudentCreationOptionalFields({
  houseName,
  dateOfBirth,
  guardianName,
  guardianPhone,
  address,
  onHouseNameChange,
  onDateOfBirthChange,
  onGuardianNameChange,
  onGuardianPhoneChange,
  onAddressChange,
}: StudentCreationOptionalFieldsProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Optional Profile Details
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Add the rest now if you have them. If you skip any, the student will
          still be saved and we will remind you what is missing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="House">
          <input
            type="text"
            value={houseName}
            onChange={(event) => onHouseNameChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="Blue House"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={dateOfBirth}
            onChange={(event) => onDateOfBirthChange(event.target.value)}
            className={fieldInputClassName}
          />
        </Field>
        <Field label="Guardian name">
          <input
            type="text"
            value={guardianName}
            onChange={(event) => onGuardianNameChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="Amina Hassan"
          />
        </Field>
        <Field label="Guardian phone">
          <input
            type="text"
            value={guardianPhone}
            onChange={(event) => onGuardianPhoneChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="+234 801 234 5678"
          />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <input
            type="text"
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="12 Unity Crescent, Ikeja"
          />
        </Field>
      </div>
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
    <div className={className}>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldInputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-indigo-600 focus:shadow-[0_0_0_4px_rgba(79,70,229,0.06)]";
