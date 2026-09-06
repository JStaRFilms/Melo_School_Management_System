"use client";
import type { GradingBandDraft } from "@/types";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../../../packages/convex/_generated/dataModel";

export function GradeGovernance({
  schoolId,
  dirty,
  onChanged,
}: {
  schoolId: Id<"schools">;
  dirty: boolean;
  onChanged: (bands: GradingBandDraft[]) => void;
}) {
  const governance = useQuery(
    api.functions.academic.gradingBands.getPolicyGovernance,
    { schoolId },
  );
  const setMode = useMutation(
    api.functions.academic.gradingBands.setGradingInheritance,
  );
  const publish = useMutation(
    api.functions.academic.gradingBands.publishGroupGradingDefault,
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [allowOverride, setAllowOverride] = useState(true);
  if (!governance) return null;
  const change = async (mode: "inherit" | "override") => {
    setPending(true);
    setError("");
    try {
      const bands = await setMode({ schoolId, mode });
      onChanged(bands);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to change policy source",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="border-b bg-white p-4 text-sm space-y-2">
      <p>
        {governance.groupName}:{" "}
        <strong>
          {governance.mode === "inherit"
            ? `Inherited policy v${governance.defaultVersion}`
            : "Branch policy"}
        </strong>
        . Group linkage alone does not change grading.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={
            dirty ||
            pending ||
            governance.defaultVersion === null ||
            governance.mode === "inherit"
          }
          onClick={() => void change("inherit")}
          className="rounded border p-2 disabled:opacity-40"
        >
          Use group default
        </button>
        <button
          disabled={
            dirty ||
            pending ||
            !governance.allowBranchOverride ||
            governance.mode === "override"
          }
          onClick={() => void change("override")}
          className="rounded border p-2 disabled:opacity-40"
        >
          Use branch override
        </button>
      </div>
      {dirty && <p>Save or discard edits before changing policy source.</p>}
      {governance.canPublish && (
        <details>
          <summary className="cursor-pointer">
            Publish this saved branch policy as group default
          </summary>
          <p className="mt-2">
            Only explicitly inheriting branches adopt this version. Existing
            issued snapshots remain unchanged.
          </p>
          <label className="block">
            <input
              type="checkbox"
              checked={allowOverride}
              onChange={(e) => setAllowOverride(e.target.checked)}
            />{" "}
            Permit branch overrides
          </label>
          <label className="block">
            Confirm group slug: {governance.groupSlug}
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mx-2 max-w-full rounded border p-2"
            />
          </label>
          <button
            disabled={dirty || pending || confirmation !== governance.groupSlug}
            className="rounded border p-2 disabled:opacity-40"
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await publish({
                  schoolId,
                  groupId: governance.groupId,
                  allowBranchOverride: allowOverride,
                  confirmation,
                });
                setConfirmation("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to publish default",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Confirm group default
          </button>
        </details>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
