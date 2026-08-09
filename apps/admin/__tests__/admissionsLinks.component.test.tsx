import { describe, expect, test, vi } from "vitest";
import {
  applicationLinkCopyFeedback,
  resolveAndCopyApplicationLink,
} from "../lib/admissions/models";

const link = {
  version: "1" as const,
  schoolSlug: "north-star-school",
  href: "https://apply.example.test/s/north-star-school/i/2027-entry",
  availability: "open" as const,
  intakeSlug: "2027-entry",
  opensAt: null,
  closesAt: null,
};

describe("admissions application link behavior", () => {
  test("queries canonical arguments and copies only the returned canonical href", async () => {
    const resolve = vi.fn().mockResolvedValue(link);
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(resolveAndCopyApplicationLink({
      schoolSlug: "north-star-school",
      intakeSlug: "2027-entry",
      resolve,
      clipboard: { writeText },
    })).resolves.toBe("copied");

    expect(resolve).toHaveBeenCalledWith({ schoolSlug: "north-star-school", intakeSlug: "2027-entry" });
    expect(writeText).toHaveBeenCalledWith(link.href);
    expect(applicationLinkCopyFeedback("copied")).toEqual({ title: "Admissions link copied to clipboard!" });
  });

  test("reports canonical-link unavailability and query failures distinctly", async () => {
    const unavailable = await resolveAndCopyApplicationLink({
      schoolSlug: "north-star-school",
      intakeSlug: "2027-entry",
      resolve: async () => ({ ...link, availability: "unavailable" }),
    });
    const queryFailure = await resolveAndCopyApplicationLink({
      schoolSlug: "north-star-school",
      intakeSlug: "2027-entry",
      resolve: async () => { throw new Error("network failed"); },
    });

    expect(unavailable).toBe("unavailable");
    expect(queryFailure).toBe("resolution_failed");
    expect(applicationLinkCopyFeedback(unavailable)).toMatchObject({ title: "Application link unavailable" });
    expect(applicationLinkCopyFeedback(queryFailure)).toMatchObject({ title: "Could not resolve application link" });
  });

  test("reports missing and rejected clipboard writes without claiming link resolution failed", async () => {
    const resolve = vi.fn().mockResolvedValue(link);
    const missingClipboard = await resolveAndCopyApplicationLink({
      schoolSlug: "north-star-school",
      intakeSlug: "2027-entry",
      resolve,
      clipboard: undefined,
    });
    const rejectedClipboard = await resolveAndCopyApplicationLink({
      schoolSlug: "north-star-school",
      intakeSlug: "2027-entry",
      resolve,
      clipboard: { writeText: async () => { throw new Error("denied"); } },
    });

    expect(missingClipboard).toBe("clipboard_unavailable");
    expect(rejectedClipboard).toBe("clipboard_unavailable");
    expect(applicationLinkCopyFeedback(rejectedClipboard)).toMatchObject({ title: "Could not copy application link" });
    expect(applicationLinkCopyFeedback(rejectedClipboard)).not.toEqual(applicationLinkCopyFeedback("resolution_failed"));
  });
});
