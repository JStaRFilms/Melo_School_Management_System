"use client";

import { Component, useState, type ReactNode } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";

const endpoints = api.functions.academic.groups;
type GroupBrandingData = FunctionReturnType<typeof endpoints.getGroupBranding>;

export default function GroupBranding({
  groupId,
  branches,
}: {
  groupId: Id<"schoolGroups">;
  branches: { schoolId: Id<"schools">; name: string }[];
}) {
  const data = useQuery(endpoints.getGroupBranding, { groupId });
  const memberships = useQuery(endpoints.listUserBranches, {});
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const permitted = branches.filter((branch) =>
    memberships?.some((member) => member.schoolId === branch.schoolId),
  );
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Shared branding defaults</h2>
      {!data ? (
        <p role="status">Loading group branding…</p>
      ) : (
        <DefaultEditor key={groupId} data={data} />
      )}
      <label className="block text-sm">
        Branch branding (explicit membership required)
        <select
          className="mt-2 w-full rounded border p-2"
          value={schoolId ?? ""}
          onChange={(event) =>
            setSchoolId(
              permitted.find((branch) => branch.schoolId === event.target.value)
                ?.schoolId,
            )
          }
        >
          <option value="">Select an authorized branch</option>
          {permitted.map((branch) => (
            <option key={branch.schoolId} value={branch.schoolId}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>
      {memberships && permitted.length === 0 && (
        <p>
          No explicit active branch memberships. Group ownership does not permit
          branch overrides.
        </p>
      )}
      {schoolId && (
        <BranchBoundary key={schoolId}>
          <BranchEditor groupId={groupId} schoolId={schoolId} />
        </BranchBoundary>
      )}
      <details className="text-sm">
        <summary>Other shared domains — not yet adopted</summary>
        <p className="mt-2">
          Grading bands/colors, role templates, admission templates, report-card
          templates, notifications, academic policies and calendar templates
          remain with their domain editors. No inheritance or calendar date
          changes are enabled for these domains. Issued reports, invoices and
          admission numbers are never rewritten by this editor.
        </p>
      </details>
    </section>
  );
}

export function BranchBrandingEditor({
  groupId,
  schoolId,
}: {
  groupId: Id<"schoolGroups">;
  schoolId: Id<"schools">;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Branch branding</h2>
      <p className="text-sm text-slate-600">
        Choose whether this branch inherits the school-group colors or uses an
        approved branch override.
      </p>
      <BranchBoundary>
        <BranchEditor groupId={groupId} schoolId={schoolId} />
      </BranchBoundary>
    </section>
  );
}

class BranchBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="space-y-2 text-sm">
        <p>
          Branch branding access is denied or unavailable. Explicit membership
          and branding capability are required; group ownership alone is not
          enough.
        </p>
        <button
          className="underline"
          onClick={() => this.setState({ failed: false })}
        >
          Retry branch access
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function DefaultEditor({ data }: { data: GroupBrandingData }) {
  const convex = useConvex();
  const save = useMutation(endpoints.saveGroupBranding);
  const [draftVersion, setDraftVersion] = useState(data.version);
  const [primaryColor, setPrimary] = useState(
    data.defaults?.theme.primaryColor ?? "#0f172a",
  );
  const [accentColor, setAccent] = useState(
    data.defaults?.theme.accentColor ?? "#2563eb",
  );
  const [allowBranchOverride, setAllow] = useState(
    data.defaults?.allowBranchOverride ?? true,
  );
  const [preview, setPreview] =
    useState<FunctionReturnType<typeof endpoints.previewGroupBranding>>();
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const args = {
    groupId: data.groupId,
    expectedVersion: draftVersion,
    theme: { primaryColor, accentColor },
    allowBranchOverride,
  };
  const review = async () => {
    setPending(true);
    setMessage("");
    try {
      setPreview(await convex.query(endpoints.previewGroupBranding, args));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Preview failed; retry",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="space-y-3 text-sm">
      <p>
        Source: {data.defaults ? "group default" : "not configured"} · Current
        version {data.version} · Editing version {draftVersion}
      </p>
      {data.version !== draftVersion && (
        <p role="alert">
          A newer version is available. Your edits are retained but cannot
          overwrite it.{" "}
          <button
            className="underline"
            onClick={() => {
              setDraftVersion(data.version);
              setPrimary(data.defaults?.theme.primaryColor ?? "#0f172a");
              setAccent(data.defaults?.theme.accentColor ?? "#2563eb");
              setAllow(data.defaults?.allowBranchOverride ?? true);
              setPreview(undefined);
              setConfirmation("");
            }}
          >
            Discard edits and load latest
          </button>
        </p>
      )}
      <fieldset disabled={pending || Boolean(preview)} className="space-y-3">
        <label className="block">
          Primary hex
          <input
            className="ml-2 max-w-full rounded border p-2"
            value={primaryColor}
            onChange={(e) => setPrimary(e.target.value)}
          />
        </label>
        <label className="block">
          Accent hex
          <input
            className="ml-2 max-w-full rounded border p-2"
            value={accentColor}
            onChange={(e) => setAccent(e.target.value)}
          />
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={allowBranchOverride}
            onChange={(e) => setAllow(e.target.checked)}
          />
          Allow branch branding overrides (preserves existing branch colors)
        </label>
      </fieldset>
      {!preview ? (
        <button
          disabled={pending}
          className="rounded border px-3 py-2"
          onClick={review}
        >
          Preview change
        </button>
      ) : (
        <div className="space-y-3 border-t pt-3">
          <p>{preview.warning}</p>
          <p>
            Proposed version {preview.candidate.version}:{" "}
            {preview.candidate.theme.primaryColor} /{" "}
            {preview.candidate.theme.accentColor}; overrides{" "}
            {allowBranchOverride ? "allowed" : "disabled"}.
          </p>
          <label className="block">
            Confirm group slug: {data.slug}
            <input
              className="mt-1 w-full rounded border p-2"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={pending || confirmation !== data.slug}
              className="rounded border px-3 py-2"
              onClick={async () => {
                setPending(true);
                setMessage("");
                try {
                  const version = await save({ ...args, confirmation });
                  setDraftVersion(version);
                  setPreview(undefined);
                  setConfirmation("");
                  setMessage("Group branding saved");
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Save failed; retry",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              Confirm default
            </button>
            <button
              disabled={pending}
              className="underline"
              onClick={() => {
                setPreview(undefined);
                setConfirmation("");
              }}
            >
              Back to edit
            </button>
          </div>
        </div>
      )}
      {pending && <p role="status">Checking and saving…</p>}
      {message && (
        <p role="status" className="break-words">
          {message}
        </p>
      )}
    </div>
  );
}

function BranchEditor({
  groupId,
  schoolId,
}: {
  groupId: Id<"schoolGroups">;
  schoolId: Id<"schools">;
}) {
  const data = useQuery(endpoints.getBranchBranding, { groupId, schoolId });
  return data ? (
    <BranchForm data={data} groupId={groupId} schoolId={schoolId} />
  ) : (
    <p role="status">Checking branch branding authority…</p>
  );
}

function BranchForm({
  data,
  groupId,
  schoolId,
}: {
  data: FunctionReturnType<typeof endpoints.getBranchBranding>;
  groupId: Id<"schoolGroups">;
  schoolId: Id<"schools">;
}) {
  const save = useMutation(endpoints.saveBranchBranding);
  const [draft, setDraft] = useState(data);
  const [mode, setMode] = useState<"inherit" | "override">("inherit");
  const [primaryColor, setPrimary] = useState(data.theme.primaryColor);
  const [accentColor, setAccent] = useState(data.theme.accentColor);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-3 border-t pt-3 text-sm">
      <p>
        Effective source: {data.source} · Group version {data.groupVersion} ·
        Branch revision {data.revision} · Stored mode: {data.mode}
      </p>
      <p>
        Current colors: {data.theme.primaryColor} / {data.theme.accentColor}
      </p>
      {(draft.groupVersion !== data.groupVersion ||
        draft.revision !== data.revision) && (
        <p role="alert">
          Configuration changed. Your edits are retained.{" "}
          <button
            className="underline"
            onClick={() => {
              setDraft(data);
              setPrimary(data.theme.primaryColor);
              setAccent(data.theme.accentColor);
              setMode("inherit");
              setConfirmation("");
            }}
          >
            Discard branch edits and load latest
          </button>
        </p>
      )}
      <fieldset
        disabled={pending || data.groupVersion === 0}
        className="space-y-3"
      >
        <label className="block">
          Proposed behavior
          <select
            className="mt-1 w-full rounded border p-2"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value === "override" ? "override" : "inherit")
            }
          >
            <option value="inherit">
              Reset to group default / inherit future versions
            </option>
            <option value="override" disabled={!data.allowBranchOverride}>
              Explicit branch override
            </option>
          </select>
        </label>
        {mode === "override" && (
          <>
            <label className="block">
              Branch primary hex
              <input
                className="mt-1 w-full rounded border p-2"
                value={primaryColor}
                onChange={(e) => setPrimary(e.target.value)}
              />
            </label>
            <label className="block">
              Branch accent hex
              <input
                className="mt-1 w-full rounded border p-2"
                value={accentColor}
                onChange={(e) => setAccent(e.target.value)}
              />
            </label>
          </>
        )}
        <p>
          Review:{" "}
          {mode === "inherit"
            ? `Use group version ${draft.groupVersion}: ${draft.defaultTheme?.primaryColor ?? "not configured"} / ${draft.defaultTheme?.accentColor ?? "not configured"}; local override is removed.`
            : `Use ${primaryColor} / ${accentColor} while overrides are allowed.`}{" "}
          Historical issued documents are unchanged.
        </p>
        <label className="block">
          Confirm branch slug: {data.slug}
          <input
            className="mt-1 w-full rounded border p-2"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          className="rounded border px-3 py-2"
          disabled={confirmation !== data.slug}
          onClick={async () => {
            setPending(true);
            setMessage("");
            try {
              const revision = await save({
                groupId,
                schoolId,
                expectedVersion: draft.groupVersion,
                expectedRevision: draft.revision,
                confirmation,
                change:
                  mode === "inherit"
                    ? { mode }
                    : { mode, theme: { primaryColor, accentColor } },
              });
              setDraft({ ...draft, revision });
              setConfirmation("");
              setMessage("Branch branding saved");
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Save failed; retry",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          Confirm branch change
        </button>
      </fieldset>
      {message && (
        <p role="status" className="break-words">
          {message}
        </p>
      )}
    </div>
  );
}
