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

    expect(
      getSignInErrorMessage({
        error: {
          code: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        },
      })
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);

    expect(
      getSignInErrorMessage({
        status: 403,
        statusText: "Forbidden",
      })
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);

    expect(
      getSignInErrorMessage({
        status: 500,
        statusText: "Internal Server Error",
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

  it("normalizes network and service failures separately from credential failures", () => {
    expect(
      getSignInErrorMessage({
        message: "Failed to fetch",
      })
    ).toBe(AUTH_ERROR_MESSAGES.retry);

    expect(
      getSignInErrorMessage({
        status: 503,
        statusText: "Service Unavailable",
      })
    ).toBe(AUTH_ERROR_MESSAGES.retry);
  });
});
