"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { AlertTriangle, BadgeCheck, Check, Link2, Mail, PencilLine, Phone, PlusCircle, ShieldAlert, Trash2, Unlink2, Users, X } from "lucide-react";
import { api } from "@school/convex/_generated/api";
import { isValidEmailAddress } from "@school/auth";
import { cleanEmailInput, cleanPhoneInput, getUserFacingErrorMessage, isValidPhoneNumber } from "@school/shared";

import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { PortalCredentialPanel } from "./PortalCredentialPanel";
import type { EnrollmentNotice } from "./types";

interface StudentFamilyProfile {
  family: {
    _id: string;
    name: string;
    studentCount: number;
    parentCount: number;
  } | null;
  parents: Array<{
    _id: string;
    parentUserId: string;
    name: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    role: "parent" | "teacher" | "admin";
    relationship: string | null;
    isPrimaryContact: boolean;
  }>;
  students: Array<{
    _id: string;
    studentName: string;
    admissionNumber: string;
    classId: string;
    className: string;
  }>;
}

interface ParentEmailReview {
  email: string;
  matches: Array<{
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    role: "student" | "parent" | "teacher" | "admin";
    isArchived: boolean;
    families: Array<{
      _id: string;
      name: string;
      studentCount: number;
      parentCount: number;
    }>;
  }>;
}

interface ParentContactDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  relationship: string;
  isPrimaryContact: boolean;
}

type PendingReview =
  | {
      kind: "link";
      draft: ParentContactDraft;
      review: ParentEmailReview;
    }
  | {
      kind: "edit";
      familyMemberId: string;
      parentUserId: string;
      parentName: string;
      draft: ParentContactDraft;
      review: ParentEmailReview;
    };

interface StudentFamilyPanelProps {
  studentId: string;
  studentName: string;
  onNotice: (notice: EnrollmentNotice) => void;
}

function normalizeParentContactDraft(draft: ParentContactDraft) {
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    email: draft.email.trim().toLowerCase(),
    phone: draft.phone.trim(),
    relationship: draft.relationship.trim(),
    isPrimaryContact: draft.isPrimaryContact,
  };
}

function draftFromParent(parent: StudentFamilyProfile["parents"][number]): ParentContactDraft {
  return {
    firstName: parent.firstName ?? "",
    lastName: parent.lastName ?? "",
    email: parent.email ?? "",
    phone: parent.phone ?? "",
    relationship: parent.relationship ?? "",
    isPrimaryContact: parent.isPrimaryContact,
  };
}

