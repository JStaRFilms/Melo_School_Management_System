import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileProgressIndicator, WizardSection } from "../MobileProgressIndicator";

describe("MobileProgressIndicator Component", () => {
  describe("Mode A: Viewport Scroll Progress", () => {
    it("renders scroll percentage and Page label correctly", () => {
      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 64,
        })
      );

      expect(html).toContain("Page 64%");
      expect(html).toContain('style="width:64%"');
      expect(html).toContain('aria-valuenow="64"');
    });

    it("clamps scroll progress to [0, 100]", () => {
      const htmlOver = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 150,
        })
      );
      expect(htmlOver).toContain("Page 100%");
      expect(htmlOver).toContain('style="width:100%"');

      const htmlUnder = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: -20,
        })
      );
      expect(htmlUnder).toContain("Page 0%");
      expect(htmlUnder).toContain('style="width:0%"');
    });
  });

  describe("Mode B: Validated Section Completion", () => {
    it("strictly advances progress based on validated sections, not scrolled/current step (Invariant I2)", () => {
      const sections: WizardSection[] = [
        { id: "s1", title: "Student Bio", isValid: true },
        { id: "s2", title: "Academics", isValid: true },
        { id: "s3", title: "Guardian & Contacts", isValid: false }, // Currently on this step, but invalid!
        { id: "s4", title: "Health & Immunization", isValid: false },
      ];

      // Even though user is viewing step 3 (currentStepIndex = 2), only 2 of 4 sections are valid!
      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "sections",
          sections,
          currentStepIndex: 2,
        })
      );

      // Progress bar must be 50% (2/4), NOT 75% (3/4)
      expect(html).toContain('style="width:50%"');
      expect(html).toContain('aria-valuenow="50"');
      expect(html).toContain("Step 3 of 4: Guardian &amp; Contacts");
    });

    it("reaches 100% only when all sections pass validation rules", () => {
      const sections: WizardSection[] = [
        { id: "s1", title: "Step 1", isValid: true },
        { id: "s2", title: "Step 2", isValid: true },
        { id: "s3", title: "Step 3", isValid: true },
      ];

      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "sections",
          sections,
          currentStepIndex: 2,
        })
      );

      expect(html).toContain('style="width:100%"');
      expect(html).toContain('aria-valuenow="100"');
    });
  });

  describe("Integrated Persistence Status Pill", () => {
    it("renders saving state spinner", () => {
      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 50,
          draftStatus: "saving",
        })
      );

      expect(html).toContain("Saving...");
    });

    it("renders saved state with timestamp", () => {
      const timestamp = new Date("2026-09-03T14:32:00").getTime();
      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 50,
          draftStatus: "saved",
          lastSavedAt: timestamp,
        })
      );

      expect(html).toContain("Saved");
    });

    it("renders truthful recovery pending state when connectivity is lost (Zero False Offline Claims)", () => {
      const html = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 50,
          draftStatus: "connection_lost",
        })
      );

      expect(html).toContain("Recovery pending");
      expect(html).toContain('title="Connection lost • Recovery pending"');
    });

    it("renders conflict and save failed states", () => {
      const htmlFailed = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 50,
          draftStatus: "save_failed",
        })
      );
      expect(htmlFailed).toContain("Save failed");

      const htmlConflict = renderToStaticMarkup(
        createElement(MobileProgressIndicator, {
          mode: "scroll",
          scrollPercentage: 50,
          draftStatus: "conflict",
        })
      );
      expect(htmlConflict).toContain("Conflict");
    });
  });
});
