"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@school/convex/_generated/api";
import type { Id } from "@school/convex/_generated/dataModel";
import { getUserFacingErrorMessage } from "@school/shared";
import { useDirtyForm } from "@school/shared/drafts";

type Domain = FunctionReturnType<typeof api.functions.academic.institutionalEmail.listEmailDomainsPage>["page"][number];

export function StudentLoginPolicy({ schoolId, domains }: { schoolId: Id<"schools">; domains: Domain[] }) {
  const policy = useQuery(api.functions.academic.institutionalEmail.getStudentLoginPolicy, { schoolId });
  const save = useMutation(api.functions.academic.institutionalEmail.saveStudentLoginPolicy);
  const [draft, setDraft] = useState<{ domainId: Id<"schoolEmailDomains"> | null; expectedVersion: number } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useDirtyForm({ name: "Student login suffix policy", isDirty: draft !== null || busy, discard: () => { if (busy) throw new Error("Wait for the policy save to finish."); setDraft(null); setReviewing(false); } });
  if (!policy) return <p role="status">Loading student login suffix...</p>;
  const eligible = domains.filter(domain => domain.status === "verified" && domain.verifiedAt !== undefined && !/\.(local|invalid|test|example)$/.test(domain.domain));
  const selectedId = draft?.domainId ?? (draft ? null : policy.domainId);
  const confirm = async () => {
    if (!draft || busy || !policy.canEdit) return;
    setBusy(true); setMessage("");
    try {
      await save({ schoolId, ...draft, confirmed: true });
      setDraft(null); setReviewing(false); setMessage("Student login suffix saved for new identities only. Existing logins and sender settings are unchanged.");
    } catch (error) { setMessage(getUserFacingErrorMessage(error, "Policy could not be saved. Reload and review the current version.")); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border-t border-slate-200 pt-4" aria-labelledby="student-login-policy-title">
    <h2 id="student-login-policy-title" className="font-semibold">Student login suffix</h2>
    <p>Current suffix: {policy.suffix ?? "Unavailable, needs review"} · version {policy.version}</p>
    <p className="text-sm">This applies only to newly admitted student identities. Existing login IDs stay unchanged across name edits, policy changes and password resets. Login IDs are not inboxes. This does not create mailboxes or change notification sender settings.</p>
    {policy.unavailableReason && <p role="alert">{policy.unavailableReason}</p>}
    <label className="block">Suffix for new student logins
      <select className="mt-1 w-full rounded border border-slate-300 p-2" disabled={!policy.canEdit || busy} value={selectedId ?? ""} onChange={event => {
        const domain = eligible.find(item => item._id === event.target.value);
        if (event.target.value === "" || domain) { setDraft({ domainId: domain?._id ?? null, expectedVersion: policy.version }); setReviewing(false); setMessage(""); }
      }}>
        <option value="">School-namespaced .local default</option>
        {selectedId && !eligible.some(domain => domain._id === selectedId) && <option value={selectedId} disabled>Configured domain unavailable</option>}
        {eligible.map(domain => <option key={domain._id} value={domain._id}>{domain.domain} · {domain.schoolId === schoolId ? "school-owned" : "shared active-group domain"}</option>)}
      </select>
    </label>
    {!policy.canEdit && <p>Read-only. Domain policy authority is required to change the suffix.</p>}
    {draft && <button type="button" disabled={busy} onClick={() => setReviewing(true)}>Review suffix change</button>}
    {reviewing && draft && <div className="space-y-2 text-sm"><p>Apply the selected suffix to new identities only, using reviewed policy version {draft.expectedVersion}?</p><button type="button" disabled={busy} onClick={() => void confirm()}>Confirm student suffix</button><button type="button" className="ml-3" disabled={busy} onClick={() => { setReviewing(false); setDraft(null); }}>Cancel suffix change</button></div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