export function StudentFamilyPanel({
  studentId,
  studentName,
  onNotice,
}: StudentFamilyPanelProps) {
  const convex = useConvex();
  const familyProfile = useQuery(
    "functions/academic/studentEnrollment:getStudentFamilyProfile" as never,
    { studentId } as never
  ) as StudentFamilyProfile | undefined;
  const upsertStudentFamilyLink = useMutation(
    "functions/academic/studentEnrollment:upsertStudentFamilyLink" as never
  );
  const updateStudentFamilyParentContact = useMutation(
    "functions/academic/studentEnrollment:updateStudentFamilyParentContact" as never
  );
  const unlinkStudentFromFamily = useMutation(
    "functions/academic/studentEnrollment:unlinkStudentFromFamily" as never
  );
  const removeStudentFamilyLink = useMutation(
    "functions/academic/studentEnrollment:removeStudentFamilyLink" as never
  );

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isPrimaryContact, setIsPrimaryContact] = useState(true);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ParentContactDraft | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnlinkModalOpen, setIsUnlinkModalOpen] = useState(false);
  const [parentToRemove, setParentToRemove] = useState<StudentFamilyProfile["parents"][number] | null>(null);

  useEffect(() => {
    setParentFirstName("");
    setParentLastName("");
    setParentEmail("");
    setParentPhone("");
    setRelationship("");
    setIsPrimaryContact(true);
    setEditingParentId(null);
    setEditDraft(null);
    setPendingReview(null);
  }, [studentId]);

  if (familyProfile === undefined) {
    return (
      <section className="space-y-4 pt-6 border-t border-slate-200/60 animate-pulse">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
          Family Links
        </p>
        <div className="h-24 rounded-xl bg-slate-50" />
      </section>
    );
  }

  const currentFamilyParentUserIds = new Set(
    familyProfile.parents.map((parent) => parent.parentUserId)
  );

  const classifyParentEmailReview = (
    review: ParentEmailReview,
    currentParentUserId?: string
  ) => {
    const activeMatches = review.matches.filter((match) => !match.isArchived);
    const archivedMatches = review.matches.filter((match) => match.isArchived);
    const activeParentMatches = activeMatches.filter((match) => match.role === "parent");
    const activeOtherMatches = activeMatches.filter((match) => match.role !== "parent");
    const reviewParentMatches = activeParentMatches.filter(
      (match) => match.userId !== currentParentUserId
    );

    return {
      activeParentMatches,
      activeOtherMatches,
      archivedMatches,
      reviewParentMatches,
    };
  };

  const openAddReview = async (draft: ParentContactDraft) => {
    const normalized = normalizeParentContactDraft(draft);
    const review = (await convex.query(
      api.functions.academic.studentEnrollment.getParentEmailReview,
      { email: normalized.email }
    )) as ParentEmailReview;

    const activeMatches = review.matches.filter((match) => !match.isArchived);
    const archivedMatches = review.matches.filter((match) => match.isArchived);
    const activeStudentMatches = activeMatches.filter((match) => match.role === "student");
    const eligibleParentMatches = activeMatches.filter((match) => match.role !== "student");
    const reviewParentMatches = eligibleParentMatches.filter(
      (match) => !currentFamilyParentUserIds.has(match.userId)
    );

    if (archivedMatches.length > 0) {
      onNotice({
        tone: "error",
        message: "This parent email is tied to an archived school account.",
      });
      return false;
    }

    if (activeStudentMatches.length > 0) {
      onNotice({
        tone: "error",
        message: "A student account cannot be linked as a parent.",
      });
      return false;
    }

    if (eligibleParentMatches.length > 1) {
      onNotice({
        tone: "error",
        message: "Multiple school accounts share this email. Resolve the duplicate account first.",
      });
      return false;
    }

    if (reviewParentMatches.length === 0) {
      return false;
    }

    setPendingReview({
      kind: "link",
      draft,
      review,
    });
    return true;
  };

  const openEditReview = async (parent: StudentFamilyProfile["parents"][number], draft: ParentContactDraft) => {
    const normalized = normalizeParentContactDraft(draft);
    const review = (await convex.query(
      api.functions.academic.studentEnrollment.getParentEmailReview,
      { email: normalized.email }
    )) as ParentEmailReview;

    const { activeParentMatches, activeOtherMatches, archivedMatches, reviewParentMatches } =
      classifyParentEmailReview(review, parent.parentUserId);

    if (archivedMatches.length > 0) {
      onNotice({
        tone: "error",
        message: "This parent email is tied to an archived school account.",
      });
      return false;
    }

    if (activeOtherMatches.length > 0) {
      onNotice({
        tone: "error",
        message: "This email already belongs to a non-parent school account.",
      });
      return false;
    }

    if (activeParentMatches.length > 1) {
      onNotice({
        tone: "error",
        message: "Multiple parent records share this email. Resolve the duplicate parent account first.",
      });
      return false;
    }

    if (reviewParentMatches.length === 0) {
      return false;
    }

    setPendingReview({
      kind: "edit",
      familyMemberId: parent._id,
      parentUserId: parent.parentUserId,
      parentName: parent.name,
      draft,
      review,
    });
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const draft = normalizeParentContactDraft({
      firstName: parentFirstName,
      lastName: parentLastName,
      email: parentEmail,
      phone: parentPhone,
      relationship,
      isPrimaryContact,
    });

    if (!draft.firstName || !draft.lastName || !draft.email) {
      onNotice({
        tone: "error",
        message: "Parent first name, last name, and email are required.",
      });
      return;
    }

    if (!isValidEmailAddress(draft.email)) {
      onNotice({
        tone: "error",
        message: "Enter a valid parent email address.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const reviewOpened = await openAddReview(draft);
      if (reviewOpened) {
        return;
      }

      await upsertStudentFamilyLink({
        studentId,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        phone: draft.phone || null,
        relationship: draft.relationship || null,
        isPrimaryContact: draft.isPrimaryContact,
      } as never);

      onNotice({
        tone: "success",
        message: `Family link updated for ${studentName}.`,
      });
      setParentFirstName("");
      setParentLastName("");
      setParentEmail("");
      setParentPhone("");
      setRelationship("");
      setIsPrimaryContact(true);
      setPendingReview(null);
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Family link save failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReview = async () => {
    if (!pendingReview) {
      return;
    }

    const draft = normalizeParentContactDraft(pendingReview.draft);
    if (!draft.firstName || !draft.lastName || !draft.email) {
      onNotice({
        tone: "error",
        message: "Parent first name, last name, and email are required.",
      });
      return;
    }

    if (!isValidEmailAddress(draft.email)) {
      onNotice({
        tone: "error",
        message: "Enter a valid parent email address.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (pendingReview.kind === "link") {
        await upsertStudentFamilyLink({
          studentId,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone || null,
          relationship: draft.relationship || null,
          isPrimaryContact: draft.isPrimaryContact,
          confirmDuplicateLink: true,
        } as never);
      } else {
        await updateStudentFamilyParentContact({
          familyMemberId: pendingReview.familyMemberId,
          firstName: draft.firstName,
          lastName: draft.lastName,
          email: draft.email,
          phone: draft.phone || null,
          relationship: draft.relationship || null,
          isPrimaryContact: draft.isPrimaryContact,
          confirmDuplicateEmail: true,
        } as never);
      }

      onNotice({
        tone: "success",
        message:
          pendingReview.kind === "link"
            ? `Family link updated for ${studentName}.`
            : `Parent contact updated for ${pendingReview.parentName}.`,
      });
      setPendingReview(null);
      setEditingParentId(null);
      setEditDraft(null);
      if (pendingReview.kind === "link") {
        setParentFirstName("");
        setParentLastName("");
        setParentEmail("");
        setParentPhone("");
        setRelationship("");
        setIsPrimaryContact(true);
      }
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          error,
          pendingReview.kind === "link"
            ? "Family link save failed."
            : "Parent contact update failed."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReview = () => {
    setPendingReview(null);
  };

  const handleUnlinkStudent = () => {
    setIsUnlinkModalOpen(true);
  };

  const executeUnlinkStudent = async () => {
    setIsSubmitting(true);
    try {
      await unlinkStudentFromFamily({ studentId } as never);
      onNotice({
        tone: "success",
        message: `${studentName} was removed from this household.`,
      });
      setIsUnlinkModalOpen(false);
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Family unlink failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveParent = (parent: StudentFamilyProfile["parents"][number]) => {
    setParentToRemove(parent);
  };

  const executeRemoveParent = async () => {
    if (!parentToRemove) return;
    setIsSubmitting(true);
    try {
      await removeStudentFamilyLink({ familyMemberId: parentToRemove._id } as never);
      onNotice({
        tone: "success",
        message: `${parentToRemove.name} was removed from the household.`,
      });
      setParentToRemove(null);
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Family removal failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentFamily = familyProfile.family;

  return (
    <section className="space-y-6 pt-6 border-t border-slate-200/60">
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
          Family Links
        </p>
        <h3 className="text-sm font-black text-slate-950">Household record</h3>
        <p className="text-xs font-medium text-slate-400">
          Link parent contacts to create or manage a family record for {studentName}.
        </p>
      </div>

      {currentFamily ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              <p className="text-sm font-black text-slate-950">{currentFamily.name}</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                Active
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {currentFamily.parentCount} parents · {currentFamily.studentCount} students
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleUnlinkStudent()}
            disabled={isSubmitting}
            className="shrink-0 flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 shadow-sm"
          >
            <Unlink2 className="h-3.5 w-3.5" />
            <span>Unlink</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs font-medium text-slate-500">
          No family record exists yet. Add a parent below to create one.
        </div>
      )}

      {pendingReview ? (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-700 shrink-0" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-bold text-amber-950">
                {pendingReview.kind === "link"
                  ? "Existing Account Found"
                  : `Existing Account for ${pendingReview.parentName}`}
              </p>
              <p className="text-[11px] leading-normal text-amber-800/90">
                {pendingReview.kind === "link"
                  ? "This email already belongs to a registered user. Confirm to link this student to their household."
                  : "This email belongs to another registered user. Confirm to update the contact details."}
              </p>
            </div>
          </div>

          <div className="space-y-2 border-t border-amber-200/70 pt-2.5">
            {pendingReview.review.matches.map((match) => (
              <div key={match.userId} className="space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">{match.name}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                      {match.role}
                    </span>
                    {match.isArchived && (
                      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                        archived
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-slate-600">{match.email}</span>
                </div>

                {match.families.length > 0 ? (
                  <div className="space-y-1 pl-2 border-l-2 border-amber-300">
                    {match.families.map((family) => (
                      <div key={family._id} className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-medium text-slate-800">{family.name}</span>
                        <span className="text-slate-500">
                          {family.parentCount} parent{family.parentCount === 1 ? "" : "s"} · {family.studentCount} student{family.studentCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No existing household links.</p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-amber-200/70">
            <button
              type="button"
              onClick={handleCancelReview}
              disabled={isSubmitting}
              className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100/50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5 text-amber-700" />
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmReview()}
              disabled={isSubmitting}
              className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50 shadow-sm"
            >
              <Check className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">
                {isSubmitting ? "Saving..." : pendingReview.kind === "link" ? "Confirm Link" : "Confirm Update"}
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
          Linked Contacts
        </p>
        {familyProfile.parents.length > 0 ? (
          <div className="space-y-3">
            {familyProfile.parents.map((parent) => {
              const isEditing = editingParentId === parent.parentUserId;
              const currentDraft = editDraft ?? draftFromParent(parent);

              return (
                <div
                  key={parent._id}
                  className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{parent.name}</p>
                        {parent.isPrimaryContact ? (
                          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-indigo-600">
                            Primary
                          </span>
                        ) : null}
                        {parent.role !== "parent" ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-700">
                            Staff: {parent.role}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                        {parent.relationship || "Guardian"}
                      </p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="break-all">{parent.email}</span>
                        </span>
                        {parent.phone && (
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{parent.phone}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {parent.role === "parent" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingParentId(parent.parentUserId);
                          setEditDraft(draftFromParent(parent));
                          setPendingReview(null);
                        }}
                        disabled={isSubmitting}
                        className="shrink-0 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <form
                      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!editDraft) {
                          return;
                        }

                        const draft = normalizeParentContactDraft(editDraft);
                        if (!draft.firstName || !draft.lastName || !draft.email) {
                          onNotice({
                            tone: "error",
                            message: "Parent first name, last name, and email are required.",
                          });
                          return;
                        }

                        if (!isValidEmailAddress(draft.email)) {
                          onNotice({
                            tone: "error",
                            message: "Enter a valid parent email address.",
                          });
                          return;
                        }

                        setIsSubmitting(true);
                        try {
                          const reviewOpened = await openEditReview(parent, draft);
                          if (reviewOpened) {
                            return;
                          }

                          await updateStudentFamilyParentContact({
                            familyMemberId: parent._id,
                            firstName: draft.firstName,
                            lastName: draft.lastName,
                            email: draft.email,
                            phone: draft.phone || null,
                            relationship: draft.relationship || null,
                            isPrimaryContact: draft.isPrimaryContact,
                          } as never);

                          onNotice({
                            tone: "success",
                            message: `Parent contact updated for ${parent.name}.`,
                          });
                          setEditingParentId(null);
                          setEditDraft(null);
                        } catch (error) {
                          onNotice({
                            tone: "error",
                            message: getUserFacingErrorMessage(error, "Parent contact update failed."),
                          });
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            First Name
                          </span>
                          <input
                            value={currentDraft.firstName}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                firstName: event.target.value,
                              }))
                            }
                            className={fieldInputClassName}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Last Name
                          </span>
                          <input
                            value={currentDraft.lastName}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                lastName: event.target.value,
                              }))
                            }
                            className={fieldInputClassName}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Email
                          </span>
                          <input
                            type="email"
                            value={currentDraft.email}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                email: event.target.value,
                              }))
                            }
                            className={fieldInputClassName}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Phone
                          </span>
                          <input
                            type="tel"
                            inputMode="tel"
                            value={currentDraft.phone}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                phone: cleanPhoneInput(event.target.value),
                              }))
                            }
                            className={fieldInputClassName}
                            placeholder="+234..."
                          />
                        </label>
                        <label className="space-y-1.5 sm:col-span-2">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Relationship
                          </span>
                          <input
                            value={currentDraft.relationship}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                relationship: event.target.value,
                              }))
                            }
                            className={fieldInputClassName}
                          />
                        </label>
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={currentDraft.isPrimaryContact}
                          onChange={(event) =>
                            setEditDraft((previous) => ({
                              ...(previous ?? currentDraft),
                              isPrimaryContact: event.target.checked,
                            }))
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                        />
                        <span>Mark this parent as the primary contact for the family.</span>
                      </label>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingParentId(null);
                            setEditDraft(null);
                          }}
                          disabled={isSubmitting}
                          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5 text-slate-400" />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 shadow-sm"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span className="whitespace-nowrap">{isSubmitting ? "Saving..." : "Save Changes"}</span>
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <PortalCredentialPanel
                    title="Portal Access"
                    userId={parent.parentUserId}
                    userName={parent.name}
                    email={parent.email}
                    defaultPassword="Parent123!Pass"
                    onNotice={onNotice}
                  />

                  <div className="pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => void handleRemoveParent(parent)}
                      disabled={isSubmitting}
                      className="h-9 w-full flex items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-4 text-[10px] font-bold uppercase tracking-[0.1em] text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove from Household
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs font-medium text-slate-500">
            No parent contacts linked yet.
          </div>
        )}
      </div>

      {familyProfile.students.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
            Household Students
          </p>
          <div className="grid gap-2">
            {familyProfile.students.map((familyStudent) => {
              const isCurrentStudent = familyStudent._id === studentId;
              return (
                <div
                  key={familyStudent._id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    isCurrentStudent 
                      ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                      : "border-slate-200 bg-white text-slate-950 shadow-sm"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`text-xs font-black ${isCurrentStudent ? "text-white" : "text-slate-950"}`}>
                      {familyStudent.studentName}
                    </p>
                    <p className={`mt-0.5 text-[10px] font-bold uppercase tracking-tight ${isCurrentStudent ? "text-slate-300" : "text-slate-400"}`}>
                      {familyStudent.className} · {familyStudent.admissionNumber}
                    </p>
                  </div>
                  {isCurrentStudent && (
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]">
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <form className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-slate-400" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Link Parent contact
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">First Name</span>
            <input value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} className={fieldInputClassName} placeholder="e.g. John" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Last Name</span>
            <input value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} className={fieldInputClassName} placeholder="e.g. Doe" />
          </div>
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Email</span>
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(cleanEmailInput(e.target.value))}
              className={fieldInputClassName}
              placeholder="parent@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Phone</span>
            <input
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(cleanPhoneInput(e.target.value))}
              className={fieldInputClassName}
              placeholder="+234..."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Relationship</span>
            <input value={relationship} onChange={(e) => setRelationship(e.target.value)} className={fieldInputClassName} placeholder="Relationship to student..." />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isPrimaryContact}
            onChange={(e) => setIsPrimaryContact(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950/5"
          />
          <span className="text-xs font-bold text-slate-500 group-hover:text-slate-900 transition-colors">Primary Contact</span>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-9 w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shadow-sm"
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>{isSubmitting ? "Linking..." : "Link to Household"}</span>
        </button>
      </form>

      {/* Unlink Student Modal */}
      <ConfirmationModal
        isOpen={isUnlinkModalOpen}
        onClose={() => setIsUnlinkModalOpen(false)}
        onConfirm={executeUnlinkStudent}
        title="Unlink Student from Household"
        description={`Unlink only ${studentName} from this household? The household record and other linked students will remain intact.`}
        confirmLabel="Unlink Student"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />

      {/* Remove Parent Modal */}
      <ConfirmationModal
        isOpen={Boolean(parentToRemove)}
        onClose={() => setParentToRemove(null)}
        onConfirm={executeRemoveParent}
        title="Remove Parent from Household"
        description={`Remove ${parentToRemove?.name} from this household? This household-wide action affects every student linked to the family.`}
        confirmLabel="Remove Parent"
        confirmVariant="danger"
        isLoading={isSubmitting}
      />
    </section>
  );
}

const fieldInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition-all focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5 placeholder:text-slate-300";

