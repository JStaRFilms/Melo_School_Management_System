"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@/AuthProvider";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isValidEmailAddress } from "@school/auth";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useDirtyForm } from "@school/shared/drafts";

import { humanNameFinalStrict } from "@/human-name";

import { uploadStudentPhoto } from "../components/studentPhotoUpload";
import type { ClassSummary } from "../components/types";
import { StudentFirstOnboardingForm } from "./StudentFirstOnboardingForm";

type PortalCredentialResult = {
  userId: string;
  email: string;
  temporaryPassword: string;
};

type FamilyLinkResult = {
  familyId: string;
  parentUserId: string;
  familyMemberId: string;
};

export default function StudentOnboardingPage() {
  const classes = useQuery(
    "functions/academic/academicSetup:listClasses" as never,
  ) as ClassSummary[] | undefined;
  const createStudent = useMutation(
    "functions/academic/studentEnrollment:createStudent" as never,
  );
  const upsertStudentFamilyLink = useMutation(
    "functions/academic/studentEnrollment:upsertStudentFamilyLink" as never,
  );
  const generateStudentPhotoUploadUrl = useMutation(
    "functions/academic/studentEnrollment:generateStudentPhotoUploadUrl" as never,
  );
  const upsertPortalCredentials = useAction(
    "functions/academic/studentEnrollment:upsertPortalCredentials" as never,
  );
  const upsertStudentPortalCredentialsByStudentId = useAction(
    "functions/academic/studentEnrollment:upsertStudentPortalCredentialsByStudentId" as never,
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [advanceCounterTo, setAdvanceCounterTo] = useState("");
  const [gender, setGender] = useState("");
  const [houseName, setHouseName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [address, setAddress] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const canNumber = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "enrollment.intakes.manage" } : "skip",
  );
  const canOverride = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId
      ? { schoolId, capability: "enrollment.admissions.override_number" }
      : "skip",
  );
  const numbering = useQuery(
    api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
    schoolId && canNumber
      ? {
          schoolId,
          level: classes?.find((c) => c._id === selectedClassId)?.level,
        }
      : "skip",
  );
  const [reviewedNumbering, setReviewedNumbering] = useState<{
    policyVersion: number;
    formatVersion: string;
    counterKey: string;
    counterVersion: number;
  } | null>(null);
  const [studentPhotoFile, setStudentPhotoFile] = useState<File | null>(null);
  const [studentPhotoResetKey, setStudentPhotoResetKey] = useState(0);
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [isParentPrimaryContact, setIsParentPrimaryContact] = useState(true);
  const [provisionStudentPortalAccess, setProvisionStudentPortalAccess] =
    useState(false);
  const [provisionParentPortalAccess, setProvisionParentPortalAccess] =
    useState(false);
  const [studentTemporaryPassword, setStudentTemporaryPassword] =
    useState("Student123!Pass");
  const [parentTemporaryPassword, setParentTemporaryPassword] =
    useState("Parent123!Pass");
  const [credentialSummary, setCredentialSummary] = useState<{
    student: { email: string; temporaryPassword: string } | null;
    parent: { email: string; temporaryPassword: string } | null;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const requestKey = useRef<string | null>(null);
  const createdStudent = useRef<string | null>(null);
  const [followUpPending, setFollowUpPending] = useState(false);

  const requestDeparture = useDirtyForm({
    name: "Student enrollment (not saved as a draft)",
    isDirty:
      isSubmitting ||
      followUpPending ||
      Boolean(
        firstName ||
        lastName ||
        admissionNumber ||
        overrideReason ||
        overrideConfirmed ||
        advanceCounterTo ||
        gender ||
        houseName ||
        dateOfBirth ||
        guardianName ||
        guardianPhone ||
        address ||
        selectedClassId ||
        studentPhotoFile ||
        parentFirstName ||
        parentLastName ||
        parentEmail ||
        parentPhone ||
        parentRelationship ||
        !isParentPrimaryContact ||
        provisionStudentPortalAccess ||
        provisionParentPortalAccess ||
        studentTemporaryPassword !== "Student123!Pass" ||
        parentTemporaryPassword !== "Parent123!Pass",
      ),
    discard: () => {
      if (isSubmitting)
        throw new Error(
          "Wait for the enrollment request to finish before leaving.",
        );
      resetForm();
      setCredentialSummary(null);
    },
  });

  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);

  const showNotice = (notice: {
    tone: "success" | "error" | "warning";
    title?: string;
    message: string;
  }) => {
    const title =
      notice.title ??
      (notice.tone === "success"
        ? "Success"
        : notice.tone === "warning"
          ? "Review required"
          : "Something went wrong");

    if (notice.tone === "success") {
      appToast.success(title, { description: notice.message });
      return;
    }

    if (notice.tone === "warning") {
      appToast.warning(title, { description: notice.message });
      return;
    }

    appToast.error(title, { description: notice.message });
  };

  const photoPreviewUrl = useMemo(() => {
    if (!studentPhotoFile) {
      return null;
    }

    return URL.createObjectURL(studentPhotoFile);
  }, [studentPhotoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  if (classes === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 mx-auto rounded-xl bg-slate-100 animate-pulse" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Loading onboarding
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    createdStudent.current = null;
    setFollowUpPending(false);
    setFirstName("");
    setLastName("");
    setAdmissionNumber("");
    setOverrideReason("");
    setOverrideConfirmed(false);
    setAdvanceCounterTo("");
    setReviewedNumbering(null);
    requestKey.current = null;
    setGender("");
    setHouseName("");
    setDateOfBirth("");
    setGuardianName("");
    setGuardianPhone("");
    setAddress("");
    setSelectedClassId("");
    setStudentPhotoFile(null);
    setStudentPhotoResetKey((key) => key + 1);
    setParentFirstName("");
    setParentLastName("");
    setParentEmail("");
    setParentPhone("");
    setParentRelationship("");
    setIsParentPrimaryContact(true);
    setProvisionStudentPortalAccess(false);
    setProvisionParentPortalAccess(false);
    setStudentTemporaryPassword("Student123!Pass");
    setParentTemporaryPassword("Parent123!Pass");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    const normalizedFirstName = humanNameFinalStrict(firstName);
    const normalizedLastName = humanNameFinalStrict(lastName);
    const normalizedParentFirstName = humanNameFinalStrict(parentFirstName);
    const normalizedParentLastName = humanNameFinalStrict(parentLastName);
    const normalizedParentEmail = parentEmail.trim().toLowerCase();
    const shouldLinkParent = [
      parentFirstName,
      parentLastName,
      parentEmail,
      parentPhone,
      parentRelationship,
    ].some((value) => value.trim().length > 0);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !gender.trim() ||
      !selectedClassId
    ) {
      return;
    }

    if (
      !admissionNumber.trim() &&
      (!numbering?.preview ||
        !numbering.formatVersion ||
        !numbering.counter ||
        reviewedNumbering?.policyVersion !== numbering.version ||
        reviewedNumbering.formatVersion !== numbering.formatVersion ||
        reviewedNumbering.counterKey !== numbering.counter.key ||
        reviewedNumbering.counterVersion !== numbering.counter.configVersion)
    ) {
      showNotice({
        tone: "error",
        message: "Review the available numbering policy before enrolling.",
      });
      return;
    }
    if (shouldLinkParent) {
      if (
        !normalizedParentFirstName ||
        !normalizedParentLastName ||
        !normalizedParentEmail
      ) {
        showNotice({
          tone: "error",
          message:
            "Parent first name, last name, and email are required when linking a parent during onboarding.",
        });
        return;
      }

      if (!isValidEmailAddress(normalizedParentEmail)) {
        showNotice({
          tone: "error",
          message:
            "Enter a valid parent email address before linking portal access.",
        });
        return;
      }
    }

    if (provisionParentPortalAccess && !shouldLinkParent) {
      showNotice({
        tone: "error",
        message:
          "Link a parent first before provisioning parent portal access.",
      });
      return;
    }

    if (provisionStudentPortalAccess && !studentTemporaryPassword.trim()) {
      showNotice({
        tone: "error",
        message: "Student portal access needs a temporary password.",
      });
      return;
    }

    if (provisionParentPortalAccess && !parentTemporaryPassword.trim()) {
      showNotice({
        tone: "error",
        message: "Parent portal access needs a temporary password.",
      });
      return;
    }

    setIsSubmitting(true);

    setCredentialSummary(null);

    let uploadedPhoto = false;
    try {
      const uploadedPhotoMetadata =
        studentPhotoFile && !createdStudent.current
          ? await uploadStudentPhoto(
              studentPhotoFile,
              () =>
                generateStudentPhotoUploadUrl({} as never) as Promise<string>,
            )
          : null;
      uploadedPhoto = Boolean(uploadedPhotoMetadata);

      requestKey.current ??= crypto.randomUUID();
      const createdStudentId =
        createdStudent.current ??
        ((await createStudent({
          requestKey: requestKey.current,
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          admissionNumber: admissionNumber.trim(),
          numberingVersion: reviewedNumbering?.policyVersion,
          numberingFormatVersion: reviewedNumbering?.formatVersion,
          numberingCounterKey: reviewedNumbering?.counterKey,
          numberingCounterVersion: reviewedNumbering?.counterVersion,
          overrideReason,
          overrideConfirmed,
          advanceCounterTo: advanceCounterTo
            ? Number(advanceCounterTo)
            : undefined,
          classId: selectedClassId,
          gender,
          houseName: houseName.trim() || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
          guardianName: guardianName.trim() || null,
          guardianPhone: guardianPhone.trim() || null,
          address: address.trim() || null,
          photoStorageId: uploadedPhotoMetadata?.storageId,
          photoFileName: uploadedPhotoMetadata?.fileName,
          photoContentType: uploadedPhotoMetadata?.contentType,
        } as never)) as string);
      createdStudent.current = createdStudentId;
      setFollowUpPending(true);

      let familyLinkResult: FamilyLinkResult | null = null;
      if (
        shouldLinkParent &&
        normalizedParentFirstName &&
        normalizedParentLastName
      ) {
        familyLinkResult = (await upsertStudentFamilyLink({
          studentId: createdStudentId,
          firstName: normalizedParentFirstName,
          lastName: normalizedParentLastName,
          email: normalizedParentEmail,
          phone: parentPhone.trim() || null,
          relationship: parentRelationship.trim() || null,
          isPrimaryContact: isParentPrimaryContact,
        } as never)) as FamilyLinkResult;
      }

      let studentCredentialResult: PortalCredentialResult | null = null;
      if (provisionStudentPortalAccess) {
        studentCredentialResult =
          (await upsertStudentPortalCredentialsByStudentId({
            studentId: createdStudentId,
            temporaryPassword: studentTemporaryPassword.trim(),
          } as never)) as PortalCredentialResult;
      }

      let parentCredentialResult: PortalCredentialResult | null = null;
      if (provisionParentPortalAccess && familyLinkResult) {
        parentCredentialResult = (await upsertPortalCredentials({
          userId: familyLinkResult.parentUserId,
          temporaryPassword: parentTemporaryPassword.trim(),
        } as never)) as PortalCredentialResult;
      }

      const selectedClassName =
        classes.find((classDoc) => classDoc._id === selectedClassId)?.name ??
        "the class";

      setCredentialSummary({
        student: studentCredentialResult
          ? {
              email: studentCredentialResult.email,
              temporaryPassword: studentCredentialResult.temporaryPassword,
            }
          : null,
        parent: parentCredentialResult
          ? {
              email: parentCredentialResult.email,
              temporaryPassword: parentCredentialResult.temporaryPassword,
            }
          : null,
      });

      resetForm();
      showNotice({
        tone: "success",
        message: `${normalizedFirstName} ${normalizedLastName} enrolled to ${selectedClassName}${shouldLinkParent ? " · parent linked" : ""}${provisionStudentPortalAccess || provisionParentPortalAccess ? " · portal ready" : ""}.`,
      });
      firstNameInputRef.current?.focus();
    } catch (error) {
      showNotice({
        tone: "error",
        message: createdStudent.current
          ? "The student was created. Family or portal setup is incomplete. Retry in this tab to finish setup for the same student; do not start a second enrollment."
          : getUserFacingErrorMessage(
              error,
              uploadedPhoto
                ? "The photo uploaded, but we couldn't finish creating the student."
                : "We couldn't create the student right now.",
            ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="space-y-2 p-4">
        <p role="status">
          Edits are held only in this page, not saved as a draft. Photos and
          credentials are not recoverable after leaving.
        </p>
        {followUpPending && (
          <p role="alert">
            Student created; follow-up setup is pending. Retry uses the same
            student. Identity edits here will not update that created record.
          </p>
        )}
        <a className="underline" href="/admin/settings/admission-numbering">
          Admission numbering settings
        </a>
        <p>
          Leave admission number blank for atomic allocation on successful
          enrollment. Supplied historical identifiers are preserved; manual
          overrides require separate permission.
        </p>
        {!admissionNumber.trim() && (
          <div>
            <p>
              {canNumber === false
                ? "Numbering access denied."
                : numbering === undefined
                  ? "Loading numbering policy…"
                  : numbering.preview
                    ? `Next illustrative number: ${numbering.preview}. Not reserved; concurrent enrollment can change the sequence.`
                    : "Configure numbering, select a class and ensure one active academic session."}
            </p>
            {numbering?.preview &&
              numbering.formatVersion &&
              numbering.counter && (
                <label>
                  <input
                    type="checkbox"
                    checked={
                      reviewedNumbering?.formatVersion ===
                        numbering.formatVersion &&
                      reviewedNumbering.counterVersion ===
                        numbering.counter.configVersion
                    }
                    onChange={(e) =>
                      setReviewedNumbering(
                        e.target.checked
                          ? {
                              policyVersion: numbering.version,
                              formatVersion: numbering.formatVersion!,
                              counterKey: numbering.counter!.key,
                              counterVersion: numbering.counter!.configVersion,
                            }
                          : null,
                      )
                    }
                  />{" "}
                  I reviewed format {numbering.formatVersion},{" "}
                  {numbering.counter.name} configuration{" "}
                  {numbering.counter.configVersion}; allocate on successful
                  enrollment.
                </label>
              )}
          </div>
        )}
        {admissionNumber.trim() && canOverride === false && (
          <p role="alert">
            Manual admission override access denied. Ask an authorized registrar
            to preserve a supplied historical identifier; automatic allocation
            is only for genuinely missing identifiers.
          </p>
        )}
        {admissionNumber.trim() && (
          <fieldset disabled={canOverride !== true} className="space-y-2">
            <legend>Manual override review</legend>
            <label className="block">
              Reason
              <input
                className="block border p-2"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </label>
            <label className="block">
              Explicit next counter (blank = unchanged)
              <input
                className="block border p-2"
                type="number"
                min="1"
                step="1"
                value={advanceCounterTo}
                onChange={(e) => setAdvanceCounterTo(e.target.value)}
              />
            </label>
            {advanceCounterTo &&
              numbering?.formatVersion &&
              numbering.counter && (
                <label className="block">
                  <input
                    type="checkbox"
                    checked={
                      reviewedNumbering?.formatVersion ===
                        numbering.formatVersion &&
                      reviewedNumbering.counterVersion ===
                        numbering.counter.configVersion
                    }
                    onChange={(e) =>
                      setReviewedNumbering(
                        e.target.checked
                          ? {
                              policyVersion: numbering.version,
                              formatVersion: numbering.formatVersion!,
                              counterKey: numbering.counter!.key,
                              counterVersion: numbering.counter!.configVersion,
                            }
                          : null,
                      )
                    }
                  />{" "}
                  I reviewed counter {numbering.counter.name}, next{" "}
                  {numbering.nextSequence}, configuration{" "}
                  {numbering.counter.configVersion}.
                </label>
              )}
            <label>
              <input
                type="checkbox"
                checked={overrideConfirmed}
                onChange={(e) => setOverrideConfirmed(e.target.checked)}
              />{" "}
              I confirm this identifier and the counter decision.
            </label>
          </fieldset>
        )}
      </section>
      <StudentFirstOnboardingForm
        classes={classes}
        selectedClassId={selectedClassId}
        firstName={firstName}
        lastName={lastName}
        admissionNumber={admissionNumber}
        gender={gender}
        houseName={houseName}
        dateOfBirth={dateOfBirth}
        guardianName={guardianName}
        guardianPhone={guardianPhone}
        address={address}
        parentFirstName={parentFirstName}
        parentLastName={parentLastName}
        parentEmail={parentEmail}
        parentPhone={parentPhone}
        parentRelationship={parentRelationship}
        isParentPrimaryContact={isParentPrimaryContact}
        provisionStudentPortalAccess={provisionStudentPortalAccess}
        provisionParentPortalAccess={provisionParentPortalAccess}
        studentTemporaryPassword={studentTemporaryPassword}
        parentTemporaryPassword={parentTemporaryPassword}
        credentialSummary={credentialSummary}
        photoPreviewUrl={photoPreviewUrl}
        photoResetKey={studentPhotoResetKey}
        isSubmitting={isSubmitting}
        firstNameInputRef={firstNameInputRef}
        onFirstNameChange={(value) => setFirstName(value)}
        onFirstNameBlur={(value) => setFirstName(humanNameFinalStrict(value))}
        onLastNameChange={(value) => setLastName(value)}
        onLastNameBlur={(value) => setLastName(humanNameFinalStrict(value))}
        onAdmissionNumberChange={setAdmissionNumber}
        onGenderChange={setGender}
        onHouseNameChange={setHouseName}
        onDateOfBirthChange={setDateOfBirth}
        onGuardianNameChange={setGuardianName}
        onGuardianPhoneChange={setGuardianPhone}
        onAddressChange={setAddress}
        onParentFirstNameChange={(value) => setParentFirstName(value)}
        onParentLastNameChange={(value) => setParentLastName(value)}
        onParentEmailChange={setParentEmail}
        onParentPhoneChange={setParentPhone}
        onParentRelationshipChange={setParentRelationship}
        onIsParentPrimaryContactChange={setIsParentPrimaryContact}
        onProvisionStudentPortalAccessChange={setProvisionStudentPortalAccess}
        onProvisionParentPortalAccessChange={setProvisionParentPortalAccess}
        onStudentTemporaryPasswordChange={setStudentTemporaryPassword}
        onParentTemporaryPasswordChange={setParentTemporaryPassword}
        onClassIdChange={setSelectedClassId}
        onPhotoChange={setStudentPhotoFile}
        onRemovePhoto={() => setStudentPhotoFile(null)}
        onPhotoValidationError={(message) =>
          showNotice({
            tone: "error",
            message,
          })
        }
        onReset={() => {
          void requestDeparture({ kind: "close" }).then((approved) => {
            if (approved) resetForm();
          });
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
