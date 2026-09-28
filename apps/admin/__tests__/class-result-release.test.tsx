import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import { ClassReleasePanel } from "../app/assessments/report-cards/release/ClassReleasePanel";
import type { Id } from "../../../packages/convex/_generated/dataModel";

const mocks = vi.hoisted(() => ({ query: vi.fn(), release: vi.fn(), exclude: vi.fn(), pause: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: (ref: FunctionReference<"mutation">) => getFunctionName(ref).endsWith(":excludeStudent") ? mocks.exclude : getFunctionName(ref).endsWith(":setReleasesPaused") ? mocks.pause : mocks.release,
}));
const schoolId = "school" as Id<"schools">;
const selection = { sessionId: "session", termId: "term", classId: "class" };
const context = { school: "Example School", session: "2026", term: "First", klass: "Year 1", canRelease: true, canExclude: false };
const roster = {
  released: null, eligibleCount: 2, certifiedCount: 1, excludedCount: 0, ready: false, reviewKey: "review-1",
  rows: [{ studentId: "a", name: "Amina", admissionNumber: "001", status: "certified", reason: null, reasonCode: null, canExclude: true, approvedBy: null },
    { studentId: "b", name: "Bola", admissionNumber: "002", status: "blocked", reason: "Report not certified", reasonCode: "not_certified", canExclude: true, approvedBy: null }],
};
function view(overrides = {}, access: typeof context & { releasesPaused?: boolean } = context) {
  mocks.query.mockReturnValue({ ...roster, ...overrides });
  return render(<ClassReleasePanel schoolId={schoolId} selection={selection} context={access} />);
}

beforeEach(() => { vi.clearAllMocks(); });
describe("class result release", () => {
  it("shows withheld certified counts and blocks release while a report is missing", () => {
    view();
    expect(screen.getByText("Not published")).toBeInTheDocument();
    expect(screen.getByText("Missing certification").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "Review release" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Review report card" })).toHaveAttribute("href", "/assessments/report-cards?sessionId=session&termId=term&classId=class&studentId=b");
  });
  it("respects server-derived role flags and names exclusions", () => {
    view({ excludedCount: 1, rows: [{ ...roster.rows[1], status: "excluded", reason: "Withdrawn after term close", reasonCode: "excluded", canExclude: false, approvedByName: "Ms Cole" }] });
    expect(screen.getByText("Withdrawn after term close")).toBeInTheDocument();
    expect(screen.getByText("Approved by Ms Cole")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exclude student" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review release" })).toBeInTheDocument();
  });
  it("requires confirmation, traps focus and submits the reviewed key", async () => {
    mocks.release.mockResolvedValue({ releasedAt: 1000, releasedBy: "officer", eligibleCount: 1, certifiedCount: 1, excludedCount: 0 });
    view({ ready: true, eligibleCount: 1, certifiedCount: 1, rows: [roster.rows[0]] });
    const opener = screen.getByRole("button", { name: "Review release" });
    opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Release class results?" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Release class results" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Release class results" }));
    await waitFor(() => expect(mocks.release).toHaveBeenCalledWith(expect.objectContaining({ schoolId, reviewedKey: "review-1", confirmation: "I reviewed this roster and understand that releasing it makes these reports visible to families." })));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Released to families" })).toHaveFocus());
    expect(screen.getByText(/Original release:/)).toHaveTextContent("Staff member");
    expect(screen.getByText(/Original release:/)).not.toHaveTextContent("officer");
  });
  it("rejects stale reviews and clears confirmation across tuple remounts", async () => {
    mocks.release.mockRejectedValue(new Error("Roster changed or is not ready; review again"));
    const props = { ready: true, eligibleCount: 1, certifiedCount: 1, rows: [roster.rows[0]] };
    const { rerender } = view(props);
    fireEvent.click(screen.getByRole("button", { name: "Review release" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Release class results" }));
    await waitFor(() => expect(screen.getByText("The roster changed. Review the updated list before releasing.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Release class results" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("The roster changed. Close this window");
    rerender(<ClassReleasePanel key="different-tuple" schoolId={schoolId} selection={{ ...selection, termId: "other" }} context={{ ...context, term: "Second" }} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review release" })).toBeEnabled();
  });
  it("announces a new review key in the open release dialog", () => {
    const props = { ready: true, eligibleCount: 1, certifiedCount: 1, rows: [roster.rows[0]] };
    const { rerender } = view(props);
    fireEvent.click(screen.getByRole("button", { name: "Review release" }));
    fireEvent.click(screen.getByRole("checkbox"));
    mocks.query.mockReturnValue({ ...roster, ...props, reviewKey: "review-2" });
    rerender(<ClassReleasePanel schoolId={schoolId} selection={selection} context={context} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The roster changed. Close this window");
    expect(screen.getByRole("button", { name: "Release class results" })).toBeDisabled();
  });
  it("keeps the original release metadata on an already released tuple", () => {
    view({ released: { releasedAt: 1000, releasedBy: "opaque-user-id", releasedByName: "Mr Hale", eligibleCount: 1, certifiedCount: 1, excludedCount: 0 }, ready: false });
    expect(screen.getByText(/Original release:/)).toHaveTextContent("Mr Hale");
    expect(screen.getByText(/Original release:/)).not.toHaveTextContent("opaque-user-id");
    expect(screen.queryByRole("button", { name: "Review release" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exclude student" })).not.toBeInTheDocument();
  });
  it("uses server exclusion permission and reason code, never reason prose", () => {
    view({ rows: [{ ...roster.rows[1], reason: "Report not certified", reasonCode: "enrollment_unverified", canExclude: false }] }, { ...context, canExclude: true });
    expect(screen.getByText("Contact your school administrator for review")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exclude student" })).not.toBeInTheDocument();
  });
  it("keeps frozen release status during a school pause and blocks even an exam officer", () => {
    const { rerender } = view({ ready: true, eligibleCount: 1, certifiedCount: 1, rows: [roster.rows[0]] }, { ...context, releasesPaused: true });
    expect(screen.getByRole("button", { name: "Review release" })).toBeDisabled();
    expect(screen.getByText("New class releases are paused for this school.")).toBeInTheDocument();
    rerender(<ClassReleasePanel schoolId={schoolId} selection={selection} context={{ ...context, releasesPaused: true }} />);
    mocks.query.mockReturnValue({ ...roster, released: { releasedAt: 1000, releasedBy: "officer", eligibleCount: 1, certifiedCount: 1, excludedCount: 0 } });
    rerender(<ClassReleasePanel schoolId={schoolId} selection={selection} context={{ ...context, releasesPaused: true }} />);
    expect(screen.getByRole("heading", { name: "Released to families" })).toBeInTheDocument();
    expect(screen.getByText(/Original release:/)).toHaveTextContent("Staff member");
  });
  it("lets only school admins submit a specific reason", async () => {
    mocks.exclude.mockResolvedValue(1000);
    view({}, { ...context, canRelease: false, canExclude: true });
    expect(screen.queryByRole("button", { name: "Review release" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Exclude student" })[0]);
    expect(screen.getByRole("button", { name: "Confirm exclusion" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), { target: { value: "Reviewed withdrawal record" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm exclusion" }));
    await waitFor(() => expect(mocks.exclude).toHaveBeenCalledWith(expect.objectContaining({ schoolId, studentId: "a", reason: "Reviewed withdrawal record" })));
  });
});
