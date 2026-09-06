"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
import { getErrorMessage } from "@school/shared/toast";

const rbac = api.functions.academic.rbac;
const input =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm focus:ring-2 focus:ring-school-primary";
const button =
  "rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
type Workspace = FunctionReturnType<typeof rbac.getPermissionWorkspace>;
type Configuration = FunctionReturnType<
  typeof rbac.getMemberPermissionConfiguration
>;

export default function PermissionsPage() {
  const { workspaceAccess } = useAuth();
  // U1a's ready summary contains a server-validated schools ID; no local branch activation.
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "staff.permissions.manage" } : "skip",
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/admin" className="underline">
          Administration
        </Link>
        <Link href="/admin/group" className="underline">
          School group
        </Link>
        <Link href="/admin/audit" className="underline">
          Audit
        </Link>
      </nav>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Access governance
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Staff permissions</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Combine templates, add exceptions and preview effective access.
          Display titles never grant authority. Changes apply only to this
          branch.
        </p>
      </header>
      {allowed === undefined ? (
        <p role="status">Checking permission-management access…</p>
      ) : !allowed ? (
        <section role="alert" className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Permission denied</h2>
          <p className="mt-2 text-sm">
            The proprietor must explicitly delegate permission management and a
            management ceiling. An administrator title alone is not sufficient.
          </p>
        </section>
      ) : (
        schoolId && <PermissionWorkspace schoolId={schoolId} />
      )}
    </main>
  );
}

function PermissionWorkspace({ schoolId }: { schoolId: Id<"schools"> }) {
  const workspace = useQuery(rbac.getPermissionWorkspace, { schoolId });
  const [memberId, setMemberId] = useState<Id<"branchMemberships">>();
  const [tab, setTab] = useState<"members" | "templates">("members");
  const config = useQuery(
    rbac.getMemberPermissionConfiguration,
    memberId ? { schoolId, membershipId: memberId } : "skip",
  );
  if (!workspace) return <p role="status">Loading members and templates…</p>;
  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Permission sections">
        <button
          className={
            tab === "members" ? button : "rounded-lg border px-4 py-2 text-sm"
          }
          onClick={() => setTab("members")}
        >
          Member access
        </button>
        <button
          className={
            tab === "templates" ? button : "rounded-lg border px-4 py-2 text-sm"
          }
          onClick={() => setTab("templates")}
        >
          Template library
        </button>
      </div>
      {tab === "members" ? (
        <>
          <label className="block max-w-xl text-sm font-medium">
            Staff member
            <select
              className={input}
              value={memberId ?? ""}
              onChange={(e) =>
                setMemberId(
                  workspace.members.find(
                    (m) => m.membershipId === e.target.value,
                  )?.membershipId,
                )
              }
            >
              <option value="">Select a canonical branch member</option>
              {workspace.members.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.name}
                  {m.displayTitle ? ` — ${m.displayTitle}` : ""}
                  {m.isSelf ? " (you · read only)" : ""}
                </option>
              ))}
            </select>
          </label>
          {workspace.members.length === 0 && (
            <p className="rounded-xl border bg-white p-5 text-sm">
              No canonical active members. Identity reconciliation is a separate
              reviewed process; no roles will be seeded automatically.
            </p>
          )}
          {memberId &&
            (!config ? (
              <p role="status">Loading access configuration…</p>
            ) : (
              <MemberEditor
                key={`${memberId}`}
                schoolId={schoolId}
                memberId={memberId}
                name={
                  workspace.members.find((m) => m.membershipId === memberId)
                    ?.name ?? "Selected member"
                }
                workspace={workspace}
                initial={config}
                currentRevision={config.revision}
              />
            ))}
        </>
      ) : (
        <TemplateLibrary schoolId={schoolId} workspace={workspace} />
      )}
    </>
  );
}

function CapabilityChecklist({
  catalog,
  selected,
  onChange,
  disabled = false,
  legend,
}: {
  catalog: string[];
  selected: string[];
  onChange: (caps: string[]) => void;
  disabled?: boolean;
  legend: string;
}) {
  const domains = [...new Set(catalog.map((c) => c.split(".")[0]))];
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-3 font-semibold">
        {legend}{" "}
        <span className="text-xs font-normal text-slate-500">
          ({selected.length})
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {domains.map((domain) => (
          <details
            key={domain}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
          >
            <summary className="cursor-pointer text-sm font-semibold capitalize">
              {domain}{" "}
              <span className="font-normal text-slate-500">
                {selected.filter((c) => c.startsWith(`${domain}.`)).length}{" "}
                selected
              </span>
            </summary>
            <div className="mt-3 space-y-3">
              {catalog
                .filter((c) => c.startsWith(`${domain}.`))
                .map((cap) => (
                  <label key={cap} className="flex items-start gap-2 text-xs">
                    <input
                      className="mt-0.5 h-4 w-4 shrink-0"
                      type="checkbox"
                      checked={selected.includes(cap)}
                      onChange={(e) =>
                        onChange(
                          e.target.checked
                            ? [...selected, cap]
                            : selected.filter((c) => c !== cap),
                        )
                      }
                    />
                    <span className="min-w-0 break-words">{cap}</span>
                  </label>
                ))}
            </div>
          </details>
        ))}
      </div>
    </fieldset>
  );
}

