"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSignInErrorMessage } from "@school/auth";
import { authClient, functionRef } from "../lib/client";
import { applicationPath, applicationStatusCopy, fieldIsVisible, formatMinorCurrency, paymentStatusCopy, serializedValue, type PublishedField } from "../lib/journey";
import { guardianRegistrationErrorMessage, validateGuardianRegistration } from "../lib/registration";

type Props = { schoolSlug: string; intakeSlug?: string; paymentReference?: string };
type Field = PublishedField & { sectionKey: string; label: string; helpText: string | null; dataClass: string; purpose: string | null; validation: string };
type Requirement = { key: string; label: string; purpose: string; requiredMode: string; acceptedMimeTypes: string[]; maxBytes: number; maxFiles: number; sensitivity: string };
const referenceKey = (school: string) => `apply:last-reference:${school}`;
const checkoutKey = (school: string) => `${referenceKey(school)}:checkout`;

export function GuardianSurface({ schoolSlug, intakeSlug, paymentReference }: Props) {
  const router = useRouter();
  const entry = useQuery(functionRef("functions/admissions/public:getEntry"), { schoolSlug, ...(intakeSlug ? { intakeSlug } : {}) }) as any;
  const { data: session } = authClient.useSession();
  const getIdentity = useMutation(functionRef("functions/admissions/guardian:getOrCreateIdentity"));
  const createAttempt = useMutation(functionRef("functions/admissions/public:createAttemptForOffering"));
  const initializeAttempt = useAction(functionRef("functions/admissions/public:initializeAttemptByReference"));
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const begin = async () => {
    if (!session?.user) { router.push(`/s/${encodeURIComponent(schoolSlug)}/account`); return; }
    setStarting(true);
    setNotice(null);
    try {
      const identity: any = await getIdentity({});
      if (identity.verificationRequired) { setNotice("Verify your contact to protect this private application, then return here."); return; }
      const key = localStorage.getItem(checkoutKey(schoolSlug)) ?? crypto.randomUUID();
      localStorage.setItem(checkoutKey(schoolSlug), key);
      const attempt: any = await createAttempt({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}), idempotencyKey: key });
      const checkout: any = await initializeAttempt({ reference: attempt.reference });
      if (checkout.state !== "checkout_pending" || !checkout.checkoutUrl) {
        setNotice(checkout.state === "paid" ? "Payment is confirmed. Open your workspace to use the available application slot." : "We could not start secure checkout. Please try again.");
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch { setNotice("We could not start secure checkout. Verify your contact and try again."); }
    finally { setStarting(false); }
  };

  if (!entry) return <Page><p className="muted">Loading the published application information…</p></Page>;
  if (entry.availability === "unavailable") return <Unavailable />;
  const unavailable = entry.availability !== "open";
  return <Page><section className="card"><span className="pill">{entry.availability}</span><h1>{entry.programme?.name ?? "Application information"}</h1><p className="muted">{entry.intake?.name} · {entry.intake?.cycleLabel}</p>
    {unavailable ? <Availability state={entry.availability} opensAt={entry.intake?.opensAt} /> : <><p>Start a private application for one child. You can save and return after contact verification.</p><div className="notice"><strong>Before you begin</strong><p>One payment creates one application slot for one child. A payment does not confirm a place.</p>{entry.offering ? <p>Application fee: <strong>{formatMinorCurrency(entry.offering.amountMinor, entry.offering.currency)}</strong><br />{entry.offering.feeDisclosure}</p> : null}</div><div className="actions"><button className="primary" type="button" disabled={starting} onClick={() => void begin()}>{starting ? "Starting secure checkout…" : "Start one child application"}</button><a className="secondary" href={`/s/${encodeURIComponent(schoolSlug)}/account`}>Application workspace</a></div></>}
    {notice ? <p className="status" role="status">{notice}</p> : null}
  </section>{paymentReference ? <PaymentReturn schoolSlug={schoolSlug} reference={paymentReference} /> : null}</Page>;
}

