"use client";

import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Search, GraduationCap, Sparkles, UserPlus } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { TeacherCard } from "./components/TeacherCard";
import { TeacherCreationForm } from "./components/TeacherCreationForm";
import { TeacherEditForm } from "./components/TeacherEditForm";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { TeacherRecord } from "@/types";
import type { Id } from "@school/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { useDraftConnection } from "@/useDraftConnection";

type ProvisionResult = {
  teacherId: string;
  email: string;
  temporaryPassword: string;
};
type DraftClosure = {
  schoolId: Id<"schools">;
  draftId: Id<"formDrafts">;
  expectedRevision: number;
};

function normalizeArchiveBlockers(blockers: string[] | undefined) {
  return [...new Set(blockers ?? [])].filter(Boolean);
}

function summarizeArchiveBlockers(blockers: string[]) {
  const normalizedBlockers = normalizeArchiveBlockers(blockers);

  if (normalizedBlockers.length <= 3) {
    return normalizedBlockers.join(", ");
  }

  return `${normalizedBlockers.slice(0, 3).join(", ")}, and ${
    normalizedBlockers.length - 3
  } more`;
}

function getTeacherArchiveBlockerMessage(blockers: string[]) {
  return `Reassign this teacher before archiving. Active links: ${summarizeArchiveBlockers(
    blockers
  )}.`;
}

