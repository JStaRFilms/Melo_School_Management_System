"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { getUserFacingErrorMessage } from "@school/shared";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import type { FunctionArgs } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { hasEffectiveCapability } from "@school/shared";
import { useAuth } from "@/AuthProvider";
import { LifecycleEvents, LifecycleLoadMore, LifecyclePeriods } from "@/components/lifecycle/LifecycleHistory";
import { lifecycleButton } from "@/components/lifecycle/LifecycleContextFields";
import { StudentLifecycleActionModal, studentActionLabels, type StudentLifecycleProfile } from "./StudentLifecycleActionModal";

const enrollment = api.functions.academic.studentEnrollment;
type Action = FunctionArgs<typeof enrollment.transitionStudentEnrollment>["action"];
export function studentLifecycleActions(status: StudentLifecycleProfile["enrollmentStatus"], archived = false): Action[] {
  if (archived) return [];
  if (status === "active") return ["suspend", "withdraw"];
  if (status === "suspended") return ["reinstate", "withdraw"];
  if (status === "withdrawn") return ["re_enrol"];
  return [];
}

export function StudentLifecyclePanel({ profile }: { profile: StudentLifecycleProfile }) {
  const { workspaceAccess } = useAuth();
  const allowed = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage");
  const [action, setAction] = useState<Action>();
  const [saved, setSaved] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionError, setCorrectionError] = useState("");
  const cancelGraduation = useMutation(enrollment.cancelStudentGraduation);
  return <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Student enrollment">
    <h2 className="font-semibold">Enrollment: {profile.enrollmentStatus.replaceAll("_", " ")}</h2>
    {allowed && <StudentTransitionControls profile={profile} onAction={setAction} />}
    {saved && <p role="status">{saved} The selected profile stays open even when it leaves this directory filter.</p>}
    {profile.enrollmentStatus !== "active" && <p className="text-sm">Profile and family contacts remain editable. Current placement and subjects can only change through a reviewed return. Released reports and existing bills remain accessible.</p>}
    {profile.enrollmentStatus === "graduated" && <div className="space-y-2"><p className="text-sm">Ordinary re-enrollment is unavailable. Correct only a mistaken current graduation through the existing guarded correction.</p>{allowed && profile.graduatingSessionId && <button type="button" className={lifecycleButton} onClick={() => { setCorrectionError(""); setCorrecting(true); }}>Correct recorded graduation</button>}</div>}
    {profile.enrollmentStatus === "transferred_out" && <Link className="underline" href="/academic/students/transfers">Use the governed transfer or reversal workflow</Link>}
    {allowed && <StudentEnrollmentHistory studentId={profile._id} inactive={profile.enrollmentStatus !== "active"} />}
    <ConfirmationModal isOpen={correcting} onClose={() => setCorrecting(false)} title={`Correct graduation for ${profile.displayName}`} description={`This corrects the current matching graduation in ${profile.graduatingSessionName ?? "the recorded session"}. It is not ordinary re-enrollment. Later departures and transferred-out records cannot be reversed here.`} confirmLabel="Correct mistaken graduation" isLoading={correctionBusy} onConfirm={() => {
      if (!profile.graduatingSessionId || correctionBusy) return;
      setCorrectionBusy(true);
      void cancelGraduation({ studentId: profile._id, sessionId: profile.graduatingSessionId }).then(() => { setCorrecting(false); setSaved("Graduation correction confirmed."); }).catch(err => setCorrectionError(getUserFacingErrorMessage(err, "The current graduation cannot be corrected."))).finally(() => setCorrectionBusy(false));
    }}>{correctionError && <p role="alert">{correctionError}</p>}</ConfirmationModal>
    {action && <StudentLifecycleActionModal key={action} profile={profile} action={action} onClose={() => setAction(undefined)} onSaved={() => { setAction(undefined); setSaved("Enrollment change confirmed. Current status comes from the refreshed record."); }} />}
  </section>;
}

export function StudentEnrollmentHistory({ studentId, inactive }: { studentId: Id<"students">; inactive: boolean }) {
  const { workspaceAccess } = useAuth();
  const allowed = hasEffectiveCapability(workspaceAccess, "enrollment.intakes.manage");
  const history = usePaginatedQuery(enrollment.getStudentEnrollmentHistory, allowed ? { studentId } : "skip", { initialNumItems: 25 });
  const periods = usePaginatedQuery(enrollment.getStudentEnrollmentPeriods, allowed ? { studentId } : "skip", { initialNumItems: 25 });
  if (!allowed) return null;
  return <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Enrollment periods and history</summary><div className="space-y-4 pt-3">
    <LifecyclePeriods periods={periods.results} events={history.results} inactive={inactive} />
    <LifecycleLoadMore status={periods.status} loadMore={periods.loadMore} label="Load older periods" />
    <LifecycleEvents events={history.results} />
    <LifecycleLoadMore status={history.status} loadMore={history.loadMore} label="Load older enrollment events" />
  </div></details>;
}

function StudentTransitionControls({ profile, onAction }: { profile: StudentLifecycleProfile; onAction: (action: Action) => void }) {
  const { workspaceAccess } = useAuth();
  const schoolId = workspaceAccess?.state === "ready" ? workspaceAccess.branch.schoolId as Id<"schools"> : undefined;
  const pilot = useQuery(api.functions.academic.transfers.getTransferPilotAccess, schoolId ? { schoolId } : "skip");
  const transfers = useQuery(api.functions.academic.transfers.getStudentTransferHistory, pilot?.allowed ? { studentId: profile._id } : "skip");
  const pendingTransfer = transfers?.some(t => t.status === "initiated" || t.status === "source_released");
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">{studentLifecycleActions(profile.enrollmentStatus).map(action => <button key={action} type="button" className={lifecycleButton} disabled={Boolean(pendingTransfer) || Boolean(pilot?.allowed && !transfers)} onClick={() => onAction(action)}>{studentActionLabels[action]}</button>)}</div>
    {pendingTransfer && <p role="alert" className="text-sm">Resolve the open transfer before changing enrollment. <Link className="underline" href="/academic/students/transfers">Open transfer workbench</Link></p>}
  </div>;
}
