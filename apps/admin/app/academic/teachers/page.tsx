"use client";

import { useMemo, useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { GraduationCap, Sparkles } from "lucide-react";
import { StaffLifecyclePanel } from "../../admin/components/StaffLifecyclePanel";
import { StaffServiceDirectory } from "../../admin/components/StaffServiceDirectory";
import { getUserFacingErrorMessage, hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { StatGroup } from "@/components/ui/StatGroup";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
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
  const canOnboard = hasEffectiveCapability(workspaceAccess, "staff.onboard");
  const canEditProfile = hasEffectiveCapability(workspaceAccess, "staff.profiles.edit");
  const canResetPassword = hasEffectiveCapability(workspaceAccess, "staff.password.reset");
  const canArchive = hasEffectiveCapability(workspaceAccess, "staff.account.suspend");

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

  const selectedTeacher = useMemo(() => 
    teachers?.find((t) => t._id === selectedTeacherId) ?? null,
  [teachers, selectedTeacherId]);
  const selectedTeacherArchiveBlockers = useQuery(
    "functions/academic/academicSetup:getTeacherArchiveBlockers" as never,
    selectedTeacherId && canArchive
      ? ({ teacherId: selectedTeacherId } as never)
      : ("skip" as never)
  ) as string[] | undefined;
  const isArchiveStatusLoading =
    Boolean(selectedTeacherId && canArchive) && selectedTeacherArchiveBlockers === undefined;
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
      const el = document.getElementById("teacher-builder-section");
      el?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTeacherId, isMobile]);

  const handleProvision = async (name: string, email: string, password: string, draft?: DraftClosure, joiningDay?: string): Promise<ProvisionResult> => {
    setIsSubmitting(true);
    try {
      const response = await createTeacher({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        temporaryPassword: password.trim(),
        origin: window.location.origin,
        draftId: draft?.draftId,
        expectedDraftRevision: draft?.expectedRevision,
        joiningDay,
      } as never) as ProvisionResult;
      
      showNotice({ tone: "success", title: "Teacher Provisioned", message: `Account active for ${email}` });
      return response;
    } catch (err) {
      const message = getUserFacingErrorMessage(err, "Failed to provision account.");
      showNotice({
        tone: "error",
        title: message.toLowerCase().includes("already registered") || message.toLowerCase().includes("unique")
          ? "Account Exists"
          : "Provision Failed",
        message,
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
        message: getUserFacingErrorMessage(err, "Failed to update record."),
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
        message: getUserFacingErrorMessage(err, "Failed to reset password."),
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
        title: message.toLowerCase().includes("reassign") || message.toLowerCase().includes("link")
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
        {schoolId && selectedTeacherId && <StaffLifecyclePanel key={selectedTeacherId} schoolId={schoolId} userId={selectedTeacherId as Id<"users">} />}
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
             canEditProfile={canEditProfile}
             canResetPassword={canResetPassword}
             canArchive={canArchive}
           />
        )}
      </AdminSheet>

      <div className="relative flex-1 flex flex-col lg:flex-row-reverse min-h-0 lg:h-full lg:overflow-hidden">
        {/* Sidebar Bucket - Locked & Pinned */}
        <aside className="w-full lg:w-[400px] xl:w-[420px] lg:h-full lg:overflow-hidden flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/60 bg-white/40 backdrop-blur-xl p-4 md:p-5 z-10 shrink-0">
          <div id="teacher-builder-section" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5 space-y-4">
            {selectedTeacherId && schoolId ? (
              <div className="hidden lg:block space-y-4">
                <StaffLifecyclePanel key={selectedTeacherId} schoolId={schoolId} userId={selectedTeacherId as Id<"users">} />
                {selectedTeacherWithArchiveState && <TeacherEditForm
                  teacher={selectedTeacherWithArchiveState}
                  onUpdate={handleUpdate}
                  onResetPassword={handleResetPassword}
                  onArchive={() => handleArchivePrompt(selectedTeacherWithArchiveState)}
                  onClose={() => setSelectedTeacherId(null)}
                  isSaving={isSaving}
                  isResetting={isResetting}
                  isArchiveStatusLoading={isArchiveStatusLoading}
                  canEditProfile={canEditProfile}
                  canResetPassword={canResetPassword}
                  canArchive={canArchive}
                />}
                {!selectedTeacherWithArchiveState && <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setSelectedTeacherId(null)}>Close service profile</button>}
              </div>
            ) : canOnboard ? (
              <TeacherCreationForm
                onProvision={handleProvision}
                isSubmitting={isSubmitting}
                draftContext={draftContext}
              />
            ) : (
              <p className="text-sm text-slate-500">Select a teacher to view authorized controls.</p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200/60 shrink-0">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">System Notification</h4>
            <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-400">
              Departure ends access to this school. Historical records remain. Returning staff require an access review.
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

            {schoolId && <StaffServiceDirectory schoolId={schoolId} role="teacher" selectedUserId={selectedTeacherId} onSelect={setSelectedTeacherId} />}
          </div>
        </main>
      </div>
    </div>
  );
}
