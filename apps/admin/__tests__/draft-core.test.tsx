import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DepartureGuardProvider, useDirtyForm, useDepartureGuard, useFormDraft, parseDraftPayload, type UseFormDraftOptions } from "@school/shared/drafts";
import { MobileProgressIndicator } from "../../../packages/shared/src/components/MobileProgressIndicator";
import { DraftRecoveryModal } from "../../../packages/shared/src/drafts/DraftRecoveryModal";
import { WorkspaceNavbar } from "../../../packages/shared/src/components/WorkspaceNavbar";

afterEach(() => { vi.useRealTimers(); });
const parse = (data: unknown) => parseDraftPayload("student_onboarding", data);
const payload = parse({ firstName: "Ada" });
function options(): UseFormDraftOptions<ReturnType<typeof parse>> {
  return { formKey: "student_onboarding", contextKey: "school:new", accountId: "owner", connection: { connected: true, authenticated: true, accountId: "owner" }, isDirty: true, currentData: payload, parsePayload: parse, serverDraft: null, onSave: vi.fn().mockResolvedValue({ revision: 1, lastSavedAt: 100 }), onRestore: vi.fn(), onDiscardServerDraft: vi.fn().mockResolvedValue(undefined) };
}
function deferred() { let resolve!: (value: { revision: number; lastSavedAt: number }) => void; const promise = new Promise<{ revision: number; lastSavedAt: number }>(r => { resolve = r; }); return { promise, resolve }; }

