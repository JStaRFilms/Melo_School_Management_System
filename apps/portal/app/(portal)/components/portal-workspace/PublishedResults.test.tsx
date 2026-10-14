// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@school/convex/_generated/dataModel";
import { PublishedResults } from "./PublishedResults";

const mocks = vi.hoisted(() => ({ sessions: { results: [{ sessionId: "new-year", name: "2026/27" }, { sessionId: "old-year", name: "2024/25" }], status: "CanLoadMore", loadMore: vi.fn() }, history: { results: [] as Array<{ resultKind: string; sessionId: string; termId: string; sessionName: string; termName: string; href: string; className: string; mode: string; averageScore: number }> , status: "CanLoadMore", loadMore: vi.fn() }, args: vi.fn() }));
vi.mock("convex/react", () => ({ usePaginatedQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
  mocks.args(args);
  return getFunctionName(ref).endsWith(":listResultSessions") ? mocks.sessions : mocks.history;
} }));
afterEach(() => { cleanup(); mocks.args.mockClear(); mocks.sessions.loadMore.mockClear(); mocks.history.loadMore.mockClear(); mocks.history.results = []; });

it("defaults to the first chronologically indexed session when no session is chosen", () => {
  render(<PublishedResults studentId={"child" as Id<"students">} initialSessionId={null} />);
  expect(screen.getByLabelText("Session / year")).toHaveValue("new-year");
  expect(mocks.args).toHaveBeenCalledWith({ studentId: "child", sessionId: "new-year", resultKind: "end_of_term" });
});

it("selects session/year before terms and continues an empty filtered page", () => {
  render(<PublishedResults studentId={"child" as Id<"students">} initialSessionId={"old-year" as Id<"academicSessions">} />);
  expect(screen.getByLabelText("Session / year")).toHaveValue("old-year");
  expect(mocks.args).toHaveBeenCalledWith({ studentId: "child", sessionId: "old-year", resultKind: "end_of_term" });
  fireEvent.click(screen.getByRole("button", { name: "Load more terms" }));
  expect(mocks.history.loadMore).toHaveBeenCalledWith(6);
  fireEvent.click(screen.getByRole("button", { name: "Load older sessions" }));
  expect(mocks.sessions.loadMore).toHaveBeenCalledWith(20);
  fireEvent.change(screen.getByLabelText("Session / year"), { target: { value: "new-year" } });
  expect(mocks.args).toHaveBeenCalledWith({ studentId: "child", sessionId: "new-year", resultKind: "end_of_term" });
});

it("renders all continued reports beyond twelve with issued historical class and explicit result kind links", () => {
  mocks.history.results = Array.from({ length: 15 }, (_, i) => ({ resultKind: "end_of_term", sessionId: "old-year", termId: `term-${i}`, sessionName: "2024/25", termName: `Published ${i}`, href: `/report-cards?studentId=child&sessionId=old-year&termId=term-${i}&resultKind=end_of_term`, className: "Historical class", mode: "graded", averageScore: 83 }));
  render(<PublishedResults studentId={"child" as Id<"students">} initialSessionId={"old-year" as Id<"academicSessions">} />);
  expect(screen.getAllByRole("link")).toHaveLength(15);
  expect(screen.getByRole("link", { name: /Published 14/ })).toHaveAttribute("href", expect.stringContaining("resultKind=end_of_term"));
});
