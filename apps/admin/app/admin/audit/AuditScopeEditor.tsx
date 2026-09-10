"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getErrorMessage } from "@school/shared/toast";

export function AuditScopeEditor({
  schoolId,
  modules,
}: {
  schoolId: Id<"schools">;
  modules: string[];
}) {
  const members = useQuery(
    api.functions.academic.audit.getAuditScopeConfiguration,
    { schoolId },
  );
  const save = useMutation(api.functions.academic.audit.setAuditModuleScope);
  const [target, setTarget] = useState<{
    id: Id<"branchMemberships">;
    revision: number;
    name: string;
  }>();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <details className="rounded-xl border bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        Proprietor: configure delegated audit visibility
      </summary>
      <p className="my-3 text-sm text-slate-600">
        A member also needs audit-view capability. Choosing modules here never
        grants that capability. Clearing every module revokes delegated audit
        visibility.
      </p>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!target || !confirmed) return;
          setPending(true);
          setMessage("");
          try {
            await save({
              schoolId,
              targetMembershipId: target.id,
              expectedRevision: target.revision,
              modules: selected,
              reason,
            });
            setMessage(
              "Audit scope saved. Reselect the member before another change.",
            );
            setConfirmed(false);
            setTarget(undefined);
          } catch (error) {
            setMessage(getErrorMessage(error));
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="space-y-4">
          <label className="block text-sm font-medium">
            Audit reader
            <select
              required
              className="mt-1 w-full rounded-lg border p-3"
              value={target?.id ?? ""}
              onChange={(e) => {
                const member = members?.find(
                  (m) => m.membershipId === e.target.value,
                );
                setTarget(
                  member
                    ? {
                        id: member.membershipId,
                        revision: member.revision,
                        name: member.name,
                      }
                    : undefined,
                );
                setSelected(member?.modules ?? []);
                setConfirmed(false);
              }}
            >
              <option value="">
                {members ? "Select a branch member" : "Loading members…"}
              </option>
              {members?.map((m) => (
                <option key={m.membershipId} value={m.membershipId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Visible audit modules
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {modules.map((module) => (
                <label key={module} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(module)}
                    onChange={(e) => {
                      setSelected(
                        e.target.checked
                          ? [...selected, module]
                          : selected.filter((m) => m !== module),
                      );
                      setConfirmed(false);
                    }}
                  />
                  {module}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium">
            Scope review reason
            <input
              required
              minLength={8}
              maxLength={240}
              className="mt-1 w-full rounded-lg border p-3"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Confirm {selected.length} visible modules for{" "}
              {target?.name ?? "the selected member"}.
            </span>
          </label>
        </fieldset>
        <button
          disabled={
            pending || !target || !confirmed || reason.trim().length < 8
          }
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Confirm audit scope"}
        </button>
        {message && (
          <p role="status" className="break-words text-sm">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
