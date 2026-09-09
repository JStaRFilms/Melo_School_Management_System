import type { ReactNode } from "react";
import { PlatformLayoutClient } from "@/PlatformLayoutClient";

export default function AuditLayout({ children }: { children: ReactNode }) {
  return <PlatformLayoutClient>{children}</PlatformLayoutClient>;
}
