"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage } from "@school/shared";
import { appToast } from "@school/shared/toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { LifecycleContextFields, lifecycleInput, validLifecycleDay } from "@/components/lifecycle/LifecycleContextFields";

const enrollment = api.functions.academic.studentEnrollment;
type Transition = FunctionArgs<typeof enrollment.transitionStudentEnrollment>;
export type StudentLifecycleProfile = FunctionReturnType<typeof enrollment.getStudentProfile>;
export const studentActionLabels = { suspend: "Suspend", withdraw: "Withdraw", reinstate: "Reinstate", re_enrol: "Re-enroll" };

export function StudentLifecycleActionModal({ profile, action, onClose, onSaved }: {
  profile: StudentLifecycleProfile; action: Transition["action"]; onClose: () => void; onSaved: () => void;
}) {
  const returning = action === "reinstate" || action === "re_enrol";
  const classes = useQuery(api.functions.academic.academicSetup.listClasses, {});
  const sessions = useQuery(api.functions.academic.academicSetup.listSessions, {});
  const activeSession = sessions?.find(session => session.isActive);
  const terms = useQuery(api.functions.academic.academicSetup.listTermsBySession, activeSession ? { sessionId: activeSession._id } : "skip");
  const [chosenClass, setChosenClass] = useState<Id<"classes">>();
  const classId = chosenClass ?? classes?.find(c => c._id === profile.classId)?._id;
  const context = useQuery(enrollment.getStudentEnrollmentReturnContext, classId ? { studentId: profile._id, classId } : "skip");
  const subjects = useQuery(api.functions.academic.academicSetup.getClassSubjects, returning && classId ? { classId } : "skip");
  const [subjectIds, setSubjectIds] = useState<Id<"subjects">[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [correction, setCorrection] = useState(false);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const attempt = useRef<{ intent: string; args: Transition }>();
  const transition = useMutation(enrollment.transitionStudentEnrollment);
  const valid = reason.trim().length > 0 && validLifecycleDay(correction, day) && (!returning || Boolean(context?.sessionId && classId && subjects && confirmed));

  const submit = async () => {
    if (busy || stale || !valid) return;
    const draft = { studentId: profile._id, action, reason: reason.trim(), ...(correction ? { effectiveDay: day } : {}), ...(returning && classId ? { placement: { confirmed, classId, subjectIds } } : {}) };
    const intent = JSON.stringify(draft);
    // A lost response may already have committed. An unchanged retry keeps its original revision and key.
    if (attempt.current?.intent !== intent) attempt.current = { intent, args: { ...draft, expectedRevision: profile.enrollmentRevision, operationKey: crypto.randomUUID() } };
    setBusy(true);
    setError("");
    try {
      await transition(attempt.current.args);
      // The returned event can be an old replay. Subscriptions own today's status.
      appToast.success("Enrollment change confirmed");
      onSaved();
    } catch (err) {
      const message = getUserFacingErrorMessage(err, "The change could not be confirmed. Retry the unchanged request or review the current record.");
      setError(message);
      appToast.error(message);
      if (/stale|conflict|changed|revision/i.test(message)) setStale(true);
    } finally { setBusy(false); }
  };

  return <ConfirmationModal isOpen onClose={onClose} onConfirm={() => void submit()} title={`${studentActionLabels[action]} ${profile.displayName}`} description={returning ? "Saving opens a new participation period on this student record. Review current placement and subjects." : "Saving closes participation and removes the student from active rosters. Released reports and existing bills remain available in Portal."} confirmLabel={studentActionLabels[action]} confirmVariant={returning ? "primary" : "danger"} isLoading={busy} confirmDisabled={!valid || stale}>
    <div className="space-y-4">
      <p className="text-sm">Current status: {profile.enrollmentStatus.replaceAll("_", " ")}</p>
      <LifecycleContextFields sessionName={context?.sessionName ?? activeSession?.name} termName={context?.termName ?? terms?.find(term => term.isActive)?.name} reason={reason} onReasonChange={setReason} correction={correction} onCorrectionChange={setCorrection} effectiveDay={day} onDayChange={setDay} disabled={busy} />
      {returning && <fieldset disabled={busy} className="space-y-3 text-sm">
        <legend className="font-semibold">Review return placement</legend>
        <label className="block">Return class<select className={lifecycleInput} value={classId ?? ""} onChange={e => { setChosenClass(classes?.find(c => c._id === e.target.value)?._id); setSubjectIds([]); setConfirmed(false); }}><option value="">Choose a valid class</option>{classes?.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        {!context?.sessionId && <p role="alert">A current active session is required. Check Academic Setup before returning this student.</p>}
        <p>Subjects start unselected. Previous subjects are not restored automatically.</p>
        {classId && subjects === undefined && <p role="status">Loading current class subjects...</p>}
        {subjects?.map(subject => <label key={subject.subjectId} className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={subjectIds.includes(subject.subjectId)} onChange={e => { setSubjectIds(e.target.checked ? [...subjectIds, subject.subjectId] : subjectIds.filter(id => id !== subject.subjectId)); setConfirmed(false); }} />{subject.subjectName}</label>)}
        {subjects?.length === 0 && <p>This class has no configured subjects.</p>}
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed this class and subject selection for the current session.</label>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      {stale && <p role="alert">Close this dialog and review the refreshed status and placement before confirming a new request.</p>}
    </div>
  </ConfirmationModal>;
}
