// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NarrativeReport } from "./NarrativeReport";

describe("issued progress report paper", () => {
  it("renders each issued subject independently with fixed historical context and A4 print rules", () => {
    const { container } = render(<NarrativeReport report={{ issuedAt: 1750000000000, snapshot: {
      schoolName: "School A", studentName: "Ada", admissionNumber: "A-01",
      className: "Former class", sessionName: "2024/25", termName: "Term 2",
      subjects: [
        { subjectId: "music", name: "Music", order: 1, comment: "Keeps a steady beat." },
        { subjectId: "art", name: "Art", order: 0, comment: "Uses colour with care.\nWorks together." },
      ],
    } }} />);
    expect(screen.getByText("Former class")).toBeTruthy();
    expect(screen.getByText("2024/25 | Term 2")).toBeTruthy();
    expect(container.querySelector("section p")?.textContent).toBe("Uses colour with care.\nWorks together.");
    expect(screen.getByText("Keeps a steady beat.")).toBeTruthy();
    expect(container.textContent?.indexOf("Art")).toBeLessThan(container.textContent!.indexOf("Music"));
    const css = container.querySelector("style")?.textContent;
    expect(css).toContain("@page { size: A4; margin: 14mm; }");
    expect(css).toContain(".narrative-paper, .narrative-paper * { color: #111827 !important; background: white !important; }");
    expect(css).toContain("section { break-inside: auto; }");
    expect(css).toContain("orphans: 3; widows: 3;");
    expect(container.textContent).not.toMatch(/average|grade|score|rank|draft/i);
  });
  it("lets a long comment flow across pages despite the tenant heading's inline colour", () => {
    const { container } = render(<NarrativeReport report={{ issuedAt: 1, snapshot: {
      schoolName: "School", primaryColor: "#fafafa", accentColor: "#ffffff", studentName: "Ada",
      admissionNumber: "A-1", className: "Class", sessionName: "2025", termName: "First",
      subjects: [{ subjectId: "art", name: "Art", order: 0, comment: "Long note.\n".repeat(150) }],
    } }} />);
    expect(container.querySelector("header p")?.getAttribute("style")).toContain("var(--school-primary)");
    expect(container.querySelector("section p")?.textContent).toContain("Long note.\nLong note.");
    expect(container.querySelector("style")?.textContent).toContain(".narrative-paper * { color: #111827 !important");
    expect(container.querySelector("style")?.textContent).toContain("section { break-inside: auto; }");
  });
});
