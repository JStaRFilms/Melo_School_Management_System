"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceDefaultHref } from "@school/shared";

/**
 * /switch-areas now redirects to the first real section.
 * Area switching lives inline in the shared navbar.
 */
export default function AdminSwitchAreasPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getWorkspaceDefaultHref("admin"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-slate-400" style={{ fontSize: 13 }}>Redirecting...</div>
    </div>
  );
}
