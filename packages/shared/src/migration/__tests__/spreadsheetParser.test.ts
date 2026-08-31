import { describe, expect, it } from "vitest";
import {
  parseCSVToMatrix,
  parseSpreadsheetContent,
  matchHeaderToField,
  normalizeGender,
} from "../spreadsheetParser";

describe("spreadsheetParser", () => {
  it("parses CSV content with headers, quotes, and commas", () => {
    const csv = `First Name,Last Name,Class,Gender,Guardian Phone,Bus Stop,Genotype
Tunde,Adeyemi,JSS 1A,Male,08031234567,Palmgrove,AA
Chioma,Okafor,JSS 1B,Female,08099887766,Maryland,AS`;

    const result = parseSpreadsheetContent(csv);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0].parsedData.firstName).toBe("Tunde");
    expect(result.rows[0].parsedData.lastName).toBe("Adeyemi");
    expect(result.rows[0].parsedData.className).toBe("JSS 1A");
    expect(result.rows[0].parsedData.guardianPhone).toBe("+2348031234567");

    // Check metadata attic / unmapped fields
    expect(result.rows[0].parsedData.unmappedFields).toEqual({
      "Bus Stop": "Palmgrove",
      "Genotype": "AA",
    });

    // Check detected feature signals
    expect(result.unrecognizedHeaders.map((h) => h.header)).toContain("Bus Stop");
    expect(result.unrecognizedHeaders.map((h) => h.header)).toContain("Genotype");
  });

  it("handles full name column when separate first/last names are not provided", () => {
    const csv = `Student Name,Class,Gender
"ADEYEMI, Babatunde Tunde",JSS 1A,M`;

    const result = parseSpreadsheetContent(csv);
    expect(result.totalRows).toBe(1);
    expect(result.rows[0].parsedData.firstName).toBe("Babatunde");
    expect(result.rows[0].parsedData.lastName).toBe("Adeyemi");
    expect(result.rows[0].parsedData.middleName).toBe("Tunde");
    expect(result.rows[0].parsedData.gender).toBe("Male");
  });

  it("identifies academic grade record rows", () => {
    const csv = `Student Name,Class,Subject,CA1,CA2,Exam
Babatunde Adeyemi,JSS 1A,Mathematics,18,17,55`;

    const result = parseSpreadsheetContent(csv);
    expect(result.rows[0].entityType).toBe("grade_record");
    expect(result.rows[0].parsedData.subjectName).toBe("Mathematics");
    expect(result.rows[0].parsedData.ca1).toBe(18);
    expect(result.rows[0].parsedData.ca2).toBe(17);
    expect(result.rows[0].parsedData.exam).toBe(55);
  });

  it("normalizes gender strings", () => {
    expect(normalizeGender("M")).toBe("Male");
    expect(normalizeGender("Male")).toBe("Male");
    expect(normalizeGender("F")).toBe("Female");
    expect(normalizeGender("Female")).toBe("Female");
    expect(normalizeGender("")).toBe("Unspecified");
    expect(normalizeGender("Other")).toBe("Unspecified");
  });
});
