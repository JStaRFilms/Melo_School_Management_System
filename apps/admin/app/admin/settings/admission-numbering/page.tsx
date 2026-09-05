"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";

export default function AdmissionNumberingPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "enrollment.intakes.manage" } : "skip",
  );
  const data = useQuery(
    api.functions.academic.admissionNumbers.getAdmissionNumberPolicy,
    schoolId && allowed ? { schoolId } : "skip",
  );
  const save = useMutation(
    api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
  );
  const [draft, setDraft] = useState<{
    pattern: string;
    schoolCode: string;
    campusCode: string;
    currentSequence: number;
    expectedVersion: number;
    resetFrequency: "continuous" | "session" | "calendar";
  } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  if (allowed === false)
    return <p role="alert">Numbering settings access denied.</p>;
  if (!data || !schoolId) return <p>Loading numbering policy…</p>;
  const value = draft ?? {
    pattern: data.policy?.pattern ?? "{SCHOOL}-{YEAR}-{SEQ:4}",
    schoolCode: data.policy?.schoolCode ?? "",
    campusCode: data.policy?.campusCode ?? "",
    currentSequence: data.nextSequence,
    expectedVersion: data.version,
    resetFrequency: data.policy?.resetFrequency ?? "continuous",
  };
  const preview = value.pattern
    .replaceAll("{SCHOOL}", value.schoolCode)
    .replaceAll("{CAMPUS}", value.campusCode)
    .replaceAll("{LEVEL}", "LEVEL")
    .replaceAll("{YEAR}", String(data.sessionYear ?? "unavailable"))
    .replace(/\{SEQ:([1-9])\}/g, (_, width: string) =>
      String(value.currentSequence).padStart(Number(width), "0"),
    );
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Admission numbering</h1>
      <p>
        Branch counter · version {data.version}. Continuous by default. YEAR
        uses the active academic session start year. Existing identifiers never
        change; gaps may occur.
      </p>
      {!data.policy && (
        <p>
          No policy configured. Enter explicit school and branch codes and
          review the next number.
        </p>
      )}
      {data.sessionYear === null && (
        <p role="alert">
          One active academic session is required before saving or allocating.
        </p>
      )}
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setMessage("");
          try {
            await save({
              schoolId,
              ...value,
              confirmedNextSequence: Number(confirmation),
            });
            setDraft(null);
            setConfirmation("");
            setMessage("Policy saved for new enrollments only.");
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Save failed; retry.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {(["schoolCode", "campusCode", "pattern"] as const).map((field) => (
          <label className="block" key={field}>
            {field}
            <input
              className="block w-full rounded border p-2"
              required
              value={value[field]}
              onChange={(e) => setDraft({ ...value, [field]: e.target.value })}
            />
          </label>
        ))}
        <p>
          Insert token:{" "}
          {["{SCHOOL}", "{CAMPUS}", "{LEVEL}", "{YEAR}", "{SEQ:4}"].map(
            (token) => (
              <button
                type="button"
                className="m-1 border px-2"
                key={token}
                onClick={() =>
                  setDraft({ ...value, pattern: value.pattern + token })
                }
              >
                {token}
              </button>
            ),
          )}
        </p>
        <label className="block">
          Reset
          <select
            className="block border p-2"
            value={value.resetFrequency}
            onChange={(e) => {
              const frequency = e.target.value;
              if (
                frequency === "continuous" ||
                frequency === "session" ||
                frequency === "calendar"
              )
                setDraft({ ...value, resetFrequency: frequency });
            }}
          >
            <option value="continuous">Continuous</option>
            <option value="session">Academic session</option>
            <option value="calendar">Calendar year (UTC)</option>
          </select>
        </label>
        <label className="block">
          Next sequence
          <input
            className="block border p-2"
            type="number"
            min="1"
            max="999999999"
            step="1"
            value={value.currentSequence}
            onChange={(e) =>
              setDraft({ ...value, currentSequence: Number(e.target.value) })
            }
          />
        </label>
        <p className="break-all">
          Illustrative preview: {preview}. LEVEL is supplied by the selected
          enrollment class. Not reserved.
        </p>
        <label className="block">
          Confirm next sequence
          <input
            className="block border p-2"
            required
            inputMode="numeric"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        {value.expectedVersion !== data.version && (
          <p role="alert">
            Policy changed. Discard and review the latest version.
          </p>
        )}
        <button
          className="rounded border px-3 py-2"
          disabled={
            pending ||
            data.sessionYear === null ||
            value.expectedVersion !== data.version
          }
        >
          Save prospective policy
        </button>{" "}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setDraft(null);
            setConfirmation("");
          }}
        >
          Discard / load latest
        </button>
      </form>
      <p role="status">{message}</p>
    </main>
  );
}
