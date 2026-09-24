import { makeFunctionReference } from "convex/server";
import type { ActionCtx } from "../../_generated/server";
import type { TableNames } from "../../_generated/dataModel";
import schema from "../../schema";
import registry from "../../schemaCoverageRegistry.json";
import { checkSchemaCoverage, schemaReferenceInventory, type TableCoverage } from "../../schemaCoverage";

const emptyTableRef = makeFunctionReference<"query", { tableName: TableNames }, boolean>(
  "functions/academic/demoPreflight:hasApplicationRowInternal",
);

// Validate the reviewed registry before trusting it as the table inventory.
// Derive the manifest arguments from the schema here: this is an emptiness
// gate, not a tenant purge or a permission to delete data.
export function emptyDeploymentTableNames(): TableNames[] {
  const actual = schemaReferenceInventory(schema);
  const indexed = Object.entries(actual)
    .filter(([name, row]) => row.directSchool && row.bySchool && name !== "branchSettingOverrides" && name !== "roleTemplates")
    .map(([name]) => name);
  const storage = indexed.filter((name) => actual[name].references.some((ref) => ref.target === "_storage"));
  const errors = checkSchemaCoverage(actual, registry as Record<string, TableCoverage>, indexed, [], storage);
  if (errors.length) throw new Error(`Demo empty-deployment registry is unclassified: ${errors.join("; ")}`);
  return Object.keys(actual) as TableNames[];
}

// Each read is its own transaction. Only a boolean crosses the action boundary;
// never return an orphan row or its contents to the operator.
export async function inspectEmptyDeployment(ctx: Pick<ActionCtx, "runQuery">): Promise<string[]> {
  const names = emptyDeploymentTableNames();
  const blockers: string[] = [];
  for (const tableName of names) {
    try {
      if (await ctx.runQuery(emptyTableRef, { tableName })) blockers.push(`${tableName}: deployment table is not empty`);
    } catch {
      blockers.push(`${tableName}: empty-deployment inspection failed`);
    }
  }
  return blockers;
}
