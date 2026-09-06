import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { BranchBrandingEditor } from "../app/admin/group/GroupBranding";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("convex/react", () => ({
  useQuery: mocks.query,
  useMutation: () => vi.fn(),
  useConvex: () => ({ query: vi.fn() }),
}));

it("loads branch branding directly for an authorized branch route", () => {
  mocks.query.mockImplementation((ref: FunctionReference<"query">) =>
    getFunctionName(ref).endsWith(":getBranchBranding")
      ? {
          source: "group",
          theme: { primaryColor: "#112233", accentColor: "#445566" },
          groupVersion: 1,
          revision: 0,
          mode: "inherit",
          defaultTheme: { primaryColor: "#112233", accentColor: "#445566" },
          slug: "test-school",
        }
      : undefined,
  );

  render(
    <BranchBrandingEditor
      groupId={"group" as never}
      schoolId={"school" as never}
    />,
  );

  expect(screen.getByRole("heading", { name: "Branch branding" })).toBeInTheDocument();
  const branchCall = mocks.query.mock.calls.find(([ref]) =>
    getFunctionName(ref).endsWith(":getBranchBranding"),
  );
  expect(branchCall?.[1]).toEqual({ groupId: "group", schoolId: "school" });
});