export default function TeachersPage() {
  const { workspaceAccess, session } = useAuth();
  const draftConnection = useDraftConnection();
  const schoolId = workspaceAccess?.state === "ready"
    ? (workspaceAccess.branch.schoolId as Id<"schools">)
    : undefined;
  const draftContext = schoolId && session?.user.id
    ? { schoolId, accountId: session.user.id, connection: draftConnection }
    : undefined;
  const teachers = useQuery(
    "functions/academic/academicSetup:listTeachers" as never
  ) as TeacherRecord[] | undefined;
  
  const createTeacher = useAction("functions/academic/academicSetup:createTeacher" as never);
  const updateTeacherProfile = useAction("functions/academic/academicSetup:updateTeacherProfile" as never);
  const resetTeacherPassword = useAction("functions/academic/academicSetup:resetTeacherPassword" as never);
  const archiveTeacher = useMutation("functions/academic/academicSetup:archiveTeacher" as never);

  const [search, setSearch] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [teacherToArchive, setTeacherToArchive] = useState<TeacherRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const isMobile = useIsMobile();

  const showNotice = (notice: { tone: "success" | "error"; title?: string; message: string }) => {
    const title = notice.title ?? (notice.tone === "success" ? "Success" : "Something went wrong");

    if (notice.tone === "success") {
      appToast.success(title, { description: notice.message });
      return;
    }

    appToast.error(title, { description: notice.message });
  };

  const deferredSearch = useDeferredValue(search);
  const selectedTeacher = useMemo(() => 
    teachers?.find((t) => t._id === selectedTeacherId) ?? null,
  [teachers, selectedTeacherId]);
  const selectedTeacherArchiveBlockers = useQuery(
    "functions/academic/academicSetup:getTeacherArchiveBlockers" as never,
    selectedTeacherId
      ? ({ teacherId: selectedTeacherId } as never)
      : ("skip" as never)
  ) as string[] | undefined;
  const isArchiveStatusLoading =
    Boolean(selectedTeacherId) && selectedTeacherArchiveBlockers === undefined;
  const selectedTeacherWithArchiveState = useMemo(
    () =>
      selectedTeacher
        ? {
            ...selectedTeacher,
            archiveBlockers: normalizeArchiveBlockers(
              selectedTeacherArchiveBlockers
            ),
          }
        : null,
    [selectedTeacher, selectedTeacherArchiveBlockers]
  );

  useEffect(() => {
    if (selectedTeacherId && isMobile) {
      const scrollTimer = setTimeout(() => {
        const element = document.getElementById(`teacher-${selectedTeacherId}`);
        if (element) {
          const yOffset = -120;
          const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [isMobile, selectedTeacherId]);

  const filteredTeachers = useMemo(() => {
    if (!teachers) return [];
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter(
      (t) => t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query)
    );
  }, [deferredSearch, teachers]);

  const handleProvision = async (name: string, email: string, password: string, draft?: DraftClosure): Promise<ProvisionResult> => {
    setIsSubmitting(true);
    try {
      const response = await createTeacher({
        name,
        email: email.trim().toLowerCase(),
        temporaryPassword: password.trim(),
        origin: window.location.origin,
        draftId: draft?.draftId,
        expectedDraftRevision: draft?.expectedRevision,
      } as never) as ProvisionResult;
      
      showNotice({ tone: "success", title: "Teacher Provisioned", message: `Account active for ${email}` });
      return response;
    } catch (err) {
      showNotice({
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
    try {
      await updateTeacherProfile({ teacherId: id, name, email } as never);
      showNotice({ tone: "success", title: "Record Updated", message: "Teacher information saved." });
    } catch (err) {
      showNotice({
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
    try {
      await resetTeacherPassword({ teacherId: id, temporaryPassword: password } as never);
      showNotice({ tone: "success", title: "Password Updated", message: "New temporary password set." });
    } catch (err) {
      showNotice({
        tone: "error",
        title: "Update Failed",
        message: getUserFacingErrorMessage(err, "Failed to update password.")
      });
    } finally {
      setIsResetting(false);
    }
  };

  const handleArchivePrompt = (teacher: TeacherRecord) => {
    const blockers = normalizeArchiveBlockers(teacher.archiveBlockers);
    if (blockers.length > 0) {
      showNotice({
        tone: "error",
        title: "Reassignment Required",
        message: getTeacherArchiveBlockerMessage(blockers),
      });
      return;
    }
    setTeacherToArchive(teacher);
  };

  const executeArchive = async () => {
    if (!teacherToArchive) return;
    setIsArchiving(true);
    try {
      await archiveTeacher({ teacherId: teacherToArchive._id } as never);
      if (selectedTeacherId === teacherToArchive._id) {
        setSelectedTeacherId(null);
      }
      setTeacherToArchive(null);
      showNotice({ tone: "success", title: "Teacher Archived", message: "Active access deactivated. Historical records preserved." });
    } catch (err) {
      const message = getUserFacingErrorMessage(err, "Failed to deactivate record.");
      showNotice({
        tone: "error",
        title: message.startsWith("Reassign this teacher")
          ? "Reassignment Required"
          : "Archive Failed",
        message,
      });
    } finally {
      setIsArchiving(false);
    }
  };

  if (teachers === undefined) {
    return (
      <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
        <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
          <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 shrink-0">
            <div className="animate-pulse space-y-6">
              <div className="h-64 rounded-xl bg-slate-100/50" />
              <div className="h-20 rounded-xl bg-slate-100/50" />
            </div>
          </aside>
          <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
            <div className="max-w-[1200px] mx-auto animate-pulse space-y-10">
              <div className="h-10 w-48 rounded-lg bg-slate-100/50" />
              <div className="h-32 rounded-xl bg-slate-100/50" />
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 rounded-xl bg-slate-100/50" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full lg:h-full w-full flex flex-col lg:overflow-hidden bg-surface-200/50">
      <div className="absolute inset-0 bg-surface-200 pointer-events-none" />

      {/* Confirmation Modal for Archiving */}
      <ConfirmationModal
        isOpen={Boolean(teacherToArchive)}
        onClose={() => setTeacherToArchive(null)}
        onConfirm={executeArchive}
        title={`Archive ${teacherToArchive?.name || "Staff Member"}?`}
        description="This will deactivate their active access to the school workspace while preserving historical attendance, graded subject scores, and past records."
        confirmLabel="Archive Teacher"
        confirmVariant="danger"
        isLoading={isArchiving}
      />

      {/* Mobile Editor Sheet */}
      <AdminSheet
        isOpen={Boolean(selectedTeacherId) && isMobile}
        onClose={() => setSelectedTeacherId(null)}
        title="Edit Staff Member"
        description="Update faculty credentials."
      >
        {selectedTeacherWithArchiveState && (
           <TeacherEditForm
             teacher={selectedTeacherWithArchiveState}
             onUpdate={handleUpdate}
             onResetPassword={handleResetPassword}
             onArchive={() => handleArchivePrompt(selectedTeacherWithArchiveState)}
             onClose={() => setSelectedTeacherId(null)}
             isSaving={isSaving}
             isResetting={isResetting}
             isArchiveStatusLoading={isArchiveStatusLoading}
             variant="sheet"
           />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
        {/* Sidebar Bucket - Locked & Pinned */}
        <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
          <div id="teacher-builder-section" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-4">
            {selectedTeacherWithArchiveState ? (
              <div className="hidden lg:block">
                <TeacherEditForm
                  teacher={selectedTeacherWithArchiveState}
                  onUpdate={handleUpdate}
                  onResetPassword={handleResetPassword}
                  onArchive={() => handleArchivePrompt(selectedTeacherWithArchiveState)}
                  onClose={() => setSelectedTeacherId(null)}
                  isSaving={isSaving}
                  isResetting={isResetting}
                  isArchiveStatusLoading={isArchiveStatusLoading}
                />
              </div>
            ) : (
              <TeacherCreationForm
                onProvision={handleProvision}
                isSubmitting={isSubmitting}
                draftContext={draftContext}
              />
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/60 shrink-0">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">System Notification</h4>
            <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-400">
              Staff accounts are linked to school email addresses. Deactivation is permanent and irreversible.
            </p>
          </div>
        </aside>

        {/* Main Bucket */}
        <main className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto px-4 py-6 md:px-10 md:py-12 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto space-y-6 md:space-y-8">
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
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm font-bold text-slate-950 outline-none transition-all focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTeachers.map((teacher) => (
                <div key={teacher._id} id={"teacher-" + teacher._id}>
                  <TeacherCard
                    teacher={teacher}
                    isSelected={selectedTeacherId === teacher._id}
                    onSelect={() => setSelectedTeacherId(teacher._id)}
                    onArchive={() => handleArchivePrompt(teacher)}
                  />
                </div>
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
        </main>
      </div>
    </div>
  );
}
