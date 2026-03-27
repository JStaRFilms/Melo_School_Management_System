import { describe, expect, it } from "vitest";
import {
  AUTH_ERROR_MESSAGES,
  getSignInErrorMessage,
  isValidEmailAddress,
} from "@school/auth";

describe("sign in error helpers", () => {
  it("recognizes valid email addresses", () => {
    expect(isValidEmailAddress("teacher@school.com")).toBe(true);
    expect(isValidEmailAddress("teacher@school")).toBe(false);
  });

  it("normalizes Better Auth credential failures", () => {
    expect(
      getSignInErrorMessage({
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "User not found",
      })
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);

    expect(
      getSignInErrorMessage({
        message: "Invalid password",
      })
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);
  });

  it("normalizes malformed email failures", () => {
    expect(
      getSignInErrorMessage({
        code: "INVALID_EMAIL",
        message: "Email is invalid",
      })
    ).toBe(AUTH_ERROR_MESSAGES.invalidEmail);
  });
});
