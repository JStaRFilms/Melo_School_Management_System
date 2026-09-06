"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";

type Frequency = "continuous" | "session" | "calendar";
type Status = "active" | "paused";
type PolicyDraft = {
  pattern: string;
  schoolCode: string;
  campusCode: string;
  currentSequence: number;
  expectedVersion: number;
  expectedCounterVersion: number;
  resetFrequency: Frequency;
  counterStatus: Status;
};
type SequenceDraft = {
  key: string;
  name: string;
  level: string;
  currentSequence: number;
  resetFrequency: Frequency;
  status: Status;
  expectedConfigVersion: number;
};

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
  const savePolicy = useMutation(
    api.functions.academic.admissionNumbers.updateAdmissionNumberPolicy,
  );
  const configureSequence = useMutation(
    api.functions.academic.admissionNumbers.configureAdmissionNumberSequence,
  );
  const archiveSequence = useMutation(
    api.functions.academic.admissionNumbers.archiveAdmissionNumberSequence,
  );
  const setDefaultSequence = useMutation(
    api.functions.academic.admissionNumbers.setDefaultAdmissionNumberSequence,
  );
  const publishGroupFormat = useMutation(
    api.functions.academic.admissionNumbers.publishGroupAdmissionNumberFormat,
  );
  const setFormatInheritance = useMutation(
    api.functions.academic.admissionNumbers.setAdmissionNumberFormatInheritance,
  );
  const [draft, setDraft] = useState<PolicyDraft | null>(null);
  const [sequenceDraft, setSequenceDraft] = useState<SequenceDraft | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState("");
  const [groupConfirmation, setGroupConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  if (allowed === false)
    return <p role="alert">Numbering settings access denied.</p>;
  if (!data || !schoolId) return <p>Loading numbering policy…</p>;

  const value: PolicyDraft = draft ?? {
    pattern: data.policy?.pattern ?? "{SCHOOL}-{YEAR}-{SEQ:4}",
    schoolCode: data.policy?.schoolCode ?? "",
    campusCode: data.policy?.campusCode ?? "",
    currentSequence: data.branchCounter?.nextSequence ?? 1,
    expectedVersion: data.version,
    expectedCounterVersion: data.branchCounter?.configVersion ?? 0,
    resetFrequency: data.branchCounter?.resetFrequency ?? "continuous",
    counterStatus: data.branchCounter?.status ?? "active",
  };
  const preview = value.pattern
    .replaceAll("{SCHOOL}", value.schoolCode)
    .replaceAll("{CAMPUS}", value.campusCode)
    .replaceAll("{LEVEL}", "LEVEL")
    .replaceAll("{YEAR}", String(data.sessionYear ?? "unavailable"))
    .replace(/\{SEQ:([1-9])\}/g, (_, width: string) =>
      String(value.currentSequence).padStart(Number(width), "0"),
    );
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setPending(true);
    setMessage("");
    try {
      await operation();
      setDraft(null);
      setSequenceDraft(null);
      setConfirmation("");
      setGroupConfirmation("");
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Save failed; retry.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-xl font-semibold">Admission numbering</h1>
      <p>
        Every counter belongs to this branch. Level counters take precedence;
        otherwise the selected branch default applies. Group inheritance can
        change only the format, never merge branch counters. Existing IDs never
        change and gaps may occur.
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
        className="space-y-3 rounded border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              savePolicy({
                schoolId,
                ...value,
                confirmedNextSequence: Number(confirmation),
              }),
            "Policy saved for new enrollments only.",
          );
        }}
      >
        <h2 className="font-semibold">Branch format and default counter</h2>
        {(["schoolCode", "campusCode", "pattern"] as const).map((field) => (
          <label className="block" key={field}>
            {field}
            <input
              className="block w-full rounded border p-2"
              required
              value={value[field]}
              onChange={(event) =>
                setDraft({ ...value, [field]: event.target.value })
              }
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
          Default counter status
          <select
            className="block border p-2"
            value={value.counterStatus}
            onChange={(event) =>
              setDraft({
                ...value,
                counterStatus: event.target.value as Status,
              })
            }
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </label>
        <label className="block">
          Reset
          <select
            className="block border p-2"
            value={value.resetFrequency}
            onChange={(event) =>
              setDraft({
                ...value,
                resetFrequency: event.target.value as Frequency,
              })
            }
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
            onChange={(event) =>
              setDraft({
                ...value,
                currentSequence: Number(event.target.value),
              })
            }
          />
        </label>
        <p className="break-all">
          Effective format ({data.formatSource},{" "}
          {data.formatVersion ?? "not configured"}):{" "}
          {data.effectiveFormat ?? value.pattern}. Illustrative preview:{" "}
          {preview}. LEVEL comes from the selected class. Nothing is reserved
          here.
        </p>
        <label className="block">
          Confirm next sequence
          <input
            className="block border p-2"
            required
            inputMode="numeric"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        {(value.expectedVersion !== data.version ||
          value.expectedCounterVersion !==
            (data.branchCounter?.configVersion ?? 0)) && (
          <p role="alert">
            Policy or counter changed. Discard and review latest.
          </p>
        )}
        <button
          className="rounded border px-3 py-2"
          disabled={pending || data.sessionYear === null}
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

      <section className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Named branch and level sequences</h2>
        <p className="text-sm">
          A sequence without a level can become the branch default. One active
          or paused sequence may target each normalized level.
        </p>
        <ul className="space-y-2">
          {data.sequences.map((sequence) => (
            <li
              className="flex flex-wrap items-center gap-2"
              key={sequence.key}
            >
              <span>
                {sequence.name} · {sequence.key}
                {sequence.level
                  ? ` · level ${sequence.level}`
                  : " · branch"} · {sequence.status} · next{" "}
                {sequence.currentSequence} · config {sequence.configVersion}
              </span>
              <button
                type="button"
                className="underline"
                onClick={() =>
                  setSequenceDraft({
                    key: sequence.key,
                    name: sequence.name,
                    level: sequence.level ?? "",
                    currentSequence: sequence.currentSequence,
                    resetFrequency: sequence.resetFrequency,
                    status: sequence.status === "paused" ? "paused" : "active",
                    expectedConfigVersion: sequence.configVersion,
                  })
                }
              >
                Edit
              </button>
              {!sequence.level && (
                <button
                  type="button"
                  className="underline"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () =>
                        setDefaultSequence({
                          schoolId,
                          key: sequence.key,
                          expectedPolicyVersion: data.version,
                        }),
                      `Default sequence set to ${sequence.name}.`,
                    )
                  }
                >
                  Set branch default
                </button>
              )}
              <button
                type="button"
                className="underline"
                disabled={pending}
                onClick={() =>
                  void run(
                    () =>
                      archiveSequence({
                        schoolId,
                        key: sequence.key,
                        expectedConfigVersion: sequence.configVersion,
                      }),
                    `Sequence ${sequence.name} archived; old IDs unchanged.`,
                  )
                }
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              void run(
                () =>
                  setDefaultSequence({
                    schoolId,
                    key: null,
                    expectedPolicyVersion: data.version,
                  }),
                "Legacy branch counter selected as default.",
              )
            }
          >
            Use legacy branch counter as default
          </button>
          <button
            type="button"
            onClick={() =>
              setSequenceDraft({
                key: "",
                name: "",
                level: "",
                currentSequence: 1,
                resetFrequency: "continuous",
                status: "active",
                expectedConfigVersion: 0,
              })
            }
          >
            Add named sequence
          </button>
        </div>
        {sequenceDraft && (
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(
                () =>
                  configureSequence({
                    schoolId,
                    ...sequenceDraft,
                    level: sequenceDraft.level || undefined,
                    confirmedNextSequence: Number(confirmation),
                  }),
                `Sequence ${sequenceDraft.name} saved.`,
              );
            }}
          >
            {(["key", "name", "level"] as const).map((field) => (
              <label key={field}>
                {field}
                <input
                  className="block w-full border p-2"
                  required={field !== "level"}
                  value={sequenceDraft[field]}
                  readOnly={
                    field === "key" && sequenceDraft.expectedConfigVersion > 0
                  }
                  onChange={(event) =>
                    setSequenceDraft({
                      ...sequenceDraft,
                      [field]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
            <label>
              Status
              <select
                className="block border p-2"
                value={sequenceDraft.status}
                onChange={(event) =>
                  setSequenceDraft({
                    ...sequenceDraft,
                    status: event.target.value as Status,
                  })
                }
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <label>
              Reset
              <select
                className="block border p-2"
                value={sequenceDraft.resetFrequency}
                onChange={(event) =>
                  setSequenceDraft({
                    ...sequenceDraft,
                    resetFrequency: event.target.value as Frequency,
                  })
                }
              >
                <option value="continuous">Continuous</option>
                <option value="session">Academic session</option>
                <option value="calendar">Calendar year (UTC)</option>
              </select>
            </label>
            <label>
              Next sequence
              <input
                className="block border p-2"
                type="number"
                min="1"
                step="1"
                value={sequenceDraft.currentSequence}
                onChange={(event) =>
                  setSequenceDraft({
                    ...sequenceDraft,
                    currentSequence: Number(event.target.value),
                  })
                }
              />
            </label>
            <p className="sm:col-span-2">
              Enter the same value in “Confirm next sequence” above before
              saving.
            </p>
            <button className="border p-2" disabled={pending}>
              Save named sequence
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSequenceDraft(null)}
            >
              Cancel
            </button>
          </form>
        )}
      </section>

      {data.governance?.groupId && (
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Group format governance</h2>
          <p>
            Mode {data.governance.mode}; group version{" "}
            {data.governance.groupVersion}; branch revision{" "}
            {data.governance.branchRevision}. Only the pattern is inherited.
            Codes and every sequence remain branch-owned.
          </p>
          <label className="block">
            Confirmation slug
            <input
              className="block border p-2"
              value={groupConfirmation}
              onChange={(event) => setGroupConfirmation(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="border p-2"
              disabled={pending || !data.governance.groupSlug}
              onClick={() =>
                void run(
                  () =>
                    publishGroupFormat({
                      schoolId,
                      groupId: data.governance!.groupId!,
                      expectedGroupVersion: data.governance!.groupVersion,
                      allowBranchOverride: true,
                      confirmation: groupConfirmation,
                    }),
                  "Group format published from this branch; counters unchanged.",
                )
              }
            >
              Publish local format as group default
            </button>
            {(["inherit", "override"] as const).map((mode) => (
              <button
                type="button"
                className="border p-2"
                key={mode}
                disabled={pending || !data.governance?.branchSlug}
                onClick={() =>
                  void run(
                    () =>
                      setFormatInheritance({
                        schoolId,
                        groupId: data.governance!.groupId!,
                        mode,
                        expectedGroupVersion: data.governance!.groupVersion,
                        expectedRevision: data.governance!.branchRevision,
                        confirmation: groupConfirmation,
                      }),
                    `Branch format set to ${mode}; counters unchanged.`,
                  )
                }
              >
                Use {mode === "inherit" ? "group format" : "local format"}
              </button>
            ))}
          </div>
          <p className="text-xs">
            Publishing requires the group slug (
            {data.governance.groupSlug ?? "unavailable"}); branch choice
            requires the branch slug (
            {data.governance.branchSlug ?? "unavailable"}).
          </p>
        </section>
      )}
      <p role="status">{message}</p>
    </main>
  );
}
