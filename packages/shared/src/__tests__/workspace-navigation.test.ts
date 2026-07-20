import { describe, expect, it } from "vitest";
import { getWorkspaceSections, isWorkspaceSectionActive } from "../workspace-navigation";

describe("admin curriculum navigation", () => {
  const sections = getWorkspaceSections("admin");

  it("exposes both Curriculum Intelligence destinations", () => {
    expect(sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ href: "/academic/knowledge/curriculum-import", label: "Curriculum Import" }),
      expect.objectContaining({ href: "/academic/knowledge/curriculum-readiness", label: "Curriculum Readiness" }),
    ]));
  });

  it("marks the readiness section active for its nested route", () => {
    const readiness = sections.find((section) => section.href === "/academic/knowledge/curriculum-readiness");
    expect(readiness).toBeDefined();
    expect(isWorkspaceSectionActive(readiness!, "/academic/knowledge/curriculum-readiness/details")).toBe(true);
  });
});
