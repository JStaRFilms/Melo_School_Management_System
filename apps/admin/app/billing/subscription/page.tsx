"use client";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
import { useAuth } from "@/AuthProvider";
export default function SubscriptionPage() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "finance.reports.view" } : "skip",
  );
  const data = useQuery(
    api.functions.academic.commercial.getCommercialWorkspace,
    schoolId && allowed ? { schoolId } : "skip",
  );
  if (allowed === false) return <p role="alert">Subscription access denied.</p>;
  if (!data) return <p role="status">Loading subscription…</p>;
  const money = (value: number, currency: string) =>
    `${currency} ${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4">
      <nav className="flex flex-wrap gap-4">
        <Link href="/billing">School fee invoices</Link>
        <Link href="/billing/settlements">Collection settlements</Link>
      </nav>
      <h1 className="text-xl font-semibold">Melo SaaS subscription</h1>
      <p>
        Separate from school fees and usage top-ups. Catalog and contract
        changes do not change issued invoice snapshots. No automatic payment or
        entitlement activation.
      </p>
      <section>
        <h2 className="font-semibold">Contracts</h2>
        {!data.contracts.length && (
          <p>
            No versioned contract configured. Contact your commercial
            administrator.
          </p>
        )}
        {data.legacy && (
          <p>
            Legacy subscription: {data.legacy.status}. Historical price snapshot
            unavailable; current catalog is not substituted.
          </p>
        )}
        {data.contracts.map((c) => (
          <article className="my-3 border-b pb-3" key={c._id}>
            <h3>
              {c.code} v{c.version} — {c.state}
            </h3>
            <p>
              {new Date(c.effectiveFrom).toISOString().slice(0, 10)} to{" "}
              {new Date(c.effectiveTo).toISOString().slice(0, 10)} (end
              exclusive)
            </p>
            <p>
              {c.rate.currency} {c.rate.perStudentMinor} minor units / active
              student / {c.rate.cadence}; minimum {c.rate.minimumMinor};
              discount {c.rate.discountBps} bps; proration {c.rate.proration};
              setup {c.rate.setupMinor} ({c.setupHandling}).
            </p>
            {c.rate.bands.map((b) => (
              <p key={b.fromStudents}>
                From {b.fromStudents} students: {b.perStudentMinor} minor units
                per student (whole-roster band).
              </p>
            ))}
            {c.overrideReason && <p>Override: {c.overrideReason}</p>}
          </article>
        ))}
      </section>
      <section>
        <h2 className="font-semibold">Issued subscription invoices</h2>
        {!data.invoices.length && <p>No subscription invoices issued.</p>}
        {data.invoices.map((i) => (
          <article className="my-3 border-b pb-3" key={i._id}>
            <h3>
              {i.periodLabel} — {i.status}
            </h3>
            <p>
              {i.rate.currency === "NGN"
                ? money(i.totalMinor, i.rate.currency)
                : `${i.rate.currency} ${i.totalMinor} minor units`}{" "}
              · SaaS only
            </p>
            <p>
              {i.studentCount} billable; {i.excludedCount} excluded. Snapshot
              taken {new Date(i.createdAt).toISOString()}. Proration{" "}
              {i.prorationNumerator}/{i.prorationDenominator}.
            </p>
            <p>
              Recurring {i.proratedMinor}, discount −{i.discountMinor}, setup{" "}
              {i.setupMinor} (minor units). No additional fee added.
            </p>
          </article>
        ))}
        <p>
          Billable policy: explicitly active, nonarchived students with
          same-school nonarchived student users, unique by user. Unclassified,
          departed, archived and duplicate records excluded. Snapshot reflects
          issuance time, not historical attendance.
        </p>
      </section>
      {data.truncated && (
        <p role="alert">
          Recent 100 records only; no complete or group total is shown.
        </p>
      )}
      <section>
        <h2 className="font-semibold">Usage top-ups</h2>
        <p>
          Separate charge class. No purchase or allowance is inferred from this
          subscription. Usage purchase activation is unavailable pending
          approved entitlement and provider gates.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">Payment and mandate status</h2>
        <p>
          Merchant connection: {data.gates.merchantConnection}. Recurring
          mandate: {data.gates.recurringMandate}. {data.gates.reason}
        </p>
        {!data.mandates.length && <p>No recorded mandate.</p>}
        {data.mandates.map((m) => (
          <p key={m.id}>
            Historical mandate: {m.recordedStatus}; consent{" "}
            {m.consentRecorded ? "recorded" : "not recorded"}. Activation
            unavailable; a stored status is not provider authorization proof.
          </p>
        ))}
        <button disabled>Purchase / enable recurring unavailable</button>
      </section>
      {!data.rates.length && <p>No versioned catalog published.</p>}
    </main>
  );
}
