import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../phoneNormalizer";

describe("phoneNormalizer", () => {
  it("normalizes standard Nigerian 11-digit local phone starting with 0", () => {
    expect(normalizePhoneNumber("08031234567")).toBe("+2348031234567");
    expect(normalizePhoneNumber("07012345678")).toBe("+2347012345678");
    expect(normalizePhoneNumber("09087654321")).toBe("+2349087654321");
  });

  it("normalizes Nigerian phone with spaces, dashes, or +234", () => {
    expect(normalizePhoneNumber("+234 803 123 4567")).toBe("+2348031234567");
    expect(normalizePhoneNumber("2348031234567")).toBe("+2348031234567");
    expect(normalizePhoneNumber("080-3123-4567")).toBe("+2348031234567");
  });

  it("normalizes 10-digit number without leading 0", () => {
    expect(normalizePhoneNumber("8031234567")).toBe("+2348031234567");
  });

  it("normalizes international phone numbers with leading plus", () => {
    expect(normalizePhoneNumber("+14155552671")).toBe("+14155552671");
    expect(normalizePhoneNumber("+447911123456")).toBe("+447911123456");
  });

  it("returns null safely for invalid or placeholder values without throwing", () => {
    expect(normalizePhoneNumber("N/A")).toBeNull();
    expect(normalizePhoneNumber("none")).toBeNull();
    expect(normalizePhoneNumber("-")).toBeNull();
    expect(normalizePhoneNumber("nil")).toBeNull();
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("123")).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });
});
