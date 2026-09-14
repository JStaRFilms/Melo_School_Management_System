"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { SchoolThemeProvider } from "@school/shared/theme";
import { appToast } from "@school/shared/toast";
import type { Id } from "@school/convex/_generated/dataModel";
import {
  createAttemptRef, createOrResumeApplicationRef, finalizeUploadRef, getDraftRef, getOrCreateGuardianIdentityRef, getOwnedApplicationByPublicIdRef, getOwnDocumentAccessRef, getPublishedOfferingRef, initializeAttemptRef, listGuardianWorkspaceBySlugRef, listPublishedOfferingsRef, requestUploadIntentRef, saveDraftRef, submitApplicationRef, verifyReturnRef,
  type OfferingSummary, type WorkspaceResult,
} from "@school/convex/functions/admissions/refs";
import { authClient } from "@/lib/auth-client";
import { answerDisplay, answerPayload, applicationStateMessage, availabilityMessage, canCheckPayment, canContinueCheckout, conditionMatchesAnswers, correctionAllows, dateInputToUtcTimestamp, documentSelectionError, fieldOptions, formatFileSize, formatMoney, isDraftConflict, missingRequiredItemLabels, multiSelectValues, paymentMessage, shortenPaymentReference, validateSubmissionInput } from "@/lib/journey";

