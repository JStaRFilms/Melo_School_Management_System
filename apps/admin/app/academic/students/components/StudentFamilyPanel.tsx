"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { BadgeCheck, Link2, PlusCircle, Unlink2, Users } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

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

interface StudentFamilyPanelProps {
  studentId: string;
  studentName: string;
  onNotice: (notice: EnrollmentNotice) => void;
}

export function StudentFamilyPanel({
  studentId,
  studentName,
  onNotice,
}: StudentFamilyPanelProps) {
  const familyProfile = useQuery(
    "functions/academic/studentEnrollment:getStudentFamilyProfile" as never,
    { studentId } as never
  ) as StudentFamilyProfile | undefined;
  const upsertStudentFamilyLink = useMutation(
    "functions/academic/studentEnrollment:upsertStudentFamilyLink" as never
  );
  const unlinkStudentFromFamily = useMutation(
    "functions/academic/studentEnrollment:unlinkStudentFromFamily" as never
  );

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isPrimaryContact, setIsPrimaryContact] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setParentFirstName("");
    setParentLastName("");
    setParentEmail("");
    setParentPhone("");
    setRelationship("");
    setIsPrimaryContact(true);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!parentFirstName.trim() || !parentLastName.trim() || !parentEmail.trim()) {
      onNotice({
        tone: "error",
        message: "Parent first name, last name, and email are required.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertStudentFamilyLink({
        studentId,
        firstName: parentFirstName.trim(),
        lastName: parentLastName.trim(),
        email: parentEmail.trim(),
        phone: parentPhone.trim() || null,
        relationship: relationship.trim() || null,
        isPrimaryContact,
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
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(error, "Family link save failed."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkStudent = async () => {
    if (!window.confirm(`Unlink ${studentName} from this family?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await unlinkStudentFromFamily({ studentId } as never);
      onNotice({
        tone: "success",
        message: `${studentName} was removed from this family.`,
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

      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          Linked Parents
        </p>
        {familyProfile.parents.length > 0 ? (
          <div className="space-y-3">
            {familyProfile.parents.map((parent) => (
              <div
                key={parent._id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
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
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-slate-500">
                    Parent removal is household-wide and is not done from the student screen.
                  </div>
                </div>
              </div>
            ))}
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
                    <p className="text-sm font-black text-slate-950">
                      {familyStudent.studentName}
                    </p>
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
          <span>
            Mark this parent as the primary contact for the family.
          </span>
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
