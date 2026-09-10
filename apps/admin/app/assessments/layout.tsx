import type { ReactNode } from "react";
import { StaffWorkspace } from "@/StaffWorkspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <StaffWorkspace fullBleed>{children}</StaffWorkspace>;
}