export function guardianFacingErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "";
  if (/VERIFICATION_REQUIRED|verify your email/i.test(raw)) return "Verify your email before continuing. Use the link in the verification message, then retry.";
  if (/OFFERING_UNAVAILABLE/i.test(raw)) return "Online payment is not available for this school yet. Ask the school to finish its payment setup.";
  if (/Storage entitlement is not active/i.test(raw)) return "Document uploads are temporarily unavailable because the school has not finished its storage setup. Contact the school before submitting.";
  if (/APPLICATION_INCOMPLETE/i.test(raw)) return "Complete every required question and document before submitting.";
  if (/Document requirement file limit reached/i.test(raw)) return "This document requirement already has the maximum number of files.";
  if (/Document does not satisfy the published type and size requirement/i.test(raw)) return "Choose a file that matches the displayed type and size limits.";
  if (/DRAFT_VERSION_CONFLICT|CAMPAIGN_DRAFT_CONFLICT/i.test(raw)) return "This information changed in another session. Reload the latest version and try again.";
  if (/FRESH_AUTH_REQUIRED|Fresh authentication/i.test(raw)) return "Your sign-in is too old for this secure action. Sign out, sign in again, and retry.";
  if (/PAYMENT_TERMS_MISMATCH|Confirmed payment terms do not match/i.test(raw)) return "The confirmed payment terms do not match this purchase attempt. Review the displayed fee and refund policy, then confirm them again.";
  if (/PAYMENT_REVIEW_REQUIRED|requires review/i.test(raw)) return "This payment needs review. Copy the payment reference and contact the school before trying another checkout.";
  if (/initialization was declined/i.test(raw)) return "The payment provider declined to open checkout. No payment was taken; contact the school if this continues.";
  if (/initialization is unavailable|cannot be initialized/i.test(raw)) return "Secure checkout cannot continue from this payment state. Check the payment status or contact the school.";
  if (/FORBIDDEN|UNAUTHORIZED|NOT_FOUND_OR_DENIED/i.test(raw)) return "You do not have access to complete this action.";
  if (/Failed to fetch|NetworkError|network request/i.test(raw)) return "The service could not be reached. Check your connection and try again.";
  return "We could not complete that request. Please try again.";
}
const errorMessage = guardianFacingErrorMessage;
function applyCallbackURL(path: string) {
  return typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();
}
export function openGuardianAdmissionsDocument(url: string, openedWindow?: Window | null) {
  if (!/^\/api\/admissions\/documents\/[a-f0-9]{64}$/.test(url)) throw new Error("Document access requires a recent sign-in or is unavailable.");
  if (openedWindow) openedWindow.location.assign(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
function reserveDocumentWindow() { const openedWindow = window.open("about:blank", "_blank"); if (openedWindow) openedWindow.opener = null; return openedWindow; }
function statusLabel(value: string) { return value.replaceAll("_", " "); }
function key() { return crypto.randomUUID().replaceAll("-", ""); }
function useOfferingNow() { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []); return now; }

function Frame({ schoolSlug, children }: { schoolSlug: string; children: React.ReactNode }) {
  const catalogue = useQuery(listPublishedOfferingsRef, { schoolSlug, now: useOfferingNow() });
  const school = catalogue?.available ? catalogue.school : null;
  return <SchoolThemeProvider primaryColor={school?.primaryColor} accentColor={school?.accentColor} className="apply-theme"><div className="apply-shell"><header className="apply-header"><Link href={`/s/${encodeURIComponent(schoolSlug)}`}>{school?.name ?? "School applications"}</Link><Link href={`/s/${encodeURIComponent(schoolSlug)}/account`}>My applications</Link></header>{children}</div></SchoolThemeProvider>;
}

export function AuthPanel({ schoolSlug }: { schoolSlug: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [name, setName] = useState(""), [register, setRegister] = useState(false), [status, setStatus] = useState(""), [verificationPending, setVerificationPending] = useState(false);
  const callbackURL = applyCallbackURL(`/s/${encodeURIComponent(schoolSlug)}/account`);
  async function resendVerification() { setStatus("Sending a new verification email…"); try { const result = await authClient.sendVerificationEmail({ email, callbackURL }); if (result.error) throw new Error(result.error.message); setVerificationPending(true); setStatus("Verification email sent. Open the link in that email, then return here and sign in."); appToast.success("Verification email sent", { description: "Open the new message to verify your email address." }); } catch (error) { const message = errorMessage(error); setStatus(message); appToast.error("Verification email could not be sent", { description: message }); } }
  async function submit(event: React.FormEvent) { event.preventDefault(); setStatus(register ? "Creating your account…" : "Signing in…"); try { if (register) { const result = await authClient.signUp.email({ email, password, name, callbackURL }); if (result.error) throw new Error(result.error.message); setVerificationPending(true); setStatus("Account created. Check your email, verify it, then return here to sign in."); } else { const result = await authClient.signIn.email({ email, password, callbackURL }); if (result.error) { if (/verify|verified/i.test(result.error.message ?? "")) setVerificationPending(true); throw new Error(result.error.message); } setStatus("Signed in. You can continue to your application workspace."); } } catch (error) { setStatus(errorMessage(error)); } }
  if (isPending) return <p role="status">Checking sign-in…</p>;
  if (session?.user) return <div className="status success"><strong>Signed in as {session.user.email}</strong><div className="actions"><Link className="primary" href={`/s/${encodeURIComponent(schoolSlug)}/account`}>Open my applications</Link><button className="secondary" onClick={() => void authClient.signOut()}>Sign out</button></div></div>;
  return <form onSubmit={(event) => void submit(event)}><h2>{register ? "Create guardian account" : "Guardian sign in"}</h2>{register ? <label className="field">Your name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label> : null}<label className="field">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field">Password<input required minLength={8} type="password" autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="actions"><button className="primary">{register ? "Create account" : "Sign in"}</button><button type="button" className="secondary" onClick={() => setRegister((value) => !value)}>{register ? "Use existing account" : "Create account"}</button>{verificationPending && email ? <button type="button" className="secondary" onClick={() => void resendVerification()}>Resend verification email</button> : null}</div>{status ? <p className="status" role="status" aria-live="polite">{status}</p> : null}</form>;
}

export function SchoolLanding({ schoolSlug }: { schoolSlug: string }) {
  const data = useQuery(listPublishedOfferingsRef, { schoolSlug, now: useOfferingNow() });
  return <Frame schoolSlug={schoolSlug}><main>{data === undefined ? <section className="apply-card"><p role="status">Loading current admissions information…</p></section> : !data.available ? <section className="apply-card"><h1>Applications unavailable</h1><p className="status warn">This school does not currently have an available admissions workspace.</p></section> : <><section className="apply-card"><h1>{data.school.name} applications</h1><p className="muted">Choose an intake to see its authoritative availability and published fee information.</p>{data.offerings.length ? data.offerings.map((offer) => <Offering key={offer.intakeSlug} schoolSlug={schoolSlug} offer={offer} />) : <p className="status warn">No published intakes are currently listed.</p>}</section><section className="apply-card"><AuthPanel schoolSlug={schoolSlug} /></section></>}</main></Frame>;
}

function Offering({ schoolSlug, offer }: { schoolSlug: string; offer: OfferingSummary }) { return <article className="offer"><div><span className={`pill ${offer.availability}`}>{statusLabel(offer.availability)}</span><h2>{offer.programmeName ?? offer.intakeName}</h2><p className="muted">{offer.intakeName} · {offer.cycleLabel}</p><p>{availabilityMessage(offer.availability, offer.opensAt)}</p>{offer.amountMinor !== null && offer.currency && offer.feeDisclosure ? <div><strong>{formatMoney(offer.amountMinor, offer.currency)}</strong><p>{offer.feeDisclosure}</p><p className="muted">Refund policy: {offer.refundPolicyKey}</p></div> : <p className="muted">No currently effective published fee is available.</p>}</div><div><Link className="secondary" href={`/s/${encodeURIComponent(schoolSlug)}/i/${encodeURIComponent(offer.intakeSlug)}`}>View intake</Link></div></article>; }

export function IntakeLanding({ schoolSlug, intakeSlug }: { schoolSlug: string; intakeSlug: string }) {
  const data = useQuery(getPublishedOfferingRef, { schoolSlug, intakeSlug, now: useOfferingNow() });
  return <Frame schoolSlug={schoolSlug}><main><section className="apply-card">{data === undefined ? <p role="status">Loading published offering…</p> : !data.available ? <><h1>Intake unavailable</h1><p className="status warn">{availabilityMessage(data.link.availability, data.link.opensAt ?? undefined)}</p></> : <><span className="pill open">open</span><h1>{data.programme.name}</h1><p>{data.programme.description}</p><h2>{data.intake.name} · {data.intake.cycleLabel}</h2><p>Applications close {new Date(data.intake.closesAt).toLocaleString()}.</p><div className="status"><strong>{formatMoney(data.price.amountMinor, data.price.currency)}</strong><p>{data.price.feeDisclosure}</p><p>Refund policy: {data.price.refundPolicyKey}</p></div><p className="muted">Payment purchases one application slot for one child. Payment does not mean admission.</p></>}</section><section className="apply-card"><AuthPanel schoolSlug={schoolSlug} /></section></main></Frame>;
}

function VerificationRecovery({ email, retry }: { email: string; retry: () => void }) {
  const [status, setStatus] = useState("");
  async function resend() { setStatus("Sending verification email…"); try { const result = await authClient.sendVerificationEmail({ email, callbackURL: applyCallbackURL(window.location.pathname) }); if (result.error) throw new Error(result.error.message); setStatus("Verification email sent. Use its link, then return and retry."); appToast.success("Verification email sent", { description: "Open the new message to verify your email address." }); } catch (error) { const message = errorMessage(error); setStatus(message); appToast.error("Verification email could not be sent", { description: message }); } }
  return <div className="status warn"><p>Verify this email before applying. If verification is complete, retry identity setup.</p><div className="actions"><button className="secondary" onClick={() => void resend()}>Resend verification email</button><button className="secondary" onClick={retry}>Retry verified identity</button><button className="secondary" onClick={() => void authClient.signOut()}>Sign out</button></div>{status ? <p role="status">{status}</p> : null}</div>;
}

function useGuardianReady() {
  const { data: session, isPending } = authClient.useSession();
  const convex = useConvexAuth();
  const createIdentity = useMutation(getOrCreateGuardianIdentityRef);
  const [identity, setIdentity] = useState<"idle" | "loading" | "ready" | "error">("idle"), [error, setError] = useState("");
  useEffect(() => { if (!session?.user || !convex.isAuthenticated || identity !== "idle") return; setIdentity("loading"); void createIdentity({}).then(() => setIdentity("ready")).catch((cause) => { const message = errorMessage(cause); setError(message); setIdentity("error"); appToast.warning("Email verification required", { description: message, id: "guardian-verification-required" }); }); }, [convex.isAuthenticated, createIdentity, identity, session?.user]);
  return { session, loading: isPending || convex.isLoading || identity === "loading", ready: Boolean(session?.user) && convex.isAuthenticated && identity === "ready", error, retry: () => { setError(""); setIdentity("idle"); } };
}

type PaymentAttempt = Omit<WorkspaceResult["attempts"][number], "createdAt"> & { createdAt?: number };

export function PaymentAttemptCard({ attempt, busy, confirmed, onConfirm, onContinue, onCheck, onCopy }: { attempt: PaymentAttempt; busy: boolean; confirmed: boolean; onConfirm: (confirmed: boolean) => void; onContinue: (attempt: PaymentAttempt) => void; onCheck: (attempt: PaymentAttempt) => void; onCopy: (attempt: PaymentAttempt) => void }) {
  const terms = attempt.terms;
  return <article className="offer"><div><strong>{formatMoney(terms.amountMinor, terms.currency)}</strong><span className={`pill ${attempt.state}`}>{statusLabel(attempt.state)}</span><p>{terms.feeDisclosure}</p><p className="muted">Refund policy: {terms.refundPolicyKey}</p><p>{paymentMessage(attempt.state)}</p><p className="muted">Reference: <code>{shortenPaymentReference(attempt.reference)}</code></p>{canContinueCheckout(attempt.state) ? <label className="field"><span><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => onConfirm(event.target.checked)} /> I confirm these purchase-attempt fee and refund terms. I understand payment buys one application slot and does not mean admission or reserve a place.</span></label> : null}</div><div className="actions">{canContinueCheckout(attempt.state) ? <button className="primary" disabled={busy || !confirmed} onClick={() => onContinue(attempt)}>{attempt.state === "created" ? "Continue secure checkout" : "Resume secure checkout"}</button> : null}{canCheckPayment(attempt.state) ? <button className="secondary" disabled={busy} onClick={() => onCheck(attempt)}>Check payment</button> : null}<button className="secondary" disabled={busy} onClick={() => onCopy(attempt)}>Copy reference</button></div></article>;
}

export function CheckoutOffer({ offer, busy, confirmed, onConfirm, onCheckout }: { offer: OfferingSummary & { productSlug: string; amountMinor: number; currency: string }; busy: boolean; confirmed: boolean; onConfirm: (confirmed: boolean) => void; onCheckout: () => void }) {
  return <article className="offer"><div><strong>{offer.productName} · {formatMoney(offer.amountMinor, offer.currency)}</strong><p>{offer.feeDisclosure}</p><p className="muted">Refund policy: {offer.refundPolicyKey ?? "Contact the school for the published policy."}</p><label className="field"><span><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => onConfirm(event.target.checked)} /> I confirm this fee and refund policy. I understand payment buys one application slot and does not mean admission or reserve a place.</span></label></div><button className="primary" disabled={busy || !confirmed} onClick={onCheckout}>Start secure checkout</button></article>;
}

