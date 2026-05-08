"use client";

import { isConvexConfigured } from "@/convex-runtime";
import type { PortalWorkspaceMode } from "@/portal-types";
import { PortalPreview } from "./portal-workspace/PortalPreview";
import { PortalWorkspaceContent } from "./portal-workspace/PortalWorkspaceContent";

export function PortalWorkspace({ mode }: { mode: PortalWorkspaceMode }) {
  if (!isConvexConfigured()) {
    return <PortalPreview mode={mode} />;
  }

  return <PortalWorkspaceContent mode={mode} />;
}
