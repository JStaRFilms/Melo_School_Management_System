"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Search, GraduationCap, Sparkles, X, UserPlus } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { TeacherCard } from "./components/TeacherCard";
import { TeacherCreationForm } from "./components/TeacherCreationForm";
import { TeacherEditForm } from "./components/TeacherEditForm";

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

export default function TeachersPage() {
  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as TeacherRecord[] | undefined;
  
  const createTeacher = useAction("functions/academic/academicSetup:createTeacher" as never);
  const updateTeacherProfile = useAction("functions/academic/academicSetup:updateTeacherProfile" as never);
  const resetTeacherPassword = useAction("functions/academic/academicSetup:resetTeacherPassword" as never);
  const archiveTeacher = useMutation("functions/academic/academicSetup:archiveTeacher" as never);

  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const deferredSearch = useDeferredValue(search);
  const selectedTeacher = useMemo(() => 
    teachers?.find((t) => t._id === selectedTeacherId) ?? null,
  [teachers, selectedTeacherId]);

  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter(
      (t) => t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query)
    );
  }, [deferredSearch, teachers]);

  const handleProvision = async (name: string, email: string, password: string): Promise<ProvisionResult> => {
    setIsSubmitting(true);
    setNotice(null);
    try {
      const response = await createTeacher({
        name,
        email: email.trim().toLowerCase(),
        temporaryPassword: password.trim(),
        origin: window.location.origin,
      } as never) as ProvisionResult;
      
      setNotice({ tone: "success", title: "Teacher Provisioned", message: `Account active for ${email}` });
      return response;
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Provisioning Failed",
        message: getUserFacingErrorMessage(err, "Account creation failed.")
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, name: string, email: string) => {
    setIsSaving(true);
    setNotice(null);
    try {
      await updateTeacherProfile({ teacherId: id, name, email } as never);
      setNotice({ tone: "success", title: "Record Updated", message: "Teacher information saved." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to save changes.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (id: string, password: string) => {
    setIsResetting(true);
    setNotice(null);
    try {
      await resetTeacherPassword({ teacherId: id, temporaryPassword: password } as never);
      setNotice({ tone: "success", title: "Password Updated", message: "New temporary password set." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to update password.")
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleArchive = async (id: string) => {
    const teacher = teachers?.find(t => t._id === id);
    if (!teacher) return;
    if (!window.confirm(`Archive ${teacher.name}? This will revoke their teaching access permanently.`)) return;

    setNotice(null);
    try {
      await archiveTeacher({ teacherId: id } as never);
      setSelectedTeacherId(null);
      setNotice({ tone: "success", title: "Teacher Archived", message: "Access and records deactivated." });
    } catch (err) {
      setNotice({
        tone: "error",
        title: "Archive Failed",
        message: getUserFacingErrorMessage(err, "Failed to deactivate record.")
      });
    }
  };

  if (teachers === undefined) {
    return (
      <div className="mx-auto max-w-[1600px] px-3 py-10 md:px-8">
        <div className="animate-pulse space-y-10">
          <div className="h-10 w-48 rounded-lg bg-slate-100" />
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-10 h-96 rounded-xl bg-slate-50" />
            <div className="h-96 rounded-xl bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />
      
      <div className="relative mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:space-y-6 md:px-8 md:py-10">
        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start lg:justify-between">
          <aside className="w-full lg:w-[340px] lg:shrink-0 space-y-6 lg:sticky lg:top-8 h-fit">
            {selectedTeacher ? (
              <TeacherEditForm
                teacher={selectedTeacher}
                onUpdate={handleUpdate}
                onResetPassword={handleResetPassword}
                onArchive={handleArchive}
                onClose={() => setSelectedTeacherId(null)}
                isSaving={isSaving}
                isResetting={isResetting}
              />
            ) : (
              <TeacherCreationForm
                onProvision={handleProvision}
                isSubmitting={isSubmitting}
              />
            )}
            
            <div className="pt-4 border-t border-slate-200/60">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">System Notification</h4>
              <p className="mt-1.5 text-xs leading-relaxed font-medium text-slate-400">
                Staff accounts are linked to school email addresses. Deactivation is permanent and irreversible.
              </p>
            </div>
          </aside>

          <div className="flex-1 min-w-0 space-y-6 md:space-y-8">
            <AdminHeader
              title="Teaching Staff"
              actions={
                <StatGroup
                  stats={[
                    {
                      label: "Registered",
                      value: teachers.length,
                      icon: <GraduationCap className="h-4 w-4" />,
                    },
                    {
                      label: "Active Access",
                      value: teachers.length,
                      icon: <Sparkles className="h-4 w-4" />,
                    },
                  ]}
                />
              }
            />

            {notice && (
              <div className={`group relative overflow-hidden rounded-lg border-l-4 p-4 shadow-lg transition-all border-white bg-white ${
                notice.tone === "success" ? "border-l-emerald-500" : "border-l-rose-500"
              }`}>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40">
                      {notice.title}
                    </p>
                    <p className="text-sm font-bold tracking-tight text-slate-950">{notice.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotice(null)}
                    className="rounded-full p-1.5 hover:bg-slate-50 transition-colors"
                  >
                    <X className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-950/5 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-950 uppercase">Active Records</h3>
                <p className="text-xs font-medium text-slate-500">
                  Manage teaching credentials and access levels.
                </p>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find record..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTeachers.map((teacher) => (
                <TeacherCard
                  key={teacher._id}
                  teacher={teacher}
                  isSelected={selectedTeacherId === teacher._id}
                  onSelect={() => setSelectedTeacherId(teacher._id)}
                  onArchive={() => handleArchive(teacher._id)}
                />
              ))}

              {filteredTeachers.length === 0 && (
                <div className="sm:col-span-2 xl:col-span-3 py-12 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-100 bg-slate-50/50 p-12 text-center">
                  <div className="rounded-2xl bg-white p-4 text-slate-200 shadow-sm ring-1 ring-slate-950/5">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <p className="mt-6 text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Record Not Found</p>
                  <p className="mt-2 text-sm font-medium text-slate-400 max-w-[200px]">Refine your search parameters or add a new teacher.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
