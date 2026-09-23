import type { SchemaDefinition } from "convex/server";
import type { ValidatorJSON } from "convex/values";

type Field = { fieldType: ValidatorJSON; optional: boolean };
export type ReferencePath = { path: string; target: string; optional: boolean };
export type TableCoverage = {
  ownership: "direct-indexed" | "direct-unindexed" | "indirect" | "shared-or-global" | "operator-global";
  reason: string;
  references: ReferencePath[];
  bySchool: boolean;
  storage: Record<string, "legacy-extractor" | "school-logo" | "unsupported-block-reset" | "inventory-not-owner">;
  shape: string;
};

function validatorFingerprint(value: ValidatorJSON): string {
  const text = JSON.stringify(value);
  let first = 2166136261;
  let second = 5381;
  for (let i = 0; i < text.length; i += 1) {
    first = Math.imul(first ^ text.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ text.charCodeAt(i);
  }
  return `${text.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

// Use the exported validator tree, not a regex over schema.ts. Arrays and
// records have stable path markers; union arms are deduplicated by path/target.
export function schemaReferenceInventory(schema: SchemaDefinition<any, any>): Record<string, {
  references: ReferencePath[]; bySchool: boolean; directSchool: boolean; shape: string;
}> {
  const inventory: Record<string, { references: ReferencePath[]; bySchool: boolean; directSchool: boolean; shape: string }> = {};
  // Convex exposes export() at runtime, though SchemaDefinition's public TS
  // declaration does not include it. The offline coverage test exercises it.
  const exported = JSON.parse((schema as SchemaDefinition<any, any> & { export(): string }).export()) as { tables: Array<{
    tableName: string;
    documentType: ValidatorJSON;
    indexes: Array<{ indexDescriptor: string; fields: string[] }>;
  }> };
  for (const table of exported.tables) {
    const refs = new Map<string, ReferencePath>();
    function visit(node: ValidatorJSON, path: string, optional: boolean): void {
      switch (node.type) {
        case "id": {
          const ref = { path, target: node.tableName, optional };
          const key = `${path}:${node.tableName}`;
          const prior = refs.get(key);
          refs.set(key, { ...ref, optional: optional && (prior?.optional ?? true) });
          break;
        }
        case "object":
          for (const [field, entry] of Object.entries(node.value) as Array<[string, Field]>) {
            visit(entry.fieldType, path ? `${path}.${field}` : field, optional || entry.optional);
          }
          break;
        case "array": visit(node.value, `${path}[]`, optional); break;
        case "record":
          visit(node.keys, `${path}{key}`, optional);
          visit(node.values.fieldType, `${path}{value}`, optional || node.values.optional);
          break;
        case "union": for (const member of node.value) visit(member, path, optional); break;
        case "any":
          // The path itself must be reviewed: a schema change under v.any cannot be observed.
          refs.set(`${path}:opaque`, { path, target: "opaque-any", optional });
          break;
      }
    }
    visit(table.documentType, "", false);
    const references = [...refs.values()].sort((a, b) => a.path.localeCompare(b.path) || a.target.localeCompare(b.target));
    inventory[table.tableName] = {
      references,
      // Full validator shape catches scalar changes too. No runtime data is read.
      shape: validatorFingerprint(table.documentType),
      directSchool: references.some((ref) => ref.path === "schoolId" && ref.target === "schools"),
      bySchool: table.indexes.some((index) => index.indexDescriptor === "by_school" && index.fields.length === 1 && index.fields[0] === "schoolId"),
    };
  }
  return inventory;
}

export function checkSchemaCoverage(
  actual: ReturnType<typeof schemaReferenceInventory>,
  registry: Record<string, TableCoverage>,
  purgeTables: readonly string[],
  demoTables: readonly string[],
  storageTables: readonly string[],
): string[] {
  const errors: string[] = [];
  const actualNames = new Set(Object.keys(actual));
  const purge = new Set(purgeTables);
  const demo = new Set(demoTables);
  const storage = new Set(storageTables);
  // Both are explicitly queried and removed with by_school in tenantPurge.ts.
  const specialIndexed = new Set(["branchSettingOverrides", "roleTemplates"]);
  for (const name of actualNames) {
    const entry = registry[name];
    const row = actual[name];
    if (!entry) { errors.push(`${name}: unclassified table`); continue; }
    // The operator reservation names a school but belongs to the deployment,
    // not to the tenant purge. This is the only reviewed exception.
    const operatorGlobal = name === "demoResetOperations" && entry.ownership === "operator-global";
    const expected = operatorGlobal ? "operator-global" : row.directSchool ? (row.bySchool ? "direct-indexed" : "direct-unindexed") :
      entry.ownership === "indirect" ? "indirect" : "shared-or-global";
    if (entry.ownership !== expected) errors.push(`${name}: ownership changed (${expected})`);
    if (entry.bySchool !== row.bySchool) errors.push(`${name}: by_school index changed`);
    if (entry.shape !== row.shape) errors.push(`${name}: validator shape changed`);
    if (!entry.reason.trim()) errors.push(`${name}: missing ownership reason`);
    const signature = (ref: ReferencePath) => `${ref.path}:${ref.target}:${ref.optional}`;
    const expectedRefs = new Set(entry.references.map(signature));
    const foundRefs = new Set(row.references.map(signature));
    for (const ref of foundRefs) if (!expectedRefs.has(ref)) errors.push(`${name}: unclassified reference ${ref}`);
    for (const ref of expectedRefs) if (!foundRefs.has(ref)) errors.push(`${name}: removed/changed reference ${ref}`);
    const storagePaths = new Set(row.references.filter((ref) => ref.target === "_storage").map((ref) => ref.path));
    for (const path of storagePaths) if (!entry.storage?.[path]) errors.push(`${name}: unclassified storage path ${path}`);
    for (const [path, disposition] of Object.entries(entry.storage ?? {})) {
      if (!storagePaths.has(path)) errors.push(`${name}: obsolete storage path ${path}`);
      if (disposition === "inventory-not-owner" && (name !== "demoResetOperations" ||
          !["storageCandidateIds[]", "storageAcknowledgedIds[]", "retainedStorageIds[]"].includes(path))) {
        errors.push(`${name}: inventory-not-owner is only reviewed for demoResetOperations storage arrays`);
      }
    }
    if (row.directSchool && row.bySchool && !operatorGlobal && !purge.has(name) && !specialIndexed.has(name)) errors.push(`${name}: indexed direct school table absent from tenant purge manifest`);
    if (row.directSchool && row.bySchool && storagePaths.size && !storage.has(name)) errors.push(`${name}: storage references absent from tenant storage plan`);
    if (purge.has(name) && (!row.directSchool || !row.bySchool)) errors.push(`${name}: purge manifest requires indexed schoolId`);
    if (row.directSchool && !row.bySchool && purge.has(name)) errors.push(`${name}: cannot use by_school purge without index`);
    if (demo.has(name) && (!row.directSchool || !row.bySchool)) errors.push(`${name}: demo reset expects indexed schoolId`);
    if (storage.has(name) && !purge.has(name)) errors.push(`${name}: storage plan requires indexed tenant purge table`);
  }
  for (const [label, names] of [["registry", Object.keys(registry)], ["purge", purgeTables], ["demo", demoTables], ["storage", storageTables]] as const) {
    for (const name of names) if (!actualNames.has(name)) errors.push(`${label}: unknown table ${name}`);
    if (new Set(names).size !== names.length) errors.push(`${label}: duplicate table`);
  }
  return errors.sort();
}
