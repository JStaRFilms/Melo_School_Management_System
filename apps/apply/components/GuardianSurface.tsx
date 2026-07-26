"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { authClient, functionRef } from "../lib/client";

type Props = { schoolSlug: string; intakeSlug?: string; paymentReference?: string };
const referenceKey = (school: string) => `apply:last-reference:${school}`;

export function GuardianSurface({ schoolSlug, intakeSlug, paymentReference }: Props) {
  const router = useRouter();
  const entry = useQuery(functionRef("functions/admissions/public:getEntry"), { schoolSlug, ...(intakeSlug ? { intakeSlug } : {}) }) as any;
  const { data: session } = authClient.useSession();
  const getIdentity = useMutation(functionRef("functions/admissions/guardian:getOrCreateIdentity"));
  const createAttempt = useMutation(functionRef("functions/admissions/public:createAttemptForOffering"));
  const reserve = useMutation(functionRef("functions/admissions/public:createOrResumeForOffering"));
  const initializeAttempt = useAction(functionRef("functions/admissions/public:initializeAttemptByReference"));
  const verifyReturn = useAction(functionRef("functions/admissions/public:verifyReturnByReference"));
  const [notice, setNotice] = useState<string | null>(null);

  const begin = async () => {
    if (!session?.user) { router.push(`/s/${schoolSlug}/account`); return; }
    try {
      const identity: any = await getIdentity({});
      if (identity.verificationRequired) { setNotice("Verify your contact to protect this private application, then return here."); return; }
      const key = localStorage.getItem(`${referenceKey(schoolSlug)}:checkout`) ?? crypto.randomUUID();
      localStorage.setItem(`${referenceKey(schoolSlug)}:checkout`, key);
      const attempt: any = await createAttempt({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}), idempotencyKey: key });
      const checkout: any = await initializeAttempt({ reference: attempt.reference });
      if (checkout.state !== "checkout_pending" || !checkout.checkoutUrl) {
        setNotice(checkout.state === "paid" ? "Payment is already confirmed. Continue from your application workspace." : "We could not start secure checkout. Please try again.");
        return;
      }
      window.location.assign(checkout.checkoutUrl);
    } catch {
      setNotice("We could not start secure checkout. Verify your contact and try again.");
    }
  };

  const startPaidApplication = async () => {
    try {
      const application: any = await reserve({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}) });
      localStorage.removeItem(`${referenceKey(schoolSlug)}:checkout`);
      localStorage.setItem(referenceKey(schoolSlug), application.publicReference);
      router.push(`/s/${schoolSlug}/applications/${application.publicReference}`);
    } catch {
      setNotice("Your payment is confirmed, but an application slot is not available yet. Please check again shortly.");
    }
  };

  if (!entry) return <Page><p className="muted">Loading the published application information…</p></Page>;
  if (entry.availability === "unavailable") return <Unavailable />;
  const unavailable = entry.availability !== "open";
  return <Page><section className="card"><span className="pill">{entry.availability}</span><h1>{entry.programme?.name ?? "Application information"}</h1><p className="muted">{entry.intake?.name} · {entry.intake?.cycleLabel}</p>
    {unavailable ? <Availability state={entry.availability} opensAt={entry.intake?.opensAt} /> : <><p>Start a private application for one child. You can save and return after contact verification.</p><div className="notice"><strong>Before you begin</strong><p>One payment creates one application slot for one child. A payment does not confirm a place.</p>{entry.offering ? <p>Application fee: <strong>{entry.offering.amountMinor} {entry.offering.currency}</strong><br />{entry.offering.feeDisclosure}</p> : null}</div><div className="actions"><button className="primary" onClick={() => void begin}>Start one child application</button><a className="secondary" href={`/s/${schoolSlug}/account`}>Application workspace</a></div></>}
    {notice ? <p className="status" role="status">{notice}</p> : null}
  </section>{paymentReference ? <PaymentReturn reference={paymentReference} verify={verifyReturn} onPaid={startPaidApplication} /> : null}</Page>;
}

export function AccountSurface({ schoolSlug, intakeSlug }: Pick<Props, "schoolSlug" | "intakeSlug">) {
  const router = useRouter(); const { data: session } = authClient.useSession(); const stored = typeof window === "undefined" ? null : localStorage.getItem(referenceKey(schoolSlug));
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [authState, setAuthState] = useState<string | null>(null);
  const signIn = async (event: FormEvent) => { event.preventDefault(); setAuthState("Signing in…"); try { const result: any = await authClient.signIn.email({ email, password }); setAuthState(result?.error ? "We could not sign you in. Check your details and try again." : "Signed in. You can now return to the application."); } catch { setAuthState("We could not sign you in. Check your connection and try again."); } };
  return <Page><section className="card"><h1>Your application workspace</h1><p className="muted">Each application slot is for one child. Payment confirmation does not confirm admission.</p>{!session?.user ? <form onSubmit={signIn}><div className="notice"><strong>Sign in or create an account</strong><p>Verification protects your child&apos;s application and lets you return to it.</p></div><div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div><div className="actions"><button className="primary" type="submit">Sign in</button><button className="secondary" type="button" onClick={async()=>{setAuthState("Creating your account…"); try { const result: any = await authClient.signUp.email({ email, password, name: "Guardian" }); setAuthState(result?.error ? "We could not create your account. Check the details and try again." : "Account created. Verify your contact, then return here."); } catch { setAuthState("We could not create your account. Check your connection and try again."); }}}>Create an account</button></div>{authState ? <p className="status" role="status">{authState}</p> : null}</form> : <><div className="notice"><strong>Private account</strong><p>Verify your contact before starting or resuming an application.</p></div><div className="actions">{stored ? <button className="secondary" onClick={() => router.push(`/s/${schoolSlug}/applications/${stored}`)}>Resume saved application</button> : null}<a className="primary" href={`/s/${schoolSlug}${intakeSlug ? `/i/${intakeSlug}` : ""}`}>Start an application</a></div></>}</section></Page>;
}