export function GuardianAccount({ schoolSlug }: { schoolSlug: string }) {
  const guardian = useGuardianReady(); const router = useRouter();
  const workspace = useQuery(listGuardianWorkspaceBySlugRef, guardian.ready ? { schoolSlug, limit: 100 } : "skip");
  const catalogue = useQuery(listPublishedOfferingsRef, { schoolSlug, now: useOfferingNow() });
  const createAttempt = useMutation(createAttemptRef), initialize = useAction(initializeAttemptRef), verify = useAction(verifyReturnRef), reserve = useMutation(createOrResumeApplicationRef);
  const [status, setStatus] = useState("Your payment and application states come from server records."), [busy, setBusy] = useState(false), [confirmedProduct, setConfirmedProduct] = useState<string | null>(null), [confirmedAttemptTerms, setConfirmedAttemptTerms] = useState<string | null>(null), [createdAttempt, setCreatedAttempt] = useState<PaymentAttempt | null>(null);
  if (!guardian.session?.user) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><AuthPanel schoolSlug={schoolSlug} /></section></Frame>;
  async function continueCheckout(attempt: PaymentAttempt) { setBusy(true); setStatus("Opening the existing secure checkout…"); try { const initialized = await initialize({ reference: attempt.reference, confirmedTermsDigest: attempt.terms.termsDigest, returnOrigin: window.location.origin }); setStatus(paymentMessage(initialized.state)); window.location.assign(initialized.authorizationUrl); } catch (error) { const text = errorMessage(error); setStatus(text); appToast.error("Checkout could not continue", { description: text }); setBusy(false); } }
  async function checkout(productSlug: string) { setBusy(true); setStatus("Creating or recovering a purchase attempt…"); try { const attempt = await createAttempt({ schoolSlug, productSlug, idempotencyKey: key() }); setCreatedAttempt(attempt); setConfirmedProduct(null); setConfirmedAttemptTerms(null); setStatus(attempt.replayed ? "An unresolved payment attempt was found. Review and confirm that attempt’s displayed terms before continuing." : "The purchase attempt is ready. Review and confirm its displayed terms before continuing."); } catch (error) { const text = errorMessage(error); setStatus(text); appToast.error("Checkout could not start", { description: text }); } finally { setBusy(false); } }
  async function checkPayment(attempt: PaymentAttempt) { setBusy(true); setStatus("Checking this payment securely with the provider…"); try { const result = await verify({ reference: attempt.reference }); setCreatedAttempt(result); const text = paymentMessage(result.state); setStatus(text); if (result.state === "paid") appToast.success("Payment verified", { description: text }); else appToast.info("Payment status checked", { description: text }); } catch (error) { const text = errorMessage(error); setStatus(text); appToast.error("Payment could not be checked", { description: text }); } finally { setBusy(false); } }
  async function copyReference(attempt: PaymentAttempt) { setBusy(true); try { await navigator.clipboard.writeText(attempt.reference); setStatus("Payment reference copied."); appToast.success("Payment reference copied"); } catch { const text = "The payment reference could not be copied. Try again or contact the school."; setStatus(text); appToast.error("Reference could not be copied", { description: text }); } finally { setBusy(false); } }
  async function start(entitlementId: Id<"admissionsEntitlements">) { setBusy(true); setStatus("Starting this child’s application…"); try { const application = await reserve({ entitlementId }); router.push(`/s/${encodeURIComponent(schoolSlug)}/applications/${encodeURIComponent(application.publicId)}`); } catch (error) { const text = errorMessage(error); setStatus(text); appToast.error("Application could not start", { description: text }); setBusy(false); } }
  const attempts = workspace ? (createdAttempt && !workspace.attempts.some((attempt) => attempt.reference === createdAttempt.reference) ? [createdAttempt, ...workspace.attempts] : workspace.attempts) : createdAttempt ? [createdAttempt] : [];
  return <Frame schoolSlug={schoolSlug}><main><section className="apply-card"><h1>My applications</h1><p role="status" aria-live="polite" className="status">{guardian.error || status}</p>{guardian.error ? <VerificationRecovery email={guardian.session.user.email} retry={guardian.retry} /> : guardian.loading || workspace === undefined ? <p>Loading owned slots and applications…</p> : <div className="apply-grid two">{workspace.applications.map((application) => <article className="apply-card" key={application.applicationId}><span className={`pill ${application.state}`}>{statusLabel(application.state)}</span><h2>Application {application.publicId}</h2><p>{applicationStateMessage(application.state)}</p><p>Revision {application.currentRevision} · draft version {application.draftVersion}</p><Link className="primary" href={`/s/${encodeURIComponent(schoolSlug)}/applications/${encodeURIComponent(application.publicId)}`}>Resume or view status</Link></article>)}{workspace.entitlements.filter((slot) => slot.state === "available").map((slot) => <article className="apply-card" key={slot.entitlementId}><span className="pill paid">paid slot</span><h2>One-child application slot</h2><p>A paid slot lets you submit one application. It is not admission and does not reserve a school place.</p><button className="primary" disabled={busy} onClick={() => void start(slot.entitlementId)}>Start this child’s application</button></article>)}</div>}</section><section className="apply-card"><h2>Purchase attempts</h2>{attempts.length ? attempts.map((attempt) => { const confirmationKey = `${attempt.reference}:${attempt.terms.termsDigest}`; return <PaymentAttemptCard key={attempt.reference} attempt={attempt} busy={busy} confirmed={confirmedAttemptTerms === confirmationKey} onConfirm={(checked) => setConfirmedAttemptTerms(checked ? confirmationKey : null)} onContinue={(item) => void continueCheckout(item)} onCheck={(item) => void checkPayment(item)} onCopy={(item) => void copyReference(item)} />; }) : <p className="muted">No purchase attempts yet.</p>}</section><section className="apply-card"><h2>Buy another one-child slot</h2>{catalogue?.available ? catalogue.offerings.map((item) => { if (item.availability !== "open" || !item.productSlug || item.amountMinor === null || !item.currency) return null; const productSlug = item.productSlug; const confirmed = confirmedProduct === productSlug; return <CheckoutOffer key={item.intakeSlug} offer={{ ...item, productSlug, amountMinor: item.amountMinor, currency: item.currency }} busy={busy} confirmed={confirmed} onConfirm={(checked) => setConfirmedProduct(checked ? productSlug : null)} onCheckout={() => void checkout(productSlug)} />; }) : <p className="muted">No purchasable offering is currently available.</p>}</section></main></Frame>;
}

