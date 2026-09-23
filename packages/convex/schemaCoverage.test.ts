import { expect, test } from "vitest";
import schema from "./schema";
import registry from "./schemaCoverageRegistry.json";
import { checkSchemaCoverage, schemaReferenceInventory, type TableCoverage } from "./schemaCoverage";
import { TENANT_SCHOOL_TABLES } from "./functions/academic/tenantPurgeManifest";
import { TENANT_STORAGE_TABLES } from "./functions/academic/tenantPurgeAction";
import { DEMO_SCHOOL_TABLES } from "./functions/academic/seed";

const coverage = registry as Record<string, TableCoverage>;
const current = () => schemaReferenceInventory(schema);
const check = (inventory: ReturnType<typeof current>) =>
  checkSchemaCoverage(inventory, coverage, TENANT_SCHOOL_TABLES, DEMO_SCHOOL_TABLES, TENANT_STORAGE_TABLES);

test("all schema tables, typed reference paths and indexed purge entries are reviewed", () => {
  expect(check(current())).toEqual([]);
});

test("new table and nested storage path fail before a maintainer classifies them", () => {
  const inventory = current();
  inventory.futureTable = { bySchool: false, directSchool: false, references: [], shape: "new" };
  inventory.students = { ...inventory.students, shape: "changed-validator-shape" };
  inventory.students = {
    ...inventory.students,
    references: [...inventory.students.references, { path: "documents[].fileId", target: "_storage", optional: true }],
  };
  expect(check(inventory)).toEqual(expect.arrayContaining([
    "futureTable: unclassified table",
    "students: unclassified reference documents[].fileId:_storage:true",
    "students: unclassified storage path documents[].fileId",
    "students: validator shape changed",
  ]));
});

test("direct schoolId without by_school and nested storage are not lost", () => {
  const inventory = current();
  expect(inventory.admissionNumberClaims.directSchool).toBe(true);
  expect(inventory.admissionNumberClaims.bySchool).toBe(false);
  expect(inventory.usageBranchPoolAllocations.directSchool).toBe(true);
  expect(inventory.usageBranchPoolAllocations.bySchool).toBe(false);
  expect(Object.values(inventory).flatMap((row) => row.references).some((ref) => ref.target === "_storage" && ref.path.includes("."))).toBe(true);
});
