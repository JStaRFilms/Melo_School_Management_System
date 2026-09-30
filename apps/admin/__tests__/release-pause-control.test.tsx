import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReleasePauseControl } from "../app/assessments/report-cards/release/ReleasePauseControl";
import type { Id } from "../../../packages/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ pause: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.pause }));
const onTransition = vi.fn();
const props = { schoolId: "school" as Id<"schools">, school: "Example School", paused: false, reason: null, updatedAt: null, canManage: true, transition: false, onTransition };
beforeEach(() => { vi.clearAllMocks(); });

describe("school release pause", () => {
  it("requires a reason and confirmation, then sends the school-scoped pause request", async () => {
    mocks.pause.mockResolvedValue({});
    const { rerender } = render(<ReleasePauseControl {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause releases" }));
    const submit = screen.getByRole("button", { name: "Confirm pause" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "Class roster needs review" } });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm this change/ }));
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith({ schoolId: props.schoolId, releasesPaused: true, reason: "Class roster needs review" }));
    expect(onTransition).toHaveBeenCalledWith(true);
    rerender(<ReleasePauseControl {...props} paused reason="Class roster needs review" updatedAt={1000} />);
    expect(screen.getByText(/Published reports remain visible to families/)).toBeInTheDocument();
    expect(screen.getByText(/Latest pause reason: Class roster needs review/)).toBeInTheDocument();
  });
  it("shows status to an exam officer but no toggle", () => {
    render(<ReleasePauseControl {...props} paused canManage={false} />);
    expect(screen.getByText(/New class releases are paused/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /releases/i })).not.toBeInTheDocument();
  });
  it("requires confirmation to resume and keeps the dialog and reason on failure", async () => {
    mocks.pause.mockRejectedValue(new Error("Permission denied"));
    render(<ReleasePauseControl {...props} paused reason="Previous pause" updatedAt={1000} />);
    fireEvent.click(screen.getByRole("button", { name: "Resume releases" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "Roster review completed" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I confirm this change/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm resume" }));
    await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith({ schoolId: props.schoolId, releasesPaused: false, reason: "Roster review completed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveValue("Roster review completed");
    expect(onTransition).toHaveBeenLastCalledWith(null);
  });
});
