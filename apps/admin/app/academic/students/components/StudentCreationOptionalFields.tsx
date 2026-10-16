"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cleanPhoneInput } from "@school/shared";

interface StudentCreationOptionalFieldsProps {
  emergencyContactMode: "primary" | "override" | "legacy";
  onEmergencyContactModeChange: (mode: "primary" | "override" | "legacy") => void;
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
  emergencyContactMode,
  onEmergencyContactModeChange,
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
    <div className="rounded-xl border border-slate-200/60 bg-white/40 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-3 w-3 text-slate-400" />
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Optional Details
          </p>
          <p className="text-xs font-medium text-slate-400 leading-relaxed">
            These can be empty for now and updated later.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="House">
          <input
            type="text"
            value={houseName}
            onChange={(event) => onHouseNameChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="Blue"
          />
        </Field>
        <Field label="DOB">
          <input
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={dateOfBirth}
            onChange={(event) => onDateOfBirthChange(event.target.value)}
            className={fieldInputClassName}
          />
        </Field>
        <div className="col-span-2 space-y-2 text-xs text-slate-600">
          <p>The household\'s primary contact is used by default. Add separate details only if the emergency contact is someone else.</p>
          {emergencyContactMode === "legacy" && <p>Previously recorded guardian details. These are separate from the linked contact and will be retained unless you change the source.</p>}
          <label className="flex gap-2"><input type="checkbox" checked={emergencyContactMode !== "primary"} onChange={event => onEmergencyContactModeChange(event.target.checked ? "override" : "primary")} />Use a different emergency contact</label>
        </div>
        {emergencyContactMode !== "primary" && <><Field label="Emergency contact name">
          <input
            type="text"
            value={guardianName}
            onChange={(event) => onGuardianNameChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="Name"
          />
        </Field>
        <Field label="Emergency contact phone">
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
        <Field label="Residential address" className="col-span-2">
          <input
            type="text"
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            className={fieldInputClassName}
            placeholder="12 Unity Cr..."
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
    <label className={className}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

const fieldInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white/60 px-3 text-xs font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-200";
