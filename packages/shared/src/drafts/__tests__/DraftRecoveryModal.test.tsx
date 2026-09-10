import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DraftRecoveryModal } from "../DraftRecoveryModal";
import { DraftStatusIndicator } from "../DraftStatusIndicator";
import { DRAFT_STATUS_CONFIGS } from "../types";
import { isLatestDraftSaveRequest } from "../useFormDraft";

describe("DraftRecoveryModal and Draft Status Components", () => {
  describe("DraftRecoveryModal Invariants and Content", () => {
    it("renders returning user draft prompt without silent overwrite (Invariant I3)", () => {
      const now = new Date("2026-09-03T11:24:00").getTime();
      const html = renderToStaticMarkup(
        createElement(DraftRecoveryModal, {
          isOpen: true,
          formTitle: "Student Onboarding",
          lastSavedAt: now,
          authorName: "Dr. Aminat Adebayo (Lekki Campus)",
          subjectName: "Chidinma Okafor (JSS 1A)",
          completionSummary: "4 of 6 sections completed (65% data density)",
          payload: { firstName: "Chidinma", lastName: "Okafor" },
          onResume: vi.fn(),
          onDiscard: vi.fn(),
          onPreview: vi.fn(),
        })
      );

      // Dialog attributes
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');

      // Title & description
      expect(html).toContain("Resume editing Student Onboarding?");
      expect(html).toContain("Chidinma Okafor (JSS 1A)");
      expect(html).toContain("Dr. Aminat Adebayo (Lekki Campus)");
      expect(html).toContain("4 of 6 sections completed (65% data density)");

      // Three distinct actions
      expect(html).toContain("Resume Editing Draft");
      expect(html).toContain("Preview Draft");
      expect(html).toContain("Discard Draft &amp; Start Fresh");
    });

    it("renders nothing when isOpen is false", () => {
      const html = renderToStaticMarkup(
        createElement(DraftRecoveryModal, {
          isOpen: false,
          formTitle: "Student Onboarding",
          lastSavedAt: Date.now(),
          onResume: vi.fn(),
          onDiscard: vi.fn(),
        })
      );

      expect(html).toBe("");
    });
  });

  describe("Autosave request sequencing", () => {
    it("rejects a stale completion after a newer save request starts", () => {
      const firstRequest = 1;
      const secondRequest = 2;

      expect(isLatestDraftSaveRequest(secondRequest, secondRequest)).toBe(true);
      expect(isLatestDraftSaveRequest(firstRequest, secondRequest)).toBe(false);
    });
  });

  describe("Truthful Connectivity and Offline Claim Invariant", () => {
    it("explicitly flags connection_lost with truthful recovery label (Zero False Offline Claims)", () => {
      const config = DRAFT_STATUS_CONFIGS.connection_lost;
      expect(config.label).toBe("Connection lost \u2022 Recovery pending");
      expect(config.truthfulOfflineClaim).toBe(true);
      expect(config.description).toContain("Changes are held in local browser memory");

      const html = renderToStaticMarkup(
        createElement(DraftStatusIndicator, {
          status: "connection_lost",
          showExplanation: true,
        })
      );

      expect(html).toContain("Connection lost \u2022 Recovery pending");
      expect(html).toContain("Changes are held in local browser memory");
    });

    it("renders saved status with time when silentOnSuccess is false", () => {
      const savedTime = new Date("2026-09-03T14:32:00").getTime();
      const html = renderToStaticMarkup(
        createElement(DraftStatusIndicator, {
          status: "saved",
          lastSavedAt: savedTime,
          silentOnSuccess: false,
        })
      );

      expect(html).toContain("Draft saved at");
    });

    it("renders nothing on saved and saving when silentOnSuccess is true (zero layout shift)", () => {
      const savedTime = new Date("2026-09-03T14:32:00").getTime();
      const htmlSaved = renderToStaticMarkup(
        createElement(DraftStatusIndicator, {
          status: "saved",
          lastSavedAt: savedTime,
          silentOnSuccess: true,
        })
      );
      expect(htmlSaved).toBe("");

      const htmlSaving = renderToStaticMarkup(
        createElement(DraftStatusIndicator, {
          status: "saving",
          silentOnSuccess: true,
        })
      );
      expect(htmlSaving).toBe("");
    });

    it("renders save_failed with retry button even when silentOnSuccess is true", () => {
      const html = renderToStaticMarkup(
        createElement(DraftStatusIndicator, {
          status: "save_failed",
          silentOnSuccess: true,
          onRetry: vi.fn(),
        })
      );

      expect(html).toContain("Save failed \u2022 Retry");
      expect(html).toContain("Retry");
    });
  });
});
