import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObhisNavigation } from "@/renderers/obhis-v1/navigation";

describe("OBHIS navigation", () => {
  test("renders a labelled modal trigger and no mobile dialog until requested", () => {
    const markup = renderToStaticMarkup(<ObhisNavigation name="Approved test identity" homeHref="/" items={[{ href: "/visit", label: "Visit", current: false }]} applicationHref={null} logo={null} />);
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-controls="obhis-mobile-navigation"');
    expect(markup).not.toContain('role="dialog"');
  });
});
