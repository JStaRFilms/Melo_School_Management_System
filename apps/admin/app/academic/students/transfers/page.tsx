"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useDirtyForm, useDepartureGuard } from "@school/shared/drafts";
import { ConvexError } from "convex/values";
import { useAuth } from "@/AuthProvider";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";

const transfers = api.functions.academic.transfers;
type Workspace = Extract<
  FunctionReturnType<typeof transfers.getTransferWorkspace>,
  { allowed: true }
>;
type Transfer = FunctionReturnType<
  typeof transfers.listTransfersBySchool
>[number];
const control =
  "block w-full rounded border border-slate-300 bg-white p-2 text-slate-900";

export default function TransfersPage() {
  return (
    <Suspense fallback={<p role="status">Loading transfers…</p>}>
      <WorkspaceGate />
    </Suspense>
  );
}
function WorkspaceGate() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const workspace = useQuery(
    transfers.getTransferWorkspace,
    schoolId ? { schoolId } : "skip",
  );
  if (!schoolId || workspace === undefined)
    return <p role="status">Checking transfer authority…</p>;
  if (!workspace.allowed)
    return (
      <p role="alert" className="p-4">
        Transfer access denied in this branch. No student data was loaded.
      </p>
    );
  return (
    <TransferWorkspace
      key={`${schoolId}:${workspaceAccess?.state === "ready" ? workspaceAccess.compatibility.legacyUserId : ""}`}
      schoolId={schoolId}
      workspace={workspace}
    />
  );
}
function TransferWorkspace({
  schoolId,
  workspace,
}: {
  schoolId: Id<"schools">;
  workspace: Workspace;
}) {
  const params = useSearchParams();
  const { requestDeparture } = useDepartureGuard();
  const [selected, setSelected] = useState<Id<"studentTransfers">>();
  // IDs from links are untrusted input; Convex validators and history authority check them.
  const [historyStudent, setHistoryStudent] = useState<
    Id<"students"> | undefined
  >(() =>
    params.get("student")
      ? (params.get("student") as Id<"students">)
      : undefined,
  );
  const records = useQuery(transfers.listTransfersBySchool, { schoolId });
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 text-slate-900 sm:p-6">
      <nav className="flex flex-wrap gap-4">
        <Link className="underline" href="/academic/students">
          Students
        </Link>
        <Link className="underline" href="/admin/settings/admission-numbering">
          Numbering settings
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">
          Within-group student transfers
        </h1>
        <p>
          {workspace.schoolName} · Source history stays in its original branch.
        </p>
      </header>
      {!selected ? (
        <Proposal
          schoolId={schoolId}
          workspace={workspace}
          onCreated={setSelected}
        />
      ) : (
        <button
          className="underline"
          onClick={async () => {
            if (await requestDeparture({ kind: "close" }))
              setSelected(undefined);
          }}
        >
          New transfer proposal
        </button>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Incoming, outgoing and finalized transfers
        </h2>
        {records === undefined ? (
          <p role="status">Loading transfers…</p>
        ) : !records.length ? (
          <p>No transfers in this branch.</p>
        ) : (
          <ul className="divide-y rounded border">
            {records.map((record) => (
              <li
                key={record._id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <span>
                  {record.studentName} ·{" "}
                  {record.sourceSchoolId === schoolId ? "Outgoing" : "Incoming"}{" "}
                  · {record.status.replaceAll("_", " ")}
                </span>
                <button
                  className="underline"
                  onClick={async () => {
                    if (await requestDeparture({ kind: "close" }))
                      setSelected(record._id);
                  }}
                >
                  Review {record.studentName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected && (
        <Review
          key={selected}
          transferId={selected}
          schoolId={schoolId}
          workspace={workspace}
          onHistory={setHistoryStudent}
        />
      )}
      {historyStudent && <History studentId={historyStudent} />}
      <p className="text-sm text-slate-600">
        Only identity and explicitly supplied academic/attendance summaries are
        shared. No financial, health, safeguarding or disciplinary records are
        copied. Independent-school transfers and institution signing are not
        available.
      </p>
    </main>
  );
}
function Proposal({
  schoolId,
  workspace,
  onCreated,
}: {
  schoolId: Id<"schools">;
  workspace: Workspace;
  onCreated: (id: Id<"studentTransfers">) => void;
}) {
  const initiate = useMutation(transfers.initiateStudentTransfer);
  const [classId, setClassId] = useState<Id<"classes">>();
  const candidates = useQuery(
    transfers.listTransferCandidates,
    classId ? { schoolId, classId } : "skip",
  );
  const [studentId, setStudentId] = useState<Id<"students">>();
  const [destination, setDestination] = useState<Id<"schools">>();
  const [className, setClassName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [method, setMethod] = useState("");
  const [summary, setSummary] = useState("");
  const [attendance, setAttendance] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [requestKey, setRequestKey] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dirty = !!(
    classId ||
    studentId ||
    destination ||
    className ||
    sessionName ||
    method ||
    summary ||
    attendance ||
    consent
  );
  function reset() {
    setClassId(undefined);
    setStudentId(undefined);
    setDestination(undefined);
    setClassName("");
    setSessionName("");
    setMethod("");
    setSummary("");
    setAttendance("");
    setConsent(false);
    setConfirmed(false);
    setRequestKey(undefined);
    setError("");
  }
  useDirtyForm({
    name: "Transfer proposal",
    isDirty: dirty || pending,
    discard: () => {
      if (pending || requestKey)
        throw new Error(
          "Resolve the submitted proposal through retry/history before discarding its intent.",
        );
      reset();
    },
  });
  if (!workspace.destinations.length)
    return (
      <p>
        No active destination branches in this school group. Independent-school
        transfers are unavailable.
      </p>
    );
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!studentId || !destination || !consent || !confirmed || pending)
          return;
        const key = requestKey ?? crypto.randomUUID();
        setRequestKey(key);
        setPending(true);
        setError("");
        try {
          const result = await initiate({
            sourceSchoolId: schoolId,
            destinationSchoolId: destination,
            studentId,
            requestKey: key,
            guardianConsentRecorded: consent,
            guardianConsentMethod: method,
            proposalClassName: className,
            proposalSessionName: sessionName,
            academicHistorySummary: summary.trim() || undefined,
            attendanceSummaryPct:
              attendance === "" ? undefined : Number(attendance),
          });
          onCreated(result.transferId);
          reset();
        } catch (error) {
          if (error instanceof ConvexError) {
            setRequestKey(undefined);
            setError(
              "Proposal rejected by the server. Verify consent, student status and group configuration before correcting and retrying.",
            );
          } else
            setError(
              "Proposal was not acknowledged. Fields and operation intent are retained; retry the same proposal or check branch history. Do not submit a second proposal.",
            );
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">
        Initiate from {workspace.schoolName}
      </h2>
      <fieldset
        disabled={pending || !!requestKey}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label>
          Source class
          <select
            required
            className={control}
            value={classId ?? ""}
            onChange={(e) => {
              setClassId(
                workspace.classes.find((c) => c._id === e.target.value)?._id,
              );
              setStudentId(undefined);
            }}
          >
            <option value="">Select source class</option>
            {workspace.classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source student
          <select
            required
            className={control}
            value={studentId ?? ""}
            onChange={(e) =>
              setStudentId(
                candidates?.find((s) => s._id === e.target.value)?._id,
              )
            }
          >
            <option value="">
              {classId && candidates === undefined
                ? "Loading students…"
                : "Select student"}
            </option>
            {candidates?.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} · {s.admissionNumber}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination branch
          <select
            required
            className={control}
            value={destination ?? ""}
            onChange={(e) =>
              setDestination(
                workspace.destinations.find((d) => d._id === e.target.value)
                  ?._id,
              )
            }
          >
            <option value="">Select within-group branch</option>
            {workspace.destinations.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Proposed destination class
          <input
            required
            maxLength={500}
            className={control}
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </label>
        <label>
          Proposed destination session
          <input
            required
            maxLength={500}
            className={control}
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
          />
        </label>
        <p className="text-sm">
          Class and session names are proposals, not access to destination
          records. The destination registrar chooses and confirms its actual
          active class/session.
        </p>
        <label>
          Guardian consent method / evidence reference
          <input
            required
            maxLength={500}
            className={control}
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          />
        </label>
        <label>
          Optional attendance percentage
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className={control}
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
          />
        </label>
        <label className="sm:col-span-2">
          Optional academic summary (no sensitive records)
          <textarea
            maxLength={500}
            className={control}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          I verified guardian consent for this transfer and the minimal shared
          record.
        </label>
        <label>
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I confirm this source student, destination branch and class/session
          proposal.
        </label>
      </fieldset>
      <p className="text-sm">
        Portable preview: selected student identity,{" "}
        {summary.trim() || "current class and admission-number summary"};
        attendance {attendance === "" ? "not supplied" : `${attendance}%`}. No
        dossier or guardian contact details are copied. Destination account
        creation retains existing student account identity linkage and email.
      </p>
      {error && <p role="alert">{error}</p>}
      <button
        className="rounded border px-4 py-2"
        disabled={
          pending || !studentId || !destination || !confirmed || !consent
        }
      >
        {pending
          ? "Submitting…"
          : requestKey
            ? "Retry same proposal"
            : "Initiate transfer"}
      </button>
    </form>
  );
}
function Review({
  transferId,
  schoolId,
  workspace,
  onHistory,
}: {
  transferId: Id<"studentTransfers">;
  schoolId: Id<"schools">;
  workspace: Workspace;
  onHistory: (id: Id<"students">) => void;
}) {
  const record = useQuery(transfers.getTransfer, { transferId });
  const release = useMutation(transfers.authorizeSourceRelease);
  const accept = useMutation(transfers.acceptDestinationTransfer);
  const abort = useMutation(transfers.rejectOrCancelTransfer);
  const [classId, setClassId] = useState<Id<"classes">>();
  const [sessionId, setSessionId] = useState<Id<"academicSessions">>();
  const number = useQuery(
    transfers.previewTransferNumber,
    classId ? { schoolId, classId } : "skip",
  );
  const [reason, setReason] = useState("");
  const [manual, setManual] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [advance, setAdvance] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState<() => Promise<unknown>>();
  const dirty = !!(
    reason ||
    manual ||
    overrideReason ||
    advance ||
    classId ||
    sessionId ||
    confirmed
  );
  useDirtyForm({
    name: "Transfer review",
    isDirty: dirty || pending || !!retry,
    discard: () => {
      if (pending || retry)
        throw new Error(
          "Resolve the pending transfer action by retrying before leaving.",
        );
      setReason("");
      setManual("");
      setOverrideReason("");
      setAdvance("");
      setClassId(undefined);
      setSessionId(undefined);
      setConfirmed(false);
      setOverrideConfirmed(false);
    },
  });
  async function perform(operation: () => Promise<unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    setRetry(() => operation);
    try {
      await operation();
      setRetry(undefined);
      setMessage(
        "Action acknowledged. Timeline shows the current authoritative state.",
      );
      setReason("");
      setManual("");
      setOverrideReason("");
      setAdvance("");
      setClassId(undefined);
      setSessionId(undefined);
      setConfirmed(false);
      setOverrideConfirmed(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        setRetry(undefined);
        setError(
          "Action rejected by the server. Check current authority, transfer state, class/session and numbering policy before correcting the review.",
        );
      } else
        setError(
          "Action not acknowledged. It may have completed, or authority/state/configuration changed. Retry sends the identical intent; check the timeline before starting another action.",
        );
    } finally {
      setPending(false);
    }
  }
  if (record === undefined)
    return <p role="status">Loading scoped transfer…</p>;
  if (!record) return <p role="alert">Transfer unavailable.</p>;
  const source = record.sourceSchoolId === schoolId;
  const active =
    record.status === "initiated" || record.status === "source_released";
  const destinationStudentId =
    "destinationStudentId" in record ? record.destinationStudentId : undefined;
  const historyId = source ? record.studentId : destinationStudentId;
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-semibold">Review {record.studentName}</h2>
      <Timeline record={record} />
      <p>
        Proposed class: {record.proposalClassName ?? "Not recorded"} · session:{" "}
        {record.proposalSessionName ?? "Not recorded"}
      </p>
      <p>
        Guardian consent:{" "}
        {record.guardianConsentRecorded ? "Recorded" : "Missing"} ·{" "}
        {record.guardianConsentMethod}
      </p>
      <details>
        <summary>Minimal portable record preview</summary>
        <p>{record.portableRecordPackage?.studentName}</p>
        <p>
          {record.portableRecordPackage?.dateOfBirth} ·{" "}
          {record.portableRecordPackage?.gender}
        </p>
        <p>{record.portableRecordPackage?.academicHistorySummary}</p>
        <p>
          Attendance:{" "}
          {record.portableRecordPackage?.attendanceSummaryPct === undefined
            ? "Not supplied"
            : `${record.portableRecordPackage.attendanceSummaryPct}%`}
        </p>
      </details>
      {historyId && (
        <button className="underline" onClick={() => onHistory(historyId)}>
          View scoped continuous history
        </button>
      )}
      {active && (
        <fieldset disabled={pending || !!retry} className="space-y-3">
          {!source && record.status === "source_released" && (
            <>
              <label>
                Actual destination class
                <select
                  className={control}
                  value={classId ?? ""}
                  onChange={(e) => {
                    setClassId(
                      workspace.classes.find((c) => c._id === e.target.value)
                        ?._id,
                    );
                    setConfirmed(false);
                  }}
                >
                  <option value="">Select class</option>
                  {workspace.classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Active destination session
                <select
                  className={control}
                  value={sessionId ?? ""}
                  onChange={(e) => {
                    setSessionId(
                      workspace.sessions.find((s) => s._id === e.target.value)
                        ?._id,
                    );
                    setConfirmed(false);
                  }}
                >
                  <option value="">Select session</option>
                  {workspace.sessions.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {number?.available
                  ? `Proposed new admission number: ${number.allocatedNumber} (policy ${number.policyVersion}). Not reserved; allocated atomically on acceptance.`
                  : (number?.message ?? "Select a class for a number preview.")}
              </p>
              {workspace.canOverrideNumber ? (
                <details>
                  <summary>Governed manual admission number override</summary>
                  <label>
                    Manual number (blank uses automatic)
                    <input
                      className={control}
                      maxLength={160}
                      value={manual}
                      onChange={(e) => setManual(e.target.value)}
                    />
                  </label>
                  <label>
                    Override reason
                    <input
                      className={control}
                      minLength={8}
                      maxLength={240}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                  </label>
                  <label>
                    Explicit next counter (blank leaves unchanged)
                    <input
                      className={control}
                      type="number"
                      min="1"
                      step="1"
                      value={advance}
                      onChange={(e) => setAdvance(e.target.value)}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={overrideConfirmed}
                      onChange={(e) => setOverrideConfirmed(e.target.checked)}
                    />{" "}
                    Confirm manual identifier and explicit counter choice.
                  </label>
                </details>
              ) : (
                <p>Manual number override is not authorized.</p>
              )}
            </>
          )}
          <label>
            Release note / rejection or cancellation reason
            <input
              className={control}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label className="block">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I confirm the{" "}
            {source
              ? "source release/cancellation"
              : "destination acceptance/rejection"}{" "}
            for this student. Source history will remain unchanged.
          </label>
          <div className="flex flex-wrap gap-3">
            {source && record.status === "initiated" && (
              <button
                className="rounded border p-2"
                disabled={!confirmed}
                onClick={() =>
                  void perform(() =>
                    release({
                      transferId,
                      sourceReleaseNote: reason.trim() || undefined,
                    }),
                  )
                }
              >
                Authorize source release
              </button>
            )}
            {!source && record.status === "source_released" && (
              <button
                className="rounded border p-2"
                disabled={
                  !confirmed ||
                  !classId ||
                  !sessionId ||
                  (manual.trim()
                    ? !overrideConfirmed || overrideReason.trim().length < 8
                    : !number?.available)
                }
                onClick={() => {
                  if (!classId || !sessionId) return;
                  const args = {
                    transferId,
                    destinationClassId: classId,
                    destinationSessionId: sessionId,
                    expectedPolicyVersion: number?.available
                      ? number.policyVersion
                      : undefined,
                    expectedFormatVersion: number?.available
                      ? number.formatVersion
                      : undefined,
                    expectedCounterKey: number?.available
                      ? number.counterKey
                      : undefined,
                    expectedCounterVersion: number?.available
                      ? number.counterVersion
                      : undefined,
                    expectedAdmissionNumber: number?.available
                      ? number.allocatedNumber
                      : undefined,
                    expectedSequenceNumber: number?.available
                      ? number.sequenceNumber
                      : undefined,
                    admissionNumberOverride: manual.trim() || undefined,
                    admissionNumberOverrideReason: manual.trim()
                      ? overrideReason
                      : undefined,
                    admissionNumberOverrideConfirmed: manual.trim()
                      ? overrideConfirmed
                      : undefined,
                    advanceCounterTo:
                      manual.trim() && advance ? Number(advance) : undefined,
                  };
                  void perform(() => accept(args));
                }}
              >
                Accept and create destination enrollment
              </button>
            )}
            <button
              className="rounded border p-2"
              disabled={!confirmed || !reason.trim()}
              onClick={() =>
                void perform(() =>
                  abort({
                    transferId,
                    action: source ? "cancelled" : "rejected",
                    reason,
                  }),
                )
              }
            >
              {source ? "Cancel transfer" : "Reject transfer"}
            </button>
          </div>
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {retry && (
        <button
          className="rounded border p-2"
          disabled={pending}
          onClick={() => void perform(retry)}
        >
          {pending ? "Sending…" : "Retry identical action"}
        </button>
      )}
    </section>
  );
}
function Timeline({ record }: { record: Transfer }) {
  return (
    <ol
      className="list-inside list-decimal space-y-1 text-sm"
      aria-label="Transfer timeline"
    >
      <li>
        Initiated · {new Date(record.createdAt).toLocaleString()} ·{" "}
        {record.sourceSchoolName ?? "Source branch"} →{" "}
        {record.destinationSchoolName ?? "Destination branch"}
      </li>
      {record.sourceReleaseRecorded && (
        <li>
          Source released ·{" "}
          {"sourceReleasedAt" in record && record.sourceReleasedAt
            ? new Date(record.sourceReleasedAt).toLocaleString()
            : "source details restricted"}
        </li>
      )}
      {record.status !== "initiated" && record.status !== "source_released" && (
        <li>
          {record.status.replaceAll("_", " ")} ·{" "}
          {new Date(record.updatedAt).toLocaleString()}
        </li>
      )}
      {"sourceReleaseNote" in record && record.sourceReleaseNote && (
        <li>Source release note: {record.sourceReleaseNote}</li>
      )}
      {"destinationClassName" in record && record.destinationClassName && (
        <li>
          Destination class: {record.destinationClassName} · session:{" "}
          {record.destinationSessionName ?? "Not recorded"}
        </li>
      )}
      {record.cancellationReason && (
        <li>Reason: {record.cancellationReason}</li>
      )}
      {"destinationAdmissionNumber" in record &&
        record.destinationAdmissionNumber && (
          <li>
            Destination admission number: {record.destinationAdmissionNumber}
          </li>
        )}
    </ol>
  );
}
function History({ studentId }: { studentId: Id<"students"> }) {
  const history = useQuery(transfers.getStudentTransferHistory, { studentId });
  return (
    <section
      className="space-y-3"
      aria-label="Scoped continuous student history"
    >
      <h2 className="text-lg font-semibold">
        Scoped continuous student history
      </h2>
      <p>
        Only authorized transfer links are shown. Original attendance, scores
        and invoices remain in their source branch, not in this portable record.
      </p>
      {history === undefined ? (
        <p role="status">Loading history…</p>
      ) : !history.length ? (
        <p>No visible transfer history.</p>
      ) : (
        history.map((record) => (
          <article className="rounded border p-3" key={record._id}>
            <h3>{record.studentName}</h3>
            <Timeline record={record} />
          </article>
        ))
      )}
    </section>
  );
}
