"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../../packages/convex/_generated/api";
import { ReviewDialog } from "./ClassReleasePanel";

const button = "min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50";

export function ReleasePauseControl({ school, paused, reason, updatedAt, canManage, transition, onTransition }: {
  school: string;
  paused: boolean;
  reason: string | null;
  updatedAt: number | null;
  canManage: boolean;
  transition: boolean;
  onTransition: (next: boolean | null) => void;
}) {
  const setPaused = useMutation(api.functions.academic.resultPublication.setReleasesPaused);
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const next = !paused;
  const close = () => {
    if (pending) return;
    setOpen(false);
    setExplanation("");
    setConfirmed(false);
    setError("");
  };
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5" aria-label="School release status">
    <h2 className="text-xl font-bold">School release status</h2>
    <p role="status" aria-live="polite">{paused ? `New class releases are paused for ${school}. Published reports remain visible to families.` : `New class releases are enabled for ${school}.`}</p>
    {updatedAt !== null && reason && <p>Latest {paused ? "pause" : "resume"} reason: {reason}. Updated {new Date(updatedAt).toLocaleString()}.</p>}
    {canManage && <button type="button" className={button} disabled={transition || pending} onClick={() => { setExplanation(""); setConfirmed(false); setError(""); setOpen(true); }}>{paused ? "Resume releases" : "Pause releases"}</button>}
    <p role="status" aria-live="polite">{transition ? "Updating school release status..." : notice}</p>
    {open && <ReviewDialog title={next ? "Pause class releases?" : "Resume class releases?"} onClose={close}>
      <p>{next ? `Pause new class releases for ${school}? Published reports will remain visible to families.` : `Resume new class releases for ${school}? Staff can release reviewed classes again.`}</p>
      <label className="block font-semibold">Reason<textarea className="mt-2 block w-full rounded border p-2" value={explanation} onChange={e => setExplanation(e.target.value)} aria-invalid={!!error} aria-describedby={error ? "pause-error" : undefined} rows={4} maxLength={500} /></label>
      <label className="flex items-center gap-3"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this change for {school}.</label>
      {error && <p id="pause-error" role="alert" className="text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={pending} onClick={close}>Cancel</button><button type="button" className={button} disabled={pending || transition || !confirmed || explanation.trim().length < 10 || explanation.trim().length > 500} onClick={async () => {
        setPending(true); setError(""); onTransition(next);
        try {
          await setPaused({ releasesPaused: next, reason: explanation.trim() });
          setNotice(next ? "New releases paused. Published reports remain visible." : "New releases resumed.");
          closeAfterSuccess();
        } catch (e) {
          onTransition(null);
          setError(e instanceof Error ? e.message : "School release status could not be changed. Try again.");
        } finally { setPending(false); }
      }}>{pending ? "Saving..." : next ? "Confirm pause" : "Confirm resume"}</button></div>
    </ReviewDialog>}
  </section>;

  function closeAfterSuccess() {
    setOpen(false);
    setExplanation("");
    setConfirmed(false);
  }
}
