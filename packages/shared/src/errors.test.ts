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

  it("extracts custom string or object from error.data on ConvexError", () => {
    const errorWithData = Object.assign(
      new Error("[CONVEX M(functions/academic/studentEnrollment:createStudent)] Server Error"),
      { data: "A student with this admission number already exists" }
    );
    expect(getUserFacingErrorMessage(errorWithData, "Fallback")).toBe(
      "A student with this admission number already exists"
    );

    const errorWithDataObj = Object.assign(
      new Error("[CONVEX M(functions/academic/studentEnrollment:createStudent)] Server Error"),
      { data: { message: "Class is full" } }
    );
    expect(getUserFacingErrorMessage(errorWithDataObj, "Fallback")).toBe("Class is full");
  });

  it("falls back for non-error values or plain Server Error", () => {
    expect(getUserFacingErrorMessage("Server Error", "Fallback")).toBe("Fallback");
    expect(getUserFacingErrorMessage(new Error("Server Error"), "Fallback")).toBe("Fallback");
  });
});