export function AccountSurface({ schoolSlug, intakeSlug }: Pick<Props, "schoolSlug" | "intakeSlug">) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const workspace = useQuery(functionRef("functions/admissions/public:getGuardianWorkspace"), session?.user ? { schoolSlug, limit: 100 } : "skip") as any;
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [authState, setAuthState] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    if (mode === "create") {
      const validationErrors = validateGuardianRegistration({ name, email, password, passwordConfirmation });
      if (validationErrors.length) {
        setAuthState(validationErrors.join(" "));
        setSubmitting(false);
        return;
      }
      setAuthState("Creating your account…");
      try {
        const result: any = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });
        if (result?.error) setAuthState(guardianRegistrationErrorMessage(result.error));
        else {
          setAuthState("Account created. Your private workspace is loading.");
          router.refresh();
        }
      } catch (error) {
        setAuthState(guardianRegistrationErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setAuthState("Signing in…");
    try {
      const result: any = await authClient.signIn.email({ email: email.trim(), password });
      if (result?.error) setAuthState(getSignInErrorMessage(result.error));
      else {
        setAuthState("Signed in. Your private workspace is loading.");
        router.refresh();
      }
    } catch (error) {
      setAuthState(getSignInErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (nextMode: "sign-in" | "create") => {
    setMode(nextMode);
    setAuthState(null);
    setPassword("");
    setPasswordConfirmation("");
  };

  return <Page><section className="card"><h1>Your application workspace</h1><p className="muted">Each application slot is for one child. Payment confirmation does not confirm admission.</p>{!session?.user ? <form onSubmit={submitAuth}><div className="notice"><strong>{mode === "create" ? "Create your guardian account" : "Sign in to your guardian account"}</strong><p>{mode === "create" ? "Use your real name and an email you can access. You will use these details to return to private applications." : "Enter the account details you used for your application."}</p></div>{mode === "create" ? <Input id="name" label="Full name" value={name} onChange={setName} autoComplete="name" required /> : null}<Input id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required /><Input id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete={mode === "create" ? "new-password" : "current-password"} required />{mode === "create" ? <><Input id="password-confirmation" label="Repeat password" type="password" value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" required /><p className="muted">Use at least 8 characters and enter the same password twice.</p></> : null}<div className="actions"><button className="primary" type="submit" disabled={submitting}>{submitting ? (mode === "create" ? "Creating account…" : "Signing in…") : (mode === "create" ? "Create account" : "Sign in")}</button><button className="secondary" type="button" disabled={submitting} onClick={() => switchMode(mode === "create" ? "sign-in" : "create")}>{mode === "create" ? "I already have an account" : "Create an account"}</button></div>{authState ? <p className="status" role="status">{authState}</p> : null}</form> : <WorkspaceCards workspace={workspace} schoolSlug={schoolSlug} intakeSlug={intakeSlug} router={router} />}</section></Page>;
}

function WorkspaceCards({ workspace, schoolSlug, intakeSlug, router }: { workspace: any; schoolSlug: string; intakeSlug?: string; router: ReturnType<typeof useRouter> }) {
  const reserve = useMutation(functionRef("functions/admissions/public:createOrResumeForOffering"));
  const [notice, setNotice] = useState("");
  const startAvailable = async () => { try { const application: any = await reserve({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}) }); localStorage.setItem(referenceKey(schoolSlug), application.publicReference); router.push(applicationPath(schoolSlug, application.publicReference)); } catch { setNotice("This slot is not available to start yet. Refresh your workspace and try again."); } };
  if (!workspace) return <p className="muted">Loading your saved slots and applications…</p>;
  return <><div className="notice"><strong>Applications for {workspace.schoolName}</strong><p>Every card below is one separate slot. Start another checkout for another child.</p></div>{notice ? <p className="status" role="status">{notice}</p> : null}<div className="workspace">{workspace.slots.length ? workspace.slots.map((slot: any, index: number) => <article className="upload" key={`${slot.publicReference ?? slot.state}-${index}`}><strong>{slot.applicationState ? `Application · ${slot.applicationState}` : slot.state === "available" ? "Available application slot" : `Slot · ${slot.state}`}</strong><p className="muted">Updated {new Date(slot.updatedAt).toLocaleString()}</p>{slot.publicReference ? <button className="secondary" onClick={() => router.push(applicationPath(schoolSlug, slot.publicReference))}>{slot.applicationState === "draft" || slot.applicationState === "changes_requested" ? "Resume application" : "View application status"}</button> : slot.state === "available" ? <button className="primary" onClick={() => void startAvailable()}>Start this child&apos;s application</button> : <p className="muted">This slot is not available to start.</p>}</article>) : <p className="muted">No paid application slots are available yet.</p>}</div><div className="actions"><a className="primary" href={`/s/${encodeURIComponent(schoolSlug)}${intakeSlug ? `/i/${encodeURIComponent(intakeSlug)}` : ""}`}>Buy another application slot</a></div></>;
}

export function ApplicationSurface({ schoolSlug, publicReference }: { schoolSlug: string; publicReference: string }) {
  const router = useRouter();
  const app = useQuery(functionRef("functions/admissions/public:getGuardianApplication"), { schoolSlug, publicReference }) as any;
  const config = useQuery(functionRef("functions/admissions/public:getApplicationConfiguration"), app ? { schoolSlug, publicReference } : "skip") as any;
  const saveCore = useMutation(functionRef("functions/admissions/public:saveCoreByPublicReference"));
  const saveAnswer = useMutation(functionRef("functions/admissions/public:saveAnswerByPublicReference"));
  const saveContact = useMutation(functionRef("functions/admissions/public:saveContactByPublicReference"));
  const withdraw = useMutation(functionRef("functions/admissions/public:withdrawByPublicReference"));
  const submit = useMutation(functionRef("functions/admissions/public:submitByPublicReference"));
  const createUploadUrl = useMutation(functionRef("functions/admissions/public:createUploadUrlByPublicReference"));
  const bindUpload = useMutation(functionRef("functions/admissions/public:bindUploadByPublicReference"));
  const accessOwnDocument = useMutation(functionRef("functions/admissions/public:getOwnDocumentAccessByPublicReference"));
  const [step, setStep] = useState("child"); const [status, setStatus] = useState("Loading your private application…"); const [version, setVersion] = useState<number | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false); const [errors, setErrors] = useState<string[]>([]);
  const [core, setCore] = useState({ firstName: "", lastName: "", dateOfBirth: "", signerName: "", signerRelationship: "" });
  const [contact, setContact] = useState({ fullName: "", relationship: "Parent", email: "", phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  useEffect(() => { if (!app) return; setVersion(app.draftVersion); setCore((current) => ({ ...current, firstName: current.firstName || app.profile?.firstName || "", lastName: current.lastName || app.profile?.lastName || "", dateOfBirth: current.dateOfBirth || (app.profile?.dateOfBirth ? new Date(app.profile.dateOfBirth).toISOString().slice(0, 10) : "") })); setAnswers(Object.fromEntries((app.answers ?? []).map((answer: any) => [answer.fieldKey, answer.serializedValue]))); const primary = app.contacts?.find((item: any) => item.isPrimary); if (primary) setContact({ fullName: primary.fullName, relationship: primary.relationship, email: primary.email ?? "", phone: primary.phone ?? "" }); }, [app]);
  const sectionKeys = useMemo<string[]>(() => Array.from(new Set<string>((config?.fields ?? []).map((field: Field) => field.sectionKey))).filter(Boolean), [config?.fields]);
  const formSteps = useMemo<string[]>(() => Array.from(new Set<string>(["child", "contacts", ...sectionKeys.filter((key) => key !== "child" && key !== "contacts"), "documents", "review"])), [sectionKeys]);
  const fields = useMemo(() => (config?.fields ?? []).filter((field: Field) => field.sectionKey === step && fieldIsVisible(field, answers)), [config?.fields, step, answers]);
  if (!app || !config || version === null) return <Page><p className="muted">Loading your private application…</p></Page>;
  const editable = app.allowedActions.includes("save");
  const fieldEditable = (key: string) => editable && (app.state !== "changes_requested" || app.permittedEdits.fieldKeys.includes(key));
  const coreEditable = (key: string) => editable && (app.state !== "changes_requested" || app.permittedEdits.coreKeys.includes(key));
  const save = async (event: FormEvent) => { event.preventDefault(); setErrors([]); setStatus("Saving…"); try { const next = await saveCore({ schoolSlug, publicReference, expectedVersion: version, firstName: core.firstName, lastName: core.lastName, dateOfBirth: new Date(core.dateOfBirth).getTime() }); setVersion(next); setStatus("Saved. Your application can be resumed from your workspace."); } catch { setStatus("Could not save. Keep this page open and retry."); setErrors(["Your core details were not saved. Check the required fields and retry."]); } };
  const saveField = async (field: Field, value: string | boolean | string[]) => { const payload = serializedValue(field.kind, value); setStatus("Saving…"); try { const next = await saveAnswer({ schoolSlug, publicReference, fieldKey: field.key, expectedVersion: version, ...payload }); setVersion(next); setStatus("Saved."); } catch { setStatus("Could not save this answer. Retry before submitting."); setErrors([`We could not save ${field.label}.`]); } };
  const savePrimaryContact = async (event: FormEvent) => { event.preventDefault(); setStatus("Saving contact…"); try { const next = await saveContact({ schoolSlug, publicReference, expectedVersion: version, contactKey: "primary-guardian", kind: "guardian", fullName: contact.fullName, relationship: contact.relationship, email: contact.email || undefined, phone: contact.phone || undefined, isApplicantGuardian: true, isPrimary: true }); setVersion(next); setStatus("Guardian contact saved."); } catch { setStatus("Could not save this contact. Check the named fields and retry."); } };
  const withdrawApplication = async () => { const reason = window.prompt("Why are you withdrawing this application?"); if (!reason?.trim()) return; try { await withdraw({ schoolSlug, publicReference, reason }); setStatus("Application withdrawn. Its history remains available."); router.refresh(); } catch { setStatus("This application cannot be withdrawn from its current state."); } };
  const submitApplication = async () => { setErrors([]); if (!config.declaration || !declarationAccepted) { setErrors(["Read and accept the published declaration before submitting."]); return; } setStatus("Submitting — checking status…"); try { const result = await submit({ schoolSlug, publicReference, expectedVersion: version, signerName: core.signerName, signerRelationship: core.signerRelationship, declarationVersion: config.declaration.version, declarationAccepted }); setStatus(`Application submitted. Revision ${result.revision} is now locked for review.`); router.refresh(); } catch { setStatus("Complete the named items and retry."); setErrors(["The application is incomplete or has a newer saved version. Review every required item and retry."]); } };
  return <Page><div className="grid"><aside className="card step-card" aria-label="Application steps"><p className="pill">{app.state}</p><p className="muted">{applicationStatusCopy(app.state, app.conversionState)}</p><ol className="stepper">{formSteps.map(item => <li key={item}><button type="button" aria-current={step === item ? "step" : undefined} onClick={() => setStep(item)}>{item === "child" ? "Child and form" : item === "contacts" ? "Guardian contact" : item === "documents" ? "Documents" : item === "review" ? "Review and declaration" : item.replace(/[-_]/g, " ")}</button></li>)}</ol></aside><main className="card app-card"><h1>{editable ? "Complete this application" : "Application status"}</h1><p className="status" aria-live="polite">{status}</p>{errors.length ? <div role="alert" className="notice danger"><strong>Complete the highlighted items</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null}{app.messages.map((message: any) => <div className="notice warn" key={message.createdAt}>{message.message ?? "The school updated your application status."}</div>)}
  {step === "child" && <form onSubmit={save}><fieldset className="fieldset" disabled={!editable}><Input id="first" label="Legal first name" value={core.firstName} onChange={(value) => setCore({ ...core, firstName: value })} required disabled={!coreEditable("firstName")} /><Input id="last" label="Legal last name" value={core.lastName} onChange={(value) => setCore({ ...core, lastName: value })} required disabled={!coreEditable("lastName")} /><Input id="dob" label="Date of birth" type="date" value={core.dateOfBirth} onChange={(value) => setCore({ ...core, dateOfBirth: value })} required disabled={!coreEditable("dateOfBirth")} />{fields.map((field: Field) => <DynamicField key={field.key} field={field} value={answers[field.key] ?? ""} disabled={!fieldEditable(field.key)} onChange={(value) => setAnswers({ ...answers, [field.key]: Array.isArray(value) ? JSON.stringify(value) : String(value) })} onSave={saveField} />)}<div className="sticky"><button className="primary" type="submit">Save and continue</button></div></fieldset></form>}
  {step === "contacts" && <form onSubmit={savePrimaryContact}><fieldset className="fieldset" disabled={!editable || app.state === "changes_requested"}><h2>Guardian and emergency contact</h2><Input id="contact-name" label="Full name" value={contact.fullName} onChange={value => setContact({ ...contact, fullName: value })} required /><Input id="contact-relationship" label="Relationship" value={contact.relationship} onChange={value => setContact({ ...contact, relationship: value })} required /><Input id="contact-email" label="Email" type="email" value={contact.email} onChange={value => setContact({ ...contact, email: value })} /><Input id="contact-phone" label="Phone" value={contact.phone} onChange={value => setContact({ ...contact, phone: value })} /><button className="primary" type="submit">Save guardian contact</button></fieldset></form>}
  {step !== "child" && step !== "contacts" && step !== "documents" && step !== "review" && <section><h2>{step.replace(/[-_]/g, " ")}</h2><fieldset className="fieldset" disabled={!editable}>{fields.map((field: Field) => <DynamicField key={field.key} field={field} value={answers[field.key] ?? ""} disabled={!fieldEditable(field.key)} onChange={(value) => setAnswers({ ...answers, [field.key]: Array.isArray(value) ? JSON.stringify(value) : String(value) })} onSave={saveField} />)}{!fields.length ? <p className="muted">No currently applicable fields are configured in this section.</p> : null}</fieldset></section>}
  {step === "documents" && <Documents requirements={(config.requirements as Requirement[]).filter(requirement => app.state !== "changes_requested" || app.permittedEdits.requirementKeys.includes(requirement.key))} documents={app.documents ?? []} disabled={!editable} onOpen={async documentKey => { const result: any = await accessOwnDocument({ schoolSlug, publicReference, documentKey, action: "view" }); if (result.status !== "available") throw new Error("Unavailable"); window.open(result.url, "_blank", "noopener,noreferrer"); }} onUpload={async (requirementKey, file) => { const uploadUrl = await createUploadUrl({ schoolSlug, publicReference, requirementKey }); const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file }); if (!response.ok) throw new Error("Upload failed"); const { storageId } = await response.json(); await bindUpload({ schoolSlug, publicReference, requirementKey, storageId, fileName: file.name }); }} />}
  {step === "review" && <section><h2>Review and declaration</h2><p className="muted">Review your saved details and private document requirements before submitting. Submitting does not create a student or confirm admission.</p>{config.declaration ? <><h3>{config.declaration.title} · Version {config.declaration.version}</h3><p className="notice">{config.declaration.body}</p></> : <p className="notice warn">The current declaration is unavailable. This application cannot be submitted.</p>}<Input id="signer" label="Signer name" value={core.signerName} onChange={(value) => setCore({ ...core, signerName: value })} required /><Input id="relationship" label="Relationship" value={core.signerRelationship} onChange={(value) => setCore({ ...core, signerRelationship: value })} required /><label><input type="checkbox" checked={declarationAccepted} onChange={e => setDeclarationAccepted(e.target.checked)} disabled={!editable || !config.declaration} /> I have read and accept the published declaration shown above.</label><div className="actions"><button type="button" className="primary" disabled={!editable || !config.declaration || !declarationAccepted} onClick={() => void submitApplication()}>Submit application</button></div></section>}{["draft", "submitted", "under_review", "changes_requested", "waitlisted"].includes(app.state) ? <button type="button" className="secondary" onClick={() => void withdrawApplication()}>Withdraw application</button> : null}</main></div></Page>;
}

function DynamicField({ field, value, disabled, onChange, onSave }: { field: Field; value: string; disabled: boolean; onChange: (value: string | boolean | string[]) => void; onSave: (field: Field, value: string | boolean | string[]) => Promise<void> }) {
  const policy = (() => { try { return JSON.parse(field.validation) as { choices?: string[] }; } catch { return {}; } })(); const sensitive = ["highly_sensitive", "financial_security", "child_confidential"].includes(field.dataClass);
  const commit = (next: string | boolean | string[]) => void onSave(field, next);
  return <div className="field"><label htmlFor={field.key}>{field.label} <small>{field.requiredMode === "required" ? "Required" : "Optional"}{sensitive ? " • Sensitive" : ""}</small></label>{field.purpose ? <small>{field.purpose} Only staff with specific admissions permissions can access sensitive information.</small> : null}{field.kind === "textarea" ? <textarea id={field.key} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} onBlur={e => commit(e.target.value)} /> : field.kind === "select" ? <select id={field.key} disabled={disabled} value={value} onChange={e => { onChange(e.target.value); commit(e.target.value); }}><option value="">Select an option</option>{policy.choices?.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select> : field.kind === "checkbox" || field.kind === "boolean" ? <label><input id={field.key} type="checkbox" disabled={disabled} checked={value === "true"} onChange={e => { onChange(e.target.checked); commit(e.target.checked); }} /> Yes</label> : field.kind === "multi_select" ? <select id={field.key} multiple disabled={disabled} value={safeArray(value)} onChange={e => { const selected = Array.from(e.currentTarget.selectedOptions, option => option.value); onChange(selected); commit(selected); }}>{policy.choices?.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select> : <input id={field.key} type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} onBlur={e => commit(e.target.value)} />}{field.helpText ? <small>{field.helpText}</small> : null}</div>;
}
function safeArray(value: string) { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function Documents({ requirements, documents, disabled, onOpen, onUpload }: { requirements: Requirement[]; documents: Array<{ documentKey: string; requirementKey: string | null; fileName: string; state: string; version: number }>; disabled: boolean; onOpen: (documentKey: string) => Promise<void>; onUpload: (key: string, file: File) => Promise<void> }) { const [selected, setSelected] = useState<Record<string, File | undefined>>({}); const [status, setStatus] = useState("Choose a file, then upload privately."); return <section><h2>Private documents</h2><p className="muted">Files are checked before binding and are not shown as public links.</p><p className="status" role="status">{status}</p>{documents.map(document => <div className="upload" key={document.documentKey}><strong>{document.fileName}</strong> · version {document.version} · {document.state}<button type="button" className="secondary" onClick={async () => { try { await onOpen(document.documentKey); } catch { setStatus("This document is not available for checked access."); } }}>View my document</button></div>)}{requirements.map(requirement => <div className="upload" key={requirement.key}><strong>{requirement.label} · {requirement.requiredMode === "required" ? "Required" : "Optional"}</strong><p className="muted">{requirement.purpose} · up to {(requirement.maxBytes / 1_000_000).toFixed(1)} MB · {requirement.maxFiles} file(s)</p><input aria-label={`Choose file for ${requirement.label}`} type="file" accept={requirement.acceptedMimeTypes.join(",")} disabled={disabled} onChange={e => setSelected({ ...selected, [requirement.key]: e.target.files?.[0] })}/><button type="button" className="secondary" disabled={disabled || !selected[requirement.key]} onClick={async () => { const file = selected[requirement.key]; if (!file) return; if (file.size > requirement.maxBytes || !requirement.acceptedMimeTypes.includes(file.type)) { setStatus("This file does not meet the listed type or size requirements."); return; } setStatus("Uploading privately…"); try { await onUpload(requirement.key, file); setStatus("Uploaded. This file is private and will be checked with your application."); setSelected({ ...selected, [requirement.key]: undefined }); } catch { setStatus("This file could not be added. Choose another file or retry upload."); } }}>Upload privately</button></div>)}</section>; }
function PaymentReturn({ schoolSlug, reference }: { schoolSlug: string; reference: string }) { const router = useRouter(); const verify = useAction(functionRef("functions/admissions/public:verifyReturnByReference")); const reserve = useMutation(functionRef("functions/admissions/public:createOrResumeForReference")); const [state, setState] = useState("Payment pending"); const [ready, setReady] = useState(false); const check = async () => { try { const result: any = await verify({ reference }); const paid = result.state === "paid" && result.entitlementAvailable; setReady(paid); setState(paymentStatusCopy(paid ? "paid" : result.state)); } catch { setState(paymentStatusCopy("manual_attention")); } }; const continueToApplication = async () => { try { const application: any = await reserve({ schoolSlug, reference }); localStorage.removeItem(checkoutKey(schoolSlug)); localStorage.setItem(referenceKey(schoolSlug), application.publicReference); router.push(applicationPath(schoolSlug, application.publicReference)); } catch { setState("Payment is confirmed, but the application slot is not available yet. Check again shortly."); } }; return <section className="card"><h2>Confirming your payment</h2><p aria-live="polite">{state}</p><button type="button" className="secondary" onClick={() => void check()}>Check again</button>{ready ? <button type="button" className="primary" onClick={() => void continueToApplication()}>Start one child application</button> : null}</section>; }
function Input({ id, label, value, onChange, type = "text", required = false, disabled = false, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; autoComplete?: string }) { return <div className="field"><label htmlFor={id}>{label} {required ? <small>Required</small> : null}</label><input id={id} type={type} autoComplete={autoComplete ?? (type === "email" ? "email" : undefined)} required={required} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} /></div>; }
function Availability({ state, opensAt }: { state: string; opensAt?: number }) { return <div className="notice warn"><h2>This application link is not currently open</h2><p>{state === "upcoming" && opensAt ? `Applications open ${new Date(opensAt).toLocaleDateString()}.` : "Check the link or contact the school for current admissions information."}</p></div>; }
function Unavailable() { return <Page><section className="card"><h1>This application link is not available.</h1><p className="muted">Please check the link or contact the school for current admissions information.</p></section></Page>; }
function Page({ children }: { children: React.ReactNode }) { return <><a className="skip" href="#content">Skip to main content</a><header className="top"><span className="brand">Apply · School admissions</span><span className="muted">Private guardian journey</span></header><main id="content" className="shell">{children}</main></>; }
