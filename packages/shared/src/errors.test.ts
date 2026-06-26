import { describe, expect, it } from "vitest";
import { getUserFacingErrorMessage } from "./errors";

describe("getUserFacingErrorMessage", () => {
  it("extracts ConvexError details from production mutation errors", () => {
    const error = new Error(
      "[CONVEX M(functions/academic/academicSetup:archiveTeacher)] [Request ID: fc35030f33c48d9b] Server Error\n" +
        "Uncaught ConvexError: Reassign this teacher before archiving. Active links: form teacher for Primary 5 - Olive Gold.\n" +
        "Called by client"
    );

    expect(getUserFacingErrorMessage(error, "Fallback")).toBe(
      "Reassign this teacher before archiving. Active links: form teacher for Primary 5 - Olive Gold."
    );
  });

  it("removes Convex client suffix and stack-like trailing whitespace", () => {
    const error = new Error(
      "Uncaught ConvexError: Reassign this teacher before archiving.\n" +
        "    at handler (functions/academic/academicSetup.ts:540:11)\n\n" +
        "Called by client"
    );

    expect(getUserFacingErrorMessage(error, "Fallback")).toBe(
      "Reassign this teacher before archiving."
    );
  });

  it("falls back for non-error values", () => {
    expect(getUserFacingErrorMessage("Server Error", "Fallback")).toBe("Fallback");
  });
});
