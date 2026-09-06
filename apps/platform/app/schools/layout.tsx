import type { ReactNode } from "react";
import Link from "next/link";
import { SchoolsLayoutClient } from "./SchoolsLayoutClient";

export default function SchoolsLayout({ children }: { children: ReactNode }) {
  return (
    <SchoolsLayoutClient>
      <nav
        aria-label="Governance"
        className="mb-4 flex flex-wrap gap-4 text-sm"
      >
        <Link className="underline" href="/groups">
          School groups
        </Link>
        <Link className="underline" href="/audit">
          Audit explorer
        </Link>
      </nav>
      {children}
    </SchoolsLayoutClient>
  );
}