export function PaystackReturn({ schoolSlug, reference }: { schoolSlug: string; reference: string | null }) {
  const guardian = useGuardianReady(); const verify = useAction(verifyReturnRef); const [state, setState] = useState<"idle" | "checking" | "done" | "retry">("idle"), [paymentState, setPaymentState] = useState<string | null>(null), [status, setStatus] = useState("Waiting to verify the owned payment on the server."), [checks, setChecks] = useState(0);
  useEffect(() => { if (!guardian.ready || !reference || state !== "idle" || checks >= 3) return; setState("checking"); setChecks((value) => value + 1); setStatus("Verifying payment with Paystack on the server…"); void verify({ reference }).then((result) => { setPaymentState(result.state); setStatus(paymentMessage(result.state)); setState(canCheckPayment(result.state) ? "retry" : "done"); }).catch((error) => { setState("retry"); setStatus(errorMessage(error)); }); }, [checks, guardian.ready, reference, state, verify]);
  const tone = paymentState === "paid" ? "success" : state === "retry" ? "warn" : paymentState === "failed" || paymentState === "reversed" ? "error" : "";
  return <Frame schoolSlug={schoolSlug}><section className="apply-card"><h1>Payment return</h1>{!reference ? <p className="status error">No payment reference was provided. No payment claim has been accepted.</p> : <p className={`status ${tone}`} role="status" aria-live="polite">{status}</p>}<p className="muted">This page never trusts success text in the URL. A paid state appears only after backend verification. Verification checks are limited to three per page visit.</p>{state === "retry" && checks < 3 ? <button className="secondary" onClick={() => setState("idle")}>Check payment again</button> : null}{state === "retry" && checks >= 3 ? <p className="status warn">The check limit was reached. Return to your applications and try again later.</p> : null}<Link className="primary" href={`/s/${encodeURIComponent(schoolSlug)}/account`}>Return to my applications</Link></section></Frame>;
}

