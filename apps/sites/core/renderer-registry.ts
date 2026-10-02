import { Homepage } from "../renderers/obhis-v1/Homepage";

const obhisRenderer = Object.freeze({ key: "obhis-v1", schemaVersion: 1, Homepage });

/** Exact compiled lookup, with no legacy or cross-school fallback. */
export function findPrivateReviewRenderer(key: string, schemaVersion: number) {
  return key === obhisRenderer.key && schemaVersion === obhisRenderer.schemaVersion ? obhisRenderer : null;
}
