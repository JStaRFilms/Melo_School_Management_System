"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAction, useQuery } from "convex/react";
import { BadgeCheck, Copy, KeyRound, RefreshCw } from "lucide-react";
import { getUserFacingErrorMessage } from "@school/shared";

import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { AccountNoticePanel } from "./AccountNoticePanel";
import { PortalStateLabel } from "./PortalStateLabel";
import { QueryErrorBoundary } from "./QueryErrorBoundary";
import type { EnrollmentNotice } from "./types";

interface PortalCredentialPanelProps {
  title: string;
  description?: string;
  userId: string;
  userName: string;
  email: string;
  defaultPassword: string;
  onNotice: (notice: EnrollmentNotice) => void;
}

interface PortalCredentialResult {
  userId: string;
  email: string;
  temporaryPassword: string;
  operationId: string;
}

export function PortalCredentialPanel(props: PortalCredentialPanelProps) {
  return <QueryErrorBoundary key={props.userId} message="Could not check portal access."><PortalCredentialPanelContent {...props} /></QueryErrorBoundary>;
}

function PortalCredentialPanelContent({
  title,
  description,
  userId,
  userName,
  email,
  defaultPassword,
  onNotice,
}: PortalCredentialPanelProps) {
  const upsertPortalCredentials = useAction(
    api.functions.academic.studentEnrollment.upsertPortalCredentials
  );

  const account = useQuery(api.functions.academic.studentEnrollment.getPortalAccountState, { userId: userId as Id<"users"> });
  const [temporaryPassword, setTemporaryPassword] = useState(defaultPassword);
  const [result, setResult] = useState<PortalCredentialResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTemporaryPassword(defaultPassword);
    setResult(null);
    setCopied(false);
  }, [defaultPassword, userId]);

  const copyCredentials = async () => {
    if (!result || result.userId !== userId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `Login ID: ${result.email}\nTemp Password: ${result.temporaryPassword}`
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("PortalCredentialPanel:copyCredentials", error);
      onNotice({
        tone: "error",
        message: "We couldn't copy the portal credentials right now.",
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const password = temporaryPassword.trim();
    if (!password) {
      onNotice({
        tone: "error",
        message: "A temporary password is required.",
      });
      return;
    }

    if (isSubmitting || !account || !["not_provisioned", "provisioned"].includes(account.state)) return;
    const targetUserId = userId;
    setResult(null);
    setIsSubmitting(true);
    try {
      const response = await upsertPortalCredentials({
        userId: targetUserId as Id<"users">,
        temporaryPassword: password,
        requestKey: crypto.randomUUID(),
      });

      setResult(response);
      setCopied(false);
      onNotice({
        tone: "success",
        message: `Portal credentials updated for ${userName}.`,
      });
    } catch (error) {
      onNotice({
        tone: "error",
        message: getUserFacingErrorMessage(
          error,
          "Portal credential update failed."
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result && result.userId === userId) {
    return (
      <section className="space-y-4 pt-6 border-t border-slate-200/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-700" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">
              Portal Access Ready
            </p>
          </div>
          <h4 className="text-sm font-black text-emerald-950">{title}</h4>
          {description && (
            <p className="text-xs font-medium leading-relaxed text-emerald-900/75">
              {description}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Login ID
            </span>
            <span className="text-sm font-black text-slate-950">{result.email}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Temporary Password
            </span>
            <span className="text-sm font-black text-slate-950">{result.temporaryPassword}</span>
          </div>
          <button
            type="button"
            onClick={() => void copyCredentials()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-emerald-500"
          >
            {copied ? <BadgeCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Login Details"}
          </button>
        </div>

        <AccountNoticePanel userId={userId as Id<"users">} />
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setCopied(false);
          }}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-800 transition hover:bg-emerald-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Set Another Temporary Password
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4 pt-6 border-t border-slate-200/60">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-500" />
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
        </div>
        <p className="text-xs font-medium leading-relaxed text-slate-500">
          {description}
        </p>
        <p className="text-[11px] font-semibold text-slate-400">
          Login ID: <span className="break-words font-black text-slate-700">{account?.email ?? email}</span>. A login ID is not necessarily an inbox.
        </p>
      </div>

      <p className="text-xs font-semibold text-slate-600"><PortalStateLabel state={account?.state} /></p>
      {account?.state === "provisioned" && <AccountNoticePanel userId={userId as Id<"users">} />}
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Temporary Password
          </span>
          <input
            type="text"
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            className={fieldInputClassName}
            placeholder={defaultPassword}
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || !account || !["not_provisioned", "provisioned"].includes(account.state)}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50/70 hover:bg-indigo-100/80 px-4 text-xs font-bold text-indigo-900 transition-all disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
        >
          <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
          <span>{isSubmitting ? "Updating..." : account?.state === "provisioned" ? "Reset password" : "Provision access"}</span>
        </button>
      </form>
    </section>
  );
}

const fieldInputClassName =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none transition-all focus:border-slate-950 focus:ring-2 focus:ring-slate-950/5 placeholder:text-slate-300";
