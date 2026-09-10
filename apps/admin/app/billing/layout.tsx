import type { ReactNode } from "react";
import Link from "next/link";
import { StaffWorkspace } from "@/StaffWorkspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <StaffWorkspace fullBleed>
      <div className="h-full w-full flex flex-col min-h-0">
        <nav
          aria-label="Billing charge classes"
          className="sr-only"
        >
          <Link href="/billing">School fees</Link>
        </nav>
        <div className="flex-1 min-h-0 w-full h-full">
          {children}
        </div>
      </div>
    </StaffWorkspace>
  );
}
