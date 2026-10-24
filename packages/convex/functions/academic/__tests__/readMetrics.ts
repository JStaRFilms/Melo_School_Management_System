import type { RegisteredQuery } from "convex/server";
import type { QueryCtx } from "../../../_generated/server";

/** Convex exposes this at runtime but strips the internal property from its .d.ts. */
export function queryHandler<Args extends Record<string, unknown>, Result>(query: RegisteredQuery<"public" | "internal", Args, Result>) {
  if (!("_handler" in query) || typeof query._handler !== "function") throw Error("Missing registered query handler");
  return query._handler as (ctx: QueryCtx, args: Args) => Result;
}

/** Test-only returned-document proxies, not Convex billing or scanned-row metrics. */
export function observeReads(reader: QueryCtx["db"]) {
  const metrics = { queries: 0, gets: 0, documents: 0, jsonDocumentBytes: 0 };
  const tables: string[] = [];
  const record = (value: unknown) => {
    const rows: unknown[] = Array.isArray(value) ? value : value == null ? [] : [value];
    for (const row of rows) {
      metrics.documents++;
      metrics.jsonDocumentBytes += new TextEncoder().encode(JSON.stringify(row)).byteLength;
    }
  };
  const terminals = new Set(["collect", "take", "unique", "first", "get"]);
  function wrap<T extends object>(target: T): T {
    return new Proxy(target, {
      get(object, property, receiver) {
        const value: unknown = Reflect.get(object, property, receiver);
        if (property === "system" && value !== null && typeof value === "object") return wrap(value);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (property === "query") {
            metrics.queries++;
            if (typeof args[0] === "string") tables.push(args[0]);
          }
          if (property === "get") metrics.gets++;
          const result: unknown = Reflect.apply(value, object, args);
          if (terminals.has(String(property))) {
            return Promise.resolve(result).then((rows: unknown) => { record(rows); return rows; });
          }
          return result !== null && typeof result === "object" ? wrap(result) : result;
        };
      },
    });
  }
  return { db: wrap(reader), metrics, tables };
}
