"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getSignInErrorMessage } from "@school/auth";
import { authClient, functionRef } from "../lib/client";
import { applicationPath, applicationStatusCopy, fieldIsVisible, formatMinorCurrency, paymentStatusCopy, serializedValue, type PublishedField } from "../lib/journey";
import { guardianRegistrationErrorMessage, validateGuardianRegistration } from "../lib/registration";
import { type DraftSaveState, type RecoveryRecord, configuredFieldError, draftConnectivityStatus, fieldRequiresValue, isTransientSaveFailure, nextFormStep, readRecovery, recoveryKey, resetAutosaveDebounce, restoreEditableDraft, saveErrorCode, startAutosaveCeiling, SerializedWriteQueue } from "../lib/draftAutosave";

type Props = { schoolSlug: string; intakeSlug?: string; paymentReference?: string; checkoutIntent?: boolean };
type Field = PublishedField & { sectionKey: string; label: string; helpText: string | null; dataClass: string; purpose: string | null; validation: string };
type Requirement = { key: string; label: string; purpose: string; requiredMode: string; acceptedMimeTypes: string[]; maxBytes: number; maxFiles: number; sensitivity: string };
const referenceKey = (school: string) => `apply:last-reference:${school}`;
const checkoutKey = (school: string) => `${referenceKey(school)}:checkout`;
type CheckoutInitialization = { state: string; checkoutUrl: string | null };
const checkoutFlights = new Map<string, Promise<CheckoutInitialization>>();
type GuardianIdentityState = "idle" | "checking" | "ready" | "verification-required" | "error";

function useBrowserOnline() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);
  return isOnline;
}

function useGuardianReadiness() {
  const sessionResult = authClient.useSession();
  const session = sessionResult.data;
  const sessionPending = sessionResult.isPending;
  const refetchSession = sessionResult.refetch;
  const currentUserId = session?.user?.id;
  const isOnline = useBrowserOnline();
  const getIdentity = useMutation(functionRef("functions/admissions/guardian:getOrCreateIdentity"));
  const [identityState, setIdentityState] = useState<GuardianIdentityState>("idle");
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const [lastReadyUserId, setLastReadyUserId] = useState<string>();
  useEffect(() => {
    let active = true;
    if (!currentUserId) {
      setIdentityState("idle");
      return () => { active = false; };
    }
    setIdentityState("checking");
    void getIdentity({}).then((identity: any) => {
      if (active) setIdentityState(identity.verificationRequired ? "verification-required" : "ready");
    }).catch(() => {
      if (active) setIdentityState("error");
    });
    return () => { active = false; };
  }, [currentUserId, getIdentity, identityAttempt]);
  useEffect(() => {
    if (currentUserId && identityState === "ready") setLastReadyUserId(currentUserId);
  }, [currentUserId, identityState]);
  const offlineReadyUserId = !isOnline && !currentUserId ? lastReadyUserId : undefined;
  const signedInUserId = currentUserId ?? offlineReadyUserId;
  const usingOfflineReadiness = Boolean(offlineReadyUserId);
  return {
    session,
    sessionPending: sessionPending && !usingOfflineReadiness,
    signedInUserId,
    isAuthenticated: Boolean(currentUserId || offlineReadyUserId),
    identityState: usingOfflineReadiness ? "ready" : identityState,
    refetchSession,
    retryIdentity: () => setIdentityAttempt((value) => value + 1),
  };
}

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
    if (!session?.user) {
      const query = new URLSearchParams({ checkout: "1", ...(intakeSlug ? { intake: intakeSlug } : {}) });
      router.push(`/s/${encodeURIComponent(schoolSlug)}/account?${query.toString()}`);
      return;
    }
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
    } catch {
      localStorage.removeItem(checkoutKey(schoolSlug));
      setNotice("We could not start secure checkout. Verify your contact and try again.");
    }
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

