import { describe, expect, it } from "vitest";
import { getWorkspaceSections, isWorkspaceSectionActive, resolveWorkspaceSwitchHref } from "../workspace-navigation";

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

describe("workspace switching origins", () => {
  it("uses each app's localhost port during local development", () => {
    expect(resolveWorkspaceSwitchHref("teacher", "http://localhost:3002")).toBe("http://localhost:3001/");
  });

  it("uses each app's HTTPS port on the same Tailscale host", () => {
    const adminOrigin = "https://johnsax.example.ts.net:3402";
    expect(resolveWorkspaceSwitchHref("teacher", adminOrigin)).toBe("https://johnsax.example.ts.net:3401/");
    expect(resolveWorkspaceSwitchHref("portal", adminOrigin)).toBe("https://johnsax.example.ts.net:3403/");
    expect(resolveWorkspaceSwitchHref("admin", "https://johnsax.example.ts.net:3401")).toBe("https://johnsax.example.ts.net:3402/admin/dashboard");
  });
});
