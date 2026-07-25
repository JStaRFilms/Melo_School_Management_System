import type { ReactNode } from "react";
import type { SiteRenderContext } from "@/core/contracts";

export interface SiteRouteDefinition {
  key: string;
  path: string;
  indexable?: boolean;
}

export interface SiteRenderer<TData = unknown> {
  readonly key: string;
  readonly schemaVersion: string;
  readonly routes: readonly SiteRouteDefinition[];
  validateRendererData(input: Readonly<Record<string, unknown>>): TData | null;
  /** Optional concrete, published paths for a compile-time dynamic route pattern. */
  sitemapPaths?(data: TData): readonly string[];
  render(context: SiteRenderContext<TData>): ReactNode;
}
