"use client";
import Link from "next/link";
import { UsageCosts } from "./UsageCosts";
import { EntitlementControls } from "./EntitlementControls";
import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../../packages/convex/_generated/api";
import type { Id } from "../../../../packages/convex/_generated/dataModel";
import {
  APPROVED_CORE_BASIC_RATE,
  type CommercialRate,
} from "../../../../packages/convex/functions/foundation/commercialContract";
import { useAuth } from "../../lib/AuthProvider";
import { isConvexConfigured } from "@/convex-runtime";

const commercial = api.functions.academic.commercial;
const input = "block w-full rounded border border-slate-300 p-2";
function Field({
  name,
  label,
  value,
  type = "text",
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className={input}
        name={name}
        type={type}
        defaultValue={value}
        pattern={name === "confirmation" ? "CONFIRM" : undefined}
        required
      />
    </label>
  );
}
function RateFields() {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend>Explicit rate (integer minor units; NGN uses kobo)</legend>
      <Field name="currency" label="Currency" value="NGN" />
      <Field
        name="perStudentMinor"
        label="Per active student"
        value={APPROVED_CORE_BASIC_RATE.perStudentMinor}
        type="number"
      />
      <Field
        name="setupMinor"
        label="One-time setup"
        value={APPROVED_CORE_BASIC_RATE.setupMinor}
        type="number"
      />
      <Field
        name="minimumMinor"
        label="Recurring minimum"
        value={0}
        type="number"
      />
      <Field
        name="discountBps"
        label="Discount basis points (0 means none)"
        value={0}
        type="number"
      />
      <label>
        Cadence
        <select className={input} name="cadence">
          <option value="termly">Termly</option>
          <option value="annually">Annually</option>
        </select>
      </label>
      <label>
        Proration
        <select className={input} name="proration">
          <option value="none">None — full period only</option>
          <option value="daily">Daily — covered UTC days</option>
        </select>
      </label>
      <label>
        Volume bands: one threshold:rate per line
        <textarea className={input} name="bands" placeholder="No bands" />
      </label>
    </fieldset>
  );
}
function readRate(form: FormData): CommercialRate {
  const bands = String(form.get("bands") ?? "").trim();
  return {
    currency: String(form.get("currency")),
    perStudentMinor: Number(form.get("perStudentMinor")),
    setupMinor: Number(form.get("setupMinor")),
    minimumMinor: Number(form.get("minimumMinor")),
    discountBps: Number(form.get("discountBps")),
    cadence: form.get("cadence") === "annually" ? "annually" : "termly",
    proration: form.get("proration") === "daily" ? "daily" : "none",
    bands: bands
      ? bands.split("\n").map((line) => {
          const parts = line.split(":");
          if (parts.length !== 2) throw new Error("Bands use threshold:rate");
          return {
            fromStudents: Number(parts[0]),
            perStudentMinor: Number(parts[1]),
          };
        })
      : [],
  };
}
export default function CommercialPage() {
  const auth = useAuth();
  if (!isConvexConfigured())
    return (
      <p className="p-6">
        Commercial records require a configured development backend.
      </p>
    );
  if (auth.isLoading) return <p role="status">Checking Platform access…</p>;
  if (!auth.isPlatformAdmin)
    return (
      <p role="alert">Permission denied: active Platform authority required.</p>
    );
  return <Workbench />;
}
function Workbench() {
  const schools = usePaginatedQuery(
    api.functions.academic.groups.listLinkableSchools,
    {},
    { initialNumItems: 25 },
  );
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const [rateId, setRateId] = useState<Id<"commercialRateVersions">>();
  const [contractId, setContractId] = useState<Id<"commercialContracts">>();
  const [override, setOverride] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const data = useQuery(
    commercial.getCommercialWorkspace,
    schoolId ? { schoolId } : "skip",
  );
  const publish = useMutation(commercial.publishRateVersion);
  const contract = useMutation(commercial.createContract);
  const issue = useMutation(commercial.issueSubscriptionInvoice);
  const correct = useMutation(commercial.appendInvoiceCorrection);
  async function save(work: () => Promise<unknown>) {
    setPending(true);
    setMessage("");
    try {
      await work();
      setMessage("Recorded. No payment initiated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Save failed. Values retained; review and retry.",
      );
    } finally {
      setPending(false);
    }
  }
  const selectedRate = data?.rates.find((r) => r._id === rateId);
  const selectedContract = data?.contracts.find((c) => c._id === contractId);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <nav className="flex gap-4">
        <Link href="/schools">Schools</Link>
        <Link href="/audit">Audit</Link>
      </nav>
      <h1 className="text-2xl font-semibold">
        Commercial catalog and contracts
      </h1>
      <p>
        Append-only prices, contracts and subscription invoices. Nothing here
        charges a card, activates entitlements or changes school fee invoices.
        Direct school collections remain separate.
      </p>
      <label>
        School / catalog audit journal
        <select
          className={input}
          value={schoolId ?? ""}
          onChange={(e) => {
            setSchoolId(
              schools.results.find((s) => s.schoolId === e.target.value)
                ?.schoolId,
            );
            setRateId(undefined);
            setContractId(undefined);
          }}
        >
          <option value="">Select school</option>
          {schools.results.map((s) => (
            <option key={s.schoolId} value={s.schoolId}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {schools.status === "CanLoadMore" && (
        <button onClick={() => schools.loadMore(25)}>More schools</button>
      )}
      {schoolId && <UsageCosts schoolId={schoolId} />}
      {schoolId && !data && <p role="status">Loading commercial records…</p>}
      <p role="status">{message}</p>
      {schoolId && data && (
        <>
          <p>
            {data.gates.reason} Merchant connection:{" "}
            {data.gates.merchantConnection}. Recurring mandate:{" "}
            {data.gates.recurringMandate}.
          </p>
          {!data.mandates.length && <p>No recorded mandate.</p>}
          {data.mandates.map((m) => (
            <p key={m.id}>
              Historical mandate: {m.recordedStatus}; consent{" "}
              {m.consentRecorded ? "recorded" : "not recorded"}. Activation
              unavailable; this record is not provider authorization proof.
            </p>
          ))}
          <button disabled>
            Purchase / split / recurring activation unavailable
          </button>
          {data.truncated && (
            <p role="alert">
              Recent 100 records only. This is not a complete history or group
              total.
            </p>
          )}
          <EntitlementControls schoolId={schoolId} contractIds={data.contracts.map(row => row._id)} />
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Versioned catalog</h2>
            {!data.rates.length && (
              <p>
                No catalog configured. The form contains only the approved Core
                / Basic anchor; review before publishing.
              </p>
            )}
            {data.rates.map((r) => (
              <p key={r._id}>
                {r.name} v{r.version} · {r.rate.currency}{" "}
                {r.rate.perStudentMinor} minor/student/{r.rate.cadence} ·
                effective {new Date(r.effectiveFrom).toISOString().slice(0, 10)}
              </p>
            ))}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save(() =>
                  publish({
                    journalSchoolId: schoolId,
                    confirmation: String(f.get("confirmation")),
                    code: String(f.get("code")),
                    name: String(f.get("name")),
                    expectedVersion: Math.max(
                      0,
                      ...data.rates
                        .filter((r) => r.code === f.get("code"))
                        .map((r) => r.version),
                    ),
                    effectiveFrom: Date.parse(String(f.get("effectiveFrom"))),
                    rate: readRate(f),
                  }),
                );
              }}
            >
              <Field name="code" label="Catalog code" value="core_basic" />
              <Field name="name" label="Name" value="Core / Basic" />
              <Field
                name="effectiveFrom"
                label="Effective UTC date"
                type="date"
              />
              <RateFields />
              <p>
                Highest matching band applies to the whole roster. Minimum, then
                daily proration, then explicit discount; setup is not discounted
                or prorated. No tax or collection fee is added.
              </p>
              <Field
                name="confirmation"
                label="Type CONFIRM to publish an immutable version"
              />
              <button disabled={pending}>Publish new version</button>
            </form>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">School contracts</h2>
            {!data.contracts.length && (
              <p>
                No versioned contract.{" "}
                {data.legacy &&
                  "Legacy subscription exists without an immutable snapshot; review required."}
              </p>
            )}
            {data.contracts.map((c) => (
              <p key={c._id}>
                {c.code} v{c.version} · {c.state} · {c.rate.currency} ·{" "}
                {c.rate.cadence} · setup {c.setupHandling}
              </p>
            ))}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!rateId) return;
                const f = new FormData(e.currentTarget);
                const handling = f.get("setupHandling");
                void save(() =>
                  contract({
                    schoolId,
                    rateVersionId: rateId,
                    ...(f.get("choiceRequestId")
                      ? {
                          choiceRequestId: String(
                            f.get("choiceRequestId"),
                          ) as Id<"commercialContractChoices">,
                        }
                      : {}),
                    confirmation: String(f.get("confirmation")),
                    effectiveFrom: Date.parse(String(f.get("start"))),
                    effectiveTo: Date.parse(String(f.get("end"))),
                    setupHandling:
                      handling === "waived"
                        ? "waived"
                        : handling === "previously_paid"
                          ? "previously_paid"
                          : "charge_once",
                    setupReason: String(f.get("setupReason")),
                    ...(override
                      ? {
                          overrideRate: readRate(f),
                          overrideReason: String(f.get("overrideReason")),
                        }
                      : {}),
                  }),
                );
              }}
            >
              <label>
                Rate version
                <select
                  className={input}
                  value={rateId ?? ""}
                  onChange={(e) =>
                    setRateId(
                      data.rates.find((r) => r._id === e.target.value)?._id,
                    )
                  }
                  required
                >
                  <option value="">Select version</option>
                  {data.rates.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.code} v{r.version}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Proprietor choice request (optional)
                <select className={input} name="choiceRequestId">
                  <option value="">No linked request</option>
                  {data.choices.map((choice) => (
                    <option key={choice._id} value={choice._id}>
                      {choice.requestedCadence} ·{" "}
                      {new Date(choice.requestedStart)
                        .toISOString()
                        .slice(0, 10)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRate && (
                <pre className="overflow-auto text-xs">
                  {JSON.stringify(selectedRate.rate, null, 2)}
                </pre>
              )}
              <Field name="start" label="Contract start (UTC)" type="date" />
              <Field
                name="end"
                label="Contract end (UTC, exclusive)"
                type="date"
              />
              <label>
                Setup handling
                <select className={input} name="setupHandling">
                  <option value="charge_once">
                    Charge once on first eligible invoice
                  </option>
                  <option value="previously_paid">
                    Previously paid — reviewed evidence
                  </option>
                  <option value="waived">Explicit waiver</option>
                </select>
              </label>
              <Field
                name="setupReason"
                label="Setup handling reason / evidence reference (no sensitive data)"
              />
              <label>
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                />{" "}
                Explicit contract rate override
              </label>
              {override && (
                <>
                  <RateFields />
                  <Field name="overrideReason" label="Override reason" />
                </>
              )}
              <Field
                name="confirmation"
                label="Type CONFIRM after reviewing the contract"
              />
              <button disabled={pending || !rateId}>Record contract</button>
            </form>
          </section>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Subscription invoices — not school collections
            </h2>
            <p>
              Snapshot now: explicitly active, nonarchived students with active
              same-school student users, deduplicated by user. Graduated,
              withdrawn, transferred, archived, unclassified and duplicate
              records excluded. Over 500 roster rows blocks issuance. No
              retroactive enrollment reconstruction or individual mid-period
              proration.
            </p>
            {!data.invoices.length && <p>No subscription invoices issued.</p>}
            {data.invoices.map((i) => (
              <div className="space-y-2 border-b pb-3" key={i._id}>
                <p>
                  {i.periodLabel}: {i.rate.currency} {i.totalMinor} minor ·{" "}
                  {i.studentCount} billable / {i.excludedCount} excluded ·{" "}
                  {i.status} · setup {i.setupMinor} · discount {i.discountMinor}{" "}
                  · proration {i.prorationNumerator}/{i.prorationDenominator}
                </p>
                <form
                  className="grid gap-2 sm:grid-cols-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const kind = String(form.get("kind"));
                    void save(() =>
                      correct({
                        schoolId,
                        invoiceId: i._id,
                        idempotencyKey: String(form.get("idempotencyKey")),
                        kind:
                          kind === "credit"
                            ? "credit"
                            : kind === "debit"
                              ? "debit"
                              : kind === "void"
                                ? "void"
                                : "note",
                        amountMinor: Number(form.get("amountMinor")),
                        reason: String(form.get("reason")),
                        confirmation: String(form.get("confirmation")),
                      }),
                    );
                  }}
                >
                  <label>
                    Correction type
                    <select className={input} name="kind">
                      <option value="note">Note</option>
                      <option value="credit">Credit (negative)</option>
                      <option value="debit">Debit (positive)</option>
                      <option value="void">
                        Void (negative original total)
                      </option>
                    </select>
                  </label>
                  <Field
                    name="amountMinor"
                    label="Signed minor amount"
                    type="number"
                  />
                  <Field
                    name="idempotencyKey"
                    label="Unique correction reference"
                  />
                  <Field name="reason" label="Correction reason" />
                  <Field name="confirmation" label="Type CONFIRM" />
                  <button disabled={pending}>Append correction</button>
                </form>
              </div>
            ))}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!contractId) return;
                const f = new FormData(e.currentTarget);
                void save(() =>
                  issue({
                    schoolId,
                    contractId,
                    confirmation: String(f.get("confirmation")),
                    expectedStudentCount: Number(f.get("expectedStudentCount")),
                    expectedTotalMinor: Number(f.get("expectedTotalMinor")),
                    periodLabel: String(f.get("periodLabel")),
                    periodStart: Date.parse(String(f.get("start"))),
                    periodEnd: Date.parse(String(f.get("end"))),
                  }),
                );
              }}
            >
              <label>
                Contract
                <select
                  className={input}
                  value={contractId ?? ""}
                  onChange={(e) =>
                    setContractId(
                      data.contracts.find((c) => c._id === e.target.value)?._id,
                    )
                  }
                  required
                >
                  <option value="">Select current contract</option>
                  {data.contracts
                    .filter((c) => c.state === "current")
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.code} v{c.version}
                      </option>
                    ))}
                </select>
              </label>
              {selectedContract && (
                <p>
                  Cadence: {selectedContract.rate.cadence}; proration:{" "}
                  {selectedContract.rate.proration}; setup:{" "}
                  {selectedContract.setupHandling}. Issued amounts cannot be
                  edited.
                </p>
              )}
              <p>
                Current preview:{" "}
                {data.rosterPreview
                  ? `${data.rosterPreview.studentCount} billable, ${data.rosterPreview.excludedCount} excluded`
                  : "Roster exceeds local preview bound; issuance unavailable"}
                . Review amounts using the pinned rate above. Enter the reviewed
                total; a mismatch fails without issuing.
              </p>
              <Field
                name="expectedStudentCount"
                label="Reviewed billable student count"
                type="number"
              />
              <Field
                name="expectedTotalMinor"
                label="Reviewed total (integer minor units, including setup if due)"
                type="number"
              />
              <Field
                name="periodLabel"
                label="Explicit term or annual period label"
              />
              <Field name="start" label="Period start (UTC)" type="date" />
              <Field
                name="end"
                label="Period end (UTC, exclusive)"
                type="date"
              />
              <Field
                name="confirmation"
                label="Type CONFIRM to issue an unpaid invoice (no charge)"
              />
              <button disabled={pending || !contractId}>
                Issue snapshot invoice
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}
