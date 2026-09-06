"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@/AuthProvider";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
const bank = api.functions.academic.bankAccounts;
const empty = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  currency: "NGN",
  label: "",
  branch: "",
  sortCode: "",
  iban: "",
  swift: "",
  transferNote: "",
};
export function BankAccountsPanel() {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const allowed = useQuery(
    api.functions.academic.rbac.hasViewerCapability,
    schoolId ? { schoolId, capability: "finance.bank_details.manage" } : "skip",
  );
  const accounts = useQuery(
    bank.listBankAccounts,
    schoolId && allowed ? { schoolId } : "skip",
  );
  const [selected, setSelected] = useState<Id<"schoolBankAccounts"> | null>(
    null,
  );
  const full = useQuery(
    bank.getBankAccount,
    schoolId && selected && allowed
      ? { schoolId, bankAccountId: selected }
      : "skip",
  );
  const [draft, setDraft] = useState<typeof empty | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [replacementId, setReplacement] = useState<
    Id<"schoolBankAccounts"> | undefined
  >();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const add = useMutation(bank.addBankAccount);
  const edit = useMutation(bank.editBankAccount);
  const archive = useMutation(bank.archiveBankAccount);
  const primary = useMutation(bank.setPrimaryBankAccount);
  if (allowed === false)
    return (
      <section>
        <h2>School bank accounts</h2>
        <p>Bank management access denied.</p>
      </section>
    );
  if (!accounts || !schoolId) return <p>Loading school bank accounts…</p>;
  const value =
    draft ??
    (full
      ? {
          bankName: full.bankName,
          accountName: full.accountName,
          accountNumber: full.accountNumber,
          currency: full.currency,
          label: full.label ?? "",
          branch: full.branch ?? "",
          sortCode: full.sortCode ?? "",
          iban: full.iban ?? "",
          swift: full.swift ?? "",
          transferNote: full.transferNote ?? "",
        }
      : empty);
  async function perform(action: () => Promise<unknown>) {
    setPending(true);
    setMessage("");
    try {
      await action();
      setMessage(
        "School-confirmed change saved. Issued invoices remain unchanged.",
      );
      setConfirmation("");
      setDraft(null);
      setVersion(null);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Bank change failed; retry.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-lg font-semibold">School bank accounts</h2>
      <p>
        Active / School-confirmed, not provider verified. Changes are audited
        and alert leadership.
      </p>
      {!accounts.length && (
        <p>No accounts. The first active account becomes the default.</p>
      )}
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a._id} className="flex flex-wrap gap-2">
            <span>
              {a.label || a.bankName} · {a.accountNumber} · {a.status}
              {a.isDefault ? " · Default" : ""}
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => {
                setSelected(a._id);
                setDraft(null);
                setVersion(null);
                setConfirmation("");
              }}
            >
              Review / edit
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setDraft(null);
          setVersion(null);
          setConfirmation("");
        }}
      >
        New account
      </button>
      {selected && !full ? (
        <p>Loading authorized full details…</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() =>
              selected && full
                ? edit({
                    schoolId,
                    bankAccountId: selected,
                    ...value,
                    expectedUpdatedAt: version ?? full.updatedAt,
                    confirmation,
                  })
                : add({ schoolId, ...value, isDefault: false, confirmation }),
            );
          }}
        >
          <fieldset
            disabled={pending || full?.status === "archived"}
            className="grid gap-3 sm:grid-cols-2"
          >
            <legend>{selected ? "Edit active account" : "Add account"}</legend>
            {(Object.keys(empty) as (keyof typeof empty)[]).map((field) => (
              <label key={field}>
                {field}
                <input
                  className="block w-full rounded border p-2"
                  required={[
                    "bankName",
                    "accountName",
                    "accountNumber",
                    "currency",
                  ].includes(field)}
                  value={value[field]}
                  onChange={(e) => {
                    setVersion(version ?? full?.updatedAt ?? null);
                    setDraft({ ...value, [field]: e.target.value });
                  }}
                />
              </label>
            ))}
          </fieldset>
          <label className="block">
            Type CONFIRM for the reviewed change
            <input
              className="block rounded border p-2"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          <button
            className="rounded border px-3 py-2"
            disabled={
              pending ||
              full?.status === "archived" ||
              confirmation !== "CONFIRM"
            }
          >
            Save bank details
          </button>
          {selected && full?.status === "active" && (
            <div className="space-y-2">
              <button
                type="button"
                className="border p-2"
                disabled={pending || confirmation !== "CONFIRM"}
                onClick={() =>
                  void perform(() =>
                    primary({
                      schoolId,
                      bankAccountId: selected,
                      confirmation,
                    }),
                  )
                }
              >
                Set default
              </button>
              <label className="block">
                Replacement default before archive
                <select
                  className="block border p-2"
                  value={replacementId ?? ""}
                  onChange={(e) =>
                    setReplacement(
                      accounts.find((a) => a._id === e.target.value)?._id,
                    )
                  }
                >
                  <option value="">Select replacement if required</option>
                  {accounts
                    .filter((a) => a.status === "active" && a._id !== selected)
                    .map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.bankName} · {a.accountNumber}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="border p-2"
                disabled={pending || confirmation !== "CONFIRM"}
                onClick={() =>
                  void perform(() =>
                    archive({
                      schoolId,
                      bankAccountId: selected,
                      replacementId,
                      confirmation,
                    }),
                  )
                }
              >
                Archive (retain historical account)
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setDraft(null);
              setVersion(null);
              setConfirmation("");
            }}
          >
            Discard / load latest
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