export function AccountSurface({ schoolSlug, intakeSlug, checkoutIntent = false }: Pick<Props, "schoolSlug" | "intakeSlug" | "checkoutIntent">) {
  const router = useRouter();
  const { sessionPending, signedInUserId, isAuthenticated, identityState, refetchSession, retryIdentity } = useGuardianReadiness();
  const workspace = useQuery(functionRef("functions/admissions/public:getGuardianWorkspace"), signedInUserId && identityState === "ready" ? { schoolSlug, limit: 100 } : "skip") as any;
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [authState, setAuthState] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutRequested, setCheckoutRequested] = useState(checkoutIntent);

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
          await refetchSession({ query: { disableCookieCache: true } });
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
        await refetchSession({ query: { disableCookieCache: true } });
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

  const signedInContent = identityState === "ready"
    ? checkoutRequested
      ? <CheckoutContinuation schoolSlug={schoolSlug} intakeSlug={intakeSlug} onCancel={() => setCheckoutRequested(false)} />
      : <WorkspaceCards workspace={workspace} schoolSlug={schoolSlug} intakeSlug={intakeSlug} router={router} onBuy={() => setCheckoutRequested(true)} />
    : identityState === "verification-required"
      ? <div className="notice warn" role="status"><strong>Verify your email to continue</strong><p>Your private application workspace will open after your email address is verified.</p></div>
      : identityState === "error"
        ? <div className="notice warn" role="alert"><strong>We could not prepare your guardian workspace</strong><p>Retry the secure account check before continuing.</p><button className="secondary" type="button" onClick={retryIdentity}>Retry account check</button></div>
        : <p className="muted" role="status">Preparing your private guardian workspace…</p>;

  return <Page><section className="card"><h1>Your application workspace</h1><p className="muted">Each application slot is for one child. Payment confirmation does not confirm admission.</p>{sessionPending ? <p className="muted" role="status">Checking your guardian account…</p> : !isAuthenticated ? <form onSubmit={submitAuth}><div className="notice"><strong>{mode === "create" ? "Create your guardian account" : "Sign in to your guardian account"}</strong><p>{mode === "create" ? "Use your real name and an email you can access. You will use these details to return to private applications." : "Enter the account details you used for your application."}</p></div>{mode === "create" ? <Input id="name" label="Full name" value={name} onChange={setName} autoComplete="name" required /> : null}<Input id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required /><Input id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete={mode === "create" ? "new-password" : "current-password"} required />{mode === "create" ? <><Input id="password-confirmation" label="Repeat password" type="password" value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" required /><p className="muted">Use at least 8 characters and enter the same password twice.</p></> : null}<div className="actions"><button className="primary" type="submit" disabled={submitting}>{submitting ? (mode === "create" ? "Creating account…" : "Signing in…") : (mode === "create" ? "Create account" : "Sign in")}</button><button className="secondary" type="button" disabled={submitting} onClick={() => switchMode(mode === "create" ? "sign-in" : "create")}>{mode === "create" ? "I already have an account" : "Create an account"}</button></div>{authState ? <p className="status" role="status">{authState}</p> : null}</form> : signedInContent}</section></Page>;
}

function CheckoutContinuation({ schoolSlug, intakeSlug, onCancel }: { schoolSlug: string; intakeSlug?: string; onCancel: () => void }) {
  const createAttempt = useMutation(functionRef("functions/admissions/public:createAttemptForOffering"));
  const initializeAttempt = useAction(functionRef("functions/admissions/public:initializeAttemptByReference"));
  const [attemptNumber, setAttemptNumber] = useState(0);
  const [status, setStatus] = useState("Preparing secure checkout…");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setStatus("Preparing secure checkout…");
    const flightKey = `${schoolSlug}:${intakeSlug ?? ""}:${attemptNumber}`;
    let flight = checkoutFlights.get(flightKey);
    if (!flight) {
      flight = (async () => {
        const key = localStorage.getItem(checkoutKey(schoolSlug)) ?? crypto.randomUUID();
        localStorage.setItem(checkoutKey(schoolSlug), key);
        const attempt: any = await createAttempt({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}), idempotencyKey: key });
        return await initializeAttempt({ reference: attempt.reference }) as CheckoutInitialization;
      })();
      checkoutFlights.set(flightKey, flight);
      void flight.then(
        () => checkoutFlights.delete(flightKey),
        () => checkoutFlights.delete(flightKey),
      );
    }
    void flight.then((checkout) => {
      if (!active) return;
      if (checkout.state === "paid") {
        setStatus("Payment is already confirmed. Return to the workspace to start the available application slot.");
        return;
      }
      if (checkout.state !== "checkout_pending" || !checkout.checkoutUrl) throw new Error("Checkout unavailable");
      window.location.assign(checkout.checkoutUrl);
    }).catch(() => {
      localStorage.removeItem(checkoutKey(schoolSlug));
      if (active) {
        setFailed(true);
        setStatus("We could not start secure checkout. Retry without leaving your workspace.");
      }
    });
    return () => { active = false; };
  }, [schoolSlug, intakeSlug, createAttempt, initializeAttempt, attemptNumber]);
  return <div className={`notice ${failed ? "warn" : ""}`} role="status"><strong>Secure application checkout</strong><p>{status}</p>{failed ? <div className="actions"><button className="primary" type="button" onClick={() => setAttemptNumber((value) => value + 1)}>Retry checkout</button><button className="secondary" type="button" onClick={onCancel}>Back to workspace</button></div> : null}</div>;
}

function WorkspaceCards({ workspace, schoolSlug, intakeSlug, router, onBuy }: { workspace: any; schoolSlug: string; intakeSlug?: string; router: ReturnType<typeof useRouter>; onBuy: () => void }) {
  const reserve = useMutation(functionRef("functions/admissions/public:createOrResumeForOffering"));
  const [notice, setNotice] = useState("");
  const startAvailable = async () => { try { const application: any = await reserve({ schoolSlug, ...(intakeSlug ? { intakeSlug } : {}) }); localStorage.setItem(referenceKey(schoolSlug), application.publicReference); router.push(applicationPath(schoolSlug, application.publicReference)); } catch { setNotice("This slot is not available to start yet. Refresh your workspace and try again."); } };
  if (!workspace) return <p className="muted">Loading your saved slots and applications…</p>;
  return <><div className="notice"><strong>Applications for {workspace.schoolName}</strong><p>Every card below is one separate slot. Start another checkout for another child.</p></div>{notice ? <p className="status" role="status">{notice}</p> : null}<div className="workspace">{workspace.slots.length ? workspace.slots.map((slot: any, index: number) => <article className="upload" key={`${slot.publicReference ?? slot.state}-${index}`}><strong>{slot.applicationState ? `Application · ${slot.applicationState}` : slot.state === "available" ? "Available application slot" : `Slot · ${slot.state}`}</strong><p className="muted">Updated {new Date(slot.updatedAt).toLocaleString()}</p>{slot.publicReference ? <button className="secondary" onClick={() => router.push(applicationPath(schoolSlug, slot.publicReference))}>{slot.applicationState === "draft" || slot.applicationState === "changes_requested" ? "Resume application" : "View application status"}</button> : slot.state === "available" ? <button className="primary" onClick={() => void startAvailable()}>Start this child&apos;s application</button> : <p className="muted">This slot is not available to start.</p>}</article>) : <p className="muted">No paid application slots are available yet. Complete secure checkout to create one.</p>}</div><div className="actions"><button className="primary" type="button" onClick={onBuy}>{workspace.slots.length ? "Buy another application slot" : "Proceed to secure checkout"}</button></div></>;
}

