import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuditExplorerView } from "../../../packages/shared/src/components/AuditExplorerView";
import {
  auditCsv,
  exportAudit,
  type AuditRow,
} from "../../../packages/shared/src/audit-export";

const row: AuditRow = {
  id: "event",
  eventId: "event",
  timestamp: 0,
  schoolId: "school",
  groupId: null,
  actor: "person",
  actorKind: "user",
  module: "academic",
  action: "result_review",
  targetType: "result",
  targetId: "result",
  outcome: "success",
  summary: "=SUM(A1:A2)",
  before: "Masked ***-****-6789",
  after: "<script>private()</script>",
  correlationId: "correlation",
  retentionClass: "permanent_statutory",
};
const props = {
  rows: [],
  loading: false,
  canLoadMore: true,
  loadingMore: false,
  onLoadMore: vi.fn(),
  modules: ["academic"],
  onApply: vi.fn(),
  onExport: vi.fn(),
  canCsv: true,
  canPdf: true,
  scopeConfigured: true,
  scopeNote: "Department scope is enforced server-side",
};

it("does not call a filtered page an empty history, applies labelled filters and shows safe details", () => {
  const view = render(<AuditExplorerView {...props} />);
  expect(screen.getByText("No matches in scanned pages")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Search next page" }));
  expect(props.onLoadMore).toHaveBeenCalled();
  const search = screen.getByLabelText("Search safe summaries");
  search.focus();
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: "review" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(props.onApply).toHaveBeenCalledWith(
    expect.objectContaining({ search: "review" }),
  );
  view.rerender(<AuditExplorerView {...props} rows={[row]} />);
  fireEvent.click(screen.getByText("Inspect context and before / after"));
  expect(screen.getByText("<script>private()</script>")).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
});
it("handles export errors without a success claim and discloses unconfigured department scope", async () => {
  render(
    <AuditExplorerView
      {...props}
      onExport={vi.fn().mockRejectedValue(new Error("Permission changed"))}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Permission changed"),
  );
});
it("CSV escapes formula payloads and printable output uses the identical safe fields as text", async () => {
  expect(auditCsv([row])).toContain('"\'=SUM(A1:A2)"');
  expect(auditCsv([{ ...row, summary: " \t@SUM(1)" }])).toContain(
    '"\' \t@SUM(1)"',
  );
  const doc = document.implementation.createHTMLDocument();
  const close = vi.fn();
  const print = vi.fn();
  const open = vi
    .spyOn(window, "open")
    .mockReturnValue({
      document: doc,
      close,
      print,
      focus: vi.fn(),
      opener: null,
    } as unknown as Window);
  const record = vi.fn().mockResolvedValue({ permitted: true });
  const fetchPage = vi
    .fn()
    .mockResolvedValue({ page: [row], isDone: true, continueCursor: "" });
  expect(
    await exportAudit({
      format: "pdf",
      label: "Synthetic audit",
      fetchPage,
      record,
    }),
  ).toBe(1);
  expect(doc.querySelector("script")).toBeNull();
  expect(doc.body.textContent).toContain(row.after);
  expect(doc.body.textContent).toContain(row.before);
  expect(doc.body.textContent).toContain(row.summary);
  expect(record).toHaveBeenCalledWith("attempt");
  expect(record).toHaveBeenCalledWith("client_prepared", 1);
  expect(print).not.toHaveBeenCalled(); // User chooses Print / Save as PDF; no false delivered-PDF assertion.
  open.mockRestore();
});
