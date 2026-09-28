import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionScoringEditor } from "../app/assessments/setup/exam-recording/components/SessionScoringEditor";

const state = vi.hoisted(() => ({
  job: null as null | { phase: string; policy: { ca1Max: number; ca2Max: number; ca3Max: number; examRawMax: number; examContributionMax: number }; expectedVersion: number; scanned: number; invalidCount: number; updated: number; invalidExamples: Array<{ studentId: string; termId: string; classId: string; subjectId: string; recordId: string; field: string; message: string }> },
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  current: { policy: { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 }, version: 0, source: "legacy" as "legacy" | "session" },
}));
const original = { ca1Max: 20, ca2Max: 20, ca3Max: 20, examRawMax: 40, examContributionMax: 40 };
vi.mock("convex/react", () => ({
  useQuery: (name: string, args: unknown) => {
    if (name.endsWith(":getSessionScoringPolicy")) return state.current;
    if (name.endsWith(":getSessionScoringJob")) return state.job;
    if (name.endsWith(":previewSessionScoringChange")) return args === "skip" ? undefined : {
      phase: state.job?.phase ?? "not_started", count: state.job?.scanned ?? 0,
      invalidCount: state.job?.invalidCount ?? 0, invalidCountIsPartial: state.job?.phase === "scanning",
      canApply: state.job?.phase === "ready" && state.job.invalidCount === 0,
      warning: "Issued reports remain unchanged.",
    };
  },
  useMutation: (name: string) => async (args: Record<string, unknown>) => {
    state.calls.push({ name, args });
    if (name.endsWith(":startSessionScoringScan")) state.job = { phase: "scanning", policy: args.policy as typeof original, expectedVersion: 0, scanned: 0, invalidCount: 0, updated: 0, invalidExamples: [] };
    if (name.endsWith(":applySessionScoringChange") && state.job) state.job.phase = "regrading";
    if (name.endsWith(":cancelSessionScoringScan")) state.job = null;
  },
}));
vi.mock("@school/shared/drafts", () => ({ useDirtyForm: () => {} }));

beforeEach(() => { state.job = null; state.calls = []; state.current = { policy: original, version: 0, source: "legacy" }; });

describe("session scoring editor", () => {
  it("keeps decimal weight text until complete and scans exact hundredths", async () => {
    render(<SessionScoringEditor sessionId={"session1" as never} />);
    const input = screen.getByLabelText("CA 1 contribution") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "20." } });
    expect(input.value).toBe("20.");
    expect(screen.getByRole("button", { name: "Scan all session scores" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(input, { target: { value: "20.25" } });
    fireEvent.change(screen.getByLabelText("CA 2 contribution"), { target: { value: "19.75" } });
    expect(screen.getByText(/total 100\/100/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scan all session scores" }));
    await waitFor(() => expect(state.calls[0].args.policy).toMatchObject({ ca1Max: 20.25, ca2Max: 19.75 }));
  });
  it("requires a complete valid scan and confirmation before starting regrade", async () => {
    const view = render(<SessionScoringEditor sessionId={"session1" as never} />);
    fireEvent.click(screen.getByRole("button", { name: /20\/20\/10/ }));
    expect(screen.getByText(/total 100\/100/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scan all session scores" }));
    await waitFor(() => expect(state.calls).toHaveLength(1));
    expect(state.calls[0].args).toMatchObject({ expectedVersion: 0, expectedPolicy: original, policy: { ca3Max: 10, examRawMax: 50, examContributionMax: 50 } });
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.queryByRole("button", { name: "Start regrade" })).toBeNull();
    state.job = { ...state.job!, phase: "ready", scanned: 101 };
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByText(/Final scan: 101 affected records, 0 invalid/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start regrade" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed the complete scan/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start regrade" }));
    await waitFor(() => expect(state.calls).toHaveLength(2));
    expect(state.calls[1].args).toMatchObject({ confirmRegrade: true, expectedVersion: 0 });
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByText(/regrading/)).toBeTruthy();
    expect(screen.queryByText(/Regrade complete/)).toBeNull();
  });

  it("restores a ready scan after refresh without replacing later edits", async () => {
    state.job = { phase: "ready", policy: { ...original, ca3Max: 10, examRawMax: 50, examContributionMax: 50 }, expectedVersion: 0, scanned: 8, invalidCount: 0, updated: 0, invalidExamples: [] };
    const view = render(<SessionScoringEditor sessionId={"session1" as never} />);
    await waitFor(() => expect((screen.getByLabelText("Exam raw maximum") as HTMLInputElement).value).toBe("50"));
    expect(screen.getByRole("button", { name: "Start regrade" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Exam raw maximum"), { target: { value: "80" } });
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect((screen.getByLabelText("Exam raw maximum") as HTMLInputElement).value).toBe("80");
    expect(screen.queryByRole("button", { name: "Start regrade" })).toBeNull();
  });

  it("pins unchanged legacy weights through the full scan flow", async () => {
    const view = render(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByRole("button", { name: "Scan all session scores" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /Save these legacy weights/ }));
    fireEvent.click(screen.getByRole("button", { name: "Scan all session scores" }));
    await waitFor(() => expect(state.calls).toHaveLength(1));
    expect(state.calls[0].args).toMatchObject({ policy: original, expectedVersion: 0 });
    state.job = { ...state.job!, phase: "ready", scanned: 1 };
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByRole("button", { name: "Start regrade" })).toBeTruthy();
  });

  it("keeps an unsaved draft on version change until a deliberate rebase and new scan", async () => {
    const view = render(<SessionScoringEditor sessionId={"session1" as never} />);
    fireEvent.click(screen.getByRole("button", { name: /20\/20\/10/ }));
    state.current = { policy: { ...original, examRawMax: 60 }, version: 1, source: "session" };
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByRole("alert").textContent).toContain("Your draft is intact");
    expect((screen.getByLabelText("Exam raw maximum") as HTMLInputElement).value).toBe("50");
    expect(screen.getByRole("button", { name: "Scan all session scores" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Rebase draft on version 1/ }));
    expect((screen.getByLabelText("Exam raw maximum") as HTMLInputElement).value).toBe("50");
    fireEvent.click(screen.getByRole("button", { name: "Scan all session scores" }));
    await waitFor(() => expect(state.calls).toHaveLength(1));
    expect(state.calls[0].args).toMatchObject({ expectedVersion: 1, expectedPolicy: state.current.policy, policy: { examRawMax: 50 } });
  });

  it("blocks invalid counts, lists sample references and allows cancelling", async () => {
    state.job = { phase: "invalid", policy: { ...original, ca3Max: 10, examContributionMax: 50 }, expectedVersion: 0, scanned: 101, invalidCount: 1, updated: 0,
      invalidExamples: [{ studentId: "student7", termId: "term3", classId: "class2", subjectId: "subject4", recordId: "record9", field: "ca3", message: "must be between 0 and 10" }] };
    const view = render(<SessionScoringEditor sessionId={"session1" as never} />);
    view.rerender(<SessionScoringEditor sessionId={"session1" as never} />);
    expect(screen.getByText(/student7, term term3, record record9/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open the student score sheet" }).getAttribute("href")).toBe("/assessments/results/entry?sessionId=session1&termId=term3&classId=class2&subjectId=subject4&studentId=student7");
    expect(screen.queryByRole("button", { name: "Start regrade" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel scan and unlock" }));
    await waitFor(() => expect(state.calls[0].name).toMatch(/cancelSessionScoringScan/));
  });
});
