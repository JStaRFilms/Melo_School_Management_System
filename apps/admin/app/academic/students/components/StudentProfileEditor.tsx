"use client";

import Link from "next/link";
import { getUserFacingErrorMessage, isValidPhoneNumber } from "@school/shared";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Trash2, UserCog, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/AuthProvider";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
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
      : undefined;
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
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never,
  );
  const canOverrideAdmissionNumber = useQuery(
    "functions/academic/rbac:hasViewerCapability" as never,
    schoolId
      ? ({
          schoolId,
          capability: "enrollment.admissions.override_number",
        } as never)
      : ("skip" as never),
  ) as boolean | undefined;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [advanceCounterTo, setAdvanceCounterTo] = useState("");
  const [classId, setClassId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
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
        nextSequence: number | null;
      }
    | undefined;

  useEffect(() => {
    if (!studentProfile) return;
    setFirstName(studentProfile.firstName ?? "");
    setLastName(studentProfile.lastName ?? "");
    setAdmissionNumber(studentProfile.admissionNumber);
    setOverrideReason("");
    setOverrideConfirmed(false);
    setAdvanceCounterTo("");
    setClassId(studentProfile.classId);
    setHouseName(studentProfile.houseName ?? "");
    setGender(studentProfile.gender ?? "");
    setDateOfBirth(toDateInput(studentProfile.dateOfBirth));
    setGuardianName(studentProfile.guardianName ?? "");
    setGuardianPhone(studentProfile.guardianPhone ?? "");
    setAddress(studentProfile.address ?? "");
    setPhotoFile(null);
    setClearPhoto(false);
    setIsPhotoProcessing(false);
  }, [studentProfile]);

  const previewUrl = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    if (clearPhoto) return null;
    return studentProfile?.photoUrl ?? null;
  }, [clearPhoto, photoFile, studentProfile?.photoUrl]);

  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
    studentProfile?.displayName ||
    "Unnamed Student";

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
      const uploadedPhotoMetadata = photoFile
        ? await uploadStudentPhoto(
            photoFile,
            () => generateStudentPhotoUploadUrl({} as never) as Promise<string>,
          )
        : null;
      await updateStudent({
        studentId,
        name: displayName,
        firstName,
        lastName,
        admissionNumber,
        overrideReason: admissionChanged ? overrideReason : undefined,
        overrideConfirmed: admissionChanged ? overrideConfirmed : undefined,
        advanceCounterTo:
          admissionChanged && advanceCounterTo
            ? Number(advanceCounterTo)
            : undefined,
        numberingVersion:
          admissionChanged && advanceCounterTo ? numbering?.version : undefined,
        numberingFormatVersion:
          admissionChanged && advanceCounterTo
            ? numbering?.formatVersion
            : undefined,
        numberingCounterKey:
          admissionChanged && advanceCounterTo
            ? numbering?.counter?.key
            : undefined,
        numberingCounterVersion:
          admissionChanged && advanceCounterTo
            ? numbering?.counter?.configVersion
            : undefined,
        classId,
        houseName: houseName || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: guardianName || null,
        guardianPhone: guardianPhone || null,
        address: address || null,
        photoStorageId: clearPhoto
          ? null
          : (uploadedPhotoMetadata?.storageId ?? undefined),
        photoFileName: clearPhoto
          ? null
          : (uploadedPhotoMetadata?.fileName ?? undefined),
        photoContentType: clearPhoto
          ? null
          : (uploadedPhotoMetadata?.contentType ?? undefined),
      } as never);

      onNotice({
        tone: "success",
        message: `${displayName} updated.`,
      });
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

  const isSidebar = variant !== "inline";

  return (
    <div className="space-y-6 pb-10">
      {studentId && (
        <Link
          className="block text-sm underline"
          href={`/academic/students/transfers?student=${encodeURIComponent(studentId)}`}
        >
          Within-group transfer history
        </Link>
      )}
      {/* Tab Switcher - Only in Sidebar/Default Desktop mode */}
      {isSidebar && (
        <div className="flex p-1 bg-slate-100/60 rounded-xl mb-2">
          <button
            type="button"
            onClick={() => onTabChange?.("profile")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "profile"
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <UserCog className="h-3.5 w-3.5" />
            Identity
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.("family")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "family"
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-950/5"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Family
          </button>
        </div>
      )}

      {activeTab === "profile" ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <UserCog className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
                  Edit Identity
                </h2>
              </div>

              {studentProfile.enrollmentStatus === "graduated" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900">
                  🎓 Graduated / Alumnus
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 line-clamp-2">
              Modify core records and credentials for{" "}
              <span className="font-bold text-slate-900">{displayName}</span>.
            </p>
          </div>

          {studentProfile.enrollmentStatus === "graduated" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Alumni Lifecycle Status
                  </span>
                  <p className="text-[11px] text-emerald-950 font-medium">
                    Graduated from{" "}
                    {studentProfile.graduatingClassName ||
                      studentProfile.className}{" "}
                    ({studentProfile.graduatingSessionName || "Final Session"}).
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
              previewUrl={previewUrl}
              onPhotoChange={(file) => {
                setPhotoFile(file);
                setClearPhoto(false);
              }}
              onRemovePhoto={() => {
                setPhotoFile(null);
                setClearPhoto(true);
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

            {admissionNumber.trim() !== studentProfile.admissionNumber && (
              <fieldset
                className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                disabled={canOverrideAdmissionNumber !== true}
              >
                <legend className="font-bold text-amber-950">
                  Admission-number correction
                </legend>
                {canOverrideAdmissionNumber === false && (
                  <p role="alert" className="text-sm text-rose-800">
                    Override Admission Number permission is required.
                  </p>
                )}
                <p className="text-xs text-amber-900">
                  The old identifier remains permanently claimed. The official
                  counter is unchanged unless you make an explicit reviewed
                  advancement.
                </p>
                <label className="block text-sm font-semibold">
                  Correction reason
                  <input
                    aria-label="Admission number correction reason"
                    className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2"
                    value={overrideReason}
                    maxLength={240}
                    onChange={(event) => setOverrideReason(event.target.value)}
                  />
                </label>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={overrideConfirmed}
                    onChange={(event) =>
                      setOverrideConfirmed(event.target.checked)
                    }
                  />
                  I confirm this exact replacement identifier.
                </label>
                <label className="block text-sm font-semibold">
                  Explicit next sequence (optional)
                  <input
                    aria-label="Explicit next admission sequence"
                    className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2"
                    type="number"
                    min="1"
                    step="1"
                    value={advanceCounterTo}
                    onChange={(event) =>
                      setAdvanceCounterTo(event.target.value)
                    }
                  />
                </label>
                {advanceCounterTo ? (
                  <p className="text-xs text-amber-900">
                    {numbering?.counter && numbering.nextSequence !== null
                      ? `Counter '${numbering.counter.key}' is currently ${numbering.nextSequence}; its configuration and effective format will be version-checked when saved.`
                      : "Loading current counter status…"}
                  </p>
                ) : (
                  <p className="text-xs text-amber-900">
                    Counter decision: unchanged.
                  </p>
                )}
              </fieldset>
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
              disabled={
                isSaving ||
                isArchiving ||
                isPhotoProcessing ||
                !firstName.trim() ||
                !lastName.trim() ||
                !admissionNumber.trim() ||
                !classId
              }
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
