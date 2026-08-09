import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("the admissions builder submits campaign graphs through atomic commands", () => {
  const source = readFileSync(resolve(process.cwd(), "app/admissions/AdmissionsFormBuilder.tsx"), "utf8");
  expect(source).toContain("createDraftCampaign");
  expect(source).toContain("replaceDraftCampaignConfiguration");
  expect(source).toContain("operationKeyRef");
  expect(source).not.toContain("settings:createProgramme");
  expect(source).not.toContain("settings:addDraftField");
  expect(source).not.toContain("settings:publishForm");
});
