"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound, Mail, Search, Send, UserPlus } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { humanNameFinalStrict, humanNameTypingStrict } from "@/human-name";

type TeacherRecord = {
  _id: string;
  name: string;
  email: string;
  createdAt: number;
};

type ProvisionResult = {
  teacherId: string;
  email: string;
  temporaryPassword: string;
};

type TeacherActionErrorState = {
  title: string;
  message: string;
} | null;

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getTeacherProvisionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/already exists|use another email/i.test(error.message)) {
      return "A teacher with this email already exists.";
    }
  }

  return "Teacher could not be created. Check the browser console for details.";
}

export default function TeachersPage() {
  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as TeacherRecord[] | undefined;
  const createTeacher = useAction(
    "functions/academic/academicSetup:createTeacher" as never
  );
  const updateTeacherProfile = useAction(
    "functions/academic/academicSetup:updateTeacherProfile" as never
  );
  const resetTeacherPassword = useAction(
    "functions/academic/academicSetup:resetTeacherPassword" as never
  );
  const archiveTeacher = useMutation(
    "functions/academic/academicSetup:archiveTeacher" as never
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("Teacher123!Pass");
  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("Teacher123!Pass");
  const [errorState, setErrorState] = useState<TeacherActionErrorState>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const selectedTeacher =
    teachers?.find((teacher) => teacher._id === selectedTeacherId) ?? null;

  useEffect(() => {
    if (!selectedTeacher) {
      return;
    }

    setEditName(selectedTeacher.name);
    setEditEmail(selectedTeacher.email);
  }, [selectedTeacher]);

  const filteredTeachers = useMemo(() => {
    if (!teachers) {
      return [];
    }

    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return teachers;
    }

    return teachers.filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(query) ||
        teacher.email.toLowerCase().includes(query)
    );
  }, [deferredSearch, teachers]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = humanNameFinalStrict(name);
    if (!normalizedName || !email.trim() || !temporaryPassword.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorState(null);
    setResult(null);
    setSuccessMessage(null);

    try {
      const response = (await createTeacher({
        name: normalizedName,
        email: email.trim().toLowerCase(),
        temporaryPassword: temporaryPassword.trim(),
        origin: window.location.origin,
      } as never)) as ProvisionResult;

      setResult(response);
      setName("");
      setEmail("");
      setTemporaryPassword("Teacher123!Pass");
      setSuccessMessage("Teacher account created.");
    } catch (err) {
      console.error("Teacher provisioning failed", err);
      setErrorState({
        title: "Teacher not created",
        message: getTeacherProvisionErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTeacher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeacher) {
      return;
    }

    const normalizedName = humanNameFinalStrict(editName);
    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!normalizedName || !normalizedEmail) {
      return;
    }

    setIsSavingProfile(true);
    setErrorState(null);
    setResult(null);
    setSuccessMessage(null);

    try {
      await updateTeacherProfile({
        teacherId: selectedTeacher._id,
        name: normalizedName,
        email: normalizedEmail,
      } as never);
      setSuccessMessage("Teacher profile updated.");
    } catch (err) {
      setErrorState({
        title: "Teacher update failed",
        message: getUserFacingErrorMessage(err, "Failed to update teacher"),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetTeacherPassword = async () => {
    if (!selectedTeacher || !resetPasswordValue.trim()) {
      return;
    }

    setIsResettingPassword(true);
    setErrorState(null);
    setResult(null);
    setSuccessMessage(null);

    try {
      await resetTeacherPassword({
        teacherId: selectedTeacher._id,
        temporaryPassword: resetPasswordValue.trim(),
      } as never);
      setSuccessMessage(
        `Password reset for ${selectedTeacher.email}. Existing sessions were revoked.`
      );
    } catch (err) {
      setErrorState({
        title: "Password reset failed",
        message: getUserFacingErrorMessage(err, "Failed to reset password"),
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleArchiveTeacher = async () => {
    if (!selectedTeacher) {
      return;
    }

    if (!window.confirm(`Archive ${selectedTeacher.name}? This preserves the record for history and removes active teaching access.`)) {
      return;
    }

    setIsSavingProfile(true);
    setErrorState(null);
    setResult(null);
    setSuccessMessage(null);

    try {
      await archiveTeacher({ teacherId: selectedTeacher._id } as never);
      setSelectedTeacherId(null);
      setSuccessMessage("Teacher archived.");
    } catch (err) {
      setErrorState({
        title: "Teacher archive failed",
        message: getUserFacingErrorMessage(err, "Failed to archive teacher"),
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (teachers === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
        <div className="text-[#64748b]">Loading staff directory...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6 pb-28">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
          <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.08em] block mb-1">
            Total Staff
          </span>
          <span className="text-2xl font-black text-[#0f172a]">{teachers.length}</span>
        </div>
        <div className="p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
          <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.08em] block mb-1">
            Live Access
          </span>
          <span className="text-2xl font-black text-emerald-600">{teachers.length}</span>
        </div>
        <div className="relative sm:col-span-1">
          <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find teacher by name..."
            className="h-11 w-full rounded-xl border border-[#e2e8f0] bg-white pl-10 pr-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-6">
        <h2 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
          Faculty List
        </h2>
        <div className="h-11 px-4 rounded-xl bg-[#0f172a] text-white shadow-xl shadow-[#e2e8f0] flex items-center gap-2 text-xs font-bold uppercase tracking-[0.025em]">
          <UserPlus className="w-4 h-4 text-white/50" />
          New Faculty
        </div>
      </div>

      <section className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
              Create Teacher
            </h3>
            <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
              Admin-only provisioning
            </p>
          </div>
          <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] px-2 py-1 rounded-full bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
            Step 1 of Setup
          </span>
        </div>

        {errorState ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-800">
              {errorState.title}
            </p>
            <p className="mt-1 text-sm font-medium text-amber-900">
              {errorState.message}
            </p>
          </div>
        ) : null}

        {successMessage && !result ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-[0.15em]">
              Update saved
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-900">
              {successMessage}
            </p>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 flex flex-col gap-2">
            <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-[0.15em]">
              Provisioned Successfully
            </p>
            <p className="text-sm font-semibold text-emerald-900">
              {result.email}
            </p>
            <p className="text-xs font-medium text-emerald-800">
              Temporary password:{" "}
              <span className="font-bold">{result.temporaryPassword}</span>
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1.5 block">
                Teacher Name
              </label>
              <input
                type="text"
                value={name}
            onChange={(event) =>
              setName(humanNameTypingStrict(event.target.value))
            }
            onBlur={(event) =>
              setName(humanNameFinalStrict(event.target.value))
            }
                className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                placeholder="Temitope Yusuf"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1.5 block">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                placeholder="teacher@school.edu"
                required
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1.5 block">
                Temporary Password
              </label>
              <input
                type="text"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-3">
            <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 space-y-2">
              <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em]">
                Assignment Preview
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[8px] font-extrabold uppercase tracking-[0.05em] px-2 py-1 rounded-full bg-white text-[#475569] border border-[#e2e8f0]">
                  Added to school staff directory
                </span>
                <span className="text-[8px] font-extrabold uppercase tracking-[0.05em] px-2 py-1 rounded-full bg-white text-[#475569] border border-[#e2e8f0]">
                  Subject assignments happen in class setup
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-[0.05em] block mb-1">
                  Provisioning
                </span>
                <p className="text-xs font-bold text-emerald-900">
                  Creates the teacher sign-in account and school membership immediately.
                </p>
              </div>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !name.trim() ||
                  !email.trim() ||
                  !temporaryPassword.trim()
                }
                className="mt-4 h-11 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-[0.025em] flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-white/50" />
                {isSubmitting ? "Creating Teacher" : "Create Teacher"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {selectedTeacher ? (
        <section className="bg-white border border-[#e2e8f0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#0f172a] uppercase tracking-[0.15em]">
                Edit Teacher
              </h3>
              <p className="text-[10px] font-medium text-[#94a3b8] uppercase tracking-tight mt-0.5">
                Update login email, display name, or reset access
              </p>
            </div>
            <span className="text-[8px] font-extrabold uppercase tracking-[0.15em] px-2 py-1 rounded-full bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
              {selectedTeacher.email}
            </span>
          </div>

          <form onSubmit={handleUpdateTeacher} className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1.5 block">
                  Teacher Name
                </label>
                <input
                  type="text"
                  value={editName}
            onChange={(event) =>
              setEditName(humanNameTypingStrict(event.target.value))
            }
            onBlur={(event) =>
              setEditName(humanNameFinalStrict(event.target.value))
            }
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  required
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em] mb-1.5 block">
                  Login Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  className="h-11 w-full rounded-xl border border-[#e2e8f0] px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-[#4f46e5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.05)]"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSavingProfile || !editName.trim() || !editEmail.trim()}
                className="h-11 rounded-xl bg-[#0f172a] text-white font-bold text-xs uppercase tracking-[0.025em] flex items-center justify-center gap-2 shadow-xl disabled:opacity-50 px-4"
              >
                <Send className="w-4 h-4 text-white/50" />
                {isSavingProfile ? "Saving Changes" : "Save Teacher Changes"}
              </button>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-700" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-900">
                  Reset Password
                </span>
              </div>
              <p className="text-xs font-medium text-amber-900">
                This sets a new temporary password and signs the teacher out of all current sessions.
              </p>
              <input
                type="text"
                value={resetPasswordValue}
                onChange={(event) => setResetPasswordValue(event.target.value)}
                className="h-11 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-medium text-[#0f172a] outline-none transition-all focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleResetTeacherPassword}
                disabled={isResettingPassword || !resetPasswordValue.trim()}
                className="h-11 w-full rounded-xl bg-amber-600 text-white font-bold text-xs uppercase tracking-[0.025em] flex items-center justify-center gap-2 shadow-lg shadow-amber-100 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4 text-white/60" />
                {isResettingPassword ? "Resetting Password" : "Reset Password"}
              </button>
            </div>
          </form>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleArchiveTeacher()}
              disabled={isSavingProfile}
              className="h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold uppercase tracking-[0.025em] text-rose-700 disabled:opacity-50"
            >
              Archive Teacher
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeachers.map((teacher) => (
          <div
            key={teacher._id}
            onClick={() => setSelectedTeacherId(teacher._id)}
            className={`cursor-pointer bg-white border rounded-2xl p-4 space-y-4 transition-all ${
              selectedTeacherId === teacher._id
                ? "border-[#4f46e5] shadow-lg shadow-[#e0e7ff]"
                : "border-[#e2e8f0] hover:border-[#cbd5e1] hover:shadow-lg"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#0f172a] flex items-center justify-center text-white font-bold text-sm">
                {getInitials(teacher.name)}
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="font-bold text-[#0f172a] text-sm truncate">
                  {teacher.name}
                </h4>
                <p className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-[0.15em]">
                  Staff Record
                </p>
              </div>
              <div className="ml-auto">
                <span className="w-2 h-2 rounded-full bg-emerald-500 block" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[9px] font-bold text-[#64748b] uppercase tracking-[0.05em]">
                Account Status
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[8px] font-extrabold uppercase tracking-[0.05em] px-2 py-1 rounded-full bg-[#f1f5f9] text-[#475569]">
                  Teacher
                </span>
                <span className="text-[8px] font-extrabold uppercase tracking-[0.05em] px-2 py-1 rounded-full bg-[#f1f5f9] text-[#475569]">
                  Ready for assignment
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#f8fafc]">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3 h-3 text-[#cbd5e1]" />
                <span className="text-[10px] font-medium text-[#64748b] truncate">
                  {teacher.email}
                </span>
              </div>
              <span className="text-[9px] font-medium text-[#94a3b8]">
                {new Date(teacher.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}

        {filteredTeachers.length === 0 ? (
          <div className="bg-[#f8fafc] border-2 border-dashed border-[#e2e8f0] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[160px] text-center">
            <UserPlus className="w-6 h-6 text-[#cbd5e1] mb-3" />
            <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-[0.15em]">
              No Staff Match
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
