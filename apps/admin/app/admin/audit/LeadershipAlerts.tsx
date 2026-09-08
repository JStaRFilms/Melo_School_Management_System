"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getErrorMessage } from "@school/shared/toast";

export function LeadershipAlerts({
  schoolId,
  compact = false,
}: {
  schoolId: Id<"schools">;
  compact?: boolean;
}) {
  const alerts = useQuery(api.functions.academic.audit.listAuditAlerts, {
    schoolId,
  });
  const dismiss = useMutation(api.functions.academic.audit.dismissAuditAlert);
  const [pending, setPending] = useState<Id<"auditAlerts">>();
  const [error, setError] = useState("");
  if (compact)
    return alerts?.length ? (
      <Link
        href="/admin/audit"
        className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
      >
        {alerts.length} recent leadership alert{alerts.length === 1 ? "" : "s"}{" "}
        — review audit history
      </Link>
    ) : null;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Leadership alerts</h2>
      <p className="text-sm text-slate-600">
        Recent addressed in-app alerts, up to 20. Acknowledgement is shared
        leadership status and is audited; it does not edit the event. No email
        or SMS delivery is implied.
      </p>
      {alerts === undefined ? (
        <p role="status">Loading addressed alerts…</p>
      ) : !alerts.length ? (
        <p className="text-sm">
          No addressed alerts in the recent window. The explorer retains the
          full event history.
        </p>
      ) : (
        <ul className="divide-y">
          {alerts.map((alert) => (
            <li key={alert._id} className="space-y-2 py-3">
              <h3 className="font-semibold">{alert.title}</h3>
              <p className="whitespace-pre-wrap break-words text-sm">
                {alert.message}
              </p>
              <button
                disabled={Boolean(pending)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                onClick={async () => {
                  setPending(alert._id);
                  setError("");
                  try {
                    await dismiss({ schoolId, alertDocId: alert._id });
                  } catch (e) {
                    setError(getErrorMessage(e));
                  } finally {
                    setPending(undefined);
                  }
                }}
              >
                {pending === alert._id ? "Acknowledging…" : "Acknowledge alert"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
