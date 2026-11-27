"use client";

import { AdminSurface } from "@/components/ui/AdminSurface";
import { PersonNameFields, emptyPersonName } from "@school/shared";
import { normalizeStructuredPersonName } from "@school/shared/name-format";
import { Check, Copy, Link2, Send, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useDirtyForm, type DraftConnection, type DraftPayload } from "@school/shared/drafts";
import type { Id } from "@school/convex/_generated/dataModel";
import { PersistentFormDraftControls } from "@/components/drafts/PersistentFormDraftControls";
import { usePersistentFormDraft } from "@/usePersistentFormDraft";

import { AccountNoticePanel } from "../../students/components/AccountNoticePanel";

interface ProvisionResult {
  teacherId: string;
  email: string;
  temporaryPassword: string;
}

export interface InviteResult {
  invitationId: string;
  targetUserId: string;
  email: string;
  invitePath: string;
  inviteUrl: string;
  expiresAt: number;
  deliveryState: string;
}

export interface PromotableParent {
  userId: Id<"users">;
  name: string;
  email: string;
  hasActiveLogin: boolean;
}

interface DraftClosure {
  schoolId: Id<"schools">;
  draftId: Id<"formDrafts">;
  expectedRevision: number;
}

interface TeacherCreationFormProps {
  onInvite?: (
    name: string,
    email: string,
    parts?: { firstName: string; middleName?: string; lastName: string },
  ) => Promise<InviteResult>;
  onProvision: (
    name: string,
    email: string,
    password: string,
    draft?: DraftClosure,
    parts?: { firstName: string; middleName?: string; lastName: string },
  ) => Promise<ProvisionResult>;
  onPromoteParent?: (parentUserId: Id<"users">) => Promise<InviteResult | null | void>;
  promotableParents?: PromotableParent[];
  isSubmitting: boolean;
  draftContext?: {
    schoolId: Id<"schools">;
    accountId: string;
    connection: DraftConnection;
  };
}

function inviteDeliveryLabel(state: string) {
  switch (state) {
    case "accepted":
      return "Email accepted by provider";
    case "pending":
    case "sending":
      return "Email queued — you can also share the link directly";
    case "not_configured":
      return "Email sending is not configured — copy and share the link below";
    case "suppressed":
      return "Email rate-limited — copy and share the link below";
    case "failed":
      return "Email failed to send — copy and share the link below";
    default:
      return "Share the invite link below";
  }
}

