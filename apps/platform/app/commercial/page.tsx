"use client";
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
const input =
  "block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-medium placeholder:text-slate-400";
const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors";
const secondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors";
const card = "bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6";
const sectionEyebrow =
  "flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1";
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
    <label className="block text-xs font-bold text-slate-700">
      <span className="mb-1 block">{label}</span>
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
      <legend className="text-xs font-bold text-slate-700 mb-2">
        Explicit rate (integer minor units; NGN uses kobo)
      </legend>
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
      <label className="block text-xs font-bold text-slate-700">
        <span className="mb-1 block">Cadence</span>
        <select className={input} name="cadence">
          <option value="termly">Termly</option>
          <option value="annually">Annually</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-700">
        <span className="mb-1 block">Proration</span>
        <select className={input} name="proration">
          <option value="none">None — full period only</option>
          <option value="daily">Daily — covered UTC days</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
        <span className="mb-1 block">Volume bands: one threshold:rate per line</span>
        <textarea className={input} name="bands" placeholder="No bands" rows={2} />
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
  const rateCatalog = usePaginatedQuery(
    commercial.listCommercialRateVersions,
    {},
    { initialNumItems: 100 },
  );
  const [schoolId, setSchoolId] = useState<Id<"schools">>();
  const contractCatalog = usePaginatedQuery(
    commercial.listCommercialContracts,
    schoolId ? { schoolId } : "skip",
    { initialNumItems: 100 },
  );
  const [catalogCode, setCatalogCode] = useState("core_basic");
  const [rateId, setRateId] = useState<Id<"commercialRateVersions">>();
  const [contractId, setContractId] = useState<Id<"commercialContracts">>();
  const [override, setOverride] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const data = useQuery(
    commercial.getCommercialWorkspace,
    schoolId ? { schoolId } : "skip",
  );
  const latestPublishedRate = useQuery(
    commercial.getLatestCommercialRateVersion,
    catalogCode.trim() ? { code: catalogCode.trim() } : "skip",
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
  const selectedRate = rateCatalog.results.find((r) => r._id === rateId);
  const selectedContract = contractCatalog.results.find((c) => c._id === contractId);
  type CommercialTab = "overview" | "prices" | "contracts" | "invoices" | "usage";
  const [tab, setTab] = useState<CommercialTab>("overview");
  const tabs: { id: CommercialTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "prices", label: "Prices", count: rateCatalog.results.length || undefined },
    { id: "contracts", label: "Contracts", count: data?.contracts.length || undefined },
    { id: "invoices", label: "Invoices", count: data?.invoices.length || undefined },
    { id: "usage", label: "Usage" },
  ];
  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <div className="min-w-0">
        <div className={sectionEyebrow}>
          <span>Platform Monetization</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance break-words leading-tight">
          Commercial catalog and contracts
        </h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl break-words">
          Prices, contracts and subscription invoices are saved as permanent records.
          Nothing here charges a card or changes what a school bills its own parents.
        </p>
      </div>

      <div className={`${card} min-w-0`}>
        <div className="text-xs font-bold text-slate-900">School workspace</div>
        <div className="text-[11px] text-slate-500 mt-0.5 mb-3 break-words">
          Pick a school to see its prices, contracts and invoices.
        </div>
        <select
          aria-label="School / catalog audit journal"
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
        {schools.status === "CanLoadMore" && (
          <button type="button" onClick={() => schools.loadMore(25)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">
            More schools
          </button>
        )}
      </div>

      {schoolId && !data && (
        <div className={card}>
          <p role="status" className="text-sm text-slate-500">Loading commercial records…</p>
        </div>
      )}
      {message && (
        <div className="p-4 rounded-xl border text-sm bg-slate-50 border-slate-200 text-slate-700" role="status">
          {message}
        </div>
      )}
      {schoolId && data && (
        <>
          {/* Tab bar — one job per tab */}
          <div role="tablist" aria-label="Commercial sections" className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                }`}
              >
                {t.label}
                {t.count !== undefined && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div role="tabpanel" hidden={tab !== "overview"} className="space-y-6 min-w-0">
          {/* At-a-glance summary — plain language, no jargon */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Contract</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900">
                {data.contracts.find((c) => c.state === "current")?.code ?? "No active contract"}
              </div>
              <div className="text-[11px] text-slate-500">
                {data.contracts.length} on record
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Invoices</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {data.invoices.length} issued
              </div>
              <div className="truncate text-[11px] text-slate-500">
                {data.invoices.length
                  ? `Latest: ${data.invoices[0].periodLabel}`
                  : "Nothing billed yet"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Billable pupils</div>
              <div className="mt-1 text-sm font-bold text-slate-900">
                {data.rosterPreview ? data.rosterPreview.studentCount : "Over limit"}
              </div>
              <div className="text-[11px] text-slate-500">
                {data.rosterPreview ? `${data.rosterPreview.excludedCount} excluded` : "Too many rows to preview"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payments</div>
              <div className="mt-1 truncate text-sm font-bold text-slate-900">
                {data.gates.merchantConnection}
              </div>
              <div className="text-[11px] text-slate-500">No card is ever charged here</div>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-xs text-indigo-950 break-words">
            <span className="font-bold">How this works: </span>
            Check the summary, then use the tabs above — one job per tab.
            Every save asks you to type CONFIRM first, and nothing here charges money.
          </div>

          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Payment readiness</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              Can this school take payments yet? Approvals and mandates, in plain words.
            </p>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-600 break-words">
              {data.gates.reason} Merchant connection:{" "}
              {data.gates.merchantConnection}. Recurring mandate:{" "}
              {data.gates.recurringMandate}.
            </p>
            {!data.mandates.length && (
              <p className="mt-2 text-sm text-slate-500">No recorded mandate.</p>
            )}
            <div className="mt-2 space-y-2">
              {data.mandates.map((m) => (
                <p key={m.id} className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                  Historical mandate: {m.recordedStatus}; consent{" "}
                  {m.consentRecorded ? "recorded" : "not recorded"}. Activation
                  unavailable; this record is not provider authorization proof.
                </p>
              ))}
            </div>
            <button disabled className={`${secondaryBtn} mt-3 opacity-60`}>
              Purchase / split / recurring activation unavailable
            </button>
            {data.truncated && (
              <p role="alert" className="mt-2 text-xs font-semibold text-amber-700 break-words">
                Showing the latest 100 records only — not the full history.
              </p>
            )}
            </div>
          </div>
          </div>

          <div role="tabpanel" hidden={tab !== "usage"} className="space-y-6 min-w-0">
          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Provider costs</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              What the school&apos;s AI and file usage costs us — not what we charge.
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3 min-w-0 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">
              <UsageCosts schoolId={schoolId} />
            </div>
          </div>

          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Storage & usage limits</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              How much AI, uploads and storage the school may use. Publishing limits grants nothing by itself.
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3 min-w-0 [&>section]:border-0 [&>section]:p-0 [&>section]:shadow-none">
              <EntitlementControls schoolId={schoolId} contractIds={data.contracts.map(row => row._id)} />
            </div>
          </div>
          </div>

          <div role="tabpanel" hidden={tab !== "prices"} className="space-y-6 min-w-0">
          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Price list</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              Saved prices. Publishing adds a new version — old ones are never edited.
            </p>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {!rateCatalog.results.length && (
              <p className="mt-2 text-sm text-slate-600">
                No catalog configured. The form contains only the approved Core
                / Basic anchor; review before publishing.
              </p>
            )}
            <div className="mt-3 space-y-2">
              {rateCatalog.results.map((r) => (
                <div key={r._id} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                  <span className="font-bold text-slate-900">{r.name} v{r.version}</span>
                  {" · "}{r.rate.currency}{" "}
                  {r.rate.perStudentMinor} minor/student/{r.rate.cadence} ·
                  effective {new Date(r.effectiveFrom).toISOString().slice(0, 10)}
                </div>
              ))}
            </div>
            {rateCatalog.status !== "Exhausted" && (
              <button
                type="button"
                disabled={rateCatalog.status !== "CanLoadMore"}
                onClick={() => rateCatalog.loadMore(100)}
                className={`${secondaryBtn} mt-3`}
              >
                {rateCatalog.status === "LoadingMore" ? "Loading rates…" : "Load more rate versions"}
              </button>
            )}
            <form
              className="mt-4 space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save(() =>
                  publish({
                    journalSchoolId: schoolId,
                    confirmation: String(f.get("confirmation")),
                    code: String(f.get("code")),
                    name: String(f.get("name")),
                    expectedVersion: latestPublishedRate?.version ?? 0,
                    effectiveFrom: Date.parse(String(f.get("effectiveFrom"))),
                    rate: readRate(f),
                  }),
                );
              }}
            >
              <label className="block text-xs font-bold text-slate-700">
                <span className="mb-1 block">Catalog code</span>
                <input
                  className={input}
                  name="code"
                  value={catalogCode}
                  onChange={(event) => setCatalogCode(event.target.value)}
                  required
                />
              </label>
              <Field name="name" label="Name" value="Core / Basic" />
              <Field
                name="effectiveFrom"
                label="Effective UTC date"
                type="date"
              />
              <RateFields />
              <p className="text-xs text-slate-500 leading-relaxed">
                Highest matching band applies to the whole roster. Minimum, then
                daily proration, then explicit discount; setup is not discounted
                or prorated. No tax or collection fee is added.
              </p>
              <Field
                name="confirmation"
                label="Type CONFIRM to publish an immutable version"
              />
              <button disabled={pending || latestPublishedRate === undefined} className={primaryBtn}>Publish new version</button>
            </form>
            </div>
          </div>
          </div>

          <div role="tabpanel" hidden={tab !== "contracts"} className="space-y-6 min-w-0">
          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Contracts</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              Which price a school agreed to, and for which dates.
            </p>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {!contractCatalog.results.length && (
              <p className="mt-2 text-sm text-slate-600">
                No versioned contract.{" "}
                {data.legacy &&
                  "Legacy subscription exists without an immutable snapshot; review required."}
              </p>
            )}
            <div className="mt-3 space-y-2">
            {contractCatalog.results.map((c) => (
              <div key={c._id} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                <span className="font-bold text-slate-900">{c.code} v{c.version}</span>
                {" · "}{c.state} · {c.rate.currency} ·{" "}
                {c.rate.cadence} · setup {c.setupHandling}
              </div>
            ))}
            </div>
            {contractCatalog.status !== "Exhausted" && (
              <button
                type="button"
                disabled={contractCatalog.status !== "CanLoadMore"}
                onClick={() => contractCatalog.loadMore(100)}
                className={`${secondaryBtn} mt-3`}
              >
                {contractCatalog.status === "LoadingMore" ? "Loading contracts…" : "Load more contracts"}
              </button>
            )}
            <form
              className="mt-4 space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-4"
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
              <label className="block text-xs font-bold text-slate-700">
                <span className="mb-1 block">Rate version</span>
                <select
                  className={input}
                  value={rateId ?? ""}
                  onChange={(e) =>
                    setRateId(
                      rateCatalog.results.find((r) => r._id === e.target.value)?._id,
                    )
                  }
                  required
                >
                  <option value="">Select version</option>
                  {rateCatalog.results.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.code} v{r.version}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-700">
                <span className="mb-1 block">Proprietor choice request (optional)</span>
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
                <pre className="overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {JSON.stringify(selectedRate.rate, null, 2)}
                </pre>
              )}
              <Field name="start" label="Contract start (UTC)" type="date" />
              <Field
                name="end"
                label="Contract end (UTC, exclusive)"
                type="date"
              />
              <label className="block text-xs font-bold text-slate-700">
                <span className="mb-1 block">Setup handling</span>
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
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={override}
                  onChange={(e) => setOverride(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
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
              <button disabled={pending || !rateId} className={primaryBtn}>Record contract</button>
            </form>
            </div>
          </div>
          </div>

          <div role="tabpanel" hidden={tab !== "invoices"} className="space-y-6 min-w-0">
          <div className={card}>
            <h2 className="text-base font-bold text-slate-900">Invoices</h2>
            <p className="mt-0.5 text-xs text-slate-500 break-words">
              Bills we recorded for the school. Issuing one never charges anyone.
            </p>
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500 leading-relaxed break-words">
              Counted right now: active pupils with an active login, one row per child.
              Leavers and duplicates are left out. Over 500 rows blocks issuing.
            </p>
            {!data.invoices.length && <p className="mt-2 text-sm text-slate-500">No subscription invoices issued.</p>}
            <div className="mt-3 space-y-3">
            {data.invoices.map((i) => {
              const corrections = data.corrections.filter((correction) => correction.invoiceId === i._id);
              const effectiveMinor = i.totalMinor + corrections.reduce((sum, correction) => sum + correction.amountMinor, 0);
              return <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2" key={i._id}>
                <p className="text-sm font-bold text-slate-900">
                  {i.periodLabel}: {i.rate.currency} {i.totalMinor} minor ·{" "}
                  {i.studentCount} billable / {i.excludedCount} excluded
                </p>
                <p className="text-xs text-slate-500">
                  {i.status} · setup {i.setupMinor} · discount {i.discountMinor}{" "}
                  · proration {i.prorationNumerator}/{i.prorationDenominator}
                </p>
                <p className="text-xs font-semibold text-slate-700">Effective balance: {i.rate.currency} {effectiveMinor} minor. Void amount: {-effectiveMinor}.</p>
                {!!corrections.length && <ul className="space-y-1 text-xs text-slate-600">{corrections.map((correction) => <li key={correction._id} className="rounded bg-white border border-slate-200 px-2 py-1">{correction.kind}: {correction.amountMinor} · {correction.reason}</li>)}</ul>}
                <form
                  className="grid gap-2 sm:grid-cols-3 rounded-lg bg-white border border-slate-200 p-3"
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
                  <label className="block text-xs font-bold text-slate-700">
                    <span className="mb-1 block">Correction type</span>
                    <select className={input} name="kind">
                      <option value="note">Note</option>
                      <option value="credit">Credit (negative)</option>
                      <option value="debit">Debit (positive)</option>
                      <option value="void">
                        Void (negative effective balance shown above)
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
                  <button disabled={pending} className={`${secondaryBtn} sm:col-span-3 w-full sm:w-auto`}>Append correction</button>
                </form>
              </div>;
            })}
            </div>
            <form
              className="mt-4 space-y-3 rounded-xl bg-slate-50 border border-slate-200 p-4"
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
              <div className="text-xs font-bold text-slate-900">Issue snapshot invoice</div>
              <label className="block text-xs font-bold text-slate-700">
                <span className="mb-1 block">Contract</span>
                <select
                  className={input}
                  value={contractId ?? ""}
                  onChange={(e) =>
                    setContractId(
                      contractCatalog.results.find((c) => c._id === e.target.value)?._id,
                    )
                  }
                  required
                >
                  <option value="">Select current contract</option>
                  {contractCatalog.results
                    .filter((c) => c.state === "current")
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.code} v{c.version}
                      </option>
                    ))}
                </select>
              </label>
              {selectedContract && (
                <p className="text-xs text-slate-500">
                  Cadence: {selectedContract.rate.cadence}; proration:{" "}
                  {selectedContract.rate.proration}; setup:{" "}
                  {selectedContract.setupHandling}. Issued amounts cannot be
                  edited.
                </p>
              )}
              <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
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
              <button disabled={pending || !contractId} className={primaryBtn}>
                Issue snapshot invoice
              </button>
            </form>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
