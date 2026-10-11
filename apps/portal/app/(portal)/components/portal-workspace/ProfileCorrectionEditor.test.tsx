// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { PROFILE_CORRECTION_WARNING } from "@school/shared/profile-corrections";
import type { ComponentProps } from "react";
import { DraftHeaderContext } from "@school/shared/drafts";
import { CorrectionEditor as ActualCorrectionEditor } from "./ProfileCorrectionEditor";
function CorrectionEditor(props: ComponentProps<typeof ActualCorrectionEditor>) {
  return <DraftHeaderContext.Provider value={document.body}><ActualCorrectionEditor {...props} /></DraftHeaderContext.Provider>;
}
import type { CorrectionDetail, CorrectionWorkspace } from "./ProfileCorrections";
const mocks = vi.hoisted(() => ({ save: vi.fn(), discard: vi.fn(), refresh: vi.fn(), submit: vi.fn(), review: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => ({ saveDraft: mocks.save, discardDraft: mocks.discard, refreshBaseline: mocks.refresh, submit: mocks.submit })[getFunctionName(ref).split(":")[1] as "saveDraft" | "discardDraft" | "refreshBaseline" | "submit"],
  useConvex: () => ({ query: mocks.review }),
}));
const schoolId = "school" as Id<"schools">;
const requestId = "request" as Id<"profileCorrectionRequests">;
const userId = "parent" as Id<"users">;
function fixture() {
  const request: CorrectionDetail = { _id: requestId, _creationTime: 1, schoolId, requesterUserId: userId,
    requestKey: "request-key-0001", requestedScope: { parentFields: ["phone"], childFields: [] },
    allowedScope: { parentFields: ["phone"], childFields: [] }, reason: "Correct phone", state: "granted", revision: 1,
    draftRevision: 1, draft: { parent: { phone: "08022222222" } }, createdAt: 1, updatedAt: 1, lastSavedAt: 1, stale: false };
  const workspace: CorrectionWorkspace = { parent: { name: "Pat Smith", firstName: "Pat", middleName: null, lastName: "Smith", phone: "08011111111" }, addresses: [], child: null, requests: [] };
  return { request, workspace };
}
beforeEach(() => {
  mocks.review.mockResolvedValue({ changes: [{ target: "parent", targetId: "parent", field: "phone", before: "08011111111", after: "08022222222" }], reviewToken: "review-token" });
  mocks.save.mockResolvedValue({ draftRevision: 2 }); mocks.submit.mockResolvedValue({ requestId, appliedAt: 10, replayed: false });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function recoverAndReview() {
  fireEvent.click(screen.getByRole("button", { name: "Recover server draft" }));
  fireEvent.click(screen.getByRole("button", { name: "Review saved changes" }));
  await screen.findByText(PROFILE_CORRECTION_WARNING);
}
it("requires explicit server recovery, does not autosave acknowledgement, and submits the reviewed revision", async () => {
  const f = fixture(); render(<CorrectionEditor schoolId={schoolId} {...f} />);
  expect(screen.getByLabelText("Your phone")).toHaveValue("08011111111"); expect(screen.getByLabelText("Your phone")).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
  await recoverAndReview();
  expect(screen.getByLabelText("Your phone")).toHaveValue("08022222222");
  expect(screen.getByText(PROFILE_CORRECTION_WARNING).tagName).toBe("STRONG");
  expect(screen.getByRole("button", { name: "Apply changes now" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "I understand and want to apply these changes now." }));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply changes now" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledOnce());
  expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({ schoolId, requestId, expectedRevision: 1, expectedDraftRevision: 1, reviewToken: "review-token", acknowledged: true }));
});
it("editing invalidates review and acknowledgement before any autosave or final submission", async () => {
  const f = fixture(); render(<CorrectionEditor schoolId={schoolId} {...f} />); await recoverAndReview();
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.change(screen.getByLabelText("Your phone"), { target: { value: "08033333333" } });
  expect(screen.queryByRole("button", { name: "Apply changes now" })).toBeNull();
  expect(screen.getByRole("button", { name: "Review saved changes" })).toBeDisabled();
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ payload: { parent: { phone: "08033333333" } }, expectedDraftRevision: 1 })));
});
it.each(["draft", "grant", "baseline", "context"])("%s changes clear acknowledgement and reject the prior review", async kind => {
  const f = fixture(); const view = render(<CorrectionEditor schoolId={schoolId} {...f} />); await recoverAndReview(); fireEvent.click(screen.getByRole("checkbox"));
  const request = kind === "draft" ? { ...f.request, draftRevision: 2 } : kind === "grant" ? { ...f.request, revision: 2 } : kind === "baseline" ? { ...f.request, stale: true } : f.request;
  const workspace = kind === "context" ? { ...f.workspace, parent: { ...f.workspace.parent, phone: "Admin's newer phone" } } : f.workspace;
  view.rerender(<CorrectionEditor schoolId={schoolId} request={request} workspace={workspace} />);
  expect(screen.queryByRole("button", { name: "Apply changes now" })).toBeNull(); expect(mocks.submit).not.toHaveBeenCalled();
  if (kind === "draft") expect(screen.getByRole("button", { name: "Recover server draft" })).toBeEnabled();
});
it("a changed baseline preserves the draft and only refreshes after an explicit action", async () => {
  const f = fixture(); render(<CorrectionEditor schoolId={schoolId} request={{ ...f.request, stale: true }} workspace={f.workspace} />);
  expect(mocks.refresh).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Recover server draft" }));
  expect(screen.getByRole("button", { name: "Review saved changes" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh baseline for review" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith({ schoolId, requestId, expectedRevision: 1, expectedDraftRevision: 1 }));
  expect(mocks.submit).not.toHaveBeenCalled();
});
it("a failed final submission keeps the same key for an identical retry and never claims apply", async () => {
  mocks.submit.mockRejectedValueOnce(new Error("Audit write failed")); const f = fixture(); render(<CorrectionEditor schoolId={schoolId} {...f} />);
  await recoverAndReview(); fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "Apply changes now" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Audit write failed");
  expect(screen.queryByText("Applied receipt")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Apply changes now" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Apply changes now" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
  expect(mocks.submit.mock.calls[1][0]).toEqual(mocks.submit.mock.calls[0][0]);
});
