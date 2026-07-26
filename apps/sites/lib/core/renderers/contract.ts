import type { ReactNode } from "react";
import type { RendererValidationInput, SiteRenderContext } from "@/core/contracts";

export interface SiteRouteDefinition {
  key: string;
  path: string;
  indexable?: boolean;
}

export interface SiteRenderer<TData = unknown> {
  readonly key: string;
  readonly schemaVersion: string;
  readonly routes: readonly SiteRouteDefinition[];
  validateRendererData(input: RendererValidationInput): TData | null;
  /** Reject a declared route when its required approved content is absent. */
  isRouteAvailable?(data: TData, routeKey: string, params: Readonly<Record<string, string>>, context: Pick<SiteRenderContext, "links" | "request">): boolean;
  /** A renderable route may still be non-indexable while required public content is incomplete. */
  isRouteIndexable?(data: TData, routeKey: string, params: Readonly<Record<string, string>>, context: Pick<SiteRenderContext, "links" | "request">): boolean;
  /** Optional concrete, published paths for a compile-time dynamic route pattern. */
  sitemapPaths?(data: TData): readonly string[];
  render(context: SiteRenderContext<TData>): ReactNode;
}