function MemberEditor({
  schoolId,
  memberId,
  name,
  workspace,
  initial,
  currentRevision,
}: {
  schoolId: Id<"schools">;
  memberId: Id<"branchMemberships">;
  name: string;
  workspace: Workspace;
  initial: Configuration;
  currentRevision: number;
}) {
  const [draft, setDraft] = useState(initial);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(false);
  const save = useMutation(rbac.saveMemberPermissions);
  const saveCeiling = useMutation(rbac.setDelegationCeiling);
  const preview = useQuery(rbac.previewEffectiveCapabilities, {
    schoolId,
    membershipId: memberId,
    candidateRoleTemplateIds: draft.roleTemplateIds,
    candidateDirectGrants: draft.grants,
    candidateDirectRestrictions: draft.restrictions,
  });
  const stale = currentRevision !== draft.revision;
  const locked = pending || !initial.editable || stale;
  const change = (values: Partial<Configuration>) => {
    setDraft((d) => ({ ...d, ...values }));
    setConfirmed(false);
    setMessage("");
  };
  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{name}</h2>
        <button
          className="text-sm underline"
          disabled={pending}
          onClick={() => {
            setDraft(initial);
            setConfirmed(false);
            setReason("");
            setMessage("");
          }}
        >
          Reload / discard local changes
        </button>
      </div>
      {!initial.editable && (
        <p role="alert" className="text-sm">
          Protected or superior authority. Self-edit, proprietor and Platform
          identity changes are unavailable here.
        </p>
      )}
      {stale && (
        <p role="alert" className="text-sm">
          Access changed since this editor opened. Reload and review before
          saving.
        </p>
      )}
      {initial.legacyBaseline && (
        <p role="alert" className="text-sm text-amber-800">
          This account still uses the legacy principal baseline. Saving this
          form—even for a display-title-only change or with no templates—retires
          that baseline permanently. The resulting access is exactly the
          effective preview; an empty preview means no gated workspace access.
        </p>
      )}
      <label className="block max-w-xl text-sm font-medium">
        Display title (cosmetic)
        <input
          className={input}
          disabled={locked}
          maxLength={100}
          value={draft.displayTitle}
          onChange={(e) => change({ displayTitle: e.target.value })}
        />
      </label>
      <fieldset disabled={locked}>
        <legend className="mb-2 font-semibold">Assigned templates</legend>
        {workspace.templates.length === 0 && (
          <p className="text-sm text-slate-600">
            No persisted templates. Review the seven factory definitions in
            Template library and create an explicit branch version if
            authorized.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {workspace.templates
            .filter((t) => t.code !== "proprietor")
            .map((t) => (
              <label
                key={t._id}
                className="flex items-start gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={draft.roleTemplateIds.includes(t._id)}
                  onChange={(e) =>
                    change({
                      roleTemplateIds: e.target.checked
                        ? [...draft.roleTemplateIds, t._id]
                        : draft.roleTemplateIds.filter((id) => id !== t._id),
                    })
                  }
                />
                <span>
                  {t.name}
                  <span className="block text-xs text-slate-500">
                    {t.scope} · {t.capabilities.length} permissions
                  </span>
                </span>
              </label>
            ))}
        </div>
      </fieldset>
      <CapabilityChecklist
        catalog={workspace.catalog}
        selected={draft.grants}
        onChange={(grants) =>
          change({
            grants,
            restrictions: draft.restrictions.filter((c) => !grants.includes(c)),
          })
        }
        disabled={locked}
        legend="Direct grants"
      />
      <CapabilityChecklist
        catalog={workspace.catalog}
        selected={draft.restrictions}
        onChange={(restrictions) =>
          change({
            restrictions,
            grants: draft.grants.filter((c) => !restrictions.includes(c)),
          })
        }
        disabled={locked}
        legend="Direct restrictions"
      />
      <div className="rounded-lg border bg-slate-50 p-4">
        <h3 className="font-semibold">Effective access preview</h3>
        {preview === undefined ? (
          <p role="status">Recalculating…</p>
        ) : (
          <>
            <p className="mt-1 text-sm">
              {preview.length} effective capabilities after templates + grants −
              restrictions.
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm underline">
                Inspect exact capabilities
              </summary>
              <ul className="mt-3 grid gap-1 text-xs sm:grid-cols-2">
                {preview.map((c) => (
                  <li className="break-words" key={c}>
                    {c}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </div>
      {workspace.canConfigureTemplates && (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-semibold">
            Proprietor: management ceiling
          </summary>
          <p className="my-3 text-sm text-slate-600">
            Possessing a permission does not make it delegable. This ceiling
            never permits delegation of permission-manager authority itself.
          </p>
          <CapabilityChecklist
            catalog={workspace.catalog.filter(
              (c) => c !== "staff.permissions.manage",
            )}
            selected={draft.ceiling}
            onChange={(ceiling) => change({ ceiling })}
            disabled={locked}
            legend="Delegable capabilities"
          />
          <button
            disabled={locked || !confirmed || reason.trim().length < 8}
            className={`${button} mt-4`}
            onClick={async () => {
              setPending(true);
              setFailure(false);
              try {
                await saveCeiling({
                  schoolId,
                  targetMembershipId: memberId,
                  allowedCapabilities: draft.ceiling,
                  expectedRevision: draft.revision,
                  reason,
                });
                setMessage(
                  "Ceiling saved. Reload the configuration before further edits.",
                );
              } catch (e) {
                setFailure(true);
                setMessage(getErrorMessage(e));
              } finally {
                setPending(false);
                setConfirmed(false);
              }
            }}
          >
            Confirm ceiling only
          </button>
        </details>
      )}
      <div className="space-y-3 border-t pt-4">
        <label className="block text-sm font-medium">
          Review reason
          <input
            disabled={locked}
            className={input}
            minLength={8}
            maxLength={240}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setConfirmed(false);
            }}
            placeholder="Brief purpose; do not include secrets or private records"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            disabled={locked || preview === undefined}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I reviewed the target <strong>{name}</strong>, effective preview and
            reason.
            {initial.legacyBaseline && (
              <> I understand this save permanently retires legacy access.</>
            )}
          </span>
        </label>
        <p className="text-xs text-slate-500">
          Clearing a grant, restriction or assignment removes it on save. All
          changes are audited. Permission-manager authority remains
          proprietor-controlled.
        </p>
        {message && (
          <p
            role={failure ? "alert" : "status"}
            className="break-words text-sm"
          >
            {message}
          </p>
        )}
        <button
          disabled={
            locked ||
            !confirmed ||
            reason.trim().length < 8 ||
            preview === undefined
          }
          className={button}
          onClick={async () => {
            setPending(true);
            setFailure(false);
            try {
              await save({
                schoolId,
                targetMembershipId: memberId,
                expectedRevision: draft.revision,
                displayTitle: draft.displayTitle,
                roleTemplateIds: draft.roleTemplateIds,
                grants: draft.grants,
                restrictions: draft.restrictions,
                reason,
              });
              setMessage(
                "Permissions saved. Reload to review the current configuration.",
              );
            } catch (e) {
              setFailure(true);
              setMessage(getErrorMessage(e));
            } finally {
              setPending(false);
              setConfirmed(false);
            }
          }}
        >
          {pending ? "Saving…" : "Confirm access changes"}
        </button>
      </div>
    </section>
  );
}

function TemplateLibrary({
  schoolId,
  workspace,
}: {
  schoolId: Id<"schools">;
  workspace: Workspace;
}) {
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const create = useMutation(rbac.createRoleTemplateVersion);
  return (
    <section className="space-y-5">
      <p className="text-sm text-slate-600">
        Seven approved starting templates. Proprietor is ownership authority,
        not an assignable operational template. Factory definitions are
        read-only; a configured version is a new branch template and does not
        change anyone’s existing assignments.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspace.factoryTemplates.map((t) => (
          <article className="rounded-xl border bg-white p-4" key={t.code}>
            <h2 className="font-semibold">{t.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{t.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {t.capabilities.length} canonical capabilities
            </p>
            {workspace.canConfigureTemplates && t.code !== "proprietor" && (
              <button
                className="mt-3 text-sm underline"
                disabled={pending}
                onClick={() => {
                  setName(`${t.name} — branch version`);
                  setCapabilities(t.capabilities);
                }}
              >
                Use as starting point
              </button>
            )}
          </article>
        ))}
      </div>
      {workspace.canConfigureTemplates ? (
        <form
          className="space-y-4 rounded-xl border bg-white p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            try {
              await create({ schoolId, name, capabilities, reason });
              setMessage(
                "New template version saved. Assign it explicitly in Member access.",
              );
              setReason("");
            } catch (error) {
              setMessage(getErrorMessage(error));
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-lg font-semibold">
            Configure a branch template version
          </h2>
          <label className="block text-sm font-medium">
            Version name
            <input
              required
              disabled={pending}
              className={input}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <CapabilityChecklist
            catalog={workspace.catalog}
            selected={capabilities}
            onChange={setCapabilities}
            disabled={pending}
            legend="Template capabilities"
          />
          <label className="block text-sm font-medium">
            Review reason
            <input
              required
              disabled={pending}
              className={input}
              minLength={8}
              maxLength={240}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="text-sm">
            Confirm creation of <strong>{name || "unnamed template"}</strong>{" "}
            with {capabilities.length} capabilities. No member access changes
            until explicit assignment.
          </p>
          <button disabled={pending} className={button}>
            {pending ? "Saving…" : "Confirm new version"}
          </button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </form>
      ) : (
        <p className="rounded-lg border p-4 text-sm">
          Template configuration is restricted to the proprietor. Your
          delegation ceiling does not authorize bulk template editing.
        </p>
      )}
    </section>
  );
}
