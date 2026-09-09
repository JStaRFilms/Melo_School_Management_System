"use client";

import Link from "next/link";
import { getUserFacingErrorMessage, isValidPhoneNumber } from "@school/shared";
import { useDirtyForm } from "@school/shared/drafts";
import { useAction, useMutation, useQuery } from "convex/react";
import { CheckCircle2, Trash2, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/AuthProvider";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import {
  AdmissionNumberGovernanceFields,
  hasCompleteAdmissionNumberOverride,
  type AdmissionCounterDecision,
} from "./AdmissionNumberGovernanceFields";
import { PortalCredentialPanel } from "./PortalCredentialPanel";
import { StudentFamilyPanel } from "./StudentFamilyPanel";
import { StudentPhotoPanel } from "./StudentPhotoPanel";
import { StudentProfileFormFields } from "./StudentProfileFormFields";
import { uploadStudentPhoto } from "./studentPhotoUpload";
import type { ClassSummary, EnrollmentNotice } from "./types";

interface StudentProfileEditorProps {
  studentId: string | null;
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
  onStudentArchived?: (studentId: string) => void;
  onViewAttestation?: (studentId: string) => void;
  variant?: "inline" | "sheet";
  activeTab?: "profile" | "family";
  onTabChange?: (tab: "profile" | "family") => void;
}

type StudentProfile = {
  _id: string;
  userId: string;
  email: string;
  name: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  admissionNumber: string;
  classId: string;
  className: string;
  houseName: string | null;
  gender: string | null;
  dateOfBirth: number | null;
  guardianName: string | null;
  guardianPhone: string | null;
  address: string | null;
  photoUrl: string | null;
  photoFileName: string | null;
  photoContentType: string | null;
  enrollmentStatus?: string | null;
  graduatedAt?: number | null;
  graduatingSessionId?: string | null;
  graduatingSessionName?: string | null;
  graduatingClassId?: string | null;
  graduatingClassName?: string | null;
};

