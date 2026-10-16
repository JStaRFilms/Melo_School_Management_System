"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage, hasEffectiveCapability } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { useAuth } from "@/AuthProvider";
import { useDraftConnection } from "@/useDraftConnection";
import { useIsMobile } from "@/hooks/useIsMobile";
import { AdminSheet } from "@/components/ui/AdminSheet";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { lifecycleButton } from "@/components/lifecycle/LifecycleContextFields";
import { TeacherCreationForm } from "../../academic/teachers/components/TeacherCreationForm";
import { StaffServiceDirectory } from "./StaffServiceDirectory";
import { StaffLifecyclePanel } from "./StaffLifecyclePanel";

export function StaffDirectorySection({ schoolId }: { schoolId: Id<"schools"> }) {
  const { workspaceAccess, session } = useAuth();
  const connection = useDraftConnection();
  const isMobile = useIsMobile();
  const [userId, setUserId] = useState<Id<"users">>();
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const createStaff = useAction(api.functions.academic.academicSetup.createStaff);
  const archive = useMutation(api.functions.academic.academicSetup.setStaffAccountArchive);
  const canOnboard = hasEffectiveCapability(workspaceAccess, "staff.onboard");
  const canArchive = hasEffectiveCapability(workspaceAccess, "staff.account.suspend");
  if (!hasEffectiveCapability(workspaceAccess, "staff.list.view")) return null;
  const detail = userId && <div className="space-y-3">
    <StaffLifecyclePanel key={userId} schoolId={schoolId} userId={userId} />
    {canArchive && <button type="button" className={lifecycleButton} onClick={() => { setArchiveError(""); setArchiveOpen(true); }}>Archive other staff account</button>}
    {!isMobile && <button type="button" className={lifecycleButton} onClick={() => setUserId(undefined)}>Close staff profile</button>}
  </div>;
  return <section className="space-y-4 border-t border-slate-200 pt-6" aria-label="Other staff">
    <h2 className="text-lg font-semibold">Other staff</h2>
    <p className="text-sm text-slate-600">Generic staff accounts, not teachers. Joining, departure and reviewed rehire use the same identity.</p>
    <StaffServiceDirectory schoolId={schoolId} role="staff" selectedUserId={userId ?? null} onSelect={setUserId} />
    {!isMobile && detail}
    <AdminSheet isOpen={isMobile && Boolean(userId)} onClose={() => setUserId(undefined)} title="Other staff service">{detail}</AdminSheet>
    {canOnboard && session?.user.id && <TeacherCreationForm accountKind="staff" isSubmitting={busy} draftContext={{ schoolId, accountId: session.user.id, connection }} onProvision={async (name, email, password, draft, joiningDay) => {
      if (!draft) throw new Error("An active staff onboarding draft is required.");
      setBusy(true);
      try {
        const result = await createStaff({ name: name.trim(), email: email.trim().toLowerCase(), temporaryPassword: password.trim(), origin: window.location.origin, draftId: draft.draftId, expectedDraftRevision: draft.expectedRevision, joiningDay });
        appToast.success("Other staff account created");
        return result;
      } catch (err) { appToast.error(getUserFacingErrorMessage(err, "Could not create the staff account.")); throw err; }
      finally { setBusy(false); }
    }} />}
    <ConfirmationModal isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} title="Archive other staff account" description="Archive restricts visibility and access. It does not record departure. Restore does not rehire staff or override independent restrictions." confirmLabel="Archive account" confirmVariant="danger" isLoading={archiving} onConfirm={() => {
      if (!userId || archiving) return;
      setArchiving(true);
      void archive({ schoolId, userId, archived: true }).then(() => { setArchiveOpen(false); setUserId(undefined); appToast.success("Staff account archived"); }).catch(err => setArchiveError(getUserFacingErrorMessage(err, "Archive failed. Resolve any named assignment or leadership blockers."))).finally(() => setArchiving(false));
    }}>{archiveError && <p role="alert">{archiveError}</p>}</ConfirmationModal>
  </section>;
}
