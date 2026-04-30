"use client";

import { Sparkles, Users } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import type { ClassSummary } from "./types";

interface FamilyOnboardingFormProps {
  selectedClassName: string;
  classes: ClassSummary[];
  selectedClassId: string | null;
  onClassIdChange: (value: string) => void;
  
  studentFirstName: string;
  onStudentFirstNameChange: (value: string) => void;
  onStudentFirstNameBlur: (value: string) => void;
  
  studentLastName: string;
  onStudentLastNameChange: (value: string) => void;
  onStudentLastNameBlur: (value: string) => void;
  
  admissionNumber: string;
  onAdmissionNumberChange: (value: string) => void;
  
  gender: string;
  onGenderChange: (value: string) => void;
  
  parentFirstName: string;
  onParentFirstNameChange: (value: string) => void;
  onParentFirstNameBlur: (value: string) => void;
  
  parentLastName: string;
  onParentLastNameChange: (value: string) => void;
  onParentLastNameBlur: (value: string) => void;
  
  parentEmail: string;
  onParentEmailChange: (value: string) => void;
  
  parentPhone: string;
  onParentPhoneChange: (value: string) => void;
  
  parentRelationship: string;
  onParentRelationshipChange: (value: string) => void;
  
  isParentPrimaryContact: boolean;
  onIsParentPrimaryContactChange: (value: boolean) => void;
  
  isSubmitting: boolean;
  onSubmit: (event: FormEvent) => Promise<void>;
  inputRef: RefObject<HTMLInputElement>;
}

export function FamilyOnboardingForm({
  selectedClassName,
  classes,
  selectedClassId,
  onClassIdChange,
  studentFirstName,
  onStudentFirstNameChange,
  onStudentFirstNameBlur,
  studentLastName,
  onStudentLastNameChange,
  onStudentLastNameBlur,
  admissionNumber,
  onAdmissionNumberChange,
  gender,
  onGenderChange,
  parentFirstName,
  onParentFirstNameChange,
  onParentFirstNameBlur,
  parentLastName,
  onParentLastNameChange,
  onParentLastNameBlur,
  parentEmail,
  onParentEmailChange,
  parentPhone,
  onParentPhoneChange,
  parentRelationship,
  onParentRelationshipChange,
  isParentPrimaryContact,
  onIsParentPrimaryContactChange,
  isSubmitting,
  onSubmit,
  inputRef,
}: FamilyOnboardingFormProps) {
  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <Users className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
            Family Onboarding
          </h2>
        </div>
        <p className="text-xs font-medium leading-relaxed text-slate-500">
          Enrolling to <span className="font-bold text-slate-900">{selectedClassName}</span>. Create student and link parent.
        </p>
      </div>

      {!selectedClassId && (
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Target Class
          </label>
          <select
            value={selectedClassId ?? ""}
            onChange={(event) => onClassIdChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
            required
          >
            <option value="">Select a class</option>
            {classes.map((classDoc) => (
              <option key={classDoc._id} value={classDoc._id}>
                {classDoc.name} ({classDoc.level})
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="space-y-4 border-b border-slate-200/70 pb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Student identity</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">First Name</label>
            <input
              ref={inputRef}
              type="text"
              value={studentFirstName}
              onChange={(event) => onStudentFirstNameChange(event.target.value)}
              onBlur={(event) => onStudentFirstNameBlur(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="Maryam"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Last Name</label>
            <input
              type="text"
              value={studentLastName}
              onChange={(event) => onStudentLastNameChange(event.target.value)}
              onBlur={(event) => onStudentLastNameBlur(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="Hassan"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Admission ID</label>
            <input
              type="text"
              value={admissionNumber}
              onChange={(event) => onAdmissionNumberChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 font-mono text-xs font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="4A-0951"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Gender</label>
            <select
              value={gender}
              onChange={(event) => onGenderChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              required
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Family link</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Parent First Name</label>
            <input
              type="text"
              value={parentFirstName}
              onChange={(event) => onParentFirstNameChange(event.target.value)}
              onBlur={(event) => onParentFirstNameBlur(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="James"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Parent Last Name</label>
            <input
              type="text"
              value={parentLastName}
              onChange={(event) => onParentLastNameChange(event.target.value)}
              onBlur={(event) => onParentLastNameBlur(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="Brown"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Parent Email</label>
          <input
            type="email"
            value={parentEmail}
            onChange={(event) => onParentEmailChange(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
            placeholder="parent@example.com"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Phone</label>
            <input
              type="tel"
              value={parentPhone}
              onChange={(event) => onParentPhoneChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="+234..."
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Relationship</label>
            <input
              type="text"
              value={parentRelationship}
              onChange={(event) => onParentRelationshipChange(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white/70 px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/5"
              placeholder="Father"
            />
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={isParentPrimaryContact}
            onChange={(event) => onIsParentPrimaryContactChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          />
          Mark this parent as the primary family contact.
        </label>
      </section>

      <button
        type="submit"
        disabled={isSubmitting || !studentFirstName.trim() || !studentLastName.trim() || !admissionNumber.trim() || !gender.trim() || !selectedClassId}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
      >
        <Sparkles className="h-4 w-4 text-emerald-400" />
        <span>{isSubmitting ? "Processing..." : "Complete Admission + Family Link"}</span>
      </button>
    </form>
  );
}
