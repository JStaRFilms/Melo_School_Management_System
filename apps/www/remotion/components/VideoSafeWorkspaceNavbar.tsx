import React from "react";
import {
  WorkspaceNavbar,
  type WorkspaceNavbarProps,
} from "../../../../packages/shared/src/components/WorkspaceNavbar";
import type { WorkspaceKey } from "../../../../packages/shared/src/workspace-navigation";

export interface VideoSafeWorkspaceNavbarProps {
  workspace: WorkspaceKey;
  currentPath: string;
  userName: string;
  userRole: string;
  fullBleed?: boolean;
  children?: React.ReactNode;
}

export function VideoSafeWorkspaceNavbar({
  workspace,
  currentPath,
  userName,
  userRole,
  fullBleed = false,
  children,
}: VideoSafeWorkspaceNavbarProps) {
  return (
    <WorkspaceNavbar
      workspace={workspace}
      currentPath={currentPath}
      fullBleed={fullBleed}
      userName={userName}
      userRole={userRole}
      renderLink={({
        className,
        children: linkChildren,
      }: Parameters<WorkspaceNavbarProps["renderLink"]>[0]) => (
        <span className={className}>{linkChildren}</span>
      )}
    >
      <div className="h-full w-full bg-slate-50">{children}</div>
    </WorkspaceNavbar>
  );
}
