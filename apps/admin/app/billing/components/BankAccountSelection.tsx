"use client";
import { useQuery } from "convex/react";
import { useAuth } from "@/AuthProvider";
import { api } from "../../../../../packages/convex/_generated/api";
import type { Id } from "../../../../../packages/convex/_generated/dataModel";
export function BankAccountSelection({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { workspaceAccess } = useAuth();
  const schoolId =
    workspaceAccess?.state === "ready"
      ? (workspaceAccess.branch.schoolId as Id<"schools">)
      : undefined;
  const accounts = useQuery(
    api.functions.academic.bankAccounts.listBankAccounts,
    schoolId ? { schoolId } : "skip",
  );
  return (
    <label className="block text-sm">
      Bank instructions for new invoices
      <select
        className="block w-full rounded border p-2"
        value={value}
        disabled={!accounts}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {accounts ? "Default instructions" : "Loading accounts…"}
        </option>
        {accounts
          ?.filter((a) => a.status === "active")
          .map((a) => (
            <option key={a._id} value={a._id}>
              {a.label || a.bankName} · {a.accountNumber} · {a.currency}
            </option>
          ))}
      </select>
      <span className="text-xs">
        Invoice choice overrides the fee plan account, otherwise the active
        school default is used. Issued copies never change.
      </span>
    </label>
  );
}
