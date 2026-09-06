"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  const requestChoice = useMutation(
    api.functions.academic.commercial.requestContractChoice,
  );
  const [message, setMessage] = useState("");
  const data = useQuery(
    api.functions.academic.commercial.getCommercialWorkspace,
    schoolId && allowed ? { schoolId } : "skip",
  );
  const group = useQuery(
    api.functions.academic.commercial.getGroupCommercialSummary,
    data?.commercialGroupId ? { groupId: data.commercialGroupId } : "skip",
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
      {data.canRequestContract && (
        <section className="space-y-2">
          <h2 className="font-semibold">Request a configured catalog option</h2>
          <p>
            This records a proprietor request only. It creates no contract,
            entitlement, invoice or payment.
          </p>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await requestChoice({
                  schoolId: schoolId!,
                  rateVersionId: String(
                    form.get("rateVersionId"),
                  ) as Id<"commercialRateVersions">,
                  requestedCadence:
                    form.get("cadence") === "annually" ? "annually" : "termly",
                  requestedStart: Date.parse(String(form.get("start"))),
                  reason: String(form.get("reason")),
                  confirmation: String(form.get("confirmation")),
                });
                setMessage(
                  "Request recorded; no commercial activation occurred.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Request failed; values retained.",
                );
              }
            }}
          >
            <label>
              Published option
              <select
                className="block w-full border p-2"
                name="rateVersionId"
                required
              >
                <option value="">Select</option>
                {data.rates.map((rate) => (
                  <option key={rate._id} value={rate._id}>
                    {rate.name} v{rate.version} · {rate.rate.cadence}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cadence
              <select className="block w-full border p-2" name="cadence">
                <option value="termly">Termly</option>
                <option value="annually">Annual upfront</option>
              </select>
            </label>
            <label>
              Requested UTC start
              <input
                className="block w-full border p-2"
                name="start"
                type="date"
                required
              />
            </label>
            <label>
              Reason
              <input
                className="block w-full border p-2"
                name="reason"
                minLength={8}
                maxLength={240}
                required
              />
            </label>
            <label>
              Type REQUEST
              <input
                className="block w-full border p-2"
                name="confirmation"
                pattern="REQUEST"
                required
              />
            </label>
            <button className="border p-2">Record request</button>
          </form>
          <p role="status">{message}</p>
          {data.choices.map((choice) => (
            <p key={choice._id}>
              Requested{" "}
              {new Date(choice.requestedStart).toISOString().slice(0, 10)} ·{" "}
              {choice.requestedCadence} · pending Platform contract review.
            </p>
          ))}
        </section>
      )}
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
        {data.invoices.map((i) => {
          const correction = data.corrections
            .filter((row) => row.invoiceId === i._id)
            .reduce((sum, row) => sum + row.amountMinor, 0);
          return (
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
              <p>
                Append-only corrections {correction} minor units; effective
                recorded amount {i.totalMinor + correction}. Corrections do not
                move money.
              </p>
            </article>
          );
        })}
        <p>
          Billable policy: explicitly active, nonarchived students with
          same-school nonarchived student users, unique by user. Unclassified,
          departed, archived and duplicate records excluded. Snapshot reflects
          issuance time, not historical attendance.
        </p>
      </section>
      {data.commercialGroupId && !group && (
        <p role="status">Loading authorized group subscription totals…</p>
      )}
      {group && (
        <section>
          <h2 className="font-semibold">
            Authorized group subscription totals
          </h2>
          <p>{group.basis}</p>
          {Object.entries(group.currencies).map(([currency, total]) => (
            <p key={currency}>
              {currency}: original {total.originalMinor}; corrections{" "}
              {total.correctionsMinor}; effective {total.effectiveMinor} minor
              units across {total.invoiceCount} invoices.
            </p>
          ))}
        </section>
      )}
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