export function GuardianApplication({ schoolSlug, publicId }: { schoolSlug: string; publicId: string }) {
  const guardian = useGuardianReady();
  const owned = useQuery(getOwnedApplicationByPublicIdRef, guardian.ready ? { schoolSlug, publicId } : "skip");
  const draft = useQuery(getDraftRef, owned ? { applicationId: owned.applicationId } : "skip");
  if (!guardian.session?.user) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><AuthPanel schoolSlug={schoolSlug} /></section></Frame>;
  if (guardian.error) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><h1>Identity verification required</h1><p role="alert">{guardian.error}</p><VerificationRecovery email={guardian.session.user.email} retry={guardian.retry} /></section></Frame>;
  if (owned === null) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><h1>Application unavailable</h1><p>This reference is not owned by the signed-in guardian.</p></section></Frame>;
  if (!owned || !draft) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><p role="status">Loading your private application…</p></section></Frame>;
  return <ApplicationForm schoolSlug={schoolSlug} applicationId={owned.applicationId} draft={draft} financialHold={owned.financialHold} safeMessages={owned.safeMessages} conversion={owned.conversion} />;
}

type Draft = NonNullable<ReturnType<typeof useQuery<typeof getDraftRef>>>;
export function ApplicationForm({ schoolSlug, applicationId, draft, financialHold, safeMessages, conversion }: { schoolSlug: string; applicationId: Id<"admissionsApplications">; draft: Draft; financialHold: boolean; safeMessages: string[]; conversion: { state: "processing" | "completed" | "needs_attention"; message: string; admissionNumber: string | null } | null }) {
  const saveMutation = useMutation(saveDraftRef), submitMutation = useMutation(submitApplicationRef), requestIntent = useMutation(requestUploadIntentRef), finalize = useMutation(finalizeUploadRef), getOwnAccess = useMutation(getOwnDocumentAccessRef);
  const initialized = useRef(false); const [version, setVersion] = useState(draft.draftVersion), [status, setStatus] = useState("All displayed values are loaded from the server."), [conflict, setConflict] = useState(false), [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ firstName: "", middleName: "", lastName: "", dateOfBirth: "" }), [contact, setContact] = useState({ fullName: "", relationship: "", email: "", phone: "" }), [entry, setEntry] = useState(""), [answers, setAnswers] = useState<Record<string, string>>({}), [signerName, setSignerName] = useState(""), [signerRelationship, setSignerRelationship] = useState(""), [accepted, setAccepted] = useState(false);
  const [upload, setUpload] = useState<{ progress: number; status: string; intentId?: Id<"admissionsDocumentUploadIntents"> }>({ progress: 0, status: "No upload in progress." });
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const adoptServerDraft = useCallback(() => { setProfile({ firstName: draft.profile?.firstName ?? "", middleName: draft.profile?.middleName ?? "", lastName: draft.profile?.lastName ?? "", dateOfBirth: draft.profile ? new Date(draft.profile.dateOfBirth).toISOString().slice(0, 10) : "" }); setContact({ fullName: draft.primaryContact?.fullName ?? "", relationship: draft.primaryContact?.relationship ?? "", email: draft.primaryContact?.email ?? "", phone: draft.primaryContact?.phone ?? "" }); setEntry(draft.requestedEntryLabel ?? ""); setAnswers(Object.fromEntries(draft.answers.map((answer) => [answer.fieldKey, answerDisplay(draft.form.fields.find((field) => field.fieldKey === answer.fieldKey)?.kind ?? "text", answer.serializedValue)]))); setVersion(draft.draftVersion); setConflict(false); }, [draft]);
  useEffect(() => { if (initialized.current) return; initialized.current = true; adoptServerDraft(); }, [adoptServerDraft]);
  const editable = !financialHold && (draft.state === "draft" || draft.state === "changes_requested");
  const correctionKeys = draft.correction?.fieldKeys;
  const correctionScopeLabels = draft.correction ? [
    ...draft.correction.fieldKeys.map(statusLabel),
    ...draft.correction.requirementIds.map((requirementId) => draft.form.requirements.find((requirement) => requirement.requirementId === requirementId)?.label ?? "requested document"),
  ] : [];
  const fieldKinds = new Map(draft.form.fields.map((field) => [field.fieldKey, field.kind]));
  const fieldIsVisible = (field: Draft["form"]["fields"][number]) => field.requiredMode !== "conditional" || conditionMatchesAnswers(field.conditionalRuleJson, answers, fieldKinds);
  const requirementIsVisible = (requirement: Draft["form"]["requirements"][number]) => requirement.requiredMode !== "conditional" || conditionMatchesAnswers(requirement.conditionJson, answers, fieldKinds);
  async function save(clearAnswerKeys: string[] = [], quiet = false): Promise<number | null> {
    setSaving(true); setConflict(false); setStatus("Saving current application values to the server...");
    try {
      const hiddenAnswerKeys = draft.form.fields.filter((field) => !fieldIsVisible(field) && answers[field.fieldKey] && correctionAllows(draft.state, correctionKeys, field.fieldKey)).map((field) => field.fieldKey);
      const keysToClear = [...new Set([...clearAnswerKeys, ...hiddenAnswerKeys])];
      const payloadAnswers = draft.form.fields.filter((field) => fieldIsVisible(field) && answers[field.fieldKey]?.trim() && !keysToClear.includes(field.fieldKey) && correctionAllows(draft.state, correctionKeys, field.fieldKey)).map((field) => ({ fieldKey: field.fieldKey, ...answerPayload(field.kind, answers[field.fieldKey]) }));
      const result = await saveMutation({ applicationId, expectedVersion: version, mutationKey: key(), ...(correctionAllows(draft.state, correctionKeys, "requestedEntryLabel") ? { requestedEntryLabel: entry } : {}), ...(correctionAllows(draft.state, correctionKeys, "profile") ? { profile: { firstName: profile.firstName, lastName: profile.lastName, ...(profile.middleName ? { middleName: profile.middleName } : {}), dateOfBirth: dateInputToUtcTimestamp(profile.dateOfBirth) } } : {}), ...(correctionAllows(draft.state, correctionKeys, "primaryContact") ? { primaryContact: { fullName: contact.fullName, relationship: contact.relationship, ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { phone: contact.phone } : {}) } } : {}), answers: payloadAnswers, ...(keysToClear.length ? { clearAnswerKeys: keysToClear } : {}) });
      setVersion(result.draftVersion); setStatus(`Saved draft version ${result.draftVersion}.`); if (!quiet) appToast.success("Application saved"); return result.draftVersion;
    } catch (error) {
      if (isDraftConflict(error)) { setConflict(true); setStatus("A newer server version exists. Reload every server value before retrying; your current edits have not been submitted."); }
      else setStatus(errorMessage(error));
      return null;
    } finally { setSaving(false); }
  }
  async function uploadFile(requirementId: Id<"admissionsDocumentRequirements">, file: File) {
    const requirement = draft.form.requirements.find((candidate) => candidate.requirementId === requirementId);
    if (!requirement) return;
    const activeFileCount = draft.documents.filter((document) => document.requirementId === requirementId).length;
    const replacementAllowed = requirement.maxFiles === 1 && activeFileCount === 1 && (draft.state === "draft" || Boolean(draft.correction?.requirementIds.includes(requirementId)));
    const selectionError = documentSelectionError({ file, acceptedMimeTypes: requirement.acceptedMimeTypes, maxBytes: requirement.maxBytes, maxFiles: requirement.maxFiles, activeFileCount, replacementAllowed });
    if (selectionError) {
      setUpload({ progress: 0, status: selectionError });
      appToast.error("Document could not be uploaded", { description: selectionError });
      return;
    }
    setUpload({ progress: 0, status: "Calculating secure file fingerprint…" });
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const intent = await requestIntent({ applicationId, requirementId, fileName: file.name, contentType: file.type, size: file.size, sha256 });
      setUpload({ progress: 0, status: "Uploading…", intentId: intent.uploadIntentId });
      await xhrUpload(intent, file, (progress) => setUpload({ progress, status: `Uploading ${progress}%…`, intentId: intent.uploadIntentId }));
      await finalize({ uploadIntentId: intent.uploadIntentId });
      setUpload({ progress: 100, status: "Upload finalized securely." });
      appToast.success("Document uploaded");
    } catch (error) {
      const message = errorMessage(error);
      setUpload((current) => ({ ...current, status: `${message}${current.intentId ? " Use retry finalize if the transfer completed." : ""}` }));
      appToast.error("Document could not be uploaded", { description: message });
    }
  }
  function viewOwnDocument(documentKey: string) {
    const openedWindow = reserveDocumentWindow();
    void getOwnAccess({ documentKey, action: "view" }).then((result) => {
      if (result.status !== "available") throw new Error("Document access requires a recent sign-in or is unavailable.");
      openGuardianAdmissionsDocument(result.url, openedWindow);
    }).catch((error) => {
      openedWindow?.close();
      setUpload((current) => ({ ...current, status: errorMessage(error) }));
    });
  }
  async function submit() {
    const missingCoreItems = [
      !profile.firstName.trim() ? "Child first name" : null,
      !profile.lastName.trim() ? "Child last name" : null,
      !profile.dateOfBirth ? "Child date of birth" : null,
      !contact.fullName.trim() ? "Primary contact name" : null,
      !contact.relationship.trim() ? "Primary contact relationship" : null,
      !entry.trim() ? "Requested entry or class" : null,
    ].filter((item): item is string => Boolean(item));
    const missingPublishedItems = missingRequiredItemLabels({
      fields: draft.form.fields,
      requirements: draft.form.requirements.map((requirement) => ({ ...requirement, requirementId: String(requirement.requirementId) })),
      answers,
      fieldKinds,
      documents: draft.documents.map((document) => ({ requirementId: document.requirementId ? String(document.requirementId) : null, state: document.state })),
    });
    const validation = validateSubmissionInput({ signerName, signerRelationship, declarationAccepted: accepted });
    const message = validation ?? ([...missingCoreItems, ...missingPublishedItems].length ? `Complete these required items: ${[...missingCoreItems, ...missingPublishedItems].join(", ")}.` : null);
    if (message) {
      setSubmissionError(message);
      setStatus(message);
      appToast.error("Application is not ready to submit", { description: message });
      return;
    }
    setSubmissionError(null);
    setStatus("Saving current values before submission…");
    const savedVersion = await save([], true);
    if (savedVersion === null) {
      const blockedMessage = "Submission was blocked because the current values could not be saved. Review the message above and try again.";
      setSubmissionError(blockedMessage);
      appToast.error("Application could not be submitted", { description: blockedMessage });
      return;
    }
    setSaving(true);
    setStatus("Validating and submitting the saved immutable revision…");
    try {
      const result = await submitMutation({ applicationId, expectedVersion: savedVersion, submissionKey: key(), signerName, signerRelationship, declarationAccepted: accepted });
      setStatus(`Submitted immutable revision ${result.revision}.`);
      setSubmissionError(null);
      appToast.success("Application submitted");
    } catch (error) {
      const errorText = isDraftConflict(error) ? "Submission stopped because the draft changed again. Reload every server value before retrying." : errorMessage(error);
      if (isDraftConflict(error)) setConflict(true);
      setStatus(errorText);
      setSubmissionError(errorText);
      appToast.error("Application could not be submitted", { description: errorText });
    } finally {
      setSaving(false);
    }
  }
  if (!editable) return <Frame schoolSlug={schoolSlug}><section className="apply-card"><span className={`pill ${draft.state}`}>{statusLabel(draft.state)}</span><h1>Application status</h1><p className="status">Submitted revision {draft.currentRevision}. The application is read-only in this state.</p>{financialHold ? <p className="status error">A verified refund or reversal placed this application on financial hold.</p> : null}{safeMessages.map((safeMessage) => <p className="status" key={safeMessage}>{safeMessage}</p>)}{conversion ? <div className="status"><p><strong>Enrollment setup:</strong> {conversion.state}</p><p>{conversion.message}</p>{conversion.admissionNumber ? <p><strong>Admission number:</strong> {conversion.admissionNumber}</p> : null}</div> : null}<Link className="primary" href={`/s/${encodeURIComponent(schoolSlug)}/account`}>Back to my applications</Link></section></Frame>;
  return <Frame schoolSlug={schoolSlug}><main><section className="apply-card"><span className={`pill ${draft.state}`}>{statusLabel(draft.state)}</span><h1>Complete application</h1><p role="status" aria-live="polite" className={`status ${conflict ? "warn" : ""}`}>{status}</p>{conflict ? <div className="actions"><button className="secondary" disabled={draft.draftVersion === version} onClick={() => { adoptServerDraft(); setStatus(`Reloaded all values from server draft version ${draft.draftVersion}. Review them before retrying.`); }}>{draft.draftVersion === version ? "Waiting for latest server values..." : "Reload all server values"}</button></div> : null}{draft.correction ? <div className="correction"><h2>Corrections requested</h2><p>{draft.correction.message}</p><p className="muted">Scope: {correctionScopeLabels.join(", ")}</p></div> : null}<div className="apply-grid two"><fieldset disabled={!correctionAllows(draft.state, correctionKeys, "profile")}><legend><strong>Child profile</strong></legend>{(["firstName", "middleName", "lastName", "dateOfBirth"] as const).map((name) => <label className="field" key={name}>{name.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}<input required={name !== "middleName"} type={name === "dateOfBirth" ? "date" : "text"} value={profile[name]} onChange={(event) => setProfile((current) => ({ ...current, [name]: event.target.value }))} /></label>)}</fieldset><fieldset disabled={!correctionAllows(draft.state, correctionKeys, "primaryContact")}><legend><strong>Primary contact</strong></legend>{(["fullName", "relationship", "email", "phone"] as const).map((name) => <label className="field" key={name}>{name.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}<input required={name === "fullName" || name === "relationship"} type={name === "email" ? "email" : "text"} value={contact[name]} onChange={(event) => setContact((current) => ({ ...current, [name]: event.target.value }))} /></label>)}</fieldset></div><label className="field">Requested entry / class label<input required disabled={!correctionAllows(draft.state, correctionKeys, "requestedEntryLabel")} value={entry} onChange={(event) => setEntry(event.target.value)} /></label><h2>Published application questions, form version {draft.form.version}</h2>{draft.form.fields.filter(fieldIsVisible).map((field) => <PublishedField key={field.fieldKey} field={field} value={answers[field.fieldKey] ?? ""} disabled={!correctionAllows(draft.state, correctionKeys, field.fieldKey)} onChange={(value) => setAnswers((current) => ({ ...current, [field.fieldKey]: value }))} onClear={field.requiredMode === "optional" && answers[field.fieldKey] ? () => { setAnswers((current) => ({ ...current, [field.fieldKey]: "" })); void save([field.fieldKey]); } : undefined} />)}<div className="actions"><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save application"}</button></div></section><section className="apply-card"><h2>Required documents</h2><p className="muted">Uploads use the school’s general provisioned storage quota.</p>{draft.form.requirements.filter(requirementIsVisible).map((requirement) => { const canEdit = draft.state === "draft" || Boolean(draft.correction?.requirementIds.includes(requirement.requirementId)); const documents = draft.documents.filter((document) => document.requirementId === requirement.requirementId); const replacementAllowed = requirement.maxFiles === 1 && documents.length === 1 && (draft.state === "draft" || Boolean(draft.correction?.requirementIds.includes(requirement.requirementId))); const fileLimitReached = documents.length >= requirement.maxFiles && !replacementAllowed; return <article className="offer" key={requirement.requirementId}><strong>{requirement.label} {requirement.requiredMode !== "optional" ? "(required when shown)" : "(optional)"}</strong><p>Purpose: {requirement.purpose}</p><p className="muted">Sensitivity: {requirement.sensitivity.replaceAll("_", " ")} · {requirement.acceptedMimeTypes.join(", ")} · maximum {formatFileSize(requirement.maxBytes)} · {requirement.maxFiles} file{requirement.maxFiles === 1 ? "" : "s"} allowed</p>{documents.map((document) => <p key={document.documentKey}><span className={`pill ${document.state}`}>{statusLabel(document.state)}</span> version {document.version} <button className="secondary" onClick={() => viewOwnDocument(document.documentKey)}>View own document</button></p>)}{fileLimitReached ? <p className="status warn">The file limit has been reached for this requirement.</p> : null}<input aria-label={`Upload ${requirement.label}`} disabled={!canEdit || fileLimitReached} type="file" accept={requirement.acceptedMimeTypes.join(",")} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadFile(requirement.requirementId, file); }} /></article>; })}<progress className="progress" max="100" value={upload.progress}>{upload.progress}%</progress><p role="status">{upload.status}</p>{upload.intentId ? <FinalizeRetry uploadIntentId={upload.intentId} onStatus={(text) => setUpload((current) => ({ ...current, status: text }))} /> : null}</section><section className="apply-card"><h2>{draft.declaration.title} · version {draft.declaration.version}</h2><p>{draft.declaration.body}</p><p className="muted">Purpose: {draft.declaration.purpose}</p><label className="field">Signer name<input required value={signerName} onChange={(event) => setSignerName(event.target.value)} /></label><label className="field">Signer relationship<input required value={signerRelationship} onChange={(event) => setSignerRelationship(event.target.value)} /></label><label className="field"><span><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> I accept the published declaration shown above.</span></label>{submissionError ? <p role="alert" className="status error">{submissionError}</p> : null}<button className="primary" disabled={saving} onClick={() => void submit()}>Submit immutable revision</button></section></main></Frame>;
}

