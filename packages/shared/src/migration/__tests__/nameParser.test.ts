import { describe, expect, it } from "vitest";
import { parseHumanName, cleanTitleCase } from "../nameParser";

describe("nameParser", () => {
  it("parses Nigerian surname comma format: 'ADEYEMI, Babatunde Tunde'", () => {
    const result = parseHumanName("ADEYEMI, Babatunde Tunde");
    expect(result.lastName).toBe("Adeyemi");
    expect(result.firstName).toBe("Babatunde");
    expect(result.middleName).toBe("Tunde");
    expect(result.fullName).toBe("Babatunde Tunde Adeyemi");
  });

  it("parses standard two-token format: 'Chukwuemeka Okonkwo'", () => {
    const result = parseHumanName("Chukwuemeka Okonkwo");
    expect(result.firstName).toBe("Chukwuemeka");
    expect(result.lastName).toBe("Okonkwo");
    expect(result.middleName).toBeUndefined();
    expect(result.fullName).toBe("Chukwuemeka Okonkwo");
  });

  it("parses three-token format without comma: 'Babatunde Tunde Adeyemi'", () => {
    const result = parseHumanName("Babatunde Tunde Adeyemi");
    expect(result.firstName).toBe("Babatunde");
    expect(result.middleName).toBe("Tunde");
    expect(result.lastName).toBe("Adeyemi");
  });

  it("handles compound prefixes and hyphenated names", () => {
    const hyphenResult = parseHumanName("Okafor-Smith, Chioma");
    expect(hyphenResult.lastName).toBe("Okafor-Smith");
    expect(hyphenResult.firstName).toBe("Chioma");

    const vanDerResult = parseHumanName("Lucas van der Beek");
    expect(vanDerResult.firstName).toBe("Lucas");
    expect(vanDerResult.lastName).toBe("Van Der Beek");
  });

  it("handles single-name inputs cleanly", () => {
    const single = parseHumanName("Abdullahi");
    expect(single.firstName).toBe("Abdullahi");
    expect(single.lastName).toBe("");
    expect(single.fullName).toBe("Abdullahi");
  });

  it("cleans title case and trims extraneous spaces", () => {
    expect(cleanTitleCase("  babatunde   adeyemi  ")).toBe("Babatunde Adeyemi");
    expect(cleanTitleCase("CHUKWUEMEKA")).toBe("Chukwuemeka");
  });
});
