import { describe, expect, it } from "vitest";
import {
  buildApplicationLinkV1,
  classifyPaymentReferenceV1,
  isAdmissionsPaymentReferenceV1,
} from "../admissions-foundation";

describe("ApplicationLinkV1", () => {
  it("uses the configured origin and canonical /s/{schoolSlug} route", () => {
    expect(
      buildApplicationLinkV1({
        applicationOrigin: "https://apply.example.test/ignored-path",
        schoolSlug: "north-star-school",
        availability: "open",
      })
    ).toEqual({
      version: "1",
      schoolSlug: "north-star-school",
      href: "https://apply.example.test/s/north-star-school",
      availability: "open",
      intakeSlug: null,
      opensAt: null,
      closesAt: null,
    });
  });

  it("adds only a validated optional intake route", () => {
    expect(
      buildApplicationLinkV1({
        applicationOrigin: "https://apply.example.test",
        schoolSlug: "north-star-school",
        intakeSlug: "2027-entry",
        availability: "upcoming",
        opensAt: 100,
        closesAt: 200,
      })
    ).toMatchObject({
      href: "https://apply.example.test/s/north-star-school/i/2027-entry",
      intakeSlug: "2027-entry",
      availability: "upcoming",
    });
  });

  it("rejects origins and route identifiers that could create an unsafe link", () => {
    expect(() =>
      buildApplicationLinkV1({
        applicationOrigin: "https://user:secret@apply.example.test",
        schoolSlug: "north-star-school",
        availability: "open",
      })
    ).toThrow("bare origin");
    expect(() =>
      buildApplicationLinkV1({
        applicationOrigin: "https://apply.example.test",
        schoolSlug: "../../private",
        availability: "open",
      })
    ).toThrow("URL-safe slug");
  });
});

describe("PaymentReferenceV1", () => {
  it("reserves adm_ references for admissions dispatch", () => {
    expect(classifyPaymentReferenceV1("adm_school_abc")).toEqual({
      version: "1",
      domain: "admissions",
      reference: "adm_school_abc",
    });
    expect(isAdmissionsPaymentReferenceV1("INV-123")).toBe(false);
  });
});