export function ApplicationSurface({ schoolSlug, publicReference }: { schoolSlug: string; publicReference: string }) {
  const router = useRouter();
  const app = useQuery(functionRef("functions/admissions/public:getGuardianApplication"), { schoolSlug, publicReference }) as any;
  const config = useQuery(functionRef("functions/admissions/public:getPublishedConfiguration"), app?.intakeSlug ? { schoolSlug, intakeSlug: app.intakeSlug } : "skip") as any;
  const saveCore = useMutation(functionRef("functions/admissions/public:saveCoreByPublicReference"));
  const saveAnswer = useMutation(functionRef("functions/admissions/public:saveAnswerByPublicReference"));
  const submit = useMutation(functionRef("functions/admissions/public:submitByPublicReference"));
  const createUploadUrl = useMutation(functionRef("functions/admissions/public:createUploadUrlByPublicReference"));
  const bindUpload = useMutation(functionRef("functions/admissions/public:bindUploadByPublicReference"));
  const [step, setStep] = useState("child"); const [status, setStatus] = useState("Loading your private application…");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [core, setCore] = useState({ firstName: "", lastName: "", dateOfBirth: "", signerName: "", signerRelationship: "" });
  const fields = useMemo(() => (config?.fields ?? []).filter((field: any) => field.sectionKey === step && field.key !== "child_name"), [config, step]);
  if (!app || !config) return <Page><p className="muted">Loading your private application…</p></Page>;
  const editable = app.allowedActions.includes("save");
  const save = async (event: FormEvent) => { event.preventDefault(); setStatus("Saving…"); try { const version = await saveCore({ schoolSlug, publicReference, expectedVersion: app.draftVersion, firstName: core.firstName, lastName: core.lastName, dateOfBirth: Date.parse(core.dateOfBirth), ...(core.signerName ? { requestedEntryLabel: core.signerName } : {}) }); setStatus(`Saved. Current version ${version}.`); } catch { setStatus("Could not save. Keep this page open and retry."); } };
  const submitApplication = async () => { if (!config.declaration || !declarationAccepted) { setStatus("Read and accept the published declaration before submitting."); return; } setStatus("Submitting — checking status…"); try { const result = await submit({ schoolSlug, publicReference, expectedVersion: app.draftVersion, signerName: core.signerName, signerRelationship: core.signerRelationship, declarationVersion: config.declaration.version, declarationAccepted }); setStatus(`Application submitted. Revision ${result.revision} is now locked for review.`); router.refresh(); } catch { setStatus("Complete the highlighted items and accept the current declaration before submitting, then retry."); } };
  return <Page><div className="grid"><aside className="card" style={{gridColumn:"span 3"}}><p className="pill">{app.state}</p><ol className="stepper">{["child","documents","review"].map(item => <li key={item}><button aria-current={step===item ? "step" : undefined} onClick={() => setStep(item)}>{item === "child" ? "Child and entry" : item === "documents" ? "Documents" : "Review and declaration"}</button></li>)}</ol></aside><main className="card" style={{gridColumn:"span 9"}}><h1>{editable ? "Complete this application" : "Application status"}</h1><p className="status" aria-live="polite">{status}</p>{app.messages.map((message: any) => <div className="notice warn" key={message.createdAt}>{message.message ?? "The school updated your application status."}</div>)}
  {step === "child" && <form onSubmit={save}><fieldset className="fieldset" disabled={!editable}><div className="field"><label htmlFor="first">Legal first name <small>Required</small></label><input id="first" required value={core.firstName || app.profile?.firstName || ""} onChange={e=>setCore({...core,firstName:e.target.value})}/></div><div className="field"><label htmlFor="last">Legal last name <small>Required</small></label><input id="last" required value={core.lastName || app.profile?.lastName || ""} onChange={e=>setCore({...core,lastName:e.target.value})}/></div><div className="field"><label htmlFor="dob">Date of birth <small>Required</small></label><input id="dob" type="date" required value={core.dateOfBirth} onChange={e=>setCore({...core,dateOfBirth:e.target.value})}/></div>{fields.map((field:any)=><DynamicField key={field.key} field={field} disabled={!editable} onSave={async (value: string)=>{await saveAnswer({schoolSlug,publicReference,fieldKey:field.key,expectedVersion:app.draftVersion,valueType:"text",serializedValue:value})}}/>)}<div className="sticky"><button className="primary" type="submit">Save and continue</button></div></fieldset></form>}
  {step === "documents" && <Documents requirements={config.requirements} disabled={!editable} onUpload={async (requirementKey: string, file: File) => { const uploadUrl = await createUploadUrl({ schoolSlug, publicReference, requirementKey }); const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file }); if (!response.ok) throw new Error("Upload failed"); const { storageId } = await response.json(); await bindUpload({ schoolSlug, publicReference, requirementKey, storageId, fileName: file.name }); }}/>}  {step === "review" && <section><h2>Review and declaration</h2>{config.declaration ? <><h3>{config.declaration.title} · Version {config.declaration.version}</h3><p className="muted">{config.declaration.purpose}</p><p className="notice">{config.declaration.body}</p></> : <p className="notice warn">The current declaration is unavailable. This application cannot be submitted.</p>}<div className="field"><label htmlFor="signer">Signer name <small>Required to submit</small></label><input id="signer" value={core.signerName} onChange={e=>setCore({...core,signerName:e.target.value})}/></div><div className="field"><label htmlFor="relationship">Relationship <small>Required to submit</small></label><input id="relationship" value={core.signerRelationship} onChange={e=>setCore({...core,signerRelationship:e.target.value})}/></div><label><input type="checkbox" checked={declarationAccepted} onChange={e=>setDeclarationAccepted(e.target.checked)} required disabled={!editable || !config.declaration}/> I have read and accept the published declaration shown above.</label><div className="actions"><button className="primary" disabled={!editable || !config.declaration || !declarationAccepted} onClick={()=>void submitApplication()}>Submit application</button></div><p className="muted">Submitting locks this revision for review. It does not create a student or confirm admission.</p></section>}</main></div></Page>;
}

