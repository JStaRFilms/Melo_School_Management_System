import type { ReactNode } from "react";
import { StaffWorkspace } from "@/lib/StaffWorkspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <StaffWorkspace fullBleed>{children}</StaffWorkspace>;
}
