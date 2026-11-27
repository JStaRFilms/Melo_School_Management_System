"use client";

import { getUserFacingErrorMessage } from "@school/shared";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";

import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import type { EnrollmentNotice } from "./types";

type ArchiveContext = FunctionReturnType<typeof api.functions.academic.studentEnrollment.getStudentArchiveContext>;

export function ArchiveStudentConfirmation({ studentId, schoolId, studentName, admissionNumber, onClose, onArchived, onNotice, onPendingChange }: {
  studentId: string;
  schoolId: string;
  studentName: string;
  admissionNumber: string;
  onClose: () => void;
  onArchived: (studentId: string) => void;
  onNotice: (notice: EnrollmentNotice) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const client = useConvex();
  const archive = useMutation(api.functions.academic.studentEnrollment.archiveStudent);
  const [context, setContext] = useState<ArchiveContext>();
  const [contextError, setContextError] = useState("");
  const [reviewVersion, setReviewVersion] = useState(0);
  const [combined, setCombined] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const active = useRef(true);
  const submitting = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; onPendingChange(false); };
  }, [onPendingChange]);

  useEffect(() => {
    let cancelled = false;
    // Keep one reviewed snapshot. A reactive term change must not replace consent.
    void client.query(api.functions.academic.studentEnrollment.getStudentArchiveContext, {
      studentId: studentId as Id<"students">, schoolId: schoolId as Id<"schools">,
    }).then(value => {
      if (!cancelled) setContext(value);
    }).catch(cause => {
      if (!cancelled) setContextError(getUserFacingErrorMessage(cause, "Current term could not be checked. Archive only is still available."));
    });
    return () => { cancelled = true; };
  }, [client, schoolId, studentId, reviewVersion]);

  const offer = context?.offer;
  const canCombine = !stale && !!context?.canArchiveAndExclude && !!offer?.reviewedKey;
  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;
  const refreshReview = () => {
    setCombined(false);
    setContext(undefined);
    setContextError("");
    setError("");
    setStale(false);
    setReviewVersion(value => value + 1);
  };
  const confirm = async () => {
    if (submitting.current || (combined && (!canCombine || !reasonValid || !offer?.reviewedKey))) return;
    submitting.current = true;
    setPending(true);
    onPendingChange(true);
    setError("");
    try {
      await archive({
        studentId: studentId as Id<"students">, schoolId: schoolId as Id<"schools">,
        ...(combined && offer?.reviewedKey ? { resultExclusion: {
          sessionId: offer.sessionId, termId: offer.termId, classId: offer.classId,
          reason: reason.trim(), reviewedKey: offer.reviewedKey,
        } } : {}),
      });
      if (!active.current) return;
      onNotice({ tone: "success", message: combined ? `Student archived and excluded from ${offer?.termName} results.` : "Student archived." });
      onArchived(studentId);
      onClose();
    } catch (cause) {
      if (!active.current) return;
      const message = getUserFacingErrorMessage(cause, "Archive failed.");
      const unavailableOffer = message.match(/^Archive offer unavailable: (.+)$/i);
      setError(unavailableOffer?.[1] ?? message);
      if (combined && (unavailableOffer || /context changed|review again|already (?:excluded|released)/i.test(message))) setStale(true);
    } finally {
      if (active.current) {
        submitting.current = false;
        setPending(false);
        onPendingChange(false);
      }
    }
  };

  return <ConfirmationModal
    isOpen
    onClose={() => { if (!submitting.current) onClose(); }}
    onConfirm={() => void confirm()}
    title="Archive student record"
    description={`${studentName}, ${admissionNumber}. The student will leave active rosters. Existing records and released reports are kept.`}
    confirmLabel={combined ? "Archive and exclude" : "Archive student"}
    confirmVariant="danger"
    isLoading={pending}
    confirmDisabled={combined && (!canCombine || !reasonValid)}
  >
    <div className="space-y-3 text-sm text-slate-700">
      {context && <p>{context.schoolName} / {offer?.className ?? context.className}{offer ? ` / ${offer.sessionName} / ${offer.termName}` : ""}</p>}
      <fieldset disabled={pending} className="space-y-2">
        <legend className="sr-only">Archive options</legend>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="archive-choice" checked={!combined} onChange={() => setCombined(false)} />Archive only</label>
        <label className="flex min-h-11 items-center gap-2"><input type="radio" name="archive-choice" checked={combined} disabled={!canCombine} aria-describedby="archive-context-status" onChange={() => setCombined(true)} />{offer ? `Archive and exclude from ${offer.termName} results` : "Archive and exclude from current term results"}</label>
      </fieldset>
      <p id="archive-context-status" role="status">{stale ? "The student or current term changed. Check the current term and review it again before archiving and excluding." : contextError || context?.unavailableReason || (!context ? "Checking current term..." : "")}</p>
      {(stale || contextError) && <button type="button" disabled={pending} onClick={refreshReview} className="min-h-11 underline">Check current term again</button>}
      {combined && <div>
        <label className="block font-semibold">Reason for exclusion
          <textarea value={reason} onChange={event => setReason(event.target.value)} disabled={pending} rows={3} aria-describedby="archive-reason-help" className="mt-2 block w-full rounded border border-slate-300 p-2" />
        </label>
        <p id="archive-reason-help" className="text-xs">Enter 10 to 500 characters.</p>
      </div>}
      <p>{combined ? "The student will not receive this class release, even if a report is certified." : "This does not exclude the student from this term's results."}</p>
      <p>While archived, the student is automatically left out of terms that begin after the archive date unless their records need review.</p>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
    </div>
  </ConfirmationModal>;
}