describe("awaitable draft recovery core", () => {
  it("debounces at 1.5s and reports only server-confirmed saved state", async () => {
    vi.useFakeTimers(); const o = options(); const pending = deferred(); o.onSave = vi.fn(() => pending.promise);
    const hook = renderHook(() => useFormDraft(o));
    await act(async () => { vi.advanceTimersByTime(1499); }); expect(o.onSave).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); }); expect(hook.result.current.status).toBe("saving");
    await act(async () => pending.resolve({ revision: 1, lastSavedAt: 123 }));
    expect(hook.result.current.status).toBe("saved"); expect(hook.result.current.lastSavedAt).toBe(123);
  });
  it("rejects awaited failures and blocks conflict retry until explicit latest recovery", async () => {
    const o = options(); o.onSave = vi.fn().mockRejectedValue({ data: { code: "CONFLICT" } });
    const hook = renderHook(() => useFormDraft(o));
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toEqual({ data: { code: "CONFLICT" } }); });
    expect(hook.result.current.status).toBe("conflict");
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/latest/); });
    expect(o.onSave).toHaveBeenCalledTimes(1); expect(o.onRestore).not.toHaveBeenCalled();
  });
  it("preserves edits across real connection/auth loss and requires explicit retry", async () => {
    let o = options(); const hook = renderHook(() => useFormDraft(o));
    o = { ...o, connection: { ...o.connection, connected: false } }; hook.rerender();
    expect(hook.result.current.status).toBe("connection_lost");
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/Reconnect/); });
    o = { ...o, connection: { connected: true, authenticated: false, accountId: "owner" } }; hook.rerender();
    expect(hook.result.current.status).toBe("reauth_required");
    o = { ...o, connection: { connected: true, authenticated: true, accountId: "owner" } }; hook.rerender();
    expect(o.onSave).not.toHaveBeenCalled();
    await act(async () => hook.result.current.retrySave()); expect(o.onSave).toHaveBeenCalledWith(payload, 0);
  });
  it("waits for the in-flight revision before discard and cannot autosave after closure", async () => {
    const o = options(); const pending = deferred(); o.onSave = vi.fn(() => pending.promise);
    const hook = renderHook(() => useFormDraft(o)); let saving!: Promise<void>; let discarding!: Promise<void>;
    act(() => { saving = hook.result.current.retrySave(); });
    act(() => { discarding = hook.result.current.handleDiscardDraft(); });
    expect(o.onDiscardServerDraft).not.toHaveBeenCalled();
    await act(async () => { pending.resolve({ revision: 1, lastSavedAt: 123 }); await saving; await discarding; });
    expect(o.onDiscardServerDraft).toHaveBeenCalledWith(1);
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/closed/); });
  });
  it("surfaces a stale tombstone revision as a conflict without clearing edits", async () => {
    const o = options();
    o.onDiscardServerDraft = vi.fn().mockRejectedValue({ data: { code: "CONFLICT" } });
    const hook = renderHook(() => useFormDraft(o));
    await act(async () => {
      await expect(hook.result.current.handleDiscardDraft()).rejects.toEqual({ data: { code: "CONFLICT" } });
    });
    expect(hook.result.current.status).toBe("conflict");
    await act(async () => {
      await expect(hook.result.current.retrySave()).rejects.toThrow(/latest/);
    });
  });

  it("does not report a failed awaited save as success", async () => {
    const o = options(); o.onSave = vi.fn().mockRejectedValue(new Error("rejected"));
    const hook = renderHook(() => useFormDraft(o));
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow("rejected"); });
    expect(hook.result.current.status).toBe("save_failed"); expect(hook.result.current.lastSavedAt).toBeNull();
  });
  it("freezes a prepared submission and rejects late saves after atomic success", async () => {
    const o = options(); const hook = renderHook(() => useFormDraft(o));
    await act(async () => { expect(await hook.result.current.prepareSubmission()).toBe(1); });
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/closed/); });
    act(() => hook.result.current.submissionSucceeded());
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/closed/); });
    expect(o.onSave).toHaveBeenCalledTimes(1);
  });
  it("starts a fresh mounted controller only after the adopter advances its closed instance key", async () => {
    let o = { ...options(), instanceKey: 0 };
    const hook = renderHook(() => useFormDraft(o));
    await act(async () => hook.result.current.retrySave());
    act(() => hook.result.current.submissionSucceeded());
    o = { ...o, instanceKey: 1, currentData: parse({ firstName: "Next" }) };
    hook.rerender();
    await act(async () => {});
    await act(async () => hook.result.current.retrySave());
    expect(o.onSave).toHaveBeenCalledTimes(2);
    expect(o.onSave).toHaveBeenLastCalledWith(o.currentData, 0);
  });

  it("retains only account-scoped in-memory recovery above an auth-gated unmount", () => {
    let o = options();
    function Form() { const draft = useFormDraft(o); return <><span>{draft.memoryDraft ? "Memory recovery available" : "No memory recovery"}</span><button onClick={draft.resumeMemoryDraft}>Resume memory</button></>; }
    const view = render(<DepartureGuardProvider><Form /></DepartureGuardProvider>);
    view.rerender(<DepartureGuardProvider><p>Reauthenticate</p></DepartureGuardProvider>);
    o = { ...o, accountId: "other", connection: { connected: true, authenticated: true, accountId: "other" }, isDirty: false };
    view.rerender(<DepartureGuardProvider><Form /></DepartureGuardProvider>);
    expect(screen.getByText("No memory recovery")).toBeInTheDocument();
    view.rerender(<DepartureGuardProvider><p>Reauthenticate</p></DepartureGuardProvider>);
    o = { ...o, accountId: "owner", connection: { connected: true, authenticated: true, accountId: "owner" } };
    view.rerender(<DepartureGuardProvider><Form /></DepartureGuardProvider>);
    expect(screen.getByText("Memory recovery available")).toBeInTheDocument(); expect(o.onRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resume memory" })); expect(o.onRestore).toHaveBeenCalledWith(payload);
  });
  it("offers recovery without overwriting dirty edits, and blocks account mismatch", async () => {
    let o = options(); o.serverDraft = { formKey: o.formKey, lastSavedAt: 50, revision: 3, payload: { firstName: "Server" } };
    const hook = renderHook(() => useFormDraft(o));
    expect(hook.result.current.showRecoveryModal).toBe(true); expect(o.onRestore).not.toHaveBeenCalled();
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/recovery/); });
    o = { ...o, accountId: "different", connection: { connected: true, authenticated: true, accountId: "different" } }; hook.rerender();
    expect(hook.result.current.serverDraft).toBeNull(); expect(hook.result.current.showRecoveryModal).toBe(false);
    act(() => hook.result.current.handleResumeDraft()); expect(o.onRestore).not.toHaveBeenCalled();
    await act(async () => { await expect(hook.result.current.retrySave()).rejects.toThrow(/same account/); });
  });
});

