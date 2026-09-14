import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationForm, AuthPanel, guardianFacingErrorMessage, PublishedField } from "../components/AdmissionsApply";
import { answerPayload, availabilityMessage, conditionMatchesAnswers, correctionAllows, dateInputToUtcTimestamp, documentSelectionError, isDraftConflict, missingRequiredItemLabels, paymentMessage, validateSubmissionInput } from "../lib/journey";

const authMocks = vi.hoisted(() => ({ signUp: vi.fn(), signIn: vi.fn(), resend: vi.fn(), signOut: vi.fn() }));
const convexMocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => convexMocks.mutate, useQuery: () => undefined, useAction: () => vi.fn(), useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: null, isPending: false }), signUp: { email: authMocks.signUp }, signIn: { email: authMocks.signIn }, sendVerificationEmail: authMocks.resend, signOut: authMocks.signOut } }));
vi.mock("@/lib/auth-server", () => ({ getToken: vi.fn(async () => "guardian-token") }));

describe("guardian email verification", () => {
  it("does not expose raw Convex errors to guardians", () => { expect(guardianFacingErrorMessage(new Error('[CONVEX M(functions/admissions/guardian:getOrCreateIdentity)] Uncaught ConvexError: {"code":"VERIFICATION_REQUIRED","message":"Verify your email before applying"} Called by client'))).toBe("Verify your email before continuing. Use the link in the verification message, then retry."); expect(guardianFacingErrorMessage(new Error('ConvexError: {"code":"OFFERING_UNAVAILABLE"} Called by client'))).toMatch(/payment is not available/); expect(guardianFacingErrorMessage(new Error("ConvexError: Storage entitlement is not active for this school"))).toMatch(/storage setup/); expect(guardianFacingErrorMessage(new Error('ConvexError: {"code":"APPLICATION_INCOMPLETE","message":"Missing required items: document-1"}'))).not.toMatch(/document-1/); });
  it("shows verification-pending and resend states after registration", async () => { authMocks.signUp.mockResolvedValue({ data: {}, error: null }); authMocks.resend.mockResolvedValue({ data: {}, error: null }); render(createElement(AuthPanel, { schoolSlug: "school" })); fireEvent.click(screen.getByRole("button", { name: "Create account" })); fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Guardian" } }); fireEvent.change(screen.getByLabelText("Email"), { target: { value: "guardian@example.test" } }); fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } }); fireEvent.click(screen.getByRole("button", { name: "Create account" })); expect(await screen.findByText(/Check your email, verify it/)).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Resend verification email" })); expect(await screen.findByText(/Verification email sent/)).toBeInTheDocument(); expect(authMocks.resend).toHaveBeenCalledWith({ email: "guardian@example.test", callbackURL: `${window.location.origin}/s/school/account` }); });
});

describe("public offering and payment truth", () => {
  it("explains every authoritative availability state", () => { expect(availabilityMessage("open")).toMatch(/open/); expect(availabilityMessage("upcoming", 1_800_000_000_000)).toMatch(/open/); expect(availabilityMessage("paused")).toMatch(/paused/); expect(availabilityMessage("closed")).toMatch(/closed/); expect(availabilityMessage("unavailable")).toMatch(/unavailable/); });
  it("does not describe pending, refunded, or reversed attempts as paid", () => { expect(paymentMessage("checkout_pending")).toMatch(/pending provider verification/); expect(paymentMessage("paid")).toMatch(/verified/); expect(paymentMessage("refunded")).toMatch(/refunded/); expect(paymentMessage("reversed")).toMatch(/reversed/); expect(paymentMessage("manual_attention")).toMatch(/no paid slot/); });
});

