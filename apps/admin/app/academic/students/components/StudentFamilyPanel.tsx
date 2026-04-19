"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { AlertTriangle, BadgeCheck, Link2, PencilLine, PlusCircle, ShieldAlert, Trash2, Unlink2, Users } from "lucide-react";
import { api } from "@school/convex/_generated/api";
import { isValidEmailAddress } from "@school/auth";
import { getUserFacingErrorMessage } from "@school/shared";

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
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Family Links
        </p>
        <div className="h-24 animate-pulse rounded-2xl bg-slate-50" />
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
    const activeParentMatches = activeMatches.filter((match) => match.role === "parent");
    const activeOtherMatches = activeMatches.filter((match) => match.role !== "parent");
    const reviewParentMatches = activeParentMatches.filter(
      (match) => !currentFamilyParentUserIds.has(match.userId)
    );

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

  const handleUnlinkStudent = async () => {
    if (
      !window.confirm(
        `Unlink only ${studentName} from this household? The household record and other linked students will remain.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await unlinkStudentFromFamily({ studentId } as never);
      onNotice({
        tone: "success",
        message: `${studentName} was removed from this household.`,
      });
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Family unlink failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveParent = async (parent: StudentFamilyProfile["parents"][number]) => {
    if (
      !window.confirm(
        `Remove ${parent.name} from this household? This household-wide action affects every student linked to the family.`
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      await removeStudentFamilyLink({ familyMemberId: parent._id } as never);
      onNotice({
        tone: "success",
        message: `${parent.name} was removed from the household.`,
      });
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
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Family Links
        </p>
        <h3 className="text-sm font-black text-slate-950">Household record</h3>
        <p className="text-xs font-medium leading-relaxed text-slate-500">
          Link one or more parent contacts to {studentName}. The first linked parent creates a family record automatically.
        </p>
      </div>

      {currentFamily ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-700" />
                <p className="text-sm font-black text-emerald-900">{currentFamily.name}</p>
              </div>
              <p className="mt-1 text-xs font-medium text-emerald-800/80">
                {currentFamily.parentCount} parent{currentFamily.parentCount === 1 ? "" : "s"} linked · {currentFamily.studentCount} student{currentFamily.studentCount === 1 ? "" : "s"} in this family
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Student-scoped unlink below
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-emerald-700">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Household actions stay on parent cards
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-emerald-900/75">
                This screen is student-scoped. Use the button below to unlink only the current student from the household.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Active
              </span>
              <button
                type="button"
                onClick={() => void handleUnlinkStudent()}
                disabled={isSubmitting}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
              >
                <Unlink2 className="h-3.5 w-3.5" />
                Unlink Student
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-xs font-medium text-slate-500">
          No family record exists yet. Add a parent below to create one.
        </div>
      )}

      {pendingReview ? (
        <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">
                Duplicate email review
              </p>
              <h4 className="text-sm font-black text-amber-950">
                {pendingReview.kind === "link"
                  ? "This email already belongs to an existing parent record."
                  : `This email already belongs to another parent record for ${pendingReview.parentName}.`}
              </h4>
              <p className="text-xs font-medium leading-relaxed text-amber-900/80">
                {pendingReview.kind === "link"
                  ? "Review the existing household(s) below before linking this parent to the student family."
                  : "Review the existing household(s) below before updating the saved parent contact email."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingReview.review.matches.map((match) => (
              <div key={match.userId} className="rounded-2xl border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-950">{match.name}</p>
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                    {match.role}
                  </span>
                  {match.isArchived ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-rose-700">
                      archived
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {match.email}
                  {match.phone ? ` · ${match.phone}` : ""}
                </p>
                {match.families.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {match.families.map((family) => (
                      <div
                        key={family._id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{family.name}</p>
                          <p className="text-[11px] font-medium text-slate-500">
                            {family.parentCount} parent{family.parentCount === 1 ? "" : "s"} · {family.studentCount} student{family.studentCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          Household link
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
                    No household links yet.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleCancelReview}
              disabled={isSubmitting}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-amber-800 transition hover:bg-amber-50 disabled:opacity-50"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Cancel review
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmReview()}
              disabled={isSubmitting}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {isSubmitting ? "Saving..." : pendingReview.kind === "link" ? "Confirm link" : "Confirm email update"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Linked Parents
        </p>
        {familyProfile.parents.length > 0 ? (
          <div className="space-y-3">
            {familyProfile.parents.map((parent) => {
              const isEditing = editingParentId === parent.parentUserId;
              const currentDraft = editDraft ?? draftFromParent(parent);

              return (
                <div
                  key={parent._id}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-950">{parent.name}</p>
                        {parent.isPrimaryContact ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {parent.relationship || "Parent contact"}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        {parent.email}
                        {parent.phone ? ` · ${parent.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        Household-wide parent management lives here.
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingParentId(parent.parentUserId);
                          setEditDraft(draftFromParent(parent));
                          setPendingReview(null);
                        }}
                        disabled={isSubmitting}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        <PencilLine className="h-3.5 w-3.5" />
                        Edit Parent Contact
                      </button>
                    </div>
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
                            value={currentDraft.phone}
                            onChange={(event) =>
                              setEditDraft((previous) => ({
                                ...(previous ?? currentDraft),
                                phone: event.target.value,
                              }))
                            }
                            className={fieldInputClassName}
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

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingParentId(null);
                            setEditDraft(null);
                          }}
                          disabled={isSubmitting}
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Cancel edit
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          <BadgeCheck className="h-3.5 w-3.5" />
                          {isSubmitting ? "Saving..." : "Save parent contact"}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                          Portal Access
                        </p>
                        <PortalCredentialPanel
                          title="Parent Portal Access"
                          description="Provision or refresh the portal login for this linked parent so the portal can be tested with real Better Auth credentials."
                          userId={parent.parentUserId}
                          userName={parent.name}
                          email={parent.email}
                          defaultPassword="Parent123!Pass"
                          onNotice={onNotice}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void handleRemoveParent(parent)}
                      disabled={isSubmitting}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Parent From Household
                    </button>
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                      Household-wide removal is separate from student unlinking.
                    </div>
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
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Family Students
          </p>
          <div className="space-y-2">
            {familyProfile.students.map((familyStudent) => {
              const isCurrentStudent = familyStudent._id === studentId;
              return (
                <div
                  key={familyStudent._id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-950">{familyStudent.studentName}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {familyStudent.className} · {familyStudent.admissionNumber}
                    </p>
                  </div>
                  {isCurrentStudent ? (
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                      Current
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <form className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-slate-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            Add or Link Parent
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              First Name
            </span>
            <input
              value={parentFirstName}
              onChange={(event) => setParentFirstName(event.target.value)}
              className={fieldInputClassName}
              placeholder="Parent first name"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Last Name
            </span>
            <input
              value={parentLastName}
              onChange={(event) => setParentLastName(event.target.value)}
              className={fieldInputClassName}
              placeholder="Parent last name"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Email
            </span>
            <input
              type="email"
              value={parentEmail}
              onChange={(event) => setParentEmail(event.target.value)}
              className={fieldInputClassName}
              placeholder="guardian@example.com"
            />
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Phone
            </span>
            <input
              value={parentPhone}
              onChange={(event) => setParentPhone(event.target.value)}
              className={fieldInputClassName}
              placeholder="+234..."
            />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Relationship
            </span>
            <input
              value={relationship}
              onChange={(event) => setRelationship(event.target.value)}
              className={fieldInputClassName}
              placeholder="Mother, Father, Guardian..."
            />
          </label>
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isPrimaryContact}
            onChange={(event) => setIsPrimaryContact(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
          />
          <span>Mark this parent as the primary contact for the family.</span>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          <span>{isSubmitting ? "Saving..." : "Save Family Link"}</span>
        </button>
      </form>
    </section>
  );
}

const fieldInputClassName =
  "h-10 w-full rounded-lg border border-slate-200 bg-white/80 px-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300";