export function ApplicationSurface({ schoolSlug, publicReference }: { schoolSlug: string; publicReference: string }) {
  const router = useRouter();
  const { sessionPending, signedInUserId, isAuthenticated, identityState, retryIdentity } = useGuardianReadiness();
  const privateQueryReady = Boolean(signedInUserId) && identityState === "ready";
  const app = useQuery(functionRef("functions/admissions/public:getGuardianApplication"), privateQueryReady ? { schoolSlug, publicReference } : "skip") as any;
  const config = useQuery(functionRef("functions/admissions/public:getApplicationConfiguration"), privateQueryReady && app ? { schoolSlug, publicReference } : "skip") as any;
  const saveCore = useMutation(functionRef("functions/admissions/public:saveCoreByPublicReference"));
  const saveAnswer = useMutation(functionRef("functions/admissions/public:saveAnswerByPublicReference"));
  const saveContact = useMutation(functionRef("functions/admissions/public:saveContactByPublicReference"));
  const withdraw = useMutation(functionRef("functions/admissions/public:withdrawByPublicReference"));
  const submit = useMutation(functionRef("functions/admissions/public:submitByPublicReference"));
  const createUploadUrl = useMutation(functionRef("functions/admissions/public:createUploadUrlByPublicReference"));
  const bindUpload = useMutation(functionRef("functions/admissions/public:bindUploadByPublicReference"));
  const accessOwnDocument = useMutation(functionRef("functions/admissions/public:getOwnDocumentAccessByPublicReference"));
  const [step, setStep] = useState("child");
  const [status, setStatus] = useState("Loading your private application…");
  const [saveState, setSaveState] = useState<DraftSaveState>("idle");
  const [version, setVersion] = useState<number | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, Record<string, string>>>({});
  const [conflict, setConflict] = useState(false);
  const [hasStaleRecovery, setHasStaleRecovery] = useState(false);
  const [core, setCore] = useState({ firstName: "", lastName: "", dateOfBirth: "", signerName: "", signerRelationship: "" });
  const [contact, setContact] = useState({ fullName: "", relationship: "Parent", email: "", phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const coreRef = useRef(core);
  const contactRef = useRef(contact);
  const answersRef = useRef(answers);
  const queueRef = useRef<SerializedWriteQueue | null>(null);
  const initializedRef = useRef(false);
  const dirtyRef = useRef(new Map<string, { section: string; generation: number }>());
  const blockedWritesRef = useRef(new Map<string, number>());
  const pendingWritesRef = useRef(new Map<string, Promise<boolean>>());
  const onlineRef = useRef(typeof navigator === "undefined" || navigator.onLine);
  const flushPendingRef = useRef<() => void>(() => {});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const recoveryBaseVersionRef = useRef<number | null>(null);
  const staleRecoveryRef = useRef<RecoveryRecord | null>(null);
  const baselineRef = useRef({ core: { firstName: "", lastName: "", dateOfBirth: "" }, contact: { fullName: "", relationship: "", email: "", phone: "" }, answers: {} as Record<string, string> });
  const recoveryStorageKey = recoveryKey(schoolSlug, publicReference);

  const sectionKeys = Array.from(new Set<string>((config?.fields ?? []).map((field: Field) => field.sectionKey))).filter(Boolean);
  const formSteps = Array.from(new Set<string>(["child", "contacts", ...sectionKeys.filter((key) => key !== "child" && key !== "contacts"), "documents", "review"]));
  const fields = (config?.fields ?? []).filter((field: Field) => field.sectionKey === step && fieldIsVisible(field, answers));

  const markDirty = (key: string, section: string) => {
    generationRef.current += 1;
    dirtyRef.current.set(key, { section, generation: generationRef.current });
    blockedWritesRef.current.delete(key);
    recoveryBaseVersionRef.current ??= version;
    debounceRef.current = resetAutosaveDebounce(debounceRef.current, () => flushPendingRef.current());
    const connectivity = draftConnectivityStatus(onlineRef.current, true);
    if (connectivity) {
      setSaveState(connectivity.saveState);
      setStatus(connectivity.status);
    } else {
      setSaveState("idle");
    }
  };
  const setCoreValue = (key: "firstName" | "lastName" | "dateOfBirth" | "signerName" | "signerRelationship", value: string) => {
    const next = { ...coreRef.current, [key]: value };
    coreRef.current = next;
    setCore(next);
    if (key !== "signerName" && key !== "signerRelationship") markDirty("core", "child");
  };
  const setContactValue = (key: "fullName" | "relationship" | "email" | "phone", value: string) => {
    const next = { ...contactRef.current, [key]: value };
    contactRef.current = next;
    setContact(next);
    markDirty("contact", "contacts");
  };
  const setAnswerValue = (field: Field, value: string | boolean | string[]) => {
    const serialized = Array.isArray(value) ? JSON.stringify(value) : String(value);
    const next = { ...answersRef.current, [field.key]: serialized };
    answersRef.current = next;
    setAnswers(next);
    markDirty(`answer:${field.key}`, field.sectionKey);
  };

  useEffect(() => {
    if (!app) return;
    const serverCore = { firstName: app.profile?.firstName ?? "", lastName: app.profile?.lastName ?? "", dateOfBirth: app.profile?.dateOfBirth ? new Date(app.profile.dateOfBirth).toISOString().slice(0, 10) : "" };
    const serverContact = app.contacts?.find((item: any) => item.isPrimary);
    const serverAnswers = Object.fromEntries((app.answers ?? []).map((answer: any) => [answer.fieldKey, answer.serializedValue]));
    baselineRef.current = { core: serverCore, contact: { fullName: serverContact?.fullName ?? "", relationship: serverContact?.relationship ?? "Parent", email: serverContact?.email ?? "", phone: serverContact?.phone ?? "" }, answers: serverAnswers };
    if (!queueRef.current) queueRef.current = new SerializedWriteQueue(app.draftVersion);
    if (!initializedRef.current) {
      initializedRef.current = true;
      const recovered = readRecovery(recoveryStorageKey);
      if (recovered && recovered.baseVersion === app.draftVersion) {
        coreRef.current = { ...coreRef.current, ...recovered.core };
        contactRef.current = recovered.contact;
        answersRef.current = recovered.answers;
        setCore(current => ({ ...current, ...recovered.core }));
        setContact(recovered.contact);
        setAnswers(recovered.answers);
        generationRef.current = recovered.generation;
        for (const entry of recovered.dirtyEntries) dirtyRef.current.set(entry.key, { section: entry.section, generation: recovered.generation });
        recoveryBaseVersionRef.current = recovered.baseVersion;
        const connectivity = draftConnectivityStatus(onlineRef.current, true);
        if (connectivity) {
          setSaveState(connectivity.saveState);
          setStatus(connectivity.status);
        } else {
          setStatus("Recovered unsaved changes. They are waiting to sync.");
        }
      } else {
        coreRef.current = { ...coreRef.current, ...serverCore };
        contactRef.current = baselineRef.current.contact;
        answersRef.current = serverAnswers;
        setCore(current => ({ ...current, ...serverCore }));
        setContact(baselineRef.current.contact);
        setAnswers(serverAnswers);
        if (recovered) {
          queueRef.current.pause();
          staleRecoveryRef.current = recovered;
          setHasStaleRecovery(true);
          setConflict(true);
          setSaveState("conflict");
          setStatus("Newer saved changes were found. Review or discard the local recovery copy.");
        }
      }
      setVersion(app.draftVersion);
      return;
    }
    if (!dirtyRef.current.size && !queueRef.current.isPaused()) {
      queueRef.current.setVersion(app.draftVersion);
      setVersion(app.draftVersion);
    }
  }, [app, recoveryStorageKey]);

  useEffect(() => {
    if (!initializedRef.current || !dirtyRef.current.size || version === null) return;
    const record = {
      baseVersion: recoveryBaseVersionRef.current ?? version,
      generation: generationRef.current,
      dirtySections: Array.from(new Set(Array.from(dirtyRef.current.values(), item => item.section))),
      dirtyEntries: Array.from(dirtyRef.current.entries(), ([key, item]) => ({ key, section: item.section })),
      core: { firstName: coreRef.current.firstName, lastName: coreRef.current.lastName, dateOfBirth: coreRef.current.dateOfBirth },
      contact: contactRef.current,
      answers: answersRef.current,
    };
    window.localStorage.setItem(recoveryStorageKey, JSON.stringify(record));
  }, [answers, contact, core, recoveryStorageKey, version]);

  const clearDirty = (key: string, generation: number) => {
    const current = dirtyRef.current.get(key);
    if (!current || current.generation !== generation) return;
    dirtyRef.current.delete(key);
    if (!dirtyRef.current.size) {
      recoveryBaseVersionRef.current = null;
      window.localStorage.removeItem(recoveryStorageKey);
    }
  };
  const setErrorsFor = (section: string, errors: Record<string, string>) => setSectionErrors(current => ({ ...current, [section]: errors }));
  const validateSection = (section: string): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (section === "child") {
      if (!coreRef.current.firstName.trim()) errors.first = "Enter the child’s legal first name.";
      if (!coreRef.current.lastName.trim()) errors.last = "Enter the child’s legal last name.";
      if (!coreRef.current.dateOfBirth || Number.isNaN(new Date(coreRef.current.dateOfBirth).getTime())) errors.dob = "Enter the child’s date of birth.";
    }
    if (section === "contacts") {
      if (!contactRef.current.fullName.trim()) errors["contact-name"] = "Enter the guardian’s full name.";
      if (!contactRef.current.relationship.trim()) errors["contact-relationship"] = "Enter the relationship to the child.";
      if (contactRef.current.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactRef.current.email)) errors["contact-email"] = "Enter a valid email address.";
      if (contactRef.current.phone && !contactRef.current.phone.trim()) errors["contact-phone"] = "Enter a phone number or leave this optional field blank.";
    }
    for (const field of (config?.fields ?? []) as Field[]) {
      if (field.sectionKey !== section || !fieldIsVisible(field, answersRef.current)) continue;
      const value = answersRef.current[field.key] ?? "";
      if (fieldRequiresValue(field.requiredMode) && !value) errors[field.key] = `${field.label} is required.`;
      else if (value) {
        const error = configuredFieldError(field, value);
        if (error) errors[field.key] = error;
      }
    }
    return errors;
  };
  const focusError = (errors: Record<string, string>) => {
    const first = Object.keys(errors)[0];
    window.setTimeout(() => document.getElementById(first ?? "section-errors")?.focus(), 0);
  };
  const queueWrite = (key: string, section: string, write: (expectedVersion: number) => Promise<number>, onAcknowledged?: () => void, field?: Field) => {
    const existing = pendingWritesRef.current.get(key);
    if (existing) return existing;
    const dirty = dirtyRef.current.get(key);
    if (!dirty || !queueRef.current) return Promise.resolve(true);
    if (blockedWritesRef.current.get(key) === dirty.generation) return Promise.resolve(false);
    if (!onlineRef.current) {
      const connectivity = draftConnectivityStatus(false, true)!;
      setSaveState(connectivity.saveState);
      setStatus(connectivity.status);
      return Promise.resolve(false);
    }
    const task = (async () => {
      setSaveState("saving");
      setStatus("Saving…");
      try {
        const next = await queueRef.current!.enqueue(write, () => { setSaveState("retrying"); setStatus("Could not save — retrying"); });
        setVersion(next);
        onAcknowledged?.();
        clearDirty(key, dirty.generation);
        setSaveState("saved");
        setStatus("Saved just now");
        return true;
      } catch (error) {
        const code = saveErrorCode(error);
        const transient = isTransientSaveFailure(error);
        if (code === "DRAFT_VERSION_CONFLICT") {
          setConflict(true);
          setSaveState("conflict");
          setStatus("Newer saved changes need your review before retrying.");
          setErrorsFor(section, { section: "This section has a newer saved version. Retry only after reviewing it." });
        } else if (!onlineRef.current) {
          const connectivity = draftConnectivityStatus(false, true)!;
          setSaveState(connectivity.saveState);
          setStatus(connectivity.status);
        } else if (code) {
          blockedWritesRef.current.set(key, dirty.generation);
          setSaveState("idle");
          const fieldErrors = field && (code === "ANSWER_INVALID" || code === "ANSWER_NOT_APPLICABLE") ? { [field.key]: `${field.label} could not be saved. Correct this field and try again.` } : { section: "Correct the highlighted values before saving again." };
          setErrorsFor(section, fieldErrors);
          if (field) focusError(fieldErrors);
        } else if (transient) {
          setSaveState("retrying");
          setStatus("Could not save — retrying");
        } else {
          blockedWritesRef.current.set(key, dirty.generation);
          setSaveState("idle");
          setStatus("Could not save. Change this section before retrying.");
          setErrorsFor(section, { section: "This section could not be saved. Review its values and try again." });
        }
        return false;
      }
    })();
    pendingWritesRef.current.set(key, task);
    void task.finally(() => pendingWritesRef.current.delete(key));
    return task;
  };
  const flushSection = async (section: string) => {
    if (conflict) return false;
    const entries = Array.from(dirtyRef.current.entries()).filter(([, dirty]) => dirty.section === section);
    if (!entries.length) return true;
    const validationErrors = validateSection(section);
    const work = entries.map(([key]) => {
      if (key === "core") {
        if (Object.keys(validationErrors).length) return Promise.resolve(false);
        const value = coreRef.current;
        const baseline = baselineRef.current.core;
        if (value.firstName === baseline.firstName && value.lastName === baseline.lastName && value.dateOfBirth === baseline.dateOfBirth) { clearDirty(key, dirtyRef.current.get(key)?.generation ?? -1); return Promise.resolve(true); }
        return queueWrite(key, section, expectedVersion => saveCore({ schoolSlug, publicReference, expectedVersion, firstName: value.firstName, lastName: value.lastName, dateOfBirth: new Date(value.dateOfBirth).getTime() }) as Promise<number>, () => { baselineRef.current.core = { firstName: value.firstName, lastName: value.lastName, dateOfBirth: value.dateOfBirth }; });
      }
      if (key === "contact") {
        if (Object.keys(validationErrors).length) return Promise.resolve(false);
        const value = contactRef.current;
        const baseline = baselineRef.current.contact;
        if (JSON.stringify(value) === JSON.stringify(baseline)) { clearDirty(key, dirtyRef.current.get(key)?.generation ?? -1); return Promise.resolve(true); }
        return queueWrite(key, section, expectedVersion => saveContact({ schoolSlug, publicReference, expectedVersion, contactKey: "primary-guardian", kind: "guardian", fullName: value.fullName, relationship: value.relationship, email: value.email || undefined, phone: value.phone || undefined, isApplicantGuardian: true, isPrimary: true }) as Promise<number>, () => { baselineRef.current.contact = value; });
      }
      const fieldKey = key.slice("answer:".length);
      const field = (config?.fields ?? []).find((item: Field) => item.key === fieldKey) as Field | undefined;
      if (!field || validationErrors[fieldKey]) return Promise.resolve(false);
      const value = answersRef.current[fieldKey] ?? "";
      if (value === baselineRef.current.answers[fieldKey]) { clearDirty(key, dirtyRef.current.get(key)?.generation ?? -1); return Promise.resolve(true); }
      return queueWrite(key, section, expectedVersion => saveAnswer({ schoolSlug, publicReference, fieldKey, expectedVersion, ...serializedValue(field.kind, field.kind === "multi_select" ? safeArray(value) : value) }) as Promise<number>, () => { baselineRef.current.answers[fieldKey] = value; }, field);
    });
    return (await Promise.all(work)).every(Boolean);
  };
  useEffect(() => {
    flushPendingRef.current = () => {
      for (const section of new Set(Array.from(dirtyRef.current.values(), item => item.section))) void flushSection(section);
    };
  });
  useEffect(() => {
    const updateConnectivity = () => {
      onlineRef.current = navigator.onLine;
      const connectivity = draftConnectivityStatus(onlineRef.current, Boolean(dirtyRef.current.size || pendingWritesRef.current.size));
      if (!connectivity || saveState === "conflict") return;
      setSaveState(connectivity.saveState);
      setStatus(connectivity.status);
      if (onlineRef.current) flushPendingRef.current();
    };
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    return () => {
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [saveState]);
  useEffect(() => {
    const stop = startAutosaveCeiling(() => flushPendingRef.current());
    return () => { if (debounceRef.current !== null) clearTimeout(debounceRef.current); stop(); };
  }, []);
  const saveAndContinue = async (event: FormEvent) => {
    event.preventDefault();
    const errors = validateSection(step);
    setErrorsFor(step, errors);
    if (Object.keys(errors).length) { focusError(errors); return; }
    if (await flushSection(step)) {
      const next = nextFormStep(formSteps, step);
      if (next) { setStep(next); setSectionErrors(current => ({ ...current, [next]: {} })); }
    }
  };
  const navigate = (next: string) => { if (next !== step) { void flushSection(step); setStep(next); setSectionErrors(current => ({ ...current, [next]: {} })); } };
  const retryAfterConflict = () => {
    if (!app || !queueRef.current) return;
    queueRef.current.resume(app.draftVersion);
    setVersion(app.draftVersion);
    recoveryBaseVersionRef.current = app.draftVersion;
    setConflict(false);
    setSaveState("idle");
    setStatus("Ready to retry your pending changes.");
  };
  const restoreStaleRecovery = () => {
    const recovered = staleRecoveryRef.current;
    if (!recovered || !app || !queueRef.current) return;
    coreRef.current = { ...coreRef.current, ...recovered.core };
    contactRef.current = recovered.contact;
    answersRef.current = recovered.answers;
    setCore(current => ({ ...current, ...recovered.core }));
    setContact(recovered.contact);
    setAnswers(recovered.answers);
    dirtyRef.current.clear();
    for (const entry of recovered.dirtyEntries) dirtyRef.current.set(entry.key, { section: entry.section, generation: recovered.generation });
    generationRef.current = recovered.generation;
    recoveryBaseVersionRef.current = app.draftVersion;
    queueRef.current.rebaseWhilePaused(app.draftVersion);
    staleRecoveryRef.current = null;
    setHasStaleRecovery(false);
    setStatus("Local edits restored. Review them, then explicitly retry or discard them.");
  };
  const discardRecovery = () => {
    if (!app || !queueRef.current) return;
    const restored = restoreEditableDraft(baselineRef.current);
    coreRef.current = { ...coreRef.current, ...restored.core };
    contactRef.current = restored.contact;
    answersRef.current = restored.answers;
    setCore(current => ({ ...current, ...restored.core }));
    setContact(restored.contact);
    setAnswers(restored.answers);
    dirtyRef.current.clear();
    blockedWritesRef.current.clear();
    pendingWritesRef.current.clear();
    recoveryBaseVersionRef.current = null;
    staleRecoveryRef.current = null;
    window.localStorage.removeItem(recoveryStorageKey);
    queueRef.current.resume(app.draftVersion);
    setVersion(app.draftVersion);
    setSectionErrors({});
    setHasStaleRecovery(false);
    setConflict(false);
    setSaveState("idle");
    setStatus("Local recovery copy discarded. Latest saved details restored.");
  };
  const withdrawApplication = async () => { const reason = window.prompt("Why are you withdrawing this application?"); if (!reason?.trim()) return; try { await withdraw({ schoolSlug, publicReference, reason }); setStatus("Application withdrawn. Its history remains available."); router.refresh(); } catch { setStatus("This application cannot be withdrawn from its current state."); } };
  const submitApplication = async () => {
    const reviewErrors: Record<string, string> = {};
    if (!config.declaration || !declarationAccepted) reviewErrors.declaration = "Read and accept the published declaration before submitting.";
    if (!coreRef.current.signerName.trim()) reviewErrors.signer = "Enter the signer’s name.";
    if (!coreRef.current.signerRelationship.trim()) reviewErrors.relationship = "Enter the signer’s relationship.";
    setErrorsFor("review", reviewErrors);
    if (Object.keys(reviewErrors).length || !queueRef.current || version === null) { focusError(reviewErrors); return; }
    setStatus("Submitting — checking status…");
    try {
      const result = await queueRef.current.enqueue(async expectedVersion => {
        await submit({ schoolSlug, publicReference, expectedVersion, signerName: coreRef.current.signerName, signerRelationship: coreRef.current.signerRelationship, declarationVersion: config.declaration.version, declarationAccepted });
        return expectedVersion;
      }, () => setStatus("Could not save — retrying"));
      setVersion(result);
      setStatus("Application submitted. It is now locked for review.");
      router.refresh();
    } catch { setStatus("Complete the named items and retry."); setErrorsFor("review", { section: "The application is incomplete or has a newer saved version." }); }
  };

  if (sessionPending || identityState === "checking" || (isAuthenticated && identityState === "idle")) return <Page><section className="card auth-gate"><h1>Opening your private application</h1><p className="muted" role="status">Checking your guardian account and application access…</p></section></Page>;
  if (!isAuthenticated) return <Page><section className="card auth-gate"><h1>Sign in to continue</h1><p className="muted">This application is private. Sign in with the guardian account that created it.</p><a className="primary" href={`/s/${encodeURIComponent(schoolSlug)}/account`}>Sign in to your workspace</a></section></Page>;
  if (identityState === "verification-required") return <Page><section className="card auth-gate"><h1>Verify your email to continue</h1><p className="muted">Your application remains private until your guardian email is verified.</p></section></Page>;
  if (identityState === "error") return <Page><section className="card auth-gate"><h1>We could not open your guardian workspace</h1><p className="muted">Retry the secure account check before loading this application.</p><button className="secondary" type="button" onClick={retryIdentity}>Retry account check</button></section></Page>;
  if (!app || !config || version === null) return <Page><section className="card auth-gate"><h1>Opening your private application</h1><p className="muted">Loading your saved details and form requirements…</p></section></Page>;
  const editable = app.allowedActions.includes("save");
  const fieldEditable = (key: string) => editable && (app.state !== "changes_requested" || app.permittedEdits.fieldKeys.includes(key));
  const coreEditable = (key: string) => editable && (app.state !== "changes_requested" || app.permittedEdits.coreKeys.includes(key));
  const activeErrors = sectionErrors[step] ?? {};
  return <Page><div className="grid"><aside className="card step-card" aria-label="Application steps"><p className="pill">{app.state}</p><p className="muted">{applicationStatusCopy(app.state, app.conversionState)}</p><ol className="stepper">{formSteps.map(item => <li key={item}><button type="button" aria-current={step === item ? "step" : undefined} onClick={() => navigate(item)}>{item === "child" ? "Child and form" : item === "contacts" ? "Guardian contact" : item === "documents" ? "Documents" : item === "review" ? "Review and declaration" : item.replace(/[-_]/g, " ")}</button></li>)}</ol></aside><main className="card app-card"><h1>{editable ? "Complete this application" : "Application status"}</h1><p className="status" aria-live="polite" data-save-state={saveState}>{status}</p>{Object.keys(activeErrors).length ? <div id="section-errors" tabIndex={-1} role="alert" className="notice danger"><strong>Complete the highlighted items</strong><ul>{Object.entries(activeErrors).map(([key, error]) => <li key={key}>{error}</li>)}</ul></div> : null}{conflict ? <div className="notice warn" role="alert"><strong>Saved changes need review</strong><p>Your pending edits were not applied over a newer application version.</p><div className="actions">{hasStaleRecovery ? <button type="button" className="secondary" onClick={restoreStaleRecovery}>Restore local edits to review and retry</button> : <button type="button" className="secondary" onClick={retryAfterConflict}>Retry my pending changes</button>}<button type="button" className="secondary" onClick={discardRecovery}>Discard local recovery copy</button></div></div> : null}{app.messages.map((message: any) => <div className="notice warn" key={message.createdAt}>{message.message ?? "The school updated your application status."}</div>)}
  {step === "child" && <form noValidate onSubmit={saveAndContinue}><fieldset className="fieldset" disabled={!editable}><Input id="first" label="Legal first name" value={core.firstName} onChange={value => setCoreValue("firstName", value)} required disabled={!coreEditable("firstName")} error={activeErrors.first} onBlur={() => void flushSection("child")} /><Input id="last" label="Legal last name" value={core.lastName} onChange={value => setCoreValue("lastName", value)} required disabled={!coreEditable("lastName")} error={activeErrors.last} onBlur={() => void flushSection("child")} /><Input id="dob" label="Date of birth" type="date" value={core.dateOfBirth} onChange={value => setCoreValue("dateOfBirth", value)} required disabled={!coreEditable("dateOfBirth")} error={activeErrors.dob} onBlur={() => void flushSection("child")} />{fields.map((field: Field) => <DynamicField key={field.key} field={field} value={answers[field.key] ?? ""} disabled={!fieldEditable(field.key)} error={activeErrors[field.key]} onChange={value => setAnswerValue(field, value)} onSave={() => void flushSection(field.sectionKey)} />)}<div className="sticky"><button className="primary" type="submit">Save and continue</button></div></fieldset></form>}
  {step === "contacts" && <form noValidate onSubmit={saveAndContinue}><fieldset className="fieldset" disabled={!editable || app.state === "changes_requested"}><h2>Guardian and emergency contact</h2><Input id="contact-name" label="Full name" value={contact.fullName} onChange={value => setContactValue("fullName", value)} required error={activeErrors["contact-name"]} onBlur={() => void flushSection("contacts")} /><Input id="contact-relationship" label="Relationship" value={contact.relationship} onChange={value => setContactValue("relationship", value)} required error={activeErrors["contact-relationship"]} onBlur={() => void flushSection("contacts")} /><Input id="contact-email" label="Email" type="email" value={contact.email} onChange={value => setContactValue("email", value)} error={activeErrors["contact-email"]} onBlur={() => void flushSection("contacts")} /><Input id="contact-phone" label="Phone" value={contact.phone} onChange={value => setContactValue("phone", value)} error={activeErrors["contact-phone"]} onBlur={() => void flushSection("contacts")} /><div className="sticky"><button className="primary" type="submit">Save and continue</button></div></fieldset></form>}
  {step !== "child" && step !== "contacts" && step !== "documents" && step !== "review" && <form noValidate onSubmit={saveAndContinue}><section><h2>{step.replace(/[-_]/g, " ")}</h2><fieldset className="fieldset" disabled={!editable}>{fields.map((field: Field) => <DynamicField key={field.key} field={field} value={answers[field.key] ?? ""} disabled={!fieldEditable(field.key)} error={activeErrors[field.key]} onChange={value => setAnswerValue(field, value)} onSave={() => void flushSection(field.sectionKey)} />)}{!fields.length ? <p className="muted">No currently applicable fields are configured in this section.</p> : null}<div className="sticky"><button className="primary" type="submit">Save and continue</button></div></fieldset></section></form>}
  {step === "documents" && <Documents requirements={(config.requirements as Requirement[]).filter(requirement => app.state !== "changes_requested" || app.permittedEdits.requirementKeys.includes(requirement.key))} documents={app.documents ?? []} disabled={!editable} onOpen={async documentKey => { const result: any = await accessOwnDocument({ schoolSlug, publicReference, documentKey, action: "view" }); if (result.status !== "available") throw new Error("Unavailable"); window.open(result.url, "_blank", "noopener,noreferrer"); }} onUpload={async (requirementKey, file) => { const uploadUrl = await createUploadUrl({ schoolSlug, publicReference, requirementKey }); const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file }); if (!response.ok) throw new Error("Upload failed"); const { storageId } = await response.json(); if (!queueRef.current) throw new Error("Application is still loading"); await queueRef.current.enqueue(async expectedVersion => { await bindUpload({ schoolSlug, publicReference, requirementKey, storageId, fileName: file.name }); return expectedVersion; }, () => setStatus("Could not save — retrying")); }} />}
  {step === "review" && <section><h2>Review and declaration</h2><p className="muted">Review your saved details and private document requirements before submitting. Submitting does not create a student or confirm admission.</p>{config.declaration ? <><h3>{config.declaration.title} · Version {config.declaration.version}</h3><p className="notice">{config.declaration.body}</p></> : <p className="notice warn">The current declaration is unavailable. This application cannot be submitted.</p>}<Input id="signer" label="Signer name" value={core.signerName} onChange={value => setCoreValue("signerName", value)} required error={activeErrors.signer} /><Input id="relationship" label="Relationship" value={core.signerRelationship} onChange={value => setCoreValue("signerRelationship", value)} required error={activeErrors.relationship} /><label><input id="declaration" type="checkbox" checked={declarationAccepted} onChange={e => setDeclarationAccepted(e.target.checked)} disabled={!editable || !config.declaration} /> I have read and accept the published declaration shown above.</label>{activeErrors.declaration ? <small className="field-error">{activeErrors.declaration}</small> : null}<div className="actions"><button type="button" className="primary" disabled={!editable || !config.declaration || !declarationAccepted} onClick={() => void submitApplication()}>Submit application</button></div></section>}{["draft", "submitted", "under_review", "changes_requested", "waitlisted"].includes(app.state) ? <button type="button" className="secondary" onClick={() => void withdrawApplication()}>Withdraw application</button> : null}</main></div></Page>;
}
function DynamicField({ field, value, disabled, error, onChange, onSave }: { field: Field; value: string; disabled: boolean; error?: string; onChange: (value: string | boolean | string[]) => void; onSave: () => void }) {
  const policy = (() => { try { return JSON.parse(field.validation) as { choices?: string[] }; } catch { return {}; } })(); const sensitive = ["highly_sensitive", "financial_security", "child_confidential"].includes(field.dataClass);
  const commit = () => onSave();
  return <div className="field"><label htmlFor={field.key}>{field.label} <small>{field.requiredMode === "required" ? "Required" : "Optional"}{sensitive ? " • Sensitive" : ""}</small></label>{field.purpose ? <small>{field.purpose} Only staff with specific admissions permissions can access sensitive information.</small> : null}{field.kind === "textarea" ? <textarea id={field.key} aria-invalid={Boolean(error)} aria-describedby={error ? `${field.key}-error` : undefined} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} onBlur={commit} /> : field.kind === "select" ? <select id={field.key} aria-invalid={Boolean(error)} aria-describedby={error ? `${field.key}-error` : undefined} disabled={disabled} value={value} onChange={e => { onChange(e.target.value); commit(); }}><option value="">Select an option</option>{policy.choices?.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select> : field.kind === "checkbox" || field.kind === "boolean" ? <label><input id={field.key} type="checkbox" aria-invalid={Boolean(error)} aria-describedby={error ? `${field.key}-error` : undefined} disabled={disabled} checked={value === "true"} onChange={e => { onChange(e.target.checked); commit(); }} /> Yes</label> : field.kind === "multi_select" ? <select id={field.key} multiple aria-invalid={Boolean(error)} aria-describedby={error ? `${field.key}-error` : undefined} disabled={disabled} value={safeArray(value)} onChange={e => { const selected = Array.from(e.currentTarget.selectedOptions, option => option.value); onChange(selected); commit(); }}>{policy.choices?.map(choice => <option key={choice} value={choice}>{choice}</option>)}</select> : <input id={field.key} type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"} aria-invalid={Boolean(error)} aria-describedby={error ? `${field.key}-error` : undefined} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} onBlur={commit} />}{field.helpText ? <small>{field.helpText}</small> : null}{error ? <small id={`${field.key}-error`} className="field-error">{error}</small> : null}</div>;
}
function safeArray(value: string) { try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
function Documents({ requirements, documents, disabled, onOpen, onUpload }: { requirements: Requirement[]; documents: Array<{ documentKey: string; requirementKey: string | null; fileName: string; state: string; version: number }>; disabled: boolean; onOpen: (documentKey: string) => Promise<void>; onUpload: (key: string, file: File) => Promise<void> }) { const [selected, setSelected] = useState<Record<string, File | undefined>>({}); const [status, setStatus] = useState("Choose a file, then upload privately."); return <section><h2>Private documents</h2><p className="muted">Files are checked before binding and are not shown as public links.</p><p className="status" role="status">{status}</p>{documents.map(document => <div className="upload" key={document.documentKey}><strong>{document.fileName}</strong> · version {document.version} · {document.state}<button type="button" className="secondary" onClick={async () => { try { await onOpen(document.documentKey); } catch { setStatus("This document is not available for checked access."); } }}>View my document</button></div>)}{requirements.map(requirement => <div className="upload" key={requirement.key}><strong>{requirement.label} · {requirement.requiredMode === "required" ? "Required" : "Optional"}</strong><p className="muted">{requirement.purpose} · up to {(requirement.maxBytes / 1_000_000).toFixed(1)} MB · {requirement.maxFiles} file(s)</p><input aria-label={`Choose file for ${requirement.label}`} type="file" accept={requirement.acceptedMimeTypes.join(",")} disabled={disabled} onChange={e => setSelected({ ...selected, [requirement.key]: e.target.files?.[0] })}/><button type="button" className="secondary" disabled={disabled || !selected[requirement.key]} onClick={async () => { const file = selected[requirement.key]; if (!file) return; if (file.size > requirement.maxBytes || !requirement.acceptedMimeTypes.includes(file.type)) { setStatus("This file does not meet the listed type or size requirements."); return; } setStatus("Uploading privately…"); try { await onUpload(requirement.key, file); setStatus("Uploaded. This file is private and will be checked with your application."); setSelected({ ...selected, [requirement.key]: undefined }); } catch { setStatus("This file could not be added. Choose another file or retry upload."); } }}>Upload privately</button></div>)}</section>; }
function PaymentReturn({ schoolSlug, reference }: { schoolSlug: string; reference: string }) {
  const router = useRouter();
  const verify = useAction(functionRef("functions/admissions/public:verifyReturnByReference"));
  const reserve = useMutation(functionRef("functions/admissions/public:createOrResumeForReference"));
  const [state, setState] = useState("Verifying your payment with Paystack…");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [checkAttempt, setCheckAttempt] = useState(0);

  const continueToApplication = async () => {
    setChecking(true);
    try {
      const application: any = await reserve({ schoolSlug, reference });
      localStorage.removeItem(checkoutKey(schoolSlug));
      localStorage.setItem(referenceKey(schoolSlug), application.publicReference);
      router.replace(applicationPath(schoolSlug, application.publicReference));
    } catch {
      setReady(true);
      setChecking(false);
      setState("Payment is confirmed, but the application slot is not available yet. Retry continuing to the application.");
    }
  };

  useEffect(() => {
    let active = true;
    setChecking(true);
    setState("Verifying your payment with Paystack…");
    void verify({ reference }).then(async (result: any) => {
      if (!active) return;
      const paid = result.state === "paid" && result.entitlementAvailable;
      setReady(paid);
      setState(paymentStatusCopy(paid ? "paid" : result.state));
      setChecking(false);
      if (paid) await continueToApplication();
    }).catch(() => {
      if (!active) return;
      setChecking(false);
      setState("We could not verify this payment yet. Paystack may still be processing it; retry the verification check.");
    });
    return () => { active = false; };
    // The attempt counter deliberately reruns the owned verification action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, verify, checkAttempt]);

  return <section className="card"><h2>Confirming your payment</h2><p aria-live="polite">{state}</p><div className="actions"><button type="button" className="secondary" disabled={checking} onClick={() => setCheckAttempt((value) => value + 1)}>{checking ? "Checking payment…" : "Check again"}</button>{ready ? <button type="button" className="primary" disabled={checking} onClick={() => void continueToApplication()}>Continue to application</button> : null}</div></section>;
}
function Input({ id, label, value, onChange, type = "text", required = false, disabled = false, autoComplete, error, onBlur }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; disabled?: boolean; autoComplete?: string; error?: string; onBlur?: () => void }) { return <div className="field"><label htmlFor={id}>{label} {required ? <small>Required</small> : null}</label><input id={id} type={type} autoComplete={autoComplete ?? (type === "email" ? "email" : undefined)} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} onBlur={onBlur} />{error ? <small id={`${id}-error`} className="field-error">{error}</small> : null}</div>; }
function Availability({ state, opensAt }: { state: string; opensAt?: number }) { return <div className="notice warn"><h2>This application link is not currently open</h2><p>{state === "upcoming" && opensAt ? `Applications open ${new Date(opensAt).toLocaleDateString()}.` : "Check the link or contact the school for current admissions information."}</p></div>; }
function Unavailable() { return <Page><section className="card"><h1>This application link is not available.</h1><p className="muted">Please check the link or contact the school for current admissions information.</p></section></Page>; }
function Page({ children }: { children: React.ReactNode }) { return <><a className="skip" href="#content">Skip to main content</a><header className="top"><span className="brand">Apply · School admissions</span><span className="muted">Private guardian journey</span></header><main id="content" className="shell">{children}</main></>; }
