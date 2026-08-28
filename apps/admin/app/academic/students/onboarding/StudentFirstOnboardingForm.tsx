"use client";

import { useMemo, useState, useDeferredValue, type FormEvent, type ReactNode, type RefObject } from "react";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Fingerprint,
  Info,
  KeyRound,
  LayoutGrid,
  Search,
  Shield,
  UserPlus,
  Users,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Check,
} from "lucide-react";
import Link from "next/link";

import { AdminSurface } from "@/components/ui/AdminSurface";
import { StudentPhotoPanel } from "../components/StudentPhotoPanel";
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
  photoResetKey: number;
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
  onReset?: () => void;
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
  photoResetKey,
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
  onReset,
  onSubmit,
}: StudentFirstOnboardingFormProps) {
  const [classSearch, setClassSearch] = useState("");
  const deferredClassSearch = useDeferredValue(classSearch);
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);

  const parentReview = useQuery(
    "functions/academic/studentEnrollment:getParentEmailReview" as any,
    parentEmail.trim().length >= 3 ? { email: parentEmail.trim() } : "skip"
  ) as { matches: any[] } | undefined;

  const emailMatches = parentReview?.matches ?? [];
  const existingStudentWithEmail = emailMatches.find((m) => m.role === "student" && !m.isArchived);
  const existingParentWithEmail = emailMatches.find((m) => m.role === "parent" && !m.isArchived);

  const filteredClasses = useMemo(() => {
    const query = deferredClassSearch.toLowerCase().trim();
    if (!query) return classes;
    return classes.filter(
      (c: ClassSummary) =>
        c.name.toLowerCase().includes(query) || c.level.toLowerCase().includes(query)
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

  const selectedClass = classes.find((classDoc) => classDoc._id === selectedClassId) ?? null;
  const selectedClassName = selectedClass?.name ?? null;

  const todayDateString = new Date().toISOString().split("T")[0];

  const hasCoreIdentity = Boolean(
    firstName.trim() && lastName.trim() && admissionNumber.trim() && gender.trim()
  );
  const hasClassPlacement = Boolean(selectedClassId);
  const hasParentOrGuardian = Boolean(
    guardianName.trim() || parentFirstName.trim() || parentEmail.trim()
  );
  const hasPortalAccess = Boolean(
    provisionStudentPortalAccess || provisionParentPortalAccess
  );

  const canSubmit = hasClassPlacement && hasCoreIdentity && !isPhotoProcessing;

  const fullNameDisplay = [firstName, lastName].filter(Boolean).join(" ") || "New Student";

  return (
    <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Split Workbench View */}
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden"
      >
        {/* ── RIGHT SIDEBAR: Locked & Pinned Live Enrollment Inspector ── */}
        <aside className="w-full lg:w-[380px] xl:w-[400px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-5">
            {/* Live Profile Card */}
            <AdminSurface intensity="low" rounded="xl" className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 font-display">
                  Live Record Preview
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    canSubmit
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      canSubmit ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    )}
                  />
                  {canSubmit ? "Ready" : "Incomplete"}
                </span>
              </div>

              <div className="flex items-center gap-3.5 pt-1">
                <div className="h-14 w-14 rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Fingerprint className="h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm font-bold text-slate-950 truncate font-display">
                    {fullNameDisplay}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-500">
                    <span className="font-mono font-bold text-slate-700">
                      {admissionNumber.trim() || "ID Pending"}
                    </span>
                    {gender && <span>• {gender}</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 text-[10px]">
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Class Placement</p>
                  <p className="font-bold text-slate-800 truncate">
                    {selectedClassName || "Unassigned"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">House Group</p>
                  <p className="font-bold text-slate-800 truncate">
                    {houseName.trim() || "None"}
                  </p>
                </div>
              </div>
            </AdminSurface>

            {/* Enrollment Readiness Checklist */}
            <AdminSurface intensity="low" rounded="xl" className="p-4 space-y-3">
              <h4 className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 font-display">
                Onboarding Readiness
              </h4>
              <div className="space-y-2">
                <ChecklistItem
                  isDone={hasClassPlacement}
                  label="Academic Class Selected"
                  detail={selectedClassName ?? "Required for roster assignment"}
                />
                <ChecklistItem
                  isDone={hasCoreIdentity}
                  label="Student Core Identity"
                  detail="First name, last name, admission ID, and gender"
                />
                <ChecklistItem
                  isDone={hasParentOrGuardian}
                  label="Parent / Guardian Contact"
                  detail={
                    guardianName.trim() || parentFirstName.trim()
                      ? "Contact details linked"
                      : "Optional during initial setup"
                  }
                  optional
                />
                <ChecklistItem
                  isDone={hasPortalAccess}
                  label="Digital Portal Access"
                  detail={
                    hasPortalAccess
                      ? "Credentials configured"
                      : "Optional self-service access"
                  }
                  optional
                />
              </div>
            </AdminSurface>

            {/* Credential Output Summary (If generated) */}
            {credentialSummary && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 font-display">
                    Account Provisioned
                  </p>
                </div>
                <div className="space-y-2">
                  {credentialSummary.student && (
                    <CredentialCard
                      label="Student Portal"
                      email={credentialSummary.student.email}
                      password={credentialSummary.student.temporaryPassword}
                    />
                  )}
                  {credentialSummary.parent && (
                    <CredentialCard
                      label="Parent Portal"
                      email={credentialSummary.parent.email}
                      password={credentialSummary.parent.temporaryPassword}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pinned Action Area */}
          <div className="pt-3 border-t border-slate-200/60 shrink-0 space-y-2">
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-slate-950/10 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {isSubmitting ? "Enrolling..." : isPhotoProcessing ? "Processing Photo..." : "Enroll Student"}
              </span>
            </button>

            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="w-full flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <RotateCcw className="h-3 w-3 text-slate-400" />
                <span>Reset Form</span>
              </button>
            )}

            <p className="text-[10px] leading-relaxed font-medium text-slate-400 text-center">
              Student record will be synced across all registers upon enrollment.
            </p>
          </div>
        </aside>

        {/* ── LEFT MAIN WORKBENCH: Scrollable Canvas ── */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Top Navigation Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/academic/students"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                    <span>Back to Roster</span>
                  </Link>
                  <span className="h-4 w-px bg-slate-200" />
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Enrollment Session
                  </span>
                </div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-950 font-display">
                  Student Onboarding
                </h1>
              </div>

              {selectedClassName && (
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-950 text-white px-3.5 py-2 shadow-sm self-start sm:self-auto">
                  <LayoutGrid className="h-3.5 w-3.5 text-brand-secondary" />
                  <div className="text-left">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Target Class</p>
                    <p className="text-xs font-bold uppercase">{selectedClassName}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── SECTION 1: Academic Class Placement ── */}
            <AdminSurface intensity="medium" rounded="xl" className="p-5 md:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950 font-display">
                      1. Academic Class Placement
                    </h2>
                    <p className="text-[11px] font-medium text-slate-400">
                      Select the class division for this student&apos;s active enrollment.
                    </p>
                  </div>
                </div>

                {/* Search / Filter Filter */}
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                  <input
                    type="text"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Search classes..."
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 placeholder:text-slate-300"
                  />
                </div>
              </div>

              {/* Class Buttons Grouped by Level */}
              <div className="space-y-4">
                {classesByLevel.map((group) => (
                  <div key={group.level} className="space-y-2">
                    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display pl-0.5">
                      {group.level} Section
                    </p>
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                      {group.classes.map((classDoc) => {
                        const isSelected = selectedClassId === classDoc._id;
                        return (
                          <button
                            key={classDoc._id}
                            type="button"
                            onClick={() => onClassIdChange(classDoc._id)}
                            className={cn(
                              "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
                              isSelected
                                ? "border-brand-primary bg-brand-primary text-white shadow-md shadow-brand-primary/15"
                                : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="text-xs font-bold uppercase truncate mr-2">
                              {classDoc.name}
                            </span>
                            {isSelected ? (
                              <Check className="h-4 w-4 shrink-0 text-white" />
                            ) : (
                              <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-200" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {filteredClasses.length === 0 && (
                  <div className="py-6 text-center text-xs font-medium text-slate-400">
                    No classes match &quot;{classSearch}&quot;
                  </div>
                )}
              </div>
            </AdminSurface>

            {/* ── SECTION 2: Student Identity Core ── */}
            <AdminSurface intensity="medium" rounded="xl" className="p-5 md:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-200/60 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Fingerprint className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950 font-display">
                    2. Student Identity & Passport
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Official identification and basic demographic records.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-12">
                {/* Photo Upload Column */}
                <div className="md:col-span-4 space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display">
                    Passport Photo (Optional)
                  </label>
                  <StudentPhotoPanel
                    name={fullNameDisplay}
                    previewUrl={photoPreviewUrl}
                    onPhotoChange={onPhotoChange}
                    onRemovePhoto={onRemovePhoto}
                    helperText="JPG/PNG up to 1 MB."
                    resetKey={photoResetKey}
                    onProcessingChange={setIsPhotoProcessing}
                    onValidationError={onPhotoValidationError}
                  />
                </div>

                {/* Inputs Column */}
                <div className="md:col-span-8 grid gap-4 sm:grid-cols-2">
                  <Field label="First Name *">
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

                  <Field label="Last Name *">
                    <input
                      value={lastName}
                      onChange={(e) => onLastNameChange(e.target.value)}
                      onBlur={(e) => onLastNameBlur(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. Hassan"
                      required
                    />
                  </Field>

                  <Field label="Admission Number *">
                    <input
                      value={admissionNumber}
                      onChange={(e) => onAdmissionNumberChange(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. NUR-0014"
                      required
                    />
                  </Field>

                  <Field label="Gender *">
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

                  <Field label="House / Team">
                    <input
                      value={houseName}
                      onChange={(e) => onHouseNameChange(e.target.value)}
                      className={fieldInputClassName}
                      placeholder="e.g. Blue House"
                    />
                  </Field>

                  <Field label="Date of Birth">
                    <input
                      type="date"
                      max={todayDateString}
                      value={dateOfBirth}
                      onChange={(e) => onDateOfBirthChange(e.target.value)}
                      className={fieldInputClassName}
                    />
                  </Field>
                </div>
              </div>
            </AdminSurface>

            {/* ── SECTION 3: Household & Primary Guardian ── */}
            <AdminSurface intensity="medium" rounded="xl" className="p-5 md:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-200/60 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950 font-display">
                    3. Household & Primary Guardian
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Emergency contacts, residential location, and parent links.
                  </p>
                </div>
              </div>

              {/* Primary Guardian Section */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 font-display">
                  Primary Guardian Details
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Primary Guardian Name">
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
                      rows={2}
                      value={address}
                      onChange={(e) => onAddressChange(e.target.value)}
                      className={cn(fieldInputClassName, "h-auto py-2 resize-none")}
                      placeholder="Full residential address..."
                    />
                  </Field>
                </div>
              </div>

              {/* Parent Portal Linkage */}
              <div className="space-y-3 pt-3 border-t border-slate-200/60">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 font-display">
                  Parent Profile & Household Linkage
                </h3>
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
                        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-brand-primary/20"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-950">Set as Primary Contact</p>
                        <p className="text-[11px] font-medium text-slate-400">
                          This parent will be the primary point of contact for emergency alerts and grade notifications.
                        </p>
                      </div>
                    </label>
                  </div>

                  {parentEmail.trim().length >= 3 && emailMatches.length > 0 && (
                    <div className="sm:col-span-2 animate-in fade-in">
                      <div
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4",
                          existingStudentWithEmail
                            ? "border-amber-200 bg-amber-50"
                            : "border-blue-200 bg-blue-50"
                        )}
                      >
                        {existingStudentWithEmail ? (
                          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        ) : (
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        )}
                        <div className="space-y-1">
                          <p
                            className={cn(
                              "text-xs font-bold uppercase tracking-wider",
                              existingStudentWithEmail ? "text-amber-800" : "text-blue-800"
                            )}
                          >
                            {existingStudentWithEmail
                              ? "Student Match Detected"
                              : "Existing Parent Match Found"}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-medium leading-relaxed",
                              existingStudentWithEmail ? "text-amber-800" : "text-blue-800"
                            )}
                          >
                            {existingStudentWithEmail ? (
                              <>
                                A student named <strong>{existingStudentWithEmail.name}</strong> is already registered with this email. Please verify if you intended to link an existing user.
                              </>
                            ) : existingParentWithEmail ? (
                              <>
                                An existing parent account for <strong>{existingParentWithEmail.name}</strong> was found. This student will be automatically linked to their household profile.
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AdminSurface>

            {/* ── SECTION 4: Digital Portal Access ── */}
            <AdminSurface intensity="medium" rounded="xl" className="p-5 md:p-6 space-y-6">
              <div className="flex items-center gap-2.5 border-b border-slate-200/60 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                  <Shield className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-950 font-display">
                    4. Digital Portal Credentials
                  </h2>
                  <p className="text-[11px] font-medium text-slate-400">
                    Provision instant login credentials for online student and parent portals.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Student Portal Card */}
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all",
                    provisionStudentPortalAccess
                      ? "border-slate-950 shadow-md ring-2 ring-slate-950/5"
                      : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 font-display">Student Portal Access</p>
                      <p className="text-[11px] font-medium text-slate-400">Enable student login app.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={provisionStudentPortalAccess}
                      onChange={(e) => onProvisionStudentPortalAccessChange(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-brand-primary/20"
                    />
                  </div>
                  {provisionStudentPortalAccess && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                      <Field label="Temporary Password">
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={studentTemporaryPassword}
                            onChange={(e) => onStudentTemporaryPasswordChange(e.target.value)}
                            className={cn(fieldInputClassName, "pl-9")}
                            placeholder="Student123!Pass"
                          />
                        </div>
                      </Field>
                      <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-[11px]">
                        <span className="font-bold text-slate-400 uppercase text-[9px] block">Assigned Username:</span>
                        <span className="font-bold font-mono text-slate-700">
                          {admissionNumber.trim().replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "adm000"}@students.local
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Parent Portal Card */}
                <div
                  className={cn(
                    "group relative overflow-hidden rounded-xl border bg-white p-4 transition-all",
                    provisionParentPortalAccess
                      ? "border-slate-950 shadow-md ring-2 ring-slate-950/5"
                      : "border-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-900 font-display">Parent Portal Access</p>
                      <p className="text-[11px] font-medium text-slate-400">Enable guardian grades app.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={provisionParentPortalAccess}
                      onChange={(e) => onProvisionParentPortalAccessChange(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-brand-primary/20"
                    />
                  </div>
                  {provisionParentPortalAccess && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
                      <Field label="Temporary Password">
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-300" />
                          <input
                            type="text"
                            value={parentTemporaryPassword}
                            onChange={(e) => onParentTemporaryPasswordChange(e.target.value)}
                            className={cn(fieldInputClassName, "pl-9")}
                            placeholder="Parent123!Pass"
                          />
                        </div>
                      </Field>
                      <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-[11px]">
                        <span className="font-bold text-slate-400 uppercase text-[9px] block">Target Email:</span>
                        <span className={cn("font-bold", parentEmail.trim() ? "text-slate-700" : "text-amber-600")}>
                          {parentEmail.trim().toLowerCase() || "Enter parent email above"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AdminSurface>
          </div>
        </main>

        {/* ── MOBILE STICKY ACTION BAR (< lg) ── */}
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Target Class</p>
              <p className="text-xs font-bold text-slate-950 truncate">
                {selectedClassName || "Unselected"}
              </p>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30 shadow-md active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>{isSubmitting ? "..." : "Enroll Student"}</span>
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
    <label className={cn("space-y-1.5 block", className)}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 font-display">
        {label}
      </span>
      {children}
    </label>
  );
}

function ChecklistItem({
  isDone,
  label,
  detail,
  optional = false,
}: {
  isDone: boolean;
  label: string;
  detail: string;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <div
        className={cn(
          "h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          isDone
            ? "bg-emerald-500 text-white"
            : optional
            ? "border border-slate-200 text-transparent"
            : "border-2 border-amber-400 text-transparent"
        )}
      >
        <Check className="h-2.5 w-2.5 stroke-[3]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("font-bold text-xs", isDone ? "text-slate-900" : "text-slate-600")}>
          {label}
        </p>
        <p className="text-[10px] font-medium text-slate-400 truncate">{detail}</p>
      </div>
    </div>
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3 space-y-1.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 font-display">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-700 transition-colors"
        >
          {copied ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="text-[11px] space-y-0.5">
        <div className="text-slate-600 truncate font-medium">User: <strong className="text-slate-900 font-mono">{email}</strong></div>
        <div className="text-slate-600 font-medium">Password: <strong className="text-slate-900 font-mono">{password}</strong></div>
      </div>
    </div>
  );
}

const fieldInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 placeholder:text-slate-300 shadow-sm";

