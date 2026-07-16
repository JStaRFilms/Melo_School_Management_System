import { describe, expect, it } from "vitest";
import { demoPortraitPng, demoPortraitSvg, demoSchoolLogoPng, demoSchoolLogoSvg } from "../demoAssets";
import {
  DEMO_ACCOUNTS,
  DEMO_RESET_CONFIRMATION,
  DEMO_STUDENTS,
  scoreFor,
} from "../demoData";

function decodeStoredRgbaPng(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrLength = view.getUint32(8); expect(new TextDecoder().decode(bytes.slice(12, 16))).toBe("IHDR");
  const width = view.getUint32(16); const height = view.getUint32(20);
  let cursor = 8 + 12 + ihdrLength; let idat: Uint8Array | null = null;
  while (cursor < bytes.length) { const length = view.getUint32(cursor); const type = new TextDecoder().decode(bytes.slice(cursor + 4, cursor + 8)); if (type === "IDAT") idat = bytes.slice(cursor + 8, cursor + 8 + length); cursor += length + 12; }
  expect(idat).not.toBeNull(); expect(idat![0]).toBe(0x78); expect(idat![1]).toBe(0x01);
  let offset = 2; const output: number[] = [];
  while (offset < idat!.length - 4) { const header = idat![offset++]; const length = idat![offset++] | (idat![offset++] << 8); offset += 2; output.push(...idat!.slice(offset, offset + length)); offset += length; if (header & 1) break; }
  expect(output).toHaveLength(height * (width * 4 + 1));
  return { width, height, decodedBytes: output.length };
}

function byteHash(bytes: Uint8Array) { let hash = 2166136261; for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619); return hash >>> 0; }

describe("full demo-school definitions", () => {
  it("has deterministic, unique, classroom-balanced student identities", () => {
    expect(DEMO_STUDENTS).toHaveLength(36);
    expect(new Set(DEMO_STUDENTS.map((student) => student.admissionNumber)).size).toBe(36);
    expect(new Set(DEMO_STUDENTS.map((student) => student.email)).size).toBe(36);
    expect(DEMO_STUDENTS[0].name).toBe("Alice Johnson");
    expect(DEMO_STUDENTS.reduce((counts, student) => {
      counts[student.classIndex] = (counts[student.classIndex] ?? 0) + 1;
      return counts;
    }, [] as number[])).toEqual([12, 12, 12]);
  });

  it("keeps the documented deterministic login compatibility and reset phrase", () => {
    expect(DEMO_ACCOUNTS.admin.email).toBe("admin@demo-academy.school");
    expect(DEMO_ACCOUNTS.teacher.email).toBe("teacher@demo-academy.school");
    expect(DEMO_ACCOUNTS.portal.email).toBe("parent@demo-academy.school");
    expect(DEMO_RESET_CONFIRMATION).toBe("RESET demo-school");
  });

  it("generates frozen local SVG source art and supported raster PNG placeholders without remote image sources", () => {
    expect(demoSchoolLogoSvg()).toContain("<svg");
    const portrait = demoPortraitSvg(DEMO_STUDENTS[0].name, 0);
    expect(portrait).toContain("Synthetic illustrated portrait");
    expect(portrait).not.toMatch(/<image[^>]+(?:href|xlink:href)=/);
    expect(portrait).not.toMatch(/url\(https?:/);
    const logoPng = demoSchoolLogoPng();
    const portraitPng = demoPortraitPng(0);
    expect([...logoPng.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect([...portraitPng.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(logoPng.byteLength).toBeLessThan(1_000_000);
    expect(portraitPng.byteLength).toBeLessThan(1_000_000);
    expect(decodeStoredRgbaPng(logoPng)).toMatchObject({ width: 256, height: 256 });
    expect(decodeStoredRgbaPng(portraitPng)).toMatchObject({ width: 192, height: 192 });
    const portraits = DEMO_STUDENTS.map((_, index) => demoPortraitPng(index));
    expect(new Set(portraits.map(byteHash)).size).toBe(36);
    expect(portraits.every((image) => image.byteLength < 1_000_000)).toBe(true);
  });

  it("produces bounded, repeatable assessment score components", () => {
    expect(scoreFor(4, 2, 1)).toEqual(scoreFor(4, 2, 1));
    for (const studentIndex of [0, 17, 35]) {
      const score = scoreFor(studentIndex, 6, 2);
      expect(score.ca1).toBeGreaterThanOrEqual(10);
      expect(score.ca2).toBeLessThanOrEqual(19);
      expect(score.ca3).toBeLessThanOrEqual(19);
      expect(score.examRawScore).toBeGreaterThanOrEqual(0);
      expect(score.examRawScore).toBeLessThanOrEqual(40);
      expect(score.total).toBe(score.ca1 + score.ca2 + score.ca3 + score.examRawScore);
    }
  });
});
