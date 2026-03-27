"use client";

import { PencilLine, UserPlus } from "lucide-react";

interface AdminMobileRosterActionsProps {
  selectedStudentName: string | null;
  onAddStudent: () => void;
  onEditProfile: () => void;
}

export function AdminMobileRosterActions({
  selectedStudentName,
  onAddStudent,
  onEditProfile,
}: AdminMobileRosterActionsProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
        Roster Tools
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Add a new student or jump straight into the selected student&apos;s full
        profile without leaving the subject workflow.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onAddStudent}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-950/10"
        >
          <UserPlus className="h-4 w-4 text-white/80" />
          Add Student
        </button>
        <button
          type="button"
          onClick={onEditProfile}
          disabled={!selectedStudentName}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <PencilLine className="h-4 w-4 text-slate-400" />
          {selectedStudentName ? "Edit Profile" : "Select Student"}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {selectedStudentName
          ? `Ready to edit ${selectedStudentName}.`
          : "Pick a student from the list below to edit the full profile."}
      </p>
    </section>
  );
}
