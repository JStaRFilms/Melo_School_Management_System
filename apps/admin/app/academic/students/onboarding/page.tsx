"use client";

import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage } from "@school/shared";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import { appToast } from "@school/shared/toast";
import { useDirtyForm, type DraftPayload } from "@school/shared/drafts";
import { useAuth } from "@/AuthProvider";
import { PersistentFormDraftControls } from "@/components/drafts/PersistentFormDraftControls";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useDraftConnection } from "@/useDraftConnection";
import { usePersistentFormDraft } from "@/usePersistentFormDraft";
import type { AdmissionCounterDecision } from "../components/AdmissionNumberGovernanceFields";
import { admissionParentGuardian, emptyAdmissionContact, restoreAdmissionContact } from "../components/admissionContact";
import { StudentCreationForm } from "../components/StudentCreationForm";
import { PortalCredentialPanel } from "../components/PortalCredentialPanel";
import { uploadStudentPhoto } from "../components/studentPhotoUpload";
import type { ClassSummary, EnrollmentNotice } from "../components/types";

export default function StudentOnboardingPage() {
  const { workspaceAccess, session } = useAuth();
  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const canOverrideAdmissionNumber = Boolean(workspaceAccess?.state === "ready" && workspaceAccess.effectiveCapabilities.includes("enrollment.admissions.override_number"));
  const classes = useQuery("functions/academic/academicSetup:listClasses" as never) as ClassSummary[] | undefined;
  const createStudent = useMutation(api.functions.academic.studentEnrollment.createStudent);
  const saveStudentPhoto = useAction("functions/academic/studentEnrollment:saveStudentPhoto" as never);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [admissionNumberMode, setAdmissionNumberMode] = useState<"automatic" | "manual">("automatic");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideCounterDecision, setOverrideCounterDecision] = useState<AdmissionCounterDecision>("");
  const [advanceCounterTo, setAdvanceCounterTo] = useState("");
  const [gender, setGender] = useState("");
  const [houseName, setHouseName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [emergencyContactMode, setEmergencyContactMode] = useState<"primary" | "override" | "legacy">("primary");
  const [address, setAddress] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [contact, setContact] = useState(emptyAdmissionContact);
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [studentPhotoResetKey, setStudentPhotoResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [duplicateReview, setDuplicateReview] = useState(false);
  const [enrollmentRequestKey, setEnrollmentRequestKey] = useState(() => crypto.randomUUID());
  const [draftInstanceKey, setDraftInstanceKey] = useState(0);
  const [completedStudentId, setCompletedStudentId] = useState<Id<"students"> | null>(null);
  const submittedArgs = useRef<FunctionArgs<typeof api.functions.academic.studentEnrollment.createStudent> | null>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const connection = useDraftConnection();
  const selectedClassLevel = classes?.find(item => item._id === selectedClassId)?.level;
  const numbering = useQuery(api.functions.academic.admissionNumbers.getAdmissionNumberPolicy, schoolId ? { schoolId, ...(selectedClassLevel ? { level: selectedClassLevel } : {}) } : "skip");
  const profile = useQuery(api.functions.academic.studentEnrollment.getStudentProfile, completedStudentId ? { studentId: completedStudentId } : "skip");
  const family = useQuery(api.functions.academic.studentEnrollment.getStudentFamilyProfile, completedStudentId ? { studentId: completedStudentId } : "skip");
  const draftData = useMemo<DraftPayload<"student_onboarding">>(() => ({
    firstName, middleName, lastName, admissionNumber, admissionNumberMode, overrideReason, overrideConfirmed,
    overrideCounterDecision, advanceCounterTo, reviewedNumbering: null, gender, houseName, dateOfBirth,
    guardianName, guardianPhone, emergencyContactMode, address, addressMode: "residential", classId: selectedClassId,
    ...contact, provisionStudentPortalAccess: false, provisionParentPortalAccess: false, enrollmentRequestKey,
  }), [firstName, middleName, lastName, admissionNumber, admissionNumberMode, overrideReason, overrideConfirmed, overrideCounterDecision, advanceCounterTo, gender, houseName, dateOfBirth, guardianName, guardianPhone, emergencyContactMode, address, selectedClassId, contact, enrollmentRequestKey]);
  const dirty = isSubmitting || Boolean(firstName || middleName || lastName || admissionNumber || gender || houseName || dateOfBirth || guardianName || guardianPhone || address || selectedClassId || contact.contactChoice !== "none" || studentPhotoFile || overrideReason);
  const draft = usePersistentFormDraft({
    formKey: "student_onboarding", schoolId, accountId: session?.user.id, connection, currentData: draftData,
    isDirty: dirty, instanceKey: draftInstanceKey,
    onRestore: payload => {
      setFirstName(payload.firstName); setMiddleName(payload.middleName ?? ""); setLastName(payload.lastName);
      setAdmissionNumber(payload.admissionNumber); setAdmissionNumberMode(payload.admissionNumberMode);
      setOverrideReason(payload.overrideReason); setOverrideConfirmed(payload.overrideConfirmed);
      setOverrideCounterDecision(payload.overrideCounterDecision); setAdvanceCounterTo(payload.advanceCounterTo);
      setGender(payload.gender); setHouseName(payload.houseName); setDateOfBirth(payload.dateOfBirth);
      setGuardianName(payload.guardianName); setGuardianPhone(payload.guardianPhone);
      setEmergencyContactMode(payload.emergencyContactMode ?? (payload.guardianName || payload.guardianPhone ? "legacy" : "primary"));
      setAddress(payload.address); setSelectedClassId(payload.classId); setContact(restoreAdmissionContact(payload));
      setEnrollmentRequestKey(payload.enrollmentRequestKey ?? crypto.randomUUID()); setStudentPhotoFile(null);
      setCompletedStudentId(null); submittedArgs.current = null;
    },
  });
  const resetForm = () => {
    setFirstName(""); setMiddleName(""); setLastName(""); setAdmissionNumber(""); setAdmissionNumberMode("automatic");
    setOverrideReason(""); setOverrideConfirmed(false); setOverrideCounterDecision(""); setAdvanceCounterTo("");
    setGender(""); setHouseName(""); setDateOfBirth(""); setGuardianName(""); setGuardianPhone("");
    setEmergencyContactMode("primary"); setAddress(""); setSelectedClassId(""); setContact(emptyAdmissionContact);
    setStudentPhotoFile(null); setStudentPhotoResetKey(key => key + 1); setEnrollmentRequestKey(crypto.randomUUID());
    submittedArgs.current = null;
  };
  const requestDeparture = useDirtyForm({ name: "Student admission", isDirty: dirty, save: draft.retrySave, discard: async () => {
    if (submitting.current) throw new Error("Wait for admission to finish.");
    await draft.handleDiscardDraft(); resetForm(); setCompletedStudentId(null);
  } });
  const showNotice = (notice: EnrollmentNotice) => {
    const options = { description: notice.message };
    if (notice.tone === "success") appToast.success("Success", options);
    else if (notice.tone === "warning") appToast.warning("Review required", options);
    else appToast.error("Something went wrong", options);
  };
  const previewUrl = useMemo(() => studentPhotoFile ? URL.createObjectURL(studentPhotoFile) : null, [studentPhotoFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const normalizeName = () => {
    const name = normalizeStructuredPersonName({ firstName, middleName, lastName });
    setFirstName(name.firstName ?? ""); setMiddleName(name.middleName ?? ""); setLastName(name.lastName ?? "");
  };
  const submit = async (confirmDuplicateLink = false) => {
    if (submitting.current || !numbering || !selectedClassId) return;
    submitting.current = true; setIsSubmitting(true);
    try {
      if (!submittedArgs.current) {
        const name = normalizeStructuredPersonName({ firstName, middleName, lastName });
        const parentGuardian = admissionParentGuardian(contact);
        const closure = await draft.prepareSubmission();
        const governed = Boolean(numbering.policy);
        submittedArgs.current = {
          requestKey: enrollmentRequestKey, firstName: name.firstName, middleName: name.middleName || undefined, lastName: name.lastName,
          admissionNumber: governed && admissionNumberMode === "automatic" ? "" : admissionNumber.trim(),
          classId: selectedClassId as Id<"classes">, gender, houseName: houseName.trim() || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null, address: address.trim() || null,
          addressMode: "residential", guardianName: guardianName.trim() || null, guardianPhone: guardianPhone.trim() || null,
          emergencyContactMode: emergencyContactMode === "legacy" ? undefined : emergencyContactMode, parentGuardian,
          ...(governed ? { numberingVersion: numbering.version, numberingFormatVersion: numbering.formatVersion ?? undefined,
            numberingCounterKey: numbering.counter?.key, numberingCounterVersion: numbering.counter?.configVersion,
            numberingSessionId: numbering.activeSessionId ?? undefined, numberingResetPeriod: numbering.resetPeriod ?? undefined } : {}),
          ...(governed && admissionNumberMode === "manual" ? { overrideReason: overrideReason.trim(), overrideConfirmed,
            overrideCounterDecision: overrideCounterDecision || undefined, advanceCounterTo: overrideCounterDecision === "advance" ? Number(advanceCounterTo) : undefined } : {}),
          ...(closure ? { draftId: closure.draftId, expectedDraftRevision: closure.expectedRevision, draftFormKey: "student_onboarding" } : {}),
        };
      }
      const id = await createStudent({ ...submittedArgs.current, confirmDuplicateLink: confirmDuplicateLink || undefined });
      setCompletedStudentId(id); draft.submissionSucceeded();
      let photoError: string | null = null;
      if (studentPhotoFile) {
        try { await uploadStudentPhoto(studentPhotoFile, id, saveStudentPhoto); }
        catch (error) { photoError = getUserFacingErrorMessage(error, "Photo upload failed."); }
      }
      resetForm(); setDraftInstanceKey(key => key + 1);
      showNotice({ tone: photoError ? "warning" : "success", message: photoError ? `Student admitted. Photo upload failed (${photoError}). Upload it from the profile.` : "Student admitted. Open the completed record below for portal access." });
    } catch (error) {
      draft.submissionFailed();
      const message = getUserFacingErrorMessage(error, "Admission failed. Retry the reviewed request.");
      if (message.includes("Review the duplicate-link details and confirm")) setDuplicateReview(true);
      else showNotice({ tone: "error", message });
    } finally { submitting.current = false; setIsSubmitting(false); }
  };
  const onSubmit = async (event: FormEvent) => { event.preventDefault(); await submit(); };
  if (!classes) return <p role="status">Loading onboarding...</p>;
  return <div className="mx-auto w-full max-w-3xl space-y-5 overflow-auto p-4 sm:p-6">
    <h1 className="text-xl font-bold text-slate-900">Admit student</h1>
    <PersistentFormDraftControls draft={draft} formTitle="student admission" isDirty={dirty} excludedFieldsNotice="Photos and passwords are not saved. Reselect the photo after recovery." onDiscard={async () => { await draft.handleDiscardDraft(); resetForm(); setDraftInstanceKey(key => key + 1); }} />
    {submittedArgs.current && !isSubmitting && <p role="status">A reviewed request is pending. Retry sends the same details. Discard the form before starting a different admission.</p>}
      <StudentCreationForm selectedClassName={classes.find(item => item._id === selectedClassId)?.name ?? "Select class"}
        classes={classes} selectedClassId={selectedClassId} onClassIdChange={setSelectedClassId}
        draftStatus={draft.status} draftLastSavedAt={draft.lastSavedAt}
        locked={submittedArgs.current !== null}
        studentFirstName={firstName} studentMiddleName={middleName} studentLastName={lastName}
        onStudentFirstNameChange={setFirstName} onStudentFirstNameBlur={normalizeName} onStudentMiddleNameChange={setMiddleName}
        onStudentLastNameChange={setLastName} onStudentLastNameBlur={normalizeName}
        admissionNumber={admissionNumber} admissionNumberMode={admissionNumberMode} numberingPolicyConfigured={Boolean(numbering?.policy)}
        numberingPolicyLoading={numbering === undefined} numberingPreview={numbering?.preview ?? null} canOverrideAdmissionNumber={canOverrideAdmissionNumber}
        overrideReason={overrideReason} overrideConfirmed={overrideConfirmed} overrideCounterDecision={overrideCounterDecision} advanceCounterTo={advanceCounterTo}
        onAdmissionNumberChange={setAdmissionNumber} onAdmissionNumberModeChange={setAdmissionNumberMode} onOverrideReasonChange={setOverrideReason}
        onOverrideConfirmedChange={setOverrideConfirmed} onOverrideCounterDecisionChange={setOverrideCounterDecision} onAdvanceCounterToChange={setAdvanceCounterTo}
        gender={gender} onGenderChange={setGender} houseName={houseName} onHouseNameChange={setHouseName} dateOfBirth={dateOfBirth} onDateOfBirthChange={setDateOfBirth}
        guardianName={guardianName} onGuardianNameChange={setGuardianName} guardianPhone={guardianPhone} onGuardianPhoneChange={setGuardianPhone}
        emergencyContactMode={emergencyContactMode} onEmergencyContactModeChange={setEmergencyContactMode} address={address} onAddressChange={setAddress}
        contact={contact} onContactChange={setContact} photoPreviewUrl={previewUrl} photoResetKey={studentPhotoResetKey} onPhotoChange={setStudentPhotoFile}
        onRemovePhoto={() => setStudentPhotoFile(null)} onPhotoValidationError={message => showNotice({ tone: "error", message })}
        sectionRef={sectionRef} inputRef={firstNameInputRef} isSubmitting={isSubmitting} onSubmit={onSubmit} />
    <button type="button" onClick={() => void requestDeparture({ kind: "close" })}>Discard admission</button>
    {completedStudentId && profile && <section className="space-y-3 border-t border-slate-200 pt-4">
      <h2 className="font-bold">Completed admission: {profile.displayName}</h2>
      <Link href={`/academic/students?studentId=${completedStudentId}&classId=${profile.classId}&tab=profile`}>Open student profile</Link>
      <PortalCredentialPanel key={profile.userId} title="Student portal access" userId={profile.userId} userName={profile.displayName} email={profile.email} defaultPassword="" onNotice={showNotice} />
      {family?.parents.map(parent => <PortalCredentialPanel key={parent.parentUserId} title={`Portal access for ${parent.name}`} userId={parent.parentUserId} userName={parent.name} email={parent.email} defaultPassword="" onNotice={showNotice} />)}
    </section>}
    <ConfirmationModal isOpen={duplicateReview} onClose={() => setDuplicateReview(false)} onConfirm={() => { setDuplicateReview(false); void submit(true); }} title="Join existing household?" description="The contact already belongs to a household. This student will join that household. Stored identity and credentials will not change. Any confirmed primary-contact change affects all linked students." confirmLabel="Confirm household link" confirmVariant="warning" />
  </div>;
}
