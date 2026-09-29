import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, EmptyState } from "@school/shared";

describe("Avatar and EmptyState (consolidation P22)", () => {
  it("renders initials at each density", () => {
    const { rerender } = render(<Avatar name="Ada Okafor" density="sm" />);
    expect(screen.getByText("AO").className).toContain("h-8");
    rerender(<Avatar name="Ada Okafor" density="md" />);
    expect(screen.getByText("AO").className).toContain("h-10");
    rerender(<Avatar name="Ada Okafor" density="lg" />);
    expect(screen.getByText("AO").className).toContain("h-11");
  });

  it("prefers photos and keeps custom chrome", () => {
    render(
      <Avatar name="Ada Okafor" src="https://x.test/a.png" density="md" className="bg-indigo-50" imgClassName="border-slate-200" />,
    );
    const img = screen.getByAltText("Ada Okafor");
    expect(img.tagName).toBe("IMG");
    expect(img.className).toContain("border-slate-200");
    expect(img.className).not.toContain("bg-indigo-50");
  });

  it("renders empty states with optional actions", () => {
    render(<EmptyState title="Nothing here" message="Try again." action={<button>Retry</button>} />);
    expect(screen.getByText("Nothing here")).toBeDefined();
    expect(screen.getByText("Try again.")).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
  });
});
