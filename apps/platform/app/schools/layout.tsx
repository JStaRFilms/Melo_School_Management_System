import type { ReactNode } from "react";
import { SchoolsLayoutClient } from "./SchoolsLayoutClient";

export default function SchoolsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <SchoolsLayoutClient>{children}</SchoolsLayoutClient>;
}
