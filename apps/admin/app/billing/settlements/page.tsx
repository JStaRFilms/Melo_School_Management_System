"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
export default function SettlementsPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "finance.settlements.view" } : "skip",
  );
  const rows = useQuery(
    api.functions.academic.commercial.getSettlementLedger,
    schoolId && allowed ? { schoolId, limit: 100 } : "skip",
  );
  if (allowed === false) return <p role="alert">Settlement access denied.</p>;
  if (!rows) return <p role="status">Loading collection settlements…</p>;
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-4">
      <nav className="flex flex-wrap gap-4">
        <Link href="/billing">School fee invoices</Link>
        <Link href="/billing/subscription">Melo subscription</Link>
      </nav>
      <h1 className="text-xl font-semibold">School collection settlements</h1>
      <p>
        Read-only recent 100 records, not a complete balance. School-owned
        merchant collection is separate from SaaS and usage billing. Connection
        unverified; split and recurring activation unavailable. A ledger row is
        not proof of merchant connection or funds received.
      </p>
      {!rows.length && (
        <p>
          No settlement records. No settlement date or provider fee can be
          estimated.
        </p>
      )}
      {rows.map((row) => (
        <article className="space-y-2 border-b pb-4" key={row._id}>
          <h2>{row.transactionRef}</h2>
          <p>
            {row.routingMode === "mode_a_direct"
              ? "School-owned merchant"
              : "Historical split record — new activation unavailable"}{" "}
            · {row.status} · {row.currency}
          </p>
          <dl className="grid grid-cols-2 gap-2">
            <dt>Gross (minor units)</dt>
            <dd>{row.grossAmountKobo}</dd>
            <dt>Provider fee</dt>
            <dd>{row.paystackFeeKobo}</dd>
            <dt>Melo collection fee</dt>
            <dd>{row.platformFeeKobo}</dd>
            <dt>Recorded net payout</dt>
            <dd>{row.netPayoutKobo}</dd>
            {(["refund", "dispute", "adjustment"] as const).map((kind) => (
              <div key={kind}>
                <dt>{kind} legs (signed minor units)</dt>
                <dd>
                  {row.legs
                    .filter((leg) => leg.kind === kind)
                    .map((leg) => (
                      <p key={leg._id}>
                        {leg.amountMinor} · {leg.evidenceReference}
                      </p>
                    ))}
                  {!row.legs.some((leg) => leg.kind === kind) &&
                    "Not recorded separately"}
                </dd>
              </div>
            ))}
          </dl>
          {row.clearingCycle === "provider_reported" &&
          row.providerSettlementReference &&
          row.providerClearingCycle ? (
            <p>
              Recorded provider evidence: {row.providerSettlementReference};
              cycle {row.providerClearingCycle}. Estimate:{" "}
              {row.estimatedSettlementDate
                ? new Date(row.estimatedSettlementDate).toISOString()
                : "Unavailable"}
              . Not a guarantee.
            </p>
          ) : (
            <p>
              Verified clearing evidence unavailable. Historical timing labels
              are not a settlement promise.
            </p>
          )}
        </article>
      ))}
    </main>
  );
}