function toDateInput(value: number | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function StudentProfileEditor({
  studentId,
  classes,
  onNotice,
  onStudentArchived,
  onViewAttestation,
  variant,
  activeTab = "profile",
  onTabChange,
}: StudentProfileEditorProps) {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? workspaceAccess.branch.schoolId
      : null;
  const canOverrideAdmissionNumber = Boolean(
    workspaceAccess?.state === "ready" &&
      workspaceAccess.effectiveCapabilities.includes(
        "enrollment.admissions.override_number",
      ),
  );
  const studentProfile = useQuery(
    "functions/academic/studentEnrollment:getStudentProfile" as never,
    studentId ? ({ studentId } as never) : ("skip" as never),
  ) as StudentProfile | undefined;
  const updateStudent = useMutation(
    "functions/academic/studentEnrollment:updateStudent" as never,
  );
  const archiveStudent = useMutation(
    "functions/academic/studentEnrollment:archiveStudent" as never,
  );
  const saveStudentPhoto = useAction(
    "functions/academic/studentEnrollment:saveStudentPhoto" as never,
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideCounterDecision, setOverrideCounterDecision] =
    useState<AdmissionCounterDecision>("");
  const [advanceCounterTo, setAdvanceCounterTo] = useState("");
  const [classId, setClassId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const admissionNumbering = useQuery(
    "functions/academic/admissionNumbers:getAdmissionNumberPolicy" as never,
    schoolId ? ({ schoolId } as never) : ("skip" as never),
  ) as { policy: { pattern: string } | null } | undefined;
  const transferAccess = useQuery(
    "functions/academic/transfers:getTransferPilotAccess" as never,
    schoolId ? ({ schoolId } as never) : ("skip" as never),
  ) as { allowed: boolean } | undefined;
  const selectedLevel = classes.find((item) => item._id === classId)?.level;
  const numbering = useQuery(
    "functions/academic/admissionNumbers:getAdmissionNumberPolicy" as never,
    schoolId && selectedLevel && advanceCounterTo
      ? ({ schoolId, level: selectedLevel } as never)
      : ("skip" as never),
  ) as
    | {
        version: number;
        formatVersion: string | null;
        counter: { key: string; configVersion: number } | null;
        activeSessionId: string | null;
        resetPeriod: string | null;
        nextSequence: number | null;
      }
    | undefined;

  const resetProfileFields = useCallback((profile: StudentProfile) => {
    setFirstName(profile.firstName ?? "");
    setLastName(profile.lastName ?? "");
    setAdmissionNumber(profile.admissionNumber ?? "");
    setOverrideReason("");
    setOverrideConfirmed(false);
    setOverrideCounterDecision("");
    setAdvanceCounterTo("");
    setClassId(profile.classId);
    setHouseName(profile.houseName ?? "");
    setGender(profile.gender ?? "");
    setDateOfBirth(toDateInput(profile.dateOfBirth));
    setGuardianName(profile.guardianName ?? "");
    setGuardianPhone(profile.guardianPhone ?? "");
    setAddress(profile.address ?? "");
    setPhotoFile(null);
    setIsPhotoProcessing(false);
  }, []);

  useEffect(() => {
    if (studentProfile) resetProfileFields(studentProfile);
  }, [resetProfileFields, studentProfile]);

  const previewUrl = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    return studentProfile?.photoUrl ?? null;
  }, [photoFile, studentProfile?.photoUrl]);

  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || studentProfile?.displayName || "Unnamed Student";
  const admissionNumberChanged = Boolean(
    studentProfile &&
    admissionNumber.trim() !== studentProfile.admissionNumber,
  );
  const profileDirty = Boolean(studentProfile && (
    firstName !== (studentProfile.firstName ?? "") ||
    lastName !== (studentProfile.lastName ?? "") ||
    admissionChanged(admissionNumber, studentProfile.admissionNumber) ||
    classId !== studentProfile.classId ||
    houseName !== (studentProfile.houseName ?? "") ||
    gender !== (studentProfile.gender ?? "") ||
    dateOfBirth !== toDateInput(studentProfile.dateOfBirth) ||
    guardianName !== (studentProfile.guardianName ?? "") ||
    guardianPhone !== (studentProfile.guardianPhone ?? "") ||
    address !== (studentProfile.address ?? "") ||
    photoFile !== null ||
    overrideReason !== "" || overrideConfirmed ||
    overrideCounterDecision !== "" || advanceCounterTo !== ""
  ));
  useDirtyForm({
    name: "Student profile edits",
    isDirty: profileDirty || isSaving || isArchiving || isPhotoProcessing,
    discard: () => {
      if (isSaving || isArchiving || isPhotoProcessing)
        throw new Error("Wait for the student profile operation to finish before leaving.");
      if (studentProfile) resetProfileFields(studentProfile);
    },
  });
  const admissionNumberOverrideReady =
    !admissionNumberChanged ||
    hasCompleteAdmissionNumberOverride({
      canOverride: canOverrideAdmissionNumber,
      confirmed: overrideConfirmed,
      reason: overrideReason,
      counterDecision: overrideCounterDecision,
      advanceCounterTo,
    });

  useEffect(() => {
    return () => {
      if (photoFile) URL.revokeObjectURL(previewUrl ?? "");
    };
  }, [photoFile, previewUrl]);

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Select Record
        </p>
        <p className="mt-1 text-xs text-slate-400 max-w-[140px]">
          Select a student to edit their full profile details.
        </p>
      </div>
    );
  }

  if (studentProfile === undefined) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
        Syncing Record...
      </div>
    );
  }

  const handleSave = async () => {
    if (!admissionNumberOverrideReady) {
      onNotice({
        tone: "error",
        message:
          "Admission-number changes require override permission, an audit reason, confirmation, and an explicit counter decision.",
      });
      return;
    }

    if (guardianPhone.trim() && !isValidPhoneNumber(guardianPhone)) {
      onNotice({
        tone: "error",
        message: "Enter a valid contact phone number (e.g. +234...).",
      });
      return;
    }

    const admissionChanged =
      admissionNumber.trim() !== studentProfile.admissionNumber;
    if (
      admissionChanged &&
      (!canOverrideAdmissionNumber ||
        !overrideConfirmed ||
        overrideReason.trim().length < 8)
    ) {
      onNotice({
        tone: "error",
        message:
          "Confirm the admission-number correction and provide an 8–240 character reason.",
      });
      return;
    }
    if (
      admissionChanged &&
      advanceCounterTo &&
      (!numbering?.formatVersion ||
        !numbering.counter ||
        numbering.nextSequence === null)
    ) {
      onNotice({
        tone: "error",
        message: "Review the current counter before explicitly advancing it.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateStudent({
        studentId,
        name: displayName,
        firstName,
        lastName,
        admissionNumber,
        overrideReason: admissionNumberChanged
          ? overrideReason.trim()
          : undefined,
        overrideConfirmed: admissionNumberChanged
          ? overrideConfirmed
          : undefined,
        overrideCounterDecision: admissionNumberChanged
          ? overrideCounterDecision || undefined
          : undefined,
        advanceCounterTo:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? Number(advanceCounterTo)
            : undefined,
        numberingVersion:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.version
            : undefined,
        numberingFormatVersion:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.formatVersion
            : undefined,
        numberingCounterKey:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.counter?.key
            : undefined,
        numberingCounterVersion:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.counter?.configVersion
            : undefined,
        numberingSessionId:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.activeSessionId ?? undefined
            : undefined,
        numberingResetPeriod:
          admissionNumberChanged && overrideCounterDecision === "advance"
            ? numbering?.resetPeriod ?? undefined
            : undefined,
        classId,
        houseName: houseName || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: guardianName || null,
        guardianPhone: guardianPhone || null,
        address: address || null,
      } as never);

      let photoUploadError: string | null = null;
      if (photoFile) {
        try {
          await uploadStudentPhoto(photoFile, studentId, saveStudentPhoto);
          setPhotoFile(null);
        } catch (photoErr) {
          photoUploadError = getUserFacingErrorMessage(photoErr, "Photo upload failed.");
        }
      }

      if (photoUploadError) {
        onNotice({
          tone: "warning",
          message: `${displayName} updated, but photo upload failed (${photoUploadError}). You can retry uploading the photo.`,
        });
      } else {
        onNotice({
          tone: "success",
          message: `${displayName} updated.`,
        });
      }
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Update failed."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = () => {
    if (!studentProfile) return;
    setIsArchiveConfirmOpen(true);
  };

  const executeArchive = async () => {
    if (!studentProfile) return;
    setIsArchiving(true);
    try {
      await archiveStudent({ studentId: studentProfile._id } as never);
      onNotice({ tone: "success", message: `${displayName} archived.` });
      onStudentArchived?.(studentProfile._id);
      setIsArchiveConfirmOpen(false);
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Archive failed."),
      });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {variant !== "sheet" && (
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <UserCog className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
                Student Profile
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Editing <span className="font-bold text-slate-900">{displayName}</span> ({studentProfile.className})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile / Family Tabs */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => onTabChange?.("profile")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "profile"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Profile Details
        </button>
        <button
          type="button"
          onClick={() => onTabChange?.("family")}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === "family"
              ? "bg-white text-slate-900 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Family & Contacts
        </button>
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-6">
          {studentProfile.enrollmentStatus === "graduated" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Graduated Alumnus
                  </span>
                  <p className="mt-1 text-xs text-slate-600">
                    Graduated
                    {studentProfile.graduatingSessionName ? ` in ${studentProfile.graduatingSessionName}` : ""}
                    {studentProfile.graduatingClassName ? ` from ${studentProfile.graduatingClassName}` : ""}.
                  </p>
                </div>
                {onViewAttestation && (
                  <button
                    type="button"
                    onClick={() => onViewAttestation(studentProfile._id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-[11px] font-bold transition shadow-xs cursor-pointer"
                  >
                    <span>Official Letter of Attestation</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <StudentPhotoPanel
              name={displayName}
              uploadAvailable={true}
              previewUrl={previewUrl}
              onPhotoChange={(file) => {
                setPhotoFile(file);
              }}
              onRemovePhoto={() => {
                setPhotoFile(null);
              }}
              resetKey={studentProfile._id}
              onProcessingChange={setIsPhotoProcessing}
              onValidationError={(m) => onNotice({ tone: "error", message: m })}
            />

            <StudentProfileFormFields
              firstName={firstName}
              lastName={lastName}
              admissionNumber={admissionNumber}
              classId={classId}
              houseName={houseName}
              gender={gender}
              dateOfBirth={dateOfBirth}
              guardianName={guardianName}
              guardianPhone={guardianPhone}
              address={address}
              classes={classes}
              onFirstNameChange={setFirstName}
              onLastNameChange={setLastName}
              onAdmissionNumberChange={setAdmissionNumber}
              onClassIdChange={setClassId}
              onHouseNameChange={setHouseName}
              onGenderChange={setGender}
              onDateOfBirthChange={setDateOfBirth}
              onGuardianNameChange={setGuardianName}
              onGuardianPhoneChange={setGuardianPhone}
              onAddressChange={setAddress}
            />

            {admissionNumberChanged && (
              <AdmissionNumberGovernanceFields
                canOverride={canOverrideAdmissionNumber}
                confirmed={overrideConfirmed}
                reason={overrideReason}
                counterDecision={overrideCounterDecision}
                advanceCounterTo={advanceCounterTo}
                policyConfigured={Boolean(admissionNumbering?.policy)}
                onConfirmedChange={setOverrideConfirmed}
                onReasonChange={setOverrideReason}
                onCounterDecisionChange={setOverrideCounterDecision}
                onAdvanceCounterToChange={setAdvanceCounterTo}
              />
            )}

            <PortalCredentialPanel
              title="Student Portal Access"
              description="Provision or refresh the portal login used by this student for the parent/student portal test flow."
              userId={studentProfile.userId}
              userName={studentProfile.displayName}
              email={studentProfile.email}
              defaultPassword="Student123!Pass"
              onNotice={onNotice}
            />
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-slate-200/60">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || isArchiving || isPhotoProcessing || !firstName.trim() || !lastName.trim() || !admissionNumber.trim() || !classId || !admissionNumberOverrideReady}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>
                {isSaving
                  ? "Saving Changes..."
                  : isPhotoProcessing
                    ? "Preparing photo..."
                    : "Save Identity"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void handleArchive()}
              disabled={isSaving || isArchiving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 text-sm font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isArchiving ? "Archiving..." : "Archive Record"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
                Household record
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 line-clamp-2">
              Manage parents and household links for{" "}
              <span className="font-bold text-slate-900">{displayName}</span>.
            </p>
          </div>

          <StudentFamilyPanel
            studentId={studentProfile._id}
            studentName={displayName}
            onNotice={onNotice}
          />
        </div>
      )}

      {/* Archive Student Confirmation Modal */}
      <ConfirmationModal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={executeArchive}
        title="Archive Student Record"
        description={`Are you sure you want to archive ${displayName}? The student will be removed from active class rosters and preserved in historical archives.`}
        confirmLabel="Archive Student"
        confirmVariant="danger"
        isLoading={isArchiving}
      />
    </div>
  );
}

function admissionChanged(current: string, original: string) {
  return current.trim() !== original;
}
