import type { ReactNode } from "react";
import Link from "next/link";
import { StaffWorkspace } from "@/StaffWorkspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <StaffWorkspace fullBleed>
      <nav
        aria-label="Billing charge classes"
        className="flex flex-wrap gap-4 p-4 text-sm"
      >
        <Link href="/billing">School fees</Link>
        <Link href="/billing/subscription">Melo subscription</Link>
        <Link href="/billing/usage">Usage and allowances</Link>
        <Link href="/billing/settlements">Collection settlements</Link>
      </nav>
      {children}
    </StaffWorkspace>
  );
}
