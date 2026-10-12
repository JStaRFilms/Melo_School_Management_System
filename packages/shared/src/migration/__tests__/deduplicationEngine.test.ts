import { describe, expect, it } from "vitest";
import {
  jaroDistance,
  jaroWinkler,
  computeNameSimilarity,
  evaluateClash,
  generateFamilyClusterKey,
} from "../deduplicationEngine";

describe("deduplicationEngine", () => {
  describe("jaroWinkler", () => {
    it("returns 1.0 for identical strings", () => {
      expect(jaroWinkler("Babatunde", "Babatunde")).toBe(1.0);
    });

    it("computes high similarity for typos and prefixes", () => {
      const sim = jaroWinkler("Adeyemi", "Adeyemii");
      expect(sim).toBeGreaterThan(0.9);
    });

    it("returns 0.0 for completely disjoint strings", () => {
      expect(jaroDistance("abc", "xyz")).toBe(0.0);
    });
  });

  describe("computeNameSimilarity", () => {
    it("handles nickname / prefix variations like 'Tunde Adeyemi' and 'Babatunde Adeyemi'", () => {
      const score = computeNameSimilarity(
        { firstName: "Tunde", lastName: "Adeyemi" },
        { firstName: "Babatunde", lastName: "Adeyemi" }
      );
      expect(score).toBeGreaterThan(0.8);
    });

    it("handles inverted first/last names", () => {
      const score = computeNameSimilarity(
        { firstName: "Adeyemi", lastName: "Babatunde" },
        { firstName: "Babatunde", lastName: "Adeyemi" }
      );
      expect(score).toBeGreaterThan(0.9);
    });
  });

  describe("evaluateClash", () => {
    it.each([
      { name: "Mary Anne De La Cruz", firstName: "", lastName: "" },
      { firstName: "Mary", middleName: "Anne", lastName: "De La Cruz" },
      { name: "De La Cruz Mary Anne", firstName: "", lastName: "" },
    ])("compares full-name-only records against $name $firstName without inferring parts", (other) => {
      const legacy = { name: "Mary Anne De La Cruz", firstName: "", lastName: "", className: "JSS 1A" };
      expect(evaluateClash(legacy, { ...other, className: "JSS 1A" }).isWarning).toBe(true);
      expect(legacy).toEqual({ name: "Mary Anne De La Cruz", firstName: "", lastName: "", className: "JSS 1A" });
    });

    it.each([
      { name: "Zainab Adeyemi", firstName: "", lastName: "" },
      { firstName: "Zainab", lastName: "Adeyemi" },
      { name: "", firstName: "", lastName: "" },
      { name: "Amina", firstName: "", lastName: "" },
      { firstName: "Amina Adeyemi", lastName: "" },
    ])("rejects full-name sibling, nameless and incomplete evidence against $name $firstName", (other) => {
      const common = { className: "JSS 1A", guardianPhone: "08031234567", gender: "Female" };
      expect(evaluateClash(
        { ...common, name: "Amina Adeyemi", firstName: "", lastName: "" },
        { ...common, ...other },
      )).toMatchObject({ isWarning: false, isClash: false });
    });

    it("preserves exact admission collisions for nameless records", () => {
      const record = { name: "", firstName: "", lastName: "", admissionNumber: "SCH/2026/001" };
      expect(evaluateClash(record, record)).toMatchObject({ isClash: true, isWarning: true, confidence: 100 });
    });

    it("flags a high-confidence clash (>= 85%) for similar names + same class + same phone", () => {
      const result = evaluateClash(
        {
          firstName: "Babatunde",
          lastName: "Adeyemi",
          className: "JSS 1A",
          guardianPhone: "08031234567",
          gender: "Male",
        },
        {
          firstName: "Tunde",
          lastName: "Adeyemi",
          className: "JSS 1A",
          guardianPhone: "+2348031234567",
          gender: "Male",
        }
      );

      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.isClash).toBe(true);
      expect(result.isWarning).toBe(true);
    });

    it("flags a warning (50% - 84%) for similar names in the same class without matching phone", () => {
      const result = evaluateClash(
        {
          firstName: "Babatunde",
          lastName: "Adeyemi",
          className: "JSS 1A",
          gender: "Male",
        },
        {
          firstName: "Tunde",
          lastName: "Adeyemi",
          className: "JSS 1A",
          gender: "Male",
        }
      );

      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.isWarning).toBe(true);
    });

    it("does not warn for unrelated classmates with incidental name overlap", () => {
      const result = evaluateClash(
        {
          firstName: "Hauwa",
          lastName: "Ibrahim",
          className: "Secondary 3",
          gender: "Female",
        },
        {
          firstName: "Damilola",
          lastName: "Bello",
          className: "Secondary 3",
          gender: "Female",
        }
      );

      expect(result.confidence).toBeGreaterThanOrEqual(50);
      expect(result.isClash).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it("does not treat a shared surname and similar class labels as a duplicate", () => {
      const result = evaluateClash(
        {
          firstName: "Uche",
          lastName: "Ogunleye",
          className: "SSS 1A",
          guardianPhone: "+2346001192019",
          gender: "Female",
        },
        {
          firstName: "Ebi",
          lastName: "Ogunleye",
          className: "JSS 1A",
          guardianPhone: "+2346001142004",
          gender: "Male",
        },
      );

      expect(result.isClash).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it("does not treat a shared guardian phone without name evidence as a duplicate", () => {
      const result = evaluateClash(
        {
          firstName: "Amina",
          lastName: "Adeyemi",
          guardianPhone: "08031234567",
        },
        {
          firstName: "Chukwuemeka",
          lastName: "Okonkwo",
          guardianPhone: "+2348031234567",
        }
      );

      expect(result.isClash).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it("returns < 50% for completely distinct individuals in different classes", () => {
      const result = evaluateClash(
        {
          firstName: "Chukwuemeka",
          lastName: "Okonkwo",
          className: "JSS 1A",
          guardianPhone: "08011111111",
          gender: "Male",
        },
        {
          firstName: "Fatima",
          lastName: "Abdullahi",
          className: "SS 3C",
          guardianPhone: "08099999999",
          gender: "Female",
        }
      );

      expect(result.confidence).toBeLessThan(50);
      expect(result.isClash).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it("immediately gives 100% collision for matching admission numbers", () => {
      const result = evaluateClash(
        {
          firstName: "Alice",
          lastName: "Smith",
          admissionNumber: "SCH/2026/001",
        },
        {
          firstName: "Bob",
          lastName: "Jones",
          admissionNumber: "SCH/2026/001",
        }
      );

      expect(result.confidence).toBe(100);
      expect(result.isClash).toBe(true);
    });
  });

  describe("generateFamilyClusterKey", () => {
    it("generates deterministic key for identical normalized phones", () => {
      const key1 = generateFamilyClusterKey("08031234567");
      const key2 = generateFamilyClusterKey("+234 803 123 4567");
      expect(key1).toBe("fam_2348031234567");
      expect(key1).toBe(key2);
    });

    it("returns undefined for invalid or missing phones", () => {
      expect(generateFamilyClusterKey("")).toBeUndefined();
      expect(generateFamilyClusterKey("N/A")).toBeUndefined();
      expect(generateFamilyClusterKey(null)).toBeUndefined();
    });
  });
});
