// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortalReportCardLayout } from "./PortalWorkspaceContent";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@school/shared", () => ({
  ReportCardPreview: () => <div>Issued sheet</div>,
  ReportCardToolbar: ({ onPrint }: { onPrint: () => void }) => <button onClick={onPrint}>Export / Print</button>,
  ReportScoringPrintWarning: ({ message, onContinue, onCancel }: { message: string; onContinue: () => void; onCancel: () => void }) => <div role="dialog">{message}<button onClick={onCancel}>Cancel print</button><button onClick={onContinue}>Print issued copy anyway</button></div>,
}));

const print = vi.fn();
beforeEach(() => { print.mockClear(); vi.stubGlobal("print", print); });
afterEach(cleanup);
const workspace = (warning?: string) => ({
  selectedReportCard: { student: { _id: "student1", name: "Ada" }, scoringPolicyWarning: warning, results: [] },
  selectedReportMode: "graded", selectedResultState: "released",
  selectedSessionId: "session1", selectedTermId: "term1",
  students: [], history: [], selectedStudentId: "student1",
}) as never;

describe("family report printing", () => {
  it("shows a screen-only warning and waits for consent before printing an outdated issued copy", () => {
    render(<PortalReportCardLayout workspace={workspace("Issued copy predates the regrade.")} onSelectHistoryItem={() => {}} onSelectStudent={() => {}} />);
    expect(screen.getByRole("status").className).toContain("rc-no-print");
    fireEvent.click(screen.getByRole("button", { name: "Export / Print" }));
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel print" }));
    expect(print).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export / Print" }));
    fireEvent.click(screen.getByRole("button", { name: "Print issued copy anyway" }));
    expect(print).toHaveBeenCalledTimes(1);
  });
  it("prints an unaffected report without a warning", () => {
    render(<PortalReportCardLayout workspace={workspace()} onSelectHistoryItem={() => {}} onSelectStudent={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Export / Print" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
