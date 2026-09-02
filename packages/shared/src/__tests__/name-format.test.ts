import { describe, expect, it } from "vitest";
import {
  cleanPhoneInput,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeHumanName,
  normalizePersonName,
} from "../name-format";

describe("normalizeHumanName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeHumanName("  john   doe  ")).toBe("John Doe");
  });

  it("handles hyphens and apostrophes", () => {
    expect(normalizeHumanName("jean-luc o'neill")).toBe("Jean-Luc O'Neill");
  });

  it("preserves short uppercase acronyms and alnum tokens", () => {
    expect(normalizeHumanName("JSS 1A")).toBe("JSS 1A");
    expect(normalizeHumanName("ICT")).toBe("ICT");
    expect(normalizeHumanName("SS1")).toBe("SS1");
  });

  it("uppercases the first letter after a digit boundary", () => {
    expect(normalizeHumanName("class 1a")).toBe("Class 1A");
  });

  it("keeps very short roman numerals uppercase", () => {
    expect(normalizeHumanName("john paul ii")).toBe("John Paul II");
    expect(normalizeHumanName("henry iv")).toBe("Henry IV");
  });

  it("strictly title-cases person names", () => {
    expect(normalizePersonName("SANI khadija")).toBe("Sani Khadija");
    expect(normalizePersonName("MARYAM")).toBe("Maryam");
  });
});

describe("cleanPhoneInput and isValidPhoneNumber", () => {
  it("strips letters, @, and email domains from phone typing", () => {
    expect(cleanPhoneInput("u.danjuma@yahoo.com")).toBe("");
    expect(cleanPhoneInput("+234 802 123 4567")).toBe("+234 802 123 4567");
    expect(cleanPhoneInput("080-123-4567")).toBe("080-123-4567");
    expect(cleanPhoneInput("+234abc8012345678")).toBe("+2348012345678");
  });

  it("validates phone numbers strictly", () => {
    expect(isValidPhoneNumber("")).toBe(true);
    expect(isValidPhoneNumber("+234 802 123 4567")).toBe(true);
    expect(isValidPhoneNumber("08012345678")).toBe(true);
    expect(isValidPhoneNumber("u.danjuma@yahoo.com")).toBe(false);
    expect(isValidPhoneNumber("12345")).toBe(false); // too short (<7 digits)
  });

  it("validates email addresses strictly", () => {
    expect(isValidEmailAddress("")).toBe(true);
    expect(isValidEmailAddress("parent@example.com")).toBe(true);
    expect(isValidEmailAddress("u.danjuma@yahoo.com")).toBe(true);
    expect(isValidEmailAddress("invalid-email")).toBe(false);
    expect(isValidEmailAddress("+2348021234567")).toBe(false);
  });
});