function Guarded({ save = async () => {}, discard = async () => {} }: { save?: () => Promise<void>; discard?: () => Promise<void> }) {
  useDirtyForm({ name: "Enrollment", isDirty: true, save, discard });
  const guard = useDepartureGuard();
  return <><button onClick={() => void guard.requestDeparture({ kind: "branch", schoolId: "other" })}>Switch branch</button><a href="/academic/elsewhere">Sidebar link</a></>;
}
describe("departure handshake and accessibility", () => {
  it("traps focus, Escape stays, and a failed awaited save preserves the dialog", async () => {
    const save = vi.fn().mockRejectedValue(new Error("server rejected"));
    render(<DepartureGuardProvider><Guarded save={save} /></DepartureGuardProvider>);
    const trigger = screen.getByRole("button", { name: "Switch branch" }); trigger.focus(); fireEvent.click(trigger);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay here" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: "Stay here" }), { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Discard and leave" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Save draft and leave" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("edits are still here");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
  });
  it("allows staying during a queued save; late completion cannot approve another departure", async () => {
    let resolve!: () => void;
    const save = () => new Promise<void>(r => { resolve = r; });
    render(<DepartureGuardProvider><Guarded save={save} /></DepartureGuardProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save draft and leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch branch" }));
    await act(async () => resolve());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("guards real sidebar links and browser reload, and restores Back before prompting", async () => {
    const forward = vi.spyOn(window.history, "forward").mockImplementation(() => {});
    render(<DepartureGuardProvider><Guarded /></DepartureGuardProvider>);
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Sidebar link" })); expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stay here" }));
    act(() => window.dispatchEvent(new PopStateEvent("popstate"))); expect(forward).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => window.dispatchEvent(new PopStateEvent("popstate"))); expect(await screen.findByRole("dialog")).toBeInTheDocument();
    forward.mockRestore();
  });
  it("connects the actual navbar sign-out seam to awaited save/discard/stay", async () => {
    Element.prototype.scrollIntoView = vi.fn(); const signOut = vi.fn(); const discard = vi.fn().mockResolvedValue(undefined);
    function Shell() { const guard = useDepartureGuard(); return <WorkspaceNavbar workspace="admin" currentPath="/admin/dashboard" requestDeparture={guard.requestDeparture} onSignOut={signOut} renderLink={props => <a key={props.href} href={props.href}>{props.children}</a>}><Guarded discard={discard} /></WorkspaceNavbar>; }
    render(<DepartureGuardProvider><Shell /></DepartureGuardProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const buttons = screen.getAllByRole("button", { name: /sign out/i }); fireEvent.click(buttons[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument(); expect(signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" })); await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1)); expect(discard).toHaveBeenCalledTimes(1);
  });
  it("recovery discard failures remain visible and Resume is disabled while discarding", async () => {
    render(<DraftRecoveryModal isOpen formTitle="Enrollment" lastSavedAt={123} payload={payload} onResume={vi.fn()} onDiscard={async () => { throw new Error(); }} onStay={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Preview Draft/ })); expect(screen.getByText(/"Ada"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Discard Draft/ })); expect(await screen.findByRole("alert")).toHaveTextContent("Discard failed");
  });
  it("never converts orientation to completion and exposes optional/error/current states", () => {
    const view = render(<MobileProgressIndicator mode="sections" currentStepIndex={4} totalSteps={5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    view.rerender(<MobileProgressIndicator mode="sections" sections={[{ id: "a", title: "Required", isValid: true, hasError: true }, { id: "b", title: "Extra", isValid: true, optional: true }]} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0"); expect(screen.getByText("Required: error")).toHaveAttribute("aria-current", "step");
    view.rerender(<MobileProgressIndicator mode="scroll" scrollPercentage={100} />); expect(screen.getByRole("progressbar")).toHaveAccessibleName("Page position, not completion");
    view.rerender(<MobileProgressIndicator mode="scroll" hidden />); expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