function Documents({ requirements, disabled, onUpload }: { requirements: any[]; disabled: boolean; onUpload: (key: string, file: File) => Promise<void> }) { const [selected, setSelected] = useState<Record<string, File | undefined>>({}); const [status, setStatus] = useState("Choose a file, then upload privately."); return <section><h2>Private documents</h2><p className="muted">Files are checked before binding and are not displayed as public links.</p><p className="status" role="status">{status}</p>{requirements.map(requirement=><div className="upload" key={requirement.key}><strong>{requirement.label}</strong><p className="muted">{requirement.purpose} · {requirement.requiredMode}</p><input aria-label={`Choose file for ${requirement.label}`} type="file" accept={requirement.acceptedMimeTypes.join(",")} disabled={disabled} onChange={e=>setSelected({...selected,[requirement.key]:e.target.files?.[0]})}/><button className="secondary" disabled={disabled || !selected[requirement.key]} onClick={async()=>{const file=selected[requirement.key]; if(!file)return; setStatus("Uploading privately…"); try { await onUpload(requirement.key,file); setStatus("Uploaded. This file is private and will be checked with your application."); } catch { setStatus("This file could not be added. Choose another file or retry upload."); }}}>Upload privately</button></div>)}</section>; }
function DynamicField({ field, disabled, onSave }: any) { const [value,setValue]=useState(""); return <div className="field"><label htmlFor={field.key}>{field.label} <small>{field.requiredMode}</small></label><input id={field.key} disabled={disabled} value={value} onBlur={()=>value && void onSave(value)} onChange={e=>setValue(e.target.value)}/><small>{field.purpose || field.helpText}</small></div>; }
function PaymentReturn({ reference, verify, onPaid }: any) { const [state,setState]=useState("Payment pending"); const [isReady,setIsReady]=useState(false); return <section className="card"><h2>Confirming your payment</h2><p aria-live="polite">{state}. A payment start does not reserve a school place.</p><button className="secondary" onClick={async()=>{try { const result=await verify({reference}); const paid=result.state === "paid" && result.entitlementAvailable; setIsReady(paid); setState(paid ? "Payment confirmed. Your application slot is ready." : result.state === "manual_attention" ? "Payment needs a check." : "We are still confirming your payment."); } catch { setState("Payment needs a check."); }}}>Check again</button>{isReady ? <button className="primary" onClick={()=>void onPaid()}>Start one child application</button> : null}</section>; }
function Availability({state,opensAt}:any){return <div className="notice warn"><h2>This application link is not currently open</h2><p>{state === "upcoming" && opensAt ? `Applications open ${new Date(opensAt).toLocaleDateString()}.` : "Check the link or contact the school for current admissions information."}</p></div>}
function Unavailable(){return <Page><section className="card"><h1>This application link is not available.</h1><p className="muted">Please check the link or contact the school for current admissions information.</p></section></Page>}
function Page({children}:{children:React.ReactNode}){return <><a className="skip" href="#content">Skip to main content</a><header className="top"><span className="brand">Apply · School admissions</span><span className="muted">Private guardian journey</span></header><div id="content" className="shell">{children}</div></>}
