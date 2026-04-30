"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue, type FormEvent, type ReactNode, type RefObject } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Copy, Fingerprint, Home, Info, KeyRound, LayoutGrid, Search, Shield, Upload, UserPlus, Users, AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { AdminHeader } from "@/components/ui/AdminHeader";
import type { ClassSummary } from "../components/types";
import { cn } from "@/utils";

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
  isParentPrimaryContact: boolean;
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
  onIsParentPrimaryContactChange: (value: boolean) => void;
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
  isParentPrimaryContact,
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
  onIsParentPrimaryContactChange,
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
  const [classSearch, setClassSearch] = useState("");
  const deferredClassSearch = useDeferredValue(classSearch);

  const parentReview = useQuery(
    "functions/academic/studentEnrollment:getParentEmailReview" as any,
    parentEmail.trim().length >= 3 ? { email: parentEmail.trim() } : "skip"
  ) as { matches: any[] } | undefined;

  const emailMatches = parentReview?.matches ?? [];
  const existingStudentWithEmail = emailMatches.find(m => m.role === "student" && !m.isArchived);
  const existingParentWithEmail = emailMatches.find(m => m.role === "parent" && !m.isArchived);

  const filteredClasses = useMemo(() => {
    const query = deferredClassSearch.toLowerCase().trim();
    if (!query) return classes;
    return classes.filter((c: ClassSummary) => 
      c.name.toLowerCase().includes(query) || 
      c.level.toLowerCase().includes(query)
    );
  }, [classes, deferredClassSearch]);

  const classesByLevel = useMemo(() => {
    return orderedLevels
      .map((level) => ({
        level,
        classes: filteredClasses.filter((classDoc: ClassSummary) => classDoc.level === level),
      }))
      .filter((group) => group.classes.length > 0);
  }, [filteredClasses]);

  const selectedClassName =
    classes.find((classDoc) => classDoc._id === selectedClassId)?.name ?? null;

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    admissionNumber.trim() &&
    gender.trim() &&
    selectedClassId;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onPhotoChange(file);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50/50">
      {/* Dense Workbench Header */}
      <header className="z-20 shrink-0 border-b border-slate-200/60 bg-white px-6 py-4 lg:px-10">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Link
                href="/academic/students"
                className="group flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm transition hover:border-slate-300"
              >
                <ArrowLeft className="h-3 w-3 text-slate-400 group-hover:text-slate-900" />
              </Link>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Live Enrollment Session
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-black tracking-tight text-slate-950">
                Student Onboarding
              </h1>
              {selectedClassName && (
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5">
                  <LayoutGrid className="h-2.5 w-2.5 text-slate-400" />
                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-tight">{selectedClassName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <p className="max-w-[300px] text-right text-[10px] font-medium leading-tight text-slate-400">
              Complete the identity core and household linkage to finalize enrollment.
            </p>
          </div>
        </div>
      </header>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white"
      >
        {/* Main Workbench Area (Scrollable) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 bg-slate-50/30">
          <div className="mx-auto max-w-4xl space-y-10">

            {/* Profile Core */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                  <Fingerprint className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Identity Core</h2>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                {/* Photo Panel */}
                <div className="lg:col-span-3">
                  <div className="group relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-400 shadow-sm">
                    {photoPreviewUrl ? (
                      <>
                        <Image
                          src={photoPreviewUrl}
                          alt="Student Preview"
                          fill
                          className="object-cover transition group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={onRemovePhoto}
                            className="rounded-lg bg-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-white backdrop-blur-md hover:bg-white/30"
                          >
                            Replace
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-900">Photo</p>
                          <p className="text-[8px] font-medium text-slate-400">JPG/PNG</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-9 grid gap-4 sm:grid-cols-2">
                  <Field label="First Name">
                    <input
                      ref={firstNameInputRef}
                      value={firstName}
                      onChange={(e) => onFirstNameChange(e.target.value)}
                      onBlur={(e) => onFirstNameBlur(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. Maryam"
                      required
                    />
                  </Field>
                  <Field label="Last Name">
                    <input
                      value={lastName}
                      onChange={(e) => onLastNameChange(e.target.value)}
                      onBlur={(e) => onLastNameBlur(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. Hassan"
                      required
                    />
                  </Field>
                  <Field label="Admission Number">
                    <input
                      value={admissionNumber}
                      onChange={(e) => onAdmissionNumberChange(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. NUR-0014"
                      required
                    />
                  </Field>
                  <Field label="Gender">
                    <select
                      value={gender}
                      onChange={(e) => onGenderChange(e.target.value)}
                      className={fieldInputClassName}
                      required
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </Field>
                </div>
              </div>
            </section>

            {/* Extended Attributes */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                  <Info className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Extended Attributes</h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="House / Team">
                  <input
                    value={houseName}
                    onChange={(e) => onHouseNameChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="e.g. Blue"
                  />
                </Field>
                <Field label="Date of Birth">
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => onDateOfBirthChange(e.target.value)}
                    className={fieldInputClassName}
                  />
                </Field>
                <Field label="Primary Guardian">
                  <input
                    value={guardianName}
                    onChange={(e) => onGuardianNameChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="e.g. John Doe"
                  />
                </Field>
                <Field label="Guardian Phone">
                  <input
                    value={guardianPhone}
                    onChange={(e) => onGuardianPhoneChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="+234..."
                  />
                </Field>
                <Field label="Residential Address" className="sm:col-span-2">
                  <textarea
                    rows={1}
                    value={address}
                    onChange={(e) => onAddressChange(e.target.value)}
                    className={cn(fieldInputClassName, "h-auto py-2 resize-none")}
                    placeholder="Full residential address..."
                  />
                </Field>
              </div>
            </section>

            {/* Household Linkage */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                  <Users className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Household Linkage</h2>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Parent First Name">
                  <input
                    value={parentFirstName}
                    onChange={(e) => onParentFirstNameChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="e.g. Aisha"
                  />
                </Field>
                <Field label="Parent Last Name">
                  <input
                    value={parentLastName}
                    onChange={(e) => onParentLastNameChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="e.g. Bello"
                  />
                </Field>
                <Field label="Parent Primary Email">
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => onParentEmailChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="parent@example.com"
                  />
                </Field>
                <Field label="Parent Mobile Number">
                  <input
                    value={parentPhone}
                    onChange={(e) => onParentPhoneChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="+234..."
                  />
                </Field>
                <Field label="Relationship Status" className="sm:col-span-2">
                  <input
                    value={parentRelationship}
                    onChange={(e) => onParentRelationshipChange(e.target.value)}
                    className={fieldInputClassName}
                    placeholder="Mother, Father, Guardian, etc."
                  />
                </Field>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isParentPrimaryContact}
                      onChange={(e) => onIsParentPrimaryContactChange(e.target.checked)}
                      className="h-5 w-5 rounded-md border-slate-300 text-slate-950 focus:ring-slate-950/10"
                    />
                    <div className="space-y-0.5">
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-950">Set as Primary Contact</p>
                      <p className="text-[10px] font-medium text-slate-400">This parent will be the first point of call for notifications and emergencies.</p>
                    </div>
                  </label>
                </div>

                {parentEmail.trim().length >= 3 && emailMatches.length > 0 && (
                  <div className="sm:col-span-2 animate-in fade-in slide-in-from-top-2">
                    <div className={cn(
                      "flex items-start gap-3 rounded-xl border p-4",
                      existingStudentWithEmail ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
                    )}>
                      {existingStudentWithEmail ? (
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      ) : (
                        <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-wider",
                          existingStudentWithEmail ? "text-amber-700" : "text-blue-700"
                        )}>
                          {existingStudentWithEmail ? "Student Match Detected" : "Identity Registry Check"}
                        </p>
                        <p className={cn(
                          "text-[11px] font-medium leading-relaxed",
                          existingStudentWithEmail ? "text-amber-800" : "text-blue-800"
                        )}>
                          {existingStudentWithEmail ? (
                            <>A student named <strong>{existingStudentWithEmail.name}</strong> is already registered with this email. Please verify if you intended to link an existing user or if this is a mistake.</>
                          ) : existingParentWithEmail ? (
                            <>A parent record for <strong>{existingParentWithEmail.name}</strong> was found. We&apos;ll automatically link this student to their existing household profile.</>
                          ) : (
                            "This email is not currently in our system. A new user account will be provisioned upon enrollment."
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Digital Access Provisioning */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm">
                  <Shield className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-950">Digital Access</h2>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className={cn(
                  "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all",
                  provisionStudentPortalAccess ? "border-slate-950 shadow-md ring-4 ring-slate-950/5" : "border-slate-200"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-900">Student Portal</p>
                      <p className="text-[10px] font-medium text-slate-400">Immediate app access.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={provisionStudentPortalAccess}
                      onChange={(e) => onProvisionStudentPortalAccessChange(e.target.checked)}
                      className="h-5 w-5 rounded-md border-slate-300 text-slate-950 focus:ring-slate-950/10"
                    />
                  </div>
                  {provisionStudentPortalAccess && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Field label="Temporary Password">
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={studentTemporaryPassword}
                            onChange={(e) => onStudentTemporaryPasswordChange(e.target.value)}
                            className={cn(fieldInputClassName, "pl-10")}
                            placeholder="Student123!Pass"
                          />
                        </div>
                      </Field>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                        <Fingerprint className="h-3 w-3 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Assigned Username</p>
                          <p className="text-[10px] font-bold text-slate-600 truncate italic">
                            {admissionNumber.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "adm000"}@students.local
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={cn(
                  "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all",
                  provisionParentPortalAccess ? "border-slate-950 shadow-md ring-4 ring-slate-950/5" : "border-slate-200"
                )}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-900">Parent Portal</p>
                      <p className="text-[10px] font-medium text-slate-400">Immediate app access.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={provisionParentPortalAccess}
                      onChange={(e) => onProvisionParentPortalAccessChange(e.target.checked)}
                      className="h-5 w-5 rounded-md border-slate-300 text-slate-950 focus:ring-slate-950/10"
                    />
                  </div>
                  {provisionParentPortalAccess && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Field label="Temporary Password">
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={parentTemporaryPassword}
                            onChange={(e) => onParentTemporaryPasswordChange(e.target.value)}
                            className={cn(fieldInputClassName, "pl-10")}
                            placeholder="Parent123!Pass"
                          />
                        </div>
                      </Field>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-100">
                        <Users className="h-3 w-3 text-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Target Email</p>
                          <p className={cn(
                            "text-[10px] font-bold truncate italic",
                            parentEmail.trim() ? "text-slate-600" : "text-amber-500"
                          )}>
                            {parentEmail.trim().toLowerCase() || "Missing Parent Email"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Credential Summary */}
              {credentialSummary && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Provisioning Successful</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {credentialSummary.student && (
                      <CredentialCard
                        label="Student Access"
                        email={credentialSummary.student.email}
                        password={credentialSummary.student.temporaryPassword}
                      />
                    )}
                    {credentialSummary.parent && (
                      <CredentialCard
                        label="Parent Access"
                        email={credentialSummary.parent.email}
                        password={credentialSummary.parent.temporaryPassword}
                      />
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Bottom Spacer for Mobile */}
            <div className="h-32 lg:hidden" />
          </div>
        </main>

        {/* Configuration Sidebar */}
        <aside className="hidden lg:flex w-[340px] shrink-0 border-l border-slate-200 bg-white flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Placement</p>
                </div>
                <h3 className="text-lg font-black tracking-tight text-slate-950 uppercase">Class Selection</h3>
              </div>

              {/* Live Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Filter classes..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-[11px] font-bold text-slate-900 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-slate-950/5"
                />
              </div>

              <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                Assign this student to a specific academic division to complete onboarding.
              </p>
            </div>

            <div className="space-y-5">
              {classesByLevel.map((group: { level: string; classes: ClassSummary[] }) => (
                <div key={group.level} className="space-y-2.5">
                  <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-400/80 pl-1">
                    {group.level}
                  </p>
                  <div className="grid gap-1.5">
                    {group.classes.map((classDoc: ClassSummary) => {
                      const isSelected = selectedClassId === classDoc._id;
                      return (
                        <button
                          key={classDoc._id}
                          type="button"
                          onClick={() => onClassIdChange(classDoc._id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition-all duration-200",
                            isSelected
                              ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                              : "border-slate-100 bg-slate-50/50 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <span className="text-[10px] font-black tracking-wide uppercase truncate mr-2">{classDoc.name}</span>
                          {isSelected ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-white" />
                          ) : (
                            <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-auto">
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-slate-950 text-white transition-all hover:bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-slate-950/20"
              >
                <UserPlus className="h-4 w-4 transition group-hover:scale-110" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">
                  {isSubmitting ? "..." : "Enroll Student"}
                </span>
              </button>

              <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 border border-slate-100">
                <Info className="h-3 w-3 text-slate-400 mt-0.5" />
                <p className="text-[9px] font-medium leading-relaxed text-slate-400">
                  Profile will be synced across all registers and parent portals upon commitment.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Overlay Sections (Since aside is hidden on mobile) */}
        <div className="lg:hidden p-6 border-t border-slate-200 bg-slate-50">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Class Placement</p>
                <h3 className="text-lg font-black text-slate-950">Target Placement</h3>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Search classes..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-bold text-slate-950 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-1 custom-scrollbar">
              {filteredClasses.map((c: ClassSummary) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => onClassIdChange(c._id)}
                  className={cn(
                    "px-3 py-3 rounded-xl border text-[10px] font-black uppercase text-left transition-all truncate",
                    selectedClassId === c._id
                      ? "bg-slate-950 border-slate-950 text-white shadow-lg"
                      : "bg-white border-slate-100 text-slate-500"
                  )}
                >
                  {c.name}
                </button>
              ))}
              {filteredClasses.length === 0 && (
                <p className="col-span-2 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  No matching classes
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Sticky Action Bar */}
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Placement</p>
              <p className="text-xs font-black text-slate-950 truncate">
                {selectedClassName || "Unselected"}
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 text-white transition-all disabled:opacity-30 shadow-lg shadow-slate-950/20"
            >
              <UserPlus className="h-4 w-4" />
              <span className="text-[11px] font-black uppercase tracking-wider">
                {isSubmitting ? "..." : "Enroll"}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}


/* ─── Helpers ─── */

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
    <label className={cn("space-y-1.5", className)}>
      <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400/80">
        {label}
      </span>
      {children}
    </label>
  );
}

function CredentialCard({
  label,
  email,
  password,
}: {
  label: string;
  email: string;
  password: string;
}) {
  const handleCopy = () => {
    void navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
  };

  return (
    <div className="group relative rounded-xl border border-emerald-200 bg-white p-4 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Copy className="h-3 w-3" />
          Copy
        </button>
      </div>
      <div className="space-y-1.5">
        <div className="space-y-0.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">ID / Username</p>
          <p className="text-xs font-bold text-slate-700 truncate">{email}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Security Key</p>
          <p className="text-sm font-black text-slate-950 font-mono tracking-tight">{password}</p>
        </div>
      </div>
    </div>
  );
}

const fieldInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-[4px] focus:ring-slate-950/5 placeholder:text-slate-200 shadow-sm";
