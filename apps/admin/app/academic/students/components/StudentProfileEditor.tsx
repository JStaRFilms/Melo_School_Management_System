"use client";

import { getUserFacingErrorMessage } from "@school/shared";
import { useMutation,useQuery } from "convex/react";
import { CheckCircle2, Trash2, UserCog, Users } from "lucide-react";
import { useEffect,useMemo,useState } from "react";

import { PortalCredentialPanel } from "./PortalCredentialPanel";
import { StudentFamilyPanel } from "./StudentFamilyPanel";
import { StudentPhotoPanel } from "./StudentPhotoPanel";
import { StudentProfileFormFields } from "./StudentProfileFormFields";
import { uploadStudentPhoto } from "./studentPhotoUpload";
import type { ClassSummary,EnrollmentNotice } from "./types";

interface StudentProfileEditorProps {
  studentId: string | null;
  classes: ClassSummary[];
  onNotice: (notice: EnrollmentNotice) => void;
  onStudentArchived?: (studentId: string) => void;
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
  variant,
  activeTab = "profile",
  onTabChange,
}: StudentProfileEditorProps) {
  const studentProfile = useQuery(
    "functions/academic/studentEnrollment:getStudentProfile" as never,
    studentId ? ({ studentId } as never) : ("skip" as never)
  ) as StudentProfile | undefined;
  const updateStudent = useMutation(
    "functions/academic/studentEnrollment:updateStudent" as never
  );
  const archiveStudent = useMutation(
    "functions/academic/studentEnrollment:archiveStudent" as never
  );
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [houseName, setHouseName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (!studentProfile) return;
    setFirstName(studentProfile.firstName ?? "");
    setLastName(studentProfile.lastName ?? "");
    setAdmissionNumber(studentProfile.admissionNumber);
    setClassId(studentProfile.classId);
    setHouseName(studentProfile.houseName ?? "");
    setGender(studentProfile.gender ?? "");
    setDateOfBirth(toDateInput(studentProfile.dateOfBirth));
    setGuardianName(studentProfile.guardianName ?? "");
    setGuardianPhone(studentProfile.guardianPhone ?? "");
    setAddress(studentProfile.address ?? "");
    setPhotoFile(null);
    setClearPhoto(false);
  }, [studentProfile]);

  const previewUrl = useMemo(() => {
    if (photoFile) return URL.createObjectURL(photoFile);
    if (clearPhoto) return null;
    return studentProfile?.photoUrl ?? null;
  }, [clearPhoto, photoFile, studentProfile?.photoUrl]);

  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || studentProfile?.displayName || "Unnamed Student";

  useEffect(() => {
    return () => {
      if (photoFile) URL.revokeObjectURL(previewUrl ?? "");
    };
  }, [photoFile, previewUrl]);

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-40 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 text-center">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Record</p>
        <p className="mt-1 text-xs text-slate-400 max-w-[140px]">Select a student to edit their full profile details.</p>
      </div>
    );
  }

  if (studentProfile === undefined) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Record...</div>;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const uploadedPhotoMetadata = photoFile
        ? await uploadStudentPhoto(photoFile, () =>
            generateStudentPhotoUploadUrl({} as never) as Promise<string>
          )
        : null;
      await updateStudent({
        studentId,
        name: displayName,
        firstName,
        lastName,
        admissionNumber,
        classId,
        houseName: houseName || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        guardianName: guardianName || null,
        guardianPhone: guardianPhone || null,
        address: address || null,
        photoStorageId: clearPhoto
          ? null
          : uploadedPhotoMetadata?.storageId ?? undefined,
        photoFileName: clearPhoto
          ? null
          : uploadedPhotoMetadata?.fileName ?? undefined,
        photoContentType: clearPhoto
          ? null
          : uploadedPhotoMetadata?.contentType ?? undefined,
      } as never);

      onNotice({
        tone: "success",
        message: `${displayName} updated.`,
      });
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Update failed.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!studentProfile) return;
    if (!window.confirm(`Archive ${displayName}?`)) return;

    setIsArchiving(true);
    try {
      await archiveStudent({ studentId: studentProfile._id } as never);
      onNotice({ tone: "success", message: `${displayName} archived.` });
      onStudentArchived?.(studentProfile._id);
    } catch (error) {
      onNotice({ tone: "error", message: getUserFacingErrorMessage(error, "Archive failed.") });
    } finally {
      setIsArchiving(false);
    }
  };

  const isSidebar = variant !== "inline";

  return (
    <div className="space-y-6 pb-10">
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
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <UserCog className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-[0.1em] text-slate-900">
                Edit Identity
              </h2>
            </div>
            <p className="text-xs font-medium text-slate-500 line-clamp-2">
              Modify core records and credentials for <span className="font-bold text-slate-900">{displayName}</span>.
            </p>
          </div>

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
              disabled={isSaving || isArchiving || !firstName.trim() || !lastName.trim() || !admissionNumber.trim() || !classId}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>{isSaving ? "Saving Changes..." : "Save Identity"}</span>
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
              Manage parents and household links for <span className="font-bold text-slate-900">{displayName}</span>.
            </p>
          </div>

          <StudentFamilyPanel
            studentId={studentProfile._id}
            studentName={displayName}
            onNotice={onNotice}
          />
        </div>
      )}
    </div>
  );
}
