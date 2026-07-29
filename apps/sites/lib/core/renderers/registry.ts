import { legacyTemplateRenderer } from "@/renderers/legacy-template/adapter";
import { obhisRenderer } from "@/renderers/obhis-v1/definition";
import type { SiteRenderer } from "@/core/renderers/contract";

/** Compile-time allowlist. Database content may select only a key in this map. */
const renderers = new Map<string, SiteRenderer>([
  [legacyTemplateRenderer.key, legacyTemplateRenderer],
  [obhisRenderer.key, obhisRenderer],
]);

export function getRenderer(key: string, schemaVersion: string): SiteRenderer | null {
  const renderer = renderers.get(key);
  return renderer?.schemaVersion === schemaVersion ? renderer : null;
}

export function registeredRendererKeys(): readonly string[] {
  return [...renderers.keys()];
}