describe("application draft, correction, and submission", () => {
  it("stores date-only values at UTC midnight without a local-time shift", () => { expect(dateInputToUtcTimestamp("2026-04-02")).toBe(Date.UTC(2026, 3, 2)); });
  it("classifies draft conflicts and serializes supported published field values", () => { expect(isDraftConflict(new Error("DRAFT_VERSION_CONFLICT"))).toBe(true); expect(answerPayload("number", "12")).toEqual({ valueType: "number", serializedValue: "12" }); expect(answerPayload("boolean", "true")).toEqual({ valueType: "boolean", serializedValue: "true" }); expect(answerPayload("multi_select", "A, B").serializedValue).toBe('["A","B"]'); expect(answerPayload("date", "2026-04-02")).toEqual({ valueType: "date", serializedValue: String(Date.parse("2026-04-02T00:00:00Z")) }); });
  it("limits changes-requested editing to the backend correction scope", () => { expect(correctionAllows("draft", undefined, "profile")).toBe(true); expect(correctionAllows("changes_requested", ["profile"], "profile")).toBe(true); expect(correctionAllows("changes_requested", ["profile"], "primaryContact")).toBe(false); expect(correctionAllows("submitted", ["profile"], "profile")).toBe(false); });
  it("requires signer, relationship, and declaration before submission", () => { expect(validateSubmissionInput({ signerName: "", signerRelationship: "Parent", declarationAccepted: true })).toMatch(/signer name/); expect(validateSubmissionInput({ signerName: "Guardian", signerRelationship: "", declarationAccepted: true })).toMatch(/relationship/); expect(validateSubmissionInput({ signerName: "Guardian", signerRelationship: "Parent", declarationAccepted: false })).toMatch(/declaration/); expect(validateSubmissionInput({ signerName: "Guardian", signerRelationship: "Parent", declarationAccepted: true })).toBeNull(); });
  it("names missing published questions and documents before submission", () => { const missing = missingRequiredItemLabels({ fields: [{ fieldKey: "language", label: "Preferred language", requiredMode: "required", conditionalRuleJson: null }], requirements: [{ requirementId: "requirement-1", label: "Birth certificate", requiredMode: "required", conditionJson: null }], answers: {}, fieldKinds: new Map([["language", "select"]]), documents: [] }); expect(missing).toEqual(["Preferred language", "Birth certificate"]); });
  it("rejects unsupported, oversized, and excess documents before upload", () => { const base = { acceptedMimeTypes: ["application/pdf"], maxBytes: 1024, maxFiles: 1, activeFileCount: 0, replacementAllowed: false }; expect(documentSelectionError({ ...base, file: { type: "image/png", size: 100 } })).toMatch(/accepted file types/); expect(documentSelectionError({ ...base, file: { type: "application/pdf", size: 2048 } })).toMatch(/too large/); expect(documentSelectionError({ ...base, activeFileCount: 1, file: { type: "application/pdf", size: 100 } })).toMatch(/at most 1 file/); expect(documentSelectionError({ ...base, file: { type: "application/pdf", size: 100 } })).toBeNull(); });
  it("renders guardian documents without internal IDs and opens only the Melo proxy URL", async () => {
    const proxyUrl = `/api/admissions/documents/${"d".repeat(64)}`;
    convexMocks.mutate.mockResolvedValue({ status: "available", url: proxyUrl, expiresAt: Date.now() + 60_000 });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const view = render(createElement(ApplicationForm, { schoolSlug: "school", applicationId: "database-application-id", financialHold: false, safeMessages: [], conversion: null, draft: { state: "draft", draftVersion: 0, currentRevision: 0, safeMessages: [], requestedEntryLabel: null, profile: null, primaryContact: null, form: { version: 1, schemaVersion: "1", status: "published", fields: [], requirements: [{ requirementId: "database-requirement-id", requirementKey: "birth", category: "identity", label: "Birth certificate", requiredMode: "required", acceptedMimeTypes: ["application/pdf"], maxBytes: 1000, maxFiles: 1, sensitivity: "personal", purpose: "Age evidence", conditionJson: null, order: 1 }] }, declaration: { version: 1, title: "Declaration", body: "Confirm", purpose: "Attestation", status: "published" }, correction: null, answers: [], documents: [{ documentKey: "internal-document-key", requirementId: "database-requirement-id", category: "identity", state: "uploaded", version: 1 }] } } as never));
    expect(view.container.textContent).not.toMatch(/internal-document-key|database-application-id|database-requirement-id|convex\.cloud|api\/storage|sha-256/i);
    fireEvent.click(screen.getByRole("button", { name: "View own document" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith(proxyUrl, "_blank", "noopener,noreferrer"));
  });
});

describe("conditional and typed published fields", () => {
  it("matches conditional rules against typed controlling answers", () => { const kinds = new Map([["hasSibling", "boolean"], ["count", "number"]]); expect(conditionMatchesAnswers('{"fieldKey":"hasSibling","operator":"equals","value":true}', { hasSibling: "true" }, kinds)).toBe(true); expect(conditionMatchesAnswers('{"fieldKey":"count","operator":"equals","value":2}', { count: "1" }, kinds)).toBe(false); });
  it("renders real choice controls and purpose/sensitivity guidance", () => { const onChange = vi.fn(); render(createElement(PublishedField, { field: { fieldKey: "choice", sectionKey: "details", kind: "select", label: "Preferred language", helpText: "Choose one", requiredMode: "required", dataClass: "personal", purpose: "Plan support", validationJson: '{"options":["English","French"]}', conditionalRuleJson: null, order: 1 }, value: "", disabled: false, onChange })); const control = screen.getByLabelText(/Preferred language/); expect(control.tagName).toBe("SELECT"); expect(screen.getByText("French")).toBeInTheDocument(); expect(screen.getByText(/Purpose: Plan support/)).toHaveTextContent(/Sensitive data: personal/); fireEvent.change(control, { target: { value: "French" } }); expect(onChange).toHaveBeenCalledWith("French"); });
  it("renders boolean and multi-select controls with typed interactions", () => { const onBoolean = vi.fn(); const { unmount } = render(createElement(PublishedField, { field: { fieldKey: "consent", sectionKey: "details", kind: "boolean", label: "Consent", helpText: null, requiredMode: "optional", dataClass: "public", purpose: null, validationJson: "{}", conditionalRuleJson: null, order: 1 }, value: "", disabled: false, onChange: onBoolean })); fireEvent.change(screen.getByLabelText(/Consent/), { target: { value: "true" } }); expect(onBoolean).toHaveBeenCalledWith("true"); unmount(); const onMulti = vi.fn(); render(createElement(PublishedField, { field: { fieldKey: "clubs", sectionKey: "details", kind: "multi_select", label: "Clubs", helpText: null, requiredMode: "optional", dataClass: "public", purpose: null, validationJson: '{"options":["Art","Music"]}', conditionalRuleJson: null, order: 1 }, value: "Art", disabled: false, onChange: onMulti })); const select = screen.getByLabelText(/Clubs/) as HTMLSelectElement; for (const option of select.options) option.selected = true; fireEvent.change(select); expect(onMulti).toHaveBeenCalledWith("Art, Music"); });
});

describe("secure upload route contract", () => {
  it("rejects missing, invalid, and oversized Content-Length before reading a body", async () => { const { POST } = await import("../app/admissions/document-upload/route"); expect((await POST(new Request("http://localhost/admissions/document-upload", { method: "POST", body: "x" }))).status).toBe(411); expect((await POST(new Request("http://localhost/admissions/document-upload", { method: "POST", headers: { "content-length": String(21 * 1024 * 1024) }, body: "x" }))).status).toBe(413); });
  it("uses the configured public Convex Site URL when the server-only alias is absent", async () => {
    const previousFetch = globalThis.fetch;
    const proxyFetch = vi.fn(async (request: Request) => {
      void request;
      return Response.json({ uploaded: true });
    });
    globalThis.fetch = proxyFetch as typeof fetch;
    vi.stubEnv("CONVEX_SITE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://development.example.test");
    try {
      const { POST } = await import("../app/admissions/document-upload/route");
      const response = await POST(new Request("http://localhost/admissions/document-upload", { method: "POST", headers: { "content-length": "1", "content-type": "application/pdf", "x-admissions-upload-intent": "intent-id", "x-admissions-upload-token": "upload-token" }, body: "x" }));
      expect(response.status).toBe(200);
      expect(proxyFetch.mock.calls[0]?.[0].url).toBe("https://development.example.test/admissions/document-upload");
    } finally {
      globalThis.fetch = previousFetch;
      vi.unstubAllEnvs();
    }
  });
});
