import { describe, expect, it } from "vitest";
import { validateKnowledgeMaterialPdfSelection } from "../KnowledgeMaterialUploadForm";

describe("knowledge material PDF entitlement preflight", () => {
  it("uses a lower active-entitlement page cap", () => {
    expect(validateKnowledgeMaterialPdfSelection({
      pageCount: 21,
      selectedPageRanges: "",
      maxPagesPerOperation: 20,
    })).toContain("at most 20 pages");

    expect(validateKnowledgeMaterialPdfSelection({
      pageCount: 21,
      selectedPageRanges: "1-21",
      maxPagesPerOperation: 20,
    })).toContain("at most 20 PDF pages");
  });

  it("retains the hard 80-page ceiling for larger entitlements", () => {
    expect(validateKnowledgeMaterialPdfSelection({
      pageCount: 81,
      selectedPageRanges: "",
      maxPagesPerOperation: 500,
    })).toContain("at most 80 pages");
  });
});
