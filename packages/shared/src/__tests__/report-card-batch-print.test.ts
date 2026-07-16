import { describe, expect, it } from "vitest";

import { calculateBatchPrintScale } from "../components/ReportCardBatchPrintStackV2";

describe("batch report-card page fitting", () => {
  it("keeps report cards that already fit at full scale", () => {
    expect(calculateBatchPrintScale(900)).toBe(1);
  });

  it("scales oversized report cards down to the printable A4 height", () => {
    const scale = calculateBatchPrintScale(1200);

    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.8);
    expect(calculateBatchPrintScale(1200)).toBe(scale);
  });

  it("fits a 100-student batch independently without cumulative drift", () => {
    const contentHeights = Array.from(
      { length: 100 },
      (_, index) => 980 + (index % 5) * 70
    );
    const scales = contentHeights.map(calculateBatchPrintScale);

    expect(scales[0]).toBe(scales[5]);
    expect(scales[4]).toBe(scales[99]);
    scales.forEach((scale, index) => {
      expect(scale).toBe(calculateBatchPrintScale(contentHeights[index]));
      expect(scale).toBeGreaterThan(0);
      expect(scale).toBeLessThanOrEqual(1);
    });
  });

  it("does not produce invalid scale values while layout is settling", () => {
    expect(calculateBatchPrintScale(0)).toBe(1);
    expect(calculateBatchPrintScale(Number.NaN)).toBe(1);
  });
});
