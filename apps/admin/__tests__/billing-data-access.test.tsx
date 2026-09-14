import { renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useBillingData } from "../app/billing/hooks/useBillingData";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({ useQuery: mocks.query }));

beforeEach(() => {
  mocks.query.mockReset();
  mocks.query.mockReturnValue(undefined);
});

it("skips admin-only academic selectors for a delegated billing manager", () => {
  renderHook(() => useBillingData(
    { classId: "", sessionId: "", termId: "", status: "", search: "" },
    { classId: "", sessionId: "" },
    { sessionId: "" },
    false,
  ));

  expect(mocks.query.mock.calls.find(
    ([name]) => name === "functions/billing:getBillingDashboard",
  )?.[1]).not.toBe("skip");
  expect(mocks.query.mock.calls.find(
    ([name]) => name === "functions/academic/academicSetup:listClasses",
  )?.[1]).toBe("skip");
  expect(mocks.query.mock.calls.find(
    ([name]) => name === "functions/academic/academicSetup:listSessions",
  )?.[1]).toBe("skip");
});