export function PublishedField({ field, value, disabled, onChange, onClear }: { field: Draft["form"]["fields"][number]; value: string; disabled: boolean; onChange: (value: string) => void; onClear?: () => void }) {
  const options = fieldOptions(field.validationJson);
  const required = field.requiredMode !== "optional";
  const guidance = [field.helpText, field.purpose ? `Purpose: ${field.purpose}` : null, field.dataClass !== "public" ? `Sensitive data: ${field.dataClass.replaceAll("_", " ")}.` : null].filter(Boolean).join(" ");
  let control: React.ReactNode;
  if (field.kind === "textarea") control = <textarea disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)} />;
  else if (field.kind === "boolean") control = <select disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select an answer</option><option value="true">Yes</option><option value="false">No</option></select>;
  else if (field.kind === "select") control = <select disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  else if (field.kind === "multi_select") { const selected = multiSelectValues(value); control = <select multiple disabled={disabled} required={required} value={selected} onChange={(event) => onChange(JSON.stringify(Array.from(event.currentTarget.selectedOptions, (option) => option.value)))}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
  else control = <input type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : field.kind === "email" ? "email" : field.kind === "phone" ? "tel" : "text"} disabled={disabled} required={required} value={value} onChange={(event) => onChange(event.target.value)} />;
  return <div><label className="field">{field.label} {required ? "(required when shown)" : "(optional)"}{control}</label>{guidance ? <p className="muted">{guidance}</p> : null}{onClear ? <button type="button" className="secondary" onClick={onClear}>Clear saved answer</button> : null}</div>;
}

function FinalizeRetry({ uploadIntentId, onStatus }: { uploadIntentId: Id<"admissionsDocumentUploadIntents">; onStatus: (text: string) => void }) { const finalize = useMutation(finalizeUploadRef); return <button className="secondary" onClick={() => void finalize({ uploadIntentId }).then(() => onStatus("Upload finalized on retry.")).catch((error) => onStatus(errorMessage(error)))}>Retry finalize</button>; }

function xhrUpload(intent: { uploadIntentId: Id<"admissionsDocumentUploadIntents">; uploadToken: string }, file: File, progress: (value: number) => void) { return new Promise<void>((resolve, reject) => { const request = new XMLHttpRequest(); request.open("POST", "/admissions/document-upload"); request.setRequestHeader("Content-Type", file.type); request.setRequestHeader("X-Admissions-Upload-Intent", intent.uploadIntentId); request.setRequestHeader("X-Admissions-Upload-Token", intent.uploadToken); request.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); }; request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("Secure upload was rejected.")); request.onerror = () => reject(new Error("Secure upload connection failed.")); request.send(file); }); }