export function TeacherCreationForm({
  onInvite,
  onProvision,
  onPromoteParent,
  promotableParents = [],
  isSubmitting,
  draftContext,
}: TeacherCreationFormProps) {
  const defaultPassword = onInvite ? "" : "Teacher123!Pass";
  const [onboardingMode, setOnboardingMode] = useState<"invite" | "password">(
    onInvite ? "invite" : "password",
  );
  const [person, setPerson] = useState(emptyPersonName);
  const parts = normalizeStructuredPersonName(person);
  const name = person.structured
    ? [parts.firstName, parts.middleName, parts.lastName].filter(Boolean).join(" ")
    : person.fullName.trim();
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState(defaultPassword);
  const [result, setResult] = useState<ProvisionResult | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [matchingParentId, setMatchingParentId] = useState<Id<"users"> | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [showPromoteParent, setShowPromoteParent] = useState(false);
  const [draftInstanceKey, setDraftInstanceKey] = useState(0);

  const draftData = useMemo<DraftPayload<"staff_onboarding">>(
    () => ({
      name,
      email,
      ...(person.structured
        ? { firstName: person.firstName, middleName: person.middleName, lastName: person.lastName }
        : {}),
    }),
    [email, name, person],
  );
  const draftIsDirty =
    isSubmitting ||
    (!result && !inviteResult && Boolean(name || email || temporaryPassword !== defaultPassword));
  const draft = usePersistentFormDraft({
    formKey: "staff_onboarding",
    schoolId: draftContext?.schoolId,
    accountId: draftContext?.accountId,
    connection: draftContext?.connection ?? {
      connected: false,
      authenticated: false,
      accountId: null,
    },
    currentData: draftData,
    isDirty: draftIsDirty,
    instanceKey: draftInstanceKey,
    onRestore: (payload) => {
      setPerson({
        firstName: payload.firstName ?? "",
        middleName: payload.middleName ?? "",
        lastName: payload.lastName ?? "",
        fullName: payload.name,
        structured: Boolean(payload.firstName && payload.lastName),
      });
      setEmail(payload.email);
      setTemporaryPassword("");
      setResult(null);
      setInviteResult(null);
      setSubmitError("");
    },
  });

  const resetForm = () => {
    setPerson(emptyPersonName);
    setEmail("");
    setTemporaryPassword(defaultPassword);
    setResult(null);
    setInviteResult(null);
    setSubmitError("");
    setMatchingParentId(null);
    setCopied(false);
  };

  const requestDeparture = useDirtyForm({
    name: "Teacher onboarding",
    isDirty: draftIsDirty,
    save: draftContext ? draft.retrySave : undefined,
    discard: async () => {
      if (isSubmitting) throw new Error("Wait for account creation to finish before leaving.");
      if (draftContext) await draft.handleDiscardDraft();
      resetForm();
      if (draftContext) setDraftInstanceKey((key) => key + 1);
    },
  });

  const normalizedParentMatch = useMemo(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return null;
    return promotableParents.find((p) => p.email.toLowerCase() === trimmed) ?? null;
  }, [email, promotableParents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !name || !email || (person.structured && (!parts.firstName || !parts.lastName))) {
      return;
    }

    setSubmitError("");
    setMatchingParentId(null);
    const structuredParts =
      person.structured && parts.firstName && parts.lastName
        ? { firstName: parts.firstName, middleName: parts.middleName, lastName: parts.lastName }
        : undefined;

    if (onboardingMode === "invite" && onInvite) {
      try {
        const created = await onInvite(name, email, structuredParts);
        if (draftContext) draft.submissionSucceeded();
        setInviteResult(created);
        setSubmitError("");
      } catch (err) {
        const data = (err as { data?: { code?: string; parentUserId?: Id<"users">; message?: string } })?.data;
        if (data?.code === "SAME_SCHOOL_PARENT_EXISTS" && data.parentUserId) {
          setMatchingParentId(data.parentUserId);
          setSubmitError(data.message ?? "This email already belongs to a parent in this school.");
        } else {
          setSubmitError("We could not send that teacher invitation right now.");
        }
      }
      return;
    }

    if (!temporaryPassword) return;
    let closure: DraftClosure | null = null;
    if (draftContext) {
      try {
        closure = await draft.prepareSubmission();
      } catch {
        setSubmitError("Save the draft before creating the account. Your edits are still here.");
        return;
      }
    }
    try {
      const res = await onProvision(
        name,
        email,
        temporaryPassword,
        closure ?? undefined,
        structuredParts,
      );
      if (res) {
        if (draftContext) draft.submissionSucceeded();
        setResult(res);
        setSubmitError("");
      }
    } catch {
      if (draftContext) draft.submissionFailed();
      setSubmitError("We could not create that teacher account right now.");
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };

  if (inviteResult) {
    return (
      <AdminSurface intensity="high" rounded="lg" className="p-4 space-y-4 shadow-xl border-emerald-500/20 bg-emerald-50/10">
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-[0.16em]">
            Invitation Pending
          </p>
          <h4 className="text-sm font-bold text-slate-950 font-display break-all">
            {inviteResult.email}
          </h4>
          <p className="text-xs text-slate-600">
            {inviteDeliveryLabel(inviteResult.deliveryState)}
          </p>
        </div>

        <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-xs space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em]">
            Single-use invite link (expires in 7 days)
          </p>
          <p className="text-[11px] font-mono text-slate-700 break-all bg-slate-50 rounded-md p-2 border border-slate-100">
            {inviteResult.inviteUrl}
          </p>
          <button
            type="button"
            onClick={() => copyText(inviteResult.inviteUrl)}
            className="w-full flex h-8 items-center justify-center gap-2 rounded-md bg-emerald-600 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied Link" : "Copy Invite Link"}
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            if (draftContext) setDraftInstanceKey((key) => key + 1);
          }}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Invite Another Teacher
        </button>
      </AdminSurface>
    );
  }

  if (result) {
    return (
      <AdminSurface intensity="high" rounded="lg" className="p-4 space-y-4 shadow-xl border-emerald-500/20 bg-emerald-50/10">
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-[0.2em]">
            Teacher Added
          </p>
          <h4 className="text-sm font-bold text-slate-950 font-display">
            {result.email}
          </h4>
        </div>

        <div className="rounded-lg bg-white p-3 border border-emerald-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">
              Temporary Password
            </span>
            <span className="text-xs font-black text-slate-950">{result.temporaryPassword}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              copyText(`Email: ${result.email}\nTemp Password: ${result.temporaryPassword}`)
            }
            className="w-full flex h-8 items-center justify-center gap-2 rounded-md bg-emerald-600 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy Credentials"}
          </button>
        </div>

        <AccountNoticePanel userId={result.teacherId as Id<"users">} />
        <button
          type="button"
          onClick={() => {
            void requestDeparture({ kind: "close" }).then((confirmed) => {
              if (confirmed && !draftIsDirty) {
                resetForm();
                setDraftInstanceKey((key) => key + 1);
              }
            });
          }}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Add Another Teacher
        </button>
      </AdminSurface>
    );
  }

  const parentToPromote =
    (matchingParentId && promotableParents.find((p) => p.userId === matchingParentId)) ||
    normalizedParentMatch;

  return (
    <AdminSurface intensity="medium" rounded="lg" className="p-4 space-y-4">
      <div className="border-b border-slate-100 pb-3 space-y-1">
        <div className="flex items-center justify-between gap-2 min-h-6">
          <h4 className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em] font-display">
            Add Teacher
          </h4>
          {draftContext && (
            <PersistentFormDraftControls
              draft={draft}
              formTitle="teacher onboarding"
              isDirty={draftIsDirty}
              variant="compact"
              excludedFieldsNotice="Passwords are not saved in drafts."
              onDiscard={async () => {
                await draft.handleDiscardDraft();
                resetForm();
                setDraftInstanceKey((key) => key + 1);
              }}
            />
          )}
        </div>
        <p className="text-[11px] font-medium text-slate-400">
          {onboardingMode === "invite"
            ? "Send an invite link. Works for new teachers and existing Melo accounts."
            : "Create a new login with a temporary password."}
        </p>
      </div>

      {onInvite && (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => { setOnboardingMode("invite"); setSubmitError(""); }}
            className={`rounded-md py-1.5 text-[11px] font-semibold transition ${
              onboardingMode === "invite"
                ? "bg-white text-slate-950 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Invite link
          </button>
          <button
            type="button"
            onClick={() => { setOnboardingMode("password"); setSubmitError(""); }}
            className={`rounded-md py-1.5 text-[11px] font-semibold transition ${
              onboardingMode === "password"
                ? "bg-white text-slate-950 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Temp password
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <PersonNameFields
          value={person}
          onChange={setPerson}
          allowFullName={!person.structured || Boolean(person.fullName)}
        />

        <FormField label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.edu"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
          />
        </FormField>

        {parentToPromote && onPromoteParent && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-sky-950">
              {parentToPromote.name} is already a parent at this school.
            </p>
            <p className="text-[11px] text-sky-900">
              Add teacher access to their existing record so they keep Family Portal access with one login.
            </p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setSubmitError("");
                void onPromoteParent(parentToPromote.userId)
                  .then((created) => {
                    if (created) {
                      setInviteResult(created);
                      setMatchingParentId(null);
                    } else {
                      resetForm();
                    }
                  })
                  .catch(() => setSubmitError("We could not grant teacher access right now."));
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-700 px-3 text-[11px] font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Grant teacher access
            </button>
          </div>
        )}

        {onboardingMode === "password" && (
          <FormField label="Temporary Password">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Enter a temporary password"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 outline-none transition-all focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5"
            />
          </FormField>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            !name ||
            !email ||
            (onboardingMode === "password" && !temporaryPassword)
          }
          className="mt-2 w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 text-[11px] font-bold uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
        >
          {onboardingMode === "invite" ? (
            <Link2 className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {isSubmitting
            ? "Saving..."
            : onboardingMode === "invite"
              ? "Send Teacher Invite"
              : "Create Teacher Account"}
        </button>

        {submitError && (
          <p className="text-[11px] font-bold text-rose-500">{submitError}</p>
        )}
      </form>

      {onPromoteParent && promotableParents.length > 0 && !parentToPromote && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => setShowPromoteParent((open) => !open)}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-950 underline underline-offset-2"
          >
            {showPromoteParent
              ? "Hide existing parents"
              : "Hiring an existing parent at this school?"}
          </button>
          {showPromoteParent && (
            <div className="flex gap-2">
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900"
              >
                <option value="">Select parent…</option>
                {promotableParents.map((parent) => (
                  <option key={parent.userId} value={parent.userId}>
                    {parent.name} ({parent.email})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedParentId || isSubmitting}
                onClick={() => {
                  if (!selectedParentId) return;
                  setSubmitError("");
                  void onPromoteParent(selectedParentId as Id<"users">)
                    .then((created) => {
                      setSelectedParentId("");
                      setShowPromoteParent(false);
                      if (created) {
                        setInviteResult(created);
                      }
                    })
                    .catch(() => setSubmitError("We could not grant teacher access right now."));
                }}
                className="h-9 rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </AdminSurface>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}
